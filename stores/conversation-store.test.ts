import { describe, it, expect, beforeEach } from 'vitest';
import { useConversationStore } from './conversation-store';
import { Conversation, Message } from '@/lib/conversations/conversation-service';

describe('useConversationStore', () => {
  beforeEach(() => {
    useConversationStore.setState({
      conversations: [],
      currentConversation: null,
      messages: [],
      isLoading: false,
    });
  });

  it('should initialize with default state', () => {
    const state = useConversationStore.getState();
    expect(state.conversations).toEqual([]);
    expect(state.currentConversation).toBeNull();
    expect(state.messages).toEqual([]);
    expect(state.isLoading).toBe(false);
  });

  it('should set conversations', () => {
    const conversations: Conversation[] = [
      {
        id: 'conv-1',
        workspace_id: 'ws-1',
        user_id: 'user-1',
        title: 'Revenue Analysis',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      },
      {
        id: 'conv-2',
        workspace_id: 'ws-1',
        user_id: 'user-1',
        title: 'Churn Investigation',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ];

    useConversationStore.getState().setConversations(conversations);

    expect(useConversationStore.getState().conversations).toEqual(conversations);
  });

  it('should set current conversation', () => {
    const conversation: Conversation = {
      id: 'conv-1',
      workspace_id: 'ws-1',
      user_id: 'user-1',
      title: 'Revenue Analysis',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    };

    useConversationStore.getState().setCurrentConversation(conversation);

    expect(useConversationStore.getState().currentConversation).toEqual(conversation);
  });

  it('should clear current conversation by setting null', () => {
    const conversation: Conversation = {
      id: 'conv-1',
      workspace_id: 'ws-1',
      user_id: 'user-1',
      title: 'Revenue Analysis',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    };

    useConversationStore.getState().setCurrentConversation(conversation);
    useConversationStore.getState().setCurrentConversation(null);

    expect(useConversationStore.getState().currentConversation).toBeNull();
  });

  it('should set messages', () => {
    const messages: Message[] = [
      {
        id: 'msg-1',
        conversation_id: 'conv-1',
        role: 'user',
        content: 'What is our MRR?',
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'msg-2',
        conversation_id: 'conv-1',
        role: 'assistant',
        content: 'Your MRR is $50,000',
        metadata: { confidence: 0.9 },
        created_at: '2024-01-01T00:00:01Z',
      },
    ];

    useConversationStore.getState().setMessages(messages);

    expect(useConversationStore.getState().messages).toEqual(messages);
  });

  it('should add a single message to existing messages', () => {
    const existingMessage: Message = {
      id: 'msg-1',
      conversation_id: 'conv-1',
      role: 'user',
      content: 'What is our MRR?',
      metadata: {},
      created_at: '2024-01-01T00:00:00Z',
    };

    const newMessage: Message = {
      id: 'msg-2',
      conversation_id: 'conv-1',
      role: 'assistant',
      content: 'Your MRR is $50,000',
      metadata: { confidence: 0.9 },
      created_at: '2024-01-01T00:00:01Z',
    };

    useConversationStore.getState().setMessages([existingMessage]);
    useConversationStore.getState().addMessage(newMessage);

    const state = useConversationStore.getState();
    expect(state.messages).toHaveLength(2);
    expect(state.messages[0]).toEqual(existingMessage);
    expect(state.messages[1]).toEqual(newMessage);
  });

  it('should add a message to empty messages array', () => {
    const message: Message = {
      id: 'msg-1',
      conversation_id: 'conv-1',
      role: 'user',
      content: 'Hello',
      metadata: {},
      created_at: '2024-01-01T00:00:00Z',
    };

    useConversationStore.getState().addMessage(message);

    expect(useConversationStore.getState().messages).toEqual([message]);
  });

  it('should set loading state', () => {
    useConversationStore.getState().setIsLoading(true);
    expect(useConversationStore.getState().isLoading).toBe(true);

    useConversationStore.getState().setIsLoading(false);
    expect(useConversationStore.getState().isLoading).toBe(false);
  });
});
