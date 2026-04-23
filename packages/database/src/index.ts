import { PrismaClient, type Prisma } from "@prisma/client";
import { appConfig } from "@one-system/config";
import { createReactivationFollowUpHandledEvent } from "@one-system/domain";
import type { Contact, Lead, Workspace } from "@one-system/domain";
import type { DomainEvent } from "@one-system/domain";
import type {
  AppointmentBookedPayload,
  MessageDeliveredPayload,
  MessageInboundReceivedPayload,
  MessageOutboundQueuedPayload,
  MessageSuppressedPayload,
  ReactivationFollowUpHandledPayload,
} from "@one-system/domain";
import type {
  ConversationThread,
  DeliveryStatusSnapshot,
  MessageTimelineItem,
  QueuedMessage,
} from "@one-system/messaging";

export const DATABASE_SCHEMA_PATH = "packages/database/prisma/schema.prisma";
const DEFAULT_WORKSPACE_ID = "workspace_medspa_demo";

const globalForPrisma = globalThis as typeof globalThis & {
  oneSystemPrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.oneSystemPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    ...(process.env.DATABASE_URL
      ? { datasourceUrl: process.env.DATABASE_URL }
      : {}),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.oneSystemPrisma = prisma;
}

export interface SaveLeadTransactionInput {
  contact: Contact;
  lead: Lead;
  events: DomainEvent[];
}

export interface SaveLeadTransactionResult {
  workspace: Workspace;
  contact: Contact;
  lead: Lead;
  events: DomainEvent[];
}

export interface SaveAppointmentTransactionInput {
  appointment: {
    id: string;
    workspaceId: string;
    contactId: string;
    leadId?: string;
    startsAt: Date;
    outcome?: "scheduled" | "completed" | "cancelled" | "no_show";
  };
  events: DomainEvent[];
}

export interface SaveAppointmentTransactionResult {
  workspace: Workspace;
  appointment: {
    id: string;
    workspaceId: string;
    contactId: string;
    leadId?: string;
    startsAt: Date;
    outcome?: "scheduled" | "completed" | "cancelled" | "no_show";
  };
  events: DomainEvent[];
}

function getDefaultWorkspace(): Workspace {
  return {
    id: DEFAULT_WORKSPACE_ID,
    name: "One System Demo Med Spa",
    niche: "medspa",
    timezone: "Europe/London",
  };
}

function normalizeOptional(value: string | undefined) {
  return value && value.length > 0 ? value : null;
}

function toWorkspaceRecord(record: {
  id: string;
  name: string;
  niche: string;
  timezone: string;
}): Workspace {
  return {
    id: record.id,
    name: record.name,
    niche: "medspa",
    timezone: record.timezone,
  };
}

function toContactRecord(record: {
  id: string;
  workspaceId: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  createdAt: Date;
}): Contact {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    firstName: record.firstName,
    createdAt: record.createdAt,
    ...(record.lastName ? { lastName: record.lastName } : {}),
    ...(record.email ? { email: record.email } : {}),
    ...(record.phone ? { phone: record.phone } : {}),
  };
}

function toLeadRecord(record: {
  id: string;
  workspaceId: string;
  contactId: string;
  source: string;
  status: string;
  campaignId: string | null;
  createdAt: Date;
}): Lead {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    contactId: record.contactId,
    source: record.source,
    status: record.status as Lead["status"],
    createdAt: record.createdAt,
    ...(record.campaignId ? { campaignId: record.campaignId } : {}),
  };
}

function toDomainEvent(record: {
  id: string;
  workspaceId: string;
  name: string;
  payload: Prisma.JsonValue;
  occurredAt: Date;
}): DomainEvent {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    name: record.name as DomainEvent["name"],
    payload: record.payload,
    occurredAt: record.occurredAt,
  };
}

async function ensureWorkspace(workspaceId: string): Promise<Workspace> {
  const fallback = getDefaultWorkspace();
  const record = await prisma.workspace.upsert({
    where: { id: workspaceId },
    update: {},
    create: {
      id: workspaceId,
      name: fallback.name,
      niche: fallback.niche,
      timezone: fallback.timezone,
    },
  });

  return toWorkspaceRecord(record);
}

export async function saveLeadTransaction(
  input: SaveLeadTransactionInput,
): Promise<SaveLeadTransactionResult> {
  const workspace = await ensureWorkspace(input.lead.workspaceId);

  const result = await prisma.$transaction(async (tx) => {
    const contact = await tx.contact.create({
      data: {
        id: input.contact.id,
        workspaceId: input.contact.workspaceId,
        firstName: input.contact.firstName,
        lastName: normalizeOptional(input.contact.lastName),
        email: normalizeOptional(input.contact.email),
        phone: normalizeOptional(input.contact.phone),
      },
    });

    const lead = await tx.lead.create({
      data: {
        id: input.lead.id,
        workspaceId: input.lead.workspaceId,
        contactId: input.lead.contactId,
        source: input.lead.source,
        status: input.lead.status,
        campaignId: normalizeOptional(input.lead.campaignId),
      },
    });

    const events = await Promise.all(
      input.events.map((event) =>
        tx.event.create({
          data: {
            id: event.id,
            workspaceId: event.workspaceId,
            name: event.name,
            payload: event.payload as Prisma.InputJsonValue,
            occurredAt: event.occurredAt,
          },
        }),
      ),
    );

    return {
      contact: toContactRecord(contact),
      lead: toLeadRecord(lead),
      events: events.map(toDomainEvent),
    };
  });

  return {
    workspace,
    contact: result.contact,
    lead: result.lead,
    events: result.events,
  };
}

export async function saveAppointmentTransaction(
  input: SaveAppointmentTransactionInput,
): Promise<SaveAppointmentTransactionResult> {
  const workspace = await ensureWorkspace(input.appointment.workspaceId);

  const result = await prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.create({
      data: {
        id: input.appointment.id,
        workspaceId: input.appointment.workspaceId,
        contactId: input.appointment.contactId,
        leadId: normalizeOptional(input.appointment.leadId),
        startsAt: input.appointment.startsAt,
        outcome: normalizeOptional(input.appointment.outcome),
      },
    });

    const events = await Promise.all(
      input.events.map((event) =>
        tx.event.create({
          data: {
            id: event.id,
            workspaceId: event.workspaceId,
            name: event.name,
            payload: event.payload as Prisma.InputJsonValue,
            occurredAt: event.occurredAt,
          },
        }),
      ),
    );

    return {
      appointment: {
        id: appointment.id,
        workspaceId: appointment.workspaceId,
        contactId: appointment.contactId,
        startsAt: appointment.startsAt,
        ...(appointment.leadId ? { leadId: appointment.leadId } : {}),
        ...(appointment.outcome
          ? { outcome: appointment.outcome as "scheduled" | "completed" | "cancelled" | "no_show" }
          : {}),
      },
      events: events.map(toDomainEvent),
    };
  });

  return {
    workspace,
    appointment: result.appointment,
    events: result.events,
  };
}

export async function appendEvents(events: DomainEvent[]): Promise<void> {
  if (events.length === 0) {
    return;
  }

  await Promise.all(
    events.map((event) =>
      prisma.event.create({
        data: {
          id: event.id,
          workspaceId: event.workspaceId,
          name: event.name,
          payload: event.payload as Prisma.InputJsonValue,
          occurredAt: event.occurredAt,
        },
      }),
    ),
  );
}

export async function getRecentEvents(limit = 25): Promise<DomainEvent[]> {
  const events = await prisma.event.findMany({
    orderBy: { occurredAt: "desc" },
    take: limit,
  });

  return events.map(toDomainEvent).reverse();
}

export async function getPendingQueuedMessages(limit = 25): Promise<QueuedMessage[]> {
  const [queuedEvents, deliveredEvents, suppressedEvents] = await Promise.all([
    prisma.event.findMany({
      where: { name: "message.outbound_queued" },
      orderBy: { occurredAt: "asc" },
      take: limit * 4,
    }),
    prisma.event.findMany({
      where: { name: "message.delivered" },
      orderBy: { occurredAt: "desc" },
      take: limit * 8,
    }),
    prisma.event.findMany({
      where: { name: "message.suppressed" },
      orderBy: { occurredAt: "desc" },
      take: limit * 8,
    }),
  ]);

  const handledIds = new Set(
    deliveredEvents
      .map((event) => event.payload as unknown as MessageDeliveredPayload)
      .map((payload) => payload.queuedEventId),
  );
  for (const event of suppressedEvents) {
    handledIds.add(
      (event.payload as unknown as MessageSuppressedPayload).queuedEventId,
    );
  }
  const now = Date.now();

  return queuedEvents
    .filter((event) => !handledIds.has(event.id))
    .map((event) => {
      const payload = event.payload as unknown as MessageOutboundQueuedPayload;
      return {
        queuedEventId: event.id,
        workspaceId: event.workspaceId,
        contactId: payload.contactId,
        channel: payload.channel,
        destination: payload.destination,
        body: payload.message,
        reason: payload.reason,
        ...(payload.deliverAfter ? { deliverAfter: payload.deliverAfter } : {}),
      } satisfies QueuedMessage;
    })
    .filter((message) => {
      if (!message.deliverAfter) {
        return true;
      }

      return new Date(message.deliverAfter).getTime() <= now;
    })
    .slice(0, limit);
}

export async function getDeliveryStatus(): Promise<DeliveryStatusSnapshot> {
  const [pending, deliveredEvents] = await Promise.all([
    getPendingQueuedMessages(200),
    prisma.event.findMany({
      where: { name: "message.delivered" },
      orderBy: { occurredAt: "desc" },
      take: 25,
    }),
  ]);

  const seenQueuedEventIds = new Set<string>();
  const recentDelivered = deliveredEvents
    .map((event) => event.payload as unknown as MessageDeliveredPayload)
    .filter((payload) => {
      if (seenQueuedEventIds.has(payload.queuedEventId)) {
        return false;
      }

      seenQueuedEventIds.add(payload.queuedEventId);
      return true;
    })
    .map((payload) => ({
      queuedEventId: payload.queuedEventId,
      contactId: payload.contactId,
      channel: payload.channel,
      provider: payload.provider,
      deliveredAt: payload.deliveredAt,
    }));

  return {
    provider: appConfig.messageProvider,
    queuedCount: pending.length,
    deliveredCount: recentDelivered.length,
    recentDelivered,
  };
}

export interface LeadOverviewItem {
  leadId: string;
  firstName: string;
  source: string;
  status: Lead["status"];
  contactChannel: string;
  createdAt: string;
}

export interface AppointmentOverviewItem {
  appointmentId: string;
  contactId: string;
  firstName: string;
  startsAt: string;
  outcome?: "scheduled" | "completed" | "cancelled" | "no_show";
  createdAt: string;
}

export interface BookingSlot {
  label: string;
  startsAt: string;
}

export interface DashboardFunnelSnapshot {
  newLeads: number;
  respondedLeads: number;
  qualifiedLeads: number;
  bookedAppointments: number;
}

export interface ActiveLeadRecord {
  id: string;
  contactId: string;
  status: Lead["status"];
}

export interface PendingWorkflowMessageRecord extends QueuedMessage {
  queuedAt: string;
}

export interface ReactivationCandidate {
  workspaceId: string;
  contactId: string;
  firstName: string;
  segment: "stale_lead" | "past_customer";
  channel: "sms" | "email";
  destination: string;
  lastActivityAt: string;
}

export type ReactivationAudienceSegment = "all" | "stale_leads" | "past_customers";

export interface ReactivationSuppressionMatch {
  contactId: string;
  reason: string;
  campaignKey?: string;
  runId?: string;
  queuedAt: string;
}

export interface ReactivationOutcomeRecord {
  queuedEventId: string;
  contactId: string;
  firstName: string;
  channel: "sms" | "email";
  destination: string;
  campaignKey?: string;
  runId?: string;
  queuedAt: string;
  deliveredAt?: string;
  replied: boolean;
  repliedAt?: string;
  qualified: boolean;
  qualifiedAt?: string;
  booked: boolean;
  bookedAt?: string;
}

export interface ReactivationOutcomeReport {
  workspaceId: string;
  campaignKey?: string;
  runId?: string;
  queuedCount: number;
  deliveredCount: number;
  repliedCount: number;
  qualifiedCount: number;
  bookedCount: number;
  outcomes: ReactivationOutcomeRecord[];
}

export interface ReactivationRunSummary {
  campaignKey: string;
  runId: string;
  queuedCount: number;
  deliveredCount: number;
  repliedCount: number;
  qualifiedCount: number;
  bookedCount: number;
  lastQueuedAt: string;
}

export interface ReactivationActionItem {
  queuedEventId: string;
  contactId: string;
  firstName: string;
  destination: string;
  channel: "sms" | "email";
  campaignKey?: string;
  runId?: string;
  queuedAt: string;
  stage: "qualified_waiting_booking" | "replied_waiting_follow_up" | "delivered_no_reply";
  repliedAt?: string;
  qualifiedAt?: string;
  lastInboundBody?: string;
  lastInboundAt?: string;
  lastOutboundBody?: string;
  lastOutboundAt?: string;
}

export interface ReactivationHandledRecord {
  queuedEventId: string;
  contactId: string;
  firstName: string;
  campaignKey?: string;
  runId?: string;
  handledAt: string;
  note?: string;
}

export interface ReactivationImportRow {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  segment: "stale_lead" | "past_customer";
  lastActivityAt: string;
  rowNumber?: number;
}

export interface ReactivationImportSkippedRow {
  rowNumber: number;
  reason: string;
}

export interface ReactivationImportResult {
  workspaceId: string;
  dryRun: boolean;
  importedCount: number;
  createdContactCount: number;
  updatedContactCount: number;
  staleLeadCount: number;
  pastCustomerCount: number;
  duplicateActivityCount: number;
  skippedRowCount: number;
  skippedRows: ReactivationImportSkippedRow[];
}

export async function getRecentLeadOverview(limit = 6): Promise<LeadOverviewItem[]> {
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      contact: true,
    },
  });

  return leads.map((lead) => ({
    leadId: lead.id,
    firstName: lead.contact.firstName,
    source: lead.source,
    status: lead.status as Lead["status"],
    contactChannel: lead.contact.phone ?? lead.contact.email ?? "unknown",
    createdAt: lead.createdAt.toISOString(),
  }));
}

export async function getRecentAppointmentOverview(
  workspaceId = DEFAULT_WORKSPACE_ID,
  limit = 6,
): Promise<AppointmentOverviewItem[]> {
  const appointments = await prisma.appointment.findMany({
    where: {
      workspaceId,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      contact: true,
    },
  });

  return appointments.map((appointment) => ({
    appointmentId: appointment.id,
    contactId: appointment.contactId,
    firstName: appointment.contact.firstName,
    startsAt: appointment.startsAt.toISOString(),
    createdAt: appointment.createdAt.toISOString(),
    ...(appointment.outcome
      ? { outcome: appointment.outcome as "scheduled" | "completed" | "cancelled" | "no_show" }
      : {}),
  }));
}

export async function importReactivationContacts(args: {
  workspaceId?: string;
  rows: ReactivationImportRow[];
  dryRun?: boolean;
  skippedRows?: ReactivationImportSkippedRow[];
}): Promise<ReactivationImportResult> {
  const workspaceId = args.workspaceId ?? DEFAULT_WORKSPACE_ID;
  await ensureWorkspace(workspaceId);
  const dryRun = args.dryRun ?? false;

  let createdContactCount = 0;
  let updatedContactCount = 0;
  let staleLeadCount = 0;
  let pastCustomerCount = 0;
  let duplicateActivityCount = 0;
  const skippedRows = [...(args.skippedRows ?? [])];

  await prisma.$transaction(async (tx) => {
    for (const row of args.rows) {
      const lastActivityAt = new Date(row.lastActivityAt);
      const existingContact = await tx.contact.findFirst({
        where: {
          workspaceId,
          OR: [
            ...(row.email ? [{ email: row.email }] : []),
            ...(row.phone ? [{ phone: row.phone }] : []),
          ],
        },
      });
      const duplicateActivity =
        row.segment === "past_customer"
          ? await tx.appointment.findFirst({
              where: {
                workspaceId,
                contactId: existingContact?.id ?? "",
                startsAt: lastActivityAt,
                outcome: "completed",
              },
            })
          : await tx.lead.findFirst({
              where: {
                workspaceId,
                contactId: existingContact?.id ?? "",
                source: "reactivation_import",
                createdAt: lastActivityAt,
              },
            });

      if (duplicateActivity) {
        duplicateActivityCount += 1;
        skippedRows.push({
          rowNumber: row.rowNumber ?? 0,
          reason: "Duplicate reactivation import activity already exists.",
        });
        continue;
      }

      if (dryRun) {
        if (existingContact) {
          updatedContactCount += 1;
        } else {
          createdContactCount += 1;
        }

        if (row.segment === "past_customer") {
          pastCustomerCount += 1;
        } else {
          staleLeadCount += 1;
        }
        continue;
      }

      const contact = existingContact
        ? await tx.contact.update({
            where: { id: existingContact.id },
            data: {
              firstName: row.firstName,
              lastName: normalizeOptional(row.lastName),
              email: normalizeOptional(row.email) ?? existingContact.email,
              phone: normalizeOptional(row.phone) ?? existingContact.phone,
            },
          })
        : await tx.contact.create({
            data: {
              workspaceId,
              firstName: row.firstName,
              lastName: normalizeOptional(row.lastName),
              email: normalizeOptional(row.email),
              phone: normalizeOptional(row.phone),
              createdAt: lastActivityAt,
            },
          });

      if (existingContact) {
        updatedContactCount += 1;
      } else {
        createdContactCount += 1;
      }

      if (row.segment === "past_customer") {
        pastCustomerCount += 1;
        await tx.appointment.create({
          data: {
            workspaceId,
            contactId: contact.id,
            startsAt: lastActivityAt,
            outcome: "completed",
            createdAt: lastActivityAt,
          },
        });
        continue;
      }

      staleLeadCount += 1;
      await tx.lead.create({
        data: {
          workspaceId,
          contactId: contact.id,
          source: "reactivation_import",
          status: "lost",
          createdAt: lastActivityAt,
        },
      });
    }
  });

  return {
    workspaceId,
    dryRun,
    importedCount: staleLeadCount + pastCustomerCount,
    createdContactCount,
    updatedContactCount,
    staleLeadCount,
    pastCustomerCount,
    duplicateActivityCount,
    skippedRowCount: skippedRows.length,
    skippedRows,
  };
}

export async function getAvailableBookingSlots(args: {
  workspaceId?: string;
  daysAhead?: number;
  limit?: number;
} = {}): Promise<BookingSlot[]> {
  const workspaceId = args.workspaceId ?? DEFAULT_WORKSPACE_ID;
  const daysAhead = Math.max(1, Math.min(args.daysAhead ?? 5, 14));
  const slotHours = [10, 14];
  const now = new Date();
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + daysAhead + 1);
  windowEnd.setHours(0, 0, 0, 0);

  const appointments = await prisma.appointment.findMany({
    where: {
      workspaceId,
      startsAt: {
        gte: now,
        lt: windowEnd,
      },
      outcome: {
        notIn: ["cancelled", "no_show"],
      },
    },
    select: {
      startsAt: true,
    },
  });
  const occupiedStarts = new Set(
    appointments.map((appointment) => appointment.startsAt.toISOString()),
  );
  const slots: BookingSlot[] = [];

  for (let dayOffset = 1; dayOffset <= daysAhead; dayOffset += 1) {
    for (const hour of slotHours) {
      const startsAt = new Date(now);
      startsAt.setDate(startsAt.getDate() + dayOffset);
      startsAt.setHours(hour, 0, 0, 0);

      if (startsAt <= now || occupiedStarts.has(startsAt.toISOString())) {
        continue;
      }

      const label = startsAt.toLocaleString("en-GB", {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      });

      slots.push({
        label,
        startsAt: startsAt.toISOString(),
      });
    }
  }

  return slots.slice(0, args.limit ?? 4);
}

export async function isAppointmentSlotAvailable(args: {
  workspaceId?: string;
  startsAt: string;
}): Promise<boolean> {
  const startsAt = new Date(args.startsAt);

  if (Number.isNaN(startsAt.getTime()) || startsAt <= new Date()) {
    return false;
  }

  const existingAppointment = await prisma.appointment.findFirst({
    where: {
      workspaceId: args.workspaceId ?? DEFAULT_WORKSPACE_ID,
      startsAt,
      outcome: {
        notIn: ["cancelled", "no_show"],
      },
    },
  });

  return !existingAppointment;
}

export async function getDashboardFunnelSnapshot(
  workspaceId = DEFAULT_WORKSPACE_ID,
): Promise<DashboardFunnelSnapshot> {
  const [newLeads, respondedLeads, qualifiedLeads, bookedAppointments] =
    await Promise.all([
      prisma.lead.count({
        where: {
          workspaceId,
          status: "new",
        },
      }),
      prisma.lead.count({
        where: {
          workspaceId,
          status: "responded",
        },
      }),
      prisma.lead.count({
        where: {
          workspaceId,
          status: "qualified",
        },
      }),
      prisma.appointment.count({
        where: {
          workspaceId,
        },
      }),
    ]);

  return {
    newLeads,
    respondedLeads,
    qualifiedLeads,
    bookedAppointments,
  };
}

export async function getReactivationCandidates(args: {
  workspaceId: string;
  inactiveDays: number;
  limit?: number;
  audienceSegment?: ReactivationAudienceSegment;
}): Promise<ReactivationCandidate[]> {
  const cutoff = new Date(Date.now() - args.inactiveDays * 24 * 60 * 60 * 1000);
  const audienceSegment = args.audienceSegment ?? "all";
  const includeStaleLeads =
    audienceSegment === "all" || audienceSegment === "stale_leads";
  const includePastCustomers =
    audienceSegment === "all" || audienceSegment === "past_customers";
  const contactQuery = {
    orderBy: { createdAt: "asc" },
    take: args.limit ?? 25,
    include: {
      appointments: {
        orderBy: { startsAt: "desc" },
        take: 1,
      },
      leads: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  } satisfies Pick<
    Prisma.ContactFindManyArgs,
    "orderBy" | "take" | "include"
  >;
  const [staleLeadContacts, pastCustomerContacts] = await Promise.all([
    includeStaleLeads
      ? prisma.contact.findMany({
          ...contactQuery,
          where: {
            workspaceId: args.workspaceId,
            leads: {
              some: {
                createdAt: { lte: cutoff },
              },
            },
            appointments: {
              none: {},
            },
            messages: {
              none: {
                createdAt: { gte: cutoff },
              },
            },
            OR: [{ phone: { not: null } }, { email: { not: null } }],
          },
        })
      : [],
    includePastCustomers
      ? prisma.contact.findMany({
          ...contactQuery,
          where: {
            workspaceId: args.workspaceId,
            appointments: {
              some: {
                startsAt: { lte: cutoff },
              },
            },
            messages: {
              none: {
                createdAt: { gte: cutoff },
              },
            },
            OR: [{ phone: { not: null } }, { email: { not: null } }],
          },
        })
      : [],
  ]);

  const toCandidate = (
    contact: (typeof staleLeadContacts)[number],
    segment: ReactivationCandidate["segment"],
  ): ReactivationCandidate => {
    const destination = contact.phone ?? contact.email ?? "";
    const channel = contact.phone ? "sms" : "email";
    const activityDates = [
      contact.messages[0]?.createdAt,
      contact.appointments[0]?.startsAt,
      contact.leads[0]?.createdAt,
      contact.createdAt,
    ].filter((date): date is Date => Boolean(date));
    const lastActivityAt = new Date(
      Math.max(...activityDates.map((date) => date.getTime())),
    ).toISOString();

    return {
      workspaceId: contact.workspaceId,
      contactId: contact.id,
      firstName: contact.firstName,
      segment,
      channel,
      destination,
      lastActivityAt,
    };
  };

  const dedupedPastCustomers = pastCustomerContacts.filter(
    (contact) => !staleLeadContacts.some((leadContact) => leadContact.id === contact.id),
  );

  return [
    ...staleLeadContacts.map((contact) => toCandidate(contact, "stale_lead")),
    ...dedupedPastCustomers.map((contact) => toCandidate(contact, "past_customer")),
  ].slice(0, args.limit ?? 25);
}

export async function getMostRecentLeadForContact(args: {
  workspaceId: string;
  contactId: string;
}): Promise<ActiveLeadRecord | null> {
  const lead = await prisma.lead.findFirst({
    where: {
      workspaceId: args.workspaceId,
      contactId: args.contactId,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!lead) {
    return null;
  }

  return {
    id: lead.id,
    contactId: lead.contactId,
    status: lead.status as Lead["status"],
  };
}

export async function markLeadResponded(args: {
  workspaceId: string;
  leadId: string;
}): Promise<boolean> {
  const result = await prisma.lead.updateMany({
    where: {
      id: args.leadId,
      workspaceId: args.workspaceId,
      status: { in: ["new", "contacted"] },
    },
    data: {
      status: "responded",
    },
  });

  return result.count > 0;
}

export async function markLeadQualified(args: {
  workspaceId: string;
  leadId: string;
}): Promise<boolean> {
  const result = await prisma.lead.updateMany({
    where: {
      id: args.leadId,
      workspaceId: args.workspaceId,
      status: { in: ["new", "contacted", "responded"] },
    },
    data: {
      status: "qualified",
    },
  });

  return result.count > 0;
}

export async function getPendingWorkflowMessagesForContact(args: {
  workspaceId: string;
  contactId: string;
  workflowReason: string;
}): Promise<PendingWorkflowMessageRecord[]> {
  const [queuedEvents, deliveredEvents, suppressedEvents] = await Promise.all([
    prisma.event.findMany({
      where: {
        workspaceId: args.workspaceId,
        name: "message.outbound_queued",
      },
      orderBy: { occurredAt: "asc" },
      take: 100,
    }),
    prisma.event.findMany({
      where: {
        workspaceId: args.workspaceId,
        name: "message.delivered",
      },
      orderBy: { occurredAt: "desc" },
      take: 200,
    }),
    prisma.event.findMany({
      where: {
        workspaceId: args.workspaceId,
        name: "message.suppressed",
      },
      orderBy: { occurredAt: "desc" },
      take: 200,
    }),
  ]);

  const handledIds = new Set<string>();
  for (const event of deliveredEvents) {
    handledIds.add(
      (event.payload as unknown as MessageDeliveredPayload).queuedEventId,
    );
  }
  for (const event of suppressedEvents) {
    handledIds.add(
      (event.payload as unknown as MessageSuppressedPayload).queuedEventId,
    );
  }

  return queuedEvents
    .filter((event) => !handledIds.has(event.id))
    .map((event) => {
      const payload = event.payload as unknown as MessageOutboundQueuedPayload;
      return {
        queuedEventId: event.id,
        workspaceId: event.workspaceId,
        contactId: payload.contactId,
        channel: payload.channel,
        destination: payload.destination,
        body: payload.message,
        reason: payload.reason,
        queuedAt: event.occurredAt.toISOString(),
        ...(payload.deliverAfter ? { deliverAfter: payload.deliverAfter } : {}),
      } satisfies PendingWorkflowMessageRecord;
    })
    .filter(
      (message) =>
        message.contactId === args.contactId && message.reason === args.workflowReason,
    );
}

export async function getRecentQueuedMessagesForReason(args: {
  workspaceId: string;
  reason: string;
  since: string;
}): Promise<ReactivationSuppressionMatch[]> {
  const queuedEvents = await prisma.event.findMany({
    where: {
      workspaceId: args.workspaceId,
      name: "message.outbound_queued",
      occurredAt: {
        gte: new Date(args.since),
      },
    },
    orderBy: { occurredAt: "desc" },
    take: 500,
  });

  return queuedEvents
    .map((event) => {
      const payload = event.payload as unknown as MessageOutboundQueuedPayload;
      return {
        contactId: payload.contactId,
        reason: payload.reason,
        ...(payload.campaignKey ? { campaignKey: payload.campaignKey } : {}),
        ...(payload.runId ? { runId: payload.runId } : {}),
        queuedAt: event.occurredAt.toISOString(),
      } satisfies ReactivationSuppressionMatch;
    })
    .filter((event) => event.reason === args.reason);
}

export async function getReactivationOutcomeReport(args: {
  workspaceId: string;
  campaignKey?: string;
  runId?: string;
  limit?: number;
}): Promise<ReactivationOutcomeReport> {
  const queuedEvents = await prisma.event.findMany({
    where: {
      workspaceId: args.workspaceId,
      name: "message.outbound_queued",
    },
    orderBy: { occurredAt: "desc" },
    take: Math.max(1, Math.min(args.limit ?? 100, 250)),
  });

  const reactivationQueuedEvents = queuedEvents.filter((event) => {
    const payload = event.payload as unknown as MessageOutboundQueuedPayload;

    if (payload.reason !== "reactivation.dormant-outreach") {
      return false;
    }

    if (args.campaignKey && payload.campaignKey !== args.campaignKey) {
      return false;
    }

    if (args.runId && payload.runId !== args.runId) {
      return false;
    }

    return true;
  });

  if (reactivationQueuedEvents.length === 0) {
    return {
      workspaceId: args.workspaceId,
      ...(args.campaignKey ? { campaignKey: args.campaignKey } : {}),
      ...(args.runId ? { runId: args.runId } : {}),
      queuedCount: 0,
      deliveredCount: 0,
      repliedCount: 0,
      qualifiedCount: 0,
      bookedCount: 0,
      outcomes: [],
    };
  }

  const contactIds = [...new Set(
    reactivationQueuedEvents.map((event) =>
      (event.payload as unknown as MessageOutboundQueuedPayload).contactId,
    ),
  )];
  const queuedEventIds = reactivationQueuedEvents.map((event) => event.id);
  const earliestQueuedAt = reactivationQueuedEvents.reduce(
    (earliest, event) =>
      event.occurredAt < earliest ? event.occurredAt : earliest,
    reactivationQueuedEvents[0]!.occurredAt,
  );

  const [contacts, deliveredEvents, inboundMessages, qualifiedEvents, bookedEvents, appointments] =
    await Promise.all([
      prisma.contact.findMany({
        where: {
          workspaceId: args.workspaceId,
          id: { in: contactIds },
        },
      }),
      prisma.event.findMany({
        where: {
          workspaceId: args.workspaceId,
          name: "message.delivered",
          occurredAt: { gte: earliestQueuedAt },
        },
      }),
      prisma.message.findMany({
        where: {
          workspaceId: args.workspaceId,
          contactId: { in: contactIds },
          direction: "inbound",
          createdAt: { gte: earliestQueuedAt },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.event.findMany({
        where: {
          workspaceId: args.workspaceId,
          name: "lead.qualified",
          occurredAt: { gte: earliestQueuedAt },
        },
      }),
      prisma.event.findMany({
        where: {
          workspaceId: args.workspaceId,
          name: "appointment.booked",
          occurredAt: { gte: earliestQueuedAt },
        },
      }),
      prisma.appointment.findMany({
        where: {
          workspaceId: args.workspaceId,
          contactId: { in: contactIds },
          createdAt: { gte: earliestQueuedAt },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
  const deliveredByQueuedEventId = new Map(
    deliveredEvents
      .map((event) => {
        const payload = event.payload as unknown as MessageDeliveredPayload;
        return [payload.queuedEventId, payload] as const;
      })
      .filter(([queuedEventId]) => queuedEventIds.includes(queuedEventId)),
  );
  const inboundByContactId = new Map<string, typeof inboundMessages>();
  for (const message of inboundMessages) {
    const entries = inboundByContactId.get(message.contactId) ?? [];
    entries.push(message);
    inboundByContactId.set(message.contactId, entries);
  }
  const qualifiedByContactId = new Map<string, DomainEvent[]>();
  for (const event of qualifiedEvents) {
    const payload = event.payload as unknown as { contactId: string };
    const entries = qualifiedByContactId.get(payload.contactId) ?? [];
    entries.push(toDomainEvent(event));
    qualifiedByContactId.set(payload.contactId, entries);
  }
  const bookedByContactId = new Map<string, DomainEvent[]>();
  for (const event of bookedEvents) {
    const payload = event.payload as unknown as AppointmentBookedPayload;
    const entries = bookedByContactId.get(payload.contactId) ?? [];
    entries.push(toDomainEvent(event));
    bookedByContactId.set(payload.contactId, entries);
  }
  const appointmentsByContactId = new Map<string, typeof appointments>();
  for (const appointment of appointments) {
    const entries = appointmentsByContactId.get(appointment.contactId) ?? [];
    entries.push(appointment);
    appointmentsByContactId.set(appointment.contactId, entries);
  }

  const outcomes = reactivationQueuedEvents.map((event) => {
    const payload = event.payload as unknown as MessageOutboundQueuedPayload;
    const contact = contactById.get(payload.contactId);
    const delivered = deliveredByQueuedEventId.get(event.id);
    const deliveredAt = delivered?.deliveredAt;
    const reply = (inboundByContactId.get(payload.contactId) ?? []).find(
      (message) => message.createdAt >= event.occurredAt,
    );
    const qualification = (qualifiedByContactId.get(payload.contactId) ?? []).find(
      (qualifiedEvent) => qualifiedEvent.occurredAt >= event.occurredAt,
    );
    const bookedEvent = (bookedByContactId.get(payload.contactId) ?? []).find(
      (bookingEvent) => bookingEvent.occurredAt >= event.occurredAt,
    );
    const fallbackAppointment = (appointmentsByContactId.get(payload.contactId) ?? []).find(
      (appointment) => appointment.createdAt >= event.occurredAt,
    );
    const bookedAt =
      bookedEvent?.occurredAt.toISOString() ??
      fallbackAppointment?.createdAt.toISOString();

    return {
      queuedEventId: event.id,
      contactId: payload.contactId,
      firstName: contact?.firstName ?? "Unknown",
      channel: payload.channel,
      destination: payload.destination,
      ...(payload.campaignKey ? { campaignKey: payload.campaignKey } : {}),
      ...(payload.runId ? { runId: payload.runId } : {}),
      queuedAt: event.occurredAt.toISOString(),
      ...(deliveredAt ? { deliveredAt } : {}),
      replied: Boolean(reply),
      ...(reply ? { repliedAt: reply.createdAt.toISOString() } : {}),
      qualified: Boolean(qualification),
      ...(qualification
        ? {
            qualifiedAt: qualification.occurredAt.toISOString(),
          }
        : {}),
      booked: Boolean(bookedEvent || fallbackAppointment),
      ...(bookedAt ? { bookedAt } : {}),
    } satisfies ReactivationOutcomeRecord;
  });

  return {
    workspaceId: args.workspaceId,
    ...(args.campaignKey ? { campaignKey: args.campaignKey } : {}),
    ...(args.runId ? { runId: args.runId } : {}),
    queuedCount: outcomes.length,
    deliveredCount: outcomes.filter((outcome) => outcome.deliveredAt).length,
    repliedCount: outcomes.filter((outcome) => outcome.replied).length,
    qualifiedCount: outcomes.filter((outcome) => outcome.qualified).length,
    bookedCount: outcomes.filter((outcome) => outcome.booked).length,
    outcomes,
  };
}

export async function getRecentReactivationRunSummaries(args: {
  workspaceId: string;
  limit?: number;
}): Promise<ReactivationRunSummary[]> {
  const report = await getReactivationOutcomeReport({
    workspaceId: args.workspaceId,
    limit: Math.max(25, (args.limit ?? 6) * 20),
  });

  const summaryByRun = new Map<string, ReactivationRunSummary>();

  for (const outcome of report.outcomes) {
    const campaignKey = outcome.campaignKey ?? "reactivation-default";
    const runId = outcome.runId ?? "legacy-run";
    const compositeKey = `${campaignKey}::${runId}`;
    const existing = summaryByRun.get(compositeKey);

    if (!existing) {
      summaryByRun.set(compositeKey, {
        campaignKey,
        runId,
        queuedCount: 1,
        deliveredCount: outcome.deliveredAt ? 1 : 0,
        repliedCount: outcome.replied ? 1 : 0,
        qualifiedCount: outcome.qualified ? 1 : 0,
        bookedCount: outcome.booked ? 1 : 0,
        lastQueuedAt: outcome.queuedAt,
      });
      continue;
    }

    existing.queuedCount += 1;
    existing.deliveredCount += outcome.deliveredAt ? 1 : 0;
    existing.repliedCount += outcome.replied ? 1 : 0;
    existing.qualifiedCount += outcome.qualified ? 1 : 0;
    existing.bookedCount += outcome.booked ? 1 : 0;
    if (new Date(outcome.queuedAt) > new Date(existing.lastQueuedAt)) {
      existing.lastQueuedAt = outcome.queuedAt;
    }
  }

  return [...summaryByRun.values()]
    .sort(
      (left, right) =>
        new Date(right.lastQueuedAt).getTime() - new Date(left.lastQueuedAt).getTime(),
    )
    .slice(0, args.limit ?? 6);
}

export async function getReactivationActionQueue(args: {
  workspaceId: string;
  limit?: number;
}): Promise<ReactivationActionItem[]> {
  const [report, handledEvents] = await Promise.all([
    getReactivationOutcomeReport({
      workspaceId: args.workspaceId,
      limit: Math.max(25, (args.limit ?? 8) * 20),
    }),
    prisma.event.findMany({
      where: {
        workspaceId: args.workspaceId,
        name: "reactivation.follow_up_handled",
      },
      orderBy: { occurredAt: "desc" },
      take: 500,
    }),
  ]);
  const handledQueuedEventIds = new Set(
    handledEvents
      .map((event) => event.payload as unknown as ReactivationFollowUpHandledPayload)
      .map((payload) => payload.queuedEventId),
  );

  const openOutcomes = report.outcomes
    .filter(
      (outcome) =>
        !outcome.booked && !handledQueuedEventIds.has(outcome.queuedEventId),
    );
  const contactIds = [...new Set(openOutcomes.map((outcome) => outcome.contactId))];
  const recentMessages = contactIds.length > 0
    ? await prisma.message.findMany({
        where: {
          workspaceId: args.workspaceId,
          contactId: { in: contactIds },
        },
        orderBy: { createdAt: "desc" },
        take: Math.max(50, contactIds.length * 6),
      })
    : [];
  const messagesByContactId = new Map<string, typeof recentMessages>();
  for (const message of recentMessages) {
    const messages = messagesByContactId.get(message.contactId) ?? [];
    messages.push(message);
    messagesByContactId.set(message.contactId, messages);
  }

  return openOutcomes.map((outcome) => {
    const stage = outcome.qualified
      ? "qualified_waiting_booking"
      : outcome.replied
        ? "replied_waiting_follow_up"
        : "delivered_no_reply";
    const messages = messagesByContactId.get(outcome.contactId) ?? [];
    const lastInbound = messages.find((message) => message.direction === "inbound");
    const lastOutbound = messages.find((message) => message.direction === "outbound");

    return {
      queuedEventId: outcome.queuedEventId,
      contactId: outcome.contactId,
      firstName: outcome.firstName,
      destination: outcome.destination,
      channel: outcome.channel,
      ...(outcome.campaignKey ? { campaignKey: outcome.campaignKey } : {}),
      ...(outcome.runId ? { runId: outcome.runId } : {}),
      queuedAt: outcome.queuedAt,
      stage,
      ...(outcome.repliedAt ? { repliedAt: outcome.repliedAt } : {}),
      ...(outcome.qualifiedAt ? { qualifiedAt: outcome.qualifiedAt } : {}),
      ...(lastInbound
        ? {
            lastInboundBody: lastInbound.body,
            lastInboundAt: lastInbound.createdAt.toISOString(),
          }
        : {}),
      ...(lastOutbound
        ? {
            lastOutboundBody: lastOutbound.body,
            lastOutboundAt: lastOutbound.createdAt.toISOString(),
          }
        : {}),
    } satisfies ReactivationActionItem;
  }).sort((left, right) => {
      const priority = {
        qualified_waiting_booking: 0,
        replied_waiting_follow_up: 1,
        delivered_no_reply: 2,
      } as const;

      const priorityDelta = priority[left.stage] - priority[right.stage];
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return new Date(right.queuedAt).getTime() - new Date(left.queuedAt).getTime();
    })
    .slice(0, args.limit ?? 8);
}

export async function markReactivationFollowUpHandled(args: {
  workspaceId: string;
  queuedEventId: string;
  contactId: string;
  note?: string;
}): Promise<void> {
  await appendEvents([
    createReactivationFollowUpHandledEvent({
      workspaceId: args.workspaceId,
      queuedEventId: args.queuedEventId,
      contactId: args.contactId,
      ...(args.note ? { note: args.note } : {}),
    }),
  ]);
}

export async function getRecentReactivationHandledItems(args: {
  workspaceId: string;
  limit?: number;
}): Promise<ReactivationHandledRecord[]> {
  const handledEvents = await prisma.event.findMany({
    where: {
      workspaceId: args.workspaceId,
      name: "reactivation.follow_up_handled",
    },
    orderBy: { occurredAt: "desc" },
    take: args.limit ?? 8,
  });

  if (handledEvents.length === 0) {
    return [];
  }

  const payloads = handledEvents.map((event) => ({
    event,
    payload: event.payload as unknown as ReactivationFollowUpHandledPayload,
  }));
  const contactIds = [...new Set(payloads.map(({ payload }) => payload.contactId))];
  const queuedEventIds = [...new Set(payloads.map(({ payload }) => payload.queuedEventId))];
  const [contacts, queuedEvents] = await Promise.all([
    prisma.contact.findMany({
      where: {
        workspaceId: args.workspaceId,
        id: { in: contactIds },
      },
    }),
    prisma.event.findMany({
      where: {
        workspaceId: args.workspaceId,
        id: { in: queuedEventIds },
        name: "message.outbound_queued",
      },
    }),
  ]);

  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
  const queuedEventById = new Map(queuedEvents.map((event) => [event.id, event]));

  return payloads.map(({ event, payload }) => {
    const contact = contactById.get(payload.contactId);
    const queuedEvent = queuedEventById.get(payload.queuedEventId);
    const queuedPayload = queuedEvent?.payload as
      | MessageOutboundQueuedPayload
      | undefined;

    return {
      queuedEventId: payload.queuedEventId,
      contactId: payload.contactId,
      firstName: contact?.firstName ?? "Unknown",
      ...(queuedPayload?.campaignKey ? { campaignKey: queuedPayload.campaignKey } : {}),
      ...(queuedPayload?.runId ? { runId: queuedPayload.runId } : {}),
      handledAt: payload.handledAt || event.occurredAt.toISOString(),
      ...(payload.note ? { note: payload.note } : {}),
    } satisfies ReactivationHandledRecord;
  });
}

export async function recordOutboundMessage(args: {
  queuedEventId: string;
  workspaceId: string;
  contactId: string;
  channel: "sms" | "email";
  provider: string;
  destination: string;
  body: string;
  deliveredAt: string;
}) {
  const deliveredDate = new Date(args.deliveredAt);
  const conversation = await prisma.conversation.upsert({
    where: {
      workspaceId_contactId_channel: {
        workspaceId: args.workspaceId,
        contactId: args.contactId,
        channel: args.channel,
      },
    },
    update: {},
    create: {
      workspaceId: args.workspaceId,
      contactId: args.contactId,
      channel: args.channel,
    },
  });

  return prisma.message.upsert({
    where: { queuedEventId: args.queuedEventId },
    update: {
      conversationId: conversation.id,
      provider: args.provider,
      destination: args.destination,
      body: args.body,
      status: "delivered",
      sentAt: deliveredDate,
      deliveredAt: deliveredDate,
    },
    create: {
      workspaceId: args.workspaceId,
      contactId: args.contactId,
      conversationId: conversation.id,
      queuedEventId: args.queuedEventId,
      channel: args.channel,
      direction: "outbound",
      provider: args.provider,
      destination: args.destination,
      body: args.body,
      status: "delivered",
      sentAt: deliveredDate,
      deliveredAt: deliveredDate,
    },
  });
}

export async function recordInboundMessage(args: {
  workspaceId: string;
  contactId: string;
  channel: "sms" | "email";
  provider: string;
  from: string;
  body: string;
  receivedAt: string;
}) {
  const conversation = await prisma.conversation.upsert({
    where: {
      workspaceId_contactId_channel: {
        workspaceId: args.workspaceId,
        contactId: args.contactId,
        channel: args.channel,
      },
    },
    update: {},
    create: {
      workspaceId: args.workspaceId,
      contactId: args.contactId,
      channel: args.channel,
    },
  });

  return prisma.message.create({
    data: {
      workspaceId: args.workspaceId,
      contactId: args.contactId,
      conversationId: conversation.id,
      channel: args.channel,
      direction: "inbound",
      provider: args.provider,
      destination: args.from,
      body: args.body,
      status: "received",
      createdAt: new Date(args.receivedAt),
    },
  });
}

export async function findContactByAddress(args: {
  workspaceId: string;
  channel: "sms" | "email";
  address: string;
}): Promise<Contact | null> {
  const contact = await prisma.contact.findFirst({
    where: {
      workspaceId: args.workspaceId,
      ...(args.channel === "sms" ? { phone: args.address } : { email: args.address }),
    },
  });

  return contact ? toContactRecord(contact) : null;
}

export async function getRecentMessageTimeline(
  limit = 12,
): Promise<MessageTimelineItem[]> {
  const messages = await prisma.message.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return messages.map((message) => ({
    messageId: message.id,
    ...(message.conversationId ? { conversationId: message.conversationId } : {}),
    contactId: message.contactId,
    channel: message.channel as "sms" | "email",
    direction: message.direction as "outbound" | "inbound",
    provider: message.provider,
    destination: message.destination,
    body: message.body,
    status: message.status,
    createdAt: message.createdAt.toISOString(),
    ...(message.deliveredAt
      ? { deliveredAt: message.deliveredAt.toISOString() }
      : {}),
  }));
}

export async function getRecentConversationThreads(
  limit = 6,
): Promise<ConversationThread[]> {
  const conversations = await prisma.conversation.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      contact: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  return conversations.map((conversation) => {
    const messages = [...conversation.messages]
      .reverse()
      .map((message) => ({
        messageId: message.id,
        ...(message.conversationId ? { conversationId: message.conversationId } : {}),
        contactId: message.contactId,
        channel: message.channel as "sms" | "email",
        direction: message.direction as "outbound" | "inbound",
        provider: message.provider,
        destination: message.destination,
        body: message.body,
        status: message.status,
        createdAt: message.createdAt.toISOString(),
        ...(message.deliveredAt
          ? { deliveredAt: message.deliveredAt.toISOString() }
          : {}),
      })) satisfies MessageTimelineItem[];

    const lastMessage = conversation.messages[0];
    const contactLabel =
      conversation.contact.firstName ||
      conversation.contact.email ||
      conversation.contact.phone ||
      conversation.contact.id;

    return {
      conversationId: conversation.id,
      contactId: conversation.contactId,
      contactLabel,
      channel: conversation.channel as "sms" | "email",
      lastMessageAt: (lastMessage?.createdAt ?? conversation.createdAt).toISOString(),
      messages,
    };
  });
}
