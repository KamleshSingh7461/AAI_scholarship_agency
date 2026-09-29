import { Module } from '@nestjs/common';
import { APP_CONFIG, CoreModule } from '@aci/nest-common';
import { config, type NotificationConfig } from './config';
import { PrismaService } from './prisma.service';
import { NotificationService } from './notification.service';
import { NotificationEvents } from './notification.events';
import { InternalNotificationController, NotificationController } from './notification.controller';
import { EMAIL_PROVIDER, SMS_PROVIDER, WHATSAPP_PROVIDER } from './providers/provider.types';
import {
  ConsoleEmail,
  ConsoleSms,
  ConsoleWhatsApp,
  MetaWhatsApp,
  Msg91Sms,
  SmtpEmail,
  TwilioSms,
  TwilioWhatsApp,
} from './providers/providers';

@Module({
  imports: [CoreModule.forRoot({ config, prisma: PrismaService })],
  controllers: [NotificationController, InternalNotificationController],
  providers: [
    NotificationService,
    NotificationEvents,
    {
      provide: SMS_PROVIDER,
      inject: [APP_CONFIG],
      useFactory: (c: NotificationConfig) =>
        c.env.SMS_PROVIDER === 'msg91'
          ? new Msg91Sms(c.env)
          : c.env.SMS_PROVIDER === 'twilio'
            ? new TwilioSms(c.env, c.env.COMPANY_BRAND_NAME)
            : new ConsoleSms(),
    },
    {
      provide: WHATSAPP_PROVIDER,
      inject: [APP_CONFIG],
      useFactory: (c: NotificationConfig) =>
        c.env.WHATSAPP_PROVIDER === 'meta'
          ? new MetaWhatsApp(c.env)
          : c.env.WHATSAPP_PROVIDER === 'twilio'
            ? new TwilioWhatsApp(c.env, c.env.COMPANY_BRAND_NAME)
            : new ConsoleWhatsApp(),
    },
    {
      provide: EMAIL_PROVIDER,
      inject: [APP_CONFIG],
      useFactory: (c: NotificationConfig) => (c.env.EMAIL_PROVIDER === 'smtp' ? new SmtpEmail(c.env) : new ConsoleEmail()),
    },
  ],
})
export class AppModule {}
