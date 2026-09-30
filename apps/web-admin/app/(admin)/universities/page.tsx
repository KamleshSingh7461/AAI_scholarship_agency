'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiPost } from '@aci/web-shared';
import { useAuth } from '@aci/web-shared/auth';
import { useApi } from '@aci/web-shared/hooks';
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, PageLoader, StatusBadge, Table, Td, Textarea, Th, useToast } from '@aci/web-shared/ui';
import type { Paged, University } from '@/lib/types';

export default function UniversitiesPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', shortName: '', city: '', state: '', website: '', contactName: '', contactEmail: '', contactPhone: '', description: '' });
  const { data } = useApi<Paged<University>>('/universities', { q, pageSize: 100 });
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role ?? '');

  const create = async () => {
    try {
      const body = Object.fromEntries(Object.entries(f).filter(([, v]) => v));
      const u = await apiPost<University>('/universities', body);
      toast.success('University created');
      router.push(`/universities/${u.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Partner universities"
        breadcrumb="Home / Universities"
        subtitle="Universities, their MoUs, the scholarship rights they transfer each year, and the programs built on them."
        actions={isAdmin && <Button onClick={() => setOpen(true)}>Add university</Button>}
      />
      <Card padded={false}>
        <div className="border-b border-slate-100 p-4">
          <label className="relative block max-w-md">
            <Input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
        {!data ? (
          <PageLoader />
        ) : data.items.length === 0 ? (
          <div className="p-6"><EmptyState title="No universities yet" /></div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>University</Th>
                <Th>Location</Th>
                <Th>Contact</Th>
                <Th className="text-right">Programs</Th>
                <Th className="text-right">Agreements</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <Td>
                    <Link href={`/universities/${u.id}`} className="font-semibold text-slate-900 hover:text-brand-700">{u.name}</Link>
                  </Td>
                  <Td>{[u.city, u.state].filter(Boolean).join(', ')}</Td>
                  <Td className="text-xs">{[u.contactName, u.contactEmail].filter(Boolean).join(' · ')}</Td>
                  <Td className="text-right">{u._count?.programs ?? 0}</Td>
                  <Td className="text-right">{u._count?.agreements ?? 0}</Td>
                  <Td><StatusBadge status={u.status} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add university"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={f.name.length < 2} onClick={create}>Create</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" required className="sm:col-span-2"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="IES University, Bhopal" /></Field>
          <Field label="Short name"><Input value={f.shortName} onChange={(e) => setF({ ...f, shortName: e.target.value })} placeholder="IES" /></Field>
          <Field label="Website"><Input value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} placeholder="https://" /></Field>
          <Field label="City"><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
          <Field label="State"><Input value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} /></Field>
          <Field label="Contact person"><Input value={f.contactName} onChange={(e) => setF({ ...f, contactName: e.target.value })} placeholder="Registrar" /></Field>
          <Field label="Contact email"><Input value={f.contactEmail} onChange={(e) => setF({ ...f, contactEmail: e.target.value })} /></Field>
          <Field label="Contact phone"><Input value={f.contactPhone} onChange={(e) => setF({ ...f, contactPhone: e.target.value })} /></Field>
          <Field label="Description" className="sm:col-span-2"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
