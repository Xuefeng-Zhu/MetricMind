'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ChartConfig } from '@/lib/visualization/visualization-service';

interface AreaChartComponentProps {
  config: ChartConfig;
}

export function AreaChartComponent({ config }: AreaChartComponentProps) {
  const { data, xAxis, yAxis, series, legend, title } = config;

  return (
    <div className="w-full h-full min-h-[300px]">
      {title && (
        <h3 className="text-sm font-medium text-muted-foreground mb-2">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data as Record<string, unknown>[]} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey={xAxis.dataKey}
            label={xAxis.label ? { value: xAxis.label, position: 'insideBottom', offset: -5 } : undefined}
          />
          <YAxis
            label={yAxis.label ? { value: yAxis.label, angle: -90, position: 'insideLeft' } : undefined}
          />
          <Tooltip />
          {legend && <Legend />}
          {series.map((s) => (
            <Area
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name}
              stroke={s.color || '#8884d8'}
              fill={s.color || '#8884d8'}
              fillOpacity={0.3}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
