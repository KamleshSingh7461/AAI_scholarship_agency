import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { bibNumber, SeatsMeter, shortDate } from '@/components/site';
import { inr, publicApi, STUDENT_APP_URL, type CatalogProgram } from '@/lib/api';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await publicApi<CatalogProgram>(`/catalog/programs/${(await params).slug}`);
  return { title: p ? `${p.name} — ${p.university?.name}` : 'Scholarship' };
}

const who = (b: string) => (b === 'UNIVERSITY' ? 'Covered by the university' : b === 'COMPANY' ? 'Paid by Alumni Connect India' : 'Paid by the student');

export default async function ProgramPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await publicApi<CatalogProgram>(`/catalog/programs/${(await params).slug}`);
  if (!p) notFound();
  const [prefix, number] = bibNumber(p.code);
  const rows = [
    ['Tuition', p.benefitsInr.tuitionPerYear, p.bearers.tuition, p.tuitionCoverageBps < 10000 ? `${p.tuitionCoverageBps / 100}% of tuition` : 'Full tuition'],
    ['Accommodation (room)', p.benefitsInr.roomPerYear, p.bearers.room, ''],
    ['Food', p.benefitsInr.foodPerYear, p.bearers.food, ''],
    ['Other benefits', p.benefitsInr.otherPerYear, p.bearers.other, p.otherCostsNote ?? ''],
  ] as const;
  const eligibility = [
    p.eligibleSports.length > 0 && `Sports: ${p.eligibleSports.join(', ')}`,
    (p.minAge || p.maxAge) && `Age ${p.minAge ?? 'any'} – ${p.maxAge ?? 'any'} years`,
    p.genderEligibility !== 'ANY' && `Open to ${p.genderEligibility.toLowerCase()} athletes`,
    p.courses.length > 0 && `Courses: ${p.courses.join(', ')}`,
    p.eligibilityCriteria,
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-10 sm:px-6">
      <Link href="/scholarships" className="eyebrow link-grow text-ink/70">
        ← All scholarships
      </Link>

      <div className="mt-8 grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div>
          <p className="eyebrow text-ink/60">
            <span className="text-ink">{p.university?.name}</span>
            {' · '}
            {[p.university?.city, p.university?.state].filter(Boolean).join(', ')}
          </p>
          <h1 className="display mt-4 text-[clamp(2.75rem,6.5vw,5.5rem)]">{p.name}</h1>
          <div className="eyebrow mt-6 flex flex-wrap gap-2 text-[0.68rem]">
            <span className="rounded-[3px] bg-ink px-2.5 py-1.5 text-paper">{p.durationYears}-year award</span>
            <span className="rounded-[3px] border border-ink/30 px-2.5 py-1.5">Intake {p.academicYear}</span>
            <span className="rounded-[3px] border border-ink/30 px-2.5 py-1.5">{p.scholarshipType.toLowerCase()} scholarship</span>
          </div>
          {p.description && <p className="mt-8 max-w-2xl whitespace-pre-line text-lg leading-relaxed text-ink/75">{p.description}</p>}

          <h2 className="eyebrow mt-14 text-brand-600">What it covers, per year</h2>
          <div className="mt-4 border-y-2 border-ink">
            {rows.map(([label, amount, bearer, note]) => (
              <div key={label} className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1 border-b border-ink/15 py-5 sm:grid-cols-[minmax(0,1fr)_16rem_9rem] ${bearer === 'STUDENT' ? 'text-ink/45' : ''}`}>
                <div>
                  <p className="font-semibold text-ink">{label}</p>
                  {note && <p className="text-sm text-ink/55">{note}</p>}
                </div>
                <p className="order-3 col-span-2 text-sm sm:order-none sm:col-span-1 sm:text-base">{who(bearer)}</p>
                <p className="text-right font-bold tabular-nums text-ink">{bearer === 'STUDENT' ? '—' : inr(amount)}</p>
              </div>
            ))}
            <div className="flex items-baseline justify-between py-5">
              <p className="font-bold">Total per year</p>
              <p className="display text-4xl text-accent-700">{inr(p.benefitsInr.annualValue)}</p>
            </div>
          </div>

          {eligibility.length > 0 && (
            <>
              <h2 className="eyebrow mt-14 text-brand-600">Eligibility</h2>
              <ul className="square-list mt-5 space-y-3 text-lg text-ink/80">
                {eligibility.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-14 grid grid-cols-1 gap-4 rounded-[6px] bg-paper-2 p-6 sm:grid-cols-[9rem_1fr]">
            <p className="eyebrow text-brand-600">Renewal</p>
            <p className="text-ink/75">
              The scholarship is released one academic year at a time. Each year you confirm your enrolment and re-sign your agreements on the portal — we
              remind you 30 days before. The university keeps the final right to approve every candidate.
            </p>
          </div>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="bib">
            <span className="bib-pin left-3 top-3 z-10" aria-hidden />
            <span className="bib-pin right-3 top-3 z-10" aria-hidden />
            <div className="bib-band px-7 pb-4 pt-6">
              <p className="eyebrow text-[0.68rem] text-white/80">Total scholarship value</p>
              <p className="display mt-2 text-6xl">{inr(p.benefitsInr.totalValue)}</p>
              <p className="mt-2 text-sm text-white/85">
                {inr(p.benefitsInr.annualValue)} × {p.durationYears} years
              </p>
            </div>
            <div className="px-7 pb-2 pt-5">
              <p className="eyebrow text-[0.68rem] text-ink/50">{prefix}</p>
              <p className="display text-[5.5rem] leading-[0.82]">{number}</p>
            </div>
            <div className="bib-stub px-7 pb-7 pt-5">
              <SeatsMeter left={p.seatsLeft} total={p.seatsTotal} />
              <dl className="mt-5 space-y-2.5 text-sm">
                {p.applicationClosesAt && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink/60">Applications close</dt>
                    <dd className="font-semibold">{shortDate(p.applicationClosesAt)}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-ink/60">Application fee</dt>
                  <dd className="font-semibold">{p.fee.totalInr > 0 ? inr(p.fee.totalInr) : 'Free'}</dd>
                </div>
              </dl>
              {p.fee.totalInr > 0 && (
                <p className="mt-3 text-xs leading-relaxed text-ink/60">
                  {p.fee.explanation}: {inr(p.fee.baseInr)} + GST {inr(p.fee.taxInr)}. Paid once when you apply.{' '}
                  {p.feeRefundableOnRejection ? 'Refunded if your application is not approved.' : 'Non-refundable.'}
                </p>
              )}
              {p.isOpen ? (
                <a href={`${STUDENT_APP_URL}/programs/${p.id}`} className="btn btn-red mt-6 w-full">
                  Apply now <span className="arrow">→</span>
                </a>
              ) : (
                <p className="eyebrow mt-6 rounded-[4px] bg-paper-2 p-3 text-center">Applications are closed</p>
              )}
              <p className="mt-3 text-center text-xs text-ink/55">You’ll log in with a WhatsApp or SMS code.</p>
            </div>
            <span className="bib-pin bottom-3 left-3" aria-hidden />
            <span className="bib-pin bottom-3 right-3" aria-hidden />
          </div>
        </aside>
      </div>
    </div>
  );
}
