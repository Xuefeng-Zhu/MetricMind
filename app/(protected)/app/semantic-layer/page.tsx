'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useApiQuery } from '@/hooks/use-api-query';
import type { EntitiesResponse, MetricsResponse, JoinsResponse } from '@/types/api-responses';
import { LoadingSkeleton, ErrorState, EmptyState } from '@/components/ui/api-states';
import { DataTable } from '@/components/data-table/data-table';
import { Badge } from '@/components/ui/badge';

import type { Node, NodeProps, Edge } from 'reactflow';

// ─── Types for graph rendering ──────────────────────────────────────────────

interface EntityNodeData {
  id: string;
  name: string;
  description: string | null;
}

// ─── Color palette for entity nodes ─────────────────────────────────────────

const ENTITY_COLORS = [
  '#2563EB', '#16A34A', '#D97706', '#7C3AED', '#EC4899',
  '#0891B2', '#DC2626', '#4F46E5', '#059669', '#CA8A04',
];

function getEntityColor(index: number): string {
  return ENTITY_COLORS[index % ENTITY_COLORS.length];
}

// ─── Custom Node Component ──────────────────────────────────────────────────

function EntityNode({ data }: NodeProps<{ entity: EntityNodeData; color: string }>) {
  const { entity, color } = data;
  return (
    <div
      className="bg-white rounded-lg shadow-md border-l-4 px-4 py-3 min-w-[160px]"
      style={{ borderLeftColor: color }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="font-semibold text-sm text-[#111827]">
          {entity.name}
        </span>
      </div>
      {entity.description && (
        <p className="text-xs text-[#4B5563] mt-1">
          {entity.description}
        </p>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
    </div>
  );
}

const nodeTypes = { entityNode: EntityNode };

// ─── Layout helper for entity nodes ─────────────────────────────────────────

function computeNodePositions(count: number): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  const cols = Math.min(count, 3);
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.push({ x: col * 250 + 50, y: row * 180 });
  }
  return positions;
}

// ─── Certified Metrics Table Column Type ────────────────────────────────────

interface MetricRow {
  id: string;
  name: string;
  formula: string;
  owner: string;
  certified: boolean;
  certified_date: string | null;
}

const metricsColumns = [
  { key: 'name' as keyof MetricRow, label: 'Name' },
  { key: 'formula' as keyof MetricRow, label: 'Formula' },
  { key: 'owner' as keyof MetricRow, label: 'Owner' },
  {
    key: 'certified' as keyof MetricRow,
    label: 'Certified',
    render: (value: MetricRow[keyof MetricRow]) => (
      <Badge variant={value ? 'success' : 'outline'} className="text-xs">
        {value ? 'Yes' : 'No'}
      </Badge>
    ),
  },
  {
    key: 'certified_date' as keyof MetricRow,
    label: 'Certified Date',
    render: (value: MetricRow[keyof MetricRow]) => (
      <span className="text-sm text-[#4B5563]">{value ? String(value) : '—'}</span>
    ),
  },
];

// ─── Page Component ─────────────────────────────────────────────────────────

export default function SemanticLayerPage() {
  // Fetch entities, metrics, and joins independently
  const {
    data: entitiesData,
    isLoading: entitiesLoading,
    error: entitiesError,
    refetch: refetchEntities,
  } = useApiQuery<EntitiesResponse>('/api/semantic/entities');

  const {
    data: metricsData,
    isLoading: metricsLoading,
    error: metricsError,
    refetch: refetchMetrics,
  } = useApiQuery<MetricsResponse>('/api/semantic/metrics');

  const {
    data: joinsData,
    isLoading: joinsLoading,
    error: joinsError,
    refetch: refetchJoins,
  } = useApiQuery<JoinsResponse>('/api/semantic/joins');

  // Build graph nodes from entities
  const initialNodes: Node[] = useMemo(() => {
    if (!entitiesData?.entities) return [];
    const positions = computeNodePositions(entitiesData.entities.length);
    return entitiesData.entities.map((entity, index) => ({
      id: entity.id,
      type: 'entityNode',
      position: positions[index] || { x: 0, y: 0 },
      data: { entity, color: getEntityColor(index) },
    }));
  }, [entitiesData]);

  // Build graph edges from joins
  const initialEdges: Edge[] = useMemo(() => {
    if (!joinsData?.joins) return [];
    return joinsData.joins.map((join) => ({
      id: join.id,
      source: join.source_entity_id,
      target: join.target_entity_id,
      label: join.join_type,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: '#94A3B8' },
      labelStyle: { fontSize: 11, fill: '#4B5563' },
    }));
  }, [joinsData]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedEntity, setSelectedEntity] = useState<EntityNodeData | null>(null);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (entitiesData?.entities) {
        const entity = entitiesData.entities.find((e) => e.id === node.id);
        if (entity) {
          setSelectedEntity({
            id: entity.id,
            name: entity.name,
            description: entity.description,
          });
        }
      }
    },
    [entitiesData]
  );

  // Determine the selected entity's color
  const selectedEntityColor = useMemo(() => {
    if (!selectedEntity || !entitiesData?.entities) return '#2563EB';
    const index = entitiesData.entities.findIndex((e) => e.id === selectedEntity.id);
    return getEntityColor(index >= 0 ? index : 0);
  }, [selectedEntity, entitiesData]);

  // Primary empty state: no entities at all
  if (!entitiesLoading && !entitiesError && entitiesData && entitiesData.entities.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[#111827]">Semantic Layer</h1>
        <EmptyState
          title="No entities defined"
          description="Define entities to build your semantic model. Entities represent the core business objects in your data."
          action={{
            label: 'Define Entity',
            onClick: () => {
              window.location.href = '/app/semantic-layer/entities';
            },
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#111827]">Semantic Layer</h1>

      {/* Main area: entity graph + detail panel */}
      <div className="grid grid-cols-5 gap-6">
        {/* Entity Graph — 60% (3/5 columns) */}
        <div className="col-span-3 bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          {entitiesLoading || joinsLoading ? (
            <div className="h-[480px] flex items-center justify-center p-6">
              <LoadingSkeleton lines={6} className="w-full" />
            </div>
          ) : entitiesError ? (
            <div className="h-[480px] flex items-center justify-center">
              <ErrorState message={entitiesError} onRetry={refetchEntities} />
            </div>
          ) : joinsError ? (
            <div className="h-[480px] flex items-center justify-center">
              <ErrorState message={joinsError} onRetry={refetchJoins} />
            </div>
          ) : (
            <div className="h-[480px]" aria-label="Entity relationship graph">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                fitView
                proOptions={{ hideAttribution: true }}
              >
                <Background color="#E5E7EB" gap={20} />
                <Controls />
              </ReactFlow>
            </div>
          )}
        </div>

        {/* Detail Panel — 40% (2/5 columns) */}
        <div className="col-span-2 bg-white rounded-xl border border-[#E5E7EB] p-6 space-y-5">
          {entitiesLoading ? (
            <LoadingSkeleton lines={5} />
          ) : selectedEntity ? (
            <>
              <div>
                <h2 className="text-lg font-semibold text-[#111827] flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full inline-block"
                    style={{ backgroundColor: selectedEntityColor }}
                  />
                  {selectedEntity.name}
                </h2>
                {selectedEntity.description && (
                  <p className="text-sm text-[#4B5563] mt-1">
                    {selectedEntity.description}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-[#4B5563]">
                Click an entity node to view details
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Certified Metrics Table */}
      <section>
        <h2 className="text-lg font-semibold text-[#111827] mb-4">Certified Metrics</h2>
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          {metricsLoading ? (
            <div className="p-6">
              <LoadingSkeleton lines={5} />
            </div>
          ) : metricsError ? (
            <ErrorState message={metricsError} onRetry={refetchMetrics} />
          ) : metricsData && metricsData.metrics.length > 0 ? (
            <DataTable
              columns={metricsColumns}
              data={metricsData.metrics}
              caption="Certified metrics with formulas, owners, and certification status"
            />
          ) : (
            <div className="p-6">
              <EmptyState
                title="No metrics defined"
                description="Create certified metrics to ensure consistent definitions across your organization."
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
