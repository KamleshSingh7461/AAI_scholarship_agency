export interface AthleteProfile {
  id: string;
  userId: string;
  athleteCode: string | null;
  status: 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'CHANGES_REQUESTED' | 'REJECTED';
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  nationality: string | null;
  profilePhotoDocumentId: string | null;
  email: string | null;
  phone: string;
  whatsappNumber: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string;
  guardianName: string | null;
  guardianRelation: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  stepsCompleted: number[];
  reviewRemarks: string | null;
  academics: AcademicRecord[];
  sports: SportsProfile | null;
  documents: { id: string; type: string; documentId: string; verificationStatus: string; remarks: string | null }[];
  references: Reference[];
}

export interface AcademicRecord {
  level: 'HIGH_SCHOOL' | 'INTERMEDIATE' | 'GRADUATION';
  institutionName: string;
  boardOrUniversity?: string | null;
  stream?: string | null;
  degree?: string | null;
  major?: string | null;
  yearOfPassing?: number | null;
  isExpectedYear?: boolean;
  scoreType?: string | null;
  scoreValue?: string | null;
  certificateDocumentId?: string | null;
}

export interface SportsProfile {
  primarySport: string;
  currentClub?: string | null;
  coachName?: string | null;
  coachContact?: string | null;
  yearsOfTraining?: number | null;
  heightCm?: number | string | null;
  weightKg?: number | string | null;
  wingspanCm?: number | string | null;
  chestCm?: number | string | null;
  waistCm?: number | string | null;
  bodyFatPct?: number | string | null;
  fitnessLevel?: string | null;
  rankingLevel?: string | null;
  rankingValue?: string | null;
  ageGroup?: string | null;
  bestPerformance?: string | null;
  medalsGold?: number;
  medalsSilver?: number;
  medalsBronze?: number;
  internationalParticipation?: boolean;
  internationalDetails?: string | null;
  previousInjuries?: boolean;
  injuryDetails?: string | null;
  recoveryStatus?: string | null;
  medicalClearanceDocumentId?: string | null;
  sportsIdDocumentId?: string | null;
  coachCertificationDocumentId?: string | null;
}

export interface Reference {
  position: number;
  name: string;
  designation: string;
  organization: string;
  relationship?: string | null;
  phone: string;
  email?: string | null;
  certificationDocumentId?: string | null;
}

export interface Completeness {
  steps: { personal: boolean; academic: boolean; sports: boolean; documents: boolean };
  missing: string[];
  missingDocuments: string[];
  isMinor: boolean;
  canSubmit: boolean;
}

export interface MeResponse {
  profile: AthleteProfile;
  completeness: Completeness;
}

export interface AwardYear {
  id: string;
  yearNumber: number;
  academicYear: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: string;
  amount: number;
  registrationSubmittedAt: string | null;
  scholarshipSignedAt: string | null;
  agencySignedAt: string | null;
  renewedAt: string | null;
  deadline?: string;
  award?: { id: string; awardNo: string; universityName: string; programName: string; status: string; currency: string };
}

export interface Award {
  id: string;
  awardNo: string;
  applicationId: string;
  universityName: string;
  programName: string;
  sport: string | null;
  durationYears: number;
  currency: string;
  tuitionPerYear: number;
  roomPerYear: number;
  foodPerYear: number;
  otherPerYear: number;
  annualValue: number;
  totalValue: number;
  usdInrRate4: number;
  status: string;
  grantDate: string | null;
  startDate: string | null;
  endDate: string | null;
  agreementsDeadline: string;
  scholarshipSignedAt: string | null;
  agencySignedAt: string | null;
  years: AwardYear[];
  progress?: {
    yearsCompleted: number;
    yearsRenewed: number;
    releasedValue: number;
    remainingValue: number;
    nextRenewal: { yearId: string; yearNumber: number; dueDate: string; status: string } | null;
  };
}

export interface Application {
  id: string;
  applicationNo: string;
  programId: string;
  programName: string;
  universityName: string;
  academicYear: string;
  durationYears: number;
  currency: string;
  annualValue: number;
  totalValue: number;
  status: string;
  feeBaseInr: number;
  feeTaxInr: number;
  feeTotalInr: number;
  feeExplanation: string | null;
  paymentStatus: string;
  paymentOrderId: string | null;
  submittedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  history?: { id: string; fromStatus: string | null; toStatus: string; note: string | null; createdAt: string }[];
  award?: Award | null;
}

export interface Envelope {
  id: string;
  agreementType: string;
  title: string;
  referenceType: 'AWARD' | 'AWARD_YEAR';
  referenceId: string;
  status: string;
  signerName: string;
  guardian: { name: string } | null;
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  expiresAt: string;
  signedDocumentId: string | null;
  unsignedDocumentId: string | null;
  templateVersion: number;
  provider: 'DOCUSIGN' | 'MOCK';
}
