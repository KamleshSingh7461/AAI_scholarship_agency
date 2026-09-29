import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarDays, CheckCircle2, GraduationCap, Info, MapPin, Users } from 'lucide-react';
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
  const rows = [
    ['Tuition', p.benefitsInr.tuitionPerYear, p.bearers.tuition, p.tuitionCoverageBps < 10000 ? `${p.tuitionCoverageBps / 100}% of tuition` : 'Full tuition'],
    ['Accommodation (room)', p.benefitsInr.roomPerYear, p.bearers.room, ''],
    ['Food', p.benefitsInr.foodPerYear, p.bearers.food, ''],
    ['Other benefits', p.benefitsInr.otherPerYear, p.bearers.other, p.otherCostsNote ?? ''],
  ] as const;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Link href="/scholarships" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> All scholarships
      </Link>
      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <GraduationCap className="size-5 text-brand-600" />
            <span className="font-semibold text-slate-800">{p.university?.name}</span>
            <span className="flex items-center gap-1"><MapPin className="size-3.5" /> {[p.university?.city, p.university?.state].filter(Boolean).join(', ')}</span>
          </div>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-900">{p.name}</h1>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-accent-50 px-3 py-1 text-accent-700">{p.durationYears}-year award</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Intake {p.academicYear}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{p.scholarshipType.toLowerCase()} scholarship</span>
          </div>
          {p.description && <p className="mt-6 whitespace-pre-line text-lg text-slate-600">{p.description}</p>}

          <h2 className="mt-10 text-xl font-bold text-slate-900">What the scholarship covers (per year)</h2>
          <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-slate-200">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {rows.map(([label, amount, bearer, note]) => (
                  <tr key={label} className={bearer === 'STUDENT' ? 'bg-slate-50 text-slate-500' : ''}>
                    <td className="px-5 py-4 font-semibold text-slate-800">
                      {label}
                      {note && <span className="block text-xs font-normal text-slate-500">{note}</span>}
                    </td>
                    <td className="px-5 py-4 text-slate-500">{who(bearer)}</td>
                    <td className="px-5 py-4 text-right font-bold tabular-nums text-slate-900">{bearer === 'STUDENT' ? '—' : inr(amount)}</td>
                  </tr>
                ))}
                <tr className="bg-accent-50/60">
                  <td className="px-5 py-4 font-bold text-slate-900">Total per year</td>
                  <td />
                  <td className="px-5 py-4 text-right text-lg font-black tabular-nums text-accent-700">{inr(p.benefitsInr.annualValue)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="mt-10 text-xl font-bold text-slate-900">Eligibility</h2>
          <ul className="mt-4 space-y-2 text-slate-600">
            {p.eligibleSports.length > 0 && <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-accent-600" /> Sports: {p.eligibleSports.join(', ')}</li>}
            {(p.minAge || p.maxAge) && (
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-accent-600" /> Age {p.minAge ?? 'any'} – {p.maxAge ?? 'any'} years</li>
            )}
            {p.genderEligibility !== 'ANY' && <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-accent-600" /> Open to {p.genderEligibility.toLowerCase()} athletes</li>}
            {p.courses.length > 0 && <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-accent-600" /> Courses: {p.courses.join(', ')}</li>}
            {p.eligibilityCriteria && <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-accent-600" /> {p.eligibilityCriteria}</li>}
          </ul>

          <div className="mt-10 flex gap-3 rounded-2xl bg-sky-50 p-5 text-sm text-sky-900 ring-1 ring-sky-200">
            <Info className="size-5 shrink-0" />
            <div>
              <p className="font-semibold">Renewal every year</p>
              <p className="mt-1">
                The scholarship is released one academic year at a time. Each year you confirm your enrolment and re-sign your agreements on the portal — we remind you
                30 days before. The university keeps the final right to approve every candidate.
              </p>
            </div>
          </div>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-3xl bg-white p-6 shadow-xl shadow-slate-200 ring-1 ring-slate-200">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Total scholarship value</p>
            <p className="mt-1 text-4xl font-black text-accent-700">{inr(p.benefitsInr.totalValue)}</p>
            <p className="text-sm text-slate-500">{inr(p.benefitsInr.annualValue)} × {p.durationYears} years</p>
            <dl className="mt-6 space-y-3 border-t border-slate-100 pt-5 text-sm">
              <div className="flex justify-between"><dt className="flex items-center gap-2 text-slate-500"><Users className="size-4" /> Seats left</dt><dd className="font-semibold">{p.seatsLeft} of {p.seatsTotal}</dd></div>
              {p.applicationClosesAt && (
                <div className="flex justify-between"><dt className="flex items-center gap-2 text-slate-500"><CalendarDays className="size-4" /> Applications close</dt><dd className="font-semibold">{new Date(p.applicationClosesAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</dd></div>
              )}
              <div className="flex justify-between"><dt className="text-slate-500">Application fee</dt><dd className="font-semibold">{p.fee.totalInr > 0 ? inr(p.fee.totalInr) : 'Free'}</dd></div>
              {p.fee.totalInr > 0 && (
                <p className="text-xs text-slate-500">
                  {p.fee.explanation}: {inr(p.fee.baseInr)} + GST {inr(p.fee.taxInr)}. Paid once when you apply. {p.feeRefundableOnRejection ? 'Refunded if your application is not approved.' : 'Non-refundable.'}
                </p>
              )}
            </dl>
            {p.isOpen ? (
              <a href={`${STUDENT_APP_URL}/programs/${p.id}`} className="mt-6 flex h-12 items-center justify-center rounded-xl bg-brand-600 font-bold text-white hover:bg-brand-700">
                Apply now
              </a>
            ) : (
              <p className="mt-6 rounded-xl bg-slate-100 p-3 text-center text-sm font-semibold text-slate-600">Applications are closed</p>
            )}
            <p className="mt-3 text-center text-xs text-slate-500">You’ll log in with a WhatsApp or SMS code.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
