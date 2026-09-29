'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { apiPost } from '@aci/web-shared';
import { PageHeader, PageLoader, useToast } from '@aci/web-shared/ui';
import { ProgramForm } from '@/components/program-form';
import type { Program } from '@/lib/types';

function NewProgramInner() {
  const router = useRouter();
  const toast = useToast();
  const universityId = useSearchParams().get('universityId') ?? undefined;
  return (
    <div>
      <PageHeader title="New scholarship program" breadcrumb="Home / Programs / New" subtitle="Programs start as drafts. Publish when ready to show them on the public site." />
      <ProgramForm
        universityId={universityId}
        onSubmit={async (payload) => {
          try {
            const p = await apiPost<Program>('/programs', payload);
            toast.success(`Program ${p.code} created as draft`);
            router.push(`/programs/${p.id}`);
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
    </div>
  );
}

export default function NewProgramPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <NewProgramInner />
    </Suspense>
  );
}
