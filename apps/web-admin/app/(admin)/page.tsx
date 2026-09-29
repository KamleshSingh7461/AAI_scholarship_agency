'use client';
import { useState } from 'react';
import { Activity } from 'lucide-react';
import { relative, statusLabel } from '@aci/web-shared';
import { useApi } from '@aci/web-shared/hooks';
import { Card, ErrorState, PageHeader, PageLoader, Stat, Table, Tabs, Td, Th } from '@aci/web-shared/ui';
import { MoneyPair } from '@/components/money';

interface Dashboard {
  totals: { students: number; universities: number; scholarshipValueInr: number; scholarshipValueUsd: number; byDuration: Record<string, number>; awarded: number };
  periodStats: { newAwards: number; agreementsSigned: number; renewalsCompleted: number; revenueBookedInr: number; revenueBookedUsd: number };
  statusCounts: Record<string, number>;
  confirmation: { confirmedInr: number; pendingInr: number };
  byUniversity: { name: string; students: number; valueInr: number; valueUsd: number }[];
  bySport: { name: string; students: number; valueInr: number; valueUsd: number }[];
  pipeline: Record<string, number>;
  recentActivity: { at: string; applicationNo: string; athleteName: string; universityName: string; sport: string | null; from: string | null; to: string; note: string | null }[];
}

interface Inventory {
  totals: Record<string, { total: number; awarded: number; reserved: number; left: number }>;
  totalLeft: number;
  totalAwarded: number;
  universities: { universityId: string; universityName: string; totalLeft: number; byDuration: Record<string, { left: number; total: number; awarded: number }> }[];
}

const PERIODS = [
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
  { value: 'all', label: 'All time' },
] as const;

export default function DashboardPage() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['value']>('year');
  const [breakdown, setBreakdown] = useState<'uni' | 'sport'>('uni');
  const { data, error, mutate } = useApi<Dashboard>('/awards/dashboard', { period });
  const { data: inv } = useApi<Inventory>('/universities/inventory');

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <PageLoader />;
  const durations = Object.keys(inv?.totals ?? data.totals.byDuration).sort((a, b) => Number(b) - Number(a));
  const rows = breakdown === 'uni' ? data.byUniversity : data.bySport;
  const maxVal = Math.max(1, ...rows.map((r) => r.valueInr));

  return (
    <div className="space-y-6">
      <PageHeader
        title="All Scholarships — Overview"
        breadcrumb="Home / Dashboard"
        actions={<Tabs tabs={PERIODS.map((p) => ({ value: p.value, label: p.label }))} value={period} onChange={setPeriod} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total students" value={data.totals.students.toLocaleString('en-IN')} sub={`Across ${data.totals.universities} partner universities`} />
        <Stat label="Total scholarship value" value={<MoneyPair value={{ inr: data.totals.scholarshipValueInr, usd: data.totals.scholarshipValueUsd }} compact />} sub="Lifetime booked revenue" />
        {durations.slice(0, 2).map((d) => (
          <Stat key={d} label={`${d}-year scholarships`} value={(data.totals.byDuration[d] ?? 0).toLocaleString('en-IN')} sub={`of ${data.totals.awarded} awarded so far`} />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={`New awards — ${PERIODS.find((p) => p.value === period)!.label.toLowerCase()}`} value={data.periodStats.newAwards} />
        <Stat label="Agreements signed" value={data.periodStats.agreementsSigned} />
        <Stat label="Renewals completed" value={data.periodStats.renewalsCompleted} />
        <Stat label="Revenue booked" value={<MoneyPair value={{ inr: data.periodStats.revenueBookedInr, usd: data.periodStats.revenueBookedUsd }} compact />} tone="green" />
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-200 ring-1 ring-slate-200 sm:grid-cols-5">
        {[
          ['ACTIVE', 'Active', 'bg-emerald-500'],
          ['PENDING_SIGNATURE', 'Pending signature', 'bg-amber-500'],
          ['RENEWALS_DUE', 'Renewals due', 'bg-violet-500'],
          ['SUSPENDED', 'Suspended', 'bg-red-500'],
          ['EXPIRED', 'Expired', 'bg-slate-400'],
        ].map(([k, label, dot]) => (
          <div key={k} className="bg-white p-4">
            <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span className={`size-2 rounded-full ${dot}`} /> {label}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{(data.statusCounts[k] ?? 0) + (k === 'ACTIVE' ? data.statusCounts.RENEWAL_DUE ?? 0 : 0)}</p>
          </div>
        ))}
      </div>

      <Card title="Scholarships still left to be awarded" subtitle="Out of our total commitment across partner universities, how many scholarships of each length are still available to give out" padded={false}>
        {inv ? (
          <>
            <div className="grid grid-cols-2 gap-4 border-b border-slate-100 p-5 sm:grid-cols-4">
              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-500">Total still left</p>
                <p className="text-2xl font-bold">{inv.totalLeft}</p>
              </div>
              {durations.slice(0, 2).map((d) => (
                <div key={d}>
                  <p className="text-[11px] font-semibold uppercase text-slate-500">{d}-year left</p>
                  <p className="text-2xl font-bold">{inv.totals[d]?.left ?? 0}</p>
                </div>
              ))}
              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-500">Already awarded</p>
                <p className="text-2xl font-bold text-accent-700">{inv.totalAwarded}</p>
              </div>
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>University</Th>
                  {durations.map((d) => (
                    <Th key={d} className="text-right">{d}-year left</Th>
                  ))}
                  <Th className="text-right">Total left</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inv.universities.map((u) => (
                  <tr key={u.universityId}>
                    <Td className="font-medium text-slate-900">{u.universityName}</Td>
                    {durations.map((d) => (
                      <Td key={d} className="text-right tabular-nums">{u.byDuration[d]?.left ?? 0}</Td>
                    ))}
                    <Td className="text-right font-semibold tabular-nums">{u.totalLeft}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        ) : (
          <PageLoader />
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card
          title="Scholarship value breakdown"
          actions={
            <Tabs
              tabs={[
                { value: 'uni' as const, label: 'By university' },
                { value: 'sport' as const, label: 'By sport' },
              ]}
              value={breakdown}
              onChange={setBreakdown}
            />
          }
        >
          {rows.length === 0 ? (
            <p className="text-sm text-slate-500">No awarded scholarships yet.</p>
          ) : (
            <ul className="space-y-4">
              {rows.map((r) => (
                <li key={r.name}>
                  <div className="flex items-baseline justify-between gap-4 text-sm">
                    <span className="font-medium text-slate-900">{r.name}</span>
                    <span className="text-right font-semibold">
                      <MoneyPair value={{ inr: r.valueInr, usd: r.valueUsd }} compact />
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${(r.valueInr / maxVal) * 100}%` }} />
                    </div>
                    <span className="w-20 text-right text-xs text-slate-500">{r.students} students</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Recent activity" padded={false}>
          <ul className="divide-y divide-slate-100">
            {data.recentActivity.length === 0 && <li className="p-5 text-sm text-slate-500">Nothing yet.</li>}
            {data.recentActivity.map((a, i) => (
              <li key={i} className="flex gap-3 px-5 py-3">
                <Activity className="mt-0.5 size-4 shrink-0 text-slate-400" />
                <div className="min-w-0">
                  <p className="text-sm text-slate-800">
                    <span className="font-semibold">{a.athleteName}</span> — {statusLabel(a.to).toLowerCase()} · {a.universityName}
                  </p>
                  <p className="text-xs text-slate-400">
                    {a.applicationNo} · {relative(a.at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
