import React from 'react';
import { Bot } from 'lucide-react';

const TypingIndicator: React.FC = () => {
  return (
    <div className="flex w-full justify-start mb-6">
      <div className="flex gap-4">
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm mt-1 bg-blue-600 text-white">
          <Bot className="w-5 h-5" />
        </div>
        
        <div className="flex flex-col items-start">
          <div className="px-5 py-4 bg-white border border-gray-100 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1.5 h-[48px]">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <span className="text-[10px] text-gray-400 font-medium mt-1 px-1">
            MediCare Assistant is typing...
          </span>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
