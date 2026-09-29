/** Server-side fetch to the gateway (public, unauthenticated catalog endpoints). */
const API = process.env.API_GATEWAY_URL ?? 'http://localhost:8080';
export const STUDENT_APP_URL = process.env.NEXT_PUBLIC_STUDENT_APP_URL ?? 'http://localhost:3001';

export async function publicApi<T>(path: string, revalidate = 60): Promise<T | null> {
  try {
    const res = await fetch(`${API}/api/v1${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface CatalogProgram {
  id: string;
  slug: string;
  code: string;
  name: string;
  description: string | null;
  scholarshipType: string;
  coverageType: string;
  tuitionCoverageBps: number;
  durationYears: number;
  academicYear: string;
  intakeDate: string | null;
  applicationClosesAt: string | null;
  eligibleSports: string[];
  eligibilityCriteria: string | null;
  minAge: number | null;
  maxAge: number | null;
  genderEligibility: string;
  courses: string[];
  otherCostsNote: string | null;
  benefitsInr: { annualValue: number; totalValue: number; tuitionPerYear: number; roomPerYear: number; foodPerYear: number; otherPerYear: number };
  bearers: { tuition: string; room: string; food: string; other: string };
  fee: { baseInr: number; taxInr: number; totalInr: number; explanation: string };
  feeRefundableOnRejection: boolean;
  seatsLeft: number;
  seatsTotal: number;
  isOpen: boolean;
  university: { id: string; name: string; shortName: string | null; city: string | null; state: string | null; logoUrl: string | null; website: string | null } | null;
}

export interface CatalogStats {
  universities: number;
  openPrograms: number;
  seatsLeft: number;
  availableValueInr: number;
  sports: string[];
}

export const inr = (minor: number, compact = false) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: compact ? 1 : 0, notation: compact ? 'compact' : 'standard' }).format(minor / 100);
