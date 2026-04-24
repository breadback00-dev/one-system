import Link from "next/link";

const tiers = [
  {
    name: "Starter",
    price: "£149",
    period: "/mo",
    blurb: "For a single location finding its feet.",
    features: [
      "Up to 1,000 contacts",
      "Reactivation + Reviews modules",
      "Email + SMS outreach (Twilio passthrough)",
      "One workspace, one user",
    ],
    cta: "Start with Starter",
  },
  {
    name: "Growth",
    price: "£399",
    period: "/mo",
    blurb: "For a growing operator running real campaigns.",
    features: [
      "Up to 10,000 contacts",
      "All five modules",
      "Paid-ads attribution + ROI reporting",
      "AI review-response drafting",
      "Up to 5 users",
    ],
    cta: "Choose Growth",
    highlighted: true,
  },
  {
    name: "Scale",
    price: "Custom",
    period: "",
    blurb: "Multi-location, white-glove onboarding, custom integrations.",
    features: [
      "Unlimited contacts",
      "Dedicated CRM sync + custom integrations",
      "SLA-backed support",
      "Multi-workspace + role-based access",
    ],
    cta: "Talk to us",
  },
];

export default function PricingPage() {
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

      <section className="hero hero-compact">
        <div className="hero-inner">
          <div className="hero-eyebrow">Pricing</div>
          <h1 className="hero-title hero-title-compact">
            One platform. Three plans. No per-module fees.
          </h1>
          <p className="hero-lede">
            Start on the tier that matches your contact volume. Everything
            scales up from the same data model — no re-onboarding when you
            grow.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="section-inner">
          <div className="pricing-grid">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`pricing-card${tier.highlighted ? " pricing-card-highlight" : ""}`}
              >
                {tier.highlighted && (
                  <div className="pricing-badge">Most chosen</div>
                )}
                <h3 className="pricing-name">{tier.name}</h3>
                <div className="pricing-price">
                  <span className="pricing-amount">{tier.price}</span>
                  {tier.period && (
                    <span className="pricing-period">{tier.period}</span>
                  )}
                </div>
                <p className="pricing-blurb">{tier.blurb}</p>
                <ul className="pricing-features">
                  {tier.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <Link
                  href="/dashboard"
                  className={
                    tier.highlighted ? "btn-primary btn-block" : "btn-ghost btn-block"
                  }
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
          <div className="pricing-note">
            SMS and email delivery costs are billed at cost through your own
            Twilio and email provider. We don&apos;t mark them up.
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
