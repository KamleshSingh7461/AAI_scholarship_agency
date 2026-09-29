import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_CONFIG, CoreModule } from '@aci/nest-common';
import { config, type EsignConfig } from './config';
import { PrismaService } from './prisma.service';
import { EsignService } from './esign.service';
import { DocusignProvider, ESIGN_PROVIDER, MockEsignProvider } from './providers';
import {
  AthleteEnvelopeController,
  EnvelopeExpiryJob,
  EsignWebhookController,
  InternalEnvelopeController,
  StaffEnvelopeController,
} from './esign.controller';

@Module({
  imports: [CoreModule.forRoot({ config, prisma: PrismaService }), ScheduleModule.forRoot()],
  controllers: [AthleteEnvelopeController, EsignWebhookController, StaffEnvelopeController, InternalEnvelopeController],
  providers: [
    EsignService,
    EnvelopeExpiryJob,
    {
      provide: ESIGN_PROVIDER,
      inject: [APP_CONFIG],
      useFactory: (c: EsignConfig) => (c.env.ESIGN_PROVIDER === 'docusign' ? new DocusignProvider(c) : new MockEsignProvider(c)),
    },
  ],
})
export class AppModule {}
