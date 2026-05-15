import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createQueryPlanner,
  extractTermsFromQuestion,
  sanitizeErrorMessage,
  QueryPlanner,
  QuestionInput,
} from './query-planner';

vi.mock('../ai/ai-service', () => ({
  createAIService: vi.fn(() => ({
    generateSemanticQuery: vi.fn(),
  })),
}));

vi.mock('../semantic/semantic-loader', () => ({
  loadSemanticRegistry: vi.fn(),
}));

vi.mock('../semantic/semantic-query-compiler', () => ({
  compileSemanticQuery: vi.fn(),
}));

import { createAIService } from '../ai/ai-service';
import { loadSemanticRegistry } from '../semantic/semantic-loader';
import { compileSemanticQuery } from '../semantic/semantic-query-compiler';

const mockAIService = {
  generateSemanticQuery: vi.fn(),
  generateSummary: vi.fn(),
  chat: vi.fn(),
};

const mockRegistry = {
  workspaceId: 'ws1',
  models: [],
  entities: [
    { id: 'e1', workspaceId: 'ws1', dataSourceId: 'ds1', modelId: 'model1', name: 'Subscription', slug: 'subscription', description: 'Subscription data', sourceTable: 'demo.subscriptions', primaryKey: 'id', createdAt: '2024-01-01' },
  ],
  dimensions: [
    { id: 'd1', entityId: 'e1', name: 'Month', slug: 'month', description: null, dataType: 'timestamp', sourceColumn: 'started_at', expression: null, timeGrain: 'month', isPii: false, requiredRole: 'viewer' },
  ],
  measures: [],
  metrics: [
    { id: 'm1', workspaceId: 'ws1', name: 'MRR', slug: 'mrr', description: 'Monthly Recurring Revenue', formula: 'SUM(subscription_mrr)', certified: true, certifiedBy: 'u1', certifiedAt: '2024-01-01', createdAt: '2024-01-01', createdBy: 'u1', rootEntityId: 'e1', measureId: null, timeDimensionId: null, calculation: { type: 'expression', expression: 'SUM({root}."mrr_cents")' }, filters: [] },
  ],
  relationships: [],
  glossaryTerms: [
    { id: 'g1', workspaceId: 'ws1', name: 'MRR', definition: 'Monthly Recurring Revenue', relatedMetricIds: ['m1'], relatedEntityIds: [], createdAt: '2024-01-01' },
  ],
};

function createMockInsForge() {
  const mockRpc = vi.fn().mockResolvedValue({
    data: [{ month: '2024-01-01', mrr: 1000 }],
    error: null,
  });

  const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockFrom = vi.fn().mockReturnValue({
    insert: mockInsert,
  });

  return {
    rpc: mockRpc,
    from: mockFrom,
    _mockRpc: mockRpc,
    _mockInsert: mockInsert,
    _mockFrom: mockFrom,
  };
}

describe('Query Planner', () => {
  let queryPlanner: QueryPlanner;
  let mockInsForge: ReturnType<typeof createMockInsForge>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockInsForge = createMockInsForge();

    (createAIService as ReturnType<typeof vi.fn>).mockReturnValue(mockAIService);
    (loadSemanticRegistry as ReturnType<typeof vi.fn>).mockResolvedValue(mockRegistry);
    (compileSemanticQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      sql: 'SELECT DATE_TRUNC(\'month\', t0."started_at")::date AS "month", SUM(t0."mrr_cents") AS "mrr" FROM "demo"."subscriptions" AS t0 GROUP BY 1 ORDER BY "month" ASC LIMIT 100',
      semanticQuery: { metrics: ['mrr'], time: { dimension: 'month', grain: 'month' } },
      citations: [{ type: 'metric', id: 'm1', name: 'MRR', slug: 'mrr' }],
      assumptions: ['Rows are capped at 100 by the semantic compiler'],
      limit: 100,
    });

    mockAIService.generateSemanticQuery.mockResolvedValue({
      semanticQuery: { metrics: ['mrr'], time: { dimension: 'month', grain: 'month' } },
      confidence: 0.85,
      assumptions: ['Using certified MRR'],
      trace: {
        id: 'trace-1',
        promptTemplate: 'template',
        fullPrompt: 'full prompt',
        rawResponse: '{"semanticQuery":{"metrics":["mrr"]}}',
        durationMs: 150,
        tokenCount: { input: 100, output: 50 },
        model: 'mock-v1',
        timestamp: '2024-01-01T00:00:00Z',
      },
    });

    queryPlanner = createQueryPlanner(mockInsForge as any);
  });

  describe('processQuestion', () => {
    const defaultInput: QuestionInput = {
      question: 'What is our MRR by month?',
      workspaceId: 'ws1',
      userId: 'user1',
      userRole: 'analyst',
    };

    it('executes the SemanticQuery compiler pipeline successfully', async () => {
      const result = await queryPlanner.processQuestion(defaultInput);

      expect(mockAIService.generateSemanticQuery).toHaveBeenCalled();
      expect(compileSemanticQuery).toHaveBeenCalledWith(
        mockRegistry,
        { metrics: ['mrr'], time: { dimension: 'month', grain: 'month' } },
        { userRole: 'analyst' }
      );
      expect(result.sql).toContain('SELECT');
      expect(result.semanticQuery.metrics).toEqual(['mrr']);
      expect(result.confidence).toBe(0.85);
      expect(result.citations[0].name).toBe('MRR');
      expect(result.assumptions).toContain('Using certified MRR');
      expect(result.assumptions).toContain('Rows are capped at 100 by the semantic compiler');
    });

    it('stores query run metadata on successful execution', async () => {
      await queryPlanner.processQuestion(defaultInput);

      expect(mockInsForge._mockFrom).toHaveBeenCalledWith('query_runs');
    });

    it('throws when AI does not return valid SemanticQuery JSON', async () => {
      mockAIService.generateSemanticQuery.mockResolvedValueOnce({
        semanticQuery: null,
        confidence: 0,
        assumptions: ['bad response'],
        trace: {
          id: 'trace-err',
          promptTemplate: 'template',
          fullPrompt: 'full prompt',
          rawResponse: 'error',
          durationMs: 50,
          tokenCount: { input: 0, output: 0 },
          model: 'unknown',
          timestamp: '2024-01-01T00:00:00Z',
        },
      });

      await expect(queryPlanner.processQuestion(defaultInput)).rejects.toThrow(
        'valid SemanticQuery JSON'
      );
    });
  });

  describe('executeSQL', () => {
    it('executes SQL via readonly RPC', async () => {
      await queryPlanner.executeSQL('ws1', 'SELECT 1');

      expect(mockInsForge._mockRpc).toHaveBeenCalledWith('execute_readonly_query', {
        query_text: 'SELECT 1',
        workspace_id: 'ws1',
      });
    });
  });
});

describe('extractTermsFromQuestion', () => {
  it('extracts words and bigrams', () => {
    const terms = extractTermsFromQuestion('What is monthly recurring revenue?');

    expect(terms).toContain('monthly');
    expect(terms).toContain('monthly recurring');
  });
});

describe('sanitizeErrorMessage', () => {
  it('sanitizes timeout errors', () => {
    expect(sanitizeErrorMessage(new Error('statement_timeout exceeded'))).toContain('timed out');
  });

  it('sanitizes syntax errors', () => {
    expect(sanitizeErrorMessage(new Error('syntax error at or near foo'))).toContain('syntax error');
  });
});
