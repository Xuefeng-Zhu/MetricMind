"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Database,
  GitBranch,
  MessageSquare,
  BarChart3,
  LayoutDashboard,
  Lightbulb,
  Shield,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { getUserDisplayName, getUserInitials } from "@/lib/auth/user-display";
import { useAuthStore } from "@/stores/auth-store";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { label: "Home", href: "/app", icon: Home },
  { label: "Data Sources", href: "/app/data-sources", icon: Database },
  { label: "Semantic Layer", href: "/app/semantic-layer", icon: GitBranch },
  { label: "AI Analyst", href: "/app/ask", icon: MessageSquare },
  { label: "Explore", href: "/app/explore", icon: BarChart3 },
  { label: "Dashboards", href: "/app/dashboards/executive", icon: LayoutDashboard },
  { label: "Insights", href: "/app/insights/churn-spike", icon: Lightbulb },
  { label: "Audit Logs", href: "/app/audit-logs", icon: Shield },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/app") {
    return pathname === "/app";
  }
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const displayName = getUserDisplayName(user);
  const initials = getUserInitials(user);

  return (
    <>
      <aside className="fixed left-0 top-0 hidden h-screen w-[260px] flex-col bg-[#1E293B] text-white md:flex">
        {/* Logo */}
        <div className="px-5 py-5">
          <Link href="/app" className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="text-lg font-semibold">MetricMind</span>
          </Link>
        </div>

        {/* Workspace Switcher */}
        <div className="px-4 mb-4">
          <WorkspaceSwitcher />
        </div>

        {/* Navigation */}
        <nav role="navigation" aria-label="Main navigation" className="flex-1 px-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                      active
                        ? "bg-white/10 text-white font-medium"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom User Section */}
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-medium text-white">{initials}</span>
            </div>
            <span className="text-sm text-gray-300 flex-1 truncate">{displayName}</span>
            <Link
              href="/app/settings"
              aria-label="Settings"
              className="text-gray-400 hover:text-white transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <Settings className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </aside>

      <nav
        role="navigation"
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#E5E7EB] bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden"
      >
        <ul className="flex min-h-16 items-stretch overflow-x-auto px-2 py-1">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href} className="min-w-[72px] flex-1">
                <Link
                  href={item.href}
                  className={`flex h-full flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
                    active
                      ? "bg-[#EFF6FF] text-[#1D4ED8]"
                      : "text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#111827]"
                  }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className="max-w-[68px] truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
