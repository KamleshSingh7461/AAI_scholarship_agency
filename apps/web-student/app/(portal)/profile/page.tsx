'use client';
import Link from 'next/link';
import { date, statusLabel } from '@aci/web-shared';
import { useApi } from '@aci/web-shared/hooks';
import { Alert, Button, Card, PageHeader, PageLoader, StatusBadge } from '@aci/web-shared/ui';
import { AthleteBib, Ledger } from '@/components/race';
import type { MeResponse } from '@/lib/types';

function Medals({ gold = 0, silver = 0, bronze = 0 }: { gold?: number; silver?: number; bronze?: number }) {
  const items: [string, number, string][] = [
    ['Gold', gold, '#c9a227'],
    ['Silver', silver, '#a7a9ac'],
    ['Bronze', bronze, '#b07142'],
  ];
  return (
    <span className="inline-flex items-center gap-3">
      {items.map(([label, n, color]) => (
        <span key={label} className="inline-flex items-center gap-1.5" title={label}>
          <span className="size-3.5 rounded-full shadow-[inset_0_-2px_0_rgb(0_0_0/0.2)]" style={{ background: color }} aria-hidden />
          <span className="tabular-nums">{n}</span>
          <span className="sr-only">{label}</span>
        </span>
      ))}
    </span>
  );
}

export default function ProfilePage() {
  const { data } = useApi<MeResponse>('/athletes/me');
  if (!data) return <PageLoader />;
  const p = data.profile;
  const s = p.sports;
  const editable = ['DRAFT', 'CHANGES_REQUESTED'].includes(p.status);
  const name = [p.firstName, p.lastName].filter(Boolean).join(' ');
  return (
    <div className="space-y-8">
      <PageHeader
        title="My profile"
        subtitle={`Athlete ID ${p.athleteCode ?? '—'}`}
        actions={
          <>
            <StatusBadge status={p.status} />
            {editable && (
              <Link href="/onboarding">
                <Button size="sm">Edit profile <span className="arrow">→</span></Button>
              </Link>
            )}
          </>
        }
      />
      {!editable && <Alert tone="info">Your profile is {statusLabel(p.status).toLowerCase()} and locked. Contact support to change details.</Alert>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="space-y-4 lg:sticky lg:top-8 lg:self-start">
          <AthleteBib code={p.athleteCode} name={name || p.phone} sub={s?.primarySport} />
          {s && (
            <div className="scoreboard px-5 py-4">
              <p className="eyebrow text-[0.62rem] text-paper/50">Medal inventory</p>
              <p className="mt-2 text-lg font-semibold">
                <Medals gold={s.medalsGold} silver={s.medalsSilver} bronze={s.medalsBronze} />
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card title="Personal">
            <Ledger
              rows={[
                ['Name', name],
                ['Date of birth', date(p.dateOfBirth)],
                ['Gender', statusLabel(p.gender)],
                ['Nationality', p.nationality],
                ['Mobile', p.phone],
                ['WhatsApp', p.whatsappNumber],
                ['Email', p.email],
                ['Address', [p.addressLine, p.city, p.state, p.zipCode].filter(Boolean).join(', ')],
                ...(p.guardianName ? ([['Guardian', `${p.guardianName} (${p.guardianRelation ?? 'guardian'}) · ${p.guardianPhone}`]] as [string, string][]) : []),
              ]}
            />
          </Card>
          <Card title="Sports">
            {s ? (
              <Ledger
                rows={[
                  ['Primary sport', s.primarySport],
                  ['Club / academy', s.currentClub],
                  ['Coach', s.coachName],
                  ['Years training', s.yearsOfTraining],
                  ['Height / weight', s.heightCm ? `${s.heightCm} cm · ${s.weightKg ?? '—'} kg` : ''],
                  ['Fitness level', statusLabel(s.fitnessLevel)],
                  ['Ranking', s.rankingLevel ? `${statusLabel(s.rankingLevel)} #${s.rankingValue ?? '—'}` : ''],
                  ['Medals', <Medals key="m" gold={s.medalsGold} silver={s.medalsSilver} bronze={s.medalsBronze} />],
                  ['Best performance', s.bestPerformance],
                ]}
              />
            ) : (
              <p className="text-sm text-slate-500">Not filled in yet.</p>
            )}
          </Card>
          <Card title="Academics">
            {p.academics.length === 0 ? (
              <p className="text-sm text-slate-500">Not filled in yet.</p>
            ) : (
              <ul className="divide-y divide-dashed divide-ink/15">
                {p.academics.map((a) => (
                  <li key={a.level} className="py-3 first:pt-0 last:pb-0">
                    <p className="eyebrow text-[0.62rem] text-slate-500">{statusLabel(a.level)}</p>
                    <p className="mt-1 font-semibold">{a.institutionName}</p>
                    <p className="text-sm text-slate-600">
                      {[a.boardOrUniversity, a.yearOfPassing, a.scoreValue ? `${a.scoreValue} ${a.scoreType?.toLowerCase() ?? ''}` : null].filter(Boolean).join(' · ')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="References">
            {p.references.length === 0 ? (
              <p className="text-sm text-slate-500">Not filled in yet.</p>
            ) : (
              <ul className="divide-y divide-dashed divide-ink/15">
                {p.references.map((r) => (
                  <li key={r.position} className="py-3 first:pt-0 last:pb-0">
                    <p className="eyebrow text-[0.62rem] text-slate-500">Reference {r.position}</p>
                    <p className="mt-1 font-semibold">{r.name}</p>
                    <p className="text-sm text-slate-600">
                      {statusLabel(r.designation)} · {r.organization} · {r.phone}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
