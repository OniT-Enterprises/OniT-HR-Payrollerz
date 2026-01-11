import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';
import {
  HRChatMessage,
  HRChatAction,
  HRChatContext as HRChatContextType,
  TenantData,
  sendHRChatMessage,
  generateMessageId,
  detectNavigationIntent,
} from '../services/hrChatService';
import { collection, doc, getDoc, setDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
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
  tenantData: TenantData | null;
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
  refreshTenantData: () => Promise<void>;
}

const HRChatContextProvider = createContext<HRChatContextValue | null>(null);

export const useHRChatContext = () => {
  const context = useContext(HRChatContextProvider);
  if (!context) {
    throw new Error('useHRChatContext must be used within a HRChatProvider');
  }
  return context;
};

// Helper to format dates safely
const formatDate = (date: unknown): string => {
  if (!date) return '';
  if (typeof date === 'string') return date;
  if (date && typeof date === 'object' && 'toDate' in date) {
    return (date as { toDate: () => Date }).toDate().toISOString().split('T')[0];
  }
  if (date instanceof Date) return date.toISOString().split('T')[0];
  return '';
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
    tenantData: null,
    context: {
      tenantId: session?.tid || '',
      tenantName: tenantName,
      userId: user?.uid || '',
      userEmail: user?.email || '',
      userRole: session?.role || 'viewer',
      currentPage: location.pathname,
    },
  });

  // Load all tenant data from Firestore
  const loadTenantData = useCallback(async (): Promise<TenantData | null> => {
    if (!session?.tid || !db) return null;

    try {
      const tenantId = session.tid;
      const tenantRef = collection(db, 'tenants', tenantId, 'employees');

      // Load employees
      const employeesSnap = await getDocs(tenantRef);
      const employees = employeesSnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: `${data.personalInfo?.firstName || ''} ${data.personalInfo?.lastName || ''}`.trim() || 'Unknown',
          email: data.personalInfo?.email || data.email || '',
          position: data.jobDetails?.position || data.position || 'N/A',
          department: data.jobDetails?.department || data.department || 'N/A',
          status: data.status || 'active',
          salary: data.compensation?.monthlySalary || data.salary || 0,
          hireDate: formatDate(data.jobDetails?.hireDate || data.hireDate),
        };
      });

      // Load departments
      const deptRef = collection(db, 'tenants', tenantId, 'departments');
      const deptSnap = await getDocs(deptRef);
      const departments = deptSnap.docs.map(doc => {
        const data = doc.data();
        const deptEmployees = employees.filter(e => e.department === data.name);
        return {
          id: doc.id,
          name: data.name || 'Unknown',
          managerId: data.managerId,
          employeeCount: deptEmployees.length,
        };
      });

      // Load pending leave requests
      const leaveRef = collection(db, 'tenants', tenantId, 'leaveRequests');
      const pendingLeaveQuery = query(leaveRef, where('status', '==', 'pending'), limit(20));
      const leaveSnap = await getDocs(pendingLeaveQuery);
      const pendingLeaveRequests = leaveSnap.docs.map(doc => {
        const data = doc.data();
        const employee = employees.find(e => e.id === data.employeeId);
        return {
          id: doc.id,
          employeeName: employee?.name || data.employeeName || 'Unknown',
          type: data.type || data.leaveType || 'Leave',
          startDate: formatDate(data.startDate),
          endDate: formatDate(data.endDate),
          status: data.status || 'pending',
        };
      });

      // Load recent payroll runs
      const payrunRef = collection(db, 'tenants', tenantId, 'payruns');
      const payrunQuery = query(payrunRef, orderBy('createdAt', 'desc'), limit(5));
      let recentPayruns: TenantData['recentPayruns'] = [];
      try {
        const payrunSnap = await getDocs(payrunQuery);
        recentPayruns = payrunSnap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            period: data.period || data.name || 'Unknown Period',
            status: data.status || 'unknown',
            totalAmount: data.totalAmount || data.totalGross || 0,
            employeeCount: data.employeeCount || data.payslips?.length || 0,
          };
        });
      } catch {
        // Payroll collection might not exist yet
      }

      // Load open jobs
      const jobsRef = collection(db, 'tenants', tenantId, 'jobs');
      const openJobsQuery = query(jobsRef, where('status', '==', 'open'), limit(10));
      let openJobs: TenantData['openJobs'] = [];
      try {
        const jobsSnap = await getDocs(openJobsQuery);
        openJobs = jobsSnap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || 'Untitled Position',
            department: data.department || 'N/A',
            applicants: data.applicantCount || 0,
          };
        });
      } catch {
        // Jobs collection might not exist yet
      }

      // Calculate stats
      const activeEmployees = employees.filter(e => e.status === 'active');
      const monthlyPayroll = activeEmployees.reduce((sum, e) => sum + (e.salary || 0), 0);

      // Check who's on leave today
      const today = new Date().toISOString().split('T')[0];
      const allLeaveRef = collection(db, 'tenants', tenantId, 'leaveRequests');
      const approvedLeaveQuery = query(allLeaveRef, where('status', '==', 'approved'));
      let onLeaveToday = 0;
      try {
        const approvedSnap = await getDocs(approvedLeaveQuery);
        approvedSnap.docs.forEach(doc => {
          const data = doc.data();
          const start = formatDate(data.startDate);
          const end = formatDate(data.endDate);
          if (start <= today && end >= today) {
            onLeaveToday++;
          }
        });
      } catch {
        // Leave might not exist
      }

      return {
        employees,
        departments,
        pendingLeaveRequests,
        recentPayruns,
        openJobs,
        stats: {
          totalEmployees: employees.length,
          activeEmployees: activeEmployees.length,
          totalDepartments: departments.length,
          pendingLeaveCount: pendingLeaveRequests.length,
          onLeaveToday,
          monthlyPayroll,
        },
      };
    } catch (error) {
      console.error('Failed to load tenant data for chat:', error);
      return null;
    }
  }, [session?.tid]);

  // Load API key from tenant settings or localStorage
  useEffect(() => {
    const loadApiKey = async () => {
      // Try environment variable first (for development)
      const envKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (envKey) {
        setState(prev => ({ ...prev, apiKey: envKey }));
        return;
      }

      // Try localStorage (for user-entered keys)
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

  // Load tenant data when chat opens or tenant changes
  useEffect(() => {
    if (state.isOpen && session?.tid) {
      loadTenantData().then(data => {
        if (data) {
          setState(prev => ({ ...prev, tenantData: data }));
        }
      });
    }
  }, [state.isOpen, session?.tid, loadTenantData]);

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
      const stats = state.tenantData?.stats;
      const statsInfo = stats
        ? `\n\nI can see you have **${stats.activeEmployees} active employees** across **${stats.totalDepartments} departments**${stats.pendingLeaveCount > 0 ? `, with **${stats.pendingLeaveCount} pending leave requests**` : ''}.`
        : '';

      const welcomeMessage: HRChatMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: `Bondia! I'm your HR/Payroll assistant for **${state.context.tenantName || 'your company'}**. I have full access to your company data and can help with:${statsInfo}

**Data & Analytics**
- "How many employees do we have?"
- "Who's on leave today?"
- "Show me pending leave requests"
- "What's our total payroll cost?"

**Tax & Payroll Calculations**
- "Calculate tax on a $1,200 salary"
- "What's the net pay for $800 gross?"
- "Calculate INSS contribution"

**Timor-Leste Labor Law**
- "Is per diem taxable?"
- "How many leave days for 5 years service?"
- "Calculate 13th month for a July hire"

**Navigation**
- "Take me to run payroll"
- "Go to employee list"
- "Open leave requests"

Just ask me anything about your HR data or Timor-Leste employment law!`,
        timestamp: new Date(),
      };
      setState(prev => ({
        ...prev,
        messages: [welcomeMessage],
      }));
    }
  }, [state.isOpen, state.messages.length, state.context.tenantName, state.tenantData]);

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

  const setApiKey = useCallback(async (key: string) => {
    // Save to Firestore for tenant-wide access
    if (session?.tid && db) {
      try {
        const settingsRef = doc(db, 'tenants', session.tid, 'settings', 'chatbot');
        await setDoc(settingsRef, { openaiApiKey: key }, { merge: true });
        setState(prev => ({ ...prev, apiKey: key }));
        toast.success('API key saved for all users', { duration: 2000 });
      } catch (error) {
        console.error('Failed to save API key:', error);
        // Fallback to localStorage
        localStorage.setItem('openai_api_key', key);
        setState(prev => ({ ...prev, apiKey: key }));
        toast.success('API key saved locally', { duration: 1500 });
      }
    } else {
      // No tenant, save to localStorage
      localStorage.setItem('openai_api_key', key);
      setState(prev => ({ ...prev, apiKey: key }));
      toast.success('API key saved', { duration: 1500 });
    }
  }, [session?.tid]);

  const refreshTenantData = useCallback(async () => {
    const data = await loadTenantData();
    if (data) {
      setState(prev => ({ ...prev, tenantData: data }));
    }
  }, [loadTenantData]);

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
        toast.success(`Navigated to ${navRoute}`, { duration: 1500 });
        return;
      }

      // Refresh tenant data before sending message for most up-to-date info
      const freshData = await loadTenantData();

      // Send to OpenAI with tenant data
      const response = await sendHRChatMessage(
        content,
        state.context,
        state.messages,
        state.apiKey,
        freshData || state.tenantData || undefined
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
        toast.success(`Navigated to ${response.action.navigateTo}`, { duration: 1500 });
      }

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        isLoading: false,
        pendingAction: response.action?.type === 'clarification' ? response.action : null,
        tenantData: freshData || prev.tenantData,
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
  }, [state.context, state.messages, state.apiKey, state.tenantData, navigate, loadTenantData]);

  const confirmAction = useCallback(async () => {
    if (!state.pendingAction) return;
    await sendMessage('yes');
  }, [state.pendingAction, sendMessage]);

  const cancelAction = useCallback(() => {
    setState(prev => ({
      ...prev,
      pendingAction: null,
    }));
    toast.info('Action cancelled', { duration: 1500 });
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
    refreshTenantData,
  };

  return (
    <HRChatContextProvider.Provider value={value}>
      {children}
    </HRChatContextProvider.Provider>
  );
};
