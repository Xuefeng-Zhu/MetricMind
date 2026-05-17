import { NextResponse, type NextRequest } from "next/server";

import { ensureProfile } from "@/lib/auth/ensure-profile";
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
import { createClient } from "@/lib/insforge/server";
import { ensureDefaultWorkspace } from "@/lib/workspaces/ensure-default-workspace";

export async function GET() {
  const insforge = createClient();
  const { data, error } = await insforge.auth.getSession();

  if (error || !data.session?.user) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Authentication required" },
      { status: 401 }
    );
  }

  const profile = await ensureProfile(insforge, data.session.user).catch(
    () => null
  );
  if (profile) {
    await ensureDefaultWorkspace(insforge, profile.id).catch(() => null);
  }

  return NextResponse.json({
    session: {
      user: data.session.user,
      access_token: "",
    },
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    accessToken?: string;
    keepSignedIn?: boolean;
    refreshToken?: string;
  } | null;

  if (!body?.accessToken || !body.refreshToken) {
    return NextResponse.json(
      { error: "Missing InsForge session tokens." },
      { status: 400 }
    );
  }

  const keepSignedIn = readKeepSignedInCookie(String(body.keepSignedIn));
  const response = NextResponse.json({ ok: true });
  response.cookies.set(INSFORGE_ACCESS_COOKIE, body.accessToken, {
    ...authCookieOptionsForMaxAge(accessCookieMaxAge, keepSignedIn),
  });
  response.cookies.set(INSFORGE_REFRESH_COOKIE, body.refreshToken, {
    ...authCookieOptionsForMaxAge(refreshCookieMaxAge, keepSignedIn),
  });
  response.cookies.set(INSFORGE_KEEP_SIGNED_IN_COOKIE, String(keepSignedIn), {
    ...authCookieOptionsForMaxAge(refreshCookieMaxAge, keepSignedIn),
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
  response.cookies.set(INSFORGE_KEEP_SIGNED_IN_COOKIE, "", {
    ...authCookieOptions,
    maxAge: 0,
  });

  return response;
}
