import { convert, type Currency } from '@aci/contracts';

/** Money is always minor units (paise/cents) in the API. */
export function money(minor: number | bigint | null | undefined, currency: Currency | string = 'INR', opts: { compact?: boolean; decimals?: boolean } = {}): string {
  const v = Number(minor ?? 0) / 100;
  const cur = (currency as Currency) ?? 'INR';
  return new Intl.NumberFormat(cur === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency: cur,
    notation: opts.compact ? 'compact' : 'standard',
    maximumFractionDigits: opts.compact ? 2 : opts.decimals ? 2 : v % 1 === 0 ? 0 : 2,
  }).format(v);
}

/** Shows an amount in its native currency plus the other one, e.g. "₹37,500 · $451". */
export function moneyBoth(minor: number, currency: Currency | string, usdInrRate4: number, opts: { compact?: boolean } = {}) {
  const cur = currency as Currency;
  const other: Currency = cur === 'INR' ? 'USD' : 'INR';
  return { primary: money(minor, cur, opts), secondary: money(convert(minor, cur, other, usdInrRate4), other, opts), inr: convert(minor, cur, 'INR', usdInrRate4), usd: convert(minor, cur, 'USD', usdInrRate4) };
}

export function date(d: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', ...opts });
}

export function dateTime(d: string | Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function relative(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const diff = (new Date(d).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return date(d);
}

export function daysUntil(d: string | Date): number {
  return Math.round((new Date(d).getTime() - Date.now()) / 86400_000);
}

export function initials(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join('');
}

export const pct = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;

/** Rupees/dollars (as typed in a form) → minor units. */
export const toMinorUnits = (v: string | number) => Math.round(Number(v || 0) * 100);
export const fromMinorUnits = (v: number | bigint | null | undefined) => Number(v ?? 0) / 100;
