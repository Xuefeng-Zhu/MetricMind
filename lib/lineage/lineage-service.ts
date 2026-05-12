/**
 * Lineage Service implementation.
 *
 * Provides data lineage tracking and visualization support:
 * - buildLineageGraph: Builds a directed graph from an AI trace showing the full derivation chain
 * - getLineageForInsight: Gets lineage for a specific message/insight
 * - getNodeDetails: Returns detailed information about a specific lineage node
 * - createLineageRecords: Creates lineage records when AI traces are generated
 *
 * The lineage graph shows: data_source → dataset → entity → metric → sql_query → result
 *
 * Requirements: 14.1, 14.2
 */

import { SupabaseClient } from '@supabase/supabase-js';

// --- Types ---

export type LineageNodeType = 'data_source' | 'dataset' | 'entity' | 'metric' | 'sql_query' | 'result';

export interface LineageNode {
  id: string;
  type: LineageNodeType;
  label: string;
  metadata: Record<string, unknown>;
}

export interface LineageEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface LineageGraph {
  nodes: LineageNode[];
  edges: LineageEdge[];
}

export interface LineageNodeDetails {
  id: string;
  type: LineageNodeType;
  label: string;
  dataSource?: { name: string; type: string; rowCount: number };
  entity?: { name: string; description: string; dimensions: string[]; measures: string[] };
  metric?: { name: string; formula: string; certified: boolean; certifiedBy?: string };
  sqlQuery?: { sql: string; executionTimeMs: number };
  result?: { rowCount: number; columns: string[] };
}

export interface CreateLineageInput {
  workspaceId: string;
  aiTraceId: string;
  dataSourceId: string;
  datasetColumnId?: string | null;
  entityId: string;
  metricId?: string | null;
  queryRunId: string;
  sqlFragment: string;
  resultSummary: Record<string, unknown>;
}

export interface LineageService {
  buildLineageGraph(traceId: string, workspaceId: string): Promise<LineageGraph>;
  getLineageForInsight(messageId: string): Promise<LineageGraph>;
  getNodeDetails(nodeId: string, nodeType: LineageNodeType): Promise<LineageNodeDetails>;
  createLineageRecords(input: CreateLineageInput): Promise<void>;
}

// --- Helper Functions ---

/**
 * Generates a deterministic edge ID from source and target node IDs.
 */
function edgeId(source: string, target: string): string {
  return `edge-${source}-${target}`;
}

/**
 * Builds lineage nodes and edges from lineage records and their related data.
 */
function buildGraphFromRecords(
  records: LineageRecord[],
  dataSources: Map<string, { name: string; type: string; row_count: number | null }>,
  entities: Map<string, { name: string; description: string | null }>,
  metrics: Map<string, { name: string; formula: string; certified: boolean }>,
  queryRuns: Map<string, { sql: string; execution_time_ms: number; row_count: number; result_sample: unknown }>
): LineageGraph {
  const nodes: LineageNode[] = [];
  const edges: LineageEdge[] = [];
  const addedNodeIds = new Set<string>();

  for (const record of records) {
    // 1. Data Source node
    const dsId = `ds-${record.data_source_id}`;
    if (!addedNodeIds.has(dsId)) {
      const ds = dataSources.get(record.data_source_id);
      nodes.push({
        id: dsId,
        type: 'data_source',
        label: ds?.name ?? 'Unknown Data Source',
        metadata: {
          dataSourceId: record.data_source_id,
          type: ds?.type ?? 'unknown',
          rowCount: ds?.row_count ?? 0,
        },
      });
      addedNodeIds.add(dsId);
    }

    // 2. Dataset node (represents the dataset/table from the data source)
    const datasetId = `dataset-${record.data_source_id}`;
    if (!addedNodeIds.has(datasetId)) {
      const ds = dataSources.get(record.data_source_id);
      nodes.push({
        id: datasetId,
        type: 'dataset',
        label: ds?.name ? `${ds.name} (dataset)` : 'Dataset',
        metadata: {
          dataSourceId: record.data_source_id,
          columnId: record.dataset_column_id,
        },
      });
      addedNodeIds.add(datasetId);

      // Edge: data_source → dataset
      edges.push({
        id: edgeId(dsId, datasetId),
        source: dsId,
        target: datasetId,
        label: 'contains',
      });
    }

    // 3. Entity node
    const entityNodeId = `entity-${record.entity_id}`;
    if (!addedNodeIds.has(entityNodeId)) {
      const entity = entities.get(record.entity_id);
      nodes.push({
        id: entityNodeId,
        type: 'entity',
        label: entity?.name ?? 'Unknown Entity',
        metadata: {
          entityId: record.entity_id,
          description: entity?.description ?? '',
        },
      });
      addedNodeIds.add(entityNodeId);

      // Edge: dataset → entity
      edges.push({
        id: edgeId(datasetId, entityNodeId),
        source: datasetId,
        target: entityNodeId,
        label: 'models',
      });
    }

    // 4. Metric node (optional - only if metric_id is present)
    let metricNodeId: string | null = null;
    if (record.metric_id) {
      metricNodeId = `metric-${record.metric_id}`;
      if (!addedNodeIds.has(metricNodeId)) {
        const metric = metrics.get(record.metric_id);
        nodes.push({
          id: metricNodeId,
          type: 'metric',
          label: metric?.name ?? 'Unknown Metric',
          metadata: {
            metricId: record.metric_id,
            formula: metric?.formula ?? '',
            certified: metric?.certified ?? false,
          },
        });
        addedNodeIds.add(metricNodeId);

        // Edge: entity → metric
        edges.push({
          id: edgeId(entityNodeId, metricNodeId),
          source: entityNodeId,
          target: metricNodeId,
          label: 'defines',
        });
      }
    }

    // 5. SQL Query node
    const sqlNodeId = `sql-${record.query_run_id}`;
    if (!addedNodeIds.has(sqlNodeId)) {
      const queryRun = queryRuns.get(record.query_run_id);
      nodes.push({
        id: sqlNodeId,
        type: 'sql_query',
        label: 'SQL Query',
        metadata: {
          queryRunId: record.query_run_id,
          sql: record.sql_fragment,
          executionTimeMs: queryRun?.execution_time_ms ?? 0,
        },
      });
      addedNodeIds.add(sqlNodeId);

      // Edge: metric/entity → sql_query
      const sourceForSql = metricNodeId ?? entityNodeId;
      edges.push({
        id: edgeId(sourceForSql, sqlNodeId),
        source: sourceForSql,
        target: sqlNodeId,
        label: 'generates',
      });
    }

    // 6. Result node
    const resultNodeId = `result-${record.query_run_id}`;
    if (!addedNodeIds.has(resultNodeId)) {
      const queryRun = queryRuns.get(record.query_run_id);
      nodes.push({
        id: resultNodeId,
        type: 'result',
        label: 'Query Result',
        metadata: {
          queryRunId: record.query_run_id,
          rowCount: queryRun?.row_count ?? 0,
          resultSummary: record.result_summary,
        },
      });
      addedNodeIds.add(resultNodeId);

      // Edge: sql_query → result
      edges.push({
        id: edgeId(sqlNodeId, resultNodeId),
        source: sqlNodeId,
        target: resultNodeId,
        label: 'produces',
      });
    }
  }

  return { nodes, edges };
}

// --- Internal Types ---

interface LineageRecord {
  id: string;
  workspace_id: string;
  ai_trace_id: string;
  data_source_id: string;
  dataset_column_id: string | null;
  entity_id: string;
  metric_id: string | null;
  query_run_id: string;
  sql_fragment: string;
  result_summary: Record<string, unknown>;
  created_at: string;
}

// --- Factory Function ---

/**
 * Creates a LineageService instance.
 *
 * @param supabase - Supabase client for database operations
 */
export function createLineageService(supabase: SupabaseClient): LineageService {
  /**
   * Fetches related data for lineage records to build the graph.
   */
  async function fetchRelatedData(records: LineageRecord[]) {
    const dataSourceIds = Array.from(new Set(records.map((r) => r.data_source_id)));
    const entityIds = Array.from(new Set(records.map((r) => r.entity_id)));
    const metricIds = Array.from(new Set(records.filter((r) => r.metric_id).map((r) => r.metric_id!)));
    const queryRunIds = Array.from(new Set(records.map((r) => r.query_run_id)));

    // Fetch all related data in parallel
    const [dsResult, entityResult, metricResult, queryRunResult] = await Promise.all([
      dataSourceIds.length > 0
        ? supabase
            .from('data_sources')
            .select('id, name, type, row_count')
            .in('id', dataSourceIds)
        : { data: [], error: null },
      entityIds.length > 0
        ? supabase
            .from('semantic_entities')
            .select('id, name, description')
            .in('id', entityIds)
        : { data: [], error: null },
      metricIds.length > 0
        ? supabase
            .from('metrics')
            .select('id, name, formula, certified')
            .in('id', metricIds)
        : { data: [], error: null },
      queryRunIds.length > 0
        ? supabase
            .from('query_runs')
            .select('id, sql, execution_time_ms, row_count, result_sample')
            .in('id', queryRunIds)
        : { data: [], error: null },
    ]);

    // Build lookup maps
    const dataSources = new Map<string, { name: string; type: string; row_count: number | null }>();
    for (const ds of (dsResult.data ?? []) as { id: string; name: string; type: string; row_count: number | null }[]) {
      dataSources.set(ds.id, { name: ds.name, type: ds.type, row_count: ds.row_count });
    }

    const entities = new Map<string, { name: string; description: string | null }>();
    for (const e of (entityResult.data ?? []) as { id: string; name: string; description: string | null }[]) {
      entities.set(e.id, { name: e.name, description: e.description });
    }

    const metrics = new Map<string, { name: string; formula: string; certified: boolean }>();
    for (const m of (metricResult.data ?? []) as { id: string; name: string; formula: string; certified: boolean }[]) {
      metrics.set(m.id, { name: m.name, formula: m.formula, certified: m.certified });
    }

    const queryRuns = new Map<string, { sql: string; execution_time_ms: number; row_count: number; result_sample: unknown }>();
    for (const qr of (queryRunResult.data ?? []) as { id: string; sql: string; execution_time_ms: number; row_count: number; result_sample: unknown }[]) {
      queryRuns.set(qr.id, { sql: qr.sql, execution_time_ms: qr.execution_time_ms, row_count: qr.row_count, result_sample: qr.result_sample });
    }

    return { dataSources, entities, metrics, queryRuns };
  }

  return {
    async buildLineageGraph(traceId: string, workspaceId: string): Promise<LineageGraph> {
      // Fetch lineage records for this AI trace
      const { data: records, error } = await supabase
        .from('lineage_records')
        .select('id, workspace_id, ai_trace_id, data_source_id, dataset_column_id, entity_id, metric_id, query_run_id, sql_fragment, result_summary, created_at')
        .eq('ai_trace_id', traceId)
        .eq('workspace_id', workspaceId);

      if (error) {
        throw new Error(`Failed to fetch lineage records: ${error.message}`);
      }

      if (!records || records.length === 0) {
        return { nodes: [], edges: [] };
      }

      const typedRecords = records as LineageRecord[];
      const { dataSources, entities, metrics, queryRuns } = await fetchRelatedData(typedRecords);

      return buildGraphFromRecords(typedRecords, dataSources, entities, metrics, queryRuns);
    },

    async getLineageForInsight(messageId: string): Promise<LineageGraph> {
      // Look up the AI trace associated with this message
      const { data: traces, error: traceError } = await supabase
        .from('ai_traces')
        .select('id, workspace_id')
        .eq('message_id', messageId);

      if (traceError) {
        throw new Error(`Failed to fetch AI trace for message: ${traceError.message}`);
      }

      if (!traces || traces.length === 0) {
        return { nodes: [], edges: [] };
      }

      const trace = traces[0] as { id: string; workspace_id: string };

      // Fetch lineage records for this trace
      const { data: records, error } = await supabase
        .from('lineage_records')
        .select('id, workspace_id, ai_trace_id, data_source_id, dataset_column_id, entity_id, metric_id, query_run_id, sql_fragment, result_summary, created_at')
        .eq('ai_trace_id', trace.id);

      if (error) {
        throw new Error(`Failed to fetch lineage records: ${error.message}`);
      }

      if (!records || records.length === 0) {
        return { nodes: [], edges: [] };
      }

      const typedRecords = records as LineageRecord[];
      const { dataSources, entities, metrics, queryRuns } = await fetchRelatedData(typedRecords);

      return buildGraphFromRecords(typedRecords, dataSources, entities, metrics, queryRuns);
    },

    async getNodeDetails(nodeId: string, nodeType: LineageNodeType): Promise<LineageNodeDetails> {
      // Extract the actual database ID from the prefixed node ID
      // Node IDs follow the pattern: type-{uuid} (e.g., "ds-abc123", "entity-def456")
      const actualId = nodeId.replace(/^(ds|dataset|entity|metric|sql|result)-/, '');

      switch (nodeType) {
        case 'data_source': {
          const { data, error } = await supabase
            .from('data_sources')
            .select('id, name, type, row_count')
            .eq('id', actualId)
            .single();

          if (error || !data) {
            throw new Error(error?.message ?? 'Data source not found');
          }

          return {
            id: nodeId,
            type: nodeType,
            label: data.name,
            dataSource: {
              name: data.name,
              type: data.type,
              rowCount: data.row_count ?? 0,
            },
          };
        }

        case 'dataset': {
          // Dataset uses the same data source ID
          const { data, error } = await supabase
            .from('data_sources')
            .select('id, name, type, row_count')
            .eq('id', actualId)
            .single();

          if (error || !data) {
            throw new Error(error?.message ?? 'Dataset not found');
          }

          return {
            id: nodeId,
            type: nodeType,
            label: `${data.name} (dataset)`,
            dataSource: {
              name: data.name,
              type: data.type,
              rowCount: data.row_count ?? 0,
            },
          };
        }

        case 'entity': {
          const { data: entity, error } = await supabase
            .from('semantic_entities')
            .select('id, name, description')
            .eq('id', actualId)
            .single();

          if (error || !entity) {
            throw new Error(error?.message ?? 'Entity not found');
          }

          // Fetch dimensions and measures for this entity
          const [dimResult, measureResult] = await Promise.all([
            supabase.from('dimensions').select('name').eq('entity_id', actualId),
            supabase.from('measures').select('name').eq('entity_id', actualId),
          ]);

          const dimensions = (dimResult.data ?? []).map((d: { name: string }) => d.name);
          const measures = (measureResult.data ?? []).map((m: { name: string }) => m.name);

          return {
            id: nodeId,
            type: nodeType,
            label: entity.name,
            entity: {
              name: entity.name,
              description: entity.description ?? '',
              dimensions,
              measures,
            },
          };
        }

        case 'metric': {
          const { data: metric, error } = await supabase
            .from('metrics')
            .select('id, name, formula, certified, certified_by')
            .eq('id', actualId)
            .single();

          if (error || !metric) {
            throw new Error(error?.message ?? 'Metric not found');
          }

          // If certified, fetch the certifier's display name
          let certifiedBy: string | undefined;
          if (metric.certified && metric.certified_by) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name')
              .eq('id', metric.certified_by)
              .single();
            certifiedBy = profile?.display_name ?? undefined;
          }

          return {
            id: nodeId,
            type: nodeType,
            label: metric.name,
            metric: {
              name: metric.name,
              formula: metric.formula,
              certified: metric.certified,
              certifiedBy,
            },
          };
        }

        case 'sql_query': {
          const { data: queryRun, error } = await supabase
            .from('query_runs')
            .select('id, sql, execution_time_ms')
            .eq('id', actualId)
            .single();

          if (error || !queryRun) {
            throw new Error(error?.message ?? 'Query run not found');
          }

          return {
            id: nodeId,
            type: nodeType,
            label: 'SQL Query',
            sqlQuery: {
              sql: queryRun.sql,
              executionTimeMs: queryRun.execution_time_ms,
            },
          };
        }

        case 'result': {
          const { data: queryRun, error } = await supabase
            .from('query_runs')
            .select('id, row_count, result_sample')
            .eq('id', actualId)
            .single();

          if (error || !queryRun) {
            throw new Error(error?.message ?? 'Query result not found');
          }

          // Extract column names from result_sample
          const resultSample = queryRun.result_sample as Record<string, unknown>[] | null;
          const columns = resultSample && resultSample.length > 0
            ? Object.keys(resultSample[0])
            : [];

          return {
            id: nodeId,
            type: nodeType,
            label: 'Query Result',
            result: {
              rowCount: queryRun.row_count ?? 0,
              columns,
            },
          };
        }

        default:
          throw new Error(`Unknown node type: ${nodeType}`);
      }
    },

    async createLineageRecords(input: CreateLineageInput): Promise<void> {
      const { data, error } = await supabase
        .from('lineage_records')
        .insert({
          workspace_id: input.workspaceId,
          ai_trace_id: input.aiTraceId,
          data_source_id: input.dataSourceId,
          dataset_column_id: input.datasetColumnId ?? null,
          entity_id: input.entityId,
          metric_id: input.metricId ?? null,
          query_run_id: input.queryRunId,
          sql_fragment: input.sqlFragment,
          result_summary: input.resultSummary,
        });

      if (error) {
        // Lineage record creation should not break the main flow
        console.error(`Failed to create lineage record: ${error.message}`);
      }
    },
  };
}
