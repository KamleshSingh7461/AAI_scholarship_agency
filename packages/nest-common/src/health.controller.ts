import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from './auth/decorators';
import { APP_CONFIG, PRISMA } from './tokens';
import type { BaseConfig } from './config';
import { RabbitMqService } from './messaging/rabbitmq.service';
import { RedisService } from './redis/redis.service';

@ApiExcludeController()
@Controller('health')
export class HealthController {
  constructor(
    @Inject(PRISMA) private readonly prisma: any,
    @Inject(APP_CONFIG) private readonly config: BaseConfig,
    private readonly rabbit: RabbitMqService,
    private readonly redis: RedisService,
  ) {}

  /** Liveness: the process is up. */
  @Public()
  @Get()
  live() {
    return { status: 'ok', service: this.config.serviceName };
  }

  /** Readiness: dependencies reachable. Used by load balancers / k8s before routing traffic. */
  @Public()
  @Get('ready')
  async ready() {
    const checks: Record<string, boolean> = {};
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      checks.database = true;
    } catch {
      checks.database = false;
    }
    checks.redis = await this.redis.ping();
    checks.rabbitmq = this.rabbit.isConnected;
    const ok = Object.values(checks).every(Boolean);
    const body = { status: ok ? 'ready' : 'degraded', service: this.config.serviceName, checks };
    if (!ok) throw new ServiceUnavailableException(body);
    return body;
  }
}
