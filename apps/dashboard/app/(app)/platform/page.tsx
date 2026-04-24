import { getPlatformFoundationReadiness } from "@one-system/domain";
import { Card } from "../../../components/Card";
import { ReadinessList } from "../../../components/ReadinessList";

export default async function PlatformPage() {
  const readiness = getPlatformFoundationReadiness();

  return (
    <div className="page-platform">
      <div className="section-label">Foundation Roadmap</div>
      <div className="grid-2">
        <Card title="Core Readiness">
          <ReadinessList items={readiness.requirements.map(r => ({
            label: r.label,
            ready: r.status === 'ready',
            detail: r.evidence
          }))} />
        </Card>
        
        <Card title="Shared Registry">
           <ReadinessList items={readiness.modules.map(m => ({
            label: m.label,
            ready: m.status === 'completed',
            detail: m.packageName
          }))} />
        </Card>
      </div>

      <div className="section-label" style={{ marginTop: '24px' }}>System Boundaries</div>
      <Card title="Entity Ownership">
        <div className="list-block">
          <table className="data-table">
            <thead>
              <tr>
                <th>Module</th>
                <th>Owned Entities</th>
              </tr>
            </thead>
            <tbody>
              {readiness.modules.map(m => (
                <tr key={m.packageName}>
                  <td className="td-primary">{m.label}</td>
                  <td className="td-muted">{m.owns.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
