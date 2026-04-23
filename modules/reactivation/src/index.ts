import { randomUUID } from "node:crypto";

import { createQueuedOutboundMessageEvent } from "@one-system/domain";
import {
  appendEvents,
  getReactivationCandidates,
  getRecentQueuedMessagesForReason,
  type ReactivationAudienceSegment,
  type ReactivationCandidate,
} from "@one-system/database";

export const reactivationWorkflow = {
  key: "reactivation.dormant-outreach",
  description: "Re-engages dormant leads and customers with a simple outreach message.",
};

export interface ReactivationRunConfig {
  campaignKey: string;
  runId?: string;
}

export interface ExecuteReactivationRunInput {
  workspaceId: string;
  inactiveDays: number;
  limit: number;
  cooldownDays: number;
  campaignKey: string;
  audienceSegment?: ReactivationAudienceSegment;
}

export type ReactivationReadinessStatus =
  | "ready"
  | "no_candidates"
  | "cooldown_blocked";

export interface ReactivationSegmentBreakdown {
  staleLeadCount: number;
  pastCustomerCount: number;
  eligibleStaleLeadCount: number;
  eligiblePastCustomerCount: number;
  skippedStaleLeadCount: number;
  skippedPastCustomerCount: number;
}

export interface ReactivationReadinessResult {
  ok: true;
  readinessStatus: ReactivationReadinessStatus;
  candidateCount: number;
  eligibleCount: number;
  skippedCount: number;
  campaignKey: string;
  cooldownDays: number;
  audienceSegment: ReactivationAudienceSegment;
  segmentBreakdown: ReactivationSegmentBreakdown;
  candidates: ReactivationCandidate[];
  skippedCandidates: ReactivationCandidate[];
}

export interface ExecuteReactivationRunResult extends ReactivationReadinessResult {
  queuedCount: number;
  runId: string;
}

function countSegment(
  candidates: ReactivationCandidate[],
  segment: ReactivationCandidate["segment"],
) {
  return candidates.filter((candidate) => candidate.segment === segment).length;
}

function getReadinessStatus(args: {
  candidateCount: number;
  queuedCount: number;
}): ReactivationReadinessStatus {
  if (args.queuedCount > 0) {
    return "ready";
  }

  if (args.candidateCount === 0) {
    return "no_candidates";
  }

  return "cooldown_blocked";
}

async function evaluateReactivationReadiness(
  input: ExecuteReactivationRunInput,
): Promise<Omit<ReactivationReadinessResult, "ok">> {
  const audienceSegment = input.audienceSegment ?? "all";
  const candidates = await getReactivationCandidates({
    ...input,
    audienceSegment,
  });
  const recentTargets = await getRecentQueuedMessagesForReason({
    workspaceId: input.workspaceId,
    reason: reactivationWorkflow.key,
    since: new Date(
      Date.now() - input.cooldownDays * 24 * 60 * 60 * 1000,
    ).toISOString(),
  });
  const recentlyTargetedContactIds = new Set(
    recentTargets
      .filter((target) => target.campaignKey === input.campaignKey)
      .map((target) => target.contactId),
  );
  const eligibleCandidates = candidates.filter(
    (candidate) => !recentlyTargetedContactIds.has(candidate.contactId),
  );
  const skippedCandidates = candidates.filter((candidate) =>
    recentlyTargetedContactIds.has(candidate.contactId),
  );

  return {
    readinessStatus: getReadinessStatus({
      candidateCount: candidates.length,
      queuedCount: eligibleCandidates.length,
    }),
    candidateCount: candidates.length,
    eligibleCount: eligibleCandidates.length,
    skippedCount: skippedCandidates.length,
    campaignKey: input.campaignKey,
    cooldownDays: input.cooldownDays,
    audienceSegment,
    segmentBreakdown: {
      staleLeadCount: countSegment(candidates, "stale_lead"),
      pastCustomerCount: countSegment(candidates, "past_customer"),
      eligibleStaleLeadCount: countSegment(eligibleCandidates, "stale_lead"),
      eligiblePastCustomerCount: countSegment(eligibleCandidates, "past_customer"),
      skippedStaleLeadCount: countSegment(skippedCandidates, "stale_lead"),
      skippedPastCustomerCount: countSegment(skippedCandidates, "past_customer"),
    },
    candidates: eligibleCandidates,
    skippedCandidates,
  };
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

export async function executeReactivationRun(
  input: ExecuteReactivationRunInput,
): Promise<ExecuteReactivationRunResult> {
  const readiness = await evaluateReactivationReadiness(input);
  const runId = randomUUID();
  const queuedEvents = buildReactivationOutreachEvents(readiness.candidates, {
    campaignKey: input.campaignKey,
    runId,
  });

  if (queuedEvents.length > 0) {
    await appendEvents(queuedEvents);
  }

  return {
    ok: true,
    ...readiness,
    queuedCount: queuedEvents.length,
    runId,
  };
}

export async function previewReactivationRun(
  input: ExecuteReactivationRunInput,
): Promise<ReactivationReadinessResult> {
  const readiness = await evaluateReactivationReadiness(input);

  return {
    ok: true,
    ...readiness,
  };
}

export const reactivationModule = {
  key: "reactivation",
  workflows: [reactivationWorkflow],
};
