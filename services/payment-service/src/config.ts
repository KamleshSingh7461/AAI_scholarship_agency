import { assertNotMockInProduction, loadConfig } from '@aci/nest-common';
import { z } from 'zod';

const cfg = loadConfig('payment', {
  PAYMENT_PROVIDER: z.enum(['mock', 'razorpay', 'cashfree', 'payu']).default('mock'),
  PAYMENT_ORDER_EXPIRY_MINUTES: z.coerce.number().int().min(5).max(1440).default(30),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  CASHFREE_APP_ID: z.string().optional(),
  CASHFREE_SECRET_KEY: z.string().optional(),
  CASHFREE_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  CASHFREE_API_VERSION: z.string().default('2023-08-01'),
  PAYU_MERCHANT_KEY: z.string().optional(),
  PAYU_MERCHANT_SALT: z.string().optional(),
  PAYU_ENV: z.enum(['test', 'production']).default('test'),
  COMPANY_BRAND_NAME: z.string().default('Alumni Connect India'),
  COMPANY_LEGAL_NAME: z.string().default('EUSAI Team Private Limited'),
  COMPANY_GSTIN: z.string().optional(),
  COMPANY_ADDRESS: z.string().optional(),
});

assertNotMockInProduction(cfg, 'PAYMENT_PROVIDER', cfg.env.PAYMENT_PROVIDER);

export const config = cfg;
export type PaymentConfig = typeof config;
