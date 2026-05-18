import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DataSourcesPageData } from "@/lib/data-sources/types";

const mockToast = vi.hoisted(() => vi.fn());
const mockPush = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

import { DataSourceDetailPage } from "@/components/data-sources/data-source-detail-page";
import { DataSourcesPage } from "@/components/data-sources/data-sources-page";
import { DatasetDetailPage } from "@/components/data-sources/dataset-detail-page";

const pageData: DataSourcesPageData = {
  workspaceId: "00000000-0000-4000-8000-000000000001",
  role: "admin",
  sources: [
    {
      id: "source-csv-customers",
      name: "CSV Upload: Customers",
      type: "csv",
      provider: "CSV",
      category: "File Upload",
      status: "healthy",
      syncStatus: "synced",
      healthScore: 94,
      rowCount: 2,
      datasetCount: 1,
      issueCount: 0,
      owner: "Revenue Operations",
      region: "Manual",
      credentialStatus: "manual",
      connectorVersion: "csv-import",
      lastSyncedAt: "2026-05-16T00:00:00Z",
      nextSyncAt: null,
      description: "Uploaded customer records for governed analysis.",
      tags: ["csv", "customers"],
    },
    {
      id: "source-demo-saas",
      name: "Demo SaaS Dataset",
      type: "demo",
      provider: "MetricMind",
      category: "Demo",
      status: "warning",
      syncStatus: "attention",
      healthScore: 81,
      rowCount: 4,
      datasetCount: 1,
      issueCount: 1,
      owner: "MetricMind Demo",
      region: "Sandbox",
      credentialStatus: "manual",
      connectorVersion: "demo-2026.05",
      lastSyncedAt: "2026-05-16T01:00:00Z",
      nextSyncAt: null,
      description: "Demo workspace data created through the backend connector.",
      tags: ["demo", "saas"],
    },
  ],
  datasets: [
    {
      id: "dataset-customers",
      sourceId: "source-csv-customers",
      name: "customers",
      displayName: "Customers",
      description: "Customer account records.",
      rowCount: 2,
      columnCount: 3,
      primaryKey: "customer_id",
      updatedAt: "2026-05-16T00:00:00Z",
      freshness: "Just now",
      qualityScore: 94,
      semanticCoverage: 75,
      piiColumnCount: 1,
      owner: "Revenue Operations",
      status: "ready",
      sampleQuestion: "Which customer segments expanded fastest?",
      semanticSuggestions: [
        {
          id: "suggest-customers-entity",
          type: "dimension",
          title: "Create Customer entity",
          description: "Map customer_id as the primary entity key.",
          confidence: 96,
          actionLabel: "Add entity",
        },
      ],
    },
    {
      id: "dataset-demo-subscriptions",
      sourceId: "source-demo-saas",
      name: "subscriptions",
      displayName: "Subscriptions",
      description: "Subscription lifecycle rows.",
      rowCount: 4,
      columnCount: 3,
      primaryKey: "subscription_id",
      updatedAt: "2026-05-16T01:00:00Z",
      freshness: "Just now",
      qualityScore: 88,
      semanticCoverage: 80,
      piiColumnCount: 0,
      owner: "MetricMind Demo",
      status: "ready",
      sampleQuestion: "What drove MRR movement by plan?",
      semanticSuggestions: [
        {
          id: "suggest-demo-mrr",
          type: "metric",
          title: "Define Monthly Recurring Revenue",
          description: "Use mrr_cents as the recurring revenue measure.",
          confidence: 93,
          actionLabel: "Draft metric",
        },
      ],
    },
  ],
  columnsByDatasetId: {
    "dataset-customers": [
      {
        name: "customer_id",
        dataType: "text",
        nullable: false,
        semanticRole: "primary_key",
        semanticType: "Customer identifier",
        description: "Stable customer key.",
        sampleValues: ["cus_1", "cus_2"],
        qualityScore: 99,
        uniqueness: "2 values",
      },
      {
        name: "email",
        dataType: "text",
        nullable: false,
        semanticRole: "pii",
        semanticType: "Restricted email",
        description: "Billing contact email.",
        sampleValues: ["ada@example.com", "grace@example.com"],
        qualityScore: 95,
        uniqueness: "2 values",
      },
    ],
    "dataset-demo-subscriptions": [
      {
        name: "subscription_id",
        dataType: "text",
        nullable: false,
        semanticRole: "primary_key",
        semanticType: "Subscription identifier",
        description: "Stable subscription key.",
        sampleValues: ["sub_1", "sub_2"],
        qualityScore: 99,
        uniqueness: "4 values",
      },
      {
        name: "mrr_cents",
        dataType: "integer",
        nullable: false,
        semanticRole: "measure",
        semanticType: "Monthly recurring revenue",
        description: "Monthly recurring revenue in cents.",
        sampleValues: ["129900", "249900"],
        qualityScore: 96,
        uniqueness: "4 values",
        suggestedAggregation: "sum",
      },
    ],
  },
  issues: [
    {
      id: "issue-demo-coverage",
      sourceId: "source-demo-saas",
      datasetId: "dataset-demo-subscriptions",
      severity: "warning",
      status: "open",
      title: "Semantic coverage below target",
      description: "Subscriptions needs one measure reviewed before certification.",
      detectedAt: "2026-05-16T01:00:00Z",
      recommendation: "Review suggested MRR metric.",
    },
  ],
  syncRuns: [
    {
      id: "sync-1",
      sourceId: "source-csv-customers",
      status: "success",
      startedAt: "2026-05-16T00:00:00Z",
      duration: "3s",
      rowsSynced: 2,
      datasetsSynced: 1,
      triggeredBy: "Manual",
      message: "CSV Upload: Customers metadata refresh completed.",
    },
  ],
};

function selectTab(label: string) {
  const tab = screen.getByRole("tab", { name: label });
  fireEvent.pointerDown(tab, { button: 0, ctrlKey: false, pointerType: "mouse" });
  fireEvent.pointerUp(tab, { button: 0, ctrlKey: false, pointerType: "mouse" });
  fireEvent.click(tab);
  return screen.getByRole("tab", { name: label });
}

describe("DataSourcesPage", () => {
  beforeEach(() => {
    mockToast.mockClear();
    mockPush.mockClear();
    mockRefresh.mockClear();
  });

  it("renders the overview with summary cards, source cards, recent datasets, and guide panel", () => {
    render(<DataSourcesPage initialData={pageData} />);

    expect(screen.getByRole("heading", { name: "Data Sources" })).toBeInTheDocument();
    expect(screen.getByText("Connected Sources")).toBeInTheDocument();
    expect(screen.getAllByText("Datasets").length).toBeGreaterThan(0);
    expect(screen.getByText("Rows Synced")).toBeInTheDocument();
    expect(screen.getByText("Issues")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect source/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^upload csv$/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Connected data sources")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recent Datasets" })).toBeInTheDocument();
    expect(screen.getByText("Explore your data in depth")).toBeInTheDocument();
    expect(screen.getAllByText("CSV Upload: Customers").length).toBeGreaterThan(0);
  });

  it("links source cards and recent datasets to their progressive detail routes", () => {
    render(<DataSourcesPage initialData={pageData} />);

    const sourceLinks = screen.getAllByRole("link", { name: /view details/i });
    expect(sourceLinks[0]).toHaveAttribute(
      "href",
      "/app/data-sources/source-csv-customers"
    );

    expect(
      screen.getByRole("link", { name: "Open Customers dataset" })
    ).toHaveAttribute(
      "href",
      "/app/data-sources/source-csv-customers/datasets/dataset-customers"
    );
  });

  it("filters source cards by search query and status", () => {
    render(<DataSourcesPage initialData={pageData} />);

    const sourceSection = screen.getByLabelText("Connected data sources");
    fireEvent.change(screen.getByLabelText("Search data sources"), {
      target: { value: "demo" },
    });

    expect(within(sourceSection).getByText("Demo SaaS Dataset")).toBeInTheDocument();
    expect(within(sourceSection).queryByText("CSV Upload: Customers")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search data sources"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Issue" }));

    expect(within(sourceSection).getByText("Demo SaaS Dataset")).toBeInTheDocument();
    expect(within(sourceSection).queryByText("CSV Upload: Customers")).not.toBeInTheDocument();
  });

  it("opens the connector gallery with live metadata source actions", () => {
    render(<DataSourcesPage initialData={pageData} />);

    fireEvent.click(screen.getByRole("button", { name: /connect source/i }));
    expect(screen.getByRole("dialog", { name: "Connector gallery" })).toBeInTheDocument();
    expect(screen.getByText("CSV Upload")).toBeInTheDocument();
    expect(screen.getAllByText("Demo SaaS Dataset").length).toBeGreaterThan(0);
    expect(screen.getByText("Snowflake")).toBeInTheDocument();
    expect(screen.getByText("BigQuery")).toBeInTheDocument();
    expect(screen.getByText("Postgres")).toBeInTheDocument();
    expect(screen.getByText("MotherDuck")).toBeInTheDocument();
  });

  it("opens CSV upload through the connector gallery", () => {
    render(<DataSourcesPage initialData={pageData} />);

    fireEvent.click(screen.getByRole("button", { name: /connect source/i }));
    const csvConnector = screen.getByText("CSV Upload").closest("article");
    expect(csvConnector).not.toBeNull();

    fireEvent.click(within(csvConnector as HTMLElement).getByRole("button", { name: "Connect" }));
    expect(screen.getByRole("dialog", { name: "Upload CSV" })).toBeInTheDocument();
    expect(screen.getByText("No file selected")).toBeInTheDocument();
  });

  it("opens provider-specific setup without creating fake source cards", () => {
    render(<DataSourcesPage initialData={pageData} />);

    fireEvent.click(screen.getByRole("button", { name: /connect source/i }));
    const sourceSection = screen.getByLabelText("Connected data sources");
    expect(within(sourceSection).queryByText("Snowflake")).not.toBeInTheDocument();

    const postgresConnector = screen.getByText("Postgres").closest("article");
    expect(postgresConnector).not.toBeNull();
    fireEvent.click(within(postgresConnector as HTMLElement).getByRole("button", { name: "Connect" }));

    expect(screen.getByRole("heading", { name: "Connect Postgres" })).toBeInTheDocument();
    expect(screen.getByLabelText("Host")).toBeInTheDocument();
    expect(screen.getByLabelText("SSL mode")).toBeInTheDocument();
  });

  it("renders friendly external connector validation errors", async () => {
    render(
      <DataSourcesPage
        initialData={pageData}
        testExternalDataSourceAction={vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          error:
            "Host is required. Database is required. Username is required. Password is required.",
        })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /connect source/i }));
    const postgresConnector = screen.getByText("Postgres").closest("article");
    expect(postgresConnector).not.toBeNull();
    fireEvent.click(within(postgresConnector as HTMLElement).getByRole("button", { name: "Connect" }));
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));

    await waitFor(() => {
      expect(screen.getByText(/Host is required/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/too_small/)).not.toBeInTheDocument();
    expect(screen.queryByText(/minimum/)).not.toBeInTheDocument();
  });
});

describe("DataSourceDetailPage", () => {
  beforeEach(() => {
    mockToast.mockClear();
    mockPush.mockClear();
    mockRefresh.mockClear();
  });

  it("loads a selected source and switches between detail tabs", () => {
    render(
      <DataSourceDetailPage
        initialData={pageData}
        sourceId="source-csv-customers"
        syncDataSourceAction={vi.fn()}
        createSemanticModelFromDatasetAction={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "CSV Upload: Customers" })).toBeInTheDocument();
    expect(screen.getByText("Source health")).toBeInTheDocument();

    selectTab("Datasets");
    expect(screen.getByRole("link", { name: /inspect/i })).toHaveAttribute(
      "href",
      "/app/data-sources/source-csv-customers/datasets/dataset-customers"
    );

    selectTab("Schema");
    expect(screen.getByText("customer_id")).toBeInTheDocument();
    expect(screen.getByText("email")).toBeInTheDocument();

    const syncHistoryTab = selectTab("Sync history");
    expect(syncHistoryTab).toHaveAttribute("data-state", "active");

    const settingsTab = selectTab("Settings");
    expect(settingsTab).toHaveAttribute("data-state", "active");
  });

  it("calls the existing sync and semantic model actions", async () => {
    const syncAction = vi.fn().mockResolvedValue({ ok: true, data: { pageData } });
    const semanticModelAction = vi.fn().mockResolvedValue({
      ok: true,
      data: { modelId: "model-1", entityId: "entity-1", metricIds: ["metric-1"] },
    });

    render(
      <DataSourceDetailPage
        initialData={pageData}
        sourceId="source-csv-customers"
        syncDataSourceAction={syncAction}
        createSemanticModelFromDatasetAction={semanticModelAction}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /sync now/i }));
    await waitFor(() => {
      expect(syncAction).toHaveBeenCalledWith({
        workspaceId: pageData.workspaceId,
        dataSourceId: "source-csv-customers",
      });
    });

    fireEvent.click(screen.getAllByRole("button", { name: /create semantic model/i })[0]);
    await waitFor(() => {
      expect(semanticModelAction).toHaveBeenCalledWith({
        workspaceId: pageData.workspaceId,
        datasetId: "dataset-customers",
      });
    });
    expect(mockPush).toHaveBeenCalledWith("/app/semantic-layer");
  });
});

describe("DatasetDetailPage", () => {
  beforeEach(() => {
    mockToast.mockClear();
    mockPush.mockClear();
    mockRefresh.mockClear();
  });

  it("renders focused schema metadata, sample values, suggestions, and back navigation", async () => {
    const semanticModelAction = vi.fn().mockResolvedValue({
      ok: true,
      data: { modelId: "model-1", entityId: "entity-1", metricIds: ["metric-1"] },
    });

    render(
      <DatasetDetailPage
        initialData={pageData}
        sourceId="source-csv-customers"
        datasetId="dataset-customers"
        createSemanticModelFromDatasetAction={semanticModelAction}
      />
    );

    expect(screen.getByRole("heading", { name: "Customers" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to source/i })).toHaveAttribute(
      "href",
      "/app/data-sources/source-csv-customers"
    );
    expect(screen.getByText("Schema and samples")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByText("Create Customer entity")).toBeInTheDocument();
    expect(screen.getByText("Which customer segments expanded fastest?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /add entity/i }));
    await waitFor(() => {
      expect(semanticModelAction).toHaveBeenCalledWith({
        workspaceId: pageData.workspaceId,
        datasetId: "dataset-customers",
      });
    });
    expect(mockPush).toHaveBeenCalledWith("/app/semantic-layer");
  });

  it("renders dataset empty states without fabricating preview data", () => {
    const sparsePageData: DataSourcesPageData = {
      ...pageData,
      datasets: [
        {
          ...pageData.datasets[0],
          semanticSuggestions: [],
        },
      ],
      columnsByDatasetId: {
        "dataset-customers": [],
      },
      issues: [],
      syncRuns: [],
    };

    render(
      <DatasetDetailPage
        initialData={sparsePageData}
        sourceId="source-csv-customers"
        datasetId="dataset-customers"
        createSemanticModelFromDatasetAction={vi.fn()}
      />
    );

    expect(screen.getByText("No schema columns are available for this dataset yet.")).toBeInTheDocument();
    expect(screen.getByText("Select a profiled dataset to see AI suggestions.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /preview data/i })).not.toBeInTheDocument();
  });
});
