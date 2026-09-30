'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { apiPatch, apiPost, date, money, openDocument, pct, statusLabel } from '@aci/web-shared';
import { useAuth } from '@aci/web-shared/auth';
import { useApi } from '@aci/web-shared/hooks';
import { Alert, Badge, Button, Card, Checkbox, Field, Input, Modal, PageHeader, PageLoader, Select, StatusBadge, Table, Tabs, Td, Textarea, Th, useToast } from '@aci/web-shared/ui';
import { FileButton } from '@/components/file-button';
import type { Program, University } from '@/lib/types';

interface Agreement {
  id: string;
  type: string;
  title: string;
  referenceNo: string | null;
  signedDate: string | null;
  effectiveDate: string;
  termYears: number | null;
  autoRenew: boolean;
  expiresAt: string | null;
  universityRevenueShareBps: number | null;
  companyRevenueShareBps: number | null;
  agencyCommissionBps: number | null;
  universityCommissionShareBps: number | null;
  documentId: string | null;
  notes: string | null;
  status: string;
}
interface Allocation {
  id: string;
  academicYear: string;
  totalSeats: number;
  rolledOverSeats: number;
  rolloverPolicy: string;
  valuationPerSeatAnnual: number | null;
  valuationCurrency: string;
  status: string;
  capacity: number;
  assignedToPrograms: number;
  awarded: number;
  unassigned: number;
  forfeitedSeats: number;
  transferLetterDocumentId: string | null;
  valuationLetterDocumentId: string | null;
  notes: string | null;
}
type Detail = University & { agreements: Agreement[]; programs: Program[] };

const AGREEMENT_TYPES: Record<string, string> = {
  ESTABLISHMENT: 'Establishment MoU',
  SCHOLARSHIP_TRANSFER: 'Scholarship transfer letter',
  VALUATION: 'Valuation letter',
  OTHER: 'Other',
};

export default function UniversityPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role ?? '');
  const [tab, setTab] = useState<'agreements' | 'allocations' | 'programs' | 'details'>('allocations');
  const { data: u, mutate } = useApi<Detail>(`/universities/${id}`);
  const { data: allocations, mutate: reloadAlloc } = useApi<Allocation[]>(`/universities/${id}/allocations`);
  const [agr, setAgr] = useState<null | Record<string, any>>(null);
  const [alloc, setAlloc] = useState<null | Record<string, any>>(null);
  const [closing, setClosing] = useState<Allocation | null>(null);
  const [edit, setEdit] = useState<Partial<University> | null>(null);

  if (!u) return <PageLoader />;

  const saveAgreement = async () => {
    try {
      const a = agr!;
      await apiPost(`/universities/${id}/agreements`, {
        type: a.type,
        title: a.title,
        referenceNo: a.referenceNo || undefined,
        signedDate: a.signedDate || undefined,
        effectiveDate: a.effectiveDate,
        termYears: a.termYears ? Number(a.termYears) : undefined,
        autoRenew: !!a.autoRenew,
        renewalTermYears: a.renewalTermYears ? Number(a.renewalTermYears) : undefined,
        noticePeriodMonths: a.noticePeriodMonths ? Number(a.noticePeriodMonths) : undefined,
        universityRevenueShareBps: a.universityShare ? Math.round(Number(a.universityShare) * 100) : undefined,
        companyRevenueShareBps: a.companyShare ? Math.round(Number(a.companyShare) * 100) : undefined,
        agencyCommissionBps: a.commission ? Math.round(Number(a.commission) * 100) : undefined,
        universityCommissionShareBps: a.uniCommissionShare ? Math.round(Number(a.uniCommissionShare) * 100) : undefined,
        documentId: a.documentId,
        notes: a.notes || undefined,
      });
      toast.success('Agreement recorded');
      setAgr(null);
      void mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const saveAllocation = async () => {
    try {
      const a = alloc!;
      await apiPost(`/universities/${id}/allocations`, {
        academicYear: a.academicYear,
        totalSeats: Number(a.totalSeats),
        rolloverPolicy: a.rolloverPolicy,
        agreementId: a.agreementId || undefined,
        valuationPerSeatAnnual: a.valuation ? Math.round(Number(a.valuation) * 100) : undefined,
        valuationCurrency: a.valuationCurrency,
        transferLetterDocumentId: a.transferLetterDocumentId,
        valuationLetterDocumentId: a.valuationLetterDocumentId,
        notes: a.notes || undefined,
      });
      toast.success('Allocation recorded');
      setAlloc(null);
      void reloadAlloc();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const closeAllocation = async () => {
    try {
      const r = await apiPost<{ unused: number; awarded: number }>(`/allocations/${closing!.id}/close`, {});
      toast.success(`Closed: ${r.awarded} awarded, ${r.unused} ${closing!.rolloverPolicy === 'ROLLOVER' ? 'rolled over' : 'forfeited'}`);
      setClosing(null);
      void reloadAlloc();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const saveDetails = async () => {
    try {
      const { name, shortName, city, state, website, contactName, contactEmail, contactPhone, description, status } = edit as University;
      await apiPatch(`/universities/${id}`, Object.fromEntries(Object.entries({ name, shortName, city, state, website, contactName, contactEmail, contactPhone, description, status }).filter(([, v]) => v !== null && v !== undefined && v !== '')));
      toast.success('Saved');
      setEdit(null);
      void mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <Link href="/universities" className="eyebrow link-grow inline-block text-slate-600 hover:text-ink">
        ← Universities
      </Link>
      <PageHeader title={u.name} subtitle={[u.city, u.state, u.website].filter(Boolean).join(' · ')} actions={<StatusBadge status={u.status} />} />
      <Tabs
        tabs={[
          { value: 'allocations' as const, label: 'Annual allocations', count: allocations?.length },
          { value: 'agreements' as const, label: 'MoUs & letters', count: u.agreements.length },
          { value: 'programs' as const, label: 'Programs', count: u.programs.length },
          { value: 'details' as const, label: 'Details' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'allocations' && (
        <Card
          title="Scholarship rights transferred each academic year"
          subtitle="From the Scholarship Transfer Letter: how many seats the university gives us each year, and what happens to unused seats."
          actions={isAdmin && <Button size="sm" onClick={() => setAlloc({ academicYear: '', totalSeats: 50, rolloverPolicy: 'FORFEIT', valuationCurrency: 'INR' })}>Add year</Button>}
          padded={false}
        >
          <Table>
            <thead>
              <tr>
                <Th>Academic year</Th>
                <Th className="text-right">Seats</Th>
                <Th className="text-right">In programs</Th>
                <Th className="text-right">Awarded</Th>
                <Th>Unused seats</Th>
                <Th>Valuation / seat / yr</Th>
                <Th>Letters</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allocations?.map((a) => (
                <tr key={a.id}>
                  <Td className="font-semibold">{a.academicYear}</Td>
                  <Td className="text-right">
                    {a.capacity}
                    {a.rolledOverSeats > 0 && <span className="block text-xs text-slate-500">incl. {a.rolledOverSeats} rolled over</span>}
                  </Td>
                  <Td className="text-right">{a.assignedToPrograms}</Td>
                  <Td className="text-right font-semibold text-accent-700">{a.awarded}</Td>
                  <Td><Badge tone={a.rolloverPolicy === 'ROLLOVER' ? 'blue' : 'amber'}>{a.rolloverPolicy === 'ROLLOVER' ? 'Roll over' : 'Forfeit'}</Badge>{a.forfeitedSeats > 0 && <span className="ml-2 text-xs text-red-600">{a.forfeitedSeats} forfeited</span>}</Td>
                  <Td>{a.valuationPerSeatAnnual ? money(a.valuationPerSeatAnnual, a.valuationCurrency) : '—'}</Td>
                  <Td>
                    {a.transferLetterDocumentId && <button className="mr-2 text-xs font-semibold text-brand-700 underline" onClick={() => openDocument(a.transferLetterDocumentId!)}>Transfer</button>}
                    {a.valuationLetterDocumentId && <button className="text-xs font-semibold text-brand-700 underline" onClick={() => openDocument(a.valuationLetterDocumentId!)}>Valuation</button>}
                  </Td>
                  <Td><StatusBadge status={a.status} /></Td>
                  <Td>{isAdmin && a.status === 'OPEN' && <Button size="sm" variant="ghost" onClick={() => setClosing(a)}>Close year</Button>}</Td>
                </tr>
              ))}
              {allocations?.length === 0 && <tr><Td colSpan={9} className="text-slate-500">No allocations recorded yet.</Td></tr>}
            </tbody>
          </Table>
        </Card>
      )}

      {tab === 'agreements' && (
        <Card
          title="Partnership agreements"
          actions={isAdmin && <Button size="sm" onClick={() => setAgr({ type: 'ESTABLISHMENT', title: '', effectiveDate: '' })}>Add agreement</Button>}
          padded={false}
        >
          <ul className="divide-y divide-slate-100">
            {u.agreements.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start gap-4 px-5 py-4">
                <span className="mt-0.5 h-9 w-1 shrink-0 bg-ink/20" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{a.title}</p>
                  <p className="text-xs text-slate-500">
                    {AGREEMENT_TYPES[a.type]} · effective {date(a.effectiveDate)}
                    {a.termYears ? ` · ${a.termYears} years${a.autoRenew ? ', auto-renews' : ''} · expires ${date(a.expiresAt)}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {[
                      a.universityRevenueShareBps !== null && `Donations split ${pct(a.universityRevenueShareBps)} university / ${pct(a.companyRevenueShareBps ?? 0)} company`,
                      a.agencyCommissionBps !== null && `Agency commission ${pct(a.agencyCommissionBps)} (university share ${pct(a.universityCommissionShareBps ?? 0)})`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {a.notes && <p className="mt-1 text-xs text-slate-500">{a.notes}</p>}
                </div>
                <StatusBadge status={a.status} />
                {a.documentId && <Button size="sm" variant="secondary" onClick={() => openDocument(a.documentId!)}>Document</Button>}
              </li>
            ))}
            {u.agreements.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">No agreements recorded.</li>}
          </ul>
        </Card>
      )}

      {tab === 'programs' && (
        <Card title="Programs" actions={isAdmin && <Link href={`/programs/new?universityId=${id}`}><Button size="sm">New program</Button></Link>} padded={false}>
          <Table>
            <thead>
              <tr>
                <Th>Program</Th>
                <Th>Year</Th>
                <Th>Length</Th>
                <Th className="text-right">Seats (awarded / reserved / total)</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {u.programs.map((p) => (
                <tr key={p.id}>
                  <Td><Link href={`/programs/${p.id}`} className="font-semibold text-slate-900 hover:text-brand-700">{p.name}</Link><span className="block font-mono text-xs text-slate-400">{p.code}</span></Td>
                  <Td>{p.academicYear}</Td>
                  <Td>{p.durationYears}-Year</Td>
                  <Td className="text-right">{p.seatsAwarded} / {p.seatsReserved} / {p.seatsTotal}</Td>
                  <Td><StatusBadge status={p.status} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {tab === 'details' && (
        <Card title="Details" actions={isAdmin && !edit && <Button size="sm" variant="secondary" onClick={() => setEdit(u)}>Edit</Button>}>
          {edit ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(['name', 'shortName', 'city', 'state', 'website', 'contactName', 'contactEmail', 'contactPhone'] as const).map((k) => (
                <Field key={k} label={statusLabel(k.replace(/([A-Z])/g, '_$1').toUpperCase())}>
                  <Input value={(edit[k] as string) ?? ''} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} />
                </Field>
              ))}
              <Field label="Status">
                <Select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive (hidden from the public site)</option>
                </Select>
              </Field>
              <Field label="Description" className="sm:col-span-2"><Textarea value={edit.description ?? ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
              <div className="flex gap-2 sm:col-span-2">
                <Button onClick={saveDetails}>Save</Button>
                <Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">Contact</dt><dd>{[u.contactName, u.contactEmail, u.contactPhone].filter(Boolean).join(' · ') || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">Website</dt><dd>{u.website ?? '—'}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Description</dt><dd>{u.description ?? '—'}</dd></div>
            </dl>
          )}
        </Card>
      )}

      <Modal
        open={!!agr}
        onClose={() => setAgr(null)}
        title="Record partnership agreement"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAgr(null)}>Cancel</Button>
            <Button disabled={!agr?.title || !agr?.effectiveDate} onClick={saveAgreement}>Save</Button>
          </>
        }
      >
        {agr && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Type">
              <Select value={agr.type} onChange={(e) => setAgr({ ...agr, type: e.target.value })}>
                {Object.entries(AGREEMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Reference no"><Input value={agr.referenceNo ?? ''} onChange={(e) => setAgr({ ...agr, referenceNo: e.target.value })} /></Field>
            <Field label="Title" required className="sm:col-span-2"><Input value={agr.title} onChange={(e) => setAgr({ ...agr, title: e.target.value })} placeholder="Agreement for the Establishment of Alumni Association" /></Field>
            <Field label="Signed on"><Input type="date" value={agr.signedDate ?? ''} onChange={(e) => setAgr({ ...agr, signedDate: e.target.value })} /></Field>
            <Field label="Effective from" required><Input type="date" value={agr.effectiveDate} onChange={(e) => setAgr({ ...agr, effectiveDate: e.target.value })} /></Field>
            <Field label="Term (years)"><Input type="number" value={agr.termYears ?? ''} onChange={(e) => setAgr({ ...agr, termYears: e.target.value })} /></Field>
            <Field label="Notice period (months)"><Input type="number" value={agr.noticePeriodMonths ?? ''} onChange={(e) => setAgr({ ...agr, noticePeriodMonths: e.target.value })} /></Field>
            <Checkbox className="sm:col-span-2" checked={!!agr.autoRenew} onChange={(e) => setAgr({ ...agr, autoRenew: e.target.checked })} label="Renews automatically" />
            <Field label="Donation share — university %"><Input type="number" value={agr.universityShare ?? ''} onChange={(e) => setAgr({ ...agr, universityShare: e.target.value })} placeholder="80" /></Field>
            <Field label="Donation share — company %"><Input type="number" value={agr.companyShare ?? ''} onChange={(e) => setAgr({ ...agr, companyShare: e.target.value })} placeholder="20" /></Field>
            <Field label="Agency commission %"><Input type="number" value={agr.commission ?? ''} onChange={(e) => setAgr({ ...agr, commission: e.target.value })} placeholder="8" /></Field>
            <Field label="University's share of commission %"><Input type="number" value={agr.uniCommissionShare ?? ''} onChange={(e) => setAgr({ ...agr, uniCommissionShare: e.target.value })} /></Field>
            <Field label="Signed copy" className="sm:col-span-2">
              <FileButton label={agr.fileName ?? 'Upload signed PDF'} category="MOU" subType={agr.type} onUploaded={(documentId, fileName) => setAgr({ ...agr, documentId, fileName })} />
            </Field>
            <Field label="Notes" className="sm:col-span-2"><Textarea value={agr.notes ?? ''} onChange={(e) => setAgr({ ...agr, notes: e.target.value })} /></Field>
          </div>
        )}
      </Modal>

      <Modal
        open={!!alloc}
        onClose={() => setAlloc(null)}
        title="Record annual scholarship allocation"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAlloc(null)}>Cancel</Button>
            <Button disabled={!/^\d{4}-\d{2}$/.test(alloc?.academicYear ?? '')} onClick={saveAllocation}>Save</Button>
          </>
        }
      >
        {alloc && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Academic year" required hint="e.g. 2026-27"><Input value={alloc.academicYear} onChange={(e) => setAlloc({ ...alloc, academicYear: e.target.value })} /></Field>
            <Field label="Seats transferred" required><Input type="number" value={alloc.totalSeats} onChange={(e) => setAlloc({ ...alloc, totalSeats: e.target.value })} /></Field>
            <Field label="Unused seats at year end" hint="The IES transfer letter says forfeited; the valuation letter says rolled over — confirm with the university">
              <Select value={alloc.rolloverPolicy} onChange={(e) => setAlloc({ ...alloc, rolloverPolicy: e.target.value })}>
                <option value="FORFEIT">Forfeited</option>
                <option value="ROLLOVER">Rolled over to next year</option>
              </Select>
            </Field>
            <Field label="Linked agreement">
              <Select value={alloc.agreementId ?? ''} onChange={(e) => setAlloc({ ...alloc, agreementId: e.target.value })}>
                <option value="">—</option>
                {u.agreements.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
              </Select>
            </Field>
            <Field label="Fair value per seat per year" hint="From the valuation letter (e.g. 37500)"><Input type="number" value={alloc.valuation ?? ''} onChange={(e) => setAlloc({ ...alloc, valuation: e.target.value })} /></Field>
            <Field label="Currency">
              <Select value={alloc.valuationCurrency} onChange={(e) => setAlloc({ ...alloc, valuationCurrency: e.target.value })}>
                <option>INR</option>
                <option>USD</option>
              </Select>
            </Field>
            <Field label="Transfer letter"><FileButton label={alloc.tlName ?? 'Upload'} category="UNIVERSITY_LETTER" subType="TRANSFER_LETTER" onUploaded={(d, n) => setAlloc({ ...alloc, transferLetterDocumentId: d, tlName: n })} /></Field>
            <Field label="Valuation letter"><FileButton label={alloc.vlName ?? 'Upload'} category="UNIVERSITY_LETTER" subType="VALUATION_LETTER" onUploaded={(d, n) => setAlloc({ ...alloc, valuationLetterDocumentId: d, vlName: n })} /></Field>
            <Field label="Notes" className="sm:col-span-2"><Textarea value={alloc.notes ?? ''} onChange={(e) => setAlloc({ ...alloc, notes: e.target.value })} /></Field>
          </div>
        )}
      </Modal>

      <Modal
        open={!!closing}
        onClose={() => setClosing(null)}
        title={`Close academic year ${closing?.academicYear}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setClosing(null)}>Cancel</Button>
            <Button variant="danger" onClick={closeAllocation}>Close year</Button>
          </>
        }
      >
        {closing && (
          <Alert tone="warning">
            {closing.awarded} of {closing.capacity} seats were awarded. The remaining {closing.capacity - closing.awarded} will be{' '}
            <strong>{closing.rolloverPolicy === 'ROLLOVER' ? 'rolled over into next year' : 'forfeited'}</strong>, and this year&apos;s published programs will close. This cannot be undone.
          </Alert>
        )}
      </Modal>
    </div>
  );
}
