// Tiny API client used by the demo seeder and the e2e smoke test (local only: relies on AUTH_DEV_ECHO_OTP).
import { loadRootEnv } from './lib.mjs';

const env = { ...loadRootEnv(), ...process.env };
export const API = env.API_PUBLIC_URL ?? 'http://localhost:8080';

export class ApiError extends Error {
  constructor(status, body, path) {
    super(`${status} ${path}: ${body?.message ?? JSON.stringify(body)}`);
    this.status = status;
    this.body = body;
  }
}

export class Session {
  constructor(label) {
    this.label = label;
    this.token = null;
  }

  async req(method, path, body, { expect } = {}) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-aci-client': 'web',
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : undefined;
    if (!res.ok && !(expect && expect.includes(res.status))) throw new ApiError(res.status, json, `${method} ${path}`);
    return json;
  }
  get(p) {
    return this.req('GET', p);
  }
  post(p, b) {
    return this.req('POST', p, b ?? {});
  }
  put(p, b) {
    return this.req('PUT', p, b);
  }
  patch(p, b) {
    return this.req('PATCH', p, b);
  }

  /** Full OTP login using the dev echo (the code is returned only when AUTH_DEV_ECHO_OTP=true locally). */
  async login(phone, audience = 'student', channel = 'WHATSAPP') {
    let ch;
    try {
      ch = await this.req('POST', '/api/v1/auth/otp/request', { phone, channel, audience });
    } catch (e) {
      // The 30 s resend cooldown applies to scripts too: wait it out once.
      const wait = e instanceof ApiError && e.status === 429 ? e.body?.retryAfterSeconds : undefined;
      if (!wait || wait > 90) throw e;
      console.log(`  … OTP cooldown for ${phone}, waiting ${wait}s`);
      await sleep((wait + 1) * 1000);
      ch = await this.req('POST', '/api/v1/auth/otp/request', { phone, channel, audience });
    }
    if (!ch.devCode) throw new Error('No devCode returned: is AUTH_DEV_ECHO_OTP=true and APP_ENV=local?');
    const r = await this.req('POST', '/api/v1/auth/otp/verify', { challengeId: ch.challengeId, code: ch.devCode });
    this.token = r.accessToken;
    this.user = r.user;
    return r;
  }

  /** Uploads a file through the presigned POST flow and returns the document id. */
  async upload({ fileName, mimeType, bytes, category = 'ATHLETE_DOCUMENT', subType }) {
    const r = await this.post('/api/v1/documents/uploads', { fileName, mimeType, sizeBytes: bytes.length, category, subType });
    const form = new FormData();
    for (const [k, v] of Object.entries(r.upload.fields)) form.append(k, v);
    form.append('file', new Blob([bytes], { type: mimeType }), fileName);
    const up = await fetch(r.upload.url, { method: 'POST', body: form });
    if (!up.ok && up.status !== 204) throw new Error(`storage upload failed: ${up.status} ${await up.text()}`);
    await this.post(`/api/v1/documents/${r.document.id}/complete`);
    return r.document.id;
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function waitFor(label, fn, { timeoutMs = 30_000, intervalMs = 500 } = {}) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeoutMs) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for: ${label}`);
}

/** Smallest valid PDF / PNG so uploads pass the server's magic-number checks. */
export const TINY_PDF = new TextEncoder().encode(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
);
export const TINY_PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
);

export { env };
