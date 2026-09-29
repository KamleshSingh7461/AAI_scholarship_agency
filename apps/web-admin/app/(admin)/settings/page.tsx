'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { AGREEMENT_LABEL, apiPatch, apiPost, api, dateTime, relative, statusLabel } from '@aci/web-shared';
import { useAuth } from '@aci/web-shared/auth';
import { useApi } from '@aci/web-shared/hooks';
import { Alert, Badge, Button, Card, Checkbox, Field, Input, Modal, PageHeader, PageLoader, Select, StatusBadge, Table, Tabs, Td, Textarea, Th, useToast } from '@aci/web-shared/ui';
import type { Paged, University } from '@/lib/types';

type Tab = 'users' | 'notifications' | 'agreements' | 'system';

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('users');
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" breadcrumb="Home / Settings" />
      <Tabs
        tabs={[
          { value: 'users' as const, label: 'Staff & roles' },
          { value: 'notifications' as const, label: 'WhatsApp / SMS / email templates' },
          { value: 'agreements' as const, label: 'Agreement templates' },
          { value: 'system' as const, label: 'FX rate & system' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'users' && <UsersTab />}
      {tab === 'notifications' && <NotificationsTab />}
      {tab === 'agreements' && <AgreementsTab />}
      {tab === 'system' && <SystemTab />}
    </div>
  );
}

interface StaffUser {
  id: string;
  phone: string;
  email: string | null;
  fullName: string | null;
  role: string;
  status: string;
  universityId: string | null;
  lastLoginAt: string | null;
}

const ROLE_HELP: Record<string, string> = {
  SUPER_ADMIN: 'Everything, including creating admins',
  ADMIN: 'Operate the platform: universities, programs, applications, awards',
  FINANCE: 'Money & Value, payments, refunds, disbursements, reports',
  REVIEWER: 'Verify athletes and review applications',
  UNIVERSITY_REP: 'University staff: see their candidates and record approvals',
};

function UsersTab() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [role, setRole] = useState('');
  const { data, mutate } = useApi<Paged<StaffUser>>('/auth/users', { role: role || undefined, pageSize: 100 });
  const { data: unis } = useApi<Paged<University>>('/universities', { pageSize: 100 });
  const [form, setForm] = useState<null | { id?: string; phone: string; fullName: string; email: string; role: string; universityId: string; status?: string }>(null);

  const save = async () => {
    if (!form) return;
    try {
      const body = { fullName: form.fullName, email: form.email || undefined, role: form.role, universityId: form.universityId || undefined, status: form.status };
      if (form.id) await apiPatch(`/auth/users/${form.id}`, body);
      else await apiPost('/auth/users', { ...body, phone: form.phone });
      toast.success('Saved');
      setForm(null);
      void mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const staff = data?.items.filter((u) => u.role !== 'ATHLETE') ?? [];
  return (
    <Card
      title="Staff users"
      subtitle="Staff log in with an OTP to their registered mobile number. Disabling a user or changing their role signs them out everywhere."
      actions={
        <>
          <Select className="w-44" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            {Object.keys(ROLE_HELP).map((r) => <option key={r} value={r}>{statusLabel(r)}</option>)}
          </Select>
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setForm({ phone: '', fullName: '', email: '', role: 'REVIEWER', universityId: '' })}>Add staff</Button>
        </>
      }
      padded={false}
    >
      {!data ? (
        <PageLoader />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Phone</Th>
              <Th>Role</Th>
              <Th>University</Th>
              <Th>Last login</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staff.map((u) => (
              <tr key={u.id}>
                <Td className="font-medium text-slate-900">{u.fullName}<span className="block text-xs text-slate-500">{u.email}</span></Td>
                <Td>{u.phone}</Td>
                <Td><Badge tone={u.role === 'SUPER_ADMIN' ? 'red' : u.role === 'ADMIN' ? 'violet' : 'blue'}>{statusLabel(u.role)}</Badge></Td>
                <Td className="text-xs">{unis?.items.find((x) => x.id === u.universityId)?.name ?? '—'}</Td>
                <Td className="text-xs">{relative(u.lastLoginAt)}</Td>
                <Td><StatusBadge status={u.status} /></Td>
                <Td>
                  {u.id !== me?.id && (
                    <Button size="sm" variant="ghost" onClick={() => setForm({ id: u.id, phone: u.phone, fullName: u.fullName ?? '', email: u.email ?? '', role: u.role, universityId: u.universityId ?? '', status: u.status })}>
                      Edit
                    </Button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Edit staff user' : 'Add staff user'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </>
        }
      >
        {form && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mobile number" required hint="They log in with an OTP to this number"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={!!form.id} /></Field>
            <Field label="Full name" required><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
            <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Role" hint={ROLE_HELP[form.role]}>
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {Object.keys(ROLE_HELP).map((r) => <option key={r} value={r}>{statusLabel(r)}</option>)}
              </Select>
            </Field>
            {form.role === 'UNIVERSITY_REP' && (
              <Field label="University" required className="sm:col-span-2">
                <Select value={form.universityId} onChange={(e) => setForm({ ...form, universityId: e.target.value })}>
                  <option value="">Select</option>
                  {unis?.items.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </Select>
              </Field>
            )}
            {form.id && (
              <Field label="Status">
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="ACTIVE">Active</option>
                  <option value="DISABLED">Disabled</option>
                </Select>
              </Field>
            )}
          </div>
        )}
      </Modal>
    </Card>
  );
}

interface Template {
  id: string;
  key: string;
  channel: string;
  subject: string | null;
  body: string;
  providerTemplate: string | null;
  dltTemplateId: string | null;
  active: boolean;
  updatedAt: string;
}

function NotificationsTab() {
  const toast = useToast();
  const { data, mutate } = useApi<Template[]>('/notifications/templates');
  const [edit, setEdit] = useState<Template | null>(null);
  const save = async () => {
    if (!edit) return;
    try {
      await api(`/notifications/templates/${edit.id}`, { method: 'PUT', body: { subject: edit.subject ?? undefined, body: edit.body, providerTemplate: edit.providerTemplate ?? undefined, dltTemplateId: edit.dltTemplateId ?? undefined, active: edit.active } });
      toast.success('Template saved');
      setEdit(null);
      void mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  if (!data) return <PageLoader />;
  return (
    <Card
      title="Message templates"
      subtitle="Use {{name}}, {{studentPortalUrl}}, {{applicationNo}}… WhatsApp business messages need a Meta-approved template name; Indian SMS needs a DLT template id."
      padded={false}
    >
      <Table>
        <thead>
          <tr>
            <Th>Event</Th>
            <Th>Channel</Th>
            <Th>Message</Th>
            <Th>Provider template</Th>
            <Th />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((t) => (
            <tr key={t.id}>
              <Td className="font-mono text-xs">{t.key}</Td>
              <Td><Badge tone={t.channel === 'WHATSAPP' ? 'green' : t.channel === 'SMS' ? 'blue' : 'violet'}>{t.channel}</Badge>{!t.active && <Badge className="ml-1">off</Badge>}</Td>
              <Td className="max-w-md text-xs text-slate-600">{t.subject && <strong className="block">{t.subject}</strong>}{t.body.slice(0, 160)}{t.body.length > 160 ? '…' : ''}</Td>
              <Td className="text-xs">{t.providerTemplate ?? t.dltTemplateId ?? '—'}</Td>
              <Td><Button size="sm" variant="ghost" onClick={() => setEdit(t)}>Edit</Button></Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={`${edit?.key} · ${edit?.channel}`} size="lg" footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}>Save</Button></>}>
        {edit && (
          <div className="space-y-4">
            {edit.channel === 'EMAIL' && <Field label="Subject"><Input value={edit.subject ?? ''} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} /></Field>}
            <Field label="Message"><Textarea className="min-h-40 font-mono text-xs" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></Field>
            {edit.channel === 'WHATSAPP' && <Field label="Meta template name" hint="Approved template with one {{1}} body parameter; the rendered message fills it"><Input value={edit.providerTemplate ?? ''} onChange={(e) => setEdit({ ...edit, providerTemplate: e.target.value })} /></Field>}
            {edit.channel === 'SMS' && <Field label="DLT template id / MSG91 flow id"><Input value={edit.dltTemplateId ?? ''} onChange={(e) => setEdit({ ...edit, dltTemplateId: e.target.value })} /></Field>}
            <Checkbox checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} label="Active" />
          </div>
        )}
      </Modal>
    </Card>
  );
}

interface AgreementTemplate {
  id: string;
  type: string;
  version: number;
  title: string;
  body: string;
  active: boolean;
  createdAt: string;
  _count: { envelopes: number };
}

function AgreementsTab() {
  const toast = useToast();
  const { data, mutate } = useApi<AgreementTemplate[]>('/esign/templates');
  const [edit, setEdit] = useState<{ type: string; title: string; body: string; activate: boolean } | null>(null);
  const create = async () => {
    try {
      await apiPost('/esign/templates', edit);
      toast.success('New version saved');
      setEdit(null);
      void mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const activate = async (id: string) => {
    try {
      await apiPost(`/esign/templates/${id}/activate`);
      void mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  if (!data) return <PageLoader />;
  return (
    <Card title="Agreement templates" subtitle="Legal text is versioned: every signed envelope records the exact version signed. Editing creates a new version." padded={false}>
      <Alert tone="warning" className="m-5">The seeded texts are drafts. Replace them with counsel-approved agreements before going live.</Alert>
      <Table>
        <thead>
          <tr>
            <Th>Agreement</Th>
            <Th>Version</Th>
            <Th>Title</Th>
            <Th>Created</Th>
            <Th className="text-right">Envelopes</Th>
            <Th />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((t) => (
            <tr key={t.id}>
              <Td className="font-medium">{AGREEMENT_LABEL[t.type] ?? t.type}</Td>
              <Td>v{t.version} {t.active && <Badge tone="green">active</Badge>}</Td>
              <Td className="text-xs">{t.title}</Td>
              <Td className="text-xs">{dateTime(t.createdAt)}</Td>
              <Td className="text-right">{t._count.envelopes}</Td>
              <Td className="whitespace-nowrap text-right">
                <Button size="sm" variant="ghost" onClick={() => setEdit({ type: t.type, title: t.title, body: t.body, activate: true })}>New version</Button>
                {!t.active && <Button size="sm" variant="ghost" onClick={() => activate(t.id)}>Activate</Button>}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={`New version — ${edit ? AGREEMENT_LABEL[edit.type] : ''}`} size="xl" footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={create}>Save version</Button></>}>
        {edit && (
          <div className="space-y-4">
            <Field label="Title"><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            <Field label="Body" hint="# Heading · ## Section · - bullet · blank line = paragraph · merge fields like {{athleteName}}, {{universityName}}, {{totalValue}}, {{commissionPct}}, {{yearNumber}}">
              <Textarea className="min-h-[420px] font-mono text-xs" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
            </Field>
            <Checkbox checked={edit.activate} onChange={(e) => setEdit({ ...edit, activate: e.target.checked })} label="Make this the active version for new envelopes" />
          </div>
        )}
      </Modal>
    </Card>
  );
}

function SystemTab() {
  const toast = useToast();
  const { user } = useAuth();
  const { data: fx, mutate } = useApi<{ latest: { rate: number; effectiveDate: string | null; source: string }; history: { id: string; rate: number; effectiveDate: string; source: string }[] }>('/finance/fx');
  const [rate, setRate] = useState('');
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const saveRate = async () => {
    try {
      await apiPost('/finance/fx', { rate: Number(rate) });
      toast.success('Rate saved — used for new scholarships and INR display of USD programs');
      setRate('');
      void mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const runLifecycle = async () => {
    try {
      setReport(await apiPost('/awards/lifecycle/run'));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="USD → INR exchange rate" subtitle="Each scholarship snapshots the rate on the day it is granted; changing it never restates history.">
        {fx ? (
          <>
            <p className="text-3xl font-bold">₹{fx.latest.rate.toFixed(4)} <span className="text-sm font-normal text-slate-500">per $1 · {fx.latest.source.toLowerCase()}</span></p>
            <div className="mt-4 flex gap-2">
              <Input type="number" step="0.0001" placeholder="e.g. 83.25" value={rate} onChange={(e) => setRate(e.target.value)} />
              <Button disabled={!rate} onClick={saveRate}>Set today’s rate</Button>
            </div>
            <ul className="mt-4 space-y-1 text-xs text-slate-500">
              {fx.history.slice(0, 8).map((h) => <li key={h.id}>{h.effectiveDate.slice(0, 10)} · ₹{h.rate.toFixed(4)} · {h.source.toLowerCase()}</li>)}
            </ul>
          </>
        ) : (
          <PageLoader />
        )}
      </Card>
      {user?.role === 'SUPER_ADMIN' && (
        <Card title="Scholarship lifecycle job" subtitle="Runs daily at 09:00 IST: renewal reminders, renewal forms, overdue → suspended, expired offers, retries.">
          <Button variant="secondary" onClick={runLifecycle}>Run now</Button>
          {report && <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">{JSON.stringify(report, null, 2)}</pre>}
        </Card>
      )}
    </div>
  );
}
