"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "@/stores/auth-store";

export interface UseApiQueryOptions {
  /** Skip fetching (e.g., when a dependency isn't ready) */
  enabled?: boolean;
  /** Query parameters appended to the URL */
  params?: Record<string, string | undefined>;
}

export interface UseApiQueryResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Shared data-fetching hook that injects the workspace header
 * and handles loading/error/success states.
 *
 * Re-fetches when `url`, `params`, or `workspaceId` change.
 * Does not fetch when `workspaceId` is falsy or `enabled === false`.
 */
export function useApiQuery<T>(
  url: string,
  options?: UseApiQueryOptions
): UseApiQueryResult<T> {
  const { workspaceContext } = useAuthStore();
  const workspaceId = workspaceContext?.workspaceId;

  const enabled = options?.enabled !== false;
  const params = options?.params;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track a refetch counter to allow manual re-triggering
  const [fetchTrigger, setFetchTrigger] = useState(0);

  // Serialize params for dependency tracking
  const paramsKey = params ? JSON.stringify(params) : "";

  // Use a ref to track the latest fetch to avoid stale state updates
  const abortControllerRef = useRef<AbortController | null>(null);

  const doFetch = useCallback(async () => {
    if (!workspaceId || !enabled) {
      setIsLoading(false);
      setData(null);
      setError(enabled ? "Please select a workspace first." : null);
      return;
    }

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      // Build URL with query params
      let fetchUrl = url;
      if (params) {
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined) {
            searchParams.set(key, value);
          }
        }
        const queryString = searchParams.toString();
        if (queryString) {
          fetchUrl = `${url}?${queryString}`;
        }
      }

      const response = await fetch(fetchUrl, {
        headers: {
          "x-workspace-id": workspaceId,
        },
        signal: controller.signal,
      });

      // Don't update state if this request was aborted
      if (controller.signal.aborted) return;

      if (!response.ok) {
        let message: string;
        try {
          const body = await response.json();
          message = body.message || `Request failed with status ${response.status}`;
        } catch {
          message = `Request failed with status ${response.status}`;
        }
        setError(message);
        setData(null);
      } else {
        const json = await response.json();
        setData(json as T);
        setError(null);
      }
    } catch (err: unknown) {
      // Don't update state if this request was aborted
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError("Network error. Please check your connection and try again.");
      setData(null);
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, paramsKey, workspaceId, enabled, fetchTrigger]);

  useEffect(() => {
    doFetch();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [doFetch]);

  const refetch = useCallback(() => {
    setFetchTrigger((prev) => prev + 1);
  }, []);

  return { data, isLoading, error, refetch };
}
