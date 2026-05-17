import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPush = vi.hoisted(() => vi.fn());
const mockReplace = vi.hoisted(() => vi.fn());
const mockSetUser = vi.hoisted(() => vi.fn());
const mockSetSession = vi.hoisted(() => vi.fn());
const mockSignInWithPassword = vi.hoisted(() => vi.fn());
const mockBootstrapWorkspaceContext = vi.hoisted(() => vi.fn());
const mockAuthUser = vi.hoisted(() => ({ current: null as null | { id: string; email: string } }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

vi.mock("@/lib/insforge/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
    },
  }),
}));

vi.mock("@/lib/workspaces/client-workspace-bootstrap", () => ({
  bootstrapWorkspaceContext: mockBootstrapWorkspaceContext,
}));

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: () => ({
    user: mockAuthUser.current,
    setSession: mockSetSession,
    setUser: mockSetUser,
  }),
}));

import LoginPage from "./page";

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser.current = null;
    mockBootstrapWorkspaceContext.mockResolvedValue(undefined);
    mockSignInWithPassword.mockResolvedValue({
      data: {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        user: { id: "user-123", email: "person@example.com" },
      },
      error: null,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ ok: true }))
    );
  });

  it("redirects an already-authenticated user to the app", async () => {
    mockAuthUser.current = { id: "user-123", email: "person@example.com" };

    render(<LoginPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/app");
    });
  });

  it("defaults to keeping users signed in and keeps Google sign-in persistent", () => {
    render(<LoginPage />);

    expect(
      screen.getByRole("checkbox", { name: /keep me signed in/i })
    ).toBeChecked();
    expect(
      screen.getByRole("link", { name: /continue with google/i })
    ).toHaveAttribute("href", "/api/auth/oauth/google?keepSignedIn=true");
    expect(
      screen.queryByRole("button", { name: /continue with microsoft/i })
    ).not.toBeInTheDocument();

    const passwordInput = screen.getByLabelText(/password/i);
    const keepSignedIn = screen.getByRole("checkbox", {
      name: /keep me signed in/i,
    });
    const logInButton = screen.getByRole("button", { name: /log in/i });
    expect(
      passwordInput.compareDocumentPosition(keepSignedIn) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      keepSignedIn.compareDocumentPosition(logInButton) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("posts the disabled keep-signed-in preference with email login only", async () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("checkbox", { name: /keep me signed in/i }));
    expect(
      screen.getByRole("link", { name: /continue with google/i })
    ).toHaveAttribute("href", "/api/auth/oauth/google?keepSignedIn=true");
    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: "person@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "correct-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/session",
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    const [, requestInit] = vi.mocked(fetch).mock.calls[0] as [
      string,
      RequestInit
    ];
    expect(JSON.parse(requestInit.body as string)).toMatchObject({
      accessToken: "access-token",
      keepSignedIn: false,
      refreshToken: "refresh-token",
    });
    expect(mockPush).toHaveBeenCalledWith("/app");
  });

  it("does not redirect when workspace bootstrap fails after password login", async () => {
    mockBootstrapWorkspaceContext.mockRejectedValue(
      new Error("Failed to load workspaces")
    );

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: "person@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "correct-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    expect(
      await screen.findByText("Failed to load workspaces")
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockSetUser).toHaveBeenLastCalledWith(null);
    expect(mockSetSession).toHaveBeenLastCalledWith(null);
  });
});
