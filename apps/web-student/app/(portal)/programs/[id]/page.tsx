'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, apiPost, money, pct } from '@aci/web-shared';
import { useApi } from '@aci/web-shared/hooks';
import { Alert, Button, Checkbox, ErrorState, Field, Input, PageLoader, Select, Textarea } from '@aci/web-shared/ui';
import { BackLink, bibNumber, Pins, SeatsMeter } from '@/components/race';
import type { CatalogProgram } from '@/lib/catalog';
import type { Application, MeResponse } from '@/lib/types';
import { startCheckout, type PaymentOrderResponse } from '@/lib/checkout';

const who = (b: string) => (b === 'UNIVERSITY' ? 'University' : b === 'COMPANY' ? 'Alumni Connect India' : 'You');

export default function ProgramDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: p, error } = useApi<CatalogProgram>(`/catalog/programs/${id}`);
  const { data: me } = useApi<MeResponse>('/athletes/me');
  const { data: mine } = useApi<{ items: Application[] }>('/applications/mine', { pageSize: 50 });
  const [statement, setStatement] = useState('');
  const [course, setCourse] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (error) return <ErrorState error={error} />;
  if (!p || !me || !mine) return <PageLoader />;
  const existing = mine.items.find((a) => a.programId === p.id && !['REJECTED', 'UNIVERSITY_REJECTED', 'WITHDRAWN', 'EXPIRED'].includes(a.status));
  const profileReady = ['SUBMITTED', 'VERIFIED'].includes(me.profile.status);
  const [prefix, number] = bibNumber(p.code);

  const apply = async () => {
    setBusy(true);
    setErr(null);
    try {
      const app = await apiPost<Application>('/applications/mine', { programId: p.id, statement: statement || undefined, preferredCourse: course || undefined });
      if (app.status === 'PAYMENT_PENDING') {
        const order = await apiPost<PaymentOrderResponse>(`/applications/mine/${app.id}/pay`);
        await startCheckout(order, (u) => router.push(u));
      } else router.push(`/applications/${app.id}`);
    } catch (e) {
      const ae = e as ApiError;
      setErr(ae.body?.problems?.join(' · ') ?? ae.message);
    } finally {
      setBusy(false);
    }
  };

  const eligibility = [
    p.eligibleSports.length > 0 && `Sports: ${p.eligibleSports.join(', ')}`,
    (p.minAge || p.maxAge) && `Age ${p.minAge ?? 'any'}–${p.maxAge ?? 'any'}`,
    p.eligibilityCriteria,
  ].filter(Boolean) as string[];

  return (
    <div>
      <BackLink href="/programs">All scholarships</BackLink>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div>
          <p className="eyebrow text-slate-500">
            <span className="text-ink">{p.university?.name}</span>
            {p.university?.city ? ` · ${[p.university.city, p.university.state].filter(Boolean).join(', ')}` : ''}
          </p>
          <h1 className="display rise mt-4 text-[clamp(2.6rem,5.5vw,4.5rem)]">{p.name}</h1>
          <div className="eyebrow mt-5 flex flex-wrap gap-2 text-[0.64rem]">
            <span className="rounded-[3px] bg-ink px-2.5 py-1.5 text-paper">{p.durationYears}-year award</span>
            <span className="rounded-[3px] border border-ink/30 px-2.5 py-1.5">Intake {p.academicYear}</span>
            {p.tuitionCoverageBps < 10000 && <span className="rounded-[3px] border border-ink/30 px-2.5 py-1.5">{pct(p.tuitionCoverageBps)} tuition</span>}
          </div>
          {p.description && <p className="mt-6 max-w-2xl whitespace-pre-line text-lg leading-relaxed text-slate-700">{p.description}</p>}

          <h2 className="eyebrow mt-12 text-brand-600">Benefits per year</h2>
          <div className="mt-4 border-y-2 border-ink">
            {(
              [
                ['Tuition', p.benefitsInr.tuitionPerYear, p.bearers.tuition],
                ['Room', p.benefitsInr.roomPerYear, p.bearers.room],
                ['Food', p.benefitsInr.foodPerYear, p.bearers.food],
                ['Other', p.benefitsInr.otherPerYear, p.bearers.other],
              ] as const
            ).map(([label, amt, bearer]) => (
              <div key={label} className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 border-b border-dashed border-ink/15 py-4 sm:grid-cols-[minmax(0,1fr)_14rem_8rem] ${bearer === 'STUDENT' ? 'text-slate-500' : ''}`}>
                <span className="font-semibold text-ink">{label}</span>
                <span className="order-3 col-span-2 text-sm sm:order-none sm:col-span-1 sm:text-base">Paid by {who(bearer)}</span>
                <span className="text-right font-bold tabular-nums text-ink">{bearer === 'STUDENT' ? '—' : money(amt, 'INR')}</span>
              </div>
            ))}
            <div className="flex items-baseline justify-between py-4">
              <span className="font-bold">Total per year</span>
              <span className="display text-4xl text-accent-700">{money(p.benefitsInr.annualValue, 'INR')}</span>
            </div>
          </div>
          {p.otherCostsNote && <p className="mt-3 text-sm text-slate-500">{p.otherCostsNote}</p>}

          {eligibility.length > 0 && (
            <>
              <h2 className="eyebrow mt-12 text-brand-600">Eligibility</h2>
              <ul className="square-list mt-4 space-y-2.5 text-slate-700">
                {eligibility.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </>
          )}
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <div className="bib">
            <Pins />
            <div className="bib-band px-6 pb-4 pt-5">
              <p className="eyebrow text-[0.62rem] text-white/80">Total scholarship value</p>
              <p className="display mt-2 text-5xl">{money(p.benefitsInr.totalValue, 'INR')}</p>
              <p className="mt-1.5 text-sm text-white/85">
                {money(p.benefitsInr.annualValue, 'INR')} × {p.durationYears} years
              </p>
            </div>
            <div className="px-6 pb-4 pt-4">
              <p className="eyebrow text-[0.62rem] text-slate-500">{prefix}</p>
              <p className="display text-[4.5rem] leading-[0.82]">{number}</p>
              <div className="mt-4">
                <SeatsMeter left={p.seatsLeft} total={p.seatsTotal} />
              </div>
            </div>

            <div className="bib-stub px-6 pb-6 pt-5">
              {existing ? (
                <Alert tone="info" title="You have already applied">
                  <Link className="font-semibold underline" href={`/applications/${existing.id}`}>
                    View application {existing.applicationNo} →
                  </Link>
                </Alert>
              ) : !profileReady ? (
                <Alert tone="warning" title="Finish your profile first">
                  <Link className="font-semibold underline" href="/onboarding">
                    Complete the 4-step profile →
                  </Link>
                </Alert>
              ) : !p.isOpen ? (
                <Alert tone="warning">Applications are closed for this scholarship.</Alert>
              ) : (
                <div className="space-y-4">
                  <Field label="Why should you get this scholarship? (optional)">
                    <Textarea value={statement} onChange={(e) => setStatement(e.target.value)} maxLength={4000} placeholder="Your achievements, goals, circumstances…" />
                  </Field>
                  {p.courses.length > 0 ? (
                    <Field label="Preferred course">
                      <Select value={course} onChange={(e) => setCourse(e.target.value)}>
                        <option value="">Select</option>
                        {p.courses.map((c) => <option key={c}>{c}</option>)}
                      </Select>
                    </Field>
                  ) : (
                    <Field label="Preferred course">
                      <Input value={course} onChange={(e) => setCourse(e.target.value)} />
                    </Field>
                  )}
                  <div className="receipt rounded-[4px] border border-dashed border-ink/25 p-4 text-[0.8rem]">
                    <div className="flex justify-between gap-4"><span className="text-slate-600">{p.fee.explanation}</span><span>{money(p.fee.baseInr, 'INR')}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-slate-600">GST</span><span>{money(p.fee.taxInr, 'INR')}</span></div>
                    <div className="mt-2 flex justify-between gap-4 border-t border-dashed border-ink/30 pt-2 font-semibold"><span>Application fee</span><span>{p.fee.totalInr ? money(p.fee.totalInr, 'INR') : 'Free'}</span></div>
                    <p className="mt-2 text-slate-600">{p.feeRefundableOnRejection ? 'Refunded if your application is not approved.' : 'Non-refundable once paid.'}</p>
                  </div>
                  <Checkbox
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                    label="I confirm my profile information is true, and I understand the university takes the final decision and the scholarship must be renewed every year."
                  />
                  {err && <Alert tone="error">{err}</Alert>}
                  <Button block size="lg" disabled={!agree} loading={busy} onClick={apply}>
                    {p.fee.totalInr ? `Apply & pay ${money(p.fee.totalInr, 'INR')}` : 'Submit application'} <span className="arrow">→</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
