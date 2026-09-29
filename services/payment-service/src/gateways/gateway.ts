import type { PaymentOrder } from '../generated/prisma';

export type GatewayStatus = 'PAID' | 'FAILED' | 'PENDING';

export interface CreatedOrder {
  providerOrderId: string;
  /** Everything the browser needs to open the gateway's checkout. */
  checkout: Record<string, unknown>;
}

export interface WebhookResult {
  eventId: string;
  eventType: string;
  /** Our orderNo or the gateway's order id — whichever the payload carries. */
  orderNo?: string;
  providerOrderId?: string;
  status: GatewayStatus | 'REFUNDED' | 'IGNORED';
  providerPaymentId?: string;
  /** Amount in minor units as reported by the gateway, to cross-check against our order. */
  amount?: number;
  failureReason?: string;
}

export interface PaymentGateway {
  readonly name: 'RAZORPAY' | 'CASHFREE' | 'PAYU' | 'MOCK';
  createOrder(order: PaymentOrder, urls: { returnUrl: string; notifyUrl: string; callbackUrl: string }): Promise<CreatedOrder>;
  /** Verifies what the browser sends back after checkout (never trusted without verification). */
  verifyClientReturn(order: PaymentOrder, payload: Record<string, string>): Promise<{ status: GatewayStatus; providerPaymentId?: string; failureReason?: string }>;
  /** Throws if the signature is invalid. Returns null for events we do not care about. */
  parseWebhook(headers: Record<string, string | string[] | undefined>, rawBody: Buffer): Promise<WebhookResult | null>;
  /** Server-to-server status check used by the reconciliation job. */
  fetchStatus(order: PaymentOrder): Promise<{ status: GatewayStatus; providerPaymentId?: string; failureReason?: string }>;
  refund(order: PaymentOrder, amountMinor: number, refundNo: string): Promise<{ providerRefundId: string }>;
}

export class GatewayError extends Error {
  constructor(provider: string, message: string, readonly status?: number) {
    super(`[${provider}] ${message}`);
  }
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export const rupees = (minor: bigint | number) => (Number(minor) / 100).toFixed(2);
export const header = (h: Record<string, string | string[] | undefined>, name: string) => {
  const v = h[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
};

export async function httpJson(provider: string, url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 15_000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }
    if (!res.ok) throw new GatewayError(provider, `HTTP ${res.status}: ${(json.error?.description ?? json.message ?? text).toString().slice(0, 300)}`, res.status);
    return json;
  } finally {
    clearTimeout(t);
  }
}
