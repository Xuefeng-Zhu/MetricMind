import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LineageGraphComponent } from './LineageGraph';
import type { LineageGraph, LineageNodeDetails } from '@/lib/lineage/lineage-service';

// Mock ReactFlow since it requires browser APIs not available in jsdom
vi.mock('reactflow', () => {
  const MockReactFlow = ({ nodes, edges, onNodeClick, children }: any) => (
    <div data-testid="react-flow">
      {nodes.map((node: any) => (
        <div
          key={node.id}
          data-testid={`node-${node.id}`}
          data-node-type={node.data.nodeType}
          onClick={(e) => onNodeClick?.(e, node)}
          style={node.style}
        >
          {node.data.label}
        </div>
      ))}
      {edges.map((edge: any) => (
        <div key={edge.id} data-testid={`edge-${edge.id}`}>
          {edge.source} → {edge.target}
        </div>
      ))}
      {children}
    </div>
  );

  return {
    __esModule: true,
    default: MockReactFlow,
    Background: () => <div data-testid="background" />,
    Controls: () => <div data-testid="controls" />,
    Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
  };
});

const mockGraph: LineageGraph = {
  nodes: [
    { id: 'ds-1', type: 'data_source', label: 'Sales CSV', metadata: { type: 'csv', rowCount: 1000 } },
    { id: 'dataset-1', type: 'dataset', label: 'Sales (dataset)', metadata: {} },
    { id: 'entity-1', type: 'entity', label: 'Sales Entity', metadata: { description: 'Sales data' } },
    { id: 'metric-1', type: 'metric', label: 'MRR', metadata: { formula: 'SUM(amount)', certified: true } },
    { id: 'sql-1', type: 'sql_query', label: 'SQL Query', metadata: { sql: 'SELECT SUM(amount) FROM sales' } },
    { id: 'result-1', type: 'result', label: 'Query Result', metadata: { rowCount: 1 } },
  ],
  edges: [
    { id: 'edge-ds-1-dataset-1', source: 'ds-1', target: 'dataset-1', label: 'contains' },
    { id: 'edge-dataset-1-entity-1', source: 'dataset-1', target: 'entity-1', label: 'models' },
    { id: 'edge-entity-1-metric-1', source: 'entity-1', target: 'metric-1', label: 'defines' },
    { id: 'edge-metric-1-sql-1', source: 'metric-1', target: 'sql-1', label: 'generates' },
    { id: 'edge-sql-1-result-1', source: 'sql-1', target: 'result-1', label: 'produces' },
  ],
};

describe('LineageGraphComponent', () => {
  it('renders empty state when graph has no nodes', () => {
    render(<LineageGraphComponent graph={{ nodes: [], edges: [] }} />);
    expect(screen.getByText('No lineage data available')).toBeInTheDocument();
  });

  it('renders all nodes from the graph', () => {
    render(<LineageGraphComponent graph={mockGraph} />);
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    expect(screen.getByTestId('node-ds-1')).toBeInTheDocument();
    expect(screen.getByTestId('node-dataset-1')).toBeInTheDocument();
    expect(screen.getByTestId('node-entity-1')).toBeInTheDocument();
    expect(screen.getByTestId('node-metric-1')).toBeInTheDocument();
    expect(screen.getByTestId('node-sql-1')).toBeInTheDocument();
    expect(screen.getByTestId('node-result-1')).toBeInTheDocument();
  });

  it('renders all edges from the graph', () => {
    render(<LineageGraphComponent graph={mockGraph} />);
    expect(screen.getByTestId('edge-edge-ds-1-dataset-1')).toBeInTheDocument();
    expect(screen.getByTestId('edge-edge-dataset-1-entity-1')).toBeInTheDocument();
    expect(screen.getByTestId('edge-edge-entity-1-metric-1')).toBeInTheDocument();
    expect(screen.getByTestId('edge-edge-metric-1-sql-1')).toBeInTheDocument();
    expect(screen.getByTestId('edge-edge-sql-1-result-1')).toBeInTheDocument();
  });

  it('applies distinct styles for each node type', () => {
    render(<LineageGraphComponent graph={mockGraph} />);

    const dsNode = screen.getByTestId('node-ds-1');
    const entityNode = screen.getByTestId('node-entity-1');
    const metricNode = screen.getByTestId('node-metric-1');
    const sqlNode = screen.getByTestId('node-sql-1');
    const resultNode = screen.getByTestId('node-result-1');

    // Each node type should have its distinct background color (jsdom converts hex to rgb)
    expect(dsNode.style.background).toBe('rgb(219, 234, 254)'); // blue
    expect(entityNode.style.background).toBe('rgb(237, 233, 254)'); // purple
    expect(metricNode.style.background).toBe('rgb(220, 252, 231)'); // green
    expect(sqlNode.style.background).toBe('rgb(255, 237, 213)'); // orange
    expect(resultNode.style.background).toBe('rgb(254, 226, 226)'); // red
  });

  it('shows detail panel on node click', async () => {
    render(<LineageGraphComponent graph={mockGraph} />);

    const metricNode = screen.getByTestId('node-metric-1');
    fireEvent.click(metricNode);

    // Detail panel should appear with node info
    await waitFor(() => {
      expect(screen.getByRole('complementary', { name: 'Node details panel' })).toBeInTheDocument();
    });
  });

  it('calls onNodeDetailsRequest when a node is clicked', async () => {
    const mockDetails: LineageNodeDetails = {
      id: 'metric-1',
      type: 'metric',
      label: 'MRR',
      metric: {
        name: 'MRR',
        formula: 'SUM(amount)',
        certified: true,
        certifiedBy: 'Admin User',
      },
    };

    const onNodeDetailsRequest = vi.fn().mockResolvedValue(mockDetails);

    render(
      <LineageGraphComponent graph={mockGraph} onNodeDetailsRequest={onNodeDetailsRequest} />
    );

    const metricNode = screen.getByTestId('node-metric-1');
    fireEvent.click(metricNode);

    await waitFor(() => {
      expect(onNodeDetailsRequest).toHaveBeenCalledWith('metric-1', 'metric');
    });

    // Should display the metric details
    await waitFor(() => {
      expect(screen.getByText('MRR')).toBeInTheDocument();
      expect(screen.getByText('SUM(amount)')).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching details', async () => {
    // Create a promise that we can control
    let resolveDetails: (value: LineageNodeDetails) => void;
    const detailsPromise = new Promise<LineageNodeDetails>((resolve) => {
      resolveDetails = resolve;
    });

    const onNodeDetailsRequest = vi.fn().mockReturnValue(detailsPromise);

    render(
      <LineageGraphComponent graph={mockGraph} onNodeDetailsRequest={onNodeDetailsRequest} />
    );

    const metricNode = screen.getByTestId('node-metric-1');
    fireEvent.click(metricNode);

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText('Loading details...')).toBeInTheDocument();
    });

    // Resolve the promise
    resolveDetails!({
      id: 'metric-1',
      type: 'metric',
      label: 'MRR',
      metric: { name: 'MRR', formula: 'SUM(amount)', certified: true },
    });

    // Loading should disappear
    await waitFor(() => {
      expect(screen.queryByText('Loading details...')).not.toBeInTheDocument();
    });
  });

  it('closes detail panel when close button is clicked', async () => {
    render(<LineageGraphComponent graph={mockGraph} />);

    // Click a node to open the panel
    const metricNode = screen.getByTestId('node-metric-1');
    fireEvent.click(metricNode);

    await waitFor(() => {
      expect(screen.getByRole('complementary', { name: 'Node details panel' })).toBeInTheDocument();
    });

    // Click close button
    const closeButton = screen.getByLabelText('Close detail panel');
    fireEvent.click(closeButton);

    // Panel should be gone
    await waitFor(() => {
      expect(screen.queryByRole('complementary', { name: 'Node details panel' })).not.toBeInTheDocument();
    });
  });

  it('displays node labels with icons', () => {
    render(<LineageGraphComponent graph={mockGraph} />);

    // Check that nodes contain their type-specific icons
    expect(screen.getByTestId('node-ds-1')).toHaveTextContent('🗄️ Sales CSV');
    expect(screen.getByTestId('node-metric-1')).toHaveTextContent('📐 MRR');
    expect(screen.getByTestId('node-sql-1')).toHaveTextContent('⚡ SQL Query');
    expect(screen.getByTestId('node-result-1')).toHaveTextContent('🎯 Query Result');
  });

  it('handles onNodeDetailsRequest failure gracefully', async () => {
    const onNodeDetailsRequest = vi.fn().mockRejectedValue(new Error('Network error'));

    render(
      <LineageGraphComponent graph={mockGraph} onNodeDetailsRequest={onNodeDetailsRequest} />
    );

    const metricNode = screen.getByTestId('node-metric-1');
    fireEvent.click(metricNode);

    // Should still show the panel with basic metadata (not crash)
    await waitFor(() => {
      expect(screen.getByRole('complementary', { name: 'Node details panel' })).toBeInTheDocument();
    });

    // Should not show loading after error
    await waitFor(() => {
      expect(screen.queryByText('Loading details...')).not.toBeInTheDocument();
    });
  });

  it('applies custom className', () => {
    const { container } = render(
      <LineageGraphComponent graph={mockGraph} className="custom-class" />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('custom-class');
  });
});
