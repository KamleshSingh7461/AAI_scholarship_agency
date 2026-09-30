'use client';
import Link from 'next/link';
import { useState } from 'react';
import { money } from '@aci/web-shared';
import { useApi } from '@aci/web-shared/hooks';
import { EmptyState, ErrorState, Input, PageHeader, PageLoader, Pagination, Select } from '@aci/web-shared/ui';
import { bibNumber, Pins, SeatsMeter } from '@/components/race';
import type { CatalogProgram } from '@/lib/catalog';

function ProgramBib({ p }: { p: CatalogProgram }) {
  const [prefix, number] = bibNumber(p.code);
  return (
    <Link href={`/programs/${p.id}`} className="bib group" aria-label={`${p.name}, ${p.university?.name ?? ''}`}>
      <Pins />
      <div className="bib-band px-6 pb-3.5 pt-5">
        <p className="display line-clamp-2 text-2xl">{p.university?.name}</p>
        <p className="eyebrow mt-1 truncate text-[0.62rem] text-white/80">{[p.university?.city, p.university?.state].filter(Boolean).join(', ') || 'India'}</p>
      </div>
      <div className="px-6 pb-5 pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow text-[0.62rem] text-slate-500">{prefix}</p>
          <p className="eyebrow text-[0.62rem] text-slate-500">
            {p.durationYears}-yr · {p.academicYear}
          </p>
        </div>
        <p className="display mt-1 text-[5.5rem] leading-[0.82] tracking-tight transition-colors group-hover:text-brand-600">{number}</p>
        <h3 className="mt-3 font-semibold leading-snug">{p.name}</h3>
      </div>
      <div className="bib-stub px-6 pb-6 pt-4">
        <dl className="grid grid-cols-3 gap-3">
          <div>
            <dt className="eyebrow text-[0.6rem] text-slate-500">Per year</dt>
            <dd className="mt-1 font-bold tabular-nums">{money(p.benefitsInr.annualValue, 'INR')}</dd>
          </div>
          <div>
            <dt className="eyebrow text-[0.6rem] text-slate-500">Total</dt>
            <dd className="mt-1 font-bold tabular-nums text-accent-700">{money(p.benefitsInr.totalValue, 'INR')}</dd>
          </div>
          <div>
            <dt className="eyebrow text-[0.6rem] text-slate-500">Fee</dt>
            <dd className="mt-1 font-bold tabular-nums">{p.fee.totalInr ? money(p.fee.totalInr, 'INR') : 'Free'}</dd>
          </div>
        </dl>
        <div className="mt-4">
          <SeatsMeter left={p.seatsLeft} total={p.seatsTotal} />
        </div>
      </div>
    </Link>
  );
}

export default function ProgramsPage() {
  const [q, setQ] = useState('');
  const [sport, setSport] = useState('');
  const [duration, setDuration] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, isLoading, mutate } = useApi<{ items: CatalogProgram[]; total: number; page: number; totalPages: number }>('/catalog/programs', {
    q,
    sport,
    durationYears: duration,
    page,
    pageSize: 12,
  });
  const { data: stats } = useApi<{ sports: string[] }>('/catalog/stats');

  return (
    <div>
      <PageHeader title="Scholarships" subtitle="Open athletic scholarships at partner universities. Values are shown in Indian Rupees." />
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_9rem]">
        <label>
          <span className="sr-only">Search university or program</span>
          <Input className="h-12" placeholder="Search university or program" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} />
        </label>
        <label>
          <span className="sr-only">Sport</span>
          <Select className="h-12" value={sport} onChange={(e) => (setSport(e.target.value), setPage(1))}>
            <option value="">All sports</option>
            {stats?.sports.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </label>
        <label>
          <span className="sr-only">Length</span>
          <Select className="h-12" value={duration} onChange={(e) => (setDuration(e.target.value), setPage(1))}>
            <option value="">Any length</option>
            <option value="4">4-year</option>
            <option value="3">3-year</option>
            <option value="2">2-year</option>
          </Select>
        </label>
      </div>
      {error ? (
        <ErrorState error={error} retry={() => mutate()} />
      ) : isLoading || !data ? (
        <PageLoader />
      ) : data.items.length === 0 ? (
        <EmptyState title="No match">No scholarships match your filters. Try another sport or length.</EmptyState>
      ) : (
        <>
          <p className="eyebrow mb-5 text-slate-500">
            {data.total} scholarship{data.total === 1 ? '' : 's'}
          </p>
          <div className="grid grid-cols-1 gap-x-7 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
            {data.items.map((p) => (
              <ProgramBib key={p.id} p={p} />
            ))}
          </div>
          {data.totalPages > 1 && (
            <div className="mt-10 border-t border-ink/15">
              <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
