'use client';
import Image from 'next/image';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@aci/web-shared/auth';
import { Avatar } from '@aci/web-shared/ui';
import { statusLabel } from '@aci/web-shared';
import { CurrencyToggle } from './money';

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'FINANCE' | 'REVIEWER' | 'UNIVERSITY_REP';
const ALL: Role[] = ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'REVIEWER', 'UNIVERSITY_REP'];

export const NAV: { section: string; href: string; label: string; roles: Role[] }[] = [
  { section: 'Work', href: '/', label: 'Dashboard', roles: ALL },
  { section: 'Work', href: '/students', label: 'Students', roles: ALL },
  { section: 'Work', href: '/applications', label: 'Applications', roles: ALL },
  { section: 'Work', href: '/athletes', label: 'Athlete profiles', roles: ['SUPER_ADMIN', 'ADMIN', 'REVIEWER', 'FINANCE', 'UNIVERSITY_REP'] },
  { section: 'Work', href: '/paperwork', label: 'Signed Paperwork', roles: ['SUPER_ADMIN', 'ADMIN', 'REVIEWER', 'FINANCE', 'UNIVERSITY_REP'] },
  { section: 'Work', href: '/renewals', label: 'Yearly Renewals', roles: ALL },
  { section: 'Finance', href: '/finance', label: 'Money & Value', roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE'] },
  { section: 'Finance', href: '/payments', label: 'Payments', roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'REVIEWER'] },
  { section: 'Finance', href: '/reports', label: 'Reports', roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'REVIEWER'] },
  { section: 'Setup', href: '/universities', label: 'Universities', roles: ALL },
  { section: 'Setup', href: '/programs', label: 'Programs', roles: ALL },
  { section: 'Setup', href: '/settings', label: 'Settings', roles: ['SUPER_ADMIN', 'ADMIN'] },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const role = (user?.role ?? 'REVIEWER') as Role;
  const items = NAV.filter((n) => n.roles.includes(role));
  const portal = role === 'UNIVERSITY_REP' ? 'University portal' : 'Staff portal';

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const nav = (
    <nav aria-label="Admin">
      {items.map((n, i) => {
        const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
        const newSection = i === 0 || items[i - 1].section !== n.section;
        return (
          <div key={n.href}>
            {newSection && <p className={clsx('eyebrow mb-1 px-3 text-[0.6rem] text-paper/35', i > 0 && 'mt-6')}>{n.section}</p>}
            <Link
              href={n.href}
              onClick={() => setOpen(false)}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'group relative flex items-center py-2 pl-3 pr-2 text-[14.5px] font-semibold transition-colors',
                active ? 'text-paper' : 'text-paper/60 hover:text-paper',
              )}
            >
              <span className={clsx('absolute inset-y-1.5 left-0 w-[3px] transition-colors', active ? 'bg-brand-500' : 'bg-transparent group-hover:bg-paper/25')} />
              {n.label}
            </Link>
          </div>
        );
      })}
    </nav>
  );

  const sidebar = (
    <div className="flex h-full flex-col bg-ink px-4 pb-4 pt-6 text-paper">
      <Link href="/" className="block px-2" aria-label={`${portal} home`}>
        <Image src="/wordmark.png" alt="Alumni Connect India Private Limited" width={983} height={285} className="h-9 w-auto invert" priority />
      </Link>
      <p className="eyebrow mt-3 px-2 text-[0.6rem] text-paper/45">{portal}</p>
      <div className="mt-8 flex-1 overflow-y-auto">{nav}</div>
      <div className="mt-4 space-y-3 border-t border-paper/10 pt-4">
        <CurrencyToggle dark />
        <div className="flex items-center gap-3">
          <Avatar name={user?.fullName ?? user?.phone} size={34} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user?.fullName ?? user?.phone}</p>
            <p className="eyebrow text-[0.58rem] text-paper/50">{statusLabel(user?.role)}</p>
          </div>
        </div>
        <button onClick={() => logout()} className="eyebrow px-0.5 text-[0.62rem] text-paper/55 hover:text-paper">
          Log out →
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)] print:block">
      <aside className="sticky top-0 hidden h-screen lg:block print:!hidden">{sidebar}</aside>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-ink px-4 text-paper lg:hidden print:hidden">
        <Link href="/" aria-label={`${portal} home`}>
          <Image src="/wordmark.png" alt="Alumni Connect India" width={983} height={285} className="h-7 w-auto invert" />
        </Link>
        <button
          onClick={() => setOpen(true)}
          className="eyebrow h-9 rounded-[4px] border border-paper/40 px-3 text-[0.66rem] font-semibold"
          aria-expanded={open}
          aria-controls="admin-menu"
        >
          Menu
        </button>
      </header>
      {open && (
        <div id="admin-menu" className="fixed inset-0 z-50 bg-ink/60 lg:hidden" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Menu">
          <div className="relative h-full w-72 max-w-[85vw]" onClick={(e) => e.stopPropagation()}>
            <button className="eyebrow absolute right-3 top-4 z-10 text-[0.62rem] text-paper/70 hover:text-paper" onClick={() => setOpen(false)}>
              Close
            </button>
            {sidebar}
          </div>
        </div>
      )}
      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</main>
    </div>
  );
}
