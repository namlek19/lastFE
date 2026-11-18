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
import { exportProgressCode, importProgressCode, isMastered } from '../utils/storage';

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
    () => [...getQuestionsBySubject('mln131'), ...getQuestionsBySubject('vnr202')],
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

    let importedMastered = 0;
    for (const q of allQuestions) {
      if (isMastered(imported.questions[q.id])) {
        importedMastered += 1;
      }
    }

    onImportProgress(imported);
    setImportError(null);
    setInputCode('');
    setConfirmReset(false);
    setImportSuccess(
      `Đã khôi phục tiến độ thành công (${importedMastered} câu đã thuộc, ${imported.examHistory.length} lượt thi thử).`
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#142018]/50 p-3 backdrop-blur-xs dark:bg-[#0D120F]/80 sm:p-6"
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
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#D2DACB] bg-[#E8ECE4] shadow-[0_14px_34px_-8px_rgba(30,58,42,0.10)] dark:border-[#222E27] dark:bg-[#131A16] dark:shadow-[0_14px_36px_-8px_rgba(0,0,0,0.65)]"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#D2DACB] bg-[#E8ECE4] px-5 py-4 dark:border-[#222E27] dark:bg-[#131A16]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#9BC4AE] bg-[#E3EFE8] text-[#23583D] dark:border-[#52B788]/50 dark:bg-[#357A58]/20 dark:text-[#74C69D]">
                  <Cloud className="h-5 w-5" />
                </div>
                <div>
                  <h2 id="sync-modal-title" className="text-base font-bold text-[#142018] dark:text-[#F3F6F4]">
                    Đồng bộ tiến độ học tập
                  </h2>
                  <p className="text-xs text-[#5C6E60] dark:text-[#8B9E91]">
                    Chuyển kết quả ôn tập giữa điện thoại và máy tính bằng mã cá nhân
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng hộp thoại"
                className="cursor-pointer rounded-xl p-1.5 text-[#5C6E60] transition hover:bg-[#E3EFE8] hover:text-[#23583D] dark:text-[#8B9E91] dark:hover:bg-[#1E2B24] dark:hover:text-[#74C69D]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              {/* Current Progress Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-[#68B99A] bg-[#E1F3EC] p-3 text-center text-[#0F5C41] dark:border-[#52B788]/60 dark:bg-[#2E9E73]/15 dark:text-[#6EE7B7]">
                  <div className="mb-1 flex items-center justify-center gap-1 text-[11px] font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#1F8A65] dark:text-[#6EE7B7]" />
                    <span>Tổng câu đã thuộc</span>
                  </div>
                  <p className="text-lg font-bold tabular-nums">
                    {summary.mastered}
                  </p>
                </div>

                <div className="rounded-xl border border-[#C9B3E6] bg-[#F3EDF9] p-3 text-center text-[#6D28D9] dark:border-[#C084FC]/50 dark:bg-[#A855F7]/15 dark:text-[#D8B4FE]">
                  <div className="mb-1 flex items-center justify-center gap-1 text-[11px] font-medium">
                    <HelpCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>Câu phân vân</span>
                  </div>
                  <p className="text-lg font-bold tabular-nums">
                    {summary.hesitant}
                  </p>
                </div>

                <div className="rounded-xl border border-[#F5CBA7] bg-[#FEF5E7] p-3 text-center text-[#B45309] dark:border-[#F59E0B]/50 dark:bg-[#F59E0B]/15 dark:text-[#FCD34D]">
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
              <section className="rounded-2xl border border-[#BCC9B4] bg-[#FFFFFF] p-4 dark:border-[#31453A] dark:bg-[#1B2620]">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-[#142018] dark:text-[#F3F6F4]">
                    Sao chép mã tiến độ
                  </h3>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      copied
                        ? 'bg-[#1F8A65] text-white dark:bg-[#38A179] dark:text-[#0D120F]'
                        : 'bg-[#2E6F4E] text-white hover:bg-[#23583D] dark:border dark:border-[#52B788]/50 dark:bg-[#357A58] dark:hover:bg-[#2B6649]'
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

                <p className="mb-2.5 text-xs text-[#5C6E60] dark:text-[#8B9E91]">
                  Sao chép đoạn mã dưới đây để lưu dự phòng hoặc dán sang thiết bị khác.
                </p>

                <textarea
                  ref={exportTextareaRef}
                  readOnly
                  rows={3}
                  value={syncCode}
                  onClick={(e) => e.currentTarget.select()}
                  aria-label="Mã tiến độ hiện tại"
                  className="w-full resize-none rounded-xl border border-[#D2DACB] bg-[#F7F8F5] px-3 py-2 font-mono text-xs leading-relaxed text-[#243329] focus:border-[#2E6F4E] focus:outline-none dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#DDE5DF] dark:focus:border-[#52B788]"
                />
              </section>

              {/* Import Section */}
              <section className="rounded-2xl border border-[#BCC9B4] bg-[#FFFFFF] p-4 dark:border-[#31453A] dark:bg-[#1B2620]">
                <h3 className="mb-1 text-sm font-bold text-[#142018] dark:text-[#F3F6F4]">
                  Nhập mã tiến độ
                </h3>
                <p className="mb-2.5 text-xs text-[#5C6E60] dark:text-[#8B9E91]">
                  Dán mã tiến độ đã lưu từ thiết bị khác vào ô bên dưới để khôi phục.
                </p>

                <textarea
                  rows={3}
                  value={inputCode}
                  onChange={(e) => {
                    setInputCode(e.target.value);
                    if (importError) setImportError(null);
                    if (importSuccess) setImportSuccess(null);
                  }}
                  placeholder="Dán mã bắt đầu bằng OT1:... vào đây"
                  aria-label="Ô nhập mã tiến độ"
                  className="w-full resize-none rounded-xl border border-[#D2DACB] bg-[#F7F8F5] px-3 py-2 font-mono text-xs leading-relaxed text-[#243329] placeholder:text-[#5C6E60] focus:border-[#2E6F4E] focus:outline-none dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#DDE5DF] dark:placeholder:text-[#8B9E91] dark:focus:border-[#52B788]"
                />

                {importError && (
                  <p
                    role="alert"
                    className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#C2412D] dark:text-[#FCA5A5]"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>{importError}</span>
                  </p>
                )}

                {importSuccess && (
                  <p
                    role="status"
                    className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#0F5C41] dark:text-[#6EE7B7]"
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
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#2E6F4E] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#23583D] disabled:cursor-not-allowed disabled:bg-[#E8ECE4] disabled:text-[#5C6E60] dark:border dark:border-[#52B788]/50 dark:bg-[#357A58] dark:hover:bg-[#2B6649] dark:disabled:border-transparent dark:disabled:bg-[#17201B] dark:disabled:text-[#8B9E91]"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Khôi phục tiến độ</span>
                  </button>
                </div>
              </section>

              {/* Reset Section */}
              <section className="rounded-2xl border border-[#F2B8AE] bg-[#FDF0ED] p-4 dark:border-[#F28472]/50 dark:bg-[#E05A47]/15">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#142018] dark:text-[#F3F6F4]">Xóa tiến độ</h3>
                    <p className="text-xs text-[#5C6E60] dark:text-[#8B9E91]">
                      Đặt lại toàn bộ trạng thái câu hỏi và lịch sử thi thử về ban đầu.
                    </p>
                  </div>

                  {!confirmReset ? (
                    <button
                      type="button"
                      onClick={() => setConfirmReset(true)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#F2B8AE] bg-[#FFFFFF] px-3 py-1.5 text-xs font-semibold text-[#C2412D] transition hover:bg-[#FDF0ED] dark:border-[#F28472]/50 dark:bg-[#E05A47]/15 dark:text-[#FCA5A5] dark:hover:bg-[#E05A47]/25"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Xóa toàn bộ tiến độ</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmReset(false)}
                        className="cursor-pointer rounded-xl border border-[#D2DACB] bg-[#F7F8F5] px-3 py-1.5 text-xs font-semibold text-[#243329] transition hover:border-[#2E6F4E] hover:bg-[#E3EFE8] dark:border-[#25332B] dark:bg-[#17201B] dark:text-[#DDE5DF] dark:hover:border-[#52B788] dark:hover:bg-[#1E2B24]"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmReset}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#C2412D] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#9E3322] dark:border dark:border-[#F28472]/50 dark:bg-[#E05A47]/15 dark:text-[#FCA5A5] dark:hover:bg-[#E05A47]/25"
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
