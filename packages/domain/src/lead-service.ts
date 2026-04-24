import { randomUUID } from "node:crypto";

import type {
  CreateLeadInput,
  Contact,
  ConsultationScorecard,
  Lead,
  LeadAttribution,
} from "./entities";
import type {
  AppointmentBookedPayload,
  DomainEvent,
  LeadCreatedPayload,
  LeadQualifiedPayload,
  LeadRespondedPayload,
  MessageDeliveredPayload,
  MessageInboundReceivedPayload,
  MessageOutboundQueuedPayload,
  MessageSuppressedPayload,
  ReviewReferralSourceCapturedPayload,
  ReactivationImportCompletedPayload,
  ReactivationFollowUpHandledPayload,
  SalesAnalysisCompletedPayload,
  SalesScoreRecordedPayload,
  SalesTranscriptReceivedPayload,
} from "./events";
import type { Appointment } from "./entities";

export interface CreateLeadResult {
  contact: Contact;
  lead: Lead;
  events: [DomainEvent<LeadCreatedPayload>];
}

export interface CreateAppointmentInput {
  workspaceId: string;
  contactId: string;
  leadId?: string;
  startsAt: string;
  outcome?: Appointment["outcome"];
}

export interface CreateAppointmentResult {
  appointment: Appointment;
  events: [DomainEvent<AppointmentBookedPayload>];
}

function normalizeLeadAttribution(
  attribution: LeadAttribution | undefined,
): LeadAttribution | undefined {
  if (!attribution) {
    return undefined;
  }

  const normalized: LeadAttribution = {
    ...(attribution.utmSource?.trim()
      ? { utmSource: attribution.utmSource.trim() }
      : {}),
    ...(attribution.utmMedium?.trim()
      ? { utmMedium: attribution.utmMedium.trim() }
      : {}),
    ...(attribution.utmCampaign?.trim()
      ? { utmCampaign: attribution.utmCampaign.trim() }
      : {}),
    ...(attribution.utmTerm?.trim()
      ? { utmTerm: attribution.utmTerm.trim() }
      : {}),
    ...(attribution.utmContent?.trim()
      ? { utmContent: attribution.utmContent.trim() }
      : {}),
  };

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function createLead(input: CreateLeadInput): CreateLeadResult {
  const timestamp = new Date();
  const attribution = normalizeLeadAttribution(input.attribution);
  const contact: Contact = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    firstName: input.firstName.trim(),
    createdAt: timestamp,
    ...(input.lastName?.trim() ? { lastName: input.lastName.trim() } : {}),
    ...(input.email?.trim()
      ? { email: input.email.trim().toLowerCase() }
      : {}),
    ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
  };

  const lead: Lead = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    contactId: contact.id,
    source: input.source.trim(),
    status: "new",
    createdAt: timestamp,
    ...(attribution ? { attribution } : {}),
  };

  const leadCreatedEvent: DomainEvent<LeadCreatedPayload> = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    name: "lead.created",
    occurredAt: timestamp,
    payload: {
      leadId: lead.id,
      contactId: contact.id,
      source: lead.source,
      firstName: contact.firstName,
      ...(contact.phone ? { phone: contact.phone } : {}),
      ...(contact.email ? { email: contact.email } : {}),
      ...(attribution ? { attribution } : {}),
    },
  };

  return {
    contact,
    lead,
    events: [leadCreatedEvent],
  };
}

export function createAppointment(
  input: CreateAppointmentInput,
): CreateAppointmentResult {
  const timestamp = new Date();
  const startsAt = new Date(input.startsAt);

  if (Number.isNaN(startsAt.getTime())) {
    throw new Error("`startsAt` must be a valid ISO datetime.");
  }

  const appointment: Appointment = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    startsAt,
    ...(input.leadId ? { leadId: input.leadId } : {}),
    ...(input.outcome ? { outcome: input.outcome } : {}),
  };

  return {
    appointment,
    events: [
      {
        id: randomUUID(),
        workspaceId: input.workspaceId,
        name: "appointment.booked",
        occurredAt: timestamp,
        payload: {
          appointmentId: appointment.id,
          contactId: appointment.contactId,
          startsAt: appointment.startsAt.toISOString(),
          bookedAt: timestamp.toISOString(),
          ...(appointment.leadId ? { leadId: appointment.leadId } : {}),
          ...(appointment.outcome ? { outcome: appointment.outcome } : {}),
        },
      },
    ],
  };
}

export function createQueuedOutboundMessageEvent(args: {
  queuedEventId?: string;
  workspaceId: string;
  contactId: string;
  leadId?: string;
  channel: "sms" | "email";
  destination: string;
  message: string;
  reason: string;
  campaignKey?: string;
  runId?: string;
  source?: string;
  utmSource?: string;
  utmCampaign?: string;
  deliverAfter?: string;
}): DomainEvent<MessageOutboundQueuedPayload> {
  return {
    id: randomUUID(),
    workspaceId: args.workspaceId,
    name: "message.outbound_queued",
    occurredAt: new Date(),
    payload: {
      ...(args.queuedEventId ? { queuedEventId: args.queuedEventId } : {}),
      contactId: args.contactId,
      ...(args.leadId ? { leadId: args.leadId } : {}),
      channel: args.channel,
      destination: args.destination,
      message: args.message,
      reason: args.reason,
      ...(args.campaignKey ? { campaignKey: args.campaignKey } : {}),
      ...(args.runId ? { runId: args.runId } : {}),
      ...(args.source ? { source: args.source } : {}),
      ...(args.utmSource ? { utmSource: args.utmSource } : {}),
      ...(args.utmCampaign ? { utmCampaign: args.utmCampaign } : {}),
      ...(args.deliverAfter ? { deliverAfter: args.deliverAfter } : {}),
    },
  };
}

export function createMessageDeliveredEvent(args: {
  workspaceId: string;
  queuedEventId: string;
  contactId: string;
  channel: "sms" | "email";
  provider: string;
  deliveredAt?: string;
}): DomainEvent<MessageDeliveredPayload> {
  const deliveredAt = args.deliveredAt ?? new Date().toISOString();

  return {
    id: randomUUID(),
    workspaceId: args.workspaceId,
    name: "message.delivered",
    occurredAt: new Date(deliveredAt),
    payload: {
      queuedEventId: args.queuedEventId,
      contactId: args.contactId,
      channel: args.channel,
      provider: args.provider,
      deliveredAt,
    },
  };
}

export function createMessageSuppressedEvent(args: {
  workspaceId: string;
  queuedEventId: string;
  contactId: string;
  channel: "sms" | "email";
  reason: string;
  suppressedAt?: string;
}): DomainEvent<MessageSuppressedPayload> {
  return {
    id: randomUUID(),
    workspaceId: args.workspaceId,
    name: "message.suppressed",
    occurredAt: new Date(),
    payload: {
      queuedEventId: args.queuedEventId,
      contactId: args.contactId,
      channel: args.channel,
      reason: args.reason,
      suppressedAt: args.suppressedAt ?? new Date().toISOString(),
    },
  };
}

export function createReactivationFollowUpHandledEvent(args: {
  workspaceId: string;
  queuedEventId: string;
  contactId: string;
  note?: string;
}): DomainEvent<ReactivationFollowUpHandledPayload> {
  const handledAt = new Date();

  return {
    id: randomUUID(),
    workspaceId: args.workspaceId,
    name: "reactivation.follow_up_handled",
    occurredAt: handledAt,
    payload: {
      queuedEventId: args.queuedEventId,
      contactId: args.contactId,
      handledAt: handledAt.toISOString(),
      ...(args.note?.trim() ? { note: args.note.trim() } : {}),
    },
  };
}

export function createReactivationImportCompletedEvent(args: {
  workspaceId: string;
  importedCount: number;
  createdContactCount: number;
  updatedContactCount: number;
  staleLeadCount: number;
  pastCustomerCount: number;
  duplicateActivityCount: number;
  skippedRowCount: number;
  dryRun: boolean;
}): DomainEvent<ReactivationImportCompletedPayload> {
  const importedAt = new Date();

  return {
    id: randomUUID(),
    workspaceId: args.workspaceId,
    name: "reactivation.import_completed",
    occurredAt: importedAt,
    payload: {
      importedCount: args.importedCount,
      createdContactCount: args.createdContactCount,
      updatedContactCount: args.updatedContactCount,
      staleLeadCount: args.staleLeadCount,
      pastCustomerCount: args.pastCustomerCount,
      duplicateActivityCount: args.duplicateActivityCount,
      skippedRowCount: args.skippedRowCount,
      dryRun: args.dryRun,
      importedAt: importedAt.toISOString(),
    },
  };
}

export function createReviewReferralSourceCapturedEvent(args: {
  workspaceId: string;
  contactId: string;
  sourceMessage: string;
  sourceMessageNormalized: string;
  referredName?: string;
  referredContact?: string;
  captureConfidence?: "high" | "medium" | "low";
  campaignKey?: string;
  runId?: string;
  capturedAt?: string;
}): DomainEvent<ReviewReferralSourceCapturedPayload> {
  const occurredAt = new Date(args.capturedAt ?? new Date().toISOString());

  return {
    id: randomUUID(),
    workspaceId: args.workspaceId,
    name: "reviews_referrals.referral_source_captured",
    occurredAt,
    payload: {
      contactId: args.contactId,
      capturedAt: occurredAt.toISOString(),
      sourceMessage: args.sourceMessage,
      sourceMessageNormalized: args.sourceMessageNormalized,
      ...(args.referredName ? { referredName: args.referredName } : {}),
      ...(args.referredContact ? { referredContact: args.referredContact } : {}),
      ...(args.captureConfidence
        ? { captureConfidence: args.captureConfidence }
        : {}),
      ...(args.campaignKey ? { campaignKey: args.campaignKey } : {}),
      ...(args.runId ? { runId: args.runId } : {}),
    },
  };
}

export function createSalesTranscriptReceivedEvent(args: {
  workspaceId: string;
  transcriptId: string;
  contactId: string;
  leadId?: string;
  appointmentId?: string;
  externalId?: string;
  agentName?: string;
  source: string;
  transcriptText: string;
  receivedAt?: string;
}): DomainEvent<SalesTranscriptReceivedPayload> {
  const occurredAt = new Date(args.receivedAt ?? new Date().toISOString());

  return {
    id: randomUUID(),
    workspaceId: args.workspaceId,
    name: "sales_enablement.transcript_received",
    occurredAt,
    payload: {
      transcriptId: args.transcriptId,
      contactId: args.contactId,
      source: args.source,
      transcriptLength: args.transcriptText.trim().length,
      receivedAt: occurredAt.toISOString(),
      ...(args.leadId ? { leadId: args.leadId } : {}),
      ...(args.appointmentId ? { appointmentId: args.appointmentId } : {}),
      ...(args.externalId ? { externalId: args.externalId } : {}),
      ...(args.agentName ? { agentName: args.agentName } : {}),
    },
  };
}

export function createSalesAnalysisCompletedEvent(args: {
  workspaceId: string;
  transcriptId: string;
  contactId: string;
  promptKey: string;
  summary: string;
  nextStep: string;
  primaryObjection?: string;
  completedAt?: string;
}): DomainEvent<SalesAnalysisCompletedPayload> {
  const occurredAt = new Date(args.completedAt ?? new Date().toISOString());

  return {
    id: randomUUID(),
    workspaceId: args.workspaceId,
    name: "sales_enablement.analysis_completed",
    occurredAt,
    payload: {
      transcriptId: args.transcriptId,
      contactId: args.contactId,
      promptKey: args.promptKey,
      summary: args.summary,
      nextStep: args.nextStep,
      completedAt: occurredAt.toISOString(),
      ...(args.primaryObjection ? { primaryObjection: args.primaryObjection } : {}),
    },
  };
}

export function createSalesScoreRecordedEvent(args: {
  workspaceId: string;
  transcriptId: string;
  contactId: string;
  scorecard: ConsultationScorecard;
  scoredAt?: string;
}): DomainEvent<SalesScoreRecordedPayload> {
  const occurredAt = new Date(args.scoredAt ?? new Date().toISOString());

  return {
    id: randomUUID(),
    workspaceId: args.workspaceId,
    name: "sales_enablement.score_recorded",
    occurredAt,
    payload: {
      transcriptId: args.transcriptId,
      contactId: args.contactId,
      overallScore: args.scorecard.overallScore,
      rapportScore: args.scorecard.rapportScore,
      needsScore: args.scorecard.needsScore,
      objectionHandlingScore: args.scorecard.objectionHandlingScore,
      bookingIntentScore: args.scorecard.bookingIntentScore,
      scoredAt: occurredAt.toISOString(),
    },
  };
}

export function createMessageInboundReceivedEvent(args: {
  workspaceId: string;
  contactId: string;
  channel: "sms" | "email";
  provider: string;
  from: string;
  body: string;
}): DomainEvent<MessageInboundReceivedPayload> {
  return {
    id: randomUUID(),
    workspaceId: args.workspaceId,
    name: "message.inbound_received",
    occurredAt: new Date(),
    payload: {
      contactId: args.contactId,
      channel: args.channel,
      provider: args.provider,
      from: args.from,
      body: args.body,
      receivedAt: new Date().toISOString(),
    },
  };
}

export function createLeadRespondedEvent(args: {
  workspaceId: string;
  leadId: string;
  contactId: string;
  channel: "sms" | "email";
  provider: string;
  respondedAt?: string;
}): DomainEvent<LeadRespondedPayload> {
  return {
    id: randomUUID(),
    workspaceId: args.workspaceId,
    name: "lead.responded",
    occurredAt: new Date(),
    payload: {
      leadId: args.leadId,
      contactId: args.contactId,
      channel: args.channel,
      provider: args.provider,
      respondedAt: args.respondedAt ?? new Date().toISOString(),
    },
  };
}

export function createLeadQualifiedEvent(args: {
  workspaceId: string;
  leadId: string;
  contactId: string;
  channel: "sms" | "email";
  destination: string;
  provider: string;
  qualificationReason: string;
  qualifiedAt?: string;
}): DomainEvent<LeadQualifiedPayload> {
  return {
    id: randomUUID(),
    workspaceId: args.workspaceId,
    name: "lead.qualified",
    occurredAt: new Date(),
    payload: {
      leadId: args.leadId,
      contactId: args.contactId,
      channel: args.channel,
      destination: args.destination,
      provider: args.provider,
      qualificationReason: args.qualificationReason,
      qualifiedAt: args.qualifiedAt ?? new Date().toISOString(),
    },
  };
}
