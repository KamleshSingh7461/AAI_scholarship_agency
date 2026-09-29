'use client';
import Link from 'next/link';
import { ArrowRight, GraduationCap } from 'lucide-react';
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
        <EmptyState icon={<GraduationCap className="size-8" />} title="No applications yet" action={<Link href="/programs"><Button>Browse scholarships</Button></Link>}>
          Find a scholarship that matches your sport and apply in a few minutes.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {data.items.map((a) => (
            <Link key={a.id} href={`/applications/${a.id}`} className="flex flex-wrap items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 hover:ring-brand-200">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{a.programName}</p>
                <p className="text-sm text-slate-500">
                  {a.universityName} · {a.applicationNo} · applied {date(a.createdAt)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900">{money(a.totalValue, a.currency)}</p>
                <p className="text-xs text-slate-500">{a.durationYears}-year value</p>
              </div>
              <StatusBadge status={a.status} />
              <ArrowRight className="size-4 text-slate-300" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
