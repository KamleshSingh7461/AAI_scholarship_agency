'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export function MobileNav({ nav, loginUrl, signupUrl }: { nav: { href: string; label: string }[]; loginUrl: string; signupUrl: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        className="eyebrow flex h-11 items-center gap-2 rounded-[4px] border border-ink px-4 font-semibold"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? 'Close' : 'Menu'}
      </button>
      {open && (
        <div id="mobile-menu" className="absolute inset-x-0 top-full border-b border-ink/15 bg-paper px-4 pb-8 pt-4 shadow-[0_24px_40px_-24px_rgb(18_17_16/0.4)] sm:px-6">
          <nav aria-label="Mobile" className="flex flex-col">
            {nav.map((n, i) => (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="display flex items-baseline justify-between border-b border-ink/10 py-4 text-5xl">
                {n.label}
                <span className="eyebrow text-ink/40">0{i + 1}</span>
              </Link>
            ))}
          </nav>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <a href={loginUrl} className="btn btn-sm border border-ink">Log in</a>
            <a href={signupUrl} className="btn btn-sm btn-ink">Create profile</a>
          </div>
        </div>
      )}
    </div>
  );
}
