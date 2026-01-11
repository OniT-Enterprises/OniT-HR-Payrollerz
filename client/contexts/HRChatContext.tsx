import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';
import {
  HRChatMessage,
  HRChatAction,
  HRChatContext as HRChatContextType,
  sendHRChatMessage,
  generateMessageId,
  detectNavigationIntent,
} from '../services/hrChatService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'sonner';

interface HRChatState {
  isOpen: boolean;
  isMinimized: boolean;
  messages: HRChatMessage[];
  isLoading: boolean;
  pendingAction: HRChatAction | null;
  context: HRChatContextType;
  apiKey: string | null;
}

interface HRChatContextValue extends HRChatState {
  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
  minimizeChat: () => void;
  sendMessage: (content: string) => Promise<void>;
  confirmAction: () => Promise<void>;
  cancelAction: () => void;
  clearMessages: () => void;
  setApiKey: (key: string) => void;
}

const HRChatContextProvider = createContext<HRChatContextValue | null>(null);

export const useHRChatContext = () => {
  const context = useContext(HRChatContextProvider);
  if (!context) {
    throw new Error('useHRChatContext must be used within a HRChatProvider');
  }
  return context;
};

export const HRChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { session, availableTenants } = useTenant();

  // Get tenant name from availableTenants or session config
  const tenantName = session?.config?.name ||
    availableTenants.find(t => t.id === session?.tid)?.name ||
    'Company';

  const [state, setState] = useState<HRChatState>({
    isOpen: false,
    isMinimized: false,
    messages: [],
    isLoading: false,
    pendingAction: null,
    apiKey: null,
    context: {
      tenantId: session?.tid || '',
      tenantName: tenantName,
      userId: user?.uid || '',
      userEmail: user?.email || '',
      userRole: session?.role || 'viewer',
      currentPage: location.pathname,
    },
  });

  // Load API key from tenant settings or localStorage
  useEffect(() => {
    const loadApiKey = async () => {
      // Try localStorage first (for quick access)
      const localKey = localStorage.getItem('openai_api_key');
      if (localKey) {
        setState(prev => ({ ...prev, apiKey: localKey }));
        return;
      }

      // Try tenant settings in Firestore
      if (session?.tid && db) {
        try {
          const settingsRef = doc(db, 'tenants', session.tid, 'settings', 'chatbot');
          const settingsDoc = await getDoc(settingsRef);
          if (settingsDoc.exists()) {
            const key = settingsDoc.data()?.openaiApiKey;
            if (key) {
              setState(prev => ({ ...prev, apiKey: key }));
            }
          }
        } catch (error) {
          console.error('Failed to load API key from Firestore:', error);
        }
      }
    };

    loadApiKey();
  }, [session?.tid]);

  // Update context when user/tenant changes
  useEffect(() => {
    setState(prev => ({
      ...prev,
      context: {
        ...prev.context,
        tenantId: session?.tid || '',
        tenantName: tenantName,
        userId: user?.uid || '',
        userEmail: user?.email || '',
        userRole: session?.role || 'viewer',
        currentPage: location.pathname,
      },
    }));
  }, [session, user, location.pathname, tenantName]);

  // Add welcome message on first open
  useEffect(() => {
    if (state.isOpen && state.messages.length === 0) {
      const welcomeMessage: HRChatMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: `Bondia! I'm your HR/Payroll assistant for ${state.context.tenantName || 'your company'}. I can help you with:

**Tax & Payroll Calculations**
- "How much tax on a $1,200 salary?"
- "Calculate net pay for $800 gross"
- "What's the INSS contribution?"

**Timor-Leste Labor Law**
- "Is per diem taxable?"
- "How many leave days for 5 years service?"
- "Calculate 13th month for a July hire"

**Navigation**
- "Take me to run payroll"
- "Go to employee list"
- "Open tax reports"

Just ask me anything about HR, payroll, or Timor-Leste employment law!`,
        timestamp: new Date(),
      };
      setState(prev => ({
        ...prev,
        messages: [welcomeMessage],
      }));
    }
  }, [state.isOpen, state.messages.length, state.context.tenantName]);

  const toggleChat = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: !prev.isOpen,
      isMinimized: false,
    }));
  }, []);

  const openChat = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: true,
      isMinimized: false,
    }));
  }, []);

  const closeChat = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  const minimizeChat = useCallback(() => {
    setState(prev => ({
      ...prev,
      isMinimized: !prev.isMinimized,
    }));
  }, []);

  const setApiKey = useCallback((key: string) => {
    localStorage.setItem('openai_api_key', key);
    setState(prev => ({ ...prev, apiKey: key }));
    toast.success('API key saved');
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    // Add user message
    const userMessage: HRChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
    }));

    try {
      // Check for direct navigation intent first
      const navRoute = detectNavigationIntent(content);
      if (navRoute) {
        navigate(navRoute);
        const assistantMessage: HRChatMessage = {
          id: generateMessageId(),
          role: 'assistant',
          content: `Taking you to ${navRoute}. Is there anything else I can help with?`,
          timestamp: new Date(),
          action: { type: 'navigation', action: 'navigate', data: {}, navigateTo: navRoute },
        };
        setState(prev => ({
          ...prev,
          messages: [...prev.messages, assistantMessage],
          isLoading: false,
        }));
        toast.success(`Navigated to ${navRoute}`);
        return;
      }

      // Send to OpenAI
      const response = await sendHRChatMessage(
        content,
        state.context,
        state.messages,
        state.apiKey
      );

      const assistantMessage: HRChatMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        action: response.action,
      };

      // Handle navigation action from AI response
      if (response.action?.navigateTo) {
        navigate(response.action.navigateTo);
        toast.success(`Navigated to ${response.action.navigateTo}`);
      }

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        isLoading: false,
        pendingAction: response.action?.type === 'clarification' ? response.action : null,
      }));
    } catch (error: unknown) {
      console.error('HR Chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      const errorResponse: HRChatMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: `I'm sorry, I encountered an error: ${errorMessage}. Please try again.`,
        timestamp: new Date(),
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, errorResponse],
        isLoading: false,
      }));
    }
  }, [state.context, state.messages, state.apiKey, navigate]);

  const confirmAction = useCallback(async () => {
    if (!state.pendingAction) return;
    await sendMessage('yes');
  }, [state.pendingAction, sendMessage]);

  const cancelAction = useCallback(() => {
    setState(prev => ({
      ...prev,
      pendingAction: null,
    }));
    toast.info('Action cancelled');
  }, []);

  const clearMessages = useCallback(() => {
    setState(prev => ({
      ...prev,
      messages: [],
      pendingAction: null,
    }));
  }, []);

  const value: HRChatContextValue = {
    ...state,
    toggleChat,
    openChat,
    closeChat,
    minimizeChat,
    sendMessage,
    confirmAction,
    cancelAction,
    clearMessages,
    setApiKey,
  };

  return (
    <HRChatContextProvider.Provider value={value}>
      {children}
    </HRChatContextProvider.Provider>
  );
};
