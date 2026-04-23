import {
  appendEvents,
  getReviewReferralOutcomeReport,
  prisma,
  recordInboundMessage,
  saveAppointmentTransaction,
} from "@one-system/database";
import {
  createAppointment,
  createMessageInboundReceivedEvent,
} from "@one-system/domain";
import {
  routeReviewsReferralsReply,
  triggerPostVisitReviewRequest,
} from "./index";

const workspaceId = process.env.WORKSPACE_ID?.trim() || "workspace_medspa_demo";
const campaignKey = process.env.CAMPAIGN_KEY?.trim() || `module3-proof-${Date.now()}`;

const contact = await prisma.contact.findFirst({
  where: {
    workspaceId,
    OR: [{ phone: { not: null } }, { email: { not: null } }],
  },
  orderBy: { createdAt: "desc" },
});

if (!contact) {
  throw new Error("No contact found in seeded workspace for Module 3 proof pass.");
}

const startsAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
const appointmentResult = createAppointment({
  workspaceId,
  contactId: contact.id,
  startsAt,
  outcome: "completed",
});
const appointmentSaved = await saveAppointmentTransaction(appointmentResult);

const trigger = await triggerPostVisitReviewRequest({
  workspaceId,
  appointmentId: appointmentSaved.appointment.id,
  campaignKey,
  cooldownDays: 1,
  delayHours: 0,
});

const before = await getReviewReferralOutcomeReport({
  workspaceId,
  campaignKey,
  limit: 250,
});

const target = before.outcomes.find((outcome) => outcome.contactId === contact.id) ??
  before.outcomes[0];

if (!target) {
  throw new Error("Proof appointment queued no review/referral outcome to route.");
}

const proofToken = Date.now().toString();
const messageBody = `5/5 and I can refer someone, name is Nora, nora.proof.${proofToken}@example.com`;
const receivedAt = new Date().toISOString();

await recordInboundMessage({
  workspaceId,
  contactId: target.contactId,
  channel: target.channel,
  provider: "module3-proof-pass",
  from: target.destination,
  body: messageBody,
  receivedAt,
});

const inboundEvent = createMessageInboundReceivedEvent({
  workspaceId,
  contactId: target.contactId,
  channel: target.channel,
  provider: "module3-proof-pass",
  from: target.destination,
  body: messageBody,
});
await appendEvents([inboundEvent]);

const routing = await routeReviewsReferralsReply({
  workspaceId,
  contactId: target.contactId,
  channel: target.channel,
  destination: target.destination,
  messageBody,
  receivedAt,
});

const after = await getReviewReferralOutcomeReport({
  workspaceId,
  campaignKey,
  limit: 250,
});
const updatedOutcome = after.outcomes.find((outcome) =>
  outcome.contactId === target.contactId
);

const evidence = {
  workspaceId,
  campaignKey,
  contact: {
    contactId: contact.id,
    firstName: contact.firstName,
    phone: contact.phone,
    email: contact.email,
  },
  appointment: {
    appointmentId: appointmentSaved.appointment.id,
    startsAt: appointmentSaved.appointment.startsAt.toISOString(),
    outcome: appointmentSaved.appointment.outcome,
  },
  trigger,
  before: {
    queuedCount: before.queuedCount,
    deliveredCount: before.deliveredCount,
    repliedCount: before.repliedCount,
    referralFollowUpQueuedCount: before.referralFollowUpQueuedCount,
    referralSourceCapturedCount: before.referralSourceCapturedCount,
    referralSourceHighConfidenceCount: before.referralSourceHighConfidenceCount,
    referralSourceMediumConfidenceCount: before.referralSourceMediumConfidenceCount,
    referralSourceLowConfidenceCount: before.referralSourceLowConfidenceCount,
  },
  routing,
  after: {
    queuedCount: after.queuedCount,
    deliveredCount: after.deliveredCount,
    repliedCount: after.repliedCount,
    referralFollowUpQueuedCount: after.referralFollowUpQueuedCount,
    referralSourceCapturedCount: after.referralSourceCapturedCount,
    referralSourceHighConfidenceCount: after.referralSourceHighConfidenceCount,
    referralSourceMediumConfidenceCount: after.referralSourceMediumConfidenceCount,
    referralSourceLowConfidenceCount: after.referralSourceLowConfidenceCount,
  },
  deltas: {
    repliedCount: after.repliedCount - before.repliedCount,
    referralFollowUpQueuedCount:
      after.referralFollowUpQueuedCount - before.referralFollowUpQueuedCount,
    referralSourceCapturedCount:
      after.referralSourceCapturedCount - before.referralSourceCapturedCount,
    referralSourceHighConfidenceCount:
      after.referralSourceHighConfidenceCount - before.referralSourceHighConfidenceCount,
    referralSourceMediumConfidenceCount:
      after.referralSourceMediumConfidenceCount - before.referralSourceMediumConfidenceCount,
    referralSourceLowConfidenceCount:
      after.referralSourceLowConfidenceCount - before.referralSourceLowConfidenceCount,
  },
  updatedOutcome: updatedOutcome
    ? {
        queuedEventId: updatedOutcome.queuedEventId,
        replied: updatedOutcome.replied,
        latestReplyBody: updatedOutcome.latestReplyBody,
        referralFollowUpQueued: updatedOutcome.referralFollowUpQueued,
        referralSourceCaptured: updatedOutcome.referralSourceCaptured,
        referralSourceCaptureConfidence:
          updatedOutcome.referralSourceCaptureConfidence,
        referredName: updatedOutcome.referredName,
        referredContact: updatedOutcome.referredContact,
      }
    : null,
};

console.log(JSON.stringify(evidence, null, 2));
