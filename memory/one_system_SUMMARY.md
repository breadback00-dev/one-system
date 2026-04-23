# One System Summary

## Current Milestone

M1 - Platform Foundation

## Active Module

Module 2 - Database Reactivation

Stay on Module 2 until explicitly told to switch modules. Say clearly before starting any new module.

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
- module folders for all five product areas
- med spa selected as first implementation niche

## What We Decided

- build the whole product as one modular platform
- avoid treating the modules as separate standalone products
- start by building shared foundation capabilities
- split synchronous API concerns from async worker concerns
- deepen Lead Capture + Instant Follow-Up first because it exercises the most platform surface area

## What Comes Next

- continue Module 2 only
- keep tightening Reactivation campaign controls and operator safety
- add final readiness checks before declaring Module 2 usable enough
- keep commits to meaningful module/capability checkpoints, not every small slice

## Immediate Next Step

- review the latest Module 2 CSV import checkpoint if uncommitted work exists
- continue Module 2 with final readiness/operator checks, not Module 3
- if committing, batch the current Module 2 work into a meaningful checkpoint

## How To Resume

1. Read `AGENTS.md`
2. Read this file
3. Run `git status --short`
4. Review the uncommitted Module 2 files before editing
5. Run `npm run typecheck`
6. Continue Module 2 only unless the user explicitly says to switch modules
