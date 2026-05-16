import { AlertTriangle, CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { DataSourceIssue } from "@/lib/mock-data/data-source-issues";
import type { MetricMindDataSource } from "@/lib/mock-data/data-sources";

interface SourceHealthChecklistProps {
  source: MetricMindDataSource | null;
  issues: DataSourceIssue[];
}

interface HealthCheck {
  label: string;
  detail: string;
  state: "pass" | "warn" | "fail" | "neutral";
}

const iconByState: Record<HealthCheck["state"], LucideIcon> = {
  pass: CheckCircle2,
  warn: AlertTriangle,
  fail: XCircle,
  neutral: CircleDashed,
};

const colorByState: Record<HealthCheck["state"], string> = {
  pass: "text-emerald-600",
  warn: "text-amber-600",
  fail: "text-red-600",
  neutral: "text-[#6B7280]",
};

function buildChecks(source: MetricMindDataSource, issues: DataSourceIssue[]): HealthCheck[] {
  const openIssues = issues.filter((issue) => issue.status === "open");
  const criticalIssues = openIssues.filter((issue) => issue.severity === "critical");
  const schemaIssue = openIssues.some((issue) => issue.title.toLowerCase().includes("schema"));

  return [
    {
      label: "Connector credentials",
      detail:
        source.credentialStatus === "valid"
          ? "Credential is valid"
          : source.credentialStatus === "expiring"
            ? "Credential rotation needed soon"
            : "Manual or demo source",
      state: source.credentialStatus === "expiring" ? "warn" : "pass",
    },
    {
      label: "Sync freshness",
      detail:
        source.syncStatus === "paused"
          ? "Sync is paused"
          : source.syncStatus === "attention"
            ? "Latest sync needs review"
            : source.syncStatus === "syncing"
              ? "Sync running now"
              : "Latest sync completed",
      state:
        source.syncStatus === "paused"
          ? "fail"
          : source.syncStatus === "attention"
            ? "warn"
            : "pass",
    },
    {
      label: "Schema stability",
      detail: schemaIssue ? "Schema drift detected" : "No schema drift detected",
      state: schemaIssue ? "fail" : "pass",
    },
    {
      label: "Open issues",
      detail:
        openIssues.length === 0
          ? "No open issues"
          : `${openIssues.length} open, ${criticalIssues.length} critical`,
      state:
        criticalIssues.length > 0 ? "fail" : openIssues.length > 0 ? "warn" : "pass",
    },
  ];
}

export function SourceHealthChecklist({ source, issues }: SourceHealthChecklistProps) {
  if (!source) {
    return (
      <section aria-label="Source health checklist" className="space-y-3">
        <h3 className="text-sm font-semibold text-[#111827]">Source health</h3>
        <div className="rounded-md border border-dashed border-[#CBD5E1] p-4 text-sm text-[#6B7280]">
          Select a data source to review health checks.
        </div>
      </section>
    );
  }

  const checks = buildChecks(source, issues);
  const openIssues = issues.filter((issue) => issue.status === "open");

  return (
    <section aria-label="Source health checklist" className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-[#111827]">Source health</h3>
        <p className="text-xs text-[#6B7280]">Operational checks for {source.name}.</p>
      </div>
      <div className="space-y-2">
        {checks.map((check) => {
          const Icon = iconByState[check.state];
          return (
            <div
              key={check.label}
              className="flex items-start gap-3 rounded-md border border-[#E5E7EB] bg-white p-3"
            >
              <Icon
                className={`mt-0.5 h-4 w-4 shrink-0 ${colorByState[check.state]}`}
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-semibold text-[#111827]">{check.label}</p>
                <p className="mt-1 text-xs text-[#6B7280]">{check.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      {openIssues.length > 0 && (
        <div className="rounded-md bg-amber-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-normal text-amber-800">
            Recommended action
          </p>
          <p className="mt-1 text-sm leading-5 text-amber-900">
            {openIssues[0].recommendation}
          </p>
        </div>
      )}
    </section>
  );
}
