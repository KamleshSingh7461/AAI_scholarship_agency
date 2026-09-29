#!/usr/bin/env node
// End-to-end smoke test of the complete scholarship flow against a running local stack
// (mock payment + mock e-sign providers, AUTH_DEV_ECHO_OTP=true). Run `npm run seed:demo` first.
// Usage: npm run e2e
import { API, env, Session, TINY_PDF, TINY_PNG, waitFor } from './api-client.mjs';

let step = 0;
const ok = (msg) => console.log(`  \x1b[32m✔\x1b[0m ${String(++step).padStart(2)} ${msg}`);
const assert = (cond, msg) => {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
};

console.log(`E2E against ${API}\n`);
const phone = `+9198${String(Date.now()).slice(-8)}`;
const athlete = new Session('athlete');
const admin = new Session('admin');

// ---------------------------------------------------------------- athlete signs up
const login = await athlete.login(phone, 'student', 'WHATSAPP');
assert(login.isNewUser && login.user.role === 'ATHLETE', 'new athlete user');
ok(`athlete ${phone} registered via WhatsApp OTP`);

const denied = await athlete.req('GET', '/api/v1/finance/summary', undefined, { expect: [403] });
assert(denied.statusCode === 403, 'athlete cannot read finance');
ok('role guard blocks athlete from finance API');

const photo = await athlete.upload({ fileName: 'photo.png', mimeType: 'image/png', bytes: TINY_PNG, subType: 'PROFILE_PHOTO' });
const docs = {};
for (const t of ['GOVT_ID', 'DOB_PROOF', 'ADDRESS_PROOF', 'MARKSHEET_10']) {
  docs[t] = await athlete.upload({ fileName: `${t.toLowerCase()}.pdf`, mimeType: 'application/pdf', bytes: TINY_PDF, subType: t });
}
ok('uploaded photo + 4 documents via presigned S3 POST (magic-number verified)');

const first = 'Aarav';
const last = `Tester${Date.now().toString().slice(-4)}`;
await athlete.put('/api/v1/athletes/me/personal', {
  firstName: first,
  lastName: last,
  dateOfBirth: '2005-06-15',
  gender: 'MALE',
  nationality: 'Indian',
  profilePhotoDocumentId: photo,
  email: `aarav.${Date.now()}@example.com`,
  addressLine: '12 Stadium Road',
  city: 'Bhopal',
  state: 'Madhya Pradesh',
  zipCode: '462044',
});
await athlete.put('/api/v1/athletes/me/academic', {
  records: [
    { level: 'HIGH_SCHOOL', institutionName: 'Govt HSS Bhopal', boardOrUniversity: 'MP Board', yearOfPassing: 2021, scoreType: 'PERCENTAGE', scoreValue: '82', certificateDocumentId: docs.MARKSHEET_10 },
    { level: 'INTERMEDIATE', institutionName: 'Govt HSS Bhopal', boardOrUniversity: 'MP Board', stream: 'Science', yearOfPassing: 2023, scoreType: 'PERCENTAGE', scoreValue: '76' },
  ],
});
await athlete.put('/api/v1/athletes/me/sports', {
  primarySport: 'Athletics',
  currentClub: 'Bhopal Athletics Academy',
  coachName: 'R. Sharma',
  yearsOfTraining: 6,
  heightCm: 178,
  weightKg: 68,
  fitnessLevel: 'ELITE',
  rankingLevel: 'STATE',
  rankingValue: '3',
  ageGroup: 'SENIOR',
  bestPerformance: '400m — 49.8s',
  medalsGold: 2,
  medalsSilver: 1,
  previousInjuries: false,
});
await athlete.put('/api/v1/athletes/me/documents', {
  documents: [
    { type: 'PROFILE_PHOTO', documentId: photo },
    { type: 'GOVT_ID', documentId: docs.GOVT_ID },
    { type: 'DOB_PROOF', documentId: docs.DOB_PROOF },
    { type: 'ADDRESS_PROOF', documentId: docs.ADDRESS_PROOF },
    { type: 'MARKSHEET_10', documentId: docs.MARKSHEET_10 },
  ],
});
await athlete.put('/api/v1/athletes/me/references', {
  references: [{ position: 1, name: 'R. Sharma', designation: 'COACH', organization: 'Bhopal Athletics Academy', relationship: 'Coach for 6 years', phone: '+919812300000' }],
});
const submitted = await athlete.post('/api/v1/athletes/me/submit');
assert(submitted.profile.status === 'SUBMITTED', 'profile submitted');
ok(`4-step profile completed and submitted (${submitted.profile.athleteCode})`);

// ---------------------------------------------------------------- staff verifies
await admin.login(env.SEED_SUPER_ADMIN_PHONE, 'staff');
const prof = await admin.get(`/api/v1/athletes/${submitted.profile.id}`);
for (const d of prof.profile.documents) {
  await admin.patch(`/api/v1/athletes/${prof.profile.id}/documents/${d.id}`, { verificationStatus: 'VERIFIED' });
}
await admin.post(`/api/v1/athletes/${prof.profile.id}/review`, { decision: 'VERIFIED', remarks: 'Documents verified' });
ok('staff verified every document and the profile');

// ---------------------------------------------------------------- apply + pay
const catalog = await athlete.get('/api/v1/catalog/programs?sport=Athletics');
const program = catalog.items.find((p) => p.fee.totalInr > 0 && p.isOpen && p.benefitsInr.totalValue > 0);
assert(program, 'an open paid program exists (run npm run seed:demo)');
ok(`catalog: ${catalog.total} program(s); applying to "${program.name}" — fee ₹${program.fee.totalInr / 100}`);

const app = await athlete.post('/api/v1/applications/mine', { programId: program.id, statement: 'State-level 400m runner.' });
assert(app.status === 'PAYMENT_PENDING', `expected PAYMENT_PENDING, got ${app.status}`);
const dup = await athlete.req('POST', '/api/v1/applications/mine', { programId: program.id }, { expect: [409] });
assert(dup.code === 'DUPLICATE_APPLICATION', 'duplicate blocked');
ok(`application ${app.applicationNo} created (duplicate application correctly rejected)`);

const order = await athlete.post(`/api/v1/applications/mine/${app.id}/pay`);
assert(order.checkout?.type === 'mock', 'mock checkout');
const again = await athlete.post(`/api/v1/applications/mine/${app.id}/pay`);
assert(again.orderId === order.orderId, 'payment order reused (idempotent)');
const done = await fetch(`${API}/api/v1/payments/mock/${order.orderId}/complete`, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: 'outcome=success',
  redirect: 'manual',
});
assert(done.status === 303, 'mock checkout redirect');
const paid = await waitFor('application submitted after payment event', async () => {
  const a = await athlete.get(`/api/v1/applications/mine/${app.id}`);
  return a.status === 'SUBMITTED' ? a : null;
});
assert(paid.paymentStatus === 'PAID', 'payment status PAID');
ok(`paid ${order.orderNo} → payment.succeeded event → application SUBMITTED`);

// ---------------------------------------------------------------- review → university approval → agreements
await admin.post(`/api/v1/applications/${app.id}/review`, { note: 'Strong state-level record' });
await admin.post(`/api/v1/applications/${app.id}/forward`, { note: 'Forwarded to IES' });
const approved = await admin.post(`/api/v1/applications/${app.id}/university-decision`, { decision: 'APPROVED', note: 'Approved by Board of Members' });
assert(approved.status === 'AGREEMENTS_PENDING' && approved.award?.status === 'PENDING_SIGNATURE', 'award offered');
ok(`reviewed → forwarded → university approved → award ${approved.award.awardNo} offered, seat reserved`);

const envelopes = await waitFor('two envelopes', async () => {
  const e = await athlete.get('/api/v1/esign/envelopes/mine');
  return e.filter((x) => x.status === 'SENT').length >= 2 ? e : null;
});
for (const e of envelopes.filter((x) => x.status === 'SENT')) {
  await athlete.post(`/api/v1/esign/envelopes/mine/${e.id}/session`, {});
  const signed = await athlete.post(`/api/v1/esign/envelopes/mine/${e.id}/sign`, { typedName: `${first} ${last}`, agree: true });
  assert(signed.status === 'SIGNED' && signed.signedDocumentId, 'envelope signed');
}
ok('athlete signed Scholarship Award Agreement + Agency Agreement (signed PDFs stored)');

const award = await waitFor('award ACTIVE', async () => {
  const a = await athlete.get('/api/v1/awards/mine');
  return a[0]?.status === 'ACTIVE' ? a[0] : null;
});
assert(award.years.length === program.durationYears, 'award years created');
const finalApp = await athlete.get(`/api/v1/applications/mine/${app.id}`);
assert(finalApp.status === 'AWARDED', 'application AWARDED');
ok(`award ACTIVE, grant date ${award.grantDate.slice(0, 10)}, ${award.years.length} yearly periods, application AWARDED`);

// ---------------------------------------------------------------- finance booked the value
const fin = await waitFor('finance booking', async () => {
  const l = await admin.get(`/api/v1/finance/awards/${award.id}`);
  return l.award && l.journals.some((j) => j.type === 'SCHOLARSHIP_GRANT') ? l : null;
});
const grant = fin.journals.find((j) => j.type === 'SCHOLARSHIP_GRANT');
assert(Number(grant.amount) === Number(award.totalValue), 'full value booked at grant');
assert(fin.schedule[0].status === 'RECOGNIZED' && fin.schedule.slice(1).every((s) => s.status === 'SCHEDULED'), 'year 1 recognised, rest scheduled');
ok(`finance: ₹${Number(grant.amountInr) / 100} revenue booked on grant; year 1 expensed; ${fin.schedule.length - 1} years scheduled`);

// ---------------------------------------------------------------- yearly renewal
if (award.years.length > 1) {
  const y2 = award.years[1];
  const asOf = new Date(new Date(y2.dueDate).getTime() - 20 * 86400_000).toISOString();
  const run1 = await admin.post(`/api/v1/awards/lifecycle/run?asOf=${encodeURIComponent(asOf)}`);
  assert(run1.renewalsDue >= 1, 'renewal became due');
  const renewals = await athlete.get('/api/v1/renewals/mine');
  const due = renewals.find((r) => r.id === y2.id);
  assert(due.status === 'DUE', 'year 2 DUE');
  await athlete.post(`/api/v1/renewals/${y2.id}/registration`, { enrollmentConfirmed: true, policyAcknowledged: true, currentCourse: 'B.Tech', currentSemester: '3', academicScore: '7.8 CGPA' });
  const renewalEnvs = await waitFor('renewal envelopes', async () => {
    const e = await athlete.get('/api/v1/esign/envelopes/mine');
    const r = e.filter((x) => x.referenceId === y2.id && x.status === 'SENT');
    return r.length >= 2 ? r : null;
  });
  for (const e of renewalEnvs) await athlete.post(`/api/v1/esign/envelopes/mine/${e.id}/sign`, { typedName: `${first} ${last}`, agree: true });
  await waitFor('year 2 renewed', async () => {
    const r = await athlete.get('/api/v1/renewals/mine');
    return r.find((x) => x.id === y2.id)?.status === 'RENEWED';
  });
  await waitFor('finance year 2 recognised', async () => {
    const l = await admin.get(`/api/v1/finance/awards/${award.id}`);
    return l.schedule.find((s) => s.yearNumber === 2)?.status === 'RECOGNIZED';
  });
  ok('year 2: due reminder → registration → both renewal agreements signed → RENEWED → expense recognised');
}

// ---------------------------------------------------------------- dashboards & reports
const dash = await admin.get('/api/v1/awards/dashboard?period=year');
assert(dash.totals.awarded >= 1, 'dashboard counts award');
const summary = await admin.get('/api/v1/finance/summary');
assert(summary.totals.counted.inr > 0, 'money & value');
ok(`dashboards: ${dash.totals.awarded} awarded, ₹${(dash.totals.scholarshipValueInr / 100).toLocaleString('en-IN')} total value / $${(dash.totals.scholarshipValueUsd / 100).toLocaleString('en-US')}`);

const report = await admin.post('/api/v1/reports/generate', { type: 'SCHOLARSHIP_LIST', format: 'xlsx', filters: {} });
assert(report.status === 'READY' && report.rowCount >= 1, `report ready (${report.error ?? ''})`);
const dl = await admin.get(`/api/v1/reports/${report.id}/download`);
const file = await fetch(dl.url);
assert(file.ok, 'report downloadable');
ok(`report ${report.fileName} generated (${report.rowCount} rows) and downloadable`);

const tb = await admin.get('/api/v1/finance/trial-balance');
// Entries balance exactly in their own currency; INR equivalents of USD lines can differ by rounding.
assert(Math.abs(tb.totals.debitInr - tb.totals.creditInr) <= tb.rows.length * 2, 'ledger balances');
ok(`trial balance balances: Dr ₹${tb.totals.debitInr / 100} = Cr ₹${tb.totals.creditInr / 100}`);

console.log(`\n\x1b[32mAll ${step} checks passed.\x1b[0m`);
