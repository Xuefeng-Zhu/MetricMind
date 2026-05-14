import { NextResponse, type NextRequest } from "next/server";

import {
  accessCookieMaxAge,
  authCookieOptions,
  INSFORGE_ACCESS_COOKIE,
  INSFORGE_REFRESH_COOKIE,
  refreshCookieMaxAge,
} from "@/lib/insforge/auth-cookies";

async function fetchCurrentUser(accessToken: string) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_INSFORGE_URL}/api/auth/sessions/current`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  return response.ok;
}

async function refreshSession(refreshToken: string) {
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

  const response = NextResponse.next();
  response.cookies.set(INSFORGE_ACCESS_COOKIE, refreshed.accessToken, {
    ...authCookieOptions,
    maxAge: accessCookieMaxAge,
  });
  response.cookies.set(
    INSFORGE_REFRESH_COOKIE,
    refreshed.refreshToken ?? refreshToken,
    {
      ...authCookieOptions,
      maxAge: refreshCookieMaxAge,
    }
  );

  return response;
}

export const config = {
  matcher: ["/app/:path*"],
};
