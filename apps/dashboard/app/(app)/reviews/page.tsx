import {
  getReviewReferralOutcomeReport,
} from "@one-system/database";
import { generateReviewsResponseDraft, runReviewsReferralsCampaign } from "../actions";
import { Card } from "../../../components/Card";
import { MetricCard } from "../../../components/MetricCard";

export default async function ReviewsPage() {
  const snapshot = await getReviewReferralOutcomeReport({ workspaceId: "workspace_medspa_demo", limit: 25 });

  return (
    <div className="page-reviews">
      <div className="pulse-bar">
        <MetricCard label="Replies" value={snapshot.repliedCount} status={{ label: 'active', variant: 'green' }} />
        <MetricCard label="Promoters" value={snapshot.promoterCount} status={{ label: 'high', variant: 'green' }} />
        <MetricCard label="Referrals" value={snapshot.referralIntentCount} status={{ label: 'intent', variant: 'amber' }} />
      </div>

      <div className="grid-2">
        <Card title="Run Reviews Campaign">
          <form action={runReviewsReferralsCampaign} className="control-form">
            <div className="form-group">
              <label className="form-label">Campaign Key</label>
              <input className="form-input" name="campaignKey" defaultValue="reviews-referrals-default" />
            </div>
            <button className="btn-primary" type="submit">Queue Outreach</button>
          </form>
        </Card>

        <Card title="Draft Response">
          <form action={generateReviewsResponseDraft} className="control-form">
             <div className="form-group">
              <label className="form-label">Client Feedback</label>
              <textarea className="form-input" name="customerMessage" placeholder="Paste feedback here..." rows={3} />
            </div>
            <button className="btn-primary" type="submit">Generate AI Draft</button>
          </form>
        </Card>
      </div>

      <div className="section-label" style={{ marginTop: '24px' }}>Feedback Feed</div>
      <Card title="Recent Inbound">
        <div className="list-block">
           <p className="td-muted" style={{ padding: '18px' }}>Review/referral feedback feed will appear here as replies are captured.</p>
        </div>
      </Card>
    </div>
  );
}
