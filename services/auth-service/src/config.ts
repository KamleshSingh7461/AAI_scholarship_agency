import { loadConfig, readPem, zBool } from '@aci/nest-common';
import { z } from 'zod';

const cfg = loadConfig('auth', {
  AUTH_JWT_PRIVATE_KEY: z.string().optional(),
  AUTH_JWT_PRIVATE_KEY_FILE: z.string().optional(),
  AUTH_OTP_PEPPER: z.string().min(16),
  AUTH_OTP_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(300),
  AUTH_OTP_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(10).default(5),
  AUTH_OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().min(10).default(30),
  AUTH_OTP_MAX_PER_HOUR: z.coerce.number().int().min(1).default(6),
  AUTH_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  AUTH_REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  AUTH_DEV_ECHO_OTP: zBool.default(false),
  AUTH_COOKIE_DOMAIN: z.string().optional(),
});

const privateKey = readPem(cfg.env.AUTH_JWT_PRIVATE_KEY, cfg.env.AUTH_JWT_PRIVATE_KEY_FILE);
if (!privateKey) throw new Error('[auth] AUTH_JWT_PRIVATE_KEY or AUTH_JWT_PRIVATE_KEY_FILE is required');
if (cfg.isProd && cfg.env.AUTH_DEV_ECHO_OTP) throw new Error('[auth] AUTH_DEV_ECHO_OTP must be false in production');

export const config = { ...cfg, jwtPrivateKey: privateKey };
export type AuthConfig = typeof config;
