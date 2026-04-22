import { randomUUID } from "node:crypto";

import type { CreateLeadInput, Contact, Lead } from "./entities";
import type {
  DomainEvent,
  LeadCreatedPayload,
  LeadQualifiedPayload,
  LeadRespondedPayload,
  MessageDeliveredPayload,
  MessageInboundReceivedPayload,
  MessageOutboundQueuedPayload,
  MessageSuppressedPayload,
} from "./events";

export interface CreateLeadResult {
  contact: Contact;
  lead: Lead;
  events: [DomainEvent<LeadCreatedPayload>];
}

export function createLead(input: CreateLeadInput): CreateLeadResult {
  const timestamp = new Date();
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
    },
  };

  return {
    contact,
    lead,
    events: [leadCreatedEvent],
  };
}

export function createQueuedOutboundMessageEvent(args: {
  queuedEventId?: string;
  workspaceId: string;
  contactId: string;
  channel: "sms" | "email";
  destination: string;
  message: string;
  reason: string;
  campaignKey?: string;
  runId?: string;
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
      channel: args.channel,
      destination: args.destination,
      message: args.message,
      reason: args.reason,
      ...(args.campaignKey ? { campaignKey: args.campaignKey } : {}),
      ...(args.runId ? { runId: args.runId } : {}),
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
}): DomainEvent<MessageDeliveredPayload> {
  return {
    id: randomUUID(),
    workspaceId: args.workspaceId,
    name: "message.delivered",
    occurredAt: new Date(),
    payload: {
      queuedEventId: args.queuedEventId,
      contactId: args.contactId,
      channel: args.channel,
      provider: args.provider,
      deliveredAt: new Date().toISOString(),
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
