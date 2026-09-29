import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Events, type PaymentEvent } from '@aci/contracts';
import { APP_CONFIG, AuditService, OutboxService, refNo, type AuthUser } from '@aci/nest-common';
import type { PaymentConfig } from './config';
import { PrismaService } from './prisma.service';
import { PAYMENT_GATEWAY, type PaymentGateway, type WebhookResult } from './gateways/gateway';
import type { PaymentOrder, Prisma } from './generated/prisma';

export interface CreateOrderInput {
  purpose: 'APPLICATION_FEE' | 'RENEWAL_FEE';
  referenceType: string;
  referenceId: string;
  userId: string;
  amount: number;
  taxAmount: number;
  description: string;
  customer: { name: string; phone: string; email?: string | null };
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: PaymentConfig,
    @Inject(PAYMENT_GATEWAY) readonly gateway: PaymentGateway,
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  urls(order: PaymentOrder) {
    const api = this.config.apiPublicUrl;
    return {
      returnUrl: `${this.config.studentWebUrl}/payments/return?orderId=${order.id}`,
      notifyUrl: `${api}/api/v1/payments/webhooks/${this.gateway.name.toLowerCase()}`,
      callbackUrl: `${api}/api/v1/payments/payu/callback`,
    };
  }

  view(o: PaymentOrder) {
    return {
      id: o.id,
      orderNo: o.orderNo,
      purpose: o.purpose,
      referenceType: o.referenceType,
      referenceId: o.referenceId,
      userId: o.userId,
      amount: o.amount,
      taxAmount: o.taxAmount,
      currency: o.currency,
      description: o.description,
      provider: o.provider,
      providerPaymentId: o.providerPaymentId,
      status: o.status,
      expiresAt: o.expiresAt,
      paidAt: o.paidAt,
      failureReason: o.failureReason,
      refundedAmount: o.refundedAmount,
      createdAt: o.createdAt,
    };
  }

  /**
   * Idempotent: an unpaid, unexpired order for the same reference and amount is reused,
   * so double-clicking "Pay" never creates two gateway orders.
   */
  async createOrder(input: CreateOrderInput) {
    if (!Number.isInteger(input.amount) || input.amount < 100) {
      throw new BadRequestException({ message: 'Amount must be at least ₹1', code: 'INVALID_AMOUNT' });
    }
    const paid = await this.prisma.paymentOrder.findFirst({
      where: { referenceType: input.referenceType, referenceId: input.referenceId, purpose: input.purpose, status: 'PAID' },
    });
    if (paid) throw new ConflictException({ message: 'This has already been paid', code: 'ALREADY_PAID', orderId: paid.id });

    const reusable = await this.prisma.paymentOrder.findFirst({
      where: {
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        purpose: input.purpose,
        status: { in: ['CREATED', 'PENDING', 'FAILED'] },
        provider: this.gateway.name,
        amount: BigInt(input.amount),
        expiresAt: { gt: new Date(Date.now() + 5 * 60_000) },
        providerOrderId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (reusable) return { orderId: reusable.id, orderNo: reusable.orderNo, provider: reusable.provider, status: reusable.status, checkout: reusable.checkout };

    const order = await this.prisma.paymentOrder.create({
      data: {
        orderNo: refNo('PAY'),
        purpose: input.purpose,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        userId: input.userId,
        amount: BigInt(input.amount),
        taxAmount: BigInt(input.taxAmount),
        currency: 'INR',
        description: input.description.slice(0, 250),
        customer: input.customer as any,
        provider: this.gateway.name,
        expiresAt: new Date(Date.now() + this.config.env.PAYMENT_ORDER_EXPIRY_MINUTES * 60_000),
      },
    });
    try {
      const created = await this.gateway.createOrder(order, this.urls(order));
      const updated = await this.prisma.paymentOrder.update({
        where: { id: order.id },
        data: { providerOrderId: created.providerOrderId, checkout: created.checkout as any, status: 'PENDING' },
      });
      return { orderId: updated.id, orderNo: updated.orderNo, provider: updated.provider, status: updated.status, checkout: created.checkout };
    } catch (err) {
      await this.prisma.paymentOrder.update({ where: { id: order.id }, data: { status: 'FAILED', failureReason: (err as Error).message.slice(0, 500) } });
      this.logger.error(`Gateway order creation failed: ${(err as Error).message}`);
      throw new ConflictException({ message: 'The payment gateway is unavailable. Please try again in a moment.', code: 'GATEWAY_UNAVAILABLE' });
    }
  }

  private event(o: PaymentOrder, reason?: string): PaymentEvent {
    return {
      orderId: o.id,
      orderNo: o.orderNo,
      purpose: o.purpose as PaymentEvent['purpose'],
      referenceType: o.referenceType,
      referenceId: o.referenceId,
      userId: o.userId,
      amount: Number(o.amount),
      taxAmount: Number(o.taxAmount),
      currency: 'INR',
      provider: o.provider as PaymentEvent['provider'],
      providerPaymentId: o.providerPaymentId ?? undefined,
      occurredAt: (o.paidAt ?? new Date()).toISOString(),
      reason,
    };
  }

  /** Single path to PAID. The conditional update guarantees one payment.succeeded event per order. */
  async markPaid(orderId: string, providerPaymentId?: string, reportedAmount?: number): Promise<PaymentOrder> {
    return this.prisma.$transaction(async (tx) => {
      const o = await tx.paymentOrder.findUniqueOrThrow({ where: { id: orderId } });
      if (o.status === 'PAID' || o.status === 'REFUNDED' || o.status === 'PARTIALLY_REFUNDED') return o;
      if (reportedAmount !== undefined && reportedAmount !== Number(o.amount)) {
        this.logger.error(`Amount mismatch on ${o.orderNo}: gateway ${reportedAmount}, expected ${o.amount}`);
        await tx.paymentOrder.update({ where: { id: o.id }, data: { failureReason: `Amount mismatch: gateway reported ${reportedAmount}` } });
        throw new ConflictException({ message: 'Payment amount mismatch; flagged for manual review', code: 'AMOUNT_MISMATCH' });
      }
      const res = await tx.paymentOrder.updateMany({
        where: { id: o.id, status: { in: ['CREATED', 'PENDING', 'FAILED', 'EXPIRED'] } },
        data: { status: 'PAID', paidAt: new Date(), providerPaymentId: providerPaymentId ?? o.providerPaymentId, failureReason: null },
      });
      const updated = await tx.paymentOrder.findUniqueOrThrow({ where: { id: o.id } });
      if (res.count === 1) await this.outbox.add<PaymentEvent>(tx, Events.PaymentSucceeded, this.event(updated));
      return updated;
    });
  }

  async markFailed(orderId: string, reason?: string): Promise<PaymentOrder> {
    return this.prisma.$transaction(async (tx) => {
      const res = await tx.paymentOrder.updateMany({
        where: { id: orderId, status: { in: ['CREATED', 'PENDING'] } },
        data: { status: 'FAILED', failureReason: reason?.slice(0, 500) ?? 'Payment failed' },
      });
      const o = await tx.paymentOrder.findUniqueOrThrow({ where: { id: orderId } });
      if (res.count === 1) await this.outbox.add<PaymentEvent>(tx, Events.PaymentFailed, this.event(o, reason));
      return o;
    });
  }

  async getForUser(id: string, u: AuthUser, staff: boolean) {
    const o = await this.prisma.paymentOrder.findUnique({ where: { id } });
    if (!o || (!staff && o.userId !== u.id)) throw new NotFoundException({ message: 'Payment not found', code: 'NOT_FOUND' });
    return o;
  }

  /** Browser came back from checkout: verify with the gateway, never trust the redirect itself. */
  async verifyReturn(order: PaymentOrder, payload: Record<string, string>) {
    if (order.status === 'PAID') return order;
    const r = await this.gateway.verifyClientReturn(order, payload);
    await this.prisma.paymentOrder.update({ where: { id: order.id }, data: { lastCheckedAt: new Date() } });
    if (r.status === 'PAID') return this.markPaid(order.id, r.providerPaymentId);
    if (r.status === 'FAILED') return this.markFailed(order.id, r.failureReason);
    return this.prisma.paymentOrder.findUniqueOrThrow({ where: { id: order.id } });
  }

  async handleWebhook(headers: Record<string, string | string[] | undefined>, raw: Buffer) {
    let parsed: WebhookResult | null;
    try {
      parsed = await this.gateway.parseWebhook(headers, raw);
    } catch (err) {
      await this.prisma.paymentWebhookEvent
        .create({ data: { provider: this.gateway.name, eventId: `invalid:${Date.now()}:${Math.random()}`, signatureValid: false, payload: { raw: raw.toString('utf8').slice(0, 5000) }, error: (err as Error).message } })
        .catch(() => undefined);
      this.logger.warn(`Rejected webhook: ${(err as Error).message}`);
      throw new BadRequestException({ message: 'Invalid signature' });
    }
    if (!parsed) return { ok: true };

    // Webhooks are retried by gateways; de-duplicate on the provider's event id.
    const existing = await this.prisma.paymentWebhookEvent.findUnique({ where: { provider_eventId: { provider: this.gateway.name, eventId: parsed.eventId } } });
    if (existing?.processedAt) return { ok: true, duplicate: true };
    const log =
      existing ??
      (await this.prisma.paymentWebhookEvent.create({
        data: { provider: this.gateway.name, eventId: parsed.eventId, eventType: parsed.eventType, signatureValid: true, payload: JSON.parse(safeText(raw)) },
      }));

    const order = await this.prisma.paymentOrder.findFirst({
      where: {
        provider: this.gateway.name,
        OR: [...(parsed.providerOrderId ? [{ providerOrderId: parsed.providerOrderId }] : []), ...(parsed.orderNo ? [{ orderNo: parsed.orderNo }] : [])],
      },
    });
    try {
      if (order) {
        if (parsed.status === 'PAID') await this.markPaid(order.id, parsed.providerPaymentId, parsed.amount);
        else if (parsed.status === 'FAILED') await this.markFailed(order.id, parsed.failureReason);
      }
      await this.prisma.paymentWebhookEvent.update({ where: { id: log.id }, data: { processedAt: new Date(), orderId: order?.id } });
    } catch (err) {
      await this.prisma.paymentWebhookEvent.update({ where: { id: log.id }, data: { error: (err as Error).message.slice(0, 500), orderId: order?.id } });
      throw err;
    }
    return { ok: true };
  }

  async refund(orderId: string, reason: string, actor: AuthUser | null, amount?: number) {
    const o = await this.prisma.paymentOrder.findUniqueOrThrow({ where: { id: orderId } });
    if (!['PAID', 'PARTIALLY_REFUNDED'].includes(o.status)) throw new ConflictException({ message: 'Only paid orders can be refunded', code: 'NOT_PAID' });
    const remaining = Number(o.amount) - Number(o.refundedAmount);
    const amt = amount ?? remaining;
    if (amt <= 0 || amt > remaining) throw new BadRequestException({ message: `Refundable amount is ${remaining / 100}`, code: 'INVALID_AMOUNT' });

    const refund = await this.prisma.refund.create({
      data: { orderId, refundNo: refNo('RF'), amount: BigInt(amt), reason, requestedById: actor?.id },
    });
    try {
      const r = await this.gateway.refund(o, amt, refund.refundNo);
      return this.prisma.$transaction(async (tx) => {
        await tx.refund.update({ where: { id: refund.id }, data: { providerRefundId: r.providerRefundId, status: 'PROCESSED', processedAt: new Date() } });
        const refunded = Number(o.refundedAmount) + amt;
        const updated = await tx.paymentOrder.update({
          where: { id: orderId },
          data: { refundedAmount: BigInt(refunded), status: refunded >= Number(o.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
        });
        await this.outbox.add<PaymentEvent>(tx, Events.PaymentRefunded, { ...this.event(updated, reason), amount: amt, occurredAt: new Date().toISOString() });
        await this.audit.log(actor ?? undefined, { action: 'payment.refund', entityType: 'PaymentOrder', entityId: orderId, after: { amount: amt, reason, refundNo: refund.refundNo } }, tx);
        return updated;
      });
    } catch (err) {
      await this.prisma.refund.update({ where: { id: refund.id }, data: { status: 'FAILED', error: (err as Error).message.slice(0, 500) } });
      throw new ConflictException({ message: `Refund failed: ${(err as Error).message}`, code: 'REFUND_FAILED' });
    }
  }

  /** Reconciliation: catches payments whose webhook never arrived and expires stale orders. */
  async reconcile(): Promise<{ checked: number; paid: number; expired: number }> {
    const stale = await this.prisma.paymentOrder.findMany({
      where: {
        status: { in: ['PENDING', 'CREATED'] },
        createdAt: { lt: new Date(Date.now() - 3 * 60_000) },
        OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(Date.now() - 10 * 60_000) } }],
      },
      take: 100,
    });
    let paid = 0;
    let expired = 0;
    for (const o of stale) {
      try {
        const r = o.providerOrderId ? await this.gateway.fetchStatus(o) : { status: 'PENDING' as const };
        await this.prisma.paymentOrder.update({ where: { id: o.id }, data: { lastCheckedAt: new Date() } });
        if (r.status === 'PAID') {
          await this.markPaid(o.id, (r as { providerPaymentId?: string }).providerPaymentId);
          paid++;
        } else if (o.expiresAt < new Date()) {
          await this.prisma.paymentOrder.updateMany({ where: { id: o.id, status: { in: ['PENDING', 'CREATED'] } }, data: { status: 'EXPIRED' } });
          expired++;
        }
      } catch (err) {
        this.logger.warn(`Reconcile ${o.orderNo} failed: ${(err as Error).message}`);
      }
    }
    return { checked: stale.length, paid, expired };
  }

  async summary(where: Prisma.PaymentOrderWhereInput = {}) {
    const rows = await this.prisma.paymentOrder.groupBy({ by: ['status', 'provider'], where, _count: { _all: true }, _sum: { amount: true, taxAmount: true, refundedAmount: true } });
    const collected = rows.filter((r) => ['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(r.status));
    return {
      collectedInr: collected.reduce((s, r) => s + Number(r._sum.amount ?? 0), 0),
      taxInr: collected.reduce((s, r) => s + Number(r._sum.taxAmount ?? 0), 0),
      refundedInr: collected.reduce((s, r) => s + Number(r._sum.refundedAmount ?? 0), 0),
      byStatus: rows.map((r) => ({ status: r.status, provider: r.provider, count: r._count._all, amount: Number(r._sum.amount ?? 0) })),
      activeProvider: this.gateway.name,
    };
  }
}

function safeText(raw: Buffer): string {
  const s = raw.toString('utf8');
  try {
    JSON.parse(s);
    return s;
  } catch {
    return JSON.stringify(Object.fromEntries(new URLSearchParams(s)));
  }
}
