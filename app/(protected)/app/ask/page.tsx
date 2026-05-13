"use client";

import { useState } from "react";
import { conversations, mockAnswer } from "@/lib/mock-data/conversations";
import { SimpleBarChart } from "@/components/charts/simple-bar-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Send, Plus, ChevronDown, ChevronRight, MessageSquare } from "lucide-react";

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

export default function AskPage() {
  const [activeConversation, setActiveConversation] = useState(conversations[0].id);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showAnswer, setShowAnswer] = useState(true);
  const [sqlExpanded, setSqlExpanded] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;

    setIsLoading(true);
    setShowAnswer(false);

    setTimeout(() => {
      setIsLoading(false);
      setShowAnswer(true);
      setQuestion("");
    }, 800);
  }

  function handleNextQuestion(q: string) {
    setQuestion(q);
  }

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16)-theme(spacing.12))]">
      {/* Left Sidebar - Conversation List */}
      <aside className="w-72 bg-white border-r border-[#E5E7EB] flex flex-col shrink-0" aria-label="Conversation history">
        <div className="p-4 border-b border-[#E5E7EB]">
          <Button className="w-full" size="sm" aria-label="Start new conversation">
            <Plus className="h-4 w-4 mr-2" />
            New Conversation
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2" aria-label="Past conversations">
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
                        {conv.title}
                      </p>
                      <p className="text-xs text-[#4B5563] truncate mt-0.5">
                        {conv.lastMessage}
                      </p>
                      <p className="text-xs text-[#4B5563] mt-1">
                        {formatRelativeTime(conv.timestamp)}
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Center Content */}
      <div className="flex-1 flex flex-col min-w-0" role="region" aria-label="AI answer area">
        <div className="flex-1 overflow-y-auto p-6">
          {/* Loading Skeleton */}
          {isLoading && (
            <div className="space-y-4 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-1/4" />
              <div className="h-24 bg-gray-200 rounded w-full mt-4" />
              <div className="flex gap-4 mt-4">
                <div className="h-20 bg-gray-200 rounded flex-1" />
                <div className="h-20 bg-gray-200 rounded flex-1" />
                <div className="h-20 bg-gray-200 rounded flex-1" />
              </div>
            </div>
          )}

          {/* Answer Display */}
          {showAnswer && !isLoading && (
            <div className="space-y-6">
              {/* Question + Confidence */}
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-xl font-semibold text-[#111827]">
                  {mockAnswer.question}
                </h1>
                <Badge variant="success" className="shrink-0 whitespace-nowrap">
                  {mockAnswer.confidence}% confidence
                </Badge>
              </div>

              {/* AI Summary */}
              <p className="text-sm text-[#4B5563] leading-relaxed">
                {mockAnswer.summary}
              </p>

              {/* Metric Cards */}
              <div className="grid grid-cols-3 gap-4">
                {mockAnswer.metrics.map((metric) => (
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

              {/* Churn by Activation Cohort Chart */}
              <section>
                <h2 className="text-sm font-semibold text-[#111827] mb-3">
                  Churn by Activation Cohort
                </h2>
                <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
                  <SimpleBarChart
                    data={mockAnswer.chartData}
                    xKey="cohort"
                    yKeys={["churnRate"]}
                    colors={["#2563EB"]}
                    height={250}
                    aria-label="Bar chart showing churn rate by activation cohort from January to June 2024"
                  />
                </div>
              </section>

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
                    <pre className="text-sm font-mono text-gray-200 whitespace-pre-wrap">
                      {mockAnswer.sql}
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
              className="flex-1 h-10 px-4 rounded-lg border border-[#E5E7EB] bg-[#F6F8FB] text-sm text-[#111827] placeholder:text-[#4B5563] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !question.trim()}
              aria-label="Send question"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* Right Panel */}
      <aside className="w-80 bg-white border-l border-[#E5E7EB] flex flex-col shrink-0 overflow-y-auto" aria-label="Answer details">
        {/* Citations */}
        <section className="p-4 border-b border-[#E5E7EB]">
          <h2 className="text-sm font-semibold text-[#111827] mb-3">Citations</h2>
          <ul className="space-y-2">
            {mockAnswer.citations.map((citation, index) => (
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

        {/* Next Questions */}
        <section className="p-4 border-b border-[#E5E7EB]">
          <h2 className="text-sm font-semibold text-[#111827] mb-3">Next Questions</h2>
          <ul className="space-y-2">
            {mockAnswer.nextQuestions.map((q, index) => (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => handleNextQuestion(q)}
                  className="w-full text-left text-sm text-[#4B5563] hover:text-[#2563EB] hover:bg-[#F0F7FF] p-2 rounded-md transition-colors"
                >
                  {q}
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Trace Steps */}
        <section className="p-4">
          <h2 className="text-sm font-semibold text-[#111827] mb-3">Trace Steps</h2>
          <ol className="space-y-2">
            {mockAnswer.traceSteps.map((step, index) => (
              <li key={index} className="flex items-center gap-3 text-sm text-[#4B5563]">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#F0F7FF] text-[#2563EB] text-xs font-semibold shrink-0">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </div>
  );
}
