'use client';

import { useCallback, useState } from 'react';
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

import { entities, relationships, certifiedMetrics } from '@/lib/mock-data/semantic';
import { DataTable } from '@/components/data-table/data-table';
import { Badge } from '@/components/ui/badge';

import type { Node, NodeProps, Edge } from 'reactflow';
import type { SemanticEntity, CertifiedMetric } from '@/lib/mock-data/types';

// ─── Custom Node Component ──────────────────────────────────────────────────

function EntityNode({ data }: NodeProps<{ entity: SemanticEntity }>) {
  const { entity } = data;
  return (
    <div
      className="bg-white rounded-lg shadow-md border-l-4 px-4 py-3 min-w-[160px]"
      style={{ borderLeftColor: entity.color }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: entity.color }}
        />
        <span className="font-semibold text-sm text-[#111827]">
          {entity.name}
        </span>
      </div>
      <p className="text-xs text-[#4B5563] mt-1">
        {entity.recordCount.toLocaleString()} records
      </p>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
    </div>
  );
}

const nodeTypes = { entityNode: EntityNode };

// ─── Node & Edge Definitions ────────────────────────────────────────────────

const nodePositions: Record<string, { x: number; y: number }> = {
  customer: { x: 300, y: 0 },
  subscription: { x: 100, y: 180 },
  invoice: { x: 100, y: 360 },
  support_ticket: { x: 500, y: 180 },
  product_event: { x: 500, y: 360 },
};

const initialNodes: Node[] = entities.map((entity) => ({
  id: entity.id,
  type: 'entityNode',
  position: nodePositions[entity.id] || { x: 0, y: 0 },
  data: { entity },
}));

const initialEdges: Edge[] = [
  {
    id: 'customer-subscription',
    source: 'customer',
    target: 'subscription',
    label: 'has_many',
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: '#94A3B8' },
    labelStyle: { fontSize: 11, fill: '#4B5563' },
  },
  {
    id: 'subscription-invoice',
    source: 'subscription',
    target: 'invoice',
    label: 'has_many',
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: '#94A3B8' },
    labelStyle: { fontSize: 11, fill: '#4B5563' },
  },
  {
    id: 'customer-support_ticket',
    source: 'customer',
    target: 'support_ticket',
    label: 'has_many',
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: '#94A3B8' },
    labelStyle: { fontSize: 11, fill: '#4B5563' },
  },
  {
    id: 'customer-product_event',
    source: 'customer',
    target: 'product_event',
    label: 'has_many',
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: '#94A3B8' },
    labelStyle: { fontSize: 11, fill: '#4B5563' },
  },
  {
    id: 'subscription-product_event',
    source: 'subscription',
    target: 'product_event',
    label: 'belongs_to',
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: '#94A3B8', strokeDasharray: '5 5' },
    labelStyle: { fontSize: 11, fill: '#4B5563' },
  },
];

// ─── Certified Metrics Table Columns ────────────────────────────────────────

const metricsColumns = [
  { key: 'name' as keyof CertifiedMetric, label: 'Name' },
  { key: 'formula' as keyof CertifiedMetric, label: 'Formula' },
  { key: 'owner' as keyof CertifiedMetric, label: 'Owner' },
  {
    key: 'certifiedDate' as keyof CertifiedMetric,
    label: 'Certified',
    render: (value: CertifiedMetric[keyof CertifiedMetric]) => (
      <span className="text-sm text-[#4B5563]">{String(value)}</span>
    ),
  },
  {
    key: 'aiUsageCount' as keyof CertifiedMetric,
    label: 'AI Usage Count',
    render: (value: CertifiedMetric[keyof CertifiedMetric]) => (
      <span className="font-medium">{Number(value).toLocaleString()}</span>
    ),
  },
];

// ─── Page Component ─────────────────────────────────────────────────────────

export default function SemanticLayerPage() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const [selectedEntity, setSelectedEntity] = useState<SemanticEntity | null>(null);
  const selectedMetric = certifiedMetrics[0]; // MRR by default

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const entity = entities.find((e) => e.id === node.id);
      if (entity) setSelectedEntity(entity);
    },
    []
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#111827]">Semantic Layer</h1>

      {/* Main area: entity graph + detail panel */}
      <div className="grid grid-cols-5 gap-6">
        {/* Entity Graph — 60% (3/5 columns) */}
        <div className="col-span-3 bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
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
        </div>

        {/* Detail Panel — 40% (2/5 columns) */}
        <div className="col-span-2 bg-white rounded-xl border border-[#E5E7EB] p-6 space-y-5">
          {selectedEntity ? (
            <>
              <div>
                <h2 className="text-lg font-semibold text-[#111827] flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full inline-block"
                    style={{ backgroundColor: selectedEntity.color }}
                  />
                  {selectedEntity.name}
                </h2>
                <p className="text-sm text-[#4B5563] mt-1">
                  {selectedEntity.recordCount.toLocaleString()} records
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-[#111827] mb-2">Dimensions</h3>
                <div className="flex flex-wrap gap-1.5">
                  {selectedEntity.dimensions.map((dim) => (
                    <Badge key={dim} variant="outline" className="text-xs">
                      {dim}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-[#111827] mb-2">Measures</h3>
                <div className="flex flex-wrap gap-1.5">
                  {selectedEntity.measures.map((measure) => (
                    <Badge key={measure} variant="secondary" className="text-xs">
                      {measure}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Default: show MRR metric detail */}
              <div>
                <h2 className="text-lg font-semibold text-[#111827]">
                  {selectedMetric.name}
                </h2>
                <Badge variant="success" className="mt-2">
                  Certified
                </Badge>
              </div>

              <div>
                <h3 className="text-sm font-medium text-[#111827] mb-2">SQL Expression</h3>
                <pre className="bg-[#F3F4F6] rounded-md p-3 text-xs font-mono text-[#111827] overflow-x-auto">
                  {`SUM(subscriptions.amount) WHERE status = 'active'`}
                </pre>
              </div>

              <div>
                <h3 className="text-sm font-medium text-[#111827] mb-1">Time Dimension</h3>
                <p className="text-sm text-[#4B5563]">{selectedMetric.timeDimension}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-[#111827] mb-2">Synonyms</h3>
                <div className="flex flex-wrap gap-1.5">
                  {selectedMetric.synonyms.map((syn) => (
                    <Badge key={syn} variant="outline" className="text-xs">
                      {syn}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-[#111827] mb-1">AI Usage Policy</h3>
                <p className="text-sm text-[#4B5563]">{selectedMetric.aiPolicy}</p>
              </div>

              <div className="pt-2 border-t border-[#E5E7EB]">
                <p className="text-xs text-[#4B5563]">
                  Certified by Admin on Jan 15, 2024
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Certified Metrics Table */}
      <section>
        <h2 className="text-lg font-semibold text-[#111827] mb-4">Certified Metrics</h2>
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <DataTable
            columns={metricsColumns}
            data={certifiedMetrics}
            caption="Certified metrics with formulas, owners, and AI usage counts"
          />
        </div>
      </section>
    </div>
  );
}
