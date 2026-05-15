import { NextResponse, type NextRequest } from "next/server";

import {
  authCookieOptions,
  INSFORGE_OAUTH_VERIFIER_COOKIE,
  oauthVerifierCookieMaxAge,
} from "@/lib/insforge/auth-cookies";
import { createClient } from "@/lib/insforge/server";

const supportedProviders = new Set(["google"]);

function redirectToLogin(request: NextRequest, error: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const provider = params.provider.toLowerCase();

  if (!supportedProviders.has(provider)) {
    return redirectToLogin(request, "unsupported_oauth_provider");
  }

  const insforge = createClient();
  const redirectTo = new URL("/api/auth/callback", request.url).toString();
  const { data, error } = await insforge.auth.signInWithOAuth({
    provider,
    redirectTo,
    skipBrowserRedirect: true,
  });

  if (error || !data?.url || !data.codeVerifier) {
    return redirectToLogin(request, "oauth_init_failed");
  }

  const response = NextResponse.redirect(data.url);
  response.cookies.set(INSFORGE_OAUTH_VERIFIER_COOKIE, data.codeVerifier, {
    ...authCookieOptions,
    maxAge: oauthVerifierCookieMaxAge,
  });

  return response;
}
