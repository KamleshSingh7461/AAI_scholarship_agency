# Third-party integrations — go-live checklist

Every provider sits behind an interface; switch with one env variable. Local development uses mock/console providers.
The adapters follow each provider's published API, but **each must be exercised against its sandbox with real
credentials before go-live** (they could not be tested without accounts).

## Payments — `PAYMENT_PROVIDER=razorpay|cashfree|payu`

Use whichever gateway approves the account first; switching later only changes env vars.

| Gateway | Credentials | Webhook URL to register | Events |
| --- | --- | --- | --- |
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | `https://api.<domain>/api/v1/payments/webhooks/razorpay` | `order.paid`, `payment.captured`, `payment.failed`, `refund.processed` |
| Cashfree | `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENV` | `https://api.<domain>/api/v1/payments/webhooks/cashfree` (also sent per order as `notify_url`) | payment success / failed / user dropped |
| PayU | `PAYU_MERCHANT_KEY`, `PAYU_MERCHANT_SALT`, `PAYU_ENV` | surl/furl are set automatically to `/api/v1/payments/payu/callback`; optional server webhook `/api/v1/payments/webhooks/payu` | success / failure |

Razorpay: enable auto-capture. All: amounts are verified server-side; a 5-minute reconciliation job catches missed webhooks.

## E-signature — DocuSign (`ESIGN_PROVIDER=docusign`)

1. Create an Integration Key (Apps & Keys), add an RSA keypair → `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_PRIVATE_KEY(_FILE)`.
2. Add redirect URI `https://app.<domain>/agreements/return`.
3. `DOCUSIGN_USER_ID` = API user GUID; `DOCUSIGN_ACCOUNT_ID` = API account id; `DOCUSIGN_BASE_PATH` from *Account base URI*
   (India data residency: `https://in.docusign.net/restapi`).
4. Grant consent once as that user:
   `https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=<KEY>&redirect_uri=<URI>` (use `account.docusign.com` in production).
5. Connect: add a custom Connect configuration → URL `https://api.<domain>/api/v1/esign/webhooks/docusign`, JSON (SIM),
   events *Envelope Sent/Delivered/Completed/Declined/Voided*, enable HMAC → `DOCUSIGN_CONNECT_HMAC_KEY`.
6. Optional company countersignature: set `COMPANY_SIGNATORY_EMAIL`.

Athletes sign inside the portal (embedded signing). If Connect is delayed, the portal calls a status sync on return.
**Agreement texts** are versioned in *Settings → Agreement templates*; the seeded texts are drafts for legal review.

## WhatsApp & SMS

- **WhatsApp (Meta Cloud API)** — `WHATSAPP_PROVIDER=meta`, `META_WA_PHONE_NUMBER_ID`, `META_WA_ACCESS_TOKEN` (system-user
  token). Create and get approved: an *Authentication* template `aci_login_otp` (with copy-code button) and a *Utility*
  template `aci_notification` with one body parameter `{{1}}`. Per-message templates can be set in Settings.
- **SMS (MSG91)** — `SMS_PROVIDER=msg91`. India requires **TRAI DLT** registration: register the entity, the sender ID
  (header) and every SMS template; put the OTP template id in `MSG91_OTP_TEMPLATE_ID` and flow ids per template in Settings.
- **Twilio** — alternative for both channels (`twilio`), useful for international numbers.
- OTPs fall back from WhatsApp to SMS automatically.

## Email
Any SMTP (Amazon SES ap-south-1, Zoho, SendGrid). Locally Mailpit catches everything at http://localhost:8025.

## Storage
AWS S3 (or any S3-compatible store: R2, Spaces, SeaweedFS). Private bucket, SSE enabled, CORS allowing `POST` from the student/admin origins:

```json
[{ "AllowedOrigins": ["https://app.<domain>", "https://admin.<domain>"], "AllowedMethods": ["POST", "GET"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 3000 }]
```
