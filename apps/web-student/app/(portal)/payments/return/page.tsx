'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { apiPost, money } from '@aci/web-shared';
import { Button, Card, PageLoader } from '@aci/web-shared/ui';

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
  return (
    <div className="mx-auto max-w-lg py-10">
      <Card>
        <div className="flex flex-col items-center py-6 text-center">
          {paid ? <CheckCircle2 className="size-14 text-accent-600" /> : failed ? <XCircle className="size-14 text-red-500" /> : <Clock className="size-14 text-amber-500" />}
          <h1 className="mt-4 text-xl font-bold text-slate-900">{paid ? 'Payment successful' : failed ? 'Payment not completed' : 'Payment is processing'}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {paid
              ? `We received ${money(order!.amount, 'INR')} (receipt ${order!.orderNo}). Your application is now submitted for review.`
              : failed
                ? error ?? order?.failureReason ?? 'No money was taken. You can try again.'
                : 'Your bank has not confirmed yet. This page will update, or check My applications in a few minutes.'}
          </p>
          <div className="mt-6 flex gap-3">
            {order && (
              <Link href={`/applications/${order.referenceId}`}>
                <Button variant={paid ? 'primary' : 'secondary'}>View application</Button>
              </Link>
            )}
            {paid && (
              <Link href={`/payments/${order!.id}/receipt`}>
                <Button variant="secondary">Receipt</Button>
              </Link>
            )}
          </div>
        </div>
      </Card>
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
