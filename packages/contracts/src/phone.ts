/**
 * Normalises Indian and international numbers to E.164. Bare 10-digit numbers are treated as Indian (+91).
 * Returns null when the number is not plausibly valid.
 */
export function normalizePhone(input: string, defaultCountryCode = '91'): string | null {
  if (!input) return null;
  let digits = input.replace(/[^\d+]/g, '');
  if (digits.startsWith('00')) digits = '+' + digits.slice(2);
  if (!digits.startsWith('+')) {
    digits = digits.replace(/^0+/, '');
    if (digits.length === 10) digits = `+${defaultCountryCode}${digits}`;
    else digits = '+' + digits;
  }
  const body = digits.slice(1);
  if (!/^\d{8,15}$/.test(body)) return null;
  if (body.startsWith('91') && !/^91[6-9]\d{9}$/.test(body)) return null;
  return '+' + body;
}

export function maskPhone(e164: string): string {
  if (e164.length < 6) return e164;
  return e164.slice(0, 3) + ' ' + '•'.repeat(Math.max(0, e164.length - 7)) + e164.slice(-4);
}
