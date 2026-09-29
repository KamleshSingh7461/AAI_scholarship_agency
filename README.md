# Alumni Connect India — Scholarship Platform

The control system for the Alumni Association of India programme (EUSAI Team Pvt Ltd): partner universities
transfer athletic scholarships to us; athletes build one profile, apply, pay a fee, get approved by the
university, e-sign two agreements, and renew every year. Every scholarship is tracked as a quantified,
auditable record, and the finance ledger books its value the day it is granted.

```
                ┌──────────────────┐   ┌───────────────────┐   ┌──────────────────┐
  Browsers ───▶ │ web-public :3000 │   │ web-student :3001 │   │ web-admin :3002  │   Next.js 15 (each proxies /api → gateway)
                └────────┬─────────┘   └─────────┬─────────┘   └────────┬─────────┘
                         └───────────────────────┼──────────────────────┘
                                          ┌──────▼──────┐
  Gateways (Razorpay/Cashfree/PayU) ────▶ │ api-gateway │ :8080  routing · rate limits · CORS · blocks /internal
  DocuSign Connect ─────────────────────▶ └──────┬──────┘
          ┌──────────┬──────────┬────────────┬───┴───────┬──────────┬──────────┬──────────────┬──────────┐
       auth:4001 athlete:4002 university:4003 application:4004 payment:4005 esign:4006 document:4007 notification:4008 finance:4009
          │  each service owns its own PostgreSQL database; they talk via RabbitMQ events (outbox/inbox)  │
          └──────────────────────── Redis (rate limits, locks) · S3/SeaweedFS (files) ──────────────────────────┘
```

| Folder | What it is |
| --- | --- |
| `apps/web-public` | Public landing site: scholarships catalog (INR), program pages, about/contact/privacy/terms |
| `apps/web-student` | Athlete portal: OTP login, 4-step sign-up wizard, apply & pay, sign agreements, yearly renewals, documents, receipts |
| `apps/web-admin` | Admin/control panel: dashboard, students roster, applications, athlete verification, signed paperwork, renewals, money & value, reports, universities/MoUs/allocations, programs, payments, settings |
| `services/auth-service` | Phone OTP (WhatsApp/SMS), RS256 JWT, rotating refresh tokens, staff users & roles |
| `services/athlete-service` | Athlete profile (personal, academic, sports metrics, documents, references, guardian) + verification |
| `services/university-service` | Universities, MoUs, annual scholarship allocations (transfer letters), programs (value, fees), seat inventory, public catalog |
| `services/application-service` | Application workflow, awards (the scholarship ledger per athlete), yearly renewals, daily lifecycle job, dashboards |
| `services/payment-service` | Razorpay / Cashfree / PayU / mock gateway, webhooks, refunds, reconciliation |
| `services/esign-service` | Versioned agreement templates, PDF generation, DocuSign embedded signing (+ local mock), audit trail |
| `services/document-service` | S3 presigned uploads/downloads with type verification and access control |
| `services/notification-service` | WhatsApp (Meta/Twilio), SMS (MSG91/Twilio), email; templates; retrying delivery queue |
| `services/finance-service` | Double-entry ledger: revenue at grant, yearly expense, commission, disbursements, FX, audit views, XLSX/CSV/PDF reports |
| `services/api-gateway` | The only internet-facing backend component |
| `packages/contracts` | Shared enums, event contracts, money/fee maths (unit-tested) |
| `packages/nest-common` | Shared backend kernel: config validation, auth guards, outbox/inbox messaging, Redis locks, health, audit |
| `packages/web-shared` | Shared frontend kernel: API client with silent refresh, auth, OTP login, UI components |
| `infra/` | Docker Compose (local infra, full local stack, production), Postgres init, Caddy (TLS), migrator |
| `env/` | `production.env.example` (template), `keys/` (local JWT keys, git-ignored) |
| `docs/` | Architecture, business flows, integrations, open decisions |

## Run it locally

Prerequisites: Node 22+, Docker Desktop (on Windows it needs WSL2: `wsl --install` in an admin PowerShell, then reboot).

```bash
npm install
npm run setup            # creates .env with random secrets + JWT key pair (env/keys)
npm run infra:up         # Postgres :55432, Redis, RabbitMQ (:15672 UI), S3 storage (:8888 file browser), Mailpit (:8025 UI)
npm run build            # shared packages, Prisma clients, all services and apps
npm run db:migrate       # applies migrations to all 9 databases
npm run db:seed          # creates the SUPER_ADMIN (SEED_SUPER_ADMIN_PHONE in .env)
npm run dev              # 9 services + gateway + 3 web apps with hot reload
npm run seed:demo        # (new terminal) IES University Bhopal, MoU, allocations, 3 published programs
npm run e2e              # full end-to-end smoke test through the real API
```

Open http://localhost:3000 (public), http://localhost:3001 (athletes), http://localhost:3002 (admin). Locally the
OTP is shown on screen and printed in the notification-service log; payments and e-signatures use built-in mock
providers so every flow works without third-party accounts. API docs: http://localhost:8080/docs.

Everything in containers instead: `npm run docker:up`.

## Production

See `infra/docker/docker-compose.prod.yml` and `env/production.env.example`. Services refuse to start in
`APP_ENV=production` with mock providers, dev OTP echo, or missing secrets. CI (`.github/workflows/ci.yml`)
builds, tests, checks migrations and pushes images to GHCR. Details: `docs/ARCHITECTURE.md` and `docs/INTEGRATIONS.md`.

Decisions still needed from management are listed in **`docs/OPEN-QUESTIONS.md`**.
