import { create } from "zustand";
import { persist } from "zustand/middleware";
import { User, Session } from "@supabase/supabase-js";

export interface WorkspaceContext {
  workspaceId: string;
  role: string;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  workspaceContext: WorkspaceContext | null;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setWorkspaceContext: (context: WorkspaceContext | null) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      workspaceContext: null,

      setUser: (user) => set({ user }),

      setSession: (session) => set({ session }),

      setWorkspaceContext: (context) => set({ workspaceContext: context }),

      clear: () =>
        set({
          user: null,
          session: null,
          workspaceContext: null,
        }),
    }),
    {
      name: "auth-store",
      // Only persist workspaceContext across page reloads.
      // User and session are managed by Supabase Auth and refreshed on mount.
      partialize: (state) => ({
        workspaceContext: state.workspaceContext,
      }),
    }
  )
);
