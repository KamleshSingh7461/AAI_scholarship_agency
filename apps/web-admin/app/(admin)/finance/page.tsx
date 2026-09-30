'use client';
import clsx from 'clsx';
import { useState } from 'react';
import { useApi } from '@aci/web-shared/hooks';
import { Card, PageHeader, PageLoader, Select, Stat, Table, Td, Th } from '@aci/web-shared/ui';
import { MoneyPair, useDisplayCurrency } from '@/components/money';

type M = { inr: number; usd: number };
interface Summary {
  fiscalYear: string;
  fx: { rate4: number; effectiveDate: string | null; source: string };
  totals: { counted: M; paidOutFy: M; paidOutToDate: M; stillToPay: M; cashDisbursed: M; cashDisbursedFy: M; applicationFeesCollected: M; activeStudents: number; awards: number };
  fySchedule: { fiscalYear: string; amount: M; recognized: M; studentsOnScholarship: number }[];
  byType: { durationYears: number; count: number; counted: M; paidOut: M; stillToPay: M }[];
  commission: { gross: M; companyNet: M; universityShare: M };
  confirmation: { confirmed: M; awaiting: M; disputed: M; confirmedPct: number };
  quarterly: { quarter: number; label: string; newScholarships: number; booked: M; confirmed: M; paidOut: M }[];
}

function fyOptions() {
  const now = new Date();
  const end = (now.getUTCMonth() >= 3 ? now.getUTCFullYear() + 1 : now.getUTCFullYear()) % 100;
  return [end - 2, end - 1, end, end + 1, end + 2].map((y) => `FY${String(y).padStart(2, '0')}`);
}

export default function FinancePage() {
  const [fy, setFy] = useState<string>('');
  const { display } = useDisplayCurrency();
  const { data } = useApi<Summary>('/finance/summary', { fy: fy || undefined });
  const [selected, setSelected] = useState<string | null>(null);
  if (!data) return <PageLoader />;
  const pick = (m: M) => (display === 'INR' ? m.inr : m.usd);
  const max = Math.max(1, ...data.fySchedule.map((r) => pick(r.amount)));
  const sel = data.fySchedule.find((r) => r.fiscalYear === (selected ?? data.fiscalYear));
  const totalAgreements = data.totals.awards;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scholarship Money & Value"
        breadcrumb="Home / Money & Value"
        subtitle="The moment a student signs, we count the FULL scholarship amount as money earned. We then pay it out (deliver it) to the university a bit at a time over the years of the scholarship."
        actions={
          <Select value={fy || data.fiscalYear} onChange={(e) => setFy(e.target.value)} className="w-32">
            {fyOptions().map((o) => <option key={o}>{o}</option>)}
          </Select>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Total counted so far" value={<MoneyPair value={data.totals.counted} compact />} sub="Every student, added up, the day each one signed" tone="green" />
        <Stat label={`Paid out — ${data.fiscalYear}`} value={<MoneyPair value={data.totals.paidOutFy} compact />} sub="Scholarship value delivered this financial year" />
        <Stat label="Still to be paid" value={<MoneyPair value={data.totals.stillToPay} compact />} sub="Owed in future years, not yet delivered" tone="amber" />
      </div>

      <Card title="A worked example" subtitle="A 4-year scholarship, counted as money earned in full the day the student signs">
        <p className="text-sm text-slate-700">
          Tuition <strong>$2,000/yr × 4</strong> + Food <strong>$250/yr × 4</strong> + Room <strong>$200/yr × 4</strong> = <strong className="text-accent-700">$9,800</strong> counted on the
          signing date. Each year that the student renews, that year’s $2,450 is recognised as expense (delivered). If the student stops renewing, the undelivered years are
          reversed.
        </p>
      </Card>

      <Card title="What gets paid out, year by year" subtitle="Across all students — click a year">
        {data.fySchedule.length === 0 ? (
          <p className="text-sm text-slate-500">No scholarships booked yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_260px]">
            <div className="flex h-56 items-end gap-3">
              {data.fySchedule.map((r) => (
                <button key={r.fiscalYear} className="group flex flex-1 flex-col items-center gap-2" onClick={() => setSelected(r.fiscalYear)}>
                  <span className="text-[11px] font-semibold text-slate-600"><MoneyPair value={r.amount} compact className="items-center text-[11px]" /></span>
                  <span
                    className={clsx('w-full rounded-t-lg transition', (selected ?? data.fiscalYear) === r.fiscalYear ? 'bg-brand-600' : 'bg-brand-200 group-hover:bg-brand-300')}
                    style={{ height: `${Math.max(4, (pick(r.amount) / max) * 150)}px` }}
                  />
                  <span className="text-xs font-semibold text-slate-700">{r.fiscalYear}</span>
                </button>
              ))}
            </div>
            {sel && (
              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase text-slate-500">Year</p>
                <p className="text-xl font-bold">{sel.fiscalYear}</p>
                <p className="mt-4 text-xs font-semibold uppercase text-slate-500">Paid out that year</p>
                <p className="text-xl font-bold"><MoneyPair value={sel.amount} /></p>
                <p className="mt-4 text-xs font-semibold uppercase text-slate-500">Students on scholarship</p>
                <p className="text-xl font-bold">{sel.studentsOnScholarship}</p>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card title="By scholarship type — how many, how much" padded={false}>
        <Table>
          <thead>
            <tr>
              <Th>Type</Th>
              <Th className="text-right">How many</Th>
              <Th className="text-right">$ counted (total)</Th>
              <Th className="text-right">$ paid out so far</Th>
              <Th className="text-right">$ still to pay</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.byType.map((t) => (
              <tr key={t.durationYears}>
                <Td className="font-semibold">{t.durationYears}-Year award</Td>
                <Td className="text-right">{t.count}</Td>
                <Td className="text-right"><MoneyPair value={t.counted} compact /></Td>
                <Td className="text-right"><MoneyPair value={t.paidOut} compact /></Td>
                <Td className="text-right"><MoneyPair value={t.stillToPay} compact /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Our agency commission" subtitle="Every signed Agency Agreement makes us the athlete's representative, earning a commission on the scholarship value, split with the university per its partnership agreement">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div><p className="text-xs font-semibold uppercase text-slate-500">Total commission</p><p className="text-lg font-bold"><MoneyPair value={data.commission.gross} compact /></p></div>
            <div><p className="text-xs font-semibold uppercase text-slate-500">Our share</p><p className="text-lg font-bold text-accent-700"><MoneyPair value={data.commission.companyNet} compact /></p></div>
            <div><p className="text-xs font-semibold uppercase text-slate-500">University share</p><p className="text-lg font-bold"><MoneyPair value={data.commission.universityShare} compact /></p></div>
          </div>
          <p className="mt-4 text-xs text-slate-500">Agency agreements signed: {totalAgreements}</p>
        </Card>
        <Card title="Audit — value confirmed by university" subtitle="Every amount we book should be backed by the university's own confirmation, not just our paperwork">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div><p className="text-xs font-semibold uppercase text-slate-500">Confirmed</p><p className="text-lg font-bold text-accent-700"><MoneyPair value={data.confirmation.confirmed} compact /></p></div>
            <div><p className="text-xs font-semibold uppercase text-slate-500">Awaiting</p><p className="text-lg font-bold text-amber-600"><MoneyPair value={data.confirmation.awaiting} compact /></p></div>
            <div><p className="text-xs font-semibold uppercase text-slate-500">% confirmed</p><p className="text-lg font-bold">{data.confirmation.confirmedPct}%</p></div>
          </div>
        </Card>
      </div>

      <Card title={`Quarterly audit summary — ${data.fiscalYear}`} subtitle="How many scholarships went out each quarter, and how that money was confirmed and delivered — for the auditors (Indian FY, April–March)" padded={false}>
        <Table>
          <thead>
            <tr>
              <Th>Quarter</Th>
              <Th className="text-right">New scholarships signed</Th>
              <Th className="text-right">$ booked (revenue)</Th>
              <Th className="text-right">$ confirmed by university</Th>
              <Th className="text-right">$ delivered</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.quarterly.map((q) => (
              <tr key={q.quarter}>
                <Td className="font-semibold">{q.label}</Td>
                <Td className="text-right">{q.newScholarships}</Td>
                <Td className="text-right"><MoneyPair value={q.booked} compact /></Td>
                <Td className="text-right">
                  <MoneyPair value={q.confirmed} compact />
                  {q.booked.inr > 0 && <span className="block text-[11px] text-slate-400">{Math.round((q.confirmed.inr / q.booked.inr) * 100)}%</span>}
                </Td>
                <Td className="text-right"><MoneyPair value={q.paidOut} compact /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Cash disbursed (all time)" value={<MoneyPair value={data.totals.cashDisbursed} compact />} sub="Company-funded benefits actually paid" />
        <Stat label="Application fees collected" value={<MoneyPair value={data.totals.applicationFeesCollected} compact />} sub="Net of refunds, incl. GST" />
        <Stat label="FX rate in use" value={`₹${(data.fx.rate4 / 10000).toFixed(2)} / $`} sub={data.fx.source === 'DEFAULT' ? 'Default — set the rate in Settings' : `Set ${data.fx.effectiveDate?.slice(0, 10)}`} />
      </div>
      <p className="flex items-start gap-2 text-xs text-slate-500">
        Each scholarship keeps the USD/INR rate from the day it was granted, so historical totals never change when the rate is updated. The revenue-recognition policy (book in
        full at grant vs. year by year) is configurable and should be confirmed with the statutory auditor.
      </p>
    </div>
  );
}
