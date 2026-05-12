import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createConversationService, messagesToAIContext, Message } from './conversation-service';

// Mock Supabase client
function createMockSupabase() {
  const mockChain = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  };

  const supabase = {
    from: vi.fn().mockReturnValue(mockChain),
  };

  return { supabase, mockChain };
}

describe('createConversationService', () => {
  let supabase: ReturnType<typeof createMockSupabase>['supabase'];
  let mockChain: ReturnType<typeof createMockSupabase>['mockChain'];

  beforeEach(() => {
    const mock = createMockSupabase();
    supabase = mock.supabase;
    mockChain = mock.mockChain;
  });

  describe('createConversation', () => {
    it('should create a conversation with default title', async () => {
      const conversation = {
        id: 'conv-1',
        workspace_id: 'ws-1',
        user_id: 'user-1',
        title: 'New Conversation',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockChain.single.mockResolvedValue({ data: conversation, error: null });

      const service = createConversationService(supabase as any);
      const result = await service.createConversation('ws-1', 'user-1');

      expect(result).toEqual(conversation);
      expect(supabase.from).toHaveBeenCalledWith('conversations');
      expect(mockChain.insert).toHaveBeenCalledWith({
        workspace_id: 'ws-1',
        user_id: 'user-1',
        title: 'New Conversation',
      });
    });

    it('should create a conversation with custom title', async () => {
      const conversation = {
        id: 'conv-1',
        workspace_id: 'ws-1',
        user_id: 'user-1',
        title: 'Revenue Analysis',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockChain.single.mockResolvedValue({ data: conversation, error: null });

      const service = createConversationService(supabase as any);
      const result = await service.createConversation('ws-1', 'user-1', 'Revenue Analysis');

      expect(result).toEqual(conversation);
      expect(mockChain.insert).toHaveBeenCalledWith({
        workspace_id: 'ws-1',
        user_id: 'user-1',
        title: 'Revenue Analysis',
      });
    });

    it('should throw on database error', async () => {
      mockChain.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const service = createConversationService(supabase as any);

      await expect(service.createConversation('ws-1', 'user-1')).rejects.toThrow(
        'Failed to create conversation: Database error'
      );
    });
  });

  describe('getConversations', () => {
    it('should return conversations sorted by updated_at descending', async () => {
      const conversations = [
        {
          id: 'conv-2',
          workspace_id: 'ws-1',
          user_id: 'user-1',
          title: 'Recent',
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-03T00:00:00Z',
        },
        {
          id: 'conv-1',
          workspace_id: 'ws-1',
          user_id: 'user-1',
          title: 'Older',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockChain.order.mockResolvedValue({ data: conversations, error: null });

      const service = createConversationService(supabase as any);
      const result = await service.getConversations('ws-1', 'user-1');

      expect(result).toEqual(conversations);
      expect(supabase.from).toHaveBeenCalledWith('conversations');
      expect(mockChain.eq).toHaveBeenCalledWith('workspace_id', 'ws-1');
      expect(mockChain.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockChain.order).toHaveBeenCalledWith('updated_at', { ascending: false });
    });

    it('should return empty array when no conversations exist', async () => {
      mockChain.order.mockResolvedValue({ data: [], error: null });

      const service = createConversationService(supabase as any);
      const result = await service.getConversations('ws-1', 'user-1');

      expect(result).toEqual([]);
    });

    it('should throw on database error', async () => {
      mockChain.order.mockResolvedValue({
        data: null,
        error: { message: 'Connection failed' },
      });

      const service = createConversationService(supabase as any);

      await expect(service.getConversations('ws-1', 'user-1')).rejects.toThrow(
        'Failed to fetch conversations: Connection failed'
      );
    });
  });

  describe('getConversation', () => {
    it('should return a single conversation by id', async () => {
      const conversation = {
        id: 'conv-1',
        workspace_id: 'ws-1',
        user_id: 'user-1',
        title: 'Test Conversation',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockChain.single.mockResolvedValue({ data: conversation, error: null });

      const service = createConversationService(supabase as any);
      const result = await service.getConversation('conv-1');

      expect(result).toEqual(conversation);
      expect(supabase.from).toHaveBeenCalledWith('conversations');
      expect(mockChain.eq).toHaveBeenCalledWith('id', 'conv-1');
    });

    it('should throw when conversation not found', async () => {
      mockChain.single.mockResolvedValue({
        data: null,
        error: { message: 'Row not found' },
      });

      const service = createConversationService(supabase as any);

      await expect(service.getConversation('nonexistent')).rejects.toThrow(
        'Failed to fetch conversation: Row not found'
      );
    });
  });

  describe('addMessage', () => {
    it('should add a user message and update conversation timestamp', async () => {
      const message = {
        id: 'msg-1',
        conversation_id: 'conv-1',
        role: 'user' as const,
        content: 'What is our MRR?',
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
      };

      // First call: insert message
      mockChain.single.mockResolvedValueOnce({ data: message, error: null });
      // Second call: update conversation (from returns a new chain)
      const updateChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      supabase.from
        .mockReturnValueOnce(mockChain) // for insert
        .mockReturnValueOnce(updateChain); // for update

      const service = createConversationService(supabase as any);
      const result = await service.addMessage('conv-1', 'user', 'What is our MRR?');

      expect(result).toEqual(message);
      expect(supabase.from).toHaveBeenCalledWith('messages');
      expect(mockChain.insert).toHaveBeenCalledWith({
        conversation_id: 'conv-1',
        role: 'user',
        content: 'What is our MRR?',
        metadata: {},
      });
    });

    it('should add a message with metadata', async () => {
      const metadata = { confidence: 0.85, sql: 'SELECT sum(amount) FROM invoices' };
      const message = {
        id: 'msg-2',
        conversation_id: 'conv-1',
        role: 'assistant' as const,
        content: 'Your MRR is $50,000',
        metadata,
        created_at: '2024-01-01T00:00:00Z',
      };

      mockChain.single.mockResolvedValueOnce({ data: message, error: null });
      const updateChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      supabase.from
        .mockReturnValueOnce(mockChain)
        .mockReturnValueOnce(updateChain);

      const service = createConversationService(supabase as any);
      const result = await service.addMessage(
        'conv-1',
        'assistant',
        'Your MRR is $50,000',
        metadata
      );

      expect(result).toEqual(message);
      expect(mockChain.insert).toHaveBeenCalledWith({
        conversation_id: 'conv-1',
        role: 'assistant',
        content: 'Your MRR is $50,000',
        metadata,
      });
    });

    it('should throw on database error', async () => {
      mockChain.single.mockResolvedValue({
        data: null,
        error: { message: 'Insert failed' },
      });

      const service = createConversationService(supabase as any);

      await expect(
        service.addMessage('conv-1', 'user', 'Hello')
      ).rejects.toThrow('Failed to add message: Insert failed');
    });
  });

  describe('getMessages', () => {
    it('should return messages sorted by created_at ascending', async () => {
      const messages = [
        {
          id: 'msg-1',
          conversation_id: 'conv-1',
          role: 'user' as const,
          content: 'What is MRR?',
          metadata: {},
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'msg-2',
          conversation_id: 'conv-1',
          role: 'assistant' as const,
          content: 'MRR is $50,000',
          metadata: { confidence: 0.9 },
          created_at: '2024-01-01T00:00:01Z',
        },
      ];

      mockChain.order.mockResolvedValue({ data: messages, error: null });

      const service = createConversationService(supabase as any);
      const result = await service.getMessages('conv-1');

      expect(result).toEqual(messages);
      expect(supabase.from).toHaveBeenCalledWith('messages');
      expect(mockChain.eq).toHaveBeenCalledWith('conversation_id', 'conv-1');
      expect(mockChain.order).toHaveBeenCalledWith('created_at', { ascending: true });
    });

    it('should return empty array when no messages exist', async () => {
      mockChain.order.mockResolvedValue({ data: [], error: null });

      const service = createConversationService(supabase as any);
      const result = await service.getMessages('conv-1');

      expect(result).toEqual([]);
    });

    it('should throw on database error', async () => {
      mockChain.order.mockResolvedValue({
        data: null,
        error: { message: 'Query failed' },
      });

      const service = createConversationService(supabase as any);

      await expect(service.getMessages('conv-1')).rejects.toThrow(
        'Failed to fetch messages: Query failed'
      );
    });
  });
});

describe('messagesToAIContext', () => {
  it('should convert messages to AI provider format', () => {
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
      {
        id: 'msg-3',
        conversation_id: 'conv-1',
        role: 'user',
        content: 'How has it changed over the last 3 months?',
        metadata: {},
        created_at: '2024-01-01T00:00:02Z',
      },
    ];

    const result = messagesToAIContext(messages);

    expect(result).toEqual([
      { role: 'user', content: 'What is our MRR?' },
      { role: 'assistant', content: 'Your MRR is $50,000' },
      { role: 'user', content: 'How has it changed over the last 3 months?' },
    ]);
  });

  it('should return empty array for empty messages', () => {
    const result = messagesToAIContext([]);
    expect(result).toEqual([]);
  });

  it('should strip metadata and only keep role and content', () => {
    const messages: Message[] = [
      {
        id: 'msg-1',
        conversation_id: 'conv-1',
        role: 'system',
        content: 'You are a helpful assistant',
        metadata: { internal: true },
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    const result = messagesToAIContext(messages);

    expect(result).toEqual([{ role: 'system', content: 'You are a helpful assistant' }]);
    expect(result[0]).not.toHaveProperty('id');
    expect(result[0]).not.toHaveProperty('metadata');
    expect(result[0]).not.toHaveProperty('conversation_id');
    expect(result[0]).not.toHaveProperty('created_at');
  });
});
