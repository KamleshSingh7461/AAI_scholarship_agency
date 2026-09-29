import { assertNotMockInProduction, loadConfig, zBool } from '@aci/nest-common';
import { z } from 'zod';

const cfg = loadConfig('notification', {
  SMS_PROVIDER: z.enum(['console', 'msg91', 'twilio']).default('console'),
  WHATSAPP_PROVIDER: z.enum(['console', 'meta', 'twilio']).default('console'),
  EMAIL_PROVIDER: z.enum(['console', 'smtp']).default('console'),

  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_SENDER_ID: z.string().optional(),
  MSG91_OTP_TEMPLATE_ID: z.string().optional(),
  MSG91_DEFAULT_FLOW_ID: z.string().optional(),

  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_SMS_FROM: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),

  META_WA_PHONE_NUMBER_ID: z.string().optional(),
  META_WA_ACCESS_TOKEN: z.string().optional(),
  META_WA_API_VERSION: z.string().default('v21.0'),
  META_WA_OTP_TEMPLATE: z.string().default('aci_login_otp'),
  META_WA_NOTIFY_TEMPLATE: z.string().default('aci_notification'),
  META_WA_TEMPLATE_LANG: z.string().default('en'),

  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_SECURE: zBool.default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().default('Alumni Connect India <no-reply@alumniconnectindia.com>'),
  COMPANY_BRAND_NAME: z.string().default('Alumni Connect India'),
});

assertNotMockInProduction(cfg, 'SMS_PROVIDER', cfg.env.SMS_PROVIDER);
assertNotMockInProduction(cfg, 'WHATSAPP_PROVIDER', cfg.env.WHATSAPP_PROVIDER);

export const config = cfg;
export type NotificationConfig = typeof config;
