import { BadRequestException, Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from 'class-validator';
import { Role, type Currency } from '@aci/contracts';
import { API, AuditService, CurrentUser, InternalHttpClient, Internal, PageQuery, Roles, startOfUtcDay, toPage, type AuthUser } from '@aci/nest-common';
import { PrismaService } from './prisma.service';
import { AnalyticsService } from './analytics.service';
import { Account, LedgerService } from './ledger.service';
import { REPORTS, ReportsService, type ReportFilters, type ReportFormat, type ReportType } from './reports.service';
import type { Prisma } from './generated/prisma';

class FyQuery {
  @IsOptional() @Matches(/^FY\d{2}$/) fy?: string;
}

class FxDto {
  @Type(() => Number) @IsNumber() @Min(1) rate: number;
  @IsOptional() @IsDateString() effectiveDate?: string;
}

class DisbursementDto {
  @IsUUID() awardId: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) yearNumber?: number;
  @IsIn(['TUITION', 'ROOM', 'FOOD', 'OTHER']) category: string;
  @IsOptional() @IsIn(['UNIVERSITY', 'STUDENT', 'VENDOR']) payee?: string;
  /** minor units in the award's currency */
  @Type(() => Number) @IsInt() @Min(1) amount: number;
  @IsDateString() paidOn: string;
  @IsOptional() @IsString() @MaxLength(80) reference?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsOptional() @IsUUID() documentId?: string;
}

class DisbursementQuery extends PageQuery {
  @IsOptional() @IsUUID() awardId?: string;
}

class JournalQuery extends PageQuery {
  @IsOptional() @IsString() type?: string;
  @IsOptional() @Matches(/^FY\d{2}$/) fy?: string;
  @IsOptional() @IsUUID() awardId?: string;
}

class ReportDto {
  @IsIn(Object.keys(REPORTS)) type: ReportType;
  @IsIn(['xlsx', 'csv', 'pdf']) format: ReportFormat;
  @IsOptional() @IsObject() filters?: ReportFilters;
}

@ApiTags('finance')
@Controller(`${API}/finance`)
@Roles(Role.ADMIN, Role.FINANCE)
export class FinanceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  /** "Money & Value" page. */
  @Get('summary')
  summary(@Query() q: FyQuery) {
    return this.analytics.summary(q.fy);
  }

  @Get('trial-balance')
  trialBalance(@Query() q: FyQuery) {
    return this.analytics.trialBalance(q.fy);
  }

  @Get('awards/:awardId')
  award(@Param('awardId', ParseUUIDPipe) awardId: string) {
    return this.analytics.awardLedger(awardId);
  }

  @Get('journal')
  async journal(@Query() q: JournalQuery) {
    const where: Prisma.JournalEntryWhereInput = {
      ...(q.type ? { type: q.type } : {}),
      ...(q.fy ? { fiscalYear: q.fy } : {}),
      ...(q.awardId ? { awardId: q.awardId } : {}),
      ...(q.q ? { OR: [{ entryNo: { contains: q.q, mode: 'insensitive' } }, { memo: { contains: q.q, mode: 'insensitive' } }] } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.journalEntry.findMany({ where, include: { lines: true }, orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }], skip: q.skip, take: q.pageSize }),
      this.prisma.journalEntry.count({ where }),
    ]);
    return toPage(items, total, q);
  }

  // ---------------- FX ----------------

  @Get('fx')
  async fx() {
    const [latest, history] = await Promise.all([
      this.ledger.latestRate4(),
      this.prisma.fxRate.findMany({ orderBy: { effectiveDate: 'desc' }, take: 30 }),
    ]);
    return { latest: { ...latest, rate: latest.rate4 / 10000 }, history: history.map((h) => ({ ...h, rate: h.rate4 / 10000 })) };
  }

  @Post('fx')
  async setFx(@Body() dto: FxDto, @CurrentUser() u: AuthUser) {
    const effectiveDate = startOfUtcDay(dto.effectiveDate ? new Date(dto.effectiveDate) : new Date());
    const rate4 = Math.round(dto.rate * 10000);
    const row = await this.prisma.fxRate.upsert({
      where: { base_quote_effectiveDate: { base: 'USD', quote: 'INR', effectiveDate } },
      update: { rate4, source: 'MANUAL', createdById: u.id },
      create: { base: 'USD', quote: 'INR', rate4, effectiveDate, source: 'MANUAL', createdById: u.id },
    });
    await this.audit.log(u, { action: 'fx.set', entityType: 'FxRate', entityId: row.id, after: { rate: dto.rate, effectiveDate } });
    return { ...row, rate: row.rate4 / 10000 };
  }

  // ---------------- Disbursements (cash actually paid out) ----------------

  @Get('disbursements')
  async disbursements(@Query() q: DisbursementQuery) {
    const where = q.awardId ? { awardId: q.awardId } : {};
    const [items, total] = await Promise.all([
      this.prisma.disbursement.findMany({ where, orderBy: { paidOn: 'desc' }, skip: q.skip, take: q.pageSize }),
      this.prisma.disbursement.count({ where }),
    ]);
    return toPage(items, total, q);
  }

  @Post('disbursements')
  async disburse(@Body() dto: DisbursementDto, @CurrentUser() u: AuthUser) {
    const a = await this.prisma.awardLedger.findUnique({ where: { awardId: dto.awardId } });
    if (!a) throw new NotFoundException({ message: 'Scholarship not found in the ledger (not granted yet?)', code: 'NOT_FOUND' });
    if (a.status === 'REVOKED') throw new BadRequestException({ message: 'Scholarship is revoked', code: 'REVOKED' });
    return this.prisma.$transaction(async (tx) => {
      const d = await tx.disbursement.create({
        data: { ...dto, payee: dto.payee ?? 'UNIVERSITY', amount: BigInt(dto.amount), currency: a.currency, paidOn: new Date(dto.paidOn), universityId: a.universityId, createdById: u.id },
      });
      await this.ledger.post(tx, {
        type: 'DISBURSEMENT',
        idempotencyKey: `disbursement:${d.id}`,
        date: new Date(dto.paidOn),
        currency: a.currency as Currency,
        usdInrRate4: a.usdInrRate4,
        awardId: a.awardId,
        universityId: a.universityId,
        referenceType: 'DISBURSEMENT',
        referenceId: d.id,
        memo: `${a.awardNo} ${dto.category.toLowerCase()} paid to ${dto.payee ?? 'UNIVERSITY'}${dto.reference ? ` (ref ${dto.reference})` : ''}`,
        lines: [
          { account: Account.SCHOLARSHIP_OBLIGATION, debit: dto.amount },
          { account: Account.BANK, credit: dto.amount },
        ],
      });
      await this.audit.log(u, { action: 'disbursement.create', entityType: 'Disbursement', entityId: d.id, after: dto }, tx);
      return d;
    });
  }
}

@ApiTags('reports')
@Controller(`${API}/reports`)
@Roles(Role.ADMIN, Role.FINANCE, Role.REVIEWER)
export class ReportsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly http: InternalHttpClient,
  ) {}

  @Get('catalog')
  catalog() {
    return Object.entries(REPORTS).map(([type, r]) => ({ type, ...r }));
  }

  @Get()
  async history(@Query() q: PageQuery) {
    const [items, total] = await Promise.all([
      this.prisma.reportRun.findMany({ orderBy: { createdAt: 'desc' }, skip: q.skip, take: q.pageSize }),
      this.prisma.reportRun.count(),
    ]);
    return toPage(items, total, q);
  }

  @Post('generate')
  generate(@Body() dto: ReportDto, @CurrentUser() u: AuthUser) {
    return this.reports.generate(dto.type, dto.format, dto.filters ?? {}, u);
  }

  @Get(':id/download')
  async download(@Param('id', ParseUUIDPipe) id: string) {
    const run = await this.prisma.reportRun.findUniqueOrThrow({ where: { id } });
    if (!run.documentId) throw new NotFoundException({ message: 'Report is not ready', code: 'NOT_READY' });
    return this.http.get<{ url: string }>('document', `/internal/documents/${run.documentId}/url`);
  }
}

@Controller('internal/fx')
@Internal()
export class InternalFxController {
  constructor(private readonly ledger: LedgerService) {}

  @Get('latest')
  async latest() {
    const r = await this.ledger.latestRate4();
    return { usdInrRate4: r.rate4, effectiveDate: r.effectiveDate, source: r.source };
  }
}
