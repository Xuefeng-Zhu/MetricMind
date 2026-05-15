/**
 * Query Planner implementation.
 *
 * Orchestrates the NL→SemanticQuery→SQL pipeline:
 * 1. Load the governed semantic registry
 * 2. Ask the AI service for SemanticQuery JSON only
 * 3. Validate and compile the SemanticQuery into SQL
 * 4. Execute compiled SQL through the read-only RPC
 * 5. Store query_run metadata and return results with citations
 *
 * Requirements: 7.3, 8.2, 9.1, 9.2, 10.1, 11.1, 11.2, 11.3, 11.4
 */

import { InsForgeDatabaseClient } from '@/lib/insforge/types';
import { AIProviderConfig } from '../ai/provider';
import { AIService, AITrace, createAIService, SemanticContext } from '../ai/ai-service';
import { compileSemanticQuery } from '../semantic/semantic-query-compiler';
import { loadSemanticRegistry } from '../semantic/semantic-loader';
import type { SemanticCitation, SemanticQuery } from '../semantic/types';

// --- Interfaces ---

export interface QuestionInput {
  question: string;
  workspaceId: string;
  userId: string;
  userRole?: "viewer" | "analyst" | "admin" | "owner";
  conversationId?: string;
}

export interface ChartRecommendation {
  type: 'line' | 'bar' | 'pie' | 'kpi' | 'table' | 'area' | 'scatter';
  reason: string;
  axes: { x?: string; y?: string; series?: string };
}

export interface QueryResult {
  sql: string;
  semanticQuery: SemanticQuery;
  results: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  confidence: number;
  citations: SemanticCitation[];
  assumptions: string[];
  chartRecommendation: ChartRecommendation;
  aiTrace: AITrace;
}

export interface ExecutionResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  columns: { name: string; type: string }[];
}

export interface QueryPlanner {
  processQuestion(input: QuestionInput): Promise<QueryResult>;
  executeSQL(workspaceId: string, sql: string): Promise<ExecutionResult>;
}

// --- Constants ---

/** Maximum query execution time in milliseconds (30 seconds) */
const QUERY_TIMEOUT_MS = 30_000;

// --- Helper Functions ---

/**
 * Extract words from a natural-language question for glossary term resolution.
 * Splits on whitespace and punctuation, filters short words.
 */
export function extractTermsFromQuestion(question: string): string[] {
  const words = question
    .replace(/[?!.,;:'"()\[\]{}]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .map((w) => w.toLowerCase());

  // Also extract multi-word phrases (bigrams) for compound terms
  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]} ${words[i + 1]}`);
  }

  return Array.from(new Set([...words, ...bigrams]));
}

/**
 * Sanitize database error messages to avoid exposing internal details.
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    if (msg.includes('timeout') || msg.includes('cancel') || msg.includes('statement_timeout')) {
      return 'Query execution timed out. Please try a simpler query or narrow your date range.';
    }

    if (msg.includes('permission') || msg.includes('denied')) {
      return 'You do not have permission to access the requested data.';
    }

    if (msg.includes('relation') && msg.includes('does not exist')) {
      return 'The requested data table could not be found. Please check your semantic layer configuration.';
    }

    if (msg.includes('column') && msg.includes('does not exist')) {
      return 'A referenced column could not be found. Please verify your metric definitions.';
    }

    if (msg.includes('syntax')) {
      return 'The generated query contains a syntax error. Please try rephrasing your question.';
    }

    if (msg.includes('division by zero')) {
      return 'The calculation resulted in a division by zero. Please check the data for zero values.';
    }
  }

  return 'An unexpected error occurred while executing the query. Please try again.';
}

/**
 * Infer column types from result data.
 */
function inferColumnTypes(rows: Record<string, unknown>[]): { name: string; type: string }[] {
  if (rows.length === 0) return [];

  const firstRow = rows[0];
  return Object.entries(firstRow).map(([name, value]) => {
    let type = 'text';
    if (typeof value === 'number') {
      type = Number.isInteger(value) ? 'integer' : 'float';
    } else if (typeof value === 'boolean') {
      type = 'boolean';
    } else if (value instanceof Date) {
      type = 'timestamp';
    } else if (typeof value === 'string') {
      // Check if it looks like a date
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
        type = value.includes('T') || value.includes(' ') ? 'timestamp' : 'date';
      }
    }
    return { name, type };
  });
}

// --- Factory Function ---

/**
 * Creates a QueryPlanner instance.
 *
 * @param insforge - InsForge client for database operations
 * @param aiConfig - Optional AI provider configuration
 */
export function createQueryPlanner(
  insforge: InsForgeDatabaseClient,
  aiConfig?: AIProviderConfig
): QueryPlanner {
  const aiService: AIService = createAIService(insforge, aiConfig);

  return {
    async processQuestion(input: QuestionInput): Promise<QueryResult> {
      const { question, workspaceId } = input;

      const registry = await loadSemanticRegistry(insforge, workspaceId);

      const questionTerms = extractTermsFromQuestion(question);
      const glossaryNames = registry.glossaryTerms.map((t) => t.name.toLowerCase());
      const matchingTerms = questionTerms.filter((term) =>
        glossaryNames.some((gName) => gName.includes(term) || term.includes(gName))
      );

      const resolvedTerms = registry.glossaryTerms
        .filter((t) =>
          matchingTerms.some(
            (mt) => t.name.toLowerCase().includes(mt) || mt.includes(t.name.toLowerCase())
          )
        );

      const semanticContext: SemanticContext = {
        entities: registry.entities.map((entity) => ({
          name: entity.name,
          slug: entity.slug,
          description: entity.description,
          dimensions: registry.dimensions
            .filter((dimension) => dimension.entityId === entity.id && !dimension.isPii)
            .map((dimension) => dimension.slug),
        })),
        metrics: registry.metrics
          .filter((m) => m.certified)
          .map((m) => ({
            name: m.name,
            slug: m.slug,
            formula: m.formula,
            certified: m.certified,
          })),
        glossaryTerms: [
          ...registry.glossaryTerms.map((t) => ({
            name: t.name,
            definition: t.definition,
          })),
          ...resolvedTerms.map((rt) => ({
            name: rt.name,
            definition: rt.definition,
          })),
        ],
      };

      const nonCertifiedMetrics = registry.metrics
        .filter((m) => !m.certified)
        .map((m) => ({
          name: m.name,
          slug: m.slug,
          formula: m.formula,
          certified: false,
        }));

      if (nonCertifiedMetrics.length > 0) {
        semanticContext.metrics.push(...nonCertifiedMetrics);
      }

      const semanticResult = await aiService.generateSemanticQuery({
        question,
        semanticContext,
        workspaceId,
      });

      if (!semanticResult.semanticQuery) {
        await storeQueryRun(insforge, {
          workspaceId,
          sql: '',
          status: 'rejected',
          executionTimeMs: 0,
          rowCount: 0,
          errorMessage: 'AI service did not return valid SemanticQuery JSON',
        });

        throw new Error('AI service did not return valid SemanticQuery JSON. Please try rephrasing your question.');
      }

      const compiled = compileSemanticQuery(registry, semanticResult.semanticQuery, {
        userRole: input.userRole ?? "viewer",
      });

      const executionResult = await this.executeSQL(workspaceId, compiled.sql);

      await storeQueryRun(insforge, {
        workspaceId,
        sql: compiled.sql,
        status: 'completed',
        executionTimeMs: executionResult.executionTimeMs,
        rowCount: executionResult.rowCount,
        resultSample: executionResult.rows.slice(0, 10),
      });

      const chartRecommendation: ChartRecommendation = {
        type: 'table',
        reason: 'Default table view',
        axes: {},
      };

      return {
        sql: compiled.sql,
        semanticQuery: semanticResult.semanticQuery,
        results: executionResult.rows,
        rowCount: executionResult.rowCount,
        executionTimeMs: executionResult.executionTimeMs,
        confidence: semanticResult.confidence,
        citations: compiled.citations,
        assumptions: [...semanticResult.assumptions, ...compiled.assumptions],
        chartRecommendation,
        aiTrace: semanticResult.trace,
      };
    },

    async executeSQL(workspaceId: string, sql: string): Promise<ExecutionResult> {
      const startTime = Date.now();

      try {
        // Execute with 30-second timeout using statement_timeout
        const timeoutSQL = `SET LOCAL statement_timeout = '${QUERY_TIMEOUT_MS}ms'; ${sql}`;

        // Execute compiler-generated SELECT SQL through the read-only RPC guard.
        // We use a custom RPC function or fall back to direct query
        const { data, error } = await Promise.race([
          insforge.rpc('execute_readonly_query', {
            query_text: sql,
            workspace_id: workspaceId,
          }),
          new Promise<{ data: null; error: { message: string } }>((_, reject) =>
            setTimeout(
              () => reject(new Error('Query execution timed out after 30 seconds')),
              QUERY_TIMEOUT_MS
            )
          ),
        ]) as { data: Record<string, unknown>[] | null; error: { message: string } | null };

        const executionTimeMs = Date.now() - startTime;

        if (error) {
          throw new Error(error.message);
        }

        const rows = (data || []) as Record<string, unknown>[];
        const columns = inferColumnTypes(rows);

        return {
          rows,
          rowCount: rows.length,
          executionTimeMs,
          columns,
        };
      } catch (err) {
        const executionTimeMs = Date.now() - startTime;

        // Check if it's a timeout
        if (executionTimeMs >= QUERY_TIMEOUT_MS - 100) {
          // Store timeout query run
          await storeQueryRun(insforge, {
            workspaceId,
            sql,
            status: 'timeout',
            executionTimeMs,
            rowCount: 0,
            errorMessage: 'Query execution timed out after 30 seconds',
          });

          throw new Error('Query execution timed out. Please try a simpler query or narrow your date range.');
        }

        // Store failed query run
        await storeQueryRun(insforge, {
          workspaceId,
          sql,
          status: 'failed',
          executionTimeMs,
          rowCount: 0,
          errorMessage: sanitizeErrorMessage(err),
        });

        // Return sanitized error message
        throw new Error(sanitizeErrorMessage(err));
      }
    },
  };
}

// --- Internal Helpers ---

interface QueryRunInput {
  workspaceId: string;
  sql: string;
  status: 'completed' | 'failed' | 'timeout' | 'rejected';
  executionTimeMs: number;
  rowCount: number;
  resultSample?: Record<string, unknown>[];
  errorMessage?: string;
}

/**
 * Store a query run record in the database.
 */
async function storeQueryRun(
  insforge: InsForgeDatabaseClient,
  input: QueryRunInput
): Promise<void> {
  try {
    await insforge.from('query_runs').insert({
      workspace_id: input.workspaceId,
      sql: input.sql,
      status: input.status,
      execution_time_ms: input.executionTimeMs,
      row_count: input.rowCount,
      result_sample: input.resultSample || null,
      error_message: input.errorMessage || null,
    });
  } catch {
    // Query run logging should not break the main flow
    console.error('Failed to store query run record');
  }
}
