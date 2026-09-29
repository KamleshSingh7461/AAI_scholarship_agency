import { Body, Controller, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@aci/contracts';
import { API, CurrentUser, PageQuery, Roles, toPage, type AuthUser } from '@aci/nest-common';
import { PrismaService } from './prisma.service';
import { ApplicationService } from './application.service';
import {
  ApplicationQuery,
  CreateApplicationDto,
  NoteDto,
  RejectDto,
  StaffCreateApplicationDto,
  TransitionDto,
  UniversityDecisionDto,
} from './dto';
import type { Prisma } from './generated/prisma';

/** Fields an athlete may see about their own application (no internal notes, no reviewer ids). */
function athleteView(a: any) {
  const { reviewerId, universityDecisionById, createdByStaffId, notes, programSnapshot, ...rest } = a;
  return rest;
}

@ApiTags('applications (athlete)')
@Controller(`${API}/applications/mine`)
@Roles(Role.ATHLETE)
export class MyApplicationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly svc: ApplicationService,
  ) {}

  @Get()
  async list(@CurrentUser() u: AuthUser, @Query() q: PageQuery) {
    const where = { athleteUserId: u.id };
    const [items, total] = await Promise.all([
      this.prisma.application.findMany({ where, orderBy: { createdAt: 'desc' }, skip: q.skip, take: q.pageSize, include: { award: true } }),
      this.prisma.application.count({ where }),
    ]);
    return toPage(items.map(athleteView), total, q);
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    const a = await this.prisma.application.findUnique({
      where: { id },
      include: { history: { orderBy: { createdAt: 'asc' } }, award: { include: { years: { orderBy: { yearNumber: 'asc' } } } } },
    });
    if (!a || a.athleteUserId !== u.id) throw new NotFoundException({ message: 'Application not found', code: 'NOT_FOUND' });
    return athleteView(a);
  }

  @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateApplicationDto) {
    return this.svc.create(u, dto);
  }

  @Post(':id/pay')
  @HttpCode(200)
  pay(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    return this.svc.initiatePayment(id, u);
  }

  @Post(':id/withdraw')
  @HttpCode(200)
  withdraw(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @Body() dto: TransitionDto) {
    return this.svc.withdraw(id, u, dto.note);
  }
}

@ApiTags('applications (staff)')
@Controller(`${API}/applications`)
@Roles(Role.ADMIN, Role.REVIEWER, Role.FINANCE, Role.UNIVERSITY_REP)
export class StaffApplicationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly svc: ApplicationService,
  ) {}

  @Get()
  async list(@Query() q: ApplicationQuery, @CurrentUser() u: AuthUser) {
    const where: Prisma.ApplicationWhereInput = {
      ...(u.role === Role.UNIVERSITY_REP
        ? { universityId: u.universityId, status: q.status ?? { in: ['FORWARDED_TO_UNIVERSITY', 'UNIVERSITY_APPROVED', 'UNIVERSITY_REJECTED', 'AGREEMENTS_PENDING', 'AWARDED'] } }
        : { ...(q.status ? { status: q.status } : {}), ...(q.universityId ? { universityId: q.universityId } : {}) }),
      ...(q.programId ? { programId: q.programId } : {}),
      ...(q.athleteUserId ? { athleteUserId: q.athleteUserId } : {}),
      ...(q.q
        ? {
            OR: [
              { applicationNo: { contains: q.q, mode: 'insensitive' } },
              { athleteName: { contains: q.q, mode: 'insensitive' } },
              { athleteCode: { contains: q.q, mode: 'insensitive' } },
              { athletePhone: { contains: q.q } },
            ],
          }
        : {}),
    };
    const [items, total, counts] = await Promise.all([
      this.prisma.application.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: q.skip, take: q.pageSize, omit: { programSnapshot: true } }),
      this.prisma.application.count({ where }),
      this.prisma.application.groupBy({
        by: ['status'],
        _count: { _all: true },
        where: u.role === Role.UNIVERSITY_REP ? { universityId: u.universityId } : {},
      }),
    ]);
    return { ...toPage(items, total, q), statusCounts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) };
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    const a = await this.prisma.application.findUnique({
      where: { id },
      include: {
        history: { orderBy: { createdAt: 'asc' } },
        notes: { orderBy: { createdAt: 'desc' } },
        award: { include: { years: { orderBy: { yearNumber: 'asc' } } } },
      },
    });
    if (!a) throw new NotFoundException({ message: 'Application not found', code: 'NOT_FOUND' });
    this.svc.assertCanView(a, u);
    return u.role === Role.UNIVERSITY_REP ? { ...a, notes: [] } : a;
  }

  @Roles(Role.ADMIN)
  @Post()
  staffCreate(@Body() dto: StaffCreateApplicationDto, @CurrentUser() u: AuthUser) {
    return this.svc.staffCreate(u, dto);
  }

  @Roles(Role.ADMIN, Role.REVIEWER)
  @Post(':id/notes')
  async note(@Param('id', ParseUUIDPipe) id: string, @Body() dto: NoteDto, @CurrentUser() u: AuthUser) {
    await this.svc.get(id);
    return this.prisma.applicationNote.create({ data: { applicationId: id, authorId: u.id, authorName: u.name ?? u.phone, body: dto.body } });
  }

  @Roles(Role.ADMIN, Role.REVIEWER)
  @Post(':id/review')
  @HttpCode(200)
  review(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TransitionDto, @CurrentUser() u: AuthUser) {
    return this.svc.startReview(id, u, dto.note);
  }

  @Roles(Role.ADMIN, Role.REVIEWER)
  @Post(':id/forward')
  @HttpCode(200)
  forward(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TransitionDto, @CurrentUser() u: AuthUser) {
    return this.svc.forward(id, u, dto.note);
  }

  @Roles(Role.ADMIN, Role.REVIEWER)
  @Post(':id/reject')
  @HttpCode(200)
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectDto, @CurrentUser() u: AuthUser) {
    return this.svc.reject(id, u, dto.reason);
  }

  /** Records the university's decision. University reps decide for their own university. */
  @Roles(Role.ADMIN, Role.UNIVERSITY_REP)
  @Post(':id/university-decision')
  @HttpCode(200)
  decide(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UniversityDecisionDto, @CurrentUser() u: AuthUser) {
    return this.svc.universityDecision(id, dto, u);
  }

  @Roles(Role.ADMIN)
  @Post(':id/withdraw')
  @HttpCode(200)
  withdraw(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TransitionDto, @CurrentUser() u: AuthUser) {
    return this.svc.withdraw(id, u, dto.note ?? 'Withdrawn by staff');
  }
}
