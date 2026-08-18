import React from 'react';
import { Sparkles, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export interface MessageProps {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  isMock?: boolean;
}

// Aether AI's prompts instruct Gemini to reply with structured markdown (### section
// headers, bullet lists, **bold**) — these overrides render that with the app's own
// typography instead of react-markdown's default browser styles.
const markdownComponents = {
  h1: ({ children }: any) => <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mt-5 mb-2 first:mt-0">{children}</h3>,
  h2: ({ children }: any) => <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mt-5 mb-2 first:mt-0">{children}</h3>,
  h3: ({ children }: any) => <h4 className="text-sm font-black text-gray-900 uppercase tracking-wider mt-5 mb-2 first:mt-0">{children}</h4>,
  p: ({ children }: any) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }: any) => <strong className="font-bold text-gray-900">{children}</strong>,
  ul: ({ children }: any) => <ul className="list-none flex flex-col gap-1.5 my-3 last:mb-0">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal list-inside flex flex-col gap-1.5 my-3 last:mb-0">{children}</ol>,
  li: ({ children, ordered }: any) =>
    ordered ? (
      <li className="leading-relaxed">{children}</li>
    ) : (
      <li className="flex items-start gap-2 leading-relaxed">
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40 mt-2 shrink-0" />
        <span>{children}</span>
      </li>
    ),
  a: ({ children, href }: any) => <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2 font-semibold">{children}</a>,
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
            {message.content ? (
              <div className="font-medium [&>*:first-child]:mt-0">
                <ReactMarkdown components={markdownComponents}>{message.content}</ReactMarkdown>
              </div>
            ) : (
              <span className="flex items-center gap-1.5 h-5">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></span>
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></span>
              </span>
            )}
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
