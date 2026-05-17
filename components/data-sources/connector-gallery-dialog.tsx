"use client";

import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Cloud,
  Database,
  FileText,
  Lock,
  PlugZap,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  ActionResult,
  ConnectorGalleryItem,
  ExternalConnectorConnectResult,
  ExternalConnectorInput,
  ExternalConnectorTestResult,
  ExternalDataSourceKind,
} from "@/lib/data-sources/types";

interface ConnectorGalleryDialogProps {
  open: boolean;
  workspaceId: string | null;
  canManageExternalSources: boolean;
  connectors: ConnectorGalleryItem[];
  onOpenChange: (open: boolean) => void;
  onConnect: (connector: ConnectorGalleryItem) => void;
  onTestExternalConnector: (
    input: ExternalConnectorInput
  ) => Promise<ActionResult<ExternalConnectorTestResult>>;
  onConnectExternalConnector: (
    input: ExternalConnectorInput
  ) => Promise<ActionResult<ExternalConnectorConnectResult>>;
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

function isExternalConnector(
  connector: ConnectorGalleryItem
): connector is ConnectorGalleryItem & { type: ExternalDataSourceKind } {
  return (
    connector.type === "snowflake" ||
    connector.type === "bigquery" ||
    connector.type === "postgres" ||
    connector.type === "motherduck"
  );
}

function defaultValues(connector: ConnectorGalleryItem): Record<string, string> {
  const name = connector.name;
  if (connector.type === "postgres") {
    return { name, port: "5432", schema: "public", sslMode: "require" };
  }
  if (connector.type === "motherduck") {
    return {
      name,
      database: "md:",
      schema: "main",
      host: "pg.us-east-1-aws.motherduck.com",
    };
  }
  return { name };
}

function fieldsFor(type: ExternalDataSourceKind) {
  if (type === "snowflake") {
    return [
      ["name", "Source name", "text"],
      ["account", "Account", "text"],
      ["username", "Username", "text"],
      ["password", "Password", "password"],
      ["warehouse", "Warehouse", "text"],
      ["database", "Database", "text"],
      ["schema", "Schema", "text"],
      ["role", "Role", "text"],
    ] as const;
  }
  if (type === "bigquery") {
    return [
      ["name", "Source name", "text"],
      ["projectId", "Project ID", "text"],
      ["datasetId", "Dataset ID", "text"],
      ["location", "Location", "text"],
      ["serviceAccountJson", "Service account JSON", "textarea"],
    ] as const;
  }
  if (type === "postgres") {
    return [
      ["name", "Source name", "text"],
      ["host", "Host", "text"],
      ["port", "Port", "number"],
      ["database", "Database", "text"],
      ["schema", "Schema", "text"],
      ["username", "Username", "text"],
      ["password", "Password", "password"],
      ["sslMode", "SSL mode", "select"],
    ] as const;
  }
  return [
    ["name", "Source name", "text"],
    ["token", "MotherDuck token", "password"],
    ["database", "Database", "text"],
    ["schema", "Schema", "text"],
    ["host", "Postgres endpoint host", "text"],
  ] as const;
}

function buildExternalInput(
  connector: ConnectorGalleryItem & { type: ExternalDataSourceKind },
  workspaceId: string,
  values: Record<string, string>
): ExternalConnectorInput {
  const base = {
    workspaceId,
    name: values.name?.trim() || connector.name,
  };

  if (connector.type === "snowflake") {
    return {
      ...base,
      type: "snowflake",
      account: values.account ?? "",
      username: values.username ?? "",
      password: values.password ?? "",
      warehouse: values.warehouse ?? "",
      database: values.database ?? "",
      schema: values.schema ?? "",
      role: values.role || undefined,
    };
  }

  if (connector.type === "bigquery") {
    return {
      ...base,
      type: "bigquery",
      projectId: values.projectId ?? "",
      datasetId: values.datasetId ?? "",
      serviceAccountJson: values.serviceAccountJson ?? "",
      location: values.location || undefined,
    };
  }

  if (connector.type === "postgres") {
    return {
      ...base,
      type: "postgres",
      host: values.host ?? "",
      port: Number(values.port || 5432),
      database: values.database ?? "",
      schema: values.schema ?? "",
      username: values.username ?? "",
      password: values.password ?? "",
      sslMode: values.sslMode === "disable" ? "disable" : "require",
    };
  }

  return {
    ...base,
    type: "motherduck",
    token: values.token ?? "",
    database: values.database || "md:",
    schema: values.schema || "main",
    host: values.host || undefined,
  };
}

export function ConnectorGalleryDialog({
  open,
  workspaceId,
  canManageExternalSources,
  connectors,
  onOpenChange,
  onConnect,
  onTestExternalConnector,
  onConnectExternalConnector,
}: ConnectorGalleryDialogProps) {
  const [selectedConnector, setSelectedConnector] = useState<
    (ConnectorGalleryItem & { type: ExternalDataSourceKind }) | null
  >(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedFields = useMemo(
    () => (selectedConnector ? fieldsFor(selectedConnector.type) : []),
    [selectedConnector]
  );

  useEffect(() => {
    if (!open) {
      setSelectedConnector(null);
      setValues({});
      setMessage(null);
      setError(null);
    }
  }, [open]);

  function updateValue(field: string, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function selectExternalConnector(connector: ConnectorGalleryItem) {
    if (!isExternalConnector(connector)) return;
    setSelectedConnector(connector);
    setValues(defaultValues(connector));
    setMessage(null);
    setError(null);
  }

  async function handleExternalTest() {
    if (!selectedConnector || !workspaceId) return;
    setTesting(true);
    setMessage(null);
    setError(null);
    const result = await onTestExternalConnector(
      buildExternalInput(selectedConnector, workspaceId, values)
    );
    setTesting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage(
      `${result.data.message} ${result.data.datasetCount} dataset${result.data.datasetCount === 1 ? "" : "s"} found.`
    );
  }

  async function handleExternalConnect() {
    if (!selectedConnector || !workspaceId) return;
    setConnecting(true);
    setMessage(null);
    setError(null);
    const result = await onConnectExternalConnector(
      buildExternalInput(selectedConnector, workspaceId, values)
    );
    setConnecting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setValues(defaultValues(selectedConnector));
    onOpenChange(false);
  }

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
            {selectedConnector ? (
              <div className="mx-auto max-w-3xl">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedConnector(null);
                    setMessage(null);
                    setError(null);
                  }}
                  className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back to connectors
                </button>

                <div className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] pb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-[#111827]">
                        Connect {selectedConnector.name}
                      </h3>
                      <p className="mt-1 text-sm text-[#6B7280]">
                        Credentials stay server-side and are stored only as an encrypted payload.
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                      Live metadata
                    </span>
                  </div>

                  {!workspaceId || !canManageExternalSources ? (
                    <div className="mt-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <p>
                        External connectors require an owner or admin in an active workspace.
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {selectedFields.map(([field, label, type]) => {
                      const commonClass =
                        "mt-1 w-full rounded-md border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#111827] shadow-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#BFDBFE]";
                      return (
                        <label
                          key={field}
                          className={type === "textarea" ? "md:col-span-2" : undefined}
                        >
                          <span className="text-sm font-semibold text-[#334155]">{label}</span>
                          {type === "textarea" ? (
                            <textarea
                              value={values[field] ?? ""}
                              onChange={(event) => updateValue(field, event.target.value)}
                              rows={7}
                              className={`${commonClass} font-mono text-xs`}
                              placeholder="{&quot;client_email&quot;:&quot;...&quot;,&quot;private_key&quot;:&quot;...&quot;}"
                            />
                          ) : type === "select" ? (
                            <select
                              value={values[field] ?? "require"}
                              onChange={(event) => updateValue(field, event.target.value)}
                              className={commonClass}
                            >
                              <option value="require">Require SSL</option>
                              <option value="disable">Disable SSL</option>
                            </select>
                          ) : (
                            <input
                              type={type}
                              value={values[field] ?? ""}
                              onChange={(event) => updateValue(field, event.target.value)}
                              className={commonClass}
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>

                  {message ? (
                    <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
                      {message}
                    </div>
                  ) : null}
                  {error ? (
                    <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
                      {error}
                    </div>
                  ) : null}

                  <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleExternalTest}
                      disabled={!workspaceId || !canManageExternalSources || testing || connecting}
                    >
                      {testing ? "Testing" : "Test connection"}
                    </Button>
                    <Button
                      type="button"
                      onClick={handleExternalConnect}
                      disabled={!workspaceId || !canManageExternalSources || testing || connecting}
                    >
                      {connecting ? "Connecting" : "Connect source"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {connectors.map((connector) => {
                const disabled = connector.availability === "coming_soon";
                const connected = connector.availability === "connected";
                const external = isExternalConnector(connector);
                const externalDisabled = external && !canManageExternalSources;
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
                      disabled={disabled || externalDisabled}
                      onClick={() =>
                        external ? selectExternalConnector(connector) : onConnect(connector)
                      }
                      className="mt-4 w-full gap-2"
                    >
                      {disabled || externalDisabled ? (
                        <Lock className="h-4 w-4" aria-hidden="true" />
                      ) : connected ? (
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <PlugZap className="h-4 w-4" aria-hidden="true" />
                      )}
                      {connected
                        ? "Reconnect"
                        : disabled
                          ? "Coming soon"
                          : externalDisabled
                            ? "Admin required"
                            : "Connect"}
                    </Button>
                  </article>
                );
              })}
            </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
