import Link from 'next/link';
import type { CSSProperties } from 'react';
import { KitList } from '@/components/kit-list';
import { Odometer } from '@/components/odometer';
import { Receipt } from '@/components/receipt';
import { ProgramCard, SectionHeading, SIGNUP_URL } from '@/components/site';
import { inr, publicApi, type CatalogProgram, type CatalogStats } from '@/lib/api';

export const revalidate = 60;

type University = { id: string; name: string; city: string | null; state: string | null; openPrograms: number };

const LANES = [
  { title: 'Build your profile', text: 'Sign up with your mobile number using a WhatsApp or SMS code. Add your personal, academic and sports details and upload your documents.' },
  { title: 'Apply', text: 'Pick a program at a partner university and pay the one-time application fee online — UPI, cards or net banking.' },
  { title: 'Get approved', text: 'Our team verifies your profile and recommends you. The university takes the final decision.' },
  { title: 'Sign', text: 'Sign your Scholarship Award Agreement and Agency Agreement online. Your scholarship becomes active immediately.' },
  { title: 'Renew yearly', text: 'Confirm your enrolment and re-sign once a year to keep your scholarship. We remind you on WhatsApp before it is due.' },
];

const RULES = [
  { title: 'The university has the final say.', text: 'We verify every profile and recommend candidates. The university makes the decision — no one can promise you a seat.' },
  { title: 'You see the money before you pay.', text: 'Every scholarship lists what it covers each year — tuition, room, food, other — and who pays for each part.' },
  { title: 'No passwords.', text: 'You log in with a one-time code sent to your WhatsApp or by SMS. There is nothing to remember and nothing to steal.' },
  { title: 'Your documents stay private.', text: 'Uploads are stored encrypted and are visible only to our review team and the university you apply to.' },
  { title: 'Every signature has a trail.', text: 'Both agreements are signed electronically with a full audit trail. Download your signed copies any time.' },
  { title: 'One year at a time.', text: 'Scholarships are released one academic year at a time. We remind you 30 days before your renewal is due.' },
];

const FAQS = [
  {
    q: 'Who decides whether I get the scholarship?',
    a: 'The university. Our team verifies your profile and documents and recommends eligible athletes; the partner university makes the final decision on every candidate.',
  },
  {
    q: 'Is there a fee to apply?',
    a: 'Most programs have a one-time application fee, shown on the scholarship page including GST before you apply. You pay online by UPI, card or net banking. Each program states whether the fee is refunded if you are not approved.',
  },
  {
    q: 'What exactly does a scholarship cover?',
    a: 'Each scholarship lists tuition, accommodation, food and other benefits per year, and says whether the university, Alumni Connect India or the student pays for each. You see the yearly and total value before you apply.',
  },
  {
    q: 'How do I log in?',
    a: 'With your mobile number. We send a one-time code on WhatsApp or by SMS — there is no password to create or forget.',
  },
  {
    q: 'What will I sign?',
    a: 'Two agreements: the Scholarship Award Agreement and the Agency Agreement. You sign both online, and you can download your signed copies from the portal whenever you need them.',
  },
  {
    q: 'Does my scholarship renew automatically?',
    a: 'No — it is released one academic year at a time. Each year you confirm your enrolment and re-sign on the portal. We remind you on WhatsApp 30 days before it is due.',
  },
  {
    q: 'I am under 18. Can I apply?',
    a: 'Yes, if the program’s age range includes you. We will ask for a parent or guardian’s details and ID as part of your profile.',
  },
];

export default async function HomePage() {
  const [stats, programs, universities] = await Promise.all([
    publicApi<CatalogStats>('/catalog/stats'),
    publicApi<{ items: CatalogProgram[] }>('/catalog/programs?pageSize=6'),
    publicApi<University[]>('/catalog/universities'),
  ]);
  const featured = programs?.items ?? [];
  const sample = featured[0];
  const board: [string, string][] = [
    ['Partner universities', stats ? String(stats.universities) : '—'],
    ['Programs open', stats ? String(stats.openPrograms) : '—'],
    ['Seats left', stats ? String(stats.seatsLeft) : '—'],
    ['Scholarship value open', stats ? inr(stats.availableValueInr, true) : '—'],
  ];

  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6 lg:pb-28 lg:pt-12">
        <div className="eyebrow flex flex-wrap items-center justify-between gap-3 border-b border-ink/15 pb-4 text-ink/60">
          <span>Athletic scholarships · India</span>
          <span className="inline-flex items-center gap-2.5 text-ink">
            <span className="live-dot" aria-hidden /> Intake 2026–27 open
          </span>
        </div>

        <h1 className="display hero-title mt-8 lg:mt-10">
          <span className="rise" style={{ '--i': 0 } as CSSProperties}>
            <span>Your sport</span>
          </span>
          <span className="rise" style={{ '--i': 1 } as CSSProperties}>
            <span>can pay for</span>
          </span>
          <span className="rise" style={{ '--i': 2 } as CSSProperties}>
            <span>
              your <span className="finish-word">degree.</span>
            </span>
          </span>
        </h1>

        <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-5">
            <p className="max-w-md text-lg leading-relaxed text-ink/75">
              Alumni Connect India matches student-athletes with scholarships at partner universities — tuition covered, paperwork handled, and support
              every year until you graduate.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
              <a href={SIGNUP_URL} className="btn btn-ink">
                Create athlete profile <span className="arrow">→</span>
              </a>
              <Link href="/scholarships" className="link-underline font-semibold">
                Browse scholarships
              </Link>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-[6px] bg-ink text-paper">
              <div className="eyebrow flex justify-between border-b border-paper/10 px-5 py-3 text-[0.68rem] text-paper/50">
                <span>Scoreboard</span>
                <span>Live catalogue</span>
              </div>
              <dl className="grid grid-cols-2 gap-px bg-paper/10 sm:grid-cols-4">
                {board.map(([label, value]) => (
                  <div key={label} className="flex min-w-0 flex-col-reverse bg-ink px-5 pb-5 pt-6">
                    <dt className="mt-3 text-sm text-paper/55">{label}</dt>
                    <dd className="display text-[clamp(2.5rem,4.2vw,3.75rem)] text-paper">
                      <Odometer value={value} />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- How it works: the track */}
      <section id="how-it-works" className="track overflow-hidden text-white">
        <div className="mx-auto grid grid-cols-1 max-w-7xl gap-8 px-4 pb-14 pt-20 sm:px-6 lg:grid-cols-12 lg:items-end lg:pt-24">
          <div className="lg:col-span-8">
            <p className="eyebrow text-white/75">How it works</p>
            <h2 className="display mt-3 text-[clamp(3rem,8.5vw,7rem)]">
              Five lanes
              <br />
              to campus.
            </h2>
          </div>
          <p className="text-lg text-white/85 lg:col-span-4">
            Everything happens online, from your phone or laptop. Run one lane at a time — the portal tells you exactly what comes next.
          </p>
        </div>
        <div className="relative">
        <ol className="lanes">
          {LANES.map((l, i) => (
            <li key={l.title} className="lane">
              <div className="reveal mx-auto grid grid-cols-1 max-w-7xl items-center gap-x-10 gap-y-3 px-4 pb-10 pt-8 sm:px-6 md:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1.3fr)] md:pr-16">
                <span className="display lane-no" aria-hidden>
                  {i + 1}
                </span>
                <h3 className="display text-[clamp(2.25rem,4vw,3.25rem)]">
                  <span className="sr-only">Step {i + 1}: </span>
                  {l.title}
                </h3>
                <p className="max-w-xl text-white/85">{l.text}</p>
              </div>
              <span className="lane-run" aria-hidden />
            </li>
          ))}
        </ol>
          <span className="finish-strip" aria-hidden />
        </div>
        <div className="h-16" />
      </section>

      {/* ---------------------------------------------------------------- Scholarships: race bibs */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:py-28">
        <SectionHeading eyebrow="On the start line" title="Scholarships open now">
          <Link href="/scholarships" className="link-underline font-semibold">
            All scholarships <span className="arrow">→</span>
          </Link>
        </SectionHeading>
        {featured.length ? (
          <div className="mt-14 grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((p) => (
              <div key={p.id} className="reveal">
                <ProgramCard p={p} />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-14 grid grid-cols-1 items-center gap-8 rounded-[10px] border-2 border-dashed border-ink/25 p-10 md:grid-cols-[auto_1fr_auto]">
            <p className="display text-[7rem] leading-[0.8] text-ink/15">000</p>
            <div>
              <p className="text-xl font-semibold">Your number’s being printed.</p>
              <p className="mt-1 text-ink/65">New scholarships are being added. Create your profile now so you are ready to apply the day they open.</p>
            </div>
            <a href={SIGNUP_URL} className="btn btn-ink btn-sm">
              Create profile <span className="arrow">→</span>
            </a>
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------- Transparency: the receipt */}
      {sample && (
        <section className="bg-ink text-paper">
          <div className="mx-auto grid grid-cols-1 max-w-7xl gap-16 px-4 py-24 sm:px-6 lg:grid-cols-12 lg:items-center lg:py-28">
            <div className="lg:col-span-6">
              <p className="eyebrow text-brand-400">No small print</p>
              <h2 className="display mt-3 text-[clamp(3rem,7.5vw,6.25rem)]">
                Every rupee,
                <br />
                on the record.
              </h2>
              <p className="mt-6 max-w-lg text-lg text-paper/70">
                Before you pay anything, each scholarship shows what it covers every year, who pays for each part, and the exact application fee including
                GST. This one is straight from today’s catalogue.
              </p>
              <ul className="mt-10 border-t border-paper/15">
                {[
                  'Tuition, room, food and other costs listed separately',
                  'Fee and refund rules stated before you apply',
                  'Signed agreements you can download any time',
                ].map((t, i) => (
                  <li key={t} className="flex items-baseline gap-5 border-b border-paper/15 py-4">
                    <span className="eyebrow text-brand-400">0{i + 1}</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-center lg:col-span-5 lg:col-start-8">
              <Receipt p={sample} />
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- Rulebook */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:py-28">
        <SectionHeading eyebrow="Our rulebook" title="Six rules we play by." />
        <ol className="mt-14 grid grid-cols-1 gap-px border-y-2 border-ink bg-ink/15 md:grid-cols-2 lg:grid-cols-3">
          {RULES.map((r, i) => (
            <li key={r.title} className="reveal bg-paper px-1 py-8 md:p-8">
              <p className="eyebrow text-brand-600">Rule {String(i + 1).padStart(2, '0')}</p>
              <h3 className="mt-5 text-2xl font-extrabold leading-tight tracking-tight">{r.title}</h3>
              <p className="mt-3 text-ink/70">{r.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------------------------------------------------------- Kit list */}
      <section className="bg-paper-2/70">
        <div className="mx-auto grid grid-cols-1 max-w-7xl gap-14 px-4 py-24 sm:px-6 lg:grid-cols-12 lg:py-28">
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-28">
              <SectionHeading eyebrow="Before you start" title={<>Pack your<br />kit bag.</>} />
              <p className="mt-6 max-w-md text-lg text-ink/70">
                Your profile takes about 15 minutes. These are the documents the athlete portal asks for — tick them off as you find them.
              </p>
            </div>
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <KitList signupUrl={SIGNUP_URL} />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- Partner universities */}
      {!!universities?.length && (
        <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6 lg:pt-28">
          <SectionHeading eyebrow="Partner universities" title="Where you could play next." />
          <ul className="mt-14 border-t-2 border-ink">
            {universities.map((u) => (
              <li key={u.id} className="border-b border-ink/15">
                <Link
                  href={`/scholarships?q=${encodeURIComponent(u.name)}`}
                  className="group grid grid-cols-1 items-baseline gap-x-8 gap-y-1 py-6 transition-[padding] duration-300 hover:pl-3 md:grid-cols-[minmax(0,1fr)_16rem_9rem]"
                >
                  <span className="display text-[clamp(2rem,4.5vw,3.5rem)] transition-colors group-hover:text-brand-600">{u.name}</span>
                  <span className="eyebrow text-ink/60">{[u.city, u.state].filter(Boolean).join(', ')}</span>
                  <span className="eyebrow md:text-right">
                    {u.openPrograms} open <span className="arrow">→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------------------------------------------------------------- FAQ */}
      <section className="mx-auto grid grid-cols-1 max-w-7xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-12 lg:py-28">
        <div className="lg:col-span-4">
          <SectionHeading eyebrow="FAQ" title={<>Questions,<br />answered.</>} />
          <p className="mt-6 text-ink/70">
            Still unsure?{' '}
            <Link href="/contact" className="link-underline font-semibold text-ink">
              Talk to our athlete support team
            </Link>
            .
          </p>
        </div>
        <div className="border-t-2 border-ink lg:col-span-8">
          {FAQS.map((f) => (
            <details key={f.q} className="faq border-b border-ink/15">
              <summary className="flex items-center justify-between gap-6 py-6 text-lg font-semibold sm:text-xl">
                {f.q}
                <span className="plus" aria-hidden />
              </summary>
              <p className="max-w-2xl pb-7 pr-10 text-ink/70">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- Finish line */}
      <section className="bg-ink text-paper">
        <div className="checker h-5" aria-hidden />
        <div className="mx-auto grid grid-cols-1 max-w-7xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-12 lg:items-end lg:py-28">
          <h2 className="display text-[clamp(3rem,10vw,9rem)] lg:col-span-12">
            Fifteen minutes
            <br />
            to your <span className="text-brand-500">start line.</span>
          </h2>
          <div className="lg:col-span-5 lg:col-start-8">
            <p className="text-lg text-paper/70">
              Create one athlete profile and apply to any scholarship you are eligible for. Secure OTP login, documents stored encrypted, agreements signed
              online.
            </p>
            <a href={SIGNUP_URL} className="btn btn-paper mt-8">
              Create athlete profile <span className="arrow">→</span>
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
