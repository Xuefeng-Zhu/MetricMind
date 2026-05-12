'use client';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ChartConfig } from '@/lib/visualization/visualization-service';

interface PieChartComponentProps {
  config: ChartConfig;
}

const DEFAULT_COLORS = [
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7300',
  '#0088fe',
  '#00c49f',
  '#ff6b6b',
  '#4ecdc4',
];

export function PieChartComponent({ config }: PieChartComponentProps) {
  const { data, xAxis, series, legend, title } = config;

  const nameKey = xAxis.dataKey;
  const valueKey = series[0]?.dataKey || '';

  return (
    <div className="w-full h-full min-h-[300px]">
      {title && (
        <h3 className="text-sm font-medium text-muted-foreground mb-2">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data as Record<string, unknown>[]}
            dataKey={valueKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            outerRadius="70%"
            label={({ name, percent }) =>
              `${name}: ${(percent * 100).toFixed(0)}%`
            }
          >
            {(data as Record<string, unknown>[]).map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip />
          {legend && <Legend />}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
