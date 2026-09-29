import { FeePercentBase, FeeType, type Currency } from './enums';
import { applyBps, convert, type Minor } from './money';

export interface FeeConfig {
  feeType: FeeType;
  /** Flat fee in INR paise (fees are always collected in INR). */
  feeFlatInr: Minor;
  /** Percentage in basis points, e.g. 500 = 5%. */
  feePercentBps: number;
  feePercentBase: FeePercentBase;
  /** Optional caps for percentage fees, INR paise. 0 = no cap. */
  feeMinInr: Minor;
  feeMaxInr: Minor;
  /** GST / tax in basis points, applied on top of the fee. 1800 = 18%. */
  taxBps: number;
}

export interface FeeQuote {
  baseInr: Minor;
  taxInr: Minor;
  totalInr: Minor;
  /** Human-readable explanation, shown to the athlete before paying. */
  explanation: string;
}

/**
 * Single source of truth for the application fee. Used by the application service
 * (authoritative) and by the frontends (preview only).
 */
export function quoteFee(
  cfg: FeeConfig,
  scholarship: { annualValue: Minor; totalValue: Minor; currency: Currency },
  usdInrRate4: number,
): FeeQuote {
  let base = 0;
  let explanation = 'No application fee';
  if (cfg.feeType === FeeType.FLAT) {
    base = cfg.feeFlatInr;
    explanation = 'Flat application fee';
  } else if (cfg.feeType === FeeType.PERCENTAGE) {
    const valueNative = cfg.feePercentBase === FeePercentBase.ANNUAL_VALUE ? scholarship.annualValue : scholarship.totalValue;
    const valueInr = convert(valueNative, scholarship.currency, 'INR', usdInrRate4);
    base = applyBps(valueInr, cfg.feePercentBps);
    if (cfg.feeMinInr > 0) base = Math.max(base, cfg.feeMinInr);
    if (cfg.feeMaxInr > 0) base = Math.min(base, cfg.feeMaxInr);
    const pct = (cfg.feePercentBps / 100).toFixed(2).replace(/\.00$/, '');
    explanation = `${pct}% of the ${cfg.feePercentBase === FeePercentBase.ANNUAL_VALUE ? 'annual' : 'total'} scholarship value`;
  }
  const tax = applyBps(base, cfg.taxBps);
  return { baseInr: base, taxInr: tax, totalInr: base + tax, explanation };
}
