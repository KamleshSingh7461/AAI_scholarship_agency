'use client';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { useAuth } from '@aci/web-shared/auth';
import { OtpLogin } from '@aci/web-shared/otp-login';
import { PageLoader } from '@aci/web-shared/ui';

function LoginInner() {
  const router = useRouter();
  const next = useSearchParams().get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  const { status } = useAuth();
  useEffect(() => {
    if (status === 'authenticated') router.replace(safeNext);
  }, [status, router, safeNext]);
  if (status === 'loading') return <PageLoader />;
  return (
    <div className="flex min-h-screen flex-col bg-ink">
      <div className="track relative h-16 shrink-0 border-b-[3px] border-white/90" aria-hidden>
        {[1, 2, 3].map((n) => (
          <span key={n} className="absolute inset-x-0 h-[3px] bg-white/90" style={{ top: `${n * 25}%` }} />
        ))}
        <span className="checker absolute inset-y-0 right-12 w-4" />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-[10px] bg-chalk p-8 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.6)] sm:p-10">
          <Image src="/wordmark.png" alt="Alumni Connect India Private Limited" width={983} height={285} className="h-10 w-auto" priority />
          <p className="eyebrow mb-8 mt-4 text-brand-600">Staff &amp; university portal</p>
          <OtpLogin audience="staff" title="Staff log-in" subtitle="Only registered staff numbers can log in." onSuccess={() => window.location.replace(safeNext)} />
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
