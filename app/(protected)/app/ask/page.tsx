"use client";

import { useEffect, useState } from "react";
import { useApiQuery } from "@/hooks/use-api-query";
import { useApiMutation } from "@/hooks/use-api-mutation";
import type { ConversationsResponse, MessagesResponse, AskResponse } from "@/types/api-responses";
import { LoadingSkeleton, ErrorState } from "@/components/ui/api-states";
import { SimpleBarChart } from "@/components/charts/simple-bar-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Send, Plus, ChevronDown, ChevronRight, MessageSquare } from "lucide-react";

interface AskInput {
  question: string;
  conversationId?: string;
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
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

export default function AskPage() {
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [sqlExpanded, setSqlExpanded] = useState(false);
  const [lastAnswer, setLastAnswer] = useState<AskResponse | null>(null);

  // Fetch conversation list
  const {
    data: conversationsData,
    isLoading: conversationsLoading,
    error: conversationsError,
    refetch: refetchConversations,
  } = useApiQuery<ConversationsResponse>("/api/conversations");

  // Fetch messages for selected conversation
  const {
    data: messagesData,
    isLoading: messagesLoading,
  } = useApiQuery<MessagesResponse>(
    `/api/conversations/${activeConversation}/messages`,
    { enabled: !!activeConversation }
  );

  // Submit question mutation
  const {
    mutate: submitQuestion,
    isLoading: askLoading,
    error: askError,
  } = useApiMutation<AskInput, AskResponse>("/api/ask", "POST");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;

    setLastAnswer(null);

    const result = await submitQuestion({
      question: question.trim(),
      conversationId: activeConversation ?? undefined,
    });

    if (result) {
      setLastAnswer(result);
      setQuestion("");
      // Refresh conversations to show new/updated conversation
      refetchConversations();
    }
  }

  function handleNextQuestion(q: string) {
    setQuestion(q);
  }

  const conversations = conversationsData?.conversations ?? [];
  const answer = lastAnswer?.data ?? null;

  useEffect(() => {
    function setQuestionFromLocation() {
      const queryQuestion = new URLSearchParams(window.location.search).get("q");
      if (!queryQuestion) return;

      setQuestion(queryQuestion);
      setActiveConversation(null);
    }

    function handleExternalQuery(event: Event) {
      const customEvent = event as CustomEvent<{ question?: string }>;
      const nextQuestion = customEvent.detail?.question;
      if (!nextQuestion) return;

      setQuestion(nextQuestion);
      setActiveConversation(null);
    }

    setQuestionFromLocation();
    window.addEventListener("popstate", setQuestionFromLocation);
    window.addEventListener("metricmind:ask-query", handleExternalQuery);

    return () => {
      window.removeEventListener("popstate", setQuestionFromLocation);
      window.removeEventListener("metricmind:ask-query", handleExternalQuery);
    };
  }, []);

  return (
    <div className="flex min-h-[calc(100vh-theme(spacing.16)-theme(spacing.12))] flex-col overflow-hidden lg:h-[calc(100vh-theme(spacing.16)-theme(spacing.12))] lg:flex-row">
      {/* Left Sidebar - Conversation List */}
      <aside className="flex max-h-72 w-full shrink-0 flex-col border-b border-[#E5E7EB] bg-white lg:max-h-none lg:w-72 lg:border-b-0 lg:border-r" aria-label="Conversation history">
        <div className="p-4 border-b border-[#E5E7EB]">
          <Button
            className="w-full"
            size="sm"
            aria-label="Start new conversation"
            onClick={() => setActiveConversation(null)}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Conversation
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2" aria-label="Past conversations">
          {conversationsLoading && (
            <LoadingSkeleton lines={5} className="p-2" />
          )}
          {conversationsError && (
            <ErrorState message={conversationsError} onRetry={refetchConversations} />
          )}
          {!conversationsLoading && !conversationsError && (
            <ul className="space-y-1">
              {conversations.map((conv) => (
                <li key={conv.id}>
                  <button
                    type="button"
                    onClick={() => setActiveConversation(conv.id)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      activeConversation === conv.id
                        ? "bg-[#F0F7FF] border border-blue-200"
                        : "hover:bg-gray-50"
                    }`}
                    aria-current={activeConversation === conv.id ? "true" : undefined}
                  >
                    <div className="flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#111827] truncate">
                          {conv.title ?? "Untitled conversation"}
                        </p>
                        <p className="text-xs text-[#4B5563] mt-1">
                          {formatRelativeTime(conv.updated_at)}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>
      </aside>

      {/* Center Content */}
      <div className="flex min-h-[560px] flex-1 flex-col min-w-0" role="region" aria-label="AI answer area">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* Messages for selected conversation */}
          {activeConversation && messagesLoading && (
            <LoadingSkeleton lines={6} className="mb-6" />
          )}

          {activeConversation && messagesData && !messagesLoading && (
            <div className="space-y-4 mb-6">
              {messagesData.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg text-sm ${
                    msg.role === "user"
                      ? "bg-[#F0F7FF] text-[#111827] sm:ml-12"
                      : "bg-gray-50 text-[#4B5563] sm:mr-12"
                  }`}
                >
                  {msg.content}
                </div>
              ))}
            </div>
          )}

          {/* Loading Skeleton for answer */}
          {askLoading && (
            <div className="space-y-4 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-1/4" />
              <div className="h-24 bg-gray-200 rounded w-full mt-4" />
              <div className="flex flex-col gap-4 mt-4 sm:flex-row">
                <div className="h-20 bg-gray-200 rounded flex-1" />
                <div className="h-20 bg-gray-200 rounded flex-1" />
                <div className="h-20 bg-gray-200 rounded flex-1" />
              </div>
            </div>
          )}

          {/* Error State */}
          {askError && !askLoading && (
            <ErrorState message={askError} />
          )}

          {/* Answer Display */}
          {answer && !askLoading && (
            <div className="space-y-6">
              {/* Confidence */}
              {answer.confidence && (
                <div className="flex items-start justify-between gap-4">
                  <h1 className="text-xl font-semibold text-[#111827]">
                    Answer
                  </h1>
                  <Badge variant="success" className="shrink-0 whitespace-nowrap">
                    {formatConfidence(answer.confidence)} confidence
                  </Badge>
                </div>
              )}

              {/* AI Summary */}
              <p className="text-sm text-[#4B5563] leading-relaxed">
                {answer.summary}
              </p>

              {/* Metric Cards */}
              {answer.metrics && answer.metrics.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {answer.metrics.map((metric) => (
                    <div
                      key={metric.label}
                      className="bg-white border border-[#E5E7EB] rounded-xl p-4"
                    >
                      <p className="text-xs text-[#4B5563] font-medium uppercase tracking-wide">
                        {metric.label}
                      </p>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-bold text-[#111827]">
                          {metric.value}
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            metric.trend === "up" ? "text-red-600" : "text-green-600"
                          }`}
                        >
                          {metric.trend === "up" ? "↑" : "↓"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Chart */}
              {answer.chartData && answer.chartData.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-[#111827] mb-3">
                    Results Chart
                  </h2>
                  <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
                    <SimpleBarChart
                      data={answer.chartData}
                      xKey={Object.keys(answer.chartData[0])[0]}
                      yKeys={Object.keys(answer.chartData[0]).slice(1)}
                      colors={["#2563EB"]}
                      height={250}
                      aria-label="Bar chart showing query results"
                    />
                  </div>
                </section>
              )}

              {/* Generated SQL (Collapsible) */}
              <section>
                <button
                  type="button"
                  onClick={() => setSqlExpanded(!sqlExpanded)}
                  className="flex items-center gap-2 text-sm font-semibold text-[#111827] hover:text-[#2563EB] transition-colors"
                  aria-expanded={sqlExpanded}
                  aria-controls="generated-sql-panel"
                >
                  {sqlExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  Generated SQL
                </button>
                {sqlExpanded && (
                  <div
                    id="generated-sql-panel"
                    className="mt-3 bg-[#1E293B] rounded-xl p-4 overflow-x-auto"
                  >
                    <pre className="whitespace-pre-wrap break-words text-sm font-mono text-gray-200">
                      {answer.sql}
                    </pre>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>

        {/* Sticky Chat Input Bar */}
        <div className="border-t border-[#E5E7EB] bg-white p-4 shrink-0">
          <form onSubmit={handleSubmit} className="flex items-center gap-3">
            <label htmlFor="ask-input" className="sr-only">
              Ask a question about your data
            </label>
            <input
              id="ask-input"
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question about your data..."
              className="h-10 min-w-0 flex-1 rounded-lg border border-[#E5E7EB] bg-[#F6F8FB] px-4 text-sm text-[#111827] placeholder:text-[#4B5563] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
              disabled={askLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={askLoading || !question.trim()}
              aria-label="Send question"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* Right Panel */}
      <aside className="flex max-h-80 w-full shrink-0 flex-col overflow-y-auto border-t border-[#E5E7EB] bg-white lg:max-h-none lg:w-80 lg:border-l lg:border-t-0" aria-label="Answer details">
        {/* Citations */}
        {answer?.citations && answer.citations.length > 0 && (
          <section className="p-4 border-b border-[#E5E7EB]">
            <h2 className="text-sm font-semibold text-[#111827] mb-3">Citations</h2>
            <ul className="space-y-2">
              {answer.citations.map((citation, index) => (
                <li key={index}>
                  <a
                    href={citation.source}
                    className="flex items-center gap-2 text-sm text-[#2563EB] hover:underline"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] shrink-0" />
                    {citation.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Trace Steps */}
        {answer?.aiTrace && answer.aiTrace.steps.length > 0 && (
          <section className="p-4">
            <h2 className="text-sm font-semibold text-[#111827] mb-3">Trace Steps</h2>
            <ol className="space-y-2">
              {answer.aiTrace.steps.map((step, index) => (
                <li key={index} className="flex items-center gap-3 text-sm text-[#4B5563]">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#F0F7FF] text-[#2563EB] text-xs font-semibold shrink-0">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Empty state for right panel when no answer */}
        {!answer && !askLoading && (
          <div className="flex-1 flex items-center justify-center p-4">
            <p className="text-sm text-[#4B5563] text-center">
              Ask a question to see citations and trace details here.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
