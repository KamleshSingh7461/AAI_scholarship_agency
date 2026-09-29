'use client';
import { AuthProvider } from '@aci/web-shared/auth';
import { ToastProvider } from '@aci/web-shared/ui';
import type { ReactNode } from 'react';
import { CurrencyProvider } from '@/components/money';

const STAFF = ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'REVIEWER', 'UNIVERSITY_REP'];

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider allowedRoles={STAFF}>
        <CurrencyProvider>{children}</CurrencyProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
