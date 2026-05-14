"use client";

import { useState, useMemo } from "react";
import { Shield, Activity, Lock, EyeOff } from "lucide-react";
import { useApiQuery } from "@/hooks/use-api-query";
import type { AuditLogsResponse } from "@/types/api-responses";
import { LoadingSkeleton, ErrorState } from "@/components/ui/api-states";
import { KPICard } from "@/components/dashboard/kpi-card";
import { SimpleBarChart } from "@/components/charts/simple-bar-chart";
import { DataTable } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { LucideIcon } from "lucide-react";

// ─── Local types for audit event display ─────────────────────────────────────

interface AuditEventRow {
  id: string;
  created_at: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
}

// ─── Static governance controls (no API endpoint available) ──────────────────

interface GovernanceControl {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

const governanceControls: GovernanceControl[] = [
  {
    id: "gov-001",
    label: "SQL Denylist Enforcement",
    description:
      "Block dangerous SQL patterns (DROP, TRUNCATE, DELETE without WHERE)",
    enabled: true,
  },
  {
    id: "gov-002",
    label: "PII Column Masking",
    description:
      "Automatically mask personally identifiable information in query results",
    enabled: true,
  },
  {
    id: "gov-003",
    label: "AI Trace Logging",
    description:
      "Log all AI-generated queries with full execution trace for audit",
    enabled: true,
  },
  {
    id: "gov-004",
    label: "RLS Auto-Enforcement",
    description:
      "Automatically apply row-level security filters based on user context",
    enabled: true,
  },
];

// ─── Icon mapping for KPI cards ─────────────────────────────────────────────

const kpiIcons: LucideIcon[] = [Shield, Activity, Lock, EyeOff];

// ─── Static KPI data (derived from audit events summary — no separate API) ──

const auditKPIs = [
  {
    id: "audit-blocked-sql",
    label: "Blocked SQL",
    value: "18",
    trend: "down" as const,
    trendValue: "-3",
  },
  {
    id: "audit-ai-traces",
    label: "AI Traces",
    value: "6.2k",
    trend: "up" as const,
    trendValue: "+12.4%",
  },
  {
    id: "audit-rls-checks",
    label: "RLS Policy Checks",
    value: "42k",
    trend: "up" as const,
    trendValue: "+5.8%",
  },
  {
    id: "audit-pii-columns",
    label: "PII Columns",
    value: "12",
    trend: "neutral" as const,
    trendValue: "0",
  },
];

// ─── Generate 30 days of deterministic AI safety data ────────────────────────

function generateSafetyData() {
  const data: { day: string; blocked: number; allowed: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const day = `Apr ${(i + 1).toString().padStart(2, "0")}`;
    const blocked = ((i * 3 + 7) % 5) + 1;
    const allowed = ((i * 7 + 13) % 71) + 50;
    data.push({ day, blocked, allowed });
  }
  return data;
}

const safetyData = generateSafetyData();

// ─── Action badge color mapping ──────────────────────────────────────────────

function getActionBadgeVariant(
  actionType: string
): "danger" | "warning" | "success" | "default" | "secondary" {
  switch (actionType) {
    case "query_blocked":
      return "danger";
    case "pii_access":
      return "warning";
    case "metric_certified":
      return "success";
    case "config_changed":
      return "default";
    case "rls_check":
      return "success";
    case "trace_logged":
      return "secondary";
    case "user_login":
      return "secondary";
    case "export_data":
      return "default";
    default:
      return "secondary";
  }
}

function formatActionLabel(actionType: string): string {
  return actionType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Known action types for filter dropdown ──────────────────────────────────

const knownActionTypes = [
  "query_blocked",
  "pii_access",
  "metric_certified",
  "config_changed",
  "rls_check",
  "trace_logged",
  "user_login",
  "export_data",
];

// ─── Main Page Component ─────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const { toast } = useToast();
  const [toggleStates, setToggleStates] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      governanceControls.forEach((control) => {
        initial[control.id] = control.enabled;
      });
      return initial;
    }
  );
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [actorFilter, setActorFilter] = useState<string>("all");

  // Fetch audit events with filter params — re-fetches when filters change
  const { data, isLoading, error, refetch } =
    useApiQuery<AuditLogsResponse>("/api/audit-logs", {
      params: {
        action: actionFilter !== "all" ? actionFilter : undefined,
        actorId: actorFilter !== "all" ? actorFilter : undefined,
      },
    });

  // Extract unique actors from fetched events for the actor filter dropdown
  const actors = useMemo(() => {
    if (!data?.events) return [];
    const actorSet = new Set(data.events.map((e) => e.actor_id));
    return Array.from(actorSet).sort();
  }, [data]);

  // Toggle handler for governance controls
  function handleToggle(controlId: string, label: string) {
    setToggleStates((prev) => {
      const newEnabled = !prev[controlId];
      toast({
        title: "Setting updated",
        description: `${label} ${newEnabled ? "enabled" : "disabled"}`,
      });
      return { ...prev, [controlId]: newEnabled };
    });
  }

  // Table columns for audit events
  const columns = [
    {
      key: "created_at" as keyof AuditEventRow,
      label: "Timestamp",
      render: (value: AuditEventRow[keyof AuditEventRow]) => (
        <span className="text-sm text-[#4B5563] whitespace-nowrap">
          {formatTimestamp(value as string)}
        </span>
      ),
    },
    {
      key: "actor_id" as keyof AuditEventRow,
      label: "Actor",
      render: (value: AuditEventRow[keyof AuditEventRow]) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center text-xs font-medium shrink-0">
            {(value as string).slice(0, 2).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-[#111827]">
            {value as string}
          </span>
        </div>
      ),
    },
    {
      key: "action" as keyof AuditEventRow,
      label: "Action",
      render: (value: AuditEventRow[keyof AuditEventRow]) => (
        <Badge variant={getActionBadgeVariant(value as string)}>
          {formatActionLabel(value as string)}
        </Badge>
      ),
    },
    {
      key: "target_type" as keyof AuditEventRow,
      label: "Target",
      render: (
        _value: AuditEventRow[keyof AuditEventRow],
        row: AuditEventRow
      ) => (
        <span className="text-sm text-[#111827] max-w-[300px] truncate block">
          {row.target_type}: {row.target_id}
        </span>
      ),
    },
  ];

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">
            Audit Logs &amp; Governance
          </h1>
        </div>
        <LoadingSkeleton lines={6} />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">
            Audit Logs &amp; Governance
          </h1>
        </div>
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">
          Audit Logs &amp; Governance
        </h1>
      </div>

      {/* Trust Center KPI Cards */}
      <section aria-label="Trust center metrics">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {auditKPIs.map((kpi, index) => (
            <KPICard
              key={kpi.id}
              label={kpi.label}
              value={kpi.value}
              trend={kpi.trend}
              trendValue={kpi.trendValue}
              icon={kpiIcons[index]}
            />
          ))}
        </div>
      </section>

      {/* Governance Controls */}
      <section aria-label="Governance controls">
        <h2 className="text-lg font-semibold text-[#111827] mb-4">
          Governance Controls
        </h2>
        <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] divide-y divide-[#E5E7EB]">
          {governanceControls.map((control) => (
            <div
              key={control.id}
              className="flex items-center justify-between px-6 py-4"
            >
              <div>
                <p className="text-sm font-medium text-[#111827]">
                  {control.label}
                </p>
                <p className="text-sm text-[#4B5563]">
                  {control.description}
                </p>
              </div>
              <button
                role="switch"
                aria-checked={toggleStates[control.id]}
                aria-label={`Toggle ${control.label}`}
                onClick={() => handleToggle(control.id, control.label)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 ${
                  toggleStates[control.id]
                    ? "bg-[#2563EB]"
                    : "bg-[#D1D5DB]"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    toggleStates[control.id]
                      ? "translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* AI Safety Activity Chart */}
      <section aria-label="AI safety activity">
        <h2 className="text-lg font-semibold text-[#111827] mb-4">
          AI Safety Activity
        </h2>
        <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-6">
          <SimpleBarChart
            data={safetyData}
            xKey="day"
            yKeys={["blocked", "allowed"]}
            colors={["#DC2626", "#2563EB"]}
            height={300}
            stacked={true}
            aria-label="AI Safety Activity: stacked bar chart showing blocked vs allowed queries over 30 days"
          />
        </div>
      </section>

      {/* Audit Event Stream */}
      <section aria-label="Audit event stream">
        <h2 className="text-lg font-semibold text-[#111827] mb-4">
          Audit Event Stream
        </h2>
        <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB]">
          {/* Filter Row */}
          <div className="flex flex-wrap gap-4 px-6 py-4 border-b border-[#E5E7EB]">
            <div className="space-y-1">
              <label
                htmlFor="action-type-filter"
                className="text-xs font-medium text-[#4B5563]"
              >
                Action Type
              </label>
              <select
                id="action-type-filter"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="block h-9 w-48 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
              >
                <option value="all">All Actions</option>
                {knownActionTypes.map((type) => (
                  <option key={type} value={type}>
                    {formatActionLabel(type)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label
                htmlFor="actor-filter"
                className="text-xs font-medium text-[#4B5563]"
              >
                Actor
              </label>
              <select
                id="actor-filter"
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
                className="block h-9 w-48 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
              >
                <option value="all">All Actors</option>
                {actors.map((actor) => (
                  <option key={actor} value={actor}>
                    {actor}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto">
            <DataTable
              columns={columns}
              data={(data?.events ?? []) as unknown as AuditEventRow[]}
              caption="Audit event log showing recent platform activity"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
