'use client';
import { DOC_LABEL, dateTime, openDocument, AGREEMENT_LABEL } from '@aci/web-shared';
import { useApi } from '@aci/web-shared/hooks';
import { Card, EmptyState, PageHeader, PageLoader, StatusBadge } from '@aci/web-shared/ui';
import type { Envelope, MeResponse } from '@/lib/types';

function OpenButton({ id }: { id: string }) {
  return (
    <button onClick={() => openDocument(id)} className="eyebrow link-grow text-[0.66rem] text-ink">
      Open →
    </button>
  );
}

export default function DocumentsPage() {
  const { data: me } = useApi<MeResponse>('/athletes/me');
  const { data: envelopes } = useApi<Envelope[]>('/esign/envelopes/mine');
  if (!me || !envelopes) return <PageLoader />;
  const signed = envelopes.filter((e) => e.signedDocumentId);

  return (
    <div className="space-y-8">
      <PageHeader title="Documents" subtitle="Your uploaded documents and signed agreements. Links open securely and expire after a few minutes." />
      <Card title={`Signed agreements · ${signed.length}`} padded={false}>
        {signed.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No signed agreements yet.</p>
        ) : (
          <ul className="divide-y divide-dashed divide-ink/15">
            {signed.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-4">
                <span className="h-9 w-1 shrink-0 bg-accent-600" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{e.title}</p>
                  <p className="eyebrow mt-1 text-[0.62rem] text-slate-500">
                    {AGREEMENT_LABEL[e.agreementType]} · signed {dateTime(e.signedAt)}
                  </p>
                </div>
                <OpenButton id={e.signedDocumentId!} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={`Profile documents · ${me.profile.documents.length}`} padded={false}>
        {me.profile.documents.length === 0 ? (
          <div className="p-5">
            <EmptyState title="Nothing uploaded">Documents you add while completing your profile appear here.</EmptyState>
          </div>
        ) : (
          <ul className="divide-y divide-dashed divide-ink/15">
            {me.profile.documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-4">
                <span className={`h-9 w-1 shrink-0 ${d.verificationStatus === 'VERIFIED' ? 'bg-accent-600' : d.verificationStatus === 'REJECTED' ? 'bg-brand-600' : 'bg-ink/20'}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{DOC_LABEL[d.type] ?? d.type}</p>
                  {d.remarks && <p className="text-sm text-brand-700">{d.remarks}</p>}
                </div>
                <StatusBadge status={d.verificationStatus} />
                <OpenButton id={d.documentId} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
