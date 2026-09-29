'use client';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';
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
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <div className="mb-6">
          <Image
            src="/logo.png"
            alt="Alumni Connect India Private Limited"
            width={260}
            height={68}
            className="h-16 w-auto object-contain"
            priority
          />
          <p className="mt-2 text-sm font-semibold text-slate-500">Staff &amp; university portal</p>
        </div>
        <OtpLogin audience="staff" title="Staff log-in" subtitle="Only registered staff numbers can log in." onSuccess={() => window.location.replace(safeNext)} />
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
