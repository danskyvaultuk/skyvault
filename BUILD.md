# SkyVault — Build Guide

> AI-powered roof survey and lead generation platform
> Stack: Next.js 16 · Neon Postgres · Auth.js v5 · Cloudflare R2 · Anthropic Claude · Stripe · Resend · Vercel

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Prerequisites](#3-prerequisites)
4. [Environment Setup](#4-environment-setup)
5. [Database Setup (Neon + Prisma)](#5-database-setup-neon--prisma)
6. [External Services Setup](#6-external-services-setup)
7. [Folder Structure](#7-folder-structure)
8. [Data Models](#8-data-models)
9. [API Routes Reference](#9-api-routes-reference)
10. [Page Routes Reference](#10-page-routes-reference)
11. [Core Flows](#11-core-flows)
12. [Build Phases](#12-build-phases)
13. [Running Locally](#13-running-locally)
14. [Deploying to Vercel](#14-deploying-to-vercel)
15. [Testing Checklist](#15-testing-checklist)
16. [Architecture Notes](#16-architecture-notes)

---

## 1. Project Overview

SkyVault is a three-sided marketplace:

| User Type | What they do |
|---|---|
| **Customer** | Uploads roof images (or books a drone), receives an AI health report, requests quotes |
| **Roofer** | Pays a monthly subscription, receives pre-qualified leads with report data, contacts customers |
| **Drone Operator** | Accepts capture jobs in their area, uploads images, payout processed by admin |
| **Admin** | Manages users, verifies roofers, overrides reports, views metrics, impersonates any user |

**Core value loop:** Customer uploads images → Claude Vision analyses them → branded PDF report generated → lead distributed to ≤3 subscribed roofers by postcode.

**Live URL:** https://skyvault-7341.vercel.app (custom domain `skyvaultuk.com` — not yet pointed at Vercel)

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16.2.6 App Router (TypeScript) | Single codebase for all portals + API |
| Database | Neon (serverless Postgres) + Prisma ORM 6.x | Serverless-native, connection pooling via pgbouncer |
| Auth | Auth.js v5 — Google OAuth + Resend magic link | `allowDangerousEmailAccountLinking: true` on Google provider |
| File Storage | AWS S3 (eu-west-2) | Presigned URLs, 15-min upload TTL; lib file named r2.ts but uses AWS SDK |
| AI | Anthropic `claude-sonnet-4-5` (vision) | Structured JSON output, Zod-validated, Sharp image resizing |
| PDF | @react-pdf/renderer | Pure JS, serverless safe, includes photo annex page |
| Email | Resend | From: `noreply@skyvaultuk.com` (verified domain) |
| Payments | Stripe Checkout + webhooks | Subscriptions + drone deposit (£50); webhook at `/api/stripe/webhook` |
| UI | Tailwind CSS | No Shadcn/ui — plain Tailwind throughout |
| Hosting | Vercel (Pro) | 60s timeout on analyse + drone-jobs routes |
| Address lookup | Nominatim (OpenStreetMap) + postcodes.io | Free, no API key required |

---

## 3. Prerequisites

```bash
node --version   # 18+
npm --version    # 9+
```

Accounts needed:

- [Neon](https://neon.tech) — Postgres database
- [Cloudflare](https://cloudflare.com) — R2 bucket
- [Anthropic](https://console.anthropic.com) — API key
- [Stripe](https://stripe.com) — sandbox mode for development
- [Resend](https://resend.com) — verified domain `skyvaultuk.com`
- [Google Cloud Console](https://console.cloud.google.com) — OAuth 2.0 credentials
- [Vercel](https://vercel.com) — Pro plan required (60s timeout)

---

## 4. Environment Setup

### Full `.env.local` reference

```bash
# ── Neon (serverless Postgres) ─────────────────────────────────────────────
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
DIRECT_URL="postgresql://user:pass@ep-xxx.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
# DATABASE_URL uses pgbouncer pooler. DIRECT_URL is used by Prisma migrate only.

# ── Auth.js v5 ─────────────────────────────────────────────────────────────
AUTH_SECRET=""              # openssl rand -base64 32
AUTH_GOOGLE_ID=""           # Google Cloud Console → OAuth 2.0 Client ID
AUTH_GOOGLE_SECRET=""
AUTH_RESEND_KEY=""          # Resend API key — used by Auth.js for magic link emails
NEXTAUTH_URL="http://localhost:3000"

# ── Cloudflare R2 ──────────────────────────────────────────────────────────
AWS_REGION="eu-west-2"
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_S3_BUCKET_NAME="skyvault-uploads-786971594750"

# ── Anthropic ──────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY="sk-ant-..."

# ── Stripe ─────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_BASIC_PRICE_ID="price_..."    # Basic plan £49/mo recurring
STRIPE_PRO_PRICE_ID="price_..."      # Pro plan £129/mo recurring
# Note: drone deposit uses inline price_data (£50) — no STRIPE_DRONE_PRICE_ID needed
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# ── Resend ─────────────────────────────────────────────────────────────────
RESEND_API_KEY="re_..."
# RESEND_FROM_EMAIL defaults to noreply@skyvaultuk.com — no env var needed unless overriding

# ── App ────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## 5. Database Setup (Neon + Prisma)

### 1. Create Neon project

1. Go to [neon.tech](https://neon.tech) → New Project → name it `skyvault`
2. Copy the **pooled connection string** → `DATABASE_URL`
3. Copy the **direct connection string** → `DIRECT_URL`

### 2. Run migrations

```bash
npx prisma migrate deploy
```

### 3. Generate client

```bash
npx prisma generate
```

### 4. Inspect data

```bash
npx prisma studio
# Opens at http://localhost:5555
```

---

## 6. External Services Setup

### Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Authorised redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://skyvault-7341.vercel.app/api/auth/callback/google`
   - `https://skyvaultuk.com/api/auth/callback/google` (when custom domain is live)
4. Copy Client ID → `AUTH_GOOGLE_ID` and Client Secret → `AUTH_GOOGLE_SECRET`

### AWS S3

1. Bucket: `skyvault-uploads-786971594750` in `eu-west-2`
2. IAM user with S3 read/write permissions → copy Access Key + Secret → `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
3. Set CORS policy on the bucket (required for browser direct uploads):

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://skyvault-7341.vercel.app", "https://skyvaultuk.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

Note: `src/lib/r2.ts` is named after the original Cloudflare R2 spec but uses the AWS SDK and S3 env vars.

### Stripe

1. [Stripe Dashboard](https://dashboard.stripe.com) → Sandbox mode
2. Create Products:
   - **SkyVault Basic** → Recurring £49/month → copy Price ID → `STRIPE_BASIC_PRICE_ID`
   - **SkyVault Pro** → Recurring £129/month → copy Price ID → `STRIPE_PRO_PRICE_ID`
   - *(Drone deposit uses inline `price_data` — no product needed)*
3. Webhooks → Add endpoint: `https://skyvault-7341.vercel.app/api/stripe/webhook`
   - Events to subscribe: `checkout.session.completed`, `invoice.paid`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
   - Copy Signing Secret → `STRIPE_WEBHOOK_SECRET`

### Resend

1. Domain `skyvaultuk.com` already verified (DNS via Squarespace, eu-west-1 region)
2. Emails send from `noreply@skyvaultuk.com` — this is hardcoded as the default fallback in `src/lib/resend.ts`

---

## 7. Folder Structure

```
roofAI/
├── BUILD.md                     # This file
├── .env.local                   # Local secrets (gitignored)
├── next.config.ts               # serverComponentsExternalPackages for react-pdf
├── vercel.json                  # 60s timeout on analyse + drone-jobs routes
├── middleware.ts                # Role-based route protection
├── tailwind.config.ts
│
├── prisma/
│   ├── schema.prisma            # 12 models, enums, indexes
│   └── migrations/              # All applied migrations
│
└── src/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx             # Marketing landing page
    │   │
    │   ├── (auth)/
    │   │   ├── login/page.tsx   # Google OAuth + magic link
    │   │   ├── register/page.tsx
    │   │   └── verify/page.tsx
    │   │
    │   ├── (customer)/
    │   │   ├── layout.tsx       # Sidebar nav (Dashboard, Surveys, Properties, My Quotes)
    │   │   ├── dashboard/page.tsx
    │   │   ├── properties/
    │   │   │   ├── page.tsx
    │   │   │   ├── new/page.tsx      # With Nominatim address autocomplete
    │   │   │   └── [id]/page.tsx
    │   │   ├── surveys/
    │   │   │   ├── page.tsx          # All surveys list
    │   │   │   ├── new/page.tsx      # Survey type picker (self-upload / drone)
    │   │   │   └── [id]/
    │   │   │       ├── page.tsx      # Uploader, notes field, analyse button
    │   │   │       ├── drone-booking.tsx  # Calendar picker + £50 Stripe deposit
    │   │   │       └── report/page.tsx    # Report viewer + photo gallery
    │   │   └── quotes/page.tsx
    │   │
    │   ├── roofer/
    │   │   ├── layout.tsx
    │   │   ├── dashboard/page.tsx
    │   │   ├── leads/
    │   │   │   ├── page.tsx          # Lead list (blurred until claimed)
    │   │   │   └── [id]/
    │   │   │       ├── page.tsx      # Full lead + customer contact (post-claim)
    │   │   │       └── claim-button.tsx
    │   │   ├── subscription/
    │   │   │   ├── page.tsx          # Plan picker (Basic £49 / Pro £129)
    │   │   │   └── success-banner.tsx
    │   │   └── profile/
    │   │       ├── page.tsx          # Company info, postcode coverage
    │   │       └── profile-form.tsx
    │   │
    │   ├── drone/                    # Drone operator portal (spec called this /operator/)
    │   │   ├── layout.tsx
    │   │   ├── dashboard/page.tsx    # Available + active jobs
    │   │   └── jobs/[id]/page.tsx    # Accept, upload images, mark complete
    │   │
    │   ├── admin/
    │   │   ├── layout.tsx            # Dark sidebar
    │   │   ├── dashboard/page.tsx    # User/survey/lead counts + recent activity
    │   │   ├── surveys/page.tsx
    │   │   ├── users/
    │   │   │   ├── page.tsx          # All users + role filter + impersonate button
    │   │   │   ├── role-changer.tsx
    │   │   │   ├── impersonate-button.tsx
    │   │   │   └── delete-button.tsx
    │   │   └── roofers/
    │   │       ├── page.tsx          # Verification queue
    │   │       └── verify-toggle.tsx
    │   │
    │   └── api/
    │       ├── auth/[...nextauth]/route.ts
    │       ├── auth/register/route.ts
    │       ├── properties/
    │       │   ├── route.ts
    │       │   └── [id]/route.ts
    │       ├── surveys/
    │       │   ├── route.ts
    │       │   └── [id]/
    │       │       ├── route.ts
    │       │       ├── images/route.ts
    │       │       ├── images/presign/route.ts
    │       │       └── analyse/route.ts       # Thin wrapper over lib/pipeline.ts
    │       ├── leads/
    │       │   ├── route.ts
    │       │   └── [id]/claim/route.ts
    │       ├── drone-jobs/
    │       │   ├── route.ts
    │       │   └── [id]/route.ts              # accept/complete — fires pipeline via waitUntil
    │       ├── stripe/
    │       │   ├── checkout/route.ts          # Roofer subscription checkout
    │       │   ├── drone-checkout/route.ts    # £50 drone deposit checkout
    │       │   ├── portal/route.ts            # Stripe Customer Portal
    │       │   └── webhook/route.ts           # All Stripe events
    │       ├── roofer/profile/route.ts
    │       └── admin/
    │           ├── impersonate/route.ts       # JWT cookie swap for impersonation
    │           └── users/[id]/route.ts
    │
    ├── components/
    │   └── surveys/
    │       └── image-uploader.tsx    # Drag-drop → presign → XHR PUT with progress
    │
    └── lib/
        ├── auth.ts        # Auth.js v5 config — Google + Resend, PrismaAdapter, role JWT callback
        ├── prisma.ts      # Singleton PrismaClient
        ├── r2.ts          # S3Client, presignedUpload, presignedRead, uploadBuffer, generatePdfKey
        ├── stripe.ts      # Stripe client
        ├── resend.ts      # notifyCustomerReportReady(), notifyRooferNewLead()
        ├── claude.ts      # analyzeRoof() → RoofAnalysis (Zod-validated JSON)
        ├── pdf.tsx        # renderReportPDF() → Buffer (includes photo annex page)
        ├── pipeline.ts    # runAnalysisPipeline() — shared by analyse route + drone PATCH
        └── leads.ts       # distributeLeads() — creates Lead, emails eligible roofers
```

---

## 8. Data Models

### Enums

```
Role:               customer | roofer | drone | admin
                    (spec said "operator" — actual codebase uses "drone")
PropertyType:       residential | commercial
SurveyType:         self_upload | drone_capture
SurveyStatus:       draft | pending | analysing | complete | failed
ImageValidationStatus: pending | valid | invalid
ReportStatus:       draft | published | overridden
LeadStatus:         open | closed
LeadClaimStatus:    interested | quoted | won | lost
DroneJobStatus:     posted | accepted | in_progress | images_uploaded | complete | cancelled
SubscriptionPlan:   basic | pro
SubscriptionStatus: active | past_due | cancelled
```

### Model relationships

```
User ──< Property ──< Survey ──< Image
                      Survey ──  Report
                      Survey ──  DroneJob >── User (drone operator)
                      Survey ──  Lead ──< LeadClaim >── User (roofer)
User (roofer) ──  Subscription
```

### Key fields by model

| Model | Key fields |
|---|---|
| User | id, email, role, company, postcode, phone, verified |
| Property | ownerId, address, postcode, town, type |
| Survey | propertyId, customerId, type, status, notes |
| Image | surveyId, s3Key, originalFilename, validationStatus, sortOrder |
| Report | surveyId, conditionScore (1-10), defectsJson, pdfS3Key, status, adminNotes |
| Lead | surveyId, reportId, postcode, maxRoofers (3), status |
| LeadClaim | leadId, rooferId, status, quoteAmount |
| DroneJob | surveyId, operatorId, status, postcode, payoutAmount (£30 default), scheduledAt |
| Subscription | rooferId, plan, stripeSubId, leadCount, currentPeriodEnd, cancelAtPeriodEnd |

---

## 9. API Routes Reference

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| GET/POST | `/api/auth/[...nextauth]` | — | Auth.js catch-all |
| POST | `/api/auth/register` | — | Email/name registration |

### Properties
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/properties` | customer | List own properties |
| POST | `/api/properties` | customer | Create property |
| GET | `/api/properties/[id]` | owner/admin | Detail + surveys |
| PUT | `/api/properties/[id]` | owner/admin | Update |
| DELETE | `/api/properties/[id]` | owner/admin | Delete |

### Surveys
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/surveys` | any | List (role-scoped) |
| POST | `/api/surveys` | customer | Create survey |
| GET | `/api/surveys/[id]` | owner/drone/admin | Detail with images + report |
| PATCH | `/api/surveys/[id]` | owner/admin | Update notes; reset failed→draft |
| POST | `/api/surveys/[id]/images/presign` | owner/drone | Returns `{ s3Key, uploadUrl }` |
| POST | `/api/surveys/[id]/images` | owner/drone | Register image after upload |
| **POST** | **`/api/surveys/[id]/analyse`** | owner/admin | **Runs full AI pipeline (~30s)** |

### Leads
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/leads` | roofer | All leads (postcode filter not yet enforced) |
| POST | `/api/leads/[id]/claim` | roofer | Express interest — validates subscription + cap |

### Drone Jobs
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/drone-jobs` | drone/admin | All posted jobs |
| GET | `/api/drone-jobs/[id]` | drone/admin | Job detail |
| PATCH | `/api/drone-jobs/[id]` | drone/admin | Accept or complete job; complete auto-fires pipeline via `waitUntil` |

### Stripe
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/stripe/checkout` | roofer | Roofer subscription Checkout session |
| POST | `/api/stripe/drone-checkout` | customer | £50 drone deposit Checkout session |
| POST | `/api/stripe/portal` | roofer | Stripe Customer Portal session |
| POST | `/api/stripe/webhook` | Stripe sig | `checkout.session.completed`, `invoice.paid`, `customer.subscription.*`, `invoice.payment_failed` |

### Admin
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/admin/impersonate` | admin | Mint JWT for target user, set session cookie |
| PATCH | `/api/admin/users/[id]` | admin | Role change, toggle verified |

---

## 10. Page Routes Reference

### Public
| Path | Description |
|---|---|
| `/` | Marketing landing page |
| `/login` | Google OAuth + magic link |
| `/register` | Name + email registration |
| `/verify` | "Check your email" |

### Customer
| Path | Description |
|---|---|
| `/dashboard` | Survey count, quick actions, recent surveys |
| `/properties` | Property list |
| `/properties/new` | Add property — with address autocomplete (Nominatim) + postcode→town autofill |
| `/properties/[id]` | Property detail + survey history |
| `/surveys` | All surveys list with status |
| `/surveys/new` | Survey type picker (self-upload / drone capture) |
| `/surveys/[id]` | Image uploader, customer notes field, analyse button, status display |
| `/surveys/[id]/report` | Condition score, defect list, photo gallery, PDF download |
| `/quotes` | Quote request status (stub) |

### Roofer
| Path | Description |
|---|---|
| `/roofer/dashboard` | Lead feed, subscription status |
| `/roofer/leads` | Lead list (blurred until claimed) |
| `/roofer/leads/[id]` | Full lead detail + customer contact (after claim) |
| `/roofer/subscription` | Plan picker (Basic £49 / Pro £129) + Stripe portal |
| `/roofer/profile` | Company info, postcode coverage |

### Drone Operator
| Path | Description |
|---|---|
| `/drone/dashboard` | Available jobs + my accepted/completed jobs |
| `/drone/jobs/[id]` | Accept job, upload images, mark complete |

### Admin
| Path | Description |
|---|---|
| `/admin/dashboard` | User counts, roofer verification status, survey counts, open leads, recent claims |
| `/admin/surveys` | All surveys table |
| `/admin/users` | All users — role change, delete, impersonate |
| `/admin/roofers` | Roofer verification queue with toggle |

---

## 11. Core Flows

### A. Customer Self-Upload Flow

```
1. Customer signs in (Google or magic link)
2. Add property → /properties/new → address autocomplete → POST /api/properties
3. Start survey → /surveys/new → POST /api/surveys { type: "self_upload" }
4. Upload images (up to 10):
   a. Browser POSTs to /api/surveys/[id]/images/presign
   b. Server generates R2 presigned PUT URL (15 min TTL)
   c. Browser PUTs file directly to R2 (bypasses Next.js)
   d. Browser POSTs to /api/surveys/[id]/images to register s3Key
5. Optionally add notes/concerns (sent to Claude, injection-protected)
6. Click "Analyse" → POST /api/surveys/[id]/analyse → runAnalysisPipeline()
   a. survey.status = "analysing"
   b. Fetch images from R2, resize with Sharp, encode to base64
   c. Call Claude Vision → Zod-validated RoofAnalysis JSON
   d. Render PDF with @react-pdf/renderer (includes photo annex)
   e. Upload PDF to R2
   f. Create Report record in DB
   g. survey.status = "complete"
   h. distributeLeads() → creates Lead, emails eligible roofers
   i. notifyCustomerReportReady() → Resend email
7. Customer views report → /surveys/[id]/report
```

### B. Drone Capture Flow

```
1. Customer starts survey → type: "drone_capture"
2. Calendar picker → selects date/time → £50 Stripe Checkout
3. Stripe webhook: checkout.session.completed → creates DroneJob (status: posted, scheduledAt set)
4. Operator sees job in /drone/dashboard
5. Operator clicks job → Accept → DroneJob.status = "accepted"
6. Operator captures images, uploads via /drone/jobs/[id] (same presign endpoint)
7. Operator clicks "Mark job complete"
   → DroneJob.status = "images_uploaded"
   → waitUntil(runAnalysisPipeline()) fires in background
   → Operator gets instant confirmation
8. Pipeline runs: Claude → PDF → report → lead distributed → customer email
   (target: under 60 seconds from operator marking complete)
```

### C. Roofer Subscription + Lead Flow

```
1. Roofer registers → role = "roofer"
2. Goes to /roofer/subscription → selects plan → Stripe Checkout
3. Stripe webhook: customer.subscription.created → Subscription record created
4. When a customer report completes:
   - distributeLeads() finds all roofers with active subscription
   - Emails each eligible roofer with link to /roofer/leads/[id]
   - Note: postcode filtering not yet enforced — all active subscribers receive leads
5. Roofer sees lead in /roofer/leads (blurred: score + defect types only)
6. Roofer clicks "Express Interest" → LeadClaim created → leadCount incremented
   → Full report + customer name/email/phone revealed
7. Lead.status = "closed" when 3 claims reached
8. On invoice.paid: subscription.leadCount reset to 0 (Basic plan 10/month cap refreshes)
```

---

## 12. Build Phases

### Phase 1 — Foundation ✅ Complete

- [x] Next.js 16 scaffold with TypeScript + Tailwind
- [x] Prisma schema (12 models, all enums + indexes)
- [x] Auth.js v5 — Google OAuth + Resend magic link, PrismaAdapter, role JWT callback
- [x] `allowDangerousEmailAccountLinking: true` on Google provider
- [x] `middleware.ts` — role-based route protection
- [x] `/login`, `/register`, `/verify` pages
- [x] Customer, Roofer, Drone, Admin layout shells
- [x] Marketing landing page
- [x] `vercel.json` — 60s timeout on analyse + drone-jobs routes
- [x] All environment variables documented

---

### Phase 2 — Image Upload ✅ Complete

- [x] `src/lib/r2.ts` — S3Client, presigned upload/read, uploadBuffer, generatePdfKey
- [x] Properties CRUD API + pages
- [x] Surveys CRUD API
- [x] Presign → R2 direct upload flow
- [x] `image-uploader.tsx` — drag-drop with per-file progress
- [x] `/properties/new` with Nominatim address autocomplete + postcodes.io town autofill
- [x] `/properties/[id]` detail page
- [x] `/surveys/new` — survey type picker
- [x] `/surveys/[id]` — image uploader + customer notes field + analyse button
- [x] `/surveys` — all surveys list

---

### Phase 3 — AI Pipeline & Reports ✅ Complete

- [x] `src/lib/claude.ts` — `analyzeRoof()` with Zod-validated JSON, prompt injection protection
- [x] `src/lib/pdf.tsx` — `renderReportPDF()` with photo annex page
- [x] `src/lib/pipeline.ts` — `runAnalysisPipeline()` shared function (10 steps)
- [x] `src/lib/resend.ts` — `notifyCustomerReportReady()` + `notifyRooferNewLead()`
- [x] `POST /api/surveys/[id]/analyse` — validates then calls pipeline
- [x] Sharp image resizing before Claude (max 1568px, JPEG, ~500KB each)
- [x] `/surveys/[id]/report` — score gauge, defects, recommendations, photo gallery, PDF download
- [x] `survey.status = "failed"` on pipeline error with retry flow

---

### Phase 4 — Roofer Subscriptions & Lead Flow ✅ Complete

- [x] `src/lib/stripe.ts` — Stripe client
- [x] `POST /api/stripe/checkout` — subscription checkout
- [x] `POST /api/stripe/portal` — Stripe Customer Portal
- [x] Webhook: `customer.subscription.created/updated/deleted`, `invoice.paid` (leadCount reset), `invoice.payment_failed`
- [x] `distributeLeads()` — creates Lead, emails all active roofers
- [x] `GET /api/leads` + `POST /api/leads/[id]/claim`
- [x] `/roofer/leads` — blurred list
- [x] `/roofer/leads/[id]` — full detail + customer contact post-claim
- [x] `/roofer/subscription` — plan picker + portal button
- [x] `/roofer/profile` — company info + postcode

**Known gap:** Lead distribution emails all active subscribers regardless of postcode. Postcode filtering spec'd but not yet enforced.

---

### Phase 5 — Drone Operator Flow ✅ Complete

- [x] `/surveys/[id]/drone-booking.tsx` — calendar UI (next 30 days, 4 time slots)
- [x] `POST /api/stripe/drone-checkout` — £50 inline deposit checkout with scheduledAt metadata
- [x] Webhook: `checkout.session.completed` → creates DroneJob
- [x] `GET /api/drone-jobs` — all posted jobs
- [x] `PATCH /api/drone-jobs/[id]` — accept / complete; complete uses `waitUntil` to auto-fire pipeline
- [x] `/drone/dashboard` — available + my jobs
- [x] `/drone/jobs/[id]` — accept, upload images, mark complete

**Known gap:** Drone operator payout (`/api/drone-jobs/[id]/payout`) not built. Admin manually processes payouts. Deferred — founder is sole operator at launch.

**Known gap:** Drone dashboard shows all posted jobs with no postcode filter.

---

### Phase 6 — Admin & Hardening ⚠️ Partially Complete

- [x] `/admin/dashboard` — user/survey/lead counts + recent surveys + recent claims
- [x] `/admin/surveys` — all surveys table
- [x] `/admin/users` — all users, role change, delete, **impersonate** (bonus)
- [x] `/admin/roofers` — verification queue with toggle
- [x] `POST /api/admin/impersonate` — JWT cookie mint for any user (admin only)
- [ ] `/admin/reports/[id]` — report override UI (score/defects/notes) — **NOT BUILT**
- [ ] `GET /api/admin/metrics` — MRR calculation — **NOT BUILT** (counts exist, revenue figure missing)
- [ ] Zod validation on API route inputs — **NOT DONE**
- [ ] Rate limiting on analyse route — **NOT DONE**
- [ ] `prisma/seed.ts` — demo data — **NOT BUILT**
- [ ] OWASP security review — **NOT DONE**
- [ ] Rename `src/lib/r2.ts` → `src/lib/s3.ts` and update all imports (cosmetic — file uses AWS SDK but retains old Cloudflare R2 name)

---

## 13. Running Locally

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Start dev server
npm run dev
# App at http://localhost:3000
```

---

## 14. Deploying to Vercel

### Current deployment

- **URL:** https://skyvault-7341.vercel.app
- **Repo:** github.com/danskyvaultuk/skyvault
- **Branch:** main (auto-deploys on push)

### Environment variables to set in Vercel

All variables from `.env.local` except:
- `NEXTAUTH_URL` — set to `https://skyvault-7341.vercel.app` (or custom domain when live)
- `NEXT_PUBLIC_APP_URL` — set to `https://skyvault-7341.vercel.app`

### Go-live checklist (when ready)

- [ ] Point `skyvaultuk.com` → Vercel (add domain in Vercel project settings)
- [ ] Update Google OAuth redirect URIs to include `https://skyvaultuk.com/api/auth/callback/google`
- [ ] Update `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` in Vercel to `https://skyvaultuk.com`
- [ ] Switch Stripe from sandbox to live mode:
  - New live webhook endpoint + signing secret
  - Live `STRIPE_SECRET_KEY`, `STRIPE_BASIC_PRICE_ID`, `STRIPE_PRO_PRICE_ID`
  - Live `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] Update AWS S3 CORS policy to include `https://skyvaultuk.com`
- [ ] Redeploy after all env var changes

---

## 15. Testing Checklist

### Self-upload flow
```
[ ] Sign in with Google → role = "customer"
[ ] Create property → address autocomplete works
[ ] Create self-upload survey
[ ] Upload images → files appear in R2 bucket
[ ] Add customer notes
[ ] Click "Analyse" → survey transitions: draft → analysing → complete
[ ] Report email received at customer address
[ ] View report → score, defects, photo gallery, PDF download all work
```

### Drone capture flow
```
[ ] Create drone_capture survey
[ ] Calendar picker visible → select date + time
[ ] £50 Stripe Checkout (sandbox) → payment succeeds
[ ] DroneJob created in DB (via checkout.session.completed webhook)
[ ] Switch to drone operator → job appears in /drone/dashboard
[ ] Accept job → upload images → mark complete
[ ] Survey auto-analyses → report ready without any customer action
[ ] Customer receives report email
```

### Roofer subscription + lead flow
```
[ ] Register roofer account
[ ] Subscribe via Stripe (sandbox) → Subscription record active
[ ] Complete a customer survey → roofer receives lead email
[ ] Roofer claims lead → full contact details revealed → leadCount incremented
[ ] Simulate invoice.paid → leadCount resets to 0
```

### Admin
```
[ ] Sign in as admin
[ ] Verify a roofer → User.verified = true
[ ] Impersonate customer, roofer, drone operator → each portal loads correctly
[ ] View /admin/surveys, /admin/users, /admin/roofers
```

---

## 16. Architecture Notes

### Why images bypass the Next.js server

Browser uploads go **directly to AWS S3** via presigned URLs. The server generates the URL (15-min TTL) but never touches the bytes. No 4.5MB Vercel body limit, no compute cost on upload.

### Why Claude gets base64 images, not URLs

S3 objects are private. Presigned URLs passed to Claude are unreliable (may expire mid-request). The pipeline fetches each image server-side, resizes with Sharp (max 1568px, JPEG, ~500KB), encodes to base64, and passes as `image` blocks. 10 images ≈ 5MB payload — well within Claude's limits.

### Why `waitUntil` is used on the drone-jobs route

When a drone operator marks a job complete, the PATCH handler returns immediately so the operator gets instant feedback. `waitUntil` from `@vercel/functions` keeps the serverless function alive for the full pipeline duration (up to 60 seconds) even after the response is sent. Without it, Vercel terminates the function on response, killing the background pipeline.

### Why `lib/pipeline.ts` exists

Both the manual analyse route (`POST /api/surveys/[id]/analyse`) and the auto-trigger after drone job completion (`PATCH /api/drone-jobs/[id]`) run the same 10-step pipeline. Extracting it into `runAnalysisPipeline(surveyId)` keeps the logic in one place and makes both entry points thin wrappers.

### Postcode matching — current vs spec

**Current:** `distributeLeads()` sends to all roofers with an active subscription regardless of postcode. Fast to implement, acceptable at low volume.

**Spec:** Filter by `outwardCode(property.postcode)` matching `outwardCode(roofer.postcode)`. To implement: add the `where: { postcode: { startsWith: outwardCode } }` filter back into the `findMany` in `lib/leads.ts`.

### Stripe webhook path

The spec specified `/api/subscriptions/webhook`. The actual path is `/api/stripe/webhook`. All Stripe events (subscriptions + drone deposits) go to this single endpoint.

### Auth.js session role

`role` is added to the JWT in the `jwt` callback in `lib/auth.ts` and type-augmented in `types/next-auth.d.ts`. A DB lookup runs on first sign-in if the role isn't already in the token (handles users whose role was changed after their token was issued).

### ODM GLB orientation fix — Z-up to Y-up

**Problem:** OpenDroneMap exports GLB/OBJ files in a **Z-up coordinate system** (geospatial/GIS convention). The glTF format and `model-viewer` expect **Y-up** (WebGL/3D convention). This makes the model appear standing vertically (90° tilted) instead of lying flat.

**Fix — bake the rotation into the file (do this once per model):**

```js
const fs = require('fs');
const buf = fs.readFileSync('model.glb');
const jsonLength = buf.readUInt32LE(12);
const json = JSON.parse(buf.slice(20, 20 + jsonLength).toString('utf8'));

// -90° rotation around X axis (column-major 4×4 matrix):
// Transforms Z (ODM up) → Y (glTF up)
json.nodes[0].matrix = [1, 0, 0, 0,   0, 0, -1, 0,   0, 1, 0, 0,   0, 0, 0, 1];

let newJson = JSON.stringify(json);
while (newJson.length % 4 !== 0) newJson += ' ';
const newJsonBuf = Buffer.from(newJson, 'utf8');

const origBin = buf.slice(20 + jsonLength);
const totalLen = 12 + 8 + newJsonBuf.length + origBin.length;
const out = Buffer.alloc(totalLen);
out.writeUInt32LE(0x46546C67, 0);   // GLB magic
out.writeUInt32LE(2, 4);            // version
out.writeUInt32LE(totalLen, 8);
out.writeUInt32LE(newJsonBuf.length, 12);
out.writeUInt32LE(0x4E4F534A, 16);  // JSON chunk type
newJsonBuf.copy(out, 20);
origBin.copy(out, 20 + newJsonBuf.length);
fs.writeFileSync('model_yup.glb', out);
```

**Key facts:**
- Only applies to GLB files generated by ODM (via trimesh export). Check with: if `Z extent << X/Y extents` in the bounding box, the model is Z-up.
- Baking it into the file is preferred over the `orientation` runtime attribute on `model-viewer` — the attribute is unreliable and requires a code deploy; the file fix works everywhere.
- The rotation matrix `[1,0,0,0, 0,0,-1,0, 0,1,0,0, 0,0,0,1]` is a -90° X rotation in column-major order. It maps Z→Y and Y→-Z.
- After fixing, upload to S3 and the model renders correctly in `model-viewer`, desktop 3D apps, and any glTF viewer.

---

*Last updated: June 2026 — SkyVault MVP v1.1 + Blog/3D viewer*
