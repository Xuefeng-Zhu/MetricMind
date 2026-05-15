import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  bootstrapWorkspaceContext,
  getWorkspaceRole,
} from "./client-workspace-bootstrap";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { Workspace } from "./workspace-service";

const ownerWorkspace: Workspace = {
  id: "ws-1",
  name: "Personal",
  created_at: "2026-05-15T00:00:00Z",
  owner_id: "profile-1",
  role: "owner",
};

function mockFetchOnce(body: unknown, ok = true) {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response);
}

describe("client workspace bootstrap", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    useAuthStore.setState({
      user: null,
      session: null,
      workspaceContext: null,
    });
    useWorkspaceStore.setState({
      workspaces: [],
      currentWorkspace: null,
      members: [],
      isLoading: false,
    });
  });

  it("uses membership role from the workspace response", async () => {
    useAuthStore.getState().setUser({
      id: "auth-user-1",
      email: "owner@example.com",
      name: "Owner",
      createdAt: "2026-05-15T00:00:00Z",
    });
    mockFetchOnce({ workspaces: [] });
    mockFetchOnce({ workspace: ownerWorkspace }, true);

    const selectedWorkspace = await bootstrapWorkspaceContext();

    expect(selectedWorkspace).toEqual(ownerWorkspace);
    expect(useAuthStore.getState().workspaceContext).toEqual({
      workspaceId: "ws-1",
      role: "owner",
    });
  });

  it("does not infer owner role from auth user id", () => {
    expect(
      getWorkspaceRole({
        ...ownerWorkspace,
        owner_id: "auth-user-1",
        role: undefined,
      })
    ).toBe("viewer");
  });
});
