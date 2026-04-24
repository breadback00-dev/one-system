import {
  getReactivationOutcomeReport,
  getRecentReactivationRunSummaries,
  getReactivationActionQueue,
} from "@one-system/database";
import { runReactivationCampaign } from "../actions";
import { formatRelativeIso } from "../../../lib/format";
import { Card } from "../../../components/Card";
import { MetricCard } from "../../../components/MetricCard";

export default async function ReactivationPage() {
  const [snapshot, runs, queue] = await Promise.all([
    getReactivationOutcomeReport({ workspaceId: workspaceId, limit: 25 }),
    getRecentReactivationRunSummaries({ workspaceId: workspaceId, limit: 10 }),
    getReactivationActionQueue({ workspaceId: workspaceId, limit: 25 }),
  ]);

  return (
    <div className="page-reactivation">
      <div className="pulse-bar">
        <MetricCard label="Queued" value={snapshot.queuedCount} status={{ label: 'active', variant: 'blue' }} />
        <MetricCard label="Replied" value={snapshot.repliedCount} status={{ label: 'ready', variant: 'green' }} />
        <MetricCard label="Qualified" value={snapshot.qualifiedCount} status={{ label: 'high', variant: 'green' }} />
        <MetricCard label="Booked" value={snapshot.bookedCount} status={{ label: 'goal', variant: 'green' }} />
      </div>

      <div className="grid-2">
        <Card title="Run Campaign">
          <form action={runReactivationCampaign} className="control-form">
            <div className="form-group">
              <label className="form-label">Campaign Key</label>
              <input className="form-input" name="campaignKey" defaultValue="reactivation-default" />
            </div>
            <div className="form-group">
              <label className="form-label">Audience</label>
              <select className="form-select" name="audienceSegment">
                <option value="all">All Dormant</option>
                <option value="stale_leads">Stale Leads</option>
                <option value="past_customers">Past Customers</option>
              </select>
            </div>
            <button className="btn-primary" type="submit">Queue Outreach</button>
          </form>
        </Card>

        <Card title="Recent Runs">
          <div className="list-block">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Booked</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(run => (
                  <tr key={run.runId}>
                    <td className="td-primary">{run.campaignKey}</td>
                    <td className="td-num">{run.bookedCount}</td>
                    <td className="td-muted">{formatRelativeIso(run.lastQueuedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="section-label" style={{ marginTop: '24px' }}>Action Queue</div>
      <Card title="Waiting for Follow-up">
        <div className="list-block">
          <table className="data-table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Stage</th>
                <th>Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {queue.map(item => (
                <tr key={item.queuedEventId}>
                  <td className="td-primary">{item.firstName}</td>
                  <td><span className="pill pill-amber">{item.stage.replace(/_/g, ' ')}</span></td>
                  <td className="td-muted">{formatRelativeIso(item.qualifiedAt ?? item.repliedAt ?? item.queuedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

