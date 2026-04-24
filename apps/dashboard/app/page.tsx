import {
  getDashboardFunnelSnapshot,
  getAvailableBookingSlots,
  getPaidAdsOutcomeReport,
  getReactivationActionQueue,
  getReactivationOutcomeReport,
  getRecentPaidAdsSpendEntries,
  getReviewReferralOutcomeReport,
  getRecentReactivationRunSummaries,
  getRecentAppointmentOverview,
  getRecentConversationThreads,
  getRecentReactivationImports,
  getRecentReactivationHandledItems,
  getDeliveryStatus,
  getRecentLeadOverview,
  getRecentMessageTimeline,
  getSalesEnablementReport,
} from "@one-system/database";
import { SectionCard } from "@one-system/ui";
import {
  bookReactivationItemAtSlot,
  generateReviewsResponseDraft,
  ingestSalesConsultationTranscript,
  markReactivationItemHandled,
  recordPaidAdsSpendEntry,
  runSalesEnablementAdapterSync,
  runPaidAdsCampaign,
  runReactivationCampaign,
  runReviewsReferralsCampaign,
} from "./actions";
import { previewPaidAdsRun } from "@one-system/paid-ads";
import { previewReactivationRun } from "@one-system/reactivation";
import { previewReviewsReferralsRun } from "@one-system/reviews-referrals";
import {
  getQueueActionFeedback,
  getReactivationRunErrorMessage,
  getReactivationRunFeedback,
} from "./reactivation-feedback";
import {
  getReviewsDraftErrorMessage,
  getReviewsDraftFeedback,
  getReviewsRunErrorMessage,
  getReviewsRunFeedback,
} from "./reviews-referrals-feedback";
import {
  getPaidAdsRunErrorMessage,
  getPaidAdsRunFeedback,
  getPaidAdsSpendErrorMessage,
  getPaidAdsSpendFeedback,
} from "./paid-ads-feedback";
import {
  getSalesEnablementErrorMessage,
  getSalesEnablementFeedback,
  getSalesEnablementSyncErrorMessage,
  getSalesEnablementSyncFeedback,
} from "./sales-enablement-feedback";
import { getPlatformFoundationReadiness } from "@one-system/domain";

const modules = [
  "Lead Capture + Instant Follow-Up",
  "Database Reactivation",
  "Reviews + Referrals",
  "Paid Ads + Lead Nurturing",
  "Sales Enablement",
];

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

function formatRelativeIso(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getReactivationStageLabel(
  stage: "qualified_waiting_booking" | "replied_waiting_follow_up" | "delivered_no_reply",
) {
  if (stage === "qualified_waiting_booking") {
    return "qualified, waiting to book";
  }

  if (stage === "replied_waiting_follow_up") {
    return "replied, needs follow-up";
  }

  return "delivered, no reply yet";
}

function getAudienceSegmentLabel(segment: string) {
  if (segment === "stale_leads") {
    return "Stale leads";
  }

  if (segment === "past_customers") {
    return "Past customers";
  }

  return "All dormant contacts";
}

function getReadinessLabel(status: string) {
  if (status === "no_candidates") {
    return "No matching dormant contacts found for this audience.";
  }

  if (status === "cooldown_blocked") {
    return "All matching contacts were skipped by the campaign cooldown.";
  }

  return "Ready contacts are available for outreach.";
}

function getReviewsReadinessLabel(status: string) {
  if (status === "no_candidates") {
    return "No completed-visit contacts match the current request window.";
  }

  if (status === "cooldown_blocked") {
    return "All matching contacts were recently reached for this campaign key.";
  }

  return "Ready contacts are available for review/referral outreach.";
}

function getPaidAdsReadinessLabel(status: string) {
  if (status === "no_candidates") {
    return "No attributed leads are currently available for nurture.";
  }

  if (status === "cooldown_blocked") {
    return "All matching leads were recently targeted and are in cooldown.";
  }

  if (status === "blocked_by_safety") {
    return "Matching leads exist, but safety rules are preventing queueing.";
  }

  return "Ready attributed leads are available for nurture.";
}

function getReviewsDraftSentimentLabel(sentiment: string) {
  if (sentiment === "promoter") {
    return "Promoter feedback";
  }

  if (sentiment === "recovery") {
    return "Recovery-needed feedback";
  }

  return "Neutral feedback";
}

function getReviewsDraftActionLabel(action: string) {
  if (action === "invite_public_review") {
    return "Invite public review";
  }

  if (action === "offer_service_recovery") {
    return "Offer service recovery";
  }

  return "Gather more detail";
}

function getModule2ReadinessChecks(args: {
  liveImportCount: number;
  dryRunImportCount: number;
  importedContactCount: number;
  eligibleCount: number;
  runCount: number;
  bookingSlotCount: number;
  qualifiedQueueCount: number;
  queuedCount: number;
  repliedCount: number;
  bookedCount: number;
}) {
  return [
    {
      label: "Dormant list imported",
      ready: args.liveImportCount > 0 || args.eligibleCount > 0,
      detail:
        args.liveImportCount > 0
          ? `${args.importedContactCount} contacts loaded across ${args.liveImportCount} live imports`
          : args.dryRunImportCount > 0
            ? `${args.dryRunImportCount} dry-run preview(s) recorded, but no live import yet`
            : "Run a CSV import or CRM sync import to load dormant contacts",
    },
    {
      label: "Audience ready",
      ready: args.eligibleCount > 0,
      detail:
        args.eligibleCount > 0
          ? `${args.eligibleCount} contacts currently eligible`
          : "No eligible contacts in the default readiness preview",
    },
    {
      label: "Campaign executed",
      ready: args.runCount > 0 || args.queuedCount > 0,
      detail:
        args.runCount > 0
          ? `${args.runCount} recent run groups visible`
          : "Queue at least one reactivation campaign",
    },
    {
      label: "Booking path available",
      ready: args.qualifiedQueueCount === 0 || args.bookingSlotCount > 0,
      detail:
        args.qualifiedQueueCount === 0
          ? "No qualified contacts are currently waiting for booking"
          : args.bookingSlotCount > 0
            ? `${args.bookingSlotCount} generated booking slots available for ${args.qualifiedQueueCount} qualified queue items`
            : `${args.qualifiedQueueCount} qualified queue items are waiting but no booking slots are currently available`,
    },
    {
      label: "Outcomes measurable",
      ready: args.queuedCount > 0 || args.repliedCount > 0 || args.bookedCount > 0,
      detail: `${args.queuedCount} queued • ${args.repliedCount} replied • ${args.bookedCount} booked`,
    },
  ];
}

function getModule3ReadinessChecks(args: {
  eligibleCount: number;
  queuedCount: number;
  repliedCount: number;
  promoterFollowUpQueuedCount: number;
  referralFollowUpQueuedCount: number;
  recoveryFollowUpQueuedCount: number;
  referralIntentCount: number;
  referralSourceCapturedCount: number;
}) {
  const followUpQueuedCount =
    args.promoterFollowUpQueuedCount +
    args.referralFollowUpQueuedCount +
    args.recoveryFollowUpQueuedCount;

  return [
    {
      label: "Post-visit audience ready",
      ready: args.eligibleCount > 0,
      detail:
        args.eligibleCount > 0
          ? `${args.eligibleCount} contacts currently eligible`
          : "No eligible post-visit contacts in the default readiness preview",
    },
    {
      label: "Campaign executed",
      ready: args.queuedCount > 0,
      detail:
        args.queuedCount > 0
          ? `${args.queuedCount} review/referral requests queued`
          : "Queue at least one review/referral campaign run",
    },
    {
      label: "Feedback flowing in",
      ready: args.repliedCount > 0,
      detail:
        args.repliedCount > 0
          ? `${args.repliedCount} inbound replies recorded`
          : "No inbound replies recorded yet for queued requests",
    },
    {
      label: "Routing actions active",
      ready: followUpQueuedCount > 0,
      detail:
        followUpQueuedCount > 0
          ? `${followUpQueuedCount} follow-up actions queued across promoter/referral/recovery paths`
          : "No routed follow-up actions have been queued yet",
    },
    {
      label: "Referral source visibility",
      ready:
        args.referralIntentCount === 0 || args.referralSourceCapturedCount > 0,
      detail:
        args.referralIntentCount === 0
          ? "No referral-intent replies yet; source capture will validate once referral traffic appears"
          : args.referralSourceCapturedCount > 0
            ? `${args.referralSourceCapturedCount} referral source captures recorded`
            : `${args.referralIntentCount} referral-intent replies observed but no source captures yet`,
    },
  ];
}

function getModule4ReadinessChecks(args: {
  eligibleCount: number;
  queuedCount: number;
  repliedCount: number;
  qualifiedCount: number;
  spendEntryCount: number;
  spendAmount: number;
  blockedBySafetyCount: number;
}) {
  return [
    {
      label: "Attributed audience ready",
      ready: args.eligibleCount > 0,
      detail:
        args.eligibleCount > 0
          ? `${args.eligibleCount} leads currently eligible`
          : "No eligible attributed leads in the default readiness preview",
    },
    {
      label: "Nurture run executed",
      ready: args.queuedCount > 0,
      detail:
        args.queuedCount > 0
          ? `${args.queuedCount} leads queued into paid nurture`
          : "Queue at least one paid-ads nurture run",
    },
    {
      label: "Outcome signal visible",
      ready: args.repliedCount > 0 || args.qualifiedCount > 0,
      detail: `${args.repliedCount} replied • ${args.qualifiedCount} qualified`,
    },
    {
      label: "Spend tracking active",
      ready: args.spendEntryCount > 0,
      detail:
        args.spendEntryCount > 0
          ? `${args.spendEntryCount} spend entries recorded (${args.spendAmount.toFixed(2)} total)`
          : "Record at least one spend entry to unlock ROI metrics",
    },
    {
      label: "Safety checks in effect",
      ready: args.blockedBySafetyCount > 0 || args.eligibleCount > 0,
      detail:
        args.blockedBySafetyCount > 0
          ? `${args.blockedBySafetyCount} leads currently blocked by terminal, opt-out, or invalid destination checks`
          : "No currently blocked leads in the latest readiness sample",
    },
  ];
}

function getModule5ReadinessChecks(args: {
  recentAppointmentCount: number;
  transcriptCount: number;
  averageOverallScore: number;
  bookingReadyCount: number;
  objectionCount: number;
  namedRepCount: number;
}) {
  return [
    {
      label: "Appointment context available",
      ready: args.recentAppointmentCount > 0,
      detail:
        args.recentAppointmentCount > 0
          ? `${args.recentAppointmentCount} recent appointments available for transcript capture`
          : "Create or import appointments before capturing consultation transcripts",
    },
    {
      label: "Transcript captured",
      ready: args.transcriptCount > 0,
      detail:
        args.transcriptCount > 0
          ? `${args.transcriptCount} consultation transcript(s) stored`
          : "Capture the first consultation transcript",
    },
    {
      label: "Analysis generated",
      ready: args.transcriptCount > 0,
      detail:
        args.transcriptCount > 0
          ? `${args.averageOverallScore.toFixed(1)} average overall consultation score`
          : "No consultation analysis output yet",
    },
    {
      label: "Booking signal visible",
      ready: args.transcriptCount > 0,
      detail:
        args.transcriptCount > 0
          ? `${args.bookingReadyCount} transcript(s) show strong booking intent`
          : "Booking-intent scoring will appear after the first transcript",
    },
    {
      label: "Rep coaching visibility",
      ready: args.namedRepCount > 0,
      detail:
        args.namedRepCount > 0
          ? `${args.namedRepCount} rep profile(s) have coaching metrics`
          : args.objectionCount > 0
            ? "Objection trends are visible, but rep names are missing from recent transcripts"
            : "Capture transcripts with rep names to unlock coaching views",
    },
  ];
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: PageSearchParams;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const reactivationRunFeedback =
    getReactivationRunFeedback(resolvedSearchParams);
  const reactivationRunErrorMessage =
    getReactivationRunErrorMessage(resolvedSearchParams);
  const queueActionFeedback = getQueueActionFeedback(resolvedSearchParams);
  const reviewsRunFeedback = getReviewsRunFeedback(resolvedSearchParams);
  const reviewsRunErrorMessage = getReviewsRunErrorMessage(resolvedSearchParams);
  const reviewsDraftFeedback = getReviewsDraftFeedback(resolvedSearchParams);
  const reviewsDraftErrorMessage =
    getReviewsDraftErrorMessage(resolvedSearchParams);
  const paidAdsRunFeedback = getPaidAdsRunFeedback(resolvedSearchParams);
  const paidAdsRunErrorMessage = getPaidAdsRunErrorMessage(resolvedSearchParams);
  const paidAdsSpendFeedback = getPaidAdsSpendFeedback(resolvedSearchParams);
  const paidAdsSpendErrorMessage =
    getPaidAdsSpendErrorMessage(resolvedSearchParams);
  const salesEnablementFeedback =
    getSalesEnablementFeedback(resolvedSearchParams);
  const salesEnablementErrorMessage =
    getSalesEnablementErrorMessage(resolvedSearchParams);
  const salesEnablementSyncFeedback =
    getSalesEnablementSyncFeedback(resolvedSearchParams);
  const salesEnablementSyncErrorMessage =
    getSalesEnablementSyncErrorMessage(resolvedSearchParams);
  const platformReadiness = getPlatformFoundationReadiness();
  const [
    deliveryStatus,
    funnelSnapshot,
    reactivationBookingSlots,
    defaultReactivationReadiness,
    defaultReviewsReadiness,
    defaultPaidAdsReadiness,
    reactivationSnapshot,
    reviewsSnapshot,
    paidAdsSnapshot,
    paidAdsSpendEntries,
    reactivationRuns,
    reactivationQueue,
    reactivationImports,
    reactivationHandledItems,
    recentLeads,
    recentAppointments,
    recentMessages,
    recentThreads,
    salesEnablementSnapshot,
  ] = await Promise.all([
    getDeliveryStatus(),
    getDashboardFunnelSnapshot(),
    getAvailableBookingSlots({
      workspaceId: "workspace_medspa_demo",
      limit: 4,
    }),
    previewReactivationRun({
      workspaceId: "workspace_medspa_demo",
      inactiveDays: 30,
      limit: 25,
      cooldownDays: 14,
      campaignKey: "reactivation-default",
      audienceSegment: "all",
    }),
    previewReviewsReferralsRun({
      workspaceId: "workspace_medspa_demo",
      completedDaysAgo: 2,
      limit: 25,
      cooldownDays: 14,
      campaignKey: "reviews-referrals-default",
    }),
    previewPaidAdsRun({
      workspaceId: "workspace_medspa_demo",
      limit: 25,
      cooldownDays: 14,
      campaignKey: "paid-ads-default",
    }),
    getReactivationOutcomeReport({
      workspaceId: "workspace_medspa_demo",
      limit: 25,
    }),
    getReviewReferralOutcomeReport({
      workspaceId: "workspace_medspa_demo",
      limit: 25,
    }),
    getPaidAdsOutcomeReport({
      workspaceId: "workspace_medspa_demo",
      limit: 50,
    }),
    getRecentPaidAdsSpendEntries({
      workspaceId: "workspace_medspa_demo",
      limit: 6,
    }),
    getRecentReactivationRunSummaries({
      workspaceId: "workspace_medspa_demo",
      limit: 6,
    }),
    getReactivationActionQueue({
      workspaceId: "workspace_medspa_demo",
      limit: 25,
    }),
    getRecentReactivationImports({
      workspaceId: "workspace_medspa_demo",
      limit: 5,
    }),
    getRecentReactivationHandledItems({
      workspaceId: "workspace_medspa_demo",
      limit: 6,
    }),
    getRecentLeadOverview(),
    getRecentAppointmentOverview(),
    getRecentMessageTimeline(),
    getRecentConversationThreads(),
    getSalesEnablementReport({
      workspaceId: "workspace_medspa_demo",
      limit: 12,
    }),
  ]);
  const liveImports = reactivationImports.filter((record) => !record.dryRun);
  const dryRunImports = reactivationImports.filter((record) => record.dryRun);
  const module2ReadinessChecks = getModule2ReadinessChecks({
    liveImportCount: liveImports.length,
    dryRunImportCount: dryRunImports.length,
    importedContactCount: liveImports.reduce(
      (sum, record) => sum + record.importedCount,
      0,
    ),
    eligibleCount: defaultReactivationReadiness.eligibleCount,
    runCount: reactivationRuns.length,
    bookingSlotCount: reactivationBookingSlots.length,
    qualifiedQueueCount: reactivationQueue.filter(
      (item) => item.stage === "qualified_waiting_booking",
    ).length,
    queuedCount: reactivationSnapshot.queuedCount,
    repliedCount: reactivationSnapshot.repliedCount,
    bookedCount: reactivationSnapshot.bookedCount,
  });
  const module3ReadinessChecks = getModule3ReadinessChecks({
    eligibleCount: defaultReviewsReadiness.eligibleCount,
    queuedCount: reviewsSnapshot.queuedCount,
    repliedCount: reviewsSnapshot.repliedCount,
    promoterFollowUpQueuedCount: reviewsSnapshot.promoterFollowUpQueuedCount,
    referralFollowUpQueuedCount: reviewsSnapshot.referralFollowUpQueuedCount,
    recoveryFollowUpQueuedCount: reviewsSnapshot.recoveryFollowUpQueuedCount,
    referralIntentCount: reviewsSnapshot.referralIntentCount,
    referralSourceCapturedCount: reviewsSnapshot.referralSourceCapturedCount,
  });
  const module4ReadinessChecks = getModule4ReadinessChecks({
    eligibleCount: defaultPaidAdsReadiness.eligibleCount,
    queuedCount: paidAdsSnapshot.queuedCount,
    repliedCount: paidAdsSnapshot.repliedCount,
    qualifiedCount: paidAdsSnapshot.qualifiedCount,
    spendEntryCount: paidAdsSpendEntries.length,
    spendAmount: paidAdsSpendEntries.reduce(
      (sum, entry) => sum + entry.amount,
      0,
    ),
    blockedBySafetyCount:
      defaultPaidAdsReadiness.skippedTerminalCount +
      defaultPaidAdsReadiness.skippedOptOutCount +
      defaultPaidAdsReadiness.skippedInvalidDestinationCount,
  });
  const module5ReadinessChecks = getModule5ReadinessChecks({
    recentAppointmentCount: recentAppointments.length,
    transcriptCount: salesEnablementSnapshot.transcriptCount,
    averageOverallScore: salesEnablementSnapshot.averageOverallScore,
    bookingReadyCount: salesEnablementSnapshot.bookingReadyCount,
    objectionCount: salesEnablementSnapshot.objectionCounts.length,
    namedRepCount: salesEnablementSnapshot.repPerformance.filter(
      (rep) => rep.agentName !== "unassigned",
    ).length,
  });

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">One platform. Five revenue modules.</p>
        <h1>One System</h1>
        <p className="lede">
          AI-powered customer acquisition platform for med spas, built as one
          operating system for capturing, converting, reactivating, and
          retaining more clients.
        </p>
      </section>

      <section className="panel">
        <h2>Current Build Focus</h2>
        <p>
          All five business modules now have foundation slices. The active
          checkpoint is platform closure: making shared entities, module
          boundaries, and production readiness explicit before any next-phase
          expansion.
        </p>
      </section>

      <section className="ops-grid">
        <SectionCard title="Platform Foundation Closure">
          <div className="stats-grid">
            <div className="stat">
              <span className="stat-label">Ready</span>
              <strong>{platformReadiness.readyCount}</strong>
            </div>
            <div className="stat">
              <span className="stat-label">Partial</span>
              <strong>{platformReadiness.partialCount}</strong>
            </div>
            <div className="stat">
              <span className="stat-label">Missing</span>
              <strong>{platformReadiness.missingCount}</strong>
            </div>
          </div>
          <div className="list-block">
            {platformReadiness.requirements.map((requirement) => (
              <div className="list-row" key={requirement.key}>
                <div>
                  <strong>{requirement.label}</strong>
                  <p>{requirement.evidence}</p>
                  {requirement.nextStep ? <p>{requirement.nextStep}</p> : null}
                </div>
                <span
                  className={`pill ${
                    requirement.status === "ready" ? "ready" : "needs_attention"
                  }`}
                >
                  {requirement.status}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Module Boundary Registry">
          <div className="list-block">
            {platformReadiness.modules.map((module) => (
              <div className="list-row" key={module.key}>
                <div>
                  <strong>{module.label}</strong>
                  <p>{module.packageName}</p>
                  <p>Owns {module.owns.join(", ")}</p>
                </div>
                <span
                  className={`pill ${
                    module.status === "completed" ? "ready" : "needs_attention"
                  }`}
                >
                  {module.status}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Funnel Snapshot">
          <div className="stats-grid">
            <div className="stat">
              <span className="stat-label">New</span>
              <strong>{funnelSnapshot.newLeads}</strong>
            </div>
            <div className="stat">
              <span className="stat-label">Responded</span>
              <strong>{funnelSnapshot.respondedLeads}</strong>
            </div>
            <div className="stat">
              <span className="stat-label">Qualified</span>
              <strong>{funnelSnapshot.qualifiedLeads}</strong>
            </div>
            <div className="stat">
              <span className="stat-label">Booked</span>
              <strong>{funnelSnapshot.bookedAppointments}</strong>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Delivery Status">
          <div className="stats-grid">
            <div className="stat">
              <span className="stat-label">Provider</span>
              <strong>{deliveryStatus.provider}</strong>
            </div>
            <div className="stat">
              <span className="stat-label">Queued</span>
              <strong>{deliveryStatus.queuedCount}</strong>
            </div>
            <div className="stat">
              <span className="stat-label">Delivered</span>
              <strong>{deliveryStatus.deliveredCount}</strong>
            </div>
          </div>
          <div className="list-block">
            {deliveryStatus.recentDelivered.length === 0 ? (
              <p>No deliveries recorded yet.</p>
            ) : (
              deliveryStatus.recentDelivered.map((delivery) => (
                <div className="list-row" key={delivery.queuedEventId}>
                  <div>
                    <strong>{delivery.channel.toUpperCase()}</strong>
                    <p>Contact {delivery.contactId.slice(0, 8)}</p>
                  </div>
                  <time>{formatRelativeIso(delivery.deliveredAt)}</time>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Recent Leads">
          <div className="list-block">
            {recentLeads.length === 0 ? (
              <p>No leads created yet.</p>
            ) : (
              recentLeads.map((lead) => (
                <div className="list-row" key={lead.leadId}>
                  <div>
                    <strong>{lead.firstName}</strong>
                    <p>
                      {lead.source}
                      {lead.utmCampaign ? ` (${lead.utmCampaign})` : ""} •{" "}
                      {lead.contactChannel}
                    </p>
                  </div>
                  <div className="row-meta">
                    <span className="pill">{lead.status}</span>
                    <time>{formatRelativeIso(lead.createdAt)}</time>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Reactivation Outcomes">
          <div className="stats-grid">
            <div className="stat">
              <span className="stat-label">Queued</span>
              <strong>{reactivationSnapshot.queuedCount}</strong>
            </div>
            <div className="stat">
              <span className="stat-label">Replied</span>
              <strong>{reactivationSnapshot.repliedCount}</strong>
            </div>
            <div className="stat">
              <span className="stat-label">Qualified</span>
              <strong>{reactivationSnapshot.qualifiedCount}</strong>
            </div>
            <div className="stat">
              <span className="stat-label">Booked</span>
              <strong>{reactivationSnapshot.bookedCount}</strong>
            </div>
          </div>
          <div className="list-block">
            {reactivationSnapshot.outcomes.length === 0 ? (
              <p>No reactivation activity recorded yet.</p>
            ) : (
              reactivationSnapshot.outcomes.slice(0, 4).map((outcome) => (
                <div className="list-row" key={outcome.queuedEventId}>
                  <div>
                    <strong>{outcome.firstName}</strong>
                    <p>
                      {outcome.channel.toUpperCase()} • {outcome.destination}
                    </p>
                  </div>
                  <div className="row-meta">
                    <span className="pill">
                      {outcome.booked
                        ? "booked"
                        : outcome.qualified
                          ? "qualified"
                          : outcome.replied
                            ? "replied"
                            : "sent"}
                    </span>
                    <time>{formatRelativeIso(outcome.queuedAt)}</time>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Reviews & Referrals Outcomes">
          <div className="stats-grid">
            <div className="stat">
              <span className="stat-label">Queued</span>
              <strong>{reviewsSnapshot.queuedCount}</strong>
            </div>
            <div className="stat">
              <span className="stat-label">Delivered</span>
              <strong>{reviewsSnapshot.deliveredCount}</strong>
            </div>
            <div className="stat">
              <span className="stat-label">Replied</span>
              <strong>{reviewsSnapshot.repliedCount}</strong>
            </div>
            <div className="stat">
              <span className="stat-label">Promoters</span>
              <strong>{reviewsSnapshot.promoterCount}</strong>
            </div>
            <div className="stat">
              <span className="stat-label">Referral intent</span>
              <strong>{reviewsSnapshot.referralIntentCount}</strong>
            </div>
          </div>
          <div className="mini-stats">
            <div>
              <span>Promoter follow-up</span>
              <strong>{reviewsSnapshot.promoterFollowUpQueuedCount}</strong>
            </div>
            <div>
              <span>Referral follow-up</span>
              <strong>{reviewsSnapshot.referralFollowUpQueuedCount}</strong>
            </div>
            <div>
              <span>Recovery follow-up</span>
              <strong>{reviewsSnapshot.recoveryFollowUpQueuedCount}</strong>
            </div>
            <div>
              <span>Referral source captured</span>
              <strong>{reviewsSnapshot.referralSourceCapturedCount}</strong>
            </div>
            <div>
              <span>High-confidence source</span>
              <strong>{reviewsSnapshot.referralSourceHighConfidenceCount}</strong>
            </div>
            <div>
              <span>Medium-confidence source</span>
              <strong>{reviewsSnapshot.referralSourceMediumConfidenceCount}</strong>
            </div>
            <div>
              <span>Low-confidence source</span>
              <strong>{reviewsSnapshot.referralSourceLowConfidenceCount}</strong>
            </div>
          </div>
          <div className="list-block">
            {reviewsSnapshot.outcomes.length === 0 ? (
              <p>No review/referral activity recorded yet.</p>
            ) : (
              reviewsSnapshot.outcomes.slice(0, 4).map((outcome) => (
                <div className="list-row" key={outcome.queuedEventId}>
                  <div>
                    <strong>{outcome.firstName}</strong>
                    <p>
                      {outcome.channel.toUpperCase()} • {outcome.destination}
                    </p>
                    {outcome.latestReplyBody ? (
                      <blockquote className="message-context">
                        <span>
                          Latest reply
                          {outcome.latestReplyAt
                            ? ` • ${formatRelativeIso(outcome.latestReplyAt)}`
                            : ""}
                        </span>
                        <p>{outcome.latestReplyBody}</p>
                      </blockquote>
                    ) : null}
                    {outcome.referralSourceCaptured ? (
                      <p>
                        Referral source captured
                        {outcome.referralSourceCapturedAt
                          ? ` • ${formatRelativeIso(outcome.referralSourceCapturedAt)}`
                          : ""}
                        {outcome.referredName ? ` • ${outcome.referredName}` : ""}
                        {outcome.referredContact
                          ? ` • ${outcome.referredContact}`
                          : ""}
                        {outcome.referralSourceCaptureConfidence
                          ? ` • ${outcome.referralSourceCaptureConfidence} confidence`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="row-meta">
                    <span className="pill">
                      {outcome.recoveryFollowUpQueued
                        ? "recovery queued"
                        : outcome.referralFollowUpQueued
                          ? "referral queued"
                          : outcome.promoterFollowUpQueued
                            ? "promoter queued"
                        : outcome.referralIntent
                        ? "referral intent"
                        : outcome.promoter
                          ? "promoter"
                          : outcome.replied
                            ? "replied"
                            : outcome.deliveredAt
                              ? "delivered"
                              : "queued"}
                    </span>
                    <time>{formatRelativeIso(outcome.queuedAt)}</time>
                    {outcome.latestReplyBody ? (
                      <form action={generateReviewsResponseDraft}>
                        <input
                          name="customerFirstName"
                          type="hidden"
                          value={outcome.firstName}
                        />
                        <input
                          name="customerMessage"
                          type="hidden"
                          value={outcome.latestReplyBody}
                        />
                        <button className="text-button" type="submit">
                          Draft reply
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Paid Ads Outcomes">
          <div className="stats-grid">
            <div className="stat">
              <span className="stat-label">Queued</span>
              <strong>{paidAdsSnapshot.queuedCount}</strong>
            </div>
            <div className="stat">
              <span className="stat-label">Replied</span>
              <strong>{paidAdsSnapshot.repliedCount}</strong>
            </div>
            <div className="stat">
              <span className="stat-label">Qualified</span>
              <strong>{paidAdsSnapshot.qualifiedCount}</strong>
            </div>
            <div className="stat">
              <span className="stat-label">Booked</span>
              <strong>{paidAdsSnapshot.bookedCount}</strong>
            </div>
            <div className="stat">
              <span className="stat-label">Spend</span>
              <strong>
                {paidAdsSnapshot.currency} {paidAdsSnapshot.spendAmount.toFixed(2)}
              </strong>
            </div>
          </div>
          <div className="mini-stats">
            <div>
              <span>Cost per lead</span>
              <strong>
                {paidAdsSnapshot.costPerLead
                  ? `${paidAdsSnapshot.currency} ${paidAdsSnapshot.costPerLead.toFixed(2)}`
                  : "n/a"}
              </strong>
            </div>
            <div>
              <span>Cost per qualified</span>
              <strong>
                {paidAdsSnapshot.costPerQualified
                  ? `${paidAdsSnapshot.currency} ${paidAdsSnapshot.costPerQualified.toFixed(2)}`
                  : "n/a"}
              </strong>
            </div>
            <div>
              <span>Cost per booking</span>
              <strong>
                {paidAdsSnapshot.costPerBooking
                  ? `${paidAdsSnapshot.currency} ${paidAdsSnapshot.costPerBooking.toFixed(2)}`
                  : "n/a"}
              </strong>
            </div>
          </div>
          <div className="list-block">
            {paidAdsSnapshot.outcomes.length === 0 ? (
              <p>No paid-ads nurture activity recorded yet.</p>
            ) : (
              paidAdsSnapshot.outcomes.slice(0, 4).map((outcome) => (
                <div className="list-row" key={outcome.queuedEventId}>
                  <div>
                    <strong>{outcome.firstName}</strong>
                    <p>
                      {outcome.source}
                      {outcome.utmCampaign ? ` (${outcome.utmCampaign})` : ""} •{" "}
                      {outcome.destination}
                    </p>
                  </div>
                  <div className="row-meta">
                    <span className="pill">
                      {outcome.booked
                        ? "booked"
                        : outcome.qualified
                          ? "qualified"
                          : outcome.replied
                            ? "replied"
                            : outcome.deliveredAt
                              ? "delivered"
                              : "queued"}
                    </span>
                    <time>{formatRelativeIso(outcome.queuedAt)}</time>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="list-block">
            {paidAdsSnapshot.rows.length === 0 ? (
              <p>No source performance rows yet.</p>
            ) : (
              paidAdsSnapshot.rows.slice(0, 4).map((row) => (
                <div className="list-row" key={`${row.source}-${row.utmCampaign ?? "none"}`}>
                  <div>
                    <strong>{row.source}</strong>
                    <p>{row.utmCampaign ? row.utmCampaign : "no campaign tag"}</p>
                    <p>
                      {row.leadCount} leads • {row.respondedCount} replied •{" "}
                      {row.qualifiedCount} qualified • {row.bookedCount} booked
                    </p>
                  </div>
                  <div className="row-meta">
                    <span className="pill">
                      {row.currency} {row.spendAmount.toFixed(2)}
                    </span>
                    <p>
                      CPL {row.costPerLead ? row.costPerLead.toFixed(2) : "n/a"} •
                      CPQ{" "}
                      {row.costPerQualified
                        ? row.costPerQualified.toFixed(2)
                        : "n/a"}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Run Reactivation Campaign">
          {reactivationRunFeedback ? (
            <div className="notice-card">
              <strong>Campaign run processed</strong>
              <p>
                {reactivationRunFeedback.campaignKey} • Run{" "}
                {reactivationRunFeedback.runId.slice(0, 8)}
              </p>
              <p>
                {getAudienceSegmentLabel(reactivationRunFeedback.audienceSegment)} •{" "}
                {getReadinessLabel(reactivationRunFeedback.readinessStatus)}
              </p>
              <div className="mini-stats">
                <div>
                  <span>Candidates</span>
                  <strong>{reactivationRunFeedback.candidateCount}</strong>
                </div>
                <div>
                  <span>Queued</span>
                  <strong>{reactivationRunFeedback.queuedCount}</strong>
                </div>
                <div>
                  <span>Skipped</span>
                  <strong>{reactivationRunFeedback.skippedCount}</strong>
                </div>
                <div>
                  <span>Cooldown</span>
                  <strong>{reactivationRunFeedback.cooldownDays}d</strong>
                </div>
              </div>
              <div className="mini-stats">
                <div>
                  <span>Stale leads</span>
                  <strong>{reactivationRunFeedback.staleLeadCount}</strong>
                </div>
                <div>
                  <span>Past customers</span>
                  <strong>{reactivationRunFeedback.pastCustomerCount}</strong>
                </div>
                <div>
                  <span>Eligible leads</span>
                  <strong>{reactivationRunFeedback.eligibleStaleLeadCount}</strong>
                </div>
                <div>
                  <span>Eligible customers</span>
                  <strong>{reactivationRunFeedback.eligiblePastCustomerCount}</strong>
                </div>
              </div>
            </div>
          ) : null}
          {reactivationRunErrorMessage ? (
            <div className="notice-card notice-error">
              <strong>Campaign run blocked</strong>
              <p>{reactivationRunErrorMessage}</p>
              <p>Review the campaign inputs and try again.</p>
            </div>
          ) : null}
          <p className="action-warning">
            Queues outreach for dormant contacts that match this audience. Contacts
            reached recently for the same campaign key are skipped by the cooldown.
          </p>
          <div className="readiness-card">
            <div>
              <span className="stat-label">Default readiness</span>
              <strong>{getReadinessLabel(defaultReactivationReadiness.readinessStatus)}</strong>
              <p>
                Previewing all dormant contacts, 30 inactive days, 25-contact limit,
                and 14-day cooldown before any outreach is queued.
              </p>
            </div>
            <div className="mini-stats">
              <div>
                <span>Eligible</span>
                <strong>{defaultReactivationReadiness.eligibleCount}</strong>
              </div>
              <div>
                <span>Cooldown</span>
                <strong>{defaultReactivationReadiness.skippedCount}</strong>
              </div>
              <div>
                <span>Stale leads</span>
                <strong>
                  {defaultReactivationReadiness.segmentBreakdown.staleLeadCount}
                </strong>
              </div>
              <div>
                <span>Customers</span>
                <strong>
                  {defaultReactivationReadiness.segmentBreakdown.pastCustomerCount}
                </strong>
              </div>
            </div>
            {defaultReactivationReadiness.candidates.length > 0 ? (
              <div className="preview-list">
                <span className="stat-label">Ready audience preview</span>
                {defaultReactivationReadiness.candidates.slice(0, 3).map((candidate) => (
                  <div className="preview-row" key={candidate.contactId}>
                    <strong>{candidate.firstName}</strong>
                    <span>
                      {candidate.segment === "past_customer"
                        ? "Past customer"
                        : "Stale lead"}{" "}
                      • Last active {formatRelativeIso(candidate.lastActivityAt)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <form action={runReactivationCampaign} className="control-form">
            <label>
              Campaign key
              <input
                defaultValue="reactivation-default"
                name="campaignKey"
                type="text"
              />
            </label>
            <label>
              Audience
              <select defaultValue="all" name="audienceSegment">
                <option value="all">All dormant contacts</option>
                <option value="stale_leads">Stale leads only</option>
                <option value="past_customers">Past customers only</option>
              </select>
            </label>
            <div className="form-grid">
              <label>
                Inactive days
                <input defaultValue="30" min="7" name="inactiveDays" type="number" />
              </label>
              <label>
                Limit
                <input defaultValue="25" min="1" max="100" name="limit" type="number" />
              </label>
              <label>
                Cooldown days
                <input
                  defaultValue="14"
                  min="1"
                  max="90"
                  name="cooldownDays"
                  type="number"
                />
              </label>
            </div>
            <button className="text-button" type="submit">
              Queue campaign
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Run Reviews & Referrals Campaign">
          {reviewsRunFeedback ? (
            <div className="notice-card">
              <strong>Campaign run processed</strong>
              <p>
                {reviewsRunFeedback.campaignKey} • Run{" "}
                {reviewsRunFeedback.runId.slice(0, 8)}
              </p>
              <p>{getReviewsReadinessLabel(reviewsRunFeedback.readinessStatus)}</p>
              <div className="mini-stats">
                <div>
                  <span>Candidates</span>
                  <strong>{reviewsRunFeedback.candidateCount}</strong>
                </div>
                <div>
                  <span>Queued</span>
                  <strong>{reviewsRunFeedback.queuedCount}</strong>
                </div>
                <div>
                  <span>Skipped</span>
                  <strong>{reviewsRunFeedback.skippedCount}</strong>
                </div>
                <div>
                  <span>Cooldown</span>
                  <strong>{reviewsRunFeedback.cooldownDays}d</strong>
                </div>
              </div>
            </div>
          ) : null}
          {reviewsRunErrorMessage ? (
            <div className="notice-card notice-error">
              <strong>Campaign run blocked</strong>
              <p>{reviewsRunErrorMessage}</p>
              <p>Review the campaign inputs and try again.</p>
            </div>
          ) : null}
          <p className="action-warning">
            Queues post-visit feedback and referral-interest outreach for completed
            visits. Recent sends for the same campaign key are skipped by cooldown.
          </p>
          <div className="readiness-card">
            <div>
              <span className="stat-label">Default readiness</span>
              <strong>
                {getReviewsReadinessLabel(defaultReviewsReadiness.readinessStatus)}
              </strong>
              <p>
                Previewing completed visits from at least 2 days ago, 25-contact
                limit, and 14-day cooldown before queueing outreach.
              </p>
            </div>
            <div className="mini-stats">
              <div>
                <span>Eligible</span>
                <strong>{defaultReviewsReadiness.eligibleCount}</strong>
              </div>
              <div>
                <span>Cooldown</span>
                <strong>{defaultReviewsReadiness.skippedCount}</strong>
              </div>
              <div>
                <span>Candidates</span>
                <strong>{defaultReviewsReadiness.candidateCount}</strong>
              </div>
              <div>
                <span>Window</span>
                <strong>{defaultReviewsReadiness.completedDaysAgo}d</strong>
              </div>
            </div>
            {defaultReviewsReadiness.candidates.length > 0 ? (
              <div className="preview-list">
                <span className="stat-label">Ready audience preview</span>
                {defaultReviewsReadiness.candidates.slice(0, 3).map((candidate) => (
                  <div className="preview-row" key={candidate.contactId}>
                    <strong>{candidate.firstName}</strong>
                    <span>
                      {candidate.channel.toUpperCase()} • Completed{" "}
                      {formatRelativeIso(candidate.completedVisitAt)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <form action={runReviewsReferralsCampaign} className="control-form">
            <label>
              Campaign key
              <input
                defaultValue="reviews-referrals-default"
                name="campaignKey"
                type="text"
              />
            </label>
            <div className="form-grid">
              <label>
                Completed days ago
                <input
                  defaultValue="2"
                  min="1"
                  max="120"
                  name="completedDaysAgo"
                  type="number"
                />
              </label>
              <label>
                Limit
                <input defaultValue="25" min="1" max="100" name="limit" type="number" />
              </label>
              <label>
                Cooldown days
                <input
                  defaultValue="14"
                  min="1"
                  max="90"
                  name="cooldownDays"
                  type="number"
                />
              </label>
            </div>
            <button className="text-button" type="submit">
              Queue campaign
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Run Paid Ads Nurture">
          {paidAdsRunFeedback ? (
            <div className="notice-card">
              <strong>Campaign run processed</strong>
              <p>
                {paidAdsRunFeedback.campaignKey} • Run{" "}
                {paidAdsRunFeedback.runId.slice(0, 8)}
              </p>
              <p>{getPaidAdsReadinessLabel(paidAdsRunFeedback.readinessStatus)}</p>
              <div className="mini-stats">
                <div>
                  <span>Candidates</span>
                  <strong>{paidAdsRunFeedback.candidateCount}</strong>
                </div>
                <div>
                  <span>Eligible</span>
                  <strong>{paidAdsRunFeedback.eligibleCount}</strong>
                </div>
                <div>
                  <span>Queued leads</span>
                  <strong>{paidAdsRunFeedback.queuedCount}</strong>
                </div>
                <div>
                  <span>Queued events</span>
                  <strong>{paidAdsRunFeedback.queuedEventCount}</strong>
                </div>
              </div>
              <div className="mini-stats">
                <div>
                  <span>Cooldown skips</span>
                  <strong>{paidAdsRunFeedback.skippedCooldownCount}</strong>
                </div>
                <div>
                  <span>Terminal skips</span>
                  <strong>{paidAdsRunFeedback.skippedTerminalCount}</strong>
                </div>
                <div>
                  <span>Opt-out skips</span>
                  <strong>{paidAdsRunFeedback.skippedOptOutCount}</strong>
                </div>
                <div>
                  <span>Invalid destination</span>
                  <strong>{paidAdsRunFeedback.skippedInvalidDestinationCount}</strong>
                </div>
              </div>
            </div>
          ) : null}
          {paidAdsRunErrorMessage ? (
            <div className="notice-card notice-error">
              <strong>Campaign run blocked</strong>
              <p>{paidAdsRunErrorMessage}</p>
              <p>Review the campaign inputs and try again.</p>
            </div>
          ) : null}
          <p className="action-warning">
            Queues source-aware SMS nurture for attributed leads while skipping
            terminal-status, opt-out, invalid destination, and cooldown-blocked
            contacts.
          </p>
          <div className="readiness-card">
            <div>
              <span className="stat-label">Default readiness</span>
              <strong>
                {getPaidAdsReadinessLabel(defaultPaidAdsReadiness.readinessStatus)}
              </strong>
              <p>
                Previewing a 25-lead window with a 14-day cooldown before queueing
                paid nurture.
              </p>
            </div>
            <div className="mini-stats">
              <div>
                <span>Eligible</span>
                <strong>{defaultPaidAdsReadiness.eligibleCount}</strong>
              </div>
              <div>
                <span>Cooldown</span>
                <strong>{defaultPaidAdsReadiness.skippedCooldownCount}</strong>
              </div>
              <div>
                <span>Terminal</span>
                <strong>{defaultPaidAdsReadiness.skippedTerminalCount}</strong>
              </div>
              <div>
                <span>Opt-out</span>
                <strong>{defaultPaidAdsReadiness.skippedOptOutCount}</strong>
              </div>
            </div>
            {defaultPaidAdsReadiness.candidates.length > 0 ? (
              <div className="preview-list">
                <span className="stat-label">Ready audience preview</span>
                {defaultPaidAdsReadiness.candidates.slice(0, 3).map((candidate) => (
                  <div className="preview-row" key={candidate.leadId}>
                    <strong>{candidate.firstName}</strong>
                    <span>
                      {candidate.source}
                      {candidate.utmCampaign ? ` (${candidate.utmCampaign})` : ""} •{" "}
                      {candidate.destination}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <form action={runPaidAdsCampaign} className="control-form">
            <label>
              Campaign key
              <input defaultValue="paid-ads-default" name="campaignKey" type="text" />
            </label>
            <div className="form-grid">
              <label>
                Lead limit
                <input defaultValue="25" min="1" max="200" name="limit" type="number" />
              </label>
              <label>
                Cooldown days
                <input
                  defaultValue="14"
                  min="1"
                  max="90"
                  name="cooldownDays"
                  type="number"
                />
              </label>
            </div>
            <button className="text-button" type="submit">
              Queue paid nurture
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Record Paid Ad Spend">
          {paidAdsSpendFeedback ? (
            <div className="notice-card">
              <strong>Spend entry recorded</strong>
              <p>
                {paidAdsSpendFeedback.source}
                {paidAdsSpendFeedback.utmCampaign
                  ? ` (${paidAdsSpendFeedback.utmCampaign})`
                  : ""}
              </p>
              <p>
                {paidAdsSpendFeedback.currency} {paidAdsSpendFeedback.amount} •{" "}
                {paidAdsSpendFeedback.reportDate
                  ? formatRelativeIso(paidAdsSpendFeedback.reportDate)
                  : "date unavailable"}
              </p>
            </div>
          ) : null}
          {paidAdsSpendErrorMessage ? (
            <div className="notice-card notice-error">
              <strong>Spend entry blocked</strong>
              <p>{paidAdsSpendErrorMessage}</p>
            </div>
          ) : null}
          <p className="action-warning">
            Logs daily spend by source and optional campaign so Module 4 ROI metrics
            can compute cost per lead, qualified lead, and booking.
          </p>
          <form action={recordPaidAdsSpendEntry} className="control-form">
            <label>
              Source
              <input defaultValue="facebook_ads" name="source" type="text" />
            </label>
            <div className="form-grid">
              <label>
                UTM source (optional)
                <input defaultValue="facebook" name="utmSource" type="text" />
              </label>
              <label>
                UTM campaign (optional)
                <input defaultValue="" name="utmCampaign" type="text" />
              </label>
            </div>
            <div className="form-grid">
              <label>
                Report date (ISO date or datetime)
                <input
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  name="reportDate"
                  type="text"
                />
              </label>
              <label>
                Amount
                <input defaultValue="100" min="0.01" name="amount" step="0.01" type="number" />
              </label>
              <label>
                Currency
                <input defaultValue="USD" maxLength={3} name="currency" type="text" />
              </label>
            </div>
            <button className="text-button" type="submit">
              Record spend
            </button>
          </form>
          <div className="list-block">
            {paidAdsSpendEntries.length === 0 ? (
              <p>No spend entries recorded yet.</p>
            ) : (
              paidAdsSpendEntries.map((entry) => (
                <div className="list-row" key={entry.id}>
                  <div>
                    <strong>{entry.source}</strong>
                    <p>
                      {entry.utmCampaign ? entry.utmCampaign : "no campaign tag"} •{" "}
                      {entry.currency} {entry.amount.toFixed(2)}
                    </p>
                  </div>
                  <time>{formatRelativeIso(entry.reportDate)}</time>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Draft Review Response">
          {reviewsDraftFeedback ? (
            <div className="notice-card">
              <strong>Response draft ready</strong>
              <p>
                {getReviewsDraftSentimentLabel(reviewsDraftFeedback.sentiment)} •{" "}
                {reviewsDraftFeedback.confidence} confidence
              </p>
              <p>{getReviewsDraftActionLabel(reviewsDraftFeedback.suggestedAction)}</p>
              <blockquote className="message-context">
                <span>{reviewsDraftFeedback.promptKey}</span>
                <p>{reviewsDraftFeedback.draft}</p>
              </blockquote>
            </div>
          ) : null}
          {reviewsDraftErrorMessage ? (
            <div className="notice-card notice-error">
              <strong>Draft generation blocked</strong>
              <p>{reviewsDraftErrorMessage}</p>
              <p>Provide feedback text and try again.</p>
            </div>
          ) : null}
          <p className="action-warning">
            Generates a suggested operator reply based on recent client feedback so
            staff can respond consistently and faster.
          </p>
          <form action={generateReviewsResponseDraft} className="control-form">
            <label>
              Client first name (optional)
              <input
                defaultValue=""
                name="customerFirstName"
                placeholder="e.g. Maya"
                type="text"
              />
            </label>
            <label>
              Client feedback message
              <textarea
                defaultValue=""
                name="customerMessage"
                placeholder="Paste the inbound post-visit reply here..."
                rows={4}
              />
            </label>
            <button className="text-button" type="submit">
              Generate draft
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Sales Enablement Snapshot">
          <div className="stats-grid">
            <div className="stat">
              <span className="stat-label">Transcripts</span>
              <strong>{salesEnablementSnapshot.transcriptCount}</strong>
            </div>
            <div className="stat">
              <span className="stat-label">Avg overall</span>
              <strong>{salesEnablementSnapshot.averageOverallScore.toFixed(1)}</strong>
            </div>
            <div className="stat">
              <span className="stat-label">Booking-ready</span>
              <strong>{salesEnablementSnapshot.bookingReadyCount}</strong>
            </div>
            <div className="stat">
              <span className="stat-label">Top objections</span>
              <strong>{salesEnablementSnapshot.objectionCounts.length}</strong>
            </div>
            <div className="stat">
              <span className="stat-label">Rep profiles</span>
              <strong>
                {
                  salesEnablementSnapshot.repPerformance.filter(
                    (rep) => rep.agentName !== "unassigned",
                  ).length
                }
              </strong>
            </div>
          </div>
          <div className="list-block">
            {salesEnablementSnapshot.repPerformance.length === 0 ? (
              <p>No rep coaching metrics available yet.</p>
            ) : (
              salesEnablementSnapshot.repPerformance.map((rep) => (
                <div className="list-row" key={`rep-${rep.agentName}`}>
                  <div>
                    <strong>{rep.agentName}</strong>
                    <p>
                      {rep.transcriptCount} transcript(s) • avg overall{" "}
                      {rep.averageOverallScore.toFixed(1)} • booking-ready{" "}
                      {rep.bookingReadyCount}
                    </p>
                    <p>{rep.coachingFocus}</p>
                  </div>
                  <div className="row-meta">
                    <span className="pill">
                      {rep.topObjection ?? "no dominant objection"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="list-block">
            {salesEnablementSnapshot.transcripts.length === 0 ? (
              <p>No consultation transcripts analyzed yet.</p>
            ) : (
              salesEnablementSnapshot.transcripts.map((transcript) => (
                <div className="list-row" key={transcript.transcriptId}>
                  <div>
                    <strong>{transcript.firstName}</strong>
                    <p>
                      {transcript.agentName ?? "unassigned rep"} •{" "}
                      {transcript.source} • overall {transcript.overallScore}/5
                      {" • "}booking intent {transcript.bookingIntentScore}/5
                    </p>
                    <p>{transcript.summary}</p>
                    <p>{transcript.nextStep}</p>
                  </div>
                  <div className="row-meta">
                    <span className="pill">
                      {transcript.primaryObjection ?? "no major objection"}
                    </span>
                    <time>{formatRelativeIso(transcript.createdAt)}</time>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Capture Consultation Transcript">
          {salesEnablementFeedback ? (
            <div className="notice-card">
              <strong>Transcript captured</strong>
              <p>
                {salesEnablementFeedback.firstName ?? "Client"} • appointment{" "}
                {salesEnablementFeedback.appointmentId.slice(0, 8)}
              </p>
              {salesEnablementFeedback.agentName ? (
                <p>Rep {salesEnablementFeedback.agentName}</p>
              ) : null}
              <p>
                Overall score {salesEnablementFeedback.overallScore ?? "n/a"}
                {salesEnablementFeedback.primaryObjection
                  ? ` • objection: ${salesEnablementFeedback.primaryObjection}`
                  : ""}
              </p>
            </div>
          ) : null}
          {salesEnablementErrorMessage ? (
            <div className="notice-card notice-error">
              <strong>Transcript capture blocked</strong>
              <p>{salesEnablementErrorMessage}</p>
            </div>
          ) : null}
          <p className="action-warning">
            Start Module 5 with one operator-entered consultation transcript tied
            to an existing appointment, then turn it into summary, score, and next-step
            guidance.
          </p>
          <form action={ingestSalesConsultationTranscript} className="control-form">
            <label>
              Appointment ID
              <input
                defaultValue={recentAppointments[0]?.appointmentId ?? ""}
                name="appointmentId"
                placeholder="Paste an existing appointment id"
                type="text"
              />
            </label>
            <label>
              Source
              <select defaultValue="manual" name="source">
                <option value="manual">manual</option>
                <option value="dev_capture">dev_capture</option>
                <option value="callrail">callrail</option>
                <option value="aircall">aircall</option>
                <option value="twilio_voice">twilio_voice</option>
              </select>
            </label>
            <label>
              Rep name (optional)
              <input
                defaultValue=""
                name="agentName"
                placeholder="e.g. Maya"
                type="text"
              />
            </label>
            <label>
              Consultation transcript
              <textarea
                defaultValue=""
                name="transcriptText"
                placeholder="Paste the consultation transcript here..."
                rows={6}
              />
            </label>
            <button className="text-button" type="submit">
              Analyze transcript
            </button>
          </form>
          <div className="list-block">
            {recentAppointments.length === 0 ? (
              <p>No recent appointments available yet.</p>
            ) : (
              recentAppointments.slice(0, 4).map((appointment) => (
                <div className="list-row" key={`sales-${appointment.appointmentId}`}>
                  <div>
                    <strong>{appointment.firstName}</strong>
                    <p>Appointment {appointment.appointmentId}</p>
                  </div>
                  <time>{formatRelativeIso(appointment.startsAt)}</time>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Run Adapter Transcript Sync">
          {salesEnablementSyncFeedback ? (
            <div className="notice-card">
              <strong>Adapter sync completed</strong>
              <p>
                Provider {salesEnablementSyncFeedback.provider} processed{" "}
                {salesEnablementSyncFeedback.candidateCount} candidate record(s).
              </p>
              <p>
                Imported {salesEnablementSyncFeedback.importedCount} • Skipped{" "}
                {salesEnablementSyncFeedback.skippedCount}
              </p>
            </div>
          ) : null}
          {salesEnablementSyncErrorMessage ? (
            <div className="notice-card notice-error">
              <strong>Adapter sync blocked</strong>
              <p>{salesEnablementSyncErrorMessage}</p>
            </div>
          ) : null}
          <p className="action-warning">
            This uses the Module 5 adapter path (`dev_capture`) so we can validate
            import orchestration and idempotent transcript ingestion.
          </p>
          <form action={runSalesEnablementAdapterSync} className="control-form">
            <label>
              Appointment ID
              <input
                defaultValue={recentAppointments[0]?.appointmentId ?? ""}
                name="appointmentId"
                placeholder="Paste an existing appointment id"
                type="text"
              />
            </label>
            <label>
              Rep name (optional)
              <input
                defaultValue="Demo Rep"
                name="agentName"
                placeholder="e.g. Maya"
                type="text"
              />
            </label>
            <label>
              Adapter transcript payload
              <textarea
                defaultValue=""
                name="transcriptText"
                placeholder="Paste transcript text to sync through the adapter path..."
                rows={5}
              />
            </label>
            <button className="text-button" type="submit">
              Run dev adapter sync
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Module 2 Readiness">
          <div className="list-block">
            {module2ReadinessChecks.map((check) => (
              <div className="list-row" key={check.label}>
                <div>
                  <strong>{check.label}</strong>
                  <p>{check.detail}</p>
                </div>
                <span className={`pill ${check.ready ? "ready" : "needs_attention"}`}>
                  {check.ready ? "ready" : "needs attention"}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Module 3 Readiness">
          <div className="list-block">
            {module3ReadinessChecks.map((check) => (
              <div className="list-row" key={check.label}>
                <div>
                  <strong>{check.label}</strong>
                  <p>{check.detail}</p>
                </div>
                <span className={`pill ${check.ready ? "ready" : "needs_attention"}`}>
                  {check.ready ? "ready" : "needs attention"}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Module 4 Readiness">
          <div className="list-block">
            {module4ReadinessChecks.map((check) => (
              <div className="list-row" key={check.label}>
                <div>
                  <strong>{check.label}</strong>
                  <p>{check.detail}</p>
                </div>
                <span className={`pill ${check.ready ? "ready" : "needs_attention"}`}>
                  {check.ready ? "ready" : "needs attention"}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Module 5 Readiness">
          <div className="list-block">
            {module5ReadinessChecks.map((check) => (
              <div className="list-row" key={check.label}>
                <div>
                  <strong>{check.label}</strong>
                  <p>{check.detail}</p>
                </div>
                <span className={`pill ${check.ready ? "ready" : "needs_attention"}`}>
                  {check.ready ? "ready" : "needs attention"}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>

      <section className="grid">
        <article className="panel timeline-panel">
          <h2>Recent Reactivation Runs</h2>
          <div className="run-grid">
            {reactivationRuns.length === 0 ? (
              <p>No reactivation runs recorded yet.</p>
            ) : (
              reactivationRuns.map((run) => (
                <section className="run-card" key={`${run.campaignKey}-${run.runId}`}>
                  <div className="run-header">
                    <div>
                      <strong>{run.campaignKey}</strong>
                      <p>Run {run.runId.slice(0, 8)}</p>
                    </div>
                    <time>{formatRelativeIso(run.lastQueuedAt)}</time>
                  </div>
                  <div className="mini-stats">
                    <div>
                      <span>Queued</span>
                      <strong>{run.queuedCount}</strong>
                    </div>
                    <div>
                      <span>Replied</span>
                      <strong>{run.repliedCount}</strong>
                    </div>
                    <div>
                      <span>Qualified</span>
                      <strong>{run.qualifiedCount}</strong>
                    </div>
                    <div>
                      <span>Booked</span>
                      <strong>{run.bookedCount}</strong>
                    </div>
                  </div>
                </section>
              ))
            )}
          </div>
        </article>

        <article className="panel timeline-panel">
          <h2>Reactivation Follow-Up Queue</h2>
          {queueActionFeedback ? (
            <div
              className={`notice-card ${queueActionFeedback.status === "error" ? "notice-error" : "notice-success"}`}
            >
              <strong>
                {queueActionFeedback.action === "book_slot"
                  ? "Booking action"
                  : "Handle action"}{" "}
                {queueActionFeedback.status === "success" ? "completed" : "blocked"}
              </strong>
              <p>{queueActionFeedback.message}</p>
            </div>
          ) : null}
          <div className="list-block">
            {reactivationQueue.length === 0 ? (
              <p>No open reactivation follow-up items right now.</p>
            ) : (
              reactivationQueue.slice(0, 8).map((item) => (
                <div className="list-row" key={item.queuedEventId}>
                  <div>
                    <strong>{item.firstName}</strong>
                    <p>
                      {item.channel.toUpperCase()} • {item.destination}
                    </p>
                    <p>
                      {item.campaignKey ?? "reactivation-default"} • Run{" "}
                      {(item.runId ?? "legacy-run").slice(0, 8)}
                    </p>
                    {item.lastInboundBody ? (
                      <blockquote className="message-context">
                        <span>
                          Latest reply
                          {item.lastInboundAt
                            ? ` • ${formatRelativeIso(item.lastInboundAt)}`
                            : ""}
                        </span>
                        <p>{item.lastInboundBody}</p>
                      </blockquote>
                    ) : item.lastOutboundBody ? (
                      <blockquote className="message-context">
                        <span>
                          Last sent
                          {item.lastOutboundAt
                            ? ` • ${formatRelativeIso(item.lastOutboundAt)}`
                            : ""}
                        </span>
                        <p>{item.lastOutboundBody}</p>
                      </blockquote>
                    ) : null}
                  </div>
                  <div className="row-meta">
                    <span className={`pill ${item.stage}`}>
                      {getReactivationStageLabel(item.stage)}
                    </span>
                    <time>
                      {formatRelativeIso(
                        item.qualifiedAt ?? item.repliedAt ?? item.queuedAt,
                      )}
                    </time>
                    <p className="action-warning compact-warning">
                      Booking creates an appointment and clears this item. Mark handled
                      clears it without booking.
                    </p>
                    <div className="action-row">
                      {reactivationBookingSlots.length === 0 ? (
                        <span className="muted-note">No open slots</span>
                      ) : (
                        reactivationBookingSlots.map((slot) => (
                          <form action={bookReactivationItemAtSlot} key={slot.startsAt}>
                            <input
                              name="queuedEventId"
                              type="hidden"
                              value={item.queuedEventId}
                            />
                            <input name="contactId" type="hidden" value={item.contactId} />
                            <input name="startsAt" type="hidden" value={slot.startsAt} />
                            <button className="text-button" type="submit">
                              {slot.label}
                            </button>
                          </form>
                        ))
                      )}
                      <form action={markReactivationItemHandled}>
                        <input
                          name="queuedEventId"
                          type="hidden"
                          value={item.queuedEventId}
                        />
                        <input name="contactId" type="hidden" value={item.contactId} />
                        <input
                          name="note"
                          type="hidden"
                          value={`Handled from Module 2 dashboard queue at ${new Date().toISOString()}`}
                        />
                        <button className="text-button text-button-secondary" type="submit">
                          Mark handled
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel timeline-panel">
          <h2>Recent Reactivation Imports</h2>
          <div className="list-block">
            {reactivationImports.length === 0 ? (
              <p>No reactivation imports recorded yet.</p>
            ) : (
              reactivationImports.map((importRecord) => (
                <div className="list-row" key={importRecord.eventId}>
                  <div>
                    <strong>
                      {importRecord.dryRun ? "Dry-run preview" : "CSV import"}
                    </strong>
                    <p>
                      {importRecord.staleLeadCount} stale leads •{" "}
                      {importRecord.pastCustomerCount} past customers
                    </p>
                    <p>
                      {importRecord.createdContactCount} created •{" "}
                      {importRecord.updatedContactCount} updated •{" "}
                      {importRecord.skippedRowCount} skipped
                    </p>
                  </div>
                  <div className="row-meta">
                    <span className="pill">
                      {importRecord.importedCount} ready
                    </span>
                    <time>{formatRelativeIso(importRecord.importedAt)}</time>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel timeline-panel">
          <h2>Recently Handled Reactivation Items</h2>
          <div className="list-block">
            {reactivationHandledItems.length === 0 ? (
              <p>No handled reactivation items recorded yet.</p>
            ) : (
              reactivationHandledItems.map((item) => (
                <div className="list-row" key={`${item.queuedEventId}-${item.handledAt}`}>
                  <div>
                    <strong>{item.firstName}</strong>
                    <p>
                      {item.campaignKey ?? "reactivation-default"} • Run{" "}
                      {(item.runId ?? "legacy-run").slice(0, 8)}
                    </p>
                    {item.note ? <p>{item.note}</p> : null}
                  </div>
                  <div className="row-meta">
                    <span className="pill">handled</span>
                    <time>{formatRelativeIso(item.handledAt)}</time>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel timeline-panel">
          <h2>Recent Appointments</h2>
          <div className="list-block">
            {recentAppointments.length === 0 ? (
              <p>No appointments booked yet.</p>
            ) : (
              recentAppointments.map((appointment) => (
                <div className="list-row" key={appointment.appointmentId}>
                  <div>
                    <strong>{appointment.firstName}</strong>
                    <p>Starts {formatRelativeIso(appointment.startsAt)}</p>
                  </div>
                  <div className="row-meta">
                    <span className="pill">{appointment.outcome ?? "scheduled"}</span>
                    <time>{formatRelativeIso(appointment.createdAt)}</time>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel timeline-panel">
          <h2>Recent Message Timeline</h2>
          <div className="list-block">
            {recentMessages.length === 0 ? (
              <p>No messages recorded yet.</p>
            ) : (
              recentMessages.map((message) => (
                <div className="list-row" key={message.messageId}>
                  <div>
                    <strong>
                      {message.direction === "outbound" ? "Outbound" : "Inbound"}{" "}
                      {message.channel.toUpperCase()}
                    </strong>
                    <p>{message.body}</p>
                    <p>
                      {message.destination} • {message.provider}
                    </p>
                  </div>
                  <div className="row-meta">
                    <span className="pill">{message.status}</span>
                    <time>{formatRelativeIso(message.createdAt)}</time>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel timeline-panel">
          <h2>Conversation Threads</h2>
          <div className="thread-grid">
            {recentThreads.length === 0 ? (
              <p>No threaded conversations yet.</p>
            ) : (
              recentThreads.map((thread) => (
                <section className="thread-card" key={thread.conversationId}>
                  <div className="thread-header">
                    <div>
                      <strong>{thread.contactLabel}</strong>
                      <p>{thread.channel.toUpperCase()}</p>
                    </div>
                    <time>{formatRelativeIso(thread.lastMessageAt)}</time>
                  </div>
                  <div className="thread-messages">
                    {thread.messages.map((message) => (
                      <div
                        className={`bubble ${message.direction === "outbound" ? "bubble-outbound" : "bubble-inbound"}`}
                        key={message.messageId}
                      >
                        <span className="bubble-meta">
                          {message.direction} • {message.status}
                        </span>
                        <p>{message.body}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </article>

        {modules.map((moduleName) => (
          <article className="card" key={moduleName}>
            <h3>{moduleName}</h3>
            <p>Planned as a first-class module on the shared platform.</p>
          </article>
        ))}
      </section>
    </main>
  );
}
