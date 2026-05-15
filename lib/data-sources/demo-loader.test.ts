import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadFullDemoDataset } from "./demo-loader";

// Mock InsForge client
function createMockInsForge() {
  let insertCallCount = 0;

  const mockSingle = vi.fn();
  const mockSelect = vi.fn(() => ({ single: mockSingle }));
  const mockEq = vi.fn(() => ({ select: mockSelect }));
  const mockInsert = vi.fn(() => ({ select: mockSelect }));
  const mockFrom = vi.fn(() => ({ insert: mockInsert, eq: mockEq }));

  // Track which table is being inserted into
  const insertedData: Record<string, unknown[]> = {};

  mockFrom.mockImplementation(((table: string) => {
    return {
      insert: (data: unknown) => {
        if (!insertedData[table]) {
          insertedData[table] = [];
        }
        const items = Array.isArray(data) ? data : [data];
        insertedData[table].push(...items);
        insertCallCount++;

        return {
          select: (_cols?: string) => ({
            data: items.map((item, index) => ({
              id: `mock-${table}-${insertCallCount}-${index}`,
              ...(item as Record<string, unknown>),
            })),
            error: null,
            single: () => {
              const id = `mock-${table}-${insertCallCount}`;
              // Return appropriate mock data based on table
              if (table === "data_sources") {
                const item = items[0] as Record<string, unknown>;
                return {
                  data: {
                    id,
                    workspace_id: item.workspace_id,
                    name: item.name,
                    type: item.type,
                    status: item.status,
                    row_count: item.row_count,
                    file_size_bytes: item.file_size_bytes ?? null,
                    created_at: new Date().toISOString(),
                  },
                  error: null,
                };
              }
              return { data: { id }, error: null };
            },
          }),
        };
      },
    };
  }) as any);

  return {
    client: { from: mockFrom } as unknown as Parameters<typeof loadFullDemoDataset>[0],
    mockFrom,
    insertedData,
  };
}

describe("loadFullDemoDataset", () => {
  let mockInsForge: ReturnType<typeof createMockInsForge>;

  beforeEach(() => {
    mockInsForge = createMockInsForge();
  });

  it("should create data source records for all 6 demo tables", async () => {
    const result = await loadFullDemoDataset(
      mockInsForge.client,
      "workspace-123",
      "user-456"
    );

    expect(result.dataSources).toHaveLength(6);
    expect(result.dataSources.map((ds) => ds.name)).toEqual([
      "customers",
      "subscriptions",
      "invoices",
      "payments",
      "product_events",
      "support_tickets",
    ]);
  });

  it("should create semantic entities for each demo table", async () => {
    const result = await loadFullDemoDataset(
      mockInsForge.client,
      "workspace-123",
      "user-456"
    );

    expect(result.entityIds).toHaveLength(5);
    // Verify semantic_entities were inserted
    expect(mockInsForge.insertedData["semantic_entities"]).toHaveLength(5);
  });

  it("should create all 6 pre-configured metrics", async () => {
    const result = await loadFullDemoDataset(
      mockInsForge.client,
      "workspace-123",
      "user-456"
    );

    expect(result.metricIds).toHaveLength(6);
    // Verify metrics were inserted with correct names
    const metricNames = mockInsForge.insertedData["metrics"].map(
      (m: unknown) => (m as Record<string, unknown>).name
    );
    expect(metricNames).toContain("MRR");
    expect(metricNames).toContain("ARR");
    expect(metricNames).toContain("Churn Rate");
    expect(metricNames).toContain("Active Users");
    expect(metricNames).toContain("Expansion Revenue");
    expect(metricNames).toContain("Support Ticket Volume");
  });

  it("should create glossary terms for key business concepts", async () => {
    const result = await loadFullDemoDataset(
      mockInsForge.client,
      "workspace-123",
      "user-456"
    );

    expect(result.glossaryTermIds).toHaveLength(8);
    const termNames = mockInsForge.insertedData["glossary_terms"].map(
      (t: unknown) => (t as Record<string, unknown>).name
    );
    expect(termNames).toContain("MRR");
    expect(termNames).toContain("ARR");
    expect(termNames).toContain("Churn");
    expect(termNames).toContain("NRR");
    expect(termNames).toContain("ARPA");
  });

  it("should create four demo dashboards", async () => {
    const result = await loadFullDemoDataset(
      mockInsForge.client,
      "workspace-123",
      "user-456"
    );

    expect(result.dashboardIds).toHaveLength(4);
    const dashNames = mockInsForge.insertedData["dashboards"].map(
      (d: unknown) => (d as Record<string, unknown>).name
    );
    expect(dashNames).toContain("Executive Overview");
    expect(dashNames).toContain("Revenue");
    expect(dashNames).toContain("Product Usage");
    expect(dashNames).toContain("Customer Health");
  });

  it("should create KPI widgets on the Executive Overview dashboard", async () => {
    await loadFullDemoDataset(mockInsForge.client, "workspace-123", "user-456");

    const widgets = mockInsForge.insertedData["widgets"];
    expect(widgets).toBeDefined();
    expect(widgets.length).toBeGreaterThanOrEqual(4);

    const kpiWidgets = widgets.filter(
      (w: unknown) => (w as Record<string, unknown>).type === "kpi"
    );
    expect(kpiWidgets).toHaveLength(4);
  });

  it("should create dimensions and measures for entities", async () => {
    await loadFullDemoDataset(mockInsForge.client, "workspace-123", "user-456");

    // Dimensions should be created for all entities
    const dimensions = mockInsForge.insertedData["semantic_dimensions"];
    expect(dimensions).toBeDefined();
    expect(dimensions.length).toBeGreaterThan(0);

    // Measures should be created for subscriptions and invoices
    const measures = mockInsForge.insertedData["semantic_measures"];
    expect(measures).toBeDefined();
    expect(measures.length).toBe(2);
  });

  it("should create semantic relationships for customer joins", async () => {
    await loadFullDemoDataset(mockInsForge.client, "workspace-123", "user-456");

    const relationships = mockInsForge.insertedData["semantic_relationships"];
    expect(relationships).toBeDefined();
    expect(relationships).toHaveLength(4);
  });

  it("should mark all metrics as certified", async () => {
    await loadFullDemoDataset(mockInsForge.client, "workspace-123", "user-456");

    const metrics = mockInsForge.insertedData["metrics"];
    for (const metric of metrics) {
      const m = metric as Record<string, unknown>;
      expect(m.certified).toBe(true);
      expect(m.certified_by).toBe("user-456");
      expect(m.certified_at).toBeDefined();
    }
  });

  it("should set workspace_id on all created resources", async () => {
    await loadFullDemoDataset(mockInsForge.client, "workspace-123", "user-456");

    // Check data sources
    for (const ds of mockInsForge.insertedData["data_sources"]) {
      expect((ds as Record<string, unknown>).workspace_id).toBe("workspace-123");
    }

    // Check entities
    for (const entity of mockInsForge.insertedData["semantic_entities"]) {
      expect((entity as Record<string, unknown>).workspace_id).toBe("workspace-123");
    }

    // Check metrics
    for (const metric of mockInsForge.insertedData["metrics"]) {
      expect((metric as Record<string, unknown>).workspace_id).toBe("workspace-123");
    }

    // Check glossary terms
    for (const term of mockInsForge.insertedData["glossary_terms"]) {
      expect((term as Record<string, unknown>).workspace_id).toBe("workspace-123");
    }

    // Check dashboards
    for (const dash of mockInsForge.insertedData["dashboards"]) {
      expect((dash as Record<string, unknown>).workspace_id).toBe("workspace-123");
    }
  });
});
