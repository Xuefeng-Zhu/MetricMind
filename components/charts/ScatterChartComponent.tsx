'use client';

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ChartConfig } from '@/lib/visualization/visualization-service';

interface ScatterChartComponentProps {
  config: ChartConfig;
}

export function ScatterChartComponent({ config }: ScatterChartComponentProps) {
  const { data, xAxis, yAxis, series, legend, title } = config;

  return (
    <div className="w-full h-full min-h-[300px]">
      {title && (
        <h3 className="text-sm font-medium text-muted-foreground mb-2">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey={xAxis.dataKey}
            type="number"
            name={xAxis.label}
            label={xAxis.label ? { value: xAxis.label, position: 'insideBottom', offset: -5 } : undefined}
          />
          <YAxis
            dataKey={yAxis.dataKey}
            type="number"
            name={yAxis.label}
            label={yAxis.label ? { value: yAxis.label, angle: -90, position: 'insideLeft' } : undefined}
          />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          {legend && <Legend />}
          <Scatter
            name={series[0]?.name || 'Data'}
            data={data as Record<string, unknown>[]}
            fill={series[0]?.color || '#8884d8'}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
