# Reactivation Module

Dormant lead and customer reactivation campaigns with messaging and booking conversion.

## Current Capabilities

- Imports or previews dormant contacts from CSV-ready rows for first-pass reactivation audiences, reporting invalid or duplicate rows as skips.
- Can receive CRM dormant-contact sync rows through the shared integrations adapter contract.
- Records import and dry-run audit events for operator visibility.
- Builds dormant outreach events for stale leads and past customers.
- Executes shared reactivation runs for API and dashboard callers.
- Applies campaign-key cooldowns before queueing outreach.
- Previews readiness without side effects so operators can see candidate, eligible, skipped, and segment counts before sending.
- Treats past customers as dormant only when valid appointment activity is older than the run's inactivity window and no recent or upcoming valid appointment exists.
