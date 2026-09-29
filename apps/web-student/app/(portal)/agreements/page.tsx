'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Download, FileSignature, PenLine } from 'lucide-react';
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
        <div className="mb-8 space-y-3">
          <Alert tone="warning" title={`${open.length} agreement${open.length > 1 ? 's' : ''} to sign`}>
            Please read each agreement carefully before signing. Signing is legally binding.
          </Alert>
          {open.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-amber-200">
              <span className="rounded-xl bg-amber-50 p-3 text-amber-600">
                <FileSignature className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{e.title}</p>
                <p className="text-sm text-slate-500">
                  {AGREEMENT_LABEL[e.agreementType]} · sign by {date(e.expiresAt)}
                  {e.guardian ? ` · co-signed by ${e.guardian.name}` : ''}
                </p>
              </div>
              <StatusBadge status={e.status} />
              <Button loading={busy === e.id} onClick={() => sign(e)} icon={<PenLine className="size-4" />}>
                Review & sign
              </Button>
              {e.guardian && e.provider === 'DOCUSIGN' && (
                <Button variant="secondary" loading={busy === e.id} onClick={() => sign(e, 'guardian')}>
                  Guardian signs
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {data.length === 0 ? (
        <EmptyState icon={<FileSignature className="size-8" />} title="No agreements yet">
          When a university approves your application, your agreements appear here for signing.
        </EmptyState>
      ) : (
        done.length > 0 && (
          <Card title="Signed & past agreements" padded={false}>
            <ul className="divide-y divide-slate-100">
              {done.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{e.title}</p>
                    <p className="text-xs text-slate-500">
                      {e.signedAt ? `Signed ${dateTime(e.signedAt)}` : `Sent ${date(e.sentAt)}`} · template v{e.templateVersion}
                    </p>
                  </div>
                  <StatusBadge status={e.status} />
                  {e.signedDocumentId && (
                    <Button size="sm" variant="secondary" icon={<Download className="size-4" />} onClick={() => openDocument(e.signedDocumentId!)}>
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
