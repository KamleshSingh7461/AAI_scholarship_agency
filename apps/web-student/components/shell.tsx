'use client';
import Image from 'next/image';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { CreditCard, FileSignature, FolderOpen, GraduationCap, Home, LogOut, Menu, RefreshCw, Search, UserRound, X } from 'lucide-react';
import { useAuth } from '@aci/web-shared/auth';
import { Avatar } from '@aci/web-shared/ui';
import { useApi } from '@aci/web-shared/hooks';

const NAV = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/programs', label: 'Scholarships', icon: Search },
  { href: '/applications', label: 'My applications', icon: GraduationCap },
  { href: '/agreements', label: 'Agreements', icon: FileSignature },
  { href: '/renewals', label: 'Yearly renewals', icon: RefreshCw },
  { href: '/documents', label: 'Documents', icon: FolderOpen },
  { href: '/payments', label: 'Payments', icon: CreditCard },
  { href: '/profile', label: 'My profile', icon: UserRound },
];

export function PortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const { data: me } = useApi<{ profile: { firstName: string | null; lastName: string | null; athleteCode: string | null } }>('/athletes/me');
  const { data: envelopes } = useApi<{ status: string }[]>('/esign/envelopes/mine');
  const pendingSign = envelopes?.filter((e) => e.status === 'SENT' || e.status === 'VIEWED').length ?? 0;
  const name = [me?.profile.firstName, me?.profile.lastName].filter(Boolean).join(' ') || user?.phone;

  const nav = (
    <nav className="space-y-1">
      {NAV.map((n) => {
        const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setOpen(false)}
            className={clsx(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
              active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )}
          >
            <n.icon className="size-[18px]" />
            <span className="flex-1">{n.label}</span>
            {n.href === '/agreements' && pendingSign > 0 && <span className="rounded-full bg-brand-600 px-2 text-[11px] font-bold text-white">{pendingSign}</span>}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-slate-200 bg-white p-5 lg:flex">
        <Link href="/" className="mb-6 flex flex-col items-start px-2">
          <Image
            src="/logo.png"
            alt="Alumni Connect India"
            width={200}
            height={56}
            className="h-14 w-auto object-contain"
            priority
          />
          <span className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-400">Athlete Portal</span>
        </Link>
        {nav}
        <div className="mt-auto flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <Avatar name={name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
            <p className="text-xs text-slate-500">{me?.profile.athleteCode}</p>
          </div>
          <button onClick={() => logout()} title="Log out" className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-700">
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="Alumni Connect India"
            width={150}
            height={40}
            className="h-10 w-auto object-contain"
          />
        </Link>
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-slate-600" aria-label="Menu">
          <Menu className="size-6" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="h-full w-72 bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <span className="text-sm font-extrabold">Menu</span>
              <button onClick={() => setOpen(false)} aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            {nav}
            <button onClick={() => logout()} className="mt-6 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              <LogOut className="size-[18px]" /> Log out
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10">{children}</main>
    </div>
  );
}
