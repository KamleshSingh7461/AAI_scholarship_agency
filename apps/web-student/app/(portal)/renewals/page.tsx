'use client';
import Link from 'next/link';
import { useState } from 'react';
import { CalendarCheck2, CheckCircle2, Circle, RefreshCw } from 'lucide-react';
import { apiPost, date, daysUntil, money } from '@aci/web-shared';
import { mutate, useApi } from '@aci/web-shared/hooks';
import { Alert, Button, Card, Checkbox, EmptyState, Field, Input, Modal, PageHeader, PageLoader, StatusBadge, useToast } from '@aci/web-shared/ui';
import { FileUpload } from '@/components/file-upload';
import type { AwardYear, Envelope } from '@/lib/types';

function Step({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent-600" /> : <Circle className="mt-0.5 size-4 shrink-0 text-slate-300" />}
      <span className={done ? 'text-slate-500 line-through' : 'text-slate-800'}>{children}</span>
    </li>
  );
}

export default function RenewalsPage() {
  const toast = useToast();
  const { data: years } = useApi<AwardYear[]>('/renewals/mine');
  const { data: envelopes } = useApi<Envelope[]>('/esign/envelopes/mine');
  const [open, setOpen] = useState<AwardYear | null>(null);
  const [f, setF] = useState({ enrollmentConfirmed: false, policyAcknowledged: false, currentCourse: '', currentSemester: '', academicScore: '', documentId: '' });
  const [busy, setBusy] = useState(false);

  if (!years || !envelopes) return <PageLoader />;

  const submit = async () => {
    if (!open) return;
    setBusy(true);
    try {
      const body = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''));
      await apiPost(`/renewals/${open.id}/registration`, body);
      toast.success('Registration submitted — now sign your renewal agreements');
      setOpen(null);
      void mutate(() => true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Yearly renewals"
        subtitle="A scholarship does not renew itself. Every year you register and sign again online to keep receiving it — no signature, no scholarship that year."
      />
      <div className="mb-8 grid gap-3 sm:grid-cols-4">
        {[
          ['1', '30 days before', 'We text and email you a reminder'],
          ['2', 'Register', 'Confirm enrolment and the university policy'],
          ['3', 'Sign', 'Sign the renewal of both agreements'],
          ['!', 'If you don’t', 'Your scholarship is paused (suspended)'],
        ].map(([n, t, d]) => (
          <div key={t} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <span className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${n === '!' ? 'bg-red-100 text-red-700' : 'bg-brand-50 text-brand-700'}`}>{n}</span>
            <p className="mt-3 text-sm font-semibold text-slate-900">{t}</p>
            <p className="text-xs text-slate-500">{d}</p>
          </div>
        ))}
      </div>

      {years.length === 0 ? (
        <EmptyState icon={<RefreshCw className="size-8" />} title="No renewals yet">
          Once your scholarship is active, each year’s renewal appears here.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {years.map((y) => {
            const yearEnvs = envelopes.filter((e) => e.referenceId === y.id);
            const openEnvs = yearEnvs.filter((e) => ['SENT', 'VIEWED'].includes(e.status));
            const actionable = ['DUE', 'OVERDUE', 'SUSPENDED'].includes(y.status);
            const d = daysUntil(y.dueDate);
            return (
              <Card key={y.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{y.award?.universityName}</p>
                    <h3 className="text-lg font-bold text-slate-900">
                      Year {y.yearNumber} · {y.academicYear}
                    </h3>
                    <p className="text-sm text-slate-500">
                      Anniversary {date(y.dueDate)} · {money(y.amount, y.award?.currency ?? 'INR')} this year
                      {actionable && ` · ${d >= 0 ? `due in ${d} days` : `${-d} days overdue`}`}
                    </p>
                  </div>
                  <StatusBadge status={y.status} />
                </div>
                {actionable && (
                  <>
                    {y.status !== 'DUE' && (
                      <Alert tone="error" className="mt-4">
                        Complete this renewal by {date(y.deadline)} or your scholarship will be (or stays) suspended.
                      </Alert>
                    )}
                    <ol className="mt-4 space-y-2">
                      <Step done={!!y.registrationSubmittedAt}>Annual registration (enrolment + policy confirmation)</Step>
                      <Step done={!!y.scholarshipSignedAt}>Sign the Scholarship Agreement renewal</Step>
                      <Step done={!!y.agencySignedAt}>Sign the Agency Agreement renewal</Step>
                    </ol>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {!y.registrationSubmittedAt && (
                        <Button onClick={() => setOpen(y)} icon={<CalendarCheck2 className="size-4" />}>
                          Register for Year {y.yearNumber}
                        </Button>
                      )}
                      {openEnvs.length > 0 && (
                        <Link href="/agreements">
                          <Button variant={y.registrationSubmittedAt ? 'primary' : 'secondary'}>Sign {openEnvs.length} renewal agreement(s)</Button>
                        </Link>
                      )}
                    </div>
                  </>
                )}
                {y.status === 'RENEWED' && <p className="mt-3 text-sm text-accent-700">Renewed on {date(y.renewedAt)}.</p>}
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title={`Register for Year ${open?.yearNumber}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button>
            <Button loading={busy} disabled={!f.enrollmentConfirmed || !f.policyAcknowledged} onClick={submit}>
              Submit registration
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Course"><Input value={f.currentCourse} onChange={(e) => setF({ ...f, currentCourse: e.target.value })} placeholder="B.Tech" /></Field>
            <Field label="Semester / year"><Input value={f.currentSemester} onChange={(e) => setF({ ...f, currentSemester: e.target.value })} /></Field>
            <Field label="Last result"><Input value={f.academicScore} onChange={(e) => setF({ ...f, academicScore: e.target.value })} placeholder="7.8 CGPA" /></Field>
          </div>
          <FileUpload label="Bonafide certificate / latest marksheet" subType="RENEWAL_BONAFIDE" documentId={f.documentId || null} onUploaded={(id) => setF({ ...f, documentId: id })} />
          <Checkbox checked={f.enrollmentConfirmed} onChange={(e) => setF({ ...f, enrollmentConfirmed: e.target.checked })} label="I confirm I am enrolled at the university for this academic year." />
          <Checkbox checked={f.policyAcknowledged} onChange={(e) => setF({ ...f, policyAcknowledged: e.target.checked })} label="I will continue to comply with the university's scholarship, academic and athletic policies." />
        </div>
      </Modal>
    </div>
  );
}
