"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

const workspaces = [
  { id: "acme", name: "Acme Corp" },
  { id: "demo", name: "Demo Workspace" },
];

export function WorkspaceSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState("acme");
  const containerRef = useRef<HTMLDivElement>(null);

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

  const currentWorkspace = workspaces.find((w) => w.id === activeWorkspace);

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm text-gray-300 hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <span>{currentWorkspace?.name}</span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {isOpen && (
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
              aria-selected={workspace.id === activeWorkspace}
              onClick={() => {
                setActiveWorkspace(workspace.id);
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-300 hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <span>{workspace.name}</span>
              {workspace.id === activeWorkspace && (
                <Check className="w-4 h-4 text-blue-400" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
