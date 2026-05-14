'use client';

import { useApiQuery } from '@/hooks/use-api-query';
import type { DashboardInsightsResponse } from '@/types/api-responses';
import { LoadingSkeleton, ErrorState } from '@/components/ui/api-states';
import { KPICard } from '@/components/dashboard/kpi-card';
import { SimpleLineChart } from '@/components/charts/simple-line-chart';
import { HorizontalBarChart } from '@/components/charts/horizontal-bar-chart';
import { GroupedBarChart } from '@/components/charts/grouped-bar-chart';
import { DataTable } from '@/components/data-table/data-table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function ExecutiveDashboardPage() {
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useApiQuery<DashboardInsightsResponse>('/api/dashboards/executive/insights');

  const expansionColumns = [
    {
      key: 'name' as const,
      label: 'Account',
    },
    {
      key: 'expansionMrr' as const,
      label: 'Expansion MRR',
      render: (value: unknown) => {
        const num = value as number;
        return `$${(num / 1000).toFixed(1)}k`;
      },
    },
    {
      key: 'growthPercent' as const,
      label: 'Growth %',
      render: (value: unknown) => `${value}%`,
    },
    {
      key: 'plan' as const,
      label: 'Plan',
      render: (value: unknown) => {
        const plan = value as string;
        const variant =
          plan === 'Enterprise'
            ? 'default'
            : plan === 'Growth'
              ? 'secondary'
              : 'outline';
        return <Badge variant={variant}>{plan}</Badge>;
      },
    },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-[#111827]">Executive Dashboard</h1>

      {/* KPI Cards Row */}
      <section aria-label="Key performance indicators">
        {isLoading ? (
          <LoadingSkeleton lines={3} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {data?.kpis.map((kpi) => (
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

      {/* MRR Trend Line Chart */}
      <section aria-label="MRR trend chart">
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
          <h2 className="text-lg font-semibold text-[#111827] mb-4">MRR Trend</h2>
          {isLoading ? (
            <LoadingSkeleton lines={5} />
          ) : error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : (
            <SimpleLineChart
              data={data?.revenue as unknown as Record<string, unknown>[] ?? []}
              xKey="month"
              yKey="mrr"
              color="#2563EB"
              height={300}
              aria-label="Monthly recurring revenue trend over 12 months"
            />
          )}
        </div>
      </section>

      {/* Two-column section: Plan Mix + AI Insight */}
      <section aria-label="Plan mix and AI insights">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Plan Mix Horizontal Bar Chart */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
            <h2 className="text-lg font-semibold text-[#111827] mb-4">Plan Mix</h2>
            {isLoading ? (
              <LoadingSkeleton lines={4} />
            ) : error ? (
              <ErrorState message={error} onRetry={refetch} />
            ) : (
              <HorizontalBarChart
                data={data?.planMix as unknown as Record<string, unknown>[] ?? []}
                nameKey="plan"
                valueKey="revenue"
                color="#2563EB"
                height={200}
                aria-label="Revenue distribution by plan tier: Starter, Growth, and Enterprise"
              />
            )}
          </div>

          {/* AI Insight Card */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#111827] mb-3">AI Insight</h2>
              {isLoading ? (
                <LoadingSkeleton lines={3} />
              ) : error ? (
                <ErrorState message={error} onRetry={refetch} />
              ) : data?.aiInsight ? (
                <>
                  <p className="text-[#4B5563] text-sm leading-relaxed mb-4">
                    {data.aiInsight.summary}
                  </p>
                  <Badge variant="outline">{data.aiInsight.confidence}% confidence</Badge>
                  <div className="mt-4">
                    <Link
                      href={data.aiInsight.link}
                      className="text-sm font-medium text-[#2563EB] hover:underline"
                    >
                      View Details →
                    </Link>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Weekly Active Users Grouped Bar Chart */}
      <section aria-label="Weekly active users chart">
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
          <h2 className="text-lg font-semibold text-[#111827] mb-4">Weekly Active Users</h2>
          {isLoading ? (
            <LoadingSkeleton lines={5} />
          ) : error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : (
            <GroupedBarChart
              data={data?.weeklyActiveUsers as unknown as Record<string, unknown>[] ?? []}
              xKey="week"
              yKeys={['current', 'previous']}
              colors={['#2563EB', '#9CA3AF']}
              height={300}
              aria-label="Weekly active users comparing current period (blue) vs previous period (gray) over 8 weeks"
            />
          )}
        </div>
      </section>

      {/* Top Expansion Accounts Table */}
      <section aria-label="Top expansion accounts">
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
          <h2 className="text-lg font-semibold text-[#111827] mb-4">Top Expansion Accounts</h2>
          {isLoading ? (
            <LoadingSkeleton lines={5} />
          ) : error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : (
            <DataTable
              columns={expansionColumns}
              data={data?.topExpansionAccounts ?? []}
              caption="Top accounts by expansion MRR"
            />
          )}
        </div>
      </section>
    </div>
  );
}
