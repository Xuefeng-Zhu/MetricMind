import { NextResponse, type NextRequest } from "next/server";

import { ensureProfile } from "@/lib/auth/ensure-profile";
import {
  accessCookieMaxAge,
  authCookieOptions,
  authCookieOptionsForMaxAge,
  INSFORGE_ACCESS_COOKIE,
  INSFORGE_KEEP_SIGNED_IN_COOKIE,
  INSFORGE_OAUTH_VERIFIER_COOKIE,
  INSFORGE_REFRESH_COOKIE,
  readKeepSignedInCookie,
  refreshCookieMaxAge,
} from "@/lib/insforge/auth-cookies";
import { createClient } from "@/lib/insforge/server";
import { ensureDefaultWorkspace } from "@/lib/workspaces/ensure-default-workspace";

function clearOAuthVerifier(response: NextResponse) {
  response.cookies.set(INSFORGE_OAUTH_VERIFIER_COOKIE, "", {
    ...authCookieOptions,
    maxAge: 0,
  });
}

function redirectToLogin(request: NextRequest, error: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);
  const response = NextResponse.redirect(url);
  clearOAuthVerifier(response);
  return response;
}

export async function GET(request: NextRequest) {
  const providerError =
    request.nextUrl.searchParams.get("error") ??
    request.nextUrl.searchParams.get("error_description");
  const code = request.nextUrl.searchParams.get("insforge_code");

  if (providerError) {
    return redirectToLogin(request, "oauth_provider_error");
  }

  if (!code) {
    return redirectToLogin(request, "oauth_code_missing");
  }

  const codeVerifier = request.cookies.get(INSFORGE_OAUTH_VERIFIER_COOKIE)?.value;

  if (!codeVerifier) {
    return redirectToLogin(request, "oauth_verifier_missing");
  }

  const keepSignedIn = readKeepSignedInCookie(
    request.cookies.get(INSFORGE_KEEP_SIGNED_IN_COOKIE)?.value
  );
  const insforge = createClient();
  const { data, error } = await insforge.auth.exchangeOAuthCode(code, codeVerifier);

  if (error || !data?.accessToken || !data.refreshToken || !data.user) {
    return redirectToLogin(request, "oauth_exchange_failed");
  }

  let profile: Awaited<ReturnType<typeof ensureProfile>>;
  try {
    profile = await ensureProfile(insforge, data.user);
  } catch {
    return redirectToLogin(request, "profile_setup_failed");
  }

  try {
    await ensureDefaultWorkspace(insforge, profile.id);
  } catch {
    return redirectToLogin(request, "workspace_setup_failed");
  }

  const response = NextResponse.redirect(new URL("/app", request.url));
  response.cookies.set(INSFORGE_ACCESS_COOKIE, data.accessToken, {
    ...authCookieOptionsForMaxAge(accessCookieMaxAge, keepSignedIn),
  });
  response.cookies.set(INSFORGE_REFRESH_COOKIE, data.refreshToken, {
    ...authCookieOptionsForMaxAge(refreshCookieMaxAge, keepSignedIn),
  });
  response.cookies.set(INSFORGE_KEEP_SIGNED_IN_COOKIE, String(keepSignedIn), {
    ...authCookieOptionsForMaxAge(refreshCookieMaxAge, keepSignedIn),
  });
  clearOAuthVerifier(response);

  return response;
}
