'use client';
import { useState } from 'react';
import { apiPost, dateTime, money } from '@aci/web-shared';
import { useAuth } from '@aci/web-shared/auth';
import { useApi } from '@aci/web-shared/hooks';
import { Button, Card, Field, Input, Modal, PageHeader, PageLoader, Pagination, Stat, StatusBadge, Table, Tabs, Td, Textarea, Th, useToast } from '@aci/web-shared/ui';
import type { Paged } from '@/lib/types';

interface Order {
  id: string;
  orderNo: string;
  description: string;
  amount: number;
  taxAmount: number;
  refundedAmount: number;
  status: string;
  provider: string;
  providerPaymentId: string | null;
  customer: { name: string; phone: string };
  createdAt: string;
  paidAt: string | null;
  failureReason: string | null;
}

export default function PaymentsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [status, setStatus] = useState('PAID');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [refund, setRefund] = useState<{ order: Order; reason: string; amount: string } | null>(null);
  const { data, mutate } = useApi<Paged<Order>>('/payments', { status, q, page, pageSize: 25 });
  const canSummary = ['SUPER_ADMIN', 'ADMIN', 'FINANCE'].includes(user?.role ?? '');
  const { data: summary } = useApi<{ collectedInr: number; taxInr: number; refundedInr: number; activeProvider: string }>(canSummary ? '/payments/summary' : null);

  const doRefund = async () => {
    if (!refund) return;
    try {
      await apiPost(`/payments/${refund.order.id}/refund`, { reason: refund.reason, amount: refund.amount ? Math.round(Number(refund.amount) * 100) : undefined });
      toast.success('Refund processed');
      setRefund(null);
      void mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div>
      <PageHeader title="Payments" breadcrumb="Home / Payments" subtitle="Application fees collected through the payment gateway." />
      {summary && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Stat label="Collected" value={money(summary.collectedInr, 'INR')} tone="green" />
          <Stat label="GST portion" value={money(summary.taxInr, 'INR')} />
          <Stat label="Refunded" value={money(summary.refundedInr, 'INR')} />
          <Stat label="Active gateway" value={summary.activeProvider} />
        </div>
      )}
      <Card padded={false}>
        <div className="space-y-3 border-b border-slate-100 p-4">
          <label className="relative block max-w-md">
            <Input placeholder="Receipt no, transaction id, description" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} />
          </label>
          <Tabs tabs={['PAID', 'PENDING', 'FAILED', 'REFUNDED', 'EXPIRED', ''].map((s) => ({ value: s, label: s || 'All' }))} value={status} onChange={(v) => (setStatus(v), setPage(1))} />
        </div>
        {!data ? (
          <PageLoader />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Receipt</Th>
                  <Th>Payer</Th>
                  <Th>Description</Th>
                  <Th>Gateway</Th>
                  <Th>Date</Th>
                  <Th className="text-right">Amount</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((o) => (
                  <tr key={o.id}>
                    <Td className="font-mono text-xs">{o.orderNo}</Td>
                    <Td>
                      <p className="font-medium text-slate-900">{o.customer?.name}</p>
                      <p className="text-xs text-slate-500">{o.customer?.phone}</p>
                    </Td>
                    <Td className="max-w-xs truncate text-xs">{o.description}</Td>
                    <Td className="text-xs">
                      {o.provider}
                      {o.providerPaymentId && <span className="block font-mono text-slate-400">{o.providerPaymentId}</span>}
                    </Td>
                    <Td className="whitespace-nowrap text-xs">{dateTime(o.paidAt ?? o.createdAt)}</Td>
                    <Td className="text-right font-semibold">
                      {money(o.amount, 'INR')}
                      {o.refundedAmount > 0 && <span className="block text-xs text-violet-600">−{money(o.refundedAmount, 'INR')}</span>}
                    </Td>
                    <Td>
                      <StatusBadge status={o.status} />
                      {o.failureReason && <span className="block text-[11px] text-red-600">{o.failureReason}</span>}
                    </Td>
                    <Td>
                      {canSummary && ['PAID', 'PARTIALLY_REFUNDED'].includes(o.status) && (
                        <Button size="sm" variant="ghost" onClick={() => setRefund({ order: o, reason: '', amount: '' })}>Refund</Button>
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
      <Modal
        open={!!refund}
        onClose={() => setRefund(null)}
        title={`Refund ${refund?.order.orderNo}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRefund(null)}>Cancel</Button>
            <Button variant="danger" disabled={(refund?.reason.length ?? 0) < 3} onClick={doRefund}>Refund via gateway</Button>
          </>
        }
      >
        {refund && (
          <div className="space-y-4">
            <Field label="Amount (₹)" hint={`Leave empty to refund the full remaining ${money(refund.order.amount - refund.order.refundedAmount, 'INR')}`}>
              <Input type="number" value={refund.amount} onChange={(e) => setRefund({ ...refund, amount: e.target.value })} />
            </Field>
            <Field label="Reason"><Textarea value={refund.reason} onChange={(e) => setRefund({ ...refund, reason: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
