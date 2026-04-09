import { useRef, useEffect, useCallback, useState } from "react";
import { Send, Loader2, Bot, Plus, X, Check, XCircle, ChevronRight, ChevronDown, Circle } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { auth } from "@/lib/firebase";
import { useTenantId } from "@/contexts/TenantContext";
import { useChatStore, type ProgressStep, type ChatMessage, type StepStatus } from "@/stores/chatStore";
import { cn } from "@/lib/utils";

const API_BASE = import.meta.env.VITE_MEZA_API_URL || "https://meza.naroman.tl";

const CONFIRM_PATTERN = /(?:shall i|should i|would you like me to|do you want me to|want me to|like me to|go ahead|proceed|confirm)[\s\S]*\?\s*$/i;
const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

function sanitizeLinkHref(href?: string): string | null {
  if (!href) return null;
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "https://meza.naroman.tl";
    const parsed = new URL(href, base);
    if (!SAFE_LINK_PROTOCOLS.has(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

// ── Contextual loading messages ──────────────────────────────────────────────

const THINKING_MESSAGES: Record<string, string[]> = {
  payroll: [
    "Calculating salaries...",
    "Checking tax rates...",
    "Running compliance checks...",
  ],
  accounting: [
    "Checking accounts...",
    "Verifying balances...",
    "Reviewing entries...",
  ],
  leave: [
    "Checking leave balances...",
    "Reviewing schedule...",
  ],
  default: [
    "Looking into it...",
    "Checking the data...",
    "Almost there...",
  ],
};

function getThinkingCategory(lastUserMessage: string): string {
  const lower = lastUserMessage.toLowerCase();
  if (/payroll|salary|salaries|wit|inss|pay run/.test(lower)) return "payroll";
  if (/journal|ledger|trial balance|accounting|entry|debit|credit/.test(lower))
    return "accounting";
  if (/leave|vacation|sick|pto/.test(lower)) return "leave";
  return "default";
}

function getThinkingMessage(messages: ChatMessage[], thinkingIdx: number): string {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const category = lastUserMsg ? getThinkingCategory(lastUserMsg.text) : "default";
  const msgs = THINKING_MESSAGES[category];
  return msgs[thinkingIdx % msgs.length];
}

// ── Markdown components (stable reference) ──────────────────────────────────

const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <p className="font-bold mb-1">{children}</p>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <p className="font-bold mb-1">{children}</p>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <p className="font-semibold mb-1">{children}</p>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-1.5 last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc ml-4 mb-1.5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal ml-4 mb-1.5 last:mb-0">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="mb-0.5">{children}</li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
    const safeHref = sanitizeLinkHref(href);
    if (!safeHref) {
      return <span className="text-muted-foreground">{children}</span>;
    }
    return (
      <a href={safeHref} target="_blank" rel="noopener noreferrer" className="underline text-primary">
        {children}
      </a>
    );
  },
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto mb-1.5 last:mb-0 -mx-1">
      <table className="min-w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="border-b border-foreground/20">{children}</thead>
  ),
  tbody: ({ children }: { children?: React.ReactNode }) => <tbody>{children}</tbody>,
  tr: ({ children }: { children?: React.ReactNode }) => (
    <tr className="border-b border-foreground/10 last:border-0">{children}</tr>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-1.5 py-1 text-left font-semibold whitespace-nowrap">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="px-1.5 py-1 whitespace-nowrap">{children}</td>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="bg-background/50 rounded px-1 py-0.5 text-xs">{children}</code>
  ),
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="bg-background/50 rounded p-2 text-xs overflow-x-auto mb-1.5 last:mb-0">{children}</pre>
  ),
};

// ── StepLog Component ────────────────────────────────────────────────────────

function StepLog({
  steps,
  collapsed,
  duration,
  onToggle,
}: {
  steps: ProgressStep[];
  collapsed: boolean;
  duration?: number;
  onToggle: () => void;
}) {
  if (!steps?.length) return null;

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
      >
        <ChevronRight className="h-3 w-3" />
        <span>{steps.length} steps</span>
        {duration != null && (
          <span className="text-muted-foreground/60">
            {(duration / 1000).toFixed(1)}s
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="mb-3 space-y-1">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown className="h-3 w-3" />
        <span>Steps</span>
        {duration != null && (
          <span className="text-muted-foreground/60">
            {(duration / 1000).toFixed(1)}s
          </span>
        )}
      </button>
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2 text-xs ml-2">
          {step.status === "done" ? (
            <Check className="h-3 w-3 text-green-500 shrink-0" />
          ) : step.status === "running" ? (
            <Loader2 className="h-3 w-3 animate-spin text-blue-500 shrink-0" />
          ) : step.status === "error" ? (
            <XCircle className="h-3 w-3 text-destructive shrink-0" />
          ) : (
            <Circle className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
          <span
            className={cn(
              step.status === "running"
                ? "text-foreground"
                : "text-muted-foreground"
            )}
          >
            {step.content}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ChatHeader({
  messages,
  headerExtra,
  onNewChat,
  onClose,
}: {
  messages: ChatMessage[];
  headerExtra?: React.ReactNode;
  onNewChat: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-gradient-to-r from-primary/5 to-transparent">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <span className="font-semibold text-sm text-foreground">Meza AI</span>
      </div>
      <div className="flex items-center gap-1">
        {headerExtra}
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onNewChat} title="New chat">
            <Plus className="h-4 w-4" />
          </Button>
        )}
        {onClose && (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose} title="Close">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

const QUICK_PROMPTS = [
  "Run payroll",
  "How many employees?",
  "Pending leave requests",
  "Show overdue invoices",
  "Trial balance",
  "Check compliance",
];

function EmptyState({ onSend }: { onSend: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-12 px-4">
      <Bot className="h-10 w-10 text-muted-foreground/50 mb-3" />
      <p className="text-sm font-medium text-foreground mb-2">Meza HR Assistant</p>
      <p className="text-xs text-muted-foreground leading-relaxed mb-4">
        Ask me about employees, payroll, leave, interviews, or finances.
      </p>
      <div className="flex flex-wrap justify-center gap-2 max-w-md">
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onSend(q)}
            className="px-3 py-1.5 text-xs rounded-full border border-border bg-muted/50 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  msg,
  index,
  thinkingMsg,
  onToggleCollapsed,
}: {
  msg: ChatMessage;
  index: number;
  thinkingMsg: string;
  onToggleCollapsed: (i: number) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-lg px-3 py-2 text-sm break-words",
        msg.role === "user"
          ? "max-w-[85%] ml-auto bg-primary text-primary-foreground whitespace-pre-wrap"
          : "max-w-[95%] mr-auto bg-muted text-foreground"
      )}
    >
      {msg.role === "assistant" ? (
        <AssistantContent msg={msg} index={index} thinkingMsg={thinkingMsg} onToggleCollapsed={onToggleCollapsed} />
      ) : (
        msg.text
      )}
    </div>
  );
}

function AssistantContent({
  msg,
  index,
  thinkingMsg,
  onToggleCollapsed,
}: {
  msg: ChatMessage;
  index: number;
  thinkingMsg: string;
  onToggleCollapsed: (i: number) => void;
}) {
  return (
    <>
      {msg.steps && msg.steps.length > 0 && (
        <StepLog
          steps={msg.steps}
          collapsed={msg.collapsed ?? false}
          duration={msg.duration}
          onToggle={() => onToggleCollapsed(index)}
        />
      )}
      {msg.isStreaming && (!msg.text || msg.text === "") ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>{thinkingMsg}</span>
        </div>
      ) : (
        <Markdown skipHtml remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {msg.text}
        </Markdown>
      )}
    </>
  );
}

function ConfirmButtons({ onSend }: { onSend: (text: string) => void }) {
  return (
    <div className="flex gap-2 mr-auto">
      <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => onSend("Yes, please proceed.")}>
        <Check className="h-3 w-3" />
        Confirm
      </Button>
      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onSend("No, cancel.")}>
        <XCircle className="h-3 w-3" />
        Cancel
      </Button>
    </div>
  );
}

function ChatInput({
  input,
  isLoading,
  inputRef,
  onInputChange,
  onSend,
}: {
  input: string;
  isLoading: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onInputChange: (val: string) => void;
  onSend: () => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="px-3 pb-3 pt-2 border-t border-border shrink-0">
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring max-h-24"
        />
        <Button
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={onSend}
          disabled={!input.trim() || isLoading}
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Standalone async helpers (outside hook to reduce hook complexity) ────────

interface ChatStoreActions {
  addMessage: (msg: ChatMessage) => void;
  updateLastMessage: (update: Partial<ChatMessage> | ((prev: ChatMessage) => Partial<ChatMessage>)) => void;
  setLoading: (loading: boolean) => void;
}

function processSSEEvent(
  event: { type: string; content?: string; status?: StepStatus },
  streamedTextRef: { current: string },
  startTime: number,
  updateLastMessage: ChatStoreActions["updateLastMessage"],
) {
  switch (event.type) {
    case "status":
      updateLastMessage({ text: "", isStreaming: true });
      break;
    case "step":
      updateLastMessage((prev) => {
        const steps = [...(prev.steps || [])];
        const existing = steps.findIndex((s) => s.content === event.content);
        if (existing >= 0) {
          steps[existing] = { ...steps[existing], status: event.status || "done" };
        } else {
          steps.push({ content: event.content!, status: event.status || "done", timestamp: Date.now() });
        }
        return { steps };
      });
      break;
    case "chunk":
      streamedTextRef.current += event.content;
      updateLastMessage({ text: streamedTextRef.current, isStreaming: true });
      break;
    case "complete":
      updateLastMessage({ text: event.content!, isStreaming: false, collapsed: true, duration: Date.now() - startTime });
      break;
    case "error":
      updateLastMessage({ text: `Error: ${event.content}`, isStreaming: false });
      break;
  }
}

async function readSSEStream(
  body: ReadableStream<Uint8Array>,
  streamedTextRef: { current: string },
  startTime: number,
  updateLastMessage: ChatStoreActions["updateLastMessage"],
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";
    for (const chunk of chunks) {
      if (!chunk.startsWith("data: ")) continue;
      try {
        processSSEEvent(JSON.parse(chunk.slice(6)), streamedTextRef, startTime, updateLastMessage);
      } catch { /* Ignore malformed SSE chunks */ }
    }
  }
}

async function doSendFallbackRequest(
  text: string,
  token: string,
  startTime: number,
  tenantId: string,
  sessionKey: string,
  currentRoute: string,
  actions: ChatStoreActions,
) {
  try {
    const res = await fetch(`${API_BASE}/api/tenants/${tenantId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message: text, sessionKey, currentRoute }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Request failed" }));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    actions.updateLastMessage({ text: data.reply || "I couldn't generate a response.", isStreaming: false, duration: Date.now() - startTime });
    if (Array.isArray(data.warnings) && data.warnings.length > 0) {
      actions.addMessage({ role: "assistant", text: `Warning: ${data.warnings.join("\n")}` });
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Something went wrong";
    actions.updateLastMessage({ text: `Sorry, I encountered an error: ${errorMessage}`, isStreaming: false });
  } finally {
    actions.setLoading(false);
  }
}

async function doSendStreamingRequest(
  text: string,
  tenantId: string,
  sessionKey: string,
  currentRoute: string,
  actions: ChatStoreActions,
) {
  const user = auth?.currentUser;
  if (!user) return;

  actions.addMessage({ role: "user", text });
  actions.setLoading(true);
  const startTime = Date.now();
  actions.addMessage({ role: "assistant", text: "", isStreaming: true, steps: [] });

  try {
    const token = await user.getIdToken();
    const res = await fetch(`${API_BASE}/api/tenants/${tenantId}/chat-stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message: text, sessionKey, currentRoute }),
    });

    if (res.status === 404) return doSendFallbackRequest(text, token, startTime, tenantId, sessionKey, currentRoute, actions);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Request failed" }));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    if (!res.body) throw new Error("No response body for streaming");

    const streamedTextRef = { current: "" };
    await readSSEStream(res.body, streamedTextRef, startTime, actions.updateLastMessage);

    // If we never got a 'complete' event, finalize
    const lastState = useChatStore.getState();
    const lastAssistant = lastState.messages[lastState.messages.length - 1];
    if (lastAssistant?.isStreaming) {
      actions.updateLastMessage({ text: streamedTextRef.current || lastAssistant.text, isStreaming: false, duration: Date.now() - startTime, collapsed: true });
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Something went wrong";
    actions.updateLastMessage({ text: `Sorry, I encountered an error: ${errorMessage}`, isStreaming: false });
  } finally {
    actions.setLoading(false);
  }
}

// ── useChatPanel hook ───────────────────────────────────────────────────────

function useChatPanel(tenantId: string) {
  const {
    messages,
    isLoading,
    sessionKey,
    currentRoute,
    addMessage,
    updateLastMessage,
    setLoading,
    newChat,
    toggleCollapsed,
  } = useChatStore();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);
  const [thinkingIdx, setThinkingIdx] = useState(0);

  // Track whether user is scrolled near the bottom
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onScroll = () => {
      const threshold = 80;
      isNearBottomRef.current =
        el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Auto-scroll only when user is near the bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Rotate thinking message every 3s while loading
  useEffect(() => {
    if (!isLoading) return;
    const timer = setInterval(() => {
      setThinkingIdx((i) => i + 1);
    }, 3000);
    return () => { clearInterval(timer); setThinkingIdx(0); };
  }, [isLoading]);

  const doSendStreaming = useCallback(
    (text: string) => {
      if (!text || isLoading || !tenantId) return;
      void doSendStreamingRequest(text, tenantId, sessionKey, currentRoute, { addMessage, updateLastMessage, setLoading });
    },
    [isLoading, tenantId, sessionKey, currentRoute, addMessage, updateLastMessage, setLoading]
  );

  const sendMessage = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput("");
    doSendStreaming(trimmed);
  }, [input, doSendStreaming]);

  const lastMsg = messages[messages.length - 1];
  const showConfirmButtons =
    !isLoading && lastMsg?.role === "assistant" && !lastMsg.isStreaming && CONFIRM_PATTERN.test(lastMsg.text);

  const currentThinkingMsg = getThinkingMessage(messages, thinkingIdx);

  return {
    messages, isLoading, input, setInput,
    bottomRef, inputRef, viewportRef,
    newChat, toggleCollapsed, doSendStreaming, sendMessage,
    showConfirmButtons, currentThinkingMsg,
  };
}

// ── ChatPanel ────────────────────────────────────────────────────────────────

interface ChatPanelProps {
  className?: string;
  showHeader?: boolean;
  onClose?: () => void;
  headerExtra?: React.ReactNode;
}

const ChatPanel = ({
  className,
  showHeader = true,
  onClose,
  headerExtra,
}: ChatPanelProps) => {
  const tenantId = useTenantId();
  const {
    messages, isLoading, input, setInput,
    bottomRef, inputRef, viewportRef,
    newChat, toggleCollapsed, doSendStreaming, sendMessage,
    showConfirmButtons, currentThinkingMsg,
  } = useChatPanel(tenantId);

  if (!tenantId) return null;

  return (
    <div className={cn("flex flex-col min-h-0 overflow-hidden", className)}>
      {showHeader && (
        <ChatHeader messages={messages} headerExtra={headerExtra} onNewChat={newChat} onClose={onClose} />
      )}

      <ScrollArea
        className="flex-1 min-h-0 px-4 py-3"
        ref={(node: HTMLDivElement | null) => {
          viewportRef.current =
            node?.querySelector<HTMLDivElement>("[data-radix-scroll-area-viewport]") ?? null;
        }}
      >
        {messages.length === 0 && <EmptyState onSend={doSendStreaming} />}
        <div className="flex flex-col gap-3">
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} index={i} thinkingMsg={currentThinkingMsg} onToggleCollapsed={toggleCollapsed} />
          ))}
          {isLoading && !messages.some((m) => m.isStreaming) && (
            <div className="mr-auto bg-muted text-muted-foreground rounded-lg px-3 py-2 text-sm flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              {currentThinkingMsg}
            </div>
          )}
          {showConfirmButtons && <ConfirmButtons onSend={doSendStreaming} />}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <ChatInput input={input} isLoading={isLoading} inputRef={inputRef} onInputChange={setInput} onSend={sendMessage} />
    </div>
  );
};

export default ChatPanel;
