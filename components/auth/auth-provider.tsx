"use client";

import { useEffect } from "react";

import { ensureProfile } from "@/lib/auth/ensure-profile";
import { createClient } from "@/lib/insforge/client";
import { useAuthStore } from "@/stores/auth-store";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setSession } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    async function hydrateAuth() {
      const insforge = createClient();
      const { data, error } = await insforge.auth.getSession();

      if (cancelled) return;

      if (error || !data.session) {
        setUser(null);
        setSession(null);
        return;
      }

      await ensureProfile(insforge, data.session.user).catch(() => null);
      setUser(data.session.user);
      setSession(data.session);
    }

    void hydrateAuth();

    return () => {
      cancelled = true;
    };
  }, [setSession, setUser]);

  return <>{children}</>;
}
