import { NextResponse, type NextRequest } from "next/server";

import {
  accessCookieMaxAge,
  authCookieOptions,
  INSFORGE_ACCESS_COOKIE,
  INSFORGE_REFRESH_COOKIE,
  refreshCookieMaxAge,
} from "@/lib/insforge/auth-cookies";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    accessToken?: string;
    refreshToken?: string;
  } | null;

  if (!body?.accessToken || !body.refreshToken) {
    return NextResponse.json(
      { error: "Missing InsForge session tokens." },
      { status: 400 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(INSFORGE_ACCESS_COOKIE, body.accessToken, {
    ...authCookieOptions,
    maxAge: accessCookieMaxAge,
  });
  response.cookies.set(INSFORGE_REFRESH_COOKIE, body.refreshToken, {
    ...authCookieOptions,
    maxAge: refreshCookieMaxAge,
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
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
