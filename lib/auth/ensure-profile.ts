import { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Ensures a profile record exists for the given authenticated user.
 * This is an application-layer fallback for when the database trigger
 * (00022_create_profile_trigger.sql) doesn't fire (e.g., during edge cases
 * with social auth providers or trigger failures).
 *
 * Requirements: 1.4 - Auto-create profile when new user is created
 */
export async function ensureProfile(
  supabase: SupabaseClient,
  user: User
): Promise<{ id: string; auth_user_id: string; display_name: string | null; avatar_url: string | null }> {
  // Check if profile already exists
  const { data: existingProfile, error: fetchError } = await supabase
    .from("profiles")
    .select("id, auth_user_id, display_name, avatar_url")
    .eq("auth_user_id", user.id)
    .single();

  if (existingProfile && !fetchError) {
    return existingProfile;
  }

  // Profile doesn't exist — create it as a fallback
  const displayName =
    user.user_metadata?.display_name ??
    (user.email ? user.email.split("@")[0] : null);

  const avatarUrl = user.user_metadata?.avatar_url ?? null;

  const { data: newProfile, error: insertError } = await supabase
    .from("profiles")
    .insert({
      auth_user_id: user.id,
      display_name: displayName,
      avatar_url: avatarUrl,
    })
    .select("id, auth_user_id, display_name, avatar_url")
    .single();

  if (insertError) {
    // If insert fails due to unique constraint (race condition with trigger),
    // try fetching again
    if (insertError.code === "23505") {
      const { data: raceProfile, error: raceError } = await supabase
        .from("profiles")
        .select("id, auth_user_id, display_name, avatar_url")
        .eq("auth_user_id", user.id)
        .single();

      if (raceProfile && !raceError) {
        return raceProfile;
      }
    }

    throw new Error(
      `Failed to ensure profile for user ${user.id}: ${insertError.message}`
    );
  }

  return newProfile;
}
