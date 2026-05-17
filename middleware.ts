import { NextResponse, type NextRequest } from "next/server";

import {
  accessCookieMaxAge,
  authCookieOptions,
  authCookieOptionsForMaxAge,
  INSFORGE_ACCESS_COOKIE,
  INSFORGE_KEEP_SIGNED_IN_COOKIE,
  INSFORGE_REFRESH_COOKIE,
  readKeepSignedInCookie,
  refreshCookieMaxAge,
} from "@/lib/insforge/auth-cookies";

async function fetchCurrentUser(accessToken: string) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_INSFORGE_URL}/api/auth/sessions/current`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return response.ok;
  } catch {
    return false;
  }
}

async function refreshSession(refreshToken: string) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_INSFORGE_URL}/api/auth/refresh?client_type=mobile`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }
    );

    if (!response.ok) return null;

    return (await response.json()) as {
      accessToken?: string;
      refreshToken?: string;
      user?: unknown;
    };
  } catch {
    return null;
  }
}

function redirectToLogin(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set(INSFORGE_ACCESS_COOKIE, "", {
    ...authCookieOptions,
    maxAge: 0,
  });
  response.cookies.set(INSFORGE_REFRESH_COOKIE, "", {
    ...authCookieOptions,
    maxAge: 0,
  });
  response.cookies.set(INSFORGE_KEEP_SIGNED_IN_COOKIE, "", {
    ...authCookieOptions,
    maxAge: 0,
  });
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/app")) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get(INSFORGE_ACCESS_COOKIE)?.value;

  if (accessToken && (await fetchCurrentUser(accessToken))) {
    return NextResponse.next();
  }

  const refreshToken = request.cookies.get(INSFORGE_REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    return redirectToLogin(request);
  }

  const refreshed = await refreshSession(refreshToken);

  if (!refreshed?.accessToken || !refreshed.user) {
    return redirectToLogin(request);
  }

  const keepSignedIn = readKeepSignedInCookie(
    request.cookies.get(INSFORGE_KEEP_SIGNED_IN_COOKIE)?.value
  );
  const response = NextResponse.next();
  response.cookies.set(INSFORGE_ACCESS_COOKIE, refreshed.accessToken, {
    ...authCookieOptionsForMaxAge(accessCookieMaxAge, keepSignedIn),
  });
  response.cookies.set(
    INSFORGE_REFRESH_COOKIE,
    refreshed.refreshToken ?? refreshToken,
    {
      ...authCookieOptionsForMaxAge(refreshCookieMaxAge, keepSignedIn),
    }
  );

  return response;
}

export const config = {
  matcher: ["/app/:path*"],
};
