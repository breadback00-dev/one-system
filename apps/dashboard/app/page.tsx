import {
  getRecentConversationThreads,
  getDeliveryStatus,
  getRecentLeadOverview,
  getRecentMessageTimeline,
} from "@one-system/database";
import { SectionCard } from "@one-system/ui";

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

export default async function HomePage() {
  const [deliveryStatus, recentLeads, recentMessages, recentThreads] = await Promise.all([
    getDeliveryStatus(),
    getRecentLeadOverview(),
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
      </section>

      <section className="grid">
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
