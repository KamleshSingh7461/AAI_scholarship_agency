'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiPost, money } from '@aci/web-shared';
import { useApi } from '@aci/web-shared/hooks';
import { Alert, Button, Checkbox, Field, Input, Modal, Select, Textarea, useToast } from '@aci/web-shared/ui';
import type { Application, Paged, Program } from '@/lib/types';

interface AthleteSummary {
  userId: string;
  profileId: string;
  athleteCode: string;
  fullName: string;
  status: string;
  primarySport: string | null;
  phone: string;
}

/** "Award Scholarship": staff record an award on behalf of an athlete (e.g. already approved offline by the university). */
export function AwardScholarshipModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [athlete, setAthlete] = useState<AthleteSummary | null>(null);
  const [programId, setProgramId] = useState('');
  const [waiveFee, setWaiveFee] = useState(true);
  const [approved, setApproved] = useState(true);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: athletes } = useApi<Paged<AthleteSummary>>(open ? '/athletes' : null, { q, pageSize: 8 });
  const { data: programs } = useApi<Paged<Program>>(open ? '/programs' : null, { status: 'PUBLISHED', pageSize: 100 });
  const program = programs?.items.find((p) => p.id === programId);

  const submit = async () => {
    if (!athlete || !programId) return;
    setBusy(true);
    try {
      const app = await apiPost<Application>('/applications', { athleteUserId: athlete.userId, programId, waiveFee, universityApproved: approved, note: note || undefined });
      toast.success(approved ? 'Scholarship offered — agreements sent to the athlete on WhatsApp' : 'Application created');
      onDone();
      onClose();
      router.push(`/applications/${app.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Award scholarship"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} disabled={!athlete || !programId} onClick={submit}>
            {approved ? 'Award & send agreements' : 'Create application'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Athlete" hint="Athletes must have submitted their profile. Verification is required before agreements are sent.">
          {athlete ? (
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200">
              <span>
                <strong>{athlete.fullName}</strong> · {athlete.athleteCode} · {athlete.primarySport} · {athlete.status.toLowerCase()}
              </span>
              <button className="text-xs font-semibold text-brand-700" onClick={() => setAthlete(null)}>Change</button>
            </div>
          ) : (
            <>
              <Input placeholder="Search by name, athlete ID or phone" value={q} onChange={(e) => setQ(e.target.value)} />
              <ul className="mt-2 max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg ring-1 ring-slate-200">
                {athletes?.items.map((a) => (
                  <li key={a.userId}>
                    <button className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => setAthlete(a)}>
                      <span>{a.fullName ?? a.phone} <span className="text-slate-400">· {a.athleteCode}</span></span>
                      <span className="text-xs text-slate-500">{a.primarySport} · {a.status.toLowerCase()}</span>
                    </button>
                  </li>
                ))}
                {athletes?.items.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">No athletes found</li>}
              </ul>
            </>
          )}
        </Field>
        <Field label="Scholarship program">
          <Select value={programId} onChange={(e) => setProgramId(e.target.value)}>
            <option value="">Select a published program</option>
            {programs?.items.map((p) => (
              <option key={p.id} value={p.id} disabled={p.seatsLeft === 0}>
                {p.university?.name} — {p.name} ({p.seatsLeft} seats left)
              </option>
            ))}
          </Select>
        </Field>
        {program && (
          <p className="text-sm text-slate-600">
            Value {money(program.value.totalValue, program.value.currency)} over {program.durationYears} years · fee {money(program.fee.totalInr, 'INR')}
          </p>
        )}
        <Checkbox checked={waiveFee} onChange={(e) => setWaiveFee(e.target.checked)} label="Waive the application fee" />
        <Checkbox checked={approved} onChange={(e) => setApproved(e.target.checked)} label="The university has already approved this athlete — reserve the seat and send both agreements now" />
        {approved && <Alert tone="info">The athlete will get a WhatsApp message to sign the Scholarship Award Agreement and the Agency Agreement in the portal.</Alert>}
        <Field label="Note (kept in the audit trail)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Approved by IES Board of Members on 12 Aug" />
        </Field>
      </div>
    </Modal>
  );
}
