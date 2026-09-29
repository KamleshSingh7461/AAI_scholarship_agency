import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { NotificationChannel, OtpChannel, Role } from '@aci/contracts';
import { API, AuditService, CurrentUser, Internal, PageQuery, Roles, toPage, type AuthUser } from '@aci/nest-common';
import { NotificationService } from './notification.service';
import { PrismaService } from './prisma.service';
import type { Prisma } from './generated/prisma';

class OtpDto {
  @Matches(/^\+\d{8,15}$/)
  phone: string;
  @IsIn(Object.values(OtpChannel))
  channel: OtpChannel;
  @Matches(/^\d{4,8}$/)
  code: string;
  @IsInt()
  @Min(1)
  @Max(30)
  ttlMinutes: number;
  @IsOptional()
  @IsBoolean()
  fallbackToSms?: boolean;
}

class NotifyDto {
  @IsString()
  templateKey: string;
  @IsArray()
  @IsIn(Object.values(NotificationChannel), { each: true })
  channels: NotificationChannel[];
  @IsOptional()
  @IsString()
  userId?: string;
  @IsOptional()
  @IsObject()
  to?: { phone?: string; email?: string; whatsapp?: string };
  @IsOptional()
  @IsObject()
  data?: Record<string, string | number>;
}

class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;
  @IsString()
  @MaxLength(4000)
  body: string;
  @IsOptional()
  @IsString()
  providerTemplate?: string;
  @IsOptional()
  @IsString()
  dltTemplateId?: string;
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

class LogQuery extends PageQuery {
  @IsOptional()
  @IsString()
  userId?: string;
  @IsOptional()
  @IsIn(['QUEUED', 'SENDING', 'SENT', 'FAILED'])
  status?: string;
  @IsOptional()
  @IsIn(Object.values(NotificationChannel))
  channel?: string;
}

@ApiTags('notifications')
@Controller(`${API}/notifications`)
export class NotificationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: NotificationService,
    private readonly audit: AuditService,
  ) {}

  /** The athlete's own message history (shown as an activity feed). */
  @Get('mine')
  async mine(@CurrentUser() u: AuthUser, @Query() q: PageQuery) {
    const where = { userId: u.id, status: 'SENT' };
    const [items, total] = await Promise.all([
      this.prisma.notificationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.pageSize,
        select: { id: true, channel: true, subject: true, body: true, templateKey: true, sentAt: true, createdAt: true },
      }),
      this.prisma.notificationLog.count({ where }),
    ]);
    return toPage(items, total, q);
  }

  @Roles(Role.ADMIN)
  @Get('templates')
  templates() {
    return this.prisma.notificationTemplate.findMany({ orderBy: [{ key: 'asc' }, { channel: 'asc' }] });
  }

  @Roles(Role.ADMIN)
  @Put('templates/:id')
  async updateTemplate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTemplateDto, @CurrentUser() u: AuthUser) {
    const before = await this.prisma.notificationTemplate.findUniqueOrThrow({ where: { id } });
    const after = await this.prisma.notificationTemplate.update({ where: { id }, data: { ...dto, updatedById: u.id } });
    await this.audit.log(u, { action: 'template.update', entityType: 'NotificationTemplate', entityId: id, before, after });
    return after;
  }

  @Roles(Role.ADMIN, Role.REVIEWER, Role.FINANCE)
  @Get('logs')
  async logs(@Query() q: LogQuery) {
    const where: Prisma.NotificationLogWhereInput = {
      ...(q.userId ? { userId: q.userId } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.channel ? { channel: q.channel } : {}),
      ...(q.q ? { OR: [{ recipient: { contains: q.q } }, { templateKey: { contains: q.q } }] } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.notificationLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: q.skip, take: q.pageSize }),
      this.prisma.notificationLog.count({ where }),
    ]);
    return toPage(items, total, q);
  }

  /** Staff can manually message an athlete (e.g. "Remind" button on Signed Paperwork). */
  @Roles(Role.ADMIN, Role.REVIEWER)
  @Post('send')
  @HttpCode(202)
  async send(@Body() dto: NotifyDto, @CurrentUser() u: AuthUser) {
    const queued = await this.notify.enqueue(dto);
    await this.audit.log(u, { action: 'notification.send', entityType: 'Notification', entityId: dto.userId ?? 'n/a', after: dto });
    return { queued };
  }
}

@Controller('internal')
@Internal()
export class InternalNotificationController {
  constructor(private readonly notify: NotificationService) {}

  @Post('otp')
  @HttpCode(200)
  otp(@Body() dto: OtpDto) {
    return this.notify.sendOtp(dto.phone, dto.channel, dto.code, dto.ttlMinutes, dto.fallbackToSms ?? true);
  }

  @Post('notify')
  @HttpCode(202)
  async notifyNow(@Body() dto: NotifyDto) {
    return { queued: await this.notify.enqueue(dto) };
  }
}
