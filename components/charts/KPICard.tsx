'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChartConfig } from '@/lib/visualization/visualization-service';

interface KPICardProps {
  config: ChartConfig;
}

/**
 * Formats a numeric value for display in a KPI card.
 * Applies locale formatting and abbreviation for large numbers.
 */
function formatKPIValue(value: unknown): string {
  if (value === null || value === undefined) return '—';

  const num = Number(value);
  if (isNaN(num)) return String(value);

  // Format large numbers with abbreviations
  if (Math.abs(num) >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (Math.abs(num) >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(num) >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }

  // Format decimals
  if (num % 1 !== 0) {
    return num.toFixed(2);
  }

  return num.toLocaleString();
}

export function KPICard({ config }: KPICardProps) {
  const { data, series, title } = config;

  const valueKey = series[0]?.dataKey || '';
  const label = series[0]?.name || title || 'Value';
  const row = (data as Record<string, unknown>[])[0];
  const value = row ? row[valueKey] : null;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold" aria-label={`${label}: ${value}`}>
          {formatKPIValue(value)}
        </div>
      </CardContent>
    </Card>
  );
}
