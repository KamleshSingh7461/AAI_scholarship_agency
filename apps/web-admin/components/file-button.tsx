'use client';
import { useRef, useState } from 'react';
import { ACCEPTED_TYPES, uploadFile } from '@aci/web-shared';
import { Button, useToast } from '@aci/web-shared/ui';

/** Staff upload (MoUs, university letters, confirmations). Returns the stored document id. */
export function FileButton({
  label = 'Upload',
  category,
  subType,
  ownerUserId,
  onUploaded,
  size = 'sm',
}: {
  label?: string;
  category: string;
  subType?: string;
  ownerUserId?: string;
  onUploaded: (id: string, fileName: string) => void;
  size?: 'sm' | 'md';
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [pct, setPct] = useState<number | null>(null);
  const toast = useToast();
  return (
    <>
      <Button
        type="button"
        size={size}
        variant="secondary"
        loading={pct !== null}
        onClick={() => ref.current?.click()}
      >
        {pct !== null ? `${pct}%` : label}
      </Button>
      <input
        ref={ref}
        type="file"
        className="hidden"
        accept={ACCEPTED_TYPES}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setPct(0);
          try {
            const d = await uploadFile(f, { category, subType, ownerUserId }, setPct);
            onUploaded(d.id, f.name);
            toast.success(`${f.name} uploaded`);
          } catch (err) {
            toast.error((err as Error).message);
          } finally {
            setPct(null);
            if (ref.current) ref.current.value = '';
          }
        }}
      />
    </>
  );
}
