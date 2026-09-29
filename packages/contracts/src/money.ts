import type { Currency } from './enums';

/**
 * All money is stored as integer minor units (paise for INR, cents for USD).
 * Never use floats for money arithmetic.
 */
export type Minor = number;

export function toMinor(major: number | string): Minor {
  const n = typeof major === 'string' ? Number(major) : major;
  if (!Number.isFinite(n)) throw new Error(`Invalid money amount: ${major}`);
  return Math.round(n * 100);
}

export function toMajor(minor: Minor | bigint): number {
  return Number(minor) / 100;
}

/** Percentage stored as basis points (1% = 100 bps) to keep it integral. */
export function applyBps(amount: Minor, bps: number): Minor {
  return Math.round((amount * bps) / 10000);
}

/**
 * Convert between INR and USD. `usdInrRate` is "1 USD = X INR", stored as rate * 10000 (4 decimal places) integer.
 */
export function convert(amount: Minor, from: Currency, to: Currency, usdInrRate4: number): Minor {
  if (from === to) return amount;
  if (from === 'USD' && to === 'INR') return Math.round((amount * usdInrRate4) / 10000);
  if (from === 'INR' && to === 'USD') return Math.round((amount * 10000) / usdInrRate4);
  throw new Error(`Unsupported conversion ${from}->${to}`);
}

export function formatMoney(minor: Minor | bigint, currency: Currency, opts: { compact?: boolean } = {}): string {
  const major = toMajor(minor);
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: opts.compact ? 1 : major % 1 === 0 ? 0 : 2,
    notation: opts.compact ? 'compact' : 'standard',
  }).format(major);
}

/** Annual value of a scholarship and its multi-year total. */
export interface ScholarshipValue {
  tuitionPerYear: Minor;
  roomPerYear: Minor;
  foodPerYear: Minor;
  otherPerYear: Minor;
  durationYears: number;
}

export function annualValue(v: ScholarshipValue): Minor {
  return v.tuitionPerYear + v.roomPerYear + v.foodPerYear + v.otherPerYear;
}

export function totalValue(v: ScholarshipValue): Minor {
  return annualValue(v) * v.durationYears;
}
