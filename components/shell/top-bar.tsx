"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, Bell, TriangleAlert } from "lucide-react";
import { useApiQuery } from "@/hooks/use-api-query";
import { getUserInitials } from "@/lib/auth/user-display";
import { useAuthStore } from "@/stores/auth-store";

const routeTitleMap: Record<string, string> = {
  "/app": "Dashboard",
  "/app/data-sources": "Data Sources",
  "/app/semantic-layer": "Semantic Layer",
  "/app/ask": "AI Analyst",
  "/app/explore": "Explore",
  "/app/dashboards/executive": "Executive Dashboard",
  "/app/insights/churn-spike": "Insight Detail",
  "/app/audit-logs": "Audit Logs",
};

const searchSuggestions = ["MRR by plan", "Churn rate trend", "Active users"];

interface TopBarProps {
  title?: string;
}

interface AlertNotification {
  id: string;
  metric_value?: number | null;
  threshold?: number | null;
  read?: boolean | null;
  fired_at?: string | null;
}

interface AlertsResponse {
  notifications?: AlertNotification[];
}

function canViewAlerts(role: string | undefined): boolean {
  return role === "owner" || role === "admin" || role === "analyst";
}

function formatNotification(notification: AlertNotification): string {
  if (typeof notification.metric_value === "number" && typeof notification.threshold === "number") {
    return `Alert fired at ${notification.metric_value.toLocaleString()} against a ${notification.threshold.toLocaleString()} threshold.`;
  }

  return "An alert notification needs review.";
}

export function TopBar({ title }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, workspaceContext } = useAuthStore();
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const pageTitle = title || routeTitleMap[pathname] || "Dashboard";
  const canLoadNotifications = canViewAlerts(workspaceContext?.role);
  const { data: alertsData } = useApiQuery<AlertsResponse>("/api/alerts", {
    enabled: canLoadNotifications,
  });
  const unreadNotifications =
    alertsData?.notifications?.filter((notification) => !notification.read) ?? [];
  const unreadCount = unreadNotifications.length;
  const notificationLabel =
    unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications";

  function submitSearch(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;

    setSearchFocused(false);
    searchInputRef.current?.blur();
    router.push(`/app/ask?q=${encodeURIComponent(trimmed)}`);
    window.dispatchEvent(
      new CustomEvent("metricmind:ask-query", {
        detail: { question: trimmed },
      })
    );
  }

  function handleSearchKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      setSearchFocused(false);
      searchInputRef.current?.blur();
      event.preventDefault();
      return;
    }

    if (event.key === "Enter") {
      submitSearch(searchTerm);
      event.preventDefault();
    }
  }

  return (
    <header className="h-16 border-b border-[#E5E7EB] bg-white flex items-center justify-between gap-3 px-4 sm:px-6">
      {/* Left: Page Title */}
      <span className="min-w-0 truncate text-base font-semibold text-[#111827] sm:text-lg">
        {pageTitle}
      </span>

      {/* Right: Search, Notifications, Avatar */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        {/* Search Input */}
        <div className="relative hidden sm:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4B5563]" />
            <input
              ref={searchInputRef}
              type="text"
              role="combobox"
              placeholder="Search metrics, data..."
              aria-label="Search metrics and data"
              aria-expanded={searchFocused}
              aria-controls="search-suggestions-listbox"
              aria-haspopup="listbox"
              aria-autocomplete="list"
              value={searchTerm}
              className="w-64 rounded-lg bg-[#F3F4F6] pl-9 pr-3 py-2 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onChange={(event) => setSearchTerm(event.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
          {searchFocused && (
            <div
              id="search-suggestions-listbox"
              role="listbox"
              aria-label="Search suggestions"
              className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg border border-[#E5E7EB] shadow-lg py-1 z-50"
            >
              {searchSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setSearchTerm(suggestion);
                    submitSearch(suggestion);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-[#374151] hover:bg-[#F3F4F6] cursor-pointer"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            type="button"
            aria-label={notificationLabel}
            aria-expanded={notificationsOpen}
            aria-controls="notifications-menu"
            onClick={() => setNotificationsOpen((open) => !open)}
            className="relative p-2 rounded-lg hover:bg-[#F3F4F6] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
          >
            <Bell className="w-5 h-5 text-[#4B5563]" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          {notificationsOpen && (
            <div
              id="notifications-menu"
              className="absolute right-0 top-full z-50 mt-2 w-[calc(100vw-1rem)] max-w-80 rounded-lg border border-[#E5E7EB] bg-white p-3 shadow-lg sm:w-80"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#111827]">Notifications</p>
                <Link
                  href="/app/alerts"
                  className="text-xs font-medium text-[#2563EB] hover:underline"
                  onClick={() => setNotificationsOpen(false)}
                >
                  View alerts
                </Link>
              </div>
              <div className="space-y-2">
                {unreadNotifications.length > 0 ? (
                  unreadNotifications.slice(0, 3).map((notification) => (
                    <div
                      key={notification.id}
                      className="flex gap-2 rounded-md bg-orange-50 p-2 text-sm text-orange-900"
                    >
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{formatNotification(notification)}</span>
                    </div>
                  ))
                ) : (
                  <p className="rounded-md bg-[#F9FAFB] p-3 text-sm text-[#4B5563]">
                    No unread notifications.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Avatar */}
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-medium text-white">{getUserInitials(user)}</span>
        </div>
      </div>
    </header>
  );
}
