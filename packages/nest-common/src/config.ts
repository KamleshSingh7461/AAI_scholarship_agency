import * as fs from 'node:fs';
import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { z } from 'zod';

let envLoaded = false;

/** Walks up from cwd to the monorepo root (the package.json that declares workspaces). */
export function findRepoRoot(start = process.cwd()): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    const pkg = path.join(dir, 'package.json');
    if (fs.existsSync(pkg)) {
      try {
        if (JSON.parse(fs.readFileSync(pkg, 'utf8')).workspaces) return dir;
      } catch {
        /* ignore */
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

/**
 * Loads env files once. Precedence: real environment > service/.env > repo-root/.env.
 * In containers there are no files and everything comes from the orchestrator.
 */
export function loadEnvFiles(): void {
  if (envLoaded) return;
  envLoaded = true;
  const root = findRepoRoot();
  for (const file of [path.join(process.cwd(), '.env'), path.join(root, '.env')]) {
    if (fs.existsSync(file)) dotenv.config({ path: file, override: false });
  }
}

/** Reads a PEM from an inline env var (with literal \n) or from a file path (relative to repo root). */
export function readPem(inline?: string, file?: string): string | undefined {
  if (inline && inline.trim()) return inline.replace(/\\n/g, '\n');
  if (file && file.trim()) {
    const p = path.isAbsolute(file) ? file : path.join(findRepoRoot(), file);
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  }
  return undefined;
}

const bool = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

export const zBool = bool;

export const SERVICE_NAMES = [
  'auth',
  'athlete',
  'university',
  'application',
  'payment',
  'esign',
  'document',
  'notification',
  'finance',
] as const;
export type ServiceName = (typeof SERVICE_NAMES)[number];

export interface BaseConfig {
  serviceName: ServiceName | 'gateway';
  nodeEnv: 'development' | 'test' | 'production';
  appEnv: 'local' | 'staging' | 'production';
  isProd: boolean;
  port: number;
  logLevel: string;
  databaseUrl: string;
  rabbitmqUrl: string;
  redisUrl: string;
  jwtPublicKey: string;
  jwtIssuer: string;
  jwtAudience: string;
  internalApiToken: string;
  serviceUrls: Record<ServiceName, string>;
  publicWebUrl: string;
  studentWebUrl: string;
  adminWebUrl: string;
  apiPublicUrl: string;
}

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['local', 'staging', 'production']).default('local'),
  LOG_LEVEL: z.string().default('info'),
  RABBITMQ_URL: z.string().min(1).default('amqp://aci:aci_local_pw@localhost:5672'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  JWT_PUBLIC_KEY: z.string().optional(),
  JWT_PUBLIC_KEY_FILE: z.string().optional(),
  JWT_ISSUER: z.string().default('alumni-connect-auth'),
  JWT_AUDIENCE: z.string().default('alumni-connect'),
  INTERNAL_API_TOKEN: z.string().min(32, 'INTERNAL_API_TOKEN must be at least 32 chars'),
  PUBLIC_WEB_URL: z.string().url().default('http://localhost:3000'),
  STUDENT_WEB_URL: z.string().url().default('http://localhost:3001'),
  ADMIN_WEB_URL: z.string().url().default('http://localhost:3002'),
  API_PUBLIC_URL: z.string().url().default('http://localhost:8080'),
});

const DEFAULT_PORTS: Record<ServiceName, number> = {
  auth: 4001,
  athlete: 4002,
  university: 4003,
  application: 4004,
  payment: 4005,
  esign: 4006,
  document: 4007,
  notification: 4008,
  finance: 4009,
};

/**
 * Builds a validated, typed config for a service. Service-specific variables are
 * namespaced (AUTH_DATABASE_URL, AUTH_PORT...) so one root .env can serve every
 * service locally, while production containers only receive their own variables.
 */
export function loadConfig<S extends z.ZodRawShape>(
  serviceName: ServiceName | 'gateway',
  extra: S,
): BaseConfig & { env: z.infer<z.ZodObject<S>> } {
  loadEnvFiles();
  const prefix = serviceName.toUpperCase();
  const base = baseSchema.safeParse(process.env);
  const ext = z.object(extra).safeParse(process.env);
  const problems = [
    ...(base.success ? [] : base.error.issues),
    ...(ext.success ? [] : ext.error.issues),
  ].map((i) => `  - ${i.path.join('.')}: ${i.message}`);

  const dbUrl = process.env[`${prefix}_DATABASE_URL`] ?? process.env.DATABASE_URL ?? '';
  if (serviceName !== 'gateway' && !dbUrl) problems.push(`  - ${prefix}_DATABASE_URL: required`);

  const jwtPublicKey = base.success ? readPem(base.data.JWT_PUBLIC_KEY, base.data.JWT_PUBLIC_KEY_FILE) : undefined;
  if (!jwtPublicKey) problems.push('  - JWT_PUBLIC_KEY / JWT_PUBLIC_KEY_FILE: required (run `npm run setup` locally)');

  if (problems.length || !base.success || !ext.success) {
    throw new Error(`[${serviceName}] Invalid configuration:\n${problems.join('\n')}`);
  }
  const b = base.data;
  const serviceUrls = Object.fromEntries(
    Object.entries(DEFAULT_PORTS).map(([name, port]) => [
      name,
      process.env[`${name.toUpperCase()}_SERVICE_URL`] ?? `http://localhost:${port}`,
    ]),
  ) as Record<ServiceName, string>;

  const port = Number(
    process.env[`${prefix}_PORT`] ??
      process.env.PORT ??
      (serviceName === 'gateway' ? 8080 : DEFAULT_PORTS[serviceName as ServiceName]),
  );

  return {
    serviceName,
    nodeEnv: b.NODE_ENV,
    appEnv: b.APP_ENV,
    isProd: b.APP_ENV === 'production',
    port,
    logLevel: b.LOG_LEVEL,
    databaseUrl: dbUrl,
    rabbitmqUrl: b.RABBITMQ_URL,
    redisUrl: b.REDIS_URL,
    jwtPublicKey: jwtPublicKey!,
    jwtIssuer: b.JWT_ISSUER,
    jwtAudience: b.JWT_AUDIENCE,
    internalApiToken: b.INTERNAL_API_TOKEN,
    serviceUrls,
    publicWebUrl: b.PUBLIC_WEB_URL,
    studentWebUrl: b.STUDENT_WEB_URL,
    adminWebUrl: b.ADMIN_WEB_URL,
    apiPublicUrl: b.API_PUBLIC_URL,
    env: ext.data,
  };
}

/** Throws at startup when a production deployment is still wired to a mock/console provider. */
export function assertNotMockInProduction(cfg: BaseConfig, name: string, value: string): void {
  if (cfg.isProd && ['mock', 'console'].includes(value.toLowerCase())) {
    throw new Error(`[${cfg.serviceName}] ${name}=${value} is not allowed when APP_ENV=production`);
  }
}
