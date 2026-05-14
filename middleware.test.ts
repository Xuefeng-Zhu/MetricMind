import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRedirect = vi.hoisted(() =>
  vi.fn().mockImplementation((url: URL) => ({
    status: 307,
    headers: new Headers({ location: url.toString() }),
    cookies: { set: vi.fn() },
  }))
);
const mockNext = vi.hoisted(() =>
  vi.fn().mockImplementation(() => ({
    status: 200,
    headers: new Headers(),
    cookies: { set: vi.fn() },
  }))
);

vi.mock("next/server", () => ({
  NextResponse: {
    next: mockNext,
    redirect: mockRedirect,
  },
}));

import {
  INSFORGE_ACCESS_COOKIE,
  INSFORGE_REFRESH_COOKIE,
} from "./lib/insforge/auth-cookies";
import { middleware, config } from "./middleware";

function createMockRequest(pathname: string, cookies: Record<string, string> = {}) {
  const url = new URL(pathname, "http://localhost:3000");
  return {
    nextUrl: url,
    url: url.toString(),
    cookies: {
      get: (name: string) =>
        cookies[name] ? { name, value: cookies[name] } : undefined,
      getAll: () =>
        Object.entries(cookies).map(([name, value]) => ({ name, value })),
      set: vi.fn(),
    },
    headers: new Headers(),
  } as any;
}

describe("Auth Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_INSFORGE_URL = "https://test.insforge.app";
    process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY = "anon-key";
    vi.stubGlobal("fetch", vi.fn());
    mockNext.mockImplementation(() => ({
      status: 200,
      headers: new Headers(),
      cookies: { set: vi.fn() },
    }));
    mockRedirect.mockImplementation((url: URL) => ({
      status: 307,
      headers: new Headers({ location: url.toString() }),
      cookies: { set: vi.fn() },
    }));
  });

  describe("route matching config", () => {
    it("should match /app routes via the matcher config", () => {
      const matchers = Array.isArray(config.matcher)
        ? config.matcher
        : [config.matcher];
      expect(matchers).toContain("/app/:path*");
    });

    it("should not match public routes", () => {
      const matchers = Array.isArray(config.matcher)
        ? config.matcher
        : [config.matcher];
      expect(matchers).not.toContain("/");
      expect(matchers).not.toContain("/login");
      expect(matchers).not.toContain("/signup");
      expect(matchers).not.toContain("/demo");
    });
  });

  describe("protected routes (/app/*)", () => {
    it("should redirect unauthenticated users to /login", async () => {
      const request = createMockRequest("/app/dashboards");
      await middleware(request);

      expect(mockRedirect).toHaveBeenCalled();
      const redirectUrl = mockRedirect.mock.calls[0][0] as URL;
      expect(redirectUrl.pathname).toBe("/login");
    });

    it("should redirect unauthenticated users from /app root to /login", async () => {
      const request = createMockRequest("/app");
      await middleware(request);

      expect(mockRedirect).toHaveBeenCalled();
      const redirectUrl = mockRedirect.mock.calls[0][0] as URL;
      expect(redirectUrl.pathname).toBe("/login");
    });

    it("should redirect unauthenticated users from nested /app routes to /login", async () => {
      const request = createMockRequest("/app/semantic-layer/metrics");
      await middleware(request);

      expect(mockRedirect).toHaveBeenCalled();
      const redirectUrl = mockRedirect.mock.calls[0][0] as URL;
      expect(redirectUrl.pathname).toBe("/login");
    });

    it("should allow authenticated users to access /app routes", async () => {
      vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 200 }));

      const request = createMockRequest("/app/dashboards", {
        [INSFORGE_ACCESS_COOKIE]: "access-token",
      });
      await middleware(request);

      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("should allow authenticated users to access nested /app routes", async () => {
      vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 200 }));

      const request = createMockRequest("/app/ask/conversation-1", {
        [INSFORGE_ACCESS_COOKIE]: "access-token",
      });
      await middleware(request);

      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("should refresh an expired access token when a refresh token exists", async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(new Response("{}", { status: 401 }))
        .mockResolvedValueOnce(
          Response.json({
            accessToken: "new-access-token",
            refreshToken: "new-refresh-token",
            user: { id: "user-123" },
          })
        );

      const request = createMockRequest("/app", {
        [INSFORGE_ACCESS_COOKIE]: "expired-access-token",
        [INSFORGE_REFRESH_COOKIE]: "refresh-token",
      });
      await middleware(request);

      expect(mockRedirect).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("public routes", () => {
    it("should not protect non-/app routes when middleware is invoked", async () => {
      // If somehow a non-/app route reaches the middleware, it passes through
      const request = createMockRequest("/other-route");
      await middleware(request);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    });

    it("should not be triggered for public routes due to matcher config", () => {
      // The matcher config "/app/:path*" ensures public routes never reach middleware
      const matchers = Array.isArray(config.matcher)
        ? config.matcher
        : [config.matcher];
      // Only /app routes are matched
      expect(matchers.length).toBe(1);
      expect(matchers[0]).toBe("/app/:path*");
    });
  });
});
