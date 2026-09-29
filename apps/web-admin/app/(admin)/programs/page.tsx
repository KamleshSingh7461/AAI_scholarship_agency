'use client';
import Link from 'next/link';
import { useState } from 'react';
import { GraduationCap, Plus, Search } from 'lucide-react';
import { money } from '@aci/web-shared';
import { useAuth } from '@aci/web-shared/auth';
import { useApi } from '@aci/web-shared/hooks';
import { Button, Card, EmptyState, Input, PageHeader, PageLoader, Pagination, StatusBadge, Table, Tabs, Td, Th } from '@aci/web-shared/ui';
import { Money } from '@/components/money';
import type { Paged, Program } from '@/lib/types';

export default function ProgramsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data } = useApi<Paged<Program>>('/programs', { status, q, page, pageSize: 25 });
  return (
    <div>
      <PageHeader
        title="Scholarship programs"
        breadcrumb="Home / Programs"
        subtitle="What each scholarship is worth, who funds each part, how many seats, and the application fee."
        actions={['SUPER_ADMIN', 'ADMIN'].includes(user?.role ?? '') && <Link href="/programs/new"><Button icon={<Plus className="size-4" />}>New program</Button></Link>}
      />
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <label className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Search name or code" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} />
          </label>
          <Tabs tabs={['', 'DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED'].map((s) => ({ value: s, label: s ? s.charAt(0) + s.slice(1).toLowerCase() : 'All' }))} value={status} onChange={(v) => (setStatus(v), setPage(1))} />
        </div>
        {!data ? (
          <PageLoader />
        ) : data.items.length === 0 ? (
          <div className="p-6"><EmptyState icon={<GraduationCap className="size-8" />} title="No programs" /></div>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Program</Th>
                  <Th>University</Th>
                  <Th>Year</Th>
                  <Th className="text-right">Value (total)</Th>
                  <Th className="text-right">Fee</Th>
                  <Th className="text-right">Seats left</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <Td>
                      <Link href={`/programs/${p.id}`} className="font-semibold text-slate-900 hover:text-brand-700">{p.name}</Link>
                      <span className="block font-mono text-xs text-slate-400">{p.code} · {p.durationYears}-Year</span>
                    </Td>
                    <Td>{p.university?.name}</Td>
                    <Td>{p.academicYear}</Td>
                    <Td className="text-right"><Money minor={p.value.totalValue} currency={p.value.currency} rate4={p.value.usdInrRate4} /></Td>
                    <Td className="text-right">{p.fee.totalInr ? money(p.fee.totalInr, 'INR') : 'Free'}<span className="block text-xs text-slate-400">{p.feeType.toLowerCase()}</span></Td>
                    <Td className="text-right">{p.seatsLeft} / {p.seatsTotal}</Td>
                    <Td><StatusBadge status={p.status} /></Td>
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
