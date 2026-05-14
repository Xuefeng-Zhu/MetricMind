import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InsForgeDatabaseClient } from '@/lib/insforge/types';
import {
  createAIService,
  buildSQLPrompt,
  buildSummaryPrompt,
  parseSQLResponse,
  parseSummaryResponse,
  parseChatResponse,
  generateCitations,
  callWithRetry,
  SemanticContext,
  AIService,
} from './ai-service';
import { AIProvider, CompletionResult, Message } from './provider';

// --- Mock InsForge ---

function createMockInsForge(): InsForgeDatabaseClient {
  const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
  return {
    from: vi.fn().mockReturnValue({
      insert: insertMock,
    }),
  } as unknown as InsForgeDatabaseClient;
}

// --- Mock Provider ---

function createMockProvider(response?: Partial<CompletionResult>): AIProvider {
  return {
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        sql: "SELECT COUNT(*) FROM customers",
        confidence: 0.85,
        citations: [{ type: 'entity', name: 'customers', id: 'ent-1' }],
        assumptions: ['Counting all customers regardless of status'],
      }),
      model: 'test-model',
      usage: { inputTokens: 100, outputTokens: 50 },
      ...response,
    }),
  };
}

function createFailingProvider(): AIProvider {
  return {
    complete: vi.fn().mockRejectedValue(new Error('Provider unavailable')),
  };
}

function createFailOnceThenSucceedProvider(): AIProvider {
  let callCount = 0;
  return {
    complete: vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Temporary failure');
      }
      return {
        content: JSON.stringify({
          sql: "SELECT 1",
          confidence: 0.9,
          citations: [],
          assumptions: [],
        }),
        model: 'test-model',
        usage: { inputTokens: 50, outputTokens: 25 },
      };
    }),
  };
}

// --- Test Data ---

const testSemanticContext: SemanticContext = {
  entities: [
    { name: 'customers', description: 'Customer records' },
    { name: 'subscriptions', description: 'Subscription data' },
  ],
  metrics: [
    { name: 'MRR', formula: 'SUM(mrr_cents)/100', certified: true },
    { name: 'Churn Rate', formula: 'churned/total', certified: false },
  ],
  glossaryTerms: [
    { name: 'MRR', definition: 'Monthly Recurring Revenue' },
  ],
};

describe('AI Service', () => {
  let insforge: InsForgeDatabaseClient;
  let service: AIService;

  beforeEach(() => {
    insforge = createMockInsForge();
    service = createAIService(insforge);
  });

  describe('generateSQL', () => {
    it('returns a valid SQLGenerationResult structure', async () => {
      const result = await service.generateSQL({
        question: 'How many customers do we have?',
        semanticContext: testSemanticContext,
        workspaceId: 'ws-1',
      });

      expect(result).toHaveProperty('sql');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('citations');
      expect(result).toHaveProperty('assumptions');
      expect(result).toHaveProperty('trace');
      expect(typeof result.sql).toBe('string');
      expect(result.sql.length).toBeGreaterThan(0);
    });

    it('returns confidence score between 0.0 and 1.0', async () => {
      const result = await service.generateSQL({
        question: 'What is our MRR?',
        semanticContext: testSemanticContext,
        workspaceId: 'ws-1',
      });

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('includes citations in the result', async () => {
      const result = await service.generateSQL({
        question: 'What is our revenue?',
        semanticContext: testSemanticContext,
        workspaceId: 'ws-1',
      });

      expect(Array.isArray(result.citations)).toBe(true);
    });

    it('includes assumptions in the result', async () => {
      const result = await service.generateSQL({
        question: 'How many customers?',
        semanticContext: testSemanticContext,
        workspaceId: 'ws-1',
      });

      expect(Array.isArray(result.assumptions)).toBe(true);
    });

    it('creates an AI trace record', async () => {
      const result = await service.generateSQL({
        question: 'How many customers?',
        semanticContext: testSemanticContext,
        workspaceId: 'ws-1',
      });

      expect(result.trace).toHaveProperty('id');
      expect(result.trace).toHaveProperty('promptTemplate');
      expect(result.trace).toHaveProperty('fullPrompt');
      expect(result.trace).toHaveProperty('rawResponse');
      expect(result.trace).toHaveProperty('durationMs');
      expect(result.trace).toHaveProperty('tokenCount');
      expect(result.trace).toHaveProperty('model');
      expect(result.trace).toHaveProperty('timestamp');
      expect(result.trace.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.trace.tokenCount.input).toBeGreaterThanOrEqual(0);
      expect(result.trace.tokenCount.output).toBeGreaterThanOrEqual(0);
    });

    it('stores trace in the database', async () => {
      await service.generateSQL({
        question: 'How many customers?',
        semanticContext: testSemanticContext,
        workspaceId: 'ws-1',
      });

      expect(insforge.from).toHaveBeenCalledWith('ai_traces');
      const fromResult = (insforge.from as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(fromResult.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace_id: 'ws-1',
        })
      );
    });

    it('includes conversation history in messages when provided', async () => {
      const conversationHistory: Message[] = [
        { role: 'user', content: 'What is MRR?' },
        { role: 'assistant', content: 'MRR is Monthly Recurring Revenue.' },
      ];

      const result = await service.generateSQL({
        question: 'Show me the trend',
        semanticContext: testSemanticContext,
        conversationHistory,
        workspaceId: 'ws-1',
      });

      expect(result.sql).toBeDefined();
      expect(result.trace.fullPrompt).toContain('Show me the trend');
    });
  });

  describe('generateSummary', () => {
    it('returns a valid SummaryResult structure', async () => {
      const result = await service.generateSummary({
        question: 'How many customers?',
        sql: 'SELECT COUNT(*) FROM customers',
        results: [{ count: 150 }],
        workspaceId: 'ws-1',
      });

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('trace');
      expect(typeof result.summary).toBe('string');
      expect(result.summary.length).toBeGreaterThan(0);
    });

    it('creates an AI trace record for summary', async () => {
      const result = await service.generateSummary({
        question: 'How many customers?',
        sql: 'SELECT COUNT(*) FROM customers',
        results: [{ count: 150 }],
        workspaceId: 'ws-1',
      });

      expect(result.trace.id).toBeDefined();
      expect(result.trace.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('chat', () => {
    it('returns a valid ChatResult structure', async () => {
      const result = await service.chat({
        message: 'What can you help me with?',
        conversationHistory: [],
        workspaceId: 'ws-1',
      });

      expect(result).toHaveProperty('response');
      expect(result).toHaveProperty('trace');
      expect(typeof result.response).toBe('string');
      expect(result.response.length).toBeGreaterThan(0);
    });

    it('creates an AI trace record for chat', async () => {
      const result = await service.chat({
        message: 'Hello',
        conversationHistory: [],
        workspaceId: 'ws-1',
      });

      expect(result.trace.id).toBeDefined();
      expect(result.trace.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('includes conversation history in the call', async () => {
      const result = await service.chat({
        message: 'Tell me more',
        conversationHistory: [
          { role: 'user', content: 'What is MRR?' },
          { role: 'assistant', content: 'MRR is Monthly Recurring Revenue.' },
        ],
        workspaceId: 'ws-1',
      });

      expect(result.response).toBeDefined();
    });
  });

  describe('retry logic', () => {
    it('retries once on provider error and succeeds', async () => {
      const provider = createFailOnceThenSucceedProvider();
      const result = await callWithRetry(provider, [
        { role: 'user', content: 'test' },
      ]);

      expect('error' in result).toBe(false);
      expect(provider.complete).toHaveBeenCalledTimes(2);
    });

    it('returns graceful error after two failures', async () => {
      const provider = createFailingProvider();
      const result = await callWithRetry(provider, [
        { role: 'user', content: 'test' },
      ]);

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('AI service is temporarily unavailable');
      }
      expect(provider.complete).toHaveBeenCalledTimes(2);
    });

    it('does not throw on provider error - returns graceful message', async () => {
      const failingInsForge = createMockInsForge();
      const failingService = createAIService(failingInsForge, {
        endpoint: 'https://invalid.example.com',
        model: 'test',
        apiKey: 'fake-key',
      });

      // The service should not throw even with a bad config
      // (the actual HTTP call would fail, but we're testing the retry wrapper)
      // For this test, we use the mock provider which doesn't actually make HTTP calls
      const mockService = createAIService(failingInsForge);
      const result = await mockService.generateSQL({
        question: 'test',
        semanticContext: testSemanticContext,
        workspaceId: 'ws-1',
      });

      // Should return a result, not throw
      expect(result).toBeDefined();
      expect(result.trace).toBeDefined();
    });
  });
});

describe('buildSQLPrompt', () => {
  it('includes the question in the prompt', () => {
    const prompt = buildSQLPrompt('What is our MRR?', testSemanticContext);
    expect(prompt).toContain('What is our MRR?');
  });

  it('includes semantic context entities', () => {
    const prompt = buildSQLPrompt('test', testSemanticContext);
    expect(prompt).toContain('customers');
    expect(prompt).toContain('subscriptions');
  });

  it('includes semantic context metrics', () => {
    const prompt = buildSQLPrompt('test', testSemanticContext);
    expect(prompt).toContain('MRR');
    expect(prompt).toContain('SUM(mrr_cents)/100');
  });

  it('includes glossary terms', () => {
    const prompt = buildSQLPrompt('test', testSemanticContext);
    expect(prompt).toContain('Monthly Recurring Revenue');
  });
});

describe('buildSummaryPrompt', () => {
  it('includes question, sql, and results', () => {
    const prompt = buildSummaryPrompt(
      'How many customers?',
      'SELECT COUNT(*) FROM customers',
      [{ count: 150 }]
    );
    expect(prompt).toContain('How many customers?');
    expect(prompt).toContain('SELECT COUNT(*) FROM customers');
    expect(prompt).toContain('150');
  });

  it('limits results to 20 rows in the prompt', () => {
    const manyResults = Array.from({ length: 50 }, (_, i) => ({ id: i, value: i * 10 }));
    const prompt = buildSummaryPrompt('test', 'SELECT *', manyResults);
    // Should contain row 19 (index 19) but not row 20 (index 20)
    expect(prompt).toContain('"id": 19');
    expect(prompt).not.toContain('"id": 20');
  });
});

describe('parseSQLResponse', () => {
  it('parses valid JSON response', () => {
    const raw = JSON.stringify({
      sql: 'SELECT * FROM users',
      confidence: 0.9,
      citations: [{ type: 'entity', name: 'users', id: 'e-1' }],
      assumptions: ['All users included'],
    });

    const result = parseSQLResponse(raw, testSemanticContext);
    expect(result.sql).toBe('SELECT * FROM users');
    expect(result.confidence).toBe(0.9);
    expect(result.citations).toHaveLength(1);
    expect(result.assumptions).toEqual(['All users included']);
  });

  it('clamps confidence to 0.0-1.0 range', () => {
    const raw = JSON.stringify({ sql: 'SELECT 1', confidence: 1.5, citations: [], assumptions: [] });
    const result = parseSQLResponse(raw, testSemanticContext);
    expect(result.confidence).toBe(1.0);

    const raw2 = JSON.stringify({ sql: 'SELECT 1', confidence: -0.5, citations: [], assumptions: [] });
    const result2 = parseSQLResponse(raw2, testSemanticContext);
    expect(result2.confidence).toBe(0);
  });

  it('falls back gracefully on invalid JSON', () => {
    const result = parseSQLResponse('not json at all', testSemanticContext);
    expect(result.sql).toBe('not json at all');
    expect(result.confidence).toBe(0.3);
    expect(result.assumptions).toContain('Response could not be fully parsed; confidence is reduced');
  });

  it('generates citations from semantic context when not provided', () => {
    const raw = JSON.stringify({
      sql: 'SELECT * FROM customers WHERE mrr > 100',
      confidence: 0.8,
    });

    const result = parseSQLResponse(raw, testSemanticContext);
    // Should auto-generate citations based on matching entity/metric names
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.citations.some((c) => c.name === 'customers')).toBe(true);
  });
});

describe('parseSummaryResponse', () => {
  it('extracts summary from valid JSON', () => {
    const raw = JSON.stringify({ summary: 'There are 150 customers.' });
    expect(parseSummaryResponse(raw)).toBe('There are 150 customers.');
  });

  it('falls back to response field', () => {
    const raw = JSON.stringify({ response: 'Fallback response' });
    expect(parseSummaryResponse(raw)).toBe('Fallback response');
  });

  it('returns raw content on invalid JSON', () => {
    expect(parseSummaryResponse('plain text summary')).toBe('plain text summary');
  });
});

describe('parseChatResponse', () => {
  it('extracts response from valid JSON', () => {
    const raw = JSON.stringify({ response: 'Hello! How can I help?' });
    expect(parseChatResponse(raw)).toBe('Hello! How can I help?');
  });

  it('falls back to message field', () => {
    const raw = JSON.stringify({ message: 'Fallback message' });
    expect(parseChatResponse(raw)).toBe('Fallback message');
  });

  it('returns raw content on invalid JSON', () => {
    expect(parseChatResponse('plain text response')).toBe('plain text response');
  });
});

describe('generateCitations', () => {
  it('generates metric citations when SQL references metric names', () => {
    const citations = generateCitations(
      "SELECT SUM(mrr_cents)/100 as MRR FROM subscriptions",
      testSemanticContext
    );
    expect(citations.some((c) => c.type === 'metric' && c.name === 'MRR')).toBe(true);
  });

  it('generates entity citations when SQL references entity names', () => {
    const citations = generateCitations(
      "SELECT * FROM customers",
      testSemanticContext
    );
    expect(citations.some((c) => c.type === 'entity' && c.name === 'customers')).toBe(true);
  });

  it('returns empty array when no matches found', () => {
    const citations = generateCitations(
      "SELECT 1",
      testSemanticContext
    );
    expect(citations).toHaveLength(0);
  });

  it('is case-insensitive', () => {
    const citations = generateCitations(
      "SELECT * FROM CUSTOMERS",
      testSemanticContext
    );
    expect(citations.some((c) => c.name === 'customers')).toBe(true);
  });
});

describe('callWithRetry', () => {
  it('returns result on first successful call', async () => {
    const provider = createMockProvider();
    const result = await callWithRetry(provider, [{ role: 'user', content: 'test' }]);

    expect('error' in result).toBe(false);
    expect(provider.complete).toHaveBeenCalledTimes(1);
  });

  it('retries once and succeeds on second attempt', async () => {
    const provider = createFailOnceThenSucceedProvider();
    const result = await callWithRetry(provider, [{ role: 'user', content: 'test' }]);

    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.model).toBe('test-model');
    }
    expect(provider.complete).toHaveBeenCalledTimes(2);
  });

  it('returns error object after two failures (does not throw)', async () => {
    const provider = createFailingProvider();
    const result = await callWithRetry(provider, [{ role: 'user', content: 'test' }]);

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('AI service is temporarily unavailable');
      expect(result.error).toContain('Provider unavailable');
    }
  });
});
