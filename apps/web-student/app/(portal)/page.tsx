'use client';
import Link from 'next/link';
import { useApi } from '@aci/web-shared/hooks';
import { Alert, Card, PageLoader, Stat, StatusBadge } from '@aci/web-shared/ui';
import { date, daysUntil, money, statusLabel } from '@aci/web-shared';
import { Odometer } from '@/components/race';
import type { Application, Award, Envelope, MeResponse } from '@/lib/types';

const yearState = (s: string) => (s === 'RENEWED' ? 'done' : ['DUE', 'OVERDUE', 'SUSPENDED'].includes(s) ? 'current' : undefined);

export default function DashboardPage() {
  const { data: me } = useApi<MeResponse>('/athletes/me');
  const { data: awards } = useApi<Award[]>('/awards/mine');
  const { data: apps } = useApi<{ items: Application[] }>('/applications/mine', { pageSize: 5 });
  const { data: envelopes } = useApi<Envelope[]>('/esign/envelopes/mine');

  if (!me || !awards || !apps) return <PageLoader />;
  const p = me.profile;
  const award = awards.find((a) => ['ACTIVE', 'RENEWAL_DUE', 'SUSPENDED', 'PENDING_SIGNATURE'].includes(a.status)) ?? awards[0];
  const pendingEnvelopes = envelopes?.filter((e) => ['SENT', 'VIEWED'].includes(e.status)) ?? [];
  const next = award?.progress?.nextRenewal;
  const dueIn = next ? daysUntil(next.dueDate) : null;
  const name = [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Athlete';

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b-2 border-ink pb-6">
        <div className="min-w-0">
          <p className="eyebrow text-brand-600">Welcome back</p>
          <h1 className="display rise mt-3 break-words text-[clamp(3rem,8vw,6rem)]">{name}</h1>
          {award && (
            <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-slate-600">
              {award.universityName} · {award.sport} · {award.durationYears}-year award <StatusBadge status={award.status} />
            </p>
          )}
        </div>
        <p className="eyebrow text-slate-500">
          Athlete ID <span className="text-ink">{p.athleteCode ?? '—'}</span>
        </p>
      </header>

      {(p.status === 'DRAFT' || p.status === 'CHANGES_REQUESTED' || pendingEnvelopes.length > 0 || (next && ['DUE', 'OVERDUE', 'SUSPENDED'].includes(next.status))) && (
        <div className="space-y-3">
          {p.status === 'DRAFT' && (
            <Alert tone="warning" title="Complete your athlete profile">
              You need to finish the 4-step profile before you can apply. {me.completeness.missing.length} item(s) left.{' '}
              <Link href="/onboarding" className="font-semibold underline">
                Continue profile →
              </Link>
            </Alert>
          )}
          {p.status === 'CHANGES_REQUESTED' && (
            <Alert tone="warning" title="Our team asked for changes to your profile">
              {p.reviewRemarks} <Link href="/onboarding" className="font-semibold underline">Update profile →</Link>
            </Alert>
          )}
          {pendingEnvelopes.length > 0 && (
            <Alert tone="error" title={`${pendingEnvelopes.length} agreement${pendingEnvelopes.length > 1 ? 's' : ''} waiting for your signature`}>
              Your scholarship only starts (or continues) once you sign. <Link href="/agreements" className="font-semibold underline">Sign now →</Link>
            </Alert>
          )}
          {next && ['DUE', 'OVERDUE', 'SUSPENDED'].includes(next.status) && (
            <Alert tone={next.status === 'DUE' ? 'warning' : 'error'} title={`Your Year ${next.yearNumber} renewal is ${next.status === 'DUE' ? `due in ${dueIn} days` : 'overdue'}`}>
              Register and sign again to keep your scholarship active — no signature, no scholarship that year.{' '}
              <Link href="/renewals" className="font-semibold underline">Renew now →</Link>
            </Alert>
          )}
        </div>
      )}

      {award ? (
        <>
          <section className="scoreboard" aria-label="Scholarship scoreboard">
            <div className="eyebrow flex flex-wrap justify-between gap-2 border-b border-paper/10 px-5 py-3 text-[0.66rem] text-paper/50">
              <span>Your scholarship</span>
              <span>{award.awardNo}</span>
            </div>
            <dl className="grid grid-cols-1 gap-px bg-paper/10 sm:grid-cols-3">
              <div className="flex flex-col-reverse bg-ink px-5 pb-5 pt-6">
                <dt className="mt-3 text-sm text-paper/55">
                  Total scholarship value · {money(award.annualValue, award.currency)} per year
                </dt>
                <dd className="display text-[clamp(2.75rem,5vw,3.75rem)] text-accent-300">
                  <Odometer value={money(award.totalValue, award.currency)} />
                </dd>
              </div>
              <div className="flex flex-col-reverse bg-ink px-5 pb-5 pt-6">
                <dt className="mt-3 text-sm text-paper/55">Years completed · {award.progress?.yearsRenewed ?? 0} released so far</dt>
                <dd className="display text-[clamp(2.75rem,5vw,3.75rem)]">
                  <Odometer value={`${award.progress?.yearsCompleted ?? 0}/${award.durationYears}`} />
                </dd>
              </div>
              <div className="flex flex-col-reverse bg-ink px-5 pb-5 pt-6">
                <dt className="mt-3 text-sm text-paper/55">
                  Next renewal · {next ? statusLabel(next.status) : award.status === 'PENDING_SIGNATURE' ? `deadline ${date(award.agreementsDeadline)}` : 'all years renewed'}
                </dt>
                <dd className={`display text-[clamp(2.25rem,4vw,3rem)] ${next && next.status !== 'UPCOMING' ? 'text-[#f4c65a]' : ''}`}>
                  {next ? date(next.dueDate) : award.status === 'PENDING_SIGNATURE' ? 'Sign agreements' : '—'}
                </dd>
              </div>
            </dl>
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title="Breakdown · per year">
              <dl className="divide-y divide-dashed divide-ink/15">
                {(
                  [
                    ['Tuition', award.tuitionPerYear],
                    ['Room', award.roomPerYear],
                    ['Food', award.foodPerYear],
                    ...(award.otherPerYear > 0 ? [['Other benefits', award.otherPerYear]] : []),
                  ] as [string, number][]
                ).map(([label, v]) => (
                  <div key={label} className="flex items-baseline justify-between py-3">
                    <dt className="text-slate-600">{label}</dt>
                    <dd className="font-semibold tabular-nums">{money(v, award.currency)}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-2 flex items-baseline justify-between border-t-2 border-ink pt-3">
                <span className="font-bold">Total per year</span>
                <span className="display text-3xl text-accent-700">{money(award.annualValue, award.currency)}</span>
              </div>
            </Card>

            <Card title={`Progress · year ${award.progress?.yearsRenewed ?? 0} of ${award.durationYears}`}>
              <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(award.years.length, 1)}, minmax(0, 1fr))` }}>
                {award.years.map((y) => (
                  <li key={y.id} className="min-w-0">
                    <div className="split" data-state={yearState(y.status)} />
                    <p className="display mt-3 text-2xl">Year {y.yearNumber}</p>
                    <p className="eyebrow mt-1 text-[0.62rem] text-slate-500">{y.academicYear}</p>
                    <div className="mt-2">
                      <StatusBadge status={y.status} />
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-6 text-sm leading-relaxed text-slate-600">
                Your full award of <strong className="text-ink">{money(award.totalValue, award.currency)}</strong>
                {award.grantDate ? ` was recognised when you signed on ${date(award.grantDate)}` : ' starts when you sign both agreements'}.{' '}
                {money(award.progress?.releasedValue ?? 0, award.currency)} has been released and {money(award.progress?.remainingValue ?? award.totalValue, award.currency)} remains,
                released as you renew each year.
              </p>
            </Card>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <section className="track relative overflow-hidden rounded-[6px] p-7 text-white md:col-span-2 md:p-9">
            <span className="checker absolute inset-y-0 right-0 w-4" aria-hidden />
            <p className="eyebrow text-white/80">Next step</p>
            <h2 className="display mt-3 text-[clamp(2.75rem,5vw,4rem)]">Find your scholarship</h2>
            <p className="mt-4 max-w-md text-white/90">Browse open athletic scholarships at partner universities and apply in a few minutes.</p>
            <Link href="/programs" className="mt-6 inline-flex h-12 items-center gap-3 rounded-[4px] bg-paper px-6 font-bold text-ink transition-colors hover:bg-ink hover:text-paper">
              Browse scholarships <span className="arrow">→</span>
            </Link>
          </section>
          <Stat label="Profile status" value={statusLabel(p.status)} sub={p.status === 'DRAFT' ? `${4 - p.stepsCompleted.length} step(s) to go` : 'Thanks — you can apply'} />
        </div>
      )}

      <Card
        title="Recent applications"
        actions={
          <Link href="/applications" className="eyebrow link-grow text-[0.66rem] text-ink">
            View all →
          </Link>
        }
        padded={false}
      >
        {apps.items.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">You have not applied to any scholarship yet.</p>
        ) : (
          <ul className="divide-y divide-dashed divide-ink/15">
            {apps.items.map((a) => (
              <li key={a.id}>
                <Link href={`/applications/${a.id}`} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-4 transition-colors hover:bg-paper sm:grid-cols-[9rem_minmax(0,1fr)_auto_auto]">
                  <span className="eyebrow hidden text-[0.66rem] text-slate-500 sm:block">{a.applicationNo}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{a.programName}</span>
                    <span className="block truncate text-sm text-slate-500">{a.universityName}</span>
                  </span>
                  <StatusBadge status={a.status} />
                  <span className="arrow hidden text-slate-400 group-hover:text-ink sm:inline">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {pendingEnvelopes.length === 0 && award?.status === 'ACTIVE' && (
        <p className="eyebrow text-[0.66rem] text-slate-500">We remind you on WhatsApp 30 days before each renewal · Signed copies are in Documents</p>
      )}
    </div>
  );
}
