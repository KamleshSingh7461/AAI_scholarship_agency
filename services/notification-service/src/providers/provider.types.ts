export interface SendResult {
  provider: string;
  messageId?: string;
}

export interface SmsProvider {
  readonly name: string;
  sendOtp(to: string, code: string, ttlMinutes: number): Promise<SendResult>;
  send(to: string, body: string, opts?: { dltTemplateId?: string; variables?: Record<string, string> }): Promise<SendResult>;
}

export interface WhatsAppProvider {
  readonly name: string;
  sendOtp(to: string, code: string, ttlMinutes: number): Promise<SendResult>;
  /**
   * Business-initiated WhatsApp messages must use an approved template. `body` is the rendered
   * text (used by providers that allow free-form within the 24h window, and for the log).
   */
  send(to: string, body: string, opts?: { template?: string; params?: string[] }): Promise<SendResult>;
}

export interface EmailProvider {
  readonly name: string;
  send(to: string, subject: string, text: string, html?: string): Promise<SendResult>;
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
export const WHATSAPP_PROVIDER = Symbol('WHATSAPP_PROVIDER');
export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

export class ProviderError extends Error {
  constructor(provider: string, message: string, readonly retryable = true) {
    super(`[${provider}] ${message}`);
  }
}

export async function postJson(url: string, body: unknown, headers: Record<string, string>, provider: string, timeoutMs = 10_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json: any;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }
    if (!res.ok) throw new ProviderError(provider, `HTTP ${res.status}: ${text.slice(0, 300)}`, res.status >= 500 || res.status === 429);
    return json;
  } finally {
    clearTimeout(t);
  }
}

/** Strip the leading + (most Indian providers want 91XXXXXXXXXX). */
export const digitsOnly = (e164: string) => e164.replace(/^\+/, '');
