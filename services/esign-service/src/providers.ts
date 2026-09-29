import { Logger } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { importPKCS8, SignJWT } from 'jose';
import type { EsignConfig } from './config';
import type { Envelope } from './generated/prisma';

export type ProviderStatus = 'SENT' | 'VIEWED' | 'SIGNED' | 'DECLINED' | 'VOIDED';

export interface EsignProvider {
  readonly name: 'DOCUSIGN' | 'MOCK';
  send(env: Envelope, pdf: Uint8Array): Promise<{ providerEnvelopeId: string }>;
  /** URL where the athlete (or guardian, in person) signs inside our portal. */
  signingUrl(env: Envelope, as: 'signer' | 'guardian', returnUrl: string): Promise<string>;
  status(env: Envelope): Promise<ProviderStatus>;
  downloadSigned(env: Envelope): Promise<Uint8Array>;
  void(env: Envelope, reason: string): Promise<void>;
  parseWebhook(headers: Record<string, string | string[] | undefined>, raw: Buffer): { providerEnvelopeId: string; status: ProviderStatus | null } | null;
}

export const ESIGN_PROVIDER = Symbol('ESIGN_PROVIDER');

/** Local development: signing happens on our own page (see EsignService.mockSign). */
export class MockEsignProvider implements EsignProvider {
  readonly name = 'MOCK' as const;
  constructor(private readonly cfg: EsignConfig) {}
  async send() {
    return { providerEnvelopeId: `mock_${randomUUID()}` };
  }
  async signingUrl(env: Envelope, as: 'signer' | 'guardian') {
    return `${this.cfg.studentWebUrl}/agreements/${env.id}/sign${as === 'guardian' ? '?as=guardian' : ''}`;
  }
  async status(env: Envelope): Promise<ProviderStatus> {
    return (['SENT', 'VIEWED', 'SIGNED', 'DECLINED', 'VOIDED'].includes(env.status) ? env.status : 'SENT') as ProviderStatus;
  }
  async downloadSigned(): Promise<Uint8Array> {
    throw new Error('Mock envelopes are stamped in-process');
  }
  async void() {}
  parseWebhook() {
    return null;
  }
}

/**
 * DocuSign eSignature REST v2.1 with JWT Grant auth and embedded (in-portal) signing.
 * Requires: integration key with RSA keypair, an impersonated user who granted consent once, and the account id.
 * https://developers.docusign.com/platform/auth/jwt/ · https://developers.docusign.com/docs/esign-rest-api/
 */
export class DocusignProvider implements EsignProvider {
  readonly name = 'DOCUSIGN' as const;
  private readonly logger = new Logger('DocuSign');
  private token?: { value: string; exp: number };

  constructor(private readonly cfg: EsignConfig) {
    const e = cfg.env;
    if (!e.DOCUSIGN_INTEGRATION_KEY || !e.DOCUSIGN_USER_ID || !e.DOCUSIGN_ACCOUNT_ID || !cfg.docusignPrivateKey) {
      throw new Error('DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, DOCUSIGN_ACCOUNT_ID and DOCUSIGN_PRIVATE_KEY(_FILE) are required');
    }
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.exp > Date.now() + 5 * 60_000) return this.token.value;
    const e = this.cfg.env;
    const key = await importPKCS8(this.cfg.docusignPrivateKey!, 'RS256');
    const assertion = await new SignJWT({ scope: 'signature impersonation' })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(e.DOCUSIGN_INTEGRATION_KEY!)
      .setSubject(e.DOCUSIGN_USER_ID!)
      .setAudience(e.DOCUSIGN_OAUTH_HOST)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(key);
    const res = await fetch(`https://${e.DOCUSIGN_OAUTH_HOST}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const hint = json.error === 'consent_required' ? ' — grant consent once via the DocuSign consent URL (see docs/INTEGRATIONS.md)' : '';
      throw new Error(`DocuSign auth failed: ${json.error ?? res.status}${hint}`);
    }
    this.token = { value: json.access_token, exp: Date.now() + json.expires_in * 1000 };
    return json.access_token;
  }

  private async api(path: string, init: RequestInit = {}, raw = false): Promise<any> {
    const url = `${this.cfg.env.DOCUSIGN_BASE_PATH}/v2.1/accounts/${this.cfg.env.DOCUSIGN_ACCOUNT_ID}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: { authorization: `Bearer ${await this.accessToken()}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`DocuSign ${init.method ?? 'GET'} ${path} -> ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return raw ? new Uint8Array(await res.arrayBuffer()) : res.json();
  }

  private tabs(anchor: number) {
    return {
      signHereTabs: [{ anchorString: `/sig${anchor}/`, anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '-4', anchorIgnoreIfNotPresent: 'false' }],
      dateSignedTabs: [{ anchorString: `/date${anchor}/`, anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '0' }],
    };
  }

  async send(env: Envelope, pdf: Uint8Array) {
    const guardian = env.guardian as { name: string; email?: string } | null;
    const signers: any[] = [
      { email: env.signerEmail, name: env.signerName, recipientId: '1', routingOrder: '1', clientUserId: env.signerUserId, tabs: this.tabs(1) },
    ];
    if (guardian?.name) {
      // Guardian signs in person on the athlete's device (embedded), right after the athlete.
      signers.push({
        email: guardian.email || env.signerEmail,
        name: guardian.name,
        recipientId: '2',
        routingOrder: '2',
        clientUserId: `${env.signerUserId}:guardian`,
        tabs: this.tabs(2),
      });
    }
    if (this.cfg.env.COMPANY_SIGNATORY_EMAIL) {
      signers.push({
        email: this.cfg.env.COMPANY_SIGNATORY_EMAIL,
        name: this.cfg.env.COMPANY_SIGNATORY_NAME,
        recipientId: '3',
        routingOrder: '3',
        tabs: this.tabs(3),
      });
    }
    const r = await this.api('/envelopes', {
      method: 'POST',
      body: JSON.stringify({
        emailSubject: `${this.cfg.env.COMPANY_BRAND_NAME}: ${env.title}`.slice(0, 100),
        documents: [{ documentBase64: Buffer.from(pdf).toString('base64'), name: env.title, fileExtension: 'pdf', documentId: '1' }],
        recipients: { signers },
        customFields: { textCustomFields: [{ name: 'aciEnvelopeId', value: env.id, show: 'false' }] },
        notification: { expirations: { expireEnabled: 'true', expireAfter: String(Math.max(1, Math.ceil((env.expiresAt.getTime() - Date.now()) / 86400_000))), expireWarn: '3' } },
        status: 'sent',
      }),
    });
    return { providerEnvelopeId: r.envelopeId as string };
  }

  async signingUrl(env: Envelope, as: 'signer' | 'guardian', returnUrl: string) {
    const guardian = env.guardian as { name: string; email?: string } | null;
    const isGuardian = as === 'guardian' && guardian?.name;
    const r = await this.api(`/envelopes/${env.providerEnvelopeId}/views/recipient`, {
      method: 'POST',
      body: JSON.stringify({
        returnUrl,
        // The athlete already authenticated to our portal with a phone OTP.
        authenticationMethod: 'none',
        email: isGuardian ? guardian!.email || env.signerEmail : env.signerEmail,
        userName: isGuardian ? guardian!.name : env.signerName,
        clientUserId: isGuardian ? `${env.signerUserId}:guardian` : env.signerUserId,
      }),
    });
    return r.url as string;
  }

  async status(env: Envelope): Promise<ProviderStatus> {
    const r = await this.api(`/envelopes/${env.providerEnvelopeId}`);
    return mapStatus(r.status) ?? 'SENT';
  }

  downloadSigned(env: Envelope): Promise<Uint8Array> {
    return this.api(`/envelopes/${env.providerEnvelopeId}/documents/combined?certificate=true`, { headers: { accept: 'application/pdf' } }, true);
  }

  async void(env: Envelope, reason: string) {
    if (!env.providerEnvelopeId) return;
    await this.api(`/envelopes/${env.providerEnvelopeId}`, { method: 'PUT', body: JSON.stringify({ status: 'voided', voidedReason: reason.slice(0, 200) }) });
  }

  /** DocuSign Connect (JSON, SIM). HMAC-SHA256 over the raw body, base64, in X-DocuSign-Signature-1. */
  parseWebhook(headers: Record<string, string | string[] | undefined>, raw: Buffer) {
    const key = this.cfg.env.DOCUSIGN_CONNECT_HMAC_KEY;
    if (!key) throw new Error('DOCUSIGN_CONNECT_HMAC_KEY not configured');
    const expected = createHmac('sha256', key).update(raw).digest('base64');
    const provided = [1, 2, 3].map((i) => headers[`x-docusign-signature-${i}`]).flat().filter(Boolean) as string[];
    const ok = provided.some((p) => {
      const a = Buffer.from(p);
      const b = Buffer.from(expected);
      return a.length === b.length && timingSafeEqual(a, b);
    });
    if (!ok) throw new Error('Invalid DocuSign Connect signature');
    const body = JSON.parse(raw.toString('utf8'));
    const id = body.data?.envelopeId ?? body.envelopeId;
    if (!id) return null;
    const event: string = body.event ?? '';
    const status = event.startsWith('envelope-') ? mapStatus(event.replace('envelope-', '')) : event === 'recipient-delivered' ? 'VIEWED' : null;
    return { providerEnvelopeId: id, status };
  }
}

function mapStatus(s: string): ProviderStatus | null {
  switch (s) {
    case 'sent':
      return 'SENT';
    case 'delivered':
      return 'VIEWED';
    case 'completed':
      return 'SIGNED';
    case 'declined':
      return 'DECLINED';
    case 'voided':
      return 'VOIDED';
    default:
      return null;
  }
}
