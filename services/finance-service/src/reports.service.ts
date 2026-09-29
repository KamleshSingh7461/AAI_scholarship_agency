import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { convert, type Currency } from '@aci/contracts';
import { APP_CONFIG, InternalHttpClient, type AuthUser } from '@aci/nest-common';
import type { FinanceConfig } from './config';
import { PrismaService } from './prisma.service';
import type { Prisma } from './generated/prisma';

export const REPORTS = {
  SCHOLARSHIP_LIST: { title: 'Scholarship List', formats: ['xlsx', 'csv', 'pdf'] },
  ANNUAL_RENEWAL: { title: 'Annual Renewal Report', formats: ['pdf', 'xlsx', 'csv'] },
  REVENUE: { title: 'Revenue Report', formats: ['xlsx', 'csv'] },
  EXPENSE_SCHEDULE: { title: 'Expense Schedule', formats: ['xlsx', 'csv'] },
  UNIVERSITY_WISE: { title: 'University-wise Scholarships', formats: ['xlsx', 'pdf', 'csv'] },
} as const;
export type ReportType = keyof typeof REPORTS;
export type ReportFormat = 'xlsx' | 'csv' | 'pdf';

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  universityId?: string;
  sport?: string;
  durationYears?: number;
  status?: string;
}

interface Column {
  key: string;
  header: string;
  width?: number;
  money?: boolean;
}

const n = (v: bigint | number | null | undefined) => Number(v ?? 0);
const major = (minor: number) => Math.round(minor) / 100;
const d = (x: Date | null | undefined) => (x ? x.toISOString().slice(0, 10) : '');

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: FinanceConfig,
    private readonly prisma: PrismaService,
    private readonly http: InternalHttpClient,
  ) {}

  private awardWhere(f: ReportFilters): Prisma.AwardLedgerWhereInput {
    return {
      ...(f.universityId ? { universityId: f.universityId } : {}),
      ...(f.sport ? { sport: { equals: f.sport, mode: 'insensitive' } } : {}),
      ...(f.durationYears ? { durationYears: Number(f.durationYears) } : {}),
      ...(f.status ? { status: f.status } : {}),
      ...(f.dateFrom || f.dateTo
        ? { grantDate: { ...(f.dateFrom ? { gte: new Date(f.dateFrom) } : {}), ...(f.dateTo ? { lte: new Date(f.dateTo) } : {}) } }
        : {}),
    };
  }

  private async build(type: ReportType, f: ReportFilters): Promise<{ columns: Column[]; rows: Record<string, unknown>[] }> {
    if (type === 'SCHOLARSHIP_LIST') {
      const awards = await this.prisma.awardLedger.findMany({ where: this.awardWhere(f), orderBy: { grantDate: 'desc' } });
      return {
        columns: [
          { key: 'awardNo', header: 'Award No', width: 18 },
          { key: 'athleteName', header: 'Student', width: 24 },
          { key: 'athleteCode', header: 'Student ID', width: 12 },
          { key: 'whatsapp', header: 'WhatsApp #', width: 16 },
          { key: 'grantDate', header: 'Date Passed Out', width: 14 },
          { key: 'university', header: 'School', width: 28 },
          { key: 'sport', header: 'Sport', width: 14 },
          { key: 'type', header: 'Award', width: 9 },
          { key: 'tuition', header: 'Tuition / yr', money: true },
          { key: 'room', header: 'Room / yr', money: true },
          { key: 'food', header: 'Food / yr', money: true },
          { key: 'other', header: 'Other / yr', money: true },
          { key: 'total', header: 'Total Value', money: true },
          { key: 'currency', header: 'Cur', width: 6 },
          { key: 'totalInr', header: 'Total (INR)', money: true },
          { key: 'totalUsd', header: 'Total (USD)', money: true },
          { key: 'status', header: 'Status', width: 12 },
          { key: 'confirmation', header: 'Univ. Confirmation', width: 16 },
          { key: 'agency', header: 'Agency Agreement', width: 16 },
        ],
        rows: awards.map((a) => ({
          awardNo: a.awardNo,
          athleteName: a.athleteName,
          athleteCode: a.athleteCode,
          whatsapp: a.whatsappNumber ?? '',
          grantDate: d(a.grantDate),
          university: a.universityName,
          sport: a.sport ?? '',
          type: `${a.durationYears}-Year`,
          tuition: major(n(a.tuitionPerYear)),
          room: major(n(a.roomPerYear)),
          food: major(n(a.foodPerYear)),
          other: major(n(a.otherPerYear)),
          total: major(n(a.totalValue)),
          currency: a.currency,
          totalInr: major(convert(n(a.totalValue), a.currency as Currency, 'INR', a.usdInrRate4)),
          totalUsd: major(convert(n(a.totalValue), a.currency as Currency, 'USD', a.usdInrRate4)),
          status: a.status,
          confirmation: a.universityConfirmationStatus,
          agency: 'Signed',
        })),
      };
    }

    if (type === 'ANNUAL_RENEWAL' || type === 'EXPENSE_SCHEDULE') {
      const rows = await this.prisma.expenseSchedule.findMany({
        where: {
          award: this.awardWhere({ ...f, dateFrom: undefined, dateTo: undefined }),
          ...(f.dateFrom || f.dateTo ? { periodStart: { ...(f.dateFrom ? { gte: new Date(f.dateFrom) } : {}), ...(f.dateTo ? { lte: new Date(f.dateTo) } : {}) } } : {}),
          ...(type === 'ANNUAL_RENEWAL' ? { yearNumber: { gt: 1 } } : {}),
        },
        include: { award: true },
        orderBy: [{ periodStart: 'asc' }],
      });
      const today = new Date();
      if (type === 'ANNUAL_RENEWAL') {
        return {
          columns: [
            { key: 'awardNo', header: 'Award No', width: 18 },
            { key: 'athleteName', header: 'Student', width: 24 },
            { key: 'university', header: 'School', width: 28 },
            { key: 'year', header: 'Year', width: 8 },
            { key: 'due', header: 'Anniversary / Due', width: 16 },
            { key: 'status', header: 'Renewal Status', width: 16 },
            { key: 'renewedOn', header: 'Renewed On', width: 14 },
            { key: 'amount', header: 'Year Value', money: true },
            { key: 'currency', header: 'Cur', width: 6 },
          ],
          rows: rows.map((s) => ({
            awardNo: s.award.awardNo,
            athleteName: s.award.athleteName,
            university: s.award.universityName,
            year: `${s.yearNumber} of ${s.award.durationYears}`,
            due: d(s.periodStart),
            status: s.status === 'RECOGNIZED' ? 'Renewed' : s.status === 'CANCELLED' ? 'Cancelled' : s.periodStart < today ? 'Overdue / Suspended' : 'Upcoming',
            renewedOn: d(s.recognizedAt),
            amount: major(n(s.amount)),
            currency: s.currency,
          })),
        };
      }
      return {
        columns: [
          { key: 'awardNo', header: 'Award No', width: 18 },
          { key: 'athleteName', header: 'Student', width: 24 },
          { key: 'university', header: 'School', width: 28 },
          { key: 'year', header: 'Year', width: 8 },
          { key: 'periodStart', header: 'Period Start', width: 12 },
          { key: 'periodEnd', header: 'Period End', width: 12 },
          { key: 'fy', header: 'FY', width: 7 },
          { key: 'amount', header: 'Expense', money: true },
          { key: 'universityFunded', header: 'University-funded', money: true },
          { key: 'companyFunded', header: 'Company-funded', money: true },
          { key: 'currency', header: 'Cur', width: 6 },
          { key: 'amountInr', header: 'Expense (INR)', money: true },
          { key: 'amountUsd', header: 'Expense (USD)', money: true },
          { key: 'status', header: 'Status', width: 12 },
          { key: 'recognizedOn', header: 'Recognised On', width: 14 },
        ],
        rows: rows.map((s) => ({
          awardNo: s.award.awardNo,
          athleteName: s.award.athleteName,
          university: s.award.universityName,
          year: s.yearNumber,
          periodStart: d(s.periodStart),
          periodEnd: d(s.periodEnd),
          fy: s.fiscalYear,
          amount: major(n(s.amount)),
          universityFunded: major(n(s.universityFunded)),
          companyFunded: major(n(s.companyFunded)),
          currency: s.currency,
          amountInr: major(convert(n(s.amount), s.currency as Currency, 'INR', s.award.usdInrRate4)),
          amountUsd: major(convert(n(s.amount), s.currency as Currency, 'USD', s.award.usdInrRate4)),
          status: s.status,
          recognizedOn: d(s.recognizedAt),
        })),
      };
    }

    if (type === 'REVENUE') {
      const entries = await this.prisma.journalEntry.findMany({
        where: {
          type: { in: ['SCHOLARSHIP_GRANT', 'RATABLE_REVENUE', 'REVENUE_REVERSAL', 'COMMISSION', 'FEE_INCOME', 'FEE_REFUND'] },
          ...(f.universityId ? { universityId: f.universityId } : {}),
          ...(f.dateFrom || f.dateTo ? { entryDate: { ...(f.dateFrom ? { gte: new Date(f.dateFrom) } : {}), ...(f.dateTo ? { lte: new Date(f.dateTo) } : {}) } } : {}),
        },
        orderBy: { entryDate: 'asc' },
      });
      const awards = new Map((await this.prisma.awardLedger.findMany()).map((a) => [a.awardId, a]));
      const filtered = entries.filter((e) => {
        const a = e.awardId ? awards.get(e.awardId) : undefined;
        if (f.sport && (!a || (a.sport ?? '').toLowerCase() !== f.sport.toLowerCase())) return false;
        if (f.durationYears && (!a || a.durationYears !== Number(f.durationYears))) return false;
        return true;
      });
      return {
        columns: [
          { key: 'date', header: 'Date', width: 12 },
          { key: 'fy', header: 'FY', width: 7 },
          { key: 'entryNo', header: 'Entry No', width: 20 },
          { key: 'type', header: 'Type', width: 20 },
          { key: 'awardNo', header: 'Award', width: 18 },
          { key: 'university', header: 'School', width: 26 },
          { key: 'sport', header: 'Sport', width: 14 },
          { key: 'amount', header: 'Amount', money: true },
          { key: 'currency', header: 'Cur', width: 6 },
          { key: 'amountInr', header: 'INR', money: true },
          { key: 'amountUsd', header: 'USD', money: true },
          { key: 'memo', header: 'Memo', width: 50 },
        ],
        rows: filtered.map((e) => {
          const a = e.awardId ? awards.get(e.awardId) : undefined;
          const sign = ['REVENUE_REVERSAL', 'FEE_REFUND'].includes(e.type) ? -1 : 1;
          return {
            date: d(e.entryDate),
            fy: e.fiscalYear,
            entryNo: e.entryNo,
            type: e.type,
            awardNo: a?.awardNo ?? '',
            university: a?.universityName ?? '',
            sport: a?.sport ?? '',
            amount: sign * major(n(e.amount)),
            currency: e.currency,
            amountInr: sign * major(n(e.amountInr)),
            amountUsd: sign * major(n(e.amountUsd)),
            memo: e.memo ?? '',
          };
        }),
      };
    }

    // UNIVERSITY_WISE
    const awards = await this.prisma.awardLedger.findMany({ where: this.awardWhere(f), include: { schedule: true } });
    const m = new Map<string, any>();
    for (const a of awards) {
      const r = m.get(a.universityId) ?? { university: a.universityName, awards: 0, y4: 0, y3: 0, y2: 0, other: 0, valueInr: 0, valueUsd: 0, recognizedInr: 0, remainingInr: 0, confirmedInr: 0 };
      r.awards++;
      if (a.durationYears === 4) r.y4++;
      else if (a.durationYears === 3) r.y3++;
      else if (a.durationYears === 2) r.y2++;
      else r.other++;
      const inr = (x: number) => convert(x, a.currency as Currency, 'INR', a.usdInrRate4);
      r.valueInr += inr(n(a.totalValue));
      r.valueUsd += convert(n(a.totalValue), a.currency as Currency, 'USD', a.usdInrRate4);
      for (const s of a.schedule) {
        if (s.status === 'RECOGNIZED') r.recognizedInr += inr(n(s.amount));
        if (s.status === 'SCHEDULED') r.remainingInr += inr(n(s.amount));
      }
      if (a.universityConfirmationStatus === 'CONFIRMED') r.confirmedInr += inr(n(a.totalValue));
      m.set(a.universityId, r);
    }
    return {
      columns: [
        { key: 'university', header: 'School', width: 30 },
        { key: 'awards', header: 'Awards', width: 8 },
        { key: 'y4', header: '4-Year', width: 8 },
        { key: 'y3', header: '3-Year', width: 8 },
        { key: 'y2', header: '2-Year', width: 8 },
        { key: 'valueInr', header: 'Total Value (INR)', money: true },
        { key: 'valueUsd', header: 'Total Value (USD)', money: true },
        { key: 'recognizedInr', header: 'Delivered (INR)', money: true },
        { key: 'remainingInr', header: 'Remaining (INR)', money: true },
        { key: 'confirmedPct', header: '% Confirmed', width: 12 },
      ],
      rows: [...m.values()]
        .sort((a, b) => b.valueInr - a.valueInr)
        .map((r) => ({
          ...r,
          valueInr: major(r.valueInr),
          valueUsd: major(r.valueUsd),
          recognizedInr: major(r.recognizedInr),
          remainingInr: major(r.remainingInr),
          confirmedPct: r.valueInr ? `${Math.round((r.confirmedInr / r.valueInr) * 100)}%` : '0%',
        })),
    };
  }

  private csv(columns: Column[], rows: Record<string, unknown>[]): Buffer {
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      // Prevent CSV/formula injection when opened in Excel.
      const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
      return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    };
    const lines = [columns.map((c) => esc(c.header)).join(','), ...rows.map((r) => columns.map((c) => esc(r[c.key])).join(','))];
    return Buffer.from('﻿' + lines.join('\r\n'), 'utf8');
  }

  private async xlsx(title: string, columns: Column[], rows: Record<string, unknown>[], filters: ReportFilters): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = this.config.env.COMPANY_BRAND_NAME;
    wb.created = new Date();
    const ws = wb.addWorksheet(title.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? (c.money ? 15 : 14), style: c.money ? { numFmt: '#,##0.00' } : {} }));
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    rows.forEach((r) => ws.addRow(r));
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
    const meta = wb.addWorksheet('About');
    meta.addRows([
      ['Report', title],
      ['Generated', new Date().toISOString()],
      ['Filters', JSON.stringify(filters)],
      ['Rows', rows.length],
      ['Note', 'Amounts are in major currency units. INR/USD equivalents use the rate snapshotted when each scholarship was granted.'],
    ]);
    meta.getColumn(1).width = 14;
    meta.getColumn(2).width = 100;
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  private pdf(title: string, columns: Column[], rows: Record<string, unknown>[], filters: ReportFilters): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      const clean = (s: unknown) => String(s ?? '').replace(/[^\x20-\x7e]/g, '');
      doc.fontSize(15).font('Helvetica-Bold').text(`${this.config.env.COMPANY_BRAND_NAME} — ${title}`);
      doc.fontSize(8).font('Helvetica').fillColor('#555').text(`Generated ${new Date().toISOString()} · ${rows.length} rows · filters ${JSON.stringify(filters)}`);
      doc.moveDown(0.6).fillColor('#000');
      const usable = doc.page.width - 60;
      const totalW = columns.reduce((s, c) => s + (c.width ?? (c.money ? 15 : 14)), 0);
      const widths = columns.map((c) => ((c.width ?? (c.money ? 15 : 14)) / totalW) * usable);
      const drawRow = (vals: string[], bold = false) => {
        const y = doc.y;
        if (y > doc.page.height - 50) doc.addPage();
        const top = doc.y;
        let x = 30;
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7);
        let maxH = 0;
        vals.forEach((v, i) => {
          const h = doc.heightOfString(v, { width: widths[i] - 4 });
          maxH = Math.max(maxH, h);
          doc.text(v, x + 2, top, { width: widths[i] - 4, align: columns[i].money ? 'right' : 'left' });
          x += widths[i];
        });
        doc.y = top + maxH + 4;
        doc.moveTo(30, doc.y - 2).lineTo(30 + usable, doc.y - 2).lineWidth(0.3).strokeColor('#ddd').stroke();
      };
      drawRow(columns.map((c) => c.header), true);
      for (const r of rows) {
        drawRow(columns.map((c) => (c.money && typeof r[c.key] === 'number' ? (r[c.key] as number).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : clean(r[c.key]))));
      }
      doc.end();
    });
  }

  async generate(type: ReportType, format: ReportFormat, filters: ReportFilters, actor: AuthUser) {
    const def = REPORTS[type];
    if (!def) throw new BadRequestException({ message: 'Unknown report', code: 'UNKNOWN_REPORT' });
    if (!(def.formats as readonly string[]).includes(format)) throw new BadRequestException({ message: `${def.title} is available as ${def.formats.join(', ')}`, code: 'FORMAT' });

    const run = await this.prisma.reportRun.create({
      data: { reportType: type, format, filters: filters as any, generatedById: actor.id, generatedByName: actor.name ?? actor.phone },
    });
    try {
      const { columns, rows } = await this.build(type, filters);
      const body = format === 'csv' ? this.csv(columns, rows) : format === 'xlsx' ? await this.xlsx(def.title, columns, rows, filters) : await this.pdf(def.title, columns, rows, filters);
      const stamp = new Date().toISOString().slice(0, 10);
      const fileName = `${type.toLowerCase()}_${stamp}.${format}`;
      const mimeType = format === 'csv' ? 'text/csv' : format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf';
      const doc = await this.http.post<{ id: string }>(
        'document',
        '/internal/documents',
        { category: 'REPORT', subType: type, fileName, mimeType, contentBase64: body.toString('base64'), sourceService: 'finance' },
        { timeoutMs: 60_000 },
      );
      return this.prisma.reportRun.update({ where: { id: run.id }, data: { status: 'READY', documentId: doc.id, fileName, rowCount: rows.length } });
    } catch (err) {
      this.logger.error(`Report ${type} failed: ${(err as Error).message}`);
      return this.prisma.reportRun.update({ where: { id: run.id }, data: { status: 'FAILED', error: (err as Error).message.slice(0, 500) } });
    }
  }
}
