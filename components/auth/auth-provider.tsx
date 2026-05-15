"use client";

import { useEffect } from "react";

import type { Session } from "@/lib/insforge/types";
import { bootstrapWorkspaceContext } from "@/lib/workspaces/client-workspace-bootstrap";
import { useAuthStore } from "@/stores/auth-store";

type SessionResponse = {
  session: Session;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setSession, setWorkspaceContext } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    async function hydrateAuth() {
      const sessionResponse = await fetch("/api/auth/session", {
        cache: "no-store",
      });

      if (cancelled) return;

      if (!sessionResponse.ok) {
        setUser(null);
        setSession(null);
        setWorkspaceContext(null);
        await bootstrapWorkspaceContext({ createIfMissing: false });
        return;
      }

      const { session } = (await sessionResponse.json()) as SessionResponse;
      setUser(session.user);
      setSession(session);
      await bootstrapWorkspaceContext().catch(() => {
        setWorkspaceContext(null);
      });
    }

    void hydrateAuth().catch(() => {
      if (!cancelled) {
        setUser(null);
        setSession(null);
        setWorkspaceContext(null);
        void bootstrapWorkspaceContext({ createIfMissing: false });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [setSession, setUser, setWorkspaceContext]);

  return <>{children}</>;
}
