"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export interface InsightCardData {
  question: string;
  sql: string;
  resultData: unknown[];
  chartConfig: Record<string, unknown>;
  summary: string;
  citations: { type: string; name: string; id: string }[];
  confidence: number;
  assumptions: string[];
}

interface InsightCardProps {
  insight: InsightCardData;
}

export function InsightCard({ insight }: InsightCardProps) {
  const [showSql, setShowSql] = useState(false);
  const [showAssumptions, setShowAssumptions] = useState(false);

  const confidencePercentage = Math.round(insight.confidence * 100);
  const isLowConfidence = insight.confidence < 0.7;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base leading-tight">
          {insight.question}
        </CardTitle>
        {insight.summary && (
          <CardDescription className="text-sm mt-1">
            {insight.summary}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Confidence Score */}
        <div
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
            isLowConfidence
              ? "bg-yellow-50 text-yellow-800 border border-yellow-200"
              : "bg-green-50 text-green-800 border border-green-200"
          }`}
          role={isLowConfidence ? "alert" : undefined}
        >
          Confidence: {confidencePercentage}%
          {isLowConfidence && <span>⚠️</span>}
        </div>

        {/* Result Data Preview */}
        {insight.resultData.length > 0 && (
          <div className="overflow-x-auto">
            <InsightResultsTable results={insight.resultData} />
          </div>
        )}

        {/* SQL Trace (Collapsible) */}
        <div>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            onClick={() => setShowSql(!showSql)}
            aria-expanded={showSql}
          >
            {showSql ? "▼" : "▶"} SQL Trace
          </button>
          {showSql && (
            <pre className="mt-1 bg-muted p-2 rounded text-xs font-mono whitespace-pre-wrap overflow-x-auto">
              {insight.sql}
            </pre>
          )}
        </div>

        {/* Citations */}
        {insight.citations.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Citations:
            </p>
            <div className="flex flex-wrap gap-1">
              {insight.citations.map((citation, index) => (
                <InsightCitationBadge key={index} citation={citation} />
              ))}
            </div>
          </div>
        )}

        {/* Assumptions (Collapsible) */}
        {insight.assumptions.length > 0 && (
          <div>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              onClick={() => setShowAssumptions(!showAssumptions)}
              aria-expanded={showAssumptions}
            >
              {showAssumptions ? "▼" : "▶"} Assumptions (
              {insight.assumptions.length})
            </button>
            {showAssumptions && (
              <ul className="mt-1 list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                {insight.assumptions.map((assumption, index) => (
                  <li key={index}>{assumption}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InsightResultsTable({ results }: { results: unknown[] }) {
  if (results.length === 0) return null;

  const firstRow = results[0] as Record<string, unknown>;
  if (!firstRow || typeof firstRow !== "object") return null;

  const columns = Object.keys(firstRow);
  const displayRows = results.slice(0, 5) as Record<string, unknown>[];

  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="border-b">
          {columns.map((col) => (
            <th
              key={col}
              className="text-left p-1 font-medium text-muted-foreground"
            >
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {displayRows.map((row, rowIndex) => (
          <tr key={rowIndex} className="border-b last:border-0">
            {columns.map((col) => (
              <td key={col} className="p-1">
                {formatInsightCellValue(row[col])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {results.length > 5 && (
        <tfoot>
          <tr>
            <td
              colSpan={columns.length}
              className="p-1 text-xs text-muted-foreground"
            >
              +{results.length - 5} more rows
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}

function InsightCitationBadge({
  citation,
}: {
  citation: { type: string; name: string; id: string };
}) {
  const typeColors: Record<string, string> = {
    metric: "bg-blue-100 text-blue-800",
    entity: "bg-purple-100 text-purple-800",
    data_source: "bg-gray-100 text-gray-800",
  };

  const typeLabels: Record<string, string> = {
    metric: "Metric",
    entity: "Entity",
    data_source: "Source",
  };

  const colorClass = typeColors[citation.type] || "bg-gray-100 text-gray-800";
  const label = typeLabels[citation.type] || citation.type;

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
    >
      <span className="opacity-70">{label}:</span>
      {citation.name}
    </span>
  );
}

function formatInsightCellValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? value.toLocaleString()
      : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
