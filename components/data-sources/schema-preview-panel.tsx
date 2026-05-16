import { BrainCircuit, Database, KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ColumnSchemaTable } from "./column-schema-table";
import { SemanticSuggestionsCard } from "./semantic-suggestions-card";
import { SourceHealthChecklist } from "./source-health-checklist";
import type { DatasetColumn } from "@/lib/mock-data/dataset-columns";
import type { DataSourceIssue } from "@/lib/mock-data/data-source-issues";
import type { MetricMindDataSource } from "@/lib/mock-data/data-sources";
import type { MetricMindDataset, SemanticSuggestion } from "@/lib/mock-data/datasets";

interface SchemaPreviewPanelProps {
  source: MetricMindDataSource | null;
  dataset: MetricMindDataset | null;
  columns: DatasetColumn[];
  issues: DataSourceIssue[];
  onApplySuggestion: (suggestion: SemanticSuggestion) => void;
  onCreateSemanticModel: () => void;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en").format(value);
}

export function SchemaPreviewPanel({
  source,
  dataset,
  columns,
  issues,
  onApplySuggestion,
  onCreateSemanticModel,
}: SchemaPreviewPanelProps) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
      <section
        aria-label="Schema preview panel"
        className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-sm"
      >
        <div className="border-b border-[#E5E7EB] bg-[#FBFDFF] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-normal text-[#2563EB]">
                Schema preview
              </p>
              <h2 className="mt-1 truncate text-base font-semibold text-[#111827]">
                {dataset ? dataset.displayName : "Select a dataset"}
              </h2>
              <p className="mt-1 truncate text-sm text-[#6B7280]">
                {source ? source.name : "No source selected"}
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#EFF6FF] text-[#2563EB]">
              <Database className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>

          {dataset && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-md bg-white p-3 ring-1 ring-[#E5E7EB]">
                <p className="text-xs text-[#6B7280]">Rows</p>
                <p className="mt-1 text-sm font-semibold text-[#111827]">
                  {formatNumber(dataset.rowCount)}
                </p>
              </div>
              <div className="rounded-md bg-white p-3 ring-1 ring-[#E5E7EB]">
                <p className="text-xs text-[#6B7280]">Columns</p>
                <p className="mt-1 text-sm font-semibold text-[#111827]">
                  {dataset.columnCount}
                </p>
              </div>
              <div className="rounded-md bg-white p-3 ring-1 ring-[#E5E7EB]">
                <p className="text-xs text-[#6B7280]">Coverage</p>
                <p className="mt-1 text-sm font-semibold text-[#111827]">
                  {dataset.semanticCoverage}%
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-5 p-4">
          {dataset && (
            <div className="rounded-md bg-[#F9FAFB] p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
                <KeyRound className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                Primary key: {dataset.primaryKey}
              </div>
              <p className="mt-2 text-xs leading-5 text-[#6B7280]">
                {dataset.description}
              </p>
              <p className="mt-3 text-xs font-medium text-[#374151]">
                Sample AI question: {dataset.sampleQuestion}
              </p>
            </div>
          )}

          <ColumnSchemaTable columns={columns} />

          <SemanticSuggestionsCard
            suggestions={dataset?.semanticSuggestions ?? []}
            onApplySuggestion={onApplySuggestion}
          />

          <div className="rounded-md border border-[#DBEAFE] bg-[#EFF6FF] p-3">
            <div className="flex items-start gap-3">
              <BrainCircuit className="mt-0.5 h-5 w-5 shrink-0 text-[#2563EB]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#111827]">
                  Ready to model this dataset
                </p>
                <p className="mt-1 text-xs leading-5 text-[#4B5563]">
                  MetricMind can draft entities, measures, joins, and governance notes from
                  this schema.
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={onCreateSemanticModel}
                  disabled={!dataset}
                  className="mt-3 gap-2"
                >
                  <BrainCircuit className="h-4 w-4" aria-hidden="true" />
                  Create semantic model
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SourceHealthChecklist source={source} issues={issues} />
    </aside>
  );
}
