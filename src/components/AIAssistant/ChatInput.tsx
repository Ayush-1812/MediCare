import React, { useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

const MAX_LENGTH = 2000;

const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled }) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
      <div className="max-w-3xl mx-auto w-full">
        <form
          onSubmit={handleSubmit}
          className="border border-slate-300 rounded-2xl px-3 py-2 flex items-end gap-2 bg-white focus-within:border-slate-400 transition-colors"
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value.slice(0, MAX_LENGTH));
              resize();
            }}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Ask about your appointments, prescriptions or symptoms..."
            rows={1}
            className="flex-1 max-h-40 py-2 px-1 bg-transparent outline-none resize-none text-[15px] text-slate-800 placeholder:text-slate-400 disabled:opacity-50"
          />
          {/* The old bar also had Mic and Paperclip buttons that were wired to nothing. */}
          <button
            type="submit"
            disabled={!input.trim() || disabled}
            aria-label="Send message"
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mb-0.5 transition-colors ${
              input.trim() && !disabled
                ? 'bg-slate-900 text-white hover:bg-slate-700'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <ArrowUp className="w-4.5 h-4.5" />
          </button>
        </form>

        <p className="text-center text-[11px] text-slate-400 mt-2.5">
          Aether AI can make mistakes. Verify important medical information with your doctor.
        </p>
      </div>
    </div>
  );
};

export default ChatInput;
