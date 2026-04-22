# Project Manual

## What We Are Building

We are building a full customer acquisition operating system for med spas first, with five modules delivered on a shared platform.

## Why Med Spas First

- high ticket value
- strong need for rapid follow-up
- frequent reactivation opportunities
- reviews matter commercially
- referral loops are common
- appointment workflows are easy to model

This gives us a strong first implementation without forcing the core platform to become med-spa-only.

## Shared Entities We Need Early

- workspace
- staff user
- location
- contact
- lead
- customer
- appointment
- conversation
- campaign
- workflow
- event
- integration connection

## Dangerous Areas

- muddy distinction between lead, contact, and customer
- hard-coding niche assumptions into shared packages
- treating messaging as synchronous when delivery and replies are event-driven
- leaving analytics design until after features are built
- mixing workflow definitions with ad hoc application logic

## Module Boundaries

- shared behavior belongs in `packages/*`
- business packaging belongs in `modules/*`
- UI belongs in `apps/dashboard`
- APIs and webhooks belong in `apps/api`
- async jobs, retries, and scheduled execution belong in `apps/worker`

## Package Guidance

- `packages/domain` holds canonical business concepts and rules
- `packages/database` holds persistence concerns
- `packages/workflows` holds orchestration logic
- `packages/shared` should stay thin; prefer a more specific package whenever possible

## Quality Bar

- every major workflow must be traceable through events
- every integration must have an adapter boundary
- each module should be demonstrable end-to-end before expanding width
- docs should reflect reality whenever architecture changes

## Initial Build Order

1. foundation entities and event model
2. lead intake and instant follow-up
3. reactivation campaigns
4. reviews and referrals
5. paid ads and attribution
6. sales enablement
