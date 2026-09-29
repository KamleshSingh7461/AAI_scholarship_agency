'use client';
import Link from 'next/link';
import { ArrowRight, CalendarClock, FileSignature, GraduationCap, Search, Sparkles } from 'lucide-react';
import { useApi } from '@aci/web-shared/hooks';
import { Alert, Badge, Button, Card, PageLoader, Progress, Stat, StatusBadge } from '@aci/web-shared/ui';
import { date, daysUntil, money, statusLabel } from '@aci/web-shared';
import type { Application, Award, Envelope, MeResponse } from '@/lib/types';

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Welcome back</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{[p.firstName, p.lastName].filter(Boolean).join(' ') || 'Athlete'}</h1>
          {award && (
            <p className="mt-1 text-sm text-slate-600">
              {award.universityName} · {award.sport} · {award.durationYears}-Year Award <StatusBadge status={award.status} />
            </p>
          )}
        </div>
        <Badge tone="gray">Athlete ID {p.athleteCode}</Badge>
      </div>

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

      {award ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Total scholarship value" value={money(award.totalValue, award.currency)} sub={`${money(award.annualValue, award.currency)} per year`} tone="green" />
            <Stat label="Years completed" value={`${award.progress?.yearsCompleted ?? 0} of ${award.durationYears}`} sub={`${award.progress?.yearsRenewed ?? 0} year(s) released so far`} />
            <Stat
              label="Next renewal due"
              value={next ? date(next.dueDate) : award.status === 'PENDING_SIGNATURE' ? 'Sign agreements' : '—'}
              sub={next ? statusLabel(next.status) : award.status === 'PENDING_SIGNATURE' ? `Deadline ${date(award.agreementsDeadline)}` : 'All years renewed'}
              tone={next && next.status !== 'UPCOMING' ? 'amber' : 'default'}
            />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Your scholarship breakdown" subtitle="Annual value, per benefit">
              <div className="grid grid-cols-3 gap-3">
                {[
                  ['Tuition', award.tuitionPerYear],
                  ['Room', award.roomPerYear],
                  ['Food', award.foodPerYear],
                ].map(([label, v]) => (
                  <div key={label as string} className="rounded-xl bg-slate-50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{money(v as number, award.currency)}</p>
                    <p className="text-xs text-slate-500">per year</p>
                  </div>
                ))}
              </div>
              {award.otherPerYear > 0 && <p className="mt-3 text-sm text-slate-600">Other benefits: {money(award.otherPerYear, award.currency)} per year</p>}
            </Card>
            <Card title="Scholarship progress" subtitle={`Year ${award.progress?.yearsRenewed ?? 0} of ${award.durationYears}`}>
              <Progress value={award.progress?.yearsRenewed ?? 0} max={award.durationYears} />
              <p className="mt-4 text-sm text-slate-600">
                Your full award of <strong>{money(award.totalValue, award.currency)}</strong>
                {award.grantDate ? ` was recognised when you signed on ${date(award.grantDate)}` : ' starts when you sign both agreements'}.{' '}
                {money(award.progress?.releasedValue ?? 0, award.currency)} has been released and {money(award.progress?.remainingValue ?? award.totalValue, award.currency)} remains,
                released as you renew each year.
              </p>
              <ol className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {award.years.map((y) => (
                  <li key={y.id} className="rounded-xl p-3 text-xs ring-1 ring-slate-200">
                    <p className="font-semibold text-slate-900">Year {y.yearNumber}</p>
                    <p className="text-slate-500">{y.academicYear}</p>
                    <div className="mt-2">
                      <StatusBadge status={y.status} />
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2">
            <div className="flex items-start gap-4">
              <span className="rounded-2xl bg-brand-50 p-3 text-brand-600">
                <Sparkles className="size-6" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Find your scholarship</h2>
                <p className="mt-1 text-sm text-slate-600">Browse open athletic scholarships at partner universities and apply in a few minutes.</p>
                <Link href="/programs">
                  <Button className="mt-4" icon={<Search className="size-4" />}>
                    Browse scholarships
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
          <Stat label="Profile status" value={statusLabel(p.status)} sub={p.status === 'DRAFT' ? `${4 - p.stepsCompleted.length} step(s) to go` : 'Thanks — you can apply'} />
        </div>
      )}

      <Card
        title="Recent applications"
        actions={
          <Link href="/applications" className="text-xs font-semibold text-brand-700 hover:underline">
            View all
          </Link>
        }
        padded={false}
      >
        {apps.items.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">You have not applied to any scholarship yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {apps.items.map((a) => (
              <li key={a.id}>
                <Link href={`/applications/${a.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50">
                  <GraduationCap className="size-5 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{a.programName}</p>
                    <p className="text-xs text-slate-500">
                      {a.universityName} · {a.applicationNo}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                  <ArrowRight className="size-4 text-slate-300" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {pendingEnvelopes.length === 0 && award?.status === 'ACTIVE' && (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <CalendarClock className="size-4" /> We will remind you on WhatsApp 30 days before each renewal. <FileSignature className="ml-2 size-4" /> Signed copies are in Documents.
        </p>
      )}
    </div>
  );
}
