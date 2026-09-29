import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  applyBps,
  Events,
  type AwardSnapshot,
  type AwardStatusEvent,
  type AwardYearEvent,
  type Currency,
  type PaymentEvent,
} from '@aci/contracts';
import { addDays, addYears, APP_CONFIG, fiscalYearOf, OnEvent, type EventContext } from '@aci/nest-common';
import type { FinanceConfig } from './config';
import { Account, LedgerService } from './ledger.service';
import type { Prisma } from './generated/prisma';

const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

/**
 * Turns scholarship lifecycle events into accounting entries.
 *
 * FULL_AT_GRANT (management's stated policy, email of 7 Sep 2026):
 *   grant         Dr Scholarship rights        Cr Scholarship revenue      (full multi-year value)
 *   each year     Dr Scholarship expense       Cr Scholarship obligation   (that year's value)
 *                 Dr Scholarship obligation    Cr Scholarship rights       (university-funded part, delivered in kind)
 *   cash payout   Dr Scholarship obligation    Cr Bank                     (company-funded part, via Disbursements)
 * RATABLE: revenue is recognised year by year instead of at grant.
 */
@Injectable()
export class FinanceEvents {
  private readonly logger = new Logger(FinanceEvents.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: FinanceConfig,
    private readonly ledger: LedgerService,
  ) {}

  private get ratable() {
    return this.config.env.REVENUE_RECOGNITION_POLICY === 'RATABLE';
  }

  @OnEvent(Events.AwardActivated)
  async onActivated(a: AwardSnapshot, { tx }: EventContext) {
    const grant = new Date(a.grantDate ?? new Date());
    const start = new Date(a.startDate);
    const currency = a.currency as Currency;
    const universityFunded = a.universityFundedAnnual;

    await tx.awardLedger.upsert({
      where: { awardId: a.awardId },
      update: { status: 'ACTIVE' },
      create: {
        awardId: a.awardId,
        awardNo: a.awardNo,
        athleteUserId: a.athleteUserId,
        athleteName: a.athleteName,
        athleteCode: a.athleteCode,
        whatsappNumber: a.whatsappNumber,
        sport: a.sport,
        universityId: a.universityId,
        universityName: a.universityName,
        programId: a.programId,
        programName: a.programName,
        durationYears: a.durationYears,
        currency,
        tuitionPerYear: BigInt(a.tuitionPerYear),
        roomPerYear: BigInt(a.roomPerYear),
        foodPerYear: BigInt(a.foodPerYear),
        otherPerYear: BigInt(a.otherPerYear),
        annualValue: BigInt(a.annualValue),
        totalValue: BigInt(a.totalValue),
        usdInrRate4: a.usdInrRate4,
        commissionBps: a.commissionBps,
        universityCommissionShareBps: a.universityCommissionShareBps,
        grantDate: grant,
        startDate: start,
        endDate: new Date(a.endDate),
        status: 'ACTIVE',
      },
    });

    for (let y = 1; y <= a.durationYears; y++) {
      const periodStart = addYears(start, y - 1);
      await tx.expenseSchedule.upsert({
        where: { awardId_yearNumber: { awardId: a.awardId, yearNumber: y } },
        update: {},
        create: {
          awardId: a.awardId,
          yearNumber: y,
          periodStart,
          periodEnd: addDays(addYears(start, y), -1),
          fiscalYear: fiscalYearOf(periodStart),
          amount: BigInt(a.annualValue),
          universityFunded: BigInt(universityFunded),
          companyFunded: BigInt(a.annualValue - universityFunded),
          currency,
        },
      });
    }

    const common = { currency, usdInrRate4: a.usdInrRate4, awardId: a.awardId, universityId: a.universityId, referenceType: 'AWARD', referenceId: a.awardId };
    if (!this.ratable) {
      await this.ledger.post(tx, {
        ...common,
        type: 'SCHOLARSHIP_GRANT',
        idempotencyKey: `grant:${a.awardId}`,
        date: grant,
        memo: `${a.awardNo} ${a.athleteName} — ${a.durationYears}-year scholarship at ${a.universityName} booked in full on grant`,
        lines: [
          { account: Account.SCHOLARSHIP_RIGHTS, debit: a.totalValue },
          { account: Account.SCHOLARSHIP_REVENUE, credit: a.totalValue },
        ],
      });
    }

    // Agency commission on the full scholarship value, split with the university.
    const gross = applyBps(a.totalValue, a.commissionBps);
    const uniShare = applyBps(gross, a.universityCommissionShareBps);
    await this.ledger.post(tx, {
      ...common,
      type: 'COMMISSION',
      idempotencyKey: `commission:${a.awardId}`,
      date: grant,
      memo: `${a.awardNo} agency commission ${(a.commissionBps / 100).toFixed(2)}% (university share ${(a.universityCommissionShareBps / 100).toFixed(2)}%)`,
      lines: [
        { account: Account.COMMISSION_RECEIVABLE, debit: gross },
        { account: Account.COMMISSION_INCOME, credit: gross - uniShare },
        { account: Account.COMMISSION_PAYABLE_UNIVERSITY, credit: uniShare },
      ],
    });

    // Year 1 is delivered from the grant.
    await this.recognizeYear(tx, a.awardId, 1, grant);
  }

  private async recognizeYear(tx: Prisma.TransactionClient, awardId: string, yearNumber: number, when: Date) {
    const row = await tx.expenseSchedule.findUnique({ where: { awardId_yearNumber: { awardId, yearNumber } }, include: { award: true } });
    // Events can arrive out of order across queues: if the award has not been projected yet, fail so the
    // message is retried (delay queue) instead of silently skipping the year.
    if (!row) throw new Error(`Expense schedule for award ${awardId} year ${yearNumber} not found yet`);
    if (row.status !== 'SCHEDULED') return;
    const a = row.award;
    const currency = a.currency as Currency;
    const amount = n(row.amount);
    const common = { currency, usdInrRate4: a.usdInrRate4, awardId, universityId: a.universityId, referenceType: 'AWARD_YEAR', referenceId: `${awardId}:${yearNumber}` };
    if (this.ratable) {
      await this.ledger.post(tx, {
        ...common,
        type: 'RATABLE_REVENUE',
        idempotencyKey: `ratable:${awardId}:${yearNumber}`,
        date: when,
        memo: `${a.awardNo} Year ${yearNumber} revenue`,
        lines: [
          { account: Account.SCHOLARSHIP_RIGHTS, debit: amount },
          { account: Account.SCHOLARSHIP_REVENUE, credit: amount },
        ],
      });
    }
    await this.ledger.post(tx, {
      ...common,
      type: 'EXPENSE_RECOGNITION',
      idempotencyKey: `expense:${awardId}:${yearNumber}`,
      date: when,
      memo: `${a.awardNo} Year ${yearNumber} scholarship expense`,
      lines: [
        { account: Account.SCHOLARSHIP_EXPENSE, debit: amount },
        { account: Account.SCHOLARSHIP_OBLIGATION, credit: amount },
      ],
    });
    await this.ledger.post(tx, {
      ...common,
      type: 'UNIVERSITY_DELIVERY',
      idempotencyKey: `delivery:${awardId}:${yearNumber}`,
      date: when,
      memo: `${a.awardNo} Year ${yearNumber} university-funded benefits delivered in kind`,
      lines: [
        { account: Account.SCHOLARSHIP_OBLIGATION, debit: n(row.universityFunded) },
        { account: Account.SCHOLARSHIP_RIGHTS, credit: n(row.universityFunded) },
      ],
    });
    await tx.expenseSchedule.update({ where: { id: row.id }, data: { status: 'RECOGNIZED', recognizedAt: when } });
  }

  @OnEvent(Events.AwardRenewed)
  async onRenewed(e: AwardYearEvent, { tx }: EventContext) {
    await this.recognizeYear(tx, e.awardId, e.yearNumber, new Date());
  }

  @OnEvent(Events.AwardSuspended, Events.AwardReinstated, Events.AwardCompleted)
  async onStatus(e: AwardStatusEvent, { tx, event }: EventContext) {
    const status = { [Events.AwardSuspended]: 'SUSPENDED', [Events.AwardReinstated]: 'ACTIVE', [Events.AwardCompleted]: 'COMPLETED' }[event.type as string];
    if (status) await tx.awardLedger.updateMany({ where: { awardId: e.awardId }, data: { status } });
  }

  /** Revocation: cancel future years and reverse revenue that will never be delivered. */
  @OnEvent(Events.AwardRevoked)
  async onRevoked(e: AwardStatusEvent, { tx }: EventContext) {
    const a = await tx.awardLedger.findUnique({ where: { awardId: e.awardId } });
    if (!a) return;
    const pending = await tx.expenseSchedule.findMany({ where: { awardId: e.awardId, status: 'SCHEDULED' } });
    const remaining = pending.reduce((s: number, r: { amount: bigint }) => s + n(r.amount), 0);
    await tx.expenseSchedule.updateMany({ where: { awardId: e.awardId, status: 'SCHEDULED' }, data: { status: 'CANCELLED' } });
    await tx.awardLedger.update({ where: { awardId: e.awardId }, data: { status: 'REVOKED', revokedAt: new Date(e.effectiveDate) } });
    if (!this.ratable && remaining > 0) {
      await this.ledger.post(tx, {
        type: 'REVENUE_REVERSAL',
        idempotencyKey: `reversal:${e.awardId}`,
        date: new Date(e.effectiveDate),
        currency: a.currency as Currency,
        usdInrRate4: a.usdInrRate4,
        awardId: a.awardId,
        universityId: a.universityId,
        referenceType: 'AWARD',
        referenceId: a.awardId,
        memo: `${a.awardNo} revoked (${e.reason ?? 'no reason'}): reverse ${pending.length} undelivered year(s)`,
        lines: [
          { account: Account.SCHOLARSHIP_REVENUE, debit: remaining },
          { account: Account.SCHOLARSHIP_RIGHTS, credit: remaining },
        ],
      });
    }
  }

  @OnEvent(Events.AwardUniversityConfirmed)
  async onConfirmed(e: { awardId: string; status: string; confirmedAt: string | null }, { tx }: EventContext) {
    await tx.awardLedger.updateMany({
      where: { awardId: e.awardId },
      data: { universityConfirmationStatus: e.status, universityConfirmedAt: e.confirmedAt ? new Date(e.confirmedAt) : null },
    });
  }

  @OnEvent(Events.PaymentSucceeded)
  async onPayment(e: PaymentEvent, { tx }: EventContext) {
    const rate = await this.ledger.latestRate4();
    await this.ledger.post(tx, {
      type: 'FEE_INCOME',
      idempotencyKey: `fee:${e.orderId}`,
      date: new Date(e.occurredAt),
      currency: 'INR',
      usdInrRate4: rate.rate4,
      referenceType: 'PAYMENT',
      referenceId: e.orderId,
      memo: `${e.orderNo} ${e.purpose} via ${e.provider}`,
      lines: [
        { account: Account.BANK, debit: e.amount },
        { account: Account.FEE_INCOME, credit: e.amount - e.taxAmount },
        { account: Account.GST_PAYABLE, credit: e.taxAmount },
      ],
    });
  }

  @OnEvent(Events.PaymentRefunded)
  async onRefund(e: PaymentEvent, { tx, event }: EventContext) {
    const rate = await this.ledger.latestRate4();
    const order = await tx.journalEntry.findUnique({ where: { idempotencyKey: `fee:${e.orderId}` }, include: { lines: true } });
    // Reverse tax proportionally to the refunded share of the original payment.
    const original = order ? n(order.amount) : e.amount;
    const tax = order ? Math.round((n(order.lines.find((l: { account: string }) => l.account === Account.GST_PAYABLE)?.credit) * e.amount) / original) : 0;
    await this.ledger.post(tx, {
      type: 'FEE_REFUND',
      idempotencyKey: `refund:${event.id}`,
      date: new Date(e.occurredAt),
      currency: 'INR',
      usdInrRate4: rate.rate4,
      referenceType: 'PAYMENT',
      referenceId: e.orderId,
      memo: `${e.orderNo} refund: ${e.reason ?? ''}`,
      lines: [
        { account: Account.FEE_INCOME, debit: e.amount - tax },
        { account: Account.GST_PAYABLE, debit: tax },
        { account: Account.BANK, credit: e.amount },
      ],
    });
  }
}
