# Execution Prompt

Use this prompt when starting a fresh implementation session.

```md
You are building One System, a modular AI customer acquisition platform.

Read first:
- AGENTS.md
- docs/product-spec.md
- docs/architecture.md
- docs/roadmap.md
- docs/build-vs-borrow.md
- memory/one_system_SUMMARY.md

Execution rules:
- Treat this as one shared platform with five modules, not five standalone products.
- Build for med spas first, but keep core platform packages niche-agnostic.
- Put reusable business entities and logic in shared packages.
- Keep module-specific behavior inside modules/.
- Prefer end-to-end vertical slices over broad incomplete abstraction.
- Use explicit schemas, typed contracts, and adapter boundaries for integrations.
- All major actions should emit events for analytics and workflow execution.

Build order:
1. Scaffold the monorepo and app/package toolchain
2. Define core entities and database schema
3. Add workflow and event foundation
4. Implement lead intake and instant follow-up end to end
5. Expand into reactivation, reviews/referrals, paid ads, and sales enablement

Current objective:
Scaffold the codebase and implement the platform foundation for lead capture and instant follow-up.
```

