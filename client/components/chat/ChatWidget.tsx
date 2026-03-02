import { useEffect, useCallback, useState } from "react";
import { useLocation } from "react-router-dom";
import { Bot, Command, Minimize2, Maximize2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useChatStore } from "@/stores/chatStore";
import { cn } from "@/lib/utils";
import ChatPanel from "./ChatPanel";

const ChatWidget = () => {
  const { user } = useAuth();
  const { isOpen, setOpen, setCurrentRoute } = useChatStore();
  const location = useLocation();

  // Sync current route to chat store on navigation
  useEffect(() => {
    setCurrentRoute(location.pathname);
  }, [location.pathname, setCurrentRoute]);
  const [isClosing, setIsClosing] = useState(false);
  const [isMini, setIsMini] = useState(false);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setOpen(false);
      setIsClosing(false);
    }, 150);
  }, [setOpen]);

  // Keyboard shortcuts: Cmd+K / Ctrl+K to toggle, Escape to close
  useEffect(() => {
    if (!user) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) {
          handleClose();
          setIsMini(false);
        } else {
          setOpen(true);
        }
      }
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        if (isMini) {
          handleClose();
          setIsMini(false);
        } else {
          handleClose();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [user, isOpen, isMini, setOpen, handleClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) handleClose();
    },
    [handleClose],
  );

  // Only show for authenticated users
  if (!user) return null;

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center print:hidden ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
          aria-label="Open Meza assistant (⌘K)"
        >
          <Bot className="h-6 w-6" />
        </button>
      )}

      {/* Mini floating panel (bottom-right, no backdrop) */}
      {isOpen && isMini && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-[100] w-[380px] max-sm:w-[calc(100vw-2rem)] max-sm:right-4 max-sm:bottom-4 flex flex-col overflow-hidden print:hidden",
            "h-[480px] max-sm:h-[60vh]",
            "rounded-xl shadow-2xl border border-border bg-card",
            "dark:bg-[rgba(20,27,38,0.95)] dark:backdrop-blur-xl dark:border-white/10",
            "animate-in slide-in-from-bottom-4 fade-in duration-200",
          )}
        >
          <ChatPanel
            className="h-full"
            showHeader
            onClose={() => {
              handleClose();
              setIsMini(false);
            }}
            headerExtra={
              <button
                onClick={() => setIsMini(false)}
                className="h-7 w-7 p-0 inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                title="Expand to spotlight"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            }
          />
        </div>
      )}

      {/* Spotlight overlay (default mode) */}
      {isOpen && !isMini && (
        <div
          className={cn(
            "fixed inset-0 z-[100] flex items-start justify-center print:hidden",
            isClosing ? "meza-spotlight-backdrop-out" : "meza-spotlight-backdrop-in",
          )}
          onClick={handleBackdropClick}
        >
          <div
            className={cn(
              "meza-spotlight-panel mt-[12vh] w-full max-w-[680px] mx-4 flex flex-col overflow-hidden",
              "h-[520px] max-sm:mt-[6vh] max-sm:mx-3 max-sm:max-w-none max-sm:h-[70vh]",
              isClosing ? "meza-spotlight-panel-out" : "meza-spotlight-panel-in",
            )}
          >
            <ChatPanel
              className="h-full"
              showHeader
              onClose={handleClose}
              headerExtra={
                <button
                  onClick={() => setIsMini(true)}
                  className="h-7 w-7 p-0 inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                  title="Minimize to corner"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                </button>
              }
            />

            {/* Keyboard hints */}
            <div className="meza-spotlight-footer">
              <div className="flex items-center gap-3 text-[11px] text-white/30">
                <span className="flex items-center gap-1">
                  <kbd className="meza-spotlight-kbd">Esc</kbd>
                  close
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="meza-spotlight-kbd"><Command className="h-2.5 w-2.5" /></kbd>
                  <kbd className="meza-spotlight-kbd">K</kbd>
                  toggle
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="meza-spotlight-kbd">↵</kbd>
                  send
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatWidget;
