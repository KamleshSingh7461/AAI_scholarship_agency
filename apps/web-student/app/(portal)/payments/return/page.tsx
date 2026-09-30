'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { apiPost, money } from '@aci/web-shared';
import { PageLoader } from '@aci/web-shared/ui';
import { ResultPanel } from '@/components/race';

interface Order {
  id: string;
  orderNo: string;
  status: string;
  amount: number;
  referenceId: string;
  failureReason: string | null;
}

/** Landing page after every gateway: asks the server to verify with the gateway, then polls briefly. */
function ReturnInner() {
  const orderId = useSearchParams().get('orderId');
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let stop = false;
    (async () => {
      for (let i = 0; i < 10 && !stop; i++) {
        try {
          const o = await apiPost<Order>(`/payments/${orderId}/verify`, {});
          setOrder(o);
          if (o.status !== 'PENDING' && o.status !== 'CREATED') return;
        } catch (e) {
          setError((e as Error).message);
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    })();
    return () => {
      stop = true;
    };
  }, [orderId]);

  if (!orderId) return <p>Missing order.</p>;
  if (!order && !error) return <PageLoader label="Confirming your payment with the bank…" />;

  const paid = order?.status === 'PAID';
  const failed = error || order?.status === 'FAILED' || order?.status === 'EXPIRED';
  const primary = 'inline-flex h-12 items-center gap-3 rounded-[4px] bg-paper px-6 font-bold text-ink transition-colors hover:bg-brand-600 hover:text-white';
  const secondary = 'inline-flex h-12 items-center gap-3 rounded-[4px] px-6 font-bold text-paper ring-1 ring-inset ring-paper/40 transition-colors hover:bg-paper hover:text-ink';
  return (
    <div className="py-6">
      <ResultPanel
        state={paid ? 'success' : failed ? 'fail' : 'pending'}
        eyebrow={paid ? `Receipt ${order!.orderNo}` : failed ? 'Payment' : 'Payment'}
        title={paid ? 'Paid.' : failed ? 'Not completed.' : 'Processing…'}
        actions={
          <>
            {order && (
              <Link href={`/applications/${order.referenceId}`} className={paid ? primary : secondary}>
                View application <span className="arrow">→</span>
              </Link>
            )}
            {paid && (
              <Link href={`/payments/${order!.id}/receipt`} className={secondary}>
                Receipt
              </Link>
            )}
          </>
        }
      >
        {paid
          ? `We received ${money(order!.amount, 'INR')}. Your application is now submitted for review.`
          : failed
            ? error ?? order?.failureReason ?? 'No money was taken. You can try again.'
            : 'Your bank has not confirmed yet. This page will update, or check My applications in a few minutes.'}
      </ResultPanel>
    </div>
  );
}

export default function PaymentReturnPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ReturnInner />
    </Suspense>
  );
}
