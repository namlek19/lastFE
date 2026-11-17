import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Cloud,
  GraduationCap,
  Keyboard,
  Layers,
  Moon,
  Sun,
} from 'lucide-react';
import { SUBJECTS, getQuestionsBySubject } from '../data/index';
import { StudyMode, SubjectId, UserProgressStore } from '../types/quiz';
import { isMastered, ThemeMode } from '../utils/storage';

export interface HeaderProps {
  subject: SubjectId;
  mode: StudyMode;
  theme: ThemeMode;
  progress: UserProgressStore;
  onSelectSubject: (subject: SubjectId) => void;
  onSelectMode: (mode: StudyMode) => void;
  onToggleTheme: () => void;
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
  theme,
  progress,
  onSelectSubject,
  onSelectMode,
  onToggleTheme,
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
    <header className="sticky top-0 z-40 mb-8 border-b border-[#D5E3EC] bg-white shadow-[0_8px_24px_-4px_rgba(15,23,42,0.05)] dark:border-[#1E293B] dark:bg-[#111827] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.6)]">
      <div className="mx-auto max-w-[1380px] px-6 lg:px-10">
        {/* Top Row: Brand, Subject Switcher & Utility Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex flex-wrap items-center gap-3.5">
            {/* Brand Title */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0284C7] text-white shadow-sm dark:border dark:border-[#38BDF8]/40">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <span className="block text-sm font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC] sm:text-base">
                  Ôn thi Trắc nghiệm
                </span>
                <span className="hidden text-[11px] text-[#64748B] dark:text-[#94A3B8] sm:block">
                  MLN131 &amp; VNR202 •{' '}
                  <span className="font-medium text-[#0284C7] dark:text-[#38BDF8]">from Namblee</span>
                </span>
              </div>
            </div>

            {/* Subject Switcher Pills */}
            <div
              role="group"
              aria-label="Chọn môn học"
              className="inline-flex items-center gap-1 rounded-xl border border-[#D5E3EC] bg-[#F1F6F9] p-1 dark:border-[#334155] dark:bg-[#0B1120]"
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
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 ${
                      isActive
                        ? 'bg-[#0284C7] text-white shadow-sm hover:bg-[#0369A1] dark:border dark:border-[#38BDF8]/50'
                        : 'text-[#1E293B] hover:bg-[#E0F2FE] hover:text-[#0284C7] dark:text-[#E2E8F0] dark:hover:bg-[#0284C7]/20 dark:hover:text-[#38BDF8]'
                    }`}
                  >
                    <span>{meta.code}</span>
                    <span
                      className={`tabular-nums text-[11px] font-medium ${
                        isActive ? 'text-sky-100' : 'text-[#64748B] dark:text-[#94A3B8]'
                      }`}
                    >
                      ({meta.totalQuestions} câu)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Cluster: Mastery Badge, Shortcuts Popover, Theme Toggle, Sync Modal Button */}
          <div className="flex items-center gap-2.5">
            {/* Overall Mastery Badge (Solid Cold Teal) */}
            <div
              className="inline-flex items-center gap-1.5 rounded-full border border-[#5EEAD4] bg-[#F0FDFA] px-3 py-1 text-xs font-semibold text-[#115E59] tabular-nums dark:border-[#2DD4BF] dark:bg-[#134E4A]/40 dark:text-[#2DD4BF] sm:px-3.5"
              title={`Đã thuộc ${masteredCount} trên ${activeQuestions.length} câu môn ${SUBJECTS[subject].code}`}
            >
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#0D9488] dark:text-[#14B8A6]" />
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
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition ${
                  isShortcutOpen
                    ? 'border-[#0284C7] bg-[#E0F2FE] text-[#0284C7] dark:border-[#38BDF8] dark:bg-[#0284C7]/20 dark:text-[#38BDF8]'
                    : 'border-[#D5E3EC] bg-white text-[#1E293B] hover:border-[#0284C7] hover:bg-[#E0F2FE] hover:text-[#0284C7] dark:border-[#334155] dark:bg-[#1E293B]/70 dark:text-[#E2E8F0] dark:hover:border-[#38BDF8] dark:hover:bg-[#0284C7]/20 dark:hover:text-[#38BDF8]'
                }`}
              >
                <Keyboard className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden md:inline">Phím tắt</span>
              </button>

              {isShortcutOpen && (
                <div
                  role="dialog"
                  aria-label="Hướng dẫn phím tắt"
                  className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-[#D5E3EC] bg-white p-4 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.12)] dark:border-[#334155] dark:bg-[#111827] dark:shadow-[0_14px_34px_-6px_rgba(0,0,0,0.65)]"
                >
                  <div className="mb-2.5 flex items-center justify-between border-b border-[#D5E3EC] pb-2 dark:border-[#1E293B]">
                    <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                      Phím tắt trên máy tính
                    </span>
                    <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">PC</span>
                  </div>
                  <ul className="space-y-2 text-xs text-[#1E293B] dark:text-[#E2E8F0]">
                    <li className="flex items-center justify-between gap-2">
                      <span>Chọn đáp án</span>
                      <span className="flex items-center gap-1">
                        <kbd className="rounded border border-[#D5E3EC] bg-[#F1F6F9] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#0F172A] dark:border-[#334155] dark:bg-[#0B1120] dark:text-[#F8FAFC]">
                          1–4
                        </kbd>
                        <span className="text-[#64748B] dark:text-[#94A3B8]">/</span>
                        <kbd className="rounded border border-[#D5E3EC] bg-[#F1F6F9] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#0F172A] dark:border-[#334155] dark:bg-[#0B1120] dark:text-[#F8FAFC]">
                          A–D
                        </kbd>
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span>Kiểm tra / Câu tiếp</span>
                      <span className="flex items-center gap-1">
                        <kbd className="rounded border border-[#D5E3EC] bg-[#F1F6F9] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#0F172A] dark:border-[#334155] dark:bg-[#0B1120] dark:text-[#F8FAFC]">
                          Enter
                        </kbd>
                        <span className="text-[#64748B] dark:text-[#94A3B8]">/</span>
                        <kbd className="rounded border border-[#D5E3EC] bg-[#F1F6F9] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#0F172A] dark:border-[#334155] dark:bg-[#0B1120] dark:text-[#F8FAFC]">
                          Space
                        </kbd>
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span>Đánh dấu Phân vân</span>
                      <kbd className="rounded border border-[#D5E3EC] bg-[#F1F6F9] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#0F172A] dark:border-[#334155] dark:bg-[#0B1120] dark:text-[#F8FAFC]">
                        F
                      </kbd>
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Light / Dark Mode Toggle */}
            <button
              type="button"
              onClick={onToggleTheme}
              aria-pressed={theme === 'dark'}
              aria-label={theme === 'dark' ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
              title={theme === 'dark' ? 'Chuyển sang chế độ Sáng' : 'Chuyển sang chế độ Tối'}
              className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-[#D5E3EC] bg-white p-1.5 text-xs font-medium text-[#1E293B] transition hover:border-[#0284C7] hover:bg-[#E0F2FE] hover:text-[#0284C7] dark:border-[#334155] dark:bg-[#1E293B]/70 dark:text-[#E2E8F0] dark:hover:border-[#38BDF8] dark:hover:bg-[#0284C7]/20 dark:hover:text-[#38BDF8]"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-[#38BDF8]" />
              ) : (
                <Moon className="h-4 w-4 text-[#0284C7]" />
              )}
            </button>

            {/* Progress Sync Button */}
            <button
              type="button"
              onClick={onOpenSyncModal}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#BAE6FD] bg-[#E0F2FE] px-2.5 py-1.5 text-xs font-semibold text-[#0284C7] transition hover:border-[#0284C7] hover:bg-[#BAE6FD]/60 dark:border-[#38BDF8]/40 dark:bg-[#0284C7]/15 dark:text-[#38BDF8] dark:hover:border-[#38BDF8] dark:hover:bg-[#0284C7]/25 sm:px-3"
            >
              <Cloud className="h-3.5 w-3.5 shrink-0 text-[#0284C7] dark:text-[#38BDF8]" />
              <span>Đồng bộ tiến độ</span>
            </button>
          </div>
        </div>

        {/* Bottom Row: 3 Study Mode Tabs */}
        <nav
          aria-label="Chế độ học tập"
          className="-mx-1 flex items-center gap-2 overflow-x-auto border-t border-[#D5E3EC]/70 px-1 py-2.5 dark:border-[#1E293B]"
        >
          {MODE_TABS.map(({ id, label, Icon }) => {
            const isActive = mode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectMode(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border px-4 py-1.5 text-xs font-semibold transition sm:text-sm ${
                  isActive
                    ? 'border-[#0284C7] bg-[#0284C7] text-white shadow-sm hover:bg-[#0369A1] dark:border-[#38BDF8]/60'
                    : 'border-transparent bg-transparent text-[#64748B] hover:border-[#D5E3EC] hover:bg-[#E0F2FE] hover:text-[#0284C7] dark:text-[#94A3B8] dark:hover:border-[#334155] dark:hover:bg-[#0284C7]/15 dark:hover:text-[#38BDF8]'
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
