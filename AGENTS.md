# One System
Unified AI customer acquisition platform for med spas first, built to support five modules on one shared foundation.

## Current Milestone
**Active: M1 - Platform Foundation**

### M1 - Platform Foundation In Progress
- [ ] Finalize platform entities and module boundaries
- [x] Scaffold dashboard, API, and worker apps
- [x] Define shared schemas and integration contracts
- [x] Build lead intake and messaging pipeline
- [x] Stand up first end-to-end workflow for lead capture
- [x] Move initial outbound delivery into the worker path
- [x] Add first-class message persistence and dashboard visibility

## Tech Stack
- Frontend: Next.js + TypeScript
- Backend: Node.js + TypeScript
- Database: Postgres
- ORM: Prisma
- Background jobs: queue-backed worker layer
- Messaging: Twilio first
- AI: OpenAI API via reusable prompt layer

## Commands
- Install: `npm install`
- Dev: `npm run dev`
- Test: `npm run test`
- Lint: `npm run lint`
- Format: `npm run format`

## Project Structure
- `apps/dashboard`: operator dashboard and reporting UI
- `apps/api`: API, webhooks, orchestration, background job entrypoints
- `apps/worker`: async workflow execution, scheduled jobs, retries, and event consumers
- `packages/domain`: accounts, contacts, bookings, pipelines, canonical entities
- `packages/database`: Prisma schema, migrations, database clients, persistence boundaries
- `packages/messaging`: SMS, email, templates, delivery orchestration
- `packages/workflows`: triggers, workflows, sequences, scheduling
- `packages/ai`: prompts, generation, scoring, analysis
- `packages/integrations`: Twilio, CRM, calendar, ads, review platform connectors
- `packages/analytics`: KPIs, attribution, reporting models
- `packages/ui`: shared UI primitives for dashboard surfaces
- `packages/config`: environment, app config, shared tooling config
- `packages/shared`: temporary cross-cutting utilities only; avoid growing this by default
- `modules/*`: business-facing module implementations
- `docs/`: product, architecture, roadmap, and operating docs

## Code Constraints
- Keep platform logic in shared packages, not duplicated inside modules.
- Design all module features around reusable entities and event flows.
- Prefer explicit schemas and typed contracts for integrations.
- Prefer `domain`, `database`, `workflows`, `config`, and `ui` over adding new code to `shared`.
- Build the med spa defaults first without hard-coding niche assumptions into core packages.
- Ship end-to-end slices that exercise real workflows before broadening scope.

## Gotchas
- Do not let module-specific shortcuts leak into the shared domain model.
- Do not treat analytics as an afterthought; event design starts at foundation time.

## Read When Needed
- Start of each session: `memory/one_system_SUMMARY.md`
- Product direction: `docs/product-spec.md`
- Build sequence: `docs/roadmap.md`
- System design: `docs/architecture.md`
- Working assumptions and invariants: `docs/project_manual.md`
- Niche specifics: `docs/niche/medspa.md`
