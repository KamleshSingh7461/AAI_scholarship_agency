'use client';
import Link from 'next/link';
import { date, money } from '@aci/web-shared';
import { useApi } from '@aci/web-shared/hooks';
import { Button, EmptyState, PageHeader, PageLoader, StatusBadge } from '@aci/web-shared/ui';
import type { Application } from '@/lib/types';

export default function ApplicationsPage() {
  const { data } = useApi<{ items: Application[] }>('/applications/mine', { pageSize: 50 });
  if (!data) return <PageLoader />;
  return (
    <div>
      <PageHeader title="My applications" subtitle="Track every scholarship you have applied for." />
      {data.items.length === 0 ? (
        <EmptyState title="No applications yet" action={<Link href="/programs"><Button>Browse scholarships <span className="arrow">→</span></Button></Link>}>
          Find a scholarship that matches your sport and apply in a few minutes.
        </EmptyState>
      ) : (
        <ul className="-mt-4">
          {data.items.map((a) => (
            <li key={a.id} className="border-b border-ink/15">
              <Link
                href={`/applications/${a.id}`}
                className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 py-5 transition-[padding] duration-300 hover:pl-2 md:grid-cols-[10rem_minmax(0,1fr)_9rem_auto_1.5rem]"
              >
                <span className="eyebrow text-[0.66rem] text-slate-500 md:order-none">
                  {a.applicationNo}
                  <span className="mt-1 block text-slate-400">{date(a.createdAt)}</span>
                </span>
                <span className="col-span-2 min-w-0 md:col-span-1">
                  <span className="block text-lg font-semibold leading-snug transition-colors group-hover:text-brand-600">{a.programName}</span>
                  <span className="block text-sm text-slate-500">{a.universityName}</span>
                </span>
                <span className="md:text-right">
                  <span className="block font-semibold tabular-nums">{money(a.totalValue, a.currency)}</span>
                  <span className="eyebrow block text-[0.6rem] text-slate-500">{a.durationYears}-year value</span>
                </span>
                <span className="justify-self-end md:justify-self-auto">
                  <StatusBadge status={a.status} />
                </span>
                <span className="arrow hidden text-slate-400 group-hover:text-ink md:inline">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
