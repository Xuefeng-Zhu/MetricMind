/**
 * AI Service implementation.
 *
 * The analyst model is constrained to SemanticQuery JSON. It never returns raw
 * SQL; the semantic compiler is the only code path that produces SQL.
 */

import { InsForgeDatabaseClient } from "@/lib/insforge/types";
import type { SemanticQuery } from "@/lib/semantic/types";
import { AIProvider, AIProviderConfig, Message } from "./provider";
import { createAIProvider } from "./provider-factory";

export interface SemanticContext {
  entities: Array<{
    name: string;
    slug?: string;
    description: string | null;
    dimensions?: string[];
  }>;
  metrics: Array<{
    name: string;
    slug?: string;
    formula: string;
    certified: boolean;
  }>;
  glossaryTerms: { name: string; definition: string }[];
}

export interface Citation {
  type: "metric" | "entity" | "dimension" | "measure" | "relationship" | "glossary";
  name: string;
  id: string;
}

export interface AITrace {
  id: string;
  promptTemplate: string;
  fullPrompt: string;
  rawResponse: string;
  durationMs: number;
  tokenCount: { input: number; output: number };
  model: string;
  timestamp: string;
}

export interface SemanticQueryGenerationInput {
  question: string;
  semanticContext: SemanticContext;
  conversationHistory?: Message[];
  workspaceId: string;
}

export interface SemanticQueryGenerationResult {
  semanticQuery: SemanticQuery | null;
  confidence: number;
  assumptions: string[];
  trace: AITrace;
}

export interface SummaryInput {
  question: string;
  sql: string;
  results: Record<string, unknown>[];
  workspaceId: string;
}

export interface SummaryResult {
  summary: string;
  trace: AITrace;
}

export interface ChatInput {
  message: string;
  conversationHistory: Message[];
  workspaceId: string;
}

export interface ChatResult {
  response: string;
  trace: AITrace;
}

export interface AIService {
  generateSemanticQuery(input: SemanticQueryGenerationInput): Promise<SemanticQueryGenerationResult>;
  generateSummary(input: SummaryInput): Promise<SummaryResult>;
  chat(input: ChatInput): Promise<ChatResult>;
}

const SEMANTIC_QUERY_GENERATION_TEMPLATE = `You are a semantic-query assistant for a business intelligence platform.
The user asks a business analytics question. Return SemanticQuery JSON only.

Respond with a JSON object containing:
- "semanticQuery": an object with keys:
  - "metrics": array of metric slugs
  - "dimensions": optional array of dimension slugs
  - "time": optional object { "dimension": string, "grain": "day"|"week"|"month"|"quarter"|"year" }
  - "filters": optional array of { "field": string, "operator": "eq"|"neq"|"gt"|"gte"|"lt"|"lte"|"in"|"not_in"|"contains"|"starts_with"|"ends_with"|"is_null"|"is_not_null", "value": string|number|boolean|null|array }
  - "orderBy": optional array of { "field": string, "direction": "asc"|"desc" }
  - "limit": optional positive integer
- "confidence": a number between 0.0 and 1.0
- "assumptions": an array of strings

Rules:
- Never return SQL.
- Never invent calculated expressions.
- Use only metrics, dimensions, and glossary concepts from the semantic context.
- Prefer certified metrics.

Semantic Context:
{{semanticContext}}

Question: {{question}}`;

const SUMMARY_GENERATION_TEMPLATE = `You are a data analyst assistant. Given the user's question, the compiled SQL query that was executed, and the query results, provide a clear and concise natural language summary.

Respond with a JSON object containing:
- "summary": a clear natural language summary of the results

Question: {{question}}
SQL: {{sql}}
Results: {{results}}`;

const CHAT_TEMPLATE = `You are a helpful data analytics assistant for a business intelligence platform.
Answer the user's message based on the conversation context.

Respond with a JSON object containing:
- "response": your response text`;

function generateId(): string {
  return crypto.randomUUID();
}

export function buildSemanticQueryPrompt(question: string, semanticContext: SemanticContext): string {
  const contextStr = JSON.stringify(
    {
      entities: semanticContext.entities.map((entity) => ({
        name: entity.name,
        slug: entity.slug,
        description: entity.description,
        dimensions: entity.dimensions ?? [],
      })),
      metrics: semanticContext.metrics.map((metric) => ({
        name: metric.name,
        slug: metric.slug,
        formula: metric.formula,
        certified: metric.certified,
      })),
      glossaryTerms: semanticContext.glossaryTerms.map((term) => ({
        name: term.name,
        definition: term.definition,
      })),
    },
    null,
    2
  );

  return SEMANTIC_QUERY_GENERATION_TEMPLATE.replace("{{semanticContext}}", contextStr).replace(
    "{{question}}",
    question
  );
}

export function buildSummaryPrompt(
  question: string,
  sql: string,
  results: Record<string, unknown>[]
): string {
  const resultsStr = JSON.stringify(results.slice(0, 20), null, 2);
  return SUMMARY_GENERATION_TEMPLATE.replace("{{question}}", question)
    .replace("{{sql}}", sql)
    .replace("{{results}}", resultsStr);
}

export function parseSemanticQueryResponse(
  rawContent: string
): { semanticQuery: SemanticQuery | null; confidence: number; assumptions: string[] } {
  try {
    const parsed = JSON.parse(rawContent);
    const candidate = parsed.semanticQuery ?? parsed;
    const semanticQuery = isSemanticQueryLike(candidate) ? candidate : null;
    const confidence =
      typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;
    const assumptions = Array.isArray(parsed.assumptions)
      ? parsed.assumptions.filter((assumption: unknown) => typeof assumption === "string")
      : [];

    return { semanticQuery, confidence: semanticQuery ? confidence : 0, assumptions };
  } catch {
    return {
      semanticQuery: null,
      confidence: 0,
      assumptions: ["Response was not valid SemanticQuery JSON"],
    };
  }
}

function isSemanticQueryLike(value: unknown): value is SemanticQuery {
  if (!value || typeof value !== "object") return false;
  const query = value as Record<string, unknown>;
  return Array.isArray(query.metrics) && query.metrics.every((metric) => typeof metric === "string");
}

export function parseSummaryResponse(rawContent: string): string {
  try {
    const parsed = JSON.parse(rawContent);
    if (typeof parsed.summary === "string") return parsed.summary;
    if (typeof parsed.response === "string") return parsed.response;
    return rawContent;
  } catch {
    return rawContent;
  }
}

export function parseChatResponse(rawContent: string): string {
  try {
    const parsed = JSON.parse(rawContent);
    if (typeof parsed.response === "string") return parsed.response;
    if (typeof parsed.message === "string") return parsed.message;
    return rawContent;
  } catch {
    return rawContent;
  }
}

async function storeTrace(
  insforge: InsForgeDatabaseClient,
  trace: AITrace,
  workspaceId: string,
  confidence?: number,
  citations?: Citation[],
  assumptions?: string[]
): Promise<void> {
  await insforge.from("ai_traces").insert({
    id: trace.id,
    workspace_id: workspaceId,
    prompt_template: trace.promptTemplate,
    full_prompt: trace.fullPrompt,
    raw_response: trace.rawResponse,
    duration_ms: trace.durationMs,
    input_tokens: trace.tokenCount.input,
    output_tokens: trace.tokenCount.output,
    model: trace.model,
    confidence_score: confidence ?? null,
    citations: citations ?? null,
    assumptions: assumptions ?? null,
    created_at: trace.timestamp,
  });
}

export async function callWithRetry(
  provider: AIProvider,
  messages: Message[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<{ content: string; model: string; usage: { inputTokens: number; outputTokens: number } } | { error: string }> {
  try {
    return await provider.complete(messages, options);
  } catch {
    try {
      return await provider.complete(messages, options);
    } catch (secondError) {
      const errorMessage =
        secondError instanceof Error ? secondError.message : "Unknown AI provider error";
      return {
        error: `AI service is temporarily unavailable. Please try again later. (${errorMessage})`,
      };
    }
  }
}

export function createAIService(insforge: InsForgeDatabaseClient, config?: AIProviderConfig): AIService {
  const provider = createAIProvider(config);

  return {
    async generateSemanticQuery(input: SemanticQueryGenerationInput): Promise<SemanticQueryGenerationResult> {
      const startTime = Date.now();
      const traceId = generateId();
      const promptTemplate = SEMANTIC_QUERY_GENERATION_TEMPLATE;
      const fullPrompt = buildSemanticQueryPrompt(input.question, input.semanticContext);
      const messages: Message[] = [];

      if (input.conversationHistory && input.conversationHistory.length > 0) {
        messages.push(...input.conversationHistory);
      }

      messages.push({ role: "system", content: fullPrompt });
      messages.push({ role: "user", content: input.question });

      const result = await callWithRetry(provider, messages, { temperature: 0.1, maxTokens: 800 });
      const durationMs = Date.now() - startTime;

      if ("error" in result) {
        const trace = buildTrace(traceId, promptTemplate, fullPrompt, result.error, durationMs, "unknown", 0, 0);
        await storeTrace(insforge, trace, input.workspaceId, 0, [], ["AI service encountered an error"]);
        return {
          semanticQuery: null,
          confidence: 0,
          assumptions: ["AI service encountered an error"],
          trace,
        };
      }

      const parsed = parseSemanticQueryResponse(result.content);
      const trace = buildTrace(
        traceId,
        promptTemplate,
        fullPrompt,
        result.content,
        durationMs,
        result.model,
        result.usage.inputTokens,
        result.usage.outputTokens
      );

      await storeTrace(insforge, trace, input.workspaceId, parsed.confidence, [], parsed.assumptions);

      return { ...parsed, trace };
    },

    async generateSummary(input: SummaryInput): Promise<SummaryResult> {
      const startTime = Date.now();
      const traceId = generateId();
      const promptTemplate = SUMMARY_GENERATION_TEMPLATE;
      const fullPrompt = buildSummaryPrompt(input.question, input.sql, input.results);
      const messages: Message[] = [
        { role: "system", content: fullPrompt },
        { role: "user", content: `Summarize the results for: ${input.question}` },
      ];

      const result = await callWithRetry(provider, messages);
      const durationMs = Date.now() - startTime;

      if ("error" in result) {
        const trace = buildTrace(traceId, promptTemplate, fullPrompt, result.error, durationMs, "unknown", 0, 0);
        await storeTrace(insforge, trace, input.workspaceId);
        return {
          summary: "Unable to generate summary at this time. Please try again later.",
          trace,
        };
      }

      const summary = parseSummaryResponse(result.content);
      const trace = buildTrace(
        traceId,
        promptTemplate,
        fullPrompt,
        result.content,
        durationMs,
        result.model,
        result.usage.inputTokens,
        result.usage.outputTokens
      );

      await storeTrace(insforge, trace, input.workspaceId);
      return { summary, trace };
    },

    async chat(input: ChatInput): Promise<ChatResult> {
      const startTime = Date.now();
      const traceId = generateId();
      const promptTemplate = CHAT_TEMPLATE;
      const fullPrompt = CHAT_TEMPLATE;
      const messages: Message[] = [
        { role: "system", content: fullPrompt },
        ...input.conversationHistory,
        { role: "user", content: input.message },
      ];

      const result = await callWithRetry(provider, messages);
      const durationMs = Date.now() - startTime;

      if ("error" in result) {
        const trace = buildTrace(traceId, promptTemplate, fullPrompt, result.error, durationMs, "unknown", 0, 0);
        await storeTrace(insforge, trace, input.workspaceId);
        return {
          response: "I apologize, but I am unable to respond at this time. Please try again later.",
          trace,
        };
      }

      const response = parseChatResponse(result.content);
      const trace = buildTrace(
        traceId,
        promptTemplate,
        fullPrompt,
        result.content,
        durationMs,
        result.model,
        result.usage.inputTokens,
        result.usage.outputTokens
      );

      await storeTrace(insforge, trace, input.workspaceId);
      return { response, trace };
    },
  };
}

function buildTrace(
  id: string,
  promptTemplate: string,
  fullPrompt: string,
  rawResponse: string,
  durationMs: number,
  model: string,
  inputTokens: number,
  outputTokens: number
): AITrace {
  return {
    id,
    promptTemplate,
    fullPrompt,
    rawResponse,
    durationMs,
    tokenCount: { input: inputTokens, output: outputTokens },
    model,
    timestamp: new Date().toISOString(),
  };
}
