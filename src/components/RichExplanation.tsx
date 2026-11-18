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
      className={`rounded-xl border border-[#C5D1BE] bg-[#F5F7F2] p-3.5 text-[14px] leading-relaxed text-[#243329] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#DDE5DF] sm:p-5 sm:text-[15px] ${className}`}
    >
      <div className="mb-2 flex items-center gap-2 font-semibold text-[#2E6F4E] dark:text-[#74C69D]">
        <BookOpen className="h-4 w-4 shrink-0 text-[#2E6F4E] dark:text-[#74C69D]" />
        <span>Giải thích chi tiết</span>
      </div>

      <p className="leading-relaxed text-[#243329] dark:text-[#DDE5DF]">
        {parts.map((part, idx) => {
          if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
            return (
              <mark
                key={idx}
                className="mx-0.5 rounded-md border border-[#68B99A] bg-[#E1F3EC] px-1.5 py-0.5 font-semibold text-[#0F5C41] dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15 dark:text-[#6EE7B7]"
              >
                {part.slice(2, -2)}
              </mark>
            );
          }
          return <React.Fragment key={idx}>{part}</React.Fragment>;
        })}
      </p>

      {question.note && question.note.trim() !== '' && (
        <div className="mt-3.5 flex items-start gap-2 rounded-lg border border-[#D2DACB] bg-[#FFFFFF] px-3.5 py-2.5 text-xs text-[#5C6E60] dark:border-[#31453A] dark:bg-[#1B2620] dark:text-[#8B9E91]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2E6F4E] dark:text-[#74C69D]" />
          <span>{question.note}</span>
        </div>
      )}
    </div>
  );
};
