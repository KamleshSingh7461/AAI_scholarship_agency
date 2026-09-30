'use client';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiPost, openDocument } from '@aci/web-shared';
import { mutate, useApi } from '@aci/web-shared/hooks';
import { Alert, Button, Checkbox, Modal, PageLoader, Textarea, useToast } from '@aci/web-shared/ui';
import { AgreementText } from '@/components/agreement-text';
import { BackLink } from '@/components/race';
import type { Envelope } from '@/lib/types';

type Detail = Envelope & { content: { title: string; body: string; templateVersion: number; sha256: string }; provider: string };

function SignatureLine({ label, value, onChange, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; hint?: string }) {
  return (
    <label className="block">
      <input
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        placeholder={placeholder}
        required
        className="block w-full border-0 border-b-2 border-ink bg-transparent px-1 pb-2 pt-4 font-serif text-3xl italic text-ink placeholder:text-slate-300 focus:border-brand-600 focus:outline-none"
      />
      <span className="eyebrow mt-2 block text-[0.62rem] text-slate-500">{label}</span>
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

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
      <BackLink href="/agreements">Agreements</BackLink>
      {e.provider === 'MOCK' && (
        <Alert tone="warning" className="mb-6" title="Test signing (local environment)">
          In production this step opens DocuSign. Here you sign by typing your name.
        </Alert>
      )}

      <article className="rounded-[4px] bg-chalk px-6 pb-10 pt-6 shadow-[0_0_0_1px_rgb(18_17_16/0.08),0_24px_40px_-30px_rgb(18_17_16/0.5)] sm:px-12">
        <div className="eyebrow mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-ink/20 pb-4 text-[0.62rem] text-slate-500">
          <span>
            Template v{e.content.templateVersion} · fingerprint {e.content.sha256.slice(0, 16)}…
          </span>
          {e.unsignedDocumentId && (
            <button className="link-grow text-ink" onClick={() => openDocument(e.unsignedDocumentId!)}>
              Download PDF ↓
            </button>
          )}
        </div>
        <AgreementText body={e.content.body} />
      </article>

      {open ? (
        <section className="mt-8 rounded-[8px] bg-chalk p-6 shadow-[0_0_0_1px_rgb(18_17_16/0.08)] sm:p-8">
          <p className="eyebrow text-brand-600">Sign this agreement</p>
          <div className="mt-2 space-y-6">
            <SignatureLine label={`Type your full name exactly as "${e.signerName}"`} value={typed} onChange={setTyped} placeholder={e.signerName} />
            {e.guardian && (
              <SignatureLine
                label={`Parent / guardian — ${e.guardian.name} — types their full name`}
                hint="Your guardian must be with you and sign in person."
                value={guardianTyped}
                onChange={setGuardianTyped}
                placeholder={e.guardian.name}
              />
            )}
            <Checkbox
              checked={agree}
              onChange={(ev) => setAgree(ev.target.checked)}
              label="I have read this agreement. I agree to sign it electronically and that my typed name is my legal signature."
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-ink/20 pt-5">
              <button className="text-sm font-semibold text-slate-500 hover:text-brand-600" onClick={() => setDeclineOpen(true)}>
                Decline to sign
              </button>
              <Button size="lg" loading={busy} disabled={!agree || !typed || (!!e.guardian && !guardianTyped)} onClick={sign}>
                Sign agreement <span className="arrow">→</span>
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <Alert tone="info" className="mt-6">
          This agreement is {e.status.toLowerCase()}.
        </Alert>
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
