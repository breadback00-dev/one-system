# Build Vs Borrow

## Purpose

This document records which external projects we should use directly, which we should study for patterns, and which areas we should build ourselves.

The goal is speed without inheriting the wrong product boundaries.

## Core Principle

Borrow infrastructure and patterns.
Build the product-specific operating system ourselves.

We should not fork a giant CRM or automation product and try to bend it into One System.

## Recommended External Projects

### Use Directly

#### Better Auth

Repository:
- [better-auth/better-auth](https://github.com/better-auth/better-auth)

Use for:
- authentication
- sessions
- account and workspace access foundations

Why:
- modern TypeScript fit
- strong auth baseline
- better use of time than building auth from scratch

Decision:
- likely direct dependency

#### Twilio Node

Repository:
- [twilio/twilio-node](https://github.com/twilio/twilio-node)

Use for:
- SMS sending
- phone-event handling
- webhook integrations

Why:
- official library
- central to the first modules

Decision:
- direct dependency

### Use As Strong Reference Repositories

#### Cal.com

Repositories:
- [calcom/cal.com](https://github.com/calcom/cal.com)
- [calcom/cal.diy](https://github.com/calcom/cal.com)

Study for:
- booking architecture
- scheduling flows
- availability and appointment models
- booking UX patterns

Decision:
- reference only
- do not fork the whole product as our base

#### Twenty

Repository:
- [twentyhq/twenty](https://github.com/twentyhq/twenty)

Study for:
- CRM-style object modeling
- activity timelines
- permissions ideas
- records and relationship patterns

Decision:
- reference only
- do not make this the foundation unless the product direction becomes CRM-first

### Use As Workflow Architecture Inputs

#### Temporal

Repository:
- [temporalio](https://github.com/temporalio)

Study for:
- durable execution concepts
- retries
- workflow state management
- long-running orchestration patterns

Decision:
- architectural reference
- potential future adoption if workflow complexity grows fast

#### OpenWorkflow

Repository:
- [openworkflowdev/openworkflow](https://github.com/openworkflowdev/openworkflow)

Study for:
- TypeScript-native durable workflow ideas
- simpler workflow implementation patterns

Decision:
- evaluate during implementation
- do not make it a hard dependency until we test fit against our needs

### Consider Later

#### n8n

Repository:
- [n8n-io](https://github.com/n8n-io)

Use for:
- inspiration
- possible integration target for advanced customer workflows

Decision:
- not the core backend of the product

#### Evolution API

Repository:
- [EvolutionAPI/evolution-api](https://github.com/EvolutionAPI/evolution-api)

Use for:
- possible future WhatsApp channel support

Decision:
- later consideration only
- review licensing carefully before use in product flows

## What We Build Ourselves

- domain model for leads, contacts, customers, bookings, campaigns, and events
- workflow definitions for lead capture, reactivation, reviews, nurturing, and sales flows
- operator dashboard and reporting experience
- med spa-first AI prompt and template system
- integration adapter boundaries and orchestration rules
- analytics model tied to our commercial outcomes

## Current Recommendation

Use directly:

- Better Auth
- Twilio Node

Study closely:

- Cal.com
- Twenty
- Temporal
- OpenWorkflow

Avoid as foundation:

- n8n
- full CRM forks
- messaging-platform-first clones

## Revisit Trigger

Revisit this document when:

- workflow complexity makes our in-house orchestration too fragile
- booking requirements become broad enough to justify deeper scheduling reuse
- channel strategy expands beyond SMS and email
- the product shifts toward CRM or sales-ops depth beyond current scope
