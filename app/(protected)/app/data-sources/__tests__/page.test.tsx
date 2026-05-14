/**
 * Unit tests for Data Sources page.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 */
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/hooks/use-api-query", () => ({
  useApiQuery: vi.fn(),
}));

import DataSourcesPage from "../page";
import { useApiQuery } from "@/hooks/use-api-query";

const mockedUseApiQuery = vi.mocked(useApiQuery);

describe("DataSourcesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loading state", () => {
    it("renders a loading skeleton when data is being fetched", () => {
      mockedUseApiQuery.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      });

      render(<DataSourcesPage />);

      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(screen.getByText("Data Sources")).toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("renders an error message with a retry button when the API fails", () => {
      const mockRefetch = vi.fn();
      mockedUseApiQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: "Something went wrong",
        refetch: mockRefetch,
      });

      render(<DataSourcesPage />);

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("renders encouragement to connect a source when no data sources exist", () => {
      mockedUseApiQuery.mockReturnValue({
        data: { dataSources: [] },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<DataSourcesPage />);

      expect(screen.getByText("No data sources connected")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Connect a data source or upload a CSV to get started with MetricMind."
        )
      ).toBeInTheDocument();
    });
  });

  describe("success state", () => {
    it("renders source cards with data source names", () => {
      mockedUseApiQuery.mockReturnValue({
        data: {
          dataSources: [
            {
              id: "1",
              name: "Sales DB",
              type: "database",
              status: "active",
              workspace_id: "ws-1",
              created_at: "2024-01-01",
            },
          ],
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<DataSourcesPage />);

      expect(screen.getByText("Sales DB")).toBeInTheDocument();
      expect(screen.getByLabelText("Connected data sources")).toBeInTheDocument();
    });
  });
});
