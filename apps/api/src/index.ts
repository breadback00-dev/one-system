import "dotenv/config";

import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { URL } from "node:url";

import {
  appendEvents,
  findContactByAddress,
  getDeliveryStatus,
  getMostRecentLeadForContact,
  getPendingWorkflowMessagesForContact,
  getReactivationCandidates,
  getReactivationOutcomeReport,
  getRecentQueuedMessagesForReason,
  getRecentEvents,
  markLeadQualified,
  markLeadResponded,
  recordInboundMessage,
  saveLeadTransaction,
} from "@one-system/database";
import {
  createMessageSuppressedEvent,
  createLead,
  createMessageInboundReceivedEvent,
  type CreateLeadInput,
  type DomainEvent,
  type MessageInboundReceivedPayload,
} from "@one-system/domain";
import type { InboundMessage } from "@one-system/messaging";
import { appConfig } from "@one-system/config";
import { buildReactivationOutreachEvents } from "@one-system/reactivation";
import {
  parseTwilioInboundMessage,
  validateTwilioWebhookRequest,
} from "@one-system/integrations";
import {
  handleDomainEvent,
  handleInboundMessageWorkflow,
  leadCaptureWorkflow,
} from "@one-system/workflows";

interface LeadRequestBody {
  workspaceId?: string;
  source?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

interface InboundMessageBody {
  workspaceId?: string;
  channel?: "sms" | "email";
  from?: string;
  body?: string;
  provider?: string;
}

interface ReactivationRunBody {
  workspaceId?: string;
  inactiveDays?: number;
  limit?: number;
  cooldownDays?: number;
  campaignKey?: string;
}

interface ReactivationReportQuery {
  workspaceId: string;
  campaignKey?: string;
  runId?: string;
  limit: number;
}

const port = Number.parseInt(process.env.PORT ?? "4000", 10);

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const body = await readTextBody(request);

  if (!body) {
    return {} as T;
  }

  return JSON.parse(body) as T;
}

async function readTextBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return "";
  }

  return Buffer.concat(chunks).toString("utf8");
}

function getHeaderValue(
  request: IncomingMessage,
  headerName: string,
): string | undefined {
  const value = request.headers[headerName.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getRequestBaseUrl(request: IncomingMessage): string {
  const configuredBaseUrl = appConfig.appBaseUrl?.trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, "");
  }

  const forwardedProto = getHeaderValue(request, "x-forwarded-proto")?.split(",")[0]?.trim();
  const host = getHeaderValue(request, "x-forwarded-host")?.split(",")[0]?.trim()
    || getHeaderValue(request, "host")?.trim()
    || "localhost";
  const protocol = forwardedProto || "http";

  return `${protocol}://${host}`;
}

function validateLeadInput(body: LeadRequestBody): CreateLeadInput {
  const workspaceId = body.workspaceId?.trim() || "workspace_medspa_demo";
  const source = body.source?.trim();
  const firstName = body.firstName?.trim();
  const email = body.email?.trim();
  const phone = body.phone?.trim();

  if (!source) {
    throw new Error("`source` is required.");
  }

  if (!firstName) {
    throw new Error("`firstName` is required.");
  }

  if (!email && !phone) {
    throw new Error("At least one of `email` or `phone` is required.");
  }

  return {
    workspaceId,
    source,
    firstName,
    ...(body.lastName?.trim() ? { lastName: body.lastName.trim() } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
  };
}

function validateInboundMessageInput(body: InboundMessageBody) {
  const workspaceId = body.workspaceId?.trim() || "workspace_medspa_demo";
  const channel = body.channel;
  const from = body.from?.trim();
  const messageBody = body.body?.trim();
  const provider = body.provider?.trim() || "dev-log";

  if (!channel) {
    throw new Error("`channel` is required.");
  }

  if (!from) {
    throw new Error("`from` is required.");
  }

  if (!messageBody) {
    throw new Error("`body` is required.");
  }

  return {
    workspaceId,
    channel,
    from,
    body: messageBody,
    provider,
    receivedAt: new Date().toISOString(),
  };
}

function validateReactivationRunInput(body: ReactivationRunBody) {
  const workspaceId = body.workspaceId?.trim() || "workspace_medspa_demo";
  const inactiveDays = Number.isFinite(body.inactiveDays)
    ? Math.max(7, Math.floor(body.inactiveDays as number))
    : 30;
  const limit = Number.isFinite(body.limit)
    ? Math.max(1, Math.min(100, Math.floor(body.limit as number)))
    : 25;
  const cooldownDays = Number.isFinite(body.cooldownDays)
    ? Math.max(1, Math.min(90, Math.floor(body.cooldownDays as number)))
    : 14;
  const campaignKey =
    body.campaignKey?.trim() || "reactivation-default";

  return {
    workspaceId,
    inactiveDays,
    limit,
    cooldownDays,
    campaignKey,
  };
}

function validateReactivationReportQuery(requestUrl: URL): ReactivationReportQuery {
  const workspaceId =
    requestUrl.searchParams.get("workspaceId")?.trim() || "workspace_medspa_demo";
  const campaignKey = requestUrl.searchParams.get("campaignKey")?.trim() || undefined;
  const runId = requestUrl.searchParams.get("runId")?.trim() || undefined;
  const limitParam = requestUrl.searchParams.get("limit");
  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : Number.NaN;
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(250, parsedLimit))
    : 100;

  return {
    workspaceId,
    ...(campaignKey ? { campaignKey } : {}),
    ...(runId ? { runId } : {}),
    limit,
  };
}

async function processInboundMessage(
  input: InboundMessage,
  response: ServerResponse,
) {
  const contact = await findContactByAddress({
    workspaceId: input.workspaceId,
    channel: input.channel,
    address: input.from,
  });

  if (!contact) {
    sendJson(response, 404, {
      error: "No matching contact found for inbound message.",
    });
    return;
  }

  await recordInboundMessage({
    workspaceId: input.workspaceId,
    contactId: contact.id,
    channel: input.channel,
    provider: input.provider,
    from: input.from,
    body: input.body,
    receivedAt: input.receivedAt,
  });

  const inboundEvent = createMessageInboundReceivedEvent({
    workspaceId: input.workspaceId,
    contactId: contact.id,
    channel: input.channel,
    provider: input.provider,
    from: input.from,
    body: input.body,
  });
  await appendEvents([inboundEvent]);

  const activeLead = await getMostRecentLeadForContact({
    workspaceId: input.workspaceId,
    contactId: contact.id,
  });
  const workflowEvents = handleInboundMessageWorkflow({
    event: inboundEvent as DomainEvent<MessageInboundReceivedPayload>,
    activeLead,
  });

  const persistedWorkflowEvents: DomainEvent[] = [];
  for (const event of workflowEvents) {
    if (event.name === "lead.responded") {
      const leadResponded = await markLeadResponded({
        workspaceId: event.workspaceId,
        leadId: (event.payload as { leadId: string }).leadId,
      });

      if (leadResponded) {
        persistedWorkflowEvents.push(event);

        const pendingFollowUps = await getPendingWorkflowMessagesForContact({
          workspaceId: event.workspaceId,
          contactId: contact.id,
          workflowReason: leadCaptureWorkflow.key,
        });

        for (const pendingMessage of pendingFollowUps) {
          persistedWorkflowEvents.push(
            createMessageSuppressedEvent({
              workspaceId: pendingMessage.workspaceId,
              queuedEventId: pendingMessage.queuedEventId,
              contactId: pendingMessage.contactId,
              channel: pendingMessage.channel,
              reason: "lead.responded",
              suppressedAt: input.receivedAt,
            }),
          );
        }
      }
      continue;
    }

    if (event.name === "lead.qualified") {
      const leadQualified = await markLeadQualified({
        workspaceId: event.workspaceId,
        leadId: (event.payload as { leadId: string }).leadId,
      });

      if (leadQualified) {
        persistedWorkflowEvents.push(event);
        persistedWorkflowEvents.push(...handleDomainEvent(event));
      }
    }
  }

  if (persistedWorkflowEvents.length > 0) {
    await appendEvents(persistedWorkflowEvents);
  }

  sendJson(response, 201, {
    ok: true,
    contactId: contact.id,
    event: inboundEvent,
    workflowEvents: persistedWorkflowEvents,
  });
}

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(
      request.url ?? "/",
      `http://${request.headers.host ?? "localhost"}`,
    );

    if (request.method === "GET" && requestUrl.pathname === "/health") {
      sendJson(response, 200, { ok: true, service: "api" });
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/events") {
      const events = await getRecentEvents();
      sendJson(response, 200, { events });
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/delivery-status") {
      const deliveryStatus = await getDeliveryStatus();
      sendJson(response, 200, deliveryStatus);
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/reactivation/report") {
      const query = validateReactivationReportQuery(requestUrl);
      const report = await getReactivationOutcomeReport(query);
      sendJson(response, 200, report);
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/leads") {
      const body = await readJsonBody<LeadRequestBody>(request);
      const input = validateLeadInput(body);
      const leadResult = createLead(input);

      const saved = await saveLeadTransaction(leadResult);
      const followUpEvents = saved.events.flatMap(handleDomainEvent);

      if (followUpEvents.length > 0) {
        await appendEvents(followUpEvents);
      }

      sendJson(response, 201, {
        workspace: saved.workspace,
        contact: saved.contact,
        lead: saved.lead,
        events: saved.events,
        queuedEvents: followUpEvents,
      });
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/messages/inbound") {
      const body = await readJsonBody<InboundMessageBody>(request);
      const input = validateInboundMessageInput(body);
      await processInboundMessage(input, response);
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/reactivation/run") {
      const body = await readJsonBody<ReactivationRunBody>(request);
      const input = validateReactivationRunInput(body);
      const candidates = await getReactivationCandidates(input);
      const recentTargets = await getRecentQueuedMessagesForReason({
        workspaceId: input.workspaceId,
        reason: "reactivation.dormant-outreach",
        since: new Date(
          Date.now() - input.cooldownDays * 24 * 60 * 60 * 1000,
        ).toISOString(),
      });
      const recentlyTargetedContactIds = new Set(
        recentTargets
          .filter((target) => target.campaignKey === input.campaignKey)
          .map((target) => target.contactId),
      );
      const eligibleCandidates = candidates.filter(
        (candidate) => !recentlyTargetedContactIds.has(candidate.contactId),
      );
      const skippedCandidates = candidates.filter((candidate) =>
        recentlyTargetedContactIds.has(candidate.contactId),
      );
      const queuedEvents = buildReactivationOutreachEvents(eligibleCandidates, {
        campaignKey: input.campaignKey,
      });

      if (queuedEvents.length > 0) {
        await appendEvents(queuedEvents);
      }

      sendJson(response, 201, {
        ok: true,
        candidateCount: candidates.length,
        skippedCount: skippedCandidates.length,
        queuedCount: queuedEvents.length,
        campaignKey: input.campaignKey,
        cooldownDays: input.cooldownDays,
        candidates: eligibleCandidates,
        skippedCandidates,
      });
      return;
    }

    if (
      request.method === "POST" &&
      requestUrl.pathname === "/webhooks/twilio/messages"
    ) {
      const rawBody = await readTextBody(request);
      const formData = new URLSearchParams(rawBody);
      const workspaceId =
        requestUrl.searchParams.get("workspaceId")?.trim() ||
        "workspace_medspa_demo";
      const webhookUrl = `${getRequestBaseUrl(request)}${requestUrl.pathname}${requestUrl.search}`;
      const isValidSignature = validateTwilioWebhookRequest({
        signature: getHeaderValue(request, "x-twilio-signature"),
        url: webhookUrl,
        payload: formData,
      });

      if (!isValidSignature) {
        sendJson(response, 403, {
          error: "Invalid Twilio webhook signature.",
        });
        return;
      }

      const inboundMessage = parseTwilioInboundMessage({
        workspaceId,
        payload: formData,
      });

      await processInboundMessage(inboundMessage, response);
      return;
    }

    sendJson(response, 404, { error: "Not found." });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";
    sendJson(response, 400, { error: message });
  }
});

server.listen(port, () => {
  console.log(`[api] One System API listening on :${port}`);
});
