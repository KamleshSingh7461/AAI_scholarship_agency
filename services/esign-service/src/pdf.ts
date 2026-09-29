import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';

const A4 = { w: 595.28, h: 841.89 };
const M = 56;

/** Standard PDF fonts only support WinAnsi; map common Unicode to safe equivalents. */
export function winAnsi(s: string): string {
  return s
    .replace(/₹/g, 'Rs. ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[•·]/g, '-')
    .replace(/ /g, ' ')
    .replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff]/g, '');
}

export function renderText(template: string, fields: Record<string, string | number>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (fields[k] === undefined ? '' : String(fields[k])));
}

/** Where each signature/date line was drawn, so the in-app signer can stamp exactly there. */
export interface SignatureAnchor {
  anchor: 1 | 2 | 3;
  pageIndex: number;
  sigX: number;
  dateX: number;
  lineY: number;
}

class Writer {
  page!: PDFPage;
  pageIndex = -1;
  y = 0;
  constructor(
    readonly doc: PDFDocument,
    readonly fonts: { regular: PDFFont; bold: PDFFont; italic: PDFFont },
    readonly footer: string,
  ) {
    this.newPage();
  }
  newPage() {
    this.page = this.doc.addPage([A4.w, A4.h]);
    this.pageIndex++;
    this.y = A4.h - M;
    this.page.drawText(winAnsi(this.footer), { x: M, y: 28, size: 7.5, font: this.fonts.regular, color: rgb(0.45, 0.45, 0.5) });
  }
  ensure(h: number) {
    if (this.y - h < M + 10) this.newPage();
  }
  wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const words = winAnsi(text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > width && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }
  para(text: string, opts: { font?: PDFFont; size?: number; indent?: number; gap?: number } = {}) {
    const font = opts.font ?? this.fonts.regular;
    const size = opts.size ?? 10.5;
    const indent = opts.indent ?? 0;
    const lh = size * 1.45;
    for (const l of this.wrap(text, font, size, A4.w - 2 * M - indent)) {
      this.ensure(lh);
      this.page.drawText(l, { x: M + indent, y: this.y - size, size, font, color: rgb(0.1, 0.1, 0.12) });
      this.y -= lh;
    }
    this.y -= opts.gap ?? 6;
  }
}

export interface SignatureBlock {
  signerName: string;
  guardianName?: string | null;
  companyName: string;
  companySignatory?: string | null;
}

/**
 * Renders agreement text to PDF. Invisible anchor strings (/sig1/, /date1/, /sig2/ ...) mark where
 * DocuSign places its tabs; the returned anchors let the in-app signer stamp at the same spot.
 */
export async function renderAgreementPdf(
  title: string,
  body: string,
  footer: string,
  sig: SignatureBlock,
): Promise<{ bytes: Uint8Array; anchors: SignatureAnchor[] }> {
  const doc = await PDFDocument.create();
  doc.setTitle(winAnsi(title));
  doc.setProducer('Alumni Connect India');
  doc.setCreationDate(new Date());
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  const w = new Writer(doc, fonts, footer);

  for (const block of body.split(/\n\s*\n/)) {
    for (const raw of block.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith('# ')) w.para(line.slice(2), { font: fonts.bold, size: 17, gap: 10 });
      else if (line.startsWith('## ')) {
        w.y -= 4;
        w.para(line.slice(3), { font: fonts.bold, size: 12, gap: 4 });
      } else if (line.startsWith('- ')) w.para(`-  ${line.slice(2)}`, { indent: 12, gap: 2 });
      else w.para(line);
    }
    w.y -= 4;
  }

  const anchors: SignatureAnchor[] = [];
  const block = (label: string, name: string, anchor: 1 | 2 | 3) => {
    w.ensure(100);
    w.y -= 18;
    w.para(label, { font: fonts.bold, size: 10 });
    const lineY = w.y - 34;
    const white = rgb(1, 1, 1);
    // Anchors drawn in white: invisible to readers, found by DocuSign's anchor search.
    w.page.drawText(`/sig${anchor}/`, { x: M, y: lineY + 12, size: 8, font: fonts.regular, color: white });
    w.page.drawText(`/date${anchor}/`, { x: M + 300, y: lineY + 12, size: 8, font: fonts.regular, color: white });
    w.page.drawLine({ start: { x: M, y: lineY }, end: { x: M + 230, y: lineY }, thickness: 0.6, color: rgb(0.3, 0.3, 0.3) });
    w.page.drawLine({ start: { x: M + 300, y: lineY }, end: { x: M + 440, y: lineY }, thickness: 0.6, color: rgb(0.3, 0.3, 0.3) });
    w.page.drawText(winAnsi(name), { x: M, y: lineY - 12, size: 9, font: fonts.regular });
    w.page.drawText('Date', { x: M + 300, y: lineY - 12, size: 9, font: fonts.regular });
    anchors.push({ anchor, pageIndex: w.pageIndex, sigX: M + 4, dateX: M + 304, lineY });
    w.y = lineY - 26;
  };
  block('Signed by the Athlete', sig.signerName, 1);
  if (sig.guardianName) block('Signed by the Parent / Guardian (the athlete is a minor)', sig.guardianName, 2);
  if (sig.companySignatory) block(`For and on behalf of ${sig.companyName}`, sig.companySignatory, 3);

  return { bytes: await doc.save(), anchors };
}

export interface AuditInfo {
  envelopeId: string;
  title: string;
  templateVersion: number;
  documentSha256: string;
  signerName: string;
  signerEmail: string;
  signerPhone?: string | null;
  typedSignature: string;
  guardianName?: string | null;
  guardianTypedSignature?: string | null;
  signedAt: Date;
  ip?: string | null;
  userAgent?: string | null;
  events: { event: string; at: Date; ip?: string | null }[];
}

/**
 * In-app (mock) signing: stamps typed signatures and dates on the signature lines and appends a
 * certificate page recording who signed, when, from where, and the hash of the exact document.
 */
export async function stampSignature(unsigned: Uint8Array, anchors: SignatureAnchor[], audit: AuditInfo): Promise<Uint8Array> {
  const doc = await PDFDocument.load(unsigned);
  const italic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const date = audit.signedAt.toISOString().slice(0, 10);
  const blue = rgb(0.05, 0.2, 0.55);

  const stamp = (a: SignatureAnchor | undefined, text: string | null | undefined) => {
    if (!a || !text) return;
    const page = doc.getPage(a.pageIndex);
    page.drawText(winAnsi(text), { x: a.sigX, y: a.lineY + 4, size: 17, font: italic, color: blue });
    page.drawText(date, { x: a.dateX, y: a.lineY + 5, size: 10, font: regular, color: blue });
  };
  stamp(anchors.find((a) => a.anchor === 1), audit.typedSignature);
  stamp(anchors.find((a) => a.anchor === 2), audit.guardianTypedSignature);

  const cert = doc.addPage([A4.w, A4.h]);
  let y = A4.h - M;
  const line = (t: string, f = regular, size = 10) => {
    cert.drawText(winAnsi(t), { x: M, y, size, font: f, color: rgb(0.1, 0.1, 0.12) });
    y -= size * 1.7;
  };
  line('Certificate of Electronic Signature', bold, 16);
  y -= 6;
  line(`Document: ${audit.title} (template version ${audit.templateVersion})`);
  line(`Envelope ID: ${audit.envelopeId}`);
  line(`SHA-256 of document presented for signature:`, regular, 9);
  line(audit.documentSha256, regular, 8);
  y -= 8;
  line('Signer', bold, 12);
  line(`Name: ${audit.signerName}`);
  line(`Email: ${audit.signerEmail}`);
  if (audit.signerPhone) line(`Mobile (verified by OTP at login): ${audit.signerPhone}`);
  line(`Signature adopted (typed): ${audit.typedSignature}`);
  if (audit.guardianTypedSignature) line(`Parent/guardian ${audit.guardianName ?? ''} signed (typed): ${audit.guardianTypedSignature}`);
  line(`Signed at (UTC): ${audit.signedAt.toISOString()}`);
  if (audit.ip) line(`IP address: ${audit.ip}`);
  if (audit.userAgent) line(`Device: ${audit.userAgent.slice(0, 95)}`, regular, 8.5);
  y -= 8;
  line('Event history', bold, 12);
  for (const e of audit.events.slice(-25)) line(`${e.at.toISOString()}   ${e.event}${e.ip ? `   (${e.ip})` : ''}`, regular, 9);
  return doc.save();
}
