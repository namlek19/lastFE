import React from 'react';
import { BookOpen, Info } from 'lucide-react';
import { QuestionItem } from '../types/quiz';

interface RichExplanationProps {
  question: QuestionItem;
  className?: string;
}

export const RichExplanation: React.FC<RichExplanationProps> = ({ question, className = '' }) => {
  const parts = question.explanation.split(/(\*\*[^*\n]+\*\*)/g);

  return (
    <div
      className={`rounded-xl border border-sky-100 bg-sky-50/70 p-4 text-sm leading-relaxed text-slate-700 ${className}`}
    >
      <div className="mb-1.5 flex items-center gap-2 font-semibold text-sky-800">
        <BookOpen className="h-4 w-4 text-[#0284C7] shrink-0" />
        <span>Giải thích chi tiết</span>
      </div>

      <p className="text-slate-700 leading-relaxed">
        {parts.map((part, idx) => {
          if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
            return (
              <mark
                key={idx}
                className="mx-0.5 rounded border border-cyan-200 bg-[#ECFEFF] px-1.5 py-0.5 font-semibold text-[#0E7490]"
              >
                {part.slice(2, -2)}
              </mark>
            );
          }
          return <React.Fragment key={idx}>{part}</React.Fragment>;
        })}
      </p>

      {question.note && question.note.trim() !== '' && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-sky-200/80 bg-white/80 px-3 py-2 text-xs text-slate-600">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" />
          <span>{question.note}</span>
        </div>
      )}
    </div>
  );
};
