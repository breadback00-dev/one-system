"use server";

import { revalidatePath } from "next/cache";

import { markReactivationFollowUpHandled } from "@one-system/database";

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
