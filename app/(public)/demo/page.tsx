"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import Link from "next/link";

// --- Demo data types ---

interface Citation {
  type: "metric" | "entity" | "data_source";
  name: string;
  id: string;
}

interface DemoResult {
  sql: string;
  results: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  confidence: number;
  citations: Citation[];
  assumptions: string[];
}

// --- Hardcoded demo responses keyed by keyword ---

const DEMO_RESPONSES: { keywords: string[]; response: DemoResult }[] = [
  {
    keywords: ["mrr", "revenue", "recurring"],
    response: {
      sql: "SELECT DATE_TRUNC('month', s.started_at) AS month,\n       SUM(s.mrr_cents) / 100.0 AS mrr\nFROM subscriptions s\nWHERE s.status = 'active'\nGROUP BY month\nORDER BY month DESC\nLIMIT 6;",
      results: [
        { month: "2024-06", mrr: 34250 },
        { month: "2024-05", mrr: 32490 },
        { month: "2024-04", mrr: 31100 },
        { month: "2024-03", mrr: 29800 },
        { month: "2024-02", mrr: 28500 },
        { month: "2024-01", mrr: 27200 },
      ],
      rowCount: 6,
      executionTimeMs: 142,
      confidence: 0.94,
      citations: [
        { type: "metric", name: "MRR", id: "demo-metric-mrr" },
        { type: "entity", name: "Subscriptions", id: "demo-entity-subscriptions" },
      ],
      assumptions: [
        "Filtering to active subscriptions only",
        "MRR values converted from cents to dollars",
        "Grouped by calendar month",
      ],
    },
  },
  {
    keywords: ["churn", "cancel", "lost"],
    response: {
      sql: "SELECT COUNT(*) FILTER (WHERE status = 'canceled') * 100.0 /\n       COUNT(*) AS churn_rate_pct\nFROM subscriptions\nWHERE started_at < DATE_TRUNC('month', NOW());",
      results: [{ churn_rate_pct: 4.2 }],
      rowCount: 1,
      executionTimeMs: 89,
      confidence: 0.87,
      citations: [
        { type: "metric", name: "Churn Rate", id: "demo-metric-churn" },
        { type: "entity", name: "Subscriptions", id: "demo-entity-subscriptions" },
      ],
      assumptions: [
        "Churn calculated as canceled / total subscriptions started before current month",
        "Includes all plan tiers",
      ],
    },
  },
  {
    keywords: ["customer", "user", "account", "active"],
    response: {
      sql: "SELECT c.plan, COUNT(*) AS customer_count\nFROM customers c\nWHERE c.status = 'active'\nGROUP BY c.plan\nORDER BY customer_count DESC;",
      results: [
        { plan: "Enterprise", customer_count: 3 },
        { plan: "Professional", customer_count: 7 },
        { plan: "Starter", customer_count: 6 },
      ],
      rowCount: 3,
      executionTimeMs: 67,
      confidence: 0.91,
      citations: [
        { type: "entity", name: "Customers", id: "demo-entity-customers" },
        { type: "data_source", name: "customers", id: "demo-ds-customers" },
      ],
      assumptions: [
        "Only counting customers with active status",
        "Grouped by subscription plan tier",
      ],
    },
  },
  {
    keywords: ["support", "ticket", "issue"],
    response: {
      sql: "SELECT priority, COUNT(*) AS ticket_count,\n       AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::numeric(10,1) AS avg_resolution_hours\nFROM support_tickets\nWHERE created_at >= NOW() - INTERVAL '30 days'\nGROUP BY priority\nORDER BY ticket_count DESC;",
      results: [
        { priority: "medium", ticket_count: 12, avg_resolution_hours: 18.3 },
        { priority: "high", ticket_count: 5, avg_resolution_hours: 4.7 },
        { priority: "low", ticket_count: 8, avg_resolution_hours: 42.1 },
        { priority: "critical", ticket_count: 2, avg_resolution_hours: 1.2 },
      ],
      rowCount: 4,
      executionTimeMs: 113,
      confidence: 0.89,
      citations: [
        { type: "metric", name: "Support Ticket Volume", id: "demo-metric-tickets" },
        { type: "entity", name: "Support Tickets", id: "demo-entity-tickets" },
      ],
      assumptions: [
        "Looking at tickets from the last 30 days",
        "Resolution time calculated from created_at to resolved_at",
      ],
    },
  },
  {
    keywords: ["product", "usage", "event", "feature"],
    response: {
      sql: "SELECT event_name, COUNT(*) AS event_count,\n       COUNT(DISTINCT customer_id) AS unique_users\nFROM product_events\nWHERE occurred_at >= NOW() - INTERVAL '7 days'\nGROUP BY event_name\nORDER BY event_count DESC\nLIMIT 5;",
      results: [
        { event_name: "page_view", event_count: 1842, unique_users: 14 },
        { event_name: "dashboard_created", event_count: 23, unique_users: 8 },
        { event_name: "query_executed", event_count: 156, unique_users: 11 },
        { event_name: "report_exported", event_count: 34, unique_users: 6 },
        { event_name: "alert_configured", event_count: 12, unique_users: 4 },
      ],
      rowCount: 5,
      executionTimeMs: 98,
      confidence: 0.86,
      citations: [
        { type: "metric", name: "Active Users", id: "demo-metric-active-users" },
        { type: "entity", name: "Product Events", id: "demo-entity-events" },
      ],
      assumptions: [
        "Looking at the last 7 days of product events",
        "Unique users counted by distinct customer_id",
      ],
    },
  },
];

const DEFAULT_RESPONSE: DemoResult = {
  sql: "SELECT COUNT(*) AS total_records,\n       MIN(created_at) AS earliest_record,\n       MAX(created_at) AS latest_record\nFROM customers;",
  results: [
    { total_records: 20, earliest_record: "2023-01-15", latest_record: "2024-06-01" },
  ],
  rowCount: 1,
  executionTimeMs: 54,
  confidence: 0.72,
  citations: [
    { type: "data_source", name: "customers", id: "demo-ds-customers" },
  ],
  assumptions: [
    "Using demo SaaS dataset with 20 customer records",
    "Query returns basic dataset statistics",
  ],
};

const SAMPLE_QUESTIONS = [
  "What is the MRR for the last 6 months?",
  "What is our current churn rate?",
  "How many active customers do we have by plan?",
  "Show me support ticket volume by priority",
  "What are the top product features by usage?",
];

// --- Helper to match a question to a demo response ---

function matchDemoResponse(question: string): DemoResult {
  const lower = question.toLowerCase();
  for (const entry of DEMO_RESPONSES) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.response;
    }
  }
  return DEFAULT_RESPONSE;
}

// --- Demo Page Component ---

export default function DemoPage() {
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [showSqlTrace, setShowSqlTrace] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;

    setIsLoading(true);
    setResult(null);

    // Simulate AI processing delay
    await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 700));

    const matched = matchDemoResponse(question);
    setResult(matched);
    setIsLoading(false);
  }

  function handleSampleQuestion(q: string) {
    setQuestion(q);
    setResult(null);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-slate-900">
            MetricMind
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-medium">
              Demo Mode
            </span>
            <Link href="/signup">
              <Button size="sm">Sign Up Free</Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Intro Section */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-slate-900 mb-3">
            Try MetricMind — No Sign-Up Required
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Ask questions about a sample SaaS revenue dataset. See how MetricMind
            generates SQL, provides confidence scores, and cites its sources — all
            with full transparency.
          </p>
        </div>

        {/* Dataset Info */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base">Demo Dataset: SaaS Revenue Analytics</CardTitle>
            <CardDescription>
              Pre-loaded with customers, subscriptions, invoices, payments, product events, and support tickets.
              Includes certified metrics like MRR, ARR, Churn Rate, Active Users, and more.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Question Input */}
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="demo-question" className="sr-only">
                Your question
              </Label>
              <Input
                id="demo-question"
                type="text"
                placeholder="Ask a question about the demo data..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={isLoading}
                className="h-12 text-base"
                aria-describedby="demo-hint"
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading || !question.trim()}
              className="h-12 px-6"
            >
              {isLoading ? "Thinking..." : "Ask"}
            </Button>
          </div>
        </form>

        {/* Sample Questions */}
        <div className="mb-10" id="demo-hint">
          <p className="text-sm text-muted-foreground mb-2">Try one of these:</p>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleSampleQuestion(q)}
                className="text-sm px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors text-slate-700"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-flex items-center gap-2 text-muted-foreground">
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span>Analyzing your question...</span>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Confidence Score */}
            <ConfidenceIndicator confidence={result.confidence} />

            {/* Results Table */}
            <Card>
              <CardHeader>
                <CardTitle>Results</CardTitle>
                <CardDescription>
                  {result.rowCount} row{result.rowCount !== 1 ? "s" : ""} returned
                  in {result.executionTimeMs}ms
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResultsTable results={result.results} />
              </CardContent>
            </Card>

            {/* SQL Trace */}
            <Card>
              <CardHeader>
                <button
                  type="button"
                  className="flex items-center gap-2 w-full text-left"
                  onClick={() => setShowSqlTrace(!showSqlTrace)}
                  aria-expanded={showSqlTrace}
                  aria-controls="demo-sql-trace"
                >
                  <span className="text-lg font-semibold">SQL Trace</span>
                  <span className="text-muted-foreground text-sm">
                    {showSqlTrace ? "▼" : "▶"}
                  </span>
                </button>
              </CardHeader>
              {showSqlTrace && (
                <CardContent id="demo-sql-trace">
                  <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm font-mono whitespace-pre-wrap">
                    {result.sql}
                  </pre>
                </CardContent>
              )}
            </Card>

            {/* Citations */}
            {result.citations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Citations</CardTitle>
                  <CardDescription>
                    Sources referenced to generate this answer
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {result.citations.map((citation, index) => (
                      <CitationBadge key={index} citation={citation} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Assumptions */}
            {result.assumptions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Assumptions</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {result.assumptions.map((assumption, index) => (
                      <li key={index}>{assumption}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* CTA */}
            <div className="text-center pt-4 pb-8">
              <p className="text-muted-foreground mb-4">
                Ready to connect your own data and get real AI-powered insights?
              </p>
              <Link href="/signup">
                <Button size="lg">Get Started Free</Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// --- Sub-components ---

function ConfidenceIndicator({ confidence }: { confidence: number }) {
  const isLow = confidence < 0.7;
  const percentage = Math.round(confidence * 100);

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-md ${
        isLow
          ? "bg-yellow-50 border border-yellow-200"
          : "bg-green-50 border border-green-200"
      }`}
      role={isLow ? "alert" : undefined}
    >
      <div
        className={`text-sm font-medium ${
          isLow ? "text-yellow-800" : "text-green-800"
        }`}
      >
        Confidence: {percentage}%
      </div>
      {isLow && (
        <span className="text-xs text-yellow-700">
          ⚠️ Low confidence — results may be inaccurate
        </span>
      )}
    </div>
  );
}

function ResultsTable({ results }: { results: Record<string, unknown>[] }) {
  if (results.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No results returned.</p>
    );
  }

  const columns = Object.keys(results[0]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b">
            {columns.map((col) => (
              <th
                key={col}
                className="text-left p-2 font-medium text-muted-foreground"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b last:border-0">
              {columns.map((col) => (
                <td key={col} className="p-2">
                  {formatCellValue(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CitationBadge({ citation }: { citation: Citation }) {
  const typeColors: Record<Citation["type"], string> = {
    metric: "bg-blue-100 text-blue-800",
    entity: "bg-purple-100 text-purple-800",
    data_source: "bg-gray-100 text-gray-800",
  };

  const typeLabels: Record<Citation["type"], string> = {
    metric: "Metric",
    entity: "Entity",
    data_source: "Data Source",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
        typeColors[citation.type]
      }`}
    >
      <span className="opacity-70">{typeLabels[citation.type]}:</span>
      {citation.name}
    </span>
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? value.toLocaleString()
      : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
