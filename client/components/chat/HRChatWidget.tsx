import React, { useState, useRef, useEffect } from 'react';
import { useHRChatContext } from '../../contexts/HRChatContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import {
  MessageCircle,
  X,
  Minus,
  Send,
  Bot,
  User,
  Loader2,
  Trash2,
  Settings,
  Calculator,
  FileText,
  Users,
  DollarSign,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import ReactMarkdown from 'react-markdown';

// Quick action buttons for common tasks
const QUICK_ACTIONS = [
  { icon: Calculator, label: 'Tax Calc', prompt: 'How do I calculate income tax?' },
  { icon: DollarSign, label: 'Net Pay', prompt: 'Calculate net pay for a $1,000 salary' },
  { icon: FileText, label: 'Run Payroll', prompt: 'Take me to run payroll' },
  { icon: Users, label: 'Employees', prompt: 'Go to employee list' },
];

const HRChatWidget: React.FC = () => {
  const {
    isOpen,
    isMinimized,
    messages,
    isLoading,
    pendingAction,
    apiKey,
    toggleChat,
    closeChat,
    minimizeChat,
    sendMessage,
    confirmAction,
    cancelAction,
    clearMessages,
    setApiKey,
  } = useHRChatContext();

  const [inputValue, setInputValue] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const message = inputValue;
    setInputValue('');
    await sendMessage(message);
  };

  const handleQuickAction = async (prompt: string) => {
    if (isLoading) return;
    await sendMessage(prompt);
  };

  const handleSaveApiKey = () => {
    if (tempApiKey.trim()) {
      setApiKey(tempApiKey.trim());
      setShowApiKeyInput(false);
      setTempApiKey('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Floating button when chat is closed
  if (!isOpen) {
    return (
      <Button
        onClick={toggleChat}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 z-50"
        size="icon"
        title="HR Assistant"
      >
        <MessageCircle className="h-6 w-6 text-white" />
      </Button>
    );
  }

  // Minimized state - just header bar
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50">
        <div
          className="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg cursor-pointer"
          onClick={minimizeChat}
        >
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-white" />
            <span className="font-medium text-white">HR Assistant</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-white/80 hover:text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                minimizeChat();
              }}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-white/80 hover:text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                closeChat();
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Full chat window
  return (
    <div className="fixed bottom-6 right-6 w-96 h-[550px] bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-t-lg">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-white" />
          <span className="font-medium text-white">HR Assistant</span>
          <Badge variant="outline" className="text-xs bg-white/20 text-white border-white/30">
            TL
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-white/80 hover:text-white hover:bg-white/20"
            onClick={() => setShowApiKeyInput(!showApiKeyInput)}
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-white/80 hover:text-white hover:bg-white/20"
            onClick={clearMessages}
            title="Clear chat"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-white/80 hover:text-white hover:bg-white/20"
            onClick={minimizeChat}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-white/80 hover:text-white hover:bg-white/20"
            onClick={closeChat}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* API Key Input */}
      {showApiKeyInput && (
        <div className="p-3 bg-gray-800 border-b border-gray-700">
          <p className="text-xs text-gray-400 mb-2">Enter your OpenAI API key:</p>
          <div className="flex gap-2">
            <Input
              type="password"
              value={tempApiKey}
              onChange={(e) => setTempApiKey(e.target.value)}
              placeholder="sk-..."
              className="flex-1 bg-gray-700 border-gray-600 text-gray-100 text-sm"
            />
            <Button size="sm" onClick={handleSaveApiKey} className="bg-emerald-600 hover:bg-emerald-700">
              Save
            </Button>
          </div>
          {apiKey && (
            <p className="text-xs text-emerald-400 mt-1">API key configured</p>
          )}
        </div>
      )}

      {/* Quick Actions */}
      {messages.length <= 1 && (
        <div className="p-2 bg-gray-800/50 border-b border-gray-700">
          <div className="flex gap-1 flex-wrap">
            {QUICK_ACTIONS.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                size="sm"
                className="text-xs bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                onClick={() => handleQuickAction(action.prompt)}
                disabled={isLoading}
              >
                <action.icon className="h-3 w-3 mr-1" />
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-2',
                message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  message.role === 'user'
                    ? 'bg-blue-600'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600'
                )}
              >
                {message.role === 'user' ? (
                  <User className="h-4 w-4 text-white" />
                ) : (
                  <Bot className="h-4 w-4 text-white" />
                )}
              </div>
              <div
                className={cn(
                  'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-100'
                )}
              >
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                      li: ({ children }) => <li className="mb-0">{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold text-emerald-300">{children}</strong>,
                      code: ({ children }) => <code className="bg-gray-700 px-1 rounded text-emerald-300">{children}</code>,
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-emerald-600 to-teal-600">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="bg-gray-800 rounded-lg px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              </div>
            </div>
          )}

          {/* Pending action confirmation buttons */}
          {pendingAction && !isLoading && (
            <div className="flex gap-2 justify-center py-2">
              <Button
                size="sm"
                onClick={confirmAction}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Confirm
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={cancelAction}
                className="border-red-500 text-red-400 hover:bg-red-500/20"
              >
                Cancel
              </Button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-700">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about TL tax, labor law, payroll..."
            className="flex-1 bg-gray-800 border-gray-600 text-gray-100 placeholder:text-gray-500"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!inputValue.trim() || isLoading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Powered by AI | Timor-Leste HR/Payroll Expert
        </p>
      </form>
    </div>
  );
};

export default HRChatWidget;
