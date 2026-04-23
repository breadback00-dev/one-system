import {
  classifyReviewReferralReplySignals,
  extractReviewReferralSourceDetails,
  type ReferralSourceCaptureConfidence,
} from "@one-system/domain";

export type ReviewsReferralsFollowUpStatus =
  | "queued_promoter_follow_up"
  | "queued_referral_follow_up"
  | "queued_recovery_follow_up"
  | "ignored_neutral";

export interface ReviewsReferralsReplyRoutingEvaluation {
  followUpStatus: ReviewsReferralsFollowUpStatus;
  promoterFeedback: boolean;
  recoveryFeedback: boolean;
  referralIntentFeedback: boolean;
  canCaptureReferralSource: boolean;
  referredName?: string;
  referredContact?: string;
  referralSourceCaptureConfidence?: ReferralSourceCaptureConfidence;
}

export function evaluateReviewsReferralsReplyRouting(args: {
  messageBody: string;
  hasRecentReferralFollowUp: boolean;
}): ReviewsReferralsReplyRoutingEvaluation {
  const signals = classifyReviewReferralReplySignals(args.messageBody);
  const sourceDetails = extractReviewReferralSourceDetails(args.messageBody);
  const hasSourceDetails = Boolean(
    sourceDetails.referredName || sourceDetails.referredContact,
  );
  const confidenceEligibleForCapture =
    sourceDetails.captureConfidence === "high" ||
    sourceDetails.captureConfidence === "medium" ||
    args.hasRecentReferralFollowUp;
  const canCaptureReferralSource =
    hasSourceDetails &&
    (signals.referralIntent || args.hasRecentReferralFollowUp) &&
    confidenceEligibleForCapture;

  const followUpStatus = signals.recovery
    ? "queued_recovery_follow_up"
    : signals.referralIntent
      ? "queued_referral_follow_up"
      : signals.promoter
        ? "queued_promoter_follow_up"
        : "ignored_neutral";

  return {
    followUpStatus,
    promoterFeedback: signals.promoter,
    recoveryFeedback: signals.recovery,
    referralIntentFeedback: signals.referralIntent,
    canCaptureReferralSource,
    ...(sourceDetails.referredName
      ? { referredName: sourceDetails.referredName }
      : {}),
    ...(sourceDetails.referredContact
      ? { referredContact: sourceDetails.referredContact }
      : {}),
    ...(sourceDetails.captureConfidence
      ? {
          referralSourceCaptureConfidence: sourceDetails.captureConfidence,
        }
      : {}),
  };
}
