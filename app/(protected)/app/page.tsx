'use client';

import { useRouter } from 'next/navigation';
import { homeKPIs } from '@/lib/mock-data/kpis';
import { revenueTimeSeries } from '@/lib/mock-data/revenue';
import {
  recentMetrics,
  trustHealth,
  suggestedQuestions,
} from '@/lib/mock-data/dashboards';
import { KPICard } from '@/components/dashboard/kpi-card';
import { SimpleLineChart } from '@/components/charts/simple-line-chart';
import { DataTable } from '@/components/data-table/data-table';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function WorkspaceHomePage() {
  const router = useRouter();

  const metricsColumns = [
    { key: 'name' as const, label: 'Name' },
    { key: 'owner' as const, label: 'Owner' },
    { key: 'date' as const, label: 'Certified Date' },
    {
      key: 'status' as const,
      label: 'Status',
      render: (value: string) => (
        <Badge variant={value === 'certified' ? 'success' : value === 'pending' ? 'warning' : 'outline'}>
          {value}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#111827]">Welcome back, Alex</h1>

      {/* KPI Cards */}
      <section aria-label="Key performance indicators">
        <div className="grid grid-cols-4 gap-4">
          {homeKPIs.map((kpi) => (
            <KPICard
              key={kpi.id}
              label={kpi.label}
              value={kpi.value}
              trend={kpi.trend}
              trendValue={kpi.trendValue}
            />
          ))}
        </div>
      </section>

      {/* Revenue Trend */}
      <section aria-label="Revenue trend">
        <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-6">
          <h2 className="text-lg font-semibold text-[#111827] mb-4">Revenue Trend</h2>
          <SimpleLineChart
            data={revenueTimeSeries as unknown as Record<string, unknown>[]}
            xKey="month"
            yKey="mrr"
            aria-label="Monthly recurring revenue over 12 months"
          />
        </div>
      </section>

      {/* Ask MetricMind */}
      <section aria-label="Ask MetricMind">
        <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-6">
          <h2 className="text-lg font-semibold text-[#111827] mb-4">Ask MetricMind</h2>
          <input
            type="text"
            placeholder="Ask a question about your data..."
            className="w-full rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
            aria-label="Ask a question about your data"
          />
          <div className="flex flex-wrap gap-2 mt-4">
            {suggestedQuestions.slice(0, 4).map((question) => (
              <Button
                key={question}
                variant="outline"
                size="sm"
                onClick={() => router.push(`/app/ask?q=${encodeURIComponent(question)}`)}
              >
                {question}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Two-column: Recently Certified Metrics + Trust Health */}
      <div className="grid grid-cols-2 gap-4">
        {/* Recently Certified Metrics */}
        <section aria-label="Recently certified metrics">
          <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-6">
            <h2 className="text-lg font-semibold text-[#111827] mb-4">Recently Certified Metrics</h2>
            <DataTable
              columns={metricsColumns}
              data={recentMetrics}
              caption="Recently certified metrics with name, owner, date, and status"
            />
          </div>
        </section>

        {/* Trust Health */}
        <section aria-label="Trust health">
          <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-6">
            <h2 className="text-lg font-semibold text-[#111827] mb-4">Trust Health</h2>
            <div className="space-y-5">
              {trustHealth.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[#111827]">{item.label}</span>
                    <span className="text-sm font-semibold text-[#111827]">
                      {item.value}%
                    </span>
                  </div>
                  <Progress
                    value={item.value > 1 ? item.value : item.value * 100}
                    color={item.value >= 90 ? '#16A34A' : item.value < 1 ? '#16A34A' : '#D97706'}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
