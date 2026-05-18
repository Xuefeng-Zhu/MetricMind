'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApiQuery } from '@/hooks/use-api-query';
import type { DashboardInsightsResponse, MetricsResponse } from '@/types/api-responses';
import { LoadingSkeleton, ErrorState } from '@/components/ui/api-states';
import { KPICard } from '@/components/dashboard/kpi-card';
import { SimpleLineChart } from '@/components/charts/simple-line-chart';
import { DataTable } from '@/components/data-table/data-table';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getUserDisplayName } from '@/lib/auth/user-display';
import { useAuthStore } from '@/stores/auth-store';
import { Send } from 'lucide-react';

const suggestedQuestions = [
  'Why did churn increase in April?',
  'MRR by plan',
  'Top expansion accounts',
  'Weekly active users',
];

export default function WorkspaceHomePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [askQuestion, setAskQuestion] = useState('');
  const displayName = getUserDisplayName(user);

  // Fetch dashboard insights (KPIs, revenue, trust health)
  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    error: dashboardError,
    refetch: refetchDashboard,
  } = useApiQuery<DashboardInsightsResponse>('/api/dashboards/home/insights');

  // Fetch certified metrics
  const {
    data: metricsData,
    isLoading: metricsLoading,
    error: metricsError,
    refetch: refetchMetrics,
  } = useApiQuery<MetricsResponse>('/api/semantic/metrics');

  type MetricRow = MetricsResponse['metrics'][number];

  const metricsColumns: Array<{
    key: keyof MetricRow;
    label: string;
    render?: (value: MetricRow[keyof MetricRow], row: MetricRow) => React.ReactNode;
  }> = [
    { key: 'name', label: 'Name' },
    { key: 'owner', label: 'Owner' },
    { key: 'certified_date', label: 'Certified Date' },
    {
      key: 'certified',
      label: 'Status',
      render: (value) => (
        <Badge variant={value ? 'success' : 'outline'}>
          {value ? 'certified' : 'pending'}
        </Badge>
      ),
    },
  ];

  function handleAskSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = askQuestion.trim();
    if (!trimmed) return;

    router.push(`/app/ask?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#111827]">Welcome back, {displayName}</h1>

      {/* KPI Cards */}
      <section aria-label="Key performance indicators">
        {dashboardLoading ? (
          <LoadingSkeleton lines={3} />
        ) : dashboardError ? (
          <ErrorState message={dashboardError} onRetry={refetchDashboard} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {dashboardData?.kpis.map((kpi) => (
              <KPICard
                key={kpi.label}
                label={kpi.label}
                value={kpi.value}
                trend={kpi.trend}
                trendValue={kpi.trendValue}
              />
            ))}
          </div>
        )}
      </section>

      {/* Revenue Trend */}
      <section aria-label="Revenue trend">
        <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-6">
          <h2 className="text-lg font-semibold text-[#111827] mb-4">Revenue Trend</h2>
          {dashboardLoading ? (
            <LoadingSkeleton lines={5} />
          ) : dashboardError ? (
            <ErrorState message={dashboardError} onRetry={refetchDashboard} />
          ) : (
            <SimpleLineChart
              data={dashboardData?.revenue as unknown as Record<string, unknown>[] ?? []}
              xKey="month"
              yKey="mrr"
              aria-label="Monthly recurring revenue over 12 months"
            />
          )}
        </div>
      </section>

      {/* Ask MetricMind */}
      <section aria-label="Ask MetricMind">
        <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-6">
          <h2 className="text-lg font-semibold text-[#111827] mb-4">Ask MetricMind</h2>
          <form onSubmit={handleAskSubmit}>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={askQuestion}
                onChange={(event) => setAskQuestion(event.target.value)}
                placeholder="Ask a question about your data..."
                className="min-w-0 flex-1 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                aria-label="Ask a question about your data"
              />
              <Button
                type="submit"
                size="icon"
                aria-label="Submit question"
                disabled={!askQuestion.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {suggestedQuestions.map((question) => (
                <Button
                  key={question}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/app/ask?q=${encodeURIComponent(question)}`)}
                >
                  {question}
                </Button>
              ))}
            </div>
          </form>
        </div>
      </section>

      {/* Two-column: Recently Certified Metrics + Trust Health */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Recently Certified Metrics */}
        <section aria-label="Recently certified metrics">
          <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-6">
            <h2 className="text-lg font-semibold text-[#111827] mb-4">Recently Certified Metrics</h2>
            {metricsLoading ? (
              <LoadingSkeleton lines={5} />
            ) : metricsError ? (
              <ErrorState message={metricsError} onRetry={refetchMetrics} />
            ) : (
              <div className="overflow-x-auto">
                <DataTable
                  columns={metricsColumns}
                  data={metricsData?.metrics.filter((m) => m.certified) ?? []}
                  caption="Recently certified metrics with name, owner, date, and status"
                />
              </div>
            )}
          </div>
        </section>

        {/* Trust Health */}
        <section aria-label="Trust health">
          <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-6">
            <h2 className="text-lg font-semibold text-[#111827] mb-4">Trust Health</h2>
            {dashboardLoading ? (
              <LoadingSkeleton lines={4} />
            ) : dashboardError ? (
              <ErrorState message={dashboardError} onRetry={refetchDashboard} />
            ) : dashboardData?.aiInsight ? (
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[#111827]">AI Confidence</span>
                    <span className="text-sm font-semibold text-[#111827]">
                      {dashboardData.aiInsight.confidence}%
                    </span>
                  </div>
                  <Progress
                    value={dashboardData.aiInsight.confidence}
                    color={dashboardData.aiInsight.confidence >= 90 ? '#16A34A' : '#D97706'}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No trust health data available</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
