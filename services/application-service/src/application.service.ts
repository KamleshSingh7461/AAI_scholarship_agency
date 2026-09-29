import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Events, Role } from '@aci/contracts';
import { APP_CONFIG, AuditService, OutboxService, refNo, type AuthUser } from '@aci/nest-common';
import type { ApplicationConfig } from './config';
import { PrismaService } from './prisma.service';
import { Clients, type AthleteSummary, type ProgramView } from './clients';
import { AwardService } from './award.service';
import { ApplicationStateMachine } from './state-machine';
import type { CreateApplicationDto, StaffCreateApplicationDto, UniversityDecisionDto } from './dto';
import type { Application, Prisma } from './generated/prisma';

const TERMINAL: string[] = ['AWARDED', 'REJECTED', 'UNIVERSITY_REJECTED', 'WITHDRAWN', 'EXPIRED'];
/** Closed without an award: the athlete may apply to the same program again. */
const DEAD: string[] = ['REJECTED', 'UNIVERSITY_REJECTED', 'WITHDRAWN', 'EXPIRED'];

@Injectable()
export class ApplicationService {
  private readonly logger = new Logger(ApplicationService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: ApplicationConfig,
    private readonly prisma: PrismaService,
    private readonly clients: Clients,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly awards: AwardService,
    private readonly sm: ApplicationStateMachine,
  ) {}

  private checkEligibility(athlete: AthleteSummary, program: ProgramView) {
    const problems: string[] = [];
    if (!['SUBMITTED', 'VERIFIED'].includes(athlete.status)) problems.push('Complete and submit your athlete profile first');
    if (program.minAge && (athlete.age ?? 0) < program.minAge) problems.push(`Minimum age is ${program.minAge}`);
    if (program.maxAge && (athlete.age ?? 99) > program.maxAge) problems.push(`Maximum age is ${program.maxAge}`);
    if (program.genderEligibility !== 'ANY' && athlete.gender !== program.genderEligibility) problems.push(`Open to ${program.genderEligibility.toLowerCase()} athletes only`);
    if (program.eligibleSports.length) {
      const sport = (athlete.primarySport ?? '').toLowerCase();
      if (!program.eligibleSports.some((s) => s.toLowerCase() === sport)) problems.push(`Open to: ${program.eligibleSports.join(', ')}`);
    }
    if (problems.length) throw new BadRequestException({ message: problems[0], code: 'NOT_ELIGIBLE', problems });
  }

  private async assertNoDuplicate(athleteUserId: string, programId: string) {
    const [dup, open] = await Promise.all([
      this.prisma.application.findFirst({ where: { athleteUserId, programId, status: { notIn: DEAD } } }),
      this.prisma.application.count({ where: { athleteUserId, status: { notIn: TERMINAL } } }),
    ]);
    if (dup) throw new ConflictException({ message: 'You already have an application for this scholarship', code: 'DUPLICATE_APPLICATION', applicationId: dup.id });
    if (open >= this.config.env.MAX_OPEN_APPLICATIONS) {
      throw new ConflictException({ message: `You can have at most ${this.config.env.MAX_OPEN_APPLICATIONS} open applications`, code: 'TOO_MANY_APPLICATIONS' });
    }
  }

  private baseData(athlete: AthleteSummary, program: ProgramView) {
    return {
      athleteUserId: athlete.userId,
      athleteProfileId: athlete.profileId,
      athleteCode: athlete.athleteCode,
      athleteName: athlete.fullName ?? 'Athlete',
      athletePhone: athlete.phone,
      whatsappNumber: athlete.whatsappNumber,
      athleteEmail: athlete.email,
      sport: athlete.primarySport,
      isMinor: athlete.isMinor,
      guardian: (athlete.guardian ?? undefined) as any,
      programId: program.id,
      programName: program.name,
      universityId: program.universityId,
      universityName: program.university?.name ?? '',
      academicYear: program.academicYear,
      durationYears: program.durationYears,
      currency: program.value.currency,
      annualValue: BigInt(program.value.annualValue),
      totalValue: BigInt(program.value.totalValue),
      usdInrRate4: program.value.usdInrRate4,
      programSnapshot: program as any,
    };
  }

  /** Athlete applies. If the program charges a fee the application waits in PAYMENT_PENDING. */
  async create(user: AuthUser, dto: CreateApplicationDto) {
    const [athlete, program] = await Promise.all([this.clients.athleteByUser(user.id), this.clients.program(dto.programId)]);
    if (!program.isOpen) throw new ConflictException({ message: 'This scholarship is not accepting applications', code: 'PROGRAM_CLOSED' });
    this.checkEligibility(athlete, program);
    await this.assertNoDuplicate(user.id, program.id);

    const needsPayment = program.fee.totalInr > 0;
    return this.prisma.$transaction(async (tx) => {
      const app = await tx.application.create({
        data: {
          ...this.baseData(athlete, program),
          applicationNo: refNo('APP'),
          statement: dto.statement,
          preferredCourse: dto.preferredCourse,
          feeBaseInr: BigInt(program.fee.baseInr),
          feeTaxInr: BigInt(program.fee.taxInr),
          feeTotalInr: BigInt(program.fee.totalInr),
          feeExplanation: program.fee.explanation,
          paymentStatus: needsPayment ? 'PENDING' : 'NOT_REQUIRED',
        },
      });
      await tx.applicationStatusHistory.create({ data: { applicationId: app.id, toStatus: 'DRAFT', actorId: user.id, actorRole: user.role } });
      if (needsPayment) return this.sm.transition(tx, app, 'PAYMENT_PENDING', user, `Application fee ₹${(program.fee.totalInr / 100).toLocaleString('en-IN')}`);
      const submitted = await this.sm.transition(tx, app, 'SUBMITTED', user, 'No application fee', { submittedAt: new Date() });
      await this.outbox.add(tx, Events.ApplicationSubmitted, { applicationId: app.id, applicationNo: app.applicationNo, athleteUserId: user.id });
      return submitted;
    });
  }

  /** Staff "Award Scholarship": create on behalf of an athlete, optionally fee-waived and pre-approved by the university. */
  async staffCreate(actor: AuthUser, dto: StaffCreateApplicationDto) {
    const [athlete, program] = await Promise.all([this.clients.athleteByUser(dto.athleteUserId), this.clients.program(dto.programId)]);
    if (program.status !== 'PUBLISHED') throw new ConflictException({ message: 'Program is not published', code: 'PROGRAM_CLOSED' });
    await this.assertNoDuplicate(dto.athleteUserId, program.id);
    const waive = dto.waiveFee || program.fee.totalInr === 0;
    const app = await this.prisma.$transaction(async (tx) => {
      const created = await tx.application.create({
        data: {
          ...this.baseData(athlete, program),
          applicationNo: refNo('APP'),
          feeBaseInr: BigInt(waive ? 0 : program.fee.baseInr),
          feeTaxInr: BigInt(waive ? 0 : program.fee.taxInr),
          feeTotalInr: BigInt(waive ? 0 : program.fee.totalInr),
          feeExplanation: waive ? 'Fee waived by staff' : program.fee.explanation,
          feeWaived: !!dto.waiveFee,
          paymentStatus: waive ? 'NOT_REQUIRED' : 'PENDING',
          createdByStaffId: actor.id,
        },
      });
      await tx.applicationStatusHistory.create({ data: { applicationId: created.id, toStatus: 'DRAFT', actorId: actor.id, actorRole: actor.role, note: dto.note ?? 'Created by staff' } });
      await this.audit.log(actor, { action: 'application.staff_create', entityType: 'Application', entityId: created.id, after: dto }, tx);
      if (!waive) return this.sm.transition(tx, created, 'PAYMENT_PENDING', actor, 'Created by staff; awaiting fee');
      let a = await this.sm.transition(tx, created, 'SUBMITTED', actor, dto.note ?? 'Created by staff', { submittedAt: new Date() });
      if (dto.universityApproved) {
        a = await this.sm.transition(tx, a, 'UNDER_REVIEW', actor, 'Pre-approved');
        a = await this.sm.transition(tx, a, 'FORWARDED_TO_UNIVERSITY', actor, 'Pre-approved', { forwardedAt: new Date() });
      }
      return a;
    });
    if (dto.universityApproved) {
      return this.universityDecision(app.id, { decision: 'APPROVED', note: dto.note ?? 'Approved by university (recorded by staff)', documentId: dto.universityApprovalDocumentId }, actor);
    }
    return app;
  }

  async get(id: string): Promise<Application> {
    const a = await this.prisma.application.findUnique({ where: { id } });
    if (!a) throw new NotFoundException({ message: 'Application not found', code: 'NOT_FOUND' });
    return a;
  }

  assertCanView(app: Application, u: AuthUser) {
    if (u.role === Role.ATHLETE && app.athleteUserId !== u.id) throw new NotFoundException({ message: 'Application not found', code: 'NOT_FOUND' });
    if (u.role === Role.UNIVERSITY_REP && app.universityId !== u.universityId) throw new ForbiddenException({ message: 'Not your university', code: 'FORBIDDEN' });
  }

  /** Creates (or reuses) a payment order for the application fee and returns gateway checkout data. */
  async initiatePayment(id: string, user: AuthUser) {
    const app = await this.get(id);
    this.assertCanView(app, user);
    if (app.status !== 'PAYMENT_PENDING') throw new ConflictException({ message: 'This application does not need a payment', code: 'NO_PAYMENT_DUE' });
    const order = await this.clients.createPaymentOrder({
      purpose: 'APPLICATION_FEE',
      referenceType: 'APPLICATION',
      referenceId: app.id,
      userId: app.athleteUserId,
      amount: Number(app.feeTotalInr),
      taxAmount: Number(app.feeTaxInr),
      description: `Application fee ${app.applicationNo} — ${app.programName}`,
      customer: { name: app.athleteName, phone: app.athletePhone, email: app.athleteEmail },
    });
    await this.prisma.application.update({ where: { id }, data: { paymentOrderId: order.orderId } });
    return order;
  }

  /** Called from the payment.succeeded handler. Idempotent. */
  async markPaid(tx: Prisma.TransactionClient, applicationId: string, orderId: string, paidAt: Date) {
    const app = await tx.application.findUnique({ where: { id: applicationId } });
    if (!app) return;
    if (app.status !== 'PAYMENT_PENDING') {
      if (app.paymentStatus !== 'PAID') await tx.application.update({ where: { id: app.id }, data: { paymentStatus: 'PAID', paidAt, paymentOrderId: orderId } });
      return;
    }
    await this.sm.transition(tx, app, 'SUBMITTED', null, 'Application fee paid', { paymentStatus: 'PAID', paidAt, paymentOrderId: orderId, submittedAt: new Date() });
    await this.outbox.add(tx, Events.ApplicationSubmitted, { applicationId: app.id, applicationNo: app.applicationNo, athleteUserId: app.athleteUserId });
  }

  async startReview(id: string, actor: AuthUser, note?: string) {
    const app = await this.get(id);
    return this.prisma.$transaction((tx) => this.sm.transition(tx, app, 'UNDER_REVIEW', actor, note, { reviewerId: actor.id }));
  }

  async forward(id: string, actor: AuthUser, note?: string) {
    const app = await this.get(id);
    const athlete = await this.clients.athleteByUser(app.athleteUserId);
    if (athlete.status !== 'VERIFIED') {
      throw new ConflictException({ message: "Verify the athlete's profile and documents before forwarding to the university", code: 'ATHLETE_NOT_VERIFIED' });
    }
    return this.prisma.$transaction((tx) => this.sm.transition(tx, app, 'FORWARDED_TO_UNIVERSITY', actor, note, { forwardedAt: new Date() }));
  }

  async reject(id: string, actor: AuthUser, reason: string) {
    const app = await this.get(id);
    const updated = await this.prisma.$transaction((tx) => this.sm.transition(tx, app, 'REJECTED', actor, reason, { rejectionReason: reason }));
    await this.maybeRefund(updated, reason);
    return updated;
  }

  private async maybeRefund(app: Application, reason: string) {
    const snap = app.programSnapshot as unknown as ProgramView;
    if (app.paymentStatus === 'PAID' && app.paymentOrderId && snap?.feeRefundableOnRejection) {
      try {
        await this.clients.requestRefund(app.paymentOrderId, reason);
        await this.prisma.application.update({ where: { id: app.id }, data: { paymentStatus: 'REFUND_REQUESTED' } });
      } catch (err) {
        this.logger.error(`Refund request failed for ${app.applicationNo}: ${(err as Error).message}`);
      }
    }
  }

  /**
   * The university's final decision (MoU: the university keeps the absolute right to accept or reject).
   * On approval: reserve a seat, create the award and send both agreements for e-signature.
   */
  async universityDecision(id: string, dto: UniversityDecisionDto, actor: AuthUser) {
    const app = await this.get(id);
    this.assertCanView(app, actor);
    if (dto.decision === 'REJECTED') {
      const updated = await this.prisma.$transaction((tx) =>
        this.sm.transition(tx, app, 'UNIVERSITY_REJECTED', actor, dto.note, {
          universityDecisionAt: new Date(),
          universityDecisionById: actor.id,
          universityDecisionNote: dto.note,
          universityApprovalDocumentId: dto.documentId,
          rejectionReason: dto.note,
        }),
      );
      await this.maybeRefund(updated, dto.note ?? 'Rejected by university');
      return updated;
    }

    if (app.status !== 'FORWARDED_TO_UNIVERSITY') {
      throw new ConflictException({ message: `Cannot approve an application in ${app.status}`, code: 'INVALID_TRANSITION' });
    }
    const activeAward = await this.prisma.award.findFirst({
      where: { athleteUserId: app.athleteUserId, status: { in: ['ACTIVE', 'RENEWAL_DUE', 'PENDING_SIGNATURE', 'SUSPENDED'] } },
    });
    if (activeAward) {
      throw new ConflictException({ message: `This athlete already holds scholarship ${activeAward.awardNo}`, code: 'ALREADY_AWARDED' });
    }

    const athlete = await this.clients.athleteByUser(app.athleteUserId);
    if (athlete.status !== 'VERIFIED') {
      throw new ConflictException({ message: "Verify the athlete's profile and documents before recording the university's approval", code: 'ATHLETE_NOT_VERIFIED' });
    }

    // Seat first: if the program is full we stop here and nothing else changes.
    await this.clients.reserveSeat(app.programId, app.id);
    const program = await this.clients.program(app.programId);
    try {
      const award = await this.prisma.$transaction(async (tx) => {
        let a = await this.sm.transition(tx, app, 'UNIVERSITY_APPROVED', actor, dto.note, {
          universityDecisionAt: new Date(),
          universityDecisionById: actor.id,
          universityDecisionNote: dto.note,
          universityApprovalDocumentId: dto.documentId,
        });
        const created = await this.awards.createOffer(tx, a, program);
        a = await this.sm.transition(tx, a, 'AGREEMENTS_PENDING', null, 'Scholarship Award Agreement and Agency Agreement sent for signature');
        return created;
      });
      await this.awards.sendInitialEnvelopes(award.id);
    } catch (err) {
      // Roll back the seat hold if we could not record the offer.
      const current = await this.prisma.application.findUnique({ where: { id } });
      if (current?.status === 'FORWARDED_TO_UNIVERSITY') await this.clients.releaseSeat(app.id, 'offer failed').catch(() => undefined);
      throw err;
    }
    return this.prisma.application.findUniqueOrThrow({ where: { id }, include: { award: true } });
  }

  async withdraw(id: string, user: AuthUser, reason?: string) {
    const app = await this.get(id);
    this.assertCanView(app, user);
    const updated = await this.prisma.$transaction(async (tx) => {
      const a = await this.sm.transition(tx, app, 'WITHDRAWN', user, reason ?? 'Withdrawn by athlete');
      if (app.status === 'AGREEMENTS_PENDING') await this.awards.expireOffer(tx, app.id, 'Application withdrawn');
      return a;
    });
    if (['UNIVERSITY_APPROVED', 'AGREEMENTS_PENDING'].includes(app.status)) {
      await this.clients.releaseSeat(app.id, 'withdrawn').catch((e) => this.logger.error(`Seat release failed: ${e.message}`));
      await this.awards.voidPendingEnvelopes(app.id, 'Application withdrawn');
    }
    return updated;
  }
}
