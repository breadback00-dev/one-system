# Roadmap

## Build Strategy

Build one shared platform, then deepen modules in an order that maximizes reuse.

## Phase 1: Platform Foundation

Deliver:

- workspace and account model
- canonical lead/contact/customer entities
- conversation and activity timeline
- event schema and analytics tracking
- messaging pipeline
- workflow engine skeleton
- integrations framework
- dashboard shell

Exit criteria:

- a new lead can be created, contacted, tracked, and viewed in the dashboard

## Phase 2: Lead Capture + Instant Follow-Up

Deliver:

- form/webhook lead intake
- missed-call text-back
- instant follow-up sequences
- qualification state machine
- booking link handoff

Exit criteria:

- inbound lead to booked consultation works end-to-end

## Phase 3: Database Reactivation Engine

Deliver:

- CSV import
- CRM sync adapter pattern
- reactivation audience selection
- campaign send orchestration
- response and booking tracking

Exit criteria:

- dormant contacts can be imported, messaged, and measured

## Phase 4: Reviews & Referrals Automation

Deliver:

- post-visit trigger flows
- review request and routing logic
- referral program logic
- response suggestions

Exit criteria:

- satisfied customers can be prompted for reviews and referrals automatically

## Phase 5: Paid Ads + Lead Nurturing Layer

Deliver:

- source attribution model
- landing page/form ingestion enhancements
- nurture sequences by source
- performance reporting

Exit criteria:

- lead source and downstream conversion can be measured

## Phase 6: Sales Enablement System

Deliver:

- call transcript ingestion
- scoring and summary pipeline
- rep performance views
- coaching prompts

Exit criteria:

- consultations can be analyzed and surfaced as conversion insights

## Cross-Phase Rule

Every phase must leave behind reusable platform capability, not just a narrow feature.
