import {
  createLeadQualifiedEvent,
  createLeadRespondedEvent,
  createQueuedOutboundMessageEvent,
  type DomainEvent,
  type Lead,
  type LeadCreatedPayload,
  type LeadQualifiedPayload,
  type MessageInboundReceivedPayload,
} from "@one-system/domain";
import { appConfig } from "@one-system/config";

export interface WorkflowDefinition {
  key: string;
  description: string;
  trigger: string;
}

export const leadCaptureWorkflow: WorkflowDefinition = {
  key: "lead-capture.instant-follow-up",
  description: "Responds to a new lead with an immediate follow-up sequence.",
  trigger: "lead.created",
};

const RESPONSE_ELIGIBLE_LEAD_STATUSES: Lead["status"][] = ["new", "contacted"];
const QUALIFICATION_ELIGIBLE_LEAD_STATUSES: Lead["status"][] = [
  "new",
  "contacted",
  "responded",
];
const FOLLOW_UP_REMINDER_DELAY_MINUTES = 30;
const QUALIFICATION_KEYWORDS = [
  "botox",
  "filler",
  "facial",
  "laser",
  "consultation",
  "treatment",
  "book",
  "booking",
  "schedule",
  "appointment",
  "interested",
];

function addMinutes(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function getQualificationReason(messageBody: string): string | null {
  const normalized = messageBody.toLowerCase();
  const matchedKeyword = QUALIFICATION_KEYWORDS.find((keyword) =>
    normalized.includes(keyword),
  );

  return matchedKeyword ?? null;
}

export function handleDomainEvent(event: DomainEvent): DomainEvent[] {
  if (event.name === "lead.created") {
    const payload = event.payload as unknown as LeadCreatedPayload;
    const firstName = payload.firstName || "there";
    const preferredChannel = payload.phone ? "sms" : payload.email ? "email" : null;
    const destination = payload.phone ?? payload.email;

    if (!preferredChannel || !destination) {
      return [];
    }

    const message = `Hi ${firstName}, thanks for reaching out to us. We'd love to help you book your consultation. Reply here with the treatment you're interested in and we'll get you sorted.`;
    const reminder = `Just checking back in, ${firstName}. If you'd like, reply here with the treatment you're interested in and we can help you book your consultation.`;

    return [
      createQueuedOutboundMessageEvent({
        workspaceId: event.workspaceId,
        contactId: payload.contactId,
        channel: preferredChannel,
        destination,
        message,
        reason: leadCaptureWorkflow.key,
      }),
      createQueuedOutboundMessageEvent({
        workspaceId: event.workspaceId,
        contactId: payload.contactId,
        channel: preferredChannel,
        destination,
        message: reminder,
        reason: leadCaptureWorkflow.key,
        deliverAfter: addMinutes(event.occurredAt.toISOString(), FOLLOW_UP_REMINDER_DELAY_MINUTES),
      }),
    ];
  }

  if (event.name === "lead.qualified") {
    const payload = event.payload as unknown as LeadQualifiedPayload;
    const bookingMessage = `Thanks for sharing that. You're a great fit to book a consultation here: ${appConfig.bookingHandoffUrl}`;

    return [
      createQueuedOutboundMessageEvent({
        workspaceId: event.workspaceId,
        contactId: payload.contactId,
        channel: payload.channel,
        destination: payload.destination,
        message: bookingMessage,
        reason: `${leadCaptureWorkflow.key}.booking-handoff`,
      }),
    ];
  }

  return [];
}

export function handleInboundMessageWorkflow(args: {
  event: DomainEvent<MessageInboundReceivedPayload>;
  activeLead:
    | {
        id: string;
        contactId: string;
        status: Lead["status"];
      }
    | null;
}): DomainEvent[] {
  const { activeLead, event } = args;

  if (!activeLead) {
    return [];
  }

  const payload = event.payload;
  const workflowEvents: DomainEvent[] = [];

  if (RESPONSE_ELIGIBLE_LEAD_STATUSES.includes(activeLead.status)) {
    workflowEvents.push(
      createLeadRespondedEvent({
        workspaceId: event.workspaceId,
        leadId: activeLead.id,
        contactId: activeLead.contactId,
        channel: payload.channel,
        provider: payload.provider,
        respondedAt: payload.receivedAt,
      }),
    );
  }

  const qualificationReason = getQualificationReason(payload.body);
  if (
    qualificationReason &&
    QUALIFICATION_ELIGIBLE_LEAD_STATUSES.includes(activeLead.status)
  ) {
    workflowEvents.push(
      createLeadQualifiedEvent({
        workspaceId: event.workspaceId,
        leadId: activeLead.id,
        contactId: activeLead.contactId,
        channel: payload.channel,
        destination: payload.from,
        provider: payload.provider,
        qualificationReason,
        qualifiedAt: payload.receivedAt,
      }),
    );
  }

  return workflowEvents;
}
