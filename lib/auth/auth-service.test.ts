import { describe, it, expect, vi } from "vitest";
import { createAuthService } from "./auth-service";
import { InsForgeDatabaseClient } from "@/lib/insforge/types";

function createMockInsForge(overrides: {
  signUp?: ReturnType<InsForgeDatabaseClient["auth"]["signUp"]>;
  signInWithPassword?: ReturnType<InsForgeDatabaseClient["auth"]["signInWithPassword"]>;
  signOut?: ReturnType<InsForgeDatabaseClient["auth"]["signOut"]>;
  getSession?: ReturnType<InsForgeDatabaseClient["auth"]["getSession"]>;
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
  } as unknown as InsForgeDatabaseClient;
}

describe("AuthService", () => {
  describe("signUp", () => {
    it("returns user on successful signup", async () => {
      const mockUser = { id: "user-1", email: "test@example.com" };
      const insforge = createMockInsForge({
        signUp: Promise.resolve({
          data: { user: mockUser, session: null },
          error: null,
        }) as any,
      });

      const authService = createAuthService(insforge);
      const result = await authService.signUp("test@example.com", "password123");

      expect(result.user).toEqual(mockUser);
      expect(result.error).toBeNull();
      expect(insforge.auth.signUp).toHaveBeenCalledWith({
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
      const insforge = createMockInsForge({
        signUp: Promise.resolve({
          data: { user: null, session: null },
          error: mockError,
        }) as any,
      });

      const authService = createAuthService(insforge);
      const result = await authService.signUp("existing@example.com", "password123");

      expect(result.user).toBeNull();
      expect(result.error).toEqual(mockError);
    });
  });

  describe("signIn", () => {
    it("returns user on successful login", async () => {
      const mockUser = { id: "user-1", email: "test@example.com" };
      const insforge = createMockInsForge({
        signInWithPassword: Promise.resolve({
          data: { user: mockUser, session: { access_token: "token" } },
          error: null,
        }) as any,
      });

      const authService = createAuthService(insforge);
      const result = await authService.signIn("test@example.com", "password123");

      expect(result.user).toEqual(mockUser);
      expect(result.error).toBeNull();
      expect(insforge.auth.signInWithPassword).toHaveBeenCalledWith({
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
      const insforge = createMockInsForge({
        signInWithPassword: Promise.resolve({
          data: { user: null, session: null },
          error: mockError,
        }) as any,
      });

      const authService = createAuthService(insforge);
      const result = await authService.signIn("test@example.com", "wrongpassword");

      expect(result.user).toBeNull();
      expect(result.error).toEqual(mockError);
    });
  });

  describe("signOut", () => {
    it("signs out successfully", async () => {
      const insforge = createMockInsForge({
        signOut: Promise.resolve({ error: null }) as any,
      });

      const authService = createAuthService(insforge);
      await expect(authService.signOut()).resolves.toBeUndefined();
      expect(insforge.auth.signOut).toHaveBeenCalled();
    });

    it("throws error when signOut fails", async () => {
      const mockError = {
        message: "Session not found",
        status: 400,
        name: "AuthApiError",
      };
      const insforge = createMockInsForge({
        signOut: Promise.resolve({ error: mockError }) as any,
      });

      const authService = createAuthService(insforge);
      await expect(authService.signOut()).rejects.toEqual(mockError);
    });
  });

  describe("getSession", () => {
    it("returns session when authenticated", async () => {
      const mockSession = {
        access_token: "token",
        user: { id: "user-1", email: "test@example.com" },
      };
      const insforge = createMockInsForge({
        getSession: Promise.resolve({
          data: { session: mockSession },
          error: null,
        }) as any,
      });

      const authService = createAuthService(insforge);
      const session = await authService.getSession();

      expect(session).toEqual(mockSession);
    });

    it("returns null when not authenticated", async () => {
      const insforge = createMockInsForge({
        getSession: Promise.resolve({
          data: { session: null },
          error: null,
        }) as any,
      });

      const authService = createAuthService(insforge);
      const session = await authService.getSession();

      expect(session).toBeNull();
    });

    it("returns null when getSession errors", async () => {
      const insforge = createMockInsForge({
        getSession: Promise.resolve({
          data: { session: null },
          error: { message: "Token expired" },
        }) as any,
      });

      const authService = createAuthService(insforge);
      const session = await authService.getSession();

      expect(session).toBeNull();
    });
  });
});
