import {
  getDashboardFunnelSnapshot,
  getAvailableBookingSlots,
  getReactivationActionQueue,
  getReactivationOutcomeReport,
  getReviewReferralOutcomeReport,
  getRecentReactivationRunSummaries,
  getRecentAppointmentOverview,
  getRecentConversationThreads,
  getRecentReactivationImports,
  getRecentReactivationHandledItems,
  getDeliveryStatus,
  getRecentLeadOverview,
  getRecentMessageTimeline,
} from "@one-system/database";
import { SectionCard } from "@one-system/ui";
import {
  bookReactivationItemAtSlot,
  generateReviewsResponseDraft,
  markReactivationItemHandled,
  runReactivationCampaign,
  runReviewsReferralsCampaign,
} from "./actions";
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
  const [
    deliveryStatus,
    funnelSnapshot,
    reactivationBookingSlots,
    defaultReactivationReadiness,
    defaultReviewsReadiness,
    reactivationSnapshot,
    reviewsSnapshot,
    reactivationRuns,
    reactivationQueue,
    reactivationImports,
    reactivationHandledItems,
    recentLeads,
    recentAppointments,
    recentMessages,
    recentThreads,
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
    getReactivationOutcomeReport({
      workspaceId: "workspace_medspa_demo",
      limit: 25,
    }),
    getReviewReferralOutcomeReport({
      workspaceId: "workspace_medspa_demo",
      limit: 25,
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
          Platform foundation, lead intake, worker-based message delivery, and
          the first end-to-end follow-up workflow on real Postgres persistence.
        </p>
      </section>

      <section className="ops-grid">
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
                      {lead.source} • {lead.contactChannel}
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
