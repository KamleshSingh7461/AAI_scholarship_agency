'use client';
import Link from 'next/link';
import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { apiPost, date, statusLabel } from '@aci/web-shared';
import { useApi } from '@aci/web-shared/hooks';
import { Avatar, Button, Card, EmptyState, PageHeader, PageLoader, Pagination, Stat, StatusBadge, Table, Tabs, Td, Th, useToast } from '@aci/web-shared/ui';
import type { AwardYear, Paged } from '@/lib/types';

interface RenewalsResponse extends Paged<AwardYear> {
  summary: Record<string, number>;
  policy: { reminderDaysBefore: number; envelopeDaysBefore: number; graceDays: number };
}

export default function RenewalsPage() {
  const toast = useToast();
  const [status, setStatus] = useState('DUE');
  const [page, setPage] = useState(1);
  const { data, mutate } = useApi<RenewalsResponse>('/renewals', { status, page, pageSize: 25 });

  const remind = async (awardId: string) => {
    try {
      await apiPost(`/awards/${awardId}/remind`);
      toast.success('Reminder sent');
      void mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (!data) return <PageLoader />;
  const s = data.summary;
  return (
    <div>
      <PageHeader
        title="Yearly Renewals"
        breadcrumb="Home / Yearly Renewals"
        subtitle="A scholarship does not renew itself. Every single year, the student must register and sign again online to keep receiving it — no signature, no scholarship that year."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Renewed this year" value={s.RENEWED_THIS_YEAR ?? 0} tone="green" />
        <Stat label="Due for renewal" value={s.DUE ?? 0} tone="amber" />
        <Stat label="Overdue" value={s.OVERDUE ?? 0} tone="red" />
        <Stat label="Suspended" value={s.SUSPENDED ?? 0} tone="red" />
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {[
          ['1', `${data.policy.reminderDaysBefore} days before`, 'We text and email the student a reminder'],
          ['2', data.policy.envelopeDaysBefore ? `${data.policy.envelopeDaysBefore} days before` : 'On the anniversary', 'A new form to sign is sent automatically'],
          ['3', 'If student signs', 'Scholarship continues for another year'],
          ['!', `After ${data.policy.graceDays} days grace`, 'Scholarship is paused ("Suspended")'],
        ].map(([n, t, d]) => (
          <div key={t} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <span className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${n === '!' ? 'bg-red-100 text-red-700' : 'bg-brand-50 text-brand-700'}`}>{n}</span>
            <p className="mt-3 text-sm font-semibold text-slate-900">{t}</p>
            <p className="text-xs text-slate-500">{d}</p>
          </div>
        ))}
      </div>
      <Card padded={false}>
        <div className="border-b border-slate-100 p-4">
          <Tabs
            tabs={['DUE', 'OVERDUE', 'SUSPENDED', 'RENEWED', 'UPCOMING'].map((x) => ({ value: x, label: statusLabel(x), count: s[x] ?? 0 }))}
            value={status}
            onChange={(v) => (setStatus(v), setPage(1))}
          />
        </div>
        {data.items.length === 0 ? (
          <div className="p-6"><EmptyState icon={<RefreshCw className="size-8" />} title="Nothing in this list" /></div>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th>School</Th>
                  <Th>Year</Th>
                  <Th>Anniversary date</Th>
                  <Th>Days until / overdue</Th>
                  <Th>Progress</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((y) => (
                  <tr key={y.id}>
                    <Td>
                      <Link href={`/students/${y.award?.id}`} className="flex items-center gap-3">
                        <Avatar name={y.award?.athleteName} size={30} />
                        <span>
                          <span className="block font-semibold text-slate-900">{y.award?.athleteName}</span>
                          <span className="text-xs text-slate-500">{y.award?.whatsappNumber}</span>
                        </span>
                      </Link>
                    </Td>
                    <Td>{y.award?.universityName}</Td>
                    <Td>Year {y.yearNumber}</Td>
                    <Td>{date(y.dueDate)}</Td>
                    <Td className={(y.daysUntilDue ?? 0) < 0 ? 'font-semibold text-red-600' : ''}>
                      {y.status === 'RENEWED' ? '—' : (y.daysUntilDue ?? 0) >= 0 ? `${y.daysUntilDue} days` : `${-(y.daysUntilDue ?? 0)} days overdue`}
                    </Td>
                    <Td className="text-xs">
                      {[y.registrationSubmittedAt && 'Registered', y.scholarshipSignedAt && 'Scholarship signed', y.agencySignedAt && 'Agency signed'].filter(Boolean).join(' · ') ||
                        (y.renewedAt ? `Renewed ${date(y.renewedAt)}` : 'Not started')}
                    </Td>
                    <Td><StatusBadge status={y.status} /></Td>
                    <Td>
                      {['DUE', 'OVERDUE', 'SUSPENDED'].includes(y.status) && (
                        <Button size="sm" variant="secondary" onClick={() => remind(y.award!.id)}>
                          Send reminder
                        </Button>
                      )}
                    </Td>
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
