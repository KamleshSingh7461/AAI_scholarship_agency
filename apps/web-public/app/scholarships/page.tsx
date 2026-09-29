import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { ProgramCard } from '@/components/site';
import { publicApi, type CatalogProgram, type CatalogStats } from '@/lib/api';

export const metadata: Metadata = { title: 'Scholarships' };
export const dynamic = 'force-dynamic';

export default async function ScholarshipsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const k of ['q', 'sport', 'durationYears', 'page']) if (sp[k]) qs.set(k, sp[k]!);
  qs.set('pageSize', '12');
  const [data, stats] = await Promise.all([
    publicApi<{ items: CatalogProgram[]; total: number; page: number; totalPages: number }>(`/catalog/programs?${qs}`, 30),
    publicApi<CatalogStats>('/catalog/stats'),
  ]);
  const page = data?.page ?? 1;
  const link = (p: number) => {
    const n = new URLSearchParams(qs);
    n.set('page', String(p));
    n.delete('pageSize');
    return `/scholarships?${n}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="text-4xl font-black tracking-tight text-slate-900">Athletic scholarships</h1>
      <p className="mt-2 text-slate-500">All values are shown in Indian Rupees. Each scholarship lists exactly what it covers and what the application fee is.</p>

      <form className="mt-8 grid gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 md:grid-cols-[1fr_200px_160px_auto]" action="/scholarships">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={sp.q} placeholder="Search university or program" className="h-11 w-full rounded-lg border-0 pl-9 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand-500" />
        </label>
        <select name="sport" defaultValue={sp.sport ?? ''} className="h-11 rounded-lg border-0 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand-500">
          <option value="">All sports</option>
          {stats?.sports.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select name="durationYears" defaultValue={sp.durationYears ?? ''} className="h-11 rounded-lg border-0 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand-500">
          <option value="">Any length</option>
          <option value="4">4-year</option>
          <option value="3">3-year</option>
          <option value="2">2-year</option>
        </select>
        <button className="h-11 rounded-lg bg-brand-600 px-6 text-sm font-bold text-white hover:bg-brand-700">Search</button>
      </form>

      {!data ? (
        <p className="mt-10 rounded-2xl bg-amber-50 p-6 text-amber-800 ring-1 ring-amber-200">Scholarships are temporarily unavailable. Please try again in a minute.</p>
      ) : data.items.length === 0 ? (
        <p className="mt-10 rounded-2xl bg-slate-50 p-10 text-center text-slate-500 ring-1 ring-slate-200">No scholarships match your search.</p>
      ) : (
        <>
          <p className="mt-8 text-sm text-slate-500">{data.total} scholarship{data.total === 1 ? '' : 's'}</p>
          <div className="mt-4 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data.items.map((p) => (
              <ProgramCard key={p.id} p={p} />
            ))}
          </div>
          {data.totalPages > 1 && (
            <div className="mt-10 flex justify-center gap-2">
              {page > 1 && <Link href={link(page - 1)} className="rounded-lg px-4 py-2 text-sm font-semibold ring-1 ring-slate-300">← Previous</Link>}
              <span className="px-4 py-2 text-sm text-slate-500">Page {page} of {data.totalPages}</span>
              {page < data.totalPages && <Link href={link(page + 1)} className="rounded-lg px-4 py-2 text-sm font-semibold ring-1 ring-slate-300">Next →</Link>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
