import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";

export interface EncryptedCredentialPayload {
  version: 1;
  algorithm: typeof ALGORITHM;
  iv: string;
  authTag: string;
  ciphertext: string;
}

export function encryptCredentialPayload(value: unknown): EncryptedCredentialPayload {
  const iv = crypto.randomBytes(12);
  const key = credentialKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const plaintext = JSON.stringify(value);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  return {
    version: 1,
    algorithm: ALGORITHM,
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: encrypted.toString("base64"),
  };
}

export function decryptCredentialPayload<T>(payload: unknown): T {
  if (!isEncryptedCredentialPayload(payload)) {
    throw new Error("Stored data source credential payload is invalid.");
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    credentialKey(),
    Buffer.from(payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");

  return JSON.parse(plaintext) as T;
}

function credentialKey(): Buffer {
  const raw = process.env.DATA_SOURCE_CREDENTIALS_KEY;
  if (!raw || raw.length < 32) {
    throw new Error(
      "DATA_SOURCE_CREDENTIALS_KEY must be set to a server-only secret of at least 32 characters before connecting external data sources."
    );
  }
  return crypto.createHash("sha256").update(raw).digest();
}

function isEncryptedCredentialPayload(value: unknown): value is EncryptedCredentialPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<EncryptedCredentialPayload>;
  return (
    payload.version === 1 &&
    payload.algorithm === ALGORITHM &&
    typeof payload.iv === "string" &&
    typeof payload.authTag === "string" &&
    typeof payload.ciphertext === "string"
  );
}
