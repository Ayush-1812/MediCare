'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ArrowDown } from 'lucide-react';
import MessageBubble, { MessageProps } from './MessageBubble';
import ChatInput from './ChatInput';
import EmptyState from './EmptyState';

interface ChatAreaProps {
  activeId: string | null;
  onConversationCreated: (id: string) => void;
}

const ChatArea: React.FC<ChatAreaProps> = ({ activeId, onConversationCreated }) => {
  const [messages, setMessages] = useState<MessageProps[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  
  // Scrolling State
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  };

  // Keep latest streamed content visible if auto-scroll is enabled
  useEffect(() => {
    if (isAutoScrollEnabled) {
      // Use 'auto' behavior during fast streaming to prevent jitter and animation queues, 
      // but if it's a single message addition, 'smooth' is naturally handled.
      // We default to 'auto' for stream updates so it stays pinned without flickering.
      scrollToBottom(isLoading ? 'auto' : 'smooth');
    }
  }, [messages, isAutoScrollEnabled, isLoading]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]); // New Chat
      setIsAutoScrollEnabled(true);
      setShowScrollButton(false);
      return;
    }

    const fetchHistory = async () => {
      setIsFetchingHistory(true);
      try {
        const res = await fetch(`/api/chat/conversations/${activeId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.conversation) {
            setMessages(data.conversation.messages.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content
            })));
            // Reset scroll state on load
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
    
    // If the user scrolls up by more than 100px from the bottom, they are manually scrolling.
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    setIsAutoScrollEnabled(isNearBottom);
    setShowScrollButton(!isNearBottom);
  };

  const handleScrollToBottom = () => {
    setIsAutoScrollEnabled(true);
    setShowScrollButton(false);
    scrollToBottom('smooth');
  };

  const handleSend = async (userMessage: string) => {
    if (isLoading || isFetchingHistory) return;

    // Force auto-scroll to true when sending a new message
    setIsAutoScrollEnabled(true);
    setShowScrollButton(false);
    setIsLoading(true);

    const newUserMsg: MessageProps = {
      id: Date.now().toString(),
      role: 'USER',
      content: userMessage
    };

    setMessages(prev => [...prev, newUserMsg]);

    const assistantMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: assistantMsgId,
      role: 'ASSISTANT',
      content: ''
    }]);

    // Ensure we scroll immediately when the user message appears
    setTimeout(() => scrollToBottom('smooth'), 0);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, conversationId: activeId }),
      });

      if (!res.ok) {
        throw new Error('Failed to send message');
      }

      const newConvId = res.headers.get('X-Conversation-Id');
      if (newConvId && !activeId) {
        onConversationCreated(newConvId);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMsgId 
              ? { ...msg, content: msg.content + chunk } 
              : msg
          ));
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'ASSISTANT',
        content: 'Error: Could not connect to the server.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col relative h-full w-full overflow-hidden">
      {/* Header (Fixed at top) */}
      <div className="flex-shrink-0 flex items-center justify-between p-6 pb-4 lg:p-8 lg:pb-6 border-b border-white/20 bg-transparent z-20">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Aether AI</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Your Personal Healthcare Intelligence</p>
        </div>
        <div className="hidden sm:flex items-center gap-2.5 bg-white/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/60 shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
          <span className="text-xs font-bold text-green-700 tracking-wide uppercase">System Active</span>
        </div>
      </div>

      {/* Messages Area (Scrollable) */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10 pb-0 relative z-10 w-full"
      >
        {isFetchingHistory ? (
          <div className="flex justify-center items-center h-full text-gray-500">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></span>
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></span>
            </span>
          </div>
        ) : messages.length === 0 ? (
          <EmptyState onSelectPrompt={handleSend} />
        ) : (
          <div className="max-w-4xl mx-auto w-full flex flex-col justify-end min-h-full pb-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        )}
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollButton && (
        <div className="absolute bottom-32 left-0 right-0 flex justify-center z-20 pointer-events-none">
          <button 
            onClick={handleScrollToBottom}
            className="pointer-events-auto flex items-center gap-2 bg-white/90 backdrop-blur-md border border-gray-200 shadow-lg text-gray-700 text-sm font-bold py-2 px-4 rounded-full hover:bg-white hover:text-blue-600 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
          >
            <ArrowDown className="w-4 h-4" />
            Scroll to Latest
          </button>
        </div>
      )}

      {/* Input Area (Fixed at bottom) */}
      <ChatInput onSend={handleSend} disabled={isLoading || isFetchingHistory} />
    </div>
  );
};

export default ChatArea;

