import { Inject, Injectable, Logger, OnApplicationBootstrap, SetMetadata } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import type { EventEnvelope, EventType } from '@aci/contracts';
import { APP_CONFIG, PRISMA } from '../tokens';
import type { BaseConfig } from '../config';
import { RabbitMqService } from './rabbitmq.service';

export const EVENT_HANDLER = 'aci:event_handler';

export interface EventContext {
  /** Prisma interactive transaction; write through it so the handler and the inbox marker commit together. */
  tx: any;
  event: EventEnvelope;
}

/**
 * Marks a provider method as a handler for one or more event types.
 * Signature: `(data: T, ctx: EventContext) => Promise<void>`.
 */
export const OnEvent = (...types: EventType[]) => SetMetadata(EVENT_HANDLER, types);

interface Handler {
  name: string;
  fn: (data: unknown, ctx: EventContext) => Promise<void>;
}

/**
 * Discovers @OnEvent handlers and binds one durable queue per service. Each handler runs in a
 * DB transaction together with an inbox row (processed_events), which makes redelivery idempotent.
 */
@Injectable()
export class EventConsumerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EventConsumerService.name);
  private readonly handlers = new Map<string, Handler[]>();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
    private readonly rabbit: RabbitMqService,
    @Inject(PRISMA) private readonly prisma: any,
    @Inject(APP_CONFIG) private readonly config: BaseConfig,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    for (const wrapper of this.discovery.getProviders()) {
      const instance = wrapper.instance;
      if (!instance || typeof instance !== 'object') continue;
      const proto = Object.getPrototypeOf(instance);
      for (const method of this.scanner.getAllMethodNames(proto)) {
        const types = this.reflector.get<EventType[]>(EVENT_HANDLER, proto[method]);
        if (!types?.length) continue;
        for (const t of types) {
          const list = this.handlers.get(t) ?? [];
          list.push({ name: `${proto.constructor.name}.${method}`, fn: proto[method].bind(instance) });
          this.handlers.set(t, list);
        }
      }
    }
    if (!this.handlers.size) return;
    // Do not block startup on the broker; subscription completes once it is reachable.
    void this.rabbit
      .subscribe({
        queue: `${this.config.serviceName}.events`,
        routingKeys: [...this.handlers.keys()],
        onMessage: (env) => this.dispatch(env),
      })
      .catch((err) => this.logger.error(`Subscribe failed: ${err.message}`));
  }

  private async dispatch(envelope: EventEnvelope): Promise<void> {
    const handlers = this.handlers.get(envelope.type) ?? [];
    for (const h of handlers) {
      await this.prisma.$transaction(
        async (tx: any) => {
          const seen = await tx.processedEvent.findUnique({
            where: { eventId_handler: { eventId: envelope.id, handler: h.name } },
          });
          if (seen) return;
          await h.fn(envelope.data, { tx, event: envelope });
          await tx.processedEvent.create({ data: { eventId: envelope.id, handler: h.name } });
        },
        { timeout: 60_000, maxWait: 10_000 },
      );
    }
  }
}
