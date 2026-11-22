import React, { lazy, startTransition, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { Header } from './components/Header';
import { setBorderFirePaused } from './components/SakugaBorderFire';
import {
  getCachedSubjectData,
  getEffectiveTier,
  loadSubjectData,
  SubjectLoadedBundle,
} from './data/index';
import { ExamHistoryItem, StudyMode, StudyTier, SubjectId, UserProgressStore } from './types/quiz';
import {
  addExamHistory,
  loadStore,
  loadTheme,
  markQuestionsFlagged,
  markQuestionStudied,
  recordQuestionAttempt,
  recordQuestionAttemptsBatch,
  resetProgress,
  saveStore,
  saveTheme,
  ThemeMode,
  toggleQuestionFlag,
  toggleQuestionMastered,
} from './utils/storage';

const ChapterStudyView = lazy(() => import('./components/ChapterStudyView'));
const RollingStudyView = lazy(() => import('./components/RollingStudyView'));
const FlashcardView = lazy(() => import('./components/FlashcardView'));
const MockExamView = lazy(() => import('./components/MockExamView'));
const ProgressSyncModal = lazy(() => import('./components/ProgressSyncModal'));
const WelcomeNoteModal = lazy(() => import('./components/WelcomeNoteModal'));
const SakugaSumieIntro = lazy(() => import('./components/SakugaSumieIntro'));
const SakugaSpideyRoamer = lazy(() => import('./components/SakugaSpideyRoamer'));
const SakugaLuminousButterfly = lazy(() => import('./components/SakugaLuminousButterfly'));
const SakugaOrigamiPetals = lazy(() => import('./components/SakugaOrigamiPetals'));

const INTRO_SESSION_KEY = 'lastfe_intro_played_v1';
const WELCOME_SEEN_KEY = 'fpt_exam_nam_note_seen_v1';

type IntroStage = 'active' | 'revealing' | 'done';

function shouldPlayIntroOnMount(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return false;
  }
  try {
    return sessionStorage.getItem(INTRO_SESSION_KEY) !== '1';
  } catch {
    return true;
  }
}

function shouldShowWelcomeOnMount(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(WELCOME_SEEN_KEY) !== '1';
  } catch {
    return true;
  }
}

const StudyViewSkeleton: React.FC = () => (
  <div className="flex w-full flex-col items-start gap-6 lg:flex-row lg:gap-8 xl:gap-10">
    <div className="hidden w-full shrink-0 rounded-2xl border border-[#D5CFC2] bg-[#EAE6DD] p-4 dark:border-[#262925] dark:bg-[#161816] lg:block lg:w-[360px] xl:w-[380px]">
      <div className="h-9 w-full animate-pulse rounded-xl bg-[#D5CFC2]/60 dark:bg-[#252A26]" />
      <div className="mt-4 space-y-3">
        <div className="h-24 w-full animate-pulse rounded-xl bg-[#FAF9F5] dark:bg-[#1C1F1C]" />
        <div className="h-24 w-full animate-pulse rounded-xl bg-[#FAF9F5] dark:bg-[#1C1F1C]" />
      </div>
    </div>
    <div className="w-full min-w-0 flex-1 rounded-3xl border-2 border-[#27272A]/45 bg-white p-6 shadow-[4px_4px_0_0_#C7D2FE] dark:border-[#52525B]/60 dark:bg-[#1E221F] dark:shadow-[4px_4px_0_0_#312E81]">
      <div className="h-8 w-44 animate-pulse rounded-lg bg-[#EAE6DD] dark:bg-[#252A26]" />
      <div className="mt-5 h-24 w-full animate-pulse rounded-2xl bg-[#FAF8F3] dark:bg-[#161917]" />
      <div className="mt-5 space-y-3">
        <div className="h-14 w-full animate-pulse rounded-xl bg-[#F8F6F0] dark:bg-[#252A26]" />
        <div className="h-14 w-full animate-pulse rounded-xl bg-[#F8F6F0] dark:bg-[#252A26]" />
        <div className="h-14 w-full animate-pulse rounded-xl bg-[#F8F6F0] dark:bg-[#252A26]" />
      </div>
    </div>
  </div>
);

export const App: React.FC = () => {
  const [store, setStore] = useState<UserProgressStore>(() => loadStore());
  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme());
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [hasOpenedSync, setHasOpenedSync] = useState(false);
  const [shouldShowWelcome, setShouldShowWelcome] = useState<boolean>(() =>
    shouldShowWelcomeOnMount()
  );
  const [introStage, setIntroStage] = useState<IntroStage>(() =>
    shouldPlayIntroOnMount() ? 'active' : 'done'
  );
  const [ambientEffectsReady, setAmbientEffectsReady] = useState(false);

  const { lastSubject: subject, lastMode: mode, lastTier: rawTier = 'hardcore' } = store;
  const tier = getEffectiveTier(subject, rawTier);

  const [subjectData, setSubjectData] = useState<SubjectLoadedBundle | null>(() =>
    getCachedSubjectData(store.lastSubject)
  );

  const headerLogoRef = useRef<HTMLSpanElement>(null);
  const latestStoreRef = useRef<UserProgressStore>(store);
  latestStoreRef.current = store;
  const isFirstStoreRenderRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    const cached = getCachedSubjectData(subject);
    if (cached) {
      setSubjectData(cached);
      return;
    }
    loadSubjectData(subject).then((loaded) => {
      if (!cancelled) {
        startTransition(() => setSubjectData(loaded));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [subject]);

  useEffect(() => {
    setBorderFirePaused(introStage === 'active');
    return () => {
      setBorderFirePaused(false);
    };
  }, [introStage]);

  // Defer ambient butterfly/petal chunk load until after initial render (their timers start at 25s / 75s)
  useEffect(() => {
    if (introStage !== 'done' || mode === 'exam') return;
    const timer = window.setTimeout(() => {
      setAmbientEffectsReady(true);
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [introStage, mode]);

  // Debounced localStorage persistence (skips initial mount writeback, flushes on tab hide/close)
  useEffect(() => {
    if (isFirstStoreRenderRef.current) {
      isFirstStoreRenderRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      saveStore(latestStoreRef.current);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [store]);

  useEffect(() => {
    const flushStore = () => saveStore(latestStoreRef.current);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushStore();
      }
    };
    window.addEventListener('pagehide', flushStore);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', flushStore);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      flushStore();
    };
  }, []);

  useEffect(() => {
    saveTheme(theme);
  }, [theme]);

  const handleIntroBeginReveal = useCallback(() => {
    setIntroStage((prev) => (prev === 'active' ? 'revealing' : prev));
  }, []);

  const handleIntroComplete = useCallback(() => {
    try {
      sessionStorage.setItem(INTRO_SESSION_KEY, '1');
    } catch {
      // Ignore storage restrictions in private browsing
    }
    setIntroStage('done');
  }, []);

  const handleDismissWelcome = useCallback(() => {
    setShouldShowWelcome(false);
  }, []);

  const handleOpenSyncModal = useCallback(() => {
    setHasOpenedSync(true);
    setIsSyncOpen(true);
  }, []);

  const handleCloseSyncModal = useCallback(() => {
    setIsSyncOpen(false);
  }, []);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const handleSelectSubject = useCallback((nextSubject: SubjectId) => {
    setStore((prev) => ({ ...prev, lastSubject: nextSubject }));
  }, []);

  const handleSelectMode = useCallback((nextMode: StudyMode) => {
    setStore((prev) => ({ ...prev, lastMode: nextMode }));
  }, []);

  const handleSelectTier = useCallback((nextTier: StudyTier) => {
    setStore((prev) => ({ ...prev, lastTier: nextTier }));
  }, []);

  const handleRecordAttempt = useCallback(
    (qId: string, isCorrect: boolean, flagged?: boolean) => {
      setStore((prev) => recordQuestionAttempt(prev, qId, isCorrect, flagged));
    },
    []
  );

  const handleRecordAttemptsBatch = useCallback(
    (attempts: readonly { questionId: string; isCorrect: boolean }[]) => {
      setStore((prev) => recordQuestionAttemptsBatch(prev, attempts));
    },
    []
  );

  const handleToggleFlag = useCallback((qId: string) => {
    setStore((prev) => toggleQuestionFlag(prev, qId));
  }, []);

  const handleFlagQuestions = useCallback((qIds: string[]) => {
    setStore((prev) => markQuestionsFlagged(prev, qIds));
  }, []);

  const handleMarkStudied = useCallback((qId: string) => {
    setStore((prev) => markQuestionStudied(prev, qId));
  }, []);

  const handleToggleMastered = useCallback((qId: string) => {
    setStore((prev) => toggleQuestionMastered(prev, qId));
  }, []);

  const handleResetStage = useCallback((questionIds: string[]) => {
    setStore((prev) => resetProgress(prev, questionIds));
  }, []);

  const handleSaveExamResult = useCallback((result: ExamHistoryItem) => {
    setStore((prev) => addExamHistory(prev, result));
  }, []);

  const handleImportProgress = useCallback((nextStore: UserProgressStore) => {
    setStore(nextStore);
  }, []);

  const handleResetAllProgress = useCallback(() => {
    setStore((prev) => resetProgress(prev));
  }, []);

  const isWebVisible = introStage !== 'active';
  const activeBundle = subjectData && subjectData.subject === subject ? subjectData : null;

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen flex flex-col">
        <Header
          subject={subject}
          mode={mode}
          tier={tier}
          theme={theme}
          progress={store}
          onSelectSubject={handleSelectSubject}
          onSelectMode={handleSelectMode}
          onSelectTier={handleSelectTier}
          onToggleTheme={handleToggleTheme}
          onOpenSyncModal={handleOpenSyncModal}
          logoRef={headerLogoRef}
          hideLogoMark={introStage !== 'done'}
          isRevealed={isWebVisible}
        />

        <main
          className={`mx-auto w-full max-w-[1720px] flex-1 px-4 py-4 pb-24 transition-opacity duration-500 ease-out sm:px-6 md:py-7 md:pb-8 lg:px-10 xl:px-12 ${
            isWebVisible ? 'opacity-100 delay-100' : 'pointer-events-none opacity-0'
          }`}
        >
          {!activeBundle ? (
            <StudyViewSkeleton />
          ) : (
            <Suspense fallback={<StudyViewSkeleton />}>
              {mode === 'chapter' && (
                <ChapterStudyView
                  subject={subject}
                  tier={tier}
                  questions={activeBundle.questionsByTier[tier]}
                  chapters={activeBundle.chaptersByTier[tier]}
                  progress={store}
                  onRecordAttempt={handleRecordAttempt}
                  onToggleFlag={handleToggleFlag}
                />
              )}
              {mode === 'rolling' && (
                <RollingStudyView
                  subject={subject}
                  tier={tier}
                  questions={activeBundle.questionsByTier[tier]}
                  chapters={activeBundle.chaptersByTier[tier]}
                  progress={store}
                  onRecordAttempt={handleRecordAttempt}
                  onToggleFlag={handleToggleFlag}
                  onResetStage={handleResetStage}
                />
              )}
              {mode === 'flashcard' && (
                <FlashcardView
                  subject={subject}
                  tier={tier}
                  questions={activeBundle.questionsByTier[tier]}
                  chapters={activeBundle.chaptersByTier[tier]}
                  progress={store}
                  onMarkStudied={handleMarkStudied}
                  onToggleMastered={handleToggleMastered}
                  onToggleFlag={handleToggleFlag}
                />
              )}
              {mode === 'exam' && (
                <MockExamView
                  subject={subject}
                  questions={activeBundle.questionsByTier.hardcore}
                  chapters={activeBundle.chaptersByTier.hardcore}
                  progress={store}
                  onSaveExamResult={handleSaveExamResult}
                  onRecordAttempt={handleRecordAttempt}
                  onRecordAttemptsBatch={handleRecordAttemptsBatch}
                  onToggleFlag={handleToggleFlag}
                  onFlagQuestions={handleFlagQuestions}
                />
              )}
            </Suspense>
          )}
        </main>

        <footer
          className={`mt-6 border-t border-[#D5CFC2] bg-[#EAE6DD] py-5 pb-24 text-xs text-[#656058] transition-opacity duration-500 ease-out dark:border-[#262925] dark:bg-[#161816] dark:text-[#9CA39B] md:mt-12 md:py-6 md:pb-6 ${
            isWebVisible ? 'opacity-100 delay-150' : 'pointer-events-none opacity-0'
          }`}
        >
          <div className="mx-auto flex w-full max-w-[1720px] flex-wrap items-center justify-between gap-2 px-4 sm:px-6 lg:px-10 xl:px-12">
            <span>Web ôn thi FE</span>
            <span className="inline-flex items-center rounded-full border border-[#A5B4FC] bg-[#EEF2FF] px-2.5 py-0.5 text-xs font-semibold text-[#3730A3] dark:border-[#818CF8]/50 dark:bg-[#312E81]/30 dark:text-[#A5B4FC]">
              from Namblee
            </span>
          </div>
        </footer>

        {hasOpenedSync && (
          <Suspense fallback={null}>
            <ProgressSyncModal
              isOpen={isSyncOpen}
              progress={store}
              onClose={handleCloseSyncModal}
              onImportProgress={handleImportProgress}
              onResetAllProgress={handleResetAllProgress}
            />
          </Suspense>
        )}

        {introStage === 'done' && shouldShowWelcome && (
          <Suspense fallback={null}>
            <WelcomeNoteModal enabled onDismiss={handleDismissWelcome} />
          </Suspense>
        )}

        {introStage === 'done' && mode !== 'exam' && (
          <Suspense fallback={null}>
            <SakugaSpideyRoamer mode={mode} />
            {ambientEffectsReady && (
              <>
                <SakugaLuminousButterfly mode={mode} />
                <SakugaOrigamiPetals mode={mode} />
              </>
            )}
          </Suspense>
        )}

        {introStage !== 'done' && (
          <Suspense fallback={null}>
            <SakugaSumieIntro
              targetLogoRef={headerLogoRef}
              onBeginReveal={handleIntroBeginReveal}
              onComplete={handleIntroComplete}
            />
          </Suspense>
        )}
      </div>
    </MotionConfig>
  );
};

export default App;
