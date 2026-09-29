export type Tone = 'gray' | 'green' | 'amber' | 'red' | 'blue' | 'violet';

const MAP: Record<string, [string, Tone]> = {
  // application
  DRAFT: ['Draft', 'gray'],
  PAYMENT_PENDING: ['Payment pending', 'amber'],
  SUBMITTED: ['Submitted', 'blue'],
  UNDER_REVIEW: ['Under review', 'blue'],
  FORWARDED_TO_UNIVERSITY: ['With university', 'violet'],
  UNIVERSITY_APPROVED: ['University approved', 'green'],
  AGREEMENTS_PENDING: ['Awaiting signatures', 'amber'],
  AWARDED: ['Awarded', 'green'],
  REJECTED: ['Not approved', 'red'],
  UNIVERSITY_REJECTED: ['Rejected by university', 'red'],
  WITHDRAWN: ['Withdrawn', 'gray'],
  EXPIRED: ['Expired', 'gray'],
  // award
  PENDING_SIGNATURE: ['Pending signature', 'amber'],
  ACTIVE: ['Active', 'green'],
  RENEWAL_DUE: ['Renewal due', 'amber'],
  SUSPENDED: ['Suspended', 'red'],
  COMPLETED: ['Completed', 'violet'],
  REVOKED: ['Revoked', 'red'],
  // award years
  UPCOMING: ['Upcoming', 'gray'],
  DUE: ['Due soon', 'amber'],
  OVERDUE: ['Overdue', 'red'],
  RENEWED: ['Renewed', 'green'],
  CANCELLED: ['Cancelled', 'gray'],
  // envelopes
  CREATED: ['Created', 'gray'],
  SENT: ['Pending', 'amber'],
  VIEWED: ['Viewed', 'blue'],
  SIGNED: ['Signed', 'green'],
  DECLINED: ['Declined', 'red'],
  VOIDED: ['Voided', 'gray'],
  // payments
  PENDING: ['Pending', 'amber'],
  PAID: ['Paid', 'green'],
  FAILED: ['Failed', 'red'],
  REFUNDED: ['Refunded', 'violet'],
  PARTIALLY_REFUNDED: ['Partly refunded', 'violet'],
  NOT_REQUIRED: ['No fee', 'gray'],
  REFUND_REQUESTED: ['Refund requested', 'violet'],
  // profile / docs
  VERIFIED: ['Verified', 'green'],
  CHANGES_REQUESTED: ['Changes requested', 'amber'],
  // programs
  PUBLISHED: ['Published', 'green'],
  CLOSED: ['Closed', 'gray'],
  ARCHIVED: ['Archived', 'gray'],
  OPEN: ['Open', 'green'],
  // confirmation
  CONFIRMED: ['Confirmed', 'green'],
  DISPUTED: ['Disputed', 'red'],
  SCHEDULED: ['Scheduled', 'gray'],
  RECOGNIZED: ['Recognised', 'green'],
  READY: ['Ready', 'green'],
  QUEUED: ['Queued', 'gray'],
  SENDING: ['Sending', 'blue'],
  INACTIVE: ['Inactive', 'gray'],
  DISABLED: ['Disabled', 'red'],
};

export function statusLabel(s: string | null | undefined): string {
  if (!s) return '—';
  return MAP[s]?.[0] ?? s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function statusTone(s: string | null | undefined): Tone {
  return (s && MAP[s]?.[1]) || 'gray';
}

export const AGREEMENT_LABEL: Record<string, string> = {
  SCHOLARSHIP_AWARD: 'Scholarship Award Agreement',
  AGENCY: 'Agency Agreement',
  SCHOLARSHIP_RENEWAL: 'Scholarship Agreement (Renewal)',
  AGENCY_RENEWAL: 'Agency Agreement (Renewal)',
};

export const DOC_LABEL: Record<string, string> = {
  PROFILE_PHOTO: 'Profile photo (passport size)',
  GOVT_ID: 'Government ID (Aadhaar / Passport / PAN)',
  DOB_PROOF: 'Date of birth proof',
  ADDRESS_PROOF: 'Address proof',
  SPORTS_ID: 'Sports ID / Federation card',
  PERFORMANCE_CERTIFICATE: 'Performance / achievement certificates',
  COACH_RECOMMENDATION: 'Coach recommendation letter',
  MEDICAL_FITNESS: 'Medical fitness certificate',
  INJURY_RECORDS: 'Injury / medical records',
  PLAYER_CONTRACT: 'Player contract (club / academy)',
  MARKSHEET_10: 'High school marksheet (10th)',
  MARKSHEET_12: 'Intermediate marksheet (12th)',
  GRADUATION_CERTIFICATE: 'Graduation certificate / bonafide',
  STUDENT_ID_CARD: 'Student ID card',
  MEDICAL_CLEARANCE: 'Medical clearance',
  COACH_CERTIFICATION: 'Coach certification',
  GUARDIAN_ID: 'Parent / guardian ID',
};
