import { Injectable } from '@nestjs/common';
import { convert, type Currency } from '@aci/contracts';
import { fiscalYearOf } from '@aci/nest-common';
import { PrismaService } from './prisma.service';
import { LedgerService } from './ledger.service';

const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

/** FY27 → 1 Apr 2026 .. 31 Mar 2027 (Indian financial year). */
export function fyRange(fy: string): { from: Date; to: Date } {
  const end = 2000 + Number(fy.replace(/\D/g, ''));
  return { from: new Date(Date.UTC(end - 1, 3, 1)), to: new Date(Date.UTC(end, 3, 1)) };
}

export function fyQuarter(d: Date): 1 | 2 | 3 | 4 {
  const m = d.getUTCMonth();
  return m >= 3 && m <= 5 ? 1 : m >= 6 && m <= 8 ? 2 : m >= 9 && m <= 11 ? 3 : 4;
}

export interface Money {
  inr: number;
  usd: number;
}
const zero = (): Money => ({ inr: 0, usd: 0 });
const add = (m: Money, amount: number, currency: string, rate4: number) => {
  m.inr += convert(amount, currency as Currency, 'INR', rate4);
  m.usd += convert(amount, currency as Currency, 'USD', rate4);
};

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  /** Everything on the "Money & Value" page, in both INR and USD. */
  async summary(fyParam?: string) {
    const fy = fyParam ?? fiscalYearOf(new Date());
    const { from, to } = fyRange(fy);
    const [awards, schedule, journals, disb] = await Promise.all([
      this.prisma.awardLedger.findMany(),
      this.prisma.expenseSchedule.findMany({ include: { award: { select: { usdInrRate4: true, durationYears: true, currency: true } } } }),
      this.prisma.journalEntry.findMany({ where: { type: { in: ['SCHOLARSHIP_GRANT', 'RATABLE_REVENUE', 'REVENUE_REVERSAL', 'COMMISSION', 'FEE_INCOME', 'FEE_REFUND'] } }, include: { lines: true } }),
      this.prisma.disbursement.findMany(),
    ]);

    const counted = zero();
    for (const j of journals) {
      const sign = j.type === 'REVENUE_REVERSAL' ? -1 : 1;
      if (['SCHOLARSHIP_GRANT', 'RATABLE_REVENUE', 'REVENUE_REVERSAL'].includes(j.type)) {
        counted.inr += sign * n(j.amountInr);
        counted.usd += sign * n(j.amountUsd);
      }
    }

    const paidOutFy = zero();
    const paidOutToDate = zero();
    const stillToPay = zero();
    const byFy = new Map<string, { fy: string; amount: Money; awards: Set<string>; recognized: Money }>();
    for (const s of schedule) {
      if (s.status === 'CANCELLED') continue;
      const rate = s.award.usdInrRate4;
      const amt = n(s.amount);
      const row = byFy.get(s.fiscalYear) ?? { fy: s.fiscalYear, amount: zero(), awards: new Set<string>(), recognized: zero() };
      add(row.amount, amt, s.currency, rate);
      row.awards.add(s.awardId);
      if (s.status === 'RECOGNIZED') {
        add(row.recognized, amt, s.currency, rate);
        add(paidOutToDate, amt, s.currency, rate);
        if (s.recognizedAt && s.recognizedAt >= from && s.recognizedAt < to) add(paidOutFy, amt, s.currency, rate);
      } else add(stillToPay, amt, s.currency, rate);
      byFy.set(s.fiscalYear, row);
    }

    const byType = new Map<number, { durationYears: number; count: number; counted: Money; paidOut: Money; stillToPay: Money }>();
    for (const a of awards) {
      const row = byType.get(a.durationYears) ?? { durationYears: a.durationYears, count: 0, counted: zero(), paidOut: zero(), stillToPay: zero() };
      if (a.status !== 'REVOKED') row.count++;
      byType.set(a.durationYears, row);
    }
    for (const s of schedule) {
      const row = byType.get(s.award.durationYears);
      if (!row || s.status === 'CANCELLED') continue;
      const amt = n(s.amount);
      add(row.counted, amt, s.currency, s.award.usdInrRate4);
      add(s.status === 'RECOGNIZED' ? row.paidOut : row.stillToPay, amt, s.currency, s.award.usdInrRate4);
    }

    const commission = { gross: zero(), companyNet: zero(), universityShare: zero() };
    for (const j of journals.filter((x) => x.type === 'COMMISSION')) {
      for (const l of j.lines) {
        const target =
          l.account.startsWith('1400') ? commission.gross : l.account.startsWith('4300') ? commission.companyNet : l.account.startsWith('2300') ? commission.universityShare : null;
        if (target) add(target, n(l.debit) + n(l.credit), j.currency, j.usdInrRate4);
      }
    }

    const confirmation = { confirmed: zero(), awaiting: zero(), disputed: zero() };
    for (const a of awards.filter((x) => x.status !== 'REVOKED')) {
      const bucket = a.universityConfirmationStatus === 'CONFIRMED' ? confirmation.confirmed : a.universityConfirmationStatus === 'DISPUTED' ? confirmation.disputed : confirmation.awaiting;
      add(bucket, n(a.totalValue), a.currency, a.usdInrRate4);
    }
    const confirmedPct = confirmation.confirmed.inr + confirmation.awaiting.inr + confirmation.disputed.inr > 0
      ? Math.round((confirmation.confirmed.inr * 1000) / (confirmation.confirmed.inr + confirmation.awaiting.inr + confirmation.disputed.inr)) / 10
      : 0;

    // Quarterly audit summary for the selected FY
    const quarters = [1, 2, 3, 4].map((q) => ({ quarter: q, label: `Q${q} ${fy}`, newScholarships: 0, booked: zero(), confirmed: zero(), paidOut: zero() }));
    for (const a of awards) {
      if (a.grantDate < from || a.grantDate >= to) continue;
      const q = quarters[fyQuarter(a.grantDate) - 1];
      q.newScholarships++;
      add(q.booked, n(a.totalValue), a.currency, a.usdInrRate4);
      if (a.universityConfirmationStatus === 'CONFIRMED') add(q.confirmed, n(a.totalValue), a.currency, a.usdInrRate4);
    }
    for (const s of schedule) {
      if (s.status !== 'RECOGNIZED' || !s.recognizedAt || s.recognizedAt < from || s.recognizedAt >= to) continue;
      add(quarters[fyQuarter(s.recognizedAt) - 1].paidOut, n(s.amount), s.currency, s.award.usdInrRate4);
    }

    const cashDisbursed = zero();
    const cashDisbursedFy = zero();
    const rateByAward = new Map(awards.map((a) => [a.awardId, a.usdInrRate4]));
    for (const d of disb) {
      const rate = rateByAward.get(d.awardId) ?? (await this.ledger.latestRate4()).rate4;
      add(cashDisbursed, n(d.amount), d.currency, rate);
      if (d.paidOn >= from && d.paidOn < to) add(cashDisbursedFy, n(d.amount), d.currency, rate);
    }

    const fees = zero();
    for (const j of journals) {
      if (j.type === 'FEE_INCOME') add(fees, n(j.amount), j.currency, j.usdInrRate4);
      if (j.type === 'FEE_REFUND') add(fees, -n(j.amount), j.currency, j.usdInrRate4);
    }

    const fx = await this.ledger.latestRate4();
    return {
      fiscalYear: fy,
      fyRange: { from, to },
      fx,
      totals: {
        counted,
        paidOutFy,
        paidOutToDate,
        stillToPay,
        cashDisbursed,
        cashDisbursedFy,
        applicationFeesCollected: fees,
        activeStudents: awards.filter((a) => ['ACTIVE', 'RENEWAL_DUE'].includes(a.status)).length,
        awards: awards.length,
      },
      fySchedule: [...byFy.values()]
        .sort((a, b) => a.fy.localeCompare(b.fy))
        .map((r) => ({ fiscalYear: r.fy, amount: r.amount, recognized: r.recognized, studentsOnScholarship: r.awards.size })),
      byType: [...byType.values()].sort((a, b) => b.durationYears - a.durationYears),
      commission,
      confirmation: { ...confirmation, confirmedPct },
      quarterly: quarters,
    };
  }

  /** Full ledger for one award: schedule, journal lines, disbursements. */
  async awardLedger(awardId: string) {
    const [award, schedule, journals, disbursements] = await Promise.all([
      this.prisma.awardLedger.findUnique({ where: { awardId } }),
      this.prisma.expenseSchedule.findMany({ where: { awardId }, orderBy: { yearNumber: 'asc' } }),
      this.prisma.journalEntry.findMany({ where: { awardId }, include: { lines: true }, orderBy: { entryDate: 'asc' } }),
      this.prisma.disbursement.findMany({ where: { awardId }, orderBy: { paidOn: 'asc' } }),
    ]);
    return { award, schedule, journals, disbursements };
  }

  /** Trial balance: debit/credit totals per account (INR equivalent), for the accountants. */
  async trialBalance(fy?: string) {
    const where = fy ? { entry: { fiscalYear: fy } } : {};
    const lines = await this.prisma.journalLine.findMany({ where, include: { entry: { select: { currency: true, usdInrRate4: true } } } });
    const acc = new Map<string, { account: string; debitInr: number; creditInr: number }>();
    for (const l of lines) {
      const row = acc.get(l.account) ?? { account: l.account, debitInr: 0, creditInr: 0 };
      row.debitInr += convert(n(l.debit), l.entry.currency as Currency, 'INR', l.entry.usdInrRate4);
      row.creditInr += convert(n(l.credit), l.entry.currency as Currency, 'INR', l.entry.usdInrRate4);
      acc.set(l.account, row);
    }
    const rows = [...acc.values()].sort((a, b) => a.account.localeCompare(b.account));
    return {
      fiscalYear: fy ?? 'ALL',
      rows: rows.map((r) => ({ ...r, balanceInr: r.debitInr - r.creditInr })),
      totals: { debitInr: rows.reduce((s, r) => s + r.debitInr, 0), creditInr: rows.reduce((s, r) => s + r.creditInr, 0) },
    };
  }
}
