# One System

**An operator platform for appointment-based businesses.**
Capture, nurture, reactivate, review, and convert — on one platform with shared data and workflows.

> **Status:** Reactivation module shipped end-to-end. Modules 1, 3, 4, 5 scoped, architected, and surface-complete. Portfolio build — actively under development.

---

## Live demo

- **App demo:** _deploying to Vercel — link incoming_
- **Landing:** _same domain, `/`_
- **Dashboard:** _same domain, `/dashboard`_

60-second walkthrough: _Loom link to be added after deploy_

---

## What it is

Local appointment businesses (dental, home services, law, fitness, clinics, salons — any business that lives on leads, reviews, and repeat visits) run their growth stack across five disconnected tools: CRM, SMS gateway, review platform, ad accounts, booking tool. Revenue leaks in the gaps — dormant customers never reactivated, reviews never requested, leads followed up too slowly, and no single answer to "what actually drove this month?"

**One System** is the operator surface that unifies those flows on one shared data model.

## Platform shape

Five modules on one platform:

1. **Lead Capture + Instant Follow-Up** — inbound intake, missed-call text-back, qualification, booking handoff
2. **Database Reactivation** — dormant audience selection, cooldown-aware outreach, reply + booking tracking _(flagship, fully shipped)_
3. **Reviews & Referrals** — post-visit trigger flows, AI-drafted responses, referral loop
4. **Paid Ads + Lead Nurturing** — source attribution, cost-per-booking, nurture sequences
5. **Sales Enablement** — consultation transcripts, objection libraries, post-call follow-up

All five share a single workspace, contact graph, and event timeline.

---

## Stack

- **Next.js 15** (App Router, server components, server actions) + **React 19**
- **TypeScript** strict, **Prisma 6 + PostgreSQL** for persistence
- **Twilio** for SMS, **Clerk** for auth _(integration in progress)_
- **Vercel + Neon** for hosting
- Monorepo with isolated domain / database / workflows / integrations / UI packages

## Repo shape

```
apps/
  dashboard/              Next.js app (marketing + authed surface)
    app/
      page.tsx            Landing page
      pricing/            Pricing page
      (app)/              Authed route group
        dashboard/        Overview
        reactivation/     Flagship module (end-to-end)
        leads/ reviews/ ads/ sales/ platform/
    components/           Shared UI (Card, MetricCard, Sidebar, Topbar, ...)
  api/                    HTTP APIs, webhooks
  worker/                 Durable async execution
packages/
  domain/                 Canonical entities + business rules
  database/               Prisma schema + data access
  workflows/              Triggers, sequencing, retries
  integrations/           External adapters (Twilio, CRM sync)
  messaging/ ai/ analytics/ config/ shared/ ui/
modules/                  Module-specific business logic
```

## Running locally

```bash
npm install
npm run db:up          # docker postgres
npm run db:push        # prisma schema push
npm run dev            # dashboard on :3000
```

Env vars live in `.env` at the repo root. A sample template is in `.env.example`.

## Running the tests

```bash
npm test               # across all workspaces
```

---

## Design

Warm neutral palette (cream surface, terracotta accent), dark rail sidebar, semantic status colours (green / amber / blue / red with bg variants), DM Sans for UI and data, Georgia for brand headlines. Dark mode included. Tokens in `apps/dashboard/app/globals.css`.

The first-pass UI was designed in [Claude Design](https://claude.ai/design); implementation handed off to Claude Code. Source handoff HTML preserved at `apps/dashboard/design/One System Dashboard.html` for reference.

---

## What's portable

The platform is deliberately vertical-agnostic — "appointment business" is the archetype, not a specific industry. The same model fits dental practices, chiropractors, physiotherapy, vet clinics, law firms (personal injury), home services (HVAC, roofing), real estate, auto dealerships, salons, fitness studios, and coaching practices. The demo workspace uses generic seed data.

## Project docs

- [docs/product-spec.md](docs/product-spec.md) — full product specification
- [docs/architecture.md](docs/architecture.md) — platform architecture and reasoning
- [docs/roadmap.md](docs/roadmap.md) — phase-by-phase build plan
- [docs/decisions.md](docs/decisions.md) — notable architectural decisions
- [docs/build-vs-borrow.md](docs/build-vs-borrow.md) — integration vs build choices
- [AGENTS.md](AGENTS.md) — working agreement for AI-assisted development

## Honest status

This is a portfolio build — one developer, ~6 months, deliberately disciplined architecture on top of a small real feature surface. The polish target is "near-shippable demo," not "production SaaS." See the demo for what's real; see the code for what's architected.
