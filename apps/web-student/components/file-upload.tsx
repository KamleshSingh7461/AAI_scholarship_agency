'use client';
import clsx from 'clsx';
import { CheckCircle2, Eye, Loader2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { ACCEPTED_TYPES, openDocument, uploadFile } from '@aci/web-shared';
import { useToast } from '@aci/web-shared/ui';

const MAX_MB = 10;

export function FileUpload({
  label,
  hint,
  documentId,
  subType,
  required,
  status,
  onUploaded,
  disabled,
}: {
  label: string;
  hint?: string;
  documentId?: string | null;
  subType: string;
  required?: boolean;
  status?: string;
  onUploaded: (id: string) => void | Promise<void>;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const toast = useToast();

  const onFile = async (file?: File) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.split(',').includes(file.type)) return toast.error('Upload a PDF, JPG, PNG or WEBP file');
    if (file.size > MAX_MB * 1024 * 1024) return toast.error(`Files must be under ${MAX_MB} MB`);
    setProgress(0);
    try {
      const doc = await uploadFile(file, { subType }, setProgress);
      await onUploaded(doc.id);
      toast.success(`${label} uploaded`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setProgress(null);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div
      className={clsx(
        'flex items-center gap-3 rounded-xl border px-4 py-3',
        documentId ? 'border-emerald-200 bg-emerald-50/50' : required ? 'border-dashed border-slate-300 bg-white' : 'border-dashed border-slate-200 bg-white',
      )}
    >
      {documentId ? <CheckCircle2 className="size-5 shrink-0 text-emerald-600" /> : <Upload className="size-5 shrink-0 text-slate-400" />}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800">
          {label}
          {required && <span className="ml-0.5 text-brand-600">*</span>}
        </p>
        <p className="text-xs text-slate-500">
          {progress !== null ? `Uploading… ${progress}%` : documentId ? (status === 'REJECTED' ? 'Rejected by reviewer — please re-upload' : status === 'VERIFIED' ? 'Verified' : 'Uploaded') : hint ?? 'PDF or image, max 10 MB'}
        </p>
      </div>
      {documentId && (
        <button type="button" onClick={() => openDocument(documentId)} className="rounded-lg p-2 text-slate-500 hover:bg-white" title="View">
          <Eye className="size-4" />
        </button>
      )}
      <button
        type="button"
        disabled={disabled || progress !== null}
        onClick={() => input.current?.click()}
        className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
      >
        {progress !== null ? <Loader2 className="size-4 animate-spin" /> : documentId ? 'Replace' : 'Upload'}
      </button>
      <input ref={input} type="file" accept={ACCEPTED_TYPES} className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
    </div>
  );
}
