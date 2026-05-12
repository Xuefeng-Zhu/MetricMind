/**
 * Mock AI Provider for local development without an API key.
 *
 * Analyzes user messages for keywords and returns template SQL responses
 * with realistic confidence scores and simulated processing time.
 */

import { AIProvider, CompletionOptions, CompletionResult, Message } from './provider';

interface KeywordTemplate {
  keywords: string[];
  sql: string;
  confidence: number;
}

const KEYWORD_TEMPLATES: KeywordTemplate[] = [
  {
    keywords: ['revenue', 'mrr', 'arr', 'income', 'sales'],
    sql: "SELECT SUM(mrr_cents)/100 as mrr FROM subscriptions WHERE status = 'active'",
    confidence: 0.92,
  },
  {
    keywords: ['customer', 'user', 'account', 'churn'],
    sql: "SELECT COUNT(*) as customer_count FROM customers WHERE status = 'active'",
    confidence: 0.88,
  },
  {
    keywords: ['product', 'event', 'usage', 'feature', 'session'],
    sql: "SELECT event_name, COUNT(*) as event_count FROM product_events GROUP BY event_name",
    confidence: 0.85,
  },
  {
    keywords: ['total', 'sum', 'count', 'average', 'max', 'min'],
    sql: "SELECT COUNT(*) as total, AVG(amount_cents)/100 as average_amount FROM invoices WHERE status = 'paid'",
    confidence: 0.80,
  },
];

const DEFAULT_SQL = "SELECT * FROM data LIMIT 10";
const DEFAULT_CONFIDENCE = 0.6;

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
 * Generates a mock response content string with SQL and metadata.
 */
function buildMockResponse(sql: string, confidence: number): string {
  return JSON.stringify({
    sql,
    confidence,
    citations: [],
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

    const sql = template?.sql ?? DEFAULT_SQL;
    const confidence = template?.confidence ?? DEFAULT_CONFIDENCE;

    const content = buildMockResponse(sql, confidence);

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
