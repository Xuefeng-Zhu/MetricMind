import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createSemanticLayerService,
  SemanticLayerService,
} from "./semantic-layer-service";

// Mock InsForge client
function createMockInsForge() {
  const mockChain = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  const insforge = {
    from: vi.fn().mockReturnValue(mockChain),
  };

  return { insforge, mockChain };
}

describe("SemanticLayerService", () => {
  let service: SemanticLayerService;
  let insforge: ReturnType<typeof createMockInsForge>["insforge"];
  let mockChain: ReturnType<typeof createMockInsForge>["mockChain"];

  beforeEach(() => {
    const mock = createMockInsForge();
    insforge = mock.insforge;
    mockChain = mock.mockChain;
    service = createSemanticLayerService(insforge as any);
  });

  // --- Entity CRUD ---

  describe("createEntity", () => {
    it("should create a semantic entity linked to a data source", async () => {
      const mockEntity = {
        id: "entity-1",
        workspace_id: "ws-1",
        data_source_id: "ds-1",
        name: "Customers",
        description: "Customer accounts",
        created_at: "2024-01-01T00:00:00Z",
      };

      mockChain.single.mockResolvedValueOnce({ data: mockEntity, error: null });

      const result = await service.createEntity("ws-1", {
        dataSourceId: "ds-1",
        name: "Customers",
        description: "Customer accounts",
      });

      expect(result).toEqual(mockEntity);
      expect(insforge.from).toHaveBeenCalledWith("semantic_entities");
    });

    it("should create entity with null description when not provided", async () => {
      const mockEntity = {
        id: "entity-2",
        workspace_id: "ws-1",
        data_source_id: "ds-1",
        name: "Orders",
        description: null,
        created_at: "2024-01-01T00:00:00Z",
      };

      mockChain.single.mockResolvedValueOnce({ data: mockEntity, error: null });

      const result = await service.createEntity("ws-1", {
        dataSourceId: "ds-1",
        name: "Orders",
      });

      expect(result.description).toBeNull();
    });

    it("should throw on database error", async () => {
      mockChain.single.mockResolvedValueOnce({
        data: null,
        error: { message: "Insert failed" },
      });

      await expect(
        service.createEntity("ws-1", { dataSourceId: "ds-1", name: "Test" })
      ).rejects.toThrow("Insert failed");
    });
  });

  describe("getEntities", () => {
    it("should return entities for a workspace", async () => {
      const mockEntities = [
        {
          id: "entity-1",
          workspace_id: "ws-1",
          data_source_id: "ds-1",
          name: "Customers",
          description: null,
          created_at: "2024-01-01T00:00:00Z",
        },
      ];

      mockChain.order.mockResolvedValueOnce({ data: mockEntities, error: null });

      const result = await service.getEntities("ws-1");
      expect(result).toEqual(mockEntities);
    });

    it("should return empty array when no entities exist", async () => {
      mockChain.order.mockResolvedValueOnce({ data: [], error: null });

      const result = await service.getEntities("ws-1");
      expect(result).toEqual([]);
    });

    it("should throw on database error", async () => {
      mockChain.order.mockResolvedValueOnce({
        data: null,
        error: { message: "DB error" },
      });

      await expect(service.getEntities("ws-1")).rejects.toThrow("DB error");
    });
  });

  describe("getEntity", () => {
    it("should return a single entity by id", async () => {
      const mockEntity = {
        id: "entity-1",
        workspace_id: "ws-1",
        data_source_id: "ds-1",
        name: "Customers",
        description: "Customer data",
        created_at: "2024-01-01T00:00:00Z",
      };

      mockChain.single.mockResolvedValueOnce({ data: mockEntity, error: null });

      const result = await service.getEntity("entity-1");
      expect(result).toEqual(mockEntity);
    });

    it("should throw when entity not found", async () => {
      mockChain.single.mockResolvedValueOnce({
        data: null,
        error: { message: "Not found" },
      });

      await expect(service.getEntity("nonexistent")).rejects.toThrow("Not found");
    });
  });

  // --- Dimensions & Measures ---

  describe("addDimension", () => {
    it("should add a dimension to an entity", async () => {
      const mockDimension = {
        id: "dim-1",
        entity_id: "entity-1",
        name: "customer_name",
        description: "Customer full name",
        data_type: "text",
        source_column: "name",
      };

      mockChain.single.mockResolvedValueOnce({ data: mockDimension, error: null });

      const result = await service.addDimension("entity-1", {
        name: "customer_name",
        description: "Customer full name",
        dataType: "text",
        sourceColumn: "name",
      });

      expect(result).toEqual(mockDimension);
      expect(insforge.from).toHaveBeenCalledWith("dimensions");
    });

    it("should throw on database error", async () => {
      mockChain.single.mockResolvedValueOnce({
        data: null,
        error: { message: "Insert failed" },
      });

      await expect(
        service.addDimension("entity-1", {
          name: "test",
          dataType: "text",
          sourceColumn: "col",
        })
      ).rejects.toThrow("Insert failed");
    });
  });

  describe("addMeasure", () => {
    it("should add a measure to an entity", async () => {
      const mockMeasure = {
        id: "meas-1",
        entity_id: "entity-1",
        name: "revenue",
        description: "Total revenue",
        data_type: "float",
        source_column: "revenue_amount",
        default_aggregation: "sum",
      };

      mockChain.single.mockResolvedValueOnce({ data: mockMeasure, error: null });

      const result = await service.addMeasure("entity-1", {
        name: "revenue",
        description: "Total revenue",
        dataType: "float",
        sourceColumn: "revenue_amount",
        defaultAggregation: "sum",
      });

      expect(result).toEqual(mockMeasure);
      expect(insforge.from).toHaveBeenCalledWith("measures");
    });

    it("should throw on database error", async () => {
      mockChain.single.mockResolvedValueOnce({
        data: null,
        error: { message: "Insert failed" },
      });

      await expect(
        service.addMeasure("entity-1", {
          name: "test",
          dataType: "integer",
          sourceColumn: "col",
          defaultAggregation: "count",
        })
      ).rejects.toThrow("Insert failed");
    });
  });

  // --- Joins ---

  describe("validateJoin", () => {
    it("should return valid when both columns exist on their entities", async () => {
      // First call: dimensions for source entity
      // Second call: measures for source entity
      // Third call: dimensions for target entity
      // Fourth call: measures for target entity
      let fromCallCount = 0;
      insforge.from.mockImplementation((table: string) => {
        fromCallCount++;
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation(() => {
            // Source entity dimensions (calls 1)
            if (fromCallCount === 1) {
              return Promise.resolve({
                data: [{ source_column: "customer_id" }, { source_column: "name" }],
                error: null,
              });
            }
            // Source entity measures (calls 2)
            if (fromCallCount === 2) {
              return Promise.resolve({
                data: [{ source_column: "revenue" }],
                error: null,
              });
            }
            // Target entity dimensions (calls 3)
            if (fromCallCount === 3) {
              return Promise.resolve({
                data: [{ source_column: "id" }, { source_column: "order_date" }],
                error: null,
              });
            }
            // Target entity measures (calls 4)
            if (fromCallCount === 4) {
              return Promise.resolve({
                data: [],
                error: null,
              });
            }
            return Promise.resolve({ data: [], error: null });
          }),
        };
        return chain;
      });

      const result = await service.validateJoin({
        sourceEntityId: "entity-1",
        targetEntityId: "entity-2",
        joinType: "inner",
        sourceColumn: "customer_id",
        targetColumn: "id",
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should return invalid when source column does not exist", async () => {
      let fromCallCount = 0;
      insforge.from.mockImplementation(() => {
        fromCallCount++;
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation(() => {
            if (fromCallCount === 1) {
              return Promise.resolve({
                data: [{ source_column: "name" }],
                error: null,
              });
            }
            if (fromCallCount === 2) {
              return Promise.resolve({ data: [], error: null });
            }
            if (fromCallCount === 3) {
              return Promise.resolve({
                data: [{ source_column: "id" }],
                error: null,
              });
            }
            if (fromCallCount === 4) {
              return Promise.resolve({ data: [], error: null });
            }
            return Promise.resolve({ data: [], error: null });
          }),
        };
        return chain;
      });

      const result = await service.validateJoin({
        sourceEntityId: "entity-1",
        targetEntityId: "entity-2",
        joinType: "left",
        sourceColumn: "nonexistent_col",
        targetColumn: "id",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Source column 'nonexistent_col' does not exist on source entity"
      );
    });

    it("should return invalid when target column does not exist", async () => {
      let fromCallCount = 0;
      insforge.from.mockImplementation(() => {
        fromCallCount++;
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation(() => {
            if (fromCallCount === 1) {
              return Promise.resolve({
                data: [{ source_column: "customer_id" }],
                error: null,
              });
            }
            if (fromCallCount === 2) {
              return Promise.resolve({ data: [], error: null });
            }
            if (fromCallCount === 3) {
              return Promise.resolve({
                data: [{ source_column: "id" }],
                error: null,
              });
            }
            if (fromCallCount === 4) {
              return Promise.resolve({ data: [], error: null });
            }
            return Promise.resolve({ data: [], error: null });
          }),
        };
        return chain;
      });

      const result = await service.validateJoin({
        sourceEntityId: "entity-1",
        targetEntityId: "entity-2",
        joinType: "inner",
        sourceColumn: "customer_id",
        targetColumn: "missing_col",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Target column 'missing_col' does not exist on target entity"
      );
    });

    it("should return multiple errors when both columns are invalid", async () => {
      let fromCallCount = 0;
      insforge.from.mockImplementation(() => {
        fromCallCount++;
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation(() => {
            return Promise.resolve({ data: [], error: null });
          }),
        };
        return chain;
      });

      const result = await service.validateJoin({
        sourceEntityId: "entity-1",
        targetEntityId: "entity-2",
        joinType: "full",
        sourceColumn: "bad_source",
        targetColumn: "bad_target",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe("createJoin", () => {
    it("should throw when join validation fails", async () => {
      // Mock validateJoin to return invalid (no columns on entities)
      let fromCallCount = 0;
      insforge.from.mockImplementation(() => {
        fromCallCount++;
        const chain = {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation(() => {
            return Promise.resolve({ data: [], error: null });
          }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
        return chain;
      });

      await expect(
        service.createJoin("ws-1", {
          sourceEntityId: "entity-1",
          targetEntityId: "entity-2",
          joinType: "inner",
          sourceColumn: "bad_col",
          targetColumn: "bad_col",
        })
      ).rejects.toThrow("Join validation failed");
    });
  });

  // --- Metrics ---

  describe("createMetric", () => {
    it("should create a metric with certified=false initially", async () => {
      const mockMetric = {
        id: "metric-1",
        workspace_id: "ws-1",
        name: "MRR",
        description: "Monthly Recurring Revenue",
        formula: "SUM(subscriptions.mrr_cents) / 100",
        certified: false,
        certified_by: null,
        certified_at: null,
        created_at: "2024-01-01T00:00:00Z",
        created_by: "user-1",
      };

      mockChain.single.mockResolvedValueOnce({ data: mockMetric, error: null });

      const result = await service.createMetric("ws-1", {
        name: "MRR",
        description: "Monthly Recurring Revenue",
        formula: "SUM(subscriptions.mrr_cents) / 100",
        createdBy: "user-1",
      });

      expect(result).toEqual(mockMetric);
      expect(result.certified).toBe(false);
      expect(result.certified_by).toBeNull();
      expect(result.certified_at).toBeNull();
      expect(insforge.from).toHaveBeenCalledWith("metrics");
    });

    it("should throw on database error", async () => {
      mockChain.single.mockResolvedValueOnce({
        data: null,
        error: { message: "Insert failed" },
      });

      await expect(
        service.createMetric("ws-1", {
          name: "Test",
          formula: "COUNT(*)",
          createdBy: "user-1",
        })
      ).rejects.toThrow("Insert failed");
    });
  });

  describe("certifyMetric", () => {
    it("should mark a metric as certified with user and timestamp", async () => {
      const mockCertified = {
        id: "metric-1",
        workspace_id: "ws-1",
        name: "MRR",
        description: "Monthly Recurring Revenue",
        formula: "SUM(subscriptions.mrr_cents) / 100",
        certified: true,
        certified_by: "admin-1",
        certified_at: "2024-06-15T10:00:00.000Z",
        created_at: "2024-01-01T00:00:00Z",
        created_by: "user-1",
      };

      mockChain.single.mockResolvedValueOnce({ data: mockCertified, error: null });

      const result = await service.certifyMetric("metric-1", "admin-1");

      expect(result.certified).toBe(true);
      expect(result.certified_by).toBe("admin-1");
      expect(result.certified_at).not.toBeNull();
      expect(insforge.from).toHaveBeenCalledWith("metrics");
    });

    it("should throw when metric not found", async () => {
      mockChain.single.mockResolvedValueOnce({
        data: null,
        error: { message: "Not found" },
      });

      await expect(
        service.certifyMetric("nonexistent", "admin-1")
      ).rejects.toThrow("Not found");
    });
  });

  describe("getMetrics", () => {
    it("should return metrics for a workspace", async () => {
      const mockMetrics = [
        {
          id: "metric-1",
          workspace_id: "ws-1",
          name: "MRR",
          description: null,
          formula: "SUM(mrr)",
          certified: true,
          certified_by: "admin-1",
          certified_at: "2024-01-01T00:00:00Z",
          created_at: "2024-01-01T00:00:00Z",
          created_by: "user-1",
        },
      ];

      mockChain.order.mockResolvedValueOnce({ data: mockMetrics, error: null });

      const result = await service.getMetrics("ws-1");
      expect(result).toEqual(mockMetrics);
    });

    it("should return empty array when no metrics exist", async () => {
      mockChain.order.mockResolvedValueOnce({ data: [], error: null });

      const result = await service.getMetrics("ws-1");
      expect(result).toEqual([]);
    });
  });

  // --- Glossary ---

  describe("createGlossaryTerm", () => {
    it("should create a glossary term with related resources", async () => {
      const mockTerm = {
        id: "term-1",
        workspace_id: "ws-1",
        name: "MRR",
        definition: "Monthly Recurring Revenue",
        related_metric_ids: ["metric-1"],
        related_entity_ids: ["entity-1"],
        created_at: "2024-01-01T00:00:00Z",
      };

      mockChain.single.mockResolvedValueOnce({ data: mockTerm, error: null });

      const result = await service.createGlossaryTerm("ws-1", {
        name: "MRR",
        definition: "Monthly Recurring Revenue",
        relatedMetricIds: ["metric-1"],
        relatedEntityIds: ["entity-1"],
      });

      expect(result).toEqual(mockTerm);
      expect(insforge.from).toHaveBeenCalledWith("glossary_terms");
    });

    it("should handle duplicate name error gracefully", async () => {
      mockChain.single.mockResolvedValueOnce({
        data: null,
        error: { code: "23505", message: "duplicate key value violates unique constraint" },
      });

      await expect(
        service.createGlossaryTerm("ws-1", {
          name: "MRR",
          definition: "Some definition",
        })
      ).rejects.toThrow("A glossary term with the name 'MRR' already exists in this workspace");
    });

    it("should default related IDs to empty arrays", async () => {
      const mockTerm = {
        id: "term-2",
        workspace_id: "ws-1",
        name: "Churn",
        definition: "Customer churn rate",
        related_metric_ids: [],
        related_entity_ids: [],
        created_at: "2024-01-01T00:00:00Z",
      };

      mockChain.single.mockResolvedValueOnce({ data: mockTerm, error: null });

      const result = await service.createGlossaryTerm("ws-1", {
        name: "Churn",
        definition: "Customer churn rate",
      });

      expect(result.related_metric_ids).toEqual([]);
      expect(result.related_entity_ids).toEqual([]);
    });
  });

  describe("getGlossaryTerms", () => {
    it("should return glossary terms sorted by name", async () => {
      const mockTerms = [
        {
          id: "term-1",
          workspace_id: "ws-1",
          name: "ARR",
          definition: "Annual Recurring Revenue",
          related_metric_ids: [],
          related_entity_ids: [],
          created_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "term-2",
          workspace_id: "ws-1",
          name: "MRR",
          definition: "Monthly Recurring Revenue",
          related_metric_ids: [],
          related_entity_ids: [],
          created_at: "2024-01-01T00:00:00Z",
        },
      ];

      mockChain.order.mockResolvedValueOnce({ data: mockTerms, error: null });

      const result = await service.getGlossaryTerms("ws-1");
      expect(result).toEqual(mockTerms);
      expect(result[0].name).toBe("ARR");
    });
  });

  describe("resolveTerms", () => {
    it("should resolve terms case-insensitively", async () => {
      const mockTerms = [
        {
          name: "MRR",
          definition: "Monthly Recurring Revenue",
          related_metric_ids: ["metric-1"],
          related_entity_ids: ["entity-1"],
        },
        {
          name: "Churn",
          definition: "Customer churn rate",
          related_metric_ids: [],
          related_entity_ids: [],
        },
      ];

      // resolveTerms calls insforge.from("glossary_terms").select(...).eq(...)
      insforge.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockTerms, error: null }),
      }));

      const result = await service.resolveTerms("ws-1", ["mrr", "CHURN"]);

      expect(result).toHaveLength(2);
      expect(result[0].term).toBe("MRR");
      expect(result[0].definition).toBe("Monthly Recurring Revenue");
      expect(result[0].relatedMetrics).toEqual(["metric-1"]);
      expect(result[0].relatedEntities).toEqual(["entity-1"]);
      expect(result[1].term).toBe("Churn");
    });

    it("should return empty array when no terms match", async () => {
      insforge.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }));

      const result = await service.resolveTerms("ws-1", ["unknown"]);
      expect(result).toEqual([]);
    });

    it("should only return resolved terms that match input", async () => {
      const mockTerms = [
        {
          name: "MRR",
          definition: "Monthly Recurring Revenue",
          related_metric_ids: [],
          related_entity_ids: [],
        },
        {
          name: "ARR",
          definition: "Annual Recurring Revenue",
          related_metric_ids: [],
          related_entity_ids: [],
        },
      ];

      insforge.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockTerms, error: null }),
      }));

      const result = await service.resolveTerms("ws-1", ["mrr"]);
      expect(result).toHaveLength(1);
      expect(result[0].term).toBe("MRR");
    });
  });

  // --- Suggestions ---

  describe("suggestSemanticTypes", () => {
    it("should suggest dimension for text columns", () => {
      const result = service.suggestSemanticTypes([
        { name: "customer_name", data_type: "text", nullable: true, suggested_semantic_type: null },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].suggestedType).toBe("dimension");
      expect(result[0].columnName).toBe("customer_name");
      expect(result[0].reason).toBeTruthy();
    });

    it("should suggest measure for numeric columns", () => {
      const result = service.suggestSemanticTypes([
        { name: "quantity", data_type: "integer", nullable: false, suggested_semantic_type: null },
        { name: "price_total", data_type: "float", nullable: false, suggested_semantic_type: null },
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].suggestedType).toBe("measure");
      expect(result[1].suggestedType).toBe("measure");
    });

    it("should suggest dimension for id columns even if numeric", () => {
      const result = service.suggestSemanticTypes([
        { name: "customer_id", data_type: "integer", nullable: false, suggested_semantic_type: null },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].suggestedType).toBe("dimension");
      expect(result[0].reason).toContain("id");
    });

    it("should suggest dimension for date/timestamp columns", () => {
      const result = service.suggestSemanticTypes([
        { name: "created_at", data_type: "timestamp", nullable: false, suggested_semantic_type: null },
        { name: "order_date", data_type: "date", nullable: false, suggested_semantic_type: null },
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].suggestedType).toBe("dimension");
      expect(result[1].suggestedType).toBe("dimension");
    });

    it("should suggest measure for columns with measure-related names", () => {
      const result = service.suggestSemanticTypes([
        { name: "total_revenue", data_type: "float", nullable: false, suggested_semantic_type: null },
        { name: "order_count", data_type: "integer", nullable: false, suggested_semantic_type: null },
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].suggestedType).toBe("measure");
      expect(result[1].suggestedType).toBe("measure");
    });

    it("should return suggestions for all columns with determinable types", () => {
      const result = service.suggestSemanticTypes([
        { name: "id", data_type: "integer", nullable: false, suggested_semantic_type: null },
        { name: "name", data_type: "text", nullable: true, suggested_semantic_type: null },
        { name: "amount", data_type: "float", nullable: false, suggested_semantic_type: null },
        { name: "is_active", data_type: "boolean", nullable: false, suggested_semantic_type: null },
      ]);

      expect(result).toHaveLength(4);
      expect(result[0].suggestedType).toBe("dimension"); // id
      expect(result[1].suggestedType).toBe("dimension"); // name (text)
      expect(result[2].suggestedType).toBe("measure"); // amount
      expect(result[3].suggestedType).toBe("dimension"); // is_active (boolean)
    });
  });
});
