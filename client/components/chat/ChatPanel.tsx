import { useRef, useEffect, useCallback, useState } from "react";
import { Send, Loader2, Bot, Plus, XCircle, Check } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { auth } from "@/lib/firebase";
import { useTenantId } from "@/contexts/TenantContext";
import { useChatStore } from "@/stores/chatStore";
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
  const { messages, isLoading, sessionKey, addMessage, setLoading, newChat } = useChatStore();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);

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

  const doSend = useCallback(async (text: string) => {
    if (!text || isLoading || !tenantId) return;

    const user = auth?.currentUser;
    if (!user) return;

    addMessage({ role: "user", text });
    setLoading(true);

    try {
      const token = await user.getIdToken();
      const payload = {
        message: text,
        sessionKey,
      };

      const res = await fetch(`${API_BASE}/api/tenants/${tenantId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Request failed", requestId: "" }));
        const requestIdText = err.requestId ? ` (ref: ${err.requestId})` : "";
        throw new Error((err.message || `HTTP ${res.status}`) + requestIdText);
      }

      const data = await res.json();
      addMessage({ role: "assistant", text: data.reply || "I couldn't generate a response." });

      if (Array.isArray(data.warnings) && data.warnings.length > 0) {
        addMessage({ role: "assistant", text: `Warning: ${data.warnings.join("\n")}` });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong";
      addMessage({ role: "assistant", text: `Sorry, I encountered an error: ${errorMessage}` });
    } finally {
      setLoading(false);
    }
  }, [isLoading, tenantId, addMessage, setLoading, sessionKey]);

  const sendMessage = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput("");
    doSend(trimmed);
  }, [input, doSend]);

  // Check if the last assistant message is asking for confirmation
  const lastMsg = messages[messages.length - 1];
  const showConfirmButtons = !isLoading && lastMsg?.role === "assistant" && CONFIRM_PATTERN.test(lastMsg.text);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!tenantId) return null;

  return (
    <div className={cn("flex flex-col min-h-0 overflow-hidden", className)}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
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
                size="icon"
                className="h-7 w-7"
                onClick={newChat}
                aria-label="New chat"
                title="New chat"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onClose}
                aria-label="Close"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Messages area */}
      <ScrollArea
        className="flex-1 min-h-0 px-4 py-3"
        ref={(node: HTMLDivElement | null) => {
          viewportRef.current = node?.querySelector<HTMLDivElement>(
            "[data-radix-scroll-area-viewport]"
          ) ?? null;
        }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12 px-4">
            <Bot className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-foreground mb-2">Meza HR Assistant</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Ask me about employees, payroll, leave, interviews, or finances.
            </p>
            <ul className="text-xs text-muted-foreground mt-2 space-y-1 text-left">
              <li>&bull; "How many active employees?"</li>
              <li>&bull; "Who is on leave today?"</li>
              <li>&bull; "Show overdue invoices"</li>
              <li>&bull; "Payroll summary for this month"</li>
            </ul>
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
                <Markdown
                  skipHtml
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => <p className="font-bold mb-1">{children}</p>,
                    h2: ({ children }) => <p className="font-bold mb-1">{children}</p>,
                    h3: ({ children }) => <p className="font-semibold mb-1">{children}</p>,
                    p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc ml-4 mb-1.5 last:mb-0">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal ml-4 mb-1.5 last:mb-0">{children}</ol>,
                    li: ({ children }) => <li className="mb-0.5">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    a: ({ href, children }) => {
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
                    table: ({ children }) => (
                      <div className="overflow-x-auto mb-1.5 last:mb-0 -mx-1">
                        <table className="min-w-full text-xs border-collapse">{children}</table>
                      </div>
                    ),
                    thead: ({ children }) => <thead className="border-b border-foreground/20">{children}</thead>,
                    tbody: ({ children }) => <tbody>{children}</tbody>,
                    tr: ({ children }) => <tr className="border-b border-foreground/10 last:border-0">{children}</tr>,
                    th: ({ children }) => <th className="px-1.5 py-1 text-left font-semibold whitespace-nowrap">{children}</th>,
                    td: ({ children }) => <td className="px-1.5 py-1 whitespace-nowrap">{children}</td>,
                    code: ({ children }) => (
                      <code className="bg-background/50 rounded px-1 py-0.5 text-xs">{children}</code>
                    ),
                    pre: ({ children }) => (
                      <pre className="bg-background/50 rounded p-2 text-xs overflow-x-auto mb-1.5 last:mb-0">{children}</pre>
                    ),
                  }}
                >
                  {msg.text}
                </Markdown>
              ) : (
                msg.text
              )}
            </div>
          ))}
          {isLoading && (
            <div className="mr-auto bg-muted text-muted-foreground rounded-lg px-3 py-2 text-sm flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Thinking...
            </div>
          )}
          {showConfirmButtons && (
            <div className="flex gap-2 mr-auto">
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs gap-1"
                onClick={() => doSend("Yes, please proceed.")}
              >
                <Check className="h-3 w-3" />
                Confirm
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => doSend("No, cancel.")}
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
