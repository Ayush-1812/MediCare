import React from 'react';
import { Calendar, Activity, Pill, FileText } from 'lucide-react';

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
}

const prompts = [
  { icon: Calendar, text: 'Show my appointments' },
  { icon: Activity, text: 'Summarize my health' },
  { icon: Pill, text: 'Show my prescriptions' },
  { icon: FileText, text: 'Explain my reports' },
];

const SuggestedPrompts: React.FC<SuggestedPromptsProps> = ({ onSelect }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
      {prompts.map(({ icon: Icon, text }) => (
        <button
          key={text}
          onClick={() => onSelect(text)}
          className="border border-slate-200 hover:border-slate-300 hover:bg-slate-50 px-4 py-3 rounded-xl text-left transition-colors flex items-center gap-3"
        >
          <Icon className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-sm text-slate-700">{text}</span>
        </button>
      ))}
    </div>
  );
};

export default SuggestedPrompts;
