import { loadConfig } from '@aci/nest-common';
import { z } from 'zod';

export const config = loadConfig('application', {
  AGREEMENT_SIGNING_DEADLINE_DAYS: z.coerce.number().int().min(1).max(90).default(14),
  RENEWAL_REMINDER_DAYS_BEFORE: z.coerce.number().int().min(0).max(120).default(30),
  RENEWAL_ENVELOPE_DAYS_BEFORE: z.coerce.number().int().min(0).max(120).default(0),
  RENEWAL_GRACE_DAYS: z.coerce.number().int().min(0).max(120).default(14),
  LIFECYCLE_CRON: z.string().default('0 30 3 * * *'),
  MAX_OPEN_APPLICATIONS: z.coerce.number().int().min(1).max(50).default(5),
  PAYMENT_PENDING_EXPIRY_DAYS: z.coerce.number().int().min(1).max(90).default(14),
  AGREEMENT_REMINDER_INTERVAL_DAYS: z.coerce.number().int().min(1).max(30).default(3),
});
export type ApplicationConfig = typeof config;
