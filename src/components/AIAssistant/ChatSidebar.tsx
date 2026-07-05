import React, { useEffect, useState } from 'react';
import { Plus, Search, MessageSquare, FileText } from 'lucide-react';

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
          if (data.success) {
            setConversations(data.conversations);
          }
        }
      } catch (error) {
        console.error('Failed to fetch conversations:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchConversations();
  }, [refreshKey]);

  const filteredConversations = conversations.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col p-6">
      {/* New Chat Button */}
      <button 
        onClick={onNewChat}
        className="w-full bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-between transition-all shadow-[0_8px_20px_-6px_rgba(59,130,246,0.5)] hover:shadow-[0_10px_25px_-5px_rgba(59,130,246,0.6)] hover:-translate-y-0.5 active:translate-y-0"
      >
        <span>New Chat</span>
        <Plus className="w-5 h-5" />
      </button>

      {/* Search Bar */}
      <div className="mt-6 relative group">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Search className="w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
        </div>
        <input 
          type="text" 
          placeholder="Search chats..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white/40 border border-white/60 focus:border-blue-300 focus:ring-4 focus:ring-blue-100/50 rounded-xl text-sm outline-none transition-all placeholder-gray-500 font-medium text-gray-700 shadow-sm"
        />
      </div>

      {/* Recent Consultations List */}
      <div className="mt-8 flex-1 overflow-y-auto custom-scrollbar pr-1 -mr-1">
        <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider mb-3 px-1">Recent Consultations</h3>
        
        <div className="space-y-2">
          {isLoading ? (
            <div className="text-sm text-gray-500 px-2 py-4">Loading...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-sm text-gray-500 px-2 py-4">No conversations found.</div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = activeId === conv.id;
              
              // Formatting a simple date string if it exists
              let dateStr = 'Just now';
              if (conv.lastMessageAt || conv.createdAt) {
                const date = new Date(conv.lastMessageAt || conv.createdAt);
                const isToday = new Date().toDateString() === date.toDateString();
                dateStr = isToday ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString();
              }

              return (
                <button 
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 flex items-start gap-3 relative overflow-hidden group ${
                    isActive 
                      ? 'bg-white border-white shadow-[0_5px_15px_-3px_rgba(0,0,0,0.08)]' 
                      : 'bg-transparent border-transparent hover:bg-white/50 hover:border-white/50 hover:shadow-sm'
                  }`}
                >
                  {/* Active Indicator Line */}
                  {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-teal-400 rounded-l-xl"></div>
                  )}
                  
                  <div className={`p-2 rounded-lg ${isActive ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500 group-hover:bg-white'}`}>
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className={`text-sm font-bold truncate ${isActive ? 'text-gray-900' : 'text-gray-700'}`}>{conv.title}</p>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">{dateStr}</p>
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
