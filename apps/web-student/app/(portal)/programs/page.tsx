'use client';
import Link from 'next/link';
import { useState } from 'react';
import { GraduationCap, Search, Users } from 'lucide-react';
import { money } from '@aci/web-shared';
import { useApi } from '@aci/web-shared/hooks';
import { Badge, EmptyState, ErrorState, Input, PageHeader, PageLoader, Pagination, Select } from '@aci/web-shared/ui';
import type { CatalogProgram } from '@/lib/catalog';

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
      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_180px_140px]">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search university or program" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} />
        </label>
        <Select value={sport} onChange={(e) => (setSport(e.target.value), setPage(1))}>
          <option value="">All sports</option>
          {stats?.sports.map((s) => <option key={s}>{s}</option>)}
        </Select>
        <Select value={duration} onChange={(e) => (setDuration(e.target.value), setPage(1))}>
          <option value="">Any length</option>
          <option value="4">4-year</option>
          <option value="3">3-year</option>
          <option value="2">2-year</option>
        </Select>
      </div>
      {error ? (
        <ErrorState error={error} retry={() => mutate()} />
      ) : isLoading || !data ? (
        <PageLoader />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<GraduationCap className="size-8" />} title="No scholarships match your filters" />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.items.map((p) => (
              <Link key={p.id} href={`/programs/${p.id}`} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md hover:ring-brand-200">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{p.university?.name}</p>
                  <Badge tone="green">{p.durationYears}-Year</Badge>
                </div>
                <h3 className="mt-3 font-bold text-slate-900">{p.name}</h3>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total value</p>
                    <p className="text-xl font-bold text-accent-700">{money(p.benefitsInr.totalValue, 'INR')}</p>
                    <p className="text-xs text-slate-500">{money(p.benefitsInr.annualValue, 'INR')} / year</p>
                  </div>
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <Users className="size-3.5" /> {p.seatsLeft} left
                  </p>
                </div>
                <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  Application fee: <span className="font-semibold text-slate-800">{p.fee.totalInr ? money(p.fee.totalInr, 'INR') : 'Free'}</span>
                </p>
              </Link>
            ))}
          </div>
          <div className="mt-4 rounded-2xl bg-white ring-1 ring-slate-200">
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
