'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { date, statusLabel } from '@aci/web-shared';
import { useAuth } from '@aci/web-shared/auth';
import { useApi } from '@aci/web-shared/hooks';
import { Card, EmptyState, Input, PageHeader, PageLoader, Pagination, StatusBadge, Table, Tabs, Td, Th } from '@aci/web-shared/ui';
import { Money } from '@/components/money';
import type { Application, Paged } from '@/lib/types';

const PIPELINE = ['', 'PAYMENT_PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'FORWARDED_TO_UNIVERSITY', 'AGREEMENTS_PENDING', 'AWARDED', 'REJECTED', 'UNIVERSITY_REJECTED', 'WITHDRAWN', 'EXPIRED'];

export default function ApplicationsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ApplicationsInner />
    </Suspense>
  );
}

function ApplicationsInner() {
  const router = useRouter();
  const { user } = useAuth();
  const fromUrl = useSearchParams().get('status');
  // University reps land on the applications waiting for their decision; everyone else on new submissions.
  const [status, setStatus] = useState(fromUrl !== null && PIPELINE.includes(fromUrl) ? fromUrl : user?.role === 'UNIVERSITY_REP' ? 'FORWARDED_TO_UNIVERSITY' : 'SUBMITTED');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data } = useApi<Paged<Application>>('/applications', { status, q, page, pageSize: 25 });
  const counts = data?.statusCounts ?? {};
  const pick = (v: string) => {
    setStatus(v);
    setPage(1);
    router.replace(`/applications?status=${v}`, { scroll: false });
  };

  return (
    <div>
      <PageHeader title="Applications" breadcrumb="Home / Applications" subtitle="Review athletes, forward to the university and record its decision." />
      <Card padded={false}>
        <div className="space-y-3 border-b border-slate-100 p-4">
          <label className="relative block max-w-md">
            <Input placeholder="Search name, application no, athlete ID, phone" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} />
          </label>
          <Tabs
            tabs={PIPELINE.map((s) => ({ value: s, label: s ? statusLabel(s) : 'All', count: s ? counts[s] ?? 0 : Object.values(counts).reduce((a, b) => a + b, 0) }))}
            value={status}
            onChange={pick}
          />
        </div>
        {!data ? (
          <PageLoader />
        ) : data.items.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No applications in this stage" />
          </div>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Application</Th>
                  <Th>Athlete</Th>
                  <Th>Sport</Th>
                  <Th>Program</Th>
                  <Th className="text-right">Value</Th>
                  <Th>Submitted</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((a) => (
                  <tr key={a.id} className="cursor-pointer hover:bg-slate-50" onClick={() => router.push(`/applications/${a.id}`)}>
                    <Td>
                      <Link href={`/applications/${a.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs font-semibold text-brand-700 hover:underline">
                        {a.applicationNo}
                      </Link>
                    </Td>
                    <Td>
                      <p className="font-semibold text-slate-900">{a.athleteName}</p>
                      <p className="text-xs text-slate-500">
                        {a.athleteCode} · {a.athletePhone}
                        {a.isMinor && ' · minor'}
                      </p>
                    </Td>
                    <Td>{a.sport}</Td>
                    <Td>
                      <p className="text-slate-900">{a.programName}</p>
                      <p className="text-xs text-slate-500">{a.universityName}</p>
                    </Td>
                    <Td className="text-right"><Money minor={a.totalValue} currency={a.currency} rate4={a.usdInrRate4} /></Td>
                    <Td className="whitespace-nowrap">{date(a.submittedAt ?? a.createdAt)}</Td>
                    <Td><StatusBadge status={a.status} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
