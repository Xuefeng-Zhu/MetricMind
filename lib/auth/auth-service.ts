import { SupabaseClient, Session, User, AuthError } from "@supabase/supabase-js";

export interface AuthResult {
  user: User | null;
  error: AuthError | null;
}

export interface AuthService {
  signUp(email: string, password: string): Promise<AuthResult>;
  signIn(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  getSession(): Promise<Session | null>;
}

export function createAuthService(supabase: SupabaseClient): AuthService {
  return {
    async signUp(email: string, password: string): Promise<AuthResult> {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      return {
        user: data.user ?? null,
        error: error ?? null,
      };
    },

    async signIn(email: string, password: string): Promise<AuthResult> {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      return {
        user: data.user ?? null,
        error: error ?? null,
      };
    },

    async signOut(): Promise<void> {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
    },

    async getSession(): Promise<Session | null> {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        return null;
      }
      return data.session;
    },
  };
}
