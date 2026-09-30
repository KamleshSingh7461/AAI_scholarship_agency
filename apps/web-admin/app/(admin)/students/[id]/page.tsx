'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { apiPost, date, dateTime, money, openDocument, statusLabel } from '@aci/web-shared';
import { useAuth } from '@aci/web-shared/auth';
import { useApi } from '@aci/web-shared/hooks';
import { Alert, Badge, Button, Card, Checkbox, Field, Input, Modal, PageHeader, PageLoader, Select, Stat, StatusBadge, Table, Td, Textarea, Th, useToast } from '@aci/web-shared/ui';
import { Money } from '@/components/money';
import { FileButton } from '@/components/file-button';
import type { Award } from '@/lib/types';

interface Ledger {
  schedule: { id: string; yearNumber: number; periodStart: string; fiscalYear: string; amount: number; universityFunded: number; companyFunded: number; status: string; recognizedAt: string | null }[];
  journals: { id: string; entryNo: string; entryDate: string; type: string; amount: number; currency: string; memo: string | null; lines: { account: string; debit: number; credit: number }[] }[];
  disbursements: { id: string; category: string; amount: number; currency: string; paidOn: string; reference: string | null; payee: string }[];
}

export default function AwardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const { data: a, mutate } = useApi<Award>(`/awards/${id}`);
  const isFinance = ['SUPER_ADMIN', 'ADMIN', 'FINANCE'].includes(user?.role ?? '');
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role ?? '');
  const { data: ledger, mutate: reloadLedger } = useApi<Ledger>(isFinance && a?.grantDate ? `/finance/awards/${id}` : null);
  const [action, setAction] = useState<null | 'suspend' | 'reinstate' | 'revoke'>(null);
  const [reason, setReason] = useState('');
  const [returnSeat, setReturnSeat] = useState(true);
  const [conf, setConf] = useState<{ status: string; documentId?: string; fileName?: string; note: string }>({ status: 'CONFIRMED', note: '' });
  const [disb, setDisb] = useState({ category: 'ROOM', amount: '', paidOn: new Date().toISOString().slice(0, 10), reference: '', yearNumber: '' });
  const [busy, setBusy] = useState(false);

  if (!a) return <PageLoader />;

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(msg);
      void mutate();
      void reloadLedger();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link href="/students" className="eyebrow link-grow inline-block text-slate-600 hover:text-ink">
        ← Students
      </Link>
      <PageHeader
        title={a.athleteName}
        subtitle={`${a.awardNo} · ${a.athleteCode} · ${a.whatsappNumber} · ${a.universityName} · ${a.sport ?? ''}`}
        actions={
          <>
            <StatusBadge status={a.status} />
            {['PENDING_SIGNATURE', 'RENEWAL_DUE', 'SUSPENDED'].includes(a.status) && (
              <Button size="sm" variant="secondary" loading={busy} onClick={() => run(() => apiPost(`/awards/${id}/remind`), 'Reminder sent on WhatsApp')}>
                Remind
              </Button>
            )}
            {isAdmin && a.status === 'PENDING_SIGNATURE' && (
              <Button size="sm" variant="secondary" loading={busy} onClick={() => run(() => apiPost(`/awards/${id}/resend-agreements`), 'Agreements re-sent')}>
                Resend agreements
              </Button>
            )}
            {isAdmin && ['ACTIVE', 'RENEWAL_DUE'].includes(a.status) && <Button size="sm" variant="secondary" onClick={() => setAction('suspend')}>Suspend</Button>}
            {isAdmin && a.status === 'SUSPENDED' && <Button size="sm" variant="success" onClick={() => setAction('reinstate')}>Reinstate</Button>}
            {isAdmin && !['REVOKED', 'EXPIRED', 'COMPLETED'].includes(a.status) && <Button size="sm" variant="danger" onClick={() => setAction('revoke')}>Revoke</Button>}
          </>
        }
      />
      {a.suspensionReason && a.status === 'SUSPENDED' && <Alert tone="error" title="Suspended">{a.suspensionReason}</Alert>}
      {a.revokeReason && <Alert tone="error" title={statusLabel(a.status)}>{a.revokeReason}</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total value" value={<Money minor={a.totalValue} currency={a.currency} rate4={a.usdInrRate4} />} sub={`${money(a.annualValue, a.currency)} × ${a.durationYears} years`} tone="green" />
        <Stat label="Date passed out (grant)" value={a.grantDate ? date(a.grantDate) : '—'} sub={a.grantDate ? `Revenue booked ${date(a.grantDate)}` : `Sign by ${date(a.agreementsDeadline)}`} />
        <Stat label="Current year" value={`${a.currentYear} of ${a.durationYears}`} sub={a.startDate ? `${date(a.startDate)} → ${date(a.endDate)}` : ''} />
        <Stat label="University confirmation" value={statusLabel(a.universityConfirmationStatus)} sub={a.universityConfirmedAt ? date(a.universityConfirmedAt) : 'Needed for audit'} tone={a.universityConfirmationStatus === 'CONFIRMED' ? 'green' : 'amber'} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Value per year">
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            {(
              [
                ['Tuition', a.tuitionPerYear],
                ['Room', a.roomPerYear],
                ['Food', a.foodPerYear],
                ['Other', a.otherPerYear],
              ] as const
            ).map(([l, v]) => (
              <div key={l}>
                <dt className="text-xs text-slate-500">{l}</dt>
                <dd className="font-semibold"><Money minor={v} currency={a.currency} rate4={a.usdInrRate4} /></dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-slate-500">
            FX snapshot 1 USD = ₹{(a.usdInrRate4 / 10000).toFixed(2)} · Agency commission {(a.commissionBps / 100).toFixed(2)}% · {a.programName} ({a.academicYear})
          </p>
        </Card>
        <Card title="Signed agency paperwork">
          <ul className="space-y-3 text-sm">
            {(
              [
                ['Scholarship Award Agreement', a.scholarshipSignedAt, a.scholarshipSignedDocumentId],
                ['Agency Agreement', a.agencySignedAt, a.agencySignedDocumentId],
              ] as const
            ).map(([label, at, doc]) => (
              <li key={label} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                <span className={`h-9 w-1 shrink-0 ${at ? 'bg-accent-600' : 'bg-amber-500'}`} aria-hidden />
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">{label}</p>
                  <p className="text-xs text-slate-500">{at ? `Signed ${dateTime(at)}` : 'Not signed yet'}</p>
                </div>
                {doc && (
                  <Button size="sm" variant="secondary" onClick={() => openDocument(doc)}>
                    View
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {a.isMinor && <p className="mt-3 text-xs text-slate-500">Athlete is a minor — agreements are co-signed by the guardian.</p>}
        </Card>
      </div>

      {a.years && a.years.length > 0 && (
        <Card title="Yearly renewals" padded={false}>
          <Table>
            <thead>
              <tr>
                <Th>Year</Th>
                <Th>Academic year</Th>
                <Th>Anniversary</Th>
                <Th>Registration</Th>
                <Th>Signatures</Th>
                <Th className="text-right">Value</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {a.years.map((y) => (
                <tr key={y.id}>
                  <Td className="font-semibold">Year {y.yearNumber}</Td>
                  <Td>{y.academicYear}</Td>
                  <Td>{date(y.dueDate)}</Td>
                  <Td className="text-xs">
                    {y.registrationSubmittedAt ? `✓ ${date(y.registrationSubmittedAt)}${y.currentCourse ? ` · ${y.currentCourse}` : ''}` : '—'}
                    {y.registrationDocumentId && (
                      <button className="ml-2 text-brand-700 underline" onClick={() => openDocument(y.registrationDocumentId!)}>doc</button>
                    )}
                  </Td>
                  <Td className="text-xs">{[y.scholarshipSignedAt && 'Scholarship ✓', y.agencySignedAt && 'Agency ✓'].filter(Boolean).join(' · ') || '—'}</Td>
                  <Td className="text-right">{money(y.amount, a.currency)}</Td>
                  <Td><StatusBadge status={y.status} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {a.grantDate && ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'UNIVERSITY_REP'].includes(user?.role ?? '') && (
        <Card title="University confirmation (audit)" subtitle="Every booked amount must be backed by the university's own written confirmation.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[180px_1fr_auto] md:items-end">
            <Field label="Status">
              <Select value={conf.status} onChange={(e) => setConf({ ...conf, status: e.target.value })}>
                <option value="CONFIRMED">Confirmed</option>
                <option value="DISPUTED">Disputed</option>
                <option value="PENDING">Pending</option>
              </Select>
            </Field>
            <Field label="Note">
              <Input value={conf.note} onChange={(e) => setConf({ ...conf, note: e.target.value })} placeholder="e.g. Confirmed by Registrar letter dated…" />
            </Field>
            <div className="flex gap-2">
              <FileButton label={conf.fileName ?? 'Letter'} category="UNIVERSITY_LETTER" subType="AWARD_CONFIRMATION" onUploaded={(documentId, fileName) => setConf({ ...conf, documentId, fileName })} />
              <Button loading={busy} onClick={() => run(() => apiPost(`/awards/${id}/university-confirmation`, { status: conf.status, documentId: conf.documentId, note: conf.note || undefined }), 'Confirmation recorded')}>
                Save
              </Button>
            </div>
          </div>
          {a.universityConfirmationDocumentId && (
            <button className="mt-3 text-xs font-semibold text-brand-700 underline" onClick={() => openDocument(a.universityConfirmationDocumentId!)}>
              View confirmation letter
            </button>
          )}
        </Card>
      )}

      {isFinance && ledger && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card title="Expense schedule" padded={false}>
            <Table>
              <thead>
                <tr>
                  <Th>Year</Th>
                  <Th>FY</Th>
                  <Th className="text-right">Amount</Th>
                  <Th className="text-right">Univ. funded</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledger.schedule.map((s) => (
                  <tr key={s.id}>
                    <Td>Year {s.yearNumber}</Td>
                    <Td>{s.fiscalYear}</Td>
                    <Td className="text-right">{money(s.amount, a.currency)}</Td>
                    <Td className="text-right">{money(s.universityFunded, a.currency)}</Td>
                    <Td><StatusBadge status={s.status} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
          <Card title="Cash disbursements" subtitle="Company-funded benefits actually paid (e.g. hostel, food)">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Select value={disb.category} onChange={(e) => setDisb({ ...disb, category: e.target.value })}>
                <option value="ROOM">Room</option>
                <option value="FOOD">Food</option>
                <option value="TUITION">Tuition</option>
                <option value="OTHER">Other</option>
              </Select>
              <Input placeholder={`Amount (${a.currency})`} type="number" value={disb.amount} onChange={(e) => setDisb({ ...disb, amount: e.target.value })} />
              <Input type="date" value={disb.paidOn} onChange={(e) => setDisb({ ...disb, paidOn: e.target.value })} />
              <Input placeholder="UTR / ref" value={disb.reference} onChange={(e) => setDisb({ ...disb, reference: e.target.value })} />
              <Button
                loading={busy}
                disabled={!disb.amount}
                onClick={() =>
                  run(
                    () =>
                      apiPost('/finance/disbursements', {
                        awardId: id,
                        category: disb.category,
                        amount: Math.round(Number(disb.amount) * 100),
                        paidOn: disb.paidOn,
                        reference: disb.reference || undefined,
                      }),
                    'Disbursement recorded',
                  )
                }
              >
                Record
              </Button>
            </div>
            <ul className="mt-4 divide-y divide-slate-100 text-sm">
              {ledger.disbursements.map((d) => (
                <li key={d.id} className="flex justify-between py-2">
                  <span>
                    {date(d.paidOn)} · {d.category.toLowerCase()} → {d.payee.toLowerCase()} {d.reference && <Badge>{d.reference}</Badge>}
                  </span>
                  <span className="font-semibold">{money(d.amount, d.currency)}</span>
                </li>
              ))}
              {ledger.disbursements.length === 0 && <li className="py-2 text-slate-500">No cash paid out yet.</li>}
            </ul>
          </Card>
          <Card title="Journal entries" className="xl:col-span-2" padded={false}>
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Entry</Th>
                  <Th>Type</Th>
                  <Th>Lines</Th>
                  <Th className="text-right">Amount</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledger.journals.map((j) => (
                  <tr key={j.id}>
                    <Td className="whitespace-nowrap">{date(j.entryDate)}</Td>
                    <Td className="font-mono text-xs">{j.entryNo}</Td>
                    <Td className="text-xs">{j.type.replace(/_/g, ' ').toLowerCase()}</Td>
                    <Td className="text-xs text-slate-500">
                      {j.lines.map((l, i) => (
                        <div key={i}>
                          {Number(l.debit) > 0 ? 'Dr' : 'Cr'} {l.account} {money(Number(l.debit) || Number(l.credit), j.currency)}
                        </div>
                      ))}
                    </Td>
                    <Td className="text-right font-semibold">{money(j.amount, j.currency)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
      )}

      <Modal
        open={!!action}
        onClose={() => setAction(null)}
        title={action === 'revoke' ? 'Revoke scholarship' : action === 'suspend' ? 'Suspend scholarship' : 'Reinstate scholarship'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAction(null)}>Cancel</Button>
            <Button
              variant={action === 'reinstate' ? 'success' : 'danger'}
              disabled={reason.length < 3}
              loading={busy}
              onClick={() =>
                run(() => apiPost(`/awards/${id}/${action}`, { reason, returnSeat: action === 'revoke' ? returnSeat : undefined }), 'Updated').then(() => setAction(null))
              }
            >
              Confirm
            </Button>
          </>
        }
      >
        <Field label="Reason (kept in the audit trail and sent to the athlete)">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {action === 'revoke' && (
          <>
            <Checkbox className="mt-4" checked={returnSeat} onChange={(e) => setReturnSeat(e.target.checked)} label="Return the seat to the program's inventory" />
            <Alert tone="warning" className="mt-4">Future years are cancelled and undelivered revenue is reversed in the ledger. This cannot be undone.</Alert>
          </>
        )}
      </Modal>
    </div>
  );
}
