import { describe, expect, it } from "vitest";

import { decryptCredentialPayload, encryptCredentialPayload } from "./credential-crypto";

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
});
