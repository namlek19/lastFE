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
      className={`rounded-xl border border-[#D4E1EE] bg-[#F8FAFC] p-3.5 text-[14px] leading-relaxed text-[#1E293B] dark:border-[#18243C] dark:bg-[#0C1322] dark:text-[#E2E8F0] sm:p-5 sm:text-[15px] ${className}`}
    >
      <div className="mb-2 flex items-center gap-2 font-semibold text-[#0369A1] dark:text-[#38BDF8]">
        <BookOpen className="h-4 w-4 shrink-0 text-[#0369A1] dark:text-[#38BDF8]" />
        <span>Giải thích chi tiết</span>
      </div>

      <p className="leading-relaxed text-[#1E293B] dark:text-[#E2E8F0]">
        {parts.map((part, idx) => {
          if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
            return (
              <mark
                key={idx}
                className="mx-0.5 rounded-md border border-[#5EEAD4] bg-[#E6F7F5] px-1.5 py-0.5 font-semibold text-[#0F766E] dark:border-[#14B8A6]/60 dark:bg-[#0D9488]/15 dark:text-[#2DD4BF]"
              >
                {part.slice(2, -2)}
              </mark>
            );
          }
          return <React.Fragment key={idx}>{part}</React.Fragment>;
        })}
      </p>

      {question.note && question.note.trim() !== '' && (
        <div className="mt-3.5 flex items-start gap-2 rounded-lg border border-[#D4E1EE] bg-white px-3.5 py-2.5 text-xs text-[#5B6E88] dark:border-[#18243C] dark:bg-[#111B2E] dark:text-[#7E91B0]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0369A1] dark:text-[#38BDF8]" />
          <span>{question.note}</span>
        </div>
      )}
    </div>
  );
};
