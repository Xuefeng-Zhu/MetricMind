'use client';

import { useState } from 'react';
import {
  BarChart3,
  LineChart,
  TrendingUp,
  Table,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { AskResponse } from '@/types/api-responses';
import { LoadingSkeleton, ErrorState } from '@/components/ui/api-states';
import { SimpleBarChart } from '@/components/charts/simple-bar-chart';
import { DataTable } from '@/components/data-table/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type VizType = 'line' | 'bar' | 'area' | 'table';

interface ExploreQuery {
  question: string;
  metric?: string;
  dimensions?: string[];
  filters?: Record<string, string>;
}

interface TableRow {
  [key: string]: string;
}

export default function ExplorePage() {
  const [vizType, setVizType] = useState<VizType>('bar');
  const [sqlExpanded, setSqlExpanded] = useState(false);
  const [selectedMetric] = useState('MRR');
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>(['Plan', 'Month']);
  const [filters] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AskResponse | null>(null);

  const { mutate, isLoading, error } = useApiMutation<ExploreQuery, AskResponse>('/api/ask', 'POST');

  const handleRunQuery = async () => {
    setResult(null);

    const query: ExploreQuery = {
      question: `Show ${selectedMetric} by ${selectedDimensions.join(', ')}`,
      metric: selectedMetric,
      dimensions: selectedDimensions,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    };

    const response = await mutate(query);
    if (response) {
      setResult(response);
    }
  };

  const handleDimensionToggle = (dimension: string, checked: boolean) => {
    setSelectedDimensions((prev) =>
      checked ? [...prev, dimension] : prev.filter((d) => d !== dimension)
    );
  };

  // Build table columns and data from API results
  const buildTableData = (): { columns: { key: string; label: string }[]; data: TableRow[] } => {
    if (!result?.data?.results || result.data.results.length === 0) {
      return { columns: [], data: [] };
    }

    const keys = Object.keys(result.data.results[0]);
    const columns = keys.map((key) => ({ key, label: key.charAt(0).toUpperCase() + key.slice(1) }));
    const data = result.data.results.map((row) => {
      const tableRow: TableRow = {};
      keys.forEach((key) => {
        tableRow[key] = String(row[key] ?? '');
      });
      return tableRow;
    });

    return { columns, data };
  };

  const vizOptions: { type: VizType; icon: React.ReactNode; label: string }[] = [
    { type: 'line', icon: <LineChart className="h-4 w-4" />, label: 'Line chart' },
    { type: 'bar', icon: <BarChart3 className="h-4 w-4" />, label: 'Bar chart' },
    { type: 'area', icon: <TrendingUp className="h-4 w-4" />, label: 'Area chart' },
    { type: 'table', icon: <Table className="h-4 w-4" />, label: 'Table view' },
  ];

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-6">
      <h1 className="sr-only">Explore</h1>
      {/* Left Query Builder Panel */}
      <aside className="w-80 bg-white border-r border-[#E5E7EB] p-6 flex flex-col gap-6 overflow-y-auto">
        {/* Metric Selector */}
        <div>
          <label className="block text-xs font-medium text-[#4B5563] uppercase tracking-wider mb-2">
            Metric
          </label>
          <div className="flex items-center justify-between border border-[#E5E7EB] rounded-lg px-3 py-2 bg-white cursor-pointer hover:border-[#2563EB] transition-colors">
            <span className="text-sm font-medium text-[#111827]">{selectedMetric}</span>
            <ChevronDown className="h-4 w-4 text-[#4B5563]" />
          </div>
        </div>

        {/* Dimensions */}
        <div>
          <label className="block text-xs font-medium text-[#4B5563] uppercase tracking-wider mb-2">
            Dimensions
          </label>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-[#111827] cursor-pointer">
              <input
                type="checkbox"
                checked={selectedDimensions.includes('Plan')}
                onChange={(e) => handleDimensionToggle('Plan', e.target.checked)}
                className="rounded border-[#E5E7EB] text-[#2563EB] focus:ring-[#2563EB]"
              />
              Plan
            </label>
            <label className="flex items-center gap-2 text-sm text-[#111827] cursor-pointer">
              <input
                type="checkbox"
                checked={selectedDimensions.includes('Month')}
                onChange={(e) => handleDimensionToggle('Month', e.target.checked)}
                className="rounded border-[#E5E7EB] text-[#2563EB] focus:ring-[#2563EB]"
              />
              Month
            </label>
          </div>
        </div>

        {/* Date Range */}
        <div>
          <label className="block text-xs font-medium text-[#4B5563] uppercase tracking-wider mb-2">
            Date Range
          </label>
          <div className="flex items-center justify-between border border-[#E5E7EB] rounded-lg px-3 py-2 bg-white">
            <span className="text-sm text-[#111827]">Last 12 months</span>
            <ChevronDown className="h-4 w-4 text-[#4B5563]" />
          </div>
        </div>

        {/* Filters */}
        <div>
          <label className="block text-xs font-medium text-[#4B5563] uppercase tracking-wider mb-2">
            Filters
          </label>
          <button className="flex items-center gap-1.5 text-sm text-[#2563EB] hover:text-[#1d4ed8] transition-colors">
            <Plus className="h-3.5 w-3.5" />
            Add Filter
          </button>
        </div>

        {/* Visualization Type */}
        <div>
          <label className="block text-xs font-medium text-[#4B5563] uppercase tracking-wider mb-2">
            Visualization
          </label>
          <div className="flex gap-1">
            {vizOptions.map((opt) => (
              <button
                key={opt.type}
                onClick={() => setVizType(opt.type)}
                aria-label={opt.label}
                className={`flex items-center justify-center h-9 w-9 rounded-md transition-colors ${
                  vizType === opt.type
                    ? 'bg-blue-50 border border-blue-200 text-[#2563EB]'
                    : 'border border-[#E5E7EB] text-[#4B5563] hover:bg-gray-50'
                }`}
              >
                {opt.icon}
              </button>
            ))}
          </div>
        </div>

        {/* Semantic Guardrails */}
        <div>
          <label className="block text-xs font-medium text-[#4B5563] uppercase tracking-wider mb-2">
            Semantic Guardrails
          </label>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-[#16A34A]" />
            <span className="text-sm text-[#16A34A] font-medium">All metrics certified</span>
          </div>
        </div>

        {/* Run Query Button */}
        <div className="mt-auto pt-4">
          <Button onClick={handleRunQuery} disabled={isLoading} className="w-full">
            {isLoading ? 'Running...' : 'Run Query'}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-[#F6F8FB]" role="region" aria-label="Query results">
        {isLoading ? (
          <LoadingSkeleton lines={6} className="max-w-2xl" />
        ) : error ? (
          <ErrorState message={error} onRetry={handleRunQuery} />
        ) : result ? (
          <div className="space-y-6">
            {/* Chart Title */}
            <h2 className="text-lg font-semibold text-[#111827]">
              {selectedMetric} by {selectedDimensions.join(', ')}
            </h2>

            {/* Chart Visualization */}
            {result.data.chartData && result.data.chartData.length > 0 && (
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                <SimpleBarChart
                  data={result.data.chartData}
                  xKey={Object.keys(result.data.chartData[0])[0]}
                  yKeys={Object.keys(result.data.chartData[0]).slice(1)}
                  colors={['#60A5FA', '#16A34A', '#D97706']}
                  height={300}
                  stacked={vizType === 'bar'}
                  aria-label={`${selectedMetric} by ${selectedDimensions.join(', ')} chart`}
                />
              </div>
            )}

            {/* Result Preview Table */}
            {result.data.results && result.data.results.length > 0 && (() => {
              const { columns, data } = buildTableData();
              return (
                <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#E5E7EB]">
                    <h3 className="text-sm font-semibold text-[#111827]">Result Preview</h3>
                  </div>
                  <DataTable
                    columns={columns}
                    data={data}
                    caption={`${selectedMetric} result data`}
                  />
                </div>
              );
            })()}

            {/* Generated SQL Collapsible */}
            {result.data.sql && (
              <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                <button
                  onClick={() => setSqlExpanded(!sqlExpanded)}
                  className="w-full flex items-center gap-2 px-6 py-4 text-left hover:bg-gray-50 transition-colors"
                  aria-expanded={sqlExpanded}
                >
                  {sqlExpanded ? (
                    <ChevronDown className="h-4 w-4 text-[#4B5563]" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-[#4B5563]" />
                  )}
                  <span className="text-sm font-semibold text-[#111827]">Generated SQL</span>
                  <Badge variant="outline" className="ml-2 text-xs">
                    PostgreSQL
                  </Badge>
                </button>
                {sqlExpanded && (
                  <div className="px-6 pb-4">
                    <pre className="bg-[#1E293B] text-gray-100 rounded-lg p-4 text-sm font-mono overflow-x-auto">
                      <code>{result.data.sql}</code>
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
