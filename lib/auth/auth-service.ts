import { InsForgeDatabaseClient, Session, User, AuthError } from "@/lib/insforge/types";

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

export function createAuthService(insforge: InsForgeDatabaseClient): AuthService {
  return {
    async signUp(email: string, password: string): Promise<AuthResult> {
      const { data, error } = await insforge.auth.signUp({
        email,
        password,
      });

      return {
        user: data?.user ?? null,
        error: error ?? null,
      };
    },

    async signIn(email: string, password: string): Promise<AuthResult> {
      const { data, error } = await insforge.auth.signInWithPassword({
        email,
        password,
      });

      return {
        user: data?.user ?? null,
        error: error ?? null,
      };
    },

    async signOut(): Promise<void> {
      const { error } = await insforge.auth.signOut();
      if (error) {
        throw error;
      }
    },

    async getSession(): Promise<Session | null> {
      const { data, error } = await insforge.auth.getSession();
      if (error) {
        return null;
      }
      return data.session;
    },
  };
}
