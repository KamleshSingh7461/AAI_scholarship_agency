'use client';
import Link from 'next/link';
import { Fragment, useState } from 'react';
import { date, money } from '@aci/web-shared';
import { useAuth } from '@aci/web-shared/auth';
import { useApi } from '@aci/web-shared/hooks';
import { Avatar, Button, Card, EmptyState, Input, PageHeader, PageLoader, Pagination, Select, StatusBadge, Table, Tabs, Td, Th } from '@aci/web-shared/ui';
import { Money } from '@/components/money';
import { AwardScholarshipModal } from '@/components/award-scholarship';
import type { Award, Paged, University } from '@/lib/types';

const STATUS_TABS = ['', 'ACTIVE', 'PENDING_SIGNATURE', 'RENEWAL_DUE', 'SUSPENDED', 'COMPLETED', 'EXPIRED', 'REVOKED'];

export default function StudentsPage() {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [sport, setSport] = useState('');
  const [durationYears, setDuration] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [awardOpen, setAwardOpen] = useState(false);
  const { data, mutate } = useApi<Paged<Award>>('/awards', { q, status, universityId, sport, durationYears, page, pageSize: 25 });
  const { data: unis } = useApi<Paged<University>>('/universities', { pageSize: 100 });

  return (
    <div>
      <PageHeader
        title="Students"
        breadcrumb="Home / Students"
        subtitle="Every scholarship passed out: who it went to, WhatsApp #, student ID, date passed out, sport, school, length, quantified value and signed agency agreement."
        actions={
          ['SUPER_ADMIN', 'ADMIN'].includes(user?.role ?? '') && (
            <Button onClick={() => setAwardOpen(true)}>
              Award scholarship
            </Button>
          )
        }
      />
      <Card padded={false}>
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_160px_140px]">
            <label className="relative">
              <Input placeholder="Name, student ID, award no, WhatsApp…" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} />
            </label>
            <Select value={universityId} onChange={(e) => (setUniversityId(e.target.value), setPage(1))}>
              <option value="">School: All</option>
              {unis?.items.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
            <Input placeholder="Sport: All" value={sport} onChange={(e) => (setSport(e.target.value), setPage(1))} />
            <Select value={durationYears} onChange={(e) => (setDuration(e.target.value), setPage(1))}>
              <option value="">Type: All</option>
              <option value="4">4-Year</option>
              <option value="3">3-Year</option>
              <option value="2">2-Year</option>
            </Select>
          </div>
          <Tabs
            tabs={STATUS_TABS.map((s) => ({
              value: s,
              label: s ? s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : 'All',
              count: s ? data?.statusCounts?.[s] ?? 0 : Object.values(data?.statusCounts ?? {}).reduce((a, b) => a + b, 0),
            }))}
            value={status}
            onChange={(v) => (setStatus(v), setPage(1))}
          />
        </div>
        {!data ? (
          <PageLoader />
        ) : data.items.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No scholarships found" />
          </div>
        ) : (
          <>
            <Table>
              <thead className="bg-slate-50/60">
                <tr>
                  <Th />
                  <Th>Student</Th>
                  <Th>Student ID</Th>
                  <Th>WhatsApp #</Th>
                  <Th>Date passed out</Th>
                  <Th>School</Th>
                  <Th>Sport</Th>
                  <Th>Award</Th>
                  <Th className="text-right">Total value</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((a) => (
                  <Fragment key={a.id}>
                    <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setOpen(open === a.id ? null : a.id)}>
                      <Td className="w-8"><span aria-hidden className={`inline-block text-lg leading-none text-slate-400 transition-transform ${open === a.id ? 'rotate-90' : ''}`}>›</span></Td>
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar name={a.athleteName} size={32} />
                          <Link href={`/students/${a.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-slate-900 hover:text-brand-700">
                            {a.athleteName}
                          </Link>
                        </div>
                      </Td>
                      <Td className="font-mono text-xs">{a.athleteCode}</Td>
                      <Td className="whitespace-nowrap">{a.whatsappNumber}</Td>
                      <Td className="whitespace-nowrap">{a.grantDate ? date(a.grantDate) : <span className="text-slate-400">Not yet signed</span>}</Td>
                      <Td>{a.universityName}</Td>
                      <Td>{a.sport}</Td>
                      <Td className="whitespace-nowrap">{a.durationYears}-Year</Td>
                      <Td className="text-right font-semibold">
                        <Money minor={a.totalValue} currency={a.currency} rate4={a.usdInrRate4} />
                      </Td>
                      <Td><StatusBadge status={a.status} /></Td>
                    </tr>
                    {open === a.id && (
                      <tr className="bg-slate-50/70">
                        <Td />
                        <Td colSpan={9} className="text-xs text-slate-600">
                          Tuition {money(a.tuitionPerYear, a.currency)}/yr · Food {money(a.foodPerYear, a.currency)}/yr · Room {money(a.roomPerYear, a.currency)}/yr
                          {a.otherPerYear > 0 && ` · Other ${money(a.otherPerYear, a.currency)}/yr`} · Signed Agency Agreement:{' '}
                          <strong className={a.agencySignedAt ? 'text-emerald-700' : 'text-amber-700'}>{a.agencySignedAt ? 'Uploaded & signed' : 'Not yet signed'}</strong> · University
                          confirmation: <strong>{a.universityConfirmationStatus.toLowerCase()}</strong> · <Link href={`/students/${a.id}`} className="font-semibold text-brand-700">Open →</Link>
                        </Td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </Table>
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />
          </>
        )}
      </Card>
      <AwardScholarshipModal open={awardOpen} onClose={() => setAwardOpen(false)} onDone={() => mutate()} />
    </div>
  );
}
