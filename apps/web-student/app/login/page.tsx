'use client';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { useAuth } from '@aci/web-shared/auth';
import { OtpLogin } from '@aci/web-shared/otp-login';
import { PageLoader } from '@aci/web-shared/ui';

const PUBLIC_SITE = process.env.NEXT_PUBLIC_PUBLIC_SITE_URL ?? 'http://localhost:3000';

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
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink-900 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(208,38,46,0.5),transparent_60%)]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <a href={PUBLIC_SITE} className="flex items-center">
            <Image
              src="/logo.png"
              alt="Alumni Connect India"
              width={240}
              height={64}
              className="h-16 w-auto object-contain brightness-0 invert"
              priority
            />
          </a>
          <div>
            <h2 className="text-4xl font-black leading-tight">One profile. Every scholarship you qualify for.</h2>
            <ul className="mt-8 space-y-3 text-white/80">
              <li>✓ Log in with a code on WhatsApp or SMS — no passwords</li>
              <li>✓ Apply, pay and sign agreements online</li>
              <li>✓ Renewal reminders every year on WhatsApp</li>
            </ul>
          </div>
          <p className="text-xs text-white/50">© {new Date().getFullYear()} AlumniConnect. All Rights Reserved.</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <OtpLogin
            audience="student"
            title={signup ? 'Create your athlete account' : 'Log in to your athlete account'}
            subtitle={signup ? 'Start with your mobile number. We will verify it with a one-time code.' : 'New here? Just enter your number — we will create your account.'}
            onSuccess={(_user, isNew) => window.location.replace(isNew ? '/onboarding' : safeNext ?? '/')}
          />
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
