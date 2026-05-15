import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.hoisted(() => vi.fn());
const mockCreateClient = vi.hoisted(() =>
  vi.fn(() => ({
    auth: {
      getSession: mockGetSession,
    },
  }))
);
const mockEnsureProfile = vi.hoisted(() => vi.fn());
const mockEnsureDefaultWorkspace = vi.hoisted(() => vi.fn());

vi.mock("@/lib/insforge/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/lib/auth/ensure-profile", () => ({
  ensureProfile: mockEnsureProfile,
}));

vi.mock("@/lib/workspaces/ensure-default-workspace", () => ({
  ensureDefaultWorkspace: mockEnsureDefaultWorkspace,
}));

import { GET } from "./route";

describe("GET /api/auth/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureProfile.mockResolvedValue({ id: "profile-123" });
    mockEnsureDefaultWorkspace.mockResolvedValue({
      id: "ws-123",
      name: "Personal",
      created_at: "2026-05-14T00:00:00Z",
      owner_id: "user-123",
    });
  });

  it("returns 401 when no session exists", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
    expect(mockEnsureDefaultWorkspace).not.toHaveBeenCalled();
  });

  it("hydrates the session and ensures the default workspace exists", async () => {
    const user = { id: "user-123", email: "person@example.com" };
    mockGetSession.mockResolvedValue({
      data: { session: { user } },
      error: null,
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.session.user).toEqual(user);
    expect(mockEnsureProfile).toHaveBeenCalledWith(expect.any(Object), user);
    expect(mockEnsureDefaultWorkspace).toHaveBeenCalledWith(
      expect.any(Object),
      "profile-123"
    );
  });
});
