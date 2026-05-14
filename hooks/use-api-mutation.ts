"use client";

import { useState, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";

export interface UseApiMutationResult<TInput, TOutput> {
  mutate: (input: TInput) => Promise<TOutput | null>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Shared mutation hook for on-demand POST/PUT/DELETE calls.
 * Injects the workspace `x-workspace-id` header from the auth store.
 *
 * Returns a `mutate` function that sends a JSON body and returns
 * the parsed response, or null on error.
 */
export function useApiMutation<TInput, TOutput>(
  url: string,
  method: "POST" | "PUT" | "DELETE" = "POST"
): UseApiMutationResult<TInput, TOutput> {
  const { workspaceContext } = useAuthStore();
  const workspaceId = workspaceContext?.workspaceId;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (input: TInput): Promise<TOutput | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (workspaceId) {
          headers["x-workspace-id"] = workspaceId;
        }

        const response = await fetch(url, {
          method,
          headers,
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          let message: string;
          try {
            const body = await response.json();
            message =
              body.message || `Request failed with status ${response.status}`;
          } catch {
            message = `Request failed with status ${response.status}`;
          }
          setError(message);
          return null;
        }

        const json = await response.json();
        return json as TOutput;
      } catch {
        setError("Network error. Please check your connection and try again.");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [url, method, workspaceId]
  );

  return { mutate, isLoading, error };
}
