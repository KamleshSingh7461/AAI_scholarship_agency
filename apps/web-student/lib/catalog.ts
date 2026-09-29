export interface CatalogProgram {
  id: string;
  slug: string;
  code: string;
  name: string;
  description: string | null;
  durationYears: number;
  academicYear: string;
  applicationClosesAt: string | null;
  eligibleSports: string[];
  eligibilityCriteria: string | null;
  minAge: number | null;
  maxAge: number | null;
  genderEligibility: string;
  courses: string[];
  otherCostsNote: string | null;
  tuitionCoverageBps: number;
  benefitsInr: { annualValue: number; totalValue: number; tuitionPerYear: number; roomPerYear: number; foodPerYear: number; otherPerYear: number };
  bearers: { tuition: string; room: string; food: string; other: string };
  fee: { baseInr: number; taxInr: number; totalInr: number; explanation: string };
  feeRefundableOnRejection: boolean;
  seatsLeft: number;
  seatsTotal: number;
  isOpen: boolean;
  university: { id: string; name: string; city: string | null; state: string | null } | null;
}
