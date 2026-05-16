"use client";

import { useEffect, useMemo, useState } from "react";
import { PlugZap, RefreshCw, Upload } from "lucide-react";

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
import { datasets as mockDatasets, type MetricMindDataset, type SemanticSuggestion } from "@/lib/mock-data/datasets";
import { syncRuns as mockSyncRuns } from "@/lib/mock-data/sync-runs";

function buildDatasetMap(datasets: MetricMindDataset[]) {
  const map = new Map<string, MetricMindDataset[]>();
  for (const dataset of datasets) {
    const sourceDatasets = map.get(dataset.sourceId) ?? [];
    sourceDatasets.push(dataset);
    map.set(dataset.sourceId, sourceDatasets);
  }
  return map;
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

export function DataSourcesPage() {
  const { toast } = useToast();
  const [sources, setSources] = useState(mockDataSources);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DataSourceStatusFilter>("all");
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(
    mockDataSources[0]?.id ?? null
  );
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(
    mockDatasets.find((dataset) => dataset.sourceId === mockDataSources[0]?.id)?.id ?? null
  );
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [connectorDialogOpen, setConnectorDialogOpen] = useState(false);

  const datasetsBySource = useMemo(() => buildDatasetMap(mockDatasets), []);

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

  const selectedColumns = selectedDataset ? datasetColumns[selectedDataset.id] ?? [] : [];
  const selectedIssues = selectedSource
    ? dataSourceIssues.filter((issue) => issue.sourceId === selectedSource.id)
    : [];
  const selectedSyncRuns = selectedSource
    ? mockSyncRuns.filter((run) => run.sourceId === selectedSource.id)
    : [];

  function handleSyncNow() {
    if (!selectedSource) {
      return;
    }

    setSources((currentSources) =>
      currentSources.map((source) =>
        source.id === selectedSource.id
          ? {
              ...source,
              status: "syncing",
              syncStatus: "syncing",
              lastSyncedAt: "2026-05-15T15:00:00-07:00",
            }
          : source
      )
    );

    toast({
      title: "Mock sync started",
      description: `${selectedSource.name} is running a simulated metadata refresh.`,
    });
  }

  function handleCreateSemanticModel() {
    const subject = selectedDataset?.displayName ?? selectedSource?.name ?? "Selected dataset";
    toast({
      title: "Semantic model draft created",
      description: `${subject} is ready for review in the semantic layer workspace.`,
    });
  }

  function handleApplySuggestion(suggestion: SemanticSuggestion) {
    toast({
      title: suggestion.title,
      description: `${suggestion.actionLabel} queued as a mock semantic-layer action.`,
    });
  }

  function handleConnect(connector: ConnectorGalleryItem) {
    toast({
      title:
        connector.availability === "connected"
          ? `${connector.name} reconnect flow opened`
          : `${connector.name} connector selected`,
      description: "This is a mock connector gallery. No backend connection was created.",
    });
    setConnectorDialogOpen(false);
  }

  function handleCsvUpload(fileName: string) {
    setSources((currentSources) =>
      currentSources.map((source) =>
        source.id === "source-csv-board-metrics"
          ? {
              ...source,
              status: "syncing",
              syncStatus: "syncing",
              lastSyncedAt: "2026-05-15T15:00:00-07:00",
            }
          : source
      )
    );

    toast({
      title: "CSV profiling queued",
      description: `${fileName} will be profiled with mock schema and semantic suggestions.`,
    });
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
            disabled={!selectedSource}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Sync now
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
            className="gap-2"
          >
            <PlugZap className="h-4 w-4" aria-hidden="true" />
            Connect source
          </Button>
        </div>
      </header>

      <DataSourceSummaryCards
        sources={sources}
        datasets={mockDatasets}
        issues={dataSourceIssues}
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
        />
      </div>

      <CsvUploadDialog
        open={csvDialogOpen}
        onOpenChange={setCsvDialogOpen}
        onUpload={handleCsvUpload}
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
