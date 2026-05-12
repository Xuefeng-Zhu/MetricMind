"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { AuditAction, AuditEvent } from "@/lib/audit/audit-service";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

const AUDIT_ACTIONS: AuditAction[] = [
  "user.login",
  "user.logout",
  "member.invited",
  "member.removed",
  "member.role_changed",
  "datasource.created",
  "metric.created",
  "metric.certified",
  "metric.modified",
  "query.executed",
  "query.rejected",
  "alert.fired",
  "security.violation",
];

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatAction(action: string): string {
  return action
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" → ");
}

export default function AuditLogsPage() {
  const { workspaceContext } = useAuthStore();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string>("");
  const [actorFilter, setActorFilter] = useState<string>("");

  const isAdminOrAbove =
    workspaceContext?.role === "admin" ||
    workspaceContext?.role === "owner";

  const fetchEvents = useCallback(async () => {
    if (!workspaceContext?.workspaceId) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (actionFilter) params.set("action", actionFilter);
      if (actorFilter.trim()) params.set("actorId", actorFilter.trim());

      const queryString = params.toString();
      const url = `/api/audit-logs${queryString ? `?${queryString}` : ""}`;

      const response = await fetch(url, {
        headers: {
          "x-workspace-id": workspaceContext.workspaceId,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to fetch audit events");
      }

      const data = await response.json();
      setEvents(data.events ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch audit events");
    } finally {
      setIsLoading(false);
    }
  }, [workspaceContext?.workspaceId, actionFilter, actorFilter]);

  useEffect(() => {
    if (isAdminOrAbove) {
      fetchEvents();
    }
  }, [isAdminOrAbove, fetchEvents]);

  if (!workspaceContext) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <p className="text-muted-foreground">
          Please select a workspace first.
        </p>
      </main>
    );
  }

  if (!isAdminOrAbove) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You do not have permission to view audit logs. Admin or owner role
              is required.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Audit Logs</h1>
      <p className="text-muted-foreground mb-8">
        View security-relevant events for your workspace.
      </p>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="action-filter">Action Type</Label>
              <select
                id="action-filter"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="flex h-10 w-full min-w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Filter by action type"
              >
                <option value="">All Actions</option>
                {AUDIT_ACTIONS.map((action) => (
                  <option key={action} value={action}>
                    {formatAction(action)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="actor-filter">Actor ID</Label>
              <input
                id="actor-filter"
                type="text"
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
                placeholder="Filter by actor ID..."
                className="flex h-10 w-full min-w-[250px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Filter by actor ID"
              />
            </div>
            <Button onClick={fetchEvents} disabled={isLoading}>
              {isLoading ? "Loading..." : "Apply Filters"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Events Table */}
      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
          <CardDescription>
            Showing {events.length} event{events.length !== 1 ? "s" : ""} in
            reverse chronological order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading audit events...</p>
          ) : events.length === 0 ? (
            <p className="text-muted-foreground">No audit events found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">
                      Timestamp
                    </th>
                    <th className="text-left py-3 px-2 font-medium">Actor</th>
                    <th className="text-left py-3 px-2 font-medium">Action</th>
                    <th className="text-left py-3 px-2 font-medium">
                      Target Type
                    </th>
                    <th className="text-left py-3 px-2 font-medium">
                      Target ID
                    </th>
                    <th className="text-left py-3 px-2 font-medium">
                      Metadata
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr
                      key={event.id}
                      className="border-b last:border-b-0 hover:bg-muted/50"
                    >
                      <td className="py-3 px-2 whitespace-nowrap">
                        {formatTimestamp(event.timestamp)}
                      </td>
                      <td
                        className="py-3 px-2 font-mono text-xs max-w-[150px] truncate"
                        title={event.actor_id}
                      >
                        {event.actor_id.slice(0, 8)}...
                      </td>
                      <td className="py-3 px-2">
                        <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-primary/10 text-primary">
                          {formatAction(event.action)}
                        </span>
                      </td>
                      <td className="py-3 px-2">{event.target_type}</td>
                      <td
                        className="py-3 px-2 font-mono text-xs max-w-[150px] truncate"
                        title={event.target_id}
                      >
                        {event.target_id.slice(0, 8)}...
                      </td>
                      <td className="py-3 px-2 max-w-[200px]">
                        {Object.keys(event.metadata).length > 0 ? (
                          <details className="cursor-pointer">
                            <summary className="text-xs text-muted-foreground">
                              {Object.keys(event.metadata).length} field
                              {Object.keys(event.metadata).length !== 1
                                ? "s"
                                : ""}
                            </summary>
                            <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                              {JSON.stringify(event.metadata, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
