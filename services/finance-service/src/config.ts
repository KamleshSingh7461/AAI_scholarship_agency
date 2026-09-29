import { loadConfig } from '@aci/nest-common';
import { z } from 'zod';

export const config = loadConfig('finance', {
  REVENUE_RECOGNITION_POLICY: z.enum(['FULL_AT_GRANT', 'RATABLE']).default('FULL_AT_GRANT'),
  DEFAULT_USD_INR_RATE: z.coerce.number().positive().default(83),
  COMPANY_BRAND_NAME: z.string().default('Alumni Connect India'),
});
export type FinanceConfig = typeof config;
