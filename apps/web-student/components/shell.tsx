'use client';
import Image from 'next/image';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@aci/web-shared/auth';
import { useApi } from '@aci/web-shared/hooks';
import { AthleteBib } from './race';

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/programs', label: 'Scholarships' },
  { href: '/applications', label: 'My applications' },
  { href: '/agreements', label: 'Agreements' },
  { href: '/renewals', label: 'Yearly renewals' },
  { href: '/documents', label: 'Documents' },
  { href: '/payments', label: 'Payments' },
  { href: '/profile', label: 'My profile' },
];

export function PortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const { data: me } = useApi<{ profile: { firstName: string | null; lastName: string | null; athleteCode: string | null } }>('/athletes/me');
  const { data: envelopes } = useApi<{ status: string }[]>('/esign/envelopes/mine');
  const pendingSign = envelopes?.filter((e) => e.status === 'SENT' || e.status === 'VIEWED').length ?? 0;
  const name = [me?.profile.firstName, me?.profile.lastName].filter(Boolean).join(' ') || user?.phone;

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)] print:block">
      {/* ---------------------------------------------------------------- Desktop rail */}
      <aside className="sticky top-0 hidden h-screen flex-col overflow-y-auto bg-ink px-5 pb-5 pt-6 text-paper lg:flex print:!hidden">
        <Link href="/" className="block px-1" aria-label="Athlete portal home">
          <Image src="/wordmark.png" alt="Alumni Connect India" width={983} height={285} className="h-9 w-auto invert" priority />
        </Link>
        <p className="eyebrow mt-3 px-1 text-[0.62rem] text-paper/45">Athlete portal</p>

        <div className="mt-6">
          <AthleteBib code={me?.profile.athleteCode} name={name} notch="var(--color-ink)" />
        </div>

        <nav className="mt-7 flex-1" aria-label="Portal">
          <ul>
            {NAV.map((n, i) => {
              const active = isActive(n.href);
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    aria-current={active ? 'page' : undefined}
                    className={clsx(
                      'group relative flex items-center gap-3 border-b border-paper/10 py-3 pl-3 pr-1 text-[15px] font-semibold transition-colors',
                      active ? 'text-paper' : 'text-paper/60 hover:text-paper',
                    )}
                  >
                    <span className={clsx('absolute inset-y-2 left-0 w-[3px] transition-colors', active ? 'bg-brand-500' : 'bg-transparent group-hover:bg-paper/30')} />
                    <span className="eyebrow w-5 text-[0.62rem] text-paper/40">{String(i + 1).padStart(2, '0')}</span>
                    <span className="flex-1">{n.label}</span>
                    {n.href === '/agreements' && pendingSign > 0 && (
                      <span className="eyebrow rounded-[3px] bg-brand-600 px-1.5 py-0.5 text-[0.62rem] text-white">{pendingSign} to sign</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <button onClick={() => logout()} className="eyebrow mt-6 self-start px-1 text-[0.68rem] text-paper/55 hover:text-paper">
          Log out →
        </button>
      </aside>

      {/* ---------------------------------------------------------------- Mobile bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-ink/15 bg-paper/90 px-4 backdrop-blur-md lg:hidden print:hidden">
        <Link href="/" aria-label="Athlete portal home">
          <Image src="/wordmark.png" alt="Alumni Connect India" width={983} height={285} className="h-8 w-auto" />
        </Link>
        <button
          onClick={() => setOpen(true)}
          className="eyebrow flex h-10 items-center gap-2 rounded-[4px] border border-ink px-3.5 font-semibold"
          aria-expanded={open}
          aria-controls="portal-menu"
        >
          Menu
          {pendingSign > 0 && <span className="size-2 rounded-full bg-brand-600" aria-label={`${pendingSign} to sign`} />}
        </button>
      </header>
      {open && (
        <div id="portal-menu" className="fixed inset-0 z-50 overflow-y-auto bg-ink px-5 pb-10 pt-4 text-paper lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="flex h-12 items-center justify-between">
            <Image src="/wordmark.png" alt="Alumni Connect India" width={983} height={285} className="h-8 w-auto invert" />
            <button onClick={() => setOpen(false)} className="eyebrow h-10 rounded-[4px] border border-paper/40 px-3.5 font-semibold">
              Close
            </button>
          </div>
          <div className="mt-6 max-w-xs">
            <AthleteBib code={me?.profile.athleteCode} name={name} notch="var(--color-ink)" />
          </div>
          <nav className="mt-6" aria-label="Portal">
            {NAV.map((n, i) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(n.href) ? 'page' : undefined}
                className={clsx('display flex items-baseline justify-between border-b border-paper/10 py-3 text-4xl', isActive(n.href) ? 'text-brand-400' : 'text-paper')}
              >
                {n.label}
                <span className="eyebrow text-[0.62rem] text-paper/40">
                  {n.href === '/agreements' && pendingSign > 0 ? `${pendingSign} to sign` : String(i + 1).padStart(2, '0')}
                </span>
              </Link>
            ))}
          </nav>
          <button onClick={() => logout()} className="eyebrow mt-8 text-paper/60">
            Log out →
          </button>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-12 lg:py-12">{children}</main>
    </div>
  );
}
