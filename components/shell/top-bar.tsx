"use client";

import { useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { Search, Bell } from "lucide-react";

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

export function TopBar({ title }: TopBarProps) {
  const pathname = usePathname();
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const pageTitle = title || routeTitleMap[pathname] || "Dashboard";

  function handleSearchKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      setSearchFocused(false);
      searchInputRef.current?.blur();
      event.preventDefault();
    }
  }

  return (
    <header className="h-16 border-b border-[#E5E7EB] bg-white flex items-center justify-between px-6">
      {/* Left: Page Title */}
      <span className="text-lg font-semibold text-[#111827]">{pageTitle}</span>

      {/* Right: Search, Notifications, Avatar */}
      <div className="flex items-center gap-4">
        {/* Search Input */}
        <div className="relative">
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
              className="w-64 rounded-lg bg-[#F3F4F6] pl-9 pr-3 py-2 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
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
                <div
                  key={suggestion}
                  role="option"
                  aria-selected={false}
                  className="px-3 py-2 text-sm text-[#374151] hover:bg-[#F3F4F6] cursor-pointer"
                >
                  {suggestion}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notification Bell */}
        <button
          type="button"
          aria-label="Notifications, 3 unread"
          className="relative p-2 rounded-lg hover:bg-[#F3F4F6] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
        >
          <Bell className="w-5 h-5 text-[#4B5563]" />
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-medium text-white">
            3
          </span>
        </button>

        {/* User Avatar */}
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-medium text-white">AR</span>
        </div>
      </div>
    </header>
  );
}
