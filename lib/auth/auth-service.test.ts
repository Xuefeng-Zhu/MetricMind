import { describe, it, expect, vi } from "vitest";
import { createAuthService } from "./auth-service";
import { SupabaseClient } from "@supabase/supabase-js";

function createMockSupabase(overrides: {
  signUp?: ReturnType<SupabaseClient["auth"]["signUp"]>;
  signInWithPassword?: ReturnType<SupabaseClient["auth"]["signInWithPassword"]>;
  signOut?: ReturnType<SupabaseClient["auth"]["signOut"]>;
  getSession?: ReturnType<SupabaseClient["auth"]["getSession"]>;
} = {}) {
  return {
    auth: {
      signUp: vi.fn().mockReturnValue(
        overrides.signUp ?? Promise.resolve({ data: { user: null }, error: null })
      ),
      signInWithPassword: vi.fn().mockReturnValue(
        overrides.signInWithPassword ?? Promise.resolve({ data: { user: null }, error: null })
      ),
      signOut: vi.fn().mockReturnValue(
        overrides.signOut ?? Promise.resolve({ error: null })
      ),
      getSession: vi.fn().mockReturnValue(
        overrides.getSession ?? Promise.resolve({ data: { session: null }, error: null })
      ),
    },
  } as unknown as SupabaseClient;
}

describe("AuthService", () => {
  describe("signUp", () => {
    it("returns user on successful signup", async () => {
      const mockUser = { id: "user-1", email: "test@example.com" };
      const supabase = createMockSupabase({
        signUp: Promise.resolve({
          data: { user: mockUser, session: null },
          error: null,
        }) as any,
      });

      const authService = createAuthService(supabase);
      const result = await authService.signUp("test@example.com", "password123");

      expect(result.user).toEqual(mockUser);
      expect(result.error).toBeNull();
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      });
    });

    it("returns error when email is already registered", async () => {
      const mockError = {
        message: "User already registered",
        status: 400,
        name: "AuthApiError",
      };
      const supabase = createMockSupabase({
        signUp: Promise.resolve({
          data: { user: null, session: null },
          error: mockError,
        }) as any,
      });

      const authService = createAuthService(supabase);
      const result = await authService.signUp("existing@example.com", "password123");

      expect(result.user).toBeNull();
      expect(result.error).toEqual(mockError);
    });
  });

  describe("signIn", () => {
    it("returns user on successful login", async () => {
      const mockUser = { id: "user-1", email: "test@example.com" };
      const supabase = createMockSupabase({
        signInWithPassword: Promise.resolve({
          data: { user: mockUser, session: { access_token: "token" } },
          error: null,
        }) as any,
      });

      const authService = createAuthService(supabase);
      const result = await authService.signIn("test@example.com", "password123");

      expect(result.user).toEqual(mockUser);
      expect(result.error).toBeNull();
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      });
    });

    it("returns error on invalid credentials", async () => {
      const mockError = {
        message: "Invalid login credentials",
        status: 400,
        name: "AuthApiError",
      };
      const supabase = createMockSupabase({
        signInWithPassword: Promise.resolve({
          data: { user: null, session: null },
          error: mockError,
        }) as any,
      });

      const authService = createAuthService(supabase);
      const result = await authService.signIn("test@example.com", "wrongpassword");

      expect(result.user).toBeNull();
      expect(result.error).toEqual(mockError);
    });
  });

  describe("signOut", () => {
    it("signs out successfully", async () => {
      const supabase = createMockSupabase({
        signOut: Promise.resolve({ error: null }) as any,
      });

      const authService = createAuthService(supabase);
      await expect(authService.signOut()).resolves.toBeUndefined();
      expect(supabase.auth.signOut).toHaveBeenCalled();
    });

    it("throws error when signOut fails", async () => {
      const mockError = {
        message: "Session not found",
        status: 400,
        name: "AuthApiError",
      };
      const supabase = createMockSupabase({
        signOut: Promise.resolve({ error: mockError }) as any,
      });

      const authService = createAuthService(supabase);
      await expect(authService.signOut()).rejects.toEqual(mockError);
    });
  });

  describe("getSession", () => {
    it("returns session when authenticated", async () => {
      const mockSession = {
        access_token: "token",
        user: { id: "user-1", email: "test@example.com" },
      };
      const supabase = createMockSupabase({
        getSession: Promise.resolve({
          data: { session: mockSession },
          error: null,
        }) as any,
      });

      const authService = createAuthService(supabase);
      const session = await authService.getSession();

      expect(session).toEqual(mockSession);
    });

    it("returns null when not authenticated", async () => {
      const supabase = createMockSupabase({
        getSession: Promise.resolve({
          data: { session: null },
          error: null,
        }) as any,
      });

      const authService = createAuthService(supabase);
      const session = await authService.getSession();

      expect(session).toBeNull();
    });

    it("returns null when getSession errors", async () => {
      const supabase = createMockSupabase({
        getSession: Promise.resolve({
          data: { session: null },
          error: { message: "Token expired" },
        }) as any,
      });

      const authService = createAuthService(supabase);
      const session = await authService.getSession();

      expect(session).toBeNull();
    });
  });
});
