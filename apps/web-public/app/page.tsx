import Link from 'next/link';
import { ArrowRight, BadgeCheck, ClipboardCheck, FileSignature, RefreshCw, ShieldCheck, Trophy, UserRound } from 'lucide-react';
import { ProgramCard } from '@/components/site';
import { inr, publicApi, STUDENT_APP_URL, type CatalogProgram, type CatalogStats } from '@/lib/api';

export const revalidate = 60;

const steps = [
  { icon: UserRound, title: 'Create your athlete profile', text: 'Sign up with your mobile number (WhatsApp or SMS code). Add personal, academic and sports details and upload your documents.' },
  { icon: ClipboardCheck, title: 'Apply to a scholarship', text: 'Pick a program at a partner university and pay the one-time application fee securely online (UPI, cards, net banking).' },
  { icon: BadgeCheck, title: 'Review & university approval', text: 'Our team verifies your profile and recommends you. The university takes the final decision.' },
  { icon: FileSignature, title: 'Sign & start', text: 'Sign your Scholarship Award Agreement and Agency Agreement online. Your scholarship becomes active immediately.' },
  { icon: RefreshCw, title: 'Renew every year', text: 'Confirm enrolment and re-sign once a year on the portal to keep receiving your scholarship. We remind you on WhatsApp.' },
];

export default async function HomePage() {
  const [stats, programs, universities] = await Promise.all([
    publicApi<CatalogStats>('/catalog/stats'),
    publicApi<{ items: CatalogProgram[] }>('/catalog/programs?pageSize=6'),
    publicApi<{ id: string; name: string; city: string | null; state: string | null; openPrograms: number }[]>('/catalog/universities'),
  ]);

  return (
    <>
      <section className="relative overflow-hidden bg-ink-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(208,38,46,0.45),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(34,177,76,0.25),transparent_50%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 ring-1 ring-white/20">
              <Trophy className="size-3.5" /> Athletic scholarships · 2026-27 intake open
            </span>
            <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-6xl">
              Your sport can pay for your <span className="text-brand-400">degree.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/75">
              Alumni Connect India matches student-athletes with scholarships at partner universities — tuition covered, paperwork handled, and support every year
              until you graduate.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={`${STUDENT_APP_URL}/login?signup=1`} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-brand-900/30 hover:bg-brand-500">
                Create athlete profile <ArrowRight className="size-5" />
              </a>
              <Link href="/scholarships" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-6 py-3.5 text-base font-bold text-white ring-1 ring-white/25 hover:bg-white/15">
                Browse scholarships
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 self-center">
            {[
              ['Partner universities', stats ? String(stats.universities) : '—'],
              ['Open programs', stats ? String(stats.openPrograms) : '—'],
              ['Seats available', stats ? String(stats.seatsLeft) : '—'],
              ['Scholarship value available', stats ? inr(stats.availableValueInr, true) : '—'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 backdrop-blur">
                <p className="text-3xl font-black text-white sm:text-4xl">{value}</p>
                <p className="mt-1 text-sm text-white/60">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-widest text-brand-600">How it works</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">From profile to campus in five steps</h2>
        </div>
        <ol className="mt-12 grid gap-6 md:grid-cols-5">
          {steps.map((s, i) => (
            <li key={s.title} className="relative rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-200">
              <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-bold text-white">Step {i + 1}</span>
              <s.icon className="size-7 text-brand-600" />
              <h3 className="mt-4 font-bold text-slate-900">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-brand-600">Open now</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Featured scholarships</h2>
            </div>
            <Link href="/scholarships" className="inline-flex items-center gap-1 text-sm font-bold text-brand-700 hover:underline">
              View all <ArrowRight className="size-4" />
            </Link>
          </div>
          {programs?.items.length ? (
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {programs.items.map((p) => (
                <ProgramCard key={p.id} p={p} />
              ))}
            </div>
          ) : (
            <p className="mt-10 rounded-2xl bg-white p-10 text-center text-slate-500 ring-1 ring-slate-200">New scholarships are being added. Create your profile now so you are ready to apply.</p>
          )}
        </div>
      </section>

      {!!universities?.length && (
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <p className="text-sm font-bold uppercase tracking-widest text-brand-600">Partners</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Partner universities</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {universities.map((u) => (
              <div key={u.id} className="rounded-2xl p-5 ring-1 ring-slate-200">
                <p className="font-bold text-slate-900">{u.name}</p>
                <p className="text-sm text-slate-500">{[u.city, u.state].filter(Boolean).join(', ')}</p>
                <p className="mt-3 text-xs font-semibold text-accent-700">{u.openPrograms} open program{u.openPrograms === 1 ? '' : 's'}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-8 rounded-3xl bg-brand-600 p-10 text-white md:grid-cols-[1fr_auto] md:p-14">
          <div>
            <h2 className="text-3xl font-black tracking-tight">Ready to play at the next level?</h2>
            <p className="mt-3 max-w-2xl text-white/85">
              It takes about 15 minutes to create your profile. Keep your ID, date-of-birth proof, address proof and a passport-size photo ready.
            </p>
            <p className="mt-4 flex items-center gap-2 text-sm text-white/80">
              <ShieldCheck className="size-4" /> Secure OTP login · documents stored encrypted · agreements signed electronically
            </p>
          </div>
          <a href={`${STUDENT_APP_URL}/login?signup=1`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-7 py-4 font-bold text-brand-700 hover:bg-brand-50">
            Get started <ArrowRight className="size-5" />
          </a>
        </div>
      </section>
    </>
  );
}
