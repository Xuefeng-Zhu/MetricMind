"use client";

import { useEffect, useMemo, useState } from "react";
import { PlugZap, RefreshCw, Upload } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ConnectorGalleryDialog } from "./connector-gallery-dialog";
import { CsvUploadDialog } from "./csv-upload-dialog";
import { DataSourceGrid } from "./data-source-grid";
import { DataSourceSummaryCards } from "./data-source-summary-cards";
import {
  DataSourceToolbar,
  type DataSourceStatusFilter,
} from "./data-source-toolbar";
import { DatasetTable } from "./dataset-table";
import { SchemaPreviewPanel } from "./schema-preview-panel";
import { SyncHistoryTable } from "./sync-history-table";
import {
  connectorGallery,
  dataSources as mockDataSources,
  type ConnectorGalleryItem,
  type MetricMindDataSource,
} from "@/lib/mock-data/data-sources";
import { dataSourceIssues } from "@/lib/mock-data/data-source-issues";
import { datasetColumns } from "@/lib/mock-data/dataset-columns";
import {
  datasets as mockDatasets,
  type MetricMindDataset,
  type SemanticSuggestion,
} from "@/lib/mock-data/datasets";
import { syncRuns as mockSyncRuns } from "@/lib/mock-data/sync-runs";
import type { ActionResult, DataSourcesPageData } from "@/lib/data-sources/types";

type PageDataActionPayload = {
  pageData?: DataSourcesPageData;
};

interface DataSourcesPageProps {
  initialData?: DataSourcesPageData;
  createDemoDataSourceAction?: (input: {
    workspaceId: string;
  }) => Promise<ActionResult<PageDataActionPayload>>;
  syncDataSourceAction?: (input: {
    workspaceId: string;
    dataSourceId: string;
  }) => Promise<ActionResult<PageDataActionPayload>>;
  createSemanticModelFromDatasetAction?: (input: {
    workspaceId: string;
    datasetId: string;
  }) => Promise<ActionResult<{ modelId: string; entityId: string; metricIds: string[] }>>;
}

const fallbackPageData: DataSourcesPageData = {
  workspaceId: null,
  role: null,
  sources: mockDataSources,
  datasets: mockDatasets,
  columnsByDatasetId: datasetColumns,
  issues: dataSourceIssues,
  syncRuns: mockSyncRuns,
};

function buildDatasetMap(datasets: MetricMindDataset[]) {
  const map = new Map<string, MetricMindDataset[]>();
  for (const dataset of datasets) {
    const sourceDatasets = map.get(dataset.sourceId) ?? [];
    sourceDatasets.push(dataset);
    map.set(dataset.sourceId, sourceDatasets);
  }
  return map;
}

function firstDatasetForSource(
  datasets: MetricMindDataset[],
  sourceId: string | null
): string | null {
  if (!sourceId) {
    return null;
  }

  return datasets.find((dataset) => dataset.sourceId === sourceId)?.id ?? null;
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

function matchesStatusFilter(
  source: MetricMindDataSource,
  statusFilter: DataSourceStatusFilter
): boolean {
  if (statusFilter === "all") {
    return true;
  }

  if (statusFilter === "paused") {
    return source.syncStatus === "paused";
  }

  return source.status === statusFilter;
}

function buildSearchText(
  source: MetricMindDataSource,
  sourceDatasets: MetricMindDataset[]
): string {
  return [
    source.name,
    source.provider,
    source.category,
    source.owner,
    source.description,
    source.tags.join(" "),
    ...sourceDatasets.flatMap((dataset) => [
      dataset.name,
      dataset.displayName,
      dataset.description,
      dataset.owner,
    ]),
  ]
    .join(" ")
    .toLowerCase();
}

export function DataSourcesPage({
  initialData = fallbackPageData,
  createDemoDataSourceAction,
  syncDataSourceAction,
  createSemanticModelFromDatasetAction,
}: DataSourcesPageProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [sources, setSources] = useState(initialData.sources);
  const [datasets, setDatasets] = useState(initialData.datasets);
  const [columnsByDatasetId, setColumnsByDatasetId] = useState(
    initialData.columnsByDatasetId
  );
  const [issues, setIssues] = useState(initialData.issues);
  const [syncRuns, setSyncRuns] = useState(initialData.syncRuns);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DataSourceStatusFilter>("all");
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(
    initialData.sources[0]?.id ?? null
  );
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(
    firstDatasetForSource(initialData.datasets, initialData.sources[0]?.id ?? null)
  );
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [connectorDialogOpen, setConnectorDialogOpen] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null);
  const [creatingDemo, setCreatingDemo] = useState(false);
  const [creatingSemanticModel, setCreatingSemanticModel] = useState(false);

  const workspaceId = initialData.workspaceId;

  function applyPageData(pageData: DataSourcesPageData) {
    setSources(pageData.sources);
    setDatasets(pageData.datasets);
    setColumnsByDatasetId(pageData.columnsByDatasetId);
    setIssues(pageData.issues);
    setSyncRuns(pageData.syncRuns);
    setSelectedSourceId((currentSourceId) => {
      if (currentSourceId && pageData.sources.some((source) => source.id === currentSourceId)) {
        return currentSourceId;
      }
      return pageData.sources[0]?.id ?? null;
    });
    setSelectedDatasetId((currentDatasetId) => {
      if (
        currentDatasetId &&
        pageData.datasets.some((dataset) => dataset.id === currentDatasetId)
      ) {
        return currentDatasetId;
      }
      return firstDatasetForSource(pageData.datasets, pageData.sources[0]?.id ?? null);
    });
  }

  useEffect(() => {
    applyPageData(initialData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]);

  const datasetsBySource = useMemo(() => buildDatasetMap(datasets), [datasets]);

  const filteredSources = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return sources.filter((source) => {
      if (!matchesStatusFilter(source, statusFilter)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const sourceDatasets = datasetsBySource.get(source.id) ?? [];
      return buildSearchText(source, sourceDatasets).includes(normalizedQuery);
    });
  }, [datasetsBySource, searchQuery, sources, statusFilter]);

  useEffect(() => {
    if (filteredSources.length === 0) {
      return;
    }

    if (!selectedSourceId || !filteredSources.some((source) => source.id === selectedSourceId)) {
      setSelectedSourceId(filteredSources[0].id);
    }
  }, [filteredSources, selectedSourceId]);

  const selectedSource =
    filteredSources.find((source) => source.id === selectedSourceId) ??
    filteredSources[0] ??
    null;

  const selectedSourceDatasets = useMemo(() => {
    if (!selectedSource) {
      return [];
    }
    return datasetsBySource.get(selectedSource.id) ?? [];
  }, [datasetsBySource, selectedSource]);

  useEffect(() => {
    if (selectedSourceDatasets.length === 0) {
      if (selectedDatasetId !== null) {
        setSelectedDatasetId(null);
      }
      return;
    }

    if (
      !selectedDatasetId ||
      !selectedSourceDatasets.some((dataset) => dataset.id === selectedDatasetId)
    ) {
      setSelectedDatasetId(selectedSourceDatasets[0].id);
    }
  }, [selectedDatasetId, selectedSourceDatasets]);

  const selectedDataset =
    selectedSourceDatasets.find((dataset) => dataset.id === selectedDatasetId) ??
    selectedSourceDatasets[0] ??
    null;

  const selectedColumns = selectedDataset
    ? columnsByDatasetId[selectedDataset.id] ?? []
    : [];
  const selectedIssues = selectedSource
    ? issues.filter((issue) => issue.sourceId === selectedSource.id)
    : [];
  const selectedSyncRuns = selectedSource
    ? syncRuns.filter((run) => run.sourceId === selectedSource.id)
    : [];

  async function handleSyncNow() {
    if (!selectedSource) {
      return;
    }

    if (!workspaceId || !syncDataSourceAction) {
      setSources((currentSources) =>
        currentSources.map((source) =>
          source.id === selectedSource.id
            ? {
                ...source,
                status: "syncing",
                syncStatus: "syncing",
                lastSyncedAt: new Date().toISOString(),
              }
            : source
        )
      );

      toast({
        title: "Mock sync started",
        description: `${selectedSource.name} is running a simulated metadata refresh.`,
      });
      return;
    }

    setSyncingSourceId(selectedSource.id);
    setSources((currentSources) =>
      currentSources.map((source) =>
        source.id === selectedSource.id
          ? {
              ...source,
              status: "syncing",
              syncStatus: "syncing",
              lastSyncedAt: new Date().toISOString(),
            }
          : source
      )
    );

    const result = await syncDataSourceAction({
      workspaceId,
      dataSourceId: selectedSource.id,
    });
    setSyncingSourceId(null);

    if (!result.ok) {
      toast({
        title: "Sync failed",
        description: result.error,
      });
      router.refresh();
      return;
    }

    if (hasPageData(result.data)) {
      applyPageData(result.data.pageData);
    }
    router.refresh();
    toast({
      title: "Sync complete",
      description: `${selectedSource.name} metadata was refreshed.`,
    });
  }

  async function handleCreateSemanticModel() {
    if (!selectedDataset) {
      return;
    }

    if (!workspaceId || !createSemanticModelFromDatasetAction) {
      const subject = selectedDataset.displayName ?? selectedSource?.name ?? "Selected dataset";
      toast({
        title: "Semantic model draft created",
        description: `${subject} is ready for review in the semantic layer workspace.`,
      });
      return;
    }

    setCreatingSemanticModel(true);
    const result = await createSemanticModelFromDatasetAction({
      workspaceId,
      datasetId: selectedDataset.id,
    });
    setCreatingSemanticModel(false);

    if (!result.ok) {
      toast({
        title: "Semantic model failed",
        description: result.error,
      });
      return;
    }

    const subject = selectedDataset?.displayName ?? selectedSource?.name ?? "Selected dataset";
    toast({
      title: "Semantic model created",
      description: `${subject} is ready for review in the semantic layer workspace.`,
    });
    router.push("/app/semantic-layer");
  }

  function handleApplySuggestion(suggestion: SemanticSuggestion) {
    toast({
      title: suggestion.title,
      description: `${suggestion.actionLabel} queued as a mock semantic-layer action.`,
    });
  }

  async function handleConnect(connector: ConnectorGalleryItem) {
    if (connector.id === "connector-csv") {
      setConnectorDialogOpen(false);
      setCsvDialogOpen(true);
      return;
    }

    if (connector.id === "connector-demo-saas") {
      if (!workspaceId || !createDemoDataSourceAction) {
        toast({
          title: "Demo source selected",
          description: "The demo connector is available once a workspace is loaded.",
        });
        setConnectorDialogOpen(false);
        return;
      }

      setCreatingDemo(true);
      const result = await createDemoDataSourceAction({ workspaceId });
      setCreatingDemo(false);
      setConnectorDialogOpen(false);

      if (!result.ok) {
        toast({
          title: "Demo source failed",
          description: result.error,
        });
        return;
      }

      if (hasPageData(result.data)) {
        applyPageData(result.data.pageData);
      }
      router.refresh();
      toast({
        title: "Demo source connected",
        description: "Demo SaaS datasets are ready for schema inspection.",
      });
      return;
    }

    toast({
      title:
        connector.availability === "connected"
          ? `${connector.name} reconnect flow opened`
          : `${connector.name} connector selected`,
      description: "This connector is mocked for now. Demo and CSV flows use the backend.",
    });
    setConnectorDialogOpen(false);
  }

  async function handleCsvUpload(file: File) {
    if (!workspaceId) {
      toast({
        title: "Workspace required",
        description: "Sign in and select a workspace before uploading CSV files.",
      });
      return;
    }

    setUploadingCsv(true);
    const formData = new FormData();
    formData.set("workspaceId", workspaceId);
    formData.set("file", file);

    try {
      const response = await fetch("/api/data-sources/upload-csv", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        message?: string;
        pageData?: DataSourcesPageData;
        dataset?: { display_name?: string; displayName?: string };
      };

      if (!response.ok) {
        throw new Error(payload.message ?? "CSV upload failed.");
      }

      if (payload.pageData) {
        applyPageData(payload.pageData);
      }

      setCsvDialogOpen(false);
      router.refresh();
      toast({
        title: "CSV profiled",
        description: `${file.name} was uploaded and profiled.`,
      });
    } catch (error) {
      toast({
        title: "CSV upload failed",
        description: error instanceof Error ? error.message : "CSV upload failed.",
      });
    } finally {
      setUploadingCsv(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-normal text-[#111827]">
            Data Sources
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#4B5563]">
            Manage connected warehouses, SaaS tools, and CSV uploads. Profile schemas,
            review sync health, and turn trusted datasets into AI-ready semantic models.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleSyncNow}
            disabled={!selectedSource || Boolean(syncingSourceId)}
            className="gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${syncingSourceId ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {syncingSourceId ? "Syncing" : "Sync now"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setCsvDialogOpen(true)}
            className="gap-2"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            Upload CSV
          </Button>
          <Button
            type="button"
            onClick={() => setConnectorDialogOpen(true)}
            disabled={creatingDemo}
            className="gap-2"
          >
            <PlugZap className="h-4 w-4" aria-hidden="true" />
            Connect source
          </Button>
        </div>
      </header>

      <DataSourceSummaryCards
        sources={sources}
        datasets={datasets}
        issues={issues}
      />

      <DataSourceToolbar
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        totalCount={sources.length}
        filteredCount={filteredSources.length}
        onSearchChange={setSearchQuery}
        onStatusFilterChange={setStatusFilter}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-6">
          <DataSourceGrid
            sources={filteredSources}
            selectedSourceId={selectedSource?.id ?? null}
            onSelectSource={setSelectedSourceId}
          />
          <DatasetTable
            datasets={selectedSourceDatasets}
            selectedDatasetId={selectedDataset?.id ?? null}
            sourceName={selectedSource?.name ?? null}
            onSelectDataset={setSelectedDatasetId}
            onCreateSemanticModel={handleCreateSemanticModel}
            creatingSemanticModel={creatingSemanticModel}
          />
          <SyncHistoryTable syncRuns={selectedSyncRuns} />
        </div>

        <SchemaPreviewPanel
          source={selectedSource}
          dataset={selectedDataset}
          columns={selectedColumns}
          issues={selectedIssues}
          onApplySuggestion={handleApplySuggestion}
          onCreateSemanticModel={handleCreateSemanticModel}
          creatingSemanticModel={creatingSemanticModel}
        />
      </div>

      <CsvUploadDialog
        open={csvDialogOpen}
        onOpenChange={setCsvDialogOpen}
        onUpload={handleCsvUpload}
        uploading={uploadingCsv}
      />
      <ConnectorGalleryDialog
        open={connectorDialogOpen}
        connectors={connectorGallery}
        onOpenChange={setConnectorDialogOpen}
        onConnect={handleConnect}
      />
    </div>
  );
}
