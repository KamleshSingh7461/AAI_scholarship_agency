import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_CONFIG, CoreModule } from '@aci/nest-common';
import { config, type PaymentConfig } from './config';
import { PrismaService } from './prisma.service';
import { PaymentService } from './payment.service';
import { InternalPaymentController, PaymentController, PaymentWebhookController, ReconciliationJob } from './payment.controller';
import { PAYMENT_GATEWAY } from './gateways/gateway';
import { RazorpayGateway } from './gateways/razorpay.gateway';
import { CashfreeGateway } from './gateways/cashfree.gateway';
import { PayuGateway } from './gateways/payu.gateway';
import { MockGateway } from './gateways/mock.gateway';

@Module({
  imports: [CoreModule.forRoot({ config, prisma: PrismaService }), ScheduleModule.forRoot()],
  // Webhook/mock controller first so its fixed paths win over /payments/:id
  controllers: [PaymentWebhookController, PaymentController, InternalPaymentController],
  providers: [
    PaymentService,
    ReconciliationJob,
    {
      provide: PAYMENT_GATEWAY,
      inject: [APP_CONFIG],
      useFactory: (c: PaymentConfig) => {
        switch (c.env.PAYMENT_PROVIDER) {
          case 'razorpay':
            return new RazorpayGateway(c);
          case 'cashfree':
            return new CashfreeGateway(c);
          case 'payu':
            return new PayuGateway(c);
          default:
            return new MockGateway(c);
        }
      },
    },
  ],
})
export class AppModule {}
