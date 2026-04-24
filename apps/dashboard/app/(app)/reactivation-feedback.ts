export type QueueActionName = "mark_handled" | "book_slot";
export type FeedbackStatus = "success" | "error";

export interface QueueActionFeedback {
  action: QueueActionName;
  status: FeedbackStatus;
  message: string;
}

export interface ReactivationRunFeedback {
  campaignKey: string;
  runId: string;
  candidateCount: string;
  skippedCount: string;
  queuedCount: string;
  cooldownDays: string;
  audienceSegment: string;
  readinessStatus: string;
  staleLeadCount: string;
  pastCustomerCount: string;
  eligibleStaleLeadCount: string;
  eligiblePastCustomerCount: string;
}

export function getSearchParamValue(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];

  return Array.isArray(value) ? value[0] : value;
}

export function getReactivationRunFeedback(
  searchParams: Record<string, string | string[] | undefined>,
): ReactivationRunFeedback | null {
  if (getSearchParamValue(searchParams, "reactivationRun") !== "queued") {
    return null;
  }

  return {
    campaignKey:
      getSearchParamValue(searchParams, "campaignKey") ?? "reactivation-default",
    runId: getSearchParamValue(searchParams, "runId") ?? "unknown-run",
    candidateCount: getSearchParamValue(searchParams, "candidateCount") ?? "0",
    skippedCount: getSearchParamValue(searchParams, "skippedCount") ?? "0",
    queuedCount: getSearchParamValue(searchParams, "queuedCount") ?? "0",
    cooldownDays: getSearchParamValue(searchParams, "cooldownDays") ?? "14",
    audienceSegment: getSearchParamValue(searchParams, "audienceSegment") ?? "all",
    readinessStatus: getSearchParamValue(searchParams, "readinessStatus") ?? "ready",
    staleLeadCount: getSearchParamValue(searchParams, "staleLeadCount") ?? "0",
    pastCustomerCount: getSearchParamValue(searchParams, "pastCustomerCount") ?? "0",
    eligibleStaleLeadCount:
      getSearchParamValue(searchParams, "eligibleStaleLeadCount") ?? "0",
    eligiblePastCustomerCount:
      getSearchParamValue(searchParams, "eligiblePastCustomerCount") ?? "0",
  };
}

export function getReactivationRunErrorMessage(
  searchParams: Record<string, string | string[] | undefined>,
) {
  if (getSearchParamValue(searchParams, "reactivationRun") !== "error") {
    return null;
  }

  return (
    getSearchParamValue(searchParams, "reactivationRunMessage") ??
    "Unable to queue the reactivation campaign."
  );
}

export function getQueueActionFeedback(
  searchParams: Record<string, string | string[] | undefined>,
): QueueActionFeedback | null {
  const action = getSearchParamValue(searchParams, "queueAction");
  const status = getSearchParamValue(searchParams, "queueActionStatus");

  if (!action || !status) {
    return null;
  }

  if (
    (action !== "mark_handled" && action !== "book_slot") ||
    (status !== "success" && status !== "error")
  ) {
    return null;
  }

  const message =
    getSearchParamValue(searchParams, "queueActionMessage") ??
    (action === "book_slot"
      ? "Reactivation booking action processed."
      : "Reactivation handling action processed.");

  return {
    action,
    status,
    message,
  };
}
