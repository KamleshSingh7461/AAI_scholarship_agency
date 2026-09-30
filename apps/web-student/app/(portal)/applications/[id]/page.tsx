'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiPost, dateTime, money, statusLabel } from '@aci/web-shared';
import { useApi } from '@aci/web-shared/hooks';
import { Alert, Button, Card, Modal, PageHeader, PageLoader, StatusBadge, Textarea, useToast } from '@aci/web-shared/ui';
import { BackLink, Ledger } from '@/components/race';
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
      <BackLink href="/applications">My applications</BackLink>
      <PageHeader
        breadcrumb={<span className="eyebrow">{a.applicationNo}</span>}
        title={a.programName}
        subtitle={a.universityName}
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
        <Alert tone="warning" className="mb-8" title="Pay the application fee to submit your application">
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <span>
              {money(a.feeTotalInr, 'INR')} ({a.feeExplanation} {money(a.feeBaseInr, 'INR')} + GST {money(a.feeTaxInr, 'INR')})
            </span>
            <Button size="sm" loading={paying} onClick={pay}>
              Pay now <span className="arrow">→</span>
            </Button>
          </div>
        </Alert>
      )}
      {a.status === 'AGREEMENTS_PENDING' && (
        <Alert tone="success" className="mb-8" title="Congratulations — the university approved you!">
          Sign your Scholarship Award Agreement and Agency Agreement to activate your scholarship.{' '}
          <Link href="/agreements" className="font-semibold underline">
            Sign now →
          </Link>
        </Alert>
      )}
      {terminalBad && a.rejectionReason && (
        <Alert tone="error" className="mb-8" title={statusLabel(a.status)}>
          {a.rejectionReason}
        </Alert>
      )}

      {!terminalBad && a.status !== 'PAYMENT_PENDING' && (
        <section className="mb-10" aria-label="Application progress">
          <div className="eyebrow mb-3 flex justify-between text-[0.66rem] text-slate-500">
            <span>Race splits</span>
            <span>
              {Math.max(idx + 1, 0)} of {FLOW.length}
            </span>
          </div>
          <ol className="grid grid-cols-6 gap-1.5">
            {FLOW.map((s, i) => (
              <li key={s} aria-current={i === idx ? 'step' : undefined}>
                <div className="split" data-state={i < idx || a.status === 'AWARDED' ? 'done' : i === idx ? 'current' : undefined} />
                <p className={`eyebrow mt-2.5 text-[0.66rem] ${i <= idx ? 'text-ink' : 'text-slate-400'}`}>
                  {String(i + 1).padStart(2, '0')}
                  <span className="hidden md:inline"> {FLOW_LABEL[s]}</span>
                </p>
              </li>
            ))}
          </ol>
          <p className="eyebrow mt-3 text-[0.66rem] md:hidden">Now: {FLOW_LABEL[a.status] ?? statusLabel(a.status)}</p>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Scholarship">
          <Ledger
            rows={[
              ['University', a.universityName],
              ['Intake', a.academicYear],
              ['Duration', `${a.durationYears} years`],
              ['Value per year', money(a.annualValue, a.currency)],
              ['Total value', <span key="t" className="text-accent-700">{money(a.totalValue, a.currency)}</span>],
              ['Fee', a.feeTotalInr ? `${money(a.feeTotalInr, 'INR')} · ${statusLabel(a.paymentStatus)}` : 'None'],
            ]}
          />
          {a.award && (
            <Link href="/agreements" className="group mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[4px] bg-ink px-4 py-3 text-paper">
              <span className="eyebrow text-[0.66rem] text-paper/70">
                Scholarship <span className="text-paper">{a.award.awardNo}</span>
              </span>
              <span className="flex items-center gap-3">
                <StatusBadge status={a.award.status} />
                <span className="arrow">→</span>
              </span>
            </Link>
          )}
        </Card>
        <Card title="Timeline">
          <ol className="relative space-y-6 border-l-2 border-ink/15 pl-6">
            {a.history?.map((h) => (
              <li key={h.id} className="relative">
                <span className="absolute -left-[31px] top-1.5 size-2.5 bg-brand-600" aria-hidden />
                <p className="eyebrow text-[0.62rem] text-slate-500">{dateTime(h.createdAt)}</p>
                <p className="mt-1 font-semibold">{statusLabel(h.toStatus)}</p>
                {h.note && <p className="text-sm text-slate-600">{h.note}</p>}
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
