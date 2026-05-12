import { describe, it, expect, beforeEach } from "vitest";
import { useWorkspaceStore } from "./workspace-store";
import { Workspace, Membership } from "@/lib/workspaces/workspace-service";

describe("useWorkspaceStore", () => {
  beforeEach(() => {
    // Reset store state between tests
    useWorkspaceStore.setState({
      workspaces: [],
      currentWorkspace: null,
      members: [],
      isLoading: false,
    });
  });

  it("should initialize with default state", () => {
    const state = useWorkspaceStore.getState();
    expect(state.workspaces).toEqual([]);
    expect(state.currentWorkspace).toBeNull();
    expect(state.members).toEqual([]);
    expect(state.isLoading).toBe(false);
  });

  it("should set workspaces", () => {
    const workspaces: Workspace[] = [
      {
        id: "ws-1",
        name: "Test Workspace",
        created_at: "2024-01-01T00:00:00Z",
        owner_id: "user-1",
      },
      {
        id: "ws-2",
        name: "Another Workspace",
        created_at: "2024-01-02T00:00:00Z",
        owner_id: "user-2",
      },
    ];

    useWorkspaceStore.getState().setWorkspaces(workspaces);

    expect(useWorkspaceStore.getState().workspaces).toEqual(workspaces);
  });

  it("should set current workspace", () => {
    const workspace: Workspace = {
      id: "ws-1",
      name: "Test Workspace",
      created_at: "2024-01-01T00:00:00Z",
      owner_id: "user-1",
    };

    useWorkspaceStore.getState().setCurrentWorkspace(workspace);

    expect(useWorkspaceStore.getState().currentWorkspace).toEqual(workspace);
  });

  it("should clear current workspace by setting null", () => {
    const workspace: Workspace = {
      id: "ws-1",
      name: "Test Workspace",
      created_at: "2024-01-01T00:00:00Z",
      owner_id: "user-1",
    };

    useWorkspaceStore.getState().setCurrentWorkspace(workspace);
    useWorkspaceStore.getState().setCurrentWorkspace(null);

    expect(useWorkspaceStore.getState().currentWorkspace).toBeNull();
  });

  it("should set members", () => {
    const members: Membership[] = [
      {
        id: "mem-1",
        workspace_id: "ws-1",
        user_id: "user-1",
        role: "owner",
        invited_at: "2024-01-01T00:00:00Z",
      },
      {
        id: "mem-2",
        workspace_id: "ws-1",
        user_id: "user-2",
        role: "analyst",
        invited_at: "2024-01-02T00:00:00Z",
      },
    ];

    useWorkspaceStore.getState().setMembers(members);

    expect(useWorkspaceStore.getState().members).toEqual(members);
  });

  it("should set loading state", () => {
    useWorkspaceStore.getState().setIsLoading(true);
    expect(useWorkspaceStore.getState().isLoading).toBe(true);

    useWorkspaceStore.getState().setIsLoading(false);
    expect(useWorkspaceStore.getState().isLoading).toBe(false);
  });
});
