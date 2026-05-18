import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/stores/auth-store";
import { AppSidebar } from "./app-sidebar";

const mockUsePathname = vi.hoisted(() => vi.fn(() => "/app/data-sources"));

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
}));

vi.mock("./workspace-switcher", () => ({
  WorkspaceSwitcher: () => <div>Workspace switcher</div>,
}));

describe("AppSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clear();
  });

  it("renders a mobile navigation landmark", () => {
    render(<AppSidebar />);

    const mobileNavigation = screen.getByRole("navigation", {
      name: "Mobile navigation",
    });

    expect(within(mobileNavigation).getByRole("link", { name: /data sources/i }))
      .toHaveAttribute("href", "/app/data-sources");
  });

  it("uses the signed-in user identity instead of placeholder copy", () => {
    useAuthStore.getState().setUser({
      id: "user-1",
      email: "mina@example.com",
      user_metadata: { full_name: "Mina Patel" },
    });

    render(<AppSidebar />);

    expect(screen.getByText("Mina Patel")).toBeInTheDocument();
    expect(screen.getByText("MP")).toBeInTheDocument();
    expect(screen.queryByText("Alex Rivera")).not.toBeInTheDocument();
    expect(screen.queryByText("AR")).not.toBeInTheDocument();
  });
});
