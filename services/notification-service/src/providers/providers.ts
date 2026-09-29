import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { NotificationConfig } from '../config';
import {
  digitsOnly,
  postJson,
  ProviderError,
  type EmailProvider,
  type SendResult,
  type SmsProvider,
  type WhatsAppProvider,
} from './provider.types';

// ---------------------------------------------------------------------------
// Console (local development): prints messages to the service log.
// ---------------------------------------------------------------------------
export class ConsoleSms implements SmsProvider {
  readonly name = 'console-sms';
  private readonly log = new Logger('SMS');
  async sendOtp(to: string, code: string, ttl: number): Promise<SendResult> {
    this.log.warn(`📱 OTP for ${to}: ${code} (valid ${ttl} min)`);
    return { provider: this.name };
  }
  async send(to: string, body: string): Promise<SendResult> {
    this.log.log(`📱 SMS to ${to}: ${body}`);
    return { provider: this.name };
  }
}

export class ConsoleWhatsApp implements WhatsAppProvider {
  readonly name = 'console-whatsapp';
  private readonly log = new Logger('WhatsApp');
  async sendOtp(to: string, code: string, ttl: number): Promise<SendResult> {
    this.log.warn(`💬 WhatsApp OTP for ${to}: ${code} (valid ${ttl} min)`);
    return { provider: this.name };
  }
  async send(to: string, body: string): Promise<SendResult> {
    this.log.log(`💬 WhatsApp to ${to}: ${body}`);
    return { provider: this.name };
  }
}

export class ConsoleEmail implements EmailProvider {
  readonly name = 'console-email';
  private readonly log = new Logger('Email');
  async send(to: string, subject: string, text: string): Promise<SendResult> {
    this.log.log(`✉️  Email to ${to}: ${subject}\n${text}`);
    return { provider: this.name };
  }
}

// ---------------------------------------------------------------------------
// MSG91 (India). SMS in India requires DLT-registered sender ID + templates.
// Docs: https://docs.msg91.com  — OTP API v5 and Flow API v5.
// ---------------------------------------------------------------------------
export class Msg91Sms implements SmsProvider {
  readonly name = 'msg91';
  constructor(private readonly cfg: NotificationConfig['env']) {
    if (!cfg.MSG91_AUTH_KEY || !cfg.MSG91_OTP_TEMPLATE_ID) throw new Error('MSG91_AUTH_KEY and MSG91_OTP_TEMPLATE_ID are required');
  }
  async sendOtp(to: string, code: string, ttl: number): Promise<SendResult> {
    const url = new URL('https://control.msg91.com/api/v5/otp');
    url.searchParams.set('template_id', this.cfg.MSG91_OTP_TEMPLATE_ID!);
    url.searchParams.set('mobile', digitsOnly(to));
    url.searchParams.set('otp', code);
    url.searchParams.set('otp_expiry', String(ttl));
    const r = await postJson(url.toString(), {}, { authkey: this.cfg.MSG91_AUTH_KEY! }, this.name);
    if (r.type === 'error') throw new ProviderError(this.name, r.message ?? 'OTP send failed');
    return { provider: this.name, messageId: r.request_id };
  }
  async send(to: string, _body: string, opts?: { dltTemplateId?: string; variables?: Record<string, string> }): Promise<SendResult> {
    const flowId = opts?.dltTemplateId ?? this.cfg.MSG91_DEFAULT_FLOW_ID;
    if (!flowId) throw new ProviderError(this.name, 'No MSG91 flow/template id configured for this message', false);
    const r = await postJson(
      'https://control.msg91.com/api/v5/flow',
      { template_id: flowId, short_url: '0', recipients: [{ mobiles: digitsOnly(to), ...(opts?.variables ?? {}) }] },
      { authkey: this.cfg.MSG91_AUTH_KEY! },
      this.name,
    );
    if (r.type === 'error') throw new ProviderError(this.name, r.message ?? 'send failed');
    return { provider: this.name, messageId: r.message };
  }
}

// ---------------------------------------------------------------------------
// Twilio (SMS + WhatsApp). Good fallback / international numbers.
// ---------------------------------------------------------------------------
async function twilioSend(cfg: NotificationConfig['env'], from: string, to: string, body: string): Promise<SendResult> {
  const sid = cfg.TWILIO_ACCOUNT_SID!;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      authorization: 'Basic ' + Buffer.from(`${sid}:${cfg.TWILIO_AUTH_TOKEN}`).toString('base64'),
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: from, To: to, Body: body }).toString(),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new ProviderError('twilio', `HTTP ${res.status}: ${json.message ?? ''}`, res.status >= 500 || res.status === 429);
  return { provider: 'twilio', messageId: json.sid };
}

export class TwilioSms implements SmsProvider {
  readonly name = 'twilio-sms';
  constructor(private readonly cfg: NotificationConfig['env'], private readonly brand: string) {
    if (!cfg.TWILIO_ACCOUNT_SID || !cfg.TWILIO_AUTH_TOKEN || !cfg.TWILIO_SMS_FROM) throw new Error('Twilio SMS credentials are required');
  }
  sendOtp(to: string, code: string, ttl: number) {
    return twilioSend(this.cfg, this.cfg.TWILIO_SMS_FROM!, to, `${code} is your ${this.brand} login code. Valid for ${ttl} minutes. Do not share it with anyone.`);
  }
  send(to: string, body: string) {
    return twilioSend(this.cfg, this.cfg.TWILIO_SMS_FROM!, to, body);
  }
}

export class TwilioWhatsApp implements WhatsAppProvider {
  readonly name = 'twilio-whatsapp';
  constructor(private readonly cfg: NotificationConfig['env'], private readonly brand: string) {
    if (!cfg.TWILIO_ACCOUNT_SID || !cfg.TWILIO_AUTH_TOKEN || !cfg.TWILIO_WHATSAPP_FROM) throw new Error('Twilio WhatsApp credentials are required');
  }
  sendOtp(to: string, code: string, ttl: number) {
    return twilioSend(this.cfg, `whatsapp:${this.cfg.TWILIO_WHATSAPP_FROM}`, `whatsapp:${to}`, `${code} is your ${this.brand} verification code. It expires in ${ttl} minutes.`);
  }
  send(to: string, body: string) {
    return twilioSend(this.cfg, `whatsapp:${this.cfg.TWILIO_WHATSAPP_FROM}`, `whatsapp:${to}`, body);
  }
}

// ---------------------------------------------------------------------------
// Meta WhatsApp Cloud API. OTP uses an AUTHENTICATION category template with a copy-code button.
// ---------------------------------------------------------------------------
export class MetaWhatsApp implements WhatsAppProvider {
  readonly name = 'meta-whatsapp';
  constructor(private readonly cfg: NotificationConfig['env']) {
    if (!cfg.META_WA_PHONE_NUMBER_ID || !cfg.META_WA_ACCESS_TOKEN) throw new Error('META_WA_PHONE_NUMBER_ID and META_WA_ACCESS_TOKEN are required');
  }
  private url() {
    return `https://graph.facebook.com/${this.cfg.META_WA_API_VERSION}/${this.cfg.META_WA_PHONE_NUMBER_ID}/messages`;
  }
  private headers() {
    return { authorization: `Bearer ${this.cfg.META_WA_ACCESS_TOKEN}` };
  }
  async sendOtp(to: string, code: string): Promise<SendResult> {
    const r = await postJson(
      this.url(),
      {
        messaging_product: 'whatsapp',
        to: digitsOnly(to),
        type: 'template',
        template: {
          name: this.cfg.META_WA_OTP_TEMPLATE,
          language: { code: this.cfg.META_WA_TEMPLATE_LANG },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: code }] },
            { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
          ],
        },
      },
      this.headers(),
      this.name,
    );
    return { provider: this.name, messageId: r.messages?.[0]?.id };
  }
  async send(to: string, body: string, opts?: { template?: string; params?: string[] }): Promise<SendResult> {
    // Business-initiated notifications: generic approved template with a single {{1}} body parameter.
    const template = opts?.template ?? this.cfg.META_WA_NOTIFY_TEMPLATE;
    const params = opts?.params ?? [body];
    const r = await postJson(
      this.url(),
      {
        messaging_product: 'whatsapp',
        to: digitsOnly(to),
        type: 'template',
        template: {
          name: template,
          language: { code: this.cfg.META_WA_TEMPLATE_LANG },
          components: [{ type: 'body', parameters: params.map((p) => ({ type: 'text', text: p })) }],
        },
      },
      this.headers(),
      this.name,
    );
    return { provider: this.name, messageId: r.messages?.[0]?.id };
  }
}

// ---------------------------------------------------------------------------
// SMTP email (Mailpit locally; SES/SendGrid/Zoho SMTP in production).
// ---------------------------------------------------------------------------
export class SmtpEmail implements EmailProvider {
  readonly name = 'smtp';
  private readonly transport: nodemailer.Transporter;
  constructor(private readonly cfg: NotificationConfig['env']) {
    this.transport = nodemailer.createTransport({
      host: cfg.SMTP_HOST,
      port: cfg.SMTP_PORT,
      secure: cfg.SMTP_SECURE,
      auth: cfg.SMTP_USER ? { user: cfg.SMTP_USER, pass: cfg.SMTP_PASSWORD } : undefined,
    });
  }
  async send(to: string, subject: string, text: string, html?: string): Promise<SendResult> {
    const info = await this.transport.sendMail({ from: this.cfg.EMAIL_FROM, to, subject, text, html });
    return { provider: this.name, messageId: info.messageId };
  }
}
