/**
 * API gateway: the only backend component exposed to the internet.
 *  - routes /api/v1/<area>/* to the owning microservice
 *  - never exposes /internal/* (service-to-service endpoints)
 *  - Redis-backed rate limiting (global + stricter on OTP/login)
 *  - CORS allowlist, security headers, request ids, real client IP forwarding
 * It does NOT parse bodies, so webhook signatures stay verifiable downstream.
 */
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { createProxyMiddleware } from 'http-proxy-middleware';
import Redis from 'ioredis';
import pino from 'pino';
import pinoHttp from 'pino-http';

for (const f of [path.join(process.cwd(), '.env'), path.join(process.cwd(), '../../.env')]) {
  if (fs.existsSync(f)) dotenv.config({ path: f, override: false });
}

const env = process.env;
const isProd = env.APP_ENV === 'production';
const PORT = Number(env.GATEWAY_PORT ?? env.PORT ?? 8080);
const svc = (name: string, port: number) => env[`${name.toUpperCase()}_SERVICE_URL`] ?? `http://localhost:${port}`;

/** Longest prefix first. */
const ROUTES: [string, string][] = [
  ['/api/v1/auth', svc('auth', 4001)],
  ['/api/v1/athletes', svc('athlete', 4002)],
  ['/api/v1/universities', svc('university', 4003)],
  ['/api/v1/programs', svc('university', 4003)],
  ['/api/v1/catalog', svc('university', 4003)],
  ['/api/v1/agreements', svc('university', 4003)],
  ['/api/v1/allocations', svc('university', 4003)],
  ['/api/v1/applications', svc('application', 4004)],
  ['/api/v1/awards', svc('application', 4004)],
  ['/api/v1/renewals', svc('application', 4004)],
  ['/api/v1/payments', svc('payment', 4005)],
  ['/api/v1/esign', svc('esign', 4006)],
  ['/api/v1/documents', svc('document', 4007)],
  ['/api/v1/notifications', svc('notification', 4008)],
  ['/api/v1/finance', svc('finance', 4009)],
  ['/api/v1/reports', svc('finance', 4009)],
];

const SERVICES = Object.fromEntries(
  [...new Set(ROUTES.map(([, u]) => u))].map((u) => [ROUTES.find(([, x]) => x === u)![0].split('/')[3], u]),
);

const logger = pino({
  level: env.LOG_LEVEL ?? 'info',
  name: 'gateway',
  transport: isProd ? undefined : { target: 'pino-pretty', options: { singleLine: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } },
});

const redis = new Redis(env.REDIS_URL ?? 'redis://localhost:6379', { keyPrefix: 'aci:gw:', maxRetriesPerRequest: 1, enableOfflineQueue: false });
redis.on('error', (e) => logger.warn(`redis: ${e.message}`));

const app = express();
app.disable('x-powered-by');
// Trust the load balancer / Next.js proxy in front of us so req.ip is the real client.
app.set('trust proxy', env.TRUST_PROXY ?? 'loopback, linklocal, uniquelocal');
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }));

app.use((req, res, next) => {
  const id = (req.headers['x-request-id'] as string) || randomUUID();
  req.headers['x-request-id'] = id;
  res.setHeader('x-request-id', id);
  next();
});
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => (req.url ?? '').startsWith('/health') }, redact: ['req.headers.authorization', 'req.headers.cookie'] }));

// ---- CORS (allowlist) ----
const allowed = new Set((env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowed.has(origin)) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('access-control-allow-credentials', 'true');
    res.setHeader('vary', 'Origin');
    if (req.method === 'OPTIONS') {
      res.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('access-control-allow-headers', 'authorization,content-type,x-aci-client,x-request-id');
      res.setHeader('access-control-max-age', '600');
      return res.status(204).end();
    }
  } else if (origin && req.method === 'OPTIONS') {
    return res.status(403).end();
  }
  next();
});

// ---- Never expose internal endpoints ----
app.use((req, res, next) => {
  if (/^\/internal(\/|$)/i.test(req.path) || /\/internal\//i.test(req.path)) return res.status(404).json({ statusCode: 404, message: 'Not found' });
  next();
});

// ---- Rate limiting (fixed window, fails open if Redis is down) ----
const GLOBAL_LIMIT = Number(env.RATE_LIMIT_PER_MINUTE ?? 600);
const AUTH_LIMIT = Number(env.AUTH_RATE_LIMIT_PER_MINUTE ?? 30);
async function limited(key: string, limit: number): Promise<{ over: boolean; ttl: number }> {
  try {
    const r = await redis.multi().incr(key).expire(key, 60, 'NX').ttl(key).exec();
    const count = Number(r?.[0]?.[1] ?? 0);
    return { over: count > limit, ttl: Number(r?.[2]?.[1] ?? 60) };
  } catch {
    return { over: false, ttl: 0 };
  }
}
app.use(async (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/health') || req.path.includes('/webhooks/')) return next();
  const ip = req.ip ?? 'unknown';
  const minute = Math.floor(Date.now() / 60000);
  const isAuth = req.path.startsWith('/api/v1/auth/otp') || req.path.startsWith('/api/v1/auth/refresh');
  const r = await limited(`${isAuth ? 'auth' : 'all'}:${ip}:${minute}`, isAuth ? AUTH_LIMIT : GLOBAL_LIMIT);
  if (r.over) {
    res.setHeader('retry-after', String(r.ttl || 60));
    return res.status(429).json({ statusCode: 429, message: 'Too many requests, slow down', code: 'RATE_LIMITED' });
  }
  next();
});

// ---- Health ----
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'gateway' }));
app.get('/health/ready', async (_req, res) => {
  const checks = await Promise.all(
    Object.entries(SERVICES).map(async ([name, url]) => {
      try {
        const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
        return [name, r.ok] as const;
      } catch {
        return [name, false] as const;
      }
    }),
  );
  const result = Object.fromEntries(checks);
  const ok = Object.values(result).every(Boolean);
  res.status(ok ? 200 : 503).json({ status: ok ? 'ready' : 'degraded', services: result });
});

// ---- Swagger passthrough (non-production) ----
if (!isProd) {
  app.get('/docs', (_req, res) => {
    res.type('html').send(`<h2>Service API docs</h2><ul>${Object.entries(SERVICES).map(([n]) => `<li><a href="/docs/${n}/">${n}</a></li>`).join('')}</ul>`);
  });
  for (const [name, url] of Object.entries(SERVICES)) {
    app.use(`/docs/${name}`, createProxyMiddleware({ target: url, changeOrigin: true, pathRewrite: (p) => `/docs${p}` }));
  }
}

// ---- Proxy ----
for (const [prefix, target] of ROUTES) {
  app.use(
    createProxyMiddleware({
      target,
      pathFilter: (p) => p === prefix || p.startsWith(`${prefix}/`),
      changeOrigin: true,
      xfwd: false,
      proxyTimeout: 60_000,
      timeout: 60_000,
      on: {
        proxyReq: (proxyReq, req) => {
          const r = req as Request;
          proxyReq.setHeader('x-forwarded-for', r.ip ?? '');
          proxyReq.setHeader('x-forwarded-proto', r.protocol);
          proxyReq.removeHeader('x-internal-token');
        },
        error: (err, _req, res) => {
          logger.error(`proxy ${prefix} -> ${target}: ${err.message}`);
          const r = res as Response;
          if (!r.headersSent) r.status(502).json({ statusCode: 502, message: 'Service temporarily unavailable', code: 'UPSTREAM_UNAVAILABLE' });
        },
      },
    }),
  );
}

app.use((_req, res) => res.status(404).json({ statusCode: 404, message: 'Not found' }));

app.listen(PORT, '0.0.0.0', () => logger.info(`gateway listening on :${PORT} → ${Object.keys(SERVICES).length} services`));
