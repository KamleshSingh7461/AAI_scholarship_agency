'use client';
import Link from 'next/link';
import { CreditCard } from 'lucide-react';
import { dateTime, money } from '@aci/web-shared';
import { useApi } from '@aci/web-shared/hooks';
import { Card, EmptyState, PageHeader, PageLoader, StatusBadge, Table, Td, Th } from '@aci/web-shared/ui';

interface Order {
  id: string;
  orderNo: string;
  description: string;
  amount: number;
  status: string;
  provider: string;
  createdAt: string;
  paidAt: string | null;
}

export default function PaymentsPage() {
  const { data } = useApi<{ items: Order[] }>('/payments/mine', { pageSize: 50 });
  if (!data) return <PageLoader />;
  return (
    <div>
      <PageHeader title="Payments" subtitle="Your application fee payments and receipts." />
      {data.items.length === 0 ? (
        <EmptyState icon={<CreditCard className="size-8" />} title="No payments yet" />
      ) : (
        <Card padded={false}>
          <Table>
            <thead>
              <tr>
                <Th>Receipt</Th>
                <Th>Description</Th>
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
                  <Td>{o.description}</Td>
                  <Td>{dateTime(o.paidAt ?? o.createdAt)}</Td>
                  <Td className="text-right font-semibold">{money(o.amount, 'INR')}</Td>
                  <Td><StatusBadge status={o.status} /></Td>
                  <Td>
                    {['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(o.status) && (
                      <Link href={`/payments/${o.id}/receipt`} className="text-xs font-semibold text-brand-700 hover:underline">
                        Receipt
                      </Link>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
