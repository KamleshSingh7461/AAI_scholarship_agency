import { Body, Controller, Get, HttpCode, Injectable, NotFoundException, Param, ParseUUIDPipe, Post, Query, Req, type RawBodyRequest } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Cron } from '@nestjs/schedule';
import type { Request } from 'express';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { AgreementType, EnvelopeStatus, Role } from '@aci/contracts';
import { API, AuditService, ClientIp, CurrentUser, Internal, PageQuery, Public, RedisService, Roles, toPage, type AuthUser } from '@aci/nest-common';
import { EsignService, type CreateEnvelopeInput } from './esign.service';
import { PrismaService } from './prisma.service';
import type { Prisma } from './generated/prisma';

class SessionDto {
  @IsOptional() @IsIn(['signer', 'guardian']) as?: 'signer' | 'guardian';
}

class MockSignDto {
  @IsString() @Length(2, 120) typedName: string;
  @IsOptional() @IsString() @MaxLength(120) guardianTypedName?: string;
  @IsBoolean() agree: boolean;
}

class DeclineDto {
  @IsString() @Length(3, 500) reason: string;
}

class EnvelopeQuery extends PageQuery {
  @IsOptional() @IsIn(Object.values(EnvelopeStatus)) status?: string;
  @IsOptional() @IsIn(Object.values(AgreementType)) agreementType?: string;
  @IsOptional() @IsUUID() signerUserId?: string;
  @IsOptional() @IsUUID() referenceId?: string;
}

class TemplateDto {
  @IsIn(Object.values(AgreementType)) type: string;
  @IsString() @Length(3, 200) title: string;
  @IsString() @Length(50, 60000) body: string;
  @IsOptional() @IsUUID() universityId?: string;
  @IsOptional() @IsBoolean() activate?: boolean;
}

function view(e: any) {
  const { mergeFields, signatureAnchors, ...rest } = e;
  return rest;
}

@ApiTags('esign (athlete)')
@Controller(`${API}/esign/envelopes`)
export class AthleteEnvelopeController {
  constructor(
    private readonly svc: EsignService,
    private readonly prisma: PrismaService,
  ) {}

  @Roles(Role.ATHLETE)
  @Get('mine')
  async mine(@CurrentUser() u: AuthUser) {
    const rows = await this.prisma.envelope.findMany({ where: { signerUserId: u.id }, orderBy: { createdAt: 'desc' } });
    return rows.map(view);
  }

  @Roles(Role.ATHLETE)
  @Get('mine/:id')
  async one(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    const e = await this.svc.getOwned(id, u);
    return { ...view(e), content: await this.svc.content(e), provider: this.svc.provider.name };
  }

  @Roles(Role.ATHLETE)
  @Post('mine/:id/session')
  @HttpCode(200)
  async session(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SessionDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string, @Req() req: Request) {
    const e = await this.svc.getOwned(id, u);
    return this.svc.signingSession(e, dto.as ?? 'signer', { ip, ua: req.headers['user-agent'] });
  }

  /** In-app signing (local/mock provider). With DocuSign the athlete signs inside DocuSign's embedded view. */
  @Roles(Role.ATHLETE)
  @Post('mine/:id/sign')
  @HttpCode(200)
  async sign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MockSignDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string, @Req() req: Request) {
    const e = await this.svc.getOwned(id, u);
    return view(await this.svc.mockSign(e, dto, { ip, ua: req.headers['user-agent'] }));
  }

  /** Called when DocuSign redirects back to the portal: re-checks status with DocuSign. */
  @Roles(Role.ATHLETE)
  @Post('mine/:id/sync')
  @HttpCode(200)
  async sync(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    return view(await this.svc.sync(await this.svc.getOwned(id, u)));
  }

  @Roles(Role.ATHLETE)
  @Post('mine/:id/decline')
  @HttpCode(200)
  async decline(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DeclineDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string, @Req() req: Request) {
    return view(await this.svc.decline(await this.svc.getOwned(id, u), dto.reason, { ip, ua: req.headers['user-agent'] }));
  }
}

/** "Signed Paperwork" admin page. */
@ApiTags('esign (staff)')
@Controller(`${API}/esign`)
@Roles(Role.ADMIN, Role.REVIEWER, Role.FINANCE, Role.UNIVERSITY_REP)
export class StaffEnvelopeController {
  constructor(
    private readonly svc: EsignService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('envelopes')
  async list(@Query() q: EnvelopeQuery) {
    const where: Prisma.EnvelopeWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.agreementType ? { agreementType: q.agreementType } : {}),
      ...(q.signerUserId ? { signerUserId: q.signerUserId } : {}),
      ...(q.referenceId ? { referenceId: q.referenceId } : {}),
      ...(q.q ? { OR: [{ signerName: { contains: q.q, mode: 'insensitive' } }, { signerEmail: { contains: q.q, mode: 'insensitive' } }, { title: { contains: q.q, mode: 'insensitive' } }] } : {}),
    };
    const [items, total, counts] = await Promise.all([
      this.prisma.envelope.findMany({ where, orderBy: { createdAt: 'desc' }, skip: q.skip, take: q.pageSize }),
      this.prisma.envelope.count({ where }),
      this.prisma.envelope.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    return { ...toPage(items.map(view), total, q), statusCounts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) };
  }

  @Get('envelopes/:id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const e = await this.prisma.envelope.findUnique({ where: { id }, include: { events: { orderBy: { createdAt: 'asc' } } } });
    if (!e) throw new NotFoundException({ message: 'Envelope not found', code: 'NOT_FOUND' });
    return { ...view(e), content: await this.svc.content(e) };
  }

  @Roles(Role.ADMIN, Role.REVIEWER)
  @Post('envelopes/:id/remind')
  @HttpCode(200)
  remind(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    return this.svc.remind(id, u);
  }

  @Roles(Role.ADMIN)
  @Post('envelopes/:id/sync')
  @HttpCode(200)
  async sync(@Param('id', ParseUUIDPipe) id: string) {
    return view(await this.svc.sync(await this.prisma.envelope.findUniqueOrThrow({ where: { id } })));
  }

  // ---------------- Templates (versioned legal text) ----------------

  @Roles(Role.ADMIN)
  @Get('templates')
  templates() {
    return this.prisma.agreementTemplate.findMany({ orderBy: [{ type: 'asc' }, { version: 'desc' }], include: { _count: { select: { envelopes: true } } } });
  }

  /** Templates are immutable once used: editing always creates a new version. */
  @Roles(Role.ADMIN)
  @Post('templates')
  async createTemplate(@Body() dto: TemplateDto, @CurrentUser() u: AuthUser) {
    const latest = await this.prisma.agreementTemplate.findFirst({ where: { type: dto.type, universityId: dto.universityId ?? null }, orderBy: { version: 'desc' } });
    const t = await this.prisma.$transaction(async (tx) => {
      if (dto.activate) await tx.agreementTemplate.updateMany({ where: { type: dto.type, universityId: dto.universityId ?? null }, data: { active: false } });
      return tx.agreementTemplate.create({
        data: { type: dto.type, title: dto.title, body: dto.body, universityId: dto.universityId, version: (latest?.version ?? 0) + 1, active: !!dto.activate, createdById: u.id },
      });
    });
    await this.audit.log(u, { action: 'template.create', entityType: 'AgreementTemplate', entityId: t.id, after: { type: t.type, version: t.version, active: t.active } });
    return t;
  }

  @Roles(Role.ADMIN)
  @Post('templates/:id/activate')
  @HttpCode(200)
  async activate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    const t = await this.prisma.agreementTemplate.findUniqueOrThrow({ where: { id } });
    await this.prisma.$transaction([
      this.prisma.agreementTemplate.updateMany({ where: { type: t.type, universityId: t.universityId }, data: { active: false } }),
      this.prisma.agreementTemplate.update({ where: { id }, data: { active: true } }),
    ]);
    await this.audit.log(u, { action: 'template.activate', entityType: 'AgreementTemplate', entityId: id, after: { type: t.type, version: t.version } });
    return { activated: true };
  }
}

@ApiTags('esign (webhooks)')
@Controller(`${API}/esign/webhooks`)
@Public()
export class EsignWebhookController {
  constructor(private readonly svc: EsignService) {}

  @Post('docusign')
  @HttpCode(200)
  docusign(@Req() req: RawBodyRequest<Request>) {
    return this.svc.handleWebhook(req.headers, req.rawBody ?? Buffer.from(''));
  }
}

@Controller('internal/envelopes')
@Internal()
export class InternalEnvelopeController {
  constructor(private readonly svc: EsignService) {}

  @Post()
  @HttpCode(200)
  async create(@Body() body: CreateEnvelopeInput) {
    return view(await this.svc.create(body));
  }

  @Post(':id/void')
  @HttpCode(200)
  async void(@Param('id', ParseUUIDPipe) id: string, @Body() body: { reason?: string }) {
    return view(await this.svc.void(id, body?.reason ?? 'Voided'));
  }
}

@Injectable()
export class EnvelopeExpiryJob {
  constructor(
    private readonly svc: EsignService,
    private readonly redis: RedisService,
  ) {}

  @Cron('0 15 * * * *')
  async run() {
    await this.redis.withLock('envelope-expiry', 10 * 60_000, () => this.svc.expireOverdue());
  }
}
