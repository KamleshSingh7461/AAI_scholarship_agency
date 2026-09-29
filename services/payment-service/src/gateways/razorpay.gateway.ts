import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PaymentOrder } from '../generated/prisma';
import type { PaymentConfig } from '../config';
import { GatewayError, header, httpJson, type CreatedOrder, type GatewayStatus, type PaymentGateway, type WebhookResult } from './gateway';

const API = 'https://api.razorpay.com/v1';

function hmacHex(secret: string, data: string | Buffer) {
  return createHmac('sha256', secret).update(data).digest('hex');
}
function safeEq(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Razorpay Orders API + Standard Checkout.
 * https://razorpay.com/docs/api/orders/ · https://razorpay.com/docs/webhooks/validate-test/
 */
export class RazorpayGateway implements PaymentGateway {
  readonly name = 'RAZORPAY' as const;
  private readonly auth: string;

  constructor(private readonly cfg: PaymentConfig) {
    const e = cfg.env;
    if (!e.RAZORPAY_KEY_ID || !e.RAZORPAY_KEY_SECRET) throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required');
    this.auth = 'Basic ' + Buffer.from(`${e.RAZORPAY_KEY_ID}:${e.RAZORPAY_KEY_SECRET}`).toString('base64');
  }

  private call(path: string, init: RequestInit = {}) {
    return httpJson('razorpay', `${API}${path}`, { ...init, headers: { authorization: this.auth, 'content-type': 'application/json', ...(init.headers ?? {}) } });
  }

  async createOrder(order: PaymentOrder): Promise<CreatedOrder> {
    const customer = order.customer as { name: string; email?: string; phone: string };
    const r = await this.call('/orders', {
      method: 'POST',
      body: JSON.stringify({
        amount: Number(order.amount),
        currency: order.currency,
        receipt: order.orderNo.slice(0, 40),
        notes: { orderId: order.id, purpose: order.purpose, referenceId: order.referenceId },
      }),
    });
    return {
      providerOrderId: r.id,
      checkout: {
        type: 'razorpay',
        keyId: this.cfg.env.RAZORPAY_KEY_ID,
        orderId: r.id,
        amount: Number(order.amount),
        currency: order.currency,
        name: this.cfg.env.COMPANY_BRAND_NAME,
        description: order.description,
        prefill: { name: customer.name, email: customer.email ?? undefined, contact: customer.phone },
        notes: { orderNo: order.orderNo },
      },
    };
  }

  async verifyClientReturn(order: PaymentOrder, p: Record<string, string>) {
    const paymentId = p.razorpay_payment_id;
    const signature = p.razorpay_signature;
    if (!paymentId || !signature || p.razorpay_order_id !== order.providerOrderId) {
      return { status: 'FAILED' as GatewayStatus, failureReason: 'Missing or mismatched payment details' };
    }
    const expected = hmacHex(this.cfg.env.RAZORPAY_KEY_SECRET!, `${order.providerOrderId}|${paymentId}`);
    if (!safeEq(expected, signature)) throw new GatewayError('razorpay', 'Invalid payment signature');
    // Signature proves authorization; confirm capture server-side before marking paid.
    const status = await this.fetchStatus(order);
    return { ...status, providerPaymentId: status.providerPaymentId ?? paymentId };
  }

  async parseWebhook(headers: Record<string, string | string[] | undefined>, raw: Buffer): Promise<WebhookResult | null> {
    const secret = this.cfg.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) throw new GatewayError('razorpay', 'RAZORPAY_WEBHOOK_SECRET not configured');
    const sig = header(headers, 'x-razorpay-signature') ?? '';
    if (!safeEq(hmacHex(secret, raw), sig)) throw new GatewayError('razorpay', 'Invalid webhook signature');
    const body = JSON.parse(raw.toString('utf8'));
    const eventId = header(headers, 'x-razorpay-event-id') ?? `${body.event}:${body.payload?.payment?.entity?.id ?? body.created_at}`;
    const pay = body.payload?.payment?.entity;
    const ord = body.payload?.order?.entity;
    switch (body.event) {
      case 'order.paid':
        return { eventId, eventType: body.event, providerOrderId: ord?.id ?? pay?.order_id, status: 'PAID', providerPaymentId: pay?.id, amount: ord?.amount_paid ?? pay?.amount };
      case 'payment.captured':
        return { eventId, eventType: body.event, providerOrderId: pay?.order_id, status: 'PAID', providerPaymentId: pay?.id, amount: pay?.amount };
      case 'payment.failed':
        return { eventId, eventType: body.event, providerOrderId: pay?.order_id, status: 'FAILED', providerPaymentId: pay?.id, failureReason: pay?.error_description };
      case 'refund.processed':
        return { eventId, eventType: body.event, providerOrderId: pay?.order_id, status: 'REFUNDED', providerPaymentId: pay?.id };
      default:
        return { eventId, eventType: body.event, status: 'IGNORED' };
    }
  }

  async fetchStatus(order: PaymentOrder) {
    const o = await this.call(`/orders/${order.providerOrderId}`);
    if (o.status !== 'paid') return { status: 'PENDING' as GatewayStatus };
    const payments = await this.call(`/orders/${order.providerOrderId}/payments`);
    const captured = (payments.items ?? []).find((p: any) => p.status === 'captured');
    return { status: 'PAID' as GatewayStatus, providerPaymentId: captured?.id };
  }

  async refund(order: PaymentOrder, amountMinor: number, refundNo: string) {
    if (!order.providerPaymentId) throw new GatewayError('razorpay', 'No payment id to refund');
    const r = await this.call(`/payments/${order.providerPaymentId}/refund`, {
      method: 'POST',
      body: JSON.stringify({ amount: amountMinor, receipt: refundNo.slice(0, 40), notes: { orderNo: order.orderNo } }),
    });
    return { providerRefundId: r.id };
  }
}
