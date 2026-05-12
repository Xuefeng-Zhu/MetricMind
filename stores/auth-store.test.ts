import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "./auth-store";
import { User, Session } from "@supabase/supabase-js";

function createMockUser(): User {
  return {
    id: "user-123",
    email: "test@example.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2024-01-01T00:00:00Z",
  } as User;
}

function createMockSession(): Session {
  return {
    access_token: "access-token-123",
    refresh_token: "refresh-token-123",
    expires_in: 3600,
    token_type: "bearer",
    user: createMockUser(),
  } as Session;
}

describe("useAuthStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.setState({
      user: null,
      session: null,
      workspaceContext: null,
    });
  });

  it("has correct initial state", () => {
    const state = useAuthStore.getState();

    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
    expect(state.workspaceContext).toBeNull();
  });

  it("setUser updates user state", () => {
    const user = createMockUser();

    useAuthStore.getState().setUser(user);

    expect(useAuthStore.getState().user).toEqual(user);
  });

  it("setUser can clear user to null", () => {
    const user = createMockUser();
    useAuthStore.getState().setUser(user);

    useAuthStore.getState().setUser(null);

    expect(useAuthStore.getState().user).toBeNull();
  });

  it("setSession updates session state", () => {
    const session = createMockSession();

    useAuthStore.getState().setSession(session);

    expect(useAuthStore.getState().session).toEqual(session);
  });

  it("setSession can clear session to null", () => {
    const session = createMockSession();
    useAuthStore.getState().setSession(session);

    useAuthStore.getState().setSession(null);

    expect(useAuthStore.getState().session).toBeNull();
  });

  it("setWorkspaceContext updates workspace context", () => {
    const context = { workspaceId: "ws-1", role: "admin" };

    useAuthStore.getState().setWorkspaceContext(context);

    expect(useAuthStore.getState().workspaceContext).toEqual(context);
  });

  it("setWorkspaceContext can clear context to null", () => {
    useAuthStore.getState().setWorkspaceContext({ workspaceId: "ws-1", role: "admin" });

    useAuthStore.getState().setWorkspaceContext(null);

    expect(useAuthStore.getState().workspaceContext).toBeNull();
  });

  it("clear resets all state to null", () => {
    const user = createMockUser();
    const session = createMockSession();
    const context = { workspaceId: "ws-1", role: "owner" };

    useAuthStore.getState().setUser(user);
    useAuthStore.getState().setSession(session);
    useAuthStore.getState().setWorkspaceContext(context);

    useAuthStore.getState().clear();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
    expect(state.workspaceContext).toBeNull();
  });

  it("state changes are independent", () => {
    const user = createMockUser();
    const context = { workspaceId: "ws-2", role: "analyst" };

    useAuthStore.getState().setUser(user);
    useAuthStore.getState().setWorkspaceContext(context);

    // Setting user shouldn't affect workspace context
    useAuthStore.getState().setUser(null);

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().workspaceContext).toEqual(context);
  });
});
