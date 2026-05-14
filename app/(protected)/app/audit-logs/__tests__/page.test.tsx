/**
 * Unit tests for Audit Logs page.
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/hooks/use-api-query", () => ({
  useApiQuery: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/components/charts/simple-bar-chart", () => ({
  SimpleBarChart: (props: Record<string, unknown>) => (
    <div data-testid="simple-bar-chart" aria-label={props["aria-label"] as string} />
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

import AuditLogsPage from "../page";
import { useApiQuery } from "@/hooks/use-api-query";

const mockedUseApiQuery = vi.mocked(useApiQuery);

const mockAuditData = {
  events: [
    {
      id: "evt-1",
      workspace_id: "ws-1",
      actor_id: "user-alice",
      action: "query_blocked",
      target_type: "query",
      target_id: "q-123",
      metadata: {},
      created_at: "2024-04-15T10:30:00Z",
    },
  ],
};

describe("AuditLogsPage", () => {
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

      render(<AuditLogsPage />);

      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(screen.getByText("Audit Logs & Governance")).toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("renders an error message with a retry button when the API fails", () => {
      mockedUseApiQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: "Failed to load audit logs",
        refetch: vi.fn(),
      });

      render(<AuditLogsPage />);

      expect(screen.getByText("Failed to load audit logs")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    });
  });

  describe("filter change", () => {
    it("triggers re-fetch with correct query params when action filter changes", () => {
      mockedUseApiQuery.mockReturnValue({
        data: mockAuditData,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AuditLogsPage />);

      // Change the action type filter
      const actionSelect = screen.getByLabelText("Action Type");
      fireEvent.change(actionSelect, { target: { value: "query_blocked" } });

      // useApiQuery should have been called with updated params
      // The latest call should include the action filter param
      const lastCall = mockedUseApiQuery.mock.calls[mockedUseApiQuery.mock.calls.length - 1];
      expect(lastCall[0]).toBe("/api/audit-logs");
      expect(lastCall[1]).toEqual(
        expect.objectContaining({
          params: expect.objectContaining({
            action: "query_blocked",
          }),
        })
      );
    });
  });

  describe("success state", () => {
    it("renders all audit log sections with fetched data", () => {
      mockedUseApiQuery.mockReturnValue({
        data: mockAuditData,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AuditLogsPage />);

      // KPI cards
      const kpiCards = screen.getAllByTestId("kpi-card");
      expect(kpiCards.length).toBe(4);
      expect(screen.getByText("Blocked SQL")).toBeInTheDocument();
      expect(screen.getByText("AI Traces")).toBeInTheDocument();
      expect(screen.getByText("RLS Policy Checks")).toBeInTheDocument();
      expect(screen.getByText("PII Columns")).toBeInTheDocument();

      // Governance controls section
      expect(screen.getByLabelText("Governance controls")).toBeInTheDocument();
      expect(screen.getByText("SQL Denylist Enforcement")).toBeInTheDocument();
      expect(screen.getByText("PII Column Masking")).toBeInTheDocument();

      // AI Safety chart
      expect(screen.getByTestId("simple-bar-chart")).toBeInTheDocument();
      expect(screen.getByLabelText("AI safety activity")).toBeInTheDocument();

      // Event stream table
      expect(screen.getByTestId("data-table")).toBeInTheDocument();
      expect(screen.getByLabelText("Audit event stream")).toBeInTheDocument();
    });
  });
});
