import { InsForgeDatabaseClient } from "@/lib/insforge/types";
import {
  createWorkspaceService,
  type Workspace,
} from "@/lib/workspaces/workspace-service";
import { DEFAULT_WORKSPACE_NAME } from "./default-workspace";

export async function ensureDefaultWorkspace(
  insforge: InsForgeDatabaseClient,
  profileId: string,
  name = DEFAULT_WORKSPACE_NAME
): Promise<Workspace> {
  const workspaceService = createWorkspaceService(insforge);
  const workspaces = await workspaceService.getByUser(profileId);

  if (workspaces.length > 0) {
    return workspaces[0];
  }

  return workspaceService.create(name, profileId);
}
