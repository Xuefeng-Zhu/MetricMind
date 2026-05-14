import { cookies } from "next/headers";

import {
  INSFORGE_ACCESS_COOKIE,
  INSFORGE_REFRESH_COOKIE,
} from "./auth-cookies";
import { createCompatClient } from "./compat";
import { getInsForgeAnonKey, getInsForgeUrl } from "./config";

export function createClient() {
  const cookieStore = cookies();
  const accessToken = cookieStore.get(INSFORGE_ACCESS_COOKIE)?.value;

  return createCompatClient({
    baseUrl: getInsForgeUrl(),
    anonKey: getInsForgeAnonKey(),
    edgeFunctionToken: accessToken,
    isServerMode: true,
  });
}

export function getServerRefreshToken() {
  return cookies().get(INSFORGE_REFRESH_COOKIE)?.value;
}
