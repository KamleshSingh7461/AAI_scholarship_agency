'use client';
import Image from 'next/image';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import {
  BarChart3,
  Building2,
  ClipboardList,
  CreditCard,
  FileSignature,
  GraduationCap,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  Settings,
  Trophy,
  UserRoundSearch,
  X,
} from 'lucide-react';
import { useAuth } from '@aci/web-shared/auth';
import { Avatar } from '@aci/web-shared/ui';
import { statusLabel } from '@aci/web-shared';
import { CurrencyToggle } from './money';

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'FINANCE' | 'REVIEWER' | 'UNIVERSITY_REP';
const ALL: Role[] = ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'REVIEWER', 'UNIVERSITY_REP'];

export const NAV: { section?: string; href: string; label: string; icon: typeof LayoutDashboard; roles: Role[] }[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ALL },
  { href: '/students', label: 'Students', icon: Trophy, roles: ALL },
  { href: '/applications', label: 'Applications', icon: ClipboardList, roles: ALL },
  { href: '/athletes', label: 'Athlete profiles', icon: UserRoundSearch, roles: ['SUPER_ADMIN', 'ADMIN', 'REVIEWER', 'FINANCE', 'UNIVERSITY_REP'] },
  { href: '/paperwork', label: 'Signed Paperwork', icon: FileSignature, roles: ['SUPER_ADMIN', 'ADMIN', 'REVIEWER', 'FINANCE', 'UNIVERSITY_REP'] },
  { href: '/renewals', label: 'Yearly Renewals', icon: RefreshCw, roles: ALL },
  { section: 'Finance', href: '/finance', label: 'Money & Value', icon: IndianRupee, roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE'] },
  { href: '/payments', label: 'Payments', icon: CreditCard, roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'REVIEWER'] },
  { href: '/reports', label: 'Reports', icon: BarChart3, roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'REVIEWER'] },
  { section: 'Setup', href: '/universities', label: 'Universities', icon: Building2, roles: ALL },
  { href: '/programs', label: 'Programs', icon: GraduationCap, roles: ALL },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['SUPER_ADMIN', 'ADMIN'] },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const role = (user?.role ?? 'REVIEWER') as Role;
  const items = NAV.filter((n) => n.roles.includes(role));

  const nav = (
    <nav className="space-y-0.5">
      {items.map((n) => {
        const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
        return (
          <div key={n.href}>
            {n.section && <p className="mb-1 mt-5 px-3 text-[10px] font-bold uppercase tracking-widest text-white/35">{n.section}</p>}
            <Link
              href={n.href}
              onClick={() => setOpen(false)}
              className={clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                active ? 'bg-brand-600 text-white shadow-sm' : 'text-white/70 hover:bg-white/5 hover:text-white',
              )}
            >
              <n.icon className="size-[18px]" />
              {n.label}
            </Link>
          </div>
        );
      })}
    </nav>
  );

  const sidebar = (
    <div className="flex h-full flex-col bg-ink-900 p-4 text-white">
      <Link href="/" className="mb-6 flex flex-col items-start px-2">
        <Image
          src="/logo.png"
          alt="Alumni Connect India Private Limited"
          width={210}
          height={56}
          className="h-14 w-auto object-contain brightness-0 invert"
          priority
        />
        <span className="mt-1 text-xs font-semibold uppercase tracking-widest text-white/40">Scholarship Platform</span>
      </Link>
      <div className="flex-1 overflow-y-auto">{nav}</div>
      <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
        <CurrencyToggle dark />
        <div className="flex items-center gap-3">
          <Avatar name={user?.fullName ?? user?.phone} size={34} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user?.fullName ?? user?.phone}</p>
            <p className="text-[11px] text-white/50">{statusLabel(user?.role)}</p>
          </div>
          <button onClick={() => logout()} className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white" title="Log out">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="sticky top-0 hidden h-screen lg:block">{sidebar}</aside>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-ink-900 px-4 text-white lg:hidden">
        <span className="text-sm font-extrabold">ACI Admin</span>
        <button onClick={() => setOpen(true)} aria-label="Menu">
          <Menu className="size-6" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 lg:hidden" onClick={() => setOpen(false)}>
          <div className="relative h-full w-72" onClick={(e) => e.stopPropagation()}>
            <button className="absolute right-3 top-3 z-10 text-white" onClick={() => setOpen(false)} aria-label="Close">
              <X className="size-5" />
            </button>
            {sidebar}
          </div>
        </div>
      )}
      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
