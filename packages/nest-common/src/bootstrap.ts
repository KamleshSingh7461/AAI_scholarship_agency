import 'reflect-metadata';
import { INestApplication, Type, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import type { BaseConfig } from './config';

// Prisma returns BigInt for money columns; serialise them as numbers (safe below 2^53 minor units).
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

export interface BootstrapOptions {
  config: BaseConfig;
  /** Keep the raw request body (needed to verify webhook signatures). */
  rawBody?: boolean;
  /** JSON body size limit (default 2mb). */
  jsonLimit?: string;
  title?: string;
  configure?: (app: NestExpressApplication) => void | Promise<void>;
}

export async function bootstrapService(AppModule: Type<unknown>, opts: BootstrapOptions): Promise<INestApplication> {
  const { config } = opts;
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: opts.rawBody ?? false,
  });
  app.useLogger(app.get(Logger));
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
  app.useBodyParser('json', { limit: opts.jsonLimit ?? '2mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableShutdownHooks();

  if (!config.isProd) {
    const doc = new DocumentBuilder()
      .setTitle(opts.title ?? `${config.serviceName} service`)
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, doc));
  }

  if (opts.configure) await opts.configure(app);
  await app.listen(config.port, '0.0.0.0');
  app.get(Logger).log(`${config.serviceName} listening on :${config.port} (${config.appEnv})`);
  return app;
}
