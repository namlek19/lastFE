import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { Header } from './components/Header';
import { ChapterStudyView } from './components/ChapterStudyView';
import { RollingStudyView } from './components/RollingStudyView';
import { FlashcardView } from './components/FlashcardView';
import { MockExamView } from './components/MockExamView';
import { ProgressSyncModal } from './components/ProgressSyncModal';
import { ExamHistoryItem, StudyMode, SubjectId, UserProgressStore } from './types/quiz';
import {
  addExamHistory,
  loadStore,
  loadTheme,
  markQuestionsFlagged,
  markQuestionStudied,
  recordQuestionAttempt,
  resetProgress,
  saveStore,
  saveTheme,
  ThemeMode,
  toggleQuestionFlag,
  toggleQuestionMastered,
} from './utils/storage';

export const App: React.FC = () => {
  const [store, setStore] = useState<UserProgressStore>(() => loadStore());
  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme());
  const [isSyncOpen, setIsSyncOpen] = useState(false);

  useEffect(() => {
    saveStore(store);
  }, [store]);

  useEffect(() => {
    saveTheme(theme);
  }, [theme]);

  const handleToggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const handleSelectSubject = useCallback((subject: SubjectId) => {
    setStore(prev => ({ ...prev, lastSubject: subject }));
  }, []);

  const handleSelectMode = useCallback((mode: StudyMode) => {
    setStore(prev => ({ ...prev, lastMode: mode }));
  }, []);

  const handleRecordAttempt = useCallback(
    (qId: string, isCorrect: boolean, flagged?: boolean) => {
      setStore(prev => recordQuestionAttempt(prev, qId, isCorrect, flagged));
    },
    []
  );

  const handleToggleFlag = useCallback((qId: string) => {
    setStore(prev => toggleQuestionFlag(prev, qId));
  }, []);

  const handleFlagQuestions = useCallback((qIds: string[]) => {
    setStore(prev => markQuestionsFlagged(prev, qIds));
  }, []);

  const handleMarkStudied = useCallback((qId: string) => {
    setStore(prev => markQuestionStudied(prev, qId));
  }, []);

  const handleToggleMastered = useCallback((qId: string) => {
    setStore(prev => toggleQuestionMastered(prev, qId));
  }, []);

  const handleResetStage = useCallback((questionIds: string[]) => {
    setStore(prev => resetProgress(prev, questionIds));
  }, []);

  const handleSaveExamResult = useCallback((result: ExamHistoryItem) => {
    setStore(prev => addExamHistory(prev, result));
  }, []);

  const handleImportProgress = useCallback((nextStore: UserProgressStore) => {
    setStore(nextStore);
  }, []);

  const handleResetAllProgress = useCallback(() => {
    setStore(prev => resetProgress(prev));
  }, []);

  const { lastSubject: subject, lastMode: mode } = store;

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen flex flex-col">
        <Header
          subject={subject}
          mode={mode}
          theme={theme}
          progress={store}
          onSelectSubject={handleSelectSubject}
          onSelectMode={handleSelectMode}
          onToggleTheme={handleToggleTheme}
          onOpenSyncModal={() => setIsSyncOpen(true)}
        />

        <main className="mx-auto w-full max-w-[1720px] flex-1 px-4 py-4 pb-24 sm:px-6 md:py-7 md:pb-8 lg:px-10 xl:px-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${subject}-${mode}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              {mode === 'chapter' && (
                <ChapterStudyView
                  subject={subject}
                  progress={store}
                  onRecordAttempt={handleRecordAttempt}
                  onToggleFlag={handleToggleFlag}
                />
              )}
              {mode === 'rolling' && (
                <RollingStudyView
                  subject={subject}
                  progress={store}
                  onRecordAttempt={handleRecordAttempt}
                  onToggleFlag={handleToggleFlag}
                  onResetStage={handleResetStage}
                />
              )}
              {mode === 'flashcard' && (
                <FlashcardView
                  subject={subject}
                  progress={store}
                  onMarkStudied={handleMarkStudied}
                  onToggleMastered={handleToggleMastered}
                  onToggleFlag={handleToggleFlag}
                />
              )}
              {mode === 'exam' && (
                <MockExamView
                  subject={subject}
                  progress={store}
                  onSaveExamResult={handleSaveExamResult}
                  onRecordAttempt={handleRecordAttempt}
                  onToggleFlag={handleToggleFlag}
                  onFlagQuestions={handleFlagQuestions}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="mt-6 border-t border-[#D5CFC2] bg-[#EAE6DD] py-5 pb-24 text-xs text-[#656058] dark:border-[#262925] dark:bg-[#161816] dark:text-[#9CA39B] md:mt-12 md:py-6 md:pb-6">
          <div className="mx-auto flex w-full max-w-[1720px] flex-wrap items-center justify-between gap-2 px-4 sm:px-6 lg:px-10 xl:px-12">
            <span>Ôn thi trắc nghiệm MLN131 &amp; VNR202 • Tự động lưu tiến độ</span>
            <span className="inline-flex items-center rounded-full border border-[#93C5FD] bg-[#EFF6FF] px-2.5 py-0.5 text-xs font-semibold text-[#1D4ED8] dark:border-[#3B82F6]/50 dark:bg-[#1E3A8A]/30 dark:text-[#93C5FD]">
              from Namblee
            </span>
          </div>
        </footer>

        <ProgressSyncModal
          isOpen={isSyncOpen}
          progress={store}
          onClose={() => setIsSyncOpen(false)}
          onImportProgress={handleImportProgress}
          onResetAllProgress={handleResetAllProgress}
        />
      </div>
    </MotionConfig>
  );
};

export default App;
