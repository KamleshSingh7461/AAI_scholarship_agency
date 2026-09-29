import { Inject, Injectable, Logger } from '@nestjs/common';
import { convert, type Currency } from '@aci/contracts';
import { APP_CONFIG, fiscalYearOf, refNo } from '@aci/nest-common';
import type { FinanceConfig } from './config';
import { PrismaService } from './prisma.service';
import type { Prisma } from './generated/prisma';

/**
 * Chart of accounts. Validate with the company's chartered accountant before go-live;
 * account codes are strings so they can be renamed/mapped to Tally/Zoho Books on export.
 */
export const Account = {
  SCHOLARSHIP_RIGHTS: '1300 Scholarship rights (asset from university transfer)',
  BANK: '1100 Bank',
  COMMISSION_RECEIVABLE: '1400 Agency commission receivable',
  SCHOLARSHIP_OBLIGATION: '2100 Scholarship obligation (benefits owed this year)',
  GST_PAYABLE: '2200 GST payable',
  COMMISSION_PAYABLE_UNIVERSITY: '2300 Commission payable to university',
  SCHOLARSHIP_REVENUE: '4100 Scholarship revenue',
  FEE_INCOME: '4200 Application fee income',
  COMMISSION_INCOME: '4300 Agency commission income',
  SCHOLARSHIP_EXPENSE: '5100 Scholarship expense',
} as const;

export interface PostInput {
  type: string;
  idempotencyKey: string;
  date: Date;
  currency: Currency;
  usdInrRate4: number;
  awardId?: string;
  universityId?: string;
  referenceType?: string;
  referenceId?: string;
  memo?: string;
  lines: { account: string; debit?: number; credit?: number }[];
}

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: FinanceConfig,
    private readonly prisma: PrismaService,
  ) {}

  /** Latest USD→INR rate (×10000). Falls back to the configured default when none has been entered. */
  async latestRate4(): Promise<{ rate4: number; effectiveDate: Date | null; source: string }> {
    const r = await this.prisma.fxRate.findFirst({ where: { base: 'USD', quote: 'INR' }, orderBy: { effectiveDate: 'desc' } });
    if (r) return { rate4: r.rate4, effectiveDate: r.effectiveDate, source: r.source };
    return { rate4: Math.round(this.config.env.DEFAULT_USD_INR_RATE * 10000), effectiveDate: null, source: 'DEFAULT' };
  }

  /**
   * Posts a balanced journal entry exactly once (idempotency key). Throws if debits ≠ credits.
   * The entry amount is the total debit; INR and USD equivalents use the supplied rate.
   */
  async post(tx: Prisma.TransactionClient, p: PostInput) {
    const existing = await tx.journalEntry.findUnique({ where: { idempotencyKey: p.idempotencyKey } });
    if (existing) return existing;
    const lines = p.lines.filter((l) => (l.debit ?? 0) !== 0 || (l.credit ?? 0) !== 0);
    const dr = lines.reduce((s, l) => s + (l.debit ?? 0), 0);
    const cr = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
    if (dr !== cr) throw new Error(`Unbalanced journal ${p.type}: debit ${dr} != credit ${cr}`);
    if (dr === 0) return null;
    return tx.journalEntry.create({
      data: {
        entryNo: refNo('JE', 8),
        entryDate: p.date,
        type: p.type,
        awardId: p.awardId,
        universityId: p.universityId,
        referenceType: p.referenceType,
        referenceId: p.referenceId,
        idempotencyKey: p.idempotencyKey,
        currency: p.currency,
        amount: BigInt(dr),
        amountInr: BigInt(convert(dr, p.currency, 'INR', p.usdInrRate4)),
        amountUsd: BigInt(convert(dr, p.currency, 'USD', p.usdInrRate4)),
        usdInrRate4: p.usdInrRate4,
        fiscalYear: fiscalYearOf(p.date),
        memo: p.memo,
        lines: { create: lines.map((l) => ({ account: l.account, debit: BigInt(l.debit ?? 0), credit: BigInt(l.credit ?? 0) })) },
      },
    });
  }
}
