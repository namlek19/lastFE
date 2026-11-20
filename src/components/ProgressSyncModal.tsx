import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Cloud,
  Copy,
  HelpCircle,
  Trash2,
  Trophy,
  Upload,
  X,
} from 'lucide-react';
import { getQuestionsBySubject } from '../data/index';
import { UserProgressStore } from '../types/quiz';
import { exportProgressCode, importProgressCode, isMastered, mergeProgressStores } from '../utils/storage';

export interface ProgressSyncModalProps {
  isOpen: boolean;
  progress: UserProgressStore;
  onClose: () => void;
  onImportProgress: (nextStore: UserProgressStore) => void;
  onResetAllProgress: () => void;
}

export const ProgressSyncModal: React.FC<ProgressSyncModalProps> = ({
  isOpen,
  progress,
  onClose,
  onImportProgress,
  onResetAllProgress,
}) => {
  const [copied, setCopied] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const exportTextareaRef = useRef<HTMLTextAreaElement>(null);
  const copyTimerRef = useRef<number | null>(null);

  const allQuestions = useMemo(
    () => [
      ...getQuestionsBySubject('mln131'),
      ...getQuestionsBySubject('vnr202'),
      ...getQuestionsBySubject('wdu203c'),
    ],
    []
  );

  const summary = useMemo(() => {
    let mastered = 0;
    let hesitant = 0;
    for (const q of allQuestions) {
      const qProg = progress.questions[q.id];
      if (isMastered(qProg)) {
        mastered += 1;
      }
      if (qProg?.flagged) {
        hesitant += 1;
      }
    }
    return {
      mastered,
      hesitant,
      exams: progress.examHistory.length,
    };
  }, [allQuestions, progress.examHistory.length, progress.questions]);

  const syncCode = useMemo(
    () => (isOpen ? exportProgressCode(progress) : ''),
    [isOpen, progress]
  );

  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
      setInputCode('');
      setImportError(null);
      setImportSuccess(null);
      setConfirmReset(false);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleCopyCode = async () => {
    if (!syncCode) return;
    let success = false;
    try {
      await navigator.clipboard.writeText(syncCode);
      success = true;
    } catch {
      if (exportTextareaRef.current) {
        exportTextareaRef.current.focus();
        exportTextareaRef.current.select();
        try {
          success = document.execCommand('copy');
        } catch {
          success = false;
        }
      }
    }

    if (success) {
      setCopied(true);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopied(false);
        copyTimerRef.current = null;
      }, 2200);
    }
  };

  const handleImport = () => {
    const imported = importProgressCode(inputCode);
    if (!imported) {
      setImportSuccess(null);
      setImportError('Mã tiến độ không hợp lệ hoặc bị thiếu ký tự.');
      return;
    }

    let beforeMastered = 0;
    for (const q of allQuestions) {
      if (isMastered(progress.questions[q.id])) {
        beforeMastered += 1;
      }
    }

    const merged = mergeProgressStores(progress, imported);

    let afterMastered = 0;
    for (const q of allQuestions) {
      if (isMastered(merged.questions[q.id])) {
        afterMastered += 1;
      }
    }

    const addedMastered = Math.max(0, afterMastered - beforeMastered);
    const addedExams = Math.max(0, merged.examHistory.length - progress.examHistory.length);

    onImportProgress(merged);
    setImportError(null);
    setInputCode('');
    setConfirmReset(false);
    setImportSuccess(
      `Đã cộng dồn tiến độ! Tổng: ${afterMastered} câu đã thuộc${
        addedMastered > 0 ? ` (+${addedMastered} câu mới)` : ''
      }, ${merged.examHistory.length} lượt thi thử${
        addedExams > 0 ? ` (+${addedExams} lượt mới)` : ''
      }.`
    );
  };

  const handleConfirmReset = () => {
    onResetAllProgress();
    setConfirmReset(false);
    setImportError(null);
    setImportSuccess(null);
    setCopied(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="sync-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#18181B]/50 p-3 backdrop-blur-xs dark:bg-[#0F100E]/80 sm:p-6"
        >
          <motion.div
            key="sync-modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sync-modal-title"
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#D5CFC2] bg-[#EAE6DD] shadow-[0_14px_34px_-8px_rgba(28,25,23,0.09)] dark:border-[#262925] dark:bg-[#161816] dark:shadow-[0_16px_38px_-8px_rgba(0,0,0,0.7)]"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#D5CFC2] bg-[#EAE6DD] px-5 py-4 dark:border-[#262925] dark:bg-[#161816]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#A5B4FC] bg-[#EEF2FF] text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC]">
                  <Cloud className="h-5 w-5" />
                </div>
                <div>
                  <h2 id="sync-modal-title" className="text-base font-bold text-[#18181B] dark:text-[#F5F5F4]">
                    Đồng bộ tiến độ học tập
                  </h2>
                  <p className="text-xs text-[#656058] dark:text-[#9CA39B]">
                    Chuyển kết quả ôn tập giữa điện thoại và máy tính bằng mã cá nhân
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng hộp thoại"
                className="cursor-pointer rounded-xl p-1.5 text-[#656058] transition hover:bg-[#EEF2FF] hover:text-[#3730A3] dark:text-[#9CA39B] dark:hover:bg-[#312E81]/30 dark:hover:text-[#A5B4FC]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              {/* Current Progress Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-[#10B981] bg-[#D1FAE5] p-3 text-center text-[#047857] dark:border-[#10B981] dark:bg-[#059669]/30 dark:text-[#34D399]">
                  <div className="mb-1 flex items-center justify-center gap-1 text-[11px] font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#059669] dark:text-[#34D399]" />
                    <span>Tổng câu đã thuộc</span>
                  </div>
                  <p className="text-lg font-bold tabular-nums">
                    {summary.mastered}
                  </p>
                </div>

                <div className="rounded-xl border border-[#F0ABFC] bg-[#FAE8FF] p-3 text-center text-[#A21CAF] dark:border-[#E879F9]/55 dark:bg-[#D946EF]/20 dark:text-[#F5D0FE]">
                  <div className="mb-1 flex items-center justify-center gap-1 text-[11px] font-medium">
                    <HelpCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>Câu phân vân</span>
                  </div>
                  <p className="text-lg font-bold tabular-nums">
                    {summary.hesitant}
                  </p>
                </div>

                <div className="rounded-xl border border-[#F59E0B] bg-[#FEF3C7] p-3 text-center text-[#B45309] dark:border-[#F59E0B]/60 dark:bg-[#F59E0B]/20 dark:text-[#FCD34D]">
                  <div className="mb-1 flex items-center justify-center gap-1 text-[11px] font-medium">
                    <Trophy className="h-3.5 w-3.5 shrink-0" />
                    <span>Lượt thi thử</span>
                  </div>
                  <p className="text-lg font-bold tabular-nums">
                    {summary.exams}
                  </p>
                </div>
              </div>

              {/* Export Section */}
              <section className="rounded-2xl border border-[#C6BEB0] bg-[#FFFFFF] p-4 dark:border-[#323833] dark:bg-[#1E221F]">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[#18181B] dark:text-[#F5F5F4]">
                      Sao chép mã tiến độ
                    </h3>
                    <span className="rounded-full border border-[#D5CFC2] bg-[#FAF9F5] px-2 py-0.5 tabular-nums text-[11px] font-semibold text-[#656058] dark:border-[#2C302B] dark:bg-[#161816] dark:text-[#9CA39B]">
                      {syncCode.length} ký tự
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      copied
                        ? 'bg-[#059669] text-white dark:bg-[#10B981] dark:text-[#0F100E]'
                        : 'bg-[#4338CA] text-white hover:bg-[#3730A3] dark:border dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:hover:bg-[#3730A3]'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Đã sao chép!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Sao chép mã</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="mb-2.5 text-xs text-[#656058] dark:text-[#9CA39B]">
                  Sao chép đoạn mã dưới đây để lưu dự phòng hoặc dán sang thiết bị khác.
                </p>

                <textarea
                  ref={exportTextareaRef}
                  readOnly
                  rows={2}
                  value={syncCode}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  onClick={(e) => e.currentTarget.select()}
                  aria-label="Mã tiến độ hiện tại"
                  className="w-full resize-none rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] px-3 py-2 font-mono text-xs leading-relaxed text-[#292524] focus:border-[#4338CA] focus:outline-none dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:focus:border-[#818CF8]"
                />
              </section>

              {/* Import Section */}
              <section className="rounded-2xl border border-[#C6BEB0] bg-[#FFFFFF] p-4 dark:border-[#323833] dark:bg-[#1E221F]">
                <h3 className="mb-1 text-sm font-bold text-[#18181B] dark:text-[#F5F5F4]">
                  Nhập &amp; cộng dồn mã tiến độ
                </h3>
                <p className="mb-2.5 text-xs text-[#656058] dark:text-[#9CA39B]">
                  Dán mã từ thiết bị khác để gộp cộng dồn các câu đã học, đã thuộc và lịch sử thi thử vào máy này (không ghi đè mất dữ liệu cũ).
                </p>

                <textarea
                  rows={2}
                  value={inputCode}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(e) => {
                    setInputCode(e.target.value);
                    if (importError) setImportError(null);
                    if (importSuccess) setImportSuccess(null);
                  }}
                  placeholder="Dán mã đồng bộ (OT3-..., OT2-... hoặc OT1:...) vào đây"
                  aria-label="Ô nhập mã tiến độ"
                  className="w-full resize-none rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] px-3 py-2 font-mono text-xs leading-relaxed text-[#292524] placeholder:text-[#656058] focus:border-[#4338CA] focus:outline-none dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:placeholder:text-[#9CA39B] dark:focus:border-[#818CF8]"
                />

                {importError && (
                  <p
                    role="alert"
                    className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#BE123C] dark:text-[#FDA4AF]"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>{importError}</span>
                  </p>
                )}

                {importSuccess && (
                  <p
                    role="status"
                    className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#047857] dark:text-[#34D399]"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>{importSuccess}</span>
                  </p>
                )}

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={!inputCode.trim()}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#4338CA] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#3730A3] disabled:cursor-not-allowed disabled:bg-[#EAE6DD] disabled:text-[#656058] dark:border dark:border-[#818CF8]/50 dark:bg-[#4338CA] dark:hover:bg-[#3730A3] dark:disabled:border-transparent dark:disabled:bg-[#1C1F1C] dark:disabled:text-[#9CA39B]"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Cộng dồn tiến độ</span>
                  </button>
                </div>
              </section>

              {/* Reset Section */}
              <section className="rounded-2xl border border-[#FDA4AF] bg-[#FFE4E6] p-4 dark:border-[#FB7185]/55 dark:bg-[#E11D48]/20">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#18181B] dark:text-[#F5F5F4]">Xóa tiến độ</h3>
                    <p className="text-xs text-[#656058] dark:text-[#9CA39B]">
                      Đặt lại toàn bộ trạng thái câu hỏi và lịch sử thi thử về ban đầu.
                    </p>
                  </div>

                  {!confirmReset ? (
                    <button
                      type="button"
                      onClick={() => setConfirmReset(true)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#FDA4AF] bg-[#FFFFFF] px-3 py-1.5 text-xs font-semibold text-[#BE123C] transition hover:bg-[#FFE4E6] dark:border-[#FB7185]/55 dark:bg-[#E11D48]/20 dark:text-[#FDA4AF] dark:hover:bg-[#E11D48]/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Xóa toàn bộ tiến độ</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmReset(false)}
                        className="cursor-pointer rounded-xl border border-[#D5CFC2] bg-[#FAF9F5] px-3 py-1.5 text-xs font-semibold text-[#292524] transition hover:border-[#4338CA] hover:bg-[#EEF2FF] hover:text-[#3730A3] dark:border-[#2C302B] dark:bg-[#1C1F1C] dark:text-[#E7E5E4] dark:hover:border-[#818CF8] dark:hover:bg-[#312E81]/30"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmReset}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#E11D48] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#BE123C] dark:border dark:border-[#FB7185]/55 dark:bg-[#E11D48]/20 dark:text-[#FDA4AF] dark:hover:bg-[#E11D48]/30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Xác nhận xóa</span>
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
