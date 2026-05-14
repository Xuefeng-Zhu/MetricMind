/**
 * Unit tests for Workspace Home page.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
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

vi.mock("@/components/data-table/data-table", () => ({
  DataTable: ({ caption }: { caption?: string }) => (
    <div data-testid="data-table">{caption}</div>
  ),
}));

vi.mock("@/components/dashboard/kpi-card", () => ({
  KPICard: ({ label }: { label: string }) => <div data-testid="kpi-card">{label}</div>,
}));

vi.mock("@/components/ui/progress", () => ({
  Progress: ({ value }: { value: number }) => (
    <div data-testid="progress" aria-valuenow={value} />
  ),
}));

import WorkspaceHomePage from "../page";
import { useApiQuery } from "@/hooks/use-api-query";

const mockedUseApiQuery = vi.mocked(useApiQuery);

const mockDashboard = {
  kpis: [{ label: "MRR", value: "$125K", trend: "up", trendValue: "+12%" }],
  revenue: [
    { month: "Jan", mrr: 100000, starter: 30000, growth: 40000, enterprise: 30000 },
  ],
  planMix: [{ plan: "Starter", revenue: 30000 }],
  weeklyActiveUsers: [{ week: "W1", current: 500, previous: 450 }],
  topExpansionAccounts: [
    { name: "Acme", expansionMrr: 5000, growthPercent: 25, plan: "Growth" },
  ],
  aiInsight: { summary: "Revenue growing steadily", confidence: 92, link: "/insights" },
};

const mockMetrics = {
  metrics: [
    {
      id: "m1",
      name: "MRR",
      formula: "SUM(amount)",
      owner: "Finance",
      certified: true,
      certified_date: "2024-01-15",
    },
  ],
};

describe("WorkspaceHomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loading state", () => {
    it("renders loading skeletons when data is being fetched", () => {
      mockedUseApiQuery.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      });

      render(<WorkspaceHomePage />);

      const skeletons = screen.getAllByRole("status");
      expect(skeletons.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("error state", () => {
    it("renders an error message with a retry button when the dashboard API fails", () => {
      // First call (dashboard) returns error, second call (metrics) returns loading
      mockedUseApiQuery
        .mockReturnValueOnce({
          data: null,
          isLoading: false,
          error: "Failed to load dashboard",
          refetch: vi.fn(),
        })
        .mockReturnValueOnce({
          data: null,
          isLoading: true,
          error: null,
          refetch: vi.fn(),
        });

      render(<WorkspaceHomePage />);

      // Dashboard error appears in multiple sections (KPIs, Revenue, Trust Health)
      const errorMessages = screen.getAllByText("Failed to load dashboard");
      expect(errorMessages.length).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByRole("button", { name: /try again/i }).length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  describe("success state", () => {
    it("renders KPI cards, chart, metrics table, and trust health", () => {
      // First call (dashboard) returns data, second call (metrics) returns data
      mockedUseApiQuery
        .mockReturnValueOnce({
          data: mockDashboard,
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        })
        .mockReturnValueOnce({
          data: mockMetrics,
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        });

      render(<WorkspaceHomePage />);

      // KPI cards
      expect(screen.getByText("MRR")).toBeInTheDocument();
      expect(screen.getByTestId("kpi-card")).toBeInTheDocument();

      // Revenue chart
      expect(screen.getByTestId("simple-line-chart")).toBeInTheDocument();

      // Metrics table
      expect(screen.getByTestId("data-table")).toBeInTheDocument();

      // Trust health (progress bar with AI confidence)
      expect(screen.getByTestId("progress")).toBeInTheDocument();
      expect(screen.getByText("92%")).toBeInTheDocument();
    });
  });
});
