/**
 * AI Provider abstraction layer.
 *
 * Supports any OpenAI-compatible API endpoint through a common interface.
 * When no API key is configured, the system falls back to MockAIProvider.
 */

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface CompletionResult {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface AIProvider {
  complete(messages: Message[], options?: CompletionOptions): Promise<CompletionResult>;
}

export interface AIProviderConfig {
  endpoint: string;
  model: string;
  apiKey: string; // stored encrypted, never sent to client
}
