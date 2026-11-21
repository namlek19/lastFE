import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import namFlorkImg from '../assets/nam-flork-thumbsup.png';

const WELCOME_SEEN_KEY = 'fpt_exam_nam_note_seen_v1';

export interface WelcomeNoteModalProps {
  enabled?: boolean;
  onDismiss?: () => void;
}

export const WelcomeNoteModal: React.FC<WelcomeNoteModalProps> = ({
  enabled = true,
  onDismiss,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(WELCOME_SEEN_KEY) !== '1';
    } catch {
      return true;
    }
  });

  const handleClose = useCallback(() => {
    try {
      localStorage.setItem(WELCOME_SEEN_KEY, '1');
    } catch {
      // Ignore storage quota or private mode restrictions
    }
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!enabled || !isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleClose, isOpen]);

  return (
    <AnimatePresence onExitComplete={onDismiss}>
      {enabled && isOpen && (
        <motion.div
          key="welcome-note-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={handleClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#18181B]/62 p-4 dark:bg-[#0F100E]/84"
        >
          <motion.div
            key="welcome-note-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-note-title"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-3xl border-2 border-[#27272A] bg-white p-5 shadow-[6px_6px_0_0_#C7D2FE,0_20px_40px_-12px_rgba(24,24,27,0.22)] dark:border-[#52525B] dark:bg-[#1E221F] dark:shadow-[6px_6px_0_0_#312E81,0_22px_44px_-12px_rgba(0,0,0,0.8)] sm:p-6"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-full rounded-2xl border-2 border-[#27272A] bg-white p-3 shadow-[3px_3px_0_0_#C7D2FE] dark:border-[#52525B] dark:bg-[#FAF9F5] dark:shadow-[3px_3px_0_0_#312E81]">
                <img
                  src={namFlorkImg}
                  alt="Flork giơ ngón cái chúc thi tốt"
                  width={176}
                  height={176}
                  loading="lazy"
                  decoding="async"
                  className="mx-auto h-40 w-40 object-contain sm:h-44 sm:w-44"
                />
              </div>

              <div className="mt-4 w-full rounded-2xl border border-[#E2DDD2] border-l-4 border-l-[#4338CA] bg-[#FAF8F3] px-4 py-3.5 text-left dark:border-[#2C322D] dark:border-l-4 dark:border-l-[#818CF8] dark:bg-[#161917]">
                <h2
                  id="welcome-note-title"
                  className="text-base font-extrabold text-[#4338CA] dark:text-[#A5B4FC]"
                >
                  From Nam,
                </h2>
                <p className="mt-1.5 text-[15px] font-semibold leading-relaxed text-[#18181B] dark:text-[#F5F5F4] sm:text-base">
                  Những ngày tới thi tốt nha, thanks for being my friends
                </p>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="mt-4 w-full cursor-pointer rounded-xl bg-[#4338CA] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#3730A3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4338CA] dark:focus-visible:outline-[#818CF8]"
              >
                Cảm ơn, vào ôn bài thôi!
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WelcomeNoteModal;
