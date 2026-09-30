'use client';
import { useState } from 'react';
import { AGREEMENT_LABEL, apiPost, date, dateTime, openDocument } from '@aci/web-shared';
import { useApi } from '@aci/web-shared/hooks';
import { Avatar, Button, Card, EmptyState, Input, PageHeader, PageLoader, Pagination, Stat, StatusBadge, Table, Tabs, Td, Th, useToast } from '@aci/web-shared/ui';
import type { Paged } from '@/lib/types';

interface Envelope {
  id: string;
  title: string;
  agreementType: string;
  signerName: string;
  signerEmail: string;
  status: string;
  provider: string;
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  declinedAt: string | null;
  expiresAt: string;
  signedDocumentId: string | null;
  remindersSent: number;
}

export default function PaperworkPage() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, mutate } = useApi<Paged<Envelope>>('/esign/envelopes', { status, agreementType: type, q, page, pageSize: 25 });
  const c = data?.statusCounts ?? {};

  const remind = async (id: string) => {
    try {
      await apiPost(`/esign/envelopes/${id}/remind`);
      toast.success('Reminder sent on WhatsApp');
      void mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const lastActivity = (e: Envelope) =>
    e.signedAt ? `Signed ${date(e.signedAt)}` : e.declinedAt ? `Declined ${date(e.declinedAt)}` : e.status === 'EXPIRED' ? `Deadline passed ${date(e.expiresAt)}` : e.viewedAt ? `Opened ${date(e.viewedAt)}` : 'Not yet opened';

  return (
    <div>
      <PageHeader
        title="Signed Paperwork Tracking"
        breadcrumb="Home / Signed Paperwork"
        subtitle="Every student must sign two forms online — the Scholarship Award Agreement and the Agency Agreement — before their award is active, and again every year to renew."
      />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Stat label="Pending" value={(c.SENT ?? 0) + (c.CREATED ?? 0)} tone="amber" />
        <Stat label="Viewed" value={c.VIEWED ?? 0} />
        <Stat label="Signed" value={c.SIGNED ?? 0} tone="green" />
        <Stat label="Expired / declined" value={(c.EXPIRED ?? 0) + (c.DECLINED ?? 0)} tone="red" />
      </div>
      <Card padded={false}>
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="flex flex-wrap gap-3">
            <label className="relative w-full max-w-sm">
              <Input placeholder="Student name or email" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} />
            </label>
            <Tabs
              tabs={[
                { value: '', label: 'All documents' },
                { value: 'SCHOLARSHIP_AWARD', label: 'Scholarship' },
                { value: 'AGENCY', label: 'Agency' },
                { value: 'SCHOLARSHIP_RENEWAL', label: 'Scholarship renewal' },
                { value: 'AGENCY_RENEWAL', label: 'Agency renewal' },
              ]}
              value={type}
              onChange={(v) => (setType(v), setPage(1))}
            />
          </div>
          <Tabs
            tabs={['', 'SENT', 'VIEWED', 'SIGNED', 'EXPIRED', 'DECLINED', 'VOIDED'].map((s) => ({ value: s, label: s ? s.charAt(0) + s.slice(1).toLowerCase() : 'All', count: s ? c[s] ?? 0 : undefined }))}
            value={status}
            onChange={(v) => (setStatus(v), setPage(1))}
          />
        </div>
        {!data ? (
          <PageLoader />
        ) : data.items.length === 0 ? (
          <div className="p-6"><EmptyState title="No envelopes" /></div>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th>Document</Th>
                  <Th>Sent</Th>
                  <Th>Status</Th>
                  <Th>Last activity</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((e) => (
                  <tr key={e.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={e.signerName} size={30} />
                        <span className="font-medium text-slate-900">{e.signerName}</span>
                      </div>
                    </Td>
                    <Td>
                      <p className="text-slate-900">{AGREEMENT_LABEL[e.agreementType]}</p>
                      <p className="text-xs text-slate-500">{e.title}</p>
                    </Td>
                    <Td className="whitespace-nowrap">{date(e.sentAt)}</Td>
                    <Td><StatusBadge status={e.status} /></Td>
                    <Td className="text-xs text-slate-500" >
                      {lastActivity(e)}
                      {e.remindersSent > 0 && ` · ${e.remindersSent} reminder(s)`}
                    </Td>
                    <Td className="text-right">
                      {e.signedDocumentId ? (
                        <Button size="sm" variant="secondary" onClick={() => openDocument(e.signedDocumentId!)}>
                          View
                        </Button>
                      ) : ['SENT', 'VIEWED'].includes(e.status) ? (
                        <Button size="sm" variant="secondary" onClick={() => remind(e.id)} title={`Expires ${dateTime(e.expiresAt)}`}>
                          Remind
                        </Button>
                      ) : null}
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
