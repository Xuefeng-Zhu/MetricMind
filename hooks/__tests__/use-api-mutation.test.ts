/**
 * Unit tests for useApiMutation hook.
 *
 * Validates: Requirements 8.1, 8.2
 */
import { renderHook, waitFor, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: vi.fn(),
}));

import { useApiMutation } from "../use-api-mutation";
import { useAuthStore } from "@/stores/auth-store";

const mockedUseAuthStore = vi.mocked(useAuthStore);

describe("useApiMutation", () => {
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

  describe("sends correct HTTP method", () => {
    it("sends POST by default", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: "new-1" }),
      });
      mockWorkspace("ws-123");

      const { result } = renderHook(() =>
        useApiMutation<{ name: string }, { id: string }>("/api/items")
      );

      await act(async () => {
        await result.current.mutate({ name: "Test" });
      });

      const [, options] = fetchMock.mock.calls[0];
      expect(options.method).toBe("POST");
    });

    it("sends PUT when specified", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: "updated-1" }),
      });
      mockWorkspace("ws-123");

      const { result } = renderHook(() =>
        useApiMutation<{ name: string }, { id: string }>("/api/items/1", "PUT")
      );

      await act(async () => {
        await result.current.mutate({ name: "Updated" });
      });

      const [, options] = fetchMock.mock.calls[0];
      expect(options.method).toBe("PUT");
    });

    it("sends DELETE when specified", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
      mockWorkspace("ws-123");

      const { result } = renderHook(() =>
        useApiMutation<{ id: string }, { success: boolean }>(
          "/api/items/1",
          "DELETE"
        )
      );

      await act(async () => {
        await result.current.mutate({ id: "1" });
      });

      const [, options] = fetchMock.mock.calls[0];
      expect(options.method).toBe("DELETE");
    });
  });

  describe("sends JSON body with Content-Type header", () => {
    it("sends JSON-serialized body with Content-Type application/json", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: "created" }),
      });
      mockWorkspace("ws-123");

      const input = { name: "New Item", value: 42 };
      const { result } = renderHook(() =>
        useApiMutation<typeof input, { id: string }>("/api/items")
      );

      await act(async () => {
        await result.current.mutate(input);
      });

      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers["Content-Type"]).toBe("application/json");
      expect(options.body).toBe(JSON.stringify(input));
    });
  });

  describe("includes x-workspace-id header", () => {
    it("includes x-workspace-id header when workspace is available", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });
      mockWorkspace("ws-my-workspace");

      const { result } = renderHook(() =>
        useApiMutation<{ data: string }, unknown>("/api/test")
      );

      await act(async () => {
        await result.current.mutate({ data: "hello" });
      });

      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers["x-workspace-id"]).toBe("ws-my-workspace");
    });

    it("does not include x-workspace-id header when workspace is null", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });
      mockWorkspace(null);

      const { result } = renderHook(() =>
        useApiMutation<{ data: string }, unknown>("/api/test")
      );

      await act(async () => {
        await result.current.mutate({ data: "hello" });
      });

      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers["x-workspace-id"]).toBeUndefined();
    });
  });

  describe("returns parsed response on success", () => {
    it("returns parsed JSON response from mutate()", async () => {
      const responseData = { id: "item-1", name: "Created Item", status: "active" };
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => responseData,
      });
      mockWorkspace("ws-123");

      const { result } = renderHook(() =>
        useApiMutation<{ name: string }, typeof responseData>("/api/items")
      );

      let response: typeof responseData | null = null;
      await act(async () => {
        response = await result.current.mutate({ name: "Created Item" });
      });

      expect(response).toEqual(responseData);
      expect(result.current.error).toBeNull();
    });
  });

  describe("error state on non-2xx response", () => {
    it("sets error from JSON message field on non-2xx response", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ message: "Validation failed: name is required" }),
      });
      mockWorkspace("ws-123");

      const { result } = renderHook(() =>
        useApiMutation<{ name: string }, unknown>("/api/items")
      );

      await act(async () => {
        await result.current.mutate({ name: "" });
      });

      expect(result.current.error).toBe("Validation failed: name is required");
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

      const { result } = renderHook(() =>
        useApiMutation<{ data: string }, unknown>("/api/broken")
      );

      await act(async () => {
        await result.current.mutate({ data: "test" });
      });

      expect(result.current.error).toBe("Request failed with status 500");
    });
  });

  describe("returns null on error", () => {
    it("returns null from mutate() on non-2xx response", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: "Bad request" }),
      });
      mockWorkspace("ws-123");

      const { result } = renderHook(() =>
        useApiMutation<{ data: string }, { id: string }>("/api/items")
      );

      let response: { id: string } | null = null;
      await act(async () => {
        response = await result.current.mutate({ data: "test" });
      });

      expect(response).toBeNull();
    });

    it("returns null from mutate() on network failure", async () => {
      fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
      mockWorkspace("ws-123");

      const { result } = renderHook(() =>
        useApiMutation<{ data: string }, { id: string }>("/api/items")
      );

      let response: { id: string } | null = null;
      await act(async () => {
        response = await result.current.mutate({ data: "test" });
      });

      expect(response).toBeNull();
      expect(result.current.error).toBe(
        "Network error. Please check your connection and try again."
      );
    });
  });
});
