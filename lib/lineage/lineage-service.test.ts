import { describe, it, expect, vi } from 'vitest';
import { createLineageService, LineageNodeType } from './lineage-service';
import { InsForgeDatabaseClient } from '@/lib/insforge/types';

// Helper to create a chainable mock query builder
function createQueryBuilder(result: { data: any; error: any }) {
  const builder: any = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    then: (resolve: any) => resolve(result),
  };
  return builder;
}

function createMockInsForge(overrides: { from?: Record<string, any> } = {}) {
  const fromMocks = overrides.from ?? {};

  return {
    from: vi.fn((table: string) => {
      if (fromMocks[table]) {
        return fromMocks[table];
      }
      return createQueryBuilder({ data: null, error: null });
    }),
  } as unknown as InsForgeDatabaseClient;
}

describe('LineageService', () => {
  describe('buildLineageGraph', () => {
    it('returns empty graph when no lineage records exist', async () => {
      const lineageBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({ data: [], error: null }),
      };

      const insforge = createMockInsForge({
        from: { lineage_records: lineageBuilder },
      });

      const service = createLineageService(insforge);
      const result = await service.buildLineageGraph('trace-1', 'ws-1');

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });

    it('builds a complete lineage graph from records', async () => {
      const mockRecords = [
        {
          id: 'lr-1',
          workspace_id: 'ws-1',
          ai_trace_id: 'trace-1',
          data_source_id: 'ds-1',
          dataset_column_id: null,
          entity_id: 'entity-1',
          metric_id: 'metric-1',
          query_run_id: 'qr-1',
          sql_fragment: 'SELECT sum(amount) FROM invoices',
          result_summary: { rowCount: 1, total: 50000 },
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      const lineageBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({ data: mockRecords, error: null }),
      };

      const dataSourcesBuilder: any = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [{ id: 'ds-1', name: 'Invoices CSV', type: 'csv', row_count: 1000 }],
          error: null,
        }),
      };

      const entitiesBuilder: any = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [{ id: 'entity-1', name: 'Invoices', description: 'Invoice records' }],
          error: null,
        }),
      };

      const metricsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [{ id: 'metric-1', name: 'MRR', formula: 'sum(amount)', certified: true }],
          error: null,
        }),
      };

      const queryRunsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [{ id: 'qr-1', sql: 'SELECT sum(amount) FROM invoices', execution_time_ms: 120, row_count: 1, result_sample: [{ mrr: 50000 }] }],
          error: null,
        }),
      };

      const insforge = createMockInsForge({
        from: {
          lineage_records: lineageBuilder,
          data_sources: dataSourcesBuilder,
          semantic_entities: entitiesBuilder,
          metrics: metricsBuilder,
          query_runs: queryRunsBuilder,
        },
      });

      const service = createLineageService(insforge);
      const result = await service.buildLineageGraph('trace-1', 'ws-1');

      // Should have 6 nodes: data_source, dataset, entity, metric, sql_query, result
      expect(result.nodes).toHaveLength(6);
      expect(result.nodes.map((n) => n.type)).toEqual([
        'data_source',
        'dataset',
        'entity',
        'metric',
        'sql_query',
        'result',
      ]);

      // Should have 5 edges connecting them in order
      expect(result.edges).toHaveLength(5);

      // Verify node labels
      expect(result.nodes[0].label).toBe('Invoices CSV');
      expect(result.nodes[2].label).toBe('Invoices');
      expect(result.nodes[3].label).toBe('MRR');
      expect(result.nodes[4].label).toBe('SQL Query');
      expect(result.nodes[5].label).toBe('Query Result');
    });

    it('builds graph without metric node when metric_id is null', async () => {
      const mockRecords = [
        {
          id: 'lr-2',
          workspace_id: 'ws-1',
          ai_trace_id: 'trace-2',
          data_source_id: 'ds-1',
          dataset_column_id: null,
          entity_id: 'entity-1',
          metric_id: null,
          query_run_id: 'qr-2',
          sql_fragment: 'SELECT * FROM customers LIMIT 10',
          result_summary: { rowCount: 10 },
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      const lineageBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({ data: mockRecords, error: null }),
      };

      const dataSourcesBuilder: any = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [{ id: 'ds-1', name: 'Customers', type: 'csv', row_count: 500 }],
          error: null,
        }),
      };

      const entitiesBuilder: any = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [{ id: 'entity-1', name: 'Customers', description: 'Customer records' }],
          error: null,
        }),
      };

      const queryRunsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [{ id: 'qr-2', sql: 'SELECT * FROM customers LIMIT 10', execution_time_ms: 50, row_count: 10, result_sample: [] }],
          error: null,
        }),
      };

      const insforge = createMockInsForge({
        from: {
          lineage_records: lineageBuilder,
          data_sources: dataSourcesBuilder,
          semantic_entities: entitiesBuilder,
          metrics: { select: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: [], error: null }) },
          query_runs: queryRunsBuilder,
        },
      });

      const service = createLineageService(insforge);
      const result = await service.buildLineageGraph('trace-2', 'ws-1');

      // Should have 5 nodes (no metric): data_source, dataset, entity, sql_query, result
      expect(result.nodes).toHaveLength(5);
      expect(result.nodes.map((n) => n.type)).toEqual([
        'data_source',
        'dataset',
        'entity',
        'sql_query',
        'result',
      ]);

      // Should have 4 edges (entity → sql_query directly)
      expect(result.edges).toHaveLength(4);
    });

    it('throws error when database query fails', async () => {
      const lineageBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({ data: null, error: { message: 'Connection error' } }),
      };

      const insforge = createMockInsForge({
        from: { lineage_records: lineageBuilder },
      });

      const service = createLineageService(insforge);
      await expect(service.buildLineageGraph('trace-1', 'ws-1')).rejects.toThrow(
        'Failed to fetch lineage records: Connection error'
      );
    });
  });

  describe('getLineageForInsight', () => {
    it('returns empty graph when no AI trace exists for message', async () => {
      const aiTracesBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      const insforge = createMockInsForge({
        from: { ai_traces: aiTracesBuilder },
      });

      const service = createLineageService(insforge);
      const result = await service.getLineageForInsight('msg-1');

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });

    it('fetches lineage via message_id → ai_trace → lineage_records', async () => {
      const aiTracesBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ id: 'trace-1', workspace_id: 'ws-1' }],
          error: null,
        }),
      };

      const lineageBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({ data: [], error: null }),
      };

      const insforge = createMockInsForge({
        from: {
          ai_traces: aiTracesBuilder,
          lineage_records: lineageBuilder,
        },
      });

      const service = createLineageService(insforge);
      const result = await service.getLineageForInsight('msg-1');

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
      // Verify ai_traces was queried with message_id
      expect(aiTracesBuilder.eq).toHaveBeenCalledWith('message_id', 'msg-1');
    });
  });

  describe('getNodeDetails', () => {
    it('returns data source details', async () => {
      const dataSourcesBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'abc123', name: 'Sales Data', type: 'csv', row_count: 5000 },
          error: null,
        }),
      };

      const insforge = createMockInsForge({
        from: { data_sources: dataSourcesBuilder },
      });

      const service = createLineageService(insforge);
      const result = await service.getNodeDetails('ds-abc123', 'data_source');

      expect(result.type).toBe('data_source');
      expect(result.label).toBe('Sales Data');
      expect(result.dataSource).toEqual({
        name: 'Sales Data',
        type: 'csv',
        rowCount: 5000,
      });
    });

    it('returns entity details with dimensions and measures', async () => {
      const entitiesBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'ent-1', name: 'Orders', description: 'Order records' },
          error: null,
        }),
      };

      const dimensionsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ name: 'order_date' }, { name: 'region' }],
          error: null,
        }),
      };

      const measuresBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ name: 'total_amount' }, { name: 'quantity' }],
          error: null,
        }),
      };

      const insforge = createMockInsForge({
        from: {
          semantic_entities: entitiesBuilder,
          dimensions: dimensionsBuilder,
          measures: measuresBuilder,
        },
      });

      const service = createLineageService(insforge);
      const result = await service.getNodeDetails('entity-ent-1', 'entity');

      expect(result.type).toBe('entity');
      expect(result.label).toBe('Orders');
      expect(result.entity).toEqual({
        name: 'Orders',
        description: 'Order records',
        dimensions: ['order_date', 'region'],
        measures: ['total_amount', 'quantity'],
      });
    });

    it('returns metric details with certification info', async () => {
      const metricsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'm-1', name: 'MRR', formula: 'sum(amount)', certified: true, certified_by: 'user-1' },
          error: null,
        }),
      };

      const profilesBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { display_name: 'John Doe' },
          error: null,
        }),
      };

      const insforge = createMockInsForge({
        from: {
          metrics: metricsBuilder,
          profiles: profilesBuilder,
        },
      });

      const service = createLineageService(insforge);
      const result = await service.getNodeDetails('metric-m-1', 'metric');

      expect(result.type).toBe('metric');
      expect(result.label).toBe('MRR');
      expect(result.metric).toEqual({
        name: 'MRR',
        formula: 'sum(amount)',
        certified: true,
        certifiedBy: 'John Doe',
      });
    });

    it('returns sql_query details', async () => {
      const queryRunsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'qr-1', sql: 'SELECT sum(amount) FROM invoices', execution_time_ms: 150 },
          error: null,
        }),
      };

      const insforge = createMockInsForge({
        from: { query_runs: queryRunsBuilder },
      });

      const service = createLineageService(insforge);
      const result = await service.getNodeDetails('sql-qr-1', 'sql_query');

      expect(result.type).toBe('sql_query');
      expect(result.sqlQuery).toEqual({
        sql: 'SELECT sum(amount) FROM invoices',
        executionTimeMs: 150,
      });
    });

    it('returns result details with columns', async () => {
      const queryRunsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'qr-1', row_count: 5, result_sample: [{ month: '2024-01', revenue: 50000, customers: 120 }] },
          error: null,
        }),
      };

      const insforge = createMockInsForge({
        from: { query_runs: queryRunsBuilder },
      });

      const service = createLineageService(insforge);
      const result = await service.getNodeDetails('result-qr-1', 'result');

      expect(result.type).toBe('result');
      expect(result.result).toEqual({
        rowCount: 5,
        columns: ['month', 'revenue', 'customers'],
      });
    });

    it('throws error for unknown node type', async () => {
      const insforge = createMockInsForge();
      const service = createLineageService(insforge);

      await expect(
        service.getNodeDetails('unknown-1', 'invalid_type' as LineageNodeType)
      ).rejects.toThrow('Unknown node type: invalid_type');
    });
  });

  describe('createLineageRecords', () => {
    it('inserts a lineage record with all fields', async () => {
      const lineageBuilder: any = {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const insforge = createMockInsForge({
        from: { lineage_records: lineageBuilder },
      });

      const service = createLineageService(insforge);
      await service.createLineageRecords({
        workspaceId: 'ws-1',
        aiTraceId: 'trace-1',
        dataSourceId: 'ds-1',
        datasetColumnId: 'col-1',
        entityId: 'entity-1',
        metricId: 'metric-1',
        queryRunId: 'qr-1',
        sqlFragment: 'SELECT sum(amount) FROM invoices',
        resultSummary: { rowCount: 1, total: 50000 },
      });

      expect(lineageBuilder.insert).toHaveBeenCalledWith({
        workspace_id: 'ws-1',
        ai_trace_id: 'trace-1',
        data_source_id: 'ds-1',
        dataset_column_id: 'col-1',
        entity_id: 'entity-1',
        metric_id: 'metric-1',
        query_run_id: 'qr-1',
        sql_fragment: 'SELECT sum(amount) FROM invoices',
        result_summary: { rowCount: 1, total: 50000 },
      });
    });

    it('inserts a lineage record with nullable fields as null', async () => {
      const lineageBuilder: any = {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const insforge = createMockInsForge({
        from: { lineage_records: lineageBuilder },
      });

      const service = createLineageService(insforge);
      await service.createLineageRecords({
        workspaceId: 'ws-1',
        aiTraceId: 'trace-1',
        dataSourceId: 'ds-1',
        entityId: 'entity-1',
        queryRunId: 'qr-1',
        sqlFragment: 'SELECT * FROM customers',
        resultSummary: { rowCount: 10 },
      });

      expect(lineageBuilder.insert).toHaveBeenCalledWith({
        workspace_id: 'ws-1',
        ai_trace_id: 'trace-1',
        data_source_id: 'ds-1',
        dataset_column_id: null,
        entity_id: 'entity-1',
        metric_id: null,
        query_run_id: 'qr-1',
        sql_fragment: 'SELECT * FROM customers',
        result_summary: { rowCount: 10 },
      });
    });

    it('does not throw when insert fails (logs error instead)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const lineageBuilder: any = {
        insert: vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } }),
      };

      const insforge = createMockInsForge({
        from: { lineage_records: lineageBuilder },
      });

      const service = createLineageService(insforge);

      // Should not throw
      await service.createLineageRecords({
        workspaceId: 'ws-1',
        aiTraceId: 'trace-1',
        dataSourceId: 'ds-1',
        entityId: 'entity-1',
        queryRunId: 'qr-1',
        sqlFragment: 'SELECT 1',
        resultSummary: {},
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to create lineage record: Insert failed'
      );

      consoleSpy.mockRestore();
    });
  });
});
