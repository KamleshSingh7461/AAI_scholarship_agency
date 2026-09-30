'use client';
import Link from 'next/link';
import { dateTime, money } from '@aci/web-shared';
import { useApi } from '@aci/web-shared/hooks';
import { EmptyState, PageHeader, PageLoader, StatusBadge } from '@aci/web-shared/ui';

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
        <EmptyState title="No payments yet">Application fees you pay will appear here with a receipt.</EmptyState>
      ) : (
        <ul className="-mt-4">
          {data.items.map((o) => {
            const hasReceipt = ['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(o.status);
            return (
              <li key={o.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 border-b border-ink/15 py-5 md:grid-cols-[11rem_minmax(0,1fr)_8rem_auto_6rem]">
                <span className="eyebrow text-[0.66rem] text-slate-500">
                  {o.orderNo}
                  <span className="mt-1 block text-slate-400">{dateTime(o.paidAt ?? o.createdAt)}</span>
                </span>
                <span className="col-span-2 min-w-0 font-semibold md:col-span-1">{o.description}</span>
                <span className="display text-3xl tabular-nums md:text-right">{money(o.amount, 'INR')}</span>
                <span className="justify-self-end md:justify-self-auto">
                  <StatusBadge status={o.status} />
                </span>
                <span className="col-span-2 md:col-span-1 md:text-right">
                  {hasReceipt && (
                    <Link href={`/payments/${o.id}/receipt`} className="eyebrow link-grow text-[0.66rem] text-ink">
                      Receipt →
                    </Link>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
