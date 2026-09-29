'use client';
import { useState } from 'react';
import { Check, Eye, X } from 'lucide-react';
import { apiPatch, apiPost, date, DOC_LABEL, openDocument, statusLabel } from '@aci/web-shared';
import { useApi } from '@aci/web-shared/hooks';
import { Alert, Button, Card, Field, Modal, PageLoader, Select, StatusBadge, Textarea, useToast } from '@aci/web-shared/ui';

interface Dossier {
  profile: {
    id: string;
    athleteCode: string;
    status: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    nationality: string;
    email: string;
    phone: string;
    whatsappNumber: string;
    addressLine: string;
    city: string;
    state: string;
    zipCode: string;
    guardianName: string | null;
    guardianRelation: string | null;
    guardianPhone: string | null;
    reviewRemarks: string | null;
    profilePhotoDocumentId: string | null;
    academics: { level: string; institutionName: string; boardOrUniversity: string | null; stream: string | null; degree: string | null; yearOfPassing: number | null; scoreType: string | null; scoreValue: string | null }[];
    sports: Record<string, any> | null;
    documents: { id: string; type: string; documentId: string; verificationStatus: string; remarks: string | null }[];
    references: { position: number; name: string; designation: string; organization: string; relationship: string | null; phone: string; email: string | null }[];
  };
  completeness: { missing: string[]; isMinor: boolean };
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{k}</dt>
      <dd className="text-sm font-medium text-slate-900">{v || '—'}</dd>
    </div>
  );
}

/** Full athlete profile with inline document verification and profile review (staff). */
export function AthleteDossier({ profileId, canReview }: { profileId: string; canReview: boolean }) {
  const toast = useToast();
  const { data, mutate } = useApi<Dossier>(`/athletes/${profileId}`);
  const [review, setReview] = useState<{ decision: string; remarks: string } | null>(null);
  const [rejectDoc, setRejectDoc] = useState<{ id: string; remarks: string } | null>(null);

  if (!data) return <PageLoader />;
  const p = data.profile;
  const s = p.sports ?? {};

  const verifyDoc = async (docId: string, verificationStatus: string, remarks?: string) => {
    try {
      await apiPatch(`/athletes/${p.id}/documents/${docId}`, { verificationStatus, remarks });
      void mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const submitReview = async () => {
    if (!review) return;
    try {
      await apiPost(`/athletes/${p.id}/review`, { decision: review.decision, remarks: review.remarks || undefined });
      toast.success(`Profile ${statusLabel(review.decision).toLowerCase()}`);
      setReview(null);
      void mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <Card
        title={
          <span className="flex items-center gap-2">
            Athlete profile · {p.athleteCode} <StatusBadge status={p.status} />
          </span>
        }
        actions={
          canReview &&
          ['SUBMITTED', 'CHANGES_REQUESTED', 'VERIFIED'].includes(p.status) && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setReview({ decision: 'CHANGES_REQUESTED', remarks: '' })}>Request changes</Button>
              {p.status !== 'VERIFIED' && (
                <Button size="sm" variant="success" onClick={() => setReview({ decision: 'VERIFIED', remarks: '' })}>Verify profile</Button>
              )}
            </>
          )
        }
      >
        {data.completeness.missing.length > 0 && <Alert tone="warning" className="mb-4">Incomplete: {data.completeness.missing.join(' · ')}</Alert>}
        <div className="grid gap-6 lg:grid-cols-3">
          <dl className="grid grid-cols-2 gap-3">
            <KV k="Name" v={`${p.firstName} ${p.lastName}`} />
            <KV k="Date of birth" v={`${date(p.dateOfBirth)}${data.completeness.isMinor ? ' (minor)' : ''}`} />
            <KV k="Gender" v={statusLabel(p.gender)} />
            <KV k="Nationality" v={p.nationality} />
            <KV k="Phone" v={p.phone} />
            <KV k="WhatsApp" v={p.whatsappNumber} />
            <KV k="Email" v={p.email} />
            <KV k="Address" v={`${p.addressLine}, ${p.city}, ${p.state} ${p.zipCode}`} />
            {p.guardianName && <KV k="Guardian" v={`${p.guardianName} (${p.guardianRelation ?? ''}) ${p.guardianPhone ?? ''}`} />}
          </dl>
          <dl className="grid grid-cols-2 gap-3">
            <KV k="Primary sport" v={s.primarySport} />
            <KV k="Club / academy" v={s.currentClub} />
            <KV k="Coach" v={s.coachName ? `${s.coachName} ${s.coachContact ?? ''}` : ''} />
            <KV k="Training" v={s.yearsOfTraining ? `${s.yearsOfTraining} yrs` : ''} />
            <KV k="Height / weight" v={s.heightCm ? `${s.heightCm} cm / ${s.weightKg} kg` : ''} />
            <KV k="Fitness" v={statusLabel(s.fitnessLevel)} />
            <KV k="Ranking" v={s.rankingLevel ? `${statusLabel(s.rankingLevel)} #${s.rankingValue ?? ''} (${s.ageGroup ?? ''})` : ''} />
            <KV k="Medal inventory till date" v={`🥇${s.medalsGold ?? 0} 🥈${s.medalsSilver ?? 0} 🥉${s.medalsBronze ?? 0}`} />
            <KV k="Best performance" v={s.bestPerformance} />
            <KV k="International" v={s.internationalParticipation ? s.internationalDetails ?? 'Yes' : 'No'} />
            <KV k="Injuries" v={s.previousInjuries ? `${s.injuryDetails} — ${s.recoveryStatus ?? ''}` : 'None declared'} />
          </dl>
          <div className="space-y-3 text-sm">
            {p.academics.map((a) => (
              <div key={a.level}>
                <p className="text-xs text-slate-500">{statusLabel(a.level)}</p>
                <p className="font-medium text-slate-900">{a.institutionName}</p>
                <p className="text-xs text-slate-500">
                  {[a.boardOrUniversity, a.stream, a.degree, a.yearOfPassing, a.scoreValue && `${a.scoreValue} ${a.scoreType?.toLowerCase()}`].filter(Boolean).join(' · ')}
                </p>
              </div>
            ))}
            {p.references.map((r) => (
              <div key={r.position}>
                <p className="text-xs text-slate-500">Reference {r.position}</p>
                <p className="font-medium text-slate-900">
                  {r.name} · {statusLabel(r.designation)}
                </p>
                <p className="text-xs text-slate-500">
                  {r.organization} · {r.phone} {r.email}
                </p>
              </div>
            ))}
          </div>
        </div>
        {p.reviewRemarks && <p className="mt-4 text-xs text-slate-500">Last review remarks: {p.reviewRemarks}</p>}
      </Card>

      <Card title="Documents" subtitle="Open each document and verify it. All mandatory documents must be verified before the profile can be verified." padded={false}>
        <ul className="divide-y divide-slate-100">
          {p.documents.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{DOC_LABEL[d.type] ?? d.type}</p>
                {d.remarks && <p className="text-xs text-red-600">{d.remarks}</p>}
              </div>
              <StatusBadge status={d.verificationStatus} />
              <Button size="sm" variant="secondary" icon={<Eye className="size-4" />} onClick={() => openDocument(d.documentId)}>
                Open
              </Button>
              {canReview && (
                <>
                  <Button size="sm" variant="success" icon={<Check className="size-4" />} onClick={() => verifyDoc(d.id, 'VERIFIED')} disabled={d.verificationStatus === 'VERIFIED'}>
                    Verify
                  </Button>
                  <Button size="sm" variant="ghost" icon={<X className="size-4" />} onClick={() => setRejectDoc({ id: d.id, remarks: '' })}>
                    Reject
                  </Button>
                </>
              )}
            </li>
          ))}
          {p.documents.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">No documents uploaded.</li>}
        </ul>
      </Card>

      <Modal
        open={!!review}
        onClose={() => setReview(null)}
        title={review?.decision === 'VERIFIED' ? 'Verify profile' : 'Request changes'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReview(null)}>Cancel</Button>
            <Button onClick={submitReview}>Confirm</Button>
          </>
        }
      >
        {review && (
          <div className="space-y-4">
            <Field label="Decision">
              <Select value={review.decision} onChange={(e) => setReview({ ...review, decision: e.target.value })}>
                <option value="VERIFIED">Verified</option>
                <option value="CHANGES_REQUESTED">Changes requested (unlocks the profile for the athlete)</option>
                <option value="REJECTED">Rejected</option>
              </Select>
            </Field>
            <Field label="Remarks (sent to the athlete)">
              <Textarea value={review.remarks} onChange={(e) => setReview({ ...review, remarks: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>
      <Modal
        open={!!rejectDoc}
        onClose={() => setRejectDoc(null)}
        title="Reject document"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectDoc(null)}>Cancel</Button>
            <Button variant="danger" disabled={!rejectDoc?.remarks} onClick={() => rejectDoc && verifyDoc(rejectDoc.id, 'REJECTED', rejectDoc.remarks).then(() => setRejectDoc(null))}>
              Reject
            </Button>
          </>
        }
      >
        <Field label="Why? (the athlete sees this)">
          <Textarea value={rejectDoc?.remarks ?? ''} onChange={(e) => setRejectDoc(rejectDoc && { ...rejectDoc, remarks: e.target.value })} placeholder="Blurry / expired / name mismatch…" />
        </Field>
      </Modal>
    </div>
  );
}
