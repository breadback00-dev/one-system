"use server";

import { revalidatePath } from "next/cache";

import {
  markReactivationFollowUpHandled,
  saveAppointmentTransaction,
} from "@one-system/database";
import { createAppointment } from "@one-system/domain";

export async function markReactivationItemHandled(formData: FormData) {
  const queuedEventId = String(formData.get("queuedEventId") ?? "").trim();
  const contactId = String(formData.get("contactId") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!queuedEventId || !contactId) {
    throw new Error("Reactivation queue item is missing required identifiers.");
  }

  await markReactivationFollowUpHandled({
    workspaceId: "workspace_medspa_demo",
    queuedEventId,
    contactId,
    ...(note ? { note } : {}),
  });

  revalidatePath("/");
}

export async function bookReactivationItemTomorrow(formData: FormData) {
  const queuedEventId = String(formData.get("queuedEventId") ?? "").trim();
  const contactId = String(formData.get("contactId") ?? "").trim();

  if (!queuedEventId || !contactId) {
    throw new Error("Reactivation queue item is missing required identifiers.");
  }

  const startsAt = new Date();
  startsAt.setDate(startsAt.getDate() + 1);
  startsAt.setHours(10, 0, 0, 0);

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
