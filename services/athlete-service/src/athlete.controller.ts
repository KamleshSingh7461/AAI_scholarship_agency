import { Body, Controller, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@aci/contracts';
import { API, CurrentUser, Internal, Roles, toPage, type AuthUser } from '@aci/nest-common';
import { AthleteService, ageOn, type FullProfile } from './athlete.service';
import { PrismaService } from './prisma.service';
import {
  AcademicInfoDto,
  AthleteQuery,
  DocumentsDto,
  PersonalInfoDto,
  ReferencesDto,
  ReviewDto,
  SportsInfoDto,
  VerifyDocumentDto,
} from './dto';
import type { Prisma } from './generated/prisma';

/** Compact representation used by other services (application snapshot, finance, notifications). */
export function summary(p: FullProfile | (Prisma.AthleteProfileGetPayload<{ include: { sports: true } }>)) {
  return {
    profileId: p.id,
    userId: p.userId,
    athleteCode: p.athleteCode,
    status: p.status,
    fullName: [p.firstName, p.lastName].filter(Boolean).join(' ') || null,
    firstName: p.firstName,
    lastName: p.lastName,
    dateOfBirth: p.dateOfBirth,
    age: p.dateOfBirth ? ageOn(p.dateOfBirth) : null,
    isMinor: p.dateOfBirth ? ageOn(p.dateOfBirth) < 18 : false,
    gender: p.gender,
    email: p.email,
    phone: p.phone,
    whatsappNumber: p.whatsappNumber ?? p.phone,
    city: p.city,
    state: p.state,
    primarySport: p.sports?.primarySport ?? null,
    guardian: p.guardianName ? { name: p.guardianName, relation: p.guardianRelation, phone: p.guardianPhone, email: p.guardianEmail } : null,
    profilePhotoDocumentId: p.profilePhotoDocumentId,
    submittedAt: p.submittedAt,
  };
}

@ApiTags('athlete (self)')
@Controller(`${API}/athletes/me`)
@Roles(Role.ATHLETE)
export class AthleteSelfController {
  constructor(private readonly svc: AthleteService) {}

  @Get()
  async me(@CurrentUser() u: AuthUser) {
    const p = await this.svc.getOrCreate(u);
    return { profile: p, completeness: this.svc.completeness(p) };
  }

  @Put('personal')
  async personal(@CurrentUser() u: AuthUser, @Body() dto: PersonalInfoDto) {
    const p = await this.svc.savePersonal(u, dto);
    return { profile: p, completeness: this.svc.completeness(p) };
  }

  @Put('academic')
  async academic(@CurrentUser() u: AuthUser, @Body() dto: AcademicInfoDto) {
    const p = await this.svc.saveAcademic(u, dto);
    return { profile: p, completeness: this.svc.completeness(p) };
  }

  @Put('sports')
  async sports(@CurrentUser() u: AuthUser, @Body() dto: SportsInfoDto) {
    const p = await this.svc.saveSports(u, dto);
    return { profile: p, completeness: this.svc.completeness(p) };
  }

  @Put('documents')
  async documents(@CurrentUser() u: AuthUser, @Body() dto: DocumentsDto) {
    const p = await this.svc.saveDocuments(u, dto);
    return { profile: p, completeness: this.svc.completeness(p) };
  }

  @Put('references')
  async references(@CurrentUser() u: AuthUser, @Body() dto: ReferencesDto) {
    const p = await this.svc.saveReferences(u, dto);
    return { profile: p, completeness: this.svc.completeness(p) };
  }

  @Post('submit')
  @HttpCode(200)
  async submit(@CurrentUser() u: AuthUser) {
    const p = await this.svc.submit(u);
    return { profile: p, completeness: this.svc.completeness(p) };
  }
}

@ApiTags('athletes (staff)')
@Controller(`${API}/athletes`)
@Roles(Role.ADMIN, Role.REVIEWER, Role.FINANCE, Role.UNIVERSITY_REP)
export class AthleteAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly svc: AthleteService,
  ) {}

  @Get()
  async list(@Query() q: AthleteQuery) {
    const where: Prisma.AthleteProfileWhereInput = {
      ...(q.status ? { status: q.status } : { status: { not: 'DRAFT' } }),
      ...(q.sport ? { sports: { primarySport: { equals: q.sport, mode: 'insensitive' } } } : {}),
      ...(q.q
        ? {
            OR: [
              { firstName: { contains: q.q, mode: 'insensitive' } },
              { lastName: { contains: q.q, mode: 'insensitive' } },
              { athleteCode: { contains: q.q, mode: 'insensitive' } },
              { phone: { contains: q.q } },
              { email: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.athleteProfile.findMany({ where, include: { sports: true }, orderBy: { submittedAt: 'desc' }, skip: q.skip, take: q.pageSize }),
      this.prisma.athleteProfile.count({ where }),
    ]);
    return toPage(items.map(summary), total, q);
  }

  @Get('stats')
  async stats() {
    const [byStatus, bySport] = await Promise.all([
      this.prisma.athleteProfile.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.sportsProfile.groupBy({ by: ['primarySport'], _count: { _all: true }, orderBy: { _count: { primarySport: 'desc' } }, take: 20 }),
    ]);
    return {
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
      bySport: bySport.map((r) => ({ sport: r.primarySport, count: r._count._all })),
    };
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const p = await this.prisma.athleteProfile.findUnique({
      where: { id },
      include: { academics: true, sports: true, documents: true, references: true },
    });
    if (!p) throw new NotFoundException({ message: 'Athlete not found', code: 'NOT_FOUND' });
    return { profile: p, completeness: this.svc.completeness(p as FullProfile) };
  }

  @Roles(Role.ADMIN, Role.REVIEWER)
  @Post(':id/review')
  @HttpCode(200)
  review(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewDto, @CurrentUser() u: AuthUser) {
    return this.svc.review(id, dto, u);
  }

  @Roles(Role.ADMIN, Role.REVIEWER)
  @Patch(':id/documents/:docId')
  verifyDoc(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @Body() dto: VerifyDocumentDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.svc.verifyDocument(id, docId, dto, u);
  }
}

@Controller('internal/athletes')
@Internal()
export class InternalAthleteController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('by-user/:userId')
  async byUser(@Param('userId', ParseUUIDPipe) userId: string) {
    const p = await this.prisma.athleteProfile.findUnique({ where: { userId }, include: { sports: true } });
    if (!p) throw new NotFoundException({ message: 'Athlete profile not found', code: 'PROFILE_NOT_FOUND' });
    return summary(p);
  }

  @Post('lookup')
  @HttpCode(200)
  async lookup(@Body() body: { userIds: string[] }) {
    const ids = Array.isArray(body?.userIds) ? body.userIds.slice(0, 1000) : [];
    const rows = await this.prisma.athleteProfile.findMany({ where: { userId: { in: ids } }, include: { sports: true } });
    return rows.map(summary);
  }
}
