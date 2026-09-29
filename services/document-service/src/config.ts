import { loadConfig, zBool } from '@aci/nest-common';
import { z } from 'zod';

export const config = loadConfig('document', {
  S3_ENDPOINT: z.string().optional(),
  S3_PUBLIC_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('ap-south-1'),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: zBool.default(false),
  DOCUMENT_MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(50).default(10),
});
export type DocumentConfig = typeof config;
