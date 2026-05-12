/**
 * Conversation Service implementation.
 *
 * Provides CRUD operations for conversations and messages,
 * enabling persistent AI conversation history with context
 * for follow-up coherence.
 *
 * Requirements: 22.1, 22.3
 */

import { SupabaseClient } from '@supabase/supabase-js';

// --- Interfaces ---

export interface Conversation {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ConversationService {
  createConversation(workspaceId: string, userId: string, title?: string): Promise<Conversation>;
  getConversations(workspaceId: string, userId: string): Promise<Conversation[]>;
  getConversation(conversationId: string): Promise<Conversation>;
  addMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<Message>;
  getMessages(conversationId: string): Promise<Message[]>;
}

// --- Factory ---

/**
 * Creates a ConversationService instance.
 *
 * @param supabase - Supabase client for database operations
 */
export function createConversationService(supabase: SupabaseClient): ConversationService {
  return {
    async createConversation(
      workspaceId: string,
      userId: string,
      title?: string
    ): Promise<Conversation> {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          title: title || 'New Conversation',
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create conversation: ${error.message}`);
      }

      return data as Conversation;
    },

    async getConversations(workspaceId: string, userId: string): Promise<Conversation[]> {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch conversations: ${error.message}`);
      }

      return (data ?? []) as Conversation[];
    },

    async getConversation(conversationId: string): Promise<Conversation> {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch conversation: ${error.message}`);
      }

      return data as Conversation;
    },

    async addMessage(
      conversationId: string,
      role: 'user' | 'assistant' | 'system',
      content: string,
      metadata?: Record<string, unknown>
    ): Promise<Message> {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          role,
          content,
          metadata: metadata ?? {},
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to add message: ${error.message}`);
      }

      // Update the conversation's updated_at timestamp
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      return data as Message;
    },

    async getMessages(conversationId: string): Promise<Message[]> {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch messages: ${error.message}`);
      }

      return (data ?? []) as Message[];
    },
  };
}

/**
 * Converts stored messages to the format expected by the AI provider.
 * This enables including prior conversation context in AI calls
 * for follow-up coherence (Requirement 22.3).
 *
 * @param messages - Messages from the conversation history
 * @returns Messages formatted for the AI provider
 */
export function messagesToAIContext(
  messages: Message[]
): { role: 'user' | 'assistant' | 'system'; content: string }[] {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}
