# One System Summary

## Current Milestone

M1 - Platform Foundation

## Active Module

Module 3 - Reviews + Referrals Automation

Stay on Module 3 until explicitly told to switch modules. Say clearly before starting any new module.

## What Exists

- initial product spec source file in project root
- canonical planning docs in `docs/`
- platform-first repo scaffold
- execution-oriented app and package layout
- npm workspace root config and initial TypeScript code scaffold
- initial dashboard, API, worker, domain, database, workflow, and lead-capture skeletons
- dependencies installed successfully with npm
- workspace-wide typecheck passes
- dashboard production build passes
- `POST /leads` works end to end in the API dev server
- lead creation now persists to Postgres through Prisma
- `lead.created` now triggers a queued follow-up event through the workflow layer
- local Postgres runs via `infra/docker-compose.yml`
- Prisma client generation and the initial migration both completed successfully
- the worker now consumes `message.outbound_queued` events and writes `message.delivered`
- dev message deliveries are logged to `data/exports/message-deliveries.log`
- outbound messages now persist as first-class records in the `Message` table
- the dashboard now shows delivery status, recent leads, and a message timeline
- inbound messages now persist into threaded conversations through a shared API flow
- Twilio SMS webhook payloads can now be normalized through an integration adapter at `POST /webhooks/twilio/messages`
- Twilio inbound webhooks now validate request signatures when `TWILIO_AUTH_TOKEN` is configured
- `APP_BASE_URL` can be set so webhook signature validation uses the public URL Twilio calls
- inbound reply events now mark the most recent response-eligible lead as `responded`
- duplicate inbound replies do not keep re-applying the same `lead.responded` status transition
- replied leads now suppress still-pending lead-capture follow-up messages before the worker delivers them
- queued outbound messages now support a `message.suppressed` event path alongside delivery
- queued outbound messages now support delayed delivery through a `deliverAfter` timestamp
- lead capture now runs as a minimal two-step sequence: immediate follow-up plus delayed reminder
- inbound qualification keywords now trigger `lead.qualified`
- qualified leads now receive a booking-handoff message using `BOOKING_HANDOFF_URL`
- the reactivation module now has a real workspace package and a first dormant-outreach workflow key
- `POST /reactivation/run` now finds dormant contacts with no recent activity and queues first-pass reactivation outreach
- reactivation now distinguishes `stale_lead` and `past_customer` audiences and sends different outreach copy by segment
- reactivation runs now support `campaignKey` + `runId` metadata on queued outreach
- reactivation applies a cooldown window and skips recently targeted contacts for the same campaign key
- `GET /reactivation/report` now summarizes reactivation sends, deliveries, replies, qualifications, and bookings by campaign key and/or run id
- `POST /appointments` now creates appointments and emits a first-class `appointment.booked` event
- reactivation reporting now prefers explicit `appointment.booked` events before falling back to later appointment records
- the dashboard now shows a funnel snapshot, recent appointments, and compact reactivation outcome visibility
- the dashboard now also shows grouped recent reactivation runs by campaign key and run id
- the dashboard now includes a Module 2 reactivation follow-up queue for replied and qualified contacts that are still unbooked
- Module 2 queue items can now be marked handled from the dashboard through a `reactivation.follow_up_handled` event
- Module 2 queue items can now be booked for a next-day default appointment from the dashboard, creating an `appointment.booked` event and clearing the queue item
- the dashboard now shows recently handled Module 2 reactivation queue items with campaign/run context and handling notes
- Module 2 reactivation queue items now show recent inbound/outbound conversation context before operator actions
- Module 2 reactivation queue booking actions now offer multiple explicit next appointment slots instead of one fixed shortcut
- Module 2 reactivation campaign execution now lives in the reactivation module package and is reused by both API and dashboard entry points
- the dashboard now includes a Module 2 campaign control form for queueing reactivation outreach with campaign key, inactivity window, limit, and cooldown settings
- after a Module 2 campaign run is queued from the dashboard, the operator sees candidate, queued, skipped, cooldown, campaign key, and run id feedback
- Module 2 dashboard actions now include consequence copy for campaign queueing, booking slots, and mark-handled actions
- Module 2 queue booking slots are now generated from appointment availability and server-side booking rejects stale/unavailable slots
- Module 2 reactivation run inputs now support explicit audience selection for all dormant contacts, stale leads only, or past customers only
- Module 2 campaign run results now include readiness status and segment breakdowns so operators can distinguish queued campaigns from no-audience or cooldown-blocked runs
- Module 2 now has a side-effect-free reactivation readiness preview reused by the dashboard and exposed at `GET /reactivation/readiness`
- the dashboard campaign controls now show default readiness before queueing outreach
- Module 2 past-customer reactivation candidates now require old appointment activity, and candidate `lastActivityAt` reflects the latest lead, appointment, message, or contact activity
- Module 2 now has `POST /reactivation/import` for CSV dormant contact import with `stale_lead` and `past_customer` rows
- Module 2 CSV import now supports dry-run previews, row-level skip reporting, and duplicate import activity detection
- Module 2 now has a CRM dormant-contact sync adapter contract in `packages/integrations`, plus a static dev adapter that maps CRM records into reactivation import rows
- Module 2 imports now emit `reactivation.import_completed` audit events and the dashboard shows recent import/dry-run history
- Module 2 past-customer readiness now excludes contacts with recent or upcoming valid appointments
- the dashboard now includes a Module 2 readiness checklist for imports, eligible audience, campaign execution, booking slots, and measurable outcomes
- Module 2 follow-up queue actions now validate server-side actionability before booking/handling (no stale, already-booked, or already-handled queue mutations)
- Module 2 queue booking now enforces operator-offered slot selection and rejects off-menu slot submissions
- Module 2 mark-handled notes are length-capped to reduce oversized/tampered payload risk
- Module 2 audience selection is now strict in API and dashboard actions (invalid `audienceSegment` values fail fast instead of silently defaulting)
- Module 2 campaign keys are now normalized and validated (lowercase slug pattern) before readiness checks and queueing
- Module 2 cooldown matching now compares campaign keys case-insensitively so legacy mixed-case keys still suppress repeats
- Module 2 dashboard now shows explicit success/error notices for campaign queueing and queue booking/handled actions
- Module 2 dashboard feedback parsing now lives in a shared utility with regression tests wired into the dashboard `test` script
- local Module 2 proof run on 2026-04-23 seeded one live import (4 dormant contacts), queued one campaign run (4 queued), booked one queue item, and left three open queue items
- local Module 2 readiness evidence now shows all five checklist checks as ready in the current demo workspace state
- Module 3 now has a real workspace package in `modules/reviews_referrals` with readiness preview and campaign queue execution logic
- Module 3 now has `GET /reviews-referrals/readiness`, `POST /reviews-referrals/run`, and `GET /reviews-referrals/report` API endpoints
- the dashboard now includes Module 3 outcomes visibility and campaign controls with readiness + run feedback
- Module 3 reporting now tracks queued, delivered, replied, promoter-signal, and referral-intent outcomes
- appointments created with `outcome: completed` now auto-trigger a delayed post-visit Module 3 review request with cooldown protection
- inbound post-visit replies now route into promoter, referral, or recovery follow-up outreach with cooldown-safe queueing
- Module 3 now includes operator-facing review-response draft generation with sentiment classification, confidence, and suggested next action
- Module 3 now has `POST /reviews-referrals/response-draft` for reusable response draft generation
- Module 3 outcomes now include latest reply context and one-click dashboard draft generation from real customer replies
- Module 3 outcomes now expose promoter/referral/recovery follow-up queued counts for operator visibility
- Module 3 reply routing now captures referral source details as first-class events with duplicate-message protection
- Module 3 outcomes now include referral-source capture counts plus captured referral name/contact metadata in dashboard visibility
- Module 3 now uses a shared feedback-signal classifier so mixed sentiment routes to recovery and suppresses false promoter/referral positives
- Module 3 sentiment-signal regression tests now run in `@one-system/domain` during workspace `npm run test`
- Module 3 referral-source extraction now assigns capture confidence and only auto-captures low-confidence name-only data when recent referral follow-up context exists
- roadmap and product spec module ordering are now aligned (Paid Ads before Sales Enablement)
- module folders for all five product areas
- canonical per-module execution plan in `docs/module-plans.md`
- med spa selected as first implementation niche

## What We Decided

- build the whole product as one modular platform
- avoid treating the modules as separate standalone products
- start by building shared foundation capabilities
- split synchronous API concerns from async worker concerns
- deepen Lead Capture + Instant Follow-Up first because it exercises the most platform surface area

## Model Guidance

- Use GPT-5.3 Codex for coding-heavy continuation: multi-file edits, TypeScript/Next/Prisma changes, debugging, verification, and meaningful commits.
- Use GPT-5.4 for planning-heavy work: architecture tradeoffs, product direction, scope decisions, specs, docs strategy, and explanations before implementation.
- In fresh coding threads, prefer GPT-5.3 Codex unless the immediate task is mostly planning or decision-making.
- Switch from GPT-5.4 to GPT-5.3 Codex once the plan is clear and the next step is to edit files, run checks, or commit.
- Switch from GPT-5.3 Codex to GPT-5.4 when the work gets ambiguous, module scope needs renegotiation, or there are multiple architecture/product paths.

## What Comes Next

- continue Module 3 implementation slices
- add stronger satisfaction gating and referral routing paths on inbound feedback
- refine response-suggestion flow for operator-assisted review handling and link drafts to richer conversation context
- keep commits to meaningful module/capability checkpoints, not every small slice

## Immediate Next Step

- keep Module 3 as active module and do not start Module 4 without explicit instruction
- tighten review-response routing for positive vs negative sentiment replies
- keep validating each Module 3 checkpoint with `npm run typecheck` and `npm run build`

## How To Resume

1. Read `AGENTS.md`
2. Read this file
3. Read `docs/module-plans.md`
4. Run `git status --short`
5. Review uncommitted files for the active module before editing
6. Run `npm run typecheck`
7. Continue Module 3 only unless the user explicitly says to switch modules
