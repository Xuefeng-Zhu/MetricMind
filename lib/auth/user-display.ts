import type { User } from "@/lib/insforge/types";

const NAME_METADATA_KEYS = ["name", "full_name", "display_name"] as const;

export function getUserDisplayName(user: User | null | undefined): string {
  for (const key of NAME_METADATA_KEYS) {
    const value = user?.user_metadata?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  const email = typeof user?.email === "string" ? user.email.trim() : "";
  if (email) {
    return email.split("@")[0] || email;
  }

  return "Workspace user";
}

export function getUserInitials(user: User | null | undefined): string {
  const displayName = getUserDisplayName(user);
  const words = displayName
    .split(/[\s._-]+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return (words[0]?.slice(0, 2) || "WU").toUpperCase();
}
