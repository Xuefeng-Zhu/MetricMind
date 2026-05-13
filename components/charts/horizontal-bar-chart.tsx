'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface HorizontalBarChartProps {
  data: Record<string, unknown>[];
  nameKey: string;
  valueKey: string;
  color?: string;
  height?: number;
  'aria-label'?: string;
}

export function HorizontalBarChart({
  data,
  nameKey,
  valueKey,
  color = '#2563EB',
  height = 300,
  'aria-label': ariaLabel = 'Horizontal bar chart',
}: HorizontalBarChartProps) {
  return (
    <div role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: '#4B5563', fontSize: 12 }}
            axisLine={{ stroke: '#E5E7EB' }}
          />
          <YAxis
            type="category"
            dataKey={nameKey}
            tick={{ fill: '#4B5563', fontSize: 12 }}
            axisLine={{ stroke: '#E5E7EB' }}
            width={70}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            }}
          />
          <Bar
            dataKey={valueKey}
            fill={color}
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
