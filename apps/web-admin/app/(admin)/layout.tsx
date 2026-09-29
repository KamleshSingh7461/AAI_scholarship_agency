'use client';
import { RequireAuth } from '@aci/web-shared/auth';
import { AdminShell } from '@/components/shell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AdminShell>{children}</AdminShell>
    </RequireAuth>
  );
}
