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
      className={`rounded-xl border border-[#D5E3EC] bg-[#F8FAFC] p-5 text-[15px] leading-relaxed text-[#1E293B] ${className}`}
    >
      <div className="mb-2 flex items-center gap-2 font-semibold text-[#0369A1]">
        <BookOpen className="h-4 w-4 shrink-0 text-[#0369A1]" />
        <span>Giải thích chi tiết</span>
      </div>

      <p className="leading-relaxed text-[#1E293B]">
        {parts.map((part, idx) => {
          if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
            return (
              <mark
                key={idx}
                className="mx-0.5 rounded-md border border-[#A7F3D0] bg-[#D1FAE5] px-1.5 py-0.5 font-semibold text-[#065F46]"
              >
                {part.slice(2, -2)}
              </mark>
            );
          }
          return <React.Fragment key={idx}>{part}</React.Fragment>;
        })}
      </p>

      {question.note && question.note.trim() !== '' && (
        <div className="mt-3.5 flex items-start gap-2 rounded-lg border border-[#D5E3EC] bg-white px-3.5 py-2.5 text-xs text-[#64748B]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0369A1]" />
          <span>{question.note}</span>
        </div>
      )}
    </div>
  );
};
