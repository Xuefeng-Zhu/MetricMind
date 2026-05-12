"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";

export interface SaveToDashboardProps {
  question: string;
  sql: string;
  resultData: unknown[];
  chartConfig: Record<string, unknown>;
  summary?: string;
  citations: { type: string; name: string; id: string }[];
  confidence: number;
  assumptions: string[];
}

interface DashboardListItem {
  id: string;
  name: string;
  description: string | null;
}

type SaveStatus = "idle" | "loading" | "success" | "error";

export function SaveToDashboard({
  question,
  sql,
  resultData,
  chartConfig,
  summary,
  citations,
  confidence,
  assumptions,
}: SaveToDashboardProps) {
  const { workspaceContext } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [dashboards, setDashboards] = useState<DashboardListItem[]>([]);
  const [isLoadingDashboards, setIsLoadingDashboards] = useState(false);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  async function fetchDashboards() {
    if (!workspaceContext?.workspaceId) return;

    setIsLoadingDashboards(true);
    try {
      const response = await fetch("/api/dashboards", {
        headers: {
          "x-workspace-id": workspaceContext.workspaceId,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDashboards(data.dashboards || []);
      }
    } catch {
      // Silently handle - dashboards may not be available yet
      setDashboards([]);
    } finally {
      setIsLoadingDashboards(false);
    }
  }

  function handleToggle() {
    if (!isOpen) {
      fetchDashboards();
      setSaveStatus("idle");
      setErrorMessage(null);
      setShowCreateNew(false);
      setNewDashboardName("");
    }
    setIsOpen(!isOpen);
  }

  async function handleSaveToDashboard(dashboardId: string) {
    if (!workspaceContext?.workspaceId) return;

    setSaveStatus("loading");
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/dashboards/${dashboardId}/insights`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-workspace-id": workspaceContext.workspaceId,
          },
          body: JSON.stringify({
            question,
            sql,
            resultData,
            chartConfig,
            summary: summary || "",
            citations,
            confidence,
            assumptions,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to save insight");
      }

      setSaveStatus("success");
      // Auto-close after success
      setTimeout(() => {
        setIsOpen(false);
        setSaveStatus("idle");
      }, 2000);
    } catch (err) {
      setSaveStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to save insight"
      );
    }
  }

  async function handleCreateAndSave() {
    if (!workspaceContext?.workspaceId || !newDashboardName.trim()) return;

    setSaveStatus("loading");
    setErrorMessage(null);

    try {
      // Create new dashboard
      const createResponse = await fetch("/api/dashboards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": workspaceContext.workspaceId,
        },
        body: JSON.stringify({
          name: newDashboardName.trim(),
        }),
      });

      if (!createResponse.ok) {
        const data = await createResponse.json();
        throw new Error(data.message || "Failed to create dashboard");
      }

      const createData = await createResponse.json();
      const newDashboardId = createData.dashboard?.id;

      if (!newDashboardId) {
        throw new Error("Failed to get new dashboard ID");
      }

      // Save insight to the new dashboard
      await handleSaveToDashboard(newDashboardId);
    } catch (err) {
      setSaveStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to create dashboard"
      );
    }
  }

  if (!workspaceContext?.workspaceId) return null;

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        💾 Save to Dashboard
      </Button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4"
          role="dialog"
          aria-label="Save to Dashboard"
        >
          {/* Success State */}
          {saveStatus === "success" && (
            <div className="flex items-center gap-2 text-green-700 text-sm p-2 bg-green-50 rounded">
              ✓ Insight saved successfully
            </div>
          )}

          {/* Error State */}
          {saveStatus === "error" && errorMessage && (
            <div
              className="text-red-700 text-sm p-2 bg-red-50 rounded mb-3"
              role="alert"
            >
              {errorMessage}
            </div>
          )}

          {/* Loading State for Save */}
          {saveStatus === "loading" && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm p-2">
              <span className="animate-pulse">Saving...</span>
            </div>
          )}

          {/* Dashboard Picker */}
          {saveStatus !== "success" && saveStatus !== "loading" && (
            <>
              <h3 className="text-sm font-semibold mb-3">
                Choose a dashboard
              </h3>

              {isLoadingDashboards ? (
                <p className="text-sm text-muted-foreground">
                  Loading dashboards...
                </p>
              ) : (
                <>
                  {/* Existing Dashboards */}
                  {dashboards.length > 0 ? (
                    <ul className="space-y-1 max-h-48 overflow-y-auto mb-3">
                      {dashboards.map((dashboard) => (
                        <li key={dashboard.id}>
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors text-sm"
                            onClick={() =>
                              handleSaveToDashboard(dashboard.id)
                            }
                          >
                            <span className="block font-medium truncate">
                              {dashboard.name}
                            </span>
                            {dashboard.description && (
                              <span className="block text-xs text-muted-foreground truncate">
                                {dashboard.description}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground mb-3">
                      No dashboards yet. Create one below.
                    </p>
                  )}

                  {/* Divider */}
                  <div className="border-t my-2" />

                  {/* Create New Dashboard */}
                  {!showCreateNew ? (
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors text-sm text-blue-600 font-medium"
                      onClick={() => setShowCreateNew(true)}
                    >
                      + Create new dashboard
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        type="text"
                        placeholder="Dashboard name"
                        value={newDashboardName}
                        onChange={(e) => setNewDashboardName(e.target.value)}
                        autoFocus
                        aria-label="New dashboard name"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleCreateAndSave}
                          disabled={!newDashboardName.trim()}
                        >
                          Create & Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setShowCreateNew(false);
                            setNewDashboardName("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
