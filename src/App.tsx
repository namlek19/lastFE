import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { Header } from './components/Header';
import { ChapterStudyView } from './components/ChapterStudyView';
import { RollingStudyView } from './components/RollingStudyView';
import { MockExamView } from './components/MockExamView';
import { ProgressSyncModal } from './components/ProgressSyncModal';
import { ExamHistoryItem, StudyMode, SubjectId, UserProgressStore } from './types/quiz';
import {
  addExamHistory,
  loadStore,
  recordQuestionAttempt,
  resetProgress,
  saveStore,
  toggleQuestionFlag,
} from './utils/storage';

export const App: React.FC = () => {
  const [store, setStore] = useState<UserProgressStore>(() => loadStore());
  const [isSyncOpen, setIsSyncOpen] = useState(false);

  useEffect(() => {
    saveStore(store);
  }, [store]);

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
          progress={store}
          onSelectSubject={handleSelectSubject}
          onSelectMode={handleSelectMode}
          onOpenSyncModal={() => setIsSyncOpen(true)}
        />

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
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
              {mode === 'exam' && (
                <MockExamView
                  subject={subject}
                  progress={store}
                  onSaveExamResult={handleSaveExamResult}
                  onRecordAttempt={handleRecordAttempt}
                  onToggleFlag={handleToggleFlag}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="border-t border-sky-100/80 bg-white/60 py-4 text-center text-xs text-slate-500">
          Ôn thi trắc nghiệm MLN131 &amp; VNR202 • Tiến độ tự động lưu trên trình duyệt
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
