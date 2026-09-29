import { HttpException, Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { APP_CONFIG } from '../tokens';
import type { BaseConfig, ServiceName } from '../config';

export interface InternalRequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  timeoutMs?: number;
  /** Retry on network errors / 502-504. Defaults to true for GET. */
  retry?: boolean;
  correlationId?: string;
}

/**
 * Synchronous service-to-service HTTP. Use only when the caller needs an answer right now
 * (e.g. reserve a seat, create a payment order). Everything else goes through events.
 */
@Injectable()
export class InternalHttpClient {
  private readonly logger = new Logger(InternalHttpClient.name);

  constructor(@Inject(APP_CONFIG) private readonly config: BaseConfig) {}

  get<T>(service: ServiceName, path: string, opts: InternalRequestOptions = {}) {
    return this.request<T>(service, 'GET', path, opts);
  }
  post<T>(service: ServiceName, path: string, body?: unknown, opts: InternalRequestOptions = {}) {
    return this.request<T>(service, 'POST', path, { ...opts, body });
  }
  patch<T>(service: ServiceName, path: string, body?: unknown, opts: InternalRequestOptions = {}) {
    return this.request<T>(service, 'PATCH', path, { ...opts, body });
  }

  async request<T>(service: ServiceName, method: string, path: string, opts: InternalRequestOptions = {}): Promise<T> {
    const base = this.config.serviceUrls[service];
    const url = new URL(path.startsWith('/') ? path : `/${path}`, base);
    for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
    const retry = opts.retry ?? method === 'GET';
    const maxAttempts = retry ? 3 : 1;

    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 10_000);
      try {
        const res = await fetch(url, {
          method,
          signal: ctrl.signal,
          headers: {
            'content-type': 'application/json',
            'x-internal-token': this.config.internalApiToken,
            'x-calling-service': this.config.serviceName,
            ...(opts.correlationId ? { 'x-request-id': opts.correlationId } : {}),
          },
          body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        });
        const text = await res.text();
        const json = text ? safeJson(text) : undefined;
        if (res.ok) return json as T;
        if (retry && [502, 503, 504].includes(res.status) && attempt < maxAttempts) {
          await sleep(200 * attempt);
          continue;
        }
        // Propagate the downstream error (4xx keeps its meaning for the caller).
        throw new HttpException(json ?? { message: text || res.statusText }, res.status);
      } catch (err) {
        if (err instanceof HttpException) throw err;
        lastErr = err;
        if (attempt < maxAttempts) {
          await sleep(200 * attempt);
          continue;
        }
      } finally {
        clearTimeout(t);
      }
    }
    this.logger.error(`${method} ${service}${path} failed: ${(lastErr as Error)?.message}`);
    throw new ServiceUnavailableException({ message: `${service} service unavailable`, code: 'UPSTREAM_UNAVAILABLE' });
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
