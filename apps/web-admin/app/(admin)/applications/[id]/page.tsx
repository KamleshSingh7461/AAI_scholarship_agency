'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Building2, Send, ThumbsDown, ThumbsUp, Trophy } from 'lucide-react';
import { apiPost, dateTime, money, statusLabel } from '@aci/web-shared';
import { useAuth } from '@aci/web-shared/auth';
import { useApi } from '@aci/web-shared/hooks';
import { Alert, Button, Card, Field, Modal, PageHeader, PageLoader, StatusBadge, Textarea, useToast } from '@aci/web-shared/ui';
import { AthleteDossier } from '@/components/athlete-dossier';
import { FileButton } from '@/components/file-button';
import { Money } from '@/components/money';
import type { Application } from '@/lib/types';

type Dialog = null | { kind: 'reject' | 'forward' | 'review' | 'approve' | 'uni-reject'; note: string; documentId?: string; fileName?: string };

export default function ApplicationReviewPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const { data: a, mutate } = useApi<Application>(`/applications/${id}`);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  if (!a) return <PageLoader />;
  const role = user?.role ?? '';
  const staff = ['SUPER_ADMIN', 'ADMIN', 'REVIEWER'].includes(role);
  const canDecide = ['SUPER_ADMIN', 'ADMIN', 'UNIVERSITY_REP'].includes(role);

  const act = async () => {
    if (!dialog) return;
    setBusy(true);
    try {
      const path = {
        review: ['review', { note: dialog.note || undefined }],
        forward: ['forward', { note: dialog.note || undefined }],
        reject: ['reject', { reason: dialog.note }],
        approve: ['university-decision', { decision: 'APPROVED', note: dialog.note || undefined, documentId: dialog.documentId }],
        'uni-reject': ['university-decision', { decision: 'REJECTED', note: dialog.note || undefined, documentId: dialog.documentId }],
      }[dialog.kind] as [string, object];
      await apiPost(`/applications/${id}/${path[0]}`, path[1]);
      toast.success('Application updated');
      setDialog(null);
      void mutate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addNote = async () => {
    try {
      await apiPost(`/applications/${id}/notes`, { body: note });
      setNote('');
      void mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const titles: Record<string, string> = {
    review: 'Start review',
    forward: 'Forward to university',
    reject: 'Reject application',
    approve: 'Record university APPROVAL',
    'uni-reject': 'Record university REJECTION',
  };

  return (
    <div className="space-y-6">
      <Link href="/applications" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> Applications
      </Link>
      <PageHeader
        title={`${a.athleteName} → ${a.programName}`}
        subtitle={`${a.applicationNo} · ${a.universityName} · ${a.sport ?? ''}`}
        actions={
          <>
            <StatusBadge status={a.status} />
            {staff && a.status === 'SUBMITTED' && <Button size="sm" onClick={() => setDialog({ kind: 'review', note: '' })}>Start review</Button>}
            {staff && a.status === 'UNDER_REVIEW' && (
              <Button size="sm" icon={<Send className="size-4" />} onClick={() => setDialog({ kind: 'forward', note: '' })}>
                Forward to university
              </Button>
            )}
            {staff && ['SUBMITTED', 'UNDER_REVIEW'].includes(a.status) && (
              <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: 'reject', note: '' })}>Reject</Button>
            )}
            {canDecide && a.status === 'FORWARDED_TO_UNIVERSITY' && (
              <>
                <Button size="sm" variant="success" icon={<ThumbsUp className="size-4" />} onClick={() => setDialog({ kind: 'approve', note: '' })}>
                  University approved
                </Button>
                <Button size="sm" variant="danger" icon={<ThumbsDown className="size-4" />} onClick={() => setDialog({ kind: 'uni-reject', note: '' })}>
                  University rejected
                </Button>
              </>
            )}
          </>
        }
      />

      {a.status === 'FORWARDED_TO_UNIVERSITY' && (
        <Alert tone="info" title="Waiting for the university's final decision">
          The university keeps the absolute right to accept or reject. Record its decision here (attach the approval letter if you have one). Approval reserves a seat and sends
          both agreements to the athlete.
        </Alert>
      )}
      {a.award && (
        <Alert tone={a.award.status === 'PENDING_SIGNATURE' ? 'warning' : 'success'} title={`Scholarship ${a.award.awardNo}: ${statusLabel(a.award.status)}`}>
          <Link href={`/students/${a.award.id}`} className="font-semibold underline">Open scholarship record →</Link>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title="Application">
            <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div><dt className="text-xs text-slate-500">Total value</dt><dd className="font-semibold"><Money minor={a.totalValue} currency={a.currency} rate4={a.usdInrRate4} /></dd></div>
              <div><dt className="text-xs text-slate-500">Per year</dt><dd className="font-semibold">{money(a.annualValue, a.currency)}</dd></div>
              <div><dt className="text-xs text-slate-500">Duration</dt><dd className="font-semibold">{a.durationYears} years ({a.academicYear})</dd></div>
              <div><dt className="text-xs text-slate-500">Fee</dt><dd className="font-semibold">{money(a.feeTotalInr, 'INR')} · {statusLabel(a.paymentStatus)}</dd></div>
            </dl>
            {a.preferredCourse && <p className="mt-4 text-sm"><span className="text-slate-500">Preferred course:</span> {a.preferredCourse}</p>}
            {a.statement && <blockquote className="mt-4 rounded-xl bg-slate-50 p-4 text-sm italic text-slate-700">“{a.statement}”</blockquote>}
          </Card>
          {role !== 'UNIVERSITY_REP' || a.status !== 'PAYMENT_PENDING' ? <AthleteDossier profileId={a.athleteProfileId} canReview={staff} /> : null}
        </div>

        <div className="space-y-6">
          <Card title="History">
            <ol className="relative space-y-4 border-l border-slate-200 pl-5">
              {a.history?.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute -left-[26px] top-1 size-3 rounded-full bg-white ring-2 ring-brand-500" />
                  <p className="text-sm font-semibold text-slate-900">{statusLabel(h.toStatus)}</p>
                  {h.note && <p className="text-xs text-slate-600">{h.note}</p>}
                  <p className="text-[11px] text-slate-400">
                    {dateTime(h.createdAt)} · {statusLabel(h.actorRole)}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
          {role !== 'UNIVERSITY_REP' && (
            <Card title="Internal notes" subtitle="Never visible to the athlete or the university">
              <div className="space-y-3">
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" />
                <Button size="sm" disabled={!note} onClick={addNote}>Add note</Button>
                <ul className="space-y-3">
                  {a.notes?.map((n) => (
                    <li key={n.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                      <p className="text-slate-800">{n.body}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{n.authorName} · {dateTime(n.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Modal
        open={!!dialog}
        onClose={() => setDialog(null)}
        title={dialog ? titles[dialog.kind] : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant={dialog?.kind === 'reject' || dialog?.kind === 'uni-reject' ? 'danger' : dialog?.kind === 'approve' ? 'success' : 'primary'}
              loading={busy}
              disabled={dialog?.kind === 'reject' && (dialog.note?.length ?? 0) < 3}
              onClick={act}
            >
              Confirm
            </Button>
          </>
        }
      >
        {dialog && (
          <div className="space-y-4">
            {dialog.kind === 'approve' && (
              <Alert tone="info" title="What happens next">
                A seat is reserved in the program, the scholarship is created in <em>Pending signature</em>, and the athlete gets WhatsApp + email to sign both agreements.
              </Alert>
            )}
            <Field label={dialog.kind === 'reject' ? 'Reason (sent to the athlete)' : 'Note'}>
              <Textarea value={dialog.note} onChange={(e) => setDialog({ ...dialog, note: e.target.value })} />
            </Field>
            {(dialog.kind === 'approve' || dialog.kind === 'uni-reject') && (
              <Field label="University letter (optional)">
                <div className="flex items-center gap-3">
                  <FileButton
                    label={dialog.fileName ?? 'Attach letter'}
                    category="UNIVERSITY_LETTER"
                    subType="APPLICATION_DECISION"
                    onUploaded={(documentId, fileName) => setDialog({ ...dialog, documentId, fileName })}
                  />
                  <Building2 className="size-4 text-slate-400" />
                </div>
              </Field>
            )}
            {dialog.kind === 'approve' && <p className="flex items-center gap-2 text-xs text-slate-500"><Trophy className="size-4" /> Revenue is booked only when the athlete signs both agreements.</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
