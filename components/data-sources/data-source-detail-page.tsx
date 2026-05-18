"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock,
  Database,
  FileText,
  Grid3X3,
  MoveRight,
  RefreshCw,
  Settings,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import type {
  ActionResult,
  DataSourcesPageData,
  DatasetColumn,
  MetricMindDataSource,
  MetricMindDataset,
} from "@/lib/data-sources/types";
import { ColumnSchemaTable } from "./column-schema-table";
import {
  columnsForDataset,
  datasetsForSource,
  formatCompact,
  formatDateTime,
  formatNumber,
  issuesForSource,
  sourceById,
  syncRunsForSource,
} from "./data-source-view-model";
import { SemanticSuggestionsCard } from "./semantic-suggestions-card";
import { SourceHealthChecklist } from "./source-health-checklist";
import { SyncHistoryTable } from "./sync-history-table";

type PageDataActionPayload = {
  pageData?: DataSourcesPageData;
};

interface DataSourceDetailPageProps {
  initialData: DataSourcesPageData;
  sourceId: string;
  syncDataSourceAction: (input: {
    workspaceId: string;
    dataSourceId: string;
  }) => Promise<ActionResult<PageDataActionPayload>>;
  createSemanticModelFromDatasetAction: (input: {
    workspaceId: string;
    datasetId: string;
  }) => Promise<ActionResult<{ modelId: string; entityId: string; metricIds: string[] }>>;
}

function hasPageData(value: unknown): value is PageDataActionPayload & {
  pageData: DataSourcesPageData;
} {
  return (
    value !== null &&
    typeof value === "object" &&
    "pageData" in value &&
    Boolean((value as PageDataActionPayload).pageData)
  );
}

function supportsSemanticModel(type: MetricMindDataSource["type"]) {
  return type === "csv" || type === "demo";
}

function SourceIcon({ type }: { type: MetricMindDataSource["type"] }) {
  const Icon = type === "demo" ? BarChart3 : type === "csv" ? FileText : Database;
  return <Icon className="h-8 w-8" aria-hidden="true" />;
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "healthy" || status === "ready"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : status === "syncing"
        ? "bg-blue-50 text-blue-700 ring-blue-200"
        : status === "warning"
          ? "bg-amber-50 text-amber-700 ring-amber-200"
          : "bg-red-50 text-red-700 ring-red-200";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ring-1 ${className}`}>
      {status === "healthy" ? "Connected" : status}
    </span>
  );
}

function ReadinessPill({ value }: { value: number }) {
  const className =
    value >= 90
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : value >= 75
        ? "bg-blue-50 text-blue-700 ring-blue-200"
        : "bg-amber-50 text-amber-700 ring-amber-200";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${className}`}>
      {value}% ready
    </span>
  );
}

function DatasetRows({
  datasets,
  sourceId,
  onCreateSemanticModel,
  creatingSemanticModel,
  semanticModelSupported,
}: {
  datasets: MetricMindDataset[];
  sourceId: string;
  onCreateSemanticModel: (dataset: MetricMindDataset) => void;
  creatingSemanticModel: boolean;
  semanticModelSupported: boolean;
}) {
  if (datasets.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-white p-8 text-sm text-[#64748B]">
        No datasets have been profiled for this source yet.
      </div>
    );
  }

  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-max min-w-full text-sm">
        <thead>
          <tr className="border-b border-[#E5E7EB] text-left text-xs font-semibold text-[#52617A]">
            <th className="px-5 py-3">Dataset</th>
            <th className="px-5 py-3">Rows</th>
            <th className="px-5 py-3">Readiness</th>
            <th className="px-5 py-3">Last profiled</th>
            <th className="px-5 py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {datasets.map((dataset) => (
            <tr key={dataset.id} className="border-b border-[#EEF2F7] last:border-b-0">
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <Grid3X3 className="h-4 w-4 text-[#64748B]" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-[#0F172A]">{dataset.displayName}</p>
                    <p className="text-xs text-[#64748B]">{dataset.name}</p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-3 font-medium text-[#0F172A]">
                {formatNumber(dataset.rowCount)}
              </td>
              <td className="px-5 py-3">
                <ReadinessPill value={dataset.semanticCoverage} />
              </td>
              <td className="px-5 py-3 text-[#52617A]">{dataset.freshness}</td>
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <Link
                    href={`/app/data-sources/${sourceId}/datasets/${dataset.id}`}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
                  >
                    Inspect
                    <MoveRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <button
                    type="button"
                    disabled={creatingSemanticModel || !semanticModelSupported}
                    onClick={() => onCreateSemanticModel(dataset)}
                    className="text-sm font-semibold text-[#334155] hover:text-[#2563EB] disabled:opacity-50"
                  >
                    Model
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SchemaPreview({
  dataset,
  columns,
  onCreateSemanticModel,
  creatingSemanticModel,
  semanticModelSupported,
}: {
  dataset: MetricMindDataset | null;
  columns: DatasetColumn[];
  onCreateSemanticModel: () => void;
  creatingSemanticModel: boolean;
  semanticModelSupported: boolean;
}) {
  if (!dataset) {
    return (
      <section className="rounded-lg border border-[#E5E7EB] bg-white p-6 shadow-sm shadow-slate-200/70">
        <p className="text-sm text-[#64748B]">No dataset is available for schema preview.</p>
      </section>
    );
  }

  return (
    <section className="min-w-0 rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm shadow-slate-200/70">
      <div className="flex flex-col gap-4 border-b border-[#E5E7EB] pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#52617A]">Dataset schema</p>
          <h2 className="mt-1 text-xl font-bold text-[#0F172A]">{dataset.displayName}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-[#E5E7EB] px-3 py-1 text-xs font-semibold text-[#52617A]">
              {dataset.columnCount} columns
            </span>
            <span className="rounded-full border border-[#E5E7EB] px-3 py-1 text-xs font-semibold text-[#52617A]">
              {formatNumber(dataset.rowCount)} rows
            </span>
            <ReadinessPill value={dataset.semanticCoverage} />
          </div>
        </div>
        <Button
          type="button"
          onClick={onCreateSemanticModel}
          disabled={creatingSemanticModel || !semanticModelSupported}
          className="gap-2"
        >
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          {creatingSemanticModel ? "Creating model" : "Create semantic model"}
        </Button>
      </div>

      <div className="mt-5">
        <SemanticSuggestionsCard
          suggestions={dataset.semanticSuggestions}
          onApplySuggestion={onCreateSemanticModel}
        />
      </div>

      <div className="mt-5">
        <ColumnSchemaTable columns={columns} />
      </div>
    </section>
  );
}

export function DataSourceDetailPage({
  initialData,
  sourceId,
  syncDataSourceAction,
  createSemanticModelFromDatasetAction,
}: DataSourceDetailPageProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pageData, setPageData] = useState(initialData);
  const [syncing, setSyncing] = useState(false);
  const [creatingSemanticModel, setCreatingSemanticModel] = useState(false);

  const source = sourceById(pageData, sourceId);
  const sourceDatasets = useMemo(
    () => datasetsForSource(pageData, sourceId),
    [pageData, sourceId]
  );
  const sourceIssues = useMemo(
    () => issuesForSource(pageData, sourceId),
    [pageData, sourceId]
  );
  const sourceSyncRuns = useMemo(
    () => syncRunsForSource(pageData, sourceId),
    [pageData, sourceId]
  );
  const primaryDataset = sourceDatasets[0] ?? null;
  const primaryColumns = columnsForDataset(pageData, primaryDataset?.id ?? null);
  const [activeTab, setActiveTab] = useState("overview");

  if (!source) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-[#E5E7EB] bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-[#0F172A]">Data source not found</h1>
        <p className="text-sm text-[#64748B]">
          This source is not available in the current workspace.
        </p>
        <Button asChild variant="outline" className="w-fit">
          <Link href="/app/data-sources">Back to Data Sources</Link>
        </Button>
      </div>
    );
  }

  const selectedSource = source;
  const semanticModelSupported = supportsSemanticModel(selectedSource.type);

  async function handleSyncNow() {
    if (!pageData.workspaceId) {
      toast({
        title: "Workspace required",
        description: "Sign in and select a workspace before syncing data sources.",
      });
      return;
    }

    setSyncing(true);
    const result = await syncDataSourceAction({
      workspaceId: pageData.workspaceId,
      dataSourceId: selectedSource.id,
    });
    setSyncing(false);

    if (!result.ok) {
      toast({ title: "Sync failed", description: result.error });
      return;
    }

    if (hasPageData(result.data)) {
      setPageData(result.data.pageData);
    }
    router.refresh();
    toast({
      title: "Sync complete",
      description: `${selectedSource.name} metadata was refreshed.`,
    });
  }

  async function handleCreateSemanticModel(dataset = primaryDataset) {
    if (!semanticModelSupported) {
      toast({
        title: "Semantic model unavailable",
        description:
          "External connectors currently support live metadata and samples. Full semantic modeling requires ingestion or live query execution.",
      });
      return;
    }

    if (!dataset || !pageData.workspaceId) {
      toast({
        title: "Dataset required",
        description: "Choose a profiled dataset before creating a semantic model.",
      });
      return;
    }

    setCreatingSemanticModel(true);
    const result = await createSemanticModelFromDatasetAction({
      workspaceId: pageData.workspaceId,
      datasetId: dataset.id,
    });
    setCreatingSemanticModel(false);

    if (!result.ok) {
      toast({ title: "Semantic model failed", description: result.error });
      return;
    }

    toast({
      title: "Semantic model created",
      description: `${dataset.displayName} is ready in the semantic layer workspace.`,
    });
    router.push("/app/semantic-layer");
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="border-b border-[#E5E7EB] pb-6">
        <nav className="mb-5 flex items-center gap-2 text-sm font-medium text-[#64748B]">
          <Link href="/app" className="hover:text-[#2563EB]">Home</Link>
          <span>/</span>
          <Link href="/app/data-sources" className="hover:text-[#2563EB]">Data Sources</Link>
          <span>/</span>
          <span className="text-[#334155]">{selectedSource.name}</span>
        </nav>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-[#DBEAFE] bg-white text-[#2563EB] shadow-sm">
              <SourceIcon type={selectedSource.type} />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-normal text-[#0F172A]">
                {selectedSource.name}
              </h1>
              <p className="mt-1 text-sm text-[#52617A]">
                Inspect datasets, schema, sync health, and prepare data for semantic modeling.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="gap-2">
              <Link href="/app/data-sources">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to sources
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleSyncNow}
              disabled={syncing}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} aria-hidden="true" />
              {syncing ? "Syncing" : "Sync now"}
            </Button>
            <Button
              type="button"
              onClick={() => handleCreateSemanticModel()}
              disabled={!primaryDataset || creatingSemanticModel || !semanticModelSupported}
              className="gap-2"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Create semantic model
            </Button>
          </div>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-6">
        <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-none border-b border-[#E5E7EB] bg-transparent p-0">
          {[
            ["overview", "Overview"],
            ["datasets", "Datasets"],
            ["schema", "Schema"],
            ["sync-history", "Sync history"],
            ["settings", "Settings"],
          ].map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              onMouseDown={(event) => {
                if (event.button === 0 && !event.ctrlKey) {
                  setActiveTab(value);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  setActiveTab(value);
                }
              }}
              onClick={() => setActiveTab(value)}
              className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-semibold text-[#52617A] shadow-none data-[state=active]:border-[#2563EB] data-[state=active]:bg-transparent data-[state=active]:text-[#2563EB] data-[state=active]:shadow-none"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
            <section className="min-w-0 rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm shadow-slate-200/70">
              <h2 className="text-lg font-bold text-[#0F172A]">Source health</h2>
              <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr_1fr]">
                <div className="flex flex-col gap-5">
                  <StatusBadge status={selectedSource.status} />
                  <div className="flex items-center gap-3 text-sm text-[#52617A]">
                    <Database className="h-4 w-4 text-[#64748B]" aria-hidden="true" />
                    {selectedSource.category}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#64748B]">Owner</p>
                    <p className="mt-1 text-sm font-semibold text-[#0F172A]">
                      {selectedSource.owner}
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 border-y border-[#E5E7EB] py-4 lg:border-x lg:border-y-0 lg:px-5 lg:py-0">
                  <div>
                    <p className="flex items-center gap-2 text-xs font-semibold text-[#64748B]">
                      <Clock className="h-4 w-4" aria-hidden="true" />
                      Last sync
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[#0F172A]">
                      {formatDateTime(selectedSource.lastSyncedAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#64748B]">Rows synced</p>
                    <p className="mt-2 text-lg font-bold text-[#0F172A]">
                      {formatCompact(selectedSource.rowCount)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  {[
                    "Connection verified",
                    "Metadata synced",
                    "Schema profiled",
                    sourceIssues.length === 0 ? "No schema drift detected" : "Issues need review",
                  ].map((item) => (
                    <p key={item} className="flex items-center gap-2 text-sm font-medium text-[#334155]">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            </section>

            <SchemaPreview
              dataset={primaryDataset}
              columns={primaryColumns}
              onCreateSemanticModel={() => handleCreateSemanticModel()}
              creatingSemanticModel={creatingSemanticModel}
              semanticModelSupported={semanticModelSupported}
            />
          </div>

          <section className="mt-6 min-w-0 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-sm shadow-slate-200/70">
            <div className="border-b border-[#E5E7EB] p-5">
              <h2 className="text-lg font-bold text-[#0F172A]">Datasets in this source</h2>
            </div>
            <DatasetRows
              datasets={sourceDatasets}
              sourceId={selectedSource.id}
              onCreateSemanticModel={handleCreateSemanticModel}
              creatingSemanticModel={creatingSemanticModel}
              semanticModelSupported={semanticModelSupported}
            />
          </section>
        </TabsContent>

        <TabsContent value="datasets" className="mt-0 min-w-0 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-sm shadow-slate-200/70">
          <DatasetRows
            datasets={sourceDatasets}
            sourceId={selectedSource.id}
            onCreateSemanticModel={handleCreateSemanticModel}
            creatingSemanticModel={creatingSemanticModel}
            semanticModelSupported={semanticModelSupported}
          />
        </TabsContent>

        <TabsContent value="schema" className="mt-0">
          <SchemaPreview
            dataset={primaryDataset}
            columns={primaryColumns}
            onCreateSemanticModel={() => handleCreateSemanticModel()}
            creatingSemanticModel={creatingSemanticModel}
            semanticModelSupported={semanticModelSupported}
          />
        </TabsContent>

        <TabsContent value="sync-history" className="mt-0">
          <SyncHistoryTable syncRuns={sourceSyncRuns} />
        </TabsContent>

        <TabsContent value="settings" className="mt-0">
          <div className="rounded-lg border border-[#E5E7EB] bg-white p-6 shadow-sm shadow-slate-200/70">
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />
              <h2 className="text-lg font-bold text-[#0F172A]">Source settings</h2>
            </div>
            <dl className="mt-5 grid gap-4 md:grid-cols-2">
              {[
                ["Provider", selectedSource.provider],
                ["Category", selectedSource.category],
                ["Region", selectedSource.region],
                ["Connector version", selectedSource.connectorVersion],
                ["Credential status", selectedSource.credentialStatus],
                [
                  "Next sync",
                  selectedSource.nextSyncAt
                    ? formatDateTime(selectedSource.nextSyncAt)
                    : "Manual",
                ],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                  <dt className="text-xs font-semibold text-[#64748B]">{label}</dt>
                  <dd className="mt-1 text-sm font-semibold text-[#0F172A]">{value}</dd>
                </div>
              ))}
            </dl>
            <SourceHealthChecklist source={selectedSource} issues={sourceIssues} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
