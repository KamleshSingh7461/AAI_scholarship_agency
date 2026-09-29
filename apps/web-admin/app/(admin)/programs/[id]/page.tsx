'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Eye } from 'lucide-react';
import { apiPatch, apiPost } from '@aci/web-shared';
import { useAuth } from '@aci/web-shared/auth';
import { useApi } from '@aci/web-shared/hooks';
import { Button, PageHeader, PageLoader, Stat, StatusBadge, useToast } from '@aci/web-shared/ui';
import { ProgramForm } from '@/components/program-form';
import type { Program } from '@/lib/types';

const PUBLIC_SITE = process.env.NEXT_PUBLIC_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default function ProgramPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { user } = useAuth();
  const { data: p, mutate } = useApi<Program>(`/programs/${id}`);
  if (!p) return <PageLoader />;
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role ?? '');
  const frozen = p.seatsReserved + p.seatsAwarded > 0;

  const setStatus = async (action: 'publish' | 'close' | 'archive') => {
    try {
      await apiPost(`/programs/${id}/${action}`);
      toast.success(`Program ${action === 'publish' ? 'published' : action + 'd'}`);
      void mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <Link href="/programs" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> Programs
      </Link>
      <PageHeader
        title={p.name}
        subtitle={`${p.code} · ${p.university?.name}`}
        actions={
          <>
            <StatusBadge status={p.status} />
            {p.status === 'PUBLISHED' && (
              <a href={`${PUBLIC_SITE}/scholarships/${p.slug}`} target="_blank" rel="noreferrer">
                <Button size="sm" variant="secondary" icon={<Eye className="size-4" />}>Public page</Button>
              </a>
            )}
            {isAdmin && p.status !== 'PUBLISHED' && p.status !== 'ARCHIVED' && <Button size="sm" variant="success" onClick={() => setStatus('publish')}>Publish</Button>}
            {isAdmin && p.status === 'PUBLISHED' && <Button size="sm" variant="secondary" onClick={() => setStatus('close')}>Close applications</Button>}
            {isAdmin && p.status !== 'ARCHIVED' && <Button size="sm" variant="ghost" onClick={() => setStatus('archive')}>Archive</Button>}
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Seats" value={p.seatsTotal} />
        <Stat label="Awarded" value={p.seatsAwarded} tone="green" />
        <Stat label="Reserved (awaiting signature)" value={p.seatsReserved} tone="amber" />
        <Stat label="Left" value={p.seatsLeft} />
      </div>
      {isAdmin ? (
        <ProgramForm
          program={p}
          frozen={frozen}
          usdInrRate4={p.value.usdInrRate4}
          onSubmit={async (payload) => {
            try {
              const { universityId: _u, ...rest } = payload;
              await apiPatch(`/programs/${id}`, rest);
              toast.success('Saved');
              void mutate();
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        />
      ) : (
        <p className="text-sm text-slate-500">Read-only for your role.</p>
      )}
    </div>
  );
}
