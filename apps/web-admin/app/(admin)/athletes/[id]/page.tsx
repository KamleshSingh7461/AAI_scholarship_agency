'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@aci/web-shared/auth';
import { useApi } from '@aci/web-shared/hooks';
import { Card, PageHeader, StatusBadge, Table, Td, Th } from '@aci/web-shared/ui';
import { date } from '@aci/web-shared';
import { AthleteDossier } from '@/components/athlete-dossier';
import type { Application, Paged } from '@/lib/types';

export default function AthletePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: dossier } = useApi<{ profile: { userId: string; firstName: string; lastName: string; athleteCode: string } }>(`/athletes/${id}`);
  const { data: apps } = useApi<Paged<Application>>(dossier ? '/applications' : null, { athleteUserId: dossier?.profile.userId, pageSize: 50 });
  return (
    <div className="space-y-6">
      <Link href="/athletes" className="eyebrow link-grow inline-block text-slate-600 hover:text-ink">
        ← Athletes
      </Link>
      <PageHeader title={dossier ? `${dossier.profile.firstName ?? ''} ${dossier.profile.lastName ?? ''}` : 'Athlete'} subtitle={dossier?.profile.athleteCode} />
      <AthleteDossier profileId={id} canReview={['SUPER_ADMIN', 'ADMIN', 'REVIEWER'].includes(user?.role ?? '')} />
      <Card title="Applications" padded={false}>
        <Table>
          <thead>
            <tr>
              <Th>Application</Th>
              <Th>Program</Th>
              <Th>Created</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {apps?.items.map((a) => (
              <tr key={a.id}>
                <Td><Link href={`/applications/${a.id}`} className="font-mono text-xs font-semibold text-brand-700">{a.applicationNo}</Link></Td>
                <Td>{a.programName} · {a.universityName}</Td>
                <Td>{date(a.createdAt)}</Td>
                <Td><StatusBadge status={a.status} /></Td>
              </tr>
            ))}
            {apps?.items.length === 0 && (
              <tr><Td colSpan={4} className="text-slate-500">No applications.</Td></tr>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
