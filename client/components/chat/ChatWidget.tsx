import { useEffect, useCallback, useState } from "react";
import { Bot, Command } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useChatStore } from "@/stores/chatStore";
import { cn } from "@/lib/utils";
import ChatPanel from "./ChatPanel";

const ChatWidget = () => {
  const { user } = useAuth();
  const { isOpen, setOpen } = useChatStore();
  const [isClosing, setIsClosing] = useState(false);

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
        } else {
          setOpen(true);
        }
      }
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        handleClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [user, isOpen, setOpen, handleClose]);

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

      {/* Spotlight overlay */}
      {isOpen && (
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
