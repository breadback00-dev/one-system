export interface SalesEnablementFeedback {
  transcriptId: string;
  appointmentId: string;
  firstName?: string;
  agentName?: string;
  overallScore?: number;
  primaryObjection?: string;
}

export interface SalesEnablementSyncFeedback {
  provider: string;
  candidateCount: number;
  importedCount: number;
  skippedCount: number;
}

export function getSalesEnablementFeedback(
  searchParams: Record<string, string | string[] | undefined>,
): SalesEnablementFeedback | null {
  if (searchParams.salesEnablement !== "captured") {
    return null;
  }

  const transcriptId = String(searchParams.salesTranscriptId ?? "").trim();
  const appointmentId = String(searchParams.salesAppointmentId ?? "").trim();

  if (!transcriptId || !appointmentId) {
    return null;
  }

  const firstName = String(searchParams.salesFirstName ?? "").trim();
  const agentName = String(searchParams.salesAgentName ?? "").trim();
  const primaryObjection = String(searchParams.salesPrimaryObjection ?? "").trim();
  const overallScoreRaw = Number(searchParams.salesOverallScore);

  return {
    transcriptId,
    appointmentId,
    ...(firstName ? { firstName } : {}),
    ...(agentName ? { agentName } : {}),
    ...(Number.isFinite(overallScoreRaw) ? { overallScore: overallScoreRaw } : {}),
    ...(primaryObjection ? { primaryObjection } : {}),
  };
}

export function getSalesEnablementErrorMessage(
  searchParams: Record<string, string | string[] | undefined>,
): string | null {
  if (searchParams.salesEnablement !== "error") {
    return null;
  }

  const message = String(searchParams.salesEnablementMessage ?? "").trim();
  return message || "Unable to ingest the consultation transcript.";
}

export function getSalesEnablementSyncFeedback(
  searchParams: Record<string, string | string[] | undefined>,
): SalesEnablementSyncFeedback | null {
  if (searchParams.salesSync !== "completed") {
    return null;
  }

  const provider = String(searchParams.salesSyncProvider ?? "").trim();
  const candidateCount = Number(searchParams.salesSyncCandidateCount);
  const importedCount = Number(searchParams.salesSyncImportedCount);
  const skippedCount = Number(searchParams.salesSyncSkippedCount);

  if (!provider || !Number.isFinite(candidateCount)) {
    return null;
  }

  return {
    provider,
    candidateCount,
    importedCount: Number.isFinite(importedCount) ? importedCount : 0,
    skippedCount: Number.isFinite(skippedCount) ? skippedCount : 0,
  };
}

export function getSalesEnablementSyncErrorMessage(
  searchParams: Record<string, string | string[] | undefined>,
): string | null {
  if (searchParams.salesSync !== "error") {
    return null;
  }

  const message = String(searchParams.salesSyncMessage ?? "").trim();
  return message || "Unable to run the adapter-backed transcript sync.";
}
