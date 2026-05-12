import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChartRenderer } from './ChartRenderer';
import type { ChartConfig } from '@/lib/visualization/visualization-service';

// Mock ResizeObserver for ResponsiveContainer
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserver;

function makeLineConfig(): ChartConfig {
  return {
    type: 'line',
    data: [
      { month: 'Jan', revenue: 1000 },
      { month: 'Feb', revenue: 1500 },
      { month: 'Mar', revenue: 1200 },
    ],
    xAxis: { dataKey: 'month', label: 'Month', type: 'category' },
    yAxis: { dataKey: 'revenue', label: 'Revenue', type: 'number' },
    series: [{ dataKey: 'revenue', name: 'Revenue', color: '#8884d8' }],
    legend: true,
    title: 'Monthly Revenue',
  };
}

function makeKPIConfig(): ChartConfig {
  return {
    type: 'kpi',
    data: [{ total_revenue: 42500 }],
    xAxis: { dataKey: '', label: '' },
    yAxis: { dataKey: 'total_revenue', label: 'Total Revenue', type: 'number' },
    series: [{ dataKey: 'total_revenue', name: 'Total Revenue', color: '#8884d8' }],
    legend: false,
  };
}

function makeTableConfig(): ChartConfig {
  return {
    type: 'table',
    data: [
      { name: 'Alice', score: 95 },
      { name: 'Bob', score: 87 },
    ],
    xAxis: { dataKey: '', label: '' },
    yAxis: { dataKey: '', label: '' },
    series: [
      { dataKey: 'name', name: 'Name', color: '#8884d8' },
      { dataKey: 'score', name: 'Score', color: '#82ca9d' },
    ],
    legend: false,
  };
}

describe('ChartRenderer', () => {
  it('renders a chart type selector dropdown', () => {
    render(<ChartRenderer config={makeLineConfig()} />);
    const selector = screen.getByLabelText('Select chart type');
    expect(selector).toBeInTheDocument();
  });

  it('defaults to the config type', () => {
    render(<ChartRenderer config={makeLineConfig()} />);
    const selector = screen.getByLabelText('Select chart type') as HTMLSelectElement;
    expect(selector.value).toBe('line');
  });

  it('uses overrideType when provided', () => {
    render(<ChartRenderer config={makeLineConfig()} overrideType="bar" />);
    const selector = screen.getByLabelText('Select chart type') as HTMLSelectElement;
    expect(selector.value).toBe('bar');
  });

  it('changes chart type when user selects a different option', () => {
    render(<ChartRenderer config={makeLineConfig()} />);
    const selector = screen.getByLabelText('Select chart type') as HTMLSelectElement;
    fireEvent.change(selector, { target: { value: 'table' } });
    expect(selector.value).toBe('table');
  });

  it('renders KPI card for kpi type', () => {
    render(<ChartRenderer config={makeKPIConfig()} />);
    expect(screen.getByText('42.5K')).toBeInTheDocument();
  });

  it('renders DataTable for table type', () => {
    render(<ChartRenderer config={makeTableConfig()} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('renders all chart type options in the selector', () => {
    render(<ChartRenderer config={makeLineConfig()} />);
    const selector = screen.getByLabelText('Select chart type') as HTMLSelectElement;
    const options = Array.from(selector.options).map((o) => o.value);
    expect(options).toEqual(['line', 'bar', 'pie', 'area', 'scatter', 'kpi', 'table']);
  });
});
