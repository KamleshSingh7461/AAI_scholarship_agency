'use client';
import { AuthProvider } from '@aci/web-shared/auth';
import { ToastProvider } from '@aci/web-shared/ui';
import type { ReactNode } from 'react';

const ROLES = ['ATHLETE'];

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider allowedRoles={ROLES}>{children}</AuthProvider>
    </ToastProvider>
  );
}
