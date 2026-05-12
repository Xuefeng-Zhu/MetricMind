'use client';

import { useState } from 'react';
import type { ChartConfig, ChartType } from '@/lib/visualization/visualization-service';
import { LineChartComponent } from './LineChartComponent';
import { BarChartComponent } from './BarChartComponent';
import { PieChartComponent } from './PieChartComponent';
import { AreaChartComponent } from './AreaChartComponent';
import { ScatterChartComponent } from './ScatterChartComponent';
import { KPICard } from './KPICard';
import { DataTable } from './DataTable';

interface ChartRendererProps {
  config: ChartConfig;
  overrideType?: ChartType;
}

const CHART_TYPE_OPTIONS: { value: ChartType; label: string }[] = [
  { value: 'line', label: 'Line Chart' },
  { value: 'bar', label: 'Bar Chart' },
  { value: 'pie', label: 'Pie Chart' },
  { value: 'area', label: 'Area Chart' },
  { value: 'scatter', label: 'Scatter Chart' },
  { value: 'kpi', label: 'KPI Card' },
  { value: 'table', label: 'Data Table' },
];

/**
 * ChartRenderer — Main component that takes a ChartConfig and renders
 * the appropriate chart type. Supports user override via a chart type selector.
 *
 * Requirements: 12.2, 12.6
 */
export function ChartRenderer({ config, overrideType }: ChartRendererProps) {
  const [selectedType, setSelectedType] = useState<ChartType | undefined>(overrideType);

  const activeType = (selectedType || config.type) as ChartType;
  const activeConfig: ChartConfig = { ...config, type: activeType };

  return (
    <div className="w-full">
      <div className="flex items-center justify-end mb-3">
        <label htmlFor="chart-type-selector" className="sr-only">
          Chart type
        </label>
        <select
          id="chart-type-selector"
          value={activeType}
          onChange={(e) => setSelectedType(e.target.value as ChartType)}
          className="text-sm border rounded-md px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Select chart type"
        >
          {CHART_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="w-full">
        <ChartContent config={activeConfig} type={activeType} />
      </div>
    </div>
  );
}

interface ChartContentProps {
  config: ChartConfig;
  type: ChartType;
}

function ChartContent({ config, type }: ChartContentProps) {
  switch (type) {
    case 'line':
      return <LineChartComponent config={config} />;
    case 'bar':
      return <BarChartComponent config={config} />;
    case 'pie':
      return <PieChartComponent config={config} />;
    case 'area':
      return <AreaChartComponent config={config} />;
    case 'scatter':
      return <ScatterChartComponent config={config} />;
    case 'kpi':
      return <KPICard config={config} />;
    case 'table':
      return <DataTable config={config} />;
    default:
      return <DataTable config={config} />;
  }
}
