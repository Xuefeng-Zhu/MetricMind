import { describe, expect, it } from "vitest";

import {
  decryptCredentialPayload,
  decryptSecretText,
  encryptCredentialPayload,
  encryptSecretText,
  isEncryptedSecretText,
} from "@/lib/security/credential-crypto";

describe("data source credential crypto", () => {
  it("encrypts credential payloads without leaking plaintext", () => {
    process.env.DATA_SOURCE_CREDENTIALS_KEY = "test-data-source-credential-key-12345";

    const encrypted = encryptCredentialPayload({
      type: "postgres",
      password: "super-secret",
    });

    expect(JSON.stringify(encrypted)).not.toContain("super-secret");
    expect(decryptCredentialPayload(encrypted)).toMatchObject({
      type: "postgres",
      password: "super-secret",
    });
  });

  it("encrypts text secrets for text-only database columns", () => {
    process.env.DATA_SOURCE_CREDENTIALS_KEY = "test-data-source-credential-key-12345";

    const encrypted = encryptSecretText("sk-secret-ai-key");

    expect(encrypted).not.toContain("sk-secret-ai-key");
    expect(isEncryptedSecretText(encrypted)).toBe(true);
    expect(decryptSecretText(encrypted)).toBe("sk-secret-ai-key");
  });
});
