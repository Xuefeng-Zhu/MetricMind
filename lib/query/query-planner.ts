/**
 * Query Planner implementation.
 *
 * Orchestrates the NL→SQL pipeline:
 * 1. Retrieve semantic context from SemanticLayerService (entities, metrics, glossary terms)
 * 2. Resolve ambiguous terms via glossary (resolveTerms)
 * 3. Generate SQL via AIService.generateSQL
 * 4. Validate SQL via GovernanceEngine.validateSQL
 * 5. If validation fails, return error with governance explanation
 * 6. Execute SQL (with 30-second timeout)
 * 7. Store query_run record in database
 * 8. Return results with all metadata
 *
 * Requirements: 7.3, 8.2, 9.1, 9.2, 10.1, 11.1, 11.2, 11.3, 11.4
 */

import { InsForgeDatabaseClient } from '@/lib/insforge/types';
import { AIProviderConfig } from '../ai/provider';
import { AIService, AITrace, Citation, createAIService, SemanticContext } from '../ai/ai-service';
import { createSemanticLayerService, SemanticLayerService } from '../semantic/semantic-layer-service';
import { createGovernanceEngine, GovernanceEngine, GovernanceContext } from '../governance/governance-engine';

// --- Interfaces ---

export interface QuestionInput {
  question: string;
  workspaceId: string;
  userId: string;
  conversationId?: string;
}

export interface ChartRecommendation {
  type: 'line' | 'bar' | 'pie' | 'kpi' | 'table' | 'area' | 'scatter';
  reason: string;
  axes: { x?: string; y?: string; series?: string };
}

export interface QueryResult {
  sql: string;
  results: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  confidence: number;
  citations: Citation[];
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
 * Build a GovernanceContext from workspace semantic layer data.
 */
async function buildGovernanceContext(
  insforge: InsForgeDatabaseClient,
  workspaceId: string
): Promise<GovernanceContext> {
  // Get allowed tables from semantic entities (data source names)
  const { data: entities } = await insforge
    .from('semantic_entities')
    .select('name')
    .eq('workspace_id', workspaceId);

  // Get data source names as allowed tables
  const { data: dataSources } = await insforge
    .from('data_sources')
    .select('name')
    .eq('workspace_id', workspaceId);

  const allowedTables = [
    ...(entities || []).map((e: { name: string }) => e.name),
    ...(dataSources || []).map((ds: { name: string }) => ds.name),
  ];

  // Get all columns from dimensions and measures
  const { data: dimensions } = await insforge
    .from('dimensions')
    .select('source_column, entity_id')
    .in(
      'entity_id',
      (entities || []).map((e: { name: string }) => e.name)
    );

  const { data: measures } = await insforge
    .from('measures')
    .select('source_column, entity_id')
    .in(
      'entity_id',
      (entities || []).map((e: { name: string }) => e.name)
    );

  const allowedColumns = [
    ...(dimensions || []).map((d: { source_column: string }) => d.source_column),
    ...(measures || []).map((m: { source_column: string }) => m.source_column),
  ];

  return {
    workspaceId,
    allowedTables,
    allowedColumns,
    denyPatterns: [],
  };
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
  const semanticLayerService: SemanticLayerService = createSemanticLayerService(insforge);
  const governanceEngine: GovernanceEngine = createGovernanceEngine(insforge);

  return {
    async processQuestion(input: QuestionInput): Promise<QueryResult> {
      const { question, workspaceId, userId } = input;

      // Step 1: Retrieve semantic context (entities, metrics, glossary terms)
      const [entities, metrics, glossaryTerms] = await Promise.all([
        semanticLayerService.getEntities(workspaceId),
        semanticLayerService.getMetrics(workspaceId),
        semanticLayerService.getGlossaryTerms(workspaceId),
      ]);

      // Step 2: Resolve ambiguous terms via glossary
      const questionTerms = extractTermsFromQuestion(question);
      const glossaryNames = glossaryTerms.map((t) => t.name.toLowerCase());
      const matchingTerms = questionTerms.filter((term) =>
        glossaryNames.some((gName) => gName.includes(term) || term.includes(gName))
      );

      // Get the actual glossary term names that match
      const termsToResolve = glossaryTerms
        .filter((t) =>
          matchingTerms.some(
            (mt) => t.name.toLowerCase().includes(mt) || mt.includes(t.name.toLowerCase())
          )
        )
        .map((t) => t.name);

      const resolvedTerms = termsToResolve.length > 0
        ? await semanticLayerService.resolveTerms(workspaceId, termsToResolve)
        : [];

      // Build semantic context for AI service
      // Use certified metric definitions (Requirement 7.3)
      const semanticContext: SemanticContext = {
        entities: entities.map((e) => ({
          name: e.name,
          description: e.description,
        })),
        metrics: metrics
          .filter((m) => m.certified)
          .map((m) => ({
            name: m.name,
            formula: m.formula,
            certified: m.certified,
          })),
        glossaryTerms: [
          ...glossaryTerms.map((t) => ({
            name: t.name,
            definition: t.definition,
          })),
          ...resolvedTerms.map((rt) => ({
            name: rt.term,
            definition: rt.definition,
          })),
        ],
      };

      // Also include non-certified metrics but mark them as such
      const nonCertifiedMetrics = metrics
        .filter((m) => !m.certified)
        .map((m) => ({
          name: m.name,
          formula: m.formula,
          certified: false,
        }));

      if (nonCertifiedMetrics.length > 0) {
        semanticContext.metrics.push(...nonCertifiedMetrics);
      }

      // Step 3: Generate SQL via AI Service
      const sqlResult = await aiService.generateSQL({
        question,
        semanticContext,
        workspaceId,
      });

      // If AI service returned an error (empty SQL)
      if (!sqlResult.sql) {
        throw new Error('AI service was unable to generate a SQL query. Please try rephrasing your question.');
      }

      // Step 4: Validate SQL via Governance Engine
      const governanceContext = await buildGovernanceContext(insforge, workspaceId);
      const validationResult = await governanceEngine.validateSQL(sqlResult.sql, governanceContext);

      // Step 5: If validation fails, return error with governance explanation
      if (!validationResult.valid) {
        const errorMessages = validationResult.errors.map((e) => e.message).join('; ');

        // Store a failed query run record
        await storeQueryRun(insforge, {
          workspaceId,
          sql: sqlResult.sql,
          status: 'rejected',
          executionTimeMs: 0,
          rowCount: 0,
          errorMessage: errorMessages,
        });

        throw new Error(`Query rejected by governance: ${errorMessages}`);
      }

      // Step 6: Execute SQL (with 30-second timeout)
      const executionResult = await this.executeSQL(workspaceId, sqlResult.sql);

      // Step 7: Store query run record
      await storeQueryRun(insforge, {
        workspaceId,
        sql: sqlResult.sql,
        status: 'completed',
        executionTimeMs: executionResult.executionTimeMs,
        rowCount: executionResult.rowCount,
        resultSample: executionResult.rows.slice(0, 10),
      });

      // Step 8: Return results with all metadata
      const chartRecommendation: ChartRecommendation = {
        type: 'table',
        reason: 'Default table view',
        axes: {},
      };

      return {
        sql: sqlResult.sql,
        results: executionResult.rows,
        rowCount: executionResult.rowCount,
        executionTimeMs: executionResult.executionTimeMs,
        confidence: sqlResult.confidence,
        citations: sqlResult.citations,
        assumptions: sqlResult.assumptions,
        chartRecommendation,
        aiTrace: sqlResult.trace,
      };
    },

    async executeSQL(workspaceId: string, sql: string): Promise<ExecutionResult> {
      const startTime = Date.now();

      try {
        // Execute with 30-second timeout using statement_timeout
        const timeoutSQL = `SET LOCAL statement_timeout = '${QUERY_TIMEOUT_MS}ms'; ${sql}`;

        // Use InsForge's rpc to execute raw SQL
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
          status: 'error',
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
  status: 'completed' | 'error' | 'timeout' | 'rejected';
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
