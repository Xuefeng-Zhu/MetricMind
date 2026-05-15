import { createCompatClient } from "./compat";
import { getInsForgeAnonKey, getInsForgeUrl } from "./config";

export function createClient() {
  return createCompatClient({
    baseUrl: getInsForgeUrl(),
    anonKey: getInsForgeAnonKey(),
    isServerMode: true,
  });
}
