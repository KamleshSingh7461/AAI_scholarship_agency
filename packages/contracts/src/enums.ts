/**
 * Enums shared across services and frontends. Values are persisted as strings
 * in each service's database, so never rename a value — add a new one instead.
 */

export const Role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  FINANCE: 'FINANCE',
  REVIEWER: 'REVIEWER',
  UNIVERSITY_REP: 'UNIVERSITY_REP',
  ATHLETE: 'ATHLETE',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const STAFF_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.FINANCE, Role.REVIEWER];

export const OtpChannel = { SMS: 'SMS', WHATSAPP: 'WHATSAPP' } as const;
export type OtpChannel = (typeof OtpChannel)[keyof typeof OtpChannel];

export const Currency = { INR: 'INR', USD: 'USD' } as const;
export type Currency = (typeof Currency)[keyof typeof Currency];

export const ProfileStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  VERIFIED: 'VERIFIED',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  REJECTED: 'REJECTED',
} as const;
export type ProfileStatus = (typeof ProfileStatus)[keyof typeof ProfileStatus];

export const AthleteDocumentType = {
  PROFILE_PHOTO: 'PROFILE_PHOTO',
  GOVT_ID: 'GOVT_ID',
  DOB_PROOF: 'DOB_PROOF',
  ADDRESS_PROOF: 'ADDRESS_PROOF',
  SPORTS_ID: 'SPORTS_ID',
  PERFORMANCE_CERTIFICATE: 'PERFORMANCE_CERTIFICATE',
  COACH_RECOMMENDATION: 'COACH_RECOMMENDATION',
  MEDICAL_FITNESS: 'MEDICAL_FITNESS',
  INJURY_RECORDS: 'INJURY_RECORDS',
  PLAYER_CONTRACT: 'PLAYER_CONTRACT',
  MARKSHEET_10: 'MARKSHEET_10',
  MARKSHEET_12: 'MARKSHEET_12',
  GRADUATION_CERTIFICATE: 'GRADUATION_CERTIFICATE',
  STUDENT_ID_CARD: 'STUDENT_ID_CARD',
  MEDICAL_CLEARANCE: 'MEDICAL_CLEARANCE',
  COACH_CERTIFICATION: 'COACH_CERTIFICATION',
  GUARDIAN_ID: 'GUARDIAN_ID',
} as const;
export type AthleteDocumentType = (typeof AthleteDocumentType)[keyof typeof AthleteDocumentType];

/** Documents that must be present before a profile can be submitted (Step 4 "Mandatory Documents"). */
export const MANDATORY_ATHLETE_DOCUMENTS: AthleteDocumentType[] = [
  AthleteDocumentType.PROFILE_PHOTO,
  AthleteDocumentType.GOVT_ID,
  AthleteDocumentType.DOB_PROOF,
  AthleteDocumentType.ADDRESS_PROOF,
];

export const ScholarshipType = {
  ATHLETIC: 'ATHLETIC',
  ACADEMIC: 'ACADEMIC',
  MERIT: 'MERIT',
  NEED_BASED: 'NEED_BASED',
} as const;
export type ScholarshipType = (typeof ScholarshipType)[keyof typeof ScholarshipType];

export const CoverageType = { FULL: 'FULL', PARTIAL: 'PARTIAL' } as const;
export type CoverageType = (typeof CoverageType)[keyof typeof CoverageType];

/** Who bears a non-tuition cost (hostel, books, uniform...). MoU: "paid by the AAI / student". */
export const CostBearer = { UNIVERSITY: 'UNIVERSITY', COMPANY: 'COMPANY', STUDENT: 'STUDENT' } as const;
export type CostBearer = (typeof CostBearer)[keyof typeof CostBearer];

export const ProgramStatus = { DRAFT: 'DRAFT', PUBLISHED: 'PUBLISHED', CLOSED: 'CLOSED', ARCHIVED: 'ARCHIVED' } as const;
export type ProgramStatus = (typeof ProgramStatus)[keyof typeof ProgramStatus];

/** What happens to seats not awarded by the end of an academic year. The two IES letters disagree, so it is configurable. */
export const RolloverPolicy = { FORFEIT: 'FORFEIT', ROLLOVER: 'ROLLOVER' } as const;
export type RolloverPolicy = (typeof RolloverPolicy)[keyof typeof RolloverPolicy];

export const FeeType = { NONE: 'NONE', FLAT: 'FLAT', PERCENTAGE: 'PERCENTAGE' } as const;
export type FeeType = (typeof FeeType)[keyof typeof FeeType];

export const FeePercentBase = { TOTAL_VALUE: 'TOTAL_VALUE', ANNUAL_VALUE: 'ANNUAL_VALUE' } as const;
export type FeePercentBase = (typeof FeePercentBase)[keyof typeof FeePercentBase];

export const ApplicationStatus = {
  DRAFT: 'DRAFT',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  FORWARDED_TO_UNIVERSITY: 'FORWARDED_TO_UNIVERSITY',
  UNIVERSITY_APPROVED: 'UNIVERSITY_APPROVED',
  AGREEMENTS_PENDING: 'AGREEMENTS_PENDING',
  AWARDED: 'AWARDED',
  REJECTED: 'REJECTED',
  UNIVERSITY_REJECTED: 'UNIVERSITY_REJECTED',
  WITHDRAWN: 'WITHDRAWN',
  EXPIRED: 'EXPIRED',
} as const;
export type ApplicationStatus = (typeof ApplicationStatus)[keyof typeof ApplicationStatus];

/** Allowed transitions. Anything not listed here is rejected by the application service. */
export const APPLICATION_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  DRAFT: ['PAYMENT_PENDING', 'SUBMITTED', 'WITHDRAWN'],
  PAYMENT_PENDING: ['SUBMITTED', 'WITHDRAWN', 'EXPIRED'],
  SUBMITTED: ['UNDER_REVIEW', 'REJECTED', 'WITHDRAWN'],
  UNDER_REVIEW: ['FORWARDED_TO_UNIVERSITY', 'REJECTED', 'WITHDRAWN'],
  FORWARDED_TO_UNIVERSITY: ['UNIVERSITY_APPROVED', 'UNIVERSITY_REJECTED', 'WITHDRAWN'],
  UNIVERSITY_APPROVED: ['AGREEMENTS_PENDING', 'WITHDRAWN'],
  AGREEMENTS_PENDING: ['AWARDED', 'EXPIRED', 'WITHDRAWN'],
  AWARDED: [],
  REJECTED: [],
  UNIVERSITY_REJECTED: [],
  WITHDRAWN: [],
  EXPIRED: [],
};

export const AwardStatus = {
  PENDING_SIGNATURE: 'PENDING_SIGNATURE',
  ACTIVE: 'ACTIVE',
  RENEWAL_DUE: 'RENEWAL_DUE',
  SUSPENDED: 'SUSPENDED',
  COMPLETED: 'COMPLETED',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
} as const;
export type AwardStatus = (typeof AwardStatus)[keyof typeof AwardStatus];

export const AwardYearStatus = {
  UPCOMING: 'UPCOMING',
  DUE: 'DUE',
  RENEWED: 'RENEWED',
  OVERDUE: 'OVERDUE',
  SUSPENDED: 'SUSPENDED',
  CANCELLED: 'CANCELLED',
} as const;
export type AwardYearStatus = (typeof AwardYearStatus)[keyof typeof AwardYearStatus];

export const ConfirmationStatus = { PENDING: 'PENDING', CONFIRMED: 'CONFIRMED', DISPUTED: 'DISPUTED' } as const;
export type ConfirmationStatus = (typeof ConfirmationStatus)[keyof typeof ConfirmationStatus];

export const AgreementType = {
  SCHOLARSHIP_AWARD: 'SCHOLARSHIP_AWARD',
  AGENCY: 'AGENCY',
  SCHOLARSHIP_RENEWAL: 'SCHOLARSHIP_RENEWAL',
  AGENCY_RENEWAL: 'AGENCY_RENEWAL',
} as const;
export type AgreementType = (typeof AgreementType)[keyof typeof AgreementType];

export const EnvelopeStatus = {
  CREATED: 'CREATED',
  SENT: 'SENT',
  VIEWED: 'VIEWED',
  SIGNED: 'SIGNED',
  DECLINED: 'DECLINED',
  VOIDED: 'VOIDED',
  EXPIRED: 'EXPIRED',
} as const;
export type EnvelopeStatus = (typeof EnvelopeStatus)[keyof typeof EnvelopeStatus];

export const PaymentProvider = { RAZORPAY: 'RAZORPAY', CASHFREE: 'CASHFREE', PAYU: 'PAYU', MOCK: 'MOCK' } as const;
export type PaymentProvider = (typeof PaymentProvider)[keyof typeof PaymentProvider];

export const PaymentPurpose = { APPLICATION_FEE: 'APPLICATION_FEE', RENEWAL_FEE: 'RENEWAL_FEE' } as const;
export type PaymentPurpose = (typeof PaymentPurpose)[keyof typeof PaymentPurpose];

export const PaymentStatus = {
  CREATED: 'CREATED',
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
  REFUNDED: 'REFUNDED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const NotificationChannel = { SMS: 'SMS', WHATSAPP: 'WHATSAPP', EMAIL: 'EMAIL' } as const;
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const Gender = { MALE: 'MALE', FEMALE: 'FEMALE', OTHER: 'OTHER', PREFER_NOT_TO_SAY: 'PREFER_NOT_TO_SAY' } as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

export const AcademicLevel = { HIGH_SCHOOL: 'HIGH_SCHOOL', INTERMEDIATE: 'INTERMEDIATE', GRADUATION: 'GRADUATION' } as const;
export type AcademicLevel = (typeof AcademicLevel)[keyof typeof AcademicLevel];

export const ScoreType = { PERCENTAGE: 'PERCENTAGE', GRADE: 'GRADE', CGPA: 'CGPA' } as const;
export type ScoreType = (typeof ScoreType)[keyof typeof ScoreType];

export const FitnessLevel = { BEGINNER: 'BEGINNER', INTERMEDIATE: 'INTERMEDIATE', ELITE: 'ELITE' } as const;
export type FitnessLevel = (typeof FitnessLevel)[keyof typeof FitnessLevel];

export const AgeGroup = { U14: 'U14', U17: 'U17', U19: 'U19', SENIOR: 'SENIOR' } as const;
export type AgeGroup = (typeof AgeGroup)[keyof typeof AgeGroup];

export const RankingLevel = { NATIONAL: 'NATIONAL', STATE: 'STATE', DISTRICT: 'DISTRICT', NONE: 'NONE' } as const;
export type RankingLevel = (typeof RankingLevel)[keyof typeof RankingLevel];

export const RevenueRecognitionPolicy = {
  /** Management's stated policy: book full multi-year value on the grant date, expense it year by year. */
  FULL_AT_GRANT: 'FULL_AT_GRANT',
  /** Conservative alternative: recognise each year's value as that year starts. */
  RATABLE: 'RATABLE',
} as const;
export type RevenueRecognitionPolicy = (typeof RevenueRecognitionPolicy)[keyof typeof RevenueRecognitionPolicy];
