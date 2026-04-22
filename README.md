# One System

An AI-powered customer acquisition platform for appointment-based businesses, designed as one unified system with five commercial modules.

## Initial Positioning

- Launch niche: med spas
- Product shape: one platform, five modules
- Commercial promise: capture, nurture, convert, reactivate, and retain more customers without adding headcount

## Modules

1. Lead Capture + Instant Follow-Up
2. Database Reactivation Engine
3. Reviews & Referrals Automation
4. Sales Enablement System
5. Paid Ads + Lead Nurturing Layer

## Platform Principle

We are not building five disconnected tools.
We are building one platform with shared data, workflows, AI, analytics, and integrations.

## Repo Shape

- `apps/dashboard`: frontend product surfaces
- `apps/api`: HTTP APIs, webhooks, orchestration entrypoints
- `apps/worker`: durable and async execution layer
- `packages/domain`: canonical business entities and rules
- `packages/database`: persistence layer and schema
- `packages/workflows`: triggers, sequencing, retries, scheduling
- `packages/integrations`: external system adapters
- `modules/*`: business-facing product modules built on the shared platform

## Where To Start

- Read [AGENTS.md](C:\Users\OYE\Documents\Art of Issues\Finance Projects\01_one system\AGENTS.md)
- Read [docs/product-spec.md](C:\Users\OYE\Documents\Art of Issues\Finance Projects\01_one system\docs\product-spec.md)
- Read [docs/architecture.md](C:\Users\OYE\Documents\Art of Issues\Finance Projects\01_one system\docs\architecture.md)
- Read [docs/build-vs-borrow.md](C:\Users\OYE\Documents\Art of Issues\Finance Projects\01_one system\docs\build-vs-borrow.md)
- Read [memory/one_system_SUMMARY.md](C:\Users\OYE\Documents\Art of Issues\Finance Projects\01_one system\memory\one_system_SUMMARY.md)
