import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <div className="marketing auth-page">
      <header className="marketing-nav">
        <div className="marketing-nav-inner">
          <Link href="/" className="marketing-brand">
            <span className="marketing-brand-name">One System</span>
          </Link>
          <nav className="marketing-nav-links">
            <Link href="/pricing">Pricing</Link>
            <Link href="/demo" className="marketing-nav-cta">
              Try the demo
            </Link>
          </nav>
        </div>
      </header>
      <main className="auth-shell">
        <SignUp />
      </main>
    </div>
  );
}
