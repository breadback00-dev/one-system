import { getSearchParamValue } from "./reactivation-feedback";

export interface ReviewsRunFeedback {
  campaignKey: string;
  runId: string;
  candidateCount: string;
  skippedCount: string;
  queuedCount: string;
  cooldownDays: string;
  completedDaysAgo: string;
  readinessStatus: string;
}

export interface ReviewsDraftFeedback {
  sentiment: string;
  confidence: string;
  suggestedAction: string;
  promptKey: string;
  draft: string;
}

export function getReviewsRunFeedback(
  searchParams: Record<string, string | string[] | undefined>,
): ReviewsRunFeedback | null {
  if (getSearchParamValue(searchParams, "reviewsRun") !== "queued") {
    return null;
  }

  return {
    campaignKey:
      getSearchParamValue(searchParams, "campaignKey") ??
      "reviews-referrals-default",
    runId: getSearchParamValue(searchParams, "runId") ?? "unknown-run",
    candidateCount: getSearchParamValue(searchParams, "candidateCount") ?? "0",
    skippedCount: getSearchParamValue(searchParams, "skippedCount") ?? "0",
    queuedCount: getSearchParamValue(searchParams, "queuedCount") ?? "0",
    cooldownDays: getSearchParamValue(searchParams, "cooldownDays") ?? "14",
    completedDaysAgo:
      getSearchParamValue(searchParams, "completedDaysAgo") ?? "2",
    readinessStatus: getSearchParamValue(searchParams, "readinessStatus") ?? "ready",
  };
}

export function getReviewsRunErrorMessage(
  searchParams: Record<string, string | string[] | undefined>,
) {
  if (getSearchParamValue(searchParams, "reviewsRun") !== "error") {
    return null;
  }

  return (
    getSearchParamValue(searchParams, "reviewsRunMessage") ??
    "Unable to queue the reviews/referrals campaign."
  );
}

export function getReviewsDraftFeedback(
  searchParams: Record<string, string | string[] | undefined>,
): ReviewsDraftFeedback | null {
  if (getSearchParamValue(searchParams, "reviewsDraft") !== "ready") {
    return null;
  }

  return {
    sentiment: getSearchParamValue(searchParams, "reviewsDraftSentiment") ?? "neutral",
    confidence:
      getSearchParamValue(searchParams, "reviewsDraftConfidence") ?? "medium",
    suggestedAction:
      getSearchParamValue(searchParams, "reviewsDraftAction") ??
      "gather_more_detail",
    promptKey:
      getSearchParamValue(searchParams, "reviewsDraftPromptKey") ??
      "medspa.review-response-draft.v1",
    draft: getSearchParamValue(searchParams, "reviewsDraftText") ?? "",
  };
}

export function getReviewsDraftErrorMessage(
  searchParams: Record<string, string | string[] | undefined>,
) {
  if (getSearchParamValue(searchParams, "reviewsDraft") !== "error") {
    return null;
  }

  return (
    getSearchParamValue(searchParams, "reviewsDraftMessage") ??
    "Unable to generate a reviews/referrals response draft."
  );
}
