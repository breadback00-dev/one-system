import { randomUUID } from "node:crypto";

import { createQueuedOutboundMessageEvent } from "@one-system/domain";
import {
  appendEvents,
  getPaidAdsAudienceCandidates,
  getRecentQueuedMessagesForReason,
  type PaidAdsAudienceCandidate,
} from "@one-system/database";

export const paidAdsNurtureWorkflow = {
  key: "paid_ads.nurture",
  description:
    "Runs source-aware lead nurturing for attributed leads with campaign-level performance visibility.",
};

const paidAdsFollowUpWorkflowKey = "paid_ads.nurture.follow-up";
const DEFAULT_CAMPAIGN_KEY = "paid-ads-default";
const CAMPAIGN_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const FOLLOW_UP_DELAY_HOURS = 24;

export interface ExecutePaidAdsRunInput {
  workspaceId: string;
  limit: number;
  cooldownDays: number;
  campaignKey: string;
}

export type PaidAdsReadinessStatus =
  | "ready"
  | "no_candidates"
  | "cooldown_blocked"
  | "blocked_by_safety";

export interface PaidAdsReadinessResult {
  ok: true;
  readinessStatus: PaidAdsReadinessStatus;
  candidateCount: number;
  eligibleCount: number;
  skippedCooldownCount: number;
  skippedTerminalCount: number;
  skippedOptOutCount: number;
  skippedInvalidDestinationCount: number;
  skippedDuplicateContactCount: number;
  skippedLimitCount: number;
  campaignKey: string;
  cooldownDays: number;
  limit: number;
  candidates: PaidAdsAudienceCandidate[];
  skippedCandidates: PaidAdsAudienceCandidate[];
}

export interface ExecutePaidAdsRunResult extends PaidAdsReadinessResult {
  queuedCount: number;
  queuedEventCount: number;
  runId: string;
}

interface PaidAdsRunConfig {
  campaignKey: string;
  runId?: string;
}

function normalizeCampaignKey(input: string): string {
  const campaignKey = input.trim().toLowerCase();

  if (!campaignKey) {
    return DEFAULT_CAMPAIGN_KEY;
  }

  if (!CAMPAIGN_KEY_PATTERN.test(campaignKey)) {
    throw new Error(
      "Campaign key must start with a letter or number and use only lowercase letters, numbers, dashes, or underscores (max 64 chars).",
    );
  }

  return campaignKey;
}

function getReadinessStatus(args: {
  candidateCount: number;
  eligibleCount: number;
  skippedCooldownCount: number;
  skippedSafetyCount: number;
  skippedDuplicateContactCount: number;
  skippedLimitCount: number;
}): PaidAdsReadinessStatus {
  if (args.eligibleCount > 0) {
    return "ready";
  }

  if (args.candidateCount === 0) {
    return "no_candidates";
  }

  if (
    args.skippedCooldownCount > 0 &&
    args.skippedSafetyCount === 0 &&
    args.skippedDuplicateContactCount === 0 &&
    args.skippedLimitCount === 0
  ) {
    return "cooldown_blocked";
  }

  return "blocked_by_safety";
}

function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function getSourceLabel(source: string): string {
  const normalized = source.trim().toLowerCase();

  if (
    normalized.includes("facebook") ||
    normalized.includes("instagram") ||
    normalized.includes("meta")
  ) {
    return "Meta ad";
  }

  if (normalized.includes("google")) {
    return "Google ad";
  }

  if (normalized.includes("tiktok")) {
    return "TikTok ad";
  }

  return source.trim();
}

export function buildPaidAdsNurtureMessage(
  candidate: Pick<PaidAdsAudienceCandidate, "firstName" | "source" | "utmCampaign">,
): string {
  const sourceLabel = getSourceLabel(candidate.source);
  const campaignContext = candidate.utmCampaign
    ? ` from ${candidate.utmCampaign}`
    : "";

  return `Hi ${candidate.firstName}, thanks for checking us out through ${sourceLabel}${campaignContext}. If you're still interested, reply with your top treatment goal and we can help you choose the best next step.`;
}

export function buildPaidAdsNurtureFollowUpMessage(
  candidate: Pick<PaidAdsAudienceCandidate, "firstName" | "source">,
): string {
  const sourceLabel = getSourceLabel(candidate.source);

  return `Quick follow-up, ${candidate.firstName}: if you found us through ${sourceLabel} and still want help booking, reply YES and our team will send the quickest consultation options.`;
}

async function evaluatePaidAdsReadiness(
  input: ExecutePaidAdsRunInput,
): Promise<Omit<PaidAdsReadinessResult, "ok">> {
  const limit = Math.max(1, Math.min(200, Math.floor(input.limit)));
  const cooldownDays = Math.max(1, Math.min(90, Math.floor(input.cooldownDays)));
  const campaignKey = normalizeCampaignKey(input.campaignKey);
  const candidates = await getPaidAdsAudienceCandidates({
    workspaceId: input.workspaceId,
    limit: Math.max(limit * 3, 50),
  });
  const recentTargets = await getRecentQueuedMessagesForReason({
    workspaceId: input.workspaceId,
    reason: paidAdsNurtureWorkflow.key,
    since: new Date(
      Date.now() - cooldownDays * 24 * 60 * 60 * 1000,
    ).toISOString(),
  });
  const recentlyTargetedLeadIds = new Set(
    recentTargets
      .map((target) => target.leadId)
      .filter((leadId): leadId is string => Boolean(leadId)),
  );
  const seenContactIds = new Set<string>();
  const eligibleCandidates: PaidAdsAudienceCandidate[] = [];
  const skippedCandidates: PaidAdsAudienceCandidate[] = [];
  let skippedCooldownCount = 0;
  let skippedTerminalCount = 0;
  let skippedOptOutCount = 0;
  let skippedInvalidDestinationCount = 0;
  let skippedDuplicateContactCount = 0;
  let skippedLimitCount = 0;

  for (const candidate of candidates) {
    if (candidate.skipReason === "terminal_status") {
      skippedTerminalCount += 1;
      skippedCandidates.push(candidate);
      continue;
    }

    if (candidate.skipReason === "opt_out") {
      skippedOptOutCount += 1;
      skippedCandidates.push(candidate);
      continue;
    }

    if (candidate.skipReason === "missing_sms_destination") {
      skippedInvalidDestinationCount += 1;
      skippedCandidates.push(candidate);
      continue;
    }

    if (recentlyTargetedLeadIds.has(candidate.leadId)) {
      skippedCooldownCount += 1;
      skippedCandidates.push(candidate);
      continue;
    }

    if (seenContactIds.has(candidate.contactId)) {
      skippedDuplicateContactCount += 1;
      skippedCandidates.push(candidate);
      continue;
    }

    if (eligibleCandidates.length >= limit) {
      skippedLimitCount += 1;
      skippedCandidates.push(candidate);
      continue;
    }

    eligibleCandidates.push(candidate);
    seenContactIds.add(candidate.contactId);
  }

  const skippedSafetyCount =
    skippedTerminalCount + skippedOptOutCount + skippedInvalidDestinationCount;

  return {
    readinessStatus: getReadinessStatus({
      candidateCount: candidates.length,
      eligibleCount: eligibleCandidates.length,
      skippedCooldownCount,
      skippedSafetyCount,
      skippedDuplicateContactCount,
      skippedLimitCount,
    }),
    candidateCount: candidates.length,
    eligibleCount: eligibleCandidates.length,
    skippedCooldownCount,
    skippedTerminalCount,
    skippedOptOutCount,
    skippedInvalidDestinationCount,
    skippedDuplicateContactCount,
    skippedLimitCount,
    campaignKey,
    cooldownDays,
    limit,
    candidates: eligibleCandidates,
    skippedCandidates,
  };
}

export function buildPaidAdsNurtureEvents(
  candidates: PaidAdsAudienceCandidate[],
  config: PaidAdsRunConfig,
) {
  const runId = config.runId ?? randomUUID();
  const queuedAtIso = new Date().toISOString();

  return candidates.flatMap((candidate) => [
    createQueuedOutboundMessageEvent({
      workspaceId: candidate.workspaceId,
      contactId: candidate.contactId,
      leadId: candidate.leadId,
      channel: candidate.channel,
      destination: candidate.destination,
      message: buildPaidAdsNurtureMessage(candidate),
      reason: paidAdsNurtureWorkflow.key,
      campaignKey: config.campaignKey,
      runId,
      source: candidate.source,
      ...(candidate.utmSource ? { utmSource: candidate.utmSource } : {}),
      ...(candidate.utmCampaign ? { utmCampaign: candidate.utmCampaign } : {}),
    }),
    createQueuedOutboundMessageEvent({
      workspaceId: candidate.workspaceId,
      contactId: candidate.contactId,
      leadId: candidate.leadId,
      channel: candidate.channel,
      destination: candidate.destination,
      message: buildPaidAdsNurtureFollowUpMessage(candidate),
      reason: paidAdsFollowUpWorkflowKey,
      campaignKey: config.campaignKey,
      runId,
      source: candidate.source,
      ...(candidate.utmSource ? { utmSource: candidate.utmSource } : {}),
      ...(candidate.utmCampaign ? { utmCampaign: candidate.utmCampaign } : {}),
      deliverAfter: addHours(queuedAtIso, FOLLOW_UP_DELAY_HOURS),
    }),
  ]);
}

export async function executePaidAdsRun(
  input: ExecutePaidAdsRunInput,
): Promise<ExecutePaidAdsRunResult> {
  const readiness = await evaluatePaidAdsReadiness(input);
  const runId = randomUUID();
  const queuedEvents = buildPaidAdsNurtureEvents(readiness.candidates, {
    campaignKey: readiness.campaignKey,
    runId,
  });

  if (queuedEvents.length > 0) {
    await appendEvents(queuedEvents);
  }

  return {
    ok: true,
    ...readiness,
    queuedCount: readiness.candidates.length,
    queuedEventCount: queuedEvents.length,
    runId,
  };
}

export async function previewPaidAdsRun(
  input: ExecutePaidAdsRunInput,
): Promise<PaidAdsReadinessResult> {
  const readiness = await evaluatePaidAdsReadiness(input);

  return {
    ok: true,
    ...readiness,
  };
}

export const paidAdsModule = {
  key: "paid_ads",
  workflows: [paidAdsNurtureWorkflow],
};
