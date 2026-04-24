import {
  getSalesEnablementReport,
  getRecentAppointmentOverview,
} from "@one-system/database";
import { ingestSalesConsultationTranscript } from "../actions";
import { formatRelativeIso } from "../../../lib/format";
import { Card } from "../../../components/Card";
import { MetricCard } from "../../../components/MetricCard";

export default async function SalesPage() {
  const [snapshot, appointments] = await Promise.all([
    getSalesEnablementReport({ workspaceId: "workspace_medspa_demo", limit: 12 }),
    getRecentAppointmentOverview(),
  ]);

  return (
    <div className="page-sales">
      <div className="pulse-bar">
        <MetricCard label="Transcripts" value={snapshot.transcriptCount} status={{ label: 'analyzed', variant: 'blue' }} />
        <MetricCard label="Avg. Score" value={snapshot.averageOverallScore.toFixed(1)} status={{ label: 'quality', variant: 'green' }} />
        <MetricCard label="Booking Ready" value={snapshot.bookingReadyCount} status={{ label: 'hot', variant: 'red' }} />
      </div>

      <div className="grid-2">
        <Card title="Analyze Transcript">
          <form action={ingestSalesConsultationTranscript} className="control-form">
            <div className="form-group">
              <label className="form-label">Appointment ID</label>
              <input className="form-input" name="appointmentId" defaultValue={appointments[0]?.appointmentId || ''} />
            </div>
            <div className="form-group">
              <label className="form-label">Transcript Text</label>
              <textarea className="form-input" name="transcriptText" placeholder="Paste consultation text..." rows={4} />
            </div>
            <button className="btn-primary" type="submit">Score Consultation</button>
          </form>
        </Card>

        <Card title="Rep Performance">
          <div className="list-block">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rep</th>
                  <th>Count</th>
                  <th>Avg Score</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.repPerformance.filter(r => r.agentName !== 'unassigned').map(rep => (
                  <tr key={rep.agentName}>
                    <td className="td-primary">{rep.agentName}</td>
                    <td className="td-num">{rep.transcriptCount}</td>
                    <td><span className="pill pill-blue">{rep.averageOverallScore.toFixed(1)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="section-label" style={{ marginTop: '24px' }}>Recent Insights</div>
      <Card title="Consultation Summaries">
        <div className="list-block">
          {snapshot.transcripts.slice(0, 5).map(t => (
            <div className="thread-row" key={t.transcriptId}>
              <div className="thread-avatar">{t.firstName.slice(0,1)}</div>
              <div className="thread-body">
                <div className="thread-name">{t.firstName} • {t.agentName || 'Unassigned'}</div>
                <div className="thread-preview">{t.summary}</div>
              </div>
              <div className="thread-time">{formatRelativeIso(t.createdAt)}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
