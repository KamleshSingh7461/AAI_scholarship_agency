import { DynamicModule, Global, Module, Type } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, DiscoveryModule } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { APP_CONFIG, PRISMA } from './tokens';
import type { BaseConfig } from './config';
import { AuthGuard } from './auth/auth.guard';
import { JwtVerifier } from './auth/jwt-verifier';
import { AllExceptionsFilter } from './exception.filter';
import { HealthController } from './health.controller';
import { InternalHttpClient } from './http/internal-http.client';
import { RabbitMqService } from './messaging/rabbitmq.service';
import { OutboxService } from './messaging/outbox.service';
import { EventConsumerService } from './messaging/event-consumer.service';
import { RedisService } from './redis/redis.service';
import { AuditService } from './audit.service';

export interface CoreModuleOptions {
  config: BaseConfig;
  /** The service's PrismaService class (extends its generated PrismaClient). */
  prisma: Type<unknown>;
}

@Global()
@Module({})
export class CoreModule {
  static forRoot(opts: CoreModuleOptions): DynamicModule {
    const { config } = opts;
    return {
      module: CoreModule,
      global: true,
      imports: [
        DiscoveryModule,
        LoggerModule.forRoot({
          pinoHttp: {
            level: config.logLevel,
            name: config.serviceName,
            genReqId: (req, res) => {
              const id = (req.headers['x-request-id'] as string) || randomUUID();
              res.setHeader('x-request-id', id);
              return id;
            },
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.headers["x-internal-token"]',
                'res.headers["set-cookie"]',
              ],
              censor: '[redacted]',
            },
            autoLogging: { ignore: (req) => (req.url ?? '').startsWith('/health') },
            transport: config.isProd || config.nodeEnv === 'production'
              ? undefined
              : { target: 'pino-pretty', options: { singleLine: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } },
          },
        }),
      ],
      controllers: [HealthController],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        opts.prisma,
        { provide: PRISMA, useExisting: opts.prisma },
        JwtVerifier,
        InternalHttpClient,
        RedisService,
        RabbitMqService,
        OutboxService,
        EventConsumerService,
        AuditService,
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
      ],
      exports: [
        APP_CONFIG,
        PRISMA,
        opts.prisma,
        JwtVerifier,
        InternalHttpClient,
        RedisService,
        RabbitMqService,
        OutboxService,
        AuditService,
      ],
    };
  }
}
