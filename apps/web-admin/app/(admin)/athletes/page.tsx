'use client';
import Link from 'next/link';
import { useState } from 'react';
import { date, statusLabel } from '@aci/web-shared';
import { useApi } from '@aci/web-shared/hooks';
import { Avatar, Card, EmptyState, Input, PageHeader, PageLoader, Pagination, Stat, StatusBadge, Table, Tabs, Td, Th } from '@aci/web-shared/ui';
import type { Paged } from '@/lib/types';

interface AthleteRow {
  profileId: string;
  userId: string;
  athleteCode: string;
  status: string;
  fullName: string | null;
  age: number | null;
  isMinor: boolean;
  gender: string | null;
  phone: string;
  city: string | null;
  state: string | null;
  primarySport: string | null;
  submittedAt: string | null;
}

export default function AthletesPage() {
  const [status, setStatus] = useState('SUBMITTED');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data } = useApi<Paged<AthleteRow>>('/athletes', { status, q, page, pageSize: 25 });
  const { data: stats } = useApi<{ byStatus: Record<string, number>; bySport: { sport: string; count: number }[] }>('/athletes/stats');

  return (
    <div>
      <PageHeader title="Athlete profiles" breadcrumb="Home / Athletes" subtitle="Verify documents and approve profiles. Only verified athletes can be forwarded to universities." />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        {['SUBMITTED', 'VERIFIED', 'CHANGES_REQUESTED', 'DRAFT'].map((s) => (
          <Stat key={s} label={statusLabel(s)} value={stats?.byStatus[s] ?? 0} />
        ))}
      </div>
      <Card padded={false}>
        <div className="space-y-3 border-b border-slate-100 p-4">
          <label className="relative block max-w-md">
            <Input placeholder="Name, athlete ID, phone, email" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} />
          </label>
          <Tabs
            tabs={['SUBMITTED', 'VERIFIED', 'CHANGES_REQUESTED', 'REJECTED', 'DRAFT'].map((s) => ({ value: s, label: statusLabel(s), count: stats?.byStatus[s] ?? 0 }))}
            value={status}
            onChange={(v) => (setStatus(v), setPage(1))}
          />
        </div>
        {!data ? (
          <PageLoader />
        ) : data.items.length === 0 ? (
          <div className="p-6"><EmptyState title="No athletes here" /></div>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Athlete</Th>
                  <Th>ID</Th>
                  <Th>Sport</Th>
                  <Th>Age</Th>
                  <Th>Location</Th>
                  <Th>Submitted</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((a) => (
                  <tr key={a.profileId} className="hover:bg-slate-50">
                    <Td>
                      <Link href={`/athletes/${a.profileId}`} className="flex items-center gap-3">
                        <Avatar name={a.fullName} size={32} />
                        <span>
                          <span className="block font-semibold text-slate-900 hover:text-brand-700">{a.fullName ?? '—'}</span>
                          <span className="text-xs text-slate-500">{a.phone}</span>
                        </span>
                      </Link>
                    </Td>
                    <Td className="font-mono text-xs">{a.athleteCode}</Td>
                    <Td>{a.primarySport}</Td>
                    <Td>{a.age ?? '—'}{a.isMinor && <span className="ml-1 text-xs text-amber-600">minor</span>}</Td>
                    <Td>{[a.city, a.state].filter(Boolean).join(', ')}</Td>
                    <Td>{date(a.submittedAt)}</Td>
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
