/**
 * Property-based tests for useApiQuery hook.
 *
 * Feature: wire-up-backend
 * Validates: Requirements 8.2, 8.4
 */
import { renderHook, waitFor } from "@testing-library/react";
import * as fc from "fast-check";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// Mock the auth store module
vi.mock("@/stores/auth-store", () => ({
  useAuthStore: vi.fn(),
}));

import { useApiQuery } from "../use-api-query";
import { useAuthStore } from "@/stores/auth-store";

const mockedUseAuthStore = vi.mocked(useAuthStore);

describe("Feature: wire-up-backend, Property 1: Workspace header inclusion", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: "test" }),
    });
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Property 1: Workspace header inclusion
   *
   * For any URL and workspace ID, the fetch call SHALL include an
   * `x-workspace-id` header with the exact workspace ID value.
   *
   * **Validates: Requirements 8.2**
   */
  it("SHALL include x-workspace-id header with the exact workspace ID value for any URL and workspace ID", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary URL paths (non-empty, starting with /)
        fc.webPath().map((p) => p || "/api/test"),
        // Generate arbitrary non-empty workspace IDs
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
        async (urlPath, workspaceId) => {
          fetchMock.mockClear();
          fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ data: "ok" }),
          });

          mockedUseAuthStore.mockReturnValue({
            workspaceContext: { workspaceId, role: "admin" },
            user: null,
            session: null,
            setUser: vi.fn(),
            setSession: vi.fn(),
            setWorkspaceContext: vi.fn(),
            clear: vi.fn(),
          } as any);

          const { result, unmount } = renderHook(() => useApiQuery(urlPath));

          await waitFor(() => {
            expect(fetchMock).toHaveBeenCalled();
          });

          const callArgs = fetchMock.mock.calls[0];
          const requestOptions = callArgs[1];
          expect(requestOptions.headers["x-workspace-id"]).toBe(workspaceId);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);
});

describe("Feature: wire-up-backend, Property 2: Error message extraction from non-2xx responses", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Property 2: Error message extraction
   *
   * For any non-2xx response with a JSON body containing a `message` field,
   * the hook SHALL set its error state to that message string.
   *
   * **Validates: Requirements 8.4**
   */
  it("SHALL set error state to the message string from any non-2xx JSON response", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate non-2xx status codes (400-599)
        fc.integer({ min: 400, max: 599 }),
        // Generate arbitrary non-empty error messages
        fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
        async (statusCode, errorMessage) => {
          fetchMock.mockClear();
          fetchMock.mockResolvedValue({
            ok: false,
            status: statusCode,
            json: async () => ({ message: errorMessage }),
          });

          mockedUseAuthStore.mockReturnValue({
            workspaceContext: { workspaceId: "ws-test-123", role: "admin" },
            user: null,
            session: null,
            setUser: vi.fn(),
            setSession: vi.fn(),
            setWorkspaceContext: vi.fn(),
            clear: vi.fn(),
          } as any);

          const { result, unmount } = renderHook(() =>
            useApiQuery("/api/test-endpoint")
          );

          await waitFor(() => {
            expect(result.current.error).not.toBeNull();
          });

          expect(result.current.error).toBe(errorMessage);
          expect(result.current.data).toBeNull();

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);
});
