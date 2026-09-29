import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { normalizePhone, Role } from '@aci/contracts';
import { API, AuditService, ClientIp, CurrentUser, Internal, PageQuery, Roles, toPage, type AuthUser } from '@aci/nest-common';
import { CreateStaffDto, EnsureAthleteDto, UpdateUserDto } from './dto';
import { PrismaService } from './prisma.service';
import { TokenService } from './token.service';
import { publicUser } from './auth.controller';
import type { Prisma } from './generated/prisma';

class UserQuery extends PageQuery {
  @IsOptional()
  @IsIn(Object.values(Role))
  role?: Role;
}

/** Roles each staff role may create/assign. SUPER_ADMIN may assign anything (enforced by the guard bypass). */
const ASSIGNABLE: Partial<Record<Role, Role[]>> = {
  [Role.ADMIN]: [Role.REVIEWER, Role.FINANCE, Role.UNIVERSITY_REP],
};

@ApiTags('users (staff)')
@Controller(`${API}/auth/users`)
@Roles(Role.ADMIN)
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  private assertCanAssign(actor: AuthUser, role: Role) {
    if (actor.role === Role.SUPER_ADMIN) return;
    if (!ASSIGNABLE[actor.role]?.includes(role)) {
      throw new ForbiddenException({ message: `You cannot assign the ${role} role`, code: 'FORBIDDEN_ROLE' });
    }
  }

  @Get()
  async list(@Query() q: UserQuery) {
    const where: Prisma.UserWhereInput = {
      ...(q.role ? { role: q.role } : {}),
      ...(q.q
        ? { OR: [{ phone: { contains: q.q } }, { fullName: { contains: q.q, mode: 'insensitive' } }, { email: { contains: q.q, mode: 'insensitive' } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: q.skip, take: q.pageSize }),
      this.prisma.user.count({ where }),
    ]);
    return toPage(items.map(publicUser), total, q);
  }

  @Post()
  async create(@Body() dto: CreateStaffDto, @CurrentUser() actor: AuthUser, @ClientIp() ip: string) {
    this.assertCanAssign(actor, dto.role);
    const phone = normalizePhone(dto.phone);
    if (!phone) throw new BadRequestException({ message: 'Invalid phone number', code: 'INVALID_PHONE' });
    if (dto.role === Role.UNIVERSITY_REP && !dto.universityId) {
      throw new BadRequestException({ message: 'University reps must be linked to a university', code: 'UNIVERSITY_REQUIRED' });
    }
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) throw new ConflictException({ message: 'A user with this phone already exists', code: 'DUPLICATE' });
    const user = await this.prisma.user.create({
      data: { phone, fullName: dto.fullName, email: dto.email, role: dto.role, universityId: dto.universityId, createdById: actor.id },
    });
    await this.audit.log(actor, { action: 'user.create', entityType: 'User', entityId: user.id, after: publicUser(user), ip });
    return publicUser(user);
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: AuthUser, @ClientIp() ip: string) {
    const before = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    if (before.role === Role.SUPER_ADMIN && actor.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException({ message: 'Only a super admin can modify a super admin', code: 'FORBIDDEN' });
    }
    if (dto.role) this.assertCanAssign(actor, dto.role);
    if (id === actor.id && (dto.status === 'DISABLED' || (dto.role && dto.role !== before.role))) {
      throw new ForbiddenException({ message: 'You cannot disable yourself or change your own role', code: 'SELF_LOCKOUT' });
    }
    const user = await this.prisma.user.update({ where: { id }, data: dto });
    if (dto.status === 'DISABLED' || (dto.role && dto.role !== before.role)) {
      await this.tokens.revokeAllForUser(id, 'ADMIN_CHANGE');
    }
    await this.audit.log(actor, { action: 'user.update', entityType: 'User', entityId: id, before: publicUser(before), after: publicUser(user), ip });
    return publicUser(user);
  }

  @Post(':id/sessions/revoke')
  @HttpCode(200)
  async revoke(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser, @ClientIp() ip: string) {
    const revoked = await this.tokens.revokeAllForUser(id, 'ADMIN_REVOKED');
    await this.audit.log(actor, { action: 'user.sessions.revoke', entityType: 'User', entityId: id, ip });
    return { revoked };
  }
}

@Controller('internal/users')
@Internal()
export class InternalUsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return publicUser(await this.prisma.user.findUniqueOrThrow({ where: { id } }));
  }

  @Post('lookup')
  @HttpCode(200)
  async lookup(@Body() body: { ids: string[] }) {
    const ids = Array.isArray(body?.ids) ? body.ids.slice(0, 500) : [];
    const users = await this.prisma.user.findMany({ where: { id: { in: ids } } });
    return users.map(publicUser);
  }

  /** Used when staff invite an athlete who has not signed up yet. */
  @Post('ensure-athlete')
  @HttpCode(200)
  async ensureAthlete(@Body() dto: EnsureAthleteDto) {
    const phone = normalizePhone(dto.phone);
    if (!phone) throw new BadRequestException({ message: 'Invalid phone number', code: 'INVALID_PHONE' });
    const user = await this.prisma.user.upsert({
      where: { phone },
      update: {},
      create: { phone, fullName: dto.fullName, role: Role.ATHLETE },
    });
    return publicUser(user);
  }
}
