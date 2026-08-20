import React from 'react';
import { Sparkles } from 'lucide-react';
import SuggestedPrompts from './SuggestedPrompts';

interface EmptyStateProps {
  onSelectPrompt: (prompt: string) => void;
  userName?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ onSelectPrompt }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center mb-5">
        <Sparkles className="w-6 h-6 text-white" />
      </div>

      <h2 className="text-2xl font-semibold text-slate-900 mb-2">How can I help?</h2>

      <p className="text-slate-500 max-w-md text-sm leading-relaxed mb-8">
        I can look up your appointments and prescriptions, summarise your records, and answer
        general health questions.
      </p>

      <SuggestedPrompts onSelect={onSelectPrompt} />
    </div>
  );
};

export default EmptyState;
