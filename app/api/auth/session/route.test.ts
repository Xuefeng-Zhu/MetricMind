import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  INSFORGE_ACCESS_COOKIE,
  INSFORGE_KEEP_SIGNED_IN_COOKIE,
  INSFORGE_REFRESH_COOKIE,
} from "@/lib/insforge/auth-cookies";

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

import { DELETE, GET, POST } from "./route";

function createSessionRequest(body: unknown) {
  return new Request("http://localhost:3000/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

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

describe("POST /api/auth/session", () => {
  it("stores persistent session cookies by default", async () => {
    const response = await POST(
      createSessionRequest({
        accessToken: "access-token",
        refreshToken: "refresh-token",
      })
    );
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(setCookie).toContain(`${INSFORGE_ACCESS_COOKIE}=access-token`);
    expect(setCookie).toContain(`${INSFORGE_REFRESH_COOKIE}=refresh-token`);
    expect(setCookie).toContain(`${INSFORGE_KEEP_SIGNED_IN_COOKIE}=true`);
    expect(setCookie).toMatch(/Max-Age=900/i);
    expect(setCookie).toMatch(/Max-Age=604800/i);
  });

  it("stores session cookies when keep signed in is disabled", async () => {
    const response = await POST(
      createSessionRequest({
        accessToken: "access-token",
        keepSignedIn: false,
        refreshToken: "refresh-token",
      })
    );
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(setCookie).toContain(`${INSFORGE_ACCESS_COOKIE}=access-token`);
    expect(setCookie).toContain(`${INSFORGE_REFRESH_COOKIE}=refresh-token`);
    expect(setCookie).toContain(`${INSFORGE_KEEP_SIGNED_IN_COOKIE}=false`);
    expect(setCookie).not.toMatch(/Max-Age=/i);
  });

  it("rejects missing tokens", async () => {
    const response = await POST(createSessionRequest({ accessToken: "token" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Missing InsForge session tokens.");
  });
});

describe("DELETE /api/auth/session", () => {
  it("clears auth and keep-signed-in cookies", async () => {
    const response = await DELETE();
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(setCookie).toContain(`${INSFORGE_ACCESS_COOKIE}=`);
    expect(setCookie).toContain(`${INSFORGE_REFRESH_COOKIE}=`);
    expect(setCookie).toContain(`${INSFORGE_KEEP_SIGNED_IN_COOKIE}=`);
    expect(setCookie).toMatch(/Max-Age=0/i);
  });
});
