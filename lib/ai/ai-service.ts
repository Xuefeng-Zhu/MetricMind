/**
 * AI Service implementation.
 *
 * Provides generateSQL, generateSummary, and chat methods with:
 * - Confidence score generation (0.0-1.0)
 * - Citation generation linking to metrics, entities, and data sources
 * - Assumption listing
 * - AI trace records for every AI call
 * - Retry logic (one retry on provider error, then graceful error message)
 * - Server-side only execution (never expose API keys to client)
 */

import { InsForgeDatabaseClient } from '@/lib/insforge/types';
import { AIProvider, AIProviderConfig, Message } from './provider';
import { createAIProvider } from './provider-factory';

// --- Interfaces ---

export interface SemanticContext {
  entities: { name: string; description: string | null }[];
  metrics: { name: string; formula: string; certified: boolean }[];
  glossaryTerms: { name: string; definition: string }[];
}

export interface Citation {
  type: 'metric' | 'entity' | 'data_source';
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

export interface SQLGenerationInput {
  question: string;
  semanticContext: SemanticContext;
  conversationHistory?: Message[];
  workspaceId: string;
}

export interface SQLGenerationResult {
  sql: string;
  confidence: number;
  citations: Citation[];
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
  generateSQL(input: SQLGenerationInput): Promise<SQLGenerationResult>;
  generateSummary(input: SummaryInput): Promise<SummaryResult>;
  chat(input: ChatInput): Promise<ChatResult>;
}

// --- Prompt Templates ---

const SQL_GENERATION_TEMPLATE = `You are a SQL generation assistant for a business intelligence platform.
Given the user's question and the semantic context (entities, metrics, glossary terms),
generate a valid SQL SELECT query that answers the question.

Respond with a JSON object containing:
- "sql": the generated SQL query (SELECT only)
- "confidence": a number between 0.0 and 1.0 indicating your certainty
- "citations": an array of objects with "type" (metric|entity|data_source), "name", and "id"
- "assumptions": an array of strings listing any assumptions made

Semantic Context:
{{semanticContext}}

Question: {{question}}`;

const SUMMARY_GENERATION_TEMPLATE = `You are a data analyst assistant. Given the user's question, the SQL query that was executed, and the query results, provide a clear and concise natural language summary of the findings.

Respond with a JSON object containing:
- "summary": a clear natural language summary of the results

Question: {{question}}
SQL: {{sql}}
Results: {{results}}`;

const CHAT_TEMPLATE = `You are a helpful data analytics assistant for a business intelligence platform.
Answer the user's message based on the conversation context.

Respond with a JSON object containing:
- "response": your response text`;

// --- Helper Functions ---

/**
 * Generates a UUID v4 string.
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Builds the system prompt for SQL generation with semantic context injected.
 */
export function buildSQLPrompt(question: string, semanticContext: SemanticContext): string {
  const contextStr = JSON.stringify(
    {
      entities: semanticContext.entities.map((e) => ({
        name: e.name,
        description: e.description,
      })),
      metrics: semanticContext.metrics.map((m) => ({
        name: m.name,
        formula: m.formula,
        certified: m.certified,
      })),
      glossaryTerms: semanticContext.glossaryTerms.map((t) => ({
        name: t.name,
        definition: t.definition,
      })),
    },
    null,
    2
  );

  return SQL_GENERATION_TEMPLATE.replace('{{semanticContext}}', contextStr).replace(
    '{{question}}',
    question
  );
}

/**
 * Builds the system prompt for summary generation.
 */
export function buildSummaryPrompt(
  question: string,
  sql: string,
  results: Record<string, unknown>[]
): string {
  const resultsStr = JSON.stringify(results.slice(0, 20), null, 2); // Limit to 20 rows for prompt size
  return SUMMARY_GENERATION_TEMPLATE.replace('{{question}}', question)
    .replace('{{sql}}', sql)
    .replace('{{results}}', resultsStr);
}

/**
 * Parses the AI provider response for SQL generation.
 * Extracts sql, confidence, citations, and assumptions from the JSON response.
 * Falls back to defaults if parsing fails.
 */
export function parseSQLResponse(
  rawContent: string,
  semanticContext: SemanticContext
): { sql: string; confidence: number; citations: Citation[]; assumptions: string[] } {
  try {
    const parsed = JSON.parse(rawContent);
    const sql = typeof parsed.sql === 'string' ? parsed.sql : 'SELECT 1';
    const confidence = typeof parsed.confidence === 'number'
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0.5;
    const citations = Array.isArray(parsed.citations)
      ? parsed.citations.filter(
          (c: unknown) =>
            c &&
            typeof c === 'object' &&
            'type' in (c as object) &&
            'name' in (c as object) &&
            'id' in (c as object)
        )
      : generateCitations(sql, semanticContext);
    const assumptions = Array.isArray(parsed.assumptions)
      ? parsed.assumptions.filter((a: unknown) => typeof a === 'string')
      : [];

    return { sql, confidence, citations, assumptions };
  } catch {
    // If the response isn't valid JSON, try to extract SQL from the raw text
    return {
      sql: rawContent.trim() || 'SELECT 1',
      confidence: 0.3,
      citations: generateCitations(rawContent, semanticContext),
      assumptions: ['Response could not be fully parsed; confidence is reduced'],
    };
  }
}

/**
 * Parses the AI provider response for summary generation.
 */
export function parseSummaryResponse(rawContent: string): string {
  try {
    const parsed = JSON.parse(rawContent);
    if (typeof parsed.summary === 'string') {
      return parsed.summary;
    }
    if (typeof parsed.response === 'string') {
      return parsed.response;
    }
    return rawContent;
  } catch {
    return rawContent;
  }
}

/**
 * Parses the AI provider response for chat.
 */
export function parseChatResponse(rawContent: string): string {
  try {
    const parsed = JSON.parse(rawContent);
    if (typeof parsed.response === 'string') {
      return parsed.response;
    }
    if (typeof parsed.message === 'string') {
      return parsed.message;
    }
    return rawContent;
  } catch {
    return rawContent;
  }
}

/**
 * Generates citations by matching SQL content against semantic context.
 */
export function generateCitations(sql: string, semanticContext: SemanticContext): Citation[] {
  const citations: Citation[] = [];
  const lowerSql = sql.toLowerCase();

  for (const metric of semanticContext.metrics) {
    if (lowerSql.includes(metric.name.toLowerCase())) {
      citations.push({
        type: 'metric',
        name: metric.name,
        id: metric.name, // Use name as fallback ID
      });
    }
  }

  for (const entity of semanticContext.entities) {
    if (lowerSql.includes(entity.name.toLowerCase())) {
      citations.push({
        type: 'entity',
        name: entity.name,
        id: entity.name, // Use name as fallback ID
      });
    }
  }

  return citations;
}

/**
 * Stores an AI trace record in the database.
 */
async function storeTrace(
  insforge: InsForgeDatabaseClient,
  trace: AITrace,
  workspaceId: string,
  confidence?: number,
  citations?: Citation[],
  assumptions?: string[]
): Promise<void> {
  await insforge.from('ai_traces').insert({
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

/**
 * Calls the AI provider with retry logic.
 * Retries once on provider error, then returns a graceful error.
 */
export async function callWithRetry(
  provider: AIProvider,
  messages: Message[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<{ content: string; model: string; usage: { inputTokens: number; outputTokens: number } } | { error: string }> {
  try {
    return await provider.complete(messages, options);
  } catch (firstError) {
    // Retry once
    try {
      return await provider.complete(messages, options);
    } catch (secondError) {
      const errorMessage =
        secondError instanceof Error ? secondError.message : 'Unknown AI provider error';
      return {
        error: `AI service is temporarily unavailable. Please try again later. (${errorMessage})`,
      };
    }
  }
}

// --- Factory ---

/**
 * Creates an AIService instance.
 *
 * @param insforge - InsForge client for storing AI traces
 * @param config - Optional AI provider configuration. If not provided, uses MockAIProvider.
 */
export function createAIService(insforge: InsForgeDatabaseClient, config?: AIProviderConfig): AIService {
  const provider = createAIProvider(config);

  return {
    async generateSQL(input: SQLGenerationInput): Promise<SQLGenerationResult> {
      const startTime = Date.now();
      const traceId = generateId();
      const promptTemplate = SQL_GENERATION_TEMPLATE;
      const fullPrompt = buildSQLPrompt(input.question, input.semanticContext);

      // Build messages array
      const messages: Message[] = [];

      // Include conversation history if provided
      if (input.conversationHistory && input.conversationHistory.length > 0) {
        messages.push(...input.conversationHistory);
      }

      messages.push({ role: 'system', content: fullPrompt });
      messages.push({ role: 'user', content: input.question });

      // Call provider with retry
      const result = await callWithRetry(provider, messages);
      const durationMs = Date.now() - startTime;

      // Handle error case
      if ('error' in result) {
        const trace: AITrace = {
          id: traceId,
          promptTemplate,
          fullPrompt,
          rawResponse: result.error,
          durationMs,
          tokenCount: { input: 0, output: 0 },
          model: 'unknown',
          timestamp: new Date().toISOString(),
        };

        // Store trace even on error
        await storeTrace(insforge, trace, input.workspaceId, 0, [], []);

        return {
          sql: '',
          confidence: 0,
          citations: [],
          assumptions: ['AI service encountered an error'],
          trace,
        };
      }

      // Parse the response
      const { sql, confidence, citations, assumptions } = parseSQLResponse(
        result.content,
        input.semanticContext
      );

      const trace: AITrace = {
        id: traceId,
        promptTemplate,
        fullPrompt,
        rawResponse: result.content,
        durationMs,
        tokenCount: { input: result.usage.inputTokens, output: result.usage.outputTokens },
        model: result.model,
        timestamp: new Date().toISOString(),
      };

      // Store trace record
      await storeTrace(insforge, trace, input.workspaceId, confidence, citations, assumptions);

      return { sql, confidence, citations, assumptions, trace };
    },

    async generateSummary(input: SummaryInput): Promise<SummaryResult> {
      const startTime = Date.now();
      const traceId = generateId();
      const promptTemplate = SUMMARY_GENERATION_TEMPLATE;
      const fullPrompt = buildSummaryPrompt(input.question, input.sql, input.results);

      const messages: Message[] = [
        { role: 'system', content: fullPrompt },
        { role: 'user', content: `Summarize the results for: ${input.question}` },
      ];

      // Call provider with retry
      const result = await callWithRetry(provider, messages);
      const durationMs = Date.now() - startTime;

      // Handle error case
      if ('error' in result) {
        const trace: AITrace = {
          id: traceId,
          promptTemplate,
          fullPrompt,
          rawResponse: result.error,
          durationMs,
          tokenCount: { input: 0, output: 0 },
          model: 'unknown',
          timestamp: new Date().toISOString(),
        };

        await storeTrace(insforge, trace, input.workspaceId);

        return {
          summary: 'Unable to generate summary at this time. Please try again later.',
          trace,
        };
      }

      const summary = parseSummaryResponse(result.content);

      const trace: AITrace = {
        id: traceId,
        promptTemplate,
        fullPrompt,
        rawResponse: result.content,
        durationMs,
        tokenCount: { input: result.usage.inputTokens, output: result.usage.outputTokens },
        model: result.model,
        timestamp: new Date().toISOString(),
      };

      await storeTrace(insforge, trace, input.workspaceId);

      return { summary, trace };
    },

    async chat(input: ChatInput): Promise<ChatResult> {
      const startTime = Date.now();
      const traceId = generateId();
      const promptTemplate = CHAT_TEMPLATE;
      const fullPrompt = CHAT_TEMPLATE;

      // Build messages from conversation history + new message
      const messages: Message[] = [
        { role: 'system', content: fullPrompt },
        ...input.conversationHistory,
        { role: 'user', content: input.message },
      ];

      // Call provider with retry
      const result = await callWithRetry(provider, messages);
      const durationMs = Date.now() - startTime;

      // Handle error case
      if ('error' in result) {
        const trace: AITrace = {
          id: traceId,
          promptTemplate,
          fullPrompt,
          rawResponse: result.error,
          durationMs,
          tokenCount: { input: 0, output: 0 },
          model: 'unknown',
          timestamp: new Date().toISOString(),
        };

        await storeTrace(insforge, trace, input.workspaceId);

        return {
          response: 'I apologize, but I am unable to respond at this time. Please try again later.',
          trace,
        };
      }

      const response = parseChatResponse(result.content);

      const trace: AITrace = {
        id: traceId,
        promptTemplate,
        fullPrompt,
        rawResponse: result.content,
        durationMs,
        tokenCount: { input: result.usage.inputTokens, output: result.usage.outputTokens },
        model: result.model,
        timestamp: new Date().toISOString(),
      };

      await storeTrace(insforge, trace, input.workspaceId);

      return { response, trace };
    },
  };
}
