import React from 'react';
import { Menu, Bot, Info } from 'lucide-react';

interface ChatHeaderProps {
  onMenuClick: () => void;
  title?: string;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ onMenuClick, title = "AI Assistant" }) => {
  return (
    <div className="bg-white/80 backdrop-blur-xl border-b border-gray-100 px-4 py-4 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 text-lg leading-tight">{title}</h1>
            <p className="text-xs text-blue-600 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Online & Ready
            </p>
          </div>
        </div>
      </div>
      
      <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all">
        <Info className="w-5 h-5" />
      </button>
    </div>
  );
};

export default ChatHeader;
