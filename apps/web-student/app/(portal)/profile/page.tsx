'use client';
import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { date, statusLabel } from '@aci/web-shared';
import { useApi } from '@aci/web-shared/hooks';
import { Alert, Button, Card, PageHeader, PageLoader, StatusBadge } from '@aci/web-shared/ui';
import type { MeResponse } from '@/lib/types';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900">{value || '—'}</dd>
    </div>
  );
}

export default function ProfilePage() {
  const { data } = useApi<MeResponse>('/athletes/me');
  if (!data) return <PageLoader />;
  const p = data.profile;
  const s = p.sports;
  const editable = ['DRAFT', 'CHANGES_REQUESTED'].includes(p.status);
  return (
    <div className="space-y-6">
      <PageHeader
        title="My profile"
        subtitle={`Athlete ID ${p.athleteCode}`}
        actions={
          <>
            <StatusBadge status={p.status} />
            {editable && (
              <Link href="/onboarding">
                <Button size="sm" icon={<Pencil className="size-4" />}>Edit</Button>
              </Link>
            )}
          </>
        }
      />
      {!editable && <Alert tone="info">Your profile is {statusLabel(p.status).toLowerCase()} and locked. Contact support to change details.</Alert>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Personal">
          <dl className="grid grid-cols-2 gap-4">
            <Row label="Name" value={[p.firstName, p.lastName].filter(Boolean).join(' ')} />
            <Row label="Date of birth" value={date(p.dateOfBirth)} />
            <Row label="Gender" value={statusLabel(p.gender)} />
            <Row label="Nationality" value={p.nationality} />
            <Row label="Mobile" value={p.phone} />
            <Row label="WhatsApp" value={p.whatsappNumber} />
            <Row label="Email" value={p.email} />
            <Row label="Address" value={[p.addressLine, p.city, p.state, p.zipCode].filter(Boolean).join(', ')} />
            {p.guardianName && <Row label="Guardian" value={`${p.guardianName} (${p.guardianRelation ?? 'guardian'}) · ${p.guardianPhone}`} />}
          </dl>
        </Card>
        <Card title="Sports">
          {s ? (
            <dl className="grid grid-cols-2 gap-4">
              <Row label="Primary sport" value={s.primarySport} />
              <Row label="Club / academy" value={s.currentClub} />
              <Row label="Coach" value={s.coachName} />
              <Row label="Years training" value={s.yearsOfTraining} />
              <Row label="Height / weight" value={s.heightCm ? `${s.heightCm} cm · ${s.weightKg ?? '—'} kg` : ''} />
              <Row label="Fitness level" value={statusLabel(s.fitnessLevel)} />
              <Row label="Ranking" value={s.rankingLevel ? `${statusLabel(s.rankingLevel)} #${s.rankingValue ?? '—'}` : ''} />
              <Row label="Medal inventory till date" value={`🥇${s.medalsGold ?? 0} 🥈${s.medalsSilver ?? 0} 🥉${s.medalsBronze ?? 0}`} />
              <Row label="Best performance" value={s.bestPerformance} />
            </dl>
          ) : (
            <p className="text-sm text-slate-500">Not filled in yet.</p>
          )}
        </Card>
        <Card title="Academics">
          <ul className="space-y-3">
            {p.academics.map((a) => (
              <li key={a.level} className="text-sm">
                <p className="font-semibold text-slate-900">{a.institutionName}</p>
                <p className="text-slate-500">
                  {statusLabel(a.level)} · {a.boardOrUniversity} · {a.yearOfPassing} · {a.scoreValue} {a.scoreType?.toLowerCase()}
                </p>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="References">
          <ul className="space-y-3">
            {p.references.map((r) => (
              <li key={r.position} className="text-sm">
                <p className="font-semibold text-slate-900">{r.name}</p>
                <p className="text-slate-500">
                  {statusLabel(r.designation)} · {r.organization} · {r.phone}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
