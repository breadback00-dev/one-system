import { auth } from "@clerk/nextjs/server";
import {
  ensureWorkspaceById,
  getOrCreateWorkspaceForClerkUser,
} from "@one-system/database";

const DEMO_WORKSPACE_ID = process.env.DEMO_WORKSPACE_ID?.trim() || "workspace_medspa_demo";

export interface CurrentWorkspace {
  id: string;
  name: string;
  isDemo: boolean;
}

export async function getCurrentWorkspace(): Promise<CurrentWorkspace> {
  const session = await auth();

  if (!session.userId) {
    const demoWorkspace = await ensureWorkspaceById(DEMO_WORKSPACE_ID);
    return {
      id: demoWorkspace.id,
      name: demoWorkspace.name,
      isDemo: true,
    };
  }

  const workspace = await getOrCreateWorkspaceForClerkUser({
    clerkUserId: session.userId,
    workspaceName: "Operator Workspace",
    timezone: "Europe/London",
  });

  return {
    id: workspace.id,
    name: workspace.name,
    isDemo: false,
  };
}

export function getDemoWorkspaceId(): string {
  return DEMO_WORKSPACE_ID;
}
