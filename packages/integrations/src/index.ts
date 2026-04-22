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
  provider: "twilio" | "gohighlevel" | "hubspot" | "calcom";
  workspaceId: string;
  status: "connected" | "disconnected";
}

export interface TwilioInboundWebhookPayload {
  Body?: string;
  From?: string;
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
