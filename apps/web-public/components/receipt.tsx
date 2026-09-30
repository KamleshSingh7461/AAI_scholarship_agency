import { inr, type CatalogProgram } from '@/lib/api';

const payer = (b: string) => (b === 'UNIVERSITY' ? 'University' : b === 'COMPANY' ? 'Us' : 'You');

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? 'font-semibold' : ''}`}>
      <span>{label}</span>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  );
}

/** A real catalogue program printed as a till receipt — "prints" out of the slot as it scrolls into view. */
export function Receipt({ p }: { p: CatalogProgram }) {
  const rows = [
    ['Tuition', p.benefitsInr.tuitionPerYear, p.bearers.tuition],
    ['Room', p.benefitsInr.roomPerYear, p.bearers.room],
    ['Food', p.benefitsInr.foodPerYear, p.bearers.food],
    ['Other', p.benefitsInr.otherPerYear, p.bearers.other],
  ] as const;

  return (
    <figure className="w-full max-w-[25rem]">
      <div className="receipt-slot" aria-hidden />
      <div className="receipt-clip">
        <div className="receipt">
          <p className="text-center font-semibold tracking-[0.2em]">ALUMNI CONNECT INDIA</p>
          <p className="text-center text-ink/60">Scholarship statement</p>
          <hr />
          <p className="text-ink/70">{p.university?.name}</p>
          <p className="font-semibold">{p.name}</p>
          <div className="mt-2">
            <Line label="Code" value={p.code} />
            <Line label="Intake" value={p.academicYear} />
          </div>
          <hr />
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-ink/55">
            <span>Per year</span>
            <span>Paid by</span>
            <span className="text-right">₹</span>
          </div>
          {rows.map(([label, amount, bearer]) => (
            <div key={label} className={`grid grid-cols-[1fr_auto_auto] gap-x-4 ${bearer === 'STUDENT' ? 'text-ink/45' : ''}`}>
              <span>{label}</span>
              <span>{payer(bearer)}</span>
              <span className="min-w-[5.5rem] text-right tabular-nums">{bearer === 'STUDENT' ? '—' : inr(amount)}</span>
            </div>
          ))}
          <hr />
          <Line label="Covered per year" value={inr(p.benefitsInr.annualValue)} strong />
          <Line label={`× ${p.durationYears} years`} value="" />
          <div className="mt-2 flex items-baseline justify-between border-y-2 border-ink py-2">
            <span className="font-semibold">TOTAL VALUE</span>
            <span className="text-lg font-semibold tabular-nums">{inr(p.benefitsInr.totalValue)}</span>
          </div>
          <hr />
          {p.fee.totalInr > 0 ? (
            <>
              <Line label="Application fee" value={inr(p.fee.baseInr)} />
              <Line label="GST" value={inr(p.fee.taxInr)} />
              <Line label="Pay once" value={inr(p.fee.totalInr)} strong />
              <p className="mt-1 text-ink/60">{p.feeRefundableOnRejection ? 'Refunded if not approved.' : 'Non-refundable.'}</p>
            </>
          ) : (
            <Line label="Application fee" value="Free" strong />
          )}
          <hr />
          <p className="text-center text-ink/60">The university has the final say.</p>
          <div className="barcode mt-4" aria-hidden />
        </div>
      </div>
      <figcaption className="sr-only">
        Scholarship statement for {p.name} at {p.university?.name}: {inr(p.benefitsInr.annualValue)} per year, {inr(p.benefitsInr.totalValue)} in total.
      </figcaption>
    </figure>
  );
}
