import { decryptSecretText, encryptSecretText } from "@/lib/security/credential-crypto";

export function encryptAIProviderApiKey(apiKey: string): string {
  return encryptSecretText(apiKey.trim());
}

export function decryptAIProviderApiKey(storedApiKey: string): string {
  return decryptSecretText(storedApiKey);
}
