import { create } from 'zustand';

export type StepStatus = 'pending' | 'running' | 'done' | 'error';

export type ProgressStep = {
  content: string;
  status: StepStatus;
  timestamp?: number;
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  text: string;
  isStreaming?: boolean;
  steps?: ProgressStep[];
  collapsed?: boolean;
  duration?: number;
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
  updateLastMessage: (update: Partial<ChatMessage> | ((prev: ChatMessage) => Partial<ChatMessage>)) => void;
  setLoading: (loading: boolean) => void;
  clearMessages: () => void;
  newChat: () => void;
  toggleCollapsed: (index: number) => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  isOpen: false,
  messages: [],
  isLoading: false,
  sessionKey: createSessionKey(),

  setOpen: (open) => set({ isOpen: open }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  updateLastMessage: (update) =>
    set((s) => {
      if (s.messages.length === 0) return s;
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      const patch = typeof update === 'function' ? update(last) : update;
      msgs[msgs.length - 1] = { ...last, ...patch };
      return { messages: msgs };
    }),
  setLoading: (loading) => set({ isLoading: loading }),
  clearMessages: () => set({ messages: [] }),
  newChat: () => set({ messages: [], isLoading: false, sessionKey: createSessionKey() }),
  toggleCollapsed: (index) =>
    set((s) => {
      const msgs = [...s.messages];
      if (msgs[index]) {
        msgs[index] = { ...msgs[index], collapsed: !msgs[index].collapsed };
      }
      return { messages: msgs };
    }),
}));
