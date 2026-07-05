import React from 'react';
import { Sparkles } from 'lucide-react';
import SuggestedPrompts from './SuggestedPrompts';

interface EmptyStateProps {
  onSelectPrompt: (prompt: string) => void;
  userName?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ onSelectPrompt, userName = "there" }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 text-center h-full">
      <div className="w-24 h-24 bg-gradient-to-tr from-blue-600 to-teal-400 rounded-[2rem] flex items-center justify-center shadow-[0_10px_40px_-10px_rgba(59,130,246,0.5)] mb-8 transform hover:scale-105 transition-transform duration-500">
        <Sparkles className="w-12 h-12 text-white" />
      </div>
      
      <h2 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight mb-4">
        Welcome to Aether AI
      </h2>
      
      <p className="text-slate-500 max-w-lg text-[15px] leading-relaxed mb-8">
        Your personal healthcare intelligence. I can help you understand your medical history, remind you about appointments, summarize prescriptions, and answer general health queries.
      </p>

      <SuggestedPrompts onSelect={onSelectPrompt} />
    </div>
  );
};

export default EmptyState;

