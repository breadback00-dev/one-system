export type DomainEventName =
  | "lead.created"
  | "lead.responded"
  | "lead.qualified"
  | "appointment.booked"
  | "reactivation.import_completed"
  | "reactivation.follow_up_handled"
  | "reviews_referrals.referral_source_captured"
  | "message.inbound_received"
  | "message.outbound_queued"
  | "message.suppressed"
  | "message.delivered";

export interface DomainEvent<TPayload = unknown> {
  id: string;
  workspaceId: string;
  name: DomainEventName;
  payload: TPayload;
  occurredAt: Date;
}

export interface LeadCreatedPayload {
  leadId: string;
  contactId: string;
  source: string;
  firstName: string;
  phone?: string;
  email?: string;
}

export interface LeadRespondedPayload {
  leadId: string;
  contactId: string;
  channel: "sms" | "email";
  provider: string;
  respondedAt: string;
}

export interface LeadQualifiedPayload {
  leadId: string;
  contactId: string;
  channel: "sms" | "email";
  destination: string;
  provider: string;
  qualificationReason: string;
  qualifiedAt: string;
}

export interface AppointmentBookedPayload {
  appointmentId: string;
  contactId: string;
  leadId?: string;
  startsAt: string;
  outcome?: "scheduled" | "completed" | "cancelled" | "no_show";
  bookedAt: string;
}

export interface ReactivationFollowUpHandledPayload {
  queuedEventId: string;
  contactId: string;
  handledAt: string;
  note?: string;
}

export interface ReactivationImportCompletedPayload {
  importedCount: number;
  createdContactCount: number;
  updatedContactCount: number;
  staleLeadCount: number;
  pastCustomerCount: number;
  duplicateActivityCount: number;
  skippedRowCount: number;
  dryRun: boolean;
  importedAt: string;
}

export interface ReviewReferralSourceCapturedPayload {
  contactId: string;
  capturedAt: string;
  sourceMessage: string;
  sourceMessageNormalized: string;
  referredName?: string;
  referredContact?: string;
  captureConfidence?: "high" | "medium" | "low";
  campaignKey?: string;
  runId?: string;
}

export interface MessageOutboundQueuedPayload {
  queuedEventId?: string;
  contactId: string;
  channel: "sms" | "email";
  destination: string;
  message: string;
  reason: string;
  campaignKey?: string;
  runId?: string;
  deliverAfter?: string;
}

export interface MessageDeliveredPayload {
  queuedEventId: string;
  contactId: string;
  channel: "sms" | "email";
  provider: string;
  deliveredAt: string;
}

export interface MessageSuppressedPayload {
  queuedEventId: string;
  contactId: string;
  channel: "sms" | "email";
  reason: string;
  suppressedAt: string;
}

export interface MessageInboundReceivedPayload {
  contactId: string;
  channel: "sms" | "email";
  provider: string;
  from: string;
  body: string;
  receivedAt: string;
}
