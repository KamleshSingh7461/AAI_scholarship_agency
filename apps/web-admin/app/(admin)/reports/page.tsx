'use client';
import { useState } from 'react';
import { Download, FileBarChart } from 'lucide-react';
import { api, apiPost, dateTime } from '@aci/web-shared';
import { useApi } from '@aci/web-shared/hooks';
import { Button, Card, Field, Input, PageHeader, PageLoader, Select, StatusBadge, Table, Td, Th, useToast } from '@aci/web-shared/ui';
import type { Paged, University } from '@/lib/types';

const DESCRIPTIONS: Record<string, string> = {
  SCHOLARSHIP_LIST: 'Full roster with student, school, sport, type and value',
  ANNUAL_RENEWAL: 'Renewal status by student, due dates and history',
  REVENUE: 'Revenue booked by period, university and sport',
  EXPENSE_SCHEDULE: 'Year-by-year expense recognition across all awards',
  UNIVERSITY_WISE: 'Scholarship value and count grouped by university',
};

interface Run {
  id: string;
  reportType: string;
  format: string;
  status: string;
  fileName: string | null;
  rowCount: number | null;
  error: string | null;
  generatedByName: string | null;
  createdAt: string;
}

export default function ReportsPage() {
  const toast = useToast();
  const { data: catalog } = useApi<{ type: string; title: string; formats: string[] }[]>('/reports/catalog');
  const { data: runs, mutate } = useApi<Paged<Run>>('/reports', { pageSize: 20 });
  const { data: unis } = useApi<Paged<University>>('/universities', { pageSize: 100 });
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', universityId: '', sport: '', durationYears: '', status: '' });
  const [formats, setFormats] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const generate = async (type: string, format: string) => {
    setBusy(type);
    try {
      const f = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '').map(([k, v]) => [k, k === 'durationYears' ? Number(v) : v]));
      const run = await apiPost<Run>('/reports/generate', { type, format, filters: f });
      if (run.status === 'READY') {
        toast.success(`${run.fileName} ready (${run.rowCount} rows)`);
        await download(run.id);
      } else toast.error(run.error ?? 'Report failed');
      void mutate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const download = async (id: string) => {
    const r = await api<{ url: string }>(`/reports/${id}/download`);
    window.open(r.url, '_blank', 'noopener');
  };

  if (!catalog) return <PageLoader />;
  return (
    <div className="space-y-6">
      <PageHeader title="Reports you can download" breadcrumb="Home / Reports" subtitle="Pick your filters, then press Generate on any report to create a file you can save or print." />
      <Card>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="From"><Input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} /></Field>
          <Field label="To"><Input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} /></Field>
          <Field label="School">
            <Select value={filters.universityId} onChange={(e) => setFilters({ ...filters, universityId: e.target.value })}>
              <option value="">All</option>
              {unis?.items.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
          <Field label="Sport"><Input value={filters.sport} onChange={(e) => setFilters({ ...filters, sport: e.target.value })} placeholder="All" /></Field>
          <Field label="Type">
            <Select value={filters.durationYears} onChange={(e) => setFilters({ ...filters, durationYears: e.target.value })}>
              <option value="">All</option>
              <option value="4">4-Year</option>
              <option value="3">3-Year</option>
              <option value="2">2-Year</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All</option>
              {['ACTIVE', 'RENEWAL_DUE', 'SUSPENDED', 'COMPLETED', 'REVOKED'].map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {catalog.map((r) => (
          <Card key={r.type}>
            <FileBarChart className="size-6 text-brand-600" />
            <h3 className="mt-3 font-bold text-slate-900">{r.title}</h3>
            <p className="mt-1 text-sm text-slate-500">{DESCRIPTIONS[r.type]}</p>
            <div className="mt-4 flex items-center gap-2">
              <Select className="w-24" value={formats[r.type] ?? r.formats[0]} onChange={(e) => setFormats({ ...formats, [r.type]: e.target.value })}>
                {r.formats.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
              </Select>
              <Button loading={busy === r.type} onClick={() => generate(r.type, formats[r.type] ?? r.formats[0])}>Generate</Button>
            </div>
          </Card>
        ))}
      </div>
      <Card title="Generated files" padded={false}>
        <Table>
          <thead>
            <tr>
              <Th>File</Th>
              <Th>Generated by</Th>
              <Th>Date</Th>
              <Th>Rows</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {runs?.items.map((r) => (
              <tr key={r.id}>
                <Td className="font-mono text-xs">{r.fileName ?? r.reportType}</Td>
                <Td>{r.generatedByName}</Td>
                <Td>{dateTime(r.createdAt)}</Td>
                <Td>{r.rowCount ?? '—'}</Td>
                <Td><StatusBadge status={r.status} /></Td>
                <Td>
                  {r.status === 'READY' && (
                    <Button size="sm" variant="secondary" icon={<Download className="size-4" />} onClick={() => download(r.id)}>
                      Download
                    </Button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
