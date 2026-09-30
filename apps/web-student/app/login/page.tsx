'use client';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { useAuth } from '@aci/web-shared/auth';
import { OtpLogin } from '@aci/web-shared/otp-login';
import { PageLoader } from '@aci/web-shared/ui';

const PUBLIC_SITE = process.env.NEXT_PUBLIC_PUBLIC_SITE_URL ?? 'http://localhost:3000';

const POINTS = ['Log in with a code on WhatsApp or SMS — no passwords', 'Apply, pay and sign agreements online', 'Renewal reminders every year on WhatsApp'];

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { status } = useAuth();
  const next = params.get('next');
  const signup = params.get('signup') === '1';
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;

  useEffect(() => {
    if (status === 'authenticated') router.replace(safeNext ?? '/');
  }, [status, router, safeNext]);

  if (status === 'loading') return <PageLoader />;
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="relative hidden flex-col overflow-hidden bg-ink text-paper lg:flex">
        <div className="flex flex-1 flex-col justify-between p-12 xl:p-16">
          <a href={PUBLIC_SITE} className="inline-flex self-start" aria-label="Alumni Connect India home">
            <Image src="/wordmark.png" alt="Alumni Connect India" width={983} height={285} className="h-11 w-auto invert" priority />
          </a>
          <div>
            <p className="eyebrow text-brand-400">Athlete portal</p>
            <h2 className="display rise mt-4 text-[clamp(3.5rem,6.5vw,6.5rem)]">
              One profile.
              <br />
              Every scholarship
              <br />
              you qualify for.
            </h2>
            <ol className="mt-10 max-w-md border-t border-paper/15">
              {POINTS.map((t, i) => (
                <li key={t} className="rise flex items-baseline gap-5 border-b border-paper/15 py-3.5 text-paper/80" style={{ '--i': i + 3 } as React.CSSProperties}>
                  <span className="eyebrow text-brand-400">0{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
          </div>
          <p className="eyebrow text-[0.65rem] text-paper/40">© {new Date().getFullYear()} Alumni Connect India Private Limited</p>
        </div>
        {/* start line: five lanes */}
        <div className="track relative h-28 border-t-[3px] border-white/90" aria-hidden>
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className="absolute inset-x-0 h-[3px] bg-white/90" style={{ top: `${n * 20}%` }} />
          ))}
          <span className="checker absolute inset-y-0 right-10 w-4" />
        </div>
      </div>

      <div className="flex flex-col px-4 py-8 sm:px-8">
        <a href={PUBLIC_SITE} className="inline-flex self-start lg:hidden" aria-label="Alumni Connect India home">
          <Image src="/wordmark.png" alt="Alumni Connect India" width={983} height={285} className="h-9 w-auto" priority />
        </a>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">
            <p className="eyebrow mb-4 text-brand-600">{signup ? 'New athlete' : 'Welcome back'}</p>
            <OtpLogin
              audience="student"
              title={signup ? 'Create your athlete account' : 'Log in to your athlete account'}
              subtitle={signup ? 'Start with your mobile number. We will verify it with a one-time code.' : 'New here? Just enter your number — we will create your account.'}
              onSuccess={(_user, isNew) => window.location.replace(isNew ? '/onboarding' : safeNext ?? '/')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <LoginInner />
    </Suspense>
  );
}
