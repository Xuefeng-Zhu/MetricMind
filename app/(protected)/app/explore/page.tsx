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
import { revenueTimeSeries } from '@/lib/mock-data/revenue';
import { SimpleBarChart } from '@/components/charts/simple-bar-chart';
import { DataTable } from '@/components/data-table/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type VizType = 'line' | 'bar' | 'area' | 'table';

interface TableRow {
  month: string;
  starter: string;
  growth: string;
  enterprise: string;
  total: string;
}

const MOCK_SQL = `SELECT
  DATE_TRUNC('month', s.created_at) AS month,
  p.name AS plan,
  SUM(s.amount) AS mrr
FROM subscriptions s
JOIN plans p ON s.plan_id = p.id
WHERE s.status = 'active'
  AND s.created_at >= NOW() - INTERVAL '12 months'
GROUP BY month, plan
ORDER BY month ASC;`;

export default function ExplorePage() {
  const [vizType, setVizType] = useState<VizType>('bar');
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const [sqlExpanded, setSqlExpanded] = useState(false);

  const handleRunQuery = () => {
    setShowResults(false);
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setShowResults(true);
    }, 800);
  };

  const tableData: TableRow[] = revenueTimeSeries.map((d) => ({
    month: d.month,
    starter: `$${(d.starter / 1000).toFixed(1)}k`,
    growth: `$${(d.growth / 1000).toFixed(1)}k`,
    enterprise: `$${(d.enterprise / 1000).toFixed(1)}k`,
    total: `$${((d.starter + d.growth + d.enterprise) / 1000).toFixed(1)}k`,
  }));

  const columns: { key: keyof TableRow; label: string }[] = [
    { key: 'month', label: 'Month' },
    { key: 'starter', label: 'Starter' },
    { key: 'growth', label: 'Growth' },
    { key: 'enterprise', label: 'Enterprise' },
    { key: 'total', label: 'Total' },
  ];

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
            <span className="text-sm font-medium text-[#111827]">MRR</span>
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
                defaultChecked
                className="rounded border-[#E5E7EB] text-[#2563EB] focus:ring-[#2563EB]"
              />
              Plan
            </label>
            <label className="flex items-center gap-2 text-sm text-[#111827] cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
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
          <Button onClick={handleRunQuery} className="w-full">
            Run Query
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-[#F6F8FB]" role="region" aria-label="Query results">
        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-6 w-40 bg-gray-200 rounded" />
            <div className="h-[300px] bg-gray-200 rounded-lg" />
            <div className="h-4 w-60 bg-gray-200 rounded" />
            <div className="h-[200px] bg-gray-200 rounded-lg" />
          </div>
        ) : showResults ? (
          <div className="space-y-6">
            {/* Chart Title */}
            <h2 className="text-lg font-semibold text-[#111827]">MRR by Plan</h2>

            {/* Stacked Bar Chart */}
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
              <SimpleBarChart
                data={revenueTimeSeries as unknown as Record<string, unknown>[]}
                xKey="month"
                yKeys={['starter', 'growth', 'enterprise']}
                colors={['#60A5FA', '#16A34A', '#D97706']}
                height={300}
                stacked={true}
                aria-label="MRR by Plan stacked bar chart showing Starter, Growth, and Enterprise revenue over 12 months"
              />
            </div>

            {/* Result Preview Table */}
            <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
              <div className="px-6 py-4 border-b border-[#E5E7EB]">
                <h3 className="text-sm font-semibold text-[#111827]">Result Preview</h3>
              </div>
              <DataTable columns={columns} data={tableData} caption="MRR by Plan result data" />
            </div>

            {/* Generated SQL Collapsible */}
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
                    <code>{MOCK_SQL}</code>
                  </pre>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
