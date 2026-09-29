import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AgreementType,
  Events,
  Role,
  type AwardSnapshot,
  type AwardStatusEvent,
  type AwardYearEvent,
  type EnvelopeEvent,
} from '@aci/contracts';
import {
  academicYearOf,
  addDays,
  addYears,
  APP_CONFIG,
  AuditService,
  OutboxService,
  refNo,
  startOfUtcDay,
  type AuthUser,
} from '@aci/nest-common';
import type { ApplicationConfig } from './config';
import { PrismaService } from './prisma.service';
import { Clients, type ProgramView } from './clients';
import { ApplicationStateMachine } from './state-machine';
import type { ConfirmationDto, RegistrationDto } from './dto';
import type { Application, Award, AwardYear, Prisma } from './generated/prisma';

const n = (v: bigint | number | null | undefined) => Number(v ?? 0);
const fmt = (minor: bigint | number, currency: string) =>
  new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n(minor) / 100);
const fmtDate = (d: Date | null | undefined) => (d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '');

@Injectable()
export class AwardService {
  private readonly logger = new Logger(AwardService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: ApplicationConfig,
    private readonly prisma: PrismaService,
    private readonly clients: Clients,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly sm: ApplicationStateMachine,
  ) {}

  snapshot(a: Award): AwardSnapshot {
    return {
      awardId: a.id,
      awardNo: a.awardNo,
      applicationId: a.applicationId,
      athleteUserId: a.athleteUserId,
      athleteCode: a.athleteCode,
      athleteName: a.athleteName,
      whatsappNumber: a.whatsappNumber,
      sport: a.sport ?? '',
      universityId: a.universityId,
      universityName: a.universityName,
      programId: a.programId,
      programName: a.programName,
      durationYears: a.durationYears,
      currency: a.currency as AwardSnapshot['currency'],
      tuitionPerYear: n(a.tuitionPerYear),
      roomPerYear: n(a.roomPerYear),
      foodPerYear: n(a.foodPerYear),
      otherPerYear: n(a.otherPerYear),
      annualValue: n(a.annualValue),
      totalValue: n(a.totalValue),
      universityFundedAnnual: n(a.universityFundedAnnual),
      companyFundedAnnual: n(a.companyFundedAnnual),
      usdInrRate4: a.usdInrRate4,
      commissionBps: a.commissionBps,
      universityCommissionShareBps: a.universityCommissionShareBps,
      grantDate: a.grantDate?.toISOString() ?? null,
      startDate: (a.startDate ?? a.offeredAt).toISOString(),
      endDate: (a.endDate ?? a.agreementsDeadline).toISOString(),
      status: a.status as AwardSnapshot['status'],
    };
  }

  /** Creates the award in PENDING_SIGNATURE with the program's terms frozen in. */
  async createOffer(tx: Prisma.TransactionClient, app: Application, program: ProgramView): Promise<Award> {
    const v = program.value;
    const deadlineDays = this.config.env.AGREEMENT_SIGNING_DEADLINE_DAYS;
    const award = await tx.award.create({
      data: {
        awardNo: refNo('AWD'),
        applicationId: app.id,
        athleteUserId: app.athleteUserId,
        athleteCode: app.athleteCode,
        athleteName: app.athleteName,
        whatsappNumber: app.whatsappNumber,
        athleteEmail: app.athleteEmail,
        sport: app.sport,
        isMinor: app.isMinor,
        guardian: (app.guardian ?? undefined) as any,
        universityId: app.universityId,
        universityName: app.universityName,
        programId: app.programId,
        programName: app.programName,
        academicYear: app.academicYear,
        durationYears: program.durationYears,
        currency: v.currency,
        tuitionPerYear: BigInt(v.tuitionPerYear),
        roomPerYear: BigInt(v.roomPerYear),
        foodPerYear: BigInt(v.foodPerYear),
        otherPerYear: BigInt(v.otherPerYear),
        annualValue: BigInt(v.annualValue),
        totalValue: BigInt(v.totalValue),
        universityFundedAnnual: BigInt(v.universityFundedAnnual),
        companyFundedAnnual: BigInt(v.companyFundedAnnual),
        usdInrRate4: v.usdInrRate4,
        commissionBps: program.commissionBps,
        universityCommissionShareBps: program.universityCommissionShareBps,
        agreementsDeadline: addDays(new Date(), deadlineDays),
      },
    });
    await this.outbox.add(tx, Events.AwardOffered, { ...this.snapshot(award), deadlineDays });
    return award;
  }

  private mergeFields(a: Award, year?: AwardYear): Record<string, string | number> {
    const guardian = a.guardian as { name?: string } | null;
    return {
      awardNo: a.awardNo,
      athleteName: a.athleteName,
      athleteCode: a.athleteCode,
      guardianName: guardian?.name ?? '',
      sport: a.sport ?? '',
      universityName: a.universityName,
      programName: a.programName,
      academicYear: year?.academicYear ?? a.academicYear,
      durationYears: a.durationYears,
      yearNumber: year?.yearNumber ?? 1,
      tuitionPerYear: fmt(a.tuitionPerYear, a.currency),
      roomPerYear: fmt(a.roomPerYear, a.currency),
      foodPerYear: fmt(a.foodPerYear, a.currency),
      otherPerYear: fmt(a.otherPerYear, a.currency),
      annualValue: fmt(a.annualValue, a.currency),
      totalValue: fmt(a.totalValue, a.currency),
      commissionPct: (a.commissionBps / 100).toFixed(2).replace(/\.00$/, ''),
      date: fmtDate(new Date()),
      periodStart: fmtDate(year?.periodStart),
      periodEnd: fmtDate(year?.periodEnd),
    };
  }

  private signer(a: Award) {
    if (!a.athleteEmail) throw new BadRequestException({ message: 'Athlete has no email address for e-signature', code: 'EMAIL_REQUIRED' });
    const g = a.guardian as { name: string; email?: string; phone?: string } | null;
    return {
      signer: { userId: a.athleteUserId, name: a.athleteName, email: a.athleteEmail, phone: a.whatsappNumber },
      guardian: a.isMinor && g ? g : null,
    };
  }

  /** Sends whichever of the two initial envelopes is missing. Never throws: the lifecycle job retries. */
  async sendInitialEnvelopes(awardId: string): Promise<void> {
    const a = await this.prisma.award.findUnique({ where: { id: awardId } });
    if (!a || a.status !== 'PENDING_SIGNATURE') return;
    const expiresInDays = Math.max(1, Math.ceil((a.agreementsDeadline.getTime() - Date.now()) / 86400_000));
    try {
      const who = this.signer(a);
      if (!a.scholarshipEnvelopeId) {
        const env = await this.clients.createEnvelope({ agreementType: AgreementType.SCHOLARSHIP_AWARD, referenceType: 'AWARD', referenceId: a.id, ...who, mergeFields: this.mergeFields(a), expiresInDays });
        await this.prisma.award.update({ where: { id: a.id }, data: { scholarshipEnvelopeId: env.id } });
      }
      if (!a.agencyEnvelopeId) {
        const env = await this.clients.createEnvelope({ agreementType: AgreementType.AGENCY, referenceType: 'AWARD', referenceId: a.id, ...who, mergeFields: this.mergeFields(a), expiresInDays });
        await this.prisma.award.update({ where: { id: a.id }, data: { agencyEnvelopeId: env.id } });
      }
    } catch (err) {
      this.logger.error(`Could not send agreements for ${a.awardNo}: ${(err as Error).message}`);
    }
  }

  /**
   * Row locks: both agreement signatures (and the renewal registration) can arrive concurrently.
   * Locking serialises them so the second transaction sees the first one's signature.
   */
  private async lockAward(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT id FROM awards WHERE id = ${id}::uuid FOR UPDATE`;
  }

  private async lockYear(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT id FROM award_years WHERE id = ${id}::uuid FOR UPDATE`;
  }

  /** Handles esign.envelope.signed for both the initial agreements and yearly renewals. */
  async onEnvelopeSigned(tx: Prisma.TransactionClient, e: EnvelopeEvent): Promise<void> {
    const at = new Date(e.occurredAt);
    if (e.referenceType === 'AWARD') {
      await this.lockAward(tx, e.referenceId);
      const a = await tx.award.findUnique({ where: { id: e.referenceId } });
      if (!a) return;
      const data: Prisma.AwardUpdateInput =
        e.agreementType === AgreementType.SCHOLARSHIP_AWARD
          ? { scholarshipSignedAt: a.scholarshipSignedAt ?? at, scholarshipSignedDocumentId: e.signedDocumentId, scholarshipEnvelopeId: e.envelopeId }
          : { agencySignedAt: a.agencySignedAt ?? at, agencySignedDocumentId: e.signedDocumentId, agencyEnvelopeId: e.envelopeId };
      const updated = await tx.award.update({ where: { id: a.id }, data });
      if (updated.status === 'PENDING_SIGNATURE' && updated.scholarshipSignedAt && updated.agencySignedAt) {
        await this.activate(tx, updated);
      }
      return;
    }
    await this.lockYear(tx, e.referenceId);
    const year = await tx.awardYear.findUnique({ where: { id: e.referenceId } });
    if (!year) return;
    await tx.awardYear.update({
      where: { id: year.id },
      data:
        e.agreementType === AgreementType.SCHOLARSHIP_RENEWAL
          ? { scholarshipSignedAt: year.scholarshipSignedAt ?? at, scholarshipEnvelopeId: e.envelopeId }
          : { agencySignedAt: year.agencySignedAt ?? at, agencyEnvelopeId: e.envelopeId },
    });
    await this.tryCompleteRenewal(tx, year.id);
  }

  /**
   * Both agreements signed: the scholarship is granted. The grant date is the revenue-recognition
   * date; the award is split into yearly periods, each of which must be renewed.
   */
  private async activate(tx: Prisma.TransactionClient, a: Award): Promise<void> {
    const grant = new Date();
    const snap = (await tx.application.findUniqueOrThrow({ where: { id: a.applicationId } })).programSnapshot as unknown as ProgramView;
    const intake = snap?.intakeDate ? startOfUtcDay(new Date(snap.intakeDate)) : null;
    const start = intake && intake > grant ? intake : startOfUtcDay(grant);
    const end = addDays(addYears(start, a.durationYears), -1);

    for (let y = 1; y <= a.durationYears; y++) {
      const periodStart = addYears(start, y - 1);
      await tx.awardYear.create({
        data: {
          awardId: a.id,
          yearNumber: y,
          academicYear: academicYearOf(periodStart),
          periodStart,
          periodEnd: addDays(addYears(start, y), -1),
          dueDate: periodStart,
          status: y === 1 ? 'RENEWED' : 'UPCOMING',
          renewedAt: y === 1 ? grant : null,
          tuitionAmount: a.tuitionPerYear,
          roomAmount: a.roomPerYear,
          foodAmount: a.foodPerYear,
          otherAmount: a.otherPerYear,
          amount: a.annualValue,
          // Year 1 is covered by the initial signing
          enrollmentConfirmed: y === 1,
          policyAcknowledged: y === 1,
          registrationSubmittedAt: y === 1 ? grant : null,
          scholarshipSignedAt: y === 1 ? a.scholarshipSignedAt : null,
          agencySignedAt: y === 1 ? a.agencySignedAt : null,
        },
      });
    }
    const active = await tx.award.update({
      where: { id: a.id },
      data: { status: 'ACTIVE', grantDate: grant, startDate: start, endDate: end, currentYear: 1 },
    });
    await this.clients.confirmSeat(a.applicationId);
    const app = await tx.application.findUniqueOrThrow({ where: { id: a.applicationId } });
    if (app.status === 'AGREEMENTS_PENDING') {
      await this.sm.transition(tx, app, 'AWARDED', null, `Both agreements signed. Scholarship ${a.awardNo} is active.`);
    }
    await this.outbox.add(tx, Events.AwardActivated, this.snapshot(active));
  }

  async expireOffer(tx: Prisma.TransactionClient, applicationId: string, reason: string) {
    const a = await tx.award.findUnique({ where: { applicationId } });
    if (!a || a.status !== 'PENDING_SIGNATURE') return;
    await tx.award.update({ where: { id: a.id }, data: { status: 'EXPIRED', revokeReason: reason } });
    await this.outbox.add<AwardStatusEvent>(tx, Events.AwardExpired, {
      awardId: a.id,
      awardNo: a.awardNo,
      athleteUserId: a.athleteUserId,
      reason,
      effectiveDate: new Date().toISOString(),
    });
  }

  async voidPendingEnvelopes(applicationId: string, reason: string) {
    const a = await this.prisma.award.findUnique({ where: { applicationId } });
    if (!a) return;
    for (const [id, signed] of [
      [a.scholarshipEnvelopeId, a.scholarshipSignedAt],
      [a.agencyEnvelopeId, a.agencySignedAt],
    ] as const) {
      if (id && !signed) await this.clients.voidEnvelope(id, reason).catch((e) => this.logger.warn(`void failed: ${e.message}`));
    }
  }

  // ------------------------------------------------------------------------------------------
  // Yearly renewal
  // ------------------------------------------------------------------------------------------

  async getYearForAthlete(yearId: string, user: AuthUser) {
    const year = await this.prisma.awardYear.findUnique({ where: { id: yearId }, include: { award: true } });
    if (!year || (user.role === Role.ATHLETE && year.award.athleteUserId !== user.id)) {
      throw new NotFoundException({ message: 'Renewal not found', code: 'NOT_FOUND' });
    }
    return year;
  }

  /** Annual "register" step: the athlete confirms enrolment and the university policy. */
  async submitRegistration(yearId: string, user: AuthUser, dto: RegistrationDto) {
    const year = await this.getYearForAthlete(yearId, user);
    if (!['DUE', 'OVERDUE', 'SUSPENDED'].includes(year.status)) {
      throw new ConflictException({ message: 'This renewal is not open yet', code: 'RENEWAL_NOT_OPEN' });
    }
    if (!dto.enrollmentConfirmed || !dto.policyAcknowledged) {
      throw new BadRequestException({ message: 'You must confirm enrolment and accept the scholarship policy', code: 'CONFIRMATION_REQUIRED' });
    }
    await this.prisma.$transaction(async (tx) => {
      await this.lockYear(tx, yearId);
      await tx.awardYear.update({
        where: { id: yearId },
        data: {
          enrollmentConfirmed: true,
          policyAcknowledged: true,
          currentCourse: dto.currentCourse,
          currentSemester: dto.currentSemester,
          academicScore: dto.academicScore,
          registrationDocumentId: dto.documentId,
          registrationSubmittedAt: new Date(),
        },
      });
      await this.tryCompleteRenewal(tx, yearId);
    });
    // Registration done: make sure the renewal agreements exist so they can sign right away.
    await this.openRenewal(yearId);
    return this.prisma.awardYear.findUniqueOrThrow({ where: { id: yearId } });
  }

  /** Creates the two renewal envelopes for a year if missing. Safe to call repeatedly. */
  async openRenewal(yearId: string): Promise<void> {
    const year = await this.prisma.awardYear.findUnique({ where: { id: yearId }, include: { award: true } });
    if (!year || ['RENEWED', 'CANCELLED', 'UPCOMING'].includes(year.status)) return;
    const a = year.award;
    const deadline = addDays(year.dueDate, this.config.env.RENEWAL_GRACE_DAYS);
    const expiresInDays = Math.max(3, Math.ceil((deadline.getTime() - Date.now()) / 86400_000));
    try {
      const who = this.signer(a);
      const firstOpen = !year.openedAt;
      if (!year.scholarshipEnvelopeId) {
        const env = await this.clients.createEnvelope({ agreementType: AgreementType.SCHOLARSHIP_RENEWAL, referenceType: 'AWARD_YEAR', referenceId: year.id, ...who, mergeFields: this.mergeFields(a, year), expiresInDays });
        await this.prisma.awardYear.update({ where: { id: year.id }, data: { scholarshipEnvelopeId: env.id } });
      }
      if (!year.agencyEnvelopeId) {
        const env = await this.clients.createEnvelope({ agreementType: AgreementType.AGENCY_RENEWAL, referenceType: 'AWARD_YEAR', referenceId: year.id, ...who, mergeFields: this.mergeFields(a, year), expiresInDays });
        await this.prisma.awardYear.update({ where: { id: year.id }, data: { agencyEnvelopeId: env.id } });
      }
      if (firstOpen) {
        await this.prisma.$transaction(async (tx) => {
          await tx.awardYear.update({ where: { id: year.id }, data: { openedAt: new Date() } });
          await this.outbox.add<AwardYearEvent & { deadline: string }>(tx, Events.AwardRenewalOpened, { ...this.yearEvent(a, year), deadline: deadline.toISOString() });
        });
      }
    } catch (err) {
      this.logger.error(`Could not open renewal ${a.awardNo} Y${year.yearNumber}: ${(err as Error).message}`);
    }
  }

  yearEvent(a: Award, y: AwardYear): AwardYearEvent {
    return {
      awardId: a.id,
      awardNo: a.awardNo,
      athleteUserId: a.athleteUserId,
      yearNumber: y.yearNumber,
      academicYear: y.academicYear,
      dueDate: y.dueDate.toISOString(),
      amount: n(y.amount),
      currency: a.currency as AwardYearEvent['currency'],
    };
  }

  /** A year is renewed once the athlete has registered AND signed both renewal agreements. */
  async tryCompleteRenewal(tx: Prisma.TransactionClient, yearId: string): Promise<void> {
    const year = await tx.awardYear.findUniqueOrThrow({ where: { id: yearId }, include: { award: true } });
    if (year.status === 'RENEWED' || year.status === 'CANCELLED') return;
    if (!year.registrationSubmittedAt || !year.scholarshipSignedAt || !year.agencySignedAt) return;
    const res = await tx.awardYear.updateMany({ where: { id: yearId, status: { notIn: ['RENEWED', 'CANCELLED'] } }, data: { status: 'RENEWED', renewedAt: new Date() } });
    if (res.count !== 1) return;
    const a = year.award;
    const wasSuspended = a.status === 'SUSPENDED';
    const openYears = await tx.awardYear.count({ where: { awardId: a.id, status: { in: ['DUE', 'OVERDUE', 'SUSPENDED'] } } });
    if (['ACTIVE', 'RENEWAL_DUE', 'SUSPENDED'].includes(a.status)) {
      await tx.award.update({
        where: { id: a.id },
        data: {
          currentYear: Math.max(a.currentYear, year.yearNumber),
          status: openYears === 0 ? 'ACTIVE' : a.status,
          ...(wasSuspended && openYears === 0 ? { suspendedAt: null, suspensionReason: null } : {}),
        },
      });
    }
    await this.outbox.add<AwardYearEvent>(tx, Events.AwardRenewed, this.yearEvent(a, year));
    if (wasSuspended && openYears === 0) {
      await this.outbox.add<AwardStatusEvent>(tx, Events.AwardReinstated, {
        awardId: a.id,
        awardNo: a.awardNo,
        athleteUserId: a.athleteUserId,
        reason: `Year ${year.yearNumber} renewal completed`,
        effectiveDate: new Date().toISOString(),
      });
    }
  }

  // ------------------------------------------------------------------------------------------
  // Staff actions
  // ------------------------------------------------------------------------------------------

  async getForStaff(id: string, u: AuthUser) {
    const a = await this.prisma.award.findUnique({ where: { id }, include: { years: { orderBy: { yearNumber: 'asc' } }, application: true } });
    if (!a) throw new NotFoundException({ message: 'Scholarship not found', code: 'NOT_FOUND' });
    if (u.role === Role.UNIVERSITY_REP && a.universityId !== u.universityId) throw new ForbiddenException({ message: 'Not your university', code: 'FORBIDDEN' });
    return a;
  }

  async suspend(id: string, reason: string, actor: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const a = await tx.award.findUniqueOrThrow({ where: { id } });
      if (!['ACTIVE', 'RENEWAL_DUE'].includes(a.status)) throw new ConflictException({ message: `Cannot suspend a ${a.status} scholarship`, code: 'INVALID_STATE' });
      const u = await tx.award.update({ where: { id }, data: { status: 'SUSPENDED', suspendedAt: new Date(), suspensionReason: reason } });
      await this.outbox.add<AwardStatusEvent>(tx, Events.AwardSuspended, { awardId: id, awardNo: a.awardNo, athleteUserId: a.athleteUserId, reason, effectiveDate: new Date().toISOString() });
      await this.audit.log(actor, { action: 'award.suspend', entityType: 'Award', entityId: id, before: { status: a.status }, after: { status: 'SUSPENDED', reason } }, tx);
      return u;
    });
  }

  async reinstate(id: string, reason: string, actor: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const a = await tx.award.findUniqueOrThrow({ where: { id } });
      if (a.status !== 'SUSPENDED') throw new ConflictException({ message: 'Scholarship is not suspended', code: 'INVALID_STATE' });
      const open = await tx.awardYear.count({ where: { awardId: id, status: { in: ['DUE', 'OVERDUE', 'SUSPENDED'] } } });
      const u = await tx.award.update({ where: { id }, data: { status: open ? 'RENEWAL_DUE' : 'ACTIVE', suspendedAt: null, suspensionReason: null } });
      await tx.awardYear.updateMany({ where: { awardId: id, status: 'SUSPENDED' }, data: { status: 'OVERDUE' } });
      await this.outbox.add<AwardStatusEvent>(tx, Events.AwardReinstated, { awardId: id, awardNo: a.awardNo, athleteUserId: a.athleteUserId, reason, effectiveDate: new Date().toISOString() });
      await this.audit.log(actor, { action: 'award.reinstate', entityType: 'Award', entityId: id, before: { status: a.status }, after: { status: u.status, reason } }, tx);
      return u;
    });
  }

  /** Permanently ends a scholarship (misconduct, left the university...). Future years are cancelled. */
  async revoke(id: string, reason: string, returnSeat: boolean, actor: AuthUser) {
    const a = await this.prisma.award.findUniqueOrThrow({ where: { id } });
    if (['REVOKED', 'EXPIRED', 'COMPLETED'].includes(a.status)) throw new ConflictException({ message: `Scholarship is already ${a.status}`, code: 'INVALID_STATE' });
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.awardYear.updateMany({ where: { awardId: id, status: { in: ['UPCOMING', 'DUE', 'OVERDUE', 'SUSPENDED'] } }, data: { status: 'CANCELLED' } });
      const u = await tx.award.update({ where: { id }, data: { status: 'REVOKED', revokedAt: new Date(), revokeReason: reason } });
      await this.outbox.add<AwardStatusEvent>(tx, Events.AwardRevoked, { awardId: id, awardNo: a.awardNo, athleteUserId: a.athleteUserId, reason, effectiveDate: new Date().toISOString() });
      await this.audit.log(actor, { action: 'award.revoke', entityType: 'Award', entityId: id, before: { status: a.status }, after: { status: 'REVOKED', reason, returnSeat } }, tx);
      if (a.status === 'PENDING_SIGNATURE') {
        const app = await tx.application.findUniqueOrThrow({ where: { id: a.applicationId } });
        if (app.status === 'AGREEMENTS_PENDING') await this.sm.transition(tx, app, 'WITHDRAWN', actor, `Offer revoked: ${reason}`);
      }
      return u;
    });
    if (a.status === 'PENDING_SIGNATURE') {
      await this.clients.releaseSeat(a.applicationId, 'offer revoked').catch(() => undefined);
      await this.voidPendingEnvelopes(a.applicationId, reason);
    } else if (returnSeat) {
      await this.clients.returnSeat(a.applicationId, reason).catch((e) => this.logger.error(`seat return failed: ${e.message}`));
    }
    return updated;
  }

  /** Records the university's confirmation of the award value (backs every booked rupee/dollar for audit). */
  async setUniversityConfirmation(id: string, dto: ConfirmationDto, actor: AuthUser) {
    const a = await this.getForStaff(id, actor);
    if (!a.grantDate) throw new ConflictException({ message: 'Only granted scholarships can be confirmed', code: 'NOT_GRANTED' });
    return this.prisma.$transaction(async (tx) => {
      const u = await tx.award.update({
        where: { id },
        data: {
          universityConfirmationStatus: dto.status,
          universityConfirmedAt: dto.status === 'CONFIRMED' ? new Date() : null,
          universityConfirmedById: actor.id,
          universityConfirmationDocumentId: dto.documentId ?? a.universityConfirmationDocumentId,
          universityConfirmationNote: dto.note,
        },
      });
      await this.outbox.add(tx, Events.AwardUniversityConfirmed, {
        awardId: id,
        awardNo: a.awardNo,
        status: dto.status,
        confirmedAt: u.universityConfirmedAt?.toISOString() ?? null,
        documentId: u.universityConfirmationDocumentId,
      });
      await this.audit.log(actor, { action: 'award.university_confirmation', entityType: 'Award', entityId: id, before: { status: a.universityConfirmationStatus }, after: dto }, tx);
      return u;
    });
  }

  /** "Remind" button: nudges the athlete about unsigned agreements / pending renewal. */
  async remind(id: string, actor: AuthUser | null) {
    const a = await this.prisma.award.findUniqueOrThrow({ where: { id }, include: { years: true } });
    const pendingYear = a.years.find((y) => ['DUE', 'OVERDUE', 'SUSPENDED'].includes(y.status));
    await this.prisma.$transaction(async (tx) => {
      if (a.status === 'PENDING_SIGNATURE') {
        const missing = [!a.scholarshipSignedAt && 'Scholarship Award Agreement', !a.agencySignedAt && 'Agency Agreement'].filter(Boolean).join(' and ');
        await this.outbox.add(tx, Events.NotificationRequested, {
          templateKey: 'agreement_reminder',
          userId: a.athleteUserId,
          to: { whatsapp: a.whatsappNumber },
          channels: ['WHATSAPP'],
          data: { agreementName: missing },
        });
      } else if (pendingYear) {
        await this.outbox.add(tx, Events.AwardRenewalDue, this.yearEvent(a, pendingYear));
      } else {
        throw new ConflictException({ message: 'Nothing is pending for this scholarship', code: 'NOTHING_PENDING' });
      }
      await tx.award.update({ where: { id }, data: { lastReminderAt: new Date() } });
      if (actor) await this.audit.log(actor, { action: 'award.remind', entityType: 'Award', entityId: id }, tx);
    });
    return { reminded: true };
  }

  async resendAgreements(id: string, actor: AuthUser) {
    const a = await this.prisma.award.findUniqueOrThrow({ where: { id } });
    if (a.status !== 'PENDING_SIGNATURE') throw new ConflictException({ message: 'Agreements are already signed', code: 'INVALID_STATE' });
    const toVoid = [!a.scholarshipSignedAt && a.scholarshipEnvelopeId, !a.agencySignedAt && a.agencyEnvelopeId].filter((x): x is string => !!x);
    for (const e of toVoid) await this.clients.voidEnvelope(e, 'Resent by staff').catch(() => undefined);
    await this.prisma.award.update({
      where: { id },
      data: {
        agreementsDeadline: addDays(new Date(), this.config.env.AGREEMENT_SIGNING_DEADLINE_DAYS),
        ...(a.scholarshipSignedAt ? {} : { scholarshipEnvelopeId: null }),
        ...(a.agencySignedAt ? {} : { agencyEnvelopeId: null }),
      },
    });
    await this.sendInitialEnvelopes(id);
    await this.audit.log(actor, { action: 'award.resend_agreements', entityType: 'Award', entityId: id });
    return this.prisma.award.findUniqueOrThrow({ where: { id } });
  }
}
