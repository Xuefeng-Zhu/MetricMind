"use client";

import type { Workspace } from "@/lib/workspaces/workspace-service";
import { DEFAULT_WORKSPACE_NAME } from "@/lib/workspaces/default-workspace";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceStore } from "@/stores/workspace-store";

interface BootstrapOptions {
  createIfMissing?: boolean;
  defaultWorkspaceName?: string;
}

function getWorkspaceRole(workspace: Workspace, userId: string) {
  return workspace.role ?? (workspace.owner_id === userId ? "owner" : "viewer");
}

async function fetchWorkspaces() {
  const response = await fetch("/api/workspaces", { cache: "no-store" });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? "Failed to load workspaces");
  }

  const body = (await response.json()) as { workspaces: Workspace[] };
  return body.workspaces;
}

async function createWorkspace(name: string) {
  const response = await fetch("/api/workspaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? "Failed to create workspace");
  }

  const body = (await response.json()) as { workspace: Workspace };
  return body.workspace;
}

export async function bootstrapWorkspaceContext({
  createIfMissing = true,
  defaultWorkspaceName = DEFAULT_WORKSPACE_NAME,
}: BootstrapOptions = {}) {
  const authStore = useAuthStore.getState();
  const workspaceStore = useWorkspaceStore.getState();
  const user = authStore.user;

  if (!user) {
    workspaceStore.setWorkspaces([]);
    workspaceStore.setCurrentWorkspace(null);
    authStore.setWorkspaceContext(null);
    return null;
  }

  let workspaces = await fetchWorkspaces();

  if (workspaces.length === 0 && createIfMissing) {
    const workspace = await createWorkspace(defaultWorkspaceName);
    workspaces = [workspace];
  }

  workspaceStore.setWorkspaces(workspaces);

  const currentWorkspaceId = authStore.workspaceContext?.workspaceId;
  const selectedWorkspace =
    workspaces.find((workspace) => workspace.id === currentWorkspaceId) ??
    workspaces[0] ??
    null;

  workspaceStore.setCurrentWorkspace(selectedWorkspace);
  authStore.setWorkspaceContext(
    selectedWorkspace
      ? {
          workspaceId: selectedWorkspace.id,
          role: getWorkspaceRole(selectedWorkspace, user.id),
        }
      : null
  );

  return selectedWorkspace;
}
