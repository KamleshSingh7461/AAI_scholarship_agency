import { api } from './api';

export interface UploadedDocument {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
}

export const ACCEPTED_TYPES = 'application/pdf,image/jpeg,image/png,image/webp';

/**
 * Two-step upload: get a presigned POST from the document service, send the file straight to
 * storage (never through our servers), then ask the service to verify it.
 */
export async function uploadFile(
  file: File,
  opts: { category?: string; subType?: string; ownerUserId?: string } = {},
  onProgress?: (pct: number) => void,
): Promise<UploadedDocument> {
  const init = await api<{ document: UploadedDocument; upload: { url: string; fields: Record<string, string> }; maxBytes: number }>('/documents/uploads', {
    method: 'POST',
    body: { fileName: file.name, mimeType: file.type, sizeBytes: file.size, category: opts.category ?? 'ATHLETE_DOCUMENT', subType: opts.subType, ownerUserId: opts.ownerUserId },
  });
  const form = new FormData();
  for (const [k, v] of Object.entries(init.upload.fields)) form.append(k, v);
  form.append('file', file);
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', init.upload.url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('Upload failed — check your connection'));
    xhr.send(form);
  });
  return api<UploadedDocument>(`/documents/${init.document.id}/complete`, { method: 'POST', body: {} });
}

export async function openDocument(id: string, inline = true) {
  const r = await api<{ url: string }>(`/documents/${id}/url`, { query: { inline: inline ? '1' : '0' } });
  window.open(r.url, '_blank', 'noopener');
}
