import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EventEnvelope, EventType } from '@aci/contracts';
import { APP_CONFIG, PRISMA } from '../tokens';
import type { BaseConfig } from '../config';
import { RabbitMqService } from './rabbitmq.service';

/** Minimal shape of a Prisma transaction client that has the outbox model. */
export interface OutboxTx {
  outboxEvent: { create(args: { data: { id: string; type: string; payload: any } }): Promise<unknown> };
}

/**
 * Transactional outbox. Services write events in the SAME database transaction as the
 * state change, so an event is published if and only if the change committed.
 * A relay publishes pending rows to RabbitMQ (at-least-once; consumers de-duplicate).
 */
@Injectable()
export class OutboxService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private kick = false;

  constructor(
    @Inject(PRISMA) private readonly prisma: any,
    @Inject(APP_CONFIG) private readonly config: BaseConfig,
    private readonly rabbit: RabbitMqService,
  ) {}

  async add<T>(tx: OutboxTx, type: EventType, data: T, correlationId?: string): Promise<EventEnvelope<T>> {
    const envelope: EventEnvelope<T> = {
      id: randomUUID(),
      type,
      version: 1,
      source: this.config.serviceName,
      occurredAt: new Date().toISOString(),
      correlationId,
      data,
    };
    await tx.outboxEvent.create({ data: { id: envelope.id, type, payload: envelope as any } });
    this.kick = true;
    setTimeout(() => void this.flush(), 50);
    return envelope;
  }

  onApplicationBootstrap(): void {
    if (!this.prisma?.outboxEvent) return;
    this.timer = setInterval(() => void this.flush(), 1000);
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async flush(): Promise<void> {
    if (this.running) {
      this.kick = true;
      return;
    }
    this.running = true;
    try {
      do {
        this.kick = false;
        const published = await this.publishBatch();
        if (published === 100) this.kick = true;
      } while (this.kick);
    } catch (err) {
      this.logger.warn(`Outbox flush failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async publishBatch(): Promise<number> {
    if (!this.rabbit.isConnected) {
      await this.rabbit.ensureConnected();
    }
    return this.prisma.$transaction(
      async (tx: any) => {
        const rows: { id: string; payload: EventEnvelope }[] = await tx.$queryRawUnsafe(
          `SELECT id, payload FROM outbox_events WHERE published_at IS NULL ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED`,
        );
        const done: string[] = [];
        for (const row of rows) {
          try {
            await this.rabbit.publish(row.payload);
            done.push(row.id);
          } catch (err) {
            await tx.$executeRawUnsafe(
              `UPDATE outbox_events SET attempts = attempts + 1, last_error = $1 WHERE id = $2::uuid`,
              String((err as Error).message).slice(0, 500),
              row.id,
            );
            break; // keep ordering: stop at the first failure
          }
        }
        if (done.length) {
          await tx.$executeRawUnsafe(
            `UPDATE outbox_events SET published_at = now() WHERE id = ANY($1::uuid[])`,
            done,
          );
        }
        return rows.length;
      },
      { timeout: 30_000 },
    );
  }
}
