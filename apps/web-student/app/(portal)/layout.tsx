'use client';
import { RequireAuth } from '@aci/web-shared/auth';
import { PortalShell } from '@/components/shell';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <PortalShell>{children}</PortalShell>
    </RequireAuth>
  );
}
