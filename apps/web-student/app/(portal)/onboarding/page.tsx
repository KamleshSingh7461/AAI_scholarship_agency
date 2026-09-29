'use client';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { apiPost } from '@aci/web-shared';
import { mutate, useApi } from '@aci/web-shared/hooks';
import { Alert, Button, Card, PageLoader, useToast } from '@aci/web-shared/ui';
import { AcademicStep, DocumentsStep, PersonalStep, SportsStep } from '@/components/onboarding/steps';
import type { MeResponse } from '@/lib/types';

const STEPS = [
  { n: 1, title: 'Personal info', key: 'personal' },
  { n: 2, title: 'Academic info', key: 'academic' },
  { n: 3, title: 'Sports metrix', key: 'sports' },
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
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-black tracking-tight text-slate-900 underline decoration-brand-600 decoration-4 underline-offset-8">ATHLETE SIGN UP</h1>
        <p className="mt-4 text-sm text-slate-500">Complete all four steps. Your progress is saved after each step.</p>
      </div>

      <ol className="mb-8 grid grid-cols-4 gap-2">
        {STEPS.map((s) => {
          const done = data.completeness.steps[s.key];
          return (
            <li key={s.n}>
              <button onClick={() => setStep(s.n)} className="group w-full text-left">
                <div className={clsx('h-1.5 rounded-full', step === s.n ? 'bg-brand-600' : done ? 'bg-accent-500' : 'bg-slate-200')} />
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={clsx(
                      'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      done ? 'bg-accent-500 text-white' : step === s.n ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600',
                    )}
                  >
                    {done ? <Check className="size-3.5" /> : s.n}
                  </span>
                  <span className={clsx('hidden text-xs font-semibold sm:block', step === s.n ? 'text-slate-900' : 'text-slate-500')}>
                    {s.title} (Step-{s.n})
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
        <h2 className="mb-6 text-lg font-bold text-slate-900 underline decoration-slate-300 underline-offset-4">
          {STEPS[step - 1].title} (Step-{step})
        </h2>
        {step === 1 && <PersonalStep profile={data.profile} onSaved={onSaved} locked={locked} />}
        {step === 2 && <AcademicStep profile={data.profile} onSaved={onSaved} locked={locked} />}
        {step === 3 && <SportsStep profile={data.profile} onSaved={onSaved} locked={locked} />}
        {step === 4 && <DocumentsStep me={data} onSaved={onSaved} locked={locked} />}
      </Card>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <Button variant="secondary" disabled={step === 1} onClick={() => setStep(step - 1)}>
          Prev
        </Button>
        {step < 4 ? (
          <Button variant="secondary" onClick={() => setStep(step + 1)}>
            Next
          </Button>
        ) : (
          !locked && (
            <div className="flex flex-col items-end gap-2">
              {data.completeness.missing.length > 0 && <p className="text-xs text-slate-500">Still missing: {data.completeness.missing.join(' · ')}</p>}
              <Button size="lg" onClick={submit} loading={submitting} disabled={!data.completeness.canSubmit}>
                Sign Up
              </Button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
