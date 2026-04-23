import assert from "node:assert/strict";

import type { PaidAdsAudienceCandidate } from "@one-system/database";
import {
  buildPaidAdsNurtureEvents,
  buildPaidAdsNurtureFollowUpMessage,
  buildPaidAdsNurtureMessage,
} from "./index";

function makeCandidate(
  overrides: Partial<PaidAdsAudienceCandidate> = {},
): PaidAdsAudienceCandidate {
  return {
    workspaceId: "workspace_medspa_demo",
    leadId: "lead_123",
    contactId: "contact_123",
    firstName: "Maya",
    channel: "sms",
    destination: "+447700900100",
    source: "facebook_ads",
    status: "new",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function testBuildPrimaryMessageIncludesSourceContext() {
  const message = buildPaidAdsNurtureMessage(
    makeCandidate({
      source: "google_ads",
      utmCampaign: "spring_skin_refresh",
    }),
  );

  assert.ok(message.includes("Google ad"));
  assert.ok(message.includes("spring_skin_refresh"));
}

function testBuildFollowUpMessage() {
  const message = buildPaidAdsNurtureFollowUpMessage(
    makeCandidate({
      source: "facebook_ads",
    }),
  );

  assert.ok(message.includes("Meta ad"));
  assert.ok(message.includes("reply YES"));
}

function testBuildEventsIncludesMetadata() {
  const events = buildPaidAdsNurtureEvents(
    [
      makeCandidate({
        utmSource: "facebook",
        utmCampaign: "summer_push",
      }),
    ],
    {
      campaignKey: "paid-ads-default",
      runId: "run_123",
    },
  );

  assert.equal(events.length, 2);
  const [first, second] = events;
  assert.equal(first?.payload.leadId, "lead_123");
  assert.equal(first?.payload.source, "facebook_ads");
  assert.equal(first?.payload.utmCampaign, "summer_push");
  assert.equal(first?.payload.reason, "paid_ads.nurture");
  assert.equal(second?.payload.reason, "paid_ads.nurture.follow-up");
  assert.ok(second?.payload.deliverAfter, "Expected delayed follow-up.");
}

function run() {
  testBuildPrimaryMessageIncludesSourceContext();
  testBuildFollowUpMessage();
  testBuildEventsIncludesMetadata();
  console.log("[paid-ads] module tests passed");
}

run();
