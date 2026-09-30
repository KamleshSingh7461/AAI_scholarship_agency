'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { apiPost } from '@aci/web-shared';
import { mutate } from '@aci/web-shared/hooks';
import { PageLoader } from '@aci/web-shared/ui';
import { ResultPanel } from '@/components/race';

/** DocuSign redirects here after embedded signing (?event=signing_complete|decline|cancel|ttl_expired...). */
function ReturnInner() {
  const params = useSearchParams();
  const envelopeId = params.get('envelopeId');
  const event = params.get('event');
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!envelopeId) return;
    let stop = false;
    (async () => {
      for (let i = 0; i < 8 && !stop; i++) {
        const e = await apiPost<{ status: string }>(`/esign/envelopes/mine/${envelopeId}/sync`).catch(() => null);
        if (e) setStatus(e.status);
        if (e && e.status !== 'SENT' && e.status !== 'VIEWED') break;
        if (event !== 'signing_complete') break;
        await new Promise((r) => setTimeout(r, 2500));
      }
      void mutate(() => true);
    })();
    return () => {
      stop = true;
    };
  }, [envelopeId, event]);

  if (!status) return <PageLoader label="Checking your signature…" />;
  const signed = status === 'SIGNED';
  const pending = event === 'signing_complete' && !signed;
  return (
    <div className="py-6">
      <ResultPanel
        state={signed ? 'success' : pending ? 'pending' : 'fail'}
        eyebrow={signed ? 'Agreement' : pending ? 'Please wait' : 'Agreement'}
        title={signed ? 'Signed.' : pending ? 'Finalising…' : 'Not signed.'}
        actions={
          <Link href="/agreements" className="inline-flex h-12 items-center gap-3 rounded-[4px] bg-paper px-6 font-bold text-ink transition-colors hover:bg-brand-600 hover:text-white">
            Back to agreements <span className="arrow">→</span>
          </Link>
        }
      >
        {signed ? 'Your signed copy is in Documents.' : pending ? 'This can take a minute. You can safely leave this page.' : 'You can come back and sign any time before the deadline.'}
      </ResultPanel>
    </div>
  );
}

export default function AgreementReturnPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ReturnInner />
    </Suspense>
  );
}
