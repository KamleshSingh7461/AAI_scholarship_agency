import { assertNotMockInProduction, loadConfig, readPem } from '@aci/nest-common';
import { z } from 'zod';

const cfg = loadConfig('esign', {
  ESIGN_PROVIDER: z.enum(['mock', 'docusign']).default('mock'),
  ESIGN_ENVELOPE_EXPIRY_DAYS: z.coerce.number().int().min(1).max(120).default(14),
  DOCUSIGN_INTEGRATION_KEY: z.string().optional(),
  DOCUSIGN_USER_ID: z.string().optional(),
  DOCUSIGN_ACCOUNT_ID: z.string().optional(),
  DOCUSIGN_PRIVATE_KEY: z.string().optional(),
  DOCUSIGN_PRIVATE_KEY_FILE: z.string().optional(),
  DOCUSIGN_OAUTH_HOST: z.string().default('account-d.docusign.com'),
  DOCUSIGN_BASE_PATH: z.string().default('https://demo.docusign.net/restapi'),
  DOCUSIGN_CONNECT_HMAC_KEY: z.string().optional(),
  COMPANY_LEGAL_NAME: z.string().default('EUSAI Team Private Limited'),
  COMPANY_BRAND_NAME: z.string().default('Alumni Connect India'),
  COMPANY_SIGNATORY_NAME: z.string().default('Authorised Signatory'),
  COMPANY_SIGNATORY_EMAIL: z.string().optional(),
});

assertNotMockInProduction(cfg, 'ESIGN_PROVIDER', cfg.env.ESIGN_PROVIDER);

export const config = {
  ...cfg,
  docusignPrivateKey: readPem(cfg.env.DOCUSIGN_PRIVATE_KEY, cfg.env.DOCUSIGN_PRIVATE_KEY_FILE),
};
export type EsignConfig = typeof config;
