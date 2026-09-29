'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { apiPost } from '@aci/web-shared';
import { mutate } from '@aci/web-shared/hooks';
import { Button, Card, PageLoader } from '@aci/web-shared/ui';

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
    <div className="mx-auto max-w-lg py-10">
      <Card>
        <div className="flex flex-col items-center py-6 text-center">
          {signed ? <CheckCircle2 className="size-14 text-accent-600" /> : pending ? <Clock className="size-14 text-amber-500" /> : <XCircle className="size-14 text-slate-400" />}
          <h1 className="mt-4 text-xl font-bold">{signed ? 'Agreement signed' : pending ? 'Finalising your signature' : 'Signing not completed'}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {signed ? 'Your signed copy is in Documents.' : pending ? 'This can take a minute. You can safely leave this page.' : 'You can come back and sign any time before the deadline.'}
          </p>
          <Link href="/agreements" className="mt-6">
            <Button>Back to agreements</Button>
          </Link>
        </div>
      </Card>
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
