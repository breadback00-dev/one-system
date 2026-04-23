import {
  getDashboardFunnelSnapshot,
  getReactivationActionQueue,
  getReactivationOutcomeReport,
  getRecentReactivationRunSummaries,
  getRecentAppointmentOverview,
  getRecentConversationThreads,
  getRecentReactivationHandledItems,
  getDeliveryStatus,
  getRecentLeadOverview,
  getRecentMessageTimeline,
} from "@one-system/database";
import { SectionCard } from "@one-system/ui";
import {
  bookReactivationItemTomorrow,
  markReactivationItemHandled,
} from "./actions";

const modules = [
  "Lead Capture + Instant Follow-Up",
  "Database Reactivation",
  "Reviews + Referrals",
  "Paid Ads + Lead Nurturing",
  "Sales Enablement",
];

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

export default async function HomePage() {
  const [
    deliveryStatus,
    funnelSnapshot,
    reactivationSnapshot,
    reactivationRuns,
    reactivationQueue,
    reactivationHandledItems,
    recentLeads,
    recentAppointments,
    recentMessages,
    recentThreads,
  ] = await Promise.all([
    getDeliveryStatus(),
    getDashboardFunnelSnapshot(),
    getReactivationOutcomeReport({
      workspaceId: "workspace_medspa_demo",
      limit: 25,
    }),
    getRecentReactivationRunSummaries({
      workspaceId: "workspace_medspa_demo",
      limit: 6,
    }),
    getReactivationActionQueue({
      workspaceId: "workspace_medspa_demo",
      limit: 8,
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
          <div className="list-block">
            {reactivationQueue.length === 0 ? (
              <p>No open reactivation follow-up items right now.</p>
            ) : (
              reactivationQueue.map((item) => (
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
                    <div className="action-row">
                      <form action={bookReactivationItemTomorrow}>
                        <input
                          name="queuedEventId"
                          type="hidden"
                          value={item.queuedEventId}
                        />
                        <input name="contactId" type="hidden" value={item.contactId} />
                        <button className="text-button" type="submit">
                          Book tomorrow
                        </button>
                      </form>
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
