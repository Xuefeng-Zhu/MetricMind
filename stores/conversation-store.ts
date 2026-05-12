import { create } from 'zustand';
import { Conversation, Message } from '@/lib/conversations/conversation-service';

export interface ConversationState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;
  isLoadingConversations: boolean;
  setConversations: (conversations: Conversation[]) => void;
  setCurrentConversation: (conversation: Conversation | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setIsLoading: (loading: boolean) => void;
  fetchConversations: (workspaceId: string) => Promise<void>;
  loadMessages: (workspaceId: string, conversationId: string) => Promise<void>;
}

export const useConversationStore = create<ConversationState>()((set) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  isLoading: false,
  isLoadingConversations: false,

  setConversations: (conversations) => set({ conversations }),

  setCurrentConversation: (conversation) => set({ currentConversation: conversation }),

  setMessages: (messages) => set({ messages }),

  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),

  setIsLoading: (loading) => set({ isLoading: loading }),

  fetchConversations: async (workspaceId: string) => {
    set({ isLoadingConversations: true });
    try {
      const response = await fetch('/api/conversations', {
        headers: { 'x-workspace-id': workspaceId },
      });
      if (response.ok) {
        const data = await response.json();
        set({ conversations: data.conversations ?? [] });
      }
    } catch {
      // Silently handle fetch errors - API may not be available yet
    } finally {
      set({ isLoadingConversations: false });
    }
  },

  loadMessages: async (workspaceId: string, conversationId: string) => {
    set({ isLoading: true });
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        headers: { 'x-workspace-id': workspaceId },
      });
      if (response.ok) {
        const data = await response.json();
        set({ messages: data.messages ?? [] });
      }
    } catch {
      // Silently handle fetch errors
    } finally {
      set({ isLoading: false });
    }
  },
}));
