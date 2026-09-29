'use client';
import { useMemo, useState, type FormEvent } from 'react';
import { quoteFee, type Currency, type FeeConfig } from '@aci/contracts';
import { fromMinorUnits, money, toMinorUnits } from '@aci/web-shared';
import { useApi } from '@aci/web-shared/hooks';
import { Alert, Button, Card, Checkbox, Field, Input, Select, Textarea } from '@aci/web-shared/ui';
import type { Paged, Program, University } from '@/lib/types';

const BEARERS = [
  ['UNIVERSITY', 'University (in kind)'],
  ['COMPANY', 'Alumni Connect India (cash)'],
  ['STUDENT', 'Student (not part of award)'],
] as const;

export type ProgramPayload = Record<string, unknown>;

function initial(p?: Program, universityId?: string) {
  return {
    universityId: p?.universityId ?? universityId ?? '',
    allocationId: p?.allocationId ?? '',
    name: p?.name ?? '',
    description: p?.description ?? '',
    scholarshipType: p?.scholarshipType ?? 'ATHLETIC',
    coverageType: p?.coverageType ?? 'PARTIAL',
    durationYears: String(p?.durationYears ?? 4),
    academicYear: p?.academicYear ?? '',
    intakeDate: p?.intakeDate?.slice(0, 10) ?? '',
    applicationOpensAt: p?.applicationOpensAt?.slice(0, 10) ?? '',
    applicationClosesAt: p?.applicationClosesAt?.slice(0, 10) ?? '',
    seatsTotal: String(p?.seatsTotal ?? 10),
    currency: p?.currency ?? 'INR',
    tuitionFull: p ? String(fromMinorUnits(p.tuitionFullPerYear)) : '',
    tuitionCoveragePct: p ? String(p.tuitionCoverageBps / 100) : '50',
    room: p ? String(fromMinorUnits(p.roomPerYear)) : '0',
    food: p ? String(fromMinorUnits(p.foodPerYear)) : '0',
    other: p ? String(fromMinorUnits(p.otherPerYear)) : '0',
    otherCostsNote: p?.otherCostsNote ?? '',
    tuitionBorneBy: p?.tuitionBorneBy ?? 'UNIVERSITY',
    roomBorneBy: p?.roomBorneBy ?? 'COMPANY',
    foodBorneBy: p?.foodBorneBy ?? 'COMPANY',
    otherBorneBy: p?.otherBorneBy ?? 'STUDENT',
    eligibleSports: p?.eligibleSports.join(', ') ?? '',
    courses: p?.courses.join(', ') ?? '',
    minAge: p?.minAge ? String(p.minAge) : '',
    maxAge: p?.maxAge ? String(p.maxAge) : '',
    genderEligibility: p?.genderEligibility ?? 'ANY',
    eligibilityCriteria: p?.eligibilityCriteria ?? '',
    feeType: p?.feeType ?? 'FLAT',
    feeFlat: p ? String(fromMinorUnits(p.feeFlatInr)) : '999',
    feePercent: p ? String(p.feePercentBps / 100) : '1',
    feePercentBase: p?.feePercentBase ?? 'TOTAL_VALUE',
    feeMin: p ? String(fromMinorUnits(p.feeMinInr)) : '0',
    feeMax: p ? String(fromMinorUnits(p.feeMaxInr)) : '0',
    taxPct: p ? String(p.taxBps / 100) : '18',
    feeRefundableOnRejection: p?.feeRefundableOnRejection ?? false,
    commissionPct: p ? String(p.commissionBps / 100) : '8',
    universityCommissionSharePct: p ? String(p.universityCommissionShareBps / 100) : '0',
  };
}

const bps = (pct: string) => Math.round(Number(pct || 0) * 100);
const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

/** Create / edit form with a live preview of the value (native + INR/USD) and the fee the athlete will pay. */
export function ProgramForm({ program, universityId, onSubmit, frozen, usdInrRate4 = 830000 }: { program?: Program; universityId?: string; onSubmit: (p: ProgramPayload) => Promise<void>; frozen?: boolean; usdInrRate4?: number }) {
  const [f, setF] = useState(() => initial(program, universityId));
  const [busy, setBusy] = useState(false);
  const { data: unis } = useApi<Paged<University>>('/universities', { pageSize: 100 });
  const { data: allocations } = useApi<{ id: string; academicYear: string; capacity: number; assignedToPrograms: number; status: string }[]>(f.universityId ? `/universities/${f.universityId}/allocations` : null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const preview = useMemo(() => {
    const cur = f.currency as Currency;
    const part = (v: string, bearer: string) => (bearer === 'STUDENT' ? 0 : toMinorUnits(v));
    const tuition = Math.round((toMinorUnits(f.tuitionFull) * bps(f.tuitionCoveragePct)) / 10000);
    const annual = (f.tuitionBorneBy === 'STUDENT' ? 0 : tuition) + part(f.room, f.roomBorneBy) + part(f.food, f.foodBorneBy) + part(f.other, f.otherBorneBy);
    const total = annual * Number(f.durationYears || 0);
    const cfg: FeeConfig = {
      feeType: f.feeType as FeeConfig['feeType'],
      feeFlatInr: toMinorUnits(f.feeFlat),
      feePercentBps: bps(f.feePercent),
      feePercentBase: f.feePercentBase as FeeConfig['feePercentBase'],
      feeMinInr: toMinorUnits(f.feeMin),
      feeMaxInr: toMinorUnits(f.feeMax),
      taxBps: bps(f.taxPct),
    };
    return { cur, tuition, annual, total, fee: quoteFee(cfg, { annualValue: annual, totalValue: total, currency: cur }, usdInrRate4) };
  }, [f, usdInrRate4]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: ProgramPayload = {
        universityId: f.universityId,
        allocationId: f.allocationId || undefined,
        name: f.name,
        description: f.description || undefined,
        scholarshipType: f.scholarshipType,
        coverageType: f.coverageType,
        academicYear: f.academicYear,
        intakeDate: f.intakeDate || undefined,
        applicationOpensAt: f.applicationOpensAt ? new Date(f.applicationOpensAt).toISOString() : undefined,
        applicationClosesAt: f.applicationClosesAt ? new Date(`${f.applicationClosesAt}T23:59:59+05:30`).toISOString() : undefined,
        eligibleSports: list(f.eligibleSports),
        courses: list(f.courses),
        minAge: f.minAge ? Number(f.minAge) : undefined,
        maxAge: f.maxAge ? Number(f.maxAge) : undefined,
        genderEligibility: f.genderEligibility,
        eligibilityCriteria: f.eligibilityCriteria || undefined,
        feeType: f.feeType,
        feeFlatInr: toMinorUnits(f.feeFlat),
        feePercentBps: bps(f.feePercent),
        feePercentBase: f.feePercentBase,
        feeMinInr: toMinorUnits(f.feeMin),
        feeMaxInr: toMinorUnits(f.feeMax),
        taxBps: bps(f.taxPct),
        feeRefundableOnRejection: f.feeRefundableOnRejection,
        commissionBps: bps(f.commissionPct),
        universityCommissionShareBps: bps(f.universityCommissionSharePct),
        seatsTotal: Number(f.seatsTotal),
        otherCostsNote: f.otherCostsNote || undefined,
      };
      if (!frozen) {
        Object.assign(payload, {
          durationYears: Number(f.durationYears),
          currency: f.currency,
          tuitionFullPerYear: toMinorUnits(f.tuitionFull),
          tuitionCoverageBps: bps(f.tuitionCoveragePct),
          roomPerYear: toMinorUnits(f.room),
          foodPerYear: toMinorUnits(f.food),
          otherPerYear: toMinorUnits(f.other),
          tuitionBorneBy: f.tuitionBorneBy,
          roomBorneBy: f.roomBorneBy,
          foodBorneBy: f.foodBorneBy,
          otherBorneBy: f.otherBorneBy,
        });
      }
      await onSubmit(payload);
    } finally {
      setBusy(false);
    }
  };

  const cur = f.currency;
  return (
    <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <Card title="Basics">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="University" required>
              <Select value={f.universityId} onChange={set('universityId')} required disabled={!!program}>
                <option value="">Select</option>
                {unis?.items.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </Field>
            <Field label="Draws seats from allocation" hint="Keeps the total within the university's annual transfer">
              <Select value={f.allocationId} onChange={set('allocationId')}>
                <option value="">None</option>
                {allocations?.filter((a) => a.status === 'OPEN').map((a) => <option key={a.id} value={a.id}>{a.academicYear} ({a.capacity - a.assignedToPrograms} unassigned)</option>)}
              </Select>
            </Field>
            <Field label="Program name" required className="sm:col-span-2"><Input value={f.name} onChange={set('name')} required placeholder="Half-Fee Athletic Scholarship (4-Year)" /></Field>
            <Field label="Description" className="sm:col-span-2"><Textarea value={f.description} onChange={set('description')} /></Field>
            <Field label="Scholarship type">
              <Select value={f.scholarshipType} onChange={set('scholarshipType')}>
                {['ATHLETIC', 'ACADEMIC', 'MERIT', 'NEED_BASED'].map((t) => <option key={t} value={t}>{t.replace('_', ' ').toLowerCase()}</option>)}
              </Select>
            </Field>
            <Field label="Coverage">
              <Select value={f.coverageType} onChange={set('coverageType')}>
                <option value="PARTIAL">Partial</option>
                <option value="FULL">Full</option>
              </Select>
            </Field>
            <Field label="Length (years)" required>
              <Select value={f.durationYears} onChange={set('durationYears')} disabled={frozen}>
                {[1, 2, 3, 4, 5, 6].map((n) => <option key={n}>{n}</option>)}
              </Select>
            </Field>
            <Field label="Academic year (intake)" required hint="e.g. 2026-27"><Input value={f.academicYear} onChange={set('academicYear')} required pattern="\d{4}-\d{2}" /></Field>
            <Field label="Intake / course start date" hint="Year 1 starts here (or on signing, if later)"><Input type="date" value={f.intakeDate} onChange={set('intakeDate')} /></Field>
            <Field label="Seats" required><Input type="number" min={1} value={f.seatsTotal} onChange={set('seatsTotal')} required /></Field>
            <Field label="Applications open"><Input type="date" value={f.applicationOpensAt} onChange={set('applicationOpensAt')} /></Field>
            <Field label="Applications close"><Input type="date" value={f.applicationClosesAt} onChange={set('applicationClosesAt')} /></Field>
          </div>
        </Card>

        <Card title="Value per year" subtitle="Quantified benefits that make up the award. Components paid by the student are not counted.">
          {frozen && <Alert tone="warning" className="mb-4">Seats have been reserved or awarded, so value, length and currency are locked (they are in signed agreements). Create a new program to change them.</Alert>}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Currency">
              <Select value={f.currency} onChange={set('currency')} disabled={frozen}>
                <option value="INR">INR ₹</option>
                <option value="USD">USD $</option>
              </Select>
            </Field>
            <Field label={`Full tuition / year (${cur})`} required><Input type="number" min={0} step="0.01" value={f.tuitionFull} onChange={set('tuitionFull')} required disabled={frozen} /></Field>
            <Field label="Tuition covered %"><Input type="number" min={0} max={100} step="0.01" value={f.tuitionCoveragePct} onChange={set('tuitionCoveragePct')} disabled={frozen} /></Field>
            <Field label="Tuition funded by" className="sm:col-span-3">
              <Select value={f.tuitionBorneBy} onChange={set('tuitionBorneBy')} disabled={frozen}>{BEARERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
            </Field>
            {(
              [
                ['room', 'roomBorneBy', 'Room / hostel'],
                ['food', 'foodBorneBy', 'Food'],
                ['other', 'otherBorneBy', 'Other (books, uniform, exam)'],
              ] as const
            ).map(([k, b, label]) => (
              <div key={k} className="space-y-2">
                <Field label={`${label} / year (${cur})`}><Input type="number" min={0} step="0.01" value={f[k]} onChange={set(k)} disabled={frozen} /></Field>
                <Select value={f[b]} onChange={set(b)} disabled={frozen}>{BEARERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
              </div>
            ))}
            <Field label="Note on other costs (shown to athletes)" className="sm:col-span-3"><Input value={f.otherCostsNote} onChange={set('otherCostsNote')} /></Field>
          </div>
        </Card>

        <Card title="Eligibility">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Eligible sports" hint="Comma separated; empty = all sports"><Input value={f.eligibleSports} onChange={set('eligibleSports')} /></Field>
            <Field label="Courses" hint="Comma separated"><Input value={f.courses} onChange={set('courses')} /></Field>
            <Field label="Min age"><Input type="number" value={f.minAge} onChange={set('minAge')} /></Field>
            <Field label="Max age"><Input type="number" value={f.maxAge} onChange={set('maxAge')} /></Field>
            <Field label="Gender">
              <Select value={f.genderEligibility} onChange={set('genderEligibility')}>
                <option value="ANY">Any</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </Select>
            </Field>
            <Field label="Other criteria" className="sm:col-span-2"><Textarea value={f.eligibilityCriteria} onChange={set('eligibilityCriteria')} /></Field>
          </div>
        </Card>

        <Card title="Application fee" subtitle="Charged once, in INR, when the athlete applies. Flat or a percentage of the scholarship value.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Fee type">
              <Select value={f.feeType} onChange={set('feeType')}>
                <option value="NONE">No fee</option>
                <option value="FLAT">Flat amount</option>
                <option value="PERCENTAGE">Percentage of value</option>
              </Select>
            </Field>
            {f.feeType === 'FLAT' && <Field label="Flat fee (₹)"><Input type="number" min={1} value={f.feeFlat} onChange={set('feeFlat')} /></Field>}
            {f.feeType === 'PERCENTAGE' && (
              <>
                <Field label="Percentage %"><Input type="number" min={0} step="0.01" value={f.feePercent} onChange={set('feePercent')} /></Field>
                <Field label="Of">
                  <Select value={f.feePercentBase} onChange={set('feePercentBase')}>
                    <option value="TOTAL_VALUE">Total value (all years)</option>
                    <option value="ANNUAL_VALUE">Annual value</option>
                  </Select>
                </Field>
                <Field label="Minimum (₹, 0 = none)"><Input type="number" min={0} value={f.feeMin} onChange={set('feeMin')} /></Field>
                <Field label="Maximum (₹, 0 = none)"><Input type="number" min={0} value={f.feeMax} onChange={set('feeMax')} /></Field>
              </>
            )}
            {f.feeType !== 'NONE' && <Field label="GST %"><Input type="number" min={0} step="0.01" value={f.taxPct} onChange={set('taxPct')} /></Field>}
          </div>
          {f.feeType !== 'NONE' && (
            <Checkbox className="mt-4" checked={f.feeRefundableOnRejection} onChange={(e) => setF({ ...f, feeRefundableOnRejection: e.target.checked })} label="Refund the fee automatically if the application is rejected" />
          )}
        </Card>

        <Card title="Agency commission">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Commission % of scholarship value"><Input type="number" min={0} step="0.01" value={f.commissionPct} onChange={set('commissionPct')} /></Field>
            <Field label="University's share of the commission %"><Input type="number" min={0} step="0.01" value={f.universityCommissionSharePct} onChange={set('universityCommissionSharePct')} /></Field>
          </div>
        </Card>
      </div>

      <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <Card title="Preview">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Tuition covered / yr</dt><dd className="font-semibold">{money(preview.tuition, preview.cur)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Award value / yr</dt><dd className="font-semibold">{money(preview.annual, preview.cur)}</dd></div>
            <div className="flex justify-between border-t border-slate-100 pt-3"><dt className="font-semibold">Total ({f.durationYears} yrs)</dt><dd className="text-lg font-bold text-accent-700">{money(preview.total, preview.cur)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Booked on signing, for {f.seatsTotal} seats</dt><dd className="font-semibold">{money(preview.total * Number(f.seatsTotal || 0), preview.cur, { compact: true })}</dd></div>
            <div className="border-t border-slate-100 pt-3">
              <dt className="text-slate-500">Athlete pays when applying</dt>
              <dd className="text-lg font-bold">{preview.fee.totalInr ? money(preview.fee.totalInr, 'INR') : 'Free'}</dd>
              {preview.fee.totalInr > 0 && <dd className="text-xs text-slate-500">{preview.fee.explanation}: {money(preview.fee.baseInr, 'INR')} + GST {money(preview.fee.taxInr, 'INR')}</dd>}
            </div>
          </dl>
        </Card>
        <Button type="submit" size="lg" block loading={busy}>
          {program ? 'Save changes' : 'Create program (draft)'}
        </Button>
      </div>
    </form>
  );
}
