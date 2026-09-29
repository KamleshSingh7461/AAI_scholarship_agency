import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { APP_CONFIG } from '../tokens';
import type { BaseConfig } from '../config';

const RELEASE_LOCK = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(@Inject(APP_CONFIG) config: BaseConfig) {
    this.client = new Redis(config.redisUrl, {
      lazyConnect: false,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true,
      keyPrefix: 'aci:',
    });
    this.client.on('error', (e) => this.logger.warn(`Redis error: ${e.message}`));
  }

  /**
   * Fixed-window counter. Returns the count after increment and whether it exceeded `limit`.
   */
  async hit(key: string, limit: number, windowSec: number): Promise<{ count: number; limited: boolean; ttl: number }> {
    const res = await this.client.multi().incr(key).expire(key, windowSec, 'NX').ttl(key).exec();
    const count = Number(res?.[0]?.[1] ?? 0);
    const ttl = Number(res?.[2]?.[1] ?? windowSec);
    return { count, limited: count > limit, ttl };
  }

  /**
   * Runs `fn` only if the distributed lock is acquired (used so that cron jobs run on exactly one replica).
   * Returns undefined when another instance holds the lock.
   */
  async withLock<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T | undefined> {
    const token = randomUUID();
    const ok = await this.client.set(`lock:${key}`, token, 'PX', ttlMs, 'NX');
    if (ok !== 'OK') return undefined;
    try {
      return await fn();
    } finally {
      await this.client.eval(RELEASE_LOCK, 1, `lock:${key}`, token).catch(() => undefined);
    }
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.quit().catch(() => undefined);
  }
}
