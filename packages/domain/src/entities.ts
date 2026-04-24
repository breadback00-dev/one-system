export type LeadStatus =
  | "new"
  | "contacted"
  | "responded"
  | "qualified"
  | "booked"
  | "won"
  | "lost";

export interface Workspace {
  id: string;
  name: string;
  niche: "medspa";
  timezone: string;
}

export interface Contact {
  id: string;
  workspaceId: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  createdAt: Date;
}

export interface LeadAttribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
}

export interface Lead {
  id: string;
  workspaceId: string;
  contactId: string;
  source: string;
  status: LeadStatus;
  campaignId?: string;
  attribution?: LeadAttribution;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  workspaceId: string;
  contactId: string;
  channel: "sms" | "email" | "chat" | "voice";
  createdAt: Date;
}

export interface Appointment {
  id: string;
  workspaceId: string;
  contactId: string;
  leadId?: string;
  startsAt: Date;
  outcome?: "scheduled" | "completed" | "cancelled" | "no_show";
}

export type ConsultationTranscriptSource =
  | "manual"
  | "dev_capture"
  | "callrail"
  | "aircall"
  | "twilio_voice";

export interface ConsultationScorecard {
  overallScore: number;
  rapportScore: number;
  needsScore: number;
  objectionHandlingScore: number;
  bookingIntentScore: number;
  primaryObjection?: string;
  nextStep: string;
}

export interface ConsultationTranscript {
  id: string;
  workspaceId: string;
  contactId: string;
  leadId?: string;
  appointmentId?: string;
  externalId?: string;
  agentName?: string;
  source: ConsultationTranscriptSource;
  transcriptText: string;
  summary: string;
  promptKey: string;
  scorecard: ConsultationScorecard;
  createdAt: Date;
}

export interface CreateLeadInput {
  workspaceId: string;
  source: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  attribution?: LeadAttribution;
}
