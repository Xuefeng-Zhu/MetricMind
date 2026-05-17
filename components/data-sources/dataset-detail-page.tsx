"use client";

import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Database,
  FileText,
  KeyRound,
  Layers3,
  ShieldCheck,
  Sparkles,
  Table2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type {
  ActionResult,
  ColumnSemanticRole,
  DataSourcesPageData,
  DatasetColumn,
  MetricMindDataSource,
  SemanticSuggestion,
} from "@/lib/data-sources/types";
import {
  columnsForDataset,
  datasetById,
  formatNumber,
  sourceById,
} from "./data-source-view-model";
import { SemanticSuggestionsCard } from "./semantic-suggestions-card";

interface DatasetDetailPageProps {
  initialData: DataSourcesPageData;
  sourceId: string;
  datasetId: string;
  createSemanticModelFromDatasetAction: (input: {
    workspaceId: string;
    datasetId: string;
  }) => Promise<ActionResult<{ modelId: string; entityId: string; metricIds: string[] }>>;
}

const roleStyles: Record<ColumnSemanticRole, string> = {
  primary_key: "bg-slate-900 text-white",
  foreign_key: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  dimension: "bg-blue-50 text-blue-700 ring-blue-200",
  measure: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  timestamp: "bg-amber-50 text-amber-700 ring-amber-200",
  pii: "bg-red-50 text-red-700 ring-red-200",
};

function formatRole(role: ColumnSemanticRole): string {
  return role.replace("_", " ");
}

function readinessClassName(value: number): string {
  if (value >= 90) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (value >= 75) return "bg-blue-50 text-blue-700 ring-blue-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
}

function supportsSemanticModel(type: MetricMindDataSource["type"]) {
  return type === "csv" || type === "demo";
}

function ColumnStats({ columns }: { columns: DatasetColumn[] }) {
  const requiredCount = columns.filter((column) => !column.nullable).length;
  const measureCount = columns.filter((column) => column.semanticRole === "measure").length;
  const piiCount = columns.filter((column) => column.semanticRole === "pii").length;

  return (
    <section
      aria-label="Dataset schema summary"
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
    >
      {[
        { label: "Columns", value: String(columns.length), icon: Table2 },
        { label: "Required fields", value: String(requiredCount), icon: KeyRound },
        { label: "Measures", value: String(measureCount), icon: Layers3 },
        { label: "PII fields", value: String(piiCount), icon: ShieldCheck },
      ].map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm shadow-slate-200/70"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#52617A]">{item.label}</p>
                <p className="mt-2 text-2xl font-bold text-[#0F172A]">{item.value}</p>
              </div>
              <div className="rounded-full bg-[#EFF6FF] p-3 text-[#2563EB]">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function SchemaDetailTable({ columns }: { columns: DatasetColumn[] }) {
  if (columns.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-white p-8 text-sm text-[#64748B]">
        No schema columns are available for this dataset yet.
      </div>
    );
  }

  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-max min-w-full text-sm">
        <thead>
          <tr className="border-b border-[#E5E7EB] text-left text-xs font-semibold text-[#52617A]">
            <th className="px-5 py-3">Field</th>
            <th className="px-5 py-3">Type</th>
            <th className="px-5 py-3">Semantic role</th>
            <th className="px-5 py-3">Quality</th>
            <th className="px-5 py-3">Nullability</th>
            <th className="px-5 py-3">Sample values</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((column) => (
            <tr key={column.name} className="border-b border-[#EEF2F7] last:border-b-0">
              <td className="min-w-[220px] px-5 py-4 align-top">
                <p className="font-semibold text-[#0F172A]">{column.name}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#64748B]">
                  {column.description}
                </p>
              </td>
              <td className="px-5 py-4 align-top font-medium uppercase text-[#334155]">
                {column.dataType}
              </td>
              <td className="px-5 py-4 align-top">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${roleStyles[column.semanticRole]}`}
                >
                  {formatRole(column.semanticRole)}
                </span>
                <p className="mt-2 text-xs text-[#64748B]">{column.semanticType}</p>
              </td>
              <td className="px-5 py-4 align-top">
                <p className="font-semibold text-[#0F172A]">{column.qualityScore}%</p>
                <p className="mt-1 text-xs text-[#64748B]">{column.uniqueness}</p>
              </td>
              <td className="px-5 py-4 align-top">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                    column.nullable
                      ? "bg-amber-50 text-amber-700 ring-amber-200"
                      : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  }`}
                >
                  {column.nullable ? "Nullable" : "Required"}
                </span>
              </td>
              <td className="min-w-[220px] px-5 py-4 align-top">
                <div className="flex flex-wrap gap-2">
                  {column.sampleValues.length === 0 ? (
                    <span className="text-xs text-[#94A3B8]">No samples</span>
                  ) : (
                    column.sampleValues.slice(0, 3).map((value) => (
                      <code
                        key={`${column.name}-${value}`}
                        className="rounded-md bg-[#F8FAFC] px-2 py-1 text-xs text-[#334155] ring-1 ring-[#E5E7EB]"
                      >
                        {value}
                      </code>
                    ))
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SuggestionSummary({
  suggestions,
  onCreateSemanticModel,
}: {
  suggestions: SemanticSuggestion[];
  onCreateSemanticModel: () => void;
}) {
  return (
    <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm shadow-slate-200/70">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-[#EFF6FF] p-2 text-[#2563EB]">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#0F172A]">Semantic suggestions</h2>
          <p className="text-sm text-[#64748B]">
            Review generated metrics, dimensions, joins, and policies.
          </p>
        </div>
      </div>
      <div className="mt-5">
        <SemanticSuggestionsCard
          suggestions={suggestions}
          onApplySuggestion={onCreateSemanticModel}
        />
      </div>
    </section>
  );
}

export function DatasetDetailPage({
  initialData,
  sourceId,
  datasetId,
  createSemanticModelFromDatasetAction,
}: DatasetDetailPageProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [creatingSemanticModel, setCreatingSemanticModel] = useState(false);

  const source = sourceById(initialData, sourceId);
  const dataset = datasetById(initialData, datasetId);
  const columns =
    dataset && dataset.sourceId === sourceId
      ? columnsForDataset(initialData, dataset.id)
      : [];

  if (!source || !dataset || dataset.sourceId !== sourceId) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-[#E5E7EB] bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-[#0F172A]">Dataset not found</h1>
        <p className="text-sm text-[#64748B]">
          This dataset is not available in the selected data source.
        </p>
        <Button asChild variant="outline" className="w-fit">
          <Link href="/app/data-sources">Back to Data Sources</Link>
        </Button>
      </div>
    );
  }

  const selectedSource = source;
  const selectedDataset = dataset;
  const semanticModelSupported = supportsSemanticModel(selectedSource.type);

  async function handleCreateSemanticModel() {
    if (!semanticModelSupported) {
      toast({
        title: "Semantic model unavailable",
        description:
          "External connectors currently support live metadata and samples. Full semantic modeling requires ingestion or live query execution.",
      });
      return;
    }

    if (!initialData.workspaceId) {
      toast({
        title: "Workspace required",
        description: "Sign in and select a workspace before creating a semantic model.",
      });
      return;
    }

    setCreatingSemanticModel(true);
    const result = await createSemanticModelFromDatasetAction({
      workspaceId: initialData.workspaceId,
      datasetId: selectedDataset.id,
    });
    setCreatingSemanticModel(false);

    if (!result.ok) {
      toast({ title: "Semantic model failed", description: result.error });
      return;
    }

    toast({
      title: "Semantic model created",
      description: `${selectedDataset.displayName} is ready in the semantic layer workspace.`,
    });
    router.push("/app/semantic-layer");
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="border-b border-[#E5E7EB] pb-6">
        <nav className="mb-5 flex items-center gap-2 text-sm font-medium text-[#64748B]">
          <Link href="/app" className="hover:text-[#2563EB]">
            Home
          </Link>
          <span>/</span>
          <Link href="/app/data-sources" className="hover:text-[#2563EB]">
            Data Sources
          </Link>
          <span>/</span>
          <Link href={`/app/data-sources/${selectedSource.id}`} className="hover:text-[#2563EB]">
            {selectedSource.name}
          </Link>
          <span>/</span>
          <span className="text-[#334155]">{selectedDataset.displayName}</span>
        </nav>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-[#DBEAFE] bg-white text-[#2563EB] shadow-sm">
              <FileText className="h-8 w-8" aria-hidden="true" />
            </div>
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-[#2563EB]">
                <Database className="h-4 w-4" aria-hidden="true" />
                {selectedSource.name}
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-normal text-[#0F172A]">
                {selectedDataset.displayName}
              </h1>
              <p className="mt-1 max-w-3xl text-sm text-[#52617A]">
                {selectedDataset.description}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="gap-2">
              <Link href={`/app/data-sources/${selectedSource.id}`}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to source
              </Link>
            </Button>
          <Button
            type="button"
            onClick={handleCreateSemanticModel}
            disabled={creatingSemanticModel || !semanticModelSupported}
            className="gap-2"
          >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              {creatingSemanticModel ? "Creating model" : "Create semantic model"}
            </Button>
          </div>
        </div>
      </header>

      <section
        aria-label="Dataset overview"
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        {[
          { label: "Rows", value: formatNumber(selectedDataset.rowCount) },
          { label: "Columns", value: String(selectedDataset.columnCount) },
          { label: "Primary key", value: selectedDataset.primaryKey || "Not inferred" },
          { label: "Readiness", value: `${selectedDataset.semanticCoverage}%` },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm shadow-slate-200/70"
          >
            <p className="text-sm font-semibold text-[#52617A]">{item.label}</p>
            <p
              className={`mt-2 text-2xl font-bold text-[#0F172A] ${
                item.label === "Readiness"
                  ? `inline-flex rounded-full px-3 py-1 text-base ring-1 ${readinessClassName(
                      selectedDataset.semanticCoverage
                    )}`
                  : ""
              }`}
            >
              {item.value}
            </p>
          </div>
        ))}
      </section>

      <ColumnStats columns={columns} />

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.85fr)]">
        <section className="min-w-0 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-sm shadow-slate-200/70">
          <div className="flex flex-col gap-2 border-b border-[#E5E7EB] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#0F172A]">Schema and samples</h2>
              <p className="text-sm text-[#64748B]">
                Inspect column metadata, semantic roles, quality, nullability, and samples.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {selectedDataset.status === "ready" ? "Ready" : "Needs review"}
            </span>
          </div>
          <SchemaDetailTable columns={columns} />
        </section>

        <div className="space-y-6">
          <SuggestionSummary
            suggestions={selectedDataset.semanticSuggestions}
            onCreateSemanticModel={handleCreateSemanticModel}
          />
          <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm shadow-slate-200/70">
            <h2 className="text-lg font-bold text-[#0F172A]">AI question seed</h2>
            <p className="mt-3 rounded-lg bg-[#F8FAFC] p-4 text-sm leading-6 text-[#334155]">
              {selectedDataset.sampleQuestion || "No sample question has been generated yet."}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
