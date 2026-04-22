import "dotenv/config";

import {
  appendEvents,
  getPendingQueuedMessages,
  recordOutboundMessage,
} from "@one-system/database";
import { createMessageDeliveredEvent } from "@one-system/domain";
import { createMessageGateway } from "@one-system/integrations";

const pollIntervalMs = Number.parseInt(process.env.WORKER_POLL_MS ?? "5000", 10);
const gateway = createMessageGateway();
let isProcessing = false;

async function processQueuedMessages() {
  if (isProcessing) {
    return;
  }

  isProcessing = true;

  const queuedMessages = await getPendingQueuedMessages(20);

  try {
    for (const message of queuedMessages) {
      const delivery = await gateway.send(message);
      await recordOutboundMessage({
        queuedEventId: message.queuedEventId,
        workspaceId: message.workspaceId,
        contactId: message.contactId,
        channel: message.channel,
        provider: delivery.provider,
        destination: message.destination,
        body: message.body,
        deliveredAt: delivery.deliveredAt,
      });
      await appendEvents([
        createMessageDeliveredEvent({
          workspaceId: message.workspaceId,
          queuedEventId: message.queuedEventId,
          contactId: message.contactId,
          channel: message.channel,
          provider: delivery.provider,
        }),
      ]);

      console.log(
        `[worker] delivered ${message.channel} message for contact ${message.contactId} via ${delivery.provider}${message.deliverAfter ? ` (scheduled for ${message.deliverAfter})` : ""}`,
      );
    }
  } finally {
    isProcessing = false;
  }
}

async function start() {
  console.log(`[worker] polling for queued messages every ${pollIntervalMs}ms`);

  await processQueuedMessages();

  setInterval(() => {
    void processQueuedMessages().catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Unknown worker error";
      console.error(`[worker] ${message}`);
    });
  }, pollIntervalMs);
}

void start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  console.error(`[worker] ${message}`);
  process.exitCode = 1;
});
