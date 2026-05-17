import { cookies } from "next/headers";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

import {
  accessCookieMaxAge,
  authCookieOptionsForMaxAge,
  INSFORGE_ACCESS_COOKIE,
  INSFORGE_KEEP_SIGNED_IN_COOKIE,
  INSFORGE_REFRESH_COOKIE,
  readKeepSignedInCookie,
  refreshCookieMaxAge,
} from "./auth-cookies";
import { createCompatClient } from "./compat";
import { getInsForgeAnonKey, getInsForgeUrl } from "./config";
import type { InsForgeAuthSessionResponse } from "./types";

type MutableCookieStore = ReturnType<typeof cookies> & {
  set(name: string, value: string, options?: Partial<ResponseCookie>): void;
};

function setServerAuthCookies(
  session: NonNullable<InsForgeAuthSessionResponse>,
  fallbackRefreshToken: string,
  keepSignedIn: boolean
) {
  if (!session.accessToken) return;

  try {
    const cookieStore = cookies() as MutableCookieStore;
    cookieStore.set(INSFORGE_ACCESS_COOKIE, session.accessToken, {
      ...authCookieOptionsForMaxAge(accessCookieMaxAge, keepSignedIn),
    });
    cookieStore.set(
      INSFORGE_REFRESH_COOKIE,
      session.refreshToken ?? fallbackRefreshToken,
      {
        ...authCookieOptionsForMaxAge(refreshCookieMaxAge, keepSignedIn),
      }
    );
  } catch {
    // Some server contexts expose read-only cookies; the refreshed in-memory
    // client token is still enough for the current API request.
  }
}

export function createClient() {
  const cookieStore = cookies();
  const accessToken = cookieStore.get(INSFORGE_ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(INSFORGE_REFRESH_COOKIE)?.value;
  const keepSignedIn = readKeepSignedInCookie(
    cookieStore.get(INSFORGE_KEEP_SIGNED_IN_COOKIE)?.value
  );
  const client = createCompatClient({
    baseUrl: getInsForgeUrl(),
    anonKey: getInsForgeAnonKey(),
    edgeFunctionToken: accessToken,
    isServerMode: true,
  });
  const getUser = client.auth.getUser.bind(client.auth);
  const getSession = client.auth.getSession.bind(client.auth);
  const refreshSession = client.auth.refreshSession.bind(client.auth);
  let refreshPromise: Promise<InsForgeAuthSessionResponse> | null = null;

  const refreshServerSession = () => {
    if (!refreshToken) return Promise.resolve(null);

    refreshPromise ??= (async () => {
      try {
        const { data, error } = await refreshSession({ refreshToken });

        if (error || !data?.accessToken || !data.user) return null;

        setServerAuthCookies(data, refreshToken, keepSignedIn);
        return data;
      } catch {
        return null;
      }
    })();

    return refreshPromise;
  };

  client.auth.getUser = async () => {
    const result = await getUser();

    if (result.data.user || !refreshToken) return result;

    const refreshed = await refreshServerSession();
    if (!refreshed?.user) return result;

    const sessionResult = await getSession();
    return {
      data: {
        user: sessionResult.data.session?.user ?? refreshed.user,
      },
      error: null,
    };
  };

  client.auth.getSession = async () => {
    const result = await getSession();

    if (result.data.session || !refreshToken) return result;

    const refreshed = await refreshServerSession();
    if (!refreshed?.accessToken || !refreshed.user) return result;

    const sessionResult = await getSession();
    if (sessionResult.data.session) return sessionResult;

    return {
      data: {
        session: {
          access_token: refreshed.accessToken,
          refresh_token: refreshed.refreshToken ?? refreshToken,
          user: refreshed.user,
        },
      },
      error: null,
    };
  };

  return client;
}

export function getServerRefreshToken() {
  return cookies().get(INSFORGE_REFRESH_COOKIE)?.value;
}
