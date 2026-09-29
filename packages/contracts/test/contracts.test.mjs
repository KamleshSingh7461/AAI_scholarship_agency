// Unit tests for money-critical shared logic. Run: npm test -w @aci/contracts (after build).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const c = require('../dist/index.js');

const RATE = 830000; // 1 USD = 83.0000 INR

test('management worked example: $2,000 tuition + $250 food + $200 room × 4 = $9,800', () => {
  const v = { tuitionPerYear: 200_000, foodPerYear: 25_000, roomPerYear: 20_000, otherPerYear: 0, durationYears: 4 };
  assert.equal(c.annualValue(v), 245_000);
  assert.equal(c.totalValue(v), 980_000);
});

test('IES valuation: 50% of ₹75,000 tuition = ₹37,500 per year', () => {
  assert.equal(c.applyBps(7_500_000, 5000), 3_750_000);
});

test('currency conversion both ways', () => {
  assert.equal(c.convert(980_000, 'USD', 'INR', RATE), 81_340_000); // $9,800 → ₹8,13,400
  assert.equal(c.convert(81_340_000, 'INR', 'USD', RATE), 980_000);
  assert.equal(c.convert(12_345, 'INR', 'INR', RATE), 12_345);
});

test('flat fee + 18% GST', () => {
  const q = c.quoteFee(
    { feeType: 'FLAT', feeFlatInr: 99_900, feePercentBps: 0, feePercentBase: 'TOTAL_VALUE', feeMinInr: 0, feeMaxInr: 0, taxBps: 1800 },
    { annualValue: 3_750_000, totalValue: 15_000_000, currency: 'INR' },
    RATE,
  );
  assert.deepEqual([q.baseInr, q.taxInr, q.totalInr], [99_900, 17_982, 117_882]);
});

test('percentage fee on total value, with min/max caps', () => {
  const cfg = { feeType: 'PERCENTAGE', feeFlatInr: 0, feePercentBps: 100, feePercentBase: 'TOTAL_VALUE', feeMinInr: 50_000, feeMaxInr: 500_000, taxBps: 0 };
  // 1% of ₹1,12,500 (3 × 37,500) = ₹1,125
  assert.equal(c.quoteFee(cfg, { annualValue: 3_750_000, totalValue: 11_250_000, currency: 'INR' }, RATE).baseInr, 112_500);
  // below minimum → ₹500
  assert.equal(c.quoteFee(cfg, { annualValue: 100_000, totalValue: 300_000, currency: 'INR' }, RATE).baseInr, 50_000);
  // above maximum → ₹5,000
  assert.equal(c.quoteFee(cfg, { annualValue: 100_000_000, totalValue: 400_000_000, currency: 'INR' }, RATE).baseInr, 500_000);
});

test('percentage fee on a USD program is charged in INR', () => {
  const cfg = { feeType: 'PERCENTAGE', feeFlatInr: 0, feePercentBps: 100, feePercentBase: 'ANNUAL_VALUE', feeMinInr: 0, feeMaxInr: 0, taxBps: 0 };
  // 1% of $2,450 = $24.50 = ₹2,033.50
  assert.equal(c.quoteFee(cfg, { annualValue: 245_000, totalValue: 980_000, currency: 'USD' }, RATE).baseInr, 203_350);
});

test('no fee', () => {
  const q = c.quoteFee({ feeType: 'NONE', feeFlatInr: 0, feePercentBps: 0, feePercentBase: 'TOTAL_VALUE', feeMinInr: 0, feeMaxInr: 0, taxBps: 1800 }, { annualValue: 1, totalValue: 1, currency: 'INR' }, RATE);
  assert.equal(q.totalInr, 0);
});

test('phone normalisation', () => {
  assert.equal(c.normalizePhone('98765 43210'), '+919876543210');
  assert.equal(c.normalizePhone('+91-98765-43210'), '+919876543210');
  assert.equal(c.normalizePhone('09876543210'), '+919876543210');
  assert.equal(c.normalizePhone('0091 9876543210'), '+919876543210');
  assert.equal(c.normalizePhone('+1 415 555 0100'), '+14155550100');
  assert.equal(c.normalizePhone('12345'), null);
  assert.equal(c.normalizePhone('+91 1234567890'), null); // Indian mobiles start 6-9
});

test('application state machine: awards only via signatures, terminal states are final', () => {
  const t = c.APPLICATION_TRANSITIONS;
  assert.ok(t.PAYMENT_PENDING.includes('SUBMITTED'));
  assert.ok(!t.SUBMITTED.includes('AWARDED'));
  assert.ok(!t.FORWARDED_TO_UNIVERSITY.includes('AWARDED'));
  assert.deepEqual(t.AGREEMENTS_PENDING.sort(), ['AWARDED', 'EXPIRED', 'WITHDRAWN'].sort());
  for (const s of ['AWARDED', 'REJECTED', 'UNIVERSITY_REJECTED', 'WITHDRAWN', 'EXPIRED']) assert.equal(t[s].length, 0);
});
