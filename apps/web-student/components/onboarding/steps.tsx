'use client';
import { useState, type FormEvent, type ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { apiPut } from '@aci/web-shared';
import { Alert, Button, Checkbox, Field, Input, Select, Textarea, useToast } from '@aci/web-shared/ui';
import { FileUpload } from '@/components/file-upload';
import type { AcademicRecord, AthleteProfile, MeResponse, Reference, SportsProfile } from '@/lib/types';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir',
  'Ladakh', 'Lakshadweep', 'Puducherry',
];
const SPORTS = ['Athletics', 'Badminton', 'Basketball', 'Boxing', 'Cricket', 'Football', 'Hockey', 'Kabaddi', 'Kho-Kho', 'Shooting', 'Swimming', 'Table Tennis', 'Tennis', 'Volleyball', 'Weightlifting', 'Wrestling', 'Other'];

type Save = (r: MeResponse) => void;

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-2 border-b-2 border-brand-100 pb-1 text-sm font-bold uppercase tracking-wide text-brand-700">{title}</legend>
      {children}
    </fieldset>
  );
}

function ageFrom(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--;
  return a;
}

// ------------------------------------------------------------------------ Step 1: Personal info
export function PersonalStep({ profile, onSaved, locked }: { profile: AthleteProfile; onSaved: Save; locked: boolean }) {
  const toast = useToast();
  const [f, setF] = useState({
    firstName: profile.firstName ?? '',
    lastName: profile.lastName ?? '',
    dateOfBirth: profile.dateOfBirth?.slice(0, 10) ?? '',
    gender: profile.gender ?? '',
    nationality: profile.nationality ?? 'Indian',
    profilePhotoDocumentId: profile.profilePhotoDocumentId ?? '',
    email: profile.email ?? '',
    whatsappNumber: profile.whatsappNumber ?? profile.phone,
    addressLine: profile.addressLine ?? '',
    city: profile.city ?? '',
    state: profile.state ?? '',
    zipCode: profile.zipCode ?? '',
    guardianName: profile.guardianName ?? '',
    guardianRelation: profile.guardianRelation ?? '',
    guardianPhone: profile.guardianPhone ?? '',
    guardianEmail: profile.guardianEmail ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const age = ageFrom(f.dateOfBirth);
  const minor = age !== null && age < 18;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '')) as Record<string, string>;
      onSaved(await apiPut<MeResponse>('/athletes/me/personal', body));
      toast.success('Personal info saved');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-8">
      <Section title="Basic details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" required><Input value={f.firstName} onChange={set('firstName')} required disabled={locked} /></Field>
          <Field label="Last name" required><Input value={f.lastName} onChange={set('lastName')} required disabled={locked} /></Field>
          <Field label="Date of birth" required hint={age !== null ? `Age ${age}` : 'DD/MM/YYYY'}>
            <Input type="date" value={f.dateOfBirth} onChange={set('dateOfBirth')} required disabled={locked} max={new Date().toISOString().slice(0, 10)} />
          </Field>
          <Field label="Gender" required>
            <Select value={f.gender} onChange={set('gender')} required disabled={locked}>
              <option value="">Select</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
              <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
            </Select>
          </Field>
          <Field label="Nationality" required><Input value={f.nationality} onChange={set('nationality')} required disabled={locked} /></Field>
        </div>
        <FileUpload
          label="Profile photo (passport size)"
          subType="PROFILE_PHOTO"
          required
          documentId={f.profilePhotoDocumentId}
          onUploaded={async (id) => {
            setF((x) => ({ ...x, profilePhotoDocumentId: id }));
            // The photo is also one of the mandatory Step-4 documents.
            await apiPut('/athletes/me/documents', { documents: [{ type: 'PROFILE_PHOTO', documentId: id }] });
          }}
          disabled={locked}
          hint="A clear, recent photo — JPG or PNG"
        />
      </Section>

      <Section title="Contact information">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mobile number">
            <div className="flex h-10 items-center gap-2 rounded-lg bg-emerald-50 px-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
              <ShieldCheck className="size-4" /> {profile.phone} · verified by OTP
            </div>
          </Field>
          <Field label="WhatsApp number" hint="Where we send reminders and renewal notices"><Input value={f.whatsappNumber} onChange={set('whatsappNumber')} disabled={locked} /></Field>
          <Field label="Email address" required className="sm:col-span-2"><Input type="email" value={f.email} onChange={set('email')} required disabled={locked} /></Field>
          <Field label="Current address" required className="sm:col-span-2"><Input value={f.addressLine} onChange={set('addressLine')} required disabled={locked} /></Field>
          <Field label="City" required><Input value={f.city} onChange={set('city')} required disabled={locked} /></Field>
          <Field label="State" required>
            <Select value={f.state} onChange={set('state')} required disabled={locked}>
              <option value="">Select state</option>
              {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="PIN / ZIP code" required><Input value={f.zipCode} onChange={set('zipCode')} required inputMode="numeric" disabled={locked} /></Field>
        </div>
      </Section>

      {(minor || f.guardianName) && (
        <Section title="Parent / guardian">
          {minor && <Alert tone="info">You are under 18, so a parent or guardian must be named here. They will co-sign your agreements with you.</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Guardian name" required={minor}><Input value={f.guardianName} onChange={set('guardianName')} required={minor} disabled={locked} /></Field>
            <Field label="Relationship"><Input value={f.guardianRelation} onChange={set('guardianRelation')} placeholder="Father / Mother / Guardian" disabled={locked} /></Field>
            <Field label="Guardian mobile" required={minor}><Input value={f.guardianPhone} onChange={set('guardianPhone')} required={minor} disabled={locked} /></Field>
            <Field label="Guardian email"><Input type="email" value={f.guardianEmail} onChange={set('guardianEmail')} disabled={locked} /></Field>
          </div>
        </Section>
      )}
      {!locked && <StepActions saving={saving} />}
    </form>
  );
}

// ------------------------------------------------------------------------ Step 2: Academic info
const emptyRecord = (level: AcademicRecord['level']): AcademicRecord => ({ level, institutionName: '', boardOrUniversity: '', yearOfPassing: undefined, scoreType: 'PERCENTAGE', scoreValue: '' });

export function AcademicStep({ profile, onSaved, locked }: { profile: AthleteProfile; onSaved: Save; locked: boolean }) {
  const toast = useToast();
  const byLevel = Object.fromEntries(profile.academics.map((a) => [a.level, a]));
  const [records, setRecords] = useState<Record<string, AcademicRecord>>({
    HIGH_SCHOOL: byLevel.HIGH_SCHOOL ?? emptyRecord('HIGH_SCHOOL'),
    INTERMEDIATE: byLevel.INTERMEDIATE ?? emptyRecord('INTERMEDIATE'),
    GRADUATION: byLevel.GRADUATION ?? emptyRecord('GRADUATION'),
  });
  const [include, setInclude] = useState({ INTERMEDIATE: !!byLevel.INTERMEDIATE, GRADUATION: !!byLevel.GRADUATION });
  const [saving, setSaving] = useState(false);
  const upd = (level: string, k: keyof AcademicRecord, v: unknown) => setRecords((r) => ({ ...r, [level]: { ...r[level], [k]: v } }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const list = (['HIGH_SCHOOL', 'INTERMEDIATE', 'GRADUATION'] as const)
        .filter((l) => l === 'HIGH_SCHOOL' || include[l])
        .map((l) => {
          const r = records[l];
          return Object.fromEntries(Object.entries({ ...r, yearOfPassing: r.yearOfPassing ? Number(r.yearOfPassing) : undefined }).filter(([, v]) => v !== '' && v !== null && v !== undefined));
        });
      onSaved(await apiPut<MeResponse>('/athletes/me/academic', { records: list }));
      toast.success('Academic info saved');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const block = (level: 'HIGH_SCHOOL' | 'INTERMEDIATE' | 'GRADUATION', title: string) => {
    const r = records[level];
    return (
      <Section title={title}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={level === 'HIGH_SCHOOL' ? 'School name' : level === 'INTERMEDIATE' ? 'College / school name' : 'College / university name'} required className="sm:col-span-2">
            <Input value={r.institutionName} onChange={(e) => upd(level, 'institutionName', e.target.value)} required disabled={locked} />
          </Field>
          <Field label={level === 'GRADUATION' ? 'University' : 'Board'} hint={level === 'HIGH_SCHOOL' ? 'CBSE / State Board / ICSE / etc.' : undefined}>
            <Input value={r.boardOrUniversity ?? ''} onChange={(e) => upd(level, 'boardOrUniversity', e.target.value)} disabled={locked} />
          </Field>
          {level === 'INTERMEDIATE' && (
            <Field label="Stream">
              <Select value={r.stream ?? ''} onChange={(e) => upd(level, 'stream', e.target.value)} disabled={locked}>
                <option value="">Select</option>
                {['Science', 'Commerce', 'Arts', 'Vocational'].map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
          )}
          {level === 'GRADUATION' && (
            <>
              <Field label="Degree" hint="B.A / B.Sc / B.Com / etc."><Input value={r.degree ?? ''} onChange={(e) => upd(level, 'degree', e.target.value)} disabled={locked} /></Field>
              <Field label="Major / specialisation"><Input value={r.major ?? ''} onChange={(e) => upd(level, 'major', e.target.value)} disabled={locked} /></Field>
            </>
          )}
          <Field label={level === 'GRADUATION' ? 'Year of passing / expected year' : 'Year of passing'}>
            <Input type="number" min={1990} max={2040} value={r.yearOfPassing ?? ''} onChange={(e) => upd(level, 'yearOfPassing', e.target.value)} disabled={locked} />
          </Field>
          <Field label="Result">
            <div className="flex gap-2">
              <Select className="w-36" value={r.scoreType ?? 'PERCENTAGE'} onChange={(e) => upd(level, 'scoreType', e.target.value)} disabled={locked}>
                <option value="PERCENTAGE">Percentage</option>
                <option value="GRADE">Grade</option>
                <option value="CGPA">CGPA</option>
              </Select>
              <Input value={r.scoreValue ?? ''} onChange={(e) => upd(level, 'scoreValue', e.target.value)} placeholder="e.g. 82" disabled={locked} />
            </div>
          </Field>
        </div>
        <FileUpload
          label={level === 'GRADUATION' ? 'Certificate / bonafide (optional)' : 'Certificate (optional)'}
          subType={level === 'HIGH_SCHOOL' ? 'MARKSHEET_10' : level === 'INTERMEDIATE' ? 'MARKSHEET_12' : 'GRADUATION_CERTIFICATE'}
          documentId={r.certificateDocumentId}
          onUploaded={(id) => upd(level, 'certificateDocumentId', id)}
          disabled={locked}
        />
      </Section>
    );
  };

  return (
    <form onSubmit={submit} className="space-y-8">
      {block('HIGH_SCHOOL', 'High school (10th)')}
      <Checkbox label="I have completed / am doing Intermediate (12th / Diploma)" checked={include.INTERMEDIATE} onChange={(e) => setInclude({ ...include, INTERMEDIATE: e.target.checked })} disabled={locked} />
      {include.INTERMEDIATE && block('INTERMEDIATE', 'Intermediate (12th / Diploma)')}
      <Checkbox label="I am doing / have completed Graduation" checked={include.GRADUATION} onChange={(e) => setInclude({ ...include, GRADUATION: e.target.checked })} disabled={locked} />
      {include.GRADUATION && block('GRADUATION', 'Graduation (if applicable)')}
      {!locked && <StepActions saving={saving} />}
    </form>
  );
}

// ------------------------------------------------------------------------ Step 3: Sports metrix
export function SportsStep({ profile, onSaved, locked }: { profile: AthleteProfile; onSaved: Save; locked: boolean }) {
  const toast = useToast();
  const s = profile.sports;
  const [f, setF] = useState<SportsProfile>({
    primarySport: s?.primarySport ?? '',
    currentClub: s?.currentClub ?? '',
    coachName: s?.coachName ?? '',
    coachContact: s?.coachContact ?? '',
    yearsOfTraining: s?.yearsOfTraining ?? undefined,
    heightCm: s?.heightCm ?? '',
    weightKg: s?.weightKg ?? '',
    wingspanCm: s?.wingspanCm ?? '',
    chestCm: s?.chestCm ?? '',
    waistCm: s?.waistCm ?? '',
    bodyFatPct: s?.bodyFatPct ?? '',
    fitnessLevel: s?.fitnessLevel ?? '',
    rankingLevel: s?.rankingLevel ?? '',
    rankingValue: s?.rankingValue ?? '',
    ageGroup: s?.ageGroup ?? '',
    bestPerformance: s?.bestPerformance ?? '',
    medalsGold: s?.medalsGold ?? 0,
    medalsSilver: s?.medalsSilver ?? 0,
    medalsBronze: s?.medalsBronze ?? 0,
    internationalParticipation: s?.internationalParticipation ?? false,
    internationalDetails: s?.internationalDetails ?? '',
    previousInjuries: s?.previousInjuries ?? false,
    injuryDetails: s?.injuryDetails ?? '',
    recoveryStatus: s?.recoveryStatus ?? '',
    medicalClearanceDocumentId: s?.medicalClearanceDocumentId ?? null,
    sportsIdDocumentId: s?.sportsIdDocumentId ?? null,
    coachCertificationDocumentId: s?.coachCertificationDocumentId ?? null,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof SportsProfile) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const num = (k: keyof SportsProfile) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value === '' ? '' : Number(e.target.value) });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '' && v !== null && v !== undefined));
      onSaved(await apiPut<MeResponse>('/athletes/me/sports', body));
      // Verification uploads also count as step-4 documents.
      const docs = [
        f.sportsIdDocumentId && { type: 'SPORTS_ID', documentId: f.sportsIdDocumentId },
        f.medicalClearanceDocumentId && { type: 'MEDICAL_CLEARANCE', documentId: f.medicalClearanceDocumentId },
        f.coachCertificationDocumentId && { type: 'COACH_CERTIFICATION', documentId: f.coachCertificationDocumentId },
      ].filter(Boolean);
      if (docs.length) onSaved(await apiPut<MeResponse>('/athletes/me/documents', { documents: docs }));
      toast.success('Sports metrics saved');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-8">
        <Section title="Primary sport profile">
          <Field label="Primary sport" required>
            <Select value={f.primarySport} onChange={set('primarySport')} required disabled={locked}>
              <option value="">Select sport</option>
              {SPORTS.map((x) => <option key={x}>{x}</option>)}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Current club / academy"><Input value={f.currentClub ?? ''} onChange={set('currentClub')} disabled={locked} /></Field>
            <Field label="Years of training / experience"><Input type="number" min={0} max={40} value={f.yearsOfTraining ?? ''} onChange={num('yearsOfTraining')} disabled={locked} /></Field>
            <Field label="Coach name"><Input value={f.coachName ?? ''} onChange={set('coachName')} disabled={locked} /></Field>
            <Field label="Coach contact"><Input value={f.coachContact ?? ''} onChange={set('coachContact')} disabled={locked} /></Field>
          </div>
        </Section>
        <Section title="Physical metrics">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Height (cm)"><Input type="number" step="0.1" value={f.heightCm ?? ''} onChange={num('heightCm')} disabled={locked} /></Field>
            <Field label="Weight (kg)"><Input type="number" step="0.1" value={f.weightKg ?? ''} onChange={num('weightKg')} disabled={locked} /></Field>
            <Field label="Wingspan (cm)"><Input type="number" step="0.1" value={f.wingspanCm ?? ''} onChange={num('wingspanCm')} disabled={locked} /></Field>
            <Field label="Chest (cm)"><Input type="number" step="0.1" value={f.chestCm ?? ''} onChange={num('chestCm')} disabled={locked} /></Field>
            <Field label="Waist (cm)"><Input type="number" step="0.1" value={f.waistCm ?? ''} onChange={num('waistCm')} disabled={locked} /></Field>
            <Field label="Body fat % (optional)"><Input type="number" step="0.1" value={f.bodyFatPct ?? ''} onChange={num('bodyFatPct')} disabled={locked} /></Field>
          </div>
          <Field label="Fitness level">
            <Select value={f.fitnessLevel ?? ''} onChange={set('fitnessLevel')} disabled={locked}>
              <option value="">Select</option>
              <option value="BEGINNER">Beginner</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="ELITE">Elite</option>
            </Select>
          </Field>
        </Section>
        <Section title="Competition & ranking">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Current ranking level">
              <Select value={f.rankingLevel ?? ''} onChange={set('rankingLevel')} disabled={locked}>
                <option value="">Select</option>
                <option value="NATIONAL">National</option>
                <option value="STATE">State</option>
                <option value="DISTRICT">District</option>
                <option value="NONE">Not ranked</option>
              </Select>
            </Field>
            <Field label="Ranking"><Input value={f.rankingValue ?? ''} onChange={set('rankingValue')} placeholder="e.g. 3" disabled={locked} /></Field>
            <Field label="Age group category">
              <Select value={f.ageGroup ?? ''} onChange={set('ageGroup')} disabled={locked}>
                <option value="">Select</option>
                <option value="U14">U14</option>
                <option value="U17">U17</option>
                <option value="U19">U19</option>
                <option value="SENIOR">Senior</option>
              </Select>
            </Field>
            <Field label="Best performance record"><Input value={f.bestPerformance ?? ''} onChange={set('bestPerformance')} placeholder="e.g. 400m — 49.8s" disabled={locked} /></Field>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Medal inventory till date</p>
            <div className="grid grid-cols-3 gap-4">
              <Field label="🥇 Gold"><Input type="number" min={0} value={f.medalsGold ?? 0} onChange={num('medalsGold')} disabled={locked} /></Field>
              <Field label="🥈 Silver"><Input type="number" min={0} value={f.medalsSilver ?? 0} onChange={num('medalsSilver')} disabled={locked} /></Field>
              <Field label="🥉 Bronze"><Input type="number" min={0} value={f.medalsBronze ?? 0} onChange={num('medalsBronze')} disabled={locked} /></Field>
            </div>
          </div>
          <Checkbox label="I have participated internationally" checked={!!f.internationalParticipation} onChange={(e) => setF({ ...f, internationalParticipation: e.target.checked })} disabled={locked} />
          {f.internationalParticipation && <Field label="International participation details"><Textarea value={f.internationalDetails ?? ''} onChange={set('internationalDetails')} disabled={locked} /></Field>}
        </Section>
      </div>
      <div className="space-y-8">
        <Section title="Injury / medical status">
          <Checkbox label="I have had previous injuries" checked={!!f.previousInjuries} onChange={(e) => setF({ ...f, previousInjuries: e.target.checked })} disabled={locked} />
          {f.previousInjuries && (
            <>
              <Field label="Injury details" required><Textarea value={f.injuryDetails ?? ''} onChange={set('injuryDetails')} required disabled={locked} /></Field>
              <Field label="Recovery status"><Input value={f.recoveryStatus ?? ''} onChange={set('recoveryStatus')} placeholder="Fully recovered / under rehab" disabled={locked} /></Field>
            </>
          )}
          <FileUpload label="Medical clearance (if required)" subType="MEDICAL_CLEARANCE" documentId={f.medicalClearanceDocumentId} onUploaded={(id) => setF((x) => ({ ...x, medicalClearanceDocumentId: id }))} disabled={locked} />
        </Section>
        <Section title="Verification">
          <FileUpload label="Sports ID / association ID" subType="SPORTS_ID" documentId={f.sportsIdDocumentId} onUploaded={(id) => setF((x) => ({ ...x, sportsIdDocumentId: id }))} disabled={locked} />
          <FileUpload label="Coach certification" subType="COACH_CERTIFICATION" documentId={f.coachCertificationDocumentId} onUploaded={(id) => setF((x) => ({ ...x, coachCertificationDocumentId: id }))} disabled={locked} />
        </Section>
        {!locked && <StepActions saving={saving} />}
      </div>
    </form>
  );
}

// ------------------------------------------------------------------------ Step 4: Documents & references
const DOC_GROUPS: { title: string; items: [string, string, boolean][] }[] = [
  {
    title: 'Mandatory documents',
    items: [
      ['PROFILE_PHOTO', 'Profile photo (passport size)', true],
      ['GOVT_ID', 'Government ID proof (Aadhaar / Passport / PAN / etc.)', true],
      ['DOB_PROOF', 'Date of birth proof (Birth certificate / SSC certificate)', true],
      ['ADDRESS_PROOF', 'Address proof (Aadhaar / Utility bill / etc.)', true],
    ],
  },
  {
    title: 'Sports-related documents',
    items: [
      ['SPORTS_ID', 'Sports ID / Federation card (if available)', false],
      ['PERFORMANCE_CERTIFICATE', 'Latest performance / sports achievement certificates', false],
      ['COACH_RECOMMENDATION', 'Coach recommendation letter', false],
      ['MEDICAL_FITNESS', 'Medical fitness certificate', false],
      ['INJURY_RECORDS', 'Injury / medical records (if applicable)', false],
      ['PLAYER_CONTRACT', 'Player contract (if part of club / academy)', false],
    ],
  },
  {
    title: 'Academic documents',
    items: [
      ['MARKSHEET_10', 'High school marksheet (10th)', false],
      ['MARKSHEET_12', 'Intermediate marksheet (12th)', false],
      ['GRADUATION_CERTIFICATE', 'Graduation certificate / bonafide (if applicable)', false],
      ['STUDENT_ID_CARD', 'Student ID card', false],
    ],
  },
];

const emptyRef = (position: number): Reference => ({ position, name: '', designation: 'COACH', organization: '', relationship: '', phone: '', email: '' });

export function DocumentsStep({ me, onSaved, locked }: { me: MeResponse; onSaved: Save; locked: boolean }) {
  const toast = useToast();
  const p = me.profile;
  const docs = Object.fromEntries(p.documents.map((d) => [d.type, d]));
  const refs = Object.fromEntries(p.references.map((r) => [r.position, r]));
  const [r1, setR1] = useState<Reference>(refs[1] ?? emptyRef(1));
  const [r2, setR2] = useState<Reference>(refs[2] ?? emptyRef(2));
  const [saving, setSaving] = useState(false);

  const attach = async (type: string, documentId: string) => {
    onSaved(await apiPut<MeResponse>('/athletes/me/documents', { documents: [{ type, documentId }] }));
  };

  const saveRefs = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const clean = (r: Reference) => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== '' && v !== null && v !== undefined));
      const list = [clean(r1), ...(r2.name ? [clean(r2)] : [])];
      onSaved(await apiPut<MeResponse>('/athletes/me/references', { references: list }));
      toast.success('References saved');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const refForm = (r: Reference, set: (r: Reference) => void, required: boolean) => (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Name" required={required}><Input value={r.name} onChange={(e) => set({ ...r, name: e.target.value })} required={required} disabled={locked} /></Field>
      <Field label="Designation / role" required={required}>
        <Select value={r.designation} onChange={(e) => set({ ...r, designation: e.target.value })} disabled={locked}>
          <option value="COACH">Coach</option>
          <option value="TRAINER">Trainer</option>
          <option value="TEACHER">Teacher</option>
          <option value="SPORTS_OFFICIAL">Sports official</option>
          <option value="OTHER">Other</option>
        </Select>
      </Field>
      <Field label="Organization / academy / institution" required={required}><Input value={r.organization} onChange={(e) => set({ ...r, organization: e.target.value })} required={required} disabled={locked} /></Field>
      <Field label="Relationship with athlete"><Input value={r.relationship ?? ''} onChange={(e) => set({ ...r, relationship: e.target.value })} disabled={locked} /></Field>
      <Field label="Contact number" required={required}><Input value={r.phone} onChange={(e) => set({ ...r, phone: e.target.value })} required={required} disabled={locked} /></Field>
      <Field label="Email address"><Input type="email" value={r.email ?? ''} onChange={(e) => set({ ...r, email: e.target.value })} disabled={locked} /></Field>
    </div>
  );

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="space-y-8">
        {DOC_GROUPS.map((g) => (
          <Section key={g.title} title={g.title}>
            <div className="space-y-2">
              {g.items.map(([type, label, required]) => (
                <FileUpload
                  key={type}
                  label={label}
                  subType={type}
                  required={required}
                  documentId={docs[type]?.documentId}
                  status={docs[type]?.verificationStatus}
                  onUploaded={(id) => attach(type, id)}
                  disabled={locked}
                />
              ))}
            </div>
          </Section>
        ))}
      </div>
      <form onSubmit={saveRefs} className="space-y-8">
        <Section title="Reference 1">{refForm(r1, setR1, true)}</Section>
        <Section title="Reference 2 (optional but recommended)">{refForm(r2, setR2, false)}</Section>
        {!locked && <StepActions saving={saving} label="Save references" />}
      </form>
    </div>
  );
}

function StepActions({ saving, label = 'Save & continue' }: { saving: boolean; label?: string }) {
  return (
    <div className="flex justify-end border-t border-slate-100 pt-5">
      <Button type="submit" loading={saving} size="lg">
        {label}
      </Button>
    </div>
  );
}
