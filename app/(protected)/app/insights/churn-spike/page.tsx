"use client";

import { useState } from "react";
import { SimpleLineChart } from "@/components/charts/simple-line-chart";
import { DataTable } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useApiQuery } from "@/hooks/use-api-query";
import { LoadingSkeleton } from "@/components/ui/api-states";
import { ErrorState } from "@/components/ui/api-states";

// Local types matching the API response shapes
interface ChurnDriver {
  name: string;
  percentage: number;
  value: number;
}

interface AtRiskAccount {
  name: string;
  mrr: number;
  riskScore: number;
  daysSinceEngagement: number;
  status: 'critical' | 'warning' | 'monitoring';
}

interface RevenueDataPoint {
  month: string;
  mrr: number;
  arr: number;
  starter: number;
  growth: number;
  enterprise: number;
}

interface ChurnInsightResponse {
  churnDrivers: ChurnDriver[];
  atRiskAccounts: AtRiskAccount[];
  revenueTimeSeries: RevenueDataPoint[];
}

const driverColors: Record<number, string> = {
  0: "#DC2626", // red for highest
  1: "#EA580C", // orange
  2: "#D97706", // amber
  3: "#CA8A04", // yellow for lowest
};

const actionPlanSteps = [
  "Review onboarding flow",
  "Audit support SLAs",
  "Schedule customer calls",
  "Evaluate pricing tiers",
];

const evidenceTrail = [
  { label: "Churn Rate Metric", source: "Certified Metrics → Churn Rate" },
  { label: "Support Ticket Volume", source: "Data Source → Zendesk CSV" },
  { label: "Onboarding Completion", source: "Product Events → Activation" },
  { label: "Enterprise Segment Filter", source: "Semantic Layer → Customer" },
];

const metricOptions = ["Churn Rate", "MRR", "NRR"];

export default function InsightDetailPage() {
  const { toast } = useToast();
  const [selectedMetric, setSelectedMetric] = useState("Churn Rate");
  const [threshold, setThreshold] = useState("5");

  const { data, isLoading, error, refetch } = useApiQuery<ChurnInsightResponse>(
    '/api/insights/churn-spike'
  );

  const churnDrivers = data?.churnDrivers ?? [];
  const atRiskAccounts = data?.atRiskAccounts ?? [];
  const revenueTimeSeries = data?.revenueTimeSeries ?? [];

  const handleCreateAlert = () => {
    toast({
      title: "Alert created successfully",
      description: `Alert for ${selectedMetric} with threshold ${threshold}% has been configured.`,
    });
  };

  const accountColumns = [
    { key: "name" as const, label: "Account" },
    {
      key: "mrr" as const,
      label: "MRR",
      render: (value: unknown) =>
        `$${(value as number).toLocaleString()}`,
    },
    { key: "riskScore" as const, label: "Risk Score" },
    { key: "daysSinceEngagement" as const, label: "Days Since Engagement" },
    {
      key: "status" as const,
      label: "Status",
      render: (value: unknown) => {
        const status = value as string;
        const variant =
          status === "critical"
            ? "danger"
            : status === "warning"
            ? "warning"
            : "outline";
        return (
          <Badge variant={variant as "danger" | "warning" | "outline"}>
            {status}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="flex gap-6">
      {/* Main Content */}
      <div className="flex-1 space-y-8">
        {/* Header */}
        <header className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="danger">Critical</Badge>
            <Badge variant="outline">91% confidence</Badge>
          </div>
          <h1 className="text-2xl font-bold text-[#111827]">
            Enterprise churn spiked 58% above expected range
          </h1>
        </header>

        {isLoading && <LoadingSkeleton lines={12} />}
        {error && <ErrorState message={error} onRetry={refetch} />}

        {!isLoading && !error && (
          <>
            {/* Timeline Chart */}
            <section aria-labelledby="timeline-heading">
              <h2 id="timeline-heading" className="text-lg font-semibold text-[#111827] mb-4">
                Timeline
              </h2>
              <div className="relative rounded-xl bg-white border border-[#E5E7EB] p-4">
                {/* Anomaly highlight overlay */}
                <div
                  className="absolute top-12 bottom-12 bg-red-50 border-l border-r border-red-200 opacity-60 pointer-events-none z-0"
                  style={{ left: "62%", right: "18%" }}
                  aria-hidden="true"
                />
                <div className="relative z-10">
                  <SimpleLineChart
                    data={revenueTimeSeries as unknown as Record<string, unknown>[]}
                    xKey="month"
                    yKey="enterprise"
                    color="#DC2626"
                    height={260}
                    aria-label="Enterprise churn timeline showing anomaly spike in recent months"
                  />
                </div>
                <p className="text-xs text-[#4B5563] mt-2">
                  Shaded region indicates anomaly period (Sep–Nov 2024)
                </p>
              </div>
            </section>

            {/* Key Drivers */}
            <section aria-labelledby="drivers-heading">
              <h2 id="drivers-heading" className="text-lg font-semibold text-[#111827] mb-4">
                Key Drivers
              </h2>
              <div className="rounded-xl bg-white border border-[#E5E7EB] p-6 space-y-5">
                {churnDrivers.map((driver, index) => (
                  <div key={driver.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[#111827]">
                        {driver.name}
                      </span>
                      <span className="text-sm font-semibold text-[#4B5563]">
                        {driver.percentage}%
                      </span>
                    </div>
                    <Progress
                      value={driver.percentage}
                      color={driverColors[index]}
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Accounts Needing Action */}
            <section aria-labelledby="accounts-heading">
              <h2 id="accounts-heading" className="text-lg font-semibold text-[#111827] mb-4">
                Accounts Needing Action
              </h2>
              <div className="rounded-xl bg-white border border-[#E5E7EB] overflow-hidden">
                <DataTable
                  columns={accountColumns}
                  data={atRiskAccounts}
                  caption="At-risk accounts requiring immediate attention"
                />
              </div>
            </section>
          </>
        )}
      </div>

      {/* Right Panel */}
      <aside className="w-96 space-y-6 shrink-0">
        {/* Recommended Action Plan */}
        <section
          className="rounded-xl bg-white border border-[#E5E7EB] p-6"
          aria-labelledby="action-plan-heading"
        >
          <h2 id="action-plan-heading" className="text-lg font-semibold text-[#111827] mb-4">
            Recommended Action Plan
          </h2>
          <ol className="space-y-3">
            {actionPlanSteps.map((step, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2563EB] text-white text-xs font-semibold flex items-center justify-center">
                  {index + 1}
                </span>
                <span className="text-sm text-[#111827] pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Evidence Trail */}
        <section
          className="rounded-xl bg-white border border-[#E5E7EB] p-6"
          aria-labelledby="evidence-heading"
        >
          <h2 id="evidence-heading" className="text-lg font-semibold text-[#111827] mb-4">
            Evidence Trail
          </h2>
          <ul className="space-y-3">
            {evidenceTrail.map((item) => (
              <li key={item.label} className="text-sm">
                <span className="font-medium text-[#2563EB] hover:underline cursor-pointer">
                  {item.label}
                </span>
                <span className="text-[#4B5563] block text-xs mt-0.5">
                  {item.source}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Create Alert Form */}
        <section
          className="rounded-xl bg-white border border-[#E5E7EB] p-6"
          aria-labelledby="alert-heading"
        >
          <h2 id="alert-heading" className="text-lg font-semibold text-[#111827] mb-4">
            Create Alert
          </h2>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="metric-select"
                className="block text-sm font-medium text-[#4B5563] mb-1.5"
              >
                Metric
              </label>
              <select
                id="metric-select"
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
              >
                {metricOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="threshold-input"
                className="block text-sm font-medium text-[#4B5563] mb-1.5"
              >
                Threshold (%)
              </label>
              <input
                id="threshold-input"
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                min="0"
                max="100"
              />
            </div>
            <Button className="w-full" onClick={handleCreateAlert}>
              Create Alert
            </Button>
          </div>
        </section>
      </aside>
    </div>
  );
}
