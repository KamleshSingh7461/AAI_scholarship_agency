#!/usr/bin/env node
// Creates demo data through the real API (stack must be running): IES University Bhopal with its
// MoU, 2025-26 transfer letter + valuation letter, and published programs demonstrating flat and % fees.
// Usage: npm run seed:demo
import { env, Session } from './api-client.mjs';

const admin = new Session('admin');
await admin.login(env.SEED_SUPER_ADMIN_PHONE, 'staff');
console.log(`✔ logged in as super admin ${env.SEED_SUPER_ADMIN_PHONE}`);

const unis = await admin.get('/api/v1/universities?q=IES');
let ies = unis.items.find((u) => u.name.startsWith('IES University'));
if (!ies) {
  ies = await admin.post('/api/v1/universities', {
    name: 'IES University, Bhopal',
    shortName: 'IES',
    city: 'Bhopal',
    state: 'Madhya Pradesh',
    country: 'India',
    website: 'https://www.iesuniversity.ac.in',
    description: 'Established vide Act No. 11 of 2019 (S.No. 36) of M.P. Govt. and recognised under section 2(f) of UGC Act 1956.',
    contactName: 'Registrar',
  });
  console.log('✔ university created: IES University, Bhopal');

  await admin.post(`/api/v1/universities/${ies.id}/agreements`, {
    type: 'ESTABLISHMENT',
    title: 'Agreement for the Establishment of Alumni Association',
    signedDate: '2025-03-11',
    effectiveDate: '2025-03-11',
    termYears: 5,
    autoRenew: true,
    renewalTermYears: 5,
    noticePeriodMonths: 12,
    universityRevenueShareBps: 8000,
    companyRevenueShareBps: 2000,
    agencyCommissionBps: 800,
    universityCommissionShareBps: 0,
    notes: 'Clause 4.1: donations/sponsorship 80% university / 20% EUSAIT. Disputes: arbitration in Delhi.',
  });
  const transfer = await admin.post(`/api/v1/universities/${ies.id}/agreements`, {
    type: 'SCHOLARSHIP_TRANSFER',
    title: 'Scholarship Rights to Alumni Association of India (2025-26)',
    signedDate: '2025-04-11',
    effectiveDate: '2025-04-11',
    notes: '50 athletic scholarships per academic year; 50% of tuition only; subject to university final approval.',
  });
  await admin.post(`/api/v1/universities/${ies.id}/agreements`, {
    type: 'VALUATION',
    title: 'Valuation of Athletic Scholarships Granted to AAI (2025-26)',
    effectiveDate: '2025-04-11',
    notes: 'Half-fee scholarship: 50% of tuition = Rs 37,500 per year. Other charges (exam, books, uniform) paid by the association / student.',
  });
  for (const year of ['2025-26', '2026-27']) {
    await admin.post(`/api/v1/universities/${ies.id}/allocations`, {
      agreementId: transfer.id,
      academicYear: year,
      totalSeats: 50,
      // The transfer letter says unused seats are forfeited; the valuation letter says rolled over. Confirm with IES.
      rolloverPolicy: 'FORFEIT',
      valuationPerSeatAnnual: 3_750_000,
      valuationCurrency: 'INR',
    });
  }
  console.log('✔ MoU, transfer letter, valuation letter and 2 annual allocations (50 seats each) recorded');
}

const detail = await admin.get(`/api/v1/universities/${ies.id}`);
const alloc = detail.allocations.find((a) => a.academicYear === '2026-27');
if (!detail.programs.length) {
  const base = {
    universityId: ies.id,
    allocationId: alloc.id,
    scholarshipType: 'ATHLETIC',
    coverageType: 'PARTIAL',
    academicYear: '2026-27',
    currency: 'INR',
    tuitionFullPerYear: 7_500_000, // Rs 75,000
    tuitionCoverageBps: 5000, // 50% of tuition
    roomPerYear: 0,
    foodPerYear: 0,
    otherPerYear: 0,
    otherBorneBy: 'STUDENT',
    otherCostsNote: 'Hostel, books, uniforms, activity and exam fees are paid by the student / association.',
    eligibleSports: ['Athletics', 'Football', 'Cricket', 'Kabaddi', 'Badminton', 'Wrestling', 'Hockey', 'Volleyball'],
    minAge: 16,
    maxAge: 25,
    eligibilityCriteria: 'State or national level representation, or district-level medal. Must meet IES admission criteria.',
    courses: ['B.Tech', 'BBA', 'B.Com', 'B.Sc', 'BPES'],
    applicationClosesAt: '2027-03-31T18:29:59.000Z',
    commissionBps: 800,
  };
  const p4 = await admin.post('/api/v1/programs', {
    ...base,
    name: 'Half-Fee Athletic Scholarship (4-Year)',
    description: '50% tuition waiver for the full 4-year undergraduate programme at IES University, Bhopal.',
    durationYears: 4,
    seatsTotal: 30,
    feeType: 'FLAT',
    feeFlatInr: 99_900, // Rs 999
    taxBps: 1800,
    feeRefundableOnRejection: true,
  });
  const p3 = await admin.post('/api/v1/programs', {
    ...base,
    name: 'Half-Fee Athletic Scholarship (3-Year)',
    description: '50% tuition waiver for 3-year degree programmes.',
    durationYears: 3,
    seatsTotal: 20,
    feeType: 'PERCENTAGE',
    feePercentBps: 100, // 1% of total scholarship value
    feePercentBase: 'TOTAL_VALUE',
    feeMinInr: 50_000,
    feeMaxInr: 500_000,
    taxBps: 1800,
  });
  await admin.post(`/api/v1/programs/${p4.id}/publish`);
  await admin.post(`/api/v1/programs/${p3.id}/publish`);
  console.log(`✔ programs published: ${p4.code} (flat fee) and ${p3.code} (1% fee)`);
}

const demoUni = (await admin.get('/api/v1/universities?q=Demo')).items[0] ??
  (await admin.post('/api/v1/universities', { name: 'Demo International University', shortName: 'DIU', city: 'Pune', state: 'Maharashtra', description: 'Fictional university used for demos (USD-valued programme).' }));
const demoPrograms = await admin.get(`/api/v1/programs?universityId=${demoUni.id}`);
if (!demoPrograms.items.length) {
  const p = await admin.post('/api/v1/programs', {
    universityId: demoUni.id,
    name: 'Global Athletics Scholarship (4-Year, USD)',
    description: "Mirrors management's worked example: $2,000 tuition + $250 food + $200 room per year × 4 = $9,800.",
    scholarshipType: 'ATHLETIC',
    coverageType: 'FULL',
    durationYears: 4,
    academicYear: '2026-27',
    currency: 'USD',
    tuitionFullPerYear: 200_000,
    tuitionCoverageBps: 10000,
    foodPerYear: 25_000,
    roomPerYear: 20_000,
    tuitionBorneBy: 'UNIVERSITY',
    foodBorneBy: 'COMPANY',
    roomBorneBy: 'COMPANY',
    eligibleSports: [],
    seatsTotal: 10,
    feeType: 'FLAT',
    feeFlatInr: 199_900,
    taxBps: 1800,
  });
  await admin.post(`/api/v1/programs/${p.id}/publish`);
  console.log(`✔ USD demo program published: ${p.code}`);
}
console.log('\nDemo data ready. Public catalog: GET /api/v1/catalog/programs');
