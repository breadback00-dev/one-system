# Portfolio plan

Living doc. Two repos, two framings, same delivery engine. Finish the first before starting the second.

---

## Positioning

**One sentence:** *"One System is an appointment-business operator platform — built first as a SaaS exploration, now also used as the delivery engine for a productised growth-services business."*

**Audiences:**
1. Hiring managers — product engineering roles (Series A–C SaaS)
2. Hiring managers — startup founding/early engineer roles
3. Freelance / agency clients in the vertical SaaS / local-business-growth space

---

## Phase 1 — Finish `01_one system` (SaaS-framed)

Keep this repo frozen as a complete portfolio piece once done. Do not fork until it ships.

### Done this session

- Audience + positioning locked (1 + 2 + 3)
- Repo audit, reconciled against Codex-generated untracked work
- Med-spa branding neutralised (Sidebar, Topbar)
- Route restructure: `(app)` group for authed surface, marketing at root
- Landing page at `/` — hero, problem, 3-step flow, modules grid, CTA
- Pricing page at `/pricing` — 3 tiers (Starter £149, Growth £399, Scale custom)
- Marketing CSS (`app/marketing.css`) reusing existing design tokens
- `next build` passes end-to-end — 10 routes, marketing static, app dynamic
- FunnelChart pre-existing type bug fixed
- README rewritten for portfolio framing

### Remaining — needs user action first

User must set up accounts and paste keys back:

1. **Clerk** — [clerk.com](https://clerk.com), create app → `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
2. **Neon** — [neon.tech](https://neon.tech), create Postgres → `DATABASE_URL`
3. **Domain** — buy e.g. `onesystem.app` (Namecheap), or skip and use `*.vercel.app`
4. **Vercel** — [vercel.com](https://vercel.com), link GitHub

### Remaining — engineering work once keys land

1. Install + wire Clerk (middleware, sign-in, sign-up pages)
2. Harden workspace model — replace hardcoded `workspace_medspa_demo` with session-derived `workspaceId`
3. Build `/demo` — auto-provisions a seeded workspace on visit, drops user in as authed demo user, pre-populated with realistic data (250 contacts, 3 campaigns, message threads, runs)
4. Cover empty/loading/success/error states on Reactivation flow
5. Decide landing-page module treatment (spotlight Reactivation vs. all-5 with preview markers) — current state overpromises
6. Deploy to Vercel + Neon on real domain

### Remaining — user-led finishing touches

7. Record 60-second Loom walkthrough, embed on landing page
8. Take 3 portfolio screenshots, add to README top
9. Final README polish with live demo link

### Completion criteria

- Live URL resolves to landing page
- `/dashboard` demo works end-to-end without signup
- Reactivation module: upload → preview → run → results all demo-able
- Loom embedded on landing, README screenshots visible on GitHub
- All test suites passing

---

## Phase 2 — Fork to services-framed repo

**Start only after Phase 1 is shipped.**

### New repo name ideas (TBD)

Placeholder: `revenue-found` / `data-activation-ops` / `[your-agency-name]`

### What the fork preserves

- Entire monorepo (domain, database, workflows, integrations, UI, modules)
- All five module implementations (Reactivation shipped, others surface-complete)
- Auth + workspace model from Phase 1
- Design system and component library

### What the fork changes

**Landing page** — service-shaped, not product-shaped:
- Hero: *"We find revenue hiding in your data. Fixed price, fixed timeline."*
- Problem: local businesses lose revenue in the gaps between CRM / SMS / reviews / ads / booking
- Offer: AI-augmented audit → ranked opportunity list → fixed-price delivery
- Proof: before/after numbers from first clients (once available)

**Pricing page** → **Packages page**:
- Audit (free or £500) — 48-hour AI-augmented data review with ranked opportunity list
- Reactivation Sprint — £2k, 3 weeks, one campaign end-to-end
- Review + Referral Flow — £1.5k setup + monthly ops fee
- Ad Attribution Install — £2k
- Sales Enablement Rollout — £3k
- Full Growth Stack — £10k, all modules

**Dashboard framing**:
- Becomes an internal delivery tool, not a customer-facing SaaS
- Each workspace = one client
- Demo workspace stays (now shown as "sample client" on the services landing)

**README framing**:
- Opens with the service offer, not the platform
- Platform architecture moves to an "under the hood" section
- Adds a "how we deliver" section

### The wedge (why the fork has a real reason to exist)

None of these alone — all of them together:

1. **AI-native audit.** Claude ingests a CRM export and produces a ranked revenue-opportunity list with dollar estimates. Nobody is shipping this well yet.
2. **Productised pricing.** Fixed-price, fixed-scope beats the retainer-opaque model of GoHighLevel agencies.
3. **Speed to first result.** 48-hour audit → 3-week sprint → measurable outcome.
4. **Technical honesty.** Real engineering, clean reporting, no salesy fluff — rare in local-business-agency land.

### Competitors to position against

- GoHighLevel agencies (biggest, lowest-quality majority)
- RevOps consultancies (mid-market, wrong ICP)
- Single-product reactivation shops
- Klaviyo/email agencies (wrong vertical)
- AI data-activation startups (Clay, Apollo, Relevance) — tool-makers, not service-providers

### Portfolio value of having both

- SaaS-framed repo: shows platform thinking, architectural ambition, monorepo discipline
- Services-framed repo: shows commercial judgment, productised pricing, real go-to-market thinking
- Link to both from a portfolio page — evidence of range most candidates can't show

---

## Handoff notes to future self / Claude

- Do not start Phase 2 until Phase 1 is live at a real URL.
- Do not discard the `01_one system` repo when forking — it is the SaaS-framed portfolio artefact and needs to stay shippable as-is.
- The fork should be a true `git clone` + rename, not a rewrite. The point is that the platform code is unchanged — only the framing, marketing, and pricing surface changes.
- When ready to fork: copy repo, rename package in top-level `package.json` and all workspace `package.json` files, rewrite `app/page.tsx` + `app/pricing/page.tsx` + `README.md`, leave everything else alone.
- Revisit the landing-page module treatment on Phase 1 before deploying — current copy over-promises by treating all 5 modules as shipped.
