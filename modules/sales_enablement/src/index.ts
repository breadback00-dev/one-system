import { randomUUID } from "node:crypto";

import { generateConsultationAnalysis } from "@one-system/ai";
import {
  findConsultationTranscriptByExternalId,
  getConsultationTranscriptContext,
  saveConsultationTranscriptTransaction,
  type ConsultationTranscriptContext,
} from "@one-system/database";
import {
  createSalesAnalysisCompletedEvent,
  createSalesScoreRecordedEvent,
  createSalesTranscriptReceivedEvent,
  type ConsultationTranscript,
  type ConsultationTranscriptSource,
} from "@one-system/domain";
import type {
  SalesConsultationProvider,
  SalesConsultationTranscriptRecord,
} from "@one-system/integrations";

export const salesEnablementWorkflow = {
  key: "sales_enablement.consultation-analysis",
  description:
    "Captures one consultation transcript, scores it, and stores coaching-ready insight for operators.",
};
export const MAX_CONSULTATION_TRANSCRIPT_TEXT_LENGTH = 20_000;
export const MAX_CONSULTATION_EXTERNAL_ID_LENGTH = 160;
export const MAX_CONSULTATION_AGENT_NAME_LENGTH = 80;

export interface IngestConsultationTranscriptInput {
  workspaceId: string;
  appointmentId: string;
  source: ConsultationTranscriptSource;
  transcriptText: string;
  externalId?: string;
  agentName?: string;
  occurredAt?: string;
}

export interface IngestConsultationTranscriptResult {
  ok: true;
  transcript: ConsultationTranscript;
  events: Array<{
    id: string;
    name: string;
  }>;
  context: ConsultationTranscriptContext;
}

export interface SyncConsultationTranscriptsInput {
  workspaceId: string;
  dateFrom: string;
  dateTo: string;
  limit?: number;
  records: SalesConsultationTranscriptRecord[];
}

export interface SyncConsultationTranscriptsResult {
  ok: true;
  provider: SalesConsultationProvider;
  candidateCount: number;
  importedCount: number;
  skippedCount: number;
  skipped: Array<{
    externalId?: string;
    reason: string;
  }>;
}

class StaticSalesConsultationTranscriptSyncAdapter {
  readonly provider = "dev_capture";

  constructor(
    private readonly records: SalesConsultationTranscriptRecord[],
  ) {}

  async syncConsultationTranscripts(args: {
    workspaceId: string;
    dateFrom: string;
    dateTo: string;
    limit?: number;
  }): Promise<{
    provider: SalesConsultationProvider;
    workspaceId: string;
    records: SalesConsultationTranscriptRecord[];
  }> {
    const dateFrom = new Date(args.dateFrom);
    const dateTo = new Date(args.dateTo);
    const records = this.records
      .filter((record) => {
        const occurredAt = new Date(record.occurredAt);
        return (
          record.sourceProvider === this.provider &&
          occurredAt >= dateFrom &&
          occurredAt <= dateTo
        );
      })
      .slice(0, args.limit ?? 100);

    return {
      provider: this.provider,
      workspaceId: args.workspaceId,
      records,
    };
  }
}

function normalizeTranscriptSource(
  value: string,
): ConsultationTranscriptSource & SalesConsultationProvider {
  const source = value.trim().toLowerCase();

  if (
    source === "manual" ||
    source === "dev_capture" ||
    source === "callrail" ||
    source === "aircall" ||
    source === "twilio_voice"
  ) {
    return source;
  }

  throw new Error(
    "`source` must be one of manual, dev_capture, callrail, aircall, or twilio_voice.",
  );
}

export async function ingestConsultationTranscript(
  input: IngestConsultationTranscriptInput,
): Promise<IngestConsultationTranscriptResult> {
  const workspaceId = input.workspaceId.trim();
  const appointmentId = input.appointmentId.trim();
  const transcriptText = input.transcriptText.trim();
  const externalId = input.externalId?.trim();
  const agentName = input.agentName?.trim();
  const normalizedAgentName =
    agentName && agentName.length > MAX_CONSULTATION_AGENT_NAME_LENGTH
      ? agentName.slice(0, MAX_CONSULTATION_AGENT_NAME_LENGTH)
      : agentName;
  const source = normalizeTranscriptSource(input.source);
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();

  if (!appointmentId) {
    throw new Error("`appointmentId` is required.");
  }

  if (!transcriptText) {
    throw new Error("`transcriptText` is required.");
  }

  if (transcriptText.length > MAX_CONSULTATION_TRANSCRIPT_TEXT_LENGTH) {
    throw new Error(
      `\`transcriptText\` must be ${MAX_CONSULTATION_TRANSCRIPT_TEXT_LENGTH} characters or fewer.`,
    );
  }

  if (
    externalId &&
    externalId.length > MAX_CONSULTATION_EXTERNAL_ID_LENGTH
  ) {
    throw new Error(
      `\`externalId\` must be ${MAX_CONSULTATION_EXTERNAL_ID_LENGTH} characters or fewer.`,
    );
  }

  if (Number.isNaN(occurredAt.getTime())) {
    throw new Error("`occurredAt` must be a valid ISO datetime.");
  }

  const context = await getConsultationTranscriptContext({
    workspaceId,
    appointmentId,
  });
  const analysis = generateConsultationAnalysis({
    transcriptText,
  });
  const createdAt = occurredAt;
  const transcriptId = randomUUID();
  const transcript: ConsultationTranscript = {
    id: transcriptId,
    workspaceId,
    contactId: context.contactId,
    source,
    transcriptText,
    summary: analysis.summary,
    promptKey: analysis.promptKey,
    scorecard: analysis.scorecard,
    createdAt,
    appointmentId: context.appointmentId,
    ...(externalId ? { externalId } : {}),
    ...(normalizedAgentName ? { agentName: normalizedAgentName } : {}),
    ...(context.leadId ? { leadId: context.leadId } : {}),
  };
  const events = [
    createSalesTranscriptReceivedEvent({
      workspaceId,
      transcriptId,
      contactId: context.contactId,
      source,
      transcriptText,
      appointmentId: context.appointmentId,
      ...(externalId ? { externalId } : {}),
      ...(normalizedAgentName ? { agentName: normalizedAgentName } : {}),
      ...(context.leadId ? { leadId: context.leadId } : {}),
      receivedAt: createdAt.toISOString(),
    }),
    createSalesAnalysisCompletedEvent({
      workspaceId,
      transcriptId,
      contactId: context.contactId,
      promptKey: analysis.promptKey,
      summary: analysis.summary,
      nextStep: analysis.scorecard.nextStep,
      ...(analysis.scorecard.primaryObjection
        ? { primaryObjection: analysis.scorecard.primaryObjection }
        : {}),
      completedAt: createdAt.toISOString(),
    }),
    createSalesScoreRecordedEvent({
      workspaceId,
      transcriptId,
      contactId: context.contactId,
      scorecard: analysis.scorecard,
      scoredAt: createdAt.toISOString(),
    }),
  ];
  const saved = await saveConsultationTranscriptTransaction({
    transcript,
    events,
  });

  return {
    ok: true,
    transcript: saved.transcript,
    events: saved.events.map((event) => ({
      id: event.id,
      name: event.name,
    })),
    context,
  };
}

export async function syncConsultationTranscripts(
  input: SyncConsultationTranscriptsInput,
): Promise<SyncConsultationTranscriptsResult> {
  const workspaceId = input.workspaceId.trim();
  const adapter = new StaticSalesConsultationTranscriptSyncAdapter(input.records);
  const syncResult = await adapter.syncConsultationTranscripts({
    workspaceId,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    limit: Math.max(1, Math.min(input.limit ?? 100, 250)),
  });

  const skipped: SyncConsultationTranscriptsResult["skipped"] = [];
  const seenExternalIds = new Set<string>();
  let importedCount = 0;

  for (const record of syncResult.records) {
    const externalId = record.externalId.trim();
    if (!externalId) {
      skipped.push({
        reason: "missing_external_id",
      });
      continue;
    }

    if (seenExternalIds.has(externalId)) {
      skipped.push({
        externalId,
        reason: "duplicate_in_batch",
      });
      continue;
    }
    seenExternalIds.add(externalId);

    const appointmentId = record.appointmentExternalId?.trim();
    if (!appointmentId) {
      skipped.push({
        externalId,
        reason: "missing_appointment_external_id",
      });
      continue;
    }

    const transcriptText = record.transcriptText.trim();
    if (!transcriptText) {
      skipped.push({
        externalId,
        reason: "missing_transcript_text",
      });
      continue;
    }

    const existing = await findConsultationTranscriptByExternalId({
      workspaceId,
      source: record.sourceProvider,
      externalId,
    });
    if (existing) {
      skipped.push({
        externalId,
        reason: "already_imported",
      });
      continue;
    }

    try {
      await ingestConsultationTranscript({
        workspaceId,
        appointmentId,
        source: record.sourceProvider,
        transcriptText,
        externalId,
        ...(record.agentName ? { agentName: record.agentName } : {}),
        occurredAt: record.occurredAt,
      });
      importedCount += 1;
    } catch (error) {
      skipped.push({
        externalId,
        reason:
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : "ingest_failed",
      });
    }
  }

  return {
    ok: true,
    provider: syncResult.provider,
    candidateCount: syncResult.records.length,
    importedCount,
    skippedCount: skipped.length,
    skipped,
  };
}

export const salesEnablementModule = {
  key: "sales_enablement",
  workflows: [salesEnablementWorkflow],
};
