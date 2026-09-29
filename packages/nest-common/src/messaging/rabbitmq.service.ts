import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import * as amqp from 'amqplib';
import type { ConfirmChannel, ConsumeMessage, Options } from 'amqplib';
import type { EventEnvelope } from '@aci/contracts';
import { APP_CONFIG } from '../tokens';
import type { BaseConfig } from '../config';

export const EVENTS_EXCHANGE = 'aci.events';
const RETRY_DELAY_MS = 15_000;
export const MAX_DELIVERY_ATTEMPTS = 6;

type Connection = Awaited<ReturnType<typeof amqp.connect>>;

export interface QueueBinding {
  queue: string;
  routingKeys: string[];
  prefetch?: number;
  onMessage: (envelope: EventEnvelope, raw: ConsumeMessage) => Promise<void>;
}

/**
 * Durable topic-exchange messaging with publisher confirms, automatic reconnect,
 * a delayed retry queue per consumer and a dead-letter queue after MAX_DELIVERY_ATTEMPTS.
 */
@Injectable()
export class RabbitMqService implements OnApplicationShutdown {
  private readonly logger = new Logger(RabbitMqService.name);
  private connection?: Connection;
  private pubChannel?: ConfirmChannel;
  private connecting?: Promise<void>;
  private bindings: QueueBinding[] = [];
  private closing = false;

  constructor(@Inject(APP_CONFIG) private readonly config: BaseConfig) {}

  get isConnected(): boolean {
    return !!this.pubChannel;
  }

  async ensureConnected(): Promise<void> {
    if (this.pubChannel) return;
    if (!this.connecting) {
      this.connecting = this.connect().finally(() => (this.connecting = undefined));
    }
    return this.connecting;
  }

  private async connect(): Promise<void> {
    let attempt = 0;
    while (!this.closing) {
      try {
        const conn = await amqp.connect(this.config.rabbitmqUrl, { clientProperties: { connection_name: this.config.serviceName } });
        conn.on('error', (err) => this.logger.error(`RabbitMQ connection error: ${err.message}`));
        conn.on('close', () => {
          this.pubChannel = undefined;
          this.connection = undefined;
          if (!this.closing) {
            this.logger.warn('RabbitMQ connection closed, reconnecting...');
            setTimeout(() => void this.ensureConnected().catch(() => undefined), 2000);
          }
        });
        const ch = await conn.createConfirmChannel();
        await ch.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });
        this.connection = conn;
        this.pubChannel = ch;
        for (const b of this.bindings) await this.setupConsumer(b);
        this.logger.log('Connected to RabbitMQ');
        return;
      } catch (err) {
        attempt++;
        const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5));
        this.logger.warn(`RabbitMQ connect failed (${(err as Error).message}); retry in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  async publish(envelope: EventEnvelope): Promise<void> {
    await this.ensureConnected();
    const ch = this.pubChannel;
    if (!ch) throw new Error('RabbitMQ channel unavailable');
    const opts: Options.Publish = {
      persistent: true,
      contentType: 'application/json',
      messageId: envelope.id,
      type: envelope.type,
      timestamp: Math.floor(Date.now() / 1000),
      appId: this.config.serviceName,
      headers: { 'x-correlation-id': envelope.correlationId },
    };
    await new Promise<void>((resolve, reject) => {
      ch.publish(EVENTS_EXCHANGE, envelope.type, Buffer.from(JSON.stringify(envelope)), opts, (err) =>
        err ? reject(err) : resolve(),
      );
    });
  }

  async subscribe(binding: QueueBinding): Promise<void> {
    this.bindings.push(binding);
    await this.ensureConnected();
    // setupConsumer already ran inside connect() if we were not connected before.
    if (this.connection && !(binding as any).__active) await this.setupConsumer(binding);
  }

  private async setupConsumer(b: QueueBinding): Promise<void> {
    if (!this.connection) return;
    const ch = await this.connection.createChannel();
    const retryQ = `${b.queue}.retry`;
    const deadQ = `${b.queue}.dead`;
    await ch.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });
    await ch.assertQueue(b.queue, { durable: true });
    await ch.assertQueue(retryQ, {
      durable: true,
      arguments: { 'x-message-ttl': RETRY_DELAY_MS, 'x-dead-letter-exchange': '', 'x-dead-letter-routing-key': b.queue },
    });
    await ch.assertQueue(deadQ, { durable: true });
    for (const key of b.routingKeys) await ch.bindQueue(b.queue, EVENTS_EXCHANGE, key);
    await ch.prefetch(b.prefetch ?? 10);
    (b as any).__active = true;

    await ch.consume(b.queue, async (msg) => {
      if (!msg) return;
      const attempts = Number(msg.properties.headers?.['x-attempts'] ?? 0) + 1;
      let envelope: EventEnvelope | undefined;
      try {
        envelope = JSON.parse(msg.content.toString('utf8')) as EventEnvelope;
        await b.onMessage(envelope, msg);
        ch.ack(msg);
      } catch (err) {
        const target = attempts < MAX_DELIVERY_ATTEMPTS && envelope ? retryQ : deadQ;
        this.logger.error(
          `Handler failed for ${envelope?.type ?? 'unparseable'} ${envelope?.id ?? ''} (attempt ${attempts}) -> ${target}: ${(err as Error).message}`,
        );
        ch.sendToQueue(target, msg.content, {
          persistent: true,
          contentType: 'application/json',
          messageId: msg.properties.messageId,
          type: msg.properties.type,
          headers: { ...msg.properties.headers, 'x-attempts': attempts, 'x-last-error': String((err as Error).message).slice(0, 500) },
        });
        ch.ack(msg);
      }
    });
    this.logger.log(`Consuming ${b.queue} <- [${b.routingKeys.join(', ')}]`);
  }

  async onApplicationShutdown(): Promise<void> {
    this.closing = true;
    try {
      await this.connection?.close();
    } catch {
      /* ignore */
    }
  }
}
