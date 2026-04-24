import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

export default async function DemoPage() {
  const { userId } = await auth();

  // Signed-in users go straight to their own workspace
  if (userId) redirect("/dashboard");

  return (
    <div className="marketing">
      <header className="marketing-nav">
        <div className="marketing-nav-inner">
          <Link href="/" className="marketing-brand">
            <span className="marketing-brand-name">One System</span>
          </Link>
          <nav className="marketing-nav-links">
            <Link href="/pricing">Pricing</Link>
            <Link href="/sign-up" className="marketing-nav-cta">
              Sign up →
            </Link>
          </nav>
        </div>
      </header>

      <section className="hero hero-compact">
        <div className="hero-inner">
          <div className="hero-eyebrow">Live demo</div>
          <h1 className="hero-title hero-title-compact">
            This is a real workspace.<br />Not a video.
          </h1>
          <p className="hero-lede">
            You&apos;re about to enter a pre-seeded operator workspace. Every
            number is realistic. Every action is wired to real server logic.
            Click around, queue a campaign, see what fires back.
          </p>
          <div className="hero-ctas">
            <Link href="/dashboard" className="btn-primary btn-lg">
              Enter demo workspace
            </Link>
            <Link href="/sign-up" className="btn-ghost btn-lg">
              Create your own workspace
            </Link>
          </div>
          <div className="hero-meta">
            Read-only data · No account required · Resets periodically
          </div>
        </div>
      </section>

      <section className="section section-tint">
        <div className="section-inner">
          <div className="steps">
            <div className="step">
              <div className="step-num">01</div>
              <h3>Browse the dashboard</h3>
              <p>
                See the funnel snapshot, delivery status, and cross-module
                metrics for a fictional operator workspace with realistic data.
              </p>
            </div>
            <div className="step">
              <div className="step-num">02</div>
              <h3>Open the Reactivation module</h3>
              <p>
                Check the action queue, view recent campaign runs, and see which
                dormant contacts are waiting for follow-up. Queue a campaign to
                see it fire.
              </p>
            </div>
            <div className="step">
              <div className="step-num">03</div>
              <h3>Explore the other modules</h3>
              <p>
                Reviews, Paid Ads, Sales Enablement, and Lead Capture are all
                surface-complete with real data. Reactivation is the deepest —
                start there.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="marketing-footer">
        <div className="marketing-footer-inner">
          <div>
            <div className="marketing-brand-name">One System</div>
            <div className="footer-sub">Operator platform for appointment businesses.</div>
          </div>
          <div className="footer-links">
            <Link href="/pricing">Pricing</Link>
            <Link href="/sign-up">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
