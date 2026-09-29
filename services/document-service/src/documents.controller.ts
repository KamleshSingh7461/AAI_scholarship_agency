import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsArray, IsBase64, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { randomUUID, createHash } from 'node:crypto';
import { Role, STAFF_ROLES } from '@aci/contracts';
import { API, APP_CONFIG, AuditService, CurrentUser, Internal, PageQuery, Roles, toPage, type AuthUser } from '@aci/nest-common';
import type { DocumentConfig } from './config';
import { PrismaService } from './prisma.service';
import { ALLOWED_TYPES, StorageService, SYSTEM_TYPES } from './storage.service';
import type { Document } from './generated/prisma';

export const CATEGORIES = ['ATHLETE_DOCUMENT', 'AGREEMENT_SIGNED', 'MOU', 'UNIVERSITY_LETTER', 'REPORT', 'RECEIPT', 'RENEWAL_DOCUMENT', 'OTHER'] as const;
/** Categories an athlete may upload themselves. Everything else is staff/system only. */
const ATHLETE_UPLOADABLE = new Set(['ATHLETE_DOCUMENT', 'RENEWAL_DOCUMENT']);

class CreateUploadDto {
  @IsString()
  @Length(1, 200)
  fileName: string;

  @IsIn(Object.keys(ALLOWED_TYPES))
  mimeType: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes: number;

  @IsIn(CATEGORIES as unknown as string[])
  category: string;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  subType?: string;

  /** Staff uploading on behalf of an athlete. */
  @IsOptional()
  @IsUUID()
  ownerUserId?: string;
}

class ListQuery extends PageQuery {
  @IsOptional()
  @IsUUID()
  ownerUserId?: string;
  @IsOptional()
  @IsIn(CATEGORIES as unknown as string[])
  category?: string;
}

class InternalStoreDto {
  @IsIn(CATEGORIES as unknown as string[])
  category: string;
  @IsOptional()
  @IsString()
  subType?: string;
  @IsOptional()
  @IsUUID()
  ownerUserId?: string;
  @IsString()
  @Length(1, 200)
  fileName: string;
  @IsString()
  mimeType: string;
  @IsBase64()
  contentBase64: string;
  @IsString()
  sourceService: string;
}

class ValidateDto {
  @IsArray()
  @IsUUID('all', { each: true })
  ids: string[];
  @IsOptional()
  @IsUUID()
  ownerUserId?: string;
}

export function view(d: Document) {
  return {
    id: d.id,
    ownerUserId: d.ownerUserId,
    category: d.category,
    subType: d.subType,
    fileName: d.fileName,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    status: d.status,
    uploadedAt: d.uploadedAt,
    createdAt: d.createdAt,
  };
}

function canRead(u: AuthUser, d: Document): boolean {
  if (d.ownerUserId && d.ownerUserId === u.id) return true;
  if (STAFF_ROLES.includes(u.role)) return true;
  // University reps review candidates' documents and signed agreements.
  if (u.role === Role.UNIVERSITY_REP) return ['ATHLETE_DOCUMENT', 'AGREEMENT_SIGNED', 'RENEWAL_DOCUMENT'].includes(d.category);
  return false;
}

@ApiTags('documents')
@Controller(`${API}/documents`)
export class DocumentsController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: DocumentConfig,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  private async getReadable(id: string, u: AuthUser): Promise<Document> {
    const d = await this.prisma.document.findUnique({ where: { id } });
    if (!d || d.status === 'DELETED') throw new NotFoundException({ message: 'Document not found', code: 'NOT_FOUND' });
    if (!canRead(u, d)) throw new ForbiddenException({ message: 'You cannot access this document', code: 'FORBIDDEN' });
    return d;
  }

  /** Step 1 of an upload: returns a presigned POST the browser sends the file to directly. */
  @Post('uploads')
  async createUpload(@Body() dto: CreateUploadDto, @CurrentUser() u: AuthUser) {
    const isStaff = STAFF_ROLES.includes(u.role);
    if (!isStaff && !ATHLETE_UPLOADABLE.has(dto.category)) {
      throw new ForbiddenException({ message: 'You cannot upload this kind of document', code: 'FORBIDDEN' });
    }
    if (dto.ownerUserId && !isStaff && dto.ownerUserId !== u.id) {
      throw new ForbiddenException({ message: 'You can only upload your own documents', code: 'FORBIDDEN' });
    }
    const maxBytes = this.config.env.DOCUMENT_MAX_UPLOAD_MB * 1024 * 1024;
    if (dto.sizeBytes > maxBytes) {
      throw new BadRequestException({ message: `Files must be under ${this.config.env.DOCUMENT_MAX_UPLOAD_MB} MB`, code: 'FILE_TOO_LARGE' });
    }
    const owner = dto.ownerUserId ?? (isStaff ? null : u.id);
    const id = randomUUID();
    const ext = ALLOWED_TYPES[dto.mimeType].ext;
    const key = `${dto.category.toLowerCase()}/${owner ?? 'system'}/${new Date().getUTCFullYear()}/${id}.${ext}`;
    const doc = await this.prisma.document.create({
      data: {
        id,
        ownerUserId: owner,
        uploadedById: u.id,
        category: dto.category,
        subType: dto.subType,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        storageKey: key,
      },
    });
    const upload = await this.storage.presignUpload(key, dto.mimeType, maxBytes);
    return { document: view(doc), upload, maxBytes };
  }

  /** Step 2: verifies the object really landed and is what it claims to be. */
  @Post(':id/complete')
  @HttpCode(200)
  async complete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    const d = await this.prisma.document.findUnique({ where: { id } });
    if (!d || d.uploadedById !== u.id) throw new NotFoundException({ message: 'Upload not found', code: 'NOT_FOUND' });
    if (d.status === 'AVAILABLE') return view(d);
    const head = await this.storage.head(d.storageKey);
    if (!head) throw new BadRequestException({ message: 'The file has not been uploaded yet', code: 'UPLOAD_MISSING' });
    const bytes = await this.storage.readHead(d.storageKey, 16);
    const okType = ALLOWED_TYPES[d.mimeType]?.magic(bytes);
    if (!okType) {
      await this.storage.delete(d.storageKey).catch(() => undefined);
      const rejected = await this.prisma.document.update({ where: { id }, data: { status: 'REJECTED', rejectReason: 'File content does not match its type' } });
      throw new BadRequestException({ message: 'The file appears to be corrupted or is not a real PDF/image', code: 'INVALID_FILE', document: view(rejected) });
    }
    const updated = await this.prisma.document.update({
      where: { id },
      data: { status: 'AVAILABLE', sizeBytes: Number(head.ContentLength ?? d.sizeBytes), uploadedAt: new Date() },
    });
    return view(updated);
  }

  @Get()
  async list(@Query() q: ListQuery, @CurrentUser() u: AuthUser) {
    const isStaff = STAFF_ROLES.includes(u.role);
    const owner = isStaff ? q.ownerUserId : u.id;
    const where = { status: 'AVAILABLE', ...(owner ? { ownerUserId: owner } : {}), ...(q.category ? { category: q.category } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.document.findMany({ where, orderBy: { createdAt: 'desc' }, skip: q.skip, take: q.pageSize }),
      this.prisma.document.count({ where }),
    ]);
    return toPage(items.map(view), total, q);
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    return view(await this.getReadable(id, u));
  }

  @Get(':id/url')
  async url(@Param('id', ParseUUIDPipe) id: string, @Query('inline') inline: string | undefined, @CurrentUser() u: AuthUser) {
    const d = await this.getReadable(id, u);
    if (d.status !== 'AVAILABLE') throw new BadRequestException({ message: 'Document is not available', code: 'NOT_AVAILABLE' });
    const expiresIn = 300;
    if (d.ownerUserId !== u.id) await this.audit.log(u, { action: 'document.view', entityType: 'Document', entityId: id });
    return { url: await this.storage.presignDownload(d.storageKey, d.fileName, inline === '1' || inline === 'true', expiresIn), expiresIn };
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    const d = await this.getReadable(id, u);
    // Signed agreements and MoUs are legal records: never deletable through the API.
    if (['AGREEMENT_SIGNED', 'MOU', 'UNIVERSITY_LETTER', 'RECEIPT'].includes(d.category)) {
      throw new ForbiddenException({ message: 'This document is a legal record and cannot be deleted', code: 'IMMUTABLE' });
    }
    await this.prisma.document.update({ where: { id }, data: { status: 'DELETED', deletedAt: new Date() } });
    await this.audit.log(u, { action: 'document.delete', entityType: 'Document', entityId: id, before: view(d) });
  }
}

@Controller('internal/documents')
@Internal()
export class InternalDocumentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Services store generated files (signed agreements, receipts, reports). */
  @Post()
  async store(@Body() dto: InternalStoreDto) {
    if (!SYSTEM_TYPES.has(dto.mimeType)) throw new BadRequestException({ message: `Unsupported type ${dto.mimeType}` });
    const buf = Buffer.from(dto.contentBase64, 'base64');
    const id = randomUUID();
    const ext = dto.fileName.includes('.') ? dto.fileName.split('.').pop() : 'bin';
    const key = `${dto.category.toLowerCase()}/${dto.ownerUserId ?? 'system'}/${new Date().getUTCFullYear()}/${id}.${ext}`;
    await this.storage.put(key, buf, dto.mimeType);
    const doc = await this.prisma.document.create({
      data: {
        id,
        ownerUserId: dto.ownerUserId,
        category: dto.category,
        subType: dto.subType,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: buf.length,
        storageKey: key,
        sha256: createHash('sha256').update(buf).digest('hex'),
        status: 'AVAILABLE',
        sourceService: dto.sourceService,
        uploadedAt: new Date(),
      },
    });
    return view(doc);
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return view(await this.prisma.document.findUniqueOrThrow({ where: { id } }));
  }

  @Get(':id/url')
  async url(@Param('id', ParseUUIDPipe) id: string) {
    const d = await this.prisma.document.findUniqueOrThrow({ where: { id } });
    return { url: await this.storage.presignDownload(d.storageKey, d.fileName, true, 900) };
  }

  @Get(':id/content')
  async content(@Param('id', ParseUUIDPipe) id: string) {
    const d = await this.prisma.document.findUniqueOrThrow({ where: { id } });
    const buf = await this.storage.getBuffer(d.storageKey);
    return { ...view(d), contentBase64: buf.toString('base64') };
  }

  /** Checks that documents exist, are uploaded, and (optionally) belong to the given user. */
  @Post('validate')
  @HttpCode(200)
  async validate(@Body() dto: ValidateDto) {
    const docs = await this.prisma.document.findMany({ where: { id: { in: dto.ids } } });
    const byId = new Map(docs.map((d) => [d.id, d]));
    return dto.ids.map((id) => {
      const d = byId.get(id);
      const ok = !!d && d.status === 'AVAILABLE' && (!dto.ownerUserId || d.ownerUserId === dto.ownerUserId);
      return { id, ok, document: d ? view(d) : null };
    });
  }
}

@ApiTags('documents')
@Controller(`${API}/documents/admin`)
@Roles(Role.ADMIN, Role.REVIEWER)
export class DocumentsAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('stats')
  async stats() {
    const rows = await this.prisma.document.groupBy({ by: ['category', 'status'], _count: { _all: true } });
    return rows.map((r) => ({ category: r.category, status: r.status, count: r._count._all }));
  }
}
