import { Body, Controller, ForbiddenException, Get, HttpCode, Inject, NotFoundException, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { convert, Role, type Currency } from '@aci/contracts';
import { API, APP_CONFIG, CurrentUser, Internal, Roles, startOfUtcDay, toPage, type AuthUser } from '@aci/nest-common';
import type { ApplicationConfig } from './config';
import { PrismaService } from './prisma.service';
import { AwardService } from './award.service';
import { LifecycleService } from './lifecycle.service';
import { AwardActionDto, AwardQuery, ConfirmationDto, DashboardQuery, RegistrationDto, RenewalQuery } from './dto';
import type { Prisma } from './generated/prisma';

const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

function periodStart(period: string | undefined): Date | null {
  const now = new Date();
  if (period === 'month') return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  if (period === 'quarter') return new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1));
  if (period === 'all') return null;
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
}

@ApiTags('awards (athlete)')
@Controller(`${API}/awards/mine`)
@Roles(Role.ATHLETE)
export class MyAwardsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Student dashboard: my scholarships with yearly progress. */
  @Get()
  async mine(@CurrentUser() u: AuthUser) {
    const awards = await this.prisma.award.findMany({
      where: { athleteUserId: u.id },
      include: { years: { orderBy: { yearNumber: 'asc' } } },
      orderBy: { offeredAt: 'desc' },
    });
    return awards.map((a) => {
      const renewedYears = a.years.filter((y) => y.status === 'RENEWED');
      const next = a.years.find((y) => ['UPCOMING', 'DUE', 'OVERDUE', 'SUSPENDED'].includes(y.status));
      return {
        ...a,
        progress: {
          yearsCompleted: a.years.filter((y) => y.status === 'RENEWED' && y.periodEnd < new Date()).length,
          yearsRenewed: renewedYears.length,
          releasedValue: renewedYears.reduce((s, y) => s + n(y.amount), 0),
          remainingValue: n(a.totalValue) - renewedYears.reduce((s, y) => s + n(y.amount), 0),
          nextRenewal: next ? { yearId: next.id, yearNumber: next.yearNumber, dueDate: next.dueDate, status: next.status } : null,
        },
      };
    });
  }
}

@ApiTags('renewals')
@Controller(`${API}/renewals`)
export class RenewalsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly awards: AwardService,
    @Inject(APP_CONFIG) private readonly config: ApplicationConfig,
  ) {}

  @Roles(Role.ATHLETE)
  @Get('mine')
  async mine(@CurrentUser() u: AuthUser) {
    const years = await this.prisma.awardYear.findMany({
      where: { award: { athleteUserId: u.id }, yearNumber: { gt: 1 } },
      include: { award: { select: { id: true, awardNo: true, universityName: true, programName: true, status: true, currency: true } } },
      orderBy: [{ dueDate: 'asc' }],
    });
    return years.map((y) => ({ ...y, deadline: new Date(y.dueDate.getTime() + this.config.env.RENEWAL_GRACE_DAYS * 86400_000) }));
  }

  @Roles(Role.ATHLETE)
  @Post(':yearId/registration')
  @HttpCode(200)
  register(@Param('yearId', ParseUUIDPipe) yearId: string, @Body() dto: RegistrationDto, @CurrentUser() u: AuthUser) {
    return this.awards.submitRegistration(yearId, u, dto);
  }

  /** Staff view: "Yearly Renewals" page. */
  @Roles(Role.ADMIN, Role.REVIEWER, Role.FINANCE, Role.UNIVERSITY_REP)
  @Get()
  async list(@Query() q: RenewalQuery, @CurrentUser() u: AuthUser) {
    const scope: Prisma.AwardYearWhereInput = u.role === Role.UNIVERSITY_REP ? { award: { universityId: u.universityId } } : q.universityId ? { award: { universityId: q.universityId } } : {};
    const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
    const where: Prisma.AwardYearWhereInput = {
      ...scope,
      yearNumber: { gt: 1 },
      ...(q.status ? { status: q.status } : { status: { in: ['DUE', 'OVERDUE', 'SUSPENDED', 'RENEWED'] } }),
      ...(q.q ? { award: { ...(scope.award as object), OR: [{ athleteName: { contains: q.q, mode: 'insensitive' } }, { awardNo: { contains: q.q, mode: 'insensitive' } }] } } : {}),
    };
    const [items, total, counts, renewedThisYear] = await Promise.all([
      this.prisma.awardYear.findMany({
        where,
        include: { award: { select: { id: true, awardNo: true, athleteName: true, athleteCode: true, whatsappNumber: true, universityName: true, sport: true, status: true, athleteUserId: true } } },
        orderBy: [{ dueDate: 'asc' }],
        skip: q.skip,
        take: q.pageSize,
      }),
      this.prisma.awardYear.count({ where }),
      this.prisma.awardYear.groupBy({ by: ['status'], where: { ...scope, yearNumber: { gt: 1 } }, _count: { _all: true } }),
      this.prisma.awardYear.count({ where: { ...scope, yearNumber: { gt: 1 }, status: 'RENEWED', renewedAt: { gte: yearStart } } }),
    ]);
    const today = startOfUtcDay();
    return {
      ...toPage(
        items.map((y) => ({ ...y, daysUntilDue: Math.round((y.dueDate.getTime() - today.getTime()) / 86400_000) })),
        total,
        q,
      ),
      summary: { ...Object.fromEntries(counts.map((c) => [c.status, c._count._all])), RENEWED_THIS_YEAR: renewedThisYear },
      policy: {
        reminderDaysBefore: this.config.env.RENEWAL_REMINDER_DAYS_BEFORE,
        envelopeDaysBefore: this.config.env.RENEWAL_ENVELOPE_DAYS_BEFORE,
        graceDays: this.config.env.RENEWAL_GRACE_DAYS,
      },
    };
  }
}

@ApiTags('awards (staff)')
@Controller(`${API}/awards`)
@Roles(Role.ADMIN, Role.REVIEWER, Role.FINANCE, Role.UNIVERSITY_REP)
export class StaffAwardsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly awards: AwardService,
    private readonly lifecycle: LifecycleService,
    @Inject(APP_CONFIG) private readonly config: ApplicationConfig,
  ) {}

  /** The "Students" roster: every scholarship passed out with its quantified value and paperwork status. */
  @Get()
  async list(@Query() q: AwardQuery, @CurrentUser() u: AuthUser) {
    const where: Prisma.AwardWhereInput = {
      ...(u.role === Role.UNIVERSITY_REP ? { universityId: u.universityId } : q.universityId ? { universityId: q.universityId } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.sport ? { sport: { equals: q.sport, mode: 'insensitive' } } : {}),
      ...(q.durationYears ? { durationYears: q.durationYears } : {}),
      ...(q.confirmation ? { universityConfirmationStatus: q.confirmation } : {}),
      ...(q.athleteUserId ? { athleteUserId: q.athleteUserId } : {}),
      ...(q.q
        ? {
            OR: [
              { athleteName: { contains: q.q, mode: 'insensitive' } },
              { athleteCode: { contains: q.q, mode: 'insensitive' } },
              { awardNo: { contains: q.q, mode: 'insensitive' } },
              { whatsappNumber: { contains: q.q } },
            ],
          }
        : {}),
    };
    const [items, total, counts] = await Promise.all([
      this.prisma.award.findMany({ where, orderBy: { offeredAt: 'desc' }, skip: q.skip, take: q.pageSize }),
      this.prisma.award.count({ where }),
      this.prisma.award.groupBy({ by: ['status'], where: u.role === Role.UNIVERSITY_REP ? { universityId: u.universityId } : {}, _count: { _all: true } }),
    ]);
    return { ...toPage(items, total, q), statusCounts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) };
  }

  /** Top-level admin dashboard numbers. */
  @Get('dashboard')
  async dashboard(@Query() q: DashboardQuery, @CurrentUser() u: AuthUser) {
    const scope: Prisma.AwardWhereInput = u.role === Role.UNIVERSITY_REP ? { universityId: u.universityId } : {};
    const since = periodStart(q.period);
    const all = await this.prisma.award.findMany({
      where: scope,
      select: {
        id: true, awardNo: true, athleteUserId: true, athleteName: true, universityId: true, universityName: true, sport: true,
        durationYears: true, currency: true, totalValue: true, usdInrRate4: true, status: true, grantDate: true,
        scholarshipSignedAt: true, agencySignedAt: true, universityConfirmationStatus: true,
      },
    });
    const granted = all.filter((a) => a.grantDate);
    const both = (a: (typeof all)[number], cur: Currency) => convert(n(a.totalValue), a.currency as Currency, cur, a.usdInrRate4);
    const sum = (rows: typeof all, cur: Currency) => rows.reduce((s, a) => s + both(a, cur), 0);
    const inPeriod = (d: Date | null) => !!d && (!since || d >= since);

    const byDuration: Record<string, number> = {};
    for (const a of granted) byDuration[a.durationYears] = (byDuration[a.durationYears] ?? 0) + 1;

    const group = (key: 'universityName' | 'sport') => {
      const m = new Map<string, { name: string; students: number; valueInr: number; valueUsd: number }>();
      for (const a of granted) {
        const k = (a[key] ?? 'Unspecified') as string;
        const row = m.get(k) ?? { name: k, students: 0, valueInr: 0, valueUsd: 0 };
        row.students++;
        row.valueInr += both(a, 'INR');
        row.valueUsd += both(a, 'USD');
        m.set(k, row);
      }
      return [...m.values()].sort((x, y) => y.valueInr - x.valueInr).slice(0, 10);
    };

    const statusCounts: Record<string, number> = {};
    for (const a of all) statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1;

    const signaturesInPeriod = all.reduce((s, a) => s + (inPeriod(a.scholarshipSignedAt) ? 1 : 0) + (inPeriod(a.agencySignedAt) ? 1 : 0), 0);
    const renewalsCompleted = await this.prisma.awardYear.count({
      where: { yearNumber: { gt: 1 }, status: 'RENEWED', award: scope, ...(since ? { renewedAt: { gte: since } } : {}) },
    });
    const renewalsDue = await this.prisma.awardYear.count({ where: { status: { in: ['DUE', 'OVERDUE'] }, award: scope } });
    const recent = await this.prisma.applicationStatusHistory.findMany({
      where: u.role === Role.UNIVERSITY_REP ? { application: { universityId: u.universityId } } : {},
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: { application: { select: { athleteName: true, universityName: true, applicationNo: true, sport: true } } },
    });
    const pipeline = await this.prisma.application.groupBy({ by: ['status'], where: u.role === Role.UNIVERSITY_REP ? { universityId: u.universityId } : {}, _count: { _all: true } });
    const newAwards = granted.filter((a) => inPeriod(a.grantDate));

    return {
      period: q.period ?? 'year',
      since,
      totals: {
        students: new Set(granted.map((a) => a.athleteUserId)).size,
        universities: new Set(granted.map((a) => a.universityId)).size,
        scholarshipValueInr: sum(granted, 'INR'),
        scholarshipValueUsd: sum(granted, 'USD'),
        byDuration,
        awarded: granted.length,
      },
      periodStats: {
        newAwards: newAwards.length,
        agreementsSigned: signaturesInPeriod,
        renewalsCompleted,
        revenueBookedInr: sum(newAwards, 'INR'),
        revenueBookedUsd: sum(newAwards, 'USD'),
      },
      statusCounts: { ...statusCounts, RENEWALS_DUE: renewalsDue },
      confirmation: {
        confirmedInr: sum(granted.filter((a) => a.universityConfirmationStatus === 'CONFIRMED'), 'INR'),
        pendingInr: sum(granted.filter((a) => a.universityConfirmationStatus !== 'CONFIRMED'), 'INR'),
      },
      byUniversity: group('universityName'),
      bySport: group('sport'),
      pipeline: Object.fromEntries(pipeline.map((p) => [p.status, p._count._all])),
      recentActivity: recent.map((r) => ({
        at: r.createdAt,
        applicationNo: r.application.applicationNo,
        athleteName: r.application.athleteName,
        universityName: r.application.universityName,
        sport: r.application.sport,
        from: r.fromStatus,
        to: r.toStatus,
        note: r.note,
      })),
    };
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    return this.awards.getForStaff(id, u);
  }

  @Roles(Role.ADMIN)
  @Post(':id/suspend')
  @HttpCode(200)
  suspend(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AwardActionDto, @CurrentUser() u: AuthUser) {
    return this.awards.suspend(id, dto.reason, u);
  }

  @Roles(Role.ADMIN)
  @Post(':id/reinstate')
  @HttpCode(200)
  reinstate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AwardActionDto, @CurrentUser() u: AuthUser) {
    return this.awards.reinstate(id, dto.reason, u);
  }

  @Roles(Role.ADMIN)
  @Post(':id/revoke')
  @HttpCode(200)
  revoke(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AwardActionDto, @CurrentUser() u: AuthUser) {
    return this.awards.revoke(id, dto.reason, !!dto.returnSeat, u);
  }

  @Roles(Role.ADMIN, Role.FINANCE, Role.UNIVERSITY_REP)
  @Post(':id/university-confirmation')
  @HttpCode(200)
  confirm(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ConfirmationDto, @CurrentUser() u: AuthUser) {
    return this.awards.setUniversityConfirmation(id, dto, u);
  }

  @Roles(Role.ADMIN, Role.REVIEWER)
  @Post(':id/remind')
  @HttpCode(200)
  remind(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    return this.awards.remind(id, u);
  }

  @Roles(Role.ADMIN)
  @Post(':id/resend-agreements')
  @HttpCode(200)
  resend(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    return this.awards.resendAgreements(id, u);
  }

  /** Runs the daily lifecycle job now. `asOf` (simulate a future date) is only honoured outside production. */
  @Roles(Role.SUPER_ADMIN)
  @Post('lifecycle/run')
  @HttpCode(200)
  run(@Query('asOf') asOf: string | undefined) {
    if (asOf && this.config.isProd) throw new ForbiddenException({ message: 'asOf is disabled in production' });
    return this.lifecycle.runLocked(asOf ? new Date(asOf) : new Date());
  }
}

@Controller('internal/awards')
@Internal()
export class InternalAwardsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const a = await this.prisma.award.findUnique({ where: { id }, include: { years: true } });
    if (!a) throw new NotFoundException();
    return a;
  }

  @Get('by-user/:userId')
  byUser(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.prisma.award.findMany({ where: { athleteUserId: userId }, include: { years: true } });
  }
}
