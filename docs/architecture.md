# Architecture

## System Shape

One System is a modular platform with one shared backbone and five business modules.

## Top-Level Domains

### Core

Owns canonical business entities:

- workspace
- location
- contact
- lead
- customer
- appointment
- pipeline stage
- activity

Implemented in:

- `packages/domain`
- `packages/database`

### Messaging

Owns outbound and inbound communication:

- SMS
- email
- chat events
- message templates
- delivery logs

### Automation

Owns triggers and sequences:

- event listeners
- workflow definitions
- step execution
- scheduling
- retries and idempotency

Implemented in:

- `packages/workflows`
- `apps/worker`

### AI

Owns prompt templates and analysis:

- lead response generation
- reactivation copy
- review replies
- call summaries and scoring

### Integrations

Owns external system boundaries:

- Twilio
- calendar provider
- CRM connectors
- ads platforms
- review platforms

### Analytics

Owns reporting primitives:

- event capture
- attribution
- funnel metrics
- module performance metrics

### Dashboard

Owns operator-facing experience:

- inbox/conversations
- leads and bookings
- campaigns
- analytics
- settings and integrations

Implemented in:

- `apps/dashboard`
- `packages/ui`

## Module Mapping

### Lead Capture Module

Depends on:

- core
- messaging
- automation
- AI
- integrations
- dashboard

### Reactivation Module

Depends on:

- core
- messaging
- automation
- AI
- integrations
- analytics

### Reviews And Referrals Module

Depends on:

- core
- messaging
- automation
- AI
- integrations
- analytics

### Paid Ads Module

Depends on:

- core
- automation
- integrations
- analytics
- dashboard

### Sales Enablement Module

Depends on:

- core
- AI
- analytics
- integrations
- dashboard

## Initial Technical Recommendation

- Monorepo with shared packages
- TypeScript across apps and packages
- Postgres as system of record
- Queue-backed background processing
- API-first backend with webhook handling
- Next.js dashboard for internal operators and client-facing reporting later

## Execution Layout

- `apps/api`: synchronous request handling, webhooks, authenticated APIs
- `apps/worker`: asynchronous execution, retries, scheduling, event consumers
- `packages/domain`: canonical entities and domain logic
- `packages/database`: schema, migrations, repositories, DB access
- `packages/workflows`: workflow definitions and execution primitives
- `packages/shared`: minimal cross-cutting helpers only

## Architectural Invariants

- One canonical contact record per person per workspace
- All module actions should emit events
- External integrations must pass through typed adapters
- Module logic can compose platform primitives, but should not redefine them
- Reporting must be based on captured events, not guessed state
