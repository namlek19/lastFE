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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-3 backdrop-blur-xs sm:p-6"
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
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#D5E3EC] bg-white shadow-[0_8px_24px_-4px_rgba(15,23,42,0.12)]"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#D5E3EC] bg-white px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E0F2FE] text-[#0369A1]">
                  <Cloud className="h-5 w-5" />
                </div>
                <div>
                  <h2 id="sync-modal-title" className="text-base font-bold text-[#0F172A]">
                    Đồng bộ tiến độ học tập
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    Chuyển kết quả ôn tập giữa điện thoại và máy tính bằng mã cá nhân
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng hộp thoại"
                className="rounded-xl p-1.5 text-[#64748B] transition hover:bg-[#E0F2FE] hover:text-[#0369A1]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              {/* Current Progress Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] p-3 text-center">
                  <div className="mb-1 flex items-center justify-center gap-1 text-[11px] font-medium text-[#059669]">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#0D9488]" />
                    <span>Tổng câu đã thuộc</span>
                  </div>
                  <p className="text-lg font-bold text-[#065F46] tabular-nums">
                    {summary.mastered}
                  </p>
                </div>

                <div className="rounded-xl border border-[#C7D2FE] bg-[#EEF2FF] p-3 text-center">
                  <div className="mb-1 flex items-center justify-center gap-1 text-[11px] font-medium text-[#4F46E5]">
                    <HelpCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>Câu phân vân</span>
                  </div>
                  <p className="text-lg font-bold text-[#4F46E5] tabular-nums">
                    {summary.hesitant}
                  </p>
                </div>

                <div className="rounded-xl border border-[#BAE6FD] bg-[#E0F2FE] p-3 text-center">
                  <div className="mb-1 flex items-center justify-center gap-1 text-[11px] font-medium text-[#0369A1]">
                    <Trophy className="h-3.5 w-3.5 shrink-0" />
                    <span>Lượt thi thử</span>
                  </div>
                  <p className="text-lg font-bold text-[#0F172A] tabular-nums">
                    {summary.exams}
                  </p>
                </div>
              </div>

              {/* Export Section */}
              <section className="rounded-2xl border border-[#D5E3EC] bg-[#F8FAFC] p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-[#0F172A]">
                    Sao chép mã tiến độ
                  </h3>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      copied
                        ? 'bg-[#059669] text-white'
                        : 'bg-[#0369A1] text-white hover:bg-[#075985]'
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

                <p className="mb-2.5 text-xs text-[#64748B]">
                  Sao chép đoạn mã dưới đây để lưu dự phòng hoặc dán sang thiết bị khác.
                </p>

                <textarea
                  ref={exportTextareaRef}
                  readOnly
                  rows={3}
                  value={syncCode}
                  onClick={(e) => e.currentTarget.select()}
                  aria-label="Mã tiến độ hiện tại"
                  className="w-full resize-none rounded-xl border border-[#D5E3EC] bg-white px-3 py-2 font-mono text-xs leading-relaxed text-[#1E293B] focus:border-[#0369A1] focus:outline-none"
                />
              </section>

              {/* Import Section */}
              <section className="rounded-2xl border border-[#D5E3EC] bg-white p-4">
                <h3 className="mb-1 text-sm font-bold text-[#0F172A]">
                  Nhập mã tiến độ
                </h3>
                <p className="mb-2.5 text-xs text-[#64748B]">
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
                  className="w-full resize-none rounded-xl border border-[#D5E3EC] bg-[#F8FAFC] px-3 py-2 font-mono text-xs leading-relaxed text-[#1E293B] placeholder:text-[#64748B] focus:border-[#0369A1] focus:bg-white focus:outline-none"
                />

                {importError && (
                  <p
                    role="alert"
                    className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#E11D48]"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>{importError}</span>
                  </p>
                )}

                {importSuccess && (
                  <p
                    role="status"
                    className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#059669]"
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
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#0369A1] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#075985] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Khôi phục tiến độ</span>
                  </button>
                </div>
              </section>

              {/* Reset Section */}
              <section className="rounded-2xl border border-[#FECDD3] bg-[#FFF1F2]/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A]">Xóa tiến độ</h3>
                    <p className="text-xs text-[#64748B]">
                      Đặt lại toàn bộ trạng thái câu hỏi và lịch sử thi thử về ban đầu.
                    </p>
                  </div>

                  {!confirmReset ? (
                    <button
                      type="button"
                      onClick={() => setConfirmReset(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#FECDD3] bg-white px-3 py-1.5 text-xs font-semibold text-[#E11D48] transition hover:bg-[#FFF1F2]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Xóa toàn bộ tiến độ</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmReset(false)}
                        className="rounded-xl border border-[#D5E3EC] bg-white px-3 py-1.5 text-xs font-semibold text-[#1E293B] transition hover:bg-[#F8FAFC]"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmReset}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#E11D48] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700"
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
