"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useConversationStore } from "@/stores/conversation-store";
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
import { SaveToDashboard } from "@/components/SaveToDashboard";

interface Citation {
  type: "metric" | "entity" | "data_source";
  name: string;
  id: string;
}

interface ChartRecommendation {
  type: "line" | "bar" | "pie" | "kpi" | "table" | "area" | "scatter";
  reason: string;
  axes: { x?: string; y?: string; series?: string };
}

interface QueryResult {
  sql: string;
  results: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  confidence: number;
  citations: Citation[];
  assumptions: string[];
  chartRecommendation: ChartRecommendation;
}

export default function AskPage() {
  const { workspaceContext } = useAuthStore();
  const { conversations, isLoadingConversations, fetchConversations } =
    useConversationStore();
  const [question, setQuestion] = useState("");
  const [lastAskedQuestion, setLastAskedQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [showSqlTrace, setShowSqlTrace] = useState(false);

  useEffect(() => {
    if (workspaceContext?.workspaceId) {
      fetchConversations(workspaceContext.workspaceId);
    }
  }, [workspaceContext?.workspaceId, fetchConversations]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!workspaceContext?.workspaceId || !question.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setLastAskedQuestion(question.trim());

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": workspaceContext.workspaceId,
        },
        body: JSON.stringify({ question: question.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to process question");
      }

      setResult(data.data);
      // Refresh conversation list after asking a question (new conversation may have been created)
      fetchConversations(workspaceContext.workspaceId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  }

  if (!workspaceContext?.workspaceId) {
    return (
      <main className="flex min-h-screen flex-col p-8 max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Ask</h1>
        <p className="text-muted-foreground">
          Please select a workspace first.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-8 max-w-7xl mx-auto">
      <div className="flex gap-8">
        {/* Main Content */}
        <div className="flex-1 max-w-4xl">
          <h1 className="text-3xl font-bold mb-2">Ask your data</h1>
          <p className="text-muted-foreground mb-8">
            Ask a natural-language question about your data and get AI-powered
            insights.
          </p>

          {/* Question Input */}
          <form onSubmit={handleSubmit} className="mb-8">
            <div className="flex gap-3">
              <div className="flex-1">
                <Label htmlFor="question" className="sr-only">
                  Your question
                </Label>
                <Input
                  id="question"
                  type="text"
                  placeholder="e.g., What is the monthly recurring revenue for the last 6 months?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  disabled={isLoading}
                  aria-describedby={error ? "ask-error" : undefined}
                />
              </div>
              <Button type="submit" disabled={isLoading || !question.trim()}>
                {isLoading ? "Thinking..." : "Ask"}
              </Button>
            </div>
          </form>

          {/* Error Display */}
          {error && (
            <div
              id="ask-error"
              className="mb-6 p-4 rounded-md bg-destructive/10 text-destructive text-sm"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-6">
              {/* Confidence Score + Save Button */}
              <div className="flex items-center justify-between gap-4">
                <ConfidenceIndicator confidence={result.confidence} />
                <SaveToDashboard
                  question={lastAskedQuestion}
                  sql={result.sql}
                  resultData={result.results}
                  chartConfig={
                    result.chartRecommendation
                      ? (result.chartRecommendation as unknown as Record<string, unknown>)
                      : {}
                  }
                  summary={`Query returned ${result.rowCount} rows in ${result.executionTimeMs}ms`}
                  citations={result.citations}
                  confidence={result.confidence}
                  assumptions={result.assumptions}
                />
              </div>

              {/* Results Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Results</CardTitle>
                  <CardDescription>
                    {result.rowCount} row{result.rowCount !== 1 ? "s" : ""}{" "}
                    returned in {result.executionTimeMs}ms
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResultsTable results={result.results} />
                </CardContent>
              </Card>

              {/* SQL Trace (Collapsible) */}
              <Card>
                <CardHeader>
                  <button
                    type="button"
                    className="flex items-center gap-2 w-full text-left"
                    onClick={() => setShowSqlTrace(!showSqlTrace)}
                    aria-expanded={showSqlTrace}
                    aria-controls="sql-trace-content"
                  >
                    <span className="text-lg font-semibold">SQL Trace</span>
                    <span className="text-muted-foreground text-sm">
                      {showSqlTrace ? "▼" : "▶"}
                    </span>
                  </button>
                </CardHeader>
                {showSqlTrace && (
                  <CardContent id="sql-trace-content">
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
            </div>
          )}
        </div>

        {/* Conversation List Sidebar */}
        <aside className="w-72 shrink-0">
          <ConversationList
            conversations={conversations}
            isLoading={isLoadingConversations}
          />
        </aside>
      </div>
    </main>
  );
}

// --- Sub-components ---

interface ConversationListItem {
  id: string;
  title: string;
  updated_at: string;
}

function ConversationList({
  conversations,
  isLoading,
}: {
  conversations: ConversationListItem[];
  isLoading: boolean;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Past Conversations
      </h2>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : conversations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No conversations yet. Ask a question to start one.
        </p>
      ) : (
        <nav aria-label="Past conversations">
          <ul className="space-y-1">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <a
                  href={`/app/ask/${conversation.id}`}
                  className="block p-3 rounded-md hover:bg-muted transition-colors"
                >
                  <span className="block text-sm font-medium truncate">
                    {conversation.title}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {formatRelativeTime(conversation.updated_at)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return "Just now";
  if (diffMinutes < 60)
    return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`;
  if (diffHours < 24)
    return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  if (diffDays < 7)
    return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;

  return date.toLocaleDateString();
}

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
          ⚠️ Low confidence — results may be inaccurate. Consider rephrasing
          your question or verifying the data.
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
          {results.slice(0, 100).map((row, rowIndex) => (
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
      {results.length > 100 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Showing first 100 of {results.length} rows.
        </p>
      )}
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
