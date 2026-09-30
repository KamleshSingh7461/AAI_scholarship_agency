'use client';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiPost } from '@aci/web-shared';
import { mutate, useApi } from '@aci/web-shared/hooks';
import { Alert, Button, Card, PageLoader, useToast } from '@aci/web-shared/ui';
import { AcademicStep, DocumentsStep, PersonalStep, SportsStep } from '@/components/onboarding/steps';
import type { MeResponse } from '@/lib/types';

const STEPS = [
  { n: 1, title: 'Personal info', key: 'personal' },
  { n: 2, title: 'Academic info', key: 'academic' },
  { n: 3, title: 'Sports metrics', key: 'sports' },
  { n: 4, title: 'Documents & references', key: 'documents' },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const toast = useToast();
  const { data, mutate: setMe } = useApi<MeResponse>('/athletes/me');
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Resume at the first incomplete step.
  useEffect(() => {
    if (!data) return;
    const first = STEPS.find((s) => !data.completeness.steps[s.key]);
    setStep(first?.n ?? 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!data]);

  if (!data) return <PageLoader />;
  const locked = !['DRAFT', 'CHANGES_REQUESTED'].includes(data.profile.status);
  const doneCount = STEPS.filter((s) => data.completeness.steps[s.key]).length;
  const onSaved = (r: MeResponse) => {
    void setMe(r, { revalidate: false });
    if (step < 4) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const r = await apiPost<MeResponse>('/athletes/me/submit');
      await setMe(r, { revalidate: false });
      void mutate(() => true);
      toast.success('Profile submitted! You can now apply for scholarships.');
      router.push('/programs');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <header className="mb-8 border-b-2 border-ink pb-6">
        <p className="eyebrow text-brand-600">
          {doneCount} of 4 laps complete · progress saved after each step
        </p>
        <h1 className="display rise mt-3 text-[clamp(3rem,8vw,6rem)]">Athlete sign-up</h1>
      </header>

      <ol className="mb-10 grid grid-cols-4 gap-1.5" aria-label="Sign-up steps">
        {STEPS.map((s) => {
          const done = data.completeness.steps[s.key];
          const current = step === s.n;
          return (
            <li key={s.n}>
              <button onClick={() => setStep(s.n)} className="group w-full text-left" aria-current={current ? 'step' : undefined}>
                <div className="split" data-state={current ? 'current' : done ? 'done' : undefined} />
                <div className="mt-3 flex items-baseline gap-2">
                  <span className={clsx('display text-3xl leading-none sm:text-4xl', current ? 'text-brand-600' : done ? 'text-ink' : 'text-slate-400')}>{s.n}</span>
                  <span className="min-w-0">
                    <span className={clsx('hidden text-sm font-semibold leading-tight sm:block', current ? 'text-ink' : 'text-slate-600 group-hover:text-ink')}>{s.title}</span>
                    <span className="eyebrow block text-[0.58rem] text-slate-500">{done ? 'Done' : current ? 'Now' : 'To do'}</span>
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ol>

      {locked && (
        <Alert tone="info" className="mb-6" title="Your profile has been submitted">
          It is locked while our team reviews it. Contact support if you need to change something.
        </Alert>
      )}
      {data.profile.status === 'CHANGES_REQUESTED' && (
        <Alert tone="warning" className="mb-6" title="Changes requested by our team">
          {data.profile.reviewRemarks}
        </Alert>
      )}

      <Card>
        <div className="mb-8 flex items-end gap-4 border-b border-dashed border-ink/20 pb-5">
          <span className="display text-[4.5rem] leading-[0.8] text-brand-600">{step}</span>
          <div>
            <p className="eyebrow text-[0.62rem] text-slate-500">Step {step} of 4</p>
            <h2 className="display mt-1 text-3xl sm:text-4xl">{STEPS[step - 1].title}</h2>
          </div>
        </div>
        {step === 1 && <PersonalStep profile={data.profile} onSaved={onSaved} locked={locked} />}
        {step === 2 && <AcademicStep profile={data.profile} onSaved={onSaved} locked={locked} />}
        {step === 3 && <SportsStep profile={data.profile} onSaved={onSaved} locked={locked} />}
        {step === 4 && <DocumentsStep me={data} onSaved={onSaved} locked={locked} />}
      </Card>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <Button variant="secondary" disabled={step === 1} onClick={() => setStep(step - 1)}>
          ← Prev
        </Button>
        {step < 4 ? (
          <Button variant="secondary" onClick={() => setStep(step + 1)}>
            Next →
          </Button>
        ) : (
          !locked && (
            <div className="flex flex-col items-end gap-2">
              {data.completeness.missing.length > 0 && <p className="max-w-md text-right text-xs text-slate-500">Still missing: {data.completeness.missing.join(' · ')}</p>}
              <Button size="lg" onClick={submit} loading={submitting} disabled={!data.completeness.canSubmit}>
                Submit profile <span className="arrow">→</span>
              </Button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
