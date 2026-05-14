/**
 * Unit tests for Explore page.
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock hooks
vi.mock("@/hooks/use-api-mutation", () => ({
  useApiMutation: vi.fn(),
}));

// Mock chart component (requires canvas/SVG)
vi.mock("@/components/charts/simple-bar-chart", () => ({
  SimpleBarChart: (props: Record<string, unknown>) => (
    <div data-testid="simple-bar-chart" aria-label={props["aria-label"] as string} />
  ),
}));

// Mock DataTable component
vi.mock("@/components/data-table/data-table", () => ({
  DataTable: (props: Record<string, unknown>) => (
    <div data-testid="data-table" data-caption={props.caption as string} />
  ),
}));

import ExplorePage from "../page";
import { useApiMutation } from "@/hooks/use-api-mutation";

const mockedUseApiMutation = vi.mocked(useApiMutation);

// ─── Mock data ──────────────────────────────────────────────────────────────

const mockResult = {
  success: true,
  data: {
    summary: "MRR breakdown by plan",
    sql: "SELECT plan, SUM(amount) as mrr FROM subscriptions GROUP BY plan",
    results: [
      { plan: "Starter", mrr: "50000" },
      { plan: "Growth", mrr: "75000" },
    ],
    chartData: [
      { plan: "Starter", mrr: 50000 },
      { plan: "Growth", mrr: 75000 },
    ],
  },
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("ExplorePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Run Query triggers mutation (Req 5.1)", () => {
    it("calls mutate with correct body when Run Query is clicked", () => {
      const mockMutate = vi.fn().mockResolvedValue(null);
      mockedUseApiMutation.mockReturnValue({
        mutate: mockMutate,
        isLoading: false,
        error: null,
      });

      render(<ExplorePage />);

      const runButton = screen.getByRole("button", { name: /run query/i });
      fireEvent.click(runButton);

      expect(mockMutate).toHaveBeenCalledTimes(1);
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          question: expect.stringContaining("MRR"),
          metric: "MRR",
          dimensions: ["Plan", "Month"],
        })
      );
    });
  });

  describe("loading state (Req 5.2)", () => {
    it("renders loading skeleton in results area when query is processing", () => {
      mockedUseApiMutation.mockReturnValue({
        mutate: vi.fn().mockResolvedValue(null),
        isLoading: true,
        error: null,
      });

      render(<ExplorePage />);

      // LoadingSkeleton renders with role="status"
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
  });

  describe("error state (Req 5.3)", () => {
    it("displays error message when query fails", () => {
      mockedUseApiMutation.mockReturnValue({
        mutate: vi.fn().mockResolvedValue(null),
        isLoading: false,
        error: "Query execution failed",
      });

      render(<ExplorePage />);

      expect(screen.getByText("Query execution failed")).toBeInTheDocument();
    });

    it("renders a retry button on error", () => {
      mockedUseApiMutation.mockReturnValue({
        mutate: vi.fn().mockResolvedValue(null),
        isLoading: false,
        error: "Query execution failed",
      });

      render(<ExplorePage />);

      expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    });
  });

  describe("success state renders chart, table, and SQL (Req 5.4, 5.5)", () => {
    it("renders chart, data table, and SQL section after successful query", async () => {
      const mockMutate = vi.fn().mockResolvedValue(mockResult);
      mockedUseApiMutation.mockReturnValue({
        mutate: mockMutate,
        isLoading: false,
        error: null,
      });

      render(<ExplorePage />);

      // Trigger the query
      const runButton = screen.getByRole("button", { name: /run query/i });
      fireEvent.click(runButton);

      // Wait for the result to render
      await vi.waitFor(() => {
        expect(screen.getByTestId("simple-bar-chart")).toBeInTheDocument();
      });

      // Data table should render
      expect(screen.getByTestId("data-table")).toBeInTheDocument();

      // Generated SQL section should render
      expect(screen.getByRole("button", { name: /generated sql/i })).toBeInTheDocument();
    });
  });
});
