"use client";

import { useEffect, useMemo, useState } from "react";
import { PlugZap } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ConnectorGalleryDialog } from "./connector-gallery-dialog";
import { CsvUploadDialog } from "./csv-upload-dialog";
import { DataSourceGuidePanel } from "./data-source-guide-panel";
import { DataSourceGrid } from "./data-source-grid";
import { DataSourceSummaryCards } from "./data-source-summary-cards";
import {
  DataSourceToolbar,
  type DataSourceStatusFilter,
} from "./data-source-toolbar";
import { RecentDatasetsTable } from "./recent-datasets-table";
import { recentDatasets } from "./data-source-view-model";
import type {
  ActionResult,
  ConnectorGalleryItem,
  DataSourcesPageData,
  MetricMindDataSource,
  MetricMindDataset,
} from "@/lib/data-sources/types";

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

const emptyPageData: DataSourcesPageData = {
  workspaceId: null,
  role: null,
  sources: [],
  datasets: [],
  columnsByDatasetId: {},
  issues: [],
  syncRuns: [],
};

const workingConnectors: ConnectorGalleryItem[] = [
  {
    id: "connector-csv",
    name: "CSV Upload",
    provider: "File",
    category: "Upload",
    description: "Upload CSV files for backend profiling and semantic modeling.",
    setupTime: "2 min",
    availability: "available",
    recommendedFor: "Board packs and one-off analysis",
  },
  {
    id: "connector-demo-saas",
    name: "Demo SaaS Dataset",
    provider: "MetricMind",
    category: "Demo",
    description: "Create deterministic SaaS datasets in this workspace for evaluation.",
    setupTime: "1 min",
    availability: "available",
    recommendedFor: "Evaluation workspaces",
  },
];

function buildDatasetMap(datasets: MetricMindDataset[]) {
  const map = new Map<string, MetricMindDataset[]>();
  for (const dataset of datasets) {
    const sourceDatasets = map.get(dataset.sourceId) ?? [];
    sourceDatasets.push(dataset);
    map.set(dataset.sourceId, sourceDatasets);
  }
  return map;
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
  initialData = emptyPageData,
  createDemoDataSourceAction,
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
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [connectorDialogOpen, setConnectorDialogOpen] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [creatingDemo, setCreatingDemo] = useState(false);

  const workspaceId = initialData.workspaceId;

  function applyPageData(pageData: DataSourcesPageData) {
    setSources(pageData.sources);
    setDatasets(pageData.datasets);
    setColumnsByDatasetId(pageData.columnsByDatasetId);
    setIssues(pageData.issues);
    setSyncRuns(pageData.syncRuns);
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

  const recentProfiledDatasets = useMemo(
    () =>
      recentDatasets(
        {
          workspaceId,
          role: initialData.role,
          sources,
          datasets,
          columnsByDatasetId,
          issues,
          syncRuns,
        },
        4
      ),
    [columnsByDatasetId, datasets, initialData.role, issues, sources, syncRuns, workspaceId]
  );

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
      title: `${connector.name} is not enabled`,
      description: "Only CSV upload and demo dataset creation are available in this build.",
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
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <nav className="mb-4 flex items-center gap-2 text-sm font-medium text-[#64748B]">
            <span>Home</span>
            <span>/</span>
            <span className="text-[#334155]">Data Sources</span>
          </nav>
          <h1 className="text-4xl font-bold tracking-normal text-[#0F172A]">
            Data Sources
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#4B5563]">
            Manage CSV uploads and demo datasets backed by workspace storage. Profile
            schemas, review sync health, and turn trusted datasets into AI-ready semantic
            models.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
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

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-4">
          <DataSourceToolbar
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            totalCount={sources.length}
            filteredCount={filteredSources.length}
            onSearchChange={setSearchQuery}
            onStatusFilterChange={setStatusFilter}
          />
        </div>
        <DataSourceGrid
          sources={filteredSources}
          hasActiveFilters={searchQuery.trim().length > 0 || statusFilter !== "all"}
        />
      </section>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.95fr)]">
        <RecentDatasetsTable datasets={recentProfiledDatasets} sources={sources} />
        <DataSourceGuidePanel hasSources={sources.length > 0} />
      </div>

      <CsvUploadDialog
        open={csvDialogOpen}
        onOpenChange={setCsvDialogOpen}
        onUpload={handleCsvUpload}
        uploading={uploadingCsv}
      />
      <ConnectorGalleryDialog
        open={connectorDialogOpen}
        connectors={workingConnectors}
        onOpenChange={setConnectorDialogOpen}
        onConnect={handleConnect}
      />
    </div>
  );
}
