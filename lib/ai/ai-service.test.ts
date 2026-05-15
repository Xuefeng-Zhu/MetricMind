import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InsForgeDatabaseClient } from '@/lib/insforge/types';
import {
  createAIService,
  buildSemanticQueryPrompt,
  buildSummaryPrompt,
  parseSemanticQueryResponse,
  parseSummaryResponse,
  parseChatResponse,
  callWithRetry,
  SemanticContext,
  AIService,
} from './ai-service';
import { AIProvider, Message } from './provider';

function createMockInsForge(): InsForgeDatabaseClient {
  const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
  return {
    from: vi.fn().mockReturnValue({
      insert: insertMock,
    }),
  } as unknown as InsForgeDatabaseClient;
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
          semanticQuery: { metrics: ['mrr'], time: { dimension: 'month', grain: 'month' } },
          confidence: 0.9,
          assumptions: [],
        }),
        model: 'test-model',
        usage: { inputTokens: 50, outputTokens: 25 },
      };
    }),
  };
}

const testSemanticContext: SemanticContext = {
  entities: [
    { name: 'Customer', slug: 'customer', description: 'Customer records', dimensions: ['plan', 'region'] },
    { name: 'Subscription', slug: 'subscription', description: 'Subscription data', dimensions: ['month', 'plan'] },
  ],
  metrics: [
    { name: 'MRR', slug: 'mrr', formula: 'SUM(subscription_mrr)', certified: true },
    { name: 'Churn Rate', slug: 'churn_rate', formula: 'churned/total', certified: false },
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

  describe('generateSemanticQuery', () => {
    it('returns SemanticQuery JSON rather than SQL', async () => {
      const result = await service.generateSemanticQuery({
        question: 'What is MRR by month?',
        semanticContext: testSemanticContext,
        workspaceId: 'ws-1',
      });

      expect(result.semanticQuery).toBeTruthy();
      expect(result.semanticQuery?.metrics).toContain('mrr');
      expect(result).not.toHaveProperty('sql');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('stores an AI trace record', async () => {
      await service.generateSemanticQuery({
        question: 'What is MRR?',
        semanticContext: testSemanticContext,
        workspaceId: 'ws-1',
      });

      expect(insforge.from).toHaveBeenCalledWith('ai_traces');
    });

    it('includes conversation history when provided', async () => {
      const conversationHistory: Message[] = [
        { role: 'user', content: 'What is MRR?' },
        { role: 'assistant', content: 'MRR is Monthly Recurring Revenue.' },
      ];

      const result = await service.generateSemanticQuery({
        question: 'Show me the trend',
        semanticContext: testSemanticContext,
        conversationHistory,
        workspaceId: 'ws-1',
      });

      expect(result.trace.fullPrompt).toContain('Show me the trend');
    });
  });

  describe('generateSummary', () => {
    it('returns a valid SummaryResult structure', async () => {
      const result = await service.generateSummary({
        question: 'What is MRR?',
        sql: 'SELECT 1 AS mrr',
        results: [{ mrr: 150 }],
        workspaceId: 'ws-1',
      });

      expect(typeof result.summary).toBe('string');
      expect(result.trace.id).toBeDefined();
    });
  });

  describe('chat', () => {
    it('returns a valid ChatResult structure', async () => {
      const result = await service.chat({
        message: 'What can you help me with?',
        conversationHistory: [],
        workspaceId: 'ws-1',
      });

      expect(typeof result.response).toBe('string');
      expect(result.trace.id).toBeDefined();
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
      expect(provider.complete).toHaveBeenCalledTimes(2);
    });
  });
});

describe('buildSemanticQueryPrompt', () => {
  it('includes the question and registry context', () => {
    const prompt = buildSemanticQueryPrompt('What is our MRR?', testSemanticContext);

    expect(prompt).toContain('What is our MRR?');
    expect(prompt).toContain('Subscription');
    expect(prompt).toContain('mrr');
    expect(prompt).toContain('Never return SQL');
  });
});

describe('buildSummaryPrompt', () => {
  it('includes SQL and result data', () => {
    const prompt = buildSummaryPrompt('What is MRR?', 'SELECT 1', [{ mrr: 1 }]);

    expect(prompt).toContain('SELECT 1');
    expect(prompt).toContain('"mrr": 1');
  });
});

describe('parseSemanticQueryResponse', () => {
  it('parses valid wrapped SemanticQuery JSON', () => {
    const result = parseSemanticQueryResponse(JSON.stringify({
      semanticQuery: { metrics: ['mrr'], dimensions: ['plan'], limit: 50 },
      confidence: 0.8,
      assumptions: ['Using certified MRR'],
    }));

    expect(result.semanticQuery?.metrics).toEqual(['mrr']);
    expect(result.confidence).toBe(0.8);
    expect(result.assumptions).toEqual(['Using certified MRR']);
  });

  it('rejects raw SQL payloads', () => {
    const result = parseSemanticQueryResponse(JSON.stringify({
      sql: 'SELECT * FROM subscriptions',
      confidence: 0.9,
    }));

    expect(result.semanticQuery).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it('returns null for invalid JSON', () => {
    const result = parseSemanticQueryResponse('not json');

    expect(result.semanticQuery).toBeNull();
    expect(result.assumptions[0]).toContain('not valid SemanticQuery JSON');
  });
});

describe('response parsers', () => {
  it('parses summary JSON', () => {
    expect(parseSummaryResponse(JSON.stringify({ summary: 'Revenue is up.' }))).toBe('Revenue is up.');
  });

  it('parses chat JSON', () => {
    expect(parseChatResponse(JSON.stringify({ response: 'Hello' }))).toBe('Hello');
  });
});
