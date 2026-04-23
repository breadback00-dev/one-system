# API App

Backend entrypoint for APIs, webhooks, background jobs, workflow orchestration, and integration handling.

## Current Routes

- `POST /leads` creates a lead and emits follow-up workflow events.
- `POST /appointments` creates an appointment, persists it, and emits an `appointment.booked` event.
- `POST /messages/inbound` accepts normalized JSON inbound messages for local testing.
- `GET /reactivation/readiness` previews dormant audience readiness without queueing outreach, including audience segment counts and cooldown-blocked contacts.
- `POST /reactivation/import?workspaceId=...&dryRun=true` imports or previews dormant reactivation contacts from CSV headers `firstName,lastName,email,phone,segment,lastActivityAt`, where `segment` is `stale_lead` or `past_customer`; invalid and duplicate rows are reported as skipped rows.
- `POST /reactivation/run` finds dormant contacts with no recent activity, optionally narrows to stale leads or past customers, applies a cooldown window by `campaignKey`, and queues a reactivation outreach batch.
- `GET /reactivation/report` summarizes queued reactivation outreach by `campaignKey` and/or `runId`, including delivery, reply, qualification, and booking-follow-through signals.
- `POST /webhooks/twilio/messages?workspaceId=...` accepts Twilio SMS webhook payloads, validates the Twilio signature when `TWILIO_AUTH_TOKEN` is configured, and records them as threaded inbound messages.

## Current Workflow Behavior

- A newly created lead now triggers a minimal two-step outbound follow-up sequence on the preferred available channel.
- The lead-capture workflow currently sends one immediate message and one delayed reminder.
- An inbound reply now triggers a reply-aware workflow pass.
- The most recent response-eligible lead for that contact is marked as `responded`.
- A qualification keyword in the inbound reply can now trigger `lead.qualified`.
- A qualified lead now receives a booking-handoff message using `BOOKING_HANDOFF_URL`.
- Reactivation reporting now traces queued outreach through later inbound replies, qualification events, and explicit `appointment.booked` signals for the same contact after the send.
- Reactivation imports and dry runs emit `reactivation.import_completed` audit events for dashboard visibility.
- Pending auto-follow-up messages for the lead-capture workflow are suppressed once the lead replies before delivery.
- Repeat inbound replies do not keep re-emitting the same `lead.responded` side effect once the lead has already moved out of `new` or `contacted`.

## Webhook Notes

- Set `APP_BASE_URL` when the API sits behind a tunnel, proxy, or deployment URL so Twilio signature validation uses the same public URL Twilio calls.
- Without `TWILIO_AUTH_TOKEN`, the Twilio route still parses inbound payloads but skips signature verification.
