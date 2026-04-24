import "dotenv/config";

import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { timingSafeEqual } from "node:crypto";
import { URL, pathToFileURL } from "node:url";

import {
  appendEvents,
  findContactByAddress,
  getDeliveryStatus,
  getMostRecentLeadForContact,
  getPaidAdsOutcomeReport,
  getPendingWorkflowMessagesForContact,
  getReactivationOutcomeReport,
  getReviewReferralOutcomeReport,
  getRecentEvents,
  getSalesEnablementReport,
  importReactivationContacts,
  markLeadQualified,
  markLeadResponded,
  recordPaidAdsSpend,
  recordInboundMessage,
  saveAppointmentTransaction,
  saveLeadTransaction,
  type ReactivationAudienceSegment,
  type ReactivationImportRow,
  type ReactivationImportSkippedRow,
} from "@one-system/database";
import {
  createAppointment,
  createMessageSuppressedEvent,
  type ConsultationTranscriptSource,
  createLead,
  createMessageInboundReceivedEvent,
  type Appointment,
  type CreateLeadInput,
  type DomainEvent,
  type MessageInboundReceivedPayload,
} from "@one-system/domain";
import type { InboundMessage } from "@one-system/messaging";
import { appConfig, getOperatorApiKey } from "@one-system/config";
import {
  executePaidAdsRun,
  previewPaidAdsRun,
} from "@one-system/paid-ads";
import {
  executeReactivationRun,
  previewReactivationRun,
} from "@one-system/reactivation";
import {
  createReviewResponseDraft,
  executeReviewsReferralsRun,
  previewReviewsReferralsRun,
  routeReviewsReferralsReply,
  triggerPostVisitReviewRequest,
} from "@one-system/reviews-referrals";
import {
  ingestConsultationTranscript,
  MAX_CONSULTATION_EXTERNAL_ID_LENGTH,
  MAX_CONSULTATION_TRANSCRIPT_TEXT_LENGTH,
  syncConsultationTranscripts,
} from "@one-system/sales-enablement";
import {
  parseTwilioInboundMessage,
  type SalesConsultationTranscriptRecord,
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
  attribution?: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
  };
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
  audienceSegment?: ReactivationAudienceSegment;
}

interface ReviewsReferralsRunBody {
  workspaceId?: string;
  completedDaysAgo?: number;
  limit?: number;
  cooldownDays?: number;
  campaignKey?: string;
}

interface ReviewsReferralsResponseDraftBody {
  workspaceId?: string;
  customerMessage?: string;
  customerFirstName?: string;
}

interface PaidAdsRunBody {
  workspaceId?: string;
  limit?: number;
  cooldownDays?: number;
  campaignKey?: string;
}

interface PaidAdsSpendBody {
  workspaceId?: string;
  reportDate?: string;
  source?: string;
  utmSource?: string;
  utmCampaign?: string;
  amount?: number;
  currency?: string;
}

interface SalesEnablementTranscriptBody {
  workspaceId?: string;
  appointmentId?: string;
  source?: string;
  transcriptText?: string;
  agentName?: string;
}

interface SalesEnablementSyncBody {
  workspaceId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  records?: unknown;
}

interface AppointmentRequestBody {
  workspaceId?: string;
  contactId?: string;
  leadId?: string;
  startsAt?: string;
  outcome?: Appointment["outcome"];
}

interface ReactivationReportQuery {
  workspaceId: string;
  campaignKey?: string;
  runId?: string;
  limit: number;
}

interface ReviewsReferralsReportQuery {
  workspaceId: string;
  campaignKey?: string;
  runId?: string;
  limit: number;
}

interface PaidAdsReportQuery {
  workspaceId: string;
  campaignKey?: string;
  runId?: string;
  limit: number;
}

interface SalesEnablementReportQuery {
  workspaceId: string;
  limit: number;
}

interface SalesEnablementSyncInput {
  workspaceId: string;
  dateFrom: string;
  dateTo: string;
  limit: number;
  records: SalesConsultationTranscriptRecord[];
}

function validateSalesTranscriptSource(
  value: string | undefined,
): ConsultationTranscriptSource {
  const source = value?.trim().toLowerCase() || "manual";

  if (
    source === "manual" ||
    source === "dev_capture" ||
    source === "callrail" ||
    source === "aircall" ||
    source === "twilio_voice"
  ) {
    return source;
  }

  badRequest(
    "`source` must be one of manual, dev_capture, callrail, aircall, or twilio_voice.",
  );
}

const reactivationImportHeaders = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "segment",
  "lastActivityAt",
] as const;

const port = Number.parseInt(process.env.PORT ?? "4000", 10);
const configuredMaxRequestBodyBytes = Number.parseInt(
  process.env.MAX_REQUEST_BODY_BYTES ?? "1048576",
  10,
);
const maxRequestBodyBytes =
  Number.isFinite(configuredMaxRequestBodyBytes) &&
  configuredMaxRequestBodyBytes > 0
    ? configuredMaxRequestBodyBytes
    : 1_048_576;

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

function badRequest(message: string): never {
  throw new HttpError(400, message);
}

function isDatabaseUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  return code === "P1001" || error.message.includes("Can't reach database server");
}

function isKnownClientError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.trim();
  return (
    message === "`appointmentId` does not match an existing appointment." ||
    message === "Twilio inbound webhook is missing `From`." ||
    message === "Twilio inbound webhook is missing `Body`." ||
    message === "Transcript already imported for this source/externalId." ||
    message.startsWith("Campaign key must start with") ||
    message.startsWith("Reactivation queue item") ||
    message.startsWith("Queue item is not")
  );
}

function getErrorResponse(error: unknown): {
  statusCode: number;
  payload: { error: string };
} {
  if (error instanceof HttpError) {
    return {
      statusCode: error.statusCode,
      payload: { error: error.message },
    };
  }

  if (error instanceof SyntaxError) {
    return {
      statusCode: 400,
      payload: { error: "Request body must be valid JSON." },
    };
  }

  if (isKnownClientError(error)) {
    return {
      statusCode: 400,
      payload: { error: (error as Error).message },
    };
  }

  if (isDatabaseUnavailable(error)) {
    return {
      statusCode: 503,
      payload: { error: "Database unavailable. Retry after the database is reachable." },
    };
  }

  console.error("[api] unexpected request error", error);
  return {
    statusCode: 500,
    payload: { error: "Unexpected server error." },
  };
}

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
  let receivedBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    receivedBytes += buffer.byteLength;

    if (receivedBytes > maxRequestBodyBytes) {
      throw new HttpError(
        413,
        `Request body exceeds the ${maxRequestBodyBytes} byte limit.`,
      );
    }

    chunks.push(buffer);
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

function getBearerToken(value: string | undefined): string | undefined {
  const prefix = "Bearer ";
  if (!value?.startsWith(prefix)) {
    return undefined;
  }

  return value.slice(prefix.length).trim();
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function isProtectedApiRequest(method: string | undefined, pathname: string) {
  if (method === "GET" && pathname === "/health") {
    return false;
  }

  if (method === "POST" && pathname === "/webhooks/twilio/messages") {
    return false;
  }

  if (method === "GET") {
    return [
      "/events",
      "/delivery-status",
      "/reactivation/report",
      "/reviews-referrals/report",
      "/paid-ads/report",
      "/sales-enablement/report",
      "/reactivation/readiness",
      "/reviews-referrals/readiness",
      "/paid-ads/readiness",
    ].includes(pathname);
  }

  return method === "POST";
}

function assertAuthorizedApiRequest(
  request: IncomingMessage,
  requestUrl: URL,
) {
  if (!isProtectedApiRequest(request.method, requestUrl.pathname)) {
    return;
  }

  const configuredApiKey = getOperatorApiKey()?.trim();
  if (!configuredApiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new HttpError(
        503,
        "Operator API auth is not configured. Set ONE_SYSTEM_API_KEY before enabling protected routes.",
      );
    }

    return;
  }

  const providedApiKey =
    getBearerToken(getHeaderValue(request, "authorization")) ||
    getHeaderValue(request, "x-one-system-api-key")?.trim();

  if (
    !providedApiKey ||
    !constantTimeEqual(providedApiKey, configuredApiKey)
  ) {
    throw new HttpError(401, "Missing or invalid operator API credentials.");
  }
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
  const attribution = {
    ...(body.attribution?.utmSource?.trim()
      ? { utmSource: body.attribution.utmSource.trim() }
      : {}),
    ...(body.attribution?.utmMedium?.trim()
      ? { utmMedium: body.attribution.utmMedium.trim() }
      : {}),
    ...(body.attribution?.utmCampaign?.trim()
      ? { utmCampaign: body.attribution.utmCampaign.trim() }
      : {}),
    ...(body.attribution?.utmTerm?.trim()
      ? { utmTerm: body.attribution.utmTerm.trim() }
      : {}),
    ...(body.attribution?.utmContent?.trim()
      ? { utmContent: body.attribution.utmContent.trim() }
      : {}),
  };

  if (!source) {
    badRequest("`source` is required.");
  }

  if (!firstName) {
    badRequest("`firstName` is required.");
  }

  if (!email && !phone) {
    badRequest("At least one of `email` or `phone` is required.");
  }

  return {
    workspaceId,
    source,
    firstName,
    ...(body.lastName?.trim() ? { lastName: body.lastName.trim() } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(Object.keys(attribution).length > 0 ? { attribution } : {}),
  };
}

function validateInboundMessageInput(body: InboundMessageBody) {
  const workspaceId = body.workspaceId?.trim() || "workspace_medspa_demo";
  const channel = body.channel;
  const from = body.from?.trim();
  const messageBody = body.body?.trim();
  const provider = body.provider?.trim() || "dev-log";

  if (!channel) {
    badRequest("`channel` is required.");
  }

  if (!from) {
    badRequest("`from` is required.");
  }

  if (!messageBody) {
    badRequest("`body` is required.");
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

function validateReactivationAudienceSegment(
  value: string | null | undefined,
): ReactivationAudienceSegment {
  if (!value || value === "all") {
    return "all";
  }

  if (value === "stale_leads" || value === "past_customers") {
    return value;
  }

  badRequest("`audienceSegment` must be one of all, stale_leads, or past_customers.");
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
  const audienceSegment = validateReactivationAudienceSegment(
    body.audienceSegment,
  );

  return {
    workspaceId,
    inactiveDays,
    limit,
    cooldownDays,
    campaignKey,
    audienceSegment,
  };
}

function validateReviewsReferralsRunInput(body: ReviewsReferralsRunBody) {
  const workspaceId = body.workspaceId?.trim() || "workspace_medspa_demo";
  const completedDaysAgo = Number.isFinite(body.completedDaysAgo)
    ? Math.max(1, Math.min(120, Math.floor(body.completedDaysAgo as number)))
    : 2;
  const limit = Number.isFinite(body.limit)
    ? Math.max(1, Math.min(100, Math.floor(body.limit as number)))
    : 25;
  const cooldownDays = Number.isFinite(body.cooldownDays)
    ? Math.max(1, Math.min(90, Math.floor(body.cooldownDays as number)))
    : 14;
  const campaignKey =
    body.campaignKey?.trim() || "reviews-referrals-default";

  return {
    workspaceId,
    completedDaysAgo,
    limit,
    cooldownDays,
    campaignKey,
  };
}

function validatePaidAdsRunInput(body: PaidAdsRunBody) {
  const workspaceId = body.workspaceId?.trim() || "workspace_medspa_demo";
  const limit = Number.isFinite(body.limit)
    ? Math.max(1, Math.min(200, Math.floor(body.limit as number)))
    : 25;
  const cooldownDays = Number.isFinite(body.cooldownDays)
    ? Math.max(1, Math.min(90, Math.floor(body.cooldownDays as number)))
    : 14;
  const campaignKey = body.campaignKey?.trim() || "paid-ads-default";

  return {
    workspaceId,
    limit,
    cooldownDays,
    campaignKey,
  };
}

function validateReviewsReferralsResponseDraftInput(
  body: ReviewsReferralsResponseDraftBody,
) {
  const workspaceId = body.workspaceId?.trim() || "workspace_medspa_demo";
  const customerMessage = body.customerMessage?.trim();

  if (!customerMessage) {
    badRequest("`customerMessage` is required.");
  }

  return {
    workspaceId,
    customerMessage,
    ...(body.customerFirstName?.trim()
      ? { customerFirstName: body.customerFirstName.trim() }
      : {}),
  };
}

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const nextChar = input[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      field += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field.trim());
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(field.trim());
      field = "";
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    field += char;
  }

  row.push(field.trim());
  if (row.some((value) => value.length > 0)) {
    rows.push(row);
  }

  if (inQuotes) {
    badRequest("CSV contains an unterminated quoted field.");
  }

  return rows;
}

function parseReactivationImportCsv(input: string): {
  rows: ReactivationImportRow[];
  skippedRows: ReactivationImportSkippedRow[];
} {
  const [headerRow, ...dataRows] = parseCsvRows(input);

  if (!headerRow) {
    badRequest("CSV import requires a header row.");
  }

  const headerIndexes = new Map(headerRow.map((header, index) => [header, index]));
  const missingHeaders = reactivationImportHeaders.filter(
    (header) => !headerIndexes.has(header),
  );

  if (missingHeaders.length > 0) {
    badRequest(`CSV import is missing headers: ${missingHeaders.join(", ")}.`);
  }

  const rows: ReactivationImportRow[] = [];
  const skippedRows: ReactivationImportSkippedRow[] = [];

  dataRows.forEach((row, rowIndex) => {
    const getValue = (header: (typeof reactivationImportHeaders)[number]) =>
      row[headerIndexes.get(header)!]?.trim() ?? "";
    const firstName = getValue("firstName");
    const lastName = getValue("lastName");
    const email = getValue("email");
    const phone = getValue("phone");
    const segment = getValue("segment");
    const lastActivityAt = getValue("lastActivityAt");
    const rowNumber = rowIndex + 2;

    if (!firstName) {
      skippedRows.push({ rowNumber, reason: "Missing firstName." });
      return;
    }

    if (!email && !phone) {
      skippedRows.push({ rowNumber, reason: "Missing email or phone." });
      return;
    }

    if (segment !== "stale_lead" && segment !== "past_customer") {
      skippedRows.push({
        rowNumber,
        reason: "Segment must be stale_lead or past_customer.",
      });
      return;
    }

    if (!lastActivityAt || Number.isNaN(new Date(lastActivityAt).getTime())) {
      skippedRows.push({ rowNumber, reason: "Invalid lastActivityAt." });
      return;
    }

    rows.push({
      firstName,
      segment,
      lastActivityAt: new Date(lastActivityAt).toISOString(),
      rowNumber,
      ...(lastName ? { lastName } : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
    });
  });

  return { rows, skippedRows };
}

function validateReactivationReadinessQuery(requestUrl: URL) {
  const inactiveDays = Number.parseInt(
    requestUrl.searchParams.get("inactiveDays") ?? "30",
    10,
  );
  const limit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "25", 10);
  const cooldownDays = Number.parseInt(
    requestUrl.searchParams.get("cooldownDays") ?? "14",
    10,
  );

  return {
    workspaceId:
      requestUrl.searchParams.get("workspaceId")?.trim() ||
      "workspace_medspa_demo",
    inactiveDays: Number.isFinite(inactiveDays)
      ? Math.max(7, Math.floor(inactiveDays))
      : 30,
    limit: Number.isFinite(limit)
      ? Math.max(1, Math.min(100, Math.floor(limit)))
      : 25,
    cooldownDays: Number.isFinite(cooldownDays)
      ? Math.max(1, Math.min(90, Math.floor(cooldownDays)))
      : 14,
    campaignKey:
      requestUrl.searchParams.get("campaignKey")?.trim() ||
      "reactivation-default",
    audienceSegment: validateReactivationAudienceSegment(
      requestUrl.searchParams.get("audienceSegment"),
    ),
  };
}

function validateReviewsReferralsReadinessQuery(requestUrl: URL) {
  const completedDaysAgo = Number.parseInt(
    requestUrl.searchParams.get("completedDaysAgo") ?? "2",
    10,
  );
  const limit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "25", 10);
  const cooldownDays = Number.parseInt(
    requestUrl.searchParams.get("cooldownDays") ?? "14",
    10,
  );

  return {
    workspaceId:
      requestUrl.searchParams.get("workspaceId")?.trim() ||
      "workspace_medspa_demo",
    completedDaysAgo: Number.isFinite(completedDaysAgo)
      ? Math.max(1, Math.min(120, Math.floor(completedDaysAgo)))
      : 2,
    limit: Number.isFinite(limit)
      ? Math.max(1, Math.min(100, Math.floor(limit)))
      : 25,
    cooldownDays: Number.isFinite(cooldownDays)
      ? Math.max(1, Math.min(90, Math.floor(cooldownDays)))
      : 14,
    campaignKey:
      requestUrl.searchParams.get("campaignKey")?.trim() ||
      "reviews-referrals-default",
  };
}

function validatePaidAdsReadinessQuery(requestUrl: URL) {
  const limit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "25", 10);
  const cooldownDays = Number.parseInt(
    requestUrl.searchParams.get("cooldownDays") ?? "14",
    10,
  );

  return {
    workspaceId:
      requestUrl.searchParams.get("workspaceId")?.trim() ||
      "workspace_medspa_demo",
    limit: Number.isFinite(limit)
      ? Math.max(1, Math.min(200, Math.floor(limit)))
      : 25,
    cooldownDays: Number.isFinite(cooldownDays)
      ? Math.max(1, Math.min(90, Math.floor(cooldownDays)))
      : 14,
    campaignKey:
      requestUrl.searchParams.get("campaignKey")?.trim() ||
      "paid-ads-default",
  };
}

function validateAppointmentInput(body: AppointmentRequestBody) {
  const workspaceId = body.workspaceId?.trim() || "workspace_medspa_demo";
  const contactId = body.contactId?.trim();
  const leadId = body.leadId?.trim() || undefined;
  const startsAt = body.startsAt?.trim();
  const outcome = body.outcome;

  if (!contactId) {
    badRequest("`contactId` is required.");
  }

  if (!startsAt) {
    badRequest("`startsAt` is required.");
  }

  if (Number.isNaN(new Date(startsAt).getTime())) {
    badRequest("`startsAt` must be a valid ISO datetime.");
  }

  if (
    outcome &&
    !["scheduled", "completed", "cancelled", "no_show"].includes(outcome)
  ) {
    badRequest("`outcome` must be one of scheduled, completed, cancelled, or no_show.");
  }

  return {
    workspaceId,
    contactId,
    ...(leadId ? { leadId } : {}),
    startsAt,
    ...(outcome ? { outcome } : {}),
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

function validateReviewsReferralsReportQuery(
  requestUrl: URL,
): ReviewsReferralsReportQuery {
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

function validatePaidAdsReportQuery(requestUrl: URL): PaidAdsReportQuery {
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

function validatePaidAdsSpendInput(body: PaidAdsSpendBody) {
  const workspaceId = body.workspaceId?.trim() || "workspace_medspa_demo";
  const reportDate = body.reportDate?.trim() || new Date().toISOString();
  const parsedReportDate = new Date(reportDate);
  const source = body.source?.trim();
  const amount = Number(body.amount);
  const currency = (body.currency?.trim() || "USD").toUpperCase();

  if (!source) {
    badRequest("`source` is required.");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    badRequest("`amount` must be a positive number.");
  }

  if (Number.isNaN(parsedReportDate.getTime())) {
    badRequest("`reportDate` must be a valid ISO date.");
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    badRequest("`currency` must be a 3-letter ISO code.");
  }

  return {
    workspaceId,
    reportDate: parsedReportDate.toISOString(),
    source,
    ...(body.utmSource?.trim() ? { utmSource: body.utmSource.trim() } : {}),
    ...(body.utmCampaign?.trim() ? { utmCampaign: body.utmCampaign.trim() } : {}),
    amount,
    currency,
  };
}

function validateSalesEnablementTranscriptInput(
  body: SalesEnablementTranscriptBody,
) {
  const workspaceId = body.workspaceId?.trim() || "workspace_medspa_demo";
  const appointmentId = body.appointmentId?.trim();
  const source = validateSalesTranscriptSource(body.source);
  const transcriptText = body.transcriptText?.trim();
  const agentName = body.agentName?.trim();

  if (!appointmentId) {
    badRequest("`appointmentId` is required.");
  }

  if (!transcriptText) {
    badRequest("`transcriptText` is required.");
  }

  if (transcriptText.length > MAX_CONSULTATION_TRANSCRIPT_TEXT_LENGTH) {
    badRequest(
      `\`transcriptText\` must be ${MAX_CONSULTATION_TRANSCRIPT_TEXT_LENGTH} characters or fewer.`,
    );
  }

  return {
    workspaceId,
    appointmentId,
    source,
    transcriptText,
    ...(agentName ? { agentName: agentName.slice(0, 80) } : {}),
  };
}

function validateSalesEnablementReportQuery(
  requestUrl: URL,
): SalesEnablementReportQuery {
  const workspaceId =
    requestUrl.searchParams.get("workspaceId")?.trim() || "workspace_medspa_demo";
  const limitParam = requestUrl.searchParams.get("limit");
  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : Number.NaN;
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(100, parsedLimit))
    : 25;

  return {
    workspaceId,
    limit,
  };
}

function validateSalesEnablementSyncInput(
  body: SalesEnablementSyncBody,
): SalesEnablementSyncInput {
  const workspaceId = body.workspaceId?.trim() || "workspace_medspa_demo";
  const now = new Date();
  const defaultDateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const dateFrom = body.dateFrom?.trim()
    ? new Date(body.dateFrom)
    : defaultDateFrom;
  const dateTo = body.dateTo?.trim() ? new Date(body.dateTo) : now;
  const limit = Number.isFinite(body.limit)
    ? Math.max(1, Math.min(250, Math.floor(body.limit as number)))
    : 100;

  if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
    badRequest("`dateFrom` and `dateTo` must be valid ISO datetimes.");
  }

  if (dateFrom > dateTo) {
    badRequest("`dateFrom` cannot be after `dateTo`.");
  }

  if (!Array.isArray(body.records) || body.records.length === 0) {
    badRequest("`records` must be a non-empty array.");
  }

  const records = body.records.map((record, index) => {
    if (!record || typeof record !== "object") {
      badRequest(`records[${index}] must be an object.`);
    }

    const payload = record as Record<string, unknown>;
    const externalId = String(payload.externalId ?? "").trim();
    const occurredAt = new Date(String(payload.occurredAt ?? "").trim());
    const transcriptText = String(payload.transcriptText ?? "").trim();
    const sourceProvider = validateSalesTranscriptSource(
      typeof payload.sourceProvider === "string"
        ? payload.sourceProvider
        : undefined,
    );
    const appointmentExternalId = String(
      payload.appointmentExternalId ?? payload.appointmentId ?? "",
    ).trim();
    const agentName = String(payload.agentName ?? "").trim();

    if (!externalId) {
      badRequest(`records[${index}].externalId is required.`);
    }

    if (externalId.length > MAX_CONSULTATION_EXTERNAL_ID_LENGTH) {
      badRequest(
        `records[${index}].externalId must be ${MAX_CONSULTATION_EXTERNAL_ID_LENGTH} characters or fewer.`,
      );
    }

    if (Number.isNaN(occurredAt.getTime())) {
      badRequest(`records[${index}].occurredAt must be a valid datetime.`);
    }

    if (!transcriptText) {
      badRequest(`records[${index}].transcriptText is required.`);
    }

    if (transcriptText.length > MAX_CONSULTATION_TRANSCRIPT_TEXT_LENGTH) {
      badRequest(
        `records[${index}].transcriptText must be ${MAX_CONSULTATION_TRANSCRIPT_TEXT_LENGTH} characters or fewer.`,
      );
    }

    return {
      externalId,
      occurredAt: occurredAt.toISOString(),
      transcriptText,
      sourceProvider,
      ...(appointmentExternalId ? { appointmentExternalId } : {}),
      ...(payload.contactExternalId
        ? { contactExternalId: String(payload.contactExternalId).trim() }
        : {}),
      ...(payload.leadExternalId
        ? { leadExternalId: String(payload.leadExternalId).trim() }
        : {}),
      ...(agentName ? { agentName: agentName.slice(0, 80) } : {}),
    } satisfies SalesConsultationTranscriptRecord;
  });

  return {
    workspaceId,
    dateFrom: dateFrom.toISOString(),
    dateTo: dateTo.toISOString(),
    limit,
    records,
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

  let reviewsReferralsRouting:
    | Awaited<ReturnType<typeof routeReviewsReferralsReply>>
    | undefined;
  let reviewsReferralsRoutingError: string | undefined;

  try {
    reviewsReferralsRouting = await routeReviewsReferralsReply({
      workspaceId: input.workspaceId,
      contactId: contact.id,
      channel: input.channel,
      destination: input.from,
      messageBody: input.body,
      receivedAt: input.receivedAt,
    });
  } catch (error) {
    reviewsReferralsRoutingError =
      error instanceof Error
        ? error.message
        : "Unable to process reviews/referrals feedback routing.";
  }

  sendJson(response, 201, {
    ok: true,
    contactId: contact.id,
    event: inboundEvent,
    workflowEvents: persistedWorkflowEvents,
    ...(reviewsReferralsRouting ? { reviewsReferralsRouting } : {}),
    ...(reviewsReferralsRoutingError ? { reviewsReferralsRoutingError } : {}),
  });
}

export function createApiServer(): Server {
  return createServer(async (request, response) => {
    try {
      const requestUrl = new URL(
        request.url ?? "/",
        `http://${request.headers.host ?? "localhost"}`,
      );
      assertAuthorizedApiRequest(request, requestUrl);

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

    if (
      request.method === "GET" &&
      requestUrl.pathname === "/reviews-referrals/report"
    ) {
      const query = validateReviewsReferralsReportQuery(requestUrl);
      const report = await getReviewReferralOutcomeReport(query);
      sendJson(response, 200, report);
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/paid-ads/report") {
      const query = validatePaidAdsReportQuery(requestUrl);
      const report = await getPaidAdsOutcomeReport(query);
      sendJson(response, 200, report);
      return;
    }

    if (
      request.method === "GET" &&
      requestUrl.pathname === "/sales-enablement/report"
    ) {
      const query = validateSalesEnablementReportQuery(requestUrl);
      const report = await getSalesEnablementReport(query);
      sendJson(response, 200, report);
      return;
    }

    if (
      request.method === "GET" &&
      requestUrl.pathname === "/reactivation/readiness"
    ) {
      const query = validateReactivationReadinessQuery(requestUrl);
      const readiness = await previewReactivationRun(query);
      sendJson(response, 200, readiness);
      return;
    }

    if (
      request.method === "GET" &&
      requestUrl.pathname === "/reviews-referrals/readiness"
    ) {
      const query = validateReviewsReferralsReadinessQuery(requestUrl);
      const readiness = await previewReviewsReferralsRun(query);
      sendJson(response, 200, readiness);
      return;
    }

    if (
      request.method === "GET" &&
      requestUrl.pathname === "/paid-ads/readiness"
    ) {
      const query = validatePaidAdsReadinessQuery(requestUrl);
      const readiness = await previewPaidAdsRun(query);
      sendJson(response, 200, readiness);
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

    if (request.method === "POST" && requestUrl.pathname === "/appointments") {
      const body = await readJsonBody<AppointmentRequestBody>(request);
      const input = validateAppointmentInput(body);
      const appointmentResult = createAppointment(input);
      const saved = await saveAppointmentTransaction(appointmentResult);
      let reviewsReferralsTrigger:
        | Awaited<ReturnType<typeof triggerPostVisitReviewRequest>>
        | undefined;
      let reviewsReferralsTriggerError: string | undefined;

      if (saved.appointment.outcome === "completed") {
        try {
          reviewsReferralsTrigger = await triggerPostVisitReviewRequest({
            workspaceId: saved.appointment.workspaceId,
            appointmentId: saved.appointment.id,
          });
        } catch (error) {
          reviewsReferralsTriggerError =
            error instanceof Error
              ? error.message
              : "Unable to queue post-visit review request.";
        }
      }

      sendJson(response, 201, {
        workspace: saved.workspace,
        appointment: {
          ...saved.appointment,
          startsAt: saved.appointment.startsAt.toISOString(),
        },
        events: saved.events,
        ...(reviewsReferralsTrigger
          ? { reviewsReferralsTrigger }
          : {}),
        ...(reviewsReferralsTriggerError
          ? { reviewsReferralsTriggerError }
          : {}),
      });
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/messages/inbound") {
      const body = await readJsonBody<InboundMessageBody>(request);
      const input = validateInboundMessageInput(body);
      await processInboundMessage(input, response);
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/reactivation/import") {
      const csv = await readTextBody(request);
      const { rows, skippedRows } = parseReactivationImportCsv(csv);
      const result = await importReactivationContacts({
        workspaceId:
          requestUrl.searchParams.get("workspaceId")?.trim() ||
          "workspace_medspa_demo",
        rows,
        dryRun: requestUrl.searchParams.get("dryRun") === "true",
        skippedRows,
      });
      sendJson(response, 201, result);
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/reactivation/run") {
      const body = await readJsonBody<ReactivationRunBody>(request);
      const input = validateReactivationRunInput(body);
      const result = await executeReactivationRun(input);
      sendJson(response, 201, result);
      return;
    }

    if (
      request.method === "POST" &&
      requestUrl.pathname === "/reviews-referrals/run"
    ) {
      const body = await readJsonBody<ReviewsReferralsRunBody>(request);
      const input = validateReviewsReferralsRunInput(body);
      const result = await executeReviewsReferralsRun(input);
      sendJson(response, 201, result);
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/paid-ads/run") {
      const body = await readJsonBody<PaidAdsRunBody>(request);
      const input = validatePaidAdsRunInput(body);
      const result = await executePaidAdsRun(input);
      sendJson(response, 201, result);
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/paid-ads/spend") {
      const body = await readJsonBody<PaidAdsSpendBody>(request);
      const input = validatePaidAdsSpendInput(body);
      const result = await recordPaidAdsSpend(input);
      sendJson(response, 201, result);
      return;
    }

    if (
      request.method === "POST" &&
      requestUrl.pathname === "/sales-enablement/transcripts"
    ) {
      const body = await readJsonBody<SalesEnablementTranscriptBody>(request);
      const input = validateSalesEnablementTranscriptInput(body);
      const result = await ingestConsultationTranscript(input);
      sendJson(response, 201, result);
      return;
    }

    if (
      request.method === "POST" &&
      requestUrl.pathname === "/sales-enablement/sync"
    ) {
      const body = await readJsonBody<SalesEnablementSyncBody>(request);
      const input = validateSalesEnablementSyncInput(body);
      const result = await syncConsultationTranscripts(input);
      sendJson(response, 201, result);
      return;
    }

    if (
      request.method === "POST" &&
      requestUrl.pathname === "/reviews-referrals/response-draft"
    ) {
      const body = await readJsonBody<ReviewsReferralsResponseDraftBody>(request);
      const input = validateReviewsReferralsResponseDraftInput(body);
      const draft = createReviewResponseDraft(input);
      sendJson(response, 201, draft);
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
      const errorResponse = getErrorResponse(error);
      sendJson(response, errorResponse.statusCode, errorResponse.payload);
    }
  });
}

function isMainModule() {
  if (!process.argv[1]) {
    return false;
  }

  return import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  const server = createApiServer();
  server.listen(port, () => {
    console.log(`[api] One System API listening on :${port}`);
  });
}
