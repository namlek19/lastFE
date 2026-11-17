import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Cloud,
  GraduationCap,
  Keyboard,
  Layers,
} from 'lucide-react';
import { SUBJECTS, getQuestionsBySubject } from '../data/index';
import { StudyMode, SubjectId, UserProgressStore } from '../types/quiz';
import { isMastered } from '../utils/storage';

export interface HeaderProps {
  subject: SubjectId;
  mode: StudyMode;
  progress: UserProgressStore;
  onSelectSubject: (subject: SubjectId) => void;
  onSelectMode: (mode: StudyMode) => void;
  onOpenSyncModal: () => void;
}

const MODE_TABS: {
  id: StudyMode;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'chapter', label: 'Học theo chương', Icon: BookOpen },
  { id: 'rolling', label: 'Học cuốn chiếu', Icon: Layers },
  { id: 'exam', label: 'Thi thử trộn đề', Icon: ClipboardCheck },
];

const SUBJECT_ORDER: SubjectId[] = ['mln131', 'vnr202'];

export const Header: React.FC<HeaderProps> = ({
  subject,
  mode,
  progress,
  onSelectSubject,
  onSelectMode,
  onOpenSyncModal,
}) => {
  const [isShortcutOpen, setIsShortcutOpen] = useState(false);
  const shortcutContainerRef = useRef<HTMLDivElement>(null);

  const activeQuestions = useMemo(() => getQuestionsBySubject(subject), [subject]);

  const masteredCount = useMemo(() => {
    let count = 0;
    for (const q of activeQuestions) {
      if (isMastered(progress.questions[q.id])) {
        count += 1;
      }
    }
    return count;
  }, [activeQuestions, progress.questions]);

  useEffect(() => {
    if (!isShortcutOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        shortcutContainerRef.current &&
        !shortcutContainerRef.current.contains(event.target as Node)
      ) {
        setIsShortcutOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsShortcutOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isShortcutOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-sky-100 bg-white/90 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-3 sm:px-6">
        {/* Top Row: Brand, Subject Switcher & Utility Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 py-2.5">
          <div className="flex flex-wrap items-center gap-3">
            {/* Brand Title */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0284C7] to-[#0EA5E9] text-white shadow-sm shadow-sky-600/20">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <span className="block text-sm font-bold tracking-tight text-slate-900 sm:text-base">
                  Ôn thi Trắc nghiệm
                </span>
                <span className="hidden text-[11px] font-medium text-slate-500 sm:block">
                  MLN131 &amp; VNR202 · FPT
                </span>
              </div>
            </div>

            {/* Subject Switcher Pills */}
            <div
              role="group"
              aria-label="Chọn môn học"
              className="inline-flex items-center gap-1 rounded-xl border border-sky-100 bg-sky-50/70 p-1"
            >
              {SUBJECT_ORDER.map((subjId) => {
                const meta = SUBJECTS[subjId];
                const isActive = subject === subjId;
                return (
                  <button
                    key={subjId}
                    type="button"
                    onClick={() => onSelectSubject(subjId)}
                    aria-pressed={isActive}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 ${
                      isActive
                        ? 'bg-[#0284C7] text-white shadow-sm'
                        : 'text-slate-600 hover:bg-white hover:text-[#0284C7]'
                    }`}
                  >
                    <span>{meta.code}</span>
                    <span
                      className={`tabular-nums text-[11px] font-medium ${
                        isActive ? 'text-sky-100' : 'text-slate-400'
                      }`}
                    >
                      ({meta.totalQuestions} câu)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Cluster: Mastery Badge, Shortcuts Popover, Sync Modal Button */}
          <div className="flex items-center gap-2">
            {/* Overall Mastery Badge */}
            <div
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/90 px-2.5 py-1 text-xs font-semibold text-emerald-700 tabular-nums sm:px-3"
              title={`Đã thuộc ${masteredCount} trên ${activeQuestions.length} câu môn ${SUBJECTS[subject].code}`}
            >
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span>
                {masteredCount} / {activeQuestions.length} Đã thuộc
              </span>
            </div>

            {/* Keyboard Shortcuts Popover */}
            <div ref={shortcutContainerRef} className="relative">
              <button
                type="button"
                onClick={() => setIsShortcutOpen((prev) => !prev)}
                aria-expanded={isShortcutOpen}
                aria-haspopup="true"
                title="Phím tắt bàn phím"
                className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition ${
                  isShortcutOpen
                    ? 'border-cyan-200 bg-cyan-50 text-[#0284C7]'
                    : 'border-sky-100 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50 hover:text-[#0284C7]'
                }`}
              >
                <Keyboard className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden md:inline">Phím tắt</span>
              </button>

              {isShortcutOpen && (
                <div
                  role="dialog"
                  aria-label="Hướng dẫn phím tắt"
                  className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-sky-100 bg-white p-3.5 shadow-xl shadow-sky-900/10"
                >
                  <div className="mb-2.5 flex items-center justify-between border-b border-sky-50 pb-2">
                    <span className="text-xs font-bold text-slate-800">
                      Phím tắt trên máy tính
                    </span>
                    <span className="text-[11px] text-slate-400">PC</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-600">
                    <li className="flex items-center justify-between gap-2">
                      <span>Chọn đáp án</span>
                      <span className="flex items-center gap-1">
                        <kbd className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                          1–4
                        </kbd>
                        <span className="text-slate-400">/</span>
                        <kbd className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                          A–D
                        </kbd>
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span>Kiểm tra / Câu tiếp</span>
                      <span className="flex items-center gap-1">
                        <kbd className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                          Enter
                        </kbd>
                        <span className="text-slate-400">/</span>
                        <kbd className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                          Space
                        </kbd>
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span>Đánh dấu Phân vân</span>
                      <kbd className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                        F
                      </kbd>
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Progress Sync Button */}
            <button
              type="button"
              onClick={onOpenSyncModal}
              className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-200 bg-cyan-50/90 px-2.5 py-1.5 text-xs font-semibold text-[#0284C7] transition hover:border-[#0284C7]/40 hover:bg-cyan-100/80 sm:px-3"
            >
              <Cloud className="h-3.5 w-3.5 shrink-0" />
              <span>Đồng bộ tiến độ</span>
            </button>
          </div>
        </div>

        {/* Bottom Row: 3 Study Mode Tabs */}
        <nav
          aria-label="Chế độ học tập"
          className="-mx-1 flex items-center gap-1.5 overflow-x-auto border-t border-sky-100/80 px-1 py-2"
        >
          {MODE_TABS.map(({ id, label, Icon }) => {
            const isActive = mode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectMode(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition sm:text-sm ${
                  isActive
                    ? 'border-[#0284C7] bg-[#0284C7] text-white shadow-sm shadow-sky-600/15'
                    : 'border-transparent bg-transparent text-slate-600 hover:border-sky-100 hover:bg-sky-50/80 hover:text-[#0284C7]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
