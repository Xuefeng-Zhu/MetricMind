import {
  createClient as createInsForgeClient,
  type ClientOptions,
} from "@insforge/sdk";

import type {
  InsForgeAuthSessionResponse,
  InsForgeDatabaseClient,
  InsForgeSession,
  InsForgeUser,
} from "./types";

function mapUser(user: InsForgeUser | null | undefined): InsForgeUser | null {
  if (!user) return null;

  const metadata = user.metadata ?? user.user_metadata ?? {};

  return {
    ...user,
    user_metadata: metadata,
    app_metadata: user.app_metadata ?? {},
    created_at: user.created_at ?? user.createdAt,
    updated_at: user.updated_at ?? user.updatedAt,
  };
}

function mapSession(response: InsForgeAuthSessionResponse): InsForgeSession | null {
  const user = mapUser(response?.user as InsForgeUser | null | undefined);

  if (!response?.accessToken || !user) return null;

  return {
    user,
    access_token: response.accessToken,
    refresh_token: response.refreshToken,
  };
}

function normalizeInsertValues<T extends { insert?: (...args: any[]) => unknown }>(
  builder: T
): T {
  if (typeof builder.insert !== "function") return builder;

  const insert = builder.insert.bind(builder);
  builder.insert = ((values: unknown, ...args: unknown[]) =>
    insert(Array.isArray(values) ? values : [values], ...args)) as T["insert"];

  return builder;
}

export function createCompatClient(options: ClientOptions): InsForgeDatabaseClient {
  const client = createInsForgeClient(options) as InsForgeDatabaseClient;
  const auth = client.auth;
  let currentSession: InsForgeSession | null = null;

  const signUp = auth.signUp.bind(auth);
  auth.signUp = async (...args) => {
    const result = await signUp(...args);
    currentSession = mapSession(result.data);
    return result;
  };

  const signInWithPassword = auth.signInWithPassword.bind(auth);
  auth.signInWithPassword = async (...args) => {
    const result = await signInWithPassword(...args);
    currentSession = mapSession(result.data);
    return result;
  };

  const exchangeOAuthCode = auth.exchangeOAuthCode.bind(auth);
  auth.exchangeOAuthCode = async (...args) => {
    const result = await exchangeOAuthCode(...args);
    currentSession = mapSession(result.data);
    return result;
  };

  const refreshSession = auth.refreshSession.bind(auth);
  auth.refreshSession = async (...args) => {
    const result = await refreshSession(...args);
    currentSession = mapSession(result.data);
    return result;
  };

  const signOut = auth.signOut.bind(auth);
  auth.signOut = async () => {
    currentSession = null;
    return signOut();
  };

  auth.getUser = async () => {
    const result = await auth.getCurrentUser();
    return {
      data: {
        user: mapUser(result.data.user as InsForgeUser | null | undefined),
      },
      error: result.error,
    };
  };

  auth.getSession = async () => {
    if (currentSession) {
      return { data: { session: currentSession }, error: null };
    }

    const result = await auth.getUser();
    if (currentSession) {
      return { data: { session: currentSession }, error: result.error };
    }

    return {
      data: {
        session: result.data.user
          ? {
              user: result.data.user,
              access_token: "",
            }
          : null,
      },
      error: result.error,
    };
  };

  const from = client.database.from.bind(client.database);
  client.database.from = ((table: string) => normalizeInsertValues(from(table))) as typeof client.database.from;
  client.from = client.database.from.bind(client.database);
  client.rpc = client.database.rpc.bind(client.database);

  return client;
}
