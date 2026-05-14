/**
 * Unit tests for Semantic Layer page.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock useApiQuery — the page calls it three times (entities, metrics, joins)
vi.mock("@/hooks/use-api-query", () => ({
  useApiQuery: vi.fn(),
}));

// Mock reactflow since it requires a DOM canvas
vi.mock("reactflow", () => {
  const MockReactFlow = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="reactflow-canvas">{children}</div>
  );
  const MockBackground = () => <div data-testid="reactflow-background" />;
  const MockControls = () => <div data-testid="reactflow-controls" />;
  const MockHandle = () => <div />;
  return {
    __esModule: true,
    default: MockReactFlow,
    Background: MockBackground,
    Controls: MockControls,
    Handle: MockHandle,
    Position: { Top: "top", Bottom: "bottom" },
    MarkerType: { ArrowClosed: "arrowclosed" },
    useNodesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
    useEdgesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  };
});

import SemanticLayerPage from "../page";
import { useApiQuery } from "@/hooks/use-api-query";

const mockedUseApiQuery = vi.mocked(useApiQuery);

// ─── Mock data ──────────────────────────────────────────────────────────────

const mockEntities = {
  entities: [
    {
      id: "e1",
      workspace_id: "ws-1",
      data_source_id: "ds-1",
      name: "Users",
      description: "User accounts",
      created_at: "2024-01-01",
    },
  ],
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

const mockJoins = {
  joins: [
    {
      id: "j1",
      source_entity_id: "e1",
      target_entity_id: "e2",
      join_type: "LEFT JOIN",
      condition: "users.id = orders.user_id",
    },
  ],
};

// ─── Helper to set up mock return values for the three useApiQuery calls ────

function mockApiCalls(
  entitiesReturn: ReturnType<typeof useApiQuery>,
  metricsReturn: ReturnType<typeof useApiQuery>,
  joinsReturn: ReturnType<typeof useApiQuery>
) {
  let callIndex = 0;
  mockedUseApiQuery.mockImplementation(() => {
    const returns = [entitiesReturn, metricsReturn, joinsReturn];
    const result = returns[callIndex % 3];
    callIndex++;
    return result;
  });
}

describe("SemanticLayerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loading state", () => {
    it("renders loading skeletons when all sections are loading", () => {
      const loadingReturn = {
        data: null,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      };

      mockApiCalls(loadingReturn, loadingReturn, loadingReturn);

      render(<SemanticLayerPage />);

      // Should show loading skeletons (role="status")
      const loadingElements = screen.getAllByRole("status");
      expect(loadingElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("partial failure", () => {
    it("renders error for metrics section while entities section renders normally", () => {
      const entitiesReturn = {
        data: mockEntities,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };
      const metricsReturn = {
        data: null,
        isLoading: false,
        error: "Failed to load metrics",
        refetch: vi.fn(),
      };
      const joinsReturn = {
        data: mockJoins,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };

      mockApiCalls(entitiesReturn, metricsReturn, joinsReturn);

      render(<SemanticLayerPage />);

      // Metrics error should be displayed
      expect(screen.getByText("Failed to load metrics")).toBeInTheDocument();
      // Entity graph area should still render
      expect(screen.getByLabelText("Entity relationship graph")).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("renders empty state message when no entities exist", () => {
      const entitiesReturn = {
        data: { entities: [] },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };
      const metricsReturn = {
        data: mockMetrics,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };
      const joinsReturn = {
        data: mockJoins,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };

      mockApiCalls(entitiesReturn, metricsReturn, joinsReturn);

      render(<SemanticLayerPage />);

      expect(screen.getByText("No entities defined")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Define entities to build your semantic model. Entities represent the core business objects in your data."
        )
      ).toBeInTheDocument();
    });
  });

  describe("success state", () => {
    it("renders entity graph area, detail panel, and metrics table", () => {
      const entitiesReturn = {
        data: mockEntities,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };
      const metricsReturn = {
        data: mockMetrics,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };
      const joinsReturn = {
        data: mockJoins,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };

      mockApiCalls(entitiesReturn, metricsReturn, joinsReturn);

      render(<SemanticLayerPage />);

      // Entity graph area should render
      expect(screen.getByLabelText("Entity relationship graph")).toBeInTheDocument();
      // Detail panel prompt should be visible (no entity selected yet)
      expect(screen.getByText("Click an entity node to view details")).toBeInTheDocument();
      // Certified Metrics section heading
      expect(screen.getByText("Certified Metrics")).toBeInTheDocument();
      // Metric data should be rendered in the table
      expect(screen.getByText("MRR")).toBeInTheDocument();
      expect(screen.getByText("SUM(amount)")).toBeInTheDocument();
    });
  });
});
