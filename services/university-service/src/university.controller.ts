import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role, STAFF_ROLES } from '@aci/contracts';
import { API, AuditService, CurrentUser, PageQuery, Roles, toPage, type AuthUser } from '@aci/nest-common';
import { PrismaService } from './prisma.service';
import { slugify } from './program.service';
import {
  CreateAgreementDto,
  CreateAllocationDto,
  CreateUniversityDto,
  UpdateAgreementDto,
  UpdateAllocationDto,
  UpdateUniversityDto,
} from './dto';

/** University reps only ever see their own university. */
export function assertUniversityScope(u: AuthUser, universityId: string) {
  if (u.role === Role.UNIVERSITY_REP && u.universityId !== universityId) {
    throw new ForbiddenException({ message: 'You can only access your own university', code: 'FORBIDDEN' });
  }
}

const date = (v?: string) => (v ? new Date(v) : undefined);

function addYears(d: Date, y: number) {
  const r = new Date(d);
  r.setUTCFullYear(r.getUTCFullYear() + y);
  return r;
}

@ApiTags('universities')
@Controller(`${API}/universities`)
@Roles(Role.ADMIN, Role.REVIEWER, Role.FINANCE, Role.UNIVERSITY_REP)
export class UniversityController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(@Query() q: PageQuery, @CurrentUser() u: AuthUser) {
    const where = {
      ...(u.role === Role.UNIVERSITY_REP ? { id: u.universityId } : {}),
      ...(q.q ? { OR: [{ name: { contains: q.q, mode: 'insensitive' as const } }, { city: { contains: q.q, mode: 'insensitive' as const } }] } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.university.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: q.skip,
        take: q.pageSize,
        include: { _count: { select: { programs: true, agreements: true } } },
      }),
      this.prisma.university.count({ where }),
    ]);
    return toPage(items, total, q);
  }

  /**
   * Inventory: how many scholarships are still left to award, split by length (4-year / 3-year / 2-year),
   * per university. Drives the "Scholarships Still Left To Be Awarded" dashboard card.
   */
  @Get('inventory')
  async inventory(@CurrentUser() u: AuthUser) {
    const programs = await this.prisma.scholarshipProgram.findMany({
      where: { status: { in: ['PUBLISHED', 'CLOSED', 'DRAFT'] }, ...(u.role === Role.UNIVERSITY_REP ? { universityId: u.universityId } : {}) },
      include: { university: { select: { id: true, name: true } } },
    });
    const byUni = new Map<string, { universityId: string; universityName: string; byDuration: Record<string, { total: number; awarded: number; reserved: number; left: number }> }>();
    const totals: Record<string, { total: number; awarded: number; reserved: number; left: number }> = {};
    for (const p of programs) {
      const key = `${p.durationYears}`;
      const row = byUni.get(p.universityId) ?? { universityId: p.universityId, universityName: p.university.name, byDuration: {} };
      const left = Math.max(0, p.seatsTotal - p.seatsAwarded - p.seatsReserved);
      for (const target of [row.byDuration, totals]) {
        const cell = (target[key] ??= { total: 0, awarded: 0, reserved: 0, left: 0 });
        cell.total += p.seatsTotal;
        cell.awarded += p.seatsAwarded;
        cell.reserved += p.seatsReserved;
        cell.left += left;
      }
      byUni.set(p.universityId, row);
    }
    const universities = [...byUni.values()]
      .map((r) => ({ ...r, totalLeft: Object.values(r.byDuration).reduce((s, c) => s + c.left, 0) }))
      .sort((a, b) => b.totalLeft - a.totalLeft);
    return {
      totals,
      totalLeft: Object.values(totals).reduce((s, c) => s + c.left, 0),
      totalAwarded: Object.values(totals).reduce((s, c) => s + c.awarded, 0),
      universities,
    };
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    assertUniversityScope(u, id);
    const uni = await this.prisma.university.findUnique({
      where: { id },
      include: {
        agreements: { orderBy: { effectiveDate: 'desc' } },
        allocations: { orderBy: { academicYear: 'desc' } },
        programs: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!uni) throw new NotFoundException({ message: 'University not found', code: 'NOT_FOUND' });
    return uni;
  }

  @Roles(Role.ADMIN)
  @Post()
  async create(@Body() dto: CreateUniversityDto, @CurrentUser() u: AuthUser) {
    let slug = slugify(dto.shortName ? `${dto.shortName}-${dto.city ?? ''}` : dto.name);
    if (await this.prisma.university.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    const uni = await this.prisma.university.create({ data: { ...dto, slug } });
    await this.audit.log(u, { action: 'university.create', entityType: 'University', entityId: uni.id, after: uni });
    return uni;
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUniversityDto, @CurrentUser() u: AuthUser) {
    const before = await this.prisma.university.findUniqueOrThrow({ where: { id } });
    const uni = await this.prisma.university.update({ where: { id }, data: dto });
    await this.audit.log(u, { action: 'university.update', entityType: 'University', entityId: id, before, after: uni });
    return uni;
  }

  // ---------------- Partnership agreements (MoUs & letters) ----------------

  @Get(':id/agreements')
  agreements(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    assertUniversityScope(u, id);
    return this.prisma.partnershipAgreement.findMany({ where: { universityId: id }, orderBy: { effectiveDate: 'desc' } });
  }

  @Roles(Role.ADMIN)
  @Post(':id/agreements')
  async createAgreement(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateAgreementDto, @CurrentUser() u: AuthUser) {
    await this.prisma.university.findUniqueOrThrow({ where: { id } });
    const effective = new Date(dto.effectiveDate);
    const a = await this.prisma.partnershipAgreement.create({
      data: {
        ...dto,
        universityId: id,
        signedDate: date(dto.signedDate),
        effectiveDate: effective,
        expiresAt: dto.termYears ? addYears(effective, dto.termYears) : undefined,
      },
    });
    await this.audit.log(u, { action: 'agreement.create', entityType: 'PartnershipAgreement', entityId: a.id, after: a });
    return a;
  }

  // ---------------- Annual allocations (Scholarship Transfer Letter) ----------------

  @Get(':id/allocations')
  async allocations(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    assertUniversityScope(u, id);
    const rows = await this.prisma.scholarshipAllocation.findMany({
      where: { universityId: id },
      orderBy: { academicYear: 'desc' },
      include: { programs: { select: { id: true, name: true, seatsTotal: true, seatsAwarded: true, seatsReserved: true, durationYears: true, status: true } } },
    });
    return rows.map((a) => {
      const assigned = a.programs.filter((p) => p.status !== 'ARCHIVED').reduce((s, p) => s + p.seatsTotal, 0);
      const awarded = a.programs.reduce((s, p) => s + p.seatsAwarded, 0);
      return { ...a, capacity: a.totalSeats + a.rolledOverSeats, assignedToPrograms: assigned, awarded, unassigned: a.totalSeats + a.rolledOverSeats - assigned };
    });
  }

  @Roles(Role.ADMIN)
  @Post(':id/allocations')
  async createAllocation(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateAllocationDto, @CurrentUser() u: AuthUser) {
    await this.prisma.university.findUniqueOrThrow({ where: { id } });
    const a = await this.prisma.scholarshipAllocation.create({
      data: {
        ...dto,
        universityId: id,
        valuationPerSeatAnnual: dto.valuationPerSeatAnnual !== undefined ? BigInt(dto.valuationPerSeatAnnual) : undefined,
      },
    });
    await this.audit.log(u, { action: 'allocation.create', entityType: 'ScholarshipAllocation', entityId: a.id, after: a });
    return a;
  }
}

@ApiTags('universities')
@Controller(API)
@Roles(Role.ADMIN)
export class AgreementAllocationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Patch('agreements/:id')
  async updateAgreement(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAgreementDto, @CurrentUser() u: AuthUser) {
    const before = await this.prisma.partnershipAgreement.findUniqueOrThrow({ where: { id } });
    const effective = dto.effectiveDate ? new Date(dto.effectiveDate) : before.effectiveDate;
    const termYears = dto.termYears ?? before.termYears;
    const a = await this.prisma.partnershipAgreement.update({
      where: { id },
      data: {
        ...dto,
        signedDate: date(dto.signedDate),
        effectiveDate: dto.effectiveDate ? effective : undefined,
        expiresAt: termYears ? addYears(effective, termYears) : undefined,
      },
    });
    await this.audit.log(u, { action: 'agreement.update', entityType: 'PartnershipAgreement', entityId: id, before, after: a });
    return a;
  }

  @Patch('allocations/:id')
  async updateAllocation(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAllocationDto, @CurrentUser() u: AuthUser) {
    const before = await this.prisma.scholarshipAllocation.findUniqueOrThrow({ where: { id }, include: { programs: true } });
    if (before.status !== 'OPEN') throw new ConflictException({ message: 'Allocation is closed', code: 'ALLOCATION_CLOSED' });
    if (dto.totalSeats !== undefined) {
      const assigned = before.programs.filter((p) => p.status !== 'ARCHIVED').reduce((s, p) => s + p.seatsTotal, 0);
      if (dto.totalSeats + before.rolledOverSeats < assigned) {
        throw new ConflictException({ message: `Programs already use ${assigned} seats from this allocation`, code: 'SEATS_IN_USE' });
      }
    }
    const a = await this.prisma.scholarshipAllocation.update({
      where: { id },
      data: { ...dto, valuationPerSeatAnnual: dto.valuationPerSeatAnnual !== undefined ? BigInt(dto.valuationPerSeatAnnual) : undefined },
    });
    await this.audit.log(u, { action: 'allocation.update', entityType: 'ScholarshipAllocation', entityId: id, before, after: a });
    return a;
  }

  /**
   * Year-end close. Seats not awarded are either forfeited or rolled into the next academic
   * year's allocation, according to the allocation's rolloverPolicy.
   */
  @Post('allocations/:id/close')
  @HttpCode(200)
  async closeAllocation(@Param('id', ParseUUIDPipe) id: string, @Body() body: { nextAcademicYear?: string }, @CurrentUser() u: AuthUser) {
    const a = await this.prisma.scholarshipAllocation.findUniqueOrThrow({ where: { id }, include: { programs: true } });
    if (a.status !== 'OPEN') throw new ConflictException({ message: 'Allocation already closed', code: 'ALLOCATION_CLOSED' });
    if (a.programs.some((p) => p.seatsReserved > 0)) {
      throw new ConflictException({ message: 'Some seats are still pending agreement signatures', code: 'SEATS_PENDING' });
    }
    const awarded = a.programs.reduce((s, p) => s + p.seatsAwarded, 0);
    const unused = Math.max(0, a.totalSeats + a.rolledOverSeats - awarded);
    const [startY] = a.academicYear.split('-').map(Number);
    const nextYear = body?.nextAcademicYear ?? `${startY + 1}-${String((startY + 2) % 100).padStart(2, '0')}`;
    if (!/^\d{4}-\d{2}$/.test(nextYear)) throw new BadRequestException({ message: 'Invalid next academic year' });

    return this.prisma.$transaction(async (tx) => {
      let rolledTo: string | null = null;
      if (a.rolloverPolicy === 'ROLLOVER' && unused > 0) {
        const next = await tx.scholarshipAllocation.upsert({
          where: { universityId_academicYear: { universityId: a.universityId, academicYear: nextYear } },
          update: { rolledOverSeats: { increment: unused } },
          create: {
            universityId: a.universityId,
            agreementId: a.agreementId,
            academicYear: nextYear,
            totalSeats: 0,
            rolledOverSeats: unused,
            rolloverPolicy: a.rolloverPolicy,
            valuationPerSeatAnnual: a.valuationPerSeatAnnual,
            valuationCurrency: a.valuationCurrency,
            notes: `Created by rollover from ${a.academicYear}`,
          },
        });
        rolledTo = next.id;
      }
      await tx.scholarshipProgram.updateMany({ where: { allocationId: id, status: 'PUBLISHED' }, data: { status: 'CLOSED' } });
      const closed = await tx.scholarshipAllocation.update({
        where: { id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          forfeitedSeats: a.rolloverPolicy === 'FORFEIT' ? unused : 0,
          rolledToAllocationId: rolledTo,
        },
      });
      await this.audit.log(u, { action: 'allocation.close', entityType: 'ScholarshipAllocation', entityId: id, after: { awarded, unused, policy: a.rolloverPolicy, rolledTo } }, tx);
      return { ...closed, awarded, unused };
    });
  }
}

export { STAFF_ROLES };
