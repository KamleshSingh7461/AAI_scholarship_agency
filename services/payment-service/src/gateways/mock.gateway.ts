import type { PaymentOrder } from '../generated/prisma';
import type { PaymentConfig } from '../config';
import type { CreatedOrder, GatewayStatus, PaymentGateway, WebhookResult } from './gateway';

/**
 * Local-development gateway. Checkout is a page served by this service with
 * "Pay" / "Fail" buttons, so the full flow works without gateway credentials.
 * Refused at startup when APP_ENV=production.
 */
export class MockGateway implements PaymentGateway {
  readonly name = 'MOCK' as const;
  constructor(private readonly cfg: PaymentConfig) {}

  async createOrder(order: PaymentOrder): Promise<CreatedOrder> {
    return {
      providerOrderId: `mock_${order.orderNo}`,
      checkout: { type: 'mock', url: `${this.cfg.apiPublicUrl}/api/v1/payments/mock/checkout/${order.id}` },
    };
  }

  async verifyClientReturn(order: PaymentOrder) {
    return this.fetchStatus(order);
  }

  async parseWebhook(): Promise<WebhookResult | null> {
    return null;
  }

  async fetchStatus(order: PaymentOrder) {
    const status: GatewayStatus = order.status === 'PAID' ? 'PAID' : order.status === 'FAILED' ? 'FAILED' : 'PENDING';
    return { status, providerPaymentId: order.providerPaymentId ?? undefined };
  }

  async refund(_order: PaymentOrder, _amount: number, refundNo: string) {
    return { providerRefundId: `mock_rf_${refundNo}` };
  }
}
