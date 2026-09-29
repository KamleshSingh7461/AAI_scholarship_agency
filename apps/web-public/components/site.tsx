import Image from 'next/image';
import Link from 'next/link';
import { GraduationCap, MapPin, Timer, Users } from 'lucide-react';
import { inr, STUDENT_APP_URL, type CatalogProgram } from '@/lib/api';

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center" aria-label="Alumni Connect India home">
      <Image
        src="/logo.png"
        alt="Alumni Connect India Private Limited"
        width={260}
        height={72}
        className={`h-16 w-auto object-contain ${light ? 'brightness-0 invert' : ''}`}
        priority
      />
    </Link>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-brand-600 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-24 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-6 text-base font-semibold text-slate-600 md:flex">
          <Link href="/scholarships" className="hover:text-slate-900">Scholarships</Link>
          <Link href="/about" className="text-accent-600 hover:text-accent-700">About Us</Link>
          <span className="text-slate-300">|</span>
          <Link href="/contact" className="text-accent-600 hover:text-accent-700">Contact Us</Link>
        </nav>
        <div className="flex items-center gap-2 text-base font-semibold">
          <a href={`${STUDENT_APP_URL}/login`} className="rounded-lg px-3 py-2 text-accent-600 hover:bg-accent-50">Log-in</a>
          <a href={`${STUDENT_APP_URL}/login?signup=1`} className="rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700">Sign-up</a>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-24 border-t-2 border-brand-600 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-md text-sm text-slate-500">
            Alumni Connect India works with partner universities to place talented student-athletes on athletic scholarships — with transparent terms, secure
            paperwork and support through every year of study.
          </p>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-slate-900">Athletes</p>
          <ul className="mt-3 space-y-2 text-slate-600">
            <li><Link href="/scholarships" className="hover:text-slate-900">Browse scholarships</Link></li>
            <li><a href={`${STUDENT_APP_URL}/login?signup=1`} className="hover:text-slate-900">Create your profile</a></li>
            <li><a href={`${STUDENT_APP_URL}/login`} className="hover:text-slate-900">Athlete log-in</a></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-slate-900">Company</p>
          <ul className="mt-3 space-y-2 text-slate-600">
            <li><Link href="/about" className="hover:text-slate-900">About us</Link></li>
            <li><Link href="/contact" className="hover:text-slate-900">Contact us</Link></li>
            <li><Link href="/privacy" className="hover:text-slate-900">Privacy policy</Link></li>
            <li><Link href="/terms" className="hover:text-slate-900">Terms and conditions</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-100 py-6 text-center text-sm font-semibold text-accent-600">
        <Link href="/privacy">Privacy Policy</Link> <span className="text-slate-300">|</span> <Link href="/terms">Terms and Conditions</Link>{' '}
        <span className="text-slate-300">|</span> <Link href="/contact">Contact Us</Link>
        <p className="mt-2">© {new Date().getFullYear()} AlumniConnect. All Rights Reserved.</p>
      </div>
    </footer>
  );
}

export function ProgramCard({ p }: { p: CatalogProgram }) {
  const closes = p.applicationClosesAt ? new Date(p.applicationClosesAt) : null;
  return (
    <Link
      href={`/scholarships/${p.slug}`}
      className="group flex flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-brand-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <GraduationCap className="size-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">{p.university?.name}</p>
            <p className="flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="size-3" />
              {[p.university?.city, p.university?.state].filter(Boolean).join(', ')}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-accent-50 px-2.5 py-1 text-xs font-bold text-accent-700">{p.durationYears}-Year</span>
      </div>
      <h3 className="mt-5 text-lg font-bold leading-snug text-slate-900 group-hover:text-brand-700">{p.name}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-slate-500">{p.description}</p>
      <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Per year</p>
          <p className="text-lg font-bold text-slate-900">{inr(p.benefitsInr.annualValue)}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total value</p>
          <p className="text-lg font-bold text-accent-700">{inr(p.benefitsInr.totalValue)}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-1"><Users className="size-3.5" /> {p.seatsLeft} of {p.seatsTotal} seats left</span>
        {closes && <span className="flex items-center gap-1"><Timer className="size-3.5" /> Closes {closes.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
      </div>
      <p className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
        Application fee: <span className="font-semibold text-slate-800">{p.fee.totalInr > 0 ? `${inr(p.fee.totalInr)} incl. GST` : 'Free'}</span>
      </p>
    </Link>
  );
}
