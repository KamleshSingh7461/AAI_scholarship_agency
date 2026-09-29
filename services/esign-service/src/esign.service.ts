import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Events, type AgreementType, type EnvelopeEvent } from '@aci/contracts';
import { addDays, APP_CONFIG, AuditService, InternalHttpClient, OutboxService, type AuthUser } from '@aci/nest-common';
import type { EsignConfig } from './config';
import { PrismaService } from './prisma.service';
import { ESIGN_PROVIDER, type EsignProvider, type ProviderStatus } from './providers';
import { DEFAULT_TEMPLATES } from './default-templates';
import { renderAgreementPdf, renderText, stampSignature, type SignatureAnchor } from './pdf';
import type { Envelope, Prisma } from './generated/prisma';

export interface CreateEnvelopeInput {
  agreementType: AgreementType;
  referenceType: 'AWARD' | 'AWARD_YEAR';
  referenceId: string;
  signer: { userId: string; name: string; email: string; phone?: string };
  guardian?: { name: string; email?: string; phone?: string } | null;
  mergeFields: Record<string, string | number>;
  expiresInDays?: number;
  universityId?: string;
}

const OPEN = ['CREATED', 'SENT', 'VIEWED'];

@Injectable()
export class EsignService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EsignService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: EsignConfig,
    @Inject(ESIGN_PROVIDER) readonly provider: EsignProvider,
    private readonly prisma: PrismaService,
    private readonly http: InternalHttpClient,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    for (const [type, t] of Object.entries(DEFAULT_TEMPLATES)) {
      const exists = await this.prisma.agreementTemplate.findFirst({ where: { type, universityId: null } });
      if (!exists) {
        await this.prisma.agreementTemplate.create({ data: { type, version: 1, title: t.title, body: t.body, active: true } });
        this.logger.log(`Seeded default ${type} template (v1) — replace with counsel-approved text`);
      }
    }
  }

  private fields(input: CreateEnvelopeInput) {
    return {
      companyName: this.config.env.COMPANY_LEGAL_NAME,
      brandName: this.config.env.COMPANY_BRAND_NAME,
      ...input.mergeFields,
    };
  }

  private async log(tx: Prisma.TransactionClient | PrismaService, envelopeId: string, event: string, detail?: object, ip?: string, userAgent?: string) {
    await tx.envelopeEventLog.create({ data: { envelopeId, event, detail: detail as any, ip, userAgent: userAgent?.slice(0, 300) } });
  }

  private eventPayload(e: Envelope): EnvelopeEvent {
    return {
      envelopeId: e.id,
      agreementType: e.agreementType as AgreementType,
      referenceType: e.referenceType as EnvelopeEvent['referenceType'],
      referenceId: e.referenceId,
      signerUserId: e.signerUserId,
      signedDocumentId: e.signedDocumentId ?? undefined,
      occurredAt: (e.signedAt ?? new Date()).toISOString(),
    };
  }

  private async storeDocument(body: { category: string; subType: string; ownerUserId: string; fileName: string; bytes: Uint8Array }) {
    return this.http.post<{ id: string }>(
      'document',
      '/internal/documents',
      {
        category: body.category,
        subType: body.subType,
        ownerUserId: body.ownerUserId,
        fileName: body.fileName,
        mimeType: 'application/pdf',
        contentBase64: Buffer.from(body.bytes).toString('base64'),
        sourceService: 'esign',
      },
      { timeoutMs: 30_000, retry: true },
    );
  }

  /** Renders the versioned template, stores the exact PDF, and sends it via the configured provider. Idempotent per reference+type. */
  async create(input: CreateEnvelopeInput): Promise<Envelope> {
    const existing = await this.prisma.envelope.findFirst({
      where: { referenceType: input.referenceType, referenceId: input.referenceId, agreementType: input.agreementType, status: { in: [...OPEN, 'SIGNED'] } },
    });
    if (existing) return existing;

    const template =
      (input.universityId && (await this.prisma.agreementTemplate.findFirst({ where: { type: input.agreementType, universityId: input.universityId, active: true } }))) ||
      (await this.prisma.agreementTemplate.findFirst({ where: { type: input.agreementType, universityId: null, active: true }, orderBy: { version: 'desc' } }));
    if (!template) throw new NotFoundException({ message: `No active template for ${input.agreementType}`, code: 'NO_TEMPLATE' });

    const fields = this.fields(input);
    const title = renderText(template.title, fields);
    const body = renderText(template.body, fields);
    const { bytes, anchors } = await renderAgreementPdf(
      title,
      body,
      `${this.config.env.COMPANY_BRAND_NAME} · ${title} · template v${template.version}`,
      {
        signerName: input.signer.name,
        guardianName: input.guardian?.name,
        companyName: this.config.env.COMPANY_LEGAL_NAME,
        companySignatory: this.provider.name === 'DOCUSIGN' && this.config.env.COMPANY_SIGNATORY_EMAIL ? this.config.env.COMPANY_SIGNATORY_NAME : null,
      },
    );
    const sha = createHash('sha256').update(bytes).digest('hex');
    const unsigned = await this.storeDocument({
      category: 'OTHER',
      subType: `UNSIGNED_${input.agreementType}`,
      ownerUserId: input.signer.userId,
      fileName: `${title}.pdf`,
      bytes,
    });

    let env = await this.prisma.envelope.create({
      data: {
        agreementType: input.agreementType,
        templateId: template.id,
        templateVersion: template.version,
        title,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        signerUserId: input.signer.userId,
        signerName: input.signer.name,
        signerEmail: input.signer.email,
        signerPhone: input.signer.phone,
        guardian: (input.guardian ?? undefined) as any,
        mergeFields: fields as any,
        documentSha256: sha,
        unsignedDocumentId: unsigned.id,
        signatureAnchors: anchors as any,
        provider: this.provider.name,
        expiresAt: addDays(new Date(), input.expiresInDays ?? this.config.env.ESIGN_ENVELOPE_EXPIRY_DAYS),
      },
    });
    await this.log(this.prisma, env.id, 'created', { templateVersion: template.version, sha256: sha });

    const sent = await this.provider.send(env, bytes);
    env = await this.prisma.$transaction(async (tx) => {
      const u = await tx.envelope.update({ where: { id: env.id }, data: { providerEnvelopeId: sent.providerEnvelopeId, status: 'SENT', sentAt: new Date() } });
      await this.log(tx, env.id, 'sent', { provider: this.provider.name, providerEnvelopeId: sent.providerEnvelopeId });
      await this.outbox.add<EnvelopeEvent>(tx, Events.EnvelopeSent, this.eventPayload(u));
      return u;
    });
    return env;
  }

  async getOwned(id: string, user: AuthUser): Promise<Envelope> {
    const e = await this.prisma.envelope.findUnique({ where: { id } });
    if (!e || e.signerUserId !== user.id) throw new NotFoundException({ message: 'Agreement not found', code: 'NOT_FOUND' });
    return e;
  }

  /** Rendered text of the agreement (used by the in-app signing page to display it). */
  async content(e: Envelope) {
    const t = await this.prisma.agreementTemplate.findUniqueOrThrow({ where: { id: e.templateId } });
    const fields = e.mergeFields as Record<string, string | number>;
    return { title: e.title, body: renderText(t.body, fields), templateVersion: e.templateVersion, sha256: e.documentSha256 };
  }

  async signingSession(e: Envelope, as: 'signer' | 'guardian', meta: { ip?: string; ua?: string }) {
    if (!OPEN.includes(e.status)) throw new ConflictException({ message: `This agreement is ${e.status.toLowerCase()}`, code: 'ENVELOPE_CLOSED' });
    if (e.expiresAt < new Date()) throw new ConflictException({ message: 'This agreement has expired', code: 'ENVELOPE_EXPIRED' });
    const returnUrl = `${this.config.studentWebUrl}/agreements/return?envelopeId=${e.id}`;
    const url = await this.provider.signingUrl(e, as, returnUrl);
    await this.prisma.$transaction(async (tx) => {
      if (e.status === 'SENT') {
        const u = await tx.envelope.update({ where: { id: e.id }, data: { status: 'VIEWED', viewedAt: new Date() } });
        await this.outbox.add<EnvelopeEvent>(tx, Events.EnvelopeViewed, this.eventPayload(u));
      }
      await this.log(tx, e.id, as === 'guardian' ? 'guardian_session_started' : 'signing_session_started', undefined, meta.ip, meta.ua);
    });
    return { url, provider: this.provider.name };
  }

  /** In-app click-to-sign for local development (MOCK provider only). */
  async mockSign(e: Envelope, input: { typedName: string; guardianTypedName?: string; agree: boolean }, meta: { ip?: string; ua?: string }) {
    if (this.provider.name !== 'MOCK' || this.config.isProd) throw new ConflictException({ message: 'In-app signing is disabled', code: 'DISABLED' });
    if (!OPEN.includes(e.status)) throw new ConflictException({ message: `This agreement is ${e.status.toLowerCase()}`, code: 'ENVELOPE_CLOSED' });
    if (!input.agree) throw new BadRequestException({ message: 'You must agree to sign electronically', code: 'CONSENT_REQUIRED' });
    const typed = input.typedName.trim();
    if (typed.toLowerCase() !== e.signerName.trim().toLowerCase()) {
      throw new BadRequestException({ message: `Type your full name exactly as "${e.signerName}"`, code: 'NAME_MISMATCH' });
    }
    const guardian = e.guardian as { name: string } | null;
    if (guardian?.name && input.guardianTypedName?.trim().toLowerCase() !== guardian.name.trim().toLowerCase()) {
      throw new BadRequestException({ message: `Your parent/guardian must type their name as "${guardian.name}"`, code: 'GUARDIAN_REQUIRED' });
    }
    const signedAt = new Date();
    await this.log(this.prisma, e.id, 'signed', { typedName: typed, guardian: input.guardianTypedName ?? null }, meta.ip, meta.ua);
    const unsigned = await this.http.get<{ contentBase64: string }>('document', `/internal/documents/${e.unsignedDocumentId}/content`, { timeoutMs: 30_000 });
    const events = await this.prisma.envelopeEventLog.findMany({ where: { envelopeId: e.id }, orderBy: { createdAt: 'asc' } });
    const signed = await stampSignature(Buffer.from(unsigned.contentBase64, 'base64'), (e.signatureAnchors ?? []) as unknown as SignatureAnchor[], {
      envelopeId: e.id,
      title: e.title,
      templateVersion: e.templateVersion,
      documentSha256: e.documentSha256,
      signerName: e.signerName,
      signerEmail: e.signerEmail,
      signerPhone: e.signerPhone,
      typedSignature: typed,
      guardianName: guardian?.name,
      guardianTypedSignature: input.guardianTypedName?.trim() || null,
      signedAt,
      ip: meta.ip,
      userAgent: meta.ua,
      events: events.map((x) => ({ event: x.event, at: x.createdAt, ip: x.ip })),
    });
    return this.finalize(e, signed, signedAt, !!guardian?.name);
  }

  /** Marks signed, stores the signed PDF as a legal record, and emits esign.envelope.signed (once). */
  private async finalize(e: Envelope, signedPdf: Uint8Array, signedAt: Date, guardianSigned: boolean): Promise<Envelope> {
    const doc = await this.storeDocument({
      category: 'AGREEMENT_SIGNED',
      subType: e.agreementType,
      ownerUserId: e.signerUserId,
      fileName: `${e.title} - signed.pdf`,
      bytes: signedPdf,
    });
    return this.prisma.$transaction(async (tx) => {
      const res = await tx.envelope.updateMany({
        where: { id: e.id, status: { in: OPEN } },
        data: { status: 'SIGNED', signedAt, signedDocumentId: doc.id, guardianSignedAt: guardianSigned ? signedAt : null },
      });
      const u = await tx.envelope.findUniqueOrThrow({ where: { id: e.id } });
      if (res.count === 1) {
        await this.log(tx, e.id, 'completed', { signedDocumentId: doc.id });
        await this.outbox.add<EnvelopeEvent>(tx, Events.EnvelopeSigned, this.eventPayload(u));
      }
      return u;
    });
  }

  /** Pulls the provider's status (after the embedded signing redirect, from webhooks, or on demand). */
  async applyProviderStatus(e: Envelope, status: ProviderStatus | null): Promise<Envelope> {
    if (!status || !OPEN.includes(e.status)) return e;
    if (status === 'SIGNED') {
      const pdf = await this.provider.downloadSigned(e);
      return this.finalize(e, pdf, new Date(), !!(e.guardian as { name?: string } | null)?.name);
    }
    if (status === 'VIEWED' && e.status === 'SENT') {
      return this.prisma.envelope.update({ where: { id: e.id }, data: { status: 'VIEWED', viewedAt: new Date() } });
    }
    if (status === 'DECLINED' || status === 'VOIDED') {
      return this.prisma.$transaction(async (tx) => {
        const u = await tx.envelope.update({
          where: { id: e.id },
          data: status === 'DECLINED' ? { status: 'DECLINED', declinedAt: new Date() } : { status: 'VOIDED', voidedAt: new Date() },
        });
        await this.log(tx, e.id, status.toLowerCase());
        if (status === 'DECLINED') await this.outbox.add<EnvelopeEvent>(tx, Events.EnvelopeDeclined, this.eventPayload(u));
        return u;
      });
    }
    return e;
  }

  async sync(e: Envelope): Promise<Envelope> {
    if (this.provider.name === 'MOCK') return e;
    return this.applyProviderStatus(e, await this.provider.status(e));
  }

  async handleWebhook(headers: Record<string, string | string[] | undefined>, raw: Buffer) {
    const parsed = this.provider.parseWebhook(headers, raw);
    if (!parsed) return { ok: true };
    const e = await this.prisma.envelope.findFirst({ where: { provider: this.provider.name, providerEnvelopeId: parsed.providerEnvelopeId } });
    if (!e) return { ok: true, unknown: true };
    await this.log(this.prisma, e.id, `webhook:${parsed.status ?? 'other'}`);
    await this.applyProviderStatus(e, parsed.status);
    return { ok: true };
  }

  async decline(e: Envelope, reason: string, meta: { ip?: string; ua?: string }) {
    if (!OPEN.includes(e.status)) throw new ConflictException({ message: 'Agreement is no longer open', code: 'ENVELOPE_CLOSED' });
    await this.provider.void(e, `Declined by signer: ${reason}`).catch(() => undefined);
    return this.prisma.$transaction(async (tx) => {
      const u = await tx.envelope.update({ where: { id: e.id }, data: { status: 'DECLINED', declinedAt: new Date(), declineReason: reason } });
      await this.log(tx, e.id, 'declined', { reason }, meta.ip, meta.ua);
      await this.outbox.add<EnvelopeEvent>(tx, Events.EnvelopeDeclined, this.eventPayload(u));
      return u;
    });
  }

  async void(id: string, reason: string, actor?: AuthUser) {
    const e = await this.prisma.envelope.findUniqueOrThrow({ where: { id } });
    if (!OPEN.includes(e.status)) return e;
    await this.provider.void(e, reason).catch((err) => this.logger.warn(`Provider void failed: ${err.message}`));
    const u = await this.prisma.envelope.update({ where: { id }, data: { status: 'VOIDED', voidedAt: new Date(), voidReason: reason } });
    await this.log(this.prisma, id, 'voided', { reason, by: actor?.id ?? 'system' });
    return u;
  }

  async remind(id: string, actor?: AuthUser) {
    const e = await this.prisma.envelope.findUniqueOrThrow({ where: { id } });
    if (!OPEN.includes(e.status)) throw new ConflictException({ message: 'Agreement is no longer open', code: 'ENVELOPE_CLOSED' });
    await this.prisma.$transaction(async (tx) => {
      await tx.envelope.update({ where: { id }, data: { remindersSent: { increment: 1 }, lastReminderAt: new Date() } });
      await this.outbox.add(tx, Events.NotificationRequested, {
        templateKey: 'agreement_reminder',
        userId: e.signerUserId,
        to: { phone: e.signerPhone ?? undefined, whatsapp: e.signerPhone ?? undefined, email: e.signerEmail },
        channels: ['WHATSAPP'],
        data: { agreementName: e.title },
      });
      await this.log(tx, id, 'reminder_sent', { by: actor?.id ?? 'system' });
    });
    if (actor) await this.audit.log(actor, { action: 'envelope.remind', entityType: 'Envelope', entityId: id });
    return { reminded: true };
  }

  /** Expires unsigned envelopes past their deadline (also voids them at the provider). */
  async expireOverdue(): Promise<number> {
    const due = await this.prisma.envelope.findMany({ where: { status: { in: OPEN }, expiresAt: { lt: new Date() } }, take: 200 });
    for (const e of due) {
      await this.provider.void(e, 'Expired').catch(() => undefined);
      await this.prisma.$transaction(async (tx) => {
        const res = await tx.envelope.updateMany({ where: { id: e.id, status: { in: OPEN } }, data: { status: 'EXPIRED' } });
        if (res.count !== 1) return;
        await this.log(tx, e.id, 'expired');
        await this.outbox.add<EnvelopeEvent>(tx, Events.EnvelopeExpired, this.eventPayload(e));
      });
    }
    return due.length;
  }
}
