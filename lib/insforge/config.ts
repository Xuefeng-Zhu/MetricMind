export function getInsForgeUrl(): string {
  const url = process.env.NEXT_PUBLIC_INSFORGE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_INSFORGE_URL is not configured.");
  }
  return url;
}

export function getInsForgeAnonKey(): string {
  const anonKey =
    process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ?? process.env.INSFORGE_ANON_KEY;

  if (!anonKey) {
    throw new Error("NEXT_PUBLIC_INSFORGE_ANON_KEY is not configured.");
  }

  return anonKey;
}
