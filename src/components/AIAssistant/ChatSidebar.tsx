import React, { useEffect, useState } from 'react';
import { Plus, Search, MessageSquare } from 'lucide-react';

interface ChatSidebarProps {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  refreshKey: number;
}

interface Conversation {
  id: string;
  title: string;
  lastMessageAt: string | null;
  createdAt: string;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({ activeId, onSelect, onNewChat, refreshKey }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const res = await fetch('/api/chat/conversations');
        if (res.ok) {
          const data = await res.json();
          if (data.success) setConversations(data.conversations);
        }
      } catch (error) {
        console.error('Failed to fetch conversations:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchConversations();
  }, [refreshKey]);

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="h-full flex flex-col p-3">
      <button
        onClick={onNewChat}
        className="w-full bg-slate-900 hover:bg-slate-700 text-white text-sm font-medium py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
      >
        <Plus className="w-4 h-4" /> New chat
      </button>

      <div className="mt-3 relative">
        <Search className="absolute inset-y-0 left-3 my-auto w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search chats"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 focus:border-slate-400 rounded-xl text-sm outline-none transition-colors placeholder:text-slate-400 text-slate-700"
        />
      </div>

      <div className="mt-5 flex-1 overflow-y-auto custom-scrollbar -mr-1 pr-1">
        <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2 px-2">
          Recent
        </h3>

        <div className="space-y-0.5">
          {isLoading ? (
            <p className="text-sm text-slate-400 px-2 py-3">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-400 px-2 py-3">
              {searchQuery ? 'No matching chats.' : 'No conversations yet.'}
            </p>
          ) : (
            filtered.map((conv) => {
              const isActive = activeId === conv.id;

              let dateStr = '';
              const raw = conv.lastMessageAt || conv.createdAt;
              if (raw) {
                const date = new Date(raw);
                const isToday = new Date().toDateString() === date.toDateString();
                dateStr = isToday
                  ? date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                  : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
              }

              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className={`w-full text-left px-2.5 py-2.5 rounded-lg transition-colors flex items-start gap-2.5 ${
                    isActive ? 'bg-white border border-slate-200' : 'hover:bg-white/70 border border-transparent'
                  }`}
                >
                  <MessageSquare
                    className={`w-4 h-4 shrink-0 mt-0.5 ${isActive ? 'text-primary' : 'text-slate-400'}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm truncate ${isActive ? 'text-slate-900 font-medium' : 'text-slate-600'}`}
                    >
                      {conv.title}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{dateStr}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatSidebar;
