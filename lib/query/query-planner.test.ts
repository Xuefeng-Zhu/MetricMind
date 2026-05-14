import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createQueryPlanner,
  extractTermsFromQuestion,
  sanitizeErrorMessage,
  QueryPlanner,
  QuestionInput,
} from './query-planner';

// --- Mocks ---

// Mock the AI service
vi.mock('../ai/ai-service', () => ({
  createAIService: vi.fn(() => ({
    generateSQL: vi.fn(),
  })),
}));

// Mock the semantic layer service
vi.mock('../semantic/semantic-layer-service', () => ({
  createSemanticLayerService: vi.fn(() => ({
    getEntities: vi.fn(),
    getMetrics: vi.fn(),
    getGlossaryTerms: vi.fn(),
    resolveTerms: vi.fn(),
  })),
}));

// Mock the governance engine
vi.mock('../governance/governance-engine', () => ({
  createGovernanceEngine: vi.fn(() => ({
    validateSQL: vi.fn(),
  })),
}));

import { createAIService } from '../ai/ai-service';
import { createSemanticLayerService } from '../semantic/semantic-layer-service';
import { createGovernanceEngine } from '../governance/governance-engine';

const mockAIService = {
  generateSQL: vi.fn(),
  generateSummary: vi.fn(),
  chat: vi.fn(),
};

const mockSemanticLayerService = {
  getEntities: vi.fn(),
  getMetrics: vi.fn(),
  getGlossaryTerms: vi.fn(),
  resolveTerms: vi.fn(),
  createEntity: vi.fn(),
  getEntity: vi.fn(),
  addDimension: vi.fn(),
  addMeasure: vi.fn(),
  createJoin: vi.fn(),
  validateJoin: vi.fn(),
  createMetric: vi.fn(),
  certifyMetric: vi.fn(),
  createGlossaryTerm: vi.fn(),
  suggestSemanticTypes: vi.fn(),
};

const mockGovernanceEngine = {
  validateSQL: vi.fn(),
  checkMetricReferences: vi.fn(),
  flagHallucination: vi.fn(),
};

// Mock InsForge client
function createMockInsForge() {
  const mockRpc = vi.fn().mockResolvedValue({
    data: [{ id: 1, name: 'Test', revenue: 1000 }],
    error: null,
  });

  const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });

  const mockFrom = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        data: [],
        error: null,
      }),
      in: vi.fn().mockReturnValue({
        data: [],
        error: null,
      }),
    }),
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
    (createSemanticLayerService as ReturnType<typeof vi.fn>).mockReturnValue(mockSemanticLayerService);
    (createGovernanceEngine as ReturnType<typeof vi.fn>).mockReturnValue(mockGovernanceEngine);

    // Default mock returns
    mockSemanticLayerService.getEntities.mockResolvedValue([
      { id: 'e1', workspace_id: 'ws1', data_source_id: 'ds1', name: 'customers', description: 'Customer data', created_at: '2024-01-01' },
    ]);
    mockSemanticLayerService.getMetrics.mockResolvedValue([
      { id: 'm1', workspace_id: 'ws1', name: 'MRR', description: 'Monthly Recurring Revenue', formula: 'SUM(amount)', certified: true, certified_by: 'u1', certified_at: '2024-01-01', created_at: '2024-01-01', created_by: 'u1' },
    ]);
    mockSemanticLayerService.getGlossaryTerms.mockResolvedValue([
      { id: 'g1', workspace_id: 'ws1', name: 'MRR', definition: 'Monthly Recurring Revenue', related_metric_ids: ['m1'], related_entity_ids: [], created_at: '2024-01-01' },
    ]);
    mockSemanticLayerService.resolveTerms.mockResolvedValue([
      { term: 'MRR', definition: 'Monthly Recurring Revenue', relatedMetrics: ['m1'], relatedEntities: [] },
    ]);

    mockAIService.generateSQL.mockResolvedValue({
      sql: 'SELECT SUM(amount) AS mrr FROM subscriptions WHERE status = \'active\'',
      confidence: 0.85,
      citations: [{ type: 'metric', name: 'MRR', id: 'm1' }],
      assumptions: ['Assuming active subscriptions only'],
      trace: {
        id: 'trace-1',
        promptTemplate: 'template',
        fullPrompt: 'full prompt',
        rawResponse: '{"sql": "SELECT ..."}',
        durationMs: 150,
        tokenCount: { input: 100, output: 50 },
        model: 'mock-v1',
        timestamp: '2024-01-01T00:00:00Z',
      },
    });

    mockGovernanceEngine.validateSQL.mockResolvedValue({
      valid: true,
      errors: [],
      warnings: [],
    });

    queryPlanner = createQueryPlanner(mockInsForge as any);
  });

  describe('processQuestion', () => {
    const defaultInput: QuestionInput = {
      question: 'What is our MRR?',
      workspaceId: 'ws1',
      userId: 'user1',
    };

    it('should execute the full NL→SQL pipeline successfully', async () => {
      const result = await queryPlanner.processQuestion(defaultInput);

      expect(result.sql).toBe('SELECT SUM(amount) AS mrr FROM subscriptions WHERE status = \'active\'');
      expect(result.confidence).toBe(0.85);
      expect(result.citations).toHaveLength(1);
      expect(result.citations[0].name).toBe('MRR');
      expect(result.assumptions).toContain('Assuming active subscriptions only');
      expect(result.chartRecommendation.type).toBe('table');
      expect(result.aiTrace).toBeDefined();
      expect(result.aiTrace.id).toBe('trace-1');
    });

    it('should retrieve semantic context (entities, metrics, glossary)', async () => {
      await queryPlanner.processQuestion(defaultInput);

      expect(mockSemanticLayerService.getEntities).toHaveBeenCalledWith('ws1');
      expect(mockSemanticLayerService.getMetrics).toHaveBeenCalledWith('ws1');
      expect(mockSemanticLayerService.getGlossaryTerms).toHaveBeenCalledWith('ws1');
    });

    it('should resolve glossary terms from the question', async () => {
      await queryPlanner.processQuestion(defaultInput);

      // Should attempt to resolve terms that match glossary entries
      expect(mockSemanticLayerService.resolveTerms).toHaveBeenCalledWith('ws1', ['MRR']);
    });

    it('should use certified metric definitions in semantic context', async () => {
      await queryPlanner.processQuestion(defaultInput);

      const aiCall = mockAIService.generateSQL.mock.calls[0][0];
      const certifiedMetrics = aiCall.semanticContext.metrics.filter(
        (m: { certified: boolean }) => m.certified
      );
      expect(certifiedMetrics.length).toBeGreaterThan(0);
      expect(certifiedMetrics[0].name).toBe('MRR');
      expect(certifiedMetrics[0].formula).toBe('SUM(amount)');
    });

    it('should validate SQL via governance engine', async () => {
      await queryPlanner.processQuestion(defaultInput);

      expect(mockGovernanceEngine.validateSQL).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ workspaceId: 'ws1' })
      );
    });

    it('should throw error when governance validation fails', async () => {
      mockGovernanceEngine.validateSQL.mockResolvedValue({
        valid: false,
        errors: [{ code: 'DENIED_KEYWORD', message: 'SQL contains denied keyword: DROP' }],
        warnings: [],
      });

      await expect(queryPlanner.processQuestion(defaultInput)).rejects.toThrow(
        'Query rejected by governance'
      );
    });

    it('should throw error when AI service returns empty SQL', async () => {
      mockAIService.generateSQL.mockResolvedValue({
        sql: '',
        confidence: 0,
        citations: [],
        assumptions: ['AI service encountered an error'],
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
        'AI service was unable to generate a SQL query'
      );
    });

    it('should store query run record on successful execution', async () => {
      await queryPlanner.processQuestion(defaultInput);

      // The query run should be stored via insforge.from('query_runs').insert(...)
      expect(mockInsForge._mockFrom).toHaveBeenCalledWith('query_runs');
    });

    it('should return default table chart recommendation', async () => {
      const result = await queryPlanner.processQuestion(defaultInput);

      expect(result.chartRecommendation).toEqual({
        type: 'table',
        reason: 'Default table view',
        axes: {},
      });
    });

    it('should include execution time in results', async () => {
      const result = await queryPlanner.processQuestion(defaultInput);

      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('executeSQL', () => {
    it('should execute SQL and return results with column metadata', async () => {
      const result = await queryPlanner.executeSQL('ws1', 'SELECT 1 AS num');

      expect(result.rows).toBeDefined();
      expect(result.rowCount).toBeGreaterThanOrEqual(0);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.columns).toBeDefined();
    });

    it('should call insforge rpc with the SQL query', async () => {
      await queryPlanner.executeSQL('ws1', 'SELECT * FROM customers');

      expect(mockInsForge._mockRpc).toHaveBeenCalledWith('execute_readonly_query', {
        query_text: 'SELECT * FROM customers',
        workspace_id: 'ws1',
      });
    });

    it('should throw sanitized error on database failure', async () => {
      mockInsForge._mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'relation "secret_table" does not exist' },
      });

      await expect(queryPlanner.executeSQL('ws1', 'SELECT * FROM secret_table')).rejects.toThrow(
        'The requested data table could not be found'
      );
    });

    it('should throw timeout error when query exceeds 30 seconds', async () => {
      mockInsForge._mockRpc.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 31_000))
      );

      await expect(
        queryPlanner.executeSQL('ws1', 'SELECT * FROM large_table')
      ).rejects.toThrow('timed out');
    }, 35_000);

    it('should infer column types from result data', async () => {
      mockInsForge._mockRpc.mockResolvedValue({
        data: [
          { id: 1, name: 'Alice', revenue: 1000.5, active: true, created_at: '2024-01-01' },
        ],
        error: null,
      });

      const result = await queryPlanner.executeSQL('ws1', 'SELECT * FROM customers');

      expect(result.columns).toContainEqual({ name: 'id', type: 'integer' });
      expect(result.columns).toContainEqual({ name: 'name', type: 'text' });
      expect(result.columns).toContainEqual({ name: 'revenue', type: 'float' });
      expect(result.columns).toContainEqual({ name: 'active', type: 'boolean' });
      expect(result.columns).toContainEqual({ name: 'created_at', type: 'date' });
    });

    it('should return empty columns for empty result set', async () => {
      mockInsForge._mockRpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await queryPlanner.executeSQL('ws1', 'SELECT * FROM empty_table');

      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
      expect(result.columns).toEqual([]);
    });
  });
});

describe('extractTermsFromQuestion', () => {
  it('should extract meaningful words from a question', () => {
    const terms = extractTermsFromQuestion('What is our MRR?');
    expect(terms).toContain('what');
    expect(terms).toContain('our');
    expect(terms).toContain('mrr');
  });

  it('should filter out short words (2 chars or less)', () => {
    const terms = extractTermsFromQuestion('Is it a good MRR?');
    expect(terms).not.toContain('is');
    expect(terms).not.toContain('it');
    expect(terms).not.toContain('a');
  });

  it('should extract bigrams for compound terms', () => {
    const terms = extractTermsFromQuestion('What is the churn rate?');
    expect(terms).toContain('churn rate');
  });

  it('should remove punctuation', () => {
    const terms = extractTermsFromQuestion('What is MRR? (monthly)');
    expect(terms).toContain('mrr');
    expect(terms).toContain('monthly');
  });

  it('should deduplicate terms', () => {
    const terms = extractTermsFromQuestion('revenue revenue revenue');
    const revenueCount = terms.filter((t) => t === 'revenue').length;
    expect(revenueCount).toBe(1);
  });
});

describe('sanitizeErrorMessage', () => {
  it('should sanitize timeout errors', () => {
    const msg = sanitizeErrorMessage(new Error('statement_timeout exceeded'));
    expect(msg).toContain('timed out');
    expect(msg).not.toContain('statement_timeout');
  });

  it('should sanitize permission errors', () => {
    const msg = sanitizeErrorMessage(new Error('permission denied for table users'));
    expect(msg).toContain('do not have permission');
    expect(msg).not.toContain('table users');
  });

  it('should sanitize relation not found errors', () => {
    const msg = sanitizeErrorMessage(new Error('relation "internal_table" does not exist'));
    expect(msg).toContain('could not be found');
    expect(msg).not.toContain('internal_table');
  });

  it('should sanitize column not found errors', () => {
    const msg = sanitizeErrorMessage(new Error('column "secret_col" does not exist'));
    expect(msg).toContain('column could not be found');
    expect(msg).not.toContain('secret_col');
  });

  it('should sanitize syntax errors', () => {
    const msg = sanitizeErrorMessage(new Error('syntax error at or near "SELEC"'));
    expect(msg).toContain('syntax error');
    expect(msg).not.toContain('SELEC');
  });

  it('should sanitize division by zero errors', () => {
    const msg = sanitizeErrorMessage(new Error('division by zero'));
    expect(msg).toContain('division by zero');
  });

  it('should return generic message for unknown errors', () => {
    const msg = sanitizeErrorMessage(new Error('some internal pg error with details'));
    expect(msg).toContain('unexpected error');
    expect(msg).not.toContain('internal pg error');
  });

  it('should handle non-Error objects', () => {
    const msg = sanitizeErrorMessage('string error');
    expect(msg).toContain('unexpected error');
  });
});
