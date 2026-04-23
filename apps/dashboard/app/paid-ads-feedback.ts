import { getSearchParamValue } from "./reactivation-feedback";

export interface PaidAdsRunFeedback {
  campaignKey: string;
  runId: string;
  candidateCount: string;
  eligibleCount: string;
  queuedCount: string;
  queuedEventCount: string;
  skippedCooldownCount: string;
  skippedTerminalCount: string;
  skippedOptOutCount: string;
  skippedInvalidDestinationCount: string;
  skippedDuplicateContactCount: string;
  skippedLimitCount: string;
  readinessStatus: string;
  cooldownDays: string;
  limit: string;
}

export interface PaidAdsSpendFeedback {
  source: string;
  amount: string;
  currency: string;
  reportDate: string;
  utmCampaign?: string;
}

export function getPaidAdsRunFeedback(
  searchParams: Record<string, string | string[] | undefined>,
): PaidAdsRunFeedback | null {
  if (getSearchParamValue(searchParams, "paidAdsRun") !== "queued") {
    return null;
  }

  return {
    campaignKey: getSearchParamValue(searchParams, "campaignKey") ?? "paid-ads-default",
    runId: getSearchParamValue(searchParams, "runId") ?? "unknown-run",
    candidateCount: getSearchParamValue(searchParams, "candidateCount") ?? "0",
    eligibleCount: getSearchParamValue(searchParams, "eligibleCount") ?? "0",
    queuedCount: getSearchParamValue(searchParams, "queuedCount") ?? "0",
    queuedEventCount: getSearchParamValue(searchParams, "queuedEventCount") ?? "0",
    skippedCooldownCount:
      getSearchParamValue(searchParams, "skippedCooldownCount") ?? "0",
    skippedTerminalCount:
      getSearchParamValue(searchParams, "skippedTerminalCount") ?? "0",
    skippedOptOutCount: getSearchParamValue(searchParams, "skippedOptOutCount") ?? "0",
    skippedInvalidDestinationCount:
      getSearchParamValue(searchParams, "skippedInvalidDestinationCount") ?? "0",
    skippedDuplicateContactCount:
      getSearchParamValue(searchParams, "skippedDuplicateContactCount") ?? "0",
    skippedLimitCount: getSearchParamValue(searchParams, "skippedLimitCount") ?? "0",
    readinessStatus: getSearchParamValue(searchParams, "readinessStatus") ?? "ready",
    cooldownDays: getSearchParamValue(searchParams, "cooldownDays") ?? "14",
    limit: getSearchParamValue(searchParams, "limit") ?? "25",
  };
}

export function getPaidAdsRunErrorMessage(
  searchParams: Record<string, string | string[] | undefined>,
) {
  if (getSearchParamValue(searchParams, "paidAdsRun") !== "error") {
    return null;
  }

  return (
    getSearchParamValue(searchParams, "paidAdsRunMessage") ??
    "Unable to queue the paid ads nurture campaign."
  );
}

export function getPaidAdsSpendFeedback(
  searchParams: Record<string, string | string[] | undefined>,
): PaidAdsSpendFeedback | null {
  if (getSearchParamValue(searchParams, "paidAdsSpend") !== "recorded") {
    return null;
  }

  const utmCampaign = getSearchParamValue(
    searchParams,
    "paidAdsSpendUtmCampaign",
  );

  return {
    source: getSearchParamValue(searchParams, "paidAdsSpendSource") ?? "unknown",
    amount: getSearchParamValue(searchParams, "paidAdsSpendAmount") ?? "0",
    currency: getSearchParamValue(searchParams, "paidAdsSpendCurrency") ?? "USD",
    reportDate: getSearchParamValue(searchParams, "paidAdsSpendDate") ?? "",
    ...(utmCampaign ? { utmCampaign } : {}),
  };
}

export function getPaidAdsSpendErrorMessage(
  searchParams: Record<string, string | string[] | undefined>,
) {
  if (getSearchParamValue(searchParams, "paidAdsSpend") !== "error") {
    return null;
  }

  return (
    getSearchParamValue(searchParams, "paidAdsSpendMessage") ??
    "Unable to record paid ads spend."
  );
}
