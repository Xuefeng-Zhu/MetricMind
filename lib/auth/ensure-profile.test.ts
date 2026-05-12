import { describe, it, expect, vi, beforeEach } from "vitest";
import { ensureProfile } from "./ensure-profile";
import { User } from "@supabase/supabase-js";

function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-123",
    email: "test@example.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2024-01-01T00:00:00Z",
    ...overrides,
  } as User;
}

function createMockSupabase(options: {
  selectResult?: { data: unknown; error: unknown };
  insertResult?: { data: unknown; error: unknown };
  retrySelectResult?: { data: unknown; error: unknown };
}) {
  let selectCallCount = 0;

  const single = vi.fn().mockImplementation(() => {
    selectCallCount++;
    if (selectCallCount === 1) {
      return Promise.resolve(options.selectResult ?? { data: null, error: { code: "PGRST116", message: "not found" } });
    }
    // Retry select (for race condition handling)
    return Promise.resolve(options.retrySelectResult ?? options.selectResult ?? { data: null, error: null });
  });

  const insertSingle = vi.fn().mockImplementation(() => {
    return Promise.resolve(options.insertResult ?? { data: null, error: null });
  });

  const selectFn = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single }) });
  const insertSelectFn = vi.fn().mockReturnValue({ single: insertSingle });
  const insertFn = vi.fn().mockReturnValue({ select: insertSelectFn });

  const from = vi.fn().mockReturnValue({
    select: selectFn,
    insert: insertFn,
  });

  return { from } as unknown as Parameters<typeof ensureProfile>[0];
}

describe("ensureProfile", () => {
  it("returns existing profile if one already exists", async () => {
    const existingProfile = {
      id: "profile-1",
      auth_user_id: "user-123",
      display_name: "testuser",
      avatar_url: null,
    };

    const supabase = createMockSupabase({
      selectResult: { data: existingProfile, error: null },
    });

    const user = createMockUser();
    const result = await ensureProfile(supabase, user);

    expect(result).toEqual(existingProfile);
  });

  it("creates a new profile when none exists", async () => {
    const newProfile = {
      id: "profile-new",
      auth_user_id: "user-123",
      display_name: "test",
      avatar_url: null,
    };

    const supabase = createMockSupabase({
      selectResult: { data: null, error: { code: "PGRST116", message: "not found" } },
      insertResult: { data: newProfile, error: null },
    });

    const user = createMockUser();
    const result = await ensureProfile(supabase, user);

    expect(result).toEqual(newProfile);
  });

  it("uses email prefix as display_name when no metadata is provided", async () => {
    const newProfile = {
      id: "profile-new",
      auth_user_id: "user-123",
      display_name: "john",
      avatar_url: null,
    };

    const supabase = createMockSupabase({
      selectResult: { data: null, error: { code: "PGRST116", message: "not found" } },
      insertResult: { data: newProfile, error: null },
    });

    const user = createMockUser({ email: "john@company.com" });
    const result = await ensureProfile(supabase, user);

    expect(result).toEqual(newProfile);
    // Verify insert was called
    expect(supabase.from).toHaveBeenCalledWith("profiles");
  });

  it("handles race condition with unique constraint violation", async () => {
    const raceProfile = {
      id: "profile-race",
      auth_user_id: "user-123",
      display_name: "test",
      avatar_url: null,
    };

    const supabase = createMockSupabase({
      selectResult: { data: null, error: { code: "PGRST116", message: "not found" } },
      insertResult: { data: null, error: { code: "23505", message: "duplicate key" } },
      retrySelectResult: { data: raceProfile, error: null },
    });

    const user = createMockUser();
    const result = await ensureProfile(supabase, user);

    expect(result).toEqual(raceProfile);
  });

  it("throws error when insert fails with non-unique-constraint error", async () => {
    const supabase = createMockSupabase({
      selectResult: { data: null, error: { code: "PGRST116", message: "not found" } },
      insertResult: { data: null, error: { code: "42P01", message: "relation does not exist" } },
    });

    const user = createMockUser();

    await expect(ensureProfile(supabase, user)).rejects.toThrow(
      "Failed to ensure profile for user user-123"
    );
  });
});
