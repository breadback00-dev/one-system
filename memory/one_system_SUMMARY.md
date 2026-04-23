# One System Summary

## Current Milestone

M1 - Platform Foundation

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
- module folders for all five product areas
- med spa selected as first implementation niche

## What We Decided

- build the whole product as one modular platform
- avoid treating the modules as separate standalone products
- start by building shared foundation capabilities
- split synchronous API concerns from async worker concerns
- deepen Lead Capture + Instant Follow-Up first because it exercises the most platform surface area

## What Comes Next

- scaffold the actual app and package codebases
- define entities and schemas in code
- choose the implementation stack details and tooling
- lock build-vs-borrow choices for auth, workflows, messaging, and booking
- build the first end-to-end lead intake and follow-up workflow

## Immediate Next Step

- replace the dev delivery adapter with Twilio when we are ready to wire a real provider
- generalize the minimal sequence capability into reusable step definitions and scheduling rules
- expose response state and workflow outcomes more explicitly in the dashboard
- deepen Reactivation with reply/booking tracking, richer segmentation rules, and clearer run reporting
- deepen Module 2 operator actions with conversation context, handled-item audit visibility, and real scheduling availability

## How To Resume

1. Read `docs/product-spec.md`, `docs/architecture.md`, and `docs/roadmap.md`
2. Confirm or refine the technical stack
3. Scaffold the monorepo toolchain
4. Start implementing the foundation model and lead workflow
