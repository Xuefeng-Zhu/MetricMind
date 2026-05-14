/**
 * Unit tests for Executive Dashboard page.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4
 */
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/hooks/use-api-query", () => ({
  useApiQuery: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/charts/simple-line-chart", () => ({
  SimpleLineChart: (props: Record<string, unknown>) => (
    <div data-testid="simple-line-chart" aria-label={props["aria-label"] as string} />
  ),
}));

vi.mock("@/components/charts/horizontal-bar-chart", () => ({
  HorizontalBarChart: (props: Record<string, unknown>) => (
    <div data-testid="horizontal-bar-chart" aria-label={props["aria-label"] as string} />
  ),
}));

vi.mock("@/components/charts/grouped-bar-chart", () => ({
  GroupedBarChart: (props: Record<string, unknown>) => (
    <div data-testid="grouped-bar-chart" aria-label={props["aria-label"] as string} />
  ),
}));

vi.mock("@/components/data-table/data-table", () => ({
  DataTable: ({ caption }: { caption?: string }) => (
    <div data-testid="data-table">{caption}</div>
  ),
}));

vi.mock("@/components/dashboard/kpi-card", () => ({
  KPICard: ({ label }: { label: string }) => <div data-testid="kpi-card">{label}</div>,
}));

import ExecutiveDashboardPage from "../page";
import { useApiQuery } from "@/hooks/use-api-query";

const mockedUseApiQuery = vi.mocked(useApiQuery);

const mockData = {
  kpis: [{ label: "MRR", value: "$125K", trend: "up", trendValue: "+12%" }],
  revenue: [{ month: "Jan", mrr: 100000, starter: 30000, growth: 40000, enterprise: 30000 }],
  planMix: [{ plan: "Starter", revenue: 30000 }],
  weeklyActiveUsers: [{ week: "W1", current: 500, previous: 450 }],
  topExpansionAccounts: [{ name: "Acme Corp", expansionMrr: 5000, growthPercent: 25, plan: "Growth" }],
  aiInsight: { summary: "Revenue growing steadily", confidence: 92, link: "/insights" },
};

describe("ExecutiveDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loading state", () => {
    it("renders loading skeletons for each section", () => {
      mockedUseApiQuery.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      });

      render(<ExecutiveDashboardPage />);

      const skeletons = screen.getAllByRole("status");
      // Page has multiple sections: KPIs, MRR chart, Plan Mix, AI Insight, WAU chart, Expansion table
      expect(skeletons.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("error state", () => {
    it("renders error message with retry button when API fails", () => {
      mockedUseApiQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: "Failed to load",
        refetch: vi.fn(),
      });

      render(<ExecutiveDashboardPage />);

      const errorMessages = screen.getAllByText("Failed to load");
      expect(errorMessages.length).toBeGreaterThanOrEqual(1);

      const retryButtons = screen.getAllByRole("button", { name: /try again/i });
      expect(retryButtons.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("success state", () => {
    it("renders all dashboard sections with fetched data", () => {
      mockedUseApiQuery.mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<ExecutiveDashboardPage />);

      // KPI cards
      expect(screen.getByTestId("kpi-card")).toBeInTheDocument();
      expect(screen.getByText("MRR")).toBeInTheDocument();

      // MRR trend chart
      expect(screen.getByTestId("simple-line-chart")).toBeInTheDocument();

      // Plan mix chart
      expect(screen.getByTestId("horizontal-bar-chart")).toBeInTheDocument();

      // Weekly active users chart
      expect(screen.getByTestId("grouped-bar-chart")).toBeInTheDocument();

      // AI insight card
      expect(screen.getByText("Revenue growing steadily")).toBeInTheDocument();
      expect(screen.getByText("92% confidence")).toBeInTheDocument();

      // Expansion accounts table
      expect(screen.getByTestId("data-table")).toBeInTheDocument();
      expect(screen.getByText("Top accounts by expansion MRR")).toBeInTheDocument();
    });
  });
});
