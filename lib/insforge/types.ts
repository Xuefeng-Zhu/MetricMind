import type { UserSchema } from "@insforge/shared-schemas";
import type { InsForgeClient, InsForgeError } from "@insforge/sdk";

export type InsForgeUser = UserSchema & {
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

export interface InsForgeSession {
  user: InsForgeUser;
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

export type InsForgeAuthError = InsForgeError;

export type InsForgeAuthResponse<T> = Promise<{
  data: T;
  error: InsForgeError | null;
}>;

type AuthClient = InsForgeClient["auth"] & {
  getUser(): InsForgeAuthResponse<{ user: InsForgeUser | null }>;
  getSession(): InsForgeAuthResponse<{ session: InsForgeSession | null }>;
};

export type InsForgeDatabaseClient = InsForgeClient & {
  auth: AuthClient;
  from: InsForgeClient["database"]["from"];
  rpc: InsForgeClient["database"]["rpc"];
};

export type InsForgeAuthSessionResponse = {
  accessToken?: string | null;
  refreshToken?: string;
  user?: InsForgeUser | null;
} | null;

export type User = InsForgeUser;
export type Session = InsForgeSession;
export type AuthError = InsForgeAuthError;
