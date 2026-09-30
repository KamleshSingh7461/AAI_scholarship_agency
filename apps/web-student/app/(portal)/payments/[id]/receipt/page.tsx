'use client';
import { useParams } from 'next/navigation';
import { dateTime, money } from '@aci/web-shared';
import { useApi } from '@aci/web-shared/hooks';
import { Button, PageLoader } from '@aci/web-shared/ui';
import { BackLink } from '@/components/race';

interface Receipt {
  receiptNo: string;
  issuedAt: string;
  seller: { legalName: string; brand: string; gstin: string | null; address: string | null };
  customer: { name: string; phone: string; email?: string };
  description: string;
  baseAmount: number;
  taxAmount: number;
  total: number;
  provider: string;
  providerPaymentId: string | null;
  refundedAmount: number;
}

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-6 ${strong ? 'font-semibold' : ''}`}>
      <span>{label}</span>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  );
}

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const { data: r } = useApi<Receipt>(`/payments/${id}/receipt`);
  if (!r) return <PageLoader />;
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BackLink href="/payments">Payments</BackLink>
        <Button variant="secondary" onClick={() => window.print()}>
          Print / save as PDF
        </Button>
      </div>
      <article className="receipt rounded-[4px] px-7 pb-8 pt-8 text-ink shadow-[0_0_0_1px_rgb(18_17_16/0.08),0_24px_40px_-30px_rgb(18_17_16/0.5)] print:shadow-none sm:px-10">
        <p className="text-center text-base font-semibold tracking-[0.2em]">{r.seller.brand.toUpperCase()}</p>
        <p className="text-center text-slate-600">{r.seller.legalName}</p>
        {r.seller.address && <p className="text-center text-slate-600">{r.seller.address}</p>}
        {r.seller.gstin && <p className="text-center text-slate-600">GSTIN {r.seller.gstin}</p>}
        <hr />
        <p className="text-center font-semibold tracking-[0.2em]">PAYMENT RECEIPT</p>
        <div className="mt-3">
          <Line label="Receipt no." value={r.receiptNo} />
          <Line label="Issued" value={dateTime(r.issuedAt)} />
        </div>
        <hr />
        <p className="text-slate-600">Received from</p>
        <p className="font-semibold">{r.customer.name}</p>
        <p className="text-slate-600">
          {r.customer.phone}
          {r.customer.email ? ` · ${r.customer.email}` : ''}
        </p>
        <hr />
        <Line label={r.description} value={money(r.baseAmount, 'INR', { decimals: true })} />
        <Line label="GST" value={money(r.taxAmount, 'INR', { decimals: true })} />
        <div className="mt-3 flex items-baseline justify-between gap-6 border-y-2 border-ink py-2.5">
          <span className="font-semibold">TOTAL PAID</span>
          <span className="text-lg font-semibold tabular-nums">{money(r.total, 'INR', { decimals: true })}</span>
        </div>
        {r.refundedAmount > 0 && (
          <div className="mt-2 text-violet-700">
            <Line label="Refunded" value={`−${money(r.refundedAmount, 'INR', { decimals: true })}`} />
          </div>
        )}
        <hr />
        <p className="text-slate-600">
          Paid via {r.provider}
          {r.providerPaymentId ? ` · transaction ${r.providerPaymentId}` : ''}. This is a computer-generated receipt.
        </p>
        <div className="barcode mt-6 print:hidden" aria-hidden />
      </article>
    </div>
  );
}
