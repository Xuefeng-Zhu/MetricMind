import { describe, it, expect, vi } from 'vitest';
import { MockAIProvider, detectKeywordTemplate } from './mock-provider';
import { createAIProvider } from './provider-factory';
import { Message } from './provider';

describe('MockAIProvider', () => {
  it('returns a valid CompletionResult structure', async () => {
    const provider = new MockAIProvider();
    const messages: Message[] = [
      { role: 'user', content: 'What is our total revenue?' },
    ];

    const result = await provider.complete(messages);

    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('model');
    expect(result).toHaveProperty('usage');
    expect(result.usage).toHaveProperty('inputTokens');
    expect(result.usage).toHaveProperty('outputTokens');
    expect(result.model).toBe('mock-provider');
    expect(result.usage.inputTokens).toBeGreaterThan(0);
    expect(result.usage.outputTokens).toBeGreaterThan(0);
  });

  it('returns revenue SemanticQuery for revenue keywords', async () => {
    const provider = new MockAIProvider();
    const messages: Message[] = [
      { role: 'user', content: 'What is our MRR this month?' },
    ];

    const result = await provider.complete(messages);
    const parsed = JSON.parse(result.content);

    expect(parsed.semanticQuery.metrics).toContain('mrr');
    expect(parsed.semanticQuery.time).toEqual({ dimension: 'month', grain: 'month' });
    expect(parsed.confidence).toBeGreaterThanOrEqual(0.7);
    expect(parsed.confidence).toBeLessThanOrEqual(1.0);
  });

  it('returns customer SemanticQuery for customer keywords', async () => {
    const provider = new MockAIProvider();
    const messages: Message[] = [
      { role: 'user', content: 'How many active customers do we have?' },
    ];

    const result = await provider.complete(messages);
    const parsed = JSON.parse(result.content);

    expect(parsed.semanticQuery.metrics).toContain('churn_rate');
    expect(parsed.confidence).toBeGreaterThanOrEqual(0.7);
    expect(parsed.confidence).toBeLessThanOrEqual(1.0);
  });

  it('returns product SemanticQuery for product keywords', async () => {
    const provider = new MockAIProvider();
    const messages: Message[] = [
      { role: 'user', content: 'Show me product event usage' },
    ];

    const result = await provider.complete(messages);
    const parsed = JSON.parse(result.content);

    expect(parsed.semanticQuery.metrics).toContain('active_users');
    expect(parsed.semanticQuery.dimensions).toContain('product_area');
    expect(parsed.confidence).toBeGreaterThanOrEqual(0.7);
    expect(parsed.confidence).toBeLessThanOrEqual(1.0);
  });

  it('returns aggregation SemanticQuery for aggregation keywords', async () => {
    const provider = new MockAIProvider();
    const messages: Message[] = [
      { role: 'user', content: 'What is the average invoice amount?' },
    ];

    const result = await provider.complete(messages);
    const parsed = JSON.parse(result.content);

    expect(parsed.semanticQuery.metrics).toContain('support_ticket_volume');
    expect(parsed.confidence).toBeGreaterThanOrEqual(0.7);
    expect(parsed.confidence).toBeLessThanOrEqual(1.0);
  });

  it('returns default SemanticQuery when no keywords match', async () => {
    const provider = new MockAIProvider();
    const messages: Message[] = [
      { role: 'user', content: 'Tell me something interesting' },
    ];

    const result = await provider.complete(messages);
    const parsed = JSON.parse(result.content);

    expect(parsed.semanticQuery).toEqual({ metrics: ['mrr'], limit: 10 });
    expect(parsed.confidence).toBeGreaterThanOrEqual(0.5);
    expect(parsed.confidence).toBeLessThan(0.7);
  });

  it('uses the last user message for keyword detection', async () => {
    const provider = new MockAIProvider();
    const messages: Message[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'Show me the revenue breakdown' },
    ];

    const result = await provider.complete(messages);
    const parsed = JSON.parse(result.content);

    expect(parsed.semanticQuery.metrics).toContain('mrr');
    expect(parsed.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('includes assumptions in the response', async () => {
    const provider = new MockAIProvider();
    const messages: Message[] = [
      { role: 'user', content: 'What is our revenue?' },
    ];

    const result = await provider.complete(messages);
    const parsed = JSON.parse(result.content);

    expect(parsed.assumptions).toBeDefined();
    expect(parsed.assumptions.length).toBeGreaterThan(0);
  });
});

describe('detectKeywordTemplate', () => {
  it('detects revenue keywords', () => {
    expect(detectKeywordTemplate('What is our MRR?')).not.toBeNull();
    expect(detectKeywordTemplate('Show ARR growth')).not.toBeNull();
    expect(detectKeywordTemplate('Total sales this quarter')).not.toBeNull();
  });

  it('detects customer keywords', () => {
    expect(detectKeywordTemplate('How many customers?')).not.toBeNull();
    expect(detectKeywordTemplate('What is our churn rate?')).not.toBeNull();
    expect(detectKeywordTemplate('Active user count')).not.toBeNull();
  });

  it('detects product keywords', () => {
    expect(detectKeywordTemplate('Product usage stats')).not.toBeNull();
    expect(detectKeywordTemplate('Feature adoption')).not.toBeNull();
    expect(detectKeywordTemplate('Session duration')).not.toBeNull();
  });

  it('detects aggregation keywords', () => {
    expect(detectKeywordTemplate('Total invoices')).not.toBeNull();
    expect(detectKeywordTemplate('Sum of payments')).not.toBeNull();
    expect(detectKeywordTemplate('Average deal size')).not.toBeNull();
    expect(detectKeywordTemplate('Max value')).not.toBeNull();
    expect(detectKeywordTemplate('Min threshold')).not.toBeNull();
  });

  it('returns null for unrecognized messages', () => {
    expect(detectKeywordTemplate('Hello world')).toBeNull();
    expect(detectKeywordTemplate('Tell me a joke')).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(detectKeywordTemplate('REVENUE growth')).not.toBeNull();
    expect(detectKeywordTemplate('Customer COUNT')).not.toBeNull();
  });
});

describe('createAIProvider', () => {
  it('returns MockAIProvider when no config is provided', () => {
    const provider = createAIProvider();
    expect(provider).toBeInstanceOf(MockAIProvider);
  });

  it('returns MockAIProvider when config has empty apiKey', () => {
    const provider = createAIProvider({
      endpoint: 'https://api.openai.com/v1',
      model: 'gpt-4',
      apiKey: '',
    });
    expect(provider).toBeInstanceOf(MockAIProvider);
  });

  it('returns MockAIProvider when config has whitespace-only apiKey', () => {
    const provider = createAIProvider({
      endpoint: 'https://api.openai.com/v1',
      model: 'gpt-4',
      apiKey: '   ',
    });
    expect(provider).toBeInstanceOf(MockAIProvider);
  });

  it('returns a real provider when config has a valid apiKey', () => {
    const provider = createAIProvider({
      endpoint: 'https://api.openai.com/v1',
      model: 'gpt-4',
      apiKey: 'sk-test-key-12345',
    });
    // Should not be MockAIProvider
    expect(provider).not.toBeInstanceOf(MockAIProvider);
  });
});
