'use client';
import { Eye, FileText, FolderOpen } from 'lucide-react';
import { DOC_LABEL, dateTime, openDocument, AGREEMENT_LABEL } from '@aci/web-shared';
import { useApi } from '@aci/web-shared/hooks';
import { Card, EmptyState, PageHeader, PageLoader, StatusBadge } from '@aci/web-shared/ui';
import type { Envelope, MeResponse } from '@/lib/types';

export default function DocumentsPage() {
  const { data: me } = useApi<MeResponse>('/athletes/me');
  const { data: envelopes } = useApi<Envelope[]>('/esign/envelopes/mine');
  if (!me || !envelopes) return <PageLoader />;
  const signed = envelopes.filter((e) => e.signedDocumentId);

  return (
    <div className="space-y-6">
      <PageHeader title="Documents" subtitle="Your uploaded documents and signed agreements. Links open securely and expire after a few minutes." />
      <Card title="Signed agreements" padded={false}>
        {signed.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No signed agreements yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {signed.map((e) => (
              <li key={e.id} className="flex items-center gap-4 px-5 py-3">
                <FileText className="size-5 text-accent-600" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">{e.title}</p>
                  <p className="text-xs text-slate-500">{AGREEMENT_LABEL[e.agreementType]} · signed {dateTime(e.signedAt)}</p>
                </div>
                <button onClick={() => openDocument(e.signedDocumentId!)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Open">
                  <Eye className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Profile documents" padded={false}>
        {me.profile.documents.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={<FolderOpen className="size-8" />} title="No documents uploaded" />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {me.profile.documents.map((d) => (
              <li key={d.id} className="flex items-center gap-4 px-5 py-3">
                <FileText className="size-5 text-slate-400" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">{DOC_LABEL[d.type] ?? d.type}</p>
                  {d.remarks && <p className="text-xs text-red-600">{d.remarks}</p>}
                </div>
                <StatusBadge status={d.verificationStatus} />
                <button onClick={() => openDocument(d.documentId)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Open">
                  <Eye className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
