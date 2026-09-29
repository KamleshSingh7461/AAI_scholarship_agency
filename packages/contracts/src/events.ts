import type {
  AgreementType,
  ApplicationStatus,
  AwardStatus,
  Currency,
  NotificationChannel,
  PaymentProvider,
  PaymentPurpose,
  Role,
} from './enums';

/**
 * Every message on the bus is wrapped in this envelope. `id` is globally unique and
 * is what consumers de-duplicate on (inbox pattern), so redelivery is always safe.
 */
export interface EventEnvelope<T = unknown> {
  id: string;
  type: EventType;
  version: 1;
  source: string;
  occurredAt: string;
  correlationId?: string;
  data: T;
}

export const Events = {
  UserRegistered: 'auth.user.registered',

  ProfileSubmitted: 'athlete.profile.submitted',
  ProfileReviewed: 'athlete.profile.reviewed',

  ProgramPublished: 'university.program.published',

  ApplicationSubmitted: 'application.submitted',
  ApplicationStatusChanged: 'application.status_changed',

  AwardOffered: 'award.offered',
  AwardActivated: 'award.activated',
  AwardRenewalDue: 'award.renewal_due',
  AwardRenewalOpened: 'award.renewal_opened',
  AwardRenewed: 'award.renewed',
  AwardSuspended: 'award.suspended',
  AwardReinstated: 'award.reinstated',
  AwardRevoked: 'award.revoked',
  AwardCompleted: 'award.completed',
  AwardExpired: 'award.expired',
  AwardUniversityConfirmed: 'award.university_confirmed',

  PaymentSucceeded: 'payment.succeeded',
  PaymentFailed: 'payment.failed',
  PaymentRefunded: 'payment.refunded',

  EnvelopeSent: 'esign.envelope.sent',
  EnvelopeViewed: 'esign.envelope.viewed',
  EnvelopeSigned: 'esign.envelope.signed',
  EnvelopeDeclined: 'esign.envelope.declined',
  EnvelopeExpired: 'esign.envelope.expired',

  NotificationRequested: 'notification.requested',
} as const;
export type EventType = (typeof Events)[keyof typeof Events];

export interface UserRegisteredEvent {
  userId: string;
  phone: string;
  role: Role;
}

export interface ProfileSubmittedEvent {
  userId: string;
  profileId: string;
  athleteCode: string;
  fullName: string;
}

export interface ProfileReviewedEvent {
  userId: string;
  profileId: string;
  status: 'VERIFIED' | 'CHANGES_REQUESTED' | 'REJECTED';
  remarks?: string;
}

export interface ApplicationStatusChangedEvent {
  applicationId: string;
  applicationNo: string;
  athleteUserId: string;
  programId: string;
  universityId: string;
  from: ApplicationStatus;
  to: ApplicationStatus;
  note?: string;
}

/** Full, denormalised award snapshot. Finance keeps its own projection from this. */
export interface AwardSnapshot {
  awardId: string;
  awardNo: string;
  applicationId: string;
  athleteUserId: string;
  athleteCode: string;
  athleteName: string;
  whatsappNumber: string;
  sport: string;
  universityId: string;
  universityName: string;
  programId: string;
  programName: string;
  durationYears: number;
  currency: Currency;
  tuitionPerYear: number;
  roomPerYear: number;
  foodPerYear: number;
  otherPerYear: number;
  annualValue: number;
  totalValue: number;
  /** Per-year value funded by the university in kind (e.g. tuition waiver) vs. paid by the company (e.g. hostel, food). */
  universityFundedAnnual: number;
  companyFundedAnnual: number;
  /** 1 USD = rate/10000 INR, snapshotted at grant time. */
  usdInrRate4: number;
  commissionBps: number;
  universityCommissionShareBps: number;
  grantDate: string | null;
  startDate: string;
  endDate: string;
  status: AwardStatus;
}

export interface AwardYearEvent {
  awardId: string;
  awardNo: string;
  athleteUserId: string;
  yearNumber: number;
  academicYear: string;
  dueDate: string;
  amount: number;
  currency: Currency;
}

export interface AwardStatusEvent {
  awardId: string;
  awardNo: string;
  athleteUserId: string;
  reason?: string;
  effectiveDate: string;
}

export interface PaymentEvent {
  orderId: string;
  orderNo: string;
  purpose: PaymentPurpose;
  referenceType: string;
  referenceId: string;
  userId: string;
  amount: number;
  taxAmount: number;
  currency: Currency;
  provider: PaymentProvider;
  providerPaymentId?: string;
  occurredAt: string;
  reason?: string;
}

export interface EnvelopeEvent {
  envelopeId: string;
  agreementType: AgreementType;
  referenceType: 'AWARD' | 'AWARD_YEAR';
  referenceId: string;
  signerUserId: string;
  signedDocumentId?: string;
  occurredAt: string;
}

export interface NotificationRequestedEvent {
  templateKey: string;
  userId?: string;
  to: { phone?: string; email?: string; whatsapp?: string };
  channels: NotificationChannel[];
  data: Record<string, string | number>;
}
