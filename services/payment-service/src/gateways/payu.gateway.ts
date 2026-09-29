import { createHash, timingSafeEqual } from 'node:crypto';
import type { PaymentOrder } from '../generated/prisma';
import type { PaymentConfig } from '../config';
import { GatewayError, rupees, type CreatedOrder, type GatewayStatus, type PaymentGateway, type WebhookResult } from './gateway';

const sha512 = (s: string) => createHash('sha512').update(s).digest('hex');

/**
 * PayU India hosted checkout (form POST) with reverse-hash verification and the verify_payment API.
 * https://docs.payu.in/docs/generate-hash-merchant-hosted · https://docs.payu.in/reference/verify_payment_api
 */
export class PayuGateway implements PaymentGateway {
  readonly name = 'PAYU' as const;
  private readonly action: string;
  private readonly postservice: string;

  constructor(private readonly cfg: PaymentConfig) {
    if (!cfg.env.PAYU_MERCHANT_KEY || !cfg.env.PAYU_MERCHANT_SALT) throw new Error('PAYU_MERCHANT_KEY and PAYU_MERCHANT_SALT are required');
    const prod = cfg.env.PAYU_ENV === 'production';
    this.action = prod ? 'https://secure.payu.in/_payment' : 'https://test.payu.in/_payment';
    this.postservice = prod ? 'https://info.payu.in/merchant/postservice.php?form=2' : 'https://test.payu.in/merchant/postservice.php?form=2';
  }

  private get key() {
    return this.cfg.env.PAYU_MERCHANT_KEY!;
  }
  private get salt() {
    return this.cfg.env.PAYU_MERCHANT_SALT!;
  }

  async createOrder(order: PaymentOrder, urls: { callbackUrl: string }): Promise<CreatedOrder> {
    const c = order.customer as { name: string; email?: string; phone: string };
    const txnid = order.orderNo.slice(0, 25);
    const amount = rupees(order.amount);
    const productinfo = order.purpose;
    const firstname = c.name.split(' ')[0].slice(0, 60) || 'Athlete';
    const email = c.email || 'noemail@alumniconnectindia.com';
    const udf1 = order.id;
    const hash = sha512(`${this.key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${udf1}||||||||||${this.salt}`);
    return {
      providerOrderId: txnid,
      checkout: {
        type: 'payu',
        action: this.action,
        fields: {
          key: this.key,
          txnid,
          amount,
          productinfo,
          firstname,
          email,
          phone: c.phone.replace(/^\+91/, ''),
          surl: urls.callbackUrl,
          furl: urls.callbackUrl,
          udf1,
          hash,
        },
      },
    };
  }

  /** Verifies the reverse hash PayU posts back to surl/furl. */
  verifyResponseHash(p: Record<string, string>): boolean {
    const base = `${this.salt}|${p.status}||||||${p.udf5 ?? ''}|${p.udf4 ?? ''}|${p.udf3 ?? ''}|${p.udf2 ?? ''}|${p.udf1 ?? ''}|${p.email}|${p.firstname}|${p.productinfo}|${p.amount}|${p.txnid}|${this.key}`;
    const expected = sha512(p.additionalCharges ? `${p.additionalCharges}|${base}` : base);
    const a = Buffer.from(expected);
    const b = Buffer.from(String(p.hash ?? ''));
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async verifyClientReturn(order: PaymentOrder, p: Record<string, string>) {
    if (!this.verifyResponseHash(p) || p.txnid !== order.providerOrderId) throw new GatewayError('payu', 'Invalid response hash');
    // Defence in depth: confirm with PayU's verify API before trusting the browser-posted status.
    return this.fetchStatus(order);
  }

  async parseWebhook(_h: Record<string, string | string[] | undefined>, raw: Buffer): Promise<WebhookResult | null> {
    const p = Object.fromEntries(new URLSearchParams(raw.toString('utf8')));
    if (!this.verifyResponseHash(p)) throw new GatewayError('payu', 'Invalid webhook hash');
    const status = p.status === 'success' ? 'PAID' : p.status === 'failure' ? 'FAILED' : 'IGNORED';
    return {
      eventId: `${p.mihpayid}:${p.status}`,
      eventType: `payu.${p.status}`,
      orderNo: p.txnid,
      providerOrderId: p.txnid,
      status,
      providerPaymentId: p.mihpayid,
      amount: Math.round(Number(p.amount) * 100),
      failureReason: p.error_Message,
    };
  }

  private async postservicecall(command: string, var1: string, extra: Record<string, string> = {}) {
    const body = new URLSearchParams({ key: this.key, command, var1, hash: sha512(`${this.key}|${command}|${var1}|${this.salt}`), ...extra });
    const res = await fetch(this.postservice, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
    const text = await res.text();
    if (!res.ok) throw new GatewayError('payu', `HTTP ${res.status}: ${text.slice(0, 200)}`);
    try {
      return JSON.parse(text);
    } catch {
      throw new GatewayError('payu', `Unexpected response: ${text.slice(0, 200)}`);
    }
  }

  async fetchStatus(order: PaymentOrder) {
    const txnid = order.providerOrderId ?? order.orderNo;
    const r = await this.postservicecall('verify_payment', txnid);
    const d = r.transaction_details?.[txnid];
    if (!d) return { status: 'PENDING' as GatewayStatus };
    if (d.status === 'success') {
      if (Math.round(Number(d.amt ?? d.transaction_amount) * 100) !== Number(order.amount)) {
        return { status: 'FAILED' as GatewayStatus, failureReason: 'Amount mismatch' };
      }
      return { status: 'PAID' as GatewayStatus, providerPaymentId: String(d.mihpayid) };
    }
    if (d.status === 'failure') return { status: 'FAILED' as GatewayStatus, failureReason: d.error_Message ?? d.field9 };
    return { status: 'PENDING' as GatewayStatus };
  }

  async refund(order: PaymentOrder, amountMinor: number, refundNo: string) {
    if (!order.providerPaymentId) throw new GatewayError('payu', 'No mihpayid to refund');
    const r = await this.postservicecall('cancel_refund_transaction', order.providerPaymentId, { var2: refundNo.slice(0, 23), var3: rupees(amountMinor) });
    if (Number(r.status) !== 1) throw new GatewayError('payu', r.msg ?? 'Refund rejected');
    return { providerRefundId: String(r.request_id ?? r.mihpayid ?? refundNo) };
  }
}
