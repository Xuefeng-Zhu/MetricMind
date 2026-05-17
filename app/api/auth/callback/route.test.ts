import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  INSFORGE_ACCESS_COOKIE,
  INSFORGE_KEEP_SIGNED_IN_COOKIE,
  INSFORGE_OAUTH_VERIFIER_COOKIE,
  INSFORGE_REFRESH_COOKIE,
} from "@/lib/insforge/auth-cookies";

const mockExchangeOAuthCode = vi.hoisted(() => vi.fn());
const mockCreateClient = vi.hoisted(() =>
  vi.fn(() => ({
    auth: {
      exchangeOAuthCode: mockExchangeOAuthCode,
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

function createRequest(
  path = "/api/auth/callback?insforge_code=oauth-code",
  cookieValues: Record<string, string> = {
    [INSFORGE_OAUTH_VERIFIER_COOKIE]: "verifier-123",
  }
) {
  const url = new URL(path, "http://localhost:3000");
  return {
    url: url.toString(),
    nextUrl: url,
    cookies: {
      get: (name: string) =>
        cookieValues[name] ? { name, value: cookieValues[name] } : undefined,
    },
  } as any;
}

describe("OAuth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureDefaultWorkspace.mockResolvedValue({
      id: "ws-123",
      name: "Personal",
      created_at: "2026-05-14T00:00:00Z",
      owner_id: "user-123",
    });
  });

  it("exchanges the code, creates a profile and workspace, and stores session cookies", async () => {
    const user = { id: "user-123", email: "person@example.com" };
    mockExchangeOAuthCode.mockResolvedValue({
      data: {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        user,
      },
      error: null,
    });
    mockEnsureProfile.mockResolvedValue({ id: "profile-123" });

    const response = await GET(createRequest());

    expect(mockExchangeOAuthCode).toHaveBeenCalledWith(
      "oauth-code",
      "verifier-123"
    );
    expect(mockEnsureProfile).toHaveBeenCalledWith(
      expect.any(Object),
      user
    );
    expect(mockEnsureDefaultWorkspace).toHaveBeenCalledWith(
      expect.any(Object),
      "profile-123"
    );
    expect(response.headers.get("location")).toBe("http://localhost:3000/app");

    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain(INSFORGE_ACCESS_COOKIE);
    expect(setCookie).toContain(INSFORGE_REFRESH_COOKIE);
    expect(setCookie).toContain(`${INSFORGE_KEEP_SIGNED_IN_COOKIE}=true`);
    expect(setCookie).toContain(INSFORGE_OAUTH_VERIFIER_COOKIE);
  });

  it("honors the keep-signed-in preference from OAuth initiation", async () => {
    const user = { id: "user-123", email: "person@example.com" };
    mockExchangeOAuthCode.mockResolvedValue({
      data: {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        user,
      },
      error: null,
    });
    mockEnsureProfile.mockResolvedValue({ id: "profile-123" });

    const response = await GET(
      createRequest("/api/auth/callback?insforge_code=oauth-code", {
        [INSFORGE_OAUTH_VERIFIER_COOKIE]: "verifier-123",
        [INSFORGE_KEEP_SIGNED_IN_COOKIE]: "false",
      })
    );
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(setCookie).toContain(`${INSFORGE_KEEP_SIGNED_IN_COOKIE}=false`);
  });

  it("requires the PKCE verifier cookie", async () => {
    const response = await GET(createRequest(undefined, {}));

    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("oauth_verifier_missing");
    expect(mockExchangeOAuthCode).not.toHaveBeenCalled();
  });

  it("redirects to login when code exchange fails", async () => {
    mockExchangeOAuthCode.mockResolvedValue({
      data: null,
      error: { message: "Bad code" },
    });

    const response = await GET(createRequest());

    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("oauth_exchange_failed");
  });

  it("redirects to login when default workspace creation fails", async () => {
    mockExchangeOAuthCode.mockResolvedValue({
      data: {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        user: { id: "user-123", email: "person@example.com" },
      },
      error: null,
    });
    mockEnsureProfile.mockResolvedValue({ id: "profile-123" });
    mockEnsureDefaultWorkspace.mockRejectedValue(new Error("Database error"));

    const response = await GET(createRequest());

    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("workspace_setup_failed");
  });
});
