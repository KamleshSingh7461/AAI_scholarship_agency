'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Download, ShieldCheck } from 'lucide-react';
import { apiPost, openDocument } from '@aci/web-shared';
import { mutate, useApi } from '@aci/web-shared/hooks';
import { Alert, Button, Card, Checkbox, Field, Input, Modal, PageLoader, Textarea, useToast } from '@aci/web-shared/ui';
import { AgreementText } from '@/components/agreement-text';
import type { Envelope } from '@/lib/types';

type Detail = Envelope & { content: { title: string; body: string; templateVersion: number; sha256: string }; provider: string };

/** In-app signing page (used with the local/mock e-sign provider; DocuSign uses its own embedded view). */
export default function SignPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { data: e } = useApi<Detail>(`/esign/envelopes/mine/${id}`);
  const [typed, setTyped] = useState('');
  const [guardianTyped, setGuardianTyped] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState('');

  if (!e) return <PageLoader />;
  const open = ['SENT', 'VIEWED'].includes(e.status);

  const sign = async () => {
    setBusy(true);
    try {
      await apiPost(`/esign/envelopes/mine/${id}/sign`, { typedName: typed, guardianTypedName: guardianTyped || undefined, agree });
      toast.success('Signed! A copy is saved in your Documents.');
      void mutate(() => true);
      router.push('/agreements');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    try {
      await apiPost(`/esign/envelopes/mine/${id}/decline`, { reason });
      toast.info('You declined this agreement. Our team will contact you.');
      router.push('/agreements');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/agreements" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> Agreements
      </Link>
      {e.provider === 'MOCK' && (
        <Alert tone="warning" className="mb-4" title="Test signing (local environment)">
          In production this step opens DocuSign. Here you sign by typing your name.
        </Alert>
      )}
      <Card>
        <div className="mb-6 flex items-center justify-between gap-3 border-b border-slate-100 pb-4 text-xs text-slate-500">
          <span>Template v{e.content.templateVersion} · document fingerprint {e.content.sha256.slice(0, 16)}…</span>
          {e.unsignedDocumentId && (
            <button className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:underline" onClick={() => openDocument(e.unsignedDocumentId!)}>
              <Download className="size-3.5" /> PDF
            </button>
          )}
        </div>
        <AgreementText body={e.content.body} />
      </Card>

      {open ? (
        <Card className="mt-6" title="Sign this agreement">
          <div className="space-y-4">
            <Field label={`Type your full name exactly as "${e.signerName}"`} required>
              <Input value={typed} onChange={(ev) => setTyped(ev.target.value)} className="font-serif text-lg italic" placeholder={e.signerName} />
            </Field>
            {e.guardian && (
              <Field label={`Parent / guardian — ${e.guardian.name} — types their full name`} required hint="Your guardian must be with you and sign in person.">
                <Input value={guardianTyped} onChange={(ev) => setGuardianTyped(ev.target.value)} className="font-serif text-lg italic" placeholder={e.guardian.name} />
              </Field>
            )}
            <Checkbox
              checked={agree}
              onChange={(ev) => setAgree(ev.target.checked)}
              label="I have read this agreement. I agree to sign it electronically and that my typed name is my legal signature."
            />
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button className="text-sm font-semibold text-slate-500 hover:text-red-600" onClick={() => setDeclineOpen(true)}>
                Decline to sign
              </button>
              <Button size="lg" loading={busy} disabled={!agree || !typed || (!!e.guardian && !guardianTyped)} onClick={sign} icon={<ShieldCheck className="size-4" />}>
                Sign agreement
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Alert tone="info" className="mt-6">This agreement is {e.status.toLowerCase()}.</Alert>
      )}

      <Modal
        open={declineOpen}
        onClose={() => setDeclineOpen(false)}
        title="Decline this agreement?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeclineOpen(false)}>Cancel</Button>
            <Button variant="danger" disabled={reason.length < 3} onClick={decline}>Decline</Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600">Your scholarship cannot start without both agreements. Tell us why so we can help.</p>
        <Textarea value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder="Reason" />
      </Modal>
    </div>
  );
}
