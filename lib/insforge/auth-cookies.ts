import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const INSFORGE_ACCESS_COOKIE = "insforge_access_token";
export const INSFORGE_REFRESH_COOKIE = "insforge_refresh_token";
export const INSFORGE_OAUTH_VERIFIER_COOKIE = "insforge_oauth_code_verifier";

export const authCookieOptions: Partial<ResponseCookie> = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

export const accessCookieMaxAge = 60 * 15;
export const refreshCookieMaxAge = 60 * 60 * 24 * 7;
export const oauthVerifierCookieMaxAge = 60 * 10;
