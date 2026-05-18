import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useApiQuery } from "@/hooks/use-api-query";
import { useAuthStore } from "@/stores/auth-store";
import { TopBar } from "./top-bar";

const mockPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => "/app",
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/hooks/use-api-query", () => ({
  useApiQuery: vi.fn(),
}));

const mockedUseApiQuery = vi.mocked(useApiQuery);

describe("TopBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clear();
  });

  it("uses alert notification data for the bell state", () => {
    useAuthStore.getState().setWorkspaceContext({
      workspaceId: "00000000-0000-4000-8000-000000000001",
      role: "analyst",
    });
    mockedUseApiQuery.mockReturnValue({
      data: {
        notifications: [
          {
            id: "notification-1",
            metric_value: 12,
            threshold: 10,
            read: false,
            fired_at: "2026-05-18T00:00:00Z",
          },
        ],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<TopBar />);

    expect(screen.getByRole("button", { name: "Notifications, 1 unread" }))
      .toBeInTheDocument();
    expect(screen.queryByText("3")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Notifications, 1 unread" }));

    expect(screen.getByText(/Alert fired at 12/)).toBeInTheDocument();
    expect(screen.queryByText(/Churn rate crossed/)).not.toBeInTheDocument();
  });

  it("uses the signed-in user initials", () => {
    useAuthStore.getState().setUser({
      id: "user-1",
      email: "mina@example.com",
      user_metadata: { full_name: "Mina Patel" },
    });
    mockedUseApiQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<TopBar />);

    expect(screen.getByText("MP")).toBeInTheDocument();
    expect(screen.queryByText("AR")).not.toBeInTheDocument();
  });
});
