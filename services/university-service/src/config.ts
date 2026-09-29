import { loadConfig } from '@aci/nest-common';
import { z } from 'zod';

export const config = loadConfig('university', {
  DEFAULT_USD_INR_RATE: z.coerce.number().positive().default(83),
  DEFAULT_AGENCY_COMMISSION_BPS: z.coerce.number().int().min(0).max(10000).default(800),
});
export type UniversityConfig = typeof config;
