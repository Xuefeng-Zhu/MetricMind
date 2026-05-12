/**
 * AI Provider factory.
 *
 * Returns the appropriate AI provider based on configuration:
 * - If a valid API key is provided, returns a stub real provider (OpenAI-compatible)
 * - If no config or no API key, returns MockAIProvider for local development
 */

import { AIProvider, AIProviderConfig, CompletionOptions, CompletionResult, Message } from './provider';
import { MockAIProvider } from './mock-provider';

/**
 * Stub implementation for a real OpenAI-compatible provider.
 * Makes HTTP requests to the configured endpoint.
 */
class OpenAICompatibleProvider implements AIProvider {
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async complete(messages: Message[], options?: CompletionOptions): Promise<CompletionResult> {
    const response = await fetch(`${this.config.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`AI provider error (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    if (!choice) {
      throw new Error('AI provider returned no choices');
    }

    return {
      content: choice.message?.content ?? '',
      model: data.model ?? this.config.model,
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
    };
  }
}

/**
 * Creates an AI provider based on the given configuration.
 *
 * - If config is provided with a non-empty apiKey, returns an OpenAI-compatible provider.
 * - Otherwise, returns a MockAIProvider for local development.
 */
export function createAIProvider(config?: AIProviderConfig): AIProvider {
  if (config && config.apiKey && config.apiKey.trim().length > 0) {
    return new OpenAICompatibleProvider(config);
  }

  return new MockAIProvider();
}
