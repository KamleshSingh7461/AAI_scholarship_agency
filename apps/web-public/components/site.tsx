import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { inr, publicApi, STUDENT_APP_URL, type CatalogProgram, type CatalogStats } from '@/lib/api';
import { MobileNav } from './mobile-nav';

export const NAV = [
  { href: '/scholarships', label: 'Scholarships' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export const SIGNUP_URL = `${STUDENT_APP_URL}/login?signup=1`;
export const LOGIN_URL = `${STUDENT_APP_URL}/login`;

export function Logo({ light = false, className = 'h-10' }: { light?: boolean; className?: string }) {
  return (
    <Link href="/" className="inline-flex shrink-0" aria-label="Alumni Connect India home">
      <Image
        src="/wordmark.png"
        alt="Alumni Connect India Private Limited"
        width={983}
        height={285}
        className={`${className} w-auto ${light ? 'invert' : ''}`}
        priority
      />
    </Link>
  );
}

export async function Header() {
  const stats = await publicApi<CatalogStats>('/catalog/stats');
  const ticker = [
    'Intake 2026–27 open',
    ...(stats
      ? [
          `${stats.openPrograms} program${stats.openPrograms === 1 ? '' : 's'} taking applications`,
          `${stats.seatsLeft} seats left`,
          `${stats.universities} partner universit${stats.universities === 1 ? 'y' : 'ies'}`,
        ]
      : []),
    'Log in with a WhatsApp or SMS code',
    'Scholarships renewed every year',
  ];
  const run = (hidden: boolean) => (
    <span className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {ticker.map((t) => (
        <span key={t} className="flex items-center">
          <span className="px-6">{t}</span>
          <span className="text-brand-400">/</span>
        </span>
      ))}
    </span>
  );

  return (
    <>
      <div className="ticker eyebrow bg-ink py-2.5 text-[0.7rem] text-paper/85">
        <div className="ticker-track">
          {run(false)}
          {run(true)}
        </div>
      </div>
      <header className="sticky top-0 z-40 border-b border-ink/15 bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
          <Logo className="h-10 lg:h-11" />
          <nav className="eyebrow hidden items-center gap-8 text-ink/80 lg:flex" aria-label="Main">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="link-grow hover:text-ink">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-5 sm:flex">
            <a href={LOGIN_URL} className="link-grow font-semibold">Log in</a>
            <a href={SIGNUP_URL} className="btn btn-ink btn-sm">
              Create profile <span className="arrow">→</span>
            </a>
          </div>
          <MobileNav nav={NAV} loginUrl={LOGIN_URL} signupUrl={SIGNUP_URL} />
        </div>
      </header>
    </>
  );
}

export function Footer() {
  const cols: { title: string; links: { href: string; label: string; external?: boolean }[] }[] = [
    {
      title: 'Athletes',
      links: [
        { href: '/scholarships', label: 'Browse scholarships' },
        { href: SIGNUP_URL, label: 'Create your profile', external: true },
        { href: LOGIN_URL, label: 'Athlete log-in', external: true },
      ],
    },
    {
      title: 'Company',
      links: [
        { href: '/about', label: 'About us' },
        { href: '/contact', label: 'Contact us' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { href: '/privacy', label: 'Privacy policy' },
        { href: '/terms', label: 'Terms and conditions' },
      ],
    },
  ];
  return (
    <footer className="bg-paper">
      <div className="mx-auto grid grid-cols-1 max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-12">
        <div className="md:col-span-5">
          <Logo className="h-12" />
          <p className="mt-6 max-w-sm text-ink/65">
            We work with partner universities to place talented student-athletes on athletic scholarships — with transparent terms, secure paperwork and
            support through every year of study.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 md:col-span-7">
          {cols.map((c) => (
            <div key={c.title}>
              <p className="eyebrow text-ink/50">{c.title}</p>
              <ul className="mt-4 space-y-3 font-medium">
                {c.links.map((l) => (
                  <li key={l.label}>
                    {l.external ? (
                      <a href={l.href} className="link-grow">{l.label}</a>
                    ) : (
                      <Link href={l.href} className="link-grow">{l.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-ink/15">
        <div className="eyebrow mx-auto flex max-w-7xl flex-wrap justify-between gap-3 px-4 py-6 text-[0.7rem] text-ink/55 sm:px-6">
          <p>© {new Date().getFullYear()} Alumni Connect India Private Limited</p>
          <p>Made for India’s student-athletes</p>
        </div>
      </div>
    </footer>
  );
}

export function SectionHeading({ eyebrow, title, light = false, children }: { eyebrow: string; title: ReactNode; light?: boolean; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div>
        <p className={`eyebrow ${light ? 'text-paper/60' : 'text-brand-600'}`}>{eyebrow}</p>
        <h2 className="display mt-3 text-[clamp(2.75rem,7vw,5.5rem)]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

/** Splits a program code like "IES-4Y-2526-412" into the printed prefix and the big bib number. */
export function bibNumber(code: string): [string, string] {
  const i = code.lastIndexOf('-');
  return i > 0 ? [code.slice(0, i), code.slice(i + 1)] : ['', code];
}

export const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export function SeatsMeter({ left, total, dark = false }: { left: number; total: number; dark?: boolean }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((left / total) * 100))) : 0;
  const few = total > 0 && left > 0 && left / total <= 0.2;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">{left === 0 ? 'All seats taken' : `${left} of ${total} seats left`}</span>
        {few && <span className="eyebrow text-[0.65rem] text-brand-600">Few left</span>}
      </div>
      <div className={`meter mt-2 ${dark ? 'bg-paper/15' : ''}`} role="presentation">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ProgramCard({ p }: { p: CatalogProgram }) {
  const [prefix, number] = bibNumber(p.code);
  const place = [p.university?.city, p.university?.state].filter(Boolean).join(', ');
  return (
    <Link href={`/scholarships/${p.slug}`} className="bib group" aria-label={`${p.name}, ${p.university?.name ?? ''}`}>
      <span className="bib-pin left-3 top-3 z-10" aria-hidden />
      <span className="bib-pin right-3 top-3 z-10" aria-hidden />
      <div className="bib-band px-7 pb-4 pt-6">
        <p className="display truncate text-2xl">{p.university?.shortName ?? p.university?.name}</p>
        <p className="eyebrow mt-1 truncate text-[0.68rem] text-white/80">{place || 'India'}</p>
      </div>
      <div className="px-7 pb-6 pt-5">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow text-[0.68rem] text-ink/50">{prefix}</p>
          <p className="eyebrow text-[0.68rem] text-ink/50">{p.durationYears}-yr · {p.academicYear}</p>
        </div>
        <p className="display mt-1 text-[6.5rem] leading-[0.82] tracking-tight transition-colors group-hover:text-brand-600">{number}</p>
        <h3 className="mt-3 text-lg font-semibold leading-snug">{p.name}</h3>
      </div>
      <div className="bib-stub px-7 pb-7 pt-5">
        <dl className="grid grid-cols-3 gap-3">
          <div>
            <dt className="eyebrow text-[0.62rem] text-ink/50">Per year</dt>
            <dd className="mt-1 font-bold tabular-nums">{inr(p.benefitsInr.annualValue)}</dd>
          </div>
          <div>
            <dt className="eyebrow text-[0.62rem] text-ink/50">Total</dt>
            <dd className="mt-1 font-bold tabular-nums text-accent-700">{inr(p.benefitsInr.totalValue)}</dd>
          </div>
          <div>
            <dt className="eyebrow text-[0.62rem] text-ink/50">Fee</dt>
            <dd className="mt-1 font-bold tabular-nums">{p.fee.totalInr > 0 ? inr(p.fee.totalInr) : 'Free'}</dd>
          </div>
        </dl>
        <div className="mt-5">
          <SeatsMeter left={p.seatsLeft} total={p.seatsTotal} />
        </div>
        {p.applicationClosesAt && <p className="eyebrow mt-4 text-[0.65rem] text-ink/55">Closes {shortDate(p.applicationClosesAt)}</p>}
      </div>
      <span className="bib-pin bottom-3 left-3" aria-hidden />
      <span className="bib-pin bottom-3 right-3" aria-hidden />
    </Link>
  );
}
