'use client';
import { useParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import { dateTime, money } from '@aci/web-shared';
import { useApi } from '@aci/web-shared/hooks';
import { Button, PageLoader } from '@aci/web-shared/ui';

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

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const { data: r } = useApi<Receipt>(`/payments/${id}/receipt`);
  if (!r) return <PageLoader />;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex justify-end print:hidden">
        <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => window.print()}>
          Print / save as PDF
        </Button>
      </div>
      <div className="rounded-2xl bg-white p-8 ring-1 ring-slate-200 print:ring-0">
        <div className="flex items-start justify-between border-b border-slate-200 pb-6">
          <div>
            <p className="text-lg font-black text-slate-900">{r.seller.brand}</p>
            <p className="text-sm text-slate-500">{r.seller.legalName}</p>
            {r.seller.address && <p className="text-xs text-slate-500">{r.seller.address}</p>}
            {r.seller.gstin && <p className="text-xs text-slate-500">GSTIN {r.seller.gstin}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Payment receipt</p>
            <p className="font-mono text-sm">{r.receiptNo}</p>
            <p className="text-xs text-slate-500">{dateTime(r.issuedAt)}</p>
          </div>
        </div>
        <div className="py-6 text-sm">
          <p className="text-slate-500">Received from</p>
          <p className="font-semibold text-slate-900">{r.customer.name}</p>
          <p className="text-slate-500">
            {r.customer.phone}
            {r.customer.email ? ` · ${r.customer.email}` : ''}
          </p>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            <tr><td className="py-2">{r.description}</td><td className="py-2 text-right">{money(r.baseAmount, 'INR', { decimals: true })}</td></tr>
            <tr><td className="py-2 text-slate-500">GST</td><td className="py-2 text-right">{money(r.taxAmount, 'INR', { decimals: true })}</td></tr>
            <tr className="font-bold"><td className="py-3">Total paid</td><td className="py-3 text-right">{money(r.total, 'INR', { decimals: true })}</td></tr>
            {r.refundedAmount > 0 && <tr className="text-violet-700"><td className="py-2">Refunded</td><td className="py-2 text-right">−{money(r.refundedAmount, 'INR', { decimals: true })}</td></tr>}
          </tbody>
        </table>
        <p className="mt-6 text-xs text-slate-500">
          Paid via {r.provider}
          {r.providerPaymentId ? ` · transaction ${r.providerPaymentId}` : ''}. This is a computer-generated receipt.
        </p>
      </div>
    </div>
  );
}
