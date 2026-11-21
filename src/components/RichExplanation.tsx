import React, { memo, useMemo } from 'react';
import { BookOpen, Info } from 'lucide-react';
import { QuestionItem } from '../types/quiz';

interface RichExplanationProps {
  question: QuestionItem;
  className?: string;
}

const RichExplanationComponent: React.FC<RichExplanationProps> = ({
  question,
  className = '',
}) => {
  const parts = useMemo(
    () => question.explanation.split(/(\*\*[^*\n]+\*\*)/g),
    [question.explanation]
  );

  return (
    <div
      className={`rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] p-3.5 text-[14px] leading-relaxed text-[#292524] dark:border-[#262925] dark:bg-[#161816] dark:text-[#E7E5E4] sm:p-5 sm:text-[15px] ${className}`}
    >
      <div className="mb-2 flex items-center gap-2 font-semibold text-[#B45309] dark:text-[#FBBF24]">
        <BookOpen className="h-4 w-4 shrink-0 text-[#B45309] dark:text-[#FBBF24]" />
        <span>Giải thích chi tiết</span>
      </div>

      <p className="leading-relaxed text-[#292524] dark:text-[#E7E5E4]">
        {parts.map((part, idx) => {
          if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
            return (
              <mark
                key={idx}
                className="mx-0.5 rounded-md border border-[#F59E0B] bg-[#FEF3C7] px-1.5 py-0.5 font-semibold text-[#92400E] dark:border-[#F59E0B]/60 dark:bg-[#F59E0B]/20 dark:text-[#FDE68A]"
              >
                {part.slice(2, -2)}
              </mark>
            );
          }
          return <React.Fragment key={idx}>{part}</React.Fragment>;
        })}
      </p>

      {question.note && question.note.trim() !== '' && (
        <div className="mt-3.5 flex items-start gap-2 rounded-lg border border-[#D5CFC2] bg-white px-3.5 py-2.5 text-xs text-[#656058] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#9CA39B]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0369A1] dark:text-[#38BDF8]" />
          <span>{question.note}</span>
        </div>
      )}
    </div>
  );
};

export const RichExplanation = memo(RichExplanationComponent);
RichExplanation.displayName = 'RichExplanation';
