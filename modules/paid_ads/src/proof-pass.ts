import {
  getPaidAdsOutcomeReport,
  markLeadQualified,
  recordInboundMessage,
  recordPaidAdsSpend,
  saveLeadTransaction,
} from "@one-system/database";
import { createLead } from "@one-system/domain";
import { executePaidAdsRun } from "./index";

const workspaceId = process.env.WORKSPACE_ID?.trim() || "workspace_medspa_demo";
const campaignKey = process.env.CAMPAIGN_KEY?.trim() || `module4-proof-${Date.now()}`;
const uniqueSuffix = Date.now().toString().slice(-8);
const proofUtmCampaign = `proof_campaign_${uniqueSuffix}`;

function isMissingAttributionColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("The column `utmSource` does not exist");
}

async function main() {
  const leadResult = createLead({
    workspaceId,
    source: "facebook_ads",
    firstName: "Module4Proof",
    phone: `+1555${uniqueSuffix}`,
    attribution: {
      utmSource: "facebook",
      utmCampaign: proofUtmCampaign,
      utmMedium: "paid_social",
    },
  });
  const saved = await saveLeadTransaction(leadResult);

  const before = await getPaidAdsOutcomeReport({
    workspaceId,
    campaignKey,
    limit: 250,
  });

  const run = await executePaidAdsRun({
    workspaceId,
    campaignKey,
    cooldownDays: 1,
    limit: 1,
  });

  await recordInboundMessage({
    workspaceId,
    contactId: saved.contact.id,
    channel: "sms",
    provider: "module4-proof-pass",
    from: saved.contact.phone ?? "unknown",
    body: "Yes, I want to book a consultation.",
    receivedAt: new Date().toISOString(),
  });

  await markLeadQualified({
    workspaceId,
    leadId: saved.lead.id,
  });

  await recordPaidAdsSpend({
    workspaceId,
    reportDate: new Date().toISOString(),
    source: saved.lead.source,
    amount: 125,
    currency: "USD",
    ...(saved.lead.attribution?.utmSource
      ? { utmSource: saved.lead.attribution.utmSource }
      : {}),
    ...(saved.lead.attribution?.utmCampaign
      ? { utmCampaign: saved.lead.attribution.utmCampaign }
      : {}),
  });

  const after = await getPaidAdsOutcomeReport({
    workspaceId,
    campaignKey,
    limit: 250,
  });

  const evidence = {
    workspaceId,
    campaignKey,
    lead: {
      leadId: saved.lead.id,
      contactId: saved.contact.id,
      source: saved.lead.source,
      attribution: saved.lead.attribution,
    },
    run,
    before: {
      queuedCount: before.queuedCount,
      repliedCount: before.repliedCount,
      qualifiedCount: before.qualifiedCount,
      bookedCount: before.bookedCount,
      spendAmount: before.spendAmount,
      costPerLead: before.costPerLead,
    },
    after: {
      queuedCount: after.queuedCount,
      repliedCount: after.repliedCount,
      qualifiedCount: after.qualifiedCount,
      bookedCount: after.bookedCount,
      spendAmount: after.spendAmount,
      costPerLead: after.costPerLead,
      costPerQualified: after.costPerQualified,
      costPerBooking: after.costPerBooking,
    },
    deltas: {
      queuedCount: after.queuedCount - before.queuedCount,
      repliedCount: after.repliedCount - before.repliedCount,
      qualifiedCount: after.qualifiedCount - before.qualifiedCount,
      bookedCount: after.bookedCount - before.bookedCount,
      spendAmount: after.spendAmount - before.spendAmount,
    },
    topRow: after.rows[0] ?? null,
  };

  console.log(JSON.stringify(evidence, null, 2));
}

try {
  await main();
} catch (error) {
  if (isMissingAttributionColumnError(error)) {
    console.error(
      "[paid-ads proof-pass] Database schema is behind Module 4 changes. Run `npm run db:push` from repo root, then retry `npm run proof:module4:seeded`.",
    );
  } else {
    console.error("[paid-ads proof-pass] Failed:", error);
  }

  process.exitCode = 1;
}
