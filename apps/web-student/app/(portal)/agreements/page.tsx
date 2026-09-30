'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AGREEMENT_LABEL, apiPost, date, dateTime, openDocument } from '@aci/web-shared';
import { useApi } from '@aci/web-shared/hooks';
import { Alert, Button, Card, EmptyState, PageHeader, PageLoader, StatusBadge, useToast } from '@aci/web-shared/ui';
import type { Envelope } from '@/lib/types';

export default function AgreementsPage() {
  const router = useRouter();
  const toast = useToast();
  const { data } = useApi<Envelope[]>('/esign/envelopes/mine');
  const [busy, setBusy] = useState<string | null>(null);

  if (!data) return <PageLoader />;
  const open = data.filter((e) => ['SENT', 'VIEWED'].includes(e.status));
  const done = data.filter((e) => !['SENT', 'VIEWED', 'CREATED'].includes(e.status));

  const sign = async (e: Envelope, as: 'signer' | 'guardian' = 'signer') => {
    setBusy(e.id);
    try {
      const r = await apiPost<{ url: string; provider: string }>(`/esign/envelopes/mine/${e.id}/session`, { as });
      if (r.provider === 'MOCK') router.push(`/agreements/${e.id}/sign`);
      else window.location.href = r.url; // DocuSign embedded signing, returns to /agreements/return
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Agreements"
        subtitle="Every scholarship needs two signed agreements — the Scholarship Award Agreement and the Agency Agreement — before it starts, and again every year to renew."
      />
      {open.length > 0 && (
        <section className="mb-12">
          <Alert tone="warning" title={`${open.length} agreement${open.length > 1 ? 's' : ''} to sign`}>
            Please read each agreement carefully before signing. Signing is legally binding.
          </Alert>
          <ul className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            {open.map((e) => (
              <li key={e.id} className="flex flex-col overflow-hidden rounded-[8px] bg-chalk shadow-[0_0_0_1px_rgb(18_17_16/0.08),0_14px_28px_-24px_rgb(18_17_16/0.45)]">
                <div className="flex items-center justify-between gap-3 bg-brand-600 px-5 py-2.5 text-white">
                  <span className="eyebrow text-[0.62rem]">To sign</span>
                  <span className="eyebrow text-[0.62rem] text-white/85">By {date(e.expiresAt)}</span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="eyebrow text-[0.62rem] text-slate-500">{AGREEMENT_LABEL[e.agreementType]}</p>
                  <p className="mt-2 text-xl font-bold leading-snug">{e.title}</p>
                  {e.guardian && <p className="mt-1 text-sm text-slate-600">Co-signed by {e.guardian.name}</p>}
                  <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
                    <Button loading={busy === e.id} onClick={() => sign(e)}>
                      Review &amp; sign <span className="arrow">→</span>
                    </Button>
                    {e.guardian && e.provider === 'DOCUSIGN' && (
                      <Button variant="secondary" loading={busy === e.id} onClick={() => sign(e, 'guardian')}>
                        Guardian signs
                      </Button>
                    )}
                    <span className="ml-auto">
                      <StatusBadge status={e.status} />
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {data.length === 0 ? (
        <EmptyState title="No agreements yet">When a university approves your application, your agreements appear here for signing.</EmptyState>
      ) : (
        done.length > 0 && (
          <Card title="Signed & past agreements" padded={false}>
            <ul className="divide-y divide-dashed divide-ink/15">
              {done.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{e.title}</p>
                    <p className="eyebrow mt-1 text-[0.62rem] text-slate-500">
                      {e.signedAt ? `Signed ${dateTime(e.signedAt)}` : `Sent ${date(e.sentAt)}`} · template v{e.templateVersion}
                    </p>
                  </div>
                  <StatusBadge status={e.status} />
                  {e.signedDocumentId && (
                    <Button size="sm" variant="secondary" onClick={() => openDocument(e.signedDocumentId!)}>
                      Signed copy
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )
      )}
    </div>
  );
}
