import { randomInt } from 'node:crypto';

/** Human-friendly sequential-looking reference, e.g. APP-2026-7K3F9Q. Unambiguous alphabet (no 0/O/1/I). */
export function refNo(prefix: string, length = 6): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < length; i++) s += alphabet[randomInt(alphabet.length)];
  return `${prefix}-${new Date().getUTCFullYear()}-${s}`;
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

export function addYears(d: Date, years: number): Date {
  const r = new Date(d);
  r.setUTCFullYear(r.getUTCFullYear() + years);
  return r;
}

export function startOfUtcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Indian academic year label for a date: Jun 2026 -> "2026-27", Mar 2026 -> "2025-26". */
export function academicYearOf(d: Date, startMonth = 6): string {
  const y = d.getUTCFullYear();
  const start = d.getUTCMonth() + 1 >= startMonth ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** Indian financial year label: Apr 2026 -> "FY27" (Apr 2026 - Mar 2027). */
export function fiscalYearOf(d: Date): string {
  const y = d.getUTCFullYear();
  const fyEnd = d.getUTCMonth() + 1 >= 4 ? y + 1 : y;
  return `FY${String(fyEnd % 100).padStart(2, '0')}`;
}
