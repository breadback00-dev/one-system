import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  appConfig,
  canValidateTwilioWebhooks,
  getMessageProvider,
  hasTwilioCredentials,
} from "@one-system/config";
import type {
  InboundMessage,
  MessageDeliveryResult,
  MessageGateway,
  QueuedMessage,
} from "@one-system/messaging";
import twilio from "twilio";

export interface IntegrationConnection {
  provider: "twilio" | "gohighlevel" | "hubspot" | "calcom" | "dev-crm";
  workspaceId: string;
  status: "connected" | "disconnected";
}

export type CrmDormantContactSegment = "stale_lead" | "past_customer";

export interface CrmDormantContactRecord {
  externalId: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  segment: CrmDormantContactSegment;
  lastActivityAt: string;
  sourceProvider: IntegrationConnection["provider"];
}

export interface CrmReactivationImportRow {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  segment: CrmDormantContactSegment;
  lastActivityAt: string;
}

export interface CrmSyncResult {
  provider: IntegrationConnection["provider"];
  workspaceId: string;
  records: CrmDormantContactRecord[];
  importRows: CrmReactivationImportRow[];
}

export interface CrmDormantContactSyncAdapter {
  readonly provider: IntegrationConnection["provider"];
  syncDormantContacts(args: {
    workspaceId: string;
    inactiveSince: string;
    limit?: number;
  }): Promise<CrmSyncResult>;
}

export interface TwilioInboundWebhookPayload {
  Body?: string;
  From?: string;
}

export function mapCrmRecordToReactivationImportRow(
  record: CrmDormantContactRecord,
): CrmReactivationImportRow {
  return {
    firstName: record.firstName,
    segment: record.segment,
    lastActivityAt: record.lastActivityAt,
    ...(record.lastName ? { lastName: record.lastName } : {}),
    ...(record.email ? { email: record.email } : {}),
    ...(record.phone ? { phone: record.phone } : {}),
  };
}

export class StaticCrmDormantContactSyncAdapter
  implements CrmDormantContactSyncAdapter
{
  readonly provider = "dev-crm";

  constructor(private readonly records: CrmDormantContactRecord[]) {}

  async syncDormantContacts(args: {
    workspaceId: string;
    inactiveSince: string;
    limit?: number;
  }): Promise<CrmSyncResult> {
    const inactiveSince = new Date(args.inactiveSince);
    const records = this.records
      .filter(
        (record) =>
          record.sourceProvider === this.provider &&
          new Date(record.lastActivityAt) <= inactiveSince,
      )
      .slice(0, args.limit ?? 100);

    return {
      provider: this.provider,
      workspaceId: args.workspaceId,
      records,
      importRows: records.map(mapCrmRecordToReactivationImportRow),
    };
  }
}

export function validateTwilioWebhookRequest(args: {
  signature?: string | undefined;
  url: string;
  payload: URLSearchParams | TwilioInboundWebhookPayload;
}): boolean {
  if (!canValidateTwilioWebhooks()) {
    return true;
  }

  const signature = args.signature?.trim();
  if (!signature) {
    return false;
  }

  const params =
    args.payload instanceof URLSearchParams
      ? Object.fromEntries(args.payload.entries())
      : Object.fromEntries(
          Object.entries(args.payload).filter((entry): entry is [string, string] =>
            typeof entry[1] === "string",
          ),
        );

  return twilio.validateRequest(
    appConfig.twilio.authToken ?? "",
    signature,
    args.url,
    params,
  );
}

function readTrimmedField(
  source: URLSearchParams | TwilioInboundWebhookPayload,
  key: keyof TwilioInboundWebhookPayload,
): string | undefined {
  const value =
    source instanceof URLSearchParams ? source.get(key) ?? undefined : source[key];

  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function parseTwilioInboundMessage(args: {
  workspaceId: string;
  payload: URLSearchParams | TwilioInboundWebhookPayload;
}): InboundMessage {
  const from = readTrimmedField(args.payload, "From");
  const body = readTrimmedField(args.payload, "Body");

  if (!from) {
    throw new Error("Twilio inbound webhook is missing `From`.");
  }

  if (!body) {
    throw new Error("Twilio inbound webhook is missing `Body`.");
  }

  return {
    workspaceId: args.workspaceId,
    channel: "sms",
    provider: "twilio",
    from,
    body,
    receivedAt: new Date().toISOString(),
  };
}

export class DevMessageGateway implements MessageGateway {
  readonly provider = "dev-log";

  async send(message: QueuedMessage): Promise<MessageDeliveryResult> {
    const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
    const deliveriesPath = path.resolve(
      repoRoot,
      "data",
      "exports",
      "message-deliveries.log",
    );

    await mkdir(path.dirname(deliveriesPath), { recursive: true });
    await appendFile(
      deliveriesPath,
      `${JSON.stringify({
        queuedEventId: message.queuedEventId,
        workspaceId: message.workspaceId,
        contactId: message.contactId,
        channel: message.channel,
        destination: message.destination,
        body: message.body,
        reason: message.reason,
        deliveredAt: new Date().toISOString(),
        provider: this.provider,
      })}\n`,
      "utf8",
    );

    return {
      provider: this.provider,
      deliveredAt: new Date().toISOString(),
    };
  }
}

export class TwilioMessageGateway implements MessageGateway {
  readonly provider = "twilio";

  private readonly client = twilio(
    appConfig.twilio.accountSid ?? "",
    appConfig.twilio.authToken ?? "",
  );

  async send(message: QueuedMessage): Promise<MessageDeliveryResult> {
    if (message.channel !== "sms") {
      throw new Error("Twilio gateway currently supports SMS delivery only.");
    }

    await this.client.messages.create({
      body: message.body,
      from: appConfig.twilio.fromNumber ?? "",
      to: message.destination,
    });

    return {
      provider: this.provider,
      deliveredAt: new Date().toISOString(),
    };
  }
}

export function createMessageGateway(): MessageGateway {
  const selectedProvider = getMessageProvider();

  if (selectedProvider === "twilio") {
    if (!hasTwilioCredentials()) {
      throw new Error(
        "MESSAGE_PROVIDER is set to twilio, but Twilio credentials are incomplete.",
      );
    }

    return new TwilioMessageGateway();
  }

  return new DevMessageGateway();
}
