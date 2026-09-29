import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PaymentOrder } from '../generated/prisma';
import type { PaymentConfig } from '../config';
import { GatewayError, header, httpJson, type CreatedOrder, type GatewayStatus, type PaymentGateway, type WebhookResult } from './gateway';

/**
 * Cashfree Payment Gateway (PG API v2023-08-01) + JS SDK v3 checkout.
 * https://docs.cashfree.com/reference/pg-new-apis-endpoint
 */
export class CashfreeGateway implements PaymentGateway {
  readonly name = 'CASHFREE' as const;
  private readonly base: string;

  constructor(private readonly cfg: PaymentConfig) {
    if (!cfg.env.CASHFREE_APP_ID || !cfg.env.CASHFREE_SECRET_KEY) throw new Error('CASHFREE_APP_ID and CASHFREE_SECRET_KEY are required');
    this.base = cfg.env.CASHFREE_ENV === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
  }

  private call(path: string, init: RequestInit = {}) {
    return httpJson('cashfree', `${this.base}${path}`, {
      ...init,
      headers: {
        'x-client-id': this.cfg.env.CASHFREE_APP_ID!,
        'x-client-secret': this.cfg.env.CASHFREE_SECRET_KEY!,
        'x-api-version': this.cfg.env.CASHFREE_API_VERSION,
        'content-type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
  }

  async createOrder(order: PaymentOrder, urls: { returnUrl: string; notifyUrl: string }): Promise<CreatedOrder> {
    const c = order.customer as { name: string; email?: string; phone: string };
    const r = await this.call('/orders', {
      method: 'POST',
      body: JSON.stringify({
        order_id: order.orderNo,
        order_amount: Number(order.amount) / 100,
        order_currency: order.currency,
        customer_details: {
          customer_id: order.userId.replace(/-/g, '').slice(0, 50),
          customer_name: c.name,
          customer_email: c.email || undefined,
          customer_phone: c.phone.replace(/^\+91/, '').replace(/\D/g, '').slice(-10),
        },
        order_meta: { return_url: urls.returnUrl, notify_url: urls.notifyUrl },
        order_expiry_time: order.expiresAt.toISOString(),
        order_note: order.description.slice(0, 200),
        order_tags: { orderId: order.id, purpose: order.purpose },
      }),
    });
    return {
      providerOrderId: r.order_id,
      checkout: { type: 'cashfree', mode: this.cfg.env.CASHFREE_ENV, paymentSessionId: r.payment_session_id, orderId: r.order_id },
    };
  }

  verifyClientReturn(order: PaymentOrder) {
    // The return URL carries nothing trustworthy; always ask Cashfree.
    return this.fetchStatus(order);
  }

  async parseWebhook(headers: Record<string, string | string[] | undefined>, raw: Buffer): Promise<WebhookResult | null> {
    const ts = header(headers, 'x-webhook-timestamp') ?? '';
    const sig = header(headers, 'x-webhook-signature') ?? '';
    const expected = createHmac('sha256', this.cfg.env.CASHFREE_SECRET_KEY!).update(ts + raw.toString('utf8')).digest('base64');
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new GatewayError('cashfree', 'Invalid webhook signature');
    const body = JSON.parse(raw.toString('utf8'));
    const payment = body.data?.payment ?? {};
    const orderNo = body.data?.order?.order_id;
    const eventId = `${body.type}:${payment.cf_payment_id ?? orderNo}:${ts}`;
    const amount = payment.payment_amount !== undefined ? Math.round(Number(payment.payment_amount) * 100) : undefined;
    switch (body.type) {
      case 'PAYMENT_SUCCESS_WEBHOOK':
        return { eventId, eventType: body.type, orderNo, providerOrderId: orderNo, status: 'PAID', providerPaymentId: String(payment.cf_payment_id), amount };
      case 'PAYMENT_FAILED_WEBHOOK':
      case 'PAYMENT_USER_DROPPED_WEBHOOK':
        return { eventId, eventType: body.type, orderNo, providerOrderId: orderNo, status: 'FAILED', failureReason: payment.payment_message };
      default:
        return { eventId, eventType: body.type ?? 'unknown', status: 'IGNORED' };
    }
  }

  async fetchStatus(order: PaymentOrder) {
    const o = await this.call(`/orders/${encodeURIComponent(order.providerOrderId ?? order.orderNo)}`);
    if (o.order_status === 'PAID') {
      const payments = await this.call(`/orders/${encodeURIComponent(o.order_id)}/payments`);
      const ok = (Array.isArray(payments) ? payments : []).find((p: any) => p.payment_status === 'SUCCESS');
      return { status: 'PAID' as GatewayStatus, providerPaymentId: ok ? String(ok.cf_payment_id) : undefined };
    }
    if (['EXPIRED', 'TERMINATED'].includes(o.order_status)) return { status: 'FAILED' as GatewayStatus, failureReason: `Order ${o.order_status.toLowerCase()}` };
    return { status: 'PENDING' as GatewayStatus };
  }

  async refund(order: PaymentOrder, amountMinor: number, refundNo: string) {
    const r = await this.call(`/orders/${encodeURIComponent(order.providerOrderId ?? order.orderNo)}/refunds`, {
      method: 'POST',
      body: JSON.stringify({ refund_amount: amountMinor / 100, refund_id: refundNo, refund_note: 'Scholarship application fee refund' }),
    });
    return { providerRefundId: String(r.cf_refund_id ?? r.refund_id) };
  }
}
