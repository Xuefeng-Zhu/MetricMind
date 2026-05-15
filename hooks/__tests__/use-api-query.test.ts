/**
 * Unit tests for useApiQuery hook.
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5
 */
import { renderHook, waitFor, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: vi.fn(),
}));

import { useApiQuery } from "../use-api-query";
import { useAuthStore } from "@/stores/auth-store";

const mockedUseAuthStore = vi.mocked(useAuthStore);

describe("useApiQuery", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockWorkspace(workspaceId: string | null) {
    mockedUseAuthStore.mockReturnValue({
      workspaceContext: workspaceId
        ? { workspaceId, role: "admin" }
        : null,
      user: null,
      session: null,
      setUser: vi.fn(),
      setSession: vi.fn(),
      setWorkspaceContext: vi.fn(),
      clear: vi.fn(),
    } as any);
  }

  describe("state when workspace is not available", () => {
    it("returns a workspace selection error and does not fetch when workspaceId is null", async () => {
      mockWorkspace(null);

      const { result } = renderHook(() => useApiQuery("/api/test"));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBe("Please select a workspace first.");
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("successful data fetch and state transition", () => {
    it("transitions from loading to data state on successful fetch", async () => {
      const mockData = { items: [{ id: "1", name: "Test" }] };
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });
      mockWorkspace("ws-123");

      const { result } = renderHook(() => useApiQuery("/api/items"));

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockData);
      expect(result.current.error).toBeNull();
    });

    it("includes x-workspace-id header in the fetch call", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });
      mockWorkspace("ws-abc-456");

      renderHook(() => useApiQuery("/api/test"));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });

      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers["x-workspace-id"]).toBe("ws-abc-456");
    });
  });

  describe("error state on non-2xx response", () => {
    it("sets error from JSON message field on non-2xx response", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ message: "Forbidden: insufficient permissions" }),
      });
      mockWorkspace("ws-123");

      const { result } = renderHook(() => useApiQuery("/api/protected"));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe("Forbidden: insufficient permissions");
      expect(result.current.data).toBeNull();
    });

    it("falls back to status-based message when JSON parsing fails", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });
      mockWorkspace("ws-123");

      const { result } = renderHook(() => useApiQuery("/api/broken"));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe("Request failed with status 500");
      expect(result.current.data).toBeNull();
    });
  });

  describe("refetch function triggers new request", () => {
    it("refetch() triggers a new fetch call", async () => {
      const firstData = { count: 1 };
      const secondData = { count: 2 };
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => firstData })
        .mockResolvedValueOnce({ ok: true, json: async () => secondData });
      mockWorkspace("ws-123");

      const { result } = renderHook(() => useApiQuery("/api/counter"));

      await waitFor(() => {
        expect(result.current.data).toEqual(firstData);
      });

      act(() => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(secondData);
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("enabled: false prevents fetch", () => {
    it("does not fetch when enabled is false", async () => {
      mockWorkspace("ws-123");

      const { result } = renderHook(() =>
        useApiQuery("/api/test", { enabled: false })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("query params appended to URL", () => {
    it("appends query params to the URL correctly", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] }),
      });
      mockWorkspace("ws-123");

      renderHook(() =>
        useApiQuery("/api/logs", {
          params: { action: "create", actor: "user-1" },
        })
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain("/api/logs?");
      expect(url).toContain("action=create");
      expect(url).toContain("actor=user-1");
    });

    it("skips undefined param values", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });
      mockWorkspace("ws-123");

      renderHook(() =>
        useApiQuery("/api/logs", {
          params: { action: "delete", actor: undefined },
        })
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain("action=delete");
      expect(url).not.toContain("actor");
    });
  });

  describe("network failure", () => {
    it("returns generic error message on network failure", async () => {
      fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
      mockWorkspace("ws-123");

      const { result } = renderHook(() => useApiQuery("/api/test"));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe(
        "Network error. Please check your connection and try again."
      );
      expect(result.current.data).toBeNull();
    });
  });
});
