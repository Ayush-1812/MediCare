import React from 'react';
import { Calendar, Activity, Pill, FileText } from 'lucide-react';

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
}

const prompts = [
  {
    icon: <Calendar className="w-4 h-4 text-blue-500" />,
    text: "Show my appointments"
  },
  {
    icon: <Activity className="w-4 h-4 text-teal-500" />,
    text: "Summarize my health"
  },
  {
    icon: <Pill className="w-4 h-4 text-indigo-500" />,
    text: "Show my prescriptions"
  },
  {
    icon: <FileText className="w-4 h-4 text-purple-500" />,
    text: "Explain my reports"
  }
];

const SuggestedPrompts: React.FC<SuggestedPromptsProps> = ({ onSelect }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl mt-8">
      {prompts.map((prompt, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(prompt.text)}
          className="bg-white/60 backdrop-blur-md border border-white/80 hover:bg-white hover:border-blue-200 shadow-[0_8px_30px_-10px_rgba(0,0,0,0.06)] hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.12)] p-4 rounded-[20px] text-left transition-all duration-300 group flex items-center gap-4 transform hover:-translate-y-1"
        >
          <div className="bg-white p-2.5 rounded-xl shadow-sm border border-gray-100 group-hover:scale-110 transition-transform duration-300">
            {prompt.icon}
          </div>
          <span className="text-[14px] font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{prompt.text}</span>
        </button>
      ))}
    </div>
  );
};

export default SuggestedPrompts;

