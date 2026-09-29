import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { APP_CONFIG, type BaseConfig } from '@aci/nest-common';
import { PrismaClient } from './generated/prisma';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(APP_CONFIG) config: BaseConfig) {
    super({ datasources: { db: { url: config.databaseUrl } } });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
