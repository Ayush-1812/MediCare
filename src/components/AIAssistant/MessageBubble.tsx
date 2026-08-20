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
  h1: ({ children }: any) => <h3 className="text-[13px] font-semibold text-slate-900 uppercase tracking-wide mt-5 mb-2 first:mt-0">{children}</h3>,
  h2: ({ children }: any) => <h3 className="text-[13px] font-semibold text-slate-900 uppercase tracking-wide mt-5 mb-2 first:mt-0">{children}</h3>,
  h3: ({ children }: any) => <h4 className="text-[13px] font-semibold text-slate-900 uppercase tracking-wide mt-5 mb-2 first:mt-0">{children}</h4>,
  p: ({ children }: any) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }: any) => <strong className="font-semibold text-slate-900">{children}</strong>,
  ul: ({ children }: any) => <ul className="list-none flex flex-col gap-1.5 my-3 last:mb-0">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal list-inside flex flex-col gap-1.5 my-3 last:mb-0">{children}</ol>,
  li: ({ children, ordered }: any) =>
    ordered ? (
      <li className="leading-relaxed">{children}</li>
    ) : (
      <li className="flex items-start gap-2 leading-relaxed">
        <span className="w-1 h-1 rounded-full bg-current opacity-40 mt-2.5 shrink-0" />
        <span>{children}</span>
      </li>
    ),
  a: ({ children, href }: any) => <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2 font-medium">{children}</a>,
};

const MessageBubble: React.FC<{ message: MessageProps }> = ({ message }) => {
  const isUser = message.role === 'USER';

  return (
    <div className={`flex w-full gap-3 mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="w-4 h-4" />
        </div>
      )}

      <div
        className={`px-4 py-3 text-[15px] leading-relaxed max-w-[85%] md:max-w-[70%] ${
          isUser
            ? 'bg-primary text-white rounded-2xl rounded-br-md'
            : 'bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl rounded-bl-md'
        }`}
      >
        {message.content ? (
          <div className="[&>*:first-child]:mt-0">
            <ReactMarkdown components={markdownComponents}>{message.content}</ReactMarkdown>
          </div>
        ) : (
          <span className="flex items-center gap-1.5 h-5">
            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></span>
            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></span>
          </span>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 mt-0.5">
          <User className="w-4 h-4" />
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
