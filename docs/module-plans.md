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

Status: Completed and verified in seeded local workspace; keep active until explicit module switch approval.

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

- targeted hardening/sign-off only; prepare Module 5 handoff only when explicitly approved

Seeded proof evidence (2026-04-23):

- queued one paid nurture run (`queuedCount +1`, `queuedEventCount +2`) with readiness `ready`
- processed one inbound reply and one qualification outcome (`replied +1`, `qualified +1`)
- recorded one spend entry (`USD 125`) and produced one attribution ROI row (`facebook_ads` + unique proof UTM campaign)
- proof script now prints an explicit schema-sync hint when Module 4 columns are missing and uses unique campaign tagging to keep repeated proof runs deterministic
- paid-ads audience suppression now uses whole-word opt-out keyword matching to avoid false positives from embedded text fragments, with focused database regression tests
- paid-ads booked outcomes now prefer `appointment.booked` events (with appointment-record fallback) for more reliable attribution reporting

## Module 5 - Sales Enablement

Status: Not started.

Planned checkpoints:

- transcript ingestion and storage boundaries
- scoring/summarization pipeline and coaching prompts
- performance dashboards and conversion insight reporting
