'use client';
import clsx from 'clsx';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, CreditCard, FileSignature } from 'lucide-react';
import { apiPost, dateTime, money, statusLabel } from '@aci/web-shared';
import { useApi } from '@aci/web-shared/hooks';
import { Alert, Button, Card, Modal, PageHeader, PageLoader, StatusBadge, Textarea, useToast } from '@aci/web-shared/ui';
import { startCheckout, type PaymentOrderResponse } from '@/lib/checkout';
import type { Application } from '@/lib/types';

const FLOW = ['SUBMITTED', 'UNDER_REVIEW', 'FORWARDED_TO_UNIVERSITY', 'UNIVERSITY_APPROVED', 'AGREEMENTS_PENDING', 'AWARDED'];
const FLOW_LABEL: Record<string, string> = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Review',
  FORWARDED_TO_UNIVERSITY: 'University',
  UNIVERSITY_APPROVED: 'Approved',
  AGREEMENTS_PENDING: 'Sign',
  AWARDED: 'Awarded',
};

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { data: a, mutate } = useApi<Application>(`/applications/mine/${id}`);
  const [paying, setPaying] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [reason, setReason] = useState('');

  if (!a) return <PageLoader />;
  const idx = FLOW.indexOf(a.status);
  const terminalBad = ['REJECTED', 'UNIVERSITY_REJECTED', 'WITHDRAWN', 'EXPIRED'].includes(a.status);

  const pay = async () => {
    setPaying(true);
    try {
      const order = await apiPost<PaymentOrderResponse>(`/applications/mine/${a.id}/pay`);
      await startCheckout(order, (u) => router.push(u));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPaying(false);
    }
  };

  const withdraw = async () => {
    try {
      await apiPost(`/applications/mine/${a.id}/withdraw`, { note: reason || undefined });
      toast.success('Application withdrawn');
      setWithdrawOpen(false);
      void mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div>
      <Link href="/applications" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> My applications
      </Link>
      <PageHeader
        title={a.programName}
        subtitle={`${a.universityName} · ${a.applicationNo}`}
        actions={
          <>
            <StatusBadge status={a.status} />
            {!terminalBad && a.status !== 'AWARDED' && (
              <Button variant="ghost" size="sm" onClick={() => setWithdrawOpen(true)}>
                Withdraw
              </Button>
            )}
          </>
        }
      />

      {a.status === 'PAYMENT_PENDING' && (
        <Alert tone="warning" className="mb-6" title="Pay the application fee to submit your application">
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <span>
              {money(a.feeTotalInr, 'INR')} ({a.feeExplanation} {money(a.feeBaseInr, 'INR')} + GST {money(a.feeTaxInr, 'INR')})
            </span>
            <Button size="sm" loading={paying} onClick={pay} icon={<CreditCard className="size-4" />}>
              Pay now
            </Button>
          </div>
        </Alert>
      )}
      {a.status === 'AGREEMENTS_PENDING' && (
        <Alert tone="success" className="mb-6" title="Congratulations — the university approved you!">
          Sign your Scholarship Award Agreement and Agency Agreement to activate your scholarship.{' '}
          <Link href="/agreements" className="font-semibold underline">
            Sign now →
          </Link>
        </Alert>
      )}
      {terminalBad && a.rejectionReason && (
        <Alert tone="error" className="mb-6" title={statusLabel(a.status)}>
          {a.rejectionReason}
        </Alert>
      )}

      {!terminalBad && a.status !== 'PAYMENT_PENDING' && (
        <Card className="mb-6">
          <ol className="grid grid-cols-6 gap-2">
            {FLOW.map((s, i) => (
              <li key={s}>
                <div className={clsx('h-1.5 rounded-full', i <= idx ? 'bg-accent-500' : 'bg-slate-200')} />
                <p className={clsx('mt-2 text-[11px] font-semibold sm:text-xs', i <= idx ? 'text-slate-900' : 'text-slate-400')}>{FLOW_LABEL[s]}</p>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Scholarship">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-slate-500">University</dt><dd className="font-semibold">{a.universityName}</dd></div>
            <div><dt className="text-slate-500">Intake</dt><dd className="font-semibold">{a.academicYear}</dd></div>
            <div><dt className="text-slate-500">Duration</dt><dd className="font-semibold">{a.durationYears} years</dd></div>
            <div><dt className="text-slate-500">Value per year</dt><dd className="font-semibold">{money(a.annualValue, a.currency)}</dd></div>
            <div><dt className="text-slate-500">Total value</dt><dd className="font-semibold text-accent-700">{money(a.totalValue, a.currency)}</dd></div>
            <div><dt className="text-slate-500">Fee</dt><dd className="font-semibold">{a.feeTotalInr ? `${money(a.feeTotalInr, 'INR')} · ${statusLabel(a.paymentStatus)}` : 'None'}</dd></div>
          </dl>
          {a.award && (
            <Link href="/agreements" className="mt-5 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <FileSignature className="size-4" /> Scholarship {a.award.awardNo} · <StatusBadge status={a.award.status} />
            </Link>
          )}
        </Card>
        <Card title="Timeline">
          <ol className="relative space-y-5 border-l border-slate-200 pl-5">
            {a.history?.map((h) => (
              <li key={h.id} className="relative">
                <span className="absolute -left-[26px] top-1 size-3 rounded-full bg-white ring-2 ring-brand-500" />
                <p className="text-sm font-semibold text-slate-900">{statusLabel(h.toStatus)}</p>
                {h.note && <p className="text-sm text-slate-600">{h.note}</p>}
                <p className="text-xs text-slate-400">{dateTime(h.createdAt)}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Modal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        title="Withdraw application?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={withdraw}>Withdraw</Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-slate-600">This cannot be undone. Application fees are not refunded on withdrawal.</p>
        <Textarea placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </div>
  );
}
