import type { Metadata } from 'next';
import Link from 'next/link';
import { ProgramCard } from '@/components/site';
import { publicApi, type CatalogProgram, type CatalogStats } from '@/lib/api';

export const metadata: Metadata = { title: 'Scholarships' };
export const dynamic = 'force-dynamic';

const field = 'h-12 w-full rounded-[4px] border border-ink/25 bg-chalk px-4 text-[15px] outline-none transition-colors focus:border-ink';

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
  const filtered = Boolean(sp.q || sp.sport || sp.durationYears);
  const link = (p: number) => {
    const n = new URLSearchParams(qs);
    n.set('page', String(p));
    n.delete('pageSize');
    return `/scholarships?${n}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-12 sm:px-6">
      <div className="grid grid-cols-1 gap-6 border-b-2 border-ink pb-10 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-8">
          <p className="eyebrow text-brand-600">Catalogue</p>
          <h1 className="display mt-3 text-[clamp(3.25rem,9vw,7.5rem)]">Athletic scholarships</h1>
        </div>
        <p className="text-ink/70 lg:col-span-4">
          All values are in Indian Rupees. Each scholarship lists exactly what it covers every year and what the application fee is.
        </p>
      </div>

      <form className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_13rem_11rem_auto]" action="/scholarships" role="search">
        <label>
          <span className="sr-only">Search university or program</span>
          <input name="q" defaultValue={sp.q} placeholder="Search university or program" className={field} />
        </label>
        <label>
          <span className="sr-only">Sport</span>
          <select name="sport" defaultValue={sp.sport ?? ''} className={field}>
            <option value="">All sports</option>
            {stats?.sports.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Length</span>
          <select name="durationYears" defaultValue={sp.durationYears ?? ''} className={field}>
            <option value="">Any length</option>
            <option value="4">4-year</option>
            <option value="3">3-year</option>
            <option value="2">2-year</option>
          </select>
        </label>
        <button className="btn btn-ink h-12">Search</button>
      </form>

      {!data ? (
        <div className="mt-12 rounded-[6px] border-2 border-ink p-8">
          <p className="eyebrow text-brand-600">Timeout called</p>
          <p className="mt-2 text-xl font-semibold">Scholarships are temporarily unavailable.</p>
          <p className="mt-1 text-ink/65">Please try again in a minute.</p>
        </div>
      ) : data.items.length === 0 ? (
        <div className="mt-12 rounded-[10px] border-2 border-dashed border-ink/25 p-10 text-center">
          <p className="display text-6xl text-ink/20">No match</p>
          <p className="mt-4 text-ink/65">No scholarships match your search.</p>
          {filtered && (
            <Link href="/scholarships" className="link-underline mt-4 inline-block font-semibold">
              Clear filters
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="eyebrow mt-10 flex items-center justify-between text-ink/60">
            <p>
              {data.total} scholarship{data.total === 1 ? '' : 's'}
            </p>
            {filtered && (
              <Link href="/scholarships" className="link-grow text-ink">
                Clear filters
              </Link>
            )}
          </div>
          <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
            {data.items.map((p) => (
              <ProgramCard key={p.id} p={p} />
            ))}
          </div>
          {data.totalPages > 1 && (
            <nav className="eyebrow mt-16 flex items-center justify-center gap-6" aria-label="Pagination">
              {page > 1 && (
                <Link href={link(page - 1)} className="btn btn-sm border border-ink">
                  ← Previous
                </Link>
              )}
              <span className="text-ink/60">
                Page {page} of {data.totalPages}
              </span>
              {page < data.totalPages && (
                <Link href={link(page + 1)} className="btn btn-sm btn-ink">
                  Next →
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
