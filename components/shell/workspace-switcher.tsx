"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { Workspace } from "@/lib/workspaces/workspace-service";
import { getWorkspaceRole } from "@/lib/workspaces/client-workspace-bootstrap";

export function WorkspaceSwitcher() {
  const { user, setWorkspaceContext } = useAuthStore();
  const { workspaces, currentWorkspace, setWorkspaces, setCurrentWorkspace } =
    useWorkspaceStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || workspaces.length > 0 || isLoading) return;

    let cancelled = false;

    async function loadWorkspaces() {
      setIsLoading(true);
      try {
        const response = await fetch("/api/workspaces");
        if (!response.ok) return;

        const data = (await response.json()) as { workspaces: Workspace[] };
        if (cancelled) return;

        setWorkspaces(data.workspaces);
        const selectedWorkspace = currentWorkspace ?? data.workspaces[0] ?? null;
        if (selectedWorkspace) {
          selectWorkspace(selectedWorkspace);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadWorkspaces();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, workspaces.length]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
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

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape" && isOpen) {
      setIsOpen(false);
      event.preventDefault();
    }
  }

  function selectWorkspace(workspace: Workspace) {
    setCurrentWorkspace(workspace);
    setWorkspaceContext({
      workspaceId: workspace.id,
      role: getWorkspaceRole(workspace),
    });
    setIsOpen(false);
  }

  const currentLabel =
    currentWorkspace?.name ??
    (isLoading ? "Loading..." : workspaces.length > 0 ? "Select workspace" : "No workspace");

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={isLoading || workspaces.length === 0}
        className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm text-gray-300 hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {isOpen && workspaces.length > 0 && (
        <div
          role="listbox"
          aria-label="Select workspace"
          className="absolute left-0 right-0 top-full mt-1 bg-[#2D3B4E] rounded-md border border-white/10 shadow-lg z-50 py-1"
        >
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              type="button"
              role="option"
              aria-selected={workspace.id === currentWorkspace?.id}
              onClick={() => selectWorkspace(workspace)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-300 hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <span>{workspace.name}</span>
              {workspace.id === currentWorkspace?.id && (
                <Check className="w-4 h-4 text-blue-400" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
