# SkyVault — Build Guide

> AI-powered roof survey and lead generation platform  
> Stack: Next.js 14 · Neon Postgres · Auth.js v5 · Cloudflare R2 · Anthropic Claude · Stripe · Resend · Vercel

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
| **Drone Operator** | Accepts capture jobs in their area, uploads images, receives automated payout |
| **Admin** | Manages users, verifies roofers, overrides reports, views metrics |

**Core value loop:** Customer uploads images → Claude Vision analyses them → branded PDF report generated → lead distributed to ≤3 subscribed roofers by postcode.

---

## 2. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 App Router (TypeScript) | Single codebase for all portals + API |
| Database | Neon (serverless Postgres) + Prisma ORM | Serverless-native, zero cold-start connection pooling |
| Auth | Auth.js v5 — Google OAuth + Resend magic link | No credential storage, fast setup |
| File Storage | Cloudflare R2 (S3-compatible) | No egress fees, presigned URLs |
| AI | Anthropic Claude claude-sonnet-4-6 (vision) | Structured JSON output, multimodal |
| PDF | @react-pdf/renderer | Pure JS, no headless Chrome, serverless safe |
| Email | Resend | Reliable transactional email, good DX |
| Payments | Stripe Checkout + webhooks | Subscriptions + one-time payments + Connect |
| UI | Tailwind CSS + Shadcn/ui | Fast to build, accessible |
| Hosting | Vercel (Pro) | 60s function timeout needed for analyse route |

---

## 3. Prerequisites

```bash
node --version   # 18+
npm --version    # 9+
```

Accounts needed before you start:

- [Neon](https://neon.tech) — free tier is fine for dev
- [Cloudflare](https://cloudflare.com) — R2 bucket (free 10GB/month)
- [Anthropic](https://console.anthropic.com) — API key
- [Stripe](https://stripe.com) — test mode is fine until launch
- [Resend](https://resend.com) — free tier (100 emails/day)
- [Google Cloud Console](https://console.cloud.google.com) — OAuth 2.0 credentials
- [Vercel](https://vercel.com) — Pro plan required (60s timeout)

---

## 4. Environment Setup

Copy `.env.example` to `.env.local` and fill in every value:

```bash
cp .env.example .env.local
```

### Full `.env.local` reference

```bash
# ── Neon (serverless Postgres) ─────────────────────────────────────────────
DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/skyvault?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://user:pass@ep-xxx.neon.tech/skyvault?sslmode=require"
# Note: DATABASE_URL uses pgbouncer for pooling. DIRECT_URL is used by Prisma migrate.

# ── Auth.js v5 ─────────────────────────────────────────────────────────────
AUTH_SECRET=""          # openssl rand -base64 32
AUTH_GOOGLE_ID=""       # Google Cloud Console → Credentials → OAuth 2.0
AUTH_GOOGLE_SECRET=""
AUTH_RESEND_KEY=""      # Resend API key — Auth.js uses this for magic link emails
NEXTAUTH_URL="http://localhost:3000"

# ── Cloudflare R2 ──────────────────────────────────────────────────────────
R2_ACCOUNT_ID=""        # Cloudflare dashboard → Account ID
R2_ACCESS_KEY_ID=""     # R2 → Manage R2 API Tokens
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME="skyvault-uploads"
R2_PUBLIC_URL=""        # Optional: custom domain or pub-xxx.r2.dev for public reads

# ── Anthropic ──────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY="sk-ant-..."

# ── Stripe ─────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."    # stripe listen --forward-to localhost:3000/api/subscriptions/webhook
STRIPE_BASIC_PRICE_ID="price_..."   # Basic plan recurring price (£49/mo)
STRIPE_PRO_PRICE_ID="price_..."     # Pro plan recurring price (£129/mo)
STRIPE_DRONE_PRICE_ID="price_..."   # One-time drone capture (£89)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# ── Resend ─────────────────────────────────────────────────────────────────
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="noreply@skyvault.co.uk"

# ── App ────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## 5. Database Setup (Neon + Prisma)

### 1. Create Neon project

1. Go to [neon.tech](https://neon.tech) → New Project → name it `skyvault`
2. Copy the **pooled connection string** → `DATABASE_URL`
3. Copy the **direct connection string** → `DIRECT_URL`

### 2. Run migration

```bash
npx prisma migrate dev --name init
```

This creates all 12 tables: `User`, `Account`, `Session`, `VerificationToken`, `Property`, `Survey`, `Image`, `Report`, `Lead`, `LeadClaim`, `DroneJob`, `Subscription`.

### 3. Generate client

```bash
npx prisma generate
```

### 4. Seed initial data

```bash
npx prisma db seed
```

Creates: 1 admin user, 1 sample roofer with active subscription, 1 sample survey with report.

### 5. Inspect data

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
   - `https://yourdomain.com/api/auth/callback/google`
4. Copy Client ID → `AUTH_GOOGLE_ID` and Client Secret → `AUTH_GOOGLE_SECRET`

### Cloudflare R2

1. Cloudflare dashboard → R2 → Create bucket → name: `skyvault-uploads`
2. R2 → Manage R2 API Tokens → Create token (Object Read & Write)
3. Copy Account ID → `R2_ACCOUNT_ID`, Access Key → `R2_ACCESS_KEY_ID`, Secret → `R2_SECRET_ACCESS_KEY`
4. Set CORS policy on the bucket (required for browser direct uploads):

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://skyvault.co.uk"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

### Stripe

1. [Stripe Dashboard](https://dashboard.stripe.com) → Test mode
2. Create Products:
   - **SkyVault Basic** → Recurring £49/month → copy Price ID → `STRIPE_BASIC_PRICE_ID`
   - **SkyVault Pro** → Recurring £129/month → copy Price ID → `STRIPE_PRO_PRICE_ID`
   - **Drone Capture** → One-time £89 → copy Price ID → `STRIPE_DRONE_PRICE_ID`
3. Webhooks → Add endpoint: `https://yourdomain.com/api/subscriptions/webhook`
   - Events to listen for: `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy Signing Secret → `STRIPE_WEBHOOK_SECRET`
4. For local testing: `stripe listen --forward-to localhost:3000/api/subscriptions/webhook`

### Resend

1. [resend.com](https://resend.com) → API Keys → Create Key
2. Add and verify your sending domain
3. Copy API key → `RESEND_API_KEY`

---

## 7. Folder Structure

```
roofAI/
├── ARCHITECTURE.drawio          # System architecture diagram
├── BUILD.md                     # This file
├── .env.example                 # Environment variable template
├── .env.local                   # Local secrets (gitignored)
├── next.config.ts               # serverComponentsExternalPackages for react-pdf
├── vercel.json                  # 60s timeout on analyse route
├── middleware.ts                # Role-based route protection
├── tailwind.config.ts
├── tsconfig.json
│
├── prisma/
│   ├── schema.prisma            # All 12 models, enums, indexes
│   └── seed.ts                  # Admin user, sample roofer + survey
│
├── public/
│   └── logo.svg
│
└── src/
    ├── app/
    │   ├── layout.tsx           # Root layout (Inter font, metadata)
    │   ├── page.tsx             # Marketing landing page
    │   ├── globals.css
    │   │
    │   ├── (auth)/
    │   │   ├── login/page.tsx   # Google OAuth + magic link sign-in
    │   │   └── verify/page.tsx  # "Check your email" page
    │   │
    │   ├── (customer)/          # Role group — protected by middleware
    │   │   ├── layout.tsx       # Sidebar nav shell
    │   │   ├── dashboard/page.tsx
    │   │   ├── properties/
    │   │   │   ├── page.tsx
    │   │   │   ├── new/page.tsx
    │   │   │   └── [id]/page.tsx
    │   │   ├── surveys/
    │   │   │   ├── new/page.tsx
    │   │   │   └── [id]/
    │   │   │       ├── page.tsx          # Image uploader + analyse trigger
    │   │   │       └── report/page.tsx   # Report viewer
    │   │   └── quotes/page.tsx
    │   │
    │   ├── (roofer)/
    │   │   ├── layout.tsx
    │   │   ├── dashboard/page.tsx
    │   │   ├── leads/
    │   │   │   ├── page.tsx             # Lead list (blurred until claimed)
    │   │   │   └── [id]/page.tsx        # Full lead + contact details
    │   │   ├── subscription/
    │   │   │   ├── page.tsx             # Plan picker
    │   │   │   └── success/page.tsx     # Post-checkout confirmation
    │   │   └── profile/page.tsx
    │   │
    │   ├── (operator)/
    │   │   ├── layout.tsx
    │   │   ├── dashboard/page.tsx
    │   │   └── jobs/[id]/page.tsx       # Job detail + image upload
    │   │
    │   ├── (admin)/
    │   │   ├── layout.tsx               # Dark sidebar
    │   │   ├── dashboard/page.tsx       # Revenue metrics
    │   │   ├── surveys/page.tsx
    │   │   ├── users/
    │   │   │   ├── page.tsx
    │   │   │   └── [id]/page.tsx        # Role change, verify roofer
    │   │   ├── roofers/page.tsx         # Pending verification queue
    │   │   └── reports/[id]/page.tsx    # Report override UI
    │   │
    │   └── api/
    │       ├── auth/[...nextauth]/route.ts
    │       ├── properties/
    │       │   ├── route.ts             # GET list, POST create
    │       │   └── [id]/route.ts        # GET, PUT, DELETE
    │       ├── surveys/
    │       │   ├── route.ts             # GET list, POST create
    │       │   └── [id]/
    │       │       ├── route.ts         # GET detail, PATCH
    │       │       ├── images/
    │       │       │   ├── route.ts     # GET list, POST register
    │       │       │   └── presign/route.ts  # POST → presigned PUT URL
    │       │       ├── analyse/route.ts # POST → full AI pipeline
    │       │       └── report/route.ts  # GET report + PDF URL
    │       ├── leads/
    │       │   ├── route.ts             # GET (roofer's leads)
    │       │   └── [id]/
    │       │       ├── route.ts         # GET (partial or full)
    │       │       └── claim/route.ts   # POST express interest
    │       ├── drone-jobs/
    │       │   ├── route.ts             # GET available, POST create
    │       │   └── [id]/
    │       │       ├── route.ts         # GET, PATCH (accept/complete)
    │       │       └── payout/route.ts  # POST trigger Stripe transfer
    │       ├── subscriptions/
    │       │   ├── checkout/route.ts    # POST → Stripe Checkout session
    │       │   ├── portal/route.ts      # POST → Stripe Customer Portal
    │       │   └── webhook/route.ts     # POST raw body — Stripe events
    │       └── admin/
    │           ├── metrics/route.ts
    │           ├── users/[id]/route.ts
    │           └── reports/[id]/route.ts
    │
    ├── components/
    │   ├── ui/                          # Shadcn/ui base components
    │   ├── layout/                      # Role-specific sidebars
    │   ├── surveys/
    │   │   ├── image-uploader.tsx       # Drag-drop → presign → XHR PUT
    │   │   └── survey-card.tsx
    │   ├── reports/
    │   │   ├── condition-score-gauge.tsx
    │   │   ├── defect-list.tsx
    │   │   ├── report-pdf-template.tsx  # @react-pdf/renderer Document
    │   │   └── report-viewer.tsx
    │   ├── leads/
    │   │   ├── lead-card.tsx            # Blurred vs unlocked states
    │   │   └── lead-claim-button.tsx
    │   └── subscription/
    │       ├── plan-card.tsx
    │       └── usage-meter.tsx
    │
    ├── lib/
    │   ├── auth.ts       # Auth.js config — providers, PrismaAdapter, role callbacks
    │   ├── prisma.ts     # Singleton PrismaClient (hot-reload safe)
    │   ├── r2.ts         # S3Client + presignedUpload + presignedRead + uploadBuffer
    │   ├── stripe.ts     # Stripe client + PLANS constant
    │   ├── resend.ts     # Email templates: reportReady, leadNotification
    │   ├── claude.ts     # analyzeRoof() → RoofAnalysis (Zod-validated JSON)
    │   ├── pdf.ts        # renderReportPDF() → Buffer
    │   └── utils.ts      # cn(), formatScore(), extractPostcodePrefix(), formatDate()
    │
    ├── hooks/
    │   ├── use-upload.ts       # presign → XHR PUT with per-file progress
    │   └── use-survey-poll.ts  # polls survey status every 3s until complete/failed
    │
    └── types/
        ├── next-auth.d.ts      # Augments session with id + role
        └── index.ts            # DefectItem, RoofAnalysis, LeadSummary
```

---

## 8. Data Models

### Enums

```
Role:               customer | roofer | operator | admin
PropertyType:       residential | commercial
SurveyType:         self_upload | drone_capture
SurveyStatus:       draft | pending | analysing | complete | failed
ImageValidation:    pending | valid | invalid
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
                      Survey ──  Report ──  Lead ──< LeadClaim >── User (roofer)
                      Survey ──  DroneJob >── User (operator)
User (roofer) ──  Subscription
```

### Key fields by model

| Model | Key fields |
|---|---|
| User | id, email, role, company, postcode, phone, verified |
| Property | ownerId, address, postcode, type |
| Survey | propertyId, customerId, type, status |
| Image | surveyId, s3Key, validationStatus, sortOrder |
| Report | surveyId, conditionScore (1-10), defectsJson, pdfS3Key, status |
| Lead | surveyId, reportId, postcode, maxRoofers (3), status |
| LeadClaim | leadId, rooferId, status, quoteAmount |
| DroneJob | surveyId, operatorId, status, payoutAmount (£30 default) |
| Subscription | rooferId, plan, stripeSubId, leadCount, currentPeriodEnd |

---

## 9. API Routes Reference

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| GET/POST | `/api/auth/[...nextauth]` | — | Auth.js catch-all |

### Properties
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/properties` | customer | List own properties |
| POST | `/api/properties` | customer | Create property |
| GET | `/api/properties/[id]` | owner/admin | Detail + surveys |
| PUT | `/api/properties/[id]` | owner/admin | Update |
| DELETE | `/api/properties/[id]` | owner/admin | Delete (blocks if active surveys) |

### Surveys
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/surveys` | any | List (role-scoped) |
| POST | `/api/surveys` | customer | Create survey |
| GET | `/api/surveys/[id]` | owner/operator/admin | Detail with images + report |
| PATCH | `/api/surveys/[id]` | owner/admin | Update notes |
| POST | `/api/surveys/[id]/images/presign` | owner/operator | Returns `{ s3Key, uploadUrl }` |
| POST | `/api/surveys/[id]/images` | owner/operator | Register image after upload |
| **POST** | **`/api/surveys/[id]/analyse`** | owner/admin | **Full AI pipeline (~30s)** |
| GET | `/api/surveys/[id]/report` | owner/roofer-with-claim/admin | Report JSON + PDF URL |

### Leads
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/leads` | roofer | Postcode-matched leads, paginated |
| GET | `/api/leads/[id]` | roofer | Partial (unclaimed) or full (claimed) |
| POST | `/api/leads/[id]/claim` | roofer | Express interest — validates subscription + cap |

### Drone Jobs
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/drone-jobs` | operator | Available jobs by postcode |
| GET | `/api/drone-jobs/[id]` | operator/admin | Job detail |
| PATCH | `/api/drone-jobs/[id]` | operator/admin | Accept / complete job |
| POST | `/api/drone-jobs/[id]/payout` | admin | Trigger Stripe transfer |

### Stripe
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/subscriptions/checkout` | roofer | Create Checkout session → `{ url }` |
| POST | `/api/subscriptions/portal` | roofer | Create Portal session → `{ url }` |
| POST | `/api/subscriptions/webhook` | Stripe sig | Handle subscription events |

### Admin
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/metrics` | admin | Revenue, survey counts, conversion |
| PATCH | `/api/admin/users/[id]` | admin | Role change, toggle verified |
| PATCH | `/api/admin/reports/[id]` | admin | Override score/defects |

---

## 10. Page Routes Reference

### Public
| Path | Description |
|---|---|
| `/` | Marketing landing (hero, how-it-works, pricing) |
| `/login` | Google OAuth + magic link |
| `/verify` | "Check your email" |

### Customer
| Path | Description |
|---|---|
| `/dashboard` | Survey count, quick actions, recent properties |
| `/properties` | Property list |
| `/properties/new` | Add property form |
| `/properties/[id]` | Property detail + survey history |
| `/surveys/new` | Survey type picker (self-upload / drone) |
| `/surveys/[id]` | Image uploader, analyse button, status polling |
| `/surveys/[id]/report` | Condition score, defect list, PDF download, quote CTA |
| `/quotes` | Quote request status |

### Roofer
| Path | Description |
|---|---|
| `/roofer/dashboard` | Lead feed, subscription status |
| `/roofer/leads` | Lead list (blurred if no subscription) |
| `/roofer/leads/[id]` | Full lead detail + customer contact (after claim) |
| `/roofer/subscription` | Plan picker (Basic £49 / Pro £129) |
| `/roofer/subscription/success` | Post-checkout confirmation |
| `/roofer/profile` | Company info, service postcodes |

### Operator
| Path | Description |
|---|---|
| `/operator/dashboard` | Available + active jobs |
| `/operator/jobs/[id]` | Job detail, image upload portal |

### Admin
| Path | Description |
|---|---|
| `/admin/dashboard` | MRR, surveys, subscriptions, leads |
| `/admin/surveys` | All surveys table |
| `/admin/users` | All users, role filter |
| `/admin/users/[id]` | User detail, role/verify controls |
| `/admin/roofers` | Pending verification queue |
| `/admin/reports/[id]` | Report override UI |

---

## 11. Core Flows

### A. Customer Self-Upload Flow

```
1. Customer creates account (Google or magic link)
2. Add property → /properties/new → POST /api/properties
3. Start survey → /surveys/new → POST /api/surveys { type: "self_upload" }
4. Upload images:
   a. Browser POSTs to /api/surveys/[id]/images/presign
   b. Server validates, generates R2 presigned PUT URL (15 min TTL)
   c. Browser PUTs file directly to R2 (bypasses Next.js server)
   d. Browser POSTs to /api/surveys/[id]/images to register s3Key in DB
5. Click "Analyse" → POST /api/surveys/[id]/analyse
   a. Sets survey.status = "analysing"
   b. Fetches images server-side, encodes to base64
   c. Calls Claude claude-sonnet-4-6 vision → structured JSON
   d. Validates JSON with Zod schema
   e. Renders PDF with @react-pdf/renderer → Buffer
   f. Uploads PDF to R2 at surveys/<id>/report.pdf
   g. Creates Report record in DB
   h. Sets survey.status = "complete"
   i. Distributes lead to ≤3 matching roofers (by postcode)
   j. Sends "report ready" email via Resend
6. Customer views report → /surveys/[id]/report
7. Customer clicks "Request Quotes" → Lead status confirmed open
```

### B. Drone Capture Flow

```
1. Customer starts survey → type: "drone_capture"
2. Redirected to Stripe Checkout (£89 one-time)
3. Stripe webhook: checkout.session.completed → creates DroneJob (status: posted)
4. Operator sees job in /operator/dashboard matching their postcode
5. Operator accepts → DroneJob.status = "accepted"
6. Operator captures images, uploads via /operator/jobs/[id]
   (same presign endpoint — ownership check extended to accepted operator)
7. Operator marks complete → triggers analyse pipeline automatically
8. Customer notified when report is ready (target: 48h from booking)
```

### C. Roofer Subscription + Lead Flow

```
1. Roofer registers → POST /api/auth (Google/email)
2. Selects plan → POST /api/subscriptions/checkout → Stripe Checkout
3. Stripe webhook: checkout.session.completed → creates Subscription record
4. When customer requests quotes:
   - distributeLeads() finds eligible roofers:
     * role = "roofer", verified = true
     * subscription.status = "active"
     * postcode prefix matches property (e.g. "SW1" matches "SW1A 1AA")
     * Basic plan: leadCount < 10
     * Pro plan: unlimited
   - Orders by: Pro plan first, then FIFO
   - Takes top 3 → creates Lead + LeadClaim records → sends email
5. Roofer sees lead in /roofer/leads (blurred: postcode, score, defect types only)
6. Roofer clicks "Express Interest" → POST /api/leads/[id]/claim
   - Validates subscription active + not at quota
   - Creates LeadClaim
   - Increments subscription.leadCount
   - Returns full report + customer name/email/phone
7. Lead.status = "closed" when maxRoofers (3) claims reached
8. On invoice.paid webhook: subscription.leadCount reset to 0
```

---

## 12. Build Phases

### Phase 1 — Foundation ✅ Complete

- [x] Next.js 14 scaffold with TypeScript + Tailwind
- [x] All dependencies installed
- [x] Prisma schema (12 models, all enums + indexes)
- [x] `src/lib/prisma.ts` — singleton PrismaClient
- [x] `src/lib/auth.ts` — Auth.js v5 (Google + Resend, PrismaAdapter, role callback)
- [x] `src/types/next-auth.d.ts` — session augmented with `id` + `role`
- [x] `middleware.ts` — role-based route protection
- [x] `/login` + `/verify` pages
- [x] Customer, Roofer, Operator, Admin layout shells
- [x] Customer + Roofer + Operator + Admin dashboard pages
- [x] Marketing landing page
- [x] `next.config.ts` — react-pdf external package
- [x] `vercel.json` — 60s timeout on analyse route
- [x] `.env.example` — all 18 variables documented

**Gate:** Sign in with Google → session has `id` + `role` → protected routes redirect correctly.

---

### Phase 2 — Image Upload 🔄 In Progress

- [x] `src/lib/r2.ts` — S3Client, `getPresignedUploadUrl()`, `getPresignedReadUrl()`, `uploadBuffer()`
- [x] `GET/POST /api/properties` + `GET/PUT/DELETE /api/properties/[id]`
- [x] `GET/POST /api/surveys` + `GET/PATCH /api/surveys/[id]`
- [x] `POST /api/surveys/[id]/images/presign`
- [x] `GET/POST /api/surveys/[id]/images`
- [x] `src/hooks/use-upload.ts` — presign → XHR PUT with progress
- [x] `src/hooks/use-survey-poll.ts` — 3s polling
- [x] `src/components/surveys/image-uploader.tsx`
- [x] `/properties` list + `/properties/new` form
- [ ] `/properties/[id]` detail page
- [ ] `/surveys/new` — survey type picker
- [ ] `/surveys/[id]` — upload page with analyse button

**Gate:** 5 images uploaded to R2 bucket, Image records in DB.

---

### Phase 3 — AI Pipeline & Reports

- [ ] `src/lib/claude.ts` — `analyzeRoof()` base64 images → Claude → Zod-parsed JSON
- [ ] `src/lib/pdf.ts` — `renderReportPDF()` → Buffer via `@react-pdf/renderer`
- [ ] `src/lib/resend.ts` — report-ready + lead-notification email templates
- [ ] `POST /api/surveys/[id]/analyse` — full 11-step pipeline
- [ ] `GET /api/surveys/[id]/report` — report JSON + PDF presigned URL
- [ ] `src/components/reports/condition-score-gauge.tsx`
- [ ] `src/components/reports/defect-list.tsx`
- [ ] `src/components/reports/report-pdf-template.tsx`
- [ ] `/surveys/[id]/report` — report viewer page

**Gate:** End-to-end: 5 images → report in DB → PDF in R2 → email received → report viewable in-app.

---

### Phase 4 — Roofer Subscriptions & Lead Flow

- [ ] `src/lib/stripe.ts` — Stripe client + PLANS constant
- [ ] `POST /api/subscriptions/checkout`
- [ ] `POST /api/subscriptions/portal`
- [ ] `POST /api/subscriptions/webhook` — raw body, Stripe sig verify, 4 events
- [ ] `distributeLeads()` — postcode match, pro-first, max 3
- [ ] `GET /api/leads` + `GET /api/leads/[id]` (partial vs full)
- [ ] `POST /api/leads/[id]/claim`
- [ ] `/roofer/leads` list (blurred until claimed)
- [ ] `/roofer/leads/[id]` full detail
- [ ] `/roofer/subscription` plan picker
- [ ] `/roofer/profile` postcode coverage

**Gate:** Roofer subscribes (Stripe test mode) → receives lead email → claims → sees full report + contact details.

---

### Phase 5 — Drone Operator Flow

- [ ] Extend `POST /api/surveys` — `drone_capture` type → Stripe Checkout redirect
- [ ] Webhook handler: drone checkout → create DroneJob
- [ ] `GET /api/drone-jobs` — available jobs by postcode
- [ ] `GET/PATCH /api/drone-jobs/[id]` — accept / complete
- [ ] `POST /api/drone-jobs/[id]/payout` — admin trigger
- [ ] `/operator/dashboard` — available + active jobs
- [ ] `/operator/jobs/[id]` — job detail + image upload (reuses `ImageUploader`)

**Gate:** Customer pays → DroneJob created → operator accepts → uploads → analysis pipeline runs automatically.

---

### Phase 6 — Admin & Hardening

- [ ] `/admin/surveys` — all surveys table with status filter
- [ ] `/admin/users` + `/admin/users/[id]` — role change, verify toggle
- [ ] `/admin/roofers` — pending verification queue
- [ ] `/admin/reports/[id]` — override score/defects/notes
- [ ] `GET /api/admin/metrics` — MRR, survey counts, lead conversion
- [ ] Zod validation on all API route inputs
- [ ] Rate limiting on `/api/surveys/[id]/analyse` (1 per survey)
- [ ] Pipeline error handling → `survey.status = "failed"` → retry email
- [ ] `prisma/seed.ts` — admin user + sample data
- [ ] OWASP Top 10 security review

**Gate:** Admin verifies roofer, overrides report, views revenue metrics.

---

## 13. Running Locally

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed sample data
npx prisma db seed

# Start dev server
npm run dev
# App runs at http://localhost:3000

# In a separate terminal — forward Stripe webhooks
stripe listen --forward-to localhost:3000/api/subscriptions/webhook

# Open Prisma Studio (optional)
npx prisma studio
```

---

## 14. Deploying to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "Initial SkyVault build"
git push origin main
```

### 2. Connect to Vercel

1. [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Framework Preset: **Next.js** (auto-detected)
3. Add all environment variables from `.env.local` (except `NEXTAUTH_URL` — set to your production domain)

### 3. Configure function timeout

`vercel.json` at project root already sets 60s on the analyse route:

```json
{
  "functions": {
    "src/app/api/surveys/[id]/analyse/route.ts": {
      "maxDuration": 60
    }
  }
}
```

> **Note:** Requires Vercel **Pro** plan. Hobby plan caps at 10s.

### 4. Update OAuth redirect URIs

Add your production domain to:
- Google Cloud Console → Authorised redirect URIs
- Auth.js `NEXTAUTH_URL` env var

### 5. Update Stripe webhook endpoint

Stripe Dashboard → Webhooks → Add endpoint:
`https://yourdomain.com/api/subscriptions/webhook`

---

## 15. Testing Checklist

### End-to-end smoke test

```
[ ] Sign in with Google → confirm session.user.role = "customer"
[ ] Create property → confirm Property record in DB
[ ] Create self-upload survey → confirm Survey record, status = "draft"
[ ] Upload 5 roof images → confirm Image records in DB + files in R2 bucket
[ ] Trigger analysis → confirm survey.status transitions: draft → analysing → complete
[ ] Confirm Report record in DB with conditionScore + defectsJson
[ ] Confirm PDF in R2 at surveys/<id>/report.pdf
[ ] Confirm "report ready" email received
[ ] View report at /surveys/[id]/report → score gauge + defect list visible
[ ] Download PDF → opens correctly

[ ] Register roofer account → role = "roofer"
[ ] Subscribe → Stripe test mode → Basic plan
[ ] Confirm Subscription record, status = "active"
[ ] Customer requests quotes → confirm Lead created
[ ] Confirm roofer receives lead notification email
[ ] Roofer claims lead → LeadClaim created, leadCount incremented
[ ] Roofer sees full report + customer contact details

[ ] Admin signs in → role = "admin"
[ ] Verify roofer → User.verified flips to true
[ ] Override report → Report.status = "overridden", adminNotes saved
[ ] Admin metrics dashboard shows correct counts

[ ] Drone operator registers → role = "operator"
[ ] Customer creates drone_capture survey → Stripe Checkout (test mode)
[ ] Confirm DroneJob created after checkout.session.completed webhook
[ ] Operator accepts job → DroneJob.status = "accepted"
[ ] Operator uploads images → confirm analysis pipeline runs
```

### Stripe webhook test events

```bash
# Simulate subscription created
stripe trigger checkout.session.completed

# Simulate invoice paid (resets leadCount)
stripe trigger invoice.paid

# Simulate subscription cancelled
stripe trigger customer.subscription.deleted
```

---

## 16. Architecture Notes

### Why images bypass the Next.js server

Browser uploads go **directly to Cloudflare R2** via a presigned URL. The Next.js server generates the URL (15-minute TTL) but never receives the image bytes. This means:
- No 4.5MB Vercel body size limit issue
- No wasted serverless compute on file transfer
- Images can be 20MB each without any server config change

### Why Claude gets base64 images, not URLs

R2 objects are private (no public read). Passing presigned URLs to Claude is unreliable — URLs expire and Claude may not follow redirects consistently. Instead, `lib/claude.ts` fetches each image server-side, encodes to base64, and passes as `image` blocks in the messages API. For 10 images at ~500KB each the payload is ~5MB, well within Claude's limits. Add `sharp` server-side to resize before encoding if images are large.

### Why the Stripe webhook uses `req.text()`, not `req.json()`

Stripe's signature verification (`stripe.webhooks.constructEvent`) requires the **raw request body as a string or Buffer**. Next.js App Router parses bodies automatically. Use `req.text()` in the webhook route to get the unparsed body, then pass it to `constructEvent`. Using `req.json()` will always fail verification.

### Why `@react-pdf/renderer` over Puppeteer

Puppeteer requires a headless Chrome binary — incompatible with Vercel's serverless environment without complex workarounds. `@react-pdf/renderer` is pure JavaScript, generates PDFs from React component trees server-side via `renderToBuffer()`, and runs in any Node.js context. The tradeoff is less CSS flexibility (custom layout engine), but it's more than sufficient for a structured report.

### Postcode matching strategy

**MVP:** Store roofer's coverage as `User.postcode` (single area prefix). Match leads by `property.postcode.startsWith(extractPostcodePrefix(roofer.postcode))` where `extractPostcodePrefix("SW1A 1AA") = "SW1"`.

**Post-MVP:** Add `postcodesCovered String[]` to User. Query with Prisma `hasSome`:
```typescript
where: { postcodesCovered: { hasSome: [leadPostcodePrefix] } }
```

### Lead distribution ordering

When distributing a lead to ≤3 roofers:
1. Filter: `verified = true`, `subscription.status = "active"`, postcode match, quota not exceeded
2. Order: Pro plan roofers first (unlimited leads), then Basic by subscription start date (FIFO)
3. Take first 3
4. Create LeadClaim + send notification email for each

### Auth.js session role

The `role` field is not on the session by default. It's added via the `session` callback in `lib/auth.ts` and type-augmented in `types/next-auth.d.ts`. Every API route that needs role checking calls `const session = await auth()` and reads `session.user.role`.

---

*Last updated: May 2026 — SkyVault MVP v1.0*
