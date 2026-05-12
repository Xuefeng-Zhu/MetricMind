'use client';

import { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeMouseHandler,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type {
  LineageGraph as LineageGraphType,
  LineageNode,
  LineageNodeType,
  LineageNodeDetails,
} from '@/lib/lineage/lineage-service';

// --- Node color and icon configuration ---

const NODE_STYLES: Record<LineageNodeType, { background: string; border: string; icon: string }> = {
  data_source: { background: '#dbeafe', border: '#3b82f6', icon: '🗄️' },
  dataset: { background: '#cffafe', border: '#06b6d4', icon: '📊' },
  entity: { background: '#ede9fe', border: '#8b5cf6', icon: '🧩' },
  metric: { background: '#dcfce7', border: '#22c55e', icon: '📐' },
  sql_query: { background: '#ffedd5', border: '#f97316', icon: '⚡' },
  result: { background: '#fee2e2', border: '#ef4444', icon: '🎯' },
};

// --- Layout constants ---

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;
const HORIZONTAL_SPACING = 250;
const VERTICAL_SPACING = 100;

/**
 * Assigns positions to nodes using a left-to-right layout based on node type order.
 * Nodes of the same type are stacked vertically.
 */
function getLayoutedElements(
  nodes: LineageNode[],
  edges: LineageGraphType['edges']
): { nodes: Node[]; edges: Edge[] } {
  // Define the column order for each node type (left to right)
  const typeOrder: LineageNodeType[] = [
    'data_source',
    'dataset',
    'entity',
    'metric',
    'sql_query',
    'result',
  ];

  // Group nodes by type
  const nodesByType = new Map<LineageNodeType, LineageNode[]>();
  for (const type of typeOrder) {
    nodesByType.set(type, []);
  }
  for (const node of nodes) {
    const group = nodesByType.get(node.type);
    if (group) {
      group.push(node);
    }
  }

  // Position nodes: x based on type column, y based on index within that column
  const layoutedNodes: Node[] = [];
  for (let typeIndex = 0; typeIndex < typeOrder.length; typeIndex++) {
    const type = typeOrder[typeIndex];
    const group = nodesByType.get(type) ?? [];
    for (let nodeIndex = 0; nodeIndex < group.length; nodeIndex++) {
      const node = group[nodeIndex];
      const style = NODE_STYLES[node.type];
      layoutedNodes.push({
        id: node.id,
        position: {
          x: typeIndex * HORIZONTAL_SPACING,
          y: nodeIndex * VERTICAL_SPACING,
        },
        data: {
          label: `${style.icon} ${node.label}`,
          nodeType: node.type,
          metadata: node.metadata,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: {
          background: style.background,
          border: `2px solid ${style.border}`,
          borderRadius: '8px',
          padding: '10px 14px',
          fontSize: '13px',
          fontWeight: 500,
          width: NODE_WIDTH,
          minHeight: NODE_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center' as const,
        },
      });
    }
  }

  // Convert edges
  const layoutedEdges: Edge[] = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    animated: true,
    style: { stroke: '#94a3b8', strokeWidth: 2 },
    labelStyle: { fontSize: 11, fill: '#64748b' },
  }));

  return { nodes: layoutedNodes, edges: layoutedEdges };
}

// --- Detail Panel ---

interface DetailPanelProps {
  node: Node | null;
  details: LineageNodeDetails | null;
  loading: boolean;
  onClose: () => void;
}

function DetailPanel({ node, details, loading, onClose }: DetailPanelProps) {
  if (!node) return null;

  const nodeType = node.data.nodeType as LineageNodeType;
  const style = NODE_STYLES[nodeType];

  return (
    <div
      className="absolute top-4 right-4 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden"
      role="complementary"
      aria-label="Node details panel"
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ background: style.background, borderBottom: `2px solid ${style.border}` }}
      >
        <div className="flex items-center gap-2">
          <span>{style.icon}</span>
          <span className="font-semibold text-sm capitalize">
            {nodeType.replace('_', ' ')}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 text-lg leading-none"
          aria-label="Close detail panel"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div className="px-4 py-3 text-sm space-y-2 max-h-80 overflow-y-auto">
        {loading && <p className="text-gray-500">Loading details...</p>}

        {!loading && !details && (
          <div className="space-y-1">
            <p className="font-medium">{String(node.data.label).replace(/^[^\s]+\s/, '')}</p>
            {node.data.metadata && (
              <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                {JSON.stringify(node.data.metadata, null, 2)}
              </pre>
            )}
          </div>
        )}

        {!loading && details && (
          <div className="space-y-2">
            <p className="font-medium">{details.label}</p>

            {details.dataSource && (
              <div className="space-y-1">
                <p><span className="text-gray-500">Type:</span> {details.dataSource.type}</p>
                <p><span className="text-gray-500">Rows:</span> {details.dataSource.rowCount.toLocaleString()}</p>
              </div>
            )}

            {details.entity && (
              <div className="space-y-1">
                <p><span className="text-gray-500">Description:</span> {details.entity.description || 'N/A'}</p>
                {details.entity.dimensions.length > 0 && (
                  <p><span className="text-gray-500">Dimensions:</span> {details.entity.dimensions.join(', ')}</p>
                )}
                {details.entity.measures.length > 0 && (
                  <p><span className="text-gray-500">Measures:</span> {details.entity.measures.join(', ')}</p>
                )}
              </div>
            )}

            {details.metric && (
              <div className="space-y-1">
                <p><span className="text-gray-500">Formula:</span></p>
                <code className="block text-xs bg-gray-50 p-2 rounded">{details.metric.formula}</code>
                <p>
                  <span className="text-gray-500">Certified:</span>{' '}
                  {details.metric.certified ? '✅ Yes' : '❌ No'}
                  {details.metric.certifiedBy && ` (by ${details.metric.certifiedBy})`}
                </p>
              </div>
            )}

            {details.sqlQuery && (
              <div className="space-y-1">
                <p><span className="text-gray-500">SQL:</span></p>
                <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                  {details.sqlQuery.sql}
                </pre>
                <p><span className="text-gray-500">Execution time:</span> {details.sqlQuery.executionTimeMs}ms</p>
              </div>
            )}

            {details.result && (
              <div className="space-y-1">
                <p><span className="text-gray-500">Row count:</span> {details.result.rowCount.toLocaleString()}</p>
                {details.result.columns.length > 0 && (
                  <p><span className="text-gray-500">Columns:</span> {details.result.columns.join(', ')}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main Component ---

export interface LineageGraphProps {
  /** The lineage graph data to render */
  graph: LineageGraphType;
  /** Optional callback to fetch node details on click */
  onNodeDetailsRequest?: (nodeId: string, nodeType: LineageNodeType) => Promise<LineageNodeDetails>;
  /** Optional CSS class name */
  className?: string;
}

/**
 * LineageGraph — Renders a directed graph visualization of data lineage
 * using React Flow. Shows the derivation chain from data source to result.
 *
 * Each node type has a distinct color and icon:
 * - data_source (blue): 🗄️
 * - dataset (cyan): 📊
 * - entity (purple): 🧩
 * - metric (green): 📐
 * - sql_query (orange): ⚡
 * - result (red): 🎯
 *
 * Layout is left-to-right following the data flow.
 * Clicking a node shows a detail panel with node-specific information.
 *
 * Requirements: 14.1, 14.2, 14.3
 */
export function LineageGraphComponent({ graph, onNodeDetailsRequest, className }: LineageGraphProps) {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [nodeDetails, setNodeDetails] = useState<LineageNodeDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const { nodes, edges } = useMemo(
    () => getLayoutedElements(graph.nodes, graph.edges),
    [graph.nodes, graph.edges]
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    async (_event, node) => {
      setSelectedNode(node);
      setNodeDetails(null);

      if (onNodeDetailsRequest) {
        setDetailsLoading(true);
        try {
          const details = await onNodeDetailsRequest(node.id, node.data.nodeType);
          setNodeDetails(details);
        } catch {
          // If details fetch fails, we still show the basic metadata from the node
          setNodeDetails(null);
        } finally {
          setDetailsLoading(false);
        }
      }
    },
    [onNodeDetailsRequest]
  );

  const handleClosePanel = useCallback(() => {
    setSelectedNode(null);
    setNodeDetails(null);
  }, []);

  if (graph.nodes.length === 0) {
    return (
      <div className={`flex items-center justify-center h-64 text-gray-500 ${className ?? ''}`}>
        <p>No lineage data available</p>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-[500px] border border-gray-200 rounded-lg ${className ?? ''}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        minZoom={0.3}
        maxZoom={2}
        attributionPosition="bottom-left"
      >
        <Background color="#f1f5f9" gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>

      <DetailPanel
        node={selectedNode}
        details={nodeDetails}
        loading={detailsLoading}
        onClose={handleClosePanel}
      />
    </div>
  );
}
