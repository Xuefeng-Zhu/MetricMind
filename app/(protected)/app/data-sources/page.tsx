"use client";

import { dataSources, datasets, schemaColumns, connectorRoadmap } from "@/lib/mock-data/data-sources";
import type { Dataset, SchemaColumn as SchemaColumnType } from "@/lib/mock-data/types";
import { DataTable } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { FileText, Database, Cloud, Upload } from "lucide-react";

const sourceIcons: Record<string, React.ReactNode> = {
  "file-text": <FileText className="h-8 w-8 text-[#4B5563]" />,
  database: <Database className="h-8 w-8 text-[#4B5563]" />,
  cloud: <Cloud className="h-8 w-8 text-[#4B5563]" />,
};

function getStatusBadge(status: string) {
  switch (status) {
    case "Active":
      return <Badge variant="success">{status}</Badge>;
    case "Demo":
      return <Badge className="bg-blue-500 text-white">{status}</Badge>;
    case "Coming Soon":
      return <Badge variant="secondary">{status}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

const datasetColumns: {
  key: keyof Dataset;
  label: string;
  render?: (value: Dataset[keyof Dataset], row: Dataset) => React.ReactNode;
}[] = [
  { key: "name", label: "Name" },
  {
    key: "rows",
    label: "Rows",
    render: (value) => (value as number).toLocaleString(),
  },
  { key: "columns", label: "Columns" },
  {
    key: "qualityScore",
    label: "Quality",
    render: (value) => (
      <div className="flex items-center gap-2">
        <Progress value={value as number} color="#16A34A" className="w-24" />
        <span className="text-xs text-[#4B5563]">{value as number}%</span>
      </div>
    ),
  },
  {
    key: "semanticCoverage",
    label: "Semantic Coverage",
    render: (value) => (
      <div className="flex items-center gap-2">
        <Progress value={value as number} color="#2563EB" className="w-24" />
        <span className="text-xs text-[#4B5563]">{value as number}%</span>
      </div>
    ),
  },
  { key: "lastUpdated", label: "Last Updated" },
];

const schemaTableColumns: {
  key: keyof SchemaColumnType;
  label: string;
  render?: (value: SchemaColumnType[keyof SchemaColumnType], row: SchemaColumnType) => React.ReactNode;
}[] = [
  { key: "name", label: "Column Name" },
  {
    key: "inferredType",
    label: "Inferred Type",
    render: (value) => (
      <Badge variant="outline" className="capitalize">
        {value as string}
      </Badge>
    ),
  },
  {
    key: "semanticType",
    label: "Semantic Type",
    render: (value) => {
      const v = value as string;
      const variant =
        v === "measure"
          ? "default"
          : v === "dimension"
            ? "secondary"
            : "warning";
      return (
        <Badge variant={variant} className="capitalize">
          {v}
        </Badge>
      );
    },
  },
];

export default function DataSourcesPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-[#111827]">Data Sources</h1>

      {/* Source Cards */}
      <section aria-label="Connected data sources">
        <div className="grid grid-cols-3 gap-4">
          {dataSources.map((source) => (
            <div
              key={source.id}
              className="bg-white rounded-xl border border-[#E5E7EB] p-6 flex items-center gap-4"
            >
              {sourceIcons[source.icon]}
              <div className="flex-1">
                <p className="font-medium text-[#111827]">{source.name}</p>
              </div>
              {getStatusBadge(source.status)}
            </div>
          ))}
        </div>
      </section>

      {/* Upload CSV Panel */}
      <section aria-label="Upload CSV">
        <h2 className="text-lg font-semibold text-[#111827] mb-4">Upload CSV</h2>
        <div className="border-2 border-dashed border-[#E5E7EB] rounded-xl p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <Upload className="h-10 w-10 text-[#9CA3AF]" />
            <p className="text-[#4B5563] font-medium">
              Drag &amp; drop or click to upload
            </p>
            <Button variant="default">Browse Files</Button>
            <p className="text-xs text-[#9CA3AF]">
              Accepted formats: .csv, .tsv, .xlsx
            </p>
          </div>
        </div>
      </section>

      {/* Dataset Catalog */}
      <section aria-label="Dataset catalog">
        <h2 className="text-lg font-semibold text-[#111827] mb-4">
          Dataset Catalog
        </h2>
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <DataTable
            columns={datasetColumns}
            data={datasets}
            caption="Dataset catalog showing all uploaded datasets with quality and coverage metrics"
          />
        </div>
      </section>

      {/* Schema Inference */}
      <section aria-label="Schema inference">
        <h2 className="text-lg font-semibold text-[#111827] mb-4">
          Schema Inference
        </h2>
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <DataTable
            columns={schemaTableColumns}
            data={schemaColumns}
            caption="Schema inference showing detected column names, inferred types, and semantic classifications"
          />
        </div>
      </section>

      {/* Connector Roadmap */}
      <section aria-label="Connector roadmap">
        <h2 className="text-lg font-semibold text-[#111827] mb-4">
          Connector Roadmap
        </h2>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
          <ul className="space-y-3">
            {connectorRoadmap.map((connector) => (
              <li
                key={connector.name}
                className="flex items-center justify-between"
              >
                <span className="font-medium text-[#111827]">
                  {connector.name}
                </span>
                <Badge variant="outline">{connector.quarter}</Badge>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
