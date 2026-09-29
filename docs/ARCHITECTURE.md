# Architecture

## Principles

- **Database per service.** Each service owns its PostgreSQL database and its own DB user; no service reads another's
  tables. Cross-service data is obtained by a synchronous internal call (only when an answer is needed *now*) or by
  consuming events and keeping a local projection (e.g. finance keeps `award_ledgers`).
- **Reliable events.** State changes and their events are written in the same DB transaction (transactional
  **outbox**); a relay publishes to RabbitMQ with publisher confirms. Consumers record each processed event id in
  `processed_events` inside the same transaction as their own writes (**inbox**), so redelivery is harmless.
  Failed messages retry with a delay queue and land in `<service>.events.dead` after 6 attempts.
- **Zero-trust auth.** The gateway routes; every service verifies the RS256 access token itself. Service-to-service
  endpoints live under `/internal/*`, require `x-internal-token`, and are blocked by the gateway.
- **Money is integers.** Minor units (paise/cents) everywhere, percentages in basis points, FX as rate×10000. Each
  award snapshots the USD↔INR rate at grant so history never restates.
- **Idempotency everywhere it matters.** Payment orders are reused per reference; webhook events are de-duplicated by
  provider event id; journal entries have unique idempotency keys; seat counters change via single conditional
  `UPDATE`s; application transitions use optimistic concurrency.

## Services and ports

| Service | Port | Owns |
| --- | --- | --- |
| api-gateway | 8080 | nothing (stateless; Redis for rate limits) |
| auth | 4001 | users, OTP challenges, sessions |
| athlete | 4002 | athlete profiles, academics, sports metrics, document links, references |
| university | 4003 | universities, MoUs, allocations, programs, seat reservations |
| application | 4004 | applications, status history, notes, awards, award years |
| payment | 4005 | payment orders, webhook log, refunds |
| esign | 4006 | agreement templates (versioned), envelopes, signing event log |
| document | 4007 | document metadata (bytes in S3) |
| notification | 4008 | templates, delivery log/queue |
| finance | 4009 | FX rates, award ledger projection, journal, expense schedule, disbursements, report runs |

## Event catalogue (topic exchange `aci.events`)

| Event | Producer | Consumers |
| --- | --- | --- |
| `auth.user.registered` | auth | notification (welcome) |
| `athlete.profile.submitted` / `.reviewed` | athlete | notification |
| `application.submitted` / `.status_changed` | application | notification |
| `payment.succeeded` / `.failed` / `.refunded` | payment | application (submit), finance (fee income), notification |
| `award.offered` | application | notification (sign agreements) |
| `esign.envelope.signed` / `.declined` / `.viewed` / `.expired` | esign | application (activate / renew) |
| `award.activated` | application | finance (book revenue, schedule, commission), notification |
| `award.renewal_due` / `.renewal_opened` / `.renewed` | application | notification, finance (recognise year) |
| `award.suspended` / `.reinstated` / `.revoked` / `.completed` / `.expired` | application | finance, notification |
| `award.university_confirmed` | application | finance (audit view) |
| `notification.requested` | any | notification |

## Synchronous internal calls

- application → athlete `GET /internal/athletes/by-user/:id` (eligibility snapshot)
- application → university `GET /internal/programs/:id`, `POST /internal/seats/{reserve,confirm,release,return}`
- application → payment `POST /internal/orders`, `POST /internal/orders/:id/refund`
- application → esign `POST /internal/envelopes`, `POST /internal/envelopes/:id/void`
- auth → notification `POST /internal/otp`
- athlete → document `POST /internal/documents/validate`
- esign/finance → document `POST /internal/documents` (store generated PDFs/reports)
- university → finance `GET /internal/fx/latest`

## Security model

- Login: phone + 6-digit OTP (WhatsApp default, SMS fallback). Codes are HMAC-hashed with a pepper, expire in 5 minutes,
  5 attempts, 30 s resend cooldown, per-number and per-IP hourly caps. Staff login is only for pre-registered staff and
  responds identically for unknown numbers (no enumeration).
- Tokens: 15-minute RS256 access token in browser memory; 30-day refresh token in an httpOnly, SameSite=Strict cookie on
  the app's own origin (the Next apps proxy `/api`), rotated on every use with reuse detection (a replayed token revokes
  the whole session family). Cookie endpoints require the `x-aci-client` header (CSRF).
- Roles: `SUPER_ADMIN`, `ADMIN`, `FINANCE`, `REVIEWER`, `UNIVERSITY_REP` (scoped to one university), `ATHLETE`.
- Files: private bucket; browser uploads straight to S3 via presigned POST pinned to key, type and size; the server
  verifies magic bytes before accepting; downloads are 5-minute presigned URLs after an access check; staff viewing an
  athlete's document is audit-logged. Signed agreements, MoUs and receipts cannot be deleted through the API.
- Webhooks: Razorpay HMAC, Cashfree timestamped HMAC, PayU reverse SHA-512 hash, DocuSign Connect HMAC — all over the raw
  body, all logged; payment amounts are cross-checked against the order.
- Audit: every staff mutation writes an `audit_logs` row (who, what, before/after, IP) in the owning service.
- Production guards: services refuse to boot with mock providers, dev OTP echo, or invalid config.

## Scheduled jobs (single-runner via Redis lock)

| Job | Where | When |
| --- | --- | --- |
| Award lifecycle (renewal due → open → overdue → suspended, completions, expired offers, retries, reminders) | application | daily 03:30 UTC (09:00 IST), `LIFECYCLE_CRON` |
| Payment reconciliation (missed webhooks, expiry) | payment | every 5 min |
| Envelope expiry | esign | hourly |
| Outbox relay | every service | every second |
| Notification delivery queue with exponential backoff | notification | every 2 s |

## Scaling

All services are stateless and can run multiple replicas behind the gateway; cron-style work is guarded by Redis locks
and row claiming uses `FOR UPDATE SKIP LOCKED`. Move to Kubernetes by turning each compose service into a Deployment
(the images, health endpoints `/health` and `/health/ready`, and env contract are already container-ready).
