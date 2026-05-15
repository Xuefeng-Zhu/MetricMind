import { beforeEach, describe, expect, it, vi } from "vitest";

import { INSFORGE_OAUTH_VERIFIER_COOKIE } from "@/lib/insforge/auth-cookies";

const mockSignInWithOAuth = vi.hoisted(() => vi.fn());
const mockCreateClient = vi.hoisted(() =>
  vi.fn(() => ({
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
    },
  }))
);

vi.mock("@/lib/insforge/server", () => ({
  createClient: mockCreateClient,
}));

import { GET } from "./route";

function createRequest(path = "/api/auth/oauth/google") {
  const url = new URL(path, "http://localhost:3000");
  return {
    url: url.toString(),
    nextUrl: url,
  } as any;
}

describe("OAuth initiation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts Google OAuth and stores the PKCE verifier", async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: {
        url: "https://accounts.google.com/o/oauth2/v2/auth",
        codeVerifier: "verifier-123",
      },
      error: null,
    });

    const response = await GET(createRequest(), {
      params: { provider: "google" },
    });

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      redirectTo: "http://localhost:3000/api/auth/callback",
      skipBrowserRedirect: true,
    });
    expect(response.headers.get("location")).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth"
    );
    expect(response.headers.get("set-cookie")).toContain(
      INSFORGE_OAUTH_VERIFIER_COOKIE
    );
  });

  it("rejects unsupported OAuth providers", async () => {
    const response = await GET(createRequest("/api/auth/oauth/microsoft"), {
      params: { provider: "microsoft" },
    });

    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe(
      "unsupported_oauth_provider"
    );
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("redirects back to login when OAuth initialization fails", async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: {},
      error: { message: "Provider is not configured" },
    });

    const response = await GET(createRequest(), {
      params: { provider: "google" },
    });

    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("oauth_init_failed");
  });
});
