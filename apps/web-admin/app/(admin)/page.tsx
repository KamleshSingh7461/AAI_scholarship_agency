'use client';
import Link from 'next/link';
import { useState } from 'react';
import { relative, statusLabel } from '@aci/web-shared';
import { useAuth } from '@aci/web-shared/auth';
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

type QueueItem = { label: string; hint: string; count: number; href: string };

/** What needs attention, in the order this role works through it. The first item is the role's main job. */
function queueFor(role: string, d: Dashboard): QueueItem[] {
  const app = (s: string) => d.pipeline[s] ?? 0;
  const renewals: QueueItem = { label: 'Renewals due', hint: 'Athletes must re-register and re-sign', count: d.statusCounts.RENEWALS_DUE ?? 0, href: '/renewals' };
  const signatures: QueueItem = { label: 'Awaiting signatures', hint: 'Approved — athlete still has to sign', count: app('AGREEMENTS_PENDING'), href: '/applications?status=AGREEMENTS_PENDING' };
  const withUni: QueueItem = { label: 'With university', hint: 'Waiting for the final decision', count: app('FORWARDED_TO_UNIVERSITY'), href: '/applications?status=FORWARDED_TO_UNIVERSITY' };
  if (role === 'UNIVERSITY_REP') return [{ ...withUni, label: 'Awaiting your decision', hint: 'Approve or reject forwarded athletes' }, signatures, renewals];
  if (role === 'FINANCE')
    return [
      { label: 'Fee not paid yet', hint: 'Applications waiting on payment', count: app('PAYMENT_PENDING'), href: '/applications?status=PAYMENT_PENDING' },
      { ...signatures, hint: 'Revenue books when both are signed' },
      renewals,
    ];
  return [
    { label: 'New applications', hint: 'Start the review', count: app('SUBMITTED'), href: '/applications?status=SUBMITTED' },
    { label: 'In review', hint: 'Verify documents, then forward or reject', count: app('UNDER_REVIEW'), href: '/applications?status=UNDER_REVIEW' },
    withUni,
    signatures,
    renewals,
  ];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['value']>('year');
  const [breakdown, setBreakdown] = useState<'uni' | 'sport'>('uni');
  const { data, error, mutate } = useApi<Dashboard>('/awards/dashboard', { period });
  const { data: inv } = useApi<Inventory>('/universities/inventory');

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <PageLoader />;
  const durations = Object.keys(inv?.totals ?? data.totals.byDuration).sort((a, b) => Number(b) - Number(a));
  const rows = breakdown === 'uni' ? data.byUniversity : data.bySport;
  const maxVal = Math.max(1, ...rows.map((r) => r.valueInr));
  const queue = queueFor(user?.role ?? '', data);
  const firstName = (user?.fullName ?? '').split(' ')[0];

  return (
    <div className="space-y-8">
      <PageHeader
        title="All Scholarships — Overview"
        breadcrumb={<span className="eyebrow">{firstName ? `Good to see you, ${firstName}` : 'Dashboard'}</span>}
        actions={<Tabs tabs={PERIODS.map((p) => ({ value: p.value, label: p.label }))} value={period} onChange={setPeriod} />}
      />

      <section aria-labelledby="queue-title">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="queue-title" className="eyebrow text-brand-600">
            Needs attention
          </h2>
          <span className="eyebrow text-[0.62rem] text-slate-500">
            {(() => {
              const n = queue.reduce((sum, q) => sum + q.count, 0);
              return n === 0 ? 'All clear' : `${n} open item${n === 1 ? '' : 's'}`;
            })()}
          </span>
        </div>
        <ul className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${queue.length > 3 ? 'xl:grid-cols-5' : 'lg:grid-cols-3'}`}>
          {queue.map((q, i) => {
            const primary = i === 0 && q.count > 0;
            return (
              <li key={q.label}>
                <Link
                  href={q.href}
                  className={`group flex h-full flex-col rounded-[8px] p-4 transition-colors ${
                    primary ? 'bg-ink text-paper hover:bg-brand-600' : 'bg-chalk shadow-[0_0_0_1px_rgb(18_17_16/0.08)] hover:shadow-[0_0_0_1.5px_var(--color-ink)]'
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className={`display text-5xl leading-none ${q.count === 0 && !primary ? 'text-slate-300' : ''}`}>{q.count}</span>
                    <span className={`arrow mt-1 ${primary ? 'text-paper/70' : 'text-slate-400 group-hover:text-ink'}`}>→</span>
                  </span>
                  <span className="mt-3 font-semibold leading-snug">{q.label}</span>
                  <span className={`mt-0.5 text-xs ${primary ? 'text-paper/65' : 'text-slate-500'}`}>{q.hint}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="Totals" className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Total students" value={data.totals.students.toLocaleString('en-IN')} sub={`Across ${data.totals.universities} partner universities`} />
          <Stat label="Total scholarship value" value={<MoneyPair value={{ inr: data.totals.scholarshipValueInr, usd: data.totals.scholarshipValueUsd }} compact />} sub="Lifetime booked revenue" />
          {durations.slice(0, 2).map((d) => (
            <Stat key={d} label={`${d}-year scholarships`} value={(data.totals.byDuration[d] ?? 0).toLocaleString('en-IN')} sub={`of ${data.totals.awarded} awarded so far`} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label={`New awards — ${PERIODS.find((p) => p.value === period)!.label.toLowerCase()}`} value={data.periodStats.newAwards} />
          <Stat label="Agreements signed" value={data.periodStats.agreementsSigned} />
          <Stat label="Renewals completed" value={data.periodStats.renewalsCompleted} />
          <Stat label="Revenue booked" value={<MoneyPair value={{ inr: data.periodStats.revenueBookedInr, usd: data.periodStats.revenueBookedUsd }} compact />} tone="green" />
        </div>
      </section>

      <section aria-label="Scholarships by status" className="grid grid-cols-2 gap-px overflow-hidden rounded-[8px] bg-ink/10 shadow-[0_0_0_1px_rgb(18_17_16/0.08)] sm:grid-cols-5">
        {[
          ['ACTIVE', 'Active', 'bg-accent-600'],
          ['PENDING_SIGNATURE', 'Pending signature', 'bg-amber-500'],
          ['RENEWALS_DUE', 'Renewals due', 'bg-violet-500'],
          ['SUSPENDED', 'Suspended', 'bg-brand-600'],
          ['EXPIRED', 'Expired', 'bg-slate-400'],
        ].map(([k, label, bar]) => (
          <div key={k} className="relative bg-chalk p-4 pl-5">
            <span className={`absolute inset-y-4 left-0 w-[3px] ${bar}`} aria-hidden />
            <p className="eyebrow text-[0.6rem] text-slate-500">{label}</p>
            <p className="display mt-2 text-3xl">{(data.statusCounts[k] ?? 0) + (k === 'ACTIVE' ? data.statusCounts.RENEWAL_DUE ?? 0 : 0)}</p>
          </div>
        ))}
      </section>

      <Card title="Scholarships still left to be awarded" subtitle="Out of our total commitment across partner universities, how many scholarships of each length are still available to give out" padded={false}>
        {inv ? (
          <>
            <div className="grid grid-cols-2 gap-4 border-b border-dashed border-ink/15 p-5 sm:grid-cols-4">
              <div>
                <p className="eyebrow text-[0.6rem] text-slate-500">Total still left</p>
                <p className="display mt-1 text-3xl">{inv.totalLeft}</p>
              </div>
              {durations.slice(0, 2).map((d) => (
                <div key={d}>
                  <p className="eyebrow text-[0.6rem] text-slate-500">{d}-year left</p>
                  <p className="display mt-1 text-3xl">{inv.totals[d]?.left ?? 0}</p>
                </div>
              ))}
              <div>
                <p className="eyebrow text-[0.6rem] text-slate-500">Already awarded</p>
                <p className="display mt-1 text-3xl text-accent-700">{inv.totalAwarded}</p>
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

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
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
                    <div className="meter flex-1">
                      <span style={{ width: `${(r.valueInr / maxVal) * 100}%` }} />
                    </div>
                    <span className="eyebrow w-24 text-right text-[0.6rem] text-slate-500">{r.students} students</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Recent activity" padded={false}>
          <ul className="divide-y divide-dashed divide-ink/15">
            {data.recentActivity.length === 0 && <li className="p-5 text-sm text-slate-500">Nothing yet.</li>}
            {data.recentActivity.map((a, i) => (
              <li key={i} className="px-5 py-3">
                <p className="eyebrow text-[0.6rem] text-slate-500">
                  {a.applicationNo} · {relative(a.at)}
                </p>
                <p className="mt-1 text-sm text-slate-800">
                  <span className="font-semibold">{a.athleteName}</span> — {statusLabel(a.to).toLowerCase()} · {a.universityName}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
