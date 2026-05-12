import { create } from "zustand";
import { Workspace, Membership } from "@/lib/workspaces/workspace-service";

export interface WorkspaceState {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  members: Membership[];
  isLoading: boolean;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  setMembers: (members: Membership[]) => void;
  setIsLoading: (loading: boolean) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()((set) => ({
  workspaces: [],
  currentWorkspace: null,
  members: [],
  isLoading: false,

  setWorkspaces: (workspaces) => set({ workspaces }),

  setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),

  setMembers: (members) => set({ members }),

  setIsLoading: (loading) => set({ isLoading: loading }),
}));
