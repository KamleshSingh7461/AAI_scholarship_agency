'use client';
import clsx from 'clsx';
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

  const rejected = documentId && status === 'REJECTED';
  return (
    <div
      className={clsx(
        'relative flex items-center gap-4 overflow-hidden rounded-[4px] border px-4 py-3',
        rejected ? 'border-brand-600 bg-[#f8e3df]' : documentId ? 'border-ink/15 bg-chalk' : 'border-dashed border-ink/30 bg-transparent',
      )}
    >
      <span className={clsx('tick rounded-full', !(documentId && !rejected) && 'border-dashed')} data-done={(documentId && !rejected) || undefined} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {label}
          {required && <span className="ml-0.5 text-brand-600">*</span>}
        </p>
        <p className={clsx('text-xs', rejected ? 'font-semibold text-brand-700' : 'text-slate-500')}>
          {progress !== null ? `Uploading… ${progress}%` : documentId ? (status === 'REJECTED' ? 'Rejected by reviewer — please re-upload' : status === 'VERIFIED' ? 'Verified' : 'Uploaded') : hint ?? 'PDF or image, max 10 MB'}
        </p>
      </div>
      {documentId && (
        <button type="button" onClick={() => openDocument(documentId)} className="eyebrow link-grow text-[0.62rem] text-ink">
          View
        </button>
      )}
      <button
        type="button"
        disabled={disabled || progress !== null}
        onClick={() => input.current?.click()}
        className="eyebrow min-w-[5.5rem] rounded-[4px] px-3 py-2 text-[0.62rem] font-semibold text-ink ring-1 ring-inset ring-ink transition-colors hover:bg-ink hover:text-paper disabled:opacity-50"
      >
        {progress !== null ? `${progress}%` : documentId ? 'Replace' : 'Upload'}
      </button>
      {progress !== null && <span className="absolute inset-x-0 bottom-0 h-[3px] bg-brand-600 transition-[width]" style={{ width: `${progress}%` }} aria-hidden />}
      <input ref={input} type="file" accept={ACCEPTED_TYPES} className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
    </div>
  );
}
