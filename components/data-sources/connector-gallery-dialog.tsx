"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  CheckCircle2,
  Cloud,
  Database,
  FileText,
  Lock,
  PlugZap,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ConnectorGalleryItem } from "@/lib/mock-data/data-sources";

interface ConnectorGalleryDialogProps {
  open: boolean;
  connectors: ConnectorGalleryItem[];
  onOpenChange: (open: boolean) => void;
  onConnect: (connector: ConnectorGalleryItem) => void;
}

const availabilityStyles: Record<ConnectorGalleryItem["availability"], string> = {
  connected: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  available: "bg-blue-50 text-blue-700 ring-blue-200",
  beta: "bg-violet-50 text-violet-700 ring-violet-200",
  coming_soon: "bg-slate-100 text-slate-600 ring-slate-200",
};

function ConnectorIcon({ category }: { category: string }) {
  const normalized = category.toLowerCase();
  if (normalized.includes("warehouse") || normalized.includes("database")) {
    return <Database className="h-5 w-5" aria-hidden="true" />;
  }
  if (normalized.includes("upload")) {
    return <FileText className="h-5 w-5" aria-hidden="true" />;
  }
  return <Cloud className="h-5 w-5" aria-hidden="true" />;
}

function formatAvailability(value: ConnectorGalleryItem["availability"]): string {
  return value.replace("_", " ");
}

export function ConnectorGalleryDialog({
  open,
  connectors,
  onOpenChange,
  onConnect,
}: ConnectorGalleryDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40 data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[86vh] w-[min(980px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-xl focus-visible:outline-none">
          <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] p-5">
            <div>
              <Dialog.Title className="text-lg font-semibold text-[#111827]">
                Connector gallery
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-[#6B7280]">
                Connect governed sources for AI-ready analytics and semantic modeling.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close connector gallery"
                className="rounded-md p-2 text-[#6B7280] hover:bg-[#F3F4F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="max-h-[calc(86vh-96px)] overflow-y-auto p-5">
            <div className="grid gap-4 md:grid-cols-2">
              {connectors.map((connector) => {
                const disabled = connector.availability === "coming_soon";
                const connected = connector.availability === "connected";
                return (
                  <article
                    key={connector.id}
                    className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#EFF6FF] text-[#2563EB]">
                          <ConnectorIcon category={connector.category} />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-[#111827]">
                            {connector.name}
                          </h3>
                          <p className="mt-1 text-xs font-medium text-[#6B7280]">
                            {connector.provider} · {connector.category}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ring-1 ${availabilityStyles[connector.availability]}`}
                      >
                        {formatAvailability(connector.availability)}
                      </span>
                    </div>

                    <p className="mt-4 min-h-[40px] text-sm leading-5 text-[#4B5563]">
                      {connector.description}
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-md bg-[#F9FAFB] p-2">
                        <p className="font-medium text-[#6B7280]">Setup time</p>
                        <p className="mt-1 font-semibold text-[#111827]">
                          {connector.setupTime}
                        </p>
                      </div>
                      <div className="rounded-md bg-[#F9FAFB] p-2">
                        <p className="font-medium text-[#6B7280]">Best for</p>
                        <p className="mt-1 truncate font-semibold text-[#111827]">
                          {connector.recommendedFor}
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant={connected ? "outline" : "default"}
                      disabled={disabled}
                      onClick={() => onConnect(connector)}
                      className="mt-4 w-full gap-2"
                    >
                      {disabled ? (
                        <Lock className="h-4 w-4" aria-hidden="true" />
                      ) : connected ? (
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <PlugZap className="h-4 w-4" aria-hidden="true" />
                      )}
                      {connected ? "Reconnect" : disabled ? "Coming soon" : "Connect"}
                    </Button>
                  </article>
                );
              })}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
