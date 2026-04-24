import {
  getPaidAdsOutcomeReport,
  getRecentPaidAdsSpendEntries,
} from "@one-system/database";
import { recordPaidAdsSpendEntry } from "../actions";
import { formatRelativeIso } from "../../../lib/format";
import { getCurrentWorkspace } from "../../../lib/workspace";
import { Card } from "../../../components/Card";
import { MetricCard } from "../../../components/MetricCard";

export default async function AdsPage() {
  const workspaceId = (await getCurrentWorkspace()).id;

  const [snapshot, spendEntries] = await Promise.all([
    getPaidAdsOutcomeReport({ workspaceId: workspaceId, limit: 50 }),
    getRecentPaidAdsSpendEntries({ workspaceId: workspaceId, limit: 20 }),
  ]);

  const totalSpend = spendEntries.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="page-ads">
      <div className="pulse-bar">
        <MetricCard label="Spend (Recent)" value={`$${totalSpend.toFixed(2)}`} status={{ label: 'tracking', variant: 'blue' }} />
        <MetricCard label="Qualified" value={snapshot.qualifiedCount} status={{ label: 'ready', variant: 'green' }} />
        <MetricCard label="CPL" value={`$${(totalSpend / (snapshot.qualifiedCount || 1)).toFixed(2)}`} status={{ label: 'metric', variant: 'amber' }} />
      </div>

      <div className="grid-2">
        <Card title="Log Daily Spend">
          <form action={recordPaidAdsSpendEntry} className="control-form">
            <div className="form-group">
              <label className="form-label">Source</label>
              <input className="form-input" name="source" defaultValue="facebook_ads" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Amount</label>
                <input className="form-input" name="amount" type="number" defaultValue="100" />
              </div>
              <div className="form-group">
                <label className="form-label">Currency</label>
                <input className="form-input" name="currency" defaultValue="USD" />
              </div>
            </div>
            <button className="btn-primary" type="submit">Record Entry</button>
          </form>
        </Card>

        <Card title="Spend History">
          <div className="list-block">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Amount</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {spendEntries.slice(0, 10).map(entry => (
                  <tr key={entry.id}>
                    <td className="td-primary">{entry.source}</td>
                    <td className="td-num">${entry.amount.toFixed(2)}</td>
                    <td className="td-muted">{formatRelativeIso(entry.reportDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="section-label" style={{ marginTop: '24px' }}>Attribution Breakdown</div>
      <Card title="Source Performance">
        <div className="list-block">
          <table className="data-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Campaign</th>
                <th>Leads</th>
                <th>Qualified</th>
                <th>Booked</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.rows.map((row, idx) => (
                <tr key={idx}>
                  <td className="td-primary">{row.source}</td>
                  <td className="td-muted">{row.utmCampaign || 'organic'}</td>
                  <td className="td-num">{row.leadCount}</td>
                  <td className="td-num">{row.qualifiedCount}</td>
                  <td className="td-num">{row.bookedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

