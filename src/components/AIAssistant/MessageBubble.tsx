import React from 'react';
import { Sparkles, User } from 'lucide-react';

export interface MessageProps {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  isMock?: boolean;
}

// Basic markdown bold parser
const formatMarkdown = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
};

const MessageBubble: React.FC<{ message: MessageProps }> = ({ message }) => {
  const isUser = message.role === 'USER';

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} group mb-6 animate-fade-in-up`}>
      <div className={`flex gap-4 max-w-[90%] md:max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end`}>
        
        {/* Avatar */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-md transform transition-transform group-hover:scale-105 ${
          isUser 
            ? 'bg-gradient-to-tr from-blue-100 to-blue-50 text-blue-600 ring-2 ring-white' 
            : 'bg-gradient-to-tr from-blue-600 to-teal-400 text-white shadow-blue-500/30'
        }`}>
          {isUser ? <User className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
        </div>

        {/* Message Content */}
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          <div className={`px-6 py-4 text-[15px] leading-relaxed shadow-sm transition-all duration-300 ${
            isUser 
              ? 'bg-gradient-to-r from-blue-600 to-teal-500 text-white rounded-[24px] rounded-br-[4px] shadow-[0_10px_25px_-5px_rgba(59,130,246,0.3)]' 
              : 'bg-white/90 backdrop-blur-xl border border-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.08)] text-gray-800 rounded-[24px] rounded-bl-[4px] hover:shadow-[0_15px_50px_-12px_rgba(0,0,0,0.12)]'
          }`}>
            <p className="whitespace-pre-wrap font-medium">
              {message.content ? formatMarkdown(message.content) : (
                <span className="flex items-center gap-1.5 h-5">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></span>
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></span>
                </span>
              )}
            </p>
          </div>
          <span className="text-[11px] text-gray-400 font-bold mt-2 px-1 tracking-wide uppercase opacity-0 group-hover:opacity-100 transition-opacity">
            {isUser ? 'You' : 'Aether AI'}
          </span>
        </div>
        
      </div>
    </div>
  );
};

export default MessageBubble;

