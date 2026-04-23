import { randomUUID } from "node:crypto";

import {
  generateReviewResponseDraft,
  type ReviewFeedbackSentiment,
  type ReviewResponseAction,
  type ReviewResponseConfidence,
} from "@one-system/ai";
import {
  createQueuedOutboundMessageEvent,
  createReviewReferralSourceCapturedEvent,
  type ReviewReferralSourceCapturedPayload,
} from "@one-system/domain";
import {
  appendEvents,
  getRecentEventsForContactByName,
  getRecentQueuedMessagesForReason,
  getReviewRequestCandidateForAppointment,
  getReviewRequestCandidates,
  type ReviewRequestCandidate,
} from "@one-system/database";
import { evaluateReviewsReferralsReplyRouting } from "./routing";

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

export interface RouteReviewsReferralsReplyInput {
  workspaceId: string;
  contactId: string;
  channel: "sms" | "email";
  destination: string;
  messageBody: string;
  receivedAt?: string;
  cooldownDays?: number;
}

export type RouteReviewsReferralsReplyStatus =
  | "queued_promoter_follow_up"
  | "queued_referral_follow_up"
  | "queued_recovery_follow_up"
  | "ignored_no_recent_request"
  | "ignored_neutral"
  | "cooldown_blocked";

export interface RouteReviewsReferralsReplyResult {
  ok: true;
  status: RouteReviewsReferralsReplyStatus;
  campaignKey?: string;
  cooldownDays: number;
  queuedCount: number;
  queuedEventId?: string;
  referralSourceCaptured?: boolean;
  referralSourceCapturedEventId?: string;
  referredName?: string;
  referredContact?: string;
  referralSourceCaptureConfidence?: ReviewReferralSourceCapturedPayload["captureConfidence"];
}

export interface CreateReviewResponseDraftInput {
  workspaceId: string;
  customerMessage: string;
  customerFirstName?: string;
}

export interface CreateReviewResponseDraftResult {
  ok: true;
  workspaceId: string;
  promptKey: string;
  sentiment: ReviewFeedbackSentiment;
  confidence: ReviewResponseConfidence;
  suggestedNextAction: ReviewResponseAction;
  draft: string;
}

const DEFAULT_CAMPAIGN_KEY = "reviews-referrals-default";
const DEFAULT_POST_VISIT_CAMPAIGN_KEY = "reviews-referrals-post-visit";
const DEFAULT_POST_VISIT_COOLDOWN_DAYS = 30;
const DEFAULT_POST_VISIT_DELAY_HOURS = 24;
const DEFAULT_FEEDBACK_LOOKBACK_DAYS = 30;
const DEFAULT_FEEDBACK_COOLDOWN_DAYS = 7;
const MINIMUM_POST_VISIT_DELAY_MINUTES = 5;
const PROMOTER_FOLLOW_UP_REASON = `${reviewsReferralsWorkflow.key}.promoter-follow-up`;
const REFERRAL_FOLLOW_UP_REASON = `${reviewsReferralsWorkflow.key}.referral-follow-up`;
const RECOVERY_FOLLOW_UP_REASON = `${reviewsReferralsWorkflow.key}.recovery-follow-up`;
const REFERRAL_SOURCE_CAPTURED_EVENT_NAME =
  "reviews_referrals.referral_source_captured";
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

function normalizeFreeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function getPromoterFollowUpMessage(): string {
  return "Thank you for the 5-star feedback. If you're open to it, reply REVIEW and we'll send our public review link. If someone comes to mind who could benefit, reply REFER and we'll help with an intro offer.";
}

function getRecoveryFollowUpMessage(): string {
  return "Thank you for the honest feedback. We're sorry your experience wasn't ideal. A team member will follow up shortly so we can make this right.";
}

function getReferralFollowUpMessage(): string {
  return "Amazing, thank you for offering a referral. If you share their first name and best contact method, we can send a friendly intro offer and keep you posted.";
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

export async function routeReviewsReferralsReply(
  input: RouteReviewsReferralsReplyInput,
): Promise<RouteReviewsReferralsReplyResult> {
  const receivedAt = input.receivedAt ?? new Date().toISOString();
  const cooldownDays = Math.max(
    1,
    Math.min(30, Math.floor(input.cooldownDays ?? DEFAULT_FEEDBACK_COOLDOWN_DAYS)),
  );
  const lookbackSince = new Date(
    Date.now() - DEFAULT_FEEDBACK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const recentReviewRequests = await getRecentQueuedMessagesForReason({
    workspaceId: input.workspaceId,
    reason: reviewsReferralsWorkflow.key,
    since: lookbackSince,
  });
  const recentRequestForContact = recentReviewRequests.find(
    (request) => request.contactId === input.contactId,
  );

  if (!recentRequestForContact) {
    return {
      ok: true,
      status: "ignored_no_recent_request",
      cooldownDays,
      queuedCount: 0,
    };
  }

  const normalizedMessage = normalizeFreeText(input.messageBody);
  const recentReferralFollowUps = await getRecentQueuedMessagesForReason({
    workspaceId: input.workspaceId,
    reason: REFERRAL_FOLLOW_UP_REASON,
    since: lookbackSince,
  });
  const hasRecentReferralFollowUp = recentReferralFollowUps.some(
    (event) => event.contactId === input.contactId,
  );
  const routingEvaluation = evaluateReviewsReferralsReplyRouting({
    messageBody: input.messageBody,
    hasRecentReferralFollowUp,
  });
  const referredName = routingEvaluation.referredName;
  const referredContact = routingEvaluation.referredContact;
  const referralSourceCaptureConfidence =
    routingEvaluation.referralSourceCaptureConfidence;
  const canCaptureReferralSource = routingEvaluation.canCaptureReferralSource;
  let capturedReferralSourceEvent:
    | ReturnType<typeof createReviewReferralSourceCapturedEvent>
    | undefined;

  if (canCaptureReferralSource) {
    const recentCapturedSourceEvents = await getRecentEventsForContactByName({
      workspaceId: input.workspaceId,
      name: REFERRAL_SOURCE_CAPTURED_EVENT_NAME,
      contactId: input.contactId,
      since: lookbackSince,
      limit: 100,
    });
    const isDuplicateCapture = recentCapturedSourceEvents.some((event) => {
      const payload = event.payload as ReviewReferralSourceCapturedPayload;
      return payload.sourceMessageNormalized === normalizedMessage;
    });

    if (!isDuplicateCapture) {
      capturedReferralSourceEvent = createReviewReferralSourceCapturedEvent({
        workspaceId: input.workspaceId,
        contactId: input.contactId,
        sourceMessage: input.messageBody.trim(),
        sourceMessageNormalized: normalizedMessage,
        ...(referredName ? { referredName } : {}),
        ...(referredContact ? { referredContact } : {}),
        ...(referralSourceCaptureConfidence
          ? { captureConfidence: referralSourceCaptureConfidence }
          : {}),
        ...(recentRequestForContact.campaignKey
          ? { campaignKey: recentRequestForContact.campaignKey }
          : {}),
        ...(recentRequestForContact.runId
          ? { runId: recentRequestForContact.runId }
          : {}),
        capturedAt: receivedAt,
      });
    }
  }

  const followUp =
    routingEvaluation.followUpStatus === "queued_recovery_follow_up"
      ? {
          status: "queued_recovery_follow_up" as const,
          reason: RECOVERY_FOLLOW_UP_REASON,
          message: getRecoveryFollowUpMessage(),
        }
      : routingEvaluation.followUpStatus === "queued_referral_follow_up"
        ? {
            status: "queued_referral_follow_up" as const,
            reason: REFERRAL_FOLLOW_UP_REASON,
            message: getReferralFollowUpMessage(),
          }
        : routingEvaluation.followUpStatus === "queued_promoter_follow_up"
          ? {
              status: "queued_promoter_follow_up" as const,
              reason: PROMOTER_FOLLOW_UP_REASON,
              message: getPromoterFollowUpMessage(),
            }
          : null;

  if (!followUp) {
    if (capturedReferralSourceEvent) {
      await appendEvents([capturedReferralSourceEvent]);
    }

    return {
      ok: true,
      status: "ignored_neutral",
      ...(recentRequestForContact.campaignKey
        ? { campaignKey: recentRequestForContact.campaignKey }
        : {}),
      cooldownDays,
      queuedCount: 0,
      ...(capturedReferralSourceEvent
        ? {
            referralSourceCaptured: true,
            referralSourceCapturedEventId: capturedReferralSourceEvent.id,
            ...(referralSourceCaptureConfidence
              ? {
                  referralSourceCaptureConfidence:
                    referralSourceCaptureConfidence,
                }
              : {}),
          }
        : {}),
      ...(referredName ? { referredName } : {}),
      ...(referredContact ? { referredContact } : {}),
    };
  }

  const recentFollowUps = await getRecentQueuedMessagesForReason({
    workspaceId: input.workspaceId,
    reason: followUp.reason,
    since: new Date(
      Date.now() - cooldownDays * 24 * 60 * 60 * 1000,
    ).toISOString(),
  });
  const wasRecentlyRouted = recentFollowUps.some(
    (event) => event.contactId === input.contactId,
  );

  if (wasRecentlyRouted) {
    if (capturedReferralSourceEvent) {
      await appendEvents([capturedReferralSourceEvent]);
    }

    return {
      ok: true,
      status: "cooldown_blocked",
      ...(recentRequestForContact.campaignKey
        ? { campaignKey: recentRequestForContact.campaignKey }
        : {}),
      cooldownDays,
      queuedCount: 0,
      ...(capturedReferralSourceEvent
        ? {
            referralSourceCaptured: true,
            referralSourceCapturedEventId: capturedReferralSourceEvent.id,
            ...(referralSourceCaptureConfidence
              ? {
                  referralSourceCaptureConfidence:
                    referralSourceCaptureConfidence,
                }
              : {}),
          }
        : {}),
      ...(referredName ? { referredName } : {}),
      ...(referredContact ? { referredContact } : {}),
    };
  }

  const queuedEvent = createQueuedOutboundMessageEvent({
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    channel: input.channel,
    destination: input.destination,
    message: followUp.message,
    reason: followUp.reason,
    ...(recentRequestForContact.campaignKey
      ? { campaignKey: recentRequestForContact.campaignKey }
      : {}),
    runId: randomUUID(),
    deliverAfter: receivedAt,
  });
  const eventsToAppend = capturedReferralSourceEvent
    ? [capturedReferralSourceEvent, queuedEvent]
    : [queuedEvent];
  await appendEvents(eventsToAppend);

  return {
    ok: true,
    status: followUp.status,
    ...(recentRequestForContact.campaignKey
      ? { campaignKey: recentRequestForContact.campaignKey }
      : {}),
    cooldownDays,
    queuedCount: 1,
    queuedEventId: queuedEvent.id,
    ...(capturedReferralSourceEvent
      ? {
          referralSourceCaptured: true,
          referralSourceCapturedEventId: capturedReferralSourceEvent.id,
          ...(referralSourceCaptureConfidence
            ? {
                referralSourceCaptureConfidence:
                  referralSourceCaptureConfidence,
              }
            : {}),
        }
      : {}),
    ...(referredName ? { referredName } : {}),
    ...(referredContact ? { referredContact } : {}),
  };
}

export function createReviewResponseDraft(
  input: CreateReviewResponseDraftInput,
): CreateReviewResponseDraftResult {
  const response = generateReviewResponseDraft({
    customerMessage: input.customerMessage,
    ...(input.customerFirstName
      ? { customerFirstName: input.customerFirstName }
      : {}),
  });

  return {
    ok: true,
    workspaceId: input.workspaceId,
    promptKey: response.promptKey,
    sentiment: response.sentiment,
    confidence: response.confidence,
    suggestedNextAction: response.suggestedNextAction,
    draft: response.draft,
  };
}

export const reviewsReferralsModule = {
  key: "reviews_referrals",
  workflows: [reviewsReferralsWorkflow],
};
