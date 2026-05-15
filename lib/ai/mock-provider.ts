/**
 * Mock AI Provider for local development without an API key.
 *
 * Analyzes user messages for keywords and returns template SQL responses
 * with realistic confidence scores and simulated processing time.
 */

import { AIProvider, CompletionOptions, CompletionResult, Message } from './provider';

interface KeywordTemplate {
  keywords: string[];
  semanticQuery: Record<string, unknown>;
  confidence: number;
}

const KEYWORD_TEMPLATES: KeywordTemplate[] = [
  {
    keywords: ['revenue', 'mrr', 'arr', 'income', 'sales'],
    semanticQuery: { metrics: ['mrr'] },
    confidence: 0.92,
  },
  {
    keywords: ['customer', 'user', 'account', 'churn'],
    semanticQuery: { metrics: ['churn_rate'], time: { dimension: 'week', grain: 'week' } },
    confidence: 0.88,
  },
  {
    keywords: ['product', 'event', 'usage', 'feature', 'session'],
    semanticQuery: { metrics: ['active_users'], dimensions: ['product_area'] },
    confidence: 0.85,
  },
  {
    keywords: ['total', 'sum', 'count', 'average', 'max', 'min'],
    semanticQuery: { metrics: ['support_ticket_volume'] },
    confidence: 0.80,
  },
];

const DEFAULT_SEMANTIC_QUERY = { metrics: ['mrr'], limit: 10 };
const DEFAULT_CONFIDENCE = 0.6;

function buildRevenueSemanticQuery(message: string): Record<string, unknown> {
  const lowerMessage = message.toLowerCase();
  const semanticQuery: Record<string, unknown> = { metrics: ['mrr'] };
  const dimensions: string[] = [];

  if (lowerMessage.includes('plan')) {
    dimensions.push('plan');
  }

  if (lowerMessage.includes('month')) {
    semanticQuery.time = { dimension: 'month', grain: 'month' };
  }

  if (lowerMessage.includes('week')) {
    semanticQuery.time = { dimension: 'week', grain: 'week' };
  }

  if (dimensions.length > 0) {
    semanticQuery.dimensions = dimensions;
  }

  return semanticQuery;
}

function buildSemanticQueryFromTemplate(template: KeywordTemplate | null, message: string): Record<string, unknown> {
  if (!template) return DEFAULT_SEMANTIC_QUERY;

  if (template.keywords.includes('mrr') || template.keywords.includes('revenue')) {
    return buildRevenueSemanticQuery(message);
  }

  return template.semanticQuery;
}

/**
 * Detects which keyword template matches the user message.
 * Returns the first matching template or null if no match.
 */
export function detectKeywordTemplate(message: string): KeywordTemplate | null {
  const lowerMessage = message.toLowerCase();

  for (const template of KEYWORD_TEMPLATES) {
    if (template.keywords.some((keyword) => lowerMessage.includes(keyword))) {
      return template;
    }
  }

  return null;
}

/**
 * Generates a mock response content string with SemanticQuery and metadata.
 */
function buildMockResponse(semanticQuery: Record<string, unknown>, confidence: number): string {
  return JSON.stringify({
    semanticQuery,
    confidence,
    assumptions: ['Using mock AI provider - no real AI inference performed'],
  });
}

/**
 * Simulates processing delay between 100-500ms.
 */
function simulateDelay(): Promise<void> {
  const delay = Math.floor(Math.random() * 400) + 100;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Extracts the last user message from the message array.
 */
function getLastUserMessage(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      return messages[i].content;
    }
  }
  return '';
}

export class MockAIProvider implements AIProvider {
  async complete(messages: Message[], options?: CompletionOptions): Promise<CompletionResult> {
    await simulateDelay();

    const userMessage = getLastUserMessage(messages);
    const template = detectKeywordTemplate(userMessage);

    const semanticQuery = buildSemanticQueryFromTemplate(template, userMessage);
    const confidence = template?.confidence ?? DEFAULT_CONFIDENCE;

    const content = buildMockResponse(semanticQuery, confidence);

    // Simulate token usage based on message lengths
    const inputTokens = messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
    const outputTokens = Math.ceil(content.length / 4);

    return {
      content,
      model: 'mock-provider',
      usage: {
        inputTokens,
        outputTokens,
      },
    };
  }
}
