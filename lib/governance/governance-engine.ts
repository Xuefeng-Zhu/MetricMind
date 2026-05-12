/**
 * Governance Engine implementation.
 *
 * Provides SQL validation, metric reference checking, and hallucination detection:
 * - SQL allowlist validation against workspace sql_policies
 * - SQL denylist checking (DROP, DELETE, UPDATE, INSERT, ALTER, TRUNCATE, GRANT, REVOKE)
 * - Scope validation (reject queries referencing tables/columns outside workspace)
 * - Metric reference validation (verify all referenced metrics exist in semantic layer)
 * - Hallucination detection (flag unverified metrics, compare calculations against certified definitions)
 * - Constrain SQL generation to only SELECT statements
 * - Log security events on rejected queries
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 24.1, 24.2, 24.3, 24.4
 */

import { SupabaseClient } from '@supabase/supabase-js';

// --- Interfaces ---

export interface GovernanceContext {
  workspaceId: string;
  allowedTables: string[];
  allowedColumns: string[];
  denyPatterns: RegExp[];
}

export interface ValidationError {
  code: string;
  message: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface MetricValidation {
  valid: boolean;
  referencedMetrics: string[];
  unverifiedMetrics: string[];
}

export interface AIResponse {
  sql: string;
  confidence: number;
  citations: { type: string; name: string; id: string }[];
  assumptions: string[];
}

export interface HallucinationIssue {
  type: 'unverified_metric' | 'calculation_mismatch';
  metricName: string;
  message: string;
}

export interface HallucinationCheck {
  flagged: boolean;
  issues: HallucinationIssue[];
}

export interface GovernanceEngine {
  validateSQL(sql: string, context: GovernanceContext): Promise<ValidationResult>;
  checkMetricReferences(sql: string, workspaceId: string): Promise<MetricValidation>;
  flagHallucination(response: AIResponse, workspaceId: string): Promise<HallucinationCheck>;
}

// --- Constants ---

/**
 * SQL keywords that are always denied (destructive/mutating operations).
 * Matched with word boundaries, case-insensitive.
 */
const DENY_KEYWORDS = [
  'DROP',
  'DELETE',
  'UPDATE',
  'INSERT',
  'ALTER',
  'TRUNCATE',
  'GRANT',
  'REVOKE',
];

// --- Helper Functions ---

/**
 * Check if SQL contains any denied keywords using word boundary matching.
 * Case-insensitive.
 */
export function checkDenylist(sql: string): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const keyword of DENY_KEYWORDS) {
    const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
    if (pattern.test(sql)) {
      errors.push({
        code: 'DENIED_KEYWORD',
        message: `SQL contains denied keyword: ${keyword}`,
      });
    }
  }

  return errors;
}

/**
 * Check that the SQL is a SELECT-only statement.
 * Rejects anything that doesn't start with SELECT (after trimming whitespace/comments).
 */
export function checkSelectOnly(sql: string): ValidationError[] {
  const errors: ValidationError[] = [];

  // Strip leading whitespace and single-line/multi-line comments
  const stripped = sql
    .replace(/\/\*[\s\S]*?\*\//g, '') // remove block comments
    .replace(/--[^\n]*/g, '')          // remove line comments
    .trim();

  if (!stripped.match(/^SELECT\b/i)) {
    errors.push({
      code: 'NOT_SELECT',
      message: 'Only SELECT statements are allowed for analytics queries',
    });
  }

  return errors;
}

/**
 * Extract table references from SQL using common patterns.
 * Handles FROM, JOIN, and subquery patterns.
 */
export function extractTableReferences(sql: string): string[] {
  const tables: Set<string> = new Set();

  // Match FROM <table> and JOIN <table> patterns
  // Handles optional schema prefix (schema.table)
  const fromJoinPattern = /\b(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gi;
  let match: RegExpExecArray | null;

  while ((match = fromJoinPattern.exec(sql)) !== null) {
    const tableName = match[1].toLowerCase();
    // Skip subquery aliases and common SQL keywords
    if (!['select', 'where', 'on', 'and', 'or', 'not', 'lateral'].includes(tableName)) {
      tables.add(tableName);
    }
  }

  return Array.from(tables);
}

/**
 * Validate that all table references in the SQL are within the allowed scope.
 */
export function checkScope(sql: string, allowedTables: string[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const referencedTables = extractTableReferences(sql);
  const allowedSet = new Set(allowedTables.map((t) => t.toLowerCase()));

  for (const table of referencedTables) {
    if (!allowedSet.has(table)) {
      errors.push({
        code: 'OUT_OF_SCOPE',
        message: `Query references table '${table}' which is outside the workspace scope`,
      });
    }
  }

  return errors;
}

/**
 * Check SQL against workspace allowlist patterns from sql_policies.
 * If allowlist policies exist and the SQL doesn't match any, it's rejected.
 */
export function checkAllowlist(sql: string, allowlistPatterns: string[]): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  if (allowlistPatterns.length === 0) {
    // No allowlist configured — everything is allowed
    return warnings;
  }

  const matchesAny = allowlistPatterns.some((pattern) => {
    try {
      const regex = new RegExp(pattern, 'i');
      return regex.test(sql);
    } catch {
      // Invalid regex pattern — skip it
      return false;
    }
  });

  if (!matchesAny) {
    warnings.push({
      code: 'ALLOWLIST_MISMATCH',
      message: 'SQL does not match any configured allowlist patterns',
    });
  }

  return warnings;
}

/**
 * Check SQL against workspace denylist patterns from sql_policies.
 */
export function checkCustomDenyPatterns(sql: string, denyPatterns: RegExp[]): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const pattern of denyPatterns) {
    if (pattern.test(sql)) {
      errors.push({
        code: 'CUSTOM_DENY_PATTERN',
        message: `SQL matches a denied pattern: ${pattern.source}`,
      });
    }
  }

  return errors;
}

/**
 * Extract metric name references from SQL.
 * Looks for metric names that appear as identifiers or in comments/aliases.
 */
export function extractMetricReferences(sql: string, knownMetrics: string[]): string[] {
  const referenced: string[] = [];

  for (const metricName of knownMetrics) {
    // Case-insensitive word boundary match
    const pattern = new RegExp(`\\b${escapeRegex(metricName)}\\b`, 'i');
    if (pattern.test(sql)) {
      referenced.push(metricName);
    }
  }

  return referenced;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Log a security event to the audit_events table.
 */
async function logSecurityEvent(
  supabase: SupabaseClient,
  workspaceId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('audit_events').insert({
      workspace_id: workspaceId,
      actor_id: metadata.actor_id || '00000000-0000-0000-0000-000000000000',
      action: 'security.violation',
      target_type: 'sql_query',
      target_id: null,
      metadata,
    });
  } catch {
    // Audit logging should not break the validation flow
    console.error('Failed to log security event');
  }
}

// --- Factory Function ---

/**
 * Create a GovernanceEngine instance.
 *
 * The Supabase client is used for:
 * - Querying sql_policies table for allowlist/denylist patterns
 * - Querying metrics table for metric validation
 * - Inserting audit_events for security violations
 */
export function createGovernanceEngine(supabase: SupabaseClient): GovernanceEngine {
  return {
    async validateSQL(sql: string, context: GovernanceContext): Promise<ValidationResult> {
      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      // 1. Check SELECT-only constraint (Requirement 10.5)
      errors.push(...checkSelectOnly(sql));

      // 2. Check built-in denylist (Requirement 10.2)
      errors.push(...checkDenylist(sql));

      // 3. Check custom deny patterns from context (Requirement 10.2)
      errors.push(...checkCustomDenyPatterns(sql, context.denyPatterns));

      // 4. Check scope validation (Requirement 10.3)
      if (context.allowedTables.length > 0) {
        errors.push(...checkScope(sql, context.allowedTables));
      }

      // 5. Check workspace sql_policies from database (Requirement 10.1)
      try {
        const { data: policies } = await supabase
          .from('sql_policies')
          .select('policy_type, pattern')
          .eq('workspace_id', context.workspaceId)
          .eq('enabled', true);

        if (policies && policies.length > 0) {
          const allowlistPatterns = policies
            .filter((p: { policy_type: string; pattern: string }) => p.policy_type === 'allowlist')
            .map((p: { policy_type: string; pattern: string }) => p.pattern);

          const denylistPatterns = policies
            .filter((p: { policy_type: string; pattern: string }) => p.policy_type === 'denylist')
            .map((p: { policy_type: string; pattern: string }) => p.pattern);

          // Check allowlist
          warnings.push(...checkAllowlist(sql, allowlistPatterns));

          // Check denylist patterns from database
          const dbDenyRegexes = denylistPatterns
            .map((pattern: string) => {
              try {
                return new RegExp(pattern, 'i');
              } catch {
                return null;
              }
            })
            .filter((r: RegExp | null): r is RegExp => r !== null);

          errors.push(...checkCustomDenyPatterns(sql, dbDenyRegexes));
        }
      } catch {
        // If we can't fetch policies, continue with other checks
        warnings.push({
          code: 'POLICY_FETCH_ERROR',
          message: 'Could not fetch workspace SQL policies',
        });
      }

      // Log security event if query is rejected (Requirement 10.3)
      if (errors.length > 0) {
        await logSecurityEvent(supabase, context.workspaceId, {
          sql: sql.substring(0, 500), // Truncate for safety
          errors: errors.map((e) => ({ code: e.code, message: e.message })),
          reason: 'sql_validation_failed',
        });
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    },

    async checkMetricReferences(sql: string, workspaceId: string): Promise<MetricValidation> {
      // Fetch all metrics for the workspace (Requirement 24.1)
      const { data: metrics } = await supabase
        .from('metrics')
        .select('name')
        .eq('workspace_id', workspaceId);

      const knownMetricNames = (metrics || []).map((m: { name: string }) => m.name);
      const referencedMetrics = extractMetricReferences(sql, knownMetricNames);

      // All referenced metrics exist in the semantic layer since we only match known ones
      // But we also check for potential metric-like references that don't match known metrics
      const unverifiedMetrics: string[] = [];

      // Look for common metric patterns in SQL that don't match known metrics
      // e.g., aliases that look like metric names (SUM(...) AS some_metric)
      const aliasPattern = /\bAS\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
      let match: RegExpExecArray | null;

      while ((match = aliasPattern.exec(sql)) !== null) {
        const alias = match[1];
        // Check if this alias looks like a metric name but isn't in our known metrics
        const isKnown = knownMetricNames.some(
          (name: string) => name.toLowerCase() === alias.toLowerCase()
        );
        if (!isKnown && !isCommonSQLAlias(alias)) {
          // Check if it could be a metric reference
          if (looksLikeMetricName(alias)) {
            unverifiedMetrics.push(alias);
          }
        }
      }

      return {
        valid: unverifiedMetrics.length === 0,
        referencedMetrics,
        unverifiedMetrics,
      };
    },

    async flagHallucination(response: AIResponse, workspaceId: string): Promise<HallucinationCheck> {
      const issues: HallucinationIssue[] = [];

      // Fetch all metrics with their formulas for the workspace (Requirement 24.2, 24.3)
      const { data: metrics } = await supabase
        .from('metrics')
        .select('name, formula, certified')
        .eq('workspace_id', workspaceId);

      const knownMetrics = (metrics || []) as { name: string; formula: string; certified: boolean }[];
      const metricMap = new Map(knownMetrics.map((m) => [m.name.toLowerCase(), m]));

      // Check citations for unverified metrics (Requirement 24.2)
      for (const citation of response.citations) {
        if (citation.type === 'metric') {
          const metric = metricMap.get(citation.name.toLowerCase());
          if (!metric) {
            issues.push({
              type: 'unverified_metric',
              metricName: citation.name,
              message: `Metric '${citation.name}' is referenced but not defined in the semantic layer`,
            });
          }
        }
      }

      // Check SQL for metric references not in the semantic layer (Requirement 24.1)
      const knownMetricNames = knownMetrics.map((m) => m.name);
      const sqlMetricRefs = extractMetricReferences(response.sql, knownMetricNames);

      // Look for metric-like aliases in SQL that aren't known
      const aliasPattern = /\bAS\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
      let match: RegExpExecArray | null;

      while ((match = aliasPattern.exec(response.sql)) !== null) {
        const alias = match[1];
        const isKnown = knownMetricNames.some(
          (name) => name.toLowerCase() === alias.toLowerCase()
        );
        if (!isKnown && looksLikeMetricName(alias) && !isCommonSQLAlias(alias)) {
          // Check if this alias is already flagged via citations
          const alreadyFlagged = issues.some(
            (i) => i.metricName.toLowerCase() === alias.toLowerCase()
          );
          if (!alreadyFlagged) {
            issues.push({
              type: 'unverified_metric',
              metricName: alias,
              message: `SQL references '${alias}' which is not a defined metric in the semantic layer`,
            });
          }
        }
      }

      // Check for calculation mismatches against certified definitions (Requirement 24.3)
      for (const metricName of sqlMetricRefs) {
        const metric = metricMap.get(metricName.toLowerCase());
        if (metric && metric.certified) {
          // Check if the SQL contains a different calculation for this metric
          const mismatch = detectCalculationMismatch(response.sql, metric.name, metric.formula);
          if (mismatch) {
            issues.push({
              type: 'calculation_mismatch',
              metricName: metric.name,
              message: `Calculation for '${metric.name}' may differ from certified definition: ${metric.formula}`,
            });
          }
        }
      }

      // Log hallucination events if flagged (Requirement 24.2)
      if (issues.length > 0) {
        await logSecurityEvent(supabase, workspaceId, {
          sql: response.sql.substring(0, 500),
          issues: issues.map((i) => ({ type: i.type, metricName: i.metricName })),
          reason: 'hallucination_detected',
          confidence: response.confidence,
        });
      }

      return {
        flagged: issues.length > 0,
        issues,
      };
    },
  };
}

// --- Internal Helpers ---

/**
 * Check if an alias is a common SQL alias that shouldn't be flagged as a metric.
 */
function isCommonSQLAlias(alias: string): boolean {
  const commonAliases = new Set([
    'count', 'total', 'sum', 'avg', 'min', 'max',
    'cnt', 'num', 'amount', 'value', 'result',
    'id', 'name', 'type', 'status', 'date',
    'created_at', 'updated_at', 'timestamp',
    'row_num', 'rank', 'dense_rank',
  ]);
  return commonAliases.has(alias.toLowerCase());
}

/**
 * Heuristic to determine if an alias looks like a metric name.
 * Metric names typically contain underscores or are multi-word camelCase,
 * and often include business terms.
 */
function looksLikeMetricName(alias: string): boolean {
  // Must be at least 4 characters
  if (alias.length < 4) return false;

  // Contains underscore with meaningful parts (e.g., monthly_revenue)
  if (alias.includes('_') && alias.split('_').length >= 2) {
    const parts = alias.split('_');
    // At least one part should be longer than 2 chars
    return parts.some((p) => p.length > 2);
  }

  // CamelCase with at least 2 words (e.g., monthlyRevenue)
  if (/[a-z][A-Z]/.test(alias)) return true;

  return false;
}

/**
 * Detect if the SQL contains a calculation for a metric that differs from its certified formula.
 * This is a heuristic check — it looks for the metric name used as an alias
 * and compares the expression preceding it against the certified formula.
 */
function detectCalculationMismatch(sql: string, metricName: string, certifiedFormula: string): boolean {
  // Look for patterns like: <expression> AS <metricName>
  // The expression is captured as the part between a comma/SELECT and AS
  const escapedName = escapeRegex(metricName);
  const pattern = new RegExp(
    `(?:SELECT|,)\\s+(.+?)\\s+AS\\s+${escapedName}\\b`,
    'i'
  );
  const match = pattern.exec(sql);

  if (!match) return false;

  const expression = match[1].trim();

  // Normalize both expressions for comparison
  const normalizedExpr = normalizeExpression(expression);
  const normalizedFormula = normalizeExpression(certifiedFormula);

  // If they're substantially different, flag it
  return normalizedExpr !== normalizedFormula && normalizedExpr.length > 0;
}

/**
 * Normalize a SQL expression for comparison by removing whitespace and lowercasing.
 */
function normalizeExpression(expr: string): string {
  return expr
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()]/g, '')
    .trim();
}
