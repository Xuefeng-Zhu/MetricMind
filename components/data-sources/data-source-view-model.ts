import type {
  DataSourceIssue,
  DataSourcesPageData,
  DatasetColumn,
  MetricMindDataSource,
  MetricMindDataset,
  SyncRun,
} from "@/lib/data-sources/types";

export function sourceById(
  pageData: DataSourcesPageData,
  sourceId: string
): MetricMindDataSource | null {
  return pageData.sources.find((source) => source.id === sourceId) ?? null;
}

export function datasetsForSource(
  pageData: DataSourcesPageData,
  sourceId: string
): MetricMindDataset[] {
  return pageData.datasets.filter((dataset) => dataset.sourceId === sourceId);
}

export function datasetById(
  pageData: DataSourcesPageData,
  datasetId: string
): MetricMindDataset | null {
  return pageData.datasets.find((dataset) => dataset.id === datasetId) ?? null;
}

export function columnsForDataset(
  pageData: DataSourcesPageData,
  datasetId: string | null
): DatasetColumn[] {
  if (!datasetId) return [];
  return pageData.columnsByDatasetId[datasetId] ?? [];
}

export function issuesForSource(
  pageData: DataSourcesPageData,
  sourceId: string
): DataSourceIssue[] {
  return pageData.issues.filter((issue) => issue.sourceId === sourceId);
}

export function syncRunsForSource(
  pageData: DataSourcesPageData,
  sourceId: string
): SyncRun[] {
  return pageData.syncRuns.filter((run) => run.sourceId === sourceId);
}

export function recentDatasets(
  pageData: DataSourcesPageData,
  limit = 4
): MetricMindDataset[] {
  return [...pageData.datasets]
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    )
    .slice(0, limit);
}

export function sourceForDataset(
  pageData: DataSourcesPageData,
  dataset: MetricMindDataset
): MetricMindDataSource | null {
  return sourceById(pageData, dataset.sourceId);
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en").format(value);
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

