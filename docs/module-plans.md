# Module Execution Plans

Use this as the canonical module-by-module execution plan and planning trigger guide.

## Planning Cadence

- Create or refresh the active module plan at the start of each module.
- Re-plan when scope changes, architecture changes, or acceptance criteria change.
- Batch work into meaningful checkpoints and verify each checkpoint with typecheck and build before commit.
- Do not switch modules without explicitly stating the switch first.

## When To Use Plan Mode

Use plan mode before implementation when any of these are true:

- We are starting a new module.
- We are changing Prisma schema, event contracts, or shared package boundaries.
- There are multiple valid technical paths with non-obvious tradeoffs.
- The module checkpoint will span more than one app/package and likely require staged commits.
- The user asks for roadmap, sequencing, or milestone-level decisions before coding.

## Module 1 - Lead Capture + Instant Follow-Up

Status: Completed baseline end-to-end.

Done checkpoints:

- lead intake API flow to persistence
- queued outbound follow-up path through worker
- inbound reply handling and qualification routing
- dashboard visibility for leads and message timeline

## Module 2 - Database Reactivation

Status: Completed and verified in seeded local workspace.

Done checkpoints:

- audience selection, readiness preview, and campaign queueing
- import flows (CSV + adapter contract) with audit visibility
- follow-up queue operator controls and safety validation
- dashboard readiness checklist and operator feedback hardening

Operational note:

- Keep seeded data unless explicitly asked to reset.

## Module 3 - Reviews + Referrals

Status: Completed and verified; keep active until explicit module switch approval.

Completed checkpoints:

- post-visit review request readiness, queueing, and reporting
- auto-triggered post-visit requests from completed appointments
- inbound reply routing (promoter/referral/recovery follow-ups)
- operator response-draft generation from latest reply context
- follow-up action visibility in outcomes
- referral source capture events with dedupe and campaign/run-aware reporting
- mixed-sentiment gating now routes ambiguous negative/positive feedback to recovery
- referral-source extraction now includes confidence handling and stricter parser boundaries
- dashboard now shows Module 3 readiness checks plus referral-source capture quality counts
- focused regression tests now cover domain sentiment/source parsing and module routing decisions
- seeded local proof run on 2026-04-23 validated post-visit queueing, referral-intent reply routing, and high-confidence referral source capture end-to-end

Exit criteria:

- satisfied customers are prompted automatically for reviews/referrals
- negative feedback routes to recovery without false-positive promoter routing
- operator can see reply context, follow-up actions, and captured referral source metadata

## Module 4 - Paid Ads + Lead Nurturing

Status: Completed and verified in seeded local workspace.

Completed checkpoints:

- source attribution model and ingestion extensions
- source-aware nurture sequences
- ad-to-appointment attribution reporting

Current implementation notes:

- lead attribution now persists from lead intake through domain events and reporting surfaces
- paid nurture now runs from a dedicated module package with readiness preview, cooldown checks, and two-step queueing
- API now exposes paid-ads readiness, run, report, and spend-entry endpoints
- dashboard now includes Module 4 outcomes, campaign controls, spend capture, and readiness checklist visibility
- spend-backed ROI metrics (CPL/CPQ/CPB) are now computed in reporting by source and campaign

Remaining checkpoint:

- targeted regression fixes only if new validation reveals a concrete issue

Seeded proof evidence (2026-04-23):

- queued one paid nurture run (`queuedCount +1`, `queuedEventCount +2`) with readiness `ready`
- processed one inbound reply and one qualification outcome (`replied +1`, `qualified +1`)
- recorded one spend entry (`USD 125`) and produced one attribution ROI row (`facebook_ads` + unique proof UTM campaign)
- proof script now prints an explicit schema-sync hint when Module 4 columns are missing and uses unique campaign tagging to keep repeated proof runs deterministic
- paid-ads audience suppression now uses whole-word opt-out keyword matching to avoid false positives from embedded text fragments, with focused database regression tests
- paid-ads booked outcomes now prefer `appointment.booked` events (with appointment-record fallback) for more reliable attribution reporting
- api package now includes in-process endpoint validation tests for Module 4 route guards and request parsing (`/paid-ads/spend` and shared lead validation paths)
- api package now includes positive-path Module 4 paid-ads route coverage (lead attribution intake, readiness preview, run queueing, spend recording, and report retrieval)

## Module 5 - Sales Enablement

Status: Completed and signed off for M1 foundation scope.

Completed checkpoints:

- transcript ingestion contract and persistence boundaries defined for a manual/dev path
- first-class consultation transcript entity and event flow implemented
- transcript analysis primitives implemented for summary, score, objections, and next-step guidance
- operator-facing transcript capture and outcome visibility added to the dashboard
- first Module 5 report primitives added through `GET /sales-enablement/report`
- API and module tests now include a positive Module 5 transcript flow
- adapter-backed transcript sync execution is now in place via `syncConsultationTranscripts` (dev/static adapter path)
- sync idempotency is now enforced on `workspaceId + source + externalId` with duplicate-skip reporting
- sales transcript capture/sync now accepts optional `agentName` and persists it on transcript-received events
- Module 5 reporting now includes rep-level coaching metrics (per-rep score averages, booking-ready counts, top objection, coaching focus)
- dashboard Module 5 surfaces now include rep coaching visibility and transcript-level rep attribution
- production hardening now covers protected API routes, dashboard mutation guardrails, delivery-attempt claims with stale-claim recovery, resilient worker startup retries, sensitive-data retention sweeps in the worker, bounded Module 5 transcript payloads, and Module 5 dashboard feedback parser tests
- Module 5 sign-off/UAT evidence is packaged in `docs/module5-signoff.md`

Module 5 starting constraints:

- keep transcript ingestion behind a typed integration boundary
- prefer reusable analysis primitives in shared packages over module-local shortcuts
- emit first-class events for transcript received, analysis completed, and score recorded
- start with one demonstrable end-to-end transcript flow before broadening provider support

Suggested first slice:

- ingest one consultation transcript through a dev/static adapter
- persist it against the canonical contact/lead/appointment context
- generate one summary plus one structured scorecard
- show the result in one dashboard operator surface

Remaining checkpoints:

- targeted regression hardening only if new validation reveals concrete issues

Exit criteria:

- one consultation can be ingested, analyzed, and viewed end-to-end
- analysis output is traceable through first-class events
- the design leaves room for real call-recording integrations without changing core entities

## Module 6 - M1 Platform Closure

Status: Active. This is not a sixth business module; it is the post-module platform closure checkpoint after all five product modules have foundation slices.

Completed checkpoints:

- domain now exposes a typed platform foundation readiness registry covering shared requirements and all five module boundaries
- dashboard now surfaces platform closure readiness and module boundary ownership/dependency visibility
- domain regression tests now assert all five business modules are covered and all foundation requirements include evidence

Current implementation notes:

- readiness is intentionally `partial` because customer lifecycle state, workflow metadata, and full dashboard user/session permissions remain future closure themes
- module boundaries are explicit in code rather than only in docs

Remaining checkpoints:

- decide whether explicit customer/staff/location entities are needed before M1 can be marked complete
- promote common workflow step/run metadata into `packages/workflows` if the next phase needs configurable workflows
- add production user/session auth before multi-operator dashboard rollout

Exit criteria:

- platform foundation gaps are visible to operators and developers
- all five modules have explicit ownership/dependency boundaries
- M1 completion can be decided from concrete readiness evidence rather than memory
