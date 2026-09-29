import { Body, Controller, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@aci/contracts';
import { API, CurrentUser, Internal, Public, Roles, toPage, type AuthUser } from '@aci/nest-common';
import { PrismaService } from './prisma.service';
import { isOpen, programValue, ProgramService } from './program.service';
import { SeatService } from './seat.service';
import { FxClient } from './fx.client';
import { CatalogQuery, CreateProgramDto, ProgramQuery, SeatDto, UpdateProgramDto } from './dto';
import { assertUniversityScope } from './university.controller';
import type { Prisma } from './generated/prisma';

@ApiTags('programs (staff)')
@Controller(`${API}/programs`)
@Roles(Role.ADMIN, Role.REVIEWER, Role.FINANCE, Role.UNIVERSITY_REP)
export class ProgramController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly programs: ProgramService,
    private readonly fx: FxClient,
  ) {}

  @Get()
  async list(@Query() q: ProgramQuery, @CurrentUser() u: AuthUser) {
    const where: Prisma.ScholarshipProgramWhereInput = {
      ...(u.role === Role.UNIVERSITY_REP ? { universityId: u.universityId } : q.universityId ? { universityId: q.universityId } : {}),
      ...(q.status ? { status: q.status } : { status: { not: 'ARCHIVED' } }),
      ...(q.durationYears ? { durationYears: q.durationYears } : {}),
      ...(q.sport ? { eligibleSports: { has: q.sport } } : {}),
      ...(q.q ? { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { code: { contains: q.q, mode: 'insensitive' } }] } : {}),
    };
    const [items, total, rate] = await Promise.all([
      this.prisma.scholarshipProgram.findMany({ where, include: { university: true }, orderBy: { createdAt: 'desc' }, skip: q.skip, take: q.pageSize }),
      this.prisma.scholarshipProgram.count({ where }),
      this.fx.usdInrRate4(),
    ]);
    return toPage(await Promise.all(items.map((p) => this.programs.present(p, rate))), total, q);
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    const p = await this.prisma.scholarshipProgram.findUnique({ where: { id }, include: { university: true, allocation: true } });
    if (!p) throw new NotFoundException({ message: 'Program not found', code: 'NOT_FOUND' });
    assertUniversityScope(u, p.universityId);
    return this.programs.present(p);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateProgramDto, @CurrentUser() u: AuthUser) {
    return this.programs.create(dto, u);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProgramDto, @CurrentUser() u: AuthUser) {
    return this.programs.update(id, dto, u);
  }

  @Roles(Role.ADMIN)
  @Post(':id/publish')
  @HttpCode(200)
  publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    return this.programs.setStatus(id, 'PUBLISHED', u);
  }

  @Roles(Role.ADMIN)
  @Post(':id/close')
  @HttpCode(200)
  close(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    return this.programs.setStatus(id, 'CLOSED', u);
  }

  @Roles(Role.ADMIN)
  @Post(':id/archive')
  @HttpCode(200)
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    return this.programs.setStatus(id, 'ARCHIVED', u);
  }
}

/** Public catalog for the landing page and student portal. Values shown in INR. */
@ApiTags('catalog (public)')
@Controller(`${API}/catalog`)
@Public()
export class CatalogController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly programs: ProgramService,
    private readonly fx: FxClient,
  ) {}

  private publicView(p: Awaited<ReturnType<ProgramService['present']>>) {
    return {
      id: p.id,
      slug: p.slug,
      code: p.code,
      name: p.name,
      description: p.description,
      scholarshipType: p.scholarshipType,
      coverageType: p.coverageType,
      tuitionCoverageBps: p.tuitionCoverageBps,
      durationYears: p.durationYears,
      academicYear: p.academicYear,
      intakeDate: p.intakeDate,
      applicationOpensAt: p.applicationOpensAt,
      applicationClosesAt: p.applicationClosesAt,
      eligibleSports: p.eligibleSports,
      eligibilityCriteria: p.eligibilityCriteria,
      minAge: p.minAge,
      maxAge: p.maxAge,
      genderEligibility: p.genderEligibility,
      courses: p.courses,
      otherCostsNote: p.otherCostsNote,
      benefitsInr: p.value.inr,
      bearers: { tuition: p.tuitionBorneBy, room: p.roomBorneBy, food: p.foodBorneBy, other: p.otherBorneBy },
      fee: p.fee,
      feeRefundableOnRejection: p.feeRefundableOnRejection,
      seatsLeft: p.seatsLeft,
      seatsTotal: p.seatsTotal,
      isOpen: p.isOpen,
      university: p.university
        ? { id: p.university.id, name: p.university.name, shortName: p.university.shortName, city: p.university.city, state: p.university.state, logoUrl: p.university.logoUrl, website: p.university.website }
        : null,
    };
  }

  @Get('programs')
  async list(@Query() q: CatalogQuery) {
    const where: Prisma.ScholarshipProgramWhereInput = {
      status: 'PUBLISHED',
      university: { status: 'ACTIVE', ...(q.university ? { OR: [{ slug: q.university }, { name: { contains: q.university, mode: 'insensitive' } }] } : {}) },
      ...(q.durationYears ? { durationYears: q.durationYears } : {}),
      ...(q.sport ? { OR: [{ eligibleSports: { has: q.sport } }, { eligibleSports: { isEmpty: true } }] } : {}),
      ...(q.q ? { AND: [{ OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { university: { name: { contains: q.q, mode: 'insensitive' } } }] }] } : {}),
    };
    const [items, total, rate] = await Promise.all([
      this.prisma.scholarshipProgram.findMany({ where, include: { university: true }, orderBy: [{ applicationClosesAt: 'asc' }, { createdAt: 'desc' }], skip: q.skip, take: q.pageSize }),
      this.prisma.scholarshipProgram.count({ where }),
      this.fx.usdInrRate4(),
    ]);
    const presented = await Promise.all(items.map((p) => this.programs.present(p, rate)));
    return toPage(presented.map((p) => this.publicView(p)), total, q);
  }

  @Get('programs/:slug')
  async get(@Param('slug') slug: string) {
    const p = await this.prisma.scholarshipProgram.findFirst({
      where: { OR: [{ slug }, ...(/^[0-9a-f-]{36}$/.test(slug) ? [{ id: slug }] : [])], status: { in: ['PUBLISHED', 'CLOSED'] } },
      include: { university: true },
    });
    if (!p) throw new NotFoundException({ message: 'Scholarship not found', code: 'NOT_FOUND' });
    return this.publicView(await this.programs.present(p));
  }

  @Get('universities')
  async universities() {
    const rows = await this.prisma.university.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, shortName: true, slug: true, city: true, state: true, logoUrl: true, website: true, _count: { select: { programs: { where: { status: 'PUBLISHED' } } } } },
    });
    return rows.map(({ _count, ...u }) => ({ ...u, openPrograms: _count.programs }));
  }

  /** Headline numbers for the landing page. */
  @Get('stats')
  async stats() {
    const [programs, universities, rate] = await Promise.all([
      this.prisma.scholarshipProgram.findMany({ where: { status: 'PUBLISHED', university: { status: 'ACTIVE' } } }),
      this.prisma.university.count({ where: { status: 'ACTIVE' } }),
      this.fx.usdInrRate4(),
    ]);
    let seatsLeft = 0;
    let valueInr = 0;
    const sports = new Set<string>();
    for (const p of programs) {
      const left = Math.max(0, p.seatsTotal - p.seatsAwarded - p.seatsReserved);
      seatsLeft += left;
      const v = programValue(p);
      valueInr += left * (v.currency === 'USD' ? Math.round((v.totalValue * rate) / 10000) : v.totalValue);
      p.eligibleSports.forEach((s) => sports.add(s));
    }
    return { universities, openPrograms: programs.filter((p) => isOpen(p)).length, seatsLeft, availableValueInr: valueInr, sports: [...sports].sort() };
  }
}

@Controller('internal')
@Internal()
export class InternalUniversityController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly programs: ProgramService,
    private readonly seats: SeatService,
  ) {}

  @Get('programs/:id')
  async program(@Param('id', ParseUUIDPipe) id: string) {
    const p = await this.prisma.scholarshipProgram.findUnique({ where: { id }, include: { university: true } });
    if (!p) throw new NotFoundException({ message: 'Program not found', code: 'NOT_FOUND' });
    return this.programs.present(p);
  }

  @Get('universities/:id')
  university(@Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.university.findUniqueOrThrow({ where: { id } });
  }

  @Post('seats/reserve')
  @HttpCode(200)
  reserve(@Body() dto: SeatDto) {
    return this.seats.reserve(dto.programId!, dto.applicationId);
  }

  @Post('seats/confirm')
  @HttpCode(200)
  confirm(@Body() dto: SeatDto) {
    return this.seats.confirm(dto.applicationId);
  }

  @Post('seats/release')
  @HttpCode(200)
  release(@Body() dto: SeatDto & { returnAwarded?: boolean }) {
    return this.seats.release(dto.applicationId, dto.reason ?? 'released', false);
  }

  @Post('seats/return')
  @HttpCode(200)
  returnSeat(@Body() dto: SeatDto) {
    return this.seats.release(dto.applicationId, dto.reason ?? 'award revoked', true);
  }
}
