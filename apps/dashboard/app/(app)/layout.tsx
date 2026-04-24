import type { ReactNode } from "react";
import { LayoutShell } from "../../components/LayoutShell";

export const dynamic = "force-dynamic";

export default function AppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return <LayoutShell>{children}</LayoutShell>;
}
