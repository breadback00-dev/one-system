import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="marketing">
      <header className="marketing-nav">
        <div className="marketing-nav-inner">
          <Link href="/" className="marketing-brand">
            <span className="marketing-brand-name">One System</span>
          </Link>
          <nav className="marketing-nav-links">
            <Link href="/pricing">Pricing</Link>
            <Link href="/dashboard" className="marketing-nav-cta">
              Try the demo →
            </Link>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <div className="hero-eyebrow">Operator platform</div>
          <h1 className="hero-title">
            One system for every customer<br />
            an appointment business sees.
          </h1>
          <p className="hero-lede">
            Capture, nurture, reactivate, review, and convert — on one platform
            with shared data and workflows. Built for local service businesses
            that live on leads, reviews, and repeat visits.
          </p>
          <div className="hero-ctas">
            <Link href="/dashboard" className="btn-primary btn-lg">
              Try the live demo
            </Link>
            <Link href="/pricing" className="btn-ghost btn-lg">
              See pricing
            </Link>
          </div>
          <div className="hero-meta">
            No signup required · Pre-seeded with realistic data
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-inner">
          <div className="section-label">The problem</div>
          <h2 className="section-title">
            Your growth stack is five tools in a trench coat.
          </h2>
          <p className="section-lede">
            CRM in one place, texts in another, reviews somewhere else, ad spend
            in a fourth, and a booking tool glued on top. Every week you lose
            revenue in the gaps — dormant customers never reactivated, reviews
            never requested, leads followed up too slowly, and no one answer to
            the question that matters: <em>what actually drove this month?</em>
          </p>
        </div>
      </section>

      <section className="section section-tint">
        <div className="section-inner">
          <div className="section-label">How it works</div>
          <h2 className="section-title">Three steps. One workspace.</h2>
          <div className="steps">
            <div className="step">
              <div className="step-num">01</div>
              <h3>Connect your data</h3>
              <p>
                Import dormant contacts from your CRM, wire your ad accounts,
                point your booking tool at our webhook. Works with the CRM you
                already have — we don&apos;t replace it.
              </p>
            </div>
            <div className="step">
              <div className="step-num">02</div>
              <h3>Run a campaign</h3>
              <p>
                Queue an outreach campaign for dormant contacts, a review
                request flow for recent visits, or a follow-up sequence for new
                leads. Every run is audience-selected, cooldown-aware, and
                measurable.
              </p>
            </div>
            <div className="step">
              <div className="step-num">03</div>
              <h3>See what moved revenue</h3>
              <p>
                One funnel across every module. Which campaign booked, which
                source paid back, which customer you forgot to follow up with.
                No spreadsheet reconciliation required.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-inner">
          <div className="section-label">Modules</div>
          <h2 className="section-title">Five modules. One shipped, four in preview.</h2>
          <p className="section-lede" style={{ marginBottom: "40px" }}>
            Database Reactivation is live end-to-end. The other four are
            surface-complete with real server actions, real data models, and a
            consistent UI — actively hardening toward full production readiness.
          </p>

          {/* Flagship */}
          <div className="module-card module-card-flagship">
            <div className="module-card-flagship-head">
              <div className="module-dot module-dot-green" />
              <span className="module-status-live">Live</span>
            </div>
            <h3>Database Reactivation</h3>
            <p>
              Import dormant contacts from your CRM, select an audience segment,
              run a cooldown-aware outreach campaign, track replies and
              qualification, book via a generated booking link. Every stage
              measurable in the dashboard.
            </p>
            <Link href="/reactivation" className="btn-ghost" style={{ marginTop: "20px", display: "inline-flex" }}>
              See it in the demo →
            </Link>
          </div>

          {/* Other four */}
          <div className="modules-grid" style={{ marginTop: "16px" }}>
            {[
              {
                label: "Lead Capture",
                desc: "Instant follow-up on every inbound lead. Missed-call text-back, qualification, and booking handoff.",
                color: "amber",
              },
              {
                label: "Reviews & Referrals",
                desc: "Post-visit review flows, AI-drafted responses, and a referral loop that tracks who sent who.",
                color: "amber",
              },
              {
                label: "Paid Ads",
                desc: "Source attribution and cost-per-booking reporting for the paid channels you already run.",
                color: "amber",
              },
              {
                label: "Sales Enablement",
                desc: "Consultation transcripts, objection libraries, and post-call follow-up to close more consultations.",
                color: "amber",
              },
            ].map((m) => (
              <div key={m.label} className="module-card">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div className={`module-dot module-dot-${m.color}`} />
                  <span className="module-status-preview">Preview</span>
                </div>
                <h3>{m.label}</h3>
                <p>{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-tint">
        <div className="section-inner cta-inner">
          <h2 className="section-title">See it run in under a minute.</h2>
          <p className="section-lede">
            The demo is a live workspace with realistic data — not a video, not
            a mockup. Click around, queue a reactivation campaign, see the
            result.
          </p>
          <div className="hero-ctas">
            <Link href="/dashboard" className="btn-primary btn-lg">
              Open the demo workspace
            </Link>
          </div>
        </div>
      </section>

      <footer className="marketing-footer">
        <div className="marketing-footer-inner">
          <div>
            <div className="marketing-brand-name">One System</div>
            <div className="footer-sub">
              Operator platform for appointment businesses.
            </div>
          </div>
          <div className="footer-links">
            <Link href="/pricing">Pricing</Link>
            <Link href="/dashboard">Demo</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
