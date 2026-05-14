import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  INSFORGE_ACCESS_COOKIE,
  INSFORGE_REFRESH_COOKIE,
} from "./auth-cookies";

const mockCookieGet = vi.hoisted(() => vi.fn());
const mockCookieSet = vi.hoisted(() => vi.fn());
const mockGetUser = vi.hoisted(() => vi.fn());
const mockGetSession = vi.hoisted(() => vi.fn());
const mockRefreshSession = vi.hoisted(() => vi.fn());
const mockCreateCompatClient = vi.hoisted(() =>
  vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
      getSession: mockGetSession,
      refreshSession: mockRefreshSession,
    },
  }))
);

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: mockCookieGet,
    set: mockCookieSet,
  }),
}));

vi.mock("./compat", () => ({
  createCompatClient: mockCreateCompatClient,
}));

import { createClient } from "./server";

function setAuthCookies({
  accessToken = "access-token",
  refreshToken = "refresh-token",
}: {
  accessToken?: string;
  refreshToken?: string;
} = {}) {
  mockCookieGet.mockImplementation((name: string) => {
    if (name === INSFORGE_ACCESS_COOKIE) {
      return { name, value: accessToken };
    }

    if (name === INSFORGE_REFRESH_COOKIE) {
      return { name, value: refreshToken };
    }

    return undefined;
  });
}

describe("InsForge server client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_INSFORGE_URL = "https://test.insforge.app";
    process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY = "anon-key";
    setAuthCookies();
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  it("refreshes expired access tokens before returning the server user", async () => {
    const refreshedUser = {
      id: "user-123",
      email: "user@example.com",
    };
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "expired" },
    });
    mockRefreshSession.mockResolvedValue({
      data: {
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
        user: refreshedUser,
      },
      error: null,
    });
    mockGetSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    const client = createClient();
    const result = await client.auth.getUser();

    expect(mockRefreshSession).toHaveBeenCalledWith({
      refreshToken: "refresh-token",
    });
    expect(mockCookieSet).toHaveBeenCalledWith(
      INSFORGE_ACCESS_COOKIE,
      "new-access-token",
      expect.objectContaining({ maxAge: 60 * 15 })
    );
    expect(mockCookieSet).toHaveBeenCalledWith(
      INSFORGE_REFRESH_COOKIE,
      "new-refresh-token",
      expect.objectContaining({ maxAge: 60 * 60 * 24 * 7 })
    );
    expect(result).toEqual({
      data: { user: refreshedUser },
      error: null,
    });
  });

  it("does not refresh when no server refresh token is available", async () => {
    setAuthCookies({ refreshToken: "" });
    mockCookieGet.mockImplementation((name: string) => {
      if (name === INSFORGE_ACCESS_COOKIE) {
        return { name, value: "access-token" };
      }

      return undefined;
    });
    const authResult = {
      data: { user: null },
      error: { message: "expired" },
    };
    mockGetUser.mockResolvedValue(authResult);

    const client = createClient();
    const result = await client.auth.getUser();

    expect(mockRefreshSession).not.toHaveBeenCalled();
    expect(result).toBe(authResult);
  });

  it("falls back to the original auth result when refresh fails", async () => {
    const authResult = {
      data: { user: null },
      error: { message: "expired" },
    };
    mockGetUser.mockResolvedValue(authResult);
    mockRefreshSession.mockResolvedValue({
      data: null,
      error: { message: "refresh failed" },
    });

    const client = createClient();
    const result = await client.auth.getUser();

    expect(mockRefreshSession).toHaveBeenCalled();
    expect(mockCookieSet).not.toHaveBeenCalled();
    expect(result).toBe(authResult);
  });

  it("returns a refreshed server session", async () => {
    const refreshedUser = {
      id: "user-123",
      email: "user@example.com",
    };
    mockRefreshSession.mockResolvedValue({
      data: {
        accessToken: "new-access-token",
        user: refreshedUser,
      },
      error: null,
    });

    const client = createClient();
    const result = await client.auth.getSession();

    expect(result).toEqual({
      data: {
        session: {
          access_token: "new-access-token",
          refresh_token: "refresh-token",
          user: refreshedUser,
        },
      },
      error: null,
    });
  });
});
