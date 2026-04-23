import { randomUUID } from "node:crypto";

import { createQueuedOutboundMessageEvent } from "@one-system/domain";
import {
  appendEvents,
  getRecentQueuedMessagesForReason,
  getReviewRequestCandidateForAppointment,
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

export interface TriggerPostVisitReviewRequestInput {
  workspaceId: string;
  appointmentId: string;
  campaignKey?: string;
  cooldownDays?: number;
  delayHours?: number;
}

export type TriggerPostVisitReviewRequestStatus =
  | "queued"
  | "not_eligible"
  | "cooldown_blocked";

export interface TriggerPostVisitReviewRequestResult {
  ok: true;
  status: TriggerPostVisitReviewRequestStatus;
  appointmentId: string;
  campaignKey: string;
  cooldownDays: number;
  delayHours: number;
  runId: string;
  candidateCount: number;
  queuedCount: number;
  skippedCount: number;
  contactId?: string;
  queuedEventId?: string;
  deliverAfter?: string;
}

const DEFAULT_CAMPAIGN_KEY = "reviews-referrals-default";
const DEFAULT_POST_VISIT_CAMPAIGN_KEY = "reviews-referrals-post-visit";
const DEFAULT_POST_VISIT_COOLDOWN_DAYS = 30;
const DEFAULT_POST_VISIT_DELAY_HOURS = 24;
const MINIMUM_POST_VISIT_DELAY_MINUTES = 5;
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

function buildReviewRequestMessage(firstName: string): string {
  return `Hi ${firstName}, thanks for visiting us recently. On a 1-5 scale, how was your experience? If you felt it was a 5, we'd love to help you refer a friend as well.`;
}

function getDeliverAfterIso(args: {
  completedVisitAt: string;
  delayHours: number;
}): string {
  const completedVisitAt = new Date(args.completedVisitAt);
  const delayedFromVisit = new Date(
    completedVisitAt.getTime() + args.delayHours * 60 * 60 * 1000,
  );
  const minimumBuffer = new Date(
    Date.now() + MINIMUM_POST_VISIT_DELAY_MINUTES * 60 * 1000,
  );

  return (delayedFromVisit > minimumBuffer
    ? delayedFromVisit
    : minimumBuffer).toISOString();
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
      message: buildReviewRequestMessage(candidate.firstName),
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

export async function triggerPostVisitReviewRequest(
  input: TriggerPostVisitReviewRequestInput,
): Promise<TriggerPostVisitReviewRequestResult> {
  const campaignKey = normalizeCampaignKey(
    input.campaignKey ?? DEFAULT_POST_VISIT_CAMPAIGN_KEY,
  );
  const cooldownDays = Math.max(
    1,
    Math.min(90, Math.floor(input.cooldownDays ?? DEFAULT_POST_VISIT_COOLDOWN_DAYS)),
  );
  const delayHours = Math.max(
    0,
    Math.min(168, Math.floor(input.delayHours ?? DEFAULT_POST_VISIT_DELAY_HOURS)),
  );
  const candidate = await getReviewRequestCandidateForAppointment({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
  });

  if (!candidate) {
    return {
      ok: true,
      status: "not_eligible",
      appointmentId: input.appointmentId,
      campaignKey,
      cooldownDays,
      delayHours,
      runId: "not-queued",
      candidateCount: 0,
      queuedCount: 0,
      skippedCount: 0,
    };
  }

  const recentTargets = await getRecentQueuedMessagesForReason({
    workspaceId: input.workspaceId,
    reason: reviewsReferralsWorkflow.key,
    since: new Date(
      Date.now() - cooldownDays * 24 * 60 * 60 * 1000,
    ).toISOString(),
  });
  const recentlyTargeted = recentTargets.some(
    (target) =>
      target.contactId === candidate.contactId &&
      normalizeCampaignKeyForComparison(target.campaignKey) === campaignKey,
  );

  if (recentlyTargeted) {
    return {
      ok: true,
      status: "cooldown_blocked",
      appointmentId: input.appointmentId,
      campaignKey,
      cooldownDays,
      delayHours,
      runId: "cooldown-blocked",
      candidateCount: 1,
      queuedCount: 0,
      skippedCount: 1,
      contactId: candidate.contactId,
    };
  }

  const runId = randomUUID();
  const deliverAfter = getDeliverAfterIso({
    completedVisitAt: candidate.completedVisitAt,
    delayHours,
  });
  const queuedEvent = createQueuedOutboundMessageEvent({
    workspaceId: candidate.workspaceId,
    contactId: candidate.contactId,
    channel: candidate.channel,
    destination: candidate.destination,
    message: buildReviewRequestMessage(candidate.firstName),
    reason: reviewsReferralsWorkflow.key,
    campaignKey,
    runId,
    deliverAfter,
  });

  await appendEvents([queuedEvent]);

  return {
    ok: true,
    status: "queued",
    appointmentId: input.appointmentId,
    campaignKey,
    cooldownDays,
    delayHours,
    runId,
    candidateCount: 1,
    queuedCount: 1,
    skippedCount: 0,
    contactId: candidate.contactId,
    queuedEventId: queuedEvent.id,
    deliverAfter,
  };
}

export const reviewsReferralsModule = {
  key: "reviews_referrals",
  workflows: [reviewsReferralsWorkflow],
};
