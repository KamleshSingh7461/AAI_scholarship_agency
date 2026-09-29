'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, CheckCircle2, CreditCard, Info } from 'lucide-react';
import { ApiError, apiPost, money, pct } from '@aci/web-shared';
import { useApi } from '@aci/web-shared/hooks';
import { Alert, Badge, Button, Card, Checkbox, ErrorState, Field, Input, PageLoader, Textarea } from '@aci/web-shared/ui';
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

  return (
    <div>
      <Link href="/programs" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> All scholarships
      </Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <p className="text-sm font-semibold text-slate-500">{p.university?.name}</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{p.name}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="green">{p.durationYears}-Year award</Badge>
              <Badge>Intake {p.academicYear}</Badge>
              {p.tuitionCoverageBps < 10000 && <Badge tone="blue">{pct(p.tuitionCoverageBps)} tuition</Badge>}
            </div>
            {p.description && <p className="mt-4 whitespace-pre-line text-sm text-slate-600">{p.description}</p>}
          </Card>
          <Card title="Benefits per year" padded={false}>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {(
                  [
                    ['Tuition', p.benefitsInr.tuitionPerYear, p.bearers.tuition],
                    ['Room', p.benefitsInr.roomPerYear, p.bearers.room],
                    ['Food', p.benefitsInr.foodPerYear, p.bearers.food],
                    ['Other', p.benefitsInr.otherPerYear, p.bearers.other],
                  ] as const
                ).map(([label, amt, bearer]) => (
                  <tr key={label}>
                    <td className="px-5 py-3 font-medium text-slate-800">{label}</td>
                    <td className="px-5 py-3 text-slate-500">Paid by {who(bearer)}</td>
                    <td className="px-5 py-3 text-right font-semibold">{bearer === 'STUDENT' ? '—' : money(amt, 'INR')}</td>
                  </tr>
                ))}
                <tr className="bg-accent-50/60">
                  <td className="px-5 py-3 font-bold">Total per year</td>
                  <td />
                  <td className="px-5 py-3 text-right font-bold text-accent-700">{money(p.benefitsInr.annualValue, 'INR')}</td>
                </tr>
              </tbody>
            </table>
            {p.otherCostsNote && <p className="px-5 pb-4 pt-2 text-xs text-slate-500">{p.otherCostsNote}</p>}
          </Card>
          <Card title="Eligibility">
            <ul className="space-y-2 text-sm text-slate-600">
              {p.eligibleSports.length > 0 && <li className="flex gap-2"><CheckCircle2 className="size-4 shrink-0 text-accent-600" /> Sports: {p.eligibleSports.join(', ')}</li>}
              {(p.minAge || p.maxAge) && <li className="flex gap-2"><CheckCircle2 className="size-4 shrink-0 text-accent-600" /> Age {p.minAge ?? 'any'}–{p.maxAge ?? 'any'}</li>}
              {p.eligibilityCriteria && <li className="flex gap-2"><CheckCircle2 className="size-4 shrink-0 text-accent-600" /> {p.eligibilityCriteria}</li>}
            </ul>
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total scholarship value</p>
            <p className="text-3xl font-black text-accent-700">{money(p.benefitsInr.totalValue, 'INR')}</p>
            <p className="text-sm text-slate-500">{p.seatsLeft} of {p.seatsTotal} seats left</p>

            {existing ? (
              <Alert tone="info" className="mt-5" title="You have already applied">
                <Link className="font-semibold underline" href={`/applications/${existing.id}`}>
                  View application {existing.applicationNo} →
                </Link>
              </Alert>
            ) : !profileReady ? (
              <Alert tone="warning" className="mt-5" title="Finish your profile first">
                <Link className="font-semibold underline" href="/onboarding">Complete the 4-step profile →</Link>
              </Alert>
            ) : !p.isOpen ? (
              <Alert tone="warning" className="mt-5">Applications are closed for this scholarship.</Alert>
            ) : (
              <div className="mt-5 space-y-4">
                <Field label="Why should you get this scholarship? (optional)">
                  <Textarea value={statement} onChange={(e) => setStatement(e.target.value)} maxLength={4000} placeholder="Your achievements, goals, circumstances…" />
                </Field>
                {p.courses.length > 0 ? (
                  <Field label="Preferred course">
                    <select className="block h-10 w-full rounded-lg border-0 text-sm ring-1 ring-slate-300" value={course} onChange={(e) => setCourse(e.target.value)}>
                      <option value="">Select</option>
                      {p.courses.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                ) : (
                  <Field label="Preferred course"><Input value={course} onChange={(e) => setCourse(e.target.value)} /></Field>
                )}
                <div className="rounded-xl bg-slate-50 p-4 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">{p.fee.explanation}</span><span>{money(p.fee.baseInr, 'INR')}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">GST</span><span>{money(p.fee.taxInr, 'INR')}</span></div>
                  <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-bold"><span>Application fee</span><span>{p.fee.totalInr ? money(p.fee.totalInr, 'INR') : 'Free'}</span></div>
                  <p className="mt-2 flex gap-1.5 text-xs text-slate-500">
                    <Info className="mt-0.5 size-3.5 shrink-0" />
                    {p.feeRefundableOnRejection ? 'Refunded if your application is not approved.' : 'Non-refundable once paid.'}
                  </p>
                </div>
                <Checkbox
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  label="I confirm my profile information is true, and I understand the university takes the final decision and the scholarship must be renewed every year."
                />
                {err && <Alert tone="error">{err}</Alert>}
                <Button block size="lg" disabled={!agree} loading={busy} onClick={apply} icon={p.fee.totalInr ? <CreditCard className="size-4" /> : undefined}>
                  {p.fee.totalInr ? `Apply & pay ${money(p.fee.totalInr, 'INR')}` : 'Submit application'}
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
