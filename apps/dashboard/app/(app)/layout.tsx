import type { ReactNode } from "react";
import { LayoutShell } from "../../components/LayoutShell";
import { getCurrentWorkspace } from "../../lib/workspace";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const workspace = await getCurrentWorkspace();

  return (
    <LayoutShell
      workspaceName={workspace.name}
      workspacePlan={workspace.isDemo ? "Shared demo" : "Client workspace"}
      statusLabel={workspace.isDemo ? "Demo workspace" : "Workspace active"}
    >
      {children}
    </LayoutShell>
  );
}
