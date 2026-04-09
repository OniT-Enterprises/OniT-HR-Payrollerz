import { useEffect, useCallback, useRef, useState, lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { Command, Minimize2, Maximize2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useChatStore } from "@/stores/chatStore";
import { cn } from "@/lib/utils";

const ChatPanel = lazy(() => import("./ChatPanel"));

/* ─── Sub-components ─── */

function ChatPanelFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function MiniPanel({
  onClose, onExpand,
}: {
  onClose: () => void; onExpand: () => void;
}) {
  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-[100] w-[380px] max-sm:w-[calc(100vw-2rem)] max-sm:right-4 max-sm:bottom-4 flex flex-col overflow-hidden print:hidden",
        "h-[480px] max-sm:h-[60vh]",
        "rounded-xl shadow-2xl border border-border bg-card",
        "dark:bg-[rgba(20,27,38,0.95)] dark:backdrop-blur-xl dark:border-white/10",
        "animate-in slide-in-from-bottom-4 fade-in duration-200",
      )}
    >
      <Suspense fallback={<ChatPanelFallback />}>
        <ChatPanel
          className="h-full" showHeader onClose={onClose}
          headerExtra={
            <button
              onClick={onExpand}
              className="h-7 w-7 p-0 inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
              title="Expand to spotlight"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          }
        />
      </Suspense>
    </div>
  );
}

function SpotlightPanel({
  isClosing, onClose, onMinimize, onBackdropClick,
}: {
  isClosing: boolean; onClose: () => void;
  onMinimize: () => void; onBackdropClick: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-start justify-center print:hidden",
        isClosing ? "meza-spotlight-backdrop-out" : "meza-spotlight-backdrop-in",
      )}
      onClick={onBackdropClick}
    >
      <div
        className={cn(
          "meza-spotlight-panel mt-[12vh] w-full max-w-[680px] mx-4 flex flex-col overflow-hidden",
          "h-[520px] max-sm:mt-[6vh] max-sm:mx-3 max-sm:max-w-none max-sm:h-[70vh]",
          isClosing ? "meza-spotlight-panel-out" : "meza-spotlight-panel-in",
        )}
      >
        <Suspense fallback={<ChatPanelFallback />}>
          <ChatPanel
            className="h-full" showHeader onClose={onClose}
            headerExtra={
              <button
                onClick={onMinimize}
                className="h-7 w-7 p-0 inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                title="Minimize to corner"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </button>
            }
          />
        </Suspense>
        <div className="meza-spotlight-footer">
          <div className="flex items-center gap-3 text-[11px] text-white/30">
            <span className="flex items-center gap-1"><kbd className="meza-spotlight-kbd">Esc</kbd>close</span>
            <span className="flex items-center gap-1">
              <kbd className="meza-spotlight-kbd"><Command className="h-2.5 w-2.5" /></kbd>
              <kbd className="meza-spotlight-kbd">K</kbd>toggle
            </span>
            <span className="flex items-center gap-1"><kbd className="meza-spotlight-kbd">↵</kbd>send</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ─── */

const ChatWidget = () => {
  const { user } = useAuth();
  const { isOpen, setOpen, setCurrentRoute } = useChatStore();
  const location = useLocation();

  useEffect(() => { setCurrentRoute(location.pathname); }, [location.pathname, setCurrentRoute]);

  const [isClosing, setIsClosing] = useState(false);
  const [isMini, setIsMini] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearCloseTimer, [clearCloseTimer]);

  const handleClose = useCallback(() => {
    clearCloseTimer();
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      setIsClosing(false);
      closeTimerRef.current = null;
    }, 150);
  }, [clearCloseTimer, setOpen]);

  useEffect(() => {
    if (!user) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) { handleClose(); setIsMini(false); } else { setOpen(true); }
      }
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        handleClose();
        if (isMini) setIsMini(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [user, isOpen, isMini, setOpen, handleClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => { if (e.target === e.currentTarget) handleClose(); },
    [handleClose],
  );

  if (!user) return null;

  return (
    <>
      {isOpen && isMini && (
        <MiniPanel
          onClose={() => { handleClose(); setIsMini(false); }}
          onExpand={() => setIsMini(false)}
        />
      )}
      {isOpen && !isMini && (
        <SpotlightPanel
          isClosing={isClosing} onClose={handleClose}
          onMinimize={() => setIsMini(true)} onBackdropClick={handleBackdropClick}
        />
      )}
    </>
  );
};

export default ChatWidget;
