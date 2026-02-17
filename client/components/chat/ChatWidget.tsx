import { MessageSquare } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import ChatPanel from "./ChatPanel";

const ChatWidget = () => {
  const { user } = useAuth();
  const { isOpen, setOpen } = useChatStore();

  // Only show for authenticated users
  if (!user) return null;

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center"
          aria-label="Open Meza assistant"
        >
          <MessageSquare className="h-5 w-5" />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 flex flex-col rounded-xl border border-border bg-card shadow-2xl",
            "w-[400px] h-[520px]",
            "max-sm:w-[calc(100vw-2rem)] max-sm:right-4 max-sm:left-4 max-sm:bottom-6"
          )}
        >
          <ChatPanel
            className="h-full"
            showHeader
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </>
  );
};

export default ChatWidget;
