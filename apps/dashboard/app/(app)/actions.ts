"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  assertReactivationFollowUpActionable,
  getAvailableBookingSlots,
  isAppointmentSlotAvailable,
  markReactivationFollowUpHandled,
  recordPaidAdsSpend,
  saveAppointmentTransaction,
  type ReactivationAudienceSegment,
} from "@one-system/database";
import { createAppointment } from "@one-system/domain";
import { executePaidAdsRun } from "@one-system/paid-ads";
import { executeReactivationRun } from "@one-system/reactivation";
import {
  createReviewResponseDraft,
  executeReviewsReferralsRun,
} from "@one-system/reviews-referrals";
import {
  ingestConsultationTranscript,
  syncConsultationTranscripts,
} from "@one-system/sales-enablement";
import { assertDashboardMutationAllowed } from "@one-system/config";
import { getCurrentWorkspace } from "../../lib/workspace";

const DASHBOARD_PATH = "/dashboard";
const REACTIVATION_PATH = "/reactivation";

function parseAudienceSegment(value: FormDataEntryValue | null): ReactivationAudienceSegment {
  const audienceSegment = String(value ?? "").trim();

  if (
    audienceSegment === "all" ||
    audienceSegment === "stale_leads" ||
    audienceSegment === "past_customers"
  ) {
    return audienceSegment;
  }

  throw new Error("Audience segment must be all, stale_leads, or past_customers.");
}

function formatFeedbackMessage(error: unknown, fallback: string): string {
  const rawMessage =
    error instanceof Error && error.message.trim().length > 0
      ? error.message
      : fallback;
  const normalized = rawMessage.replace(/\s+/g, " ").trim();

  return normalized.slice(0, 220);
}

async function getWorkspaceIdForRequest(): Promise<string> {
  const workspace = await getCurrentWorkspace();
  return workspace.id;
}

export async function markReactivationItemHandled(formData: FormData) {
  assertDashboardMutationAllowed();
  const workspaceId = await getWorkspaceIdForRequest();

  const queuedEventId = String(formData.get("queuedEventId") ?? "").trim();
  const contactId = String(formData.get("contactId") ?? "").trim();
  const rawNote = String(formData.get("note") ?? "").trim();
  const note = rawNote.length > 280 ? rawNote.slice(0, 280) : rawNote;

  let feedbackParams: URLSearchParams;

  if (!queuedEventId || !contactId) {
    feedbackParams = new URLSearchParams({
      queueAction: "mark_handled",
      queueActionStatus: "error",
      queueActionMessage: "Reactivation queue item is missing required identifiers.",
    });
    revalidatePath(REACTIVATION_PATH);
    redirect(`${REACTIVATION_PATH}?${feedbackParams.toString()}`);
  }

  try {
    await assertReactivationFollowUpActionable({
      workspaceId: workspaceId,
      queuedEventId,
      contactId,
    });

    await markReactivationFollowUpHandled({
      workspaceId: workspaceId,
      queuedEventId,
      contactId,
      ...(note ? { note } : {}),
    });

    feedbackParams = new URLSearchParams({
      queueAction: "mark_handled",
      queueActionStatus: "success",
      queueActionMessage: "Follow-up item marked handled.",
    });
  } catch (error) {
    feedbackParams = new URLSearchParams({
      queueAction: "mark_handled",
      queueActionStatus: "error",
      queueActionMessage: formatFeedbackMessage(
        error,
        "Unable to mark this follow-up item handled.",
      ),
    });
  }

  revalidatePath(REACTIVATION_PATH);
  redirect(`${REACTIVATION_PATH}?${feedbackParams.toString()}`);
}

export async function bookReactivationItemAtSlot(formData: FormData) {
  assertDashboardMutationAllowed();
  const workspaceId = await getWorkspaceIdForRequest();

  const queuedEventId = String(formData.get("queuedEventId") ?? "").trim();
  const contactId = String(formData.get("contactId") ?? "").trim();
  const startsAtInput = String(formData.get("startsAt") ?? "").trim();

  let feedbackParams: URLSearchParams;

  if (!queuedEventId || !contactId || !startsAtInput) {
    feedbackParams = new URLSearchParams({
      queueAction: "book_slot",
      queueActionStatus: "error",
      queueActionMessage: "Reactivation queue item is missing required identifiers.",
    });
    revalidatePath(REACTIVATION_PATH);
    redirect(`${REACTIVATION_PATH}?${feedbackParams.toString()}`);
  }

  const startsAt = new Date(startsAtInput);

  if (Number.isNaN(startsAt.getTime())) {
    feedbackParams = new URLSearchParams({
      queueAction: "book_slot",
      queueActionStatus: "error",
      queueActionMessage: "Selected appointment slot is invalid.",
    });
    revalidatePath(REACTIVATION_PATH);
    redirect(`${REACTIVATION_PATH}?${feedbackParams.toString()}`);
  }

  try {
    await assertReactivationFollowUpActionable({
      workspaceId: workspaceId,
      queuedEventId,
      contactId,
    });

    const availableSlots = await getAvailableBookingSlots({
      workspaceId: workspaceId,
      daysAhead: 14,
      limit: 50,
    });
    const selectedSlotIsOffered = availableSlots.some(
      (slot) => slot.startsAt === startsAt.toISOString(),
    );

    if (!selectedSlotIsOffered) {
      throw new Error("Selected appointment slot is no longer offered.");
    }

    const isAvailable = await isAppointmentSlotAvailable({
      workspaceId: workspaceId,
      startsAt: startsAt.toISOString(),
    });

    if (!isAvailable) {
      throw new Error("Selected appointment slot is no longer available.");
    }

    const appointmentResult = createAppointment({
      workspaceId: workspaceId,
      contactId,
      startsAt: startsAt.toISOString(),
      outcome: "scheduled",
    });

    await saveAppointmentTransaction(appointmentResult);
    await markReactivationFollowUpHandled({
      workspaceId: workspaceId,
      queuedEventId,
      contactId,
      note: `Booked from Module 2 dashboard queue for ${startsAt.toISOString()}`,
    });

    feedbackParams = new URLSearchParams({
      queueAction: "book_slot",
      queueActionStatus: "success",
      queueActionMessage: `Appointment booked for ${startsAt.toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      })}.`,
    });
  } catch (error) {
    feedbackParams = new URLSearchParams({
      queueAction: "book_slot",
      queueActionStatus: "error",
      queueActionMessage: formatFeedbackMessage(
        error,
        "Unable to book this reactivation follow-up item.",
      ),
    });
  }

  revalidatePath(REACTIVATION_PATH);
  redirect(`${REACTIVATION_PATH}?${feedbackParams.toString()}`);
}

export async function runReactivationCampaign(formData: FormData) {
  assertDashboardMutationAllowed();
  const workspaceId = await getWorkspaceIdForRequest();

  const campaignKey =
    String(formData.get("campaignKey") ?? "").trim() || "reactivation-default";
  const inactiveDays = Number.parseInt(
    String(formData.get("inactiveDays") ?? "30"),
    10,
  );
  const limit = Number.parseInt(String(formData.get("limit") ?? "25"), 10);
  const cooldownDays = Number.parseInt(
    String(formData.get("cooldownDays") ?? "14"),
    10,
  );
  const audienceSegment = parseAudienceSegment(formData.get("audienceSegment"));

  let result: Awaited<ReturnType<typeof executeReactivationRun>>;

  try {
    result = await executeReactivationRun({
      workspaceId: workspaceId,
      inactiveDays: Number.isFinite(inactiveDays)
        ? Math.max(7, Math.floor(inactiveDays))
        : 30,
      limit: Number.isFinite(limit)
        ? Math.max(1, Math.min(100, Math.floor(limit)))
        : 25,
      cooldownDays: Number.isFinite(cooldownDays)
        ? Math.max(1, Math.min(90, Math.floor(cooldownDays)))
        : 14,
      campaignKey,
      audienceSegment,
    });
  } catch (error) {
    revalidatePath(REACTIVATION_PATH);
    const params = new URLSearchParams({
      reactivationRun: "error",
      reactivationRunMessage: formatFeedbackMessage(
        error,
        "Unable to queue the reactivation campaign.",
      ),
    });
    redirect(`${REACTIVATION_PATH}?${params.toString()}`);
  }

  revalidatePath(REACTIVATION_PATH);
  const params = new URLSearchParams({
    reactivationRun: "queued",
    campaignKey: result.campaignKey,
    runId: result.runId,
    candidateCount: String(result.candidateCount),
    skippedCount: String(result.skippedCount),
    queuedCount: String(result.queuedCount),
    cooldownDays: String(result.cooldownDays),
    audienceSegment: result.audienceSegment,
    readinessStatus: result.readinessStatus,
    staleLeadCount: String(result.segmentBreakdown.staleLeadCount),
    pastCustomerCount: String(result.segmentBreakdown.pastCustomerCount),
    eligibleStaleLeadCount: String(result.segmentBreakdown.eligibleStaleLeadCount),
    eligiblePastCustomerCount: String(
      result.segmentBreakdown.eligiblePastCustomerCount,
    ),
  });
  redirect(`${REACTIVATION_PATH}?${params.toString()}`);
}

export async function runReviewsReferralsCampaign(formData: FormData) {
  assertDashboardMutationAllowed();
  const workspaceId = await getWorkspaceIdForRequest();

  const campaignKey =
    String(formData.get("campaignKey") ?? "").trim() ||
    "reviews-referrals-default";
  const completedDaysAgo = Number.parseInt(
    String(formData.get("completedDaysAgo") ?? "2"),
    10,
  );
  const limit = Number.parseInt(String(formData.get("limit") ?? "25"), 10);
  const cooldownDays = Number.parseInt(
    String(formData.get("cooldownDays") ?? "14"),
    10,
  );

  let result: Awaited<ReturnType<typeof executeReviewsReferralsRun>>;

  try {
    result = await executeReviewsReferralsRun({
      workspaceId: workspaceId,
      completedDaysAgo: Number.isFinite(completedDaysAgo)
        ? Math.max(1, Math.min(120, Math.floor(completedDaysAgo)))
        : 2,
      limit: Number.isFinite(limit)
        ? Math.max(1, Math.min(100, Math.floor(limit)))
        : 25,
      cooldownDays: Number.isFinite(cooldownDays)
        ? Math.max(1, Math.min(90, Math.floor(cooldownDays)))
        : 14,
      campaignKey,
    });
  } catch (error) {
    revalidatePath(DASHBOARD_PATH);
    const params = new URLSearchParams({
      reviewsRun: "error",
      reviewsRunMessage: formatFeedbackMessage(
        error,
        "Unable to queue the reviews/referrals campaign.",
      ),
    });
    redirect(`${DASHBOARD_PATH}?${params.toString()}`);
  }

  revalidatePath(DASHBOARD_PATH);
  const params = new URLSearchParams({
    reviewsRun: "queued",
    campaignKey: result.campaignKey,
    runId: result.runId,
    candidateCount: String(result.candidateCount),
    skippedCount: String(result.skippedCount),
    queuedCount: String(result.queuedCount),
    cooldownDays: String(result.cooldownDays),
    completedDaysAgo: String(result.completedDaysAgo),
    readinessStatus: result.readinessStatus,
  });
  redirect(`${DASHBOARD_PATH}?${params.toString()}`);
}

export async function runPaidAdsCampaign(formData: FormData) {
  assertDashboardMutationAllowed();
  const workspaceId = await getWorkspaceIdForRequest();

  const campaignKey =
    String(formData.get("campaignKey") ?? "").trim() || "paid-ads-default";
  const limit = Number.parseInt(String(formData.get("limit") ?? "25"), 10);
  const cooldownDays = Number.parseInt(
    String(formData.get("cooldownDays") ?? "14"),
    10,
  );

  let result: Awaited<ReturnType<typeof executePaidAdsRun>>;

  try {
    result = await executePaidAdsRun({
      workspaceId: workspaceId,
      limit: Number.isFinite(limit)
        ? Math.max(1, Math.min(200, Math.floor(limit)))
        : 25,
      cooldownDays: Number.isFinite(cooldownDays)
        ? Math.max(1, Math.min(90, Math.floor(cooldownDays)))
        : 14,
      campaignKey,
    });
  } catch (error) {
    revalidatePath(DASHBOARD_PATH);
    const params = new URLSearchParams({
      paidAdsRun: "error",
      paidAdsRunMessage: formatFeedbackMessage(
        error,
        "Unable to queue the paid ads nurture campaign.",
      ),
    });
    redirect(`${DASHBOARD_PATH}?${params.toString()}`);
  }

  revalidatePath(DASHBOARD_PATH);
  const params = new URLSearchParams({
    paidAdsRun: "queued",
    campaignKey: result.campaignKey,
    runId: result.runId,
    candidateCount: String(result.candidateCount),
    eligibleCount: String(result.eligibleCount),
    queuedCount: String(result.queuedCount),
    queuedEventCount: String(result.queuedEventCount),
    skippedCooldownCount: String(result.skippedCooldownCount),
    skippedTerminalCount: String(result.skippedTerminalCount),
    skippedOptOutCount: String(result.skippedOptOutCount),
    skippedInvalidDestinationCount: String(result.skippedInvalidDestinationCount),
    skippedDuplicateContactCount: String(result.skippedDuplicateContactCount),
    skippedLimitCount: String(result.skippedLimitCount),
    readinessStatus: result.readinessStatus,
    cooldownDays: String(result.cooldownDays),
    limit: String(result.limit),
  });
  redirect(`${DASHBOARD_PATH}?${params.toString()}`);
}

export async function recordPaidAdsSpendEntry(formData: FormData) {
  assertDashboardMutationAllowed();
  const workspaceId = await getWorkspaceIdForRequest();

  const source = String(formData.get("source") ?? "").trim();
  const utmSource = String(formData.get("utmSource") ?? "").trim();
  const utmCampaign = String(formData.get("utmCampaign") ?? "").trim();
  const reportDate =
    String(formData.get("reportDate") ?? "").trim() || new Date().toISOString();
  const amount = Number(String(formData.get("amount") ?? "").trim());
  const currency = String(formData.get("currency") ?? "").trim() || "USD";

  try {
    const entry = await recordPaidAdsSpend({
      workspaceId: workspaceId,
      source,
      reportDate,
      amount,
      currency,
      ...(utmSource ? { utmSource } : {}),
      ...(utmCampaign ? { utmCampaign } : {}),
    });
    revalidatePath(DASHBOARD_PATH);
    const params = new URLSearchParams({
      paidAdsSpend: "recorded",
      paidAdsSpendSource: entry.source,
      paidAdsSpendAmount: String(entry.amount),
      paidAdsSpendCurrency: entry.currency,
      paidAdsSpendDate: entry.reportDate,
      ...(entry.utmCampaign ? { paidAdsSpendUtmCampaign: entry.utmCampaign } : {}),
    });
    redirect(`${DASHBOARD_PATH}?${params.toString()}`);
  } catch (error) {
    revalidatePath(DASHBOARD_PATH);
    const params = new URLSearchParams({
      paidAdsSpend: "error",
      paidAdsSpendMessage: formatFeedbackMessage(
        error,
        "Unable to record paid ads spend entry.",
      ),
    });
    redirect(`${DASHBOARD_PATH}?${params.toString()}`);
  }
}

export async function generateReviewsResponseDraft(formData: FormData) {
  assertDashboardMutationAllowed();
  const workspaceId = await getWorkspaceIdForRequest();

  const customerMessage = String(formData.get("customerMessage") ?? "").trim();
  const customerFirstName = String(formData.get("customerFirstName") ?? "").trim();

  let result: Awaited<ReturnType<typeof createReviewResponseDraft>>;

  try {
    result = createReviewResponseDraft({
      workspaceId: workspaceId,
      customerMessage,
      ...(customerFirstName ? { customerFirstName } : {}),
    });
  } catch (error) {
    revalidatePath(DASHBOARD_PATH);
    const params = new URLSearchParams({
      reviewsDraft: "error",
      reviewsDraftMessage: formatFeedbackMessage(
        error,
        "Unable to generate a reviews/referrals response draft.",
      ),
    });
    redirect(`${DASHBOARD_PATH}?${params.toString()}`);
  }

  revalidatePath(DASHBOARD_PATH);
  const params = new URLSearchParams({
    reviewsDraft: "ready",
    reviewsDraftSentiment: result.sentiment,
    reviewsDraftConfidence: result.confidence,
    reviewsDraftAction: result.suggestedNextAction,
    reviewsDraftPromptKey: result.promptKey,
    reviewsDraftText: result.draft.slice(0, 600),
  });
  redirect(`${DASHBOARD_PATH}?${params.toString()}`);
}

export async function ingestSalesConsultationTranscript(formData: FormData) {
  assertDashboardMutationAllowed();
  const workspaceId = await getWorkspaceIdForRequest();

  const appointmentId = String(formData.get("appointmentId") ?? "").trim();
  const source = String(formData.get("source") ?? "").trim() || "manual";
  const transcriptText = String(formData.get("transcriptText") ?? "").trim();
  const agentName = String(formData.get("agentName") ?? "").trim();

  try {
    const result = await ingestConsultationTranscript({
      workspaceId: workspaceId,
      appointmentId,
      source: source as
        | "manual"
        | "dev_capture"
        | "callrail"
        | "aircall"
        | "twilio_voice",
      transcriptText,
      ...(agentName ? { agentName } : {}),
    });
    revalidatePath(DASHBOARD_PATH);
    const params = new URLSearchParams({
      salesEnablement: "captured",
      salesTranscriptId: result.transcript.id,
      salesAppointmentId: result.context.appointmentId,
      salesFirstName: result.context.contactFirstName,
      salesOverallScore: String(result.transcript.scorecard.overallScore),
      ...(agentName ? { salesAgentName: agentName } : {}),
      ...(result.transcript.scorecard.primaryObjection
        ? { salesPrimaryObjection: result.transcript.scorecard.primaryObjection }
        : {}),
    });
    redirect(`${DASHBOARD_PATH}?${params.toString()}`);
  } catch (error) {
    revalidatePath(DASHBOARD_PATH);
    const params = new URLSearchParams({
      salesEnablement: "error",
      salesEnablementMessage: formatFeedbackMessage(
        error,
        "Unable to ingest this consultation transcript.",
      ),
    });
    redirect(`${DASHBOARD_PATH}?${params.toString()}`);
  }
}

export async function runSalesEnablementAdapterSync(formData: FormData) {
  assertDashboardMutationAllowed();
  const workspaceId = await getWorkspaceIdForRequest();

  const appointmentId = String(formData.get("appointmentId") ?? "").trim();
  const transcriptText = String(formData.get("transcriptText") ?? "").trim();
  const agentName = String(formData.get("agentName") ?? "").trim();
  const now = new Date();
  const dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const externalId = `dashboard-sync-${Date.now()}`;

  try {
    const result = await syncConsultationTranscripts({
      workspaceId: workspaceId,
      dateFrom: dateFrom.toISOString(),
      dateTo: now.toISOString(),
      limit: 25,
      records: [
        {
          externalId,
          occurredAt: now.toISOString(),
          sourceProvider: "dev_capture",
          appointmentExternalId: appointmentId,
          transcriptText,
          ...(agentName ? { agentName } : {}),
        },
      ],
    });

    revalidatePath(DASHBOARD_PATH);
    const params = new URLSearchParams({
      salesSync: "completed",
      salesSyncProvider: result.provider,
      salesSyncCandidateCount: String(result.candidateCount),
      salesSyncImportedCount: String(result.importedCount),
      salesSyncSkippedCount: String(result.skippedCount),
    });
    redirect(`${DASHBOARD_PATH}?${params.toString()}`);
  } catch (error) {
    revalidatePath(DASHBOARD_PATH);
    const params = new URLSearchParams({
      salesSync: "error",
      salesSyncMessage: formatFeedbackMessage(
        error,
        "Unable to run sales enablement adapter sync.",
      ),
    });
    redirect(`${DASHBOARD_PATH}?${params.toString()}`);
  }
}

