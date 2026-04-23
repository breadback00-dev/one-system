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
