import { randomUUID } from "node:crypto";

import { createQueuedOutboundMessageEvent } from "@one-system/domain";
import type { ReactivationCandidate } from "@one-system/database";

export const reactivationWorkflow = {
  key: "reactivation.dormant-outreach",
  description: "Re-engages dormant leads and customers with a simple outreach message.",
};

export interface ReactivationRunConfig {
  campaignKey: string;
  runId?: string;
}

export function buildReactivationOutreachEvents(
  candidates: ReactivationCandidate[],
  config: ReactivationRunConfig,
) {
  const runId = config.runId ?? randomUUID();

  return candidates.map((candidate) =>
    createQueuedOutboundMessageEvent({
      workspaceId: candidate.workspaceId,
      contactId: candidate.contactId,
      channel: candidate.channel,
      destination: candidate.destination,
      message:
        candidate.segment === "past_customer"
          ? `Hi ${candidate.firstName}, it's been a little while since your last visit. If you'd like to come back in for a treatment or consultation, reply here and we can help you get scheduled.`
          : `Hi ${candidate.firstName}, it's been a little while since we last heard from you. If you'd like to book a consultation or explore a treatment, reply here and we can help you get scheduled.`,
      reason: reactivationWorkflow.key,
      campaignKey: config.campaignKey,
      runId,
    }),
  );
}

export const reactivationModule = {
  key: "reactivation",
  workflows: [reactivationWorkflow],
};
