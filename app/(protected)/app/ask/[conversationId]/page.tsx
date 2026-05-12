"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
  chartRecommendation?: ChartRecommendation;
}

interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  metadata?: {
    queryResult?: QueryResult;
  };
  created_at: string;
}

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.conversationId as string;
  const { workspaceContext } = useAuthStore();
  const { currentConversation, setCurrentConversation } =
    useConversationStore();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (workspaceContext?.workspaceId && conversationId) {
      loadConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceContext?.workspaceId, conversationId]);

  async function loadConversation() {
    if (!workspaceContext?.workspaceId) return;
    setIsLoadingHistory(true);

    try {
      // Load conversation metadata
      const convResponse = await fetch(
        `/api/conversations/${conversationId}`,
        {
          headers: {
            "x-workspace-id": workspaceContext.workspaceId,
          },
        }
      );

      if (convResponse.ok) {
        const convData = await convResponse.json();
        setCurrentConversation(convData.conversation ?? null);
      }

      // Load messages
      const response = await fetch(
        `/api/conversations/${conversationId}/messages`,
        {
          headers: {
            "x-workspace-id": workspaceContext.workspaceId,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch {
      // Silently handle - conversation may not exist yet or API not available
    } finally {
      setIsLoadingHistory(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!workspaceContext?.workspaceId || !question.trim()) return;

    setIsLoading(true);
    setError(null);

    // Add user message optimistically
    const userMessage: ConversationMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: question.trim(),
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    const currentQuestion = question.trim();
    setQuestion("");

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": workspaceContext.workspaceId,
        },
        body: JSON.stringify({
          question: currentQuestion,
          conversationId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to process question");
      }

      // Add assistant message with result
      const assistantMessage: ConversationMessage = {
        id: `temp-${Date.now()}-response`,
        role: "assistant",
        content: `Query returned ${data.data.rowCount} rows in ${data.data.executionTimeMs}ms`,
        metadata: { queryResult: data.data },
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
      // Remove optimistic user message on error
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
    } finally {
      setIsLoading(false);
    }
  }

  if (!workspaceContext?.workspaceId) {
    return (
      <main className="flex min-h-screen flex-col p-8 max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Conversation</h1>
        <p className="text-muted-foreground">
          Please select a workspace first.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <a
          href="/app/ask"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Back to Ask
        </a>
      </div>

      <h1 className="text-3xl font-bold mb-2">
        {currentConversation?.title || "Conversation"}
      </h1>
      {currentConversation?.updated_at && (
        <p className="text-sm text-muted-foreground mb-6">
          Last updated:{" "}
          {new Date(currentConversation.updated_at).toLocaleString()}
        </p>
      )}

      {/* Message History */}
      {isLoadingHistory ? (
        <p className="text-muted-foreground mb-6">Loading conversation...</p>
      ) : (
        <div className="space-y-4 mb-8">
          {messages.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No messages yet. Ask a question below.
            </p>
          )}
          {messages.map((message, index) => {
            // For assistant messages, find the preceding user question
            const userQuestion =
              message.role === "assistant" && index > 0
                ? messages
                    .slice(0, index)
                    .reverse()
                    .find((m) => m.role === "user")?.content || ""
                : "";
            return (
              <MessageCard
                key={message.id}
                message={message}
                userQuestion={userQuestion}
              />
            );
          })}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div
          className="mb-6 p-4 rounded-md bg-destructive/10 text-destructive text-sm"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Question Input */}
      <form onSubmit={handleSubmit} className="sticky bottom-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <Label htmlFor="follow-up-question" className="sr-only">
              Follow-up question
            </Label>
            <Input
              id="follow-up-question"
              type="text"
              placeholder="Ask a follow-up question..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <Button type="submit" disabled={isLoading || !question.trim()}>
            {isLoading ? "Thinking..." : "Ask"}
          </Button>
        </div>
      </form>
    </main>
  );
}

// --- Sub-components ---

function MessageCard({
  message,
  userQuestion,
}: {
  message: ConversationMessage;
  userQuestion: string;
}) {
  const [showSql, setShowSql] = useState(false);
  const isUser = message.role === "user";
  const queryResult = message.metadata?.queryResult;

  return (
    <Card className={isUser ? "border-l-4 border-l-blue-400" : ""}>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs">
          {isUser ? "You" : "MetricMind"} •{" "}
          {new Date(message.created_at).toLocaleTimeString()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">{message.content}</p>

        {queryResult && (
          <div className="mt-4 space-y-3">
            {/* Confidence + Save to Dashboard */}
            <div className="flex items-center justify-between gap-3">
              <ConfidenceIndicator confidence={queryResult.confidence} />
              <SaveToDashboard
                question={userQuestion}
                sql={queryResult.sql}
                resultData={queryResult.results}
                chartConfig={
                  queryResult.chartRecommendation
                    ? (queryResult.chartRecommendation as unknown as Record<string, unknown>)
                    : {}
                }
                summary={`Query returned ${queryResult.rowCount} rows in ${queryResult.executionTimeMs}ms`}
                citations={queryResult.citations}
                confidence={queryResult.confidence}
                assumptions={queryResult.assumptions}
              />
            </div>

            {/* Chart Recommendation Info */}
            {queryResult.chartRecommendation && (
              <div className="p-2 rounded bg-muted text-xs text-muted-foreground">
                📊 Recommended chart: {queryResult.chartRecommendation.type} —{" "}
                {queryResult.chartRecommendation.reason}
              </div>
            )}

            {/* Results Table */}
            {queryResult.results.length > 0 && (
              <div className="overflow-x-auto">
                <ResultsTable results={queryResult.results} />
              </div>
            )}

            {/* SQL Trace */}
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              onClick={() => setShowSql(!showSql)}
              aria-expanded={showSql}
            >
              {showSql ? "▼" : "▶"} SQL Trace
            </button>
            {showSql && (
              <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs font-mono whitespace-pre-wrap">
                {queryResult.sql}
              </pre>
            )}

            {/* Citations */}
            {queryResult.citations.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Citations:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {queryResult.citations.map((citation, index) => (
                    <CitationBadge key={index} citation={citation} />
                  ))}
                </div>
              </div>
            )}

            {/* Assumptions */}
            {queryResult.assumptions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Assumptions:
                </p>
                <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                  {queryResult.assumptions.map((assumption, index) => (
                    <li key={index}>{assumption}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConfidenceIndicator({ confidence }: { confidence: number }) {
  const isLow = confidence < 0.7;
  const percentage = Math.round(confidence * 100);

  return (
    <div
      className={`flex items-center gap-2 p-2 rounded text-xs ${
        isLow
          ? "bg-yellow-50 border border-yellow-200"
          : "bg-green-50 border border-green-200"
      }`}
      role={isLow ? "alert" : undefined}
    >
      <span
        className={`font-medium ${
          isLow ? "text-yellow-800" : "text-green-800"
        }`}
      >
        Confidence: {percentage}%
      </span>
      {isLow && (
        <span className="text-yellow-700">
          ⚠️ Low confidence — verify results
        </span>
      )}
    </div>
  );
}

function ResultsTable({ results }: { results: Record<string, unknown>[] }) {
  if (results.length === 0) return null;

  const columns = Object.keys(results[0]);

  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="border-b">
          {columns.map((col) => (
            <th
              key={col}
              className="text-left p-1.5 font-medium text-muted-foreground"
            >
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {results.slice(0, 50).map((row, rowIndex) => (
          <tr key={rowIndex} className="border-b last:border-0">
            {columns.map((col) => (
              <td key={col} className="p-1.5">
                {formatCellValue(row[col])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {results.length > 50 && (
        <tfoot>
          <tr>
            <td
              colSpan={columns.length}
              className="p-1.5 text-xs text-muted-foreground"
            >
              Showing first 50 of {results.length} rows.
            </td>
          </tr>
        </tfoot>
      )}
    </table>
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
    data_source: "Source",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
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
