import { create } from 'zustand';

type ChatMessage = {
  role: 'user' | 'assistant';
  text: string;
};

function createSessionKey() {
  return `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

interface ChatState {
  isOpen: boolean;
  messages: ChatMessage[];
  isLoading: boolean;
  sessionKey: string;

  setOpen: (open: boolean) => void;
  addMessage: (msg: ChatMessage) => void;
  setLoading: (loading: boolean) => void;
  clearMessages: () => void;
  newChat: () => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  isOpen: false,
  messages: [],
  isLoading: false,
  sessionKey: createSessionKey(),

  setOpen: (open) => set({ isOpen: open }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setLoading: (loading) => set({ isLoading: loading }),
  clearMessages: () => set({ messages: [] }),
  newChat: () => set({ messages: [], isLoading: false, sessionKey: createSessionKey() }),
}));
