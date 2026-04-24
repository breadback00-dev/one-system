import {
  getDashboardFunnelSnapshot,
  getRecentLeadOverview,
  getDeliveryStatus,
} from "@one-system/database";
import { formatRelativeIso } from "../../../lib/format";
import { Card } from "../../../components/Card";

export default async function LeadsPage() {
  const [funnelSnapshot, recentLeads, deliveryStatus] = await Promise.all([
    getDashboardFunnelSnapshot(),
    getRecentLeadOverview(),
    getDeliveryStatus(),
  ]);

  return (
    <div className="page-leads">
      <div className="section-label">Funnel Snapshot</div>
      <div className="grid-3">
        <Card title="Funnel Velocity">
          <div className="stats-grid">
            <div className="stat">
              <span className="stat-label">New Leads</span>
              <strong>{funnelSnapshot.newLeads}</strong>
            </div>
            <div className="stat">
              <span className="stat-label">Responded</span>
              <strong>{funnelSnapshot.respondedLeads}</strong>
            </div>
            <div className="stat">
              <span className="stat-label">Booked</span>
              <strong>{funnelSnapshot.bookedAppointments}</strong>
            </div>
          </div>
        </Card>
        
        <Card title="Recent Activity">
          <div className="list-block">
             <table className="data-table">
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLeads.slice(0, 8).map((lead) => (
                    <tr key={lead.leadId}>
                      <td className="td-primary">{lead.firstName}</td>
                      <td><span className="pill pill-muted">{lead.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>
        </Card>

        <Card title="Delivery Status">
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
                  {deliveryStatus.recentDelivered.slice(0, 8).map((delivery) => (
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
      </div>
    </div>
  );
}
