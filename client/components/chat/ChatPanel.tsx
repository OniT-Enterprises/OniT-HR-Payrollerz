import { useRef, useEffect, useCallback, useState } from "react";
import { Send, Loader2, Bot, Plus, X, Check, XCircle, ChevronRight, ChevronDown, Circle } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { auth } from "@/lib/firebase";
import { useTenantId } from "@/contexts/TenantContext";
import { useChatStore, type ProgressStep } from "@/stores/chatStore";
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

// ── ChatPanel ────────────────────────────────────────────────────────────────

interface ChatPanelProps {
  className?: string;
  showHeader?: boolean;
  onClose?: () => void;
}

const ChatPanel = ({
  className,
  showHeader = true,
  onClose,
}: ChatPanelProps) => {
  const tenantId = useTenantId();
  const {
    messages,
    isLoading,
    sessionKey,
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
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Rotate thinking message every 3s while loading
  useEffect(() => {
    if (!isLoading) {
      setThinkingIdx(0);
      return;
    }
    const timer = setInterval(() => {
      setThinkingIdx((i) => i + 1);
    }, 3000);
    return () => clearInterval(timer);
  }, [isLoading]);

  // Fallback: regular non-streaming request (updates streaming placeholder)
  const doSendFallback = useCallback(
    async (text: string, token: string, startTime: number) => {
      try {
        const res = await fetch(
          `${API_BASE}/api/tenants/${tenantId}/chat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ message: text, sessionKey }),
          }
        );

        if (!res.ok) {
          const err = await res
            .json()
            .catch(() => ({ message: "Request failed" }));
          throw new Error(err.message || `HTTP ${res.status}`);
        }

        const data = await res.json();
        updateLastMessage({
          text: data.reply || "I couldn't generate a response.",
          isStreaming: false,
          duration: Date.now() - startTime,
        });

        if (Array.isArray(data.warnings) && data.warnings.length > 0) {
          addMessage({
            role: "assistant",
            text: `Warning: ${data.warnings.join("\n")}`,
          });
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Something went wrong";
        updateLastMessage({
          text: `Sorry, I encountered an error: ${errorMessage}`,
          isStreaming: false,
        });
      } finally {
        setLoading(false);
      }
    },
    [tenantId, sessionKey, addMessage, updateLastMessage, setLoading]
  );

  const doSendStreaming = useCallback(
    async (text: string) => {
      if (!text || isLoading || !tenantId) return;
      const user = auth?.currentUser;
      if (!user) return;

      addMessage({ role: "user", text });
      setLoading(true);
      const startTime = Date.now();

      // Add placeholder assistant message for streaming
      addMessage({
        role: "assistant",
        text: "",
        isStreaming: true,
        steps: [],
      });

      try {
        const token = await user.getIdToken();
        const res = await fetch(
          `${API_BASE}/api/tenants/${tenantId}/chat-stream`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ message: text, sessionKey }),
          }
        );

        // If streaming endpoint not available, fall back to regular
        if (res.status === 404) {
          return doSendFallback(text, token, startTime);
        }

        if (!res.ok) {
          const err = await res
            .json()
            .catch(() => ({ message: "Request failed" }));
          throw new Error(err.message || `HTTP ${res.status}`);
        }

        if (!res.body) {
          throw new Error("No response body for streaming");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let streamedText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() || "";

          for (const chunk of chunks) {
            if (!chunk.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(chunk.slice(6));

              switch (event.type) {
                case "status":
                  updateLastMessage({
                    text: "",
                    isStreaming: true,
                  });
                  break;
                case "step":
                  updateLastMessage((prev) => {
                    const steps = [...(prev.steps || [])];
                    const existing = steps.findIndex(
                      (s) => s.content === event.content
                    );
                    if (existing >= 0) {
                      steps[existing] = {
                        ...steps[existing],
                        status: event.status || "done",
                      };
                    } else {
                      steps.push({
                        content: event.content,
                        status: event.status || "done",
                        timestamp: Date.now(),
                      });
                    }
                    return { steps };
                  });
                  break;
                case "chunk":
                  streamedText += event.content;
                  updateLastMessage({
                    text: streamedText,
                    isStreaming: true,
                  });
                  break;
                case "complete":
                  updateLastMessage({
                    text: event.content,
                    isStreaming: false,
                    collapsed: true,
                    duration: Date.now() - startTime,
                  });
                  break;
                case "error":
                  updateLastMessage({
                    text: `Error: ${event.content}`,
                    isStreaming: false,
                  });
                  break;
              }
            } catch {
              // Ignore malformed SSE chunks
            }
          }
        }

        // If we never got a 'complete' event, finalize
        const lastState = useChatStore.getState();
        const lastAssistant = lastState.messages[lastState.messages.length - 1];
        if (lastAssistant?.isStreaming) {
          updateLastMessage({
            text: streamedText || lastAssistant.text,
            isStreaming: false,
            duration: Date.now() - startTime,
            collapsed: true,
          });
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Something went wrong";
        updateLastMessage({
          text: `Sorry, I encountered an error: ${errorMessage}`,
          isStreaming: false,
        });
      } finally {
        setLoading(false);
      }
    },
    [
      isLoading,
      tenantId,
      addMessage,
      updateLastMessage,
      setLoading,
      sessionKey,
      doSendFallback,
    ]
  );

  const sendMessage = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput("");
    doSendStreaming(trimmed);
  }, [input, doSendStreaming]);

  // Check if the last assistant message is asking for confirmation
  const lastMsg = messages[messages.length - 1];
  const showConfirmButtons =
    !isLoading &&
    lastMsg?.role === "assistant" &&
    !lastMsg.isStreaming &&
    CONFIRM_PATTERN.test(lastMsg.text);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Get contextual thinking message
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const thinkingCategory = lastUserMsg
    ? getThinkingCategory(lastUserMsg.text)
    : "default";
  const thinkingMsgs = THINKING_MESSAGES[thinkingCategory];
  const currentThinkingMsg =
    thinkingMsgs[thinkingIdx % thinkingMsgs.length];

  if (!tenantId) return null;

  return (
    <div className={cn("flex flex-col min-h-0 overflow-hidden", className)}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-sm text-foreground">
              Meza AI
            </span>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={newChat}
                title="New chat"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={onClose}
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Messages area */}
      <ScrollArea
        className="flex-1 min-h-0 px-4 py-3"
        ref={(node: HTMLDivElement | null) => {
          viewportRef.current =
            node?.querySelector<HTMLDivElement>(
              "[data-radix-scroll-area-viewport]"
            ) ?? null;
        }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12 px-4">
            <Bot className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-foreground mb-2">
              Meza HR Assistant
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              Ask me about employees, payroll, leave, interviews, or finances.
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-md">
              {[
                "Run payroll",
                "How many employees?",
                "Pending leave requests",
                "Show overdue invoices",
                "Trial balance",
                "Check compliance",
              ].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => doSendStreaming(q)}
                  className="px-3 py-1.5 text-xs rounded-full border border-border bg-muted/50 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg px-3 py-2 text-sm break-words",
                msg.role === "user"
                  ? "max-w-[85%] ml-auto bg-primary text-primary-foreground whitespace-pre-wrap"
                  : "max-w-[95%] mr-auto bg-muted text-foreground"
              )}
            >
              {msg.role === "assistant" ? (
                <>
                  {/* Step log (for messages with steps) */}
                  {msg.steps && msg.steps.length > 0 && (
                    <StepLog
                      steps={msg.steps}
                      collapsed={msg.collapsed ?? false}
                      duration={msg.duration}
                      onToggle={() => toggleCollapsed(i)}
                    />
                  )}

                  {/* Streaming indicator */}
                  {msg.isStreaming && (!msg.text || msg.text === "") ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>{currentThinkingMsg}</span>
                    </div>
                  ) : (
                    <Markdown
                      skipHtml
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => (
                          <p className="font-bold mb-1">{children}</p>
                        ),
                        h2: ({ children }) => (
                          <p className="font-bold mb-1">{children}</p>
                        ),
                        h3: ({ children }) => (
                          <p className="font-semibold mb-1">{children}</p>
                        ),
                        p: ({ children }) => (
                          <p className="mb-1.5 last:mb-0">{children}</p>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc ml-4 mb-1.5 last:mb-0">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal ml-4 mb-1.5 last:mb-0">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => (
                          <li className="mb-0.5">{children}</li>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-semibold">{children}</strong>
                        ),
                        a: ({ href, children }) => {
                          const safeHref = sanitizeLinkHref(href);
                          if (!safeHref) {
                            return (
                              <span className="text-muted-foreground">
                                {children}
                              </span>
                            );
                          }
                          return (
                            <a
                              href={safeHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline text-primary"
                            >
                              {children}
                            </a>
                          );
                        },
                        table: ({ children }) => (
                          <div className="overflow-x-auto mb-1.5 last:mb-0 -mx-1">
                            <table className="min-w-full text-xs border-collapse">
                              {children}
                            </table>
                          </div>
                        ),
                        thead: ({ children }) => (
                          <thead className="border-b border-foreground/20">
                            {children}
                          </thead>
                        ),
                        tbody: ({ children }) => <tbody>{children}</tbody>,
                        tr: ({ children }) => (
                          <tr className="border-b border-foreground/10 last:border-0">
                            {children}
                          </tr>
                        ),
                        th: ({ children }) => (
                          <th className="px-1.5 py-1 text-left font-semibold whitespace-nowrap">
                            {children}
                          </th>
                        ),
                        td: ({ children }) => (
                          <td className="px-1.5 py-1 whitespace-nowrap">
                            {children}
                          </td>
                        ),
                        code: ({ children }) => (
                          <code className="bg-background/50 rounded px-1 py-0.5 text-xs">
                            {children}
                          </code>
                        ),
                        pre: ({ children }) => (
                          <pre className="bg-background/50 rounded p-2 text-xs overflow-x-auto mb-1.5 last:mb-0">
                            {children}
                          </pre>
                        ),
                      }}
                    >
                      {msg.text}
                    </Markdown>
                  )}
                </>
              ) : (
                msg.text
              )}
            </div>
          ))}
          {/* Loading indicator (only for non-streaming) */}
          {isLoading &&
            !messages.some((m) => m.isStreaming) && (
              <div className="mr-auto bg-muted text-muted-foreground rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                {currentThinkingMsg}
              </div>
            )}
          {showConfirmButtons && (
            <div className="flex gap-2 mr-auto">
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs gap-1"
                onClick={() => doSendStreaming("Yes, please proceed.")}
              >
                <Check className="h-3 w-3" />
                Confirm
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => doSendStreaming("No, cancel.")}
              >
                <XCircle className="h-3 w-3" />
                Cancel
              </Button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="px-3 pb-3 pt-2 border-t border-border shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring max-h-24"
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
