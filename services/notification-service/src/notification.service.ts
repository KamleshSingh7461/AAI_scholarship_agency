import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { maskPhone, NotificationChannel, OtpChannel } from '@aci/contracts';
import { APP_CONFIG, InternalHttpClient } from '@aci/nest-common';
import type { NotificationConfig } from './config';
import { PrismaService } from './prisma.service';
import { DEFAULT_TEMPLATES, render } from './templates';
import {
  EMAIL_PROVIDER,
  SMS_PROVIDER,
  WHATSAPP_PROVIDER,
  type EmailProvider,
  type SmsProvider,
  type WhatsAppProvider,
} from './providers/provider.types';

export interface EnqueueInput {
  templateKey: string;
  channels: NotificationChannel[];
  userId?: string;
  to?: { phone?: string; whatsapp?: string; email?: string };
  data?: Record<string, string | number | undefined>;
  sourceEventId?: string;
}

const MAX_ATTEMPTS = 5;

@Injectable()
export class NotificationService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(NotificationService.name);
  private timer?: NodeJS.Timeout;
  private busy = false;

  constructor(
    @Inject(APP_CONFIG) private readonly config: NotificationConfig,
    private readonly prisma: PrismaService,
    private readonly http: InternalHttpClient,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
    @Inject(WHATSAPP_PROVIDER) private readonly whatsapp: WhatsAppProvider,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.prisma.notificationTemplate.createMany({
      data: DEFAULT_TEMPLATES.map((t) => ({ key: t.key, channel: t.channel, subject: t.subject, body: t.body })),
      skipDuplicates: true,
    });
    this.timer = setInterval(() => void this.dispatch(), 2000);
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private globals() {
    return {
      brand: this.config.env.COMPANY_BRAND_NAME,
      studentPortalUrl: this.config.studentWebUrl,
      publicSiteUrl: this.config.publicWebUrl,
      adminPortalUrl: this.config.adminWebUrl,
    };
  }

  /** Synchronous OTP delivery with WhatsApp → SMS fallback. The code is never written to the log. */
  async sendOtp(phone: string, channel: OtpChannel, code: string, ttlMinutes: number, fallbackToSms: boolean) {
    const attempt = async (ch: OtpChannel) => {
      const provider = ch === 'WHATSAPP' ? this.whatsapp : this.sms;
      const res = await provider.sendOtp(phone, code, ttlMinutes);
      await this.prisma.notificationLog.create({
        data: {
          templateKey: 'otp',
          channel: ch,
          recipient: phone,
          body: `OTP ****** (valid ${ttlMinutes} min)`,
          status: 'SENT',
          provider: res.provider,
          providerMessageId: res.messageId,
          attempts: 1,
          sentAt: new Date(),
        },
      });
      return { delivered: true, channel: ch, provider: res.provider };
    };
    try {
      return await attempt(channel);
    } catch (err) {
      this.logger.warn(`OTP via ${channel} to ${maskPhone(phone)} failed: ${(err as Error).message}`);
      await this.prisma.notificationLog.create({
        data: { templateKey: 'otp', channel, recipient: phone, body: 'OTP ******', status: 'FAILED', error: (err as Error).message.slice(0, 500), attempts: 1 },
      });
      if (fallbackToSms && channel === 'WHATSAPP') {
        try {
          return await attempt('SMS');
        } catch (err2) {
          this.logger.error(`OTP SMS fallback failed: ${(err2 as Error).message}`);
        }
      }
      return { delivered: false, channel, provider: 'none' };
    }
  }

  /** Renders templates and queues one log row per channel. Pass `tx` to commit atomically with an inbox marker. */
  async enqueue(input: EnqueueInput, tx?: any): Promise<number> {
    const db = tx ?? this.prisma;
    let contact = input.to ?? {};
    if (input.userId && (!contact.phone || !contact.email)) {
      try {
        const u = await this.http.get<{ phone: string; email?: string; fullName?: string }>('auth', `/internal/users/${input.userId}`);
        contact = { phone: contact.phone ?? u.phone, whatsapp: contact.whatsapp ?? u.phone, email: contact.email ?? u.email ?? undefined };
        input.data = { name: u.fullName ?? 'there', ...input.data };
      } catch (err) {
        this.logger.warn(`Could not resolve contact for user ${input.userId}: ${(err as Error).message}`);
      }
    }
    const vars = { ...this.globals(), name: 'there', ...input.data };
    const templates = await db.notificationTemplate.findMany({
      where: { key: input.templateKey, channel: { in: input.channels }, active: true },
    });
    let queued = 0;
    for (const t of templates) {
      const recipient = t.channel === 'EMAIL' ? contact.email : t.channel === 'WHATSAPP' ? contact.whatsapp ?? contact.phone : contact.phone;
      if (!recipient) continue;
      await db.notificationLog.create({
        data: {
          userId: input.userId,
          templateKey: t.key,
          channel: t.channel,
          recipient,
          subject: t.subject ? render(t.subject, vars) : null,
          body: render(t.body, vars),
          meta: { providerTemplate: t.providerTemplate, dltTemplateId: t.dltTemplateId, vars } as any,
          sourceEventId: input.sourceEventId,
        },
      });
      queued++;
    }
    if (queued) setTimeout(() => void this.dispatch(), 100);
    return queued;
  }

  /** Worker: claims due rows (safe across replicas), sends them, retries with exponential backoff. */
  async dispatch(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      // Recover rows stuck in SENDING (e.g. a replica crashed mid-send).
      await this.prisma.$executeRawUnsafe(
        `UPDATE notification_logs SET status = 'QUEUED' WHERE status = 'SENDING' AND "nextAttemptAt" < now() - interval '5 minutes'`,
      );
      const claimed: { id: string }[] = await this.prisma.$queryRawUnsafe(
        `UPDATE notification_logs SET status = 'SENDING', "nextAttemptAt" = now()
         WHERE id IN (SELECT id FROM notification_logs WHERE status = 'QUEUED' AND "nextAttemptAt" <= now()
                      ORDER BY "nextAttemptAt" LIMIT 25 FOR UPDATE SKIP LOCKED)
         RETURNING id`,
      );
      for (const { id } of claimed) await this.sendOne(id);
    } catch (err) {
      this.logger.warn(`dispatch failed: ${(err as Error).message}`);
    } finally {
      this.busy = false;
    }
  }

  private async sendOne(id: string): Promise<void> {
    const log = await this.prisma.notificationLog.findUniqueOrThrow({ where: { id } });
    const meta = (log.meta ?? {}) as { providerTemplate?: string; dltTemplateId?: string; vars?: Record<string, string> };
    try {
      let res;
      if (log.channel === 'EMAIL') res = await this.email.send(log.recipient, log.subject ?? this.config.env.COMPANY_BRAND_NAME, log.body);
      else if (log.channel === 'WHATSAPP') res = await this.whatsapp.send(log.recipient, log.body, meta.providerTemplate ? { template: meta.providerTemplate } : undefined);
      else res = await this.sms.send(log.recipient, log.body, { dltTemplateId: meta.dltTemplateId, variables: meta.vars });
      await this.prisma.notificationLog.update({
        where: { id },
        data: { status: 'SENT', provider: res.provider, providerMessageId: res.messageId, attempts: { increment: 1 }, sentAt: new Date(), error: null },
      });
    } catch (err) {
      const attempts = log.attempts + 1;
      const retryable = (err as any).retryable !== false && attempts < MAX_ATTEMPTS;
      await this.prisma.notificationLog.update({
        where: { id },
        data: {
          status: retryable ? 'QUEUED' : 'FAILED',
          attempts,
          error: (err as Error).message.slice(0, 500),
          nextAttemptAt: new Date(Date.now() + 30_000 * 2 ** attempts),
        },
      });
      this.logger.warn(`Send ${log.channel} to ${maskPhone(log.recipient)} failed (attempt ${attempts}): ${(err as Error).message}`);
    }
  }
}
