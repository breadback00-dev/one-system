# Architectural Decision Records

## 2026-04-22 - Use One Shared Platform Rather Than Five Separate Products

Decision:
Build one modular platform with shared core, messaging, automation, AI, integrations, analytics, and dashboard layers.

Why:
The commercial offer is unified, and the modules have major overlap in entities, workflows, and reporting.

## 2026-04-22 - Launch With Med Spas As The First Niche

Decision:
Optimize the first implementation for med spas.

Why:
They combine high-value appointments, fast follow-up needs, reactivation opportunities, reviews, and referrals in a commercially attractive way.

## 2026-04-22 - Use A Monorepo With Shared Packages

Decision:
Organize the codebase as apps plus shared packages plus modules.

Why:
This keeps shared primitives reusable while letting modules evolve independently on top of the same foundation.

## 2026-04-22 - Split API And Worker Responsibilities

Decision:
Use separate `apps/api` and `apps/worker` applications.

Why:
The product relies heavily on asynchronous workflows, retries, scheduling, webhook fan-out, and long-running execution patterns that should not be mixed into the request-serving app.
