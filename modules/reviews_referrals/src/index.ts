import { randomUUID } from "node:crypto";

import { createQueuedOutboundMessageEvent } from "@one-system/domain";
import {
  appendEvents,
  getRecentQueuedMessagesForReason,
  getReviewRequestCandidates,
  type ReviewRequestCandidate,
} from "@one-system/database";

export const reviewsReferralsWorkflow = {
  key: "reviews_referrals.post-visit-request",
  description:
    "Requests post-visit feedback and referral interest from recently completed clients.",
};

export interface ReviewsReferralsRunConfig {
  campaignKey: string;
  runId?: string;
}

export interface ExecuteReviewsReferralsRunInput {
  workspaceId: string;
  completedDaysAgo: number;
  limit: number;
  cooldownDays: number;
  campaignKey: string;
}

export type ReviewsReferralsReadinessStatus =
  | "ready"
  | "no_candidates"
  | "cooldown_blocked";

export interface ReviewsReferralsReadinessResult {
  ok: true;
  readinessStatus: ReviewsReferralsReadinessStatus;
  candidateCount: number;
  eligibleCount: number;
  skippedCount: number;
  campaignKey: string;
  cooldownDays: number;
  completedDaysAgo: number;
  candidates: ReviewRequestCandidate[];
  skippedCandidates: ReviewRequestCandidate[];
}

export interface ExecuteReviewsReferralsRunResult
  extends ReviewsReferralsReadinessResult {
  queuedCount: number;
  runId: string;
}

const DEFAULT_CAMPAIGN_KEY = "reviews-referrals-default";
const CAMPAIGN_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

function getReadinessStatus(args: {
  candidateCount: number;
  queuedCount: number;
}): ReviewsReferralsReadinessStatus {
  if (args.queuedCount > 0) {
    return "ready";
  }

  if (args.candidateCount === 0) {
    return "no_candidates";
  }

  return "cooldown_blocked";
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

function normalizeCampaignKeyForComparison(input: string | undefined): string {
  return (input ?? "").trim().toLowerCase();
}

async function evaluateReviewsReferralsReadiness(
  input: ExecuteReviewsReferralsRunInput,
): Promise<Omit<ReviewsReferralsReadinessResult, "ok">> {
  const campaignKey = normalizeCampaignKey(input.campaignKey);
  const candidates = await getReviewRequestCandidates({
    workspaceId: input.workspaceId,
    completedDaysAgo: input.completedDaysAgo,
    limit: input.limit,
  });
  const recentTargets = await getRecentQueuedMessagesForReason({
    workspaceId: input.workspaceId,
    reason: reviewsReferralsWorkflow.key,
    since: new Date(
      Date.now() - input.cooldownDays * 24 * 60 * 60 * 1000,
    ).toISOString(),
  });
  const recentlyTargetedContactIds = new Set(
    recentTargets
      .filter(
        (target) =>
          normalizeCampaignKeyForComparison(target.campaignKey) === campaignKey,
      )
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
    campaignKey,
    cooldownDays: input.cooldownDays,
    completedDaysAgo: input.completedDaysAgo,
    candidates: eligibleCandidates,
    skippedCandidates,
  };
}

export function buildReviewsReferralsOutreachEvents(
  candidates: ReviewRequestCandidate[],
  config: ReviewsReferralsRunConfig,
) {
  const runId = config.runId ?? randomUUID();

  return candidates.map((candidate) =>
    createQueuedOutboundMessageEvent({
      workspaceId: candidate.workspaceId,
      contactId: candidate.contactId,
      channel: candidate.channel,
      destination: candidate.destination,
      message: `Hi ${candidate.firstName}, thanks for visiting us recently. On a 1-5 scale, how was your experience? If you felt it was a 5, we'd love to help you refer a friend as well.`,
      reason: reviewsReferralsWorkflow.key,
      campaignKey: config.campaignKey,
      runId,
    }),
  );
}

export async function executeReviewsReferralsRun(
  input: ExecuteReviewsReferralsRunInput,
): Promise<ExecuteReviewsReferralsRunResult> {
  const readiness = await evaluateReviewsReferralsReadiness(input);
  const runId = randomUUID();
  const queuedEvents = buildReviewsReferralsOutreachEvents(readiness.candidates, {
    campaignKey: readiness.campaignKey,
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

export async function previewReviewsReferralsRun(
  input: ExecuteReviewsReferralsRunInput,
): Promise<ReviewsReferralsReadinessResult> {
  const readiness = await evaluateReviewsReferralsReadiness(input);

  return {
    ok: true,
    ...readiness,
  };
}

export const reviewsReferralsModule = {
  key: "reviews_referrals",
  workflows: [reviewsReferralsWorkflow],
};
