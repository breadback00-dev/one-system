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
} from "../actions";
import { previewPaidAdsRun } from "@one-system/paid-ads";
import { previewReactivationRun } from "@one-system/reactivation";
import { previewReviewsReferralsRun } from "@one-system/reviews-referrals";
import {
  getQueueActionFeedback,
  getReactivationRunErrorMessage,
  getReactivationRunFeedback,
} from "../reactivation-feedback";
import {
  getReviewsDraftErrorMessage,
  getReviewsDraftFeedback,
  getReviewsRunErrorMessage,
  getReviewsRunFeedback,
} from "../reviews-referrals-feedback";
import {
  getPaidAdsRunErrorMessage,
  getPaidAdsRunFeedback,
  getPaidAdsSpendErrorMessage,
  getPaidAdsSpendFeedback,
} from "../paid-ads-feedback";
import {
  getSalesEnablementErrorMessage,
  getSalesEnablementFeedback,
  getSalesEnablementSyncErrorMessage,
  getSalesEnablementSyncFeedback,
} from "../sales-enablement-feedback";
import { getPlatformFoundationReadiness } from "@one-system/domain";
import { MetricCard } from "../../../components/MetricCard";
import { Card } from "../../../components/Card";
import { ReadinessList } from "../../../components/ReadinessList";
import { FunnelChart } from "../../../components/FunnelChart";
import { getCurrentWorkspace } from "../../../lib/workspace";

const modules = [
  "Lead Capture + Instant Follow-Up",
  "Database Reactivation",
  "Reviews + Referrals",
  "Paid Ads + Lead Nurturing",
  "Sales Enablement",
];

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

function formatRelativeIso(iso: string | Date) {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
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
  const reactivationRunFeedback = getReactivationRunFeedback(resolvedSearchParams);
  const reactivationRunErrorMessage = getReactivationRunErrorMessage(resolvedSearchParams);
  const queueActionFeedback = getQueueActionFeedback(resolvedSearchParams);
  const reviewsRunFeedback = getReviewsRunFeedback(resolvedSearchParams);
  const reviewsRunErrorMessage = getReviewsRunErrorMessage(resolvedSearchParams);
  const reviewsDraftFeedback = getReviewsDraftFeedback(resolvedSearchParams);
  const reviewsDraftErrorMessage = getReviewsDraftErrorMessage(resolvedSearchParams);
  const paidAdsRunFeedback = getPaidAdsRunFeedback(resolvedSearchParams);
  const paidAdsRunErrorMessage = getPaidAdsRunErrorMessage(resolvedSearchParams);
  const paidAdsSpendFeedback = getPaidAdsSpendFeedback(resolvedSearchParams);
  const paidAdsSpendErrorMessage = getPaidAdsSpendErrorMessage(resolvedSearchParams);
  const salesEnablementFeedback = getSalesEnablementFeedback(resolvedSearchParams);
  const salesEnablementErrorMessage = getSalesEnablementErrorMessage(resolvedSearchParams);
  const salesEnablementSyncFeedback = getSalesEnablementSyncFeedback(resolvedSearchParams);
  const salesEnablementSyncErrorMessage = getSalesEnablementSyncErrorMessage(resolvedSearchParams);
  const platformReadiness = getPlatformFoundationReadiness();
  const { id: workspaceId } = await getCurrentWorkspace();

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
    getAvailableBookingSlots({ workspaceId: workspaceId, limit: 4 }),
    previewReactivationRun({
      workspaceId: workspaceId,
      inactiveDays: 30,
      limit: 25,
      cooldownDays: 14,
      campaignKey: "reactivation-default",
      audienceSegment: "all",
    }),
    previewReviewsReferralsRun({
      workspaceId: workspaceId,
      completedDaysAgo: 2,
      limit: 25,
      cooldownDays: 14,
      campaignKey: "reviews-referrals-default",
    }),
    previewPaidAdsRun({
      workspaceId: workspaceId,
      limit: 25,
      cooldownDays: 14,
      campaignKey: "paid-ads-default",
    }),
    getReactivationOutcomeReport({ workspaceId: workspaceId, limit: 25 }),
    getReviewReferralOutcomeReport({ workspaceId: workspaceId, limit: 25 }),
    getPaidAdsOutcomeReport({ workspaceId: workspaceId, limit: 50 }),
    getRecentPaidAdsSpendEntries({ workspaceId: workspaceId, limit: 6 }),
    getRecentReactivationRunSummaries({ workspaceId: workspaceId, limit: 6 }),
    getReactivationActionQueue({ workspaceId: workspaceId, limit: 25 }),
    getRecentReactivationImports({ workspaceId: workspaceId, limit: 5 }),
    getRecentReactivationHandledItems({ workspaceId: workspaceId, limit: 6 }),
    getRecentLeadOverview(),
    getRecentAppointmentOverview(),
    getRecentMessageTimeline(),
    getRecentConversationThreads(),
    getSalesEnablementReport({ workspaceId: workspaceId, limit: 12 }),
  ]);

  const liveImports = reactivationImports.filter((record) => !record.dryRun);
  const dryRunImports = reactivationImports.filter((record) => record.dryRun);
  
  const module2ReadinessChecks = getModule2ReadinessChecks({
    liveImportCount: liveImports.length,
    dryRunImportCount: dryRunImports.length,
    importedContactCount: liveImports.reduce((sum, record) => sum + record.importedCount, 0),
    eligibleCount: defaultReactivationReadiness.eligibleCount,
    runCount: reactivationRuns.length,
    bookingSlotCount: reactivationBookingSlots.length,
    qualifiedQueueCount: reactivationQueue.filter((item) => item.stage === "qualified_waiting_booking").length,
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
    spendAmount: paidAdsSpendEntries.reduce((sum, entry) => sum + entry.amount, 0),
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
    namedRepCount: salesEnablementSnapshot.repPerformance.filter((rep) => rep.agentName !== "unassigned").length,
  });

  return (
    <>
      {/* ── OVERVIEW ── */}
      <div className="pulse-bar">
        <MetricCard 
          label="Lead Capture" 
          value={funnelSnapshot.newLeads} 
          subtitle="new leads · last 7d" 
          status={{ label: 'ready', variant: 'green' }}
        />
        <MetricCard 
          label="Reactivation" 
          value={defaultReactivationReadiness.eligibleCount} 
          subtitle="contacts eligible" 
          status={{ label: 'ready', variant: 'green' }}
        />
        <MetricCard 
          label="Reviews & Referrals" 
          value={reviewsSnapshot.repliedCount} 
          subtitle="replies captured" 
          status={{ label: 'ready', variant: 'amber' }}
        />
        <MetricCard 
          label="Paid Ads" 
          value={paidAdsSnapshot.qualifiedCount} 
          subtitle="qualified nurture" 
          status={{ label: 'ready', variant: 'green' }}
        />
        <MetricCard 
          label="Sales Enablement" 
          value={salesEnablementSnapshot.transcriptCount} 
          subtitle="consultations" 
          status={{ label: 'ready', variant: 'blue' }}
        />
      </div>

      {/* ── PLATFORM FOUNDATION ── */}
      <div className="section-label">Platform Foundation</div>
      <div className="grid-2">
        <Card title="Foundation Closure">
          <ReadinessList items={platformReadiness.requirements.map(r => ({
            label: r.label,
            ready: r.status === 'ready',
            detail: r.evidence
          }))} />
        </Card>
        <Card title="Module Registry">
          <ReadinessList items={platformReadiness.modules.map(m => ({
            label: m.label,
            ready: m.status === 'completed',
            detail: m.packageName
          }))} />
        </Card>
      </div>

      {/* ── PERFORMANCE ── */}
      <div className="section-label">Performance & Outcomes</div>
      <div className="grid-3">
        <Card title="Funnel Snapshot">
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
          <div style={{ marginTop: '24px' }}>
            <FunnelChart steps={[
              { label: 'Leads', value: funnelSnapshot.newLeads, color: 'var(--blue)' },
              { label: 'Responded', value: funnelSnapshot.respondedLeads, color: 'var(--amber)' },
              { label: 'Qualified', value: funnelSnapshot.qualifiedLeads, color: 'var(--accent)' },
              { label: 'Booked', value: funnelSnapshot.bookedAppointments, color: 'var(--green)' }
            ]} />
          </div>
        </Card>
        <Card title="Delivery Tracking">
           <div className="list-block">
            {deliveryStatus.recentDelivered.length === 0 ? (
              <p className="td-muted" style={{ padding: '12px' }}>No recent deliveries.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Channel</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryStatus.recentDelivered.slice(0, 5).map((delivery) => (
                    <tr key={delivery.queuedEventId}>
                      <td className="td-primary">{delivery.channel.toUpperCase()}</td>
                      <td className="td-muted">{formatRelativeIso(delivery.deliveredAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
        <Card title="Recent Leads">
          <div className="list-block">
            {recentLeads.length === 0 ? (
              <p className="td-muted" style={{ padding: '12px' }}>No recent leads.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLeads.slice(0, 5).map((lead) => (
                    <tr key={lead.leadId}>
                      <td className="td-primary">{lead.firstName}</td>
                      <td><span className="pill pill-muted">{lead.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>

      {/* ── MODULE SPECIFICS ── */}
      <div className="section-label">Module Readiness</div>
      <div className="grid-2">
        <Card title="Reactivation Readiness">
          <ReadinessList items={module2ReadinessChecks.map(c => ({
            label: c.label,
            ready: c.ready,
            detail: c.detail
          }))} />
        </Card>
        <Card title="Reviews & Referrals Readiness">
          <ReadinessList items={module3ReadinessChecks.map(c => ({
            label: c.label,
            ready: c.ready,
            detail: c.detail
          }))} />
        </Card>
      </div>

      <div className="grid-2" style={{ marginTop: '16px' }}>
        <Card title="Paid Ads Readiness">
          <ReadinessList items={module4ReadinessChecks.map(c => ({
            label: c.label,
            ready: c.ready,
            detail: c.detail
          }))} />
        </Card>
        <Card title="Sales Enablement Readiness">
          <ReadinessList items={module5ReadinessChecks.map(c => ({
            label: c.label,
            ready: c.ready,
            detail: c.detail
          }))} />
        </Card>
      </div>

      {/* ── OPERATIONS ── */}
      <div className="section-label">Operations</div>
      <div className="grid-2">
        <Card title="Run Reactivation">
          {reactivationRunFeedback && (
            <div className="alert alert-green">
              <div className="alert-title">Campaign queued</div>
              {reactivationRunFeedback.queuedCount} contacts successfully queued.
            </div>
          )}
          <form action={runReactivationCampaign} className="control-form">
            <div className="form-group">
              <label className="form-label">Campaign key</label>
              <input className="form-input" defaultValue="reactivation-default" name="campaignKey" />
            </div>
            <div className="form-group">
              <label className="form-label">Audience</label>
              <select className="form-select" defaultValue="all" name="audienceSegment">
                <option value="all">All dormant contacts</option>
                <option value="stale_leads">Stale leads</option>
                <option value="past_customers">Past customers</option>
              </select>
            </div>
            <button className="btn-primary" type="submit">Queue outreach</button>
          </form>
        </Card>

        <Card title="Record Ad Spend">
          {paidAdsSpendFeedback && (
            <div className="alert alert-green">
              <div className="alert-title">Spend recorded</div>
              {paidAdsSpendFeedback.currency} {paidAdsSpendFeedback.amount} for {paidAdsSpendFeedback.source}.
            </div>
          )}
          <form action={recordPaidAdsSpendEntry} className="control-form">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Source</label>
                <input className="form-input" defaultValue="facebook_ads" name="source" />
              </div>
              <div className="form-group">
                <label className="form-label">Amount</label>
                <input className="form-input" defaultValue="100" name="amount" type="number" />
              </div>
            </div>
            <button className="btn-primary" type="submit">Log spend</button>
          </form>
        </Card>
      </div>

      {/* ── RECENT ACTIVITY ── */}
      <div className="section-label">Recent Activity</div>
      <div className="grid-2">
        <Card title="Conversation Threads">
          <div className="thread-list">
            {recentThreads.length === 0 ? (
              <p style={{ padding: '18px', color: 'var(--muted)' }}>No recent threads.</p>
            ) : (
              recentThreads.slice(0, 5).map((thread) => (
                <div className="thread-row" key={thread.conversationId}>
                  <div className="thread-avatar">{thread.contactLabel.slice(0, 1)}</div>
                  <div className="thread-body">
                    <div className="thread-name">{thread.contactLabel}</div>
                    <div className="thread-preview">{thread.messages[0]?.body || 'No messages'}</div>
                  </div>
                  <div className="thread-time">{formatRelativeIso(thread.lastMessageAt)}</div>
                </div>
              ))
            )}
          </div>
        </Card>
        <Card title="Sales Enablement">
          <div className="list-block">
            {salesEnablementSnapshot.repPerformance.slice(0, 5).map((rep) => (
              <div className="module-row" key={rep.agentName}>
                <div className="module-num">{rep.transcriptCount}</div>
                <div className="module-name">{rep.agentName}</div>
                <div className="pill pill-blue">{rep.averageOverallScore.toFixed(1)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

