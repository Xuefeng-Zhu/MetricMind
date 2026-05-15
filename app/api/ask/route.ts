/**
 * POST /api/ask
 *
 * Orchestrates the full query pipeline for natural-language questions.
 * Body: { question: string, conversationId?: string }
 * Workspace ID from x-workspace-id header.
 * RBAC: viewer+ role.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 13.2, 13.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRBAC, RBACContext } from '@/lib/rbac/rbac-middleware';
import { createClient } from '@/lib/insforge/server';
import { createQueryPlanner, type QueryResult } from '@/lib/query/query-planner';

function formatValue(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  if (value === null || value === undefined || value === '') {
    return 'no value';
  }

  return String(value);
}

function buildSummary(question: string, result: QueryResult): string {
  if (result.rowCount === 0) {
    return `No rows matched "${question}".`;
  }

  const firstRow = result.results[0] ?? {};
  const entries = Object.entries(firstRow);

  if (result.rowCount === 1 && entries.length === 1) {
    const [key, value] = entries[0];
    return `${key.replace(/_/g, ' ')} is ${formatValue(value)}.`;
  }

  const columns = entries.map(([key]) => key.replace(/_/g, ' ')).join(', ');
  return `Query returned ${result.rowCount.toLocaleString()} rows with ${columns}.`;
}

function buildChartData(results: Record<string, unknown>[]): Record<string, unknown>[] | undefined {
  if (results.length === 0) return undefined;

  const keys = Object.keys(results[0]);
  const numericKeys = keys.filter((key) => typeof results[0][key] === 'number');
  const dimensionKey = keys.find((key) => !numericKeys.includes(key));

  if (!dimensionKey || numericKeys.length === 0) return undefined;

  return results.map((row) => {
    const chartRow: Record<string, unknown> = {
      [dimensionKey]: row[dimensionKey],
    };

    for (const key of numericKeys) {
      chartRow[key] = row[key];
    }

    return chartRow;
  });
}

async function handler(req: NextRequest, context: RBACContext): Promise<NextResponse> {
  const { userId, workspaceId } = context;

  // Parse request body
  let body: { question?: string; conversationId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Bad Request', message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { question, conversationId } = body;

  // Validate question
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return NextResponse.json(
      { error: 'Bad Request', message: 'A non-empty question is required' },
      { status: 400 }
    );
  }

  if (question.length > 2000) {
    return NextResponse.json(
      { error: 'Bad Request', message: 'Question must be 2000 characters or fewer' },
      { status: 400 }
    );
  }

  try {
    const insforge = createClient();

    // Load AI provider config for this workspace (if any)
    const { data: aiConfig } = await insforge
      .from('ai_provider_configs')
      .select('endpoint_url, model_name, encrypted_api_key')
      .eq('workspace_id', workspaceId)
      .single();

    const providerConfig = aiConfig
      ? {
          endpoint: aiConfig.endpoint_url,
          model: aiConfig.model_name,
          apiKey: aiConfig.encrypted_api_key,
        }
      : undefined;

    // Create query planner and process the question
    const queryPlanner = createQueryPlanner(insforge, providerConfig);

    const result = await queryPlanner.processQuestion({
      question: question.trim(),
      workspaceId,
      userId,
      conversationId: conversationId || undefined,
    });

    // Audit log: query executed (non-blocking)
    try {
      await insforge.from("audit_events").insert({
        workspace_id: workspaceId,
        actor_id: userId,
        action: "query.executed",
        target_type: "query_run",
        target_id: result.aiTrace?.id || workspaceId,
        metadata: { question: question.trim(), sql: result.sql },
      });
    } catch {
      // Audit logging should not break the main flow
    }

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        summary: buildSummary(question.trim(), result),
        chartData: buildChartData(result.results),
        confidence: result.confidence,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';

    // Determine appropriate status code
    const status = message.includes('governance') || message.includes('rejected')
      ? 422
      : message.includes('timed out')
        ? 504
        : 500;

    return NextResponse.json(
      { error: 'Query Error', message },
      { status }
    );
  }
}

export const POST = withRBAC({ requiredRole: 'viewer' }, handler);
