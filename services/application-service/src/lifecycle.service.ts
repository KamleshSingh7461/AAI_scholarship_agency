import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { Events, type AwardStatusEvent, type AwardYearEvent } from '@aci/contracts';
import { addDays, APP_CONFIG, OutboxService, RedisService, startOfUtcDay } from '@aci/nest-common';
import type { ApplicationConfig } from './config';
import { PrismaService } from './prisma.service';
import { AwardService } from './award.service';
import { ApplicationStateMachine } from './state-machine';
import { Clients } from './clients';

export interface LifecycleReport {
  asOf: string;
  renewalsDue: number;
  renewalsOpened: number;
  overdue: number;
  suspended: number;
  completed: number;
  offersExpired: number;
  envelopesRetried: number;
  agreementReminders: number;
  paymentsExpired: number;
}

/**
 * The daily job that enforces "no signature, no scholarship":
 *   30 days before anniversary → DUE + reminder
 *   on anniversary             → renewal agreements sent
 *   after anniversary          → OVERDUE
 *   after grace period         → SUSPENDED
 * Runs on exactly one replica (Redis lock). Every step is idempotent.
 */
@Injectable()
export class LifecycleService implements OnModuleInit {
  private readonly logger = new Logger(LifecycleService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: ApplicationConfig,
    private readonly prisma: PrismaService,
    private readonly awards: AwardService,
    private readonly sm: ApplicationStateMachine,
    private readonly clients: Clients,
    private readonly outbox: OutboxService,
    private readonly redis: RedisService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const job = new CronJob(this.config.env.LIFECYCLE_CRON, () => void this.runLocked(), null, false, 'UTC');
    this.scheduler.addCronJob('award-lifecycle', job as any);
    job.start();
    this.logger.log(`Lifecycle job scheduled: "${this.config.env.LIFECYCLE_CRON}" (UTC)`);
  }

  async runLocked(asOf = new Date()): Promise<LifecycleReport | { skipped: true }> {
    const r = await this.redis.withLock('award-lifecycle', 15 * 60_000, () => this.run(asOf));
    if (!r) {
      this.logger.log('Lifecycle already running on another instance; skipped');
      return { skipped: true };
    }
    return r;
  }

  async run(asOf = new Date()): Promise<LifecycleReport> {
    const env = this.config.env;
    const today = startOfUtcDay(asOf);
    const report: LifecycleReport = {
      asOf: today.toISOString(),
      renewalsDue: 0,
      renewalsOpened: 0,
      overdue: 0,
      suspended: 0,
      completed: 0,
      offersExpired: 0,
      envelopesRetried: 0,
      agreementReminders: 0,
      paymentsExpired: 0,
    };
    const liveAward = { status: { in: ['ACTIVE', 'RENEWAL_DUE', 'SUSPENDED'] } };

    // 1. UPCOMING → DUE (reminder window opens)
    const becomingDue = await this.prisma.awardYear.findMany({
      where: { status: 'UPCOMING', dueDate: { lte: addDays(today, env.RENEWAL_REMINDER_DAYS_BEFORE) }, award: liveAward },
      include: { award: true },
    });
    for (const y of becomingDue) {
      await this.prisma.$transaction(async (tx) => {
        const res = await tx.awardYear.updateMany({ where: { id: y.id, status: 'UPCOMING' }, data: { status: 'DUE', reminderSentAt: new Date() } });
        if (res.count !== 1) return;
        if (y.award.status === 'ACTIVE') await tx.award.update({ where: { id: y.awardId }, data: { status: 'RENEWAL_DUE' } });
        await this.outbox.add<AwardYearEvent>(tx, Events.AwardRenewalDue, this.awards.yearEvent(y.award, y));
      });
      report.renewalsDue++;
    }

    // 2. Open renewal envelopes (anniversary − RENEWAL_ENVELOPE_DAYS_BEFORE); also retries failed sends
    const toOpen = await this.prisma.awardYear.findMany({
      where: {
        status: { in: ['DUE', 'OVERDUE', 'SUSPENDED'] },
        dueDate: { lte: addDays(today, env.RENEWAL_ENVELOPE_DAYS_BEFORE) },
        OR: [{ scholarshipEnvelopeId: null }, { agencyEnvelopeId: null }],
      },
    });
    for (const y of toOpen) {
      await this.awards.openRenewal(y.id);
      report.renewalsOpened++;
    }

    // 3. DUE → OVERDUE once the anniversary passes
    const overdue = await this.prisma.awardYear.updateMany({
      where: { status: 'DUE', dueDate: { lt: today } },
      data: { status: 'OVERDUE', overdueAt: new Date() },
    });
    report.overdue = overdue.count;

    // 4. OVERDUE past the grace period → year + award SUSPENDED
    const toSuspend = await this.prisma.awardYear.findMany({
      where: { status: 'OVERDUE', dueDate: { lt: addDays(today, -env.RENEWAL_GRACE_DAYS) } },
      include: { award: true },
    });
    for (const y of toSuspend) {
      await this.prisma.$transaction(async (tx) => {
        const res = await tx.awardYear.updateMany({ where: { id: y.id, status: 'OVERDUE' }, data: { status: 'SUSPENDED', suspendedAt: new Date() } });
        if (res.count !== 1) return;
        if (['ACTIVE', 'RENEWAL_DUE'].includes(y.award.status)) {
          const reason = `Year ${y.yearNumber} renewal not completed by ${addDays(y.dueDate, env.RENEWAL_GRACE_DAYS).toDateString()}`;
          await tx.award.update({ where: { id: y.awardId }, data: { status: 'SUSPENDED', suspendedAt: new Date(), suspensionReason: reason } });
          await this.outbox.add<AwardStatusEvent>(tx, Events.AwardSuspended, {
            awardId: y.awardId,
            awardNo: y.award.awardNo,
            athleteUserId: y.award.athleteUserId,
            reason,
            effectiveDate: new Date().toISOString(),
          });
        }
      });
      report.suspended++;
    }

    // 5. Completed: past end date with every year renewed
    const ending = await this.prisma.award.findMany({ where: { status: 'ACTIVE', endDate: { lt: today } }, include: { years: true } });
    for (const a of ending) {
      if (a.years.some((y) => y.status !== 'RENEWED' && y.status !== 'CANCELLED')) continue;
      await this.prisma.$transaction(async (tx) => {
        const res = await tx.award.updateMany({ where: { id: a.id, status: 'ACTIVE' }, data: { status: 'COMPLETED', completedAt: new Date() } });
        if (res.count !== 1) return;
        await this.outbox.add<AwardStatusEvent>(tx, Events.AwardCompleted, { awardId: a.id, awardNo: a.awardNo, athleteUserId: a.athleteUserId, effectiveDate: new Date().toISOString() });
      });
      report.completed++;
    }

    // 6. Offers not signed in time → EXPIRED; seat goes back to inventory
    const expired = await this.prisma.award.findMany({ where: { status: 'PENDING_SIGNATURE', agreementsDeadline: { lt: asOf } } });
    for (const a of expired) {
      await this.prisma.$transaction(async (tx) => {
        await this.awards.expireOffer(tx, a.applicationId, 'Agreements not signed before the deadline');
        const app = await tx.application.findUniqueOrThrow({ where: { id: a.applicationId } });
        if (app.status === 'AGREEMENTS_PENDING') await this.sm.transition(tx, app, 'EXPIRED', null, 'Agreements not signed before the deadline');
      });
      await this.clients.releaseSeat(a.applicationId, 'agreements expired').catch((e) => this.logger.error(`seat release: ${e.message}`));
      await this.awards.voidPendingEnvelopes(a.applicationId, 'Signing deadline passed');
      report.offersExpired++;
    }

    // 7. Retry offers whose envelopes failed to send
    const missing = await this.prisma.award.findMany({ where: { status: 'PENDING_SIGNATURE', OR: [{ scholarshipEnvelopeId: null }, { agencyEnvelopeId: null }] } });
    for (const a of missing) {
      await this.awards.sendInitialEnvelopes(a.id);
      report.envelopesRetried++;
    }

    // 8. Periodic reminders for unsigned offers
    const remindBefore = addDays(asOf, -env.AGREEMENT_REMINDER_INTERVAL_DAYS);
    const unsigned = await this.prisma.award.findMany({
      where: { status: 'PENDING_SIGNATURE', offeredAt: { lt: remindBefore }, OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: remindBefore } }] },
    });
    for (const a of unsigned) {
      await this.awards.remind(a.id, null).catch(() => undefined);
      report.agreementReminders++;
    }

    // 9. Abandoned unpaid applications
    const stale = await this.prisma.application.findMany({
      where: { status: 'PAYMENT_PENDING', createdAt: { lt: addDays(asOf, -env.PAYMENT_PENDING_EXPIRY_DAYS) } },
    });
    for (const app of stale) {
      await this.prisma.$transaction((tx) => this.sm.transition(tx, app, 'EXPIRED', null, 'Application fee not paid in time')).catch(() => undefined);
      report.paymentsExpired++;
    }

    this.logger.log(`Lifecycle run: ${JSON.stringify(report)}`);
    return report;
  }
}
