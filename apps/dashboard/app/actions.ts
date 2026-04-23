"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  assertReactivationFollowUpActionable,
  getAvailableBookingSlots,
  isAppointmentSlotAvailable,
  markReactivationFollowUpHandled,
  saveAppointmentTransaction,
  type ReactivationAudienceSegment,
} from "@one-system/database";
import { createAppointment } from "@one-system/domain";
import { executeReactivationRun } from "@one-system/reactivation";

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

export async function markReactivationItemHandled(formData: FormData) {
  const queuedEventId = String(formData.get("queuedEventId") ?? "").trim();
  const contactId = String(formData.get("contactId") ?? "").trim();
  const rawNote = String(formData.get("note") ?? "").trim();
  const note = rawNote.length > 280 ? rawNote.slice(0, 280) : rawNote;

  if (!queuedEventId || !contactId) {
    throw new Error("Reactivation queue item is missing required identifiers.");
  }

  await assertReactivationFollowUpActionable({
    workspaceId: "workspace_medspa_demo",
    queuedEventId,
    contactId,
  });

  await markReactivationFollowUpHandled({
    workspaceId: "workspace_medspa_demo",
    queuedEventId,
    contactId,
    ...(note ? { note } : {}),
  });

  revalidatePath("/");
}

export async function bookReactivationItemAtSlot(formData: FormData) {
  const queuedEventId = String(formData.get("queuedEventId") ?? "").trim();
  const contactId = String(formData.get("contactId") ?? "").trim();
  const startsAtInput = String(formData.get("startsAt") ?? "").trim();

  if (!queuedEventId || !contactId || !startsAtInput) {
    throw new Error("Reactivation queue item is missing required identifiers.");
  }

  const startsAt = new Date(startsAtInput);

  if (Number.isNaN(startsAt.getTime())) {
    throw new Error("Selected appointment slot is invalid.");
  }

  await assertReactivationFollowUpActionable({
    workspaceId: "workspace_medspa_demo",
    queuedEventId,
    contactId,
  });

  const availableSlots = await getAvailableBookingSlots({
    workspaceId: "workspace_medspa_demo",
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
    workspaceId: "workspace_medspa_demo",
    startsAt: startsAt.toISOString(),
  });

  if (!isAvailable) {
    throw new Error("Selected appointment slot is no longer available.");
  }

  const appointmentResult = createAppointment({
    workspaceId: "workspace_medspa_demo",
    contactId,
    startsAt: startsAt.toISOString(),
    outcome: "scheduled",
  });

  await saveAppointmentTransaction(appointmentResult);
  await markReactivationFollowUpHandled({
    workspaceId: "workspace_medspa_demo",
    queuedEventId,
    contactId,
    note: `Booked from Module 2 dashboard queue for ${startsAt.toISOString()}`,
  });

  revalidatePath("/");
}

export async function runReactivationCampaign(formData: FormData) {
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

  const result = await executeReactivationRun({
    workspaceId: "workspace_medspa_demo",
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

  revalidatePath("/");
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
  redirect(`/?${params.toString()}`);
}
