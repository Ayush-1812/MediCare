'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ArrowDown, Menu } from 'lucide-react';
import MessageBubble, { MessageProps } from './MessageBubble';
import ChatInput from './ChatInput';
import EmptyState from './EmptyState';

interface ChatAreaProps {
  activeId: string | null;
  onConversationCreated: (id: string) => void;
  onOpenSidebar?: () => void;
}

const ChatArea: React.FC<ChatAreaProps> = ({ activeId, onConversationCreated, onOpenSidebar }) => {
  const [messages, setMessages] = useState<MessageProps[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);

  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Set right before we tell the parent about a conversation id we just created ourselves —
  // lets the [activeId] effect below skip its history refetch, since local state already has
  // the live (streaming) message and a refetch would just flash a spinner over it.
  const skipNextHistoryFetchRef = useRef(false);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    // Scroll only the message list itself, not `scrollIntoView` — that walks every
    // scrollable ancestor and would drag the whole page instead of staying in the panel.
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior,
      });
    }
  };

  useEffect(() => {
    if (isAutoScrollEnabled) {
      scrollToBottom(isLoading ? 'auto' : 'smooth');
    }
  }, [messages, isAutoScrollEnabled, isLoading]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setIsAutoScrollEnabled(true);
      setShowScrollButton(false);
      return;
    }

    if (skipNextHistoryFetchRef.current) {
      skipNextHistoryFetchRef.current = false;
      return;
    }

    const fetchHistory = async () => {
      setIsFetchingHistory(true);
      try {
        const res = await fetch(`/api/chat/conversations/${activeId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.conversation) {
            setMessages(
              data.conversation.messages.map((m: any) => ({
                id: m.id,
                role: m.role,
                content: m.content,
              })),
            );
            setIsAutoScrollEnabled(true);
            setShowScrollButton(false);
            setTimeout(() => scrollToBottom('auto'), 100);
          }
        }
      } catch (error) {
        console.error('Failed to load conversation history:', error);
      } finally {
        setIsFetchingHistory(false);
      }
    };

    fetchHistory();
  }, [activeId]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setIsAutoScrollEnabled(isNearBottom);
    setShowScrollButton(!isNearBottom);
  };

  const handleSend = async (userMessage: string) => {
    if (isLoading || isFetchingHistory) return;

    setIsAutoScrollEnabled(true);
    setShowScrollButton(false);
    setIsLoading(true);

    const assistantMsgId = `assistant-${Date.now()}`;
    setMessages(prev => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'USER', content: userMessage },
      { id: assistantMsgId, role: 'ASSISTANT', content: '' },
    ]);

    setTimeout(() => scrollToBottom('smooth'), 0);

    /** Puts an error into the pending assistant bubble instead of leaving it blank. */
    const failWith = (text: string) =>
      setMessages(prev =>
        prev.map(msg => (msg.id === assistantMsgId ? { ...msg, content: text } : msg)),
      );

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, conversationId: activeId }),
      });

      if (res.status === 401) {
        failWith('Your session has expired. Please sign in again to keep chatting.');
        return;
      }
      if (!res.ok) {
        failWith('Something went wrong reaching the assistant. Please try again.');
        return;
      }

      const newConvId = res.headers.get('X-Conversation-Id');
      if (newConvId && !activeId) {
        skipNextHistoryFetchRef.current = true;
        onConversationCreated(newConvId);
      }

      const reader = res.body?.getReader();
      if (!reader) {
        failWith('Something went wrong reaching the assistant. Please try again.');
        return;
      }

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // `stream: true` matters: without it a multi-byte character split across two
        // chunks decodes as replacement characters, which mangles the emoji and accents
        // the assistant's formatted replies are full of.
        const chunk = decoder.decode(value, { stream: true });
        setMessages(prev =>
          prev.map(msg => (msg.id === assistantMsgId ? { ...msg, content: msg.content + chunk } : msg)),
        );
      }

      const tail = decoder.decode();
      if (tail) {
        setMessages(prev =>
          prev.map(msg => (msg.id === assistantMsgId ? { ...msg, content: msg.content + tail } : msg)),
        );
      }
    } catch (error) {
      console.error('Chat error:', error);
      failWith('Could not connect to the server. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full min-w-0 relative">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-slate-200">
        <button
          onClick={onOpenSidebar}
          className="lg:hidden p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors shrink-0"
          aria-label="Open conversations"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900 truncate">Aether AI</h2>
          <p className="text-xs text-slate-500">Your personal healthcare assistant</p>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-6 py-6"
      >
        {isFetchingHistory ? (
          <div className="flex justify-center items-center h-full">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></span>
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></span>
            </span>
          </div>
        ) : messages.length === 0 ? (
          <EmptyState onSelectPrompt={handleSend} />
        ) : (
          <div className="max-w-3xl mx-auto w-full">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>
        )}
      </div>

      {showScrollButton && (
        <div className="absolute bottom-28 left-0 right-0 flex justify-center pointer-events-none">
          <button
            onClick={() => {
              setIsAutoScrollEnabled(true);
              setShowScrollButton(false);
              scrollToBottom('smooth');
            }}
            className="pointer-events-auto flex items-center gap-1.5 bg-white border border-slate-200 shadow-sm text-slate-600 text-xs font-medium py-1.5 px-3 rounded-full hover:bg-slate-50 transition-colors"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            Latest
          </button>
        </div>
      )}

      <ChatInput onSend={handleSend} disabled={isLoading || isFetchingHistory} />
    </div>
  );
};

export default ChatArea;
