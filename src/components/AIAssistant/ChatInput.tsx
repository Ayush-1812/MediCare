import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Paperclip } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled }) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = '44px';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const insertPrompt = (prompt: string) => {
    setInput(prompt);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className="w-full bg-gradient-to-t from-blue-50/90 via-blue-50/80 to-transparent pt-6 pb-6 px-4 lg:px-10 flex-shrink-0 z-30">
      <div className="max-w-4xl mx-auto w-full flex flex-col">
        {/* Quick Action Chips */}
        <div className="flex flex-wrap gap-2.5 mb-4 px-1">
          <button onClick={() => insertPrompt('What are my symptoms?')} className="bg-white/70 hover:bg-white backdrop-blur-xl border border-white/80 shadow-[0_4px_15px_-5px_rgba(0,0,0,0.05)] rounded-full px-4 py-2 text-[13px] font-bold text-gray-700 flex items-center gap-2 transition-all duration-300 hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 group">
            <span className="text-base group-hover:scale-110 transition-transform">⚕️</span> Symptoms
          </button>
          <button onClick={() => insertPrompt('Show my medicines')} className="bg-white/70 hover:bg-white backdrop-blur-xl border border-white/80 shadow-[0_4px_15px_-5px_rgba(0,0,0,0.05)] rounded-full px-4 py-2 text-[13px] font-bold text-gray-700 flex items-center gap-2 transition-all duration-300 hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 group">
            <span className="text-base group-hover:scale-110 transition-transform">💊</span> Medicines
          </button>
          <button onClick={() => insertPrompt('View my timeline')} className="bg-white/70 hover:bg-white backdrop-blur-xl border border-white/80 shadow-[0_4px_15px_-5px_rgba(0,0,0,0.05)] rounded-full px-4 py-2 text-[13px] font-bold text-gray-700 flex items-center gap-2 transition-all duration-300 hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 group">
            <span className="text-base group-hover:scale-110 transition-transform">📅</span> Timeline
          </button>
        </div>

        {/* Input Bar */}
        <form 
          onSubmit={handleSubmit}
          className="bg-white/90 backdrop-blur-2xl border border-white/80 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] rounded-3xl px-4 py-3 sm:px-6 sm:py-3.5 flex items-end gap-3 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100/50 transition-all duration-300 hover:shadow-[0_15px_50px_-12px_rgba(0,0,0,0.15)] w-full"
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Ask anything about your health..."
            className="flex-1 max-h-32 min-h-[24px] py-2 sm:py-3 bg-transparent outline-none resize-none text-[15px] text-gray-800 placeholder:text-gray-400 font-medium disabled:opacity-50 w-full"
            rows={1}
            style={{ height: '44px' }}
          />
          <div className="flex items-center gap-2 sm:gap-3 pb-1">
            <button type="button" className="hidden sm:flex text-gray-400 hover:text-blue-500 hover:bg-blue-50 p-2.5 rounded-full transition-all">
              <Mic className="w-[18px] h-[18px]" />
            </button>
            <button type="button" className="hidden sm:flex text-gray-400 hover:text-blue-500 hover:bg-blue-50 p-2.5 rounded-full transition-all">
              <Paperclip className="w-[18px] h-[18px]" />
            </button>
            <button
              type="submit"
              disabled={!input.trim() || disabled}
              className={`p-3 rounded-full flex-shrink-0 transition-all duration-300 ${
                input.trim() && !disabled
                  ? 'bg-gradient-to-r from-blue-600 to-teal-500 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed scale-100'
              }`}
            >
              <Send className="w-[18px] h-[18px] sm:ml-0.5" />
            </button>
          </div>
        </form>
        <p className="text-center text-[11px] font-medium text-gray-400 mt-4 opacity-70">
          Aether AI can make mistakes. Please verify important medical information with your doctor.
        </p>
      </div>
    </div>
  );
};

export default ChatInput;

