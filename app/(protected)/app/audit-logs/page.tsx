"use client";

import { useState, useMemo } from "react";
import { Shield, Activity, Lock, EyeOff } from "lucide-react";
import { auditKPIs } from "@/lib/mock-data/kpis";
import { auditEvents, governanceControls } from "@/lib/mock-data/audit-events";
import { KPICard } from "@/components/dashboard/kpi-card";
import { SimpleBarChart } from "@/components/charts/simple-bar-chart";
import { DataTable } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { LucideIcon } from "lucide-react";
import type { AuditEvent } from "@/lib/mock-data/types";

// ─── Icon mapping for KPI cards ─────────────────────────────────────────────

const kpiIcons: LucideIcon[] = [Shield, Activity, Lock, EyeOff];

// ─── Generate 30 days of deterministic AI safety data ────────────────────────

function generateSafetyData() {
  const data: { day: string; blocked: number; allowed: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const day = `Apr ${(i + 1).toString().padStart(2, "0")}`;
    // Deterministic values using simple formula
    const blocked = ((i * 3 + 7) % 5) + 1; // 1-5 range
    const allowed = ((i * 7 + 13) % 71) + 50; // 50-120 range
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

  // Get unique action types and actors for filter dropdowns
  const actionTypes = useMemo(() => {
    const types = new Set(auditEvents.map((e) => e.actionType));
    return Array.from(types).sort();
  }, []);

  const actors = useMemo(() => {
    const actorSet = new Set(auditEvents.map((e) => e.actor));
    return Array.from(actorSet).sort();
  }, []);

  // Filter events
  const filteredEvents = useMemo(() => {
    return auditEvents.filter((event) => {
      const matchesAction =
        actionFilter === "all" || event.actionType === actionFilter;
      const matchesActor =
        actorFilter === "all" || event.actor === actorFilter;
      return matchesAction && matchesActor;
    });
  }, [actionFilter, actorFilter]);

  // Toggle handler
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

  // Table columns
  const columns = [
    {
      key: "timestamp" as keyof AuditEvent,
      label: "Timestamp",
      render: (value: AuditEvent[keyof AuditEvent]) => (
        <span className="text-sm text-[#4B5563] whitespace-nowrap">
          {formatTimestamp(value as string)}
        </span>
      ),
    },
    {
      key: "actor" as keyof AuditEvent,
      label: "Actor",
      render: (_value: AuditEvent[keyof AuditEvent], row: AuditEvent) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center text-xs font-medium shrink-0">
            {row.actorAvatar}
          </div>
          <span className="text-sm font-medium text-[#111827]">
            {row.actor}
          </span>
        </div>
      ),
    },
    {
      key: "actionType" as keyof AuditEvent,
      label: "Action",
      render: (value: AuditEvent[keyof AuditEvent]) => (
        <Badge variant={getActionBadgeVariant(value as string)}>
          {formatActionLabel(value as string)}
        </Badge>
      ),
    },
    {
      key: "target" as keyof AuditEvent,
      label: "Target",
      render: (value: AuditEvent[keyof AuditEvent]) => (
        <span className="text-sm text-[#111827] max-w-[300px] truncate block">
          {value as string}
        </span>
      ),
    },
    {
      key: "status" as keyof AuditEvent,
      label: "Status",
      render: (value: AuditEvent[keyof AuditEvent]) => {
        const status = value as string;
        const variant =
          status === "blocked"
            ? "danger"
            : status === "warning"
              ? "warning"
              : "success";
        return (
          <Badge variant={variant}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        );
      },
    },
  ];

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
                {actionTypes.map((type) => (
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
              data={filteredEvents}
              caption="Audit event log showing recent platform activity"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
