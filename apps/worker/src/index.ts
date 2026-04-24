import "dotenv/config";

import {
  claimQueuedMessageDelivery,
  enforceSensitiveDataRetentionPolicy,
  getPendingQueuedMessages,
  markQueuedMessageDeliveryFailed,
  recordOutboundMessageDelivery,
} from "@one-system/database";
import { getSensitiveDataRetentionSweepMs } from "@one-system/config";
import { createMessageDeliveredEvent } from "@one-system/domain";
import { createMessageGateway } from "@one-system/integrations";

const pollIntervalMs = Number.parseInt(process.env.WORKER_POLL_MS ?? "5000", 10);
const retentionSweepMs = getSensitiveDataRetentionSweepMs();
const gateway = createMessageGateway();
let isProcessing = false;
let isRetentionSweepRunning = false;

async function processQueuedMessages() {
  if (isProcessing) {
    return;
  }

  isProcessing = true;

  try {
    const queuedMessages = await getPendingQueuedMessages(20);

    for (const message of queuedMessages) {
      const claimed = await claimQueuedMessageDelivery(message);
      if (!claimed) {
        continue;
      }

      let delivery: Awaited<ReturnType<typeof gateway.send>>;
      try {
        delivery = await gateway.send(message);
      } catch (error) {
        await markQueuedMessageDeliveryFailed({
          queuedEventId: message.queuedEventId,
          provider: gateway.provider,
          errorMessage:
            error instanceof Error ? error.message : "Unknown delivery error",
        });
        throw error;
      }

      const deliveredEvent = createMessageDeliveredEvent({
        workspaceId: message.workspaceId,
        queuedEventId: message.queuedEventId,
        contactId: message.contactId,
        channel: message.channel,
        provider: delivery.provider,
        deliveredAt: delivery.deliveredAt,
      });

      await recordOutboundMessageDelivery({
        queuedEventId: message.queuedEventId,
        workspaceId: message.workspaceId,
        contactId: message.contactId,
        channel: message.channel,
        provider: delivery.provider,
        destination: message.destination,
        body: message.body,
        deliveredAt: delivery.deliveredAt,
        deliveredEvent,
      });

      console.log(
        `[worker] delivered ${message.channel} message for contact ${message.contactId} via ${delivery.provider}${message.deliverAfter ? ` (scheduled for ${message.deliverAfter})` : ""}`,
      );
    }
  } finally {
    isProcessing = false;
  }
}

async function sweepSensitiveDataRetention() {
  if (isRetentionSweepRunning) {
    return;
  }

  isRetentionSweepRunning = true;

  try {
    const result = await enforceSensitiveDataRetentionPolicy();
    const removedCount =
      result.transcriptCount +
      result.messageCount +
      result.eventCount +
      result.deliveryAttemptCount;

    if (removedCount > 0) {
      console.log(
        `[worker] sensitive data retention removed ${removedCount} record(s) older than ${result.cutoff}`,
      );
    }
  } finally {
    isRetentionSweepRunning = false;
  }
}

function logWorkerError(prefix: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown worker error";
  console.error(`[worker] ${prefix} ${message}`);
}

async function start() {
  console.log(`[worker] polling for queued messages every ${pollIntervalMs}ms`);
  console.log(
    `[worker] sweeping sensitive data retention every ${retentionSweepMs}ms`,
  );

  void processQueuedMessages().catch((error: unknown) => {
    logWorkerError("delivery", error);
  });
  void sweepSensitiveDataRetention().catch((error: unknown) => {
    logWorkerError("retention", error);
  });

  setInterval(() => {
    void processQueuedMessages().catch((error: unknown) => {
      logWorkerError("delivery", error);
    });
  }, pollIntervalMs);

  setInterval(() => {
    void sweepSensitiveDataRetention().catch((error: unknown) => {
      logWorkerError("retention", error);
    });
  }, retentionSweepMs);
}

void start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  console.error(`[worker] ${message}`);
  process.exitCode = 1;
});
