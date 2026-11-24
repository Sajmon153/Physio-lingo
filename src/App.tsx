import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  resolveBestRegionalKeyForStructure,
  type ViewportModelMode,
} from './components/AnatomyViewport3D';
import type { ExplorerJumpTarget } from './components/Explorer3DView';
import type { PinHubMode } from './components/PinExam3DView';
import { AtlasDictionary } from './components/AtlasDictionary';
import { HeartsModal } from './components/HeartsModal';
import { AppView, NavigationBar } from './components/NavigationBar';
import { SkillTree } from './components/SkillTree';
import { TopBar } from './components/TopBar';

const AccountModal = lazy(() =>
  import('./components/AccountModal').then((m) => ({ default: m.AccountModal })),
);
import { authService } from './services/authService';
import type {
  AccountSyncStatus,
  AuthBackendKind,
  ChangePasswordInput,
  LoginAccountInput,
  RegisterAccountInput,
  UserAccountPublic,
} from './types/auth';

const Explorer3DView = lazy(() =>
  import('./components/Explorer3DView').then((m) => ({ default: m.Explorer3DView })),
);
const PinExam3DView = lazy(() =>
  import('./components/PinExam3DView').then((m) => ({ default: m.PinExam3DView })),
);
const PatientSimulator3DView = lazy(() =>
  import('./components/PatientSimulator3DView').then((m) => ({
    default: m.PatientSimulator3DView,
  })),
);
const LessonPlayer = lazy(() =>
  import('./components/LessonPlayer').then((m) => ({ default: m.LessonPlayer })),
);
import { ANATOMY_MAP } from './data/anatomyDb';
import { CLINICAL_TEST_MAP, type ClinicalTestEntry } from './data/clinicalTestsDb';
import {
  AnatomicalStructure,
  DeviceViewMode,
  LessonNode,
  LessonSummaryResult,
  LessonTask,
  PatientCaseHistoryEntry,
  PinExamHistoryEntry,
  SrsCardState,
  UserProgress,
} from './types/anatomy';
import {
  applyAnswerOutcome,
  buildHeartRecoveryTasks,
  buildLessonTasks,
  completeLessonProgress,
  getAllLessonsOrdered,
  getNextUnlockedLessonTitle,
  loadProgress,
  restoreHeartsProgress,
  saveProgress,
} from './utils/gameLogic';
import { isStandalonePwaMode } from './services/pwaOfflineService';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function App() {
  const [progress, setProgress] = useState<UserProgress>(() => loadProgress());
  const [authUser, setAuthUser] = useState<UserAccountPublic | null>(null);
  const [authBackend, setAuthBackend] = useState<AuthBackendKind>('server');
  const [syncStatus, setSyncStatus] = useState<AccountSyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountModalInitialTab, setAccountModalInitialTab] = useState<'account' | 'stats' | 'offline'>('account');
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isPwaInstalled, setIsPwaInstalled] = useState<boolean>(() => isStandalonePwaMode());
  const skipNextAccountSyncRef = useRef(false);
  const syncTimerRef = useRef<number | null>(null);
  const latestProgressRef = useRef(progress);
  latestProgressRef.current = progress;

  const [activeView, setActiveView] = useState<AppView>('tree');
  const [explorerRegion, setExplorerRegion] = useState<ViewportModelMode>('shoulder');
  const [explorerJumpTarget, setExplorerJumpTarget] = useState<ExplorerJumpTarget | null>(null);
  const [pinExamInitialMode] = useState<PinHubMode>('locate');
  const [pinExamModeRequestId] = useState(0);
  const jumpCounterRef = useRef(1);

  const [activeSession, setActiveSession] = useState<{
    mode: 'lesson' | 'recovery' | 'review';
    lesson: LessonNode | null;
    tasks: LessonTask[];
  } | null>(null);

  const [showHeartsModal, setShowHeartsModal] = useState(false);

  // Hydrate authenticated session on mount (Express API primary, browser-local fallback)
  useEffect(() => {
    let cancelled = false;
    authService
      .getCurrentSession()
      .then((session) => {
        if (cancelled) return;
        setAuthBackend(session.backend);
        if (session.user && session.progress) {
          skipNextAccountSyncRef.current = true;
          setAuthUser(session.user);
          setProgress(session.progress);
          setSyncStatus('synced');
          setLastSyncedAt(session.user.updatedAt);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuthBackend(authService.backendKind);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Track browser online/offline state and PWA install prompt availability
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleBeforeInstall = (ev: Event) => {
      ev.preventDefault();
      setDeferredInstallPrompt(ev as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setIsPwaInstalled(true);
      setDeferredInstallPrompt(null);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleOpenAccountModal = useCallback((tab: 'account' | 'stats' | 'offline' = 'account') => {
    setAccountModalInitialTab(tab);
    setShowAccountModal(true);
  }, []);

  const handleTriggerInstallPwa = useCallback(async () => {
    if (!deferredInstallPrompt) return;
    try {
      await deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsPwaInstalled(true);
      }
      setDeferredInstallPrompt(null);
    } catch {
      // Ignore user cancellation
    }
  }, [deferredInstallPrompt]);

  // Sync dark mode class, UI scale font-size on <html>, and persist progress (Guest -> localStorage, Account -> server/local store)
  useEffect(() => {
    const root = document.documentElement;
    if (progress.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    const scalePct = progress.uiScale ?? 100;
    root.style.fontSize = `${scalePct}%`;

    if (!authUser) {
      saveProgress(progress);
      return;
    }

    if (skipNextAccountSyncRef.current) {
      skipNextAccountSyncRef.current = false;
      return;
    }

    setSyncStatus('syncing');
    if (syncTimerRef.current !== null) {
      window.clearTimeout(syncTimerRef.current);
    }
    syncTimerRef.current = window.setTimeout(() => {
      syncTimerRef.current = null;
      authService
        .saveUserProgress(latestProgressRef.current)
        .then((res) => {
          setSyncStatus(res.ok ? 'synced' : 'offline');
          if (res.ok) setLastSyncedAt(res.updatedAt);
        })
        .catch(() => {
          setSyncStatus('error');
        });
    }, 350);

    return () => {
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
  }, [progress, authUser]);

  const totalLessons = getAllLessonsOrdered().length;

  const handleToggleTheme = useCallback(() => {
    setProgress((prev) => ({
      ...prev,
      theme: prev.theme === 'dark' ? 'light' : 'dark',
    }));
  }, []);

  const handleToggleStudyMode = useCallback(() => {
    setProgress((prev) => ({
      ...prev,
      studyMode: prev.studyMode === 'free' ? 'course' : 'free',
    }));
  }, []);

  const handleChangeDeviceMode = useCallback((deviceMode: DeviceViewMode) => {
    setProgress((prev) => ({
      ...prev,
      deviceMode,
    }));
  }, []);

  const handleChangeUiScale = useCallback((uiScale: number) => {
    const clamped = Math.max(85, Math.min(115, Math.round(uiScale)));
    setProgress((prev) => ({
      ...prev,
      uiScale: clamped,
    }));
  }, []);

  const handleImportProgress = useCallback((nextProgress: UserProgress) => {
    setProgress(nextProgress);
  }, []);

  const handleLogin = useCallback(async (input: LoginAccountInput) => {
    const res = await authService.login(input);
    skipNextAccountSyncRef.current = true;
    setAuthBackend(res.backend);
    setAuthUser(res.user);
    setProgress(res.progress);
    setSyncStatus('synced');
    setLastSyncedAt(res.user.updatedAt);
  }, []);

  const handleRegister = useCallback(async (input: RegisterAccountInput) => {
    const res = await authService.register(input);
    skipNextAccountSyncRef.current = true;
    setAuthBackend(res.backend);
    setAuthUser(res.user);
    setProgress(res.progress);
    setSyncStatus('synced');
    setLastSyncedAt(res.user.updatedAt);
  }, []);

  const handleLogout = useCallback(async () => {
    // Flush any pending account progress save before ending the session
    if (authUser) {
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      try {
        await authService.saveUserProgress(latestProgressRef.current);
      } catch {
        // Best-effort flush before logout
      }
    }
    await authService.logout();
    setAuthUser(null);
    setSyncStatus('idle');
    setLastSyncedAt(null);
    setProgress(loadProgress());
  }, [authUser]);

  const handleChangePassword = useCallback(async (input: ChangePasswordInput) => {
    await authService.changePassword(input);
  }, []);

  const handleDeleteAccount = useCallback(async (currentPassword: string) => {
    await authService.deleteAccount(currentPassword);
    setAuthUser(null);
    setSyncStatus('idle');
    setLastSyncedAt(null);
    setProgress(loadProgress());
  }, []);

  const handleReviewSrsCard = useCallback(
    (cardId: string, nextState: SrsCardState, xpGain: number) => {
      setProgress((prev) => ({
        ...prev,
        xp: prev.xp + xpGain,
        srsProgress: {
          ...(prev.srsProgress ?? {}),
          [cardId]: nextState,
        },
      }));
    },
    [],
  );

  const handleCompletePinExamHistory = useCallback((entry: PinExamHistoryEntry) => {
    setProgress((prev) => ({
      ...prev,
      pinExamHistory: [entry, ...(prev.pinExamHistory ?? [])].slice(0, 15),
    }));
  }, []);

  const handleStartLesson = (lesson: LessonNode) => {
    if (progress.studyMode !== 'free' && progress.hearts <= 0) {
      setShowHeartsModal(true);
      return;
    }
    const tasks = buildLessonTasks(lesson.id);
    setActiveSession({
      mode: 'lesson',
      lesson,
      tasks,
    });
  };

  const handleStartRecoveryQuiz = () => {
    const tasks = buildHeartRecoveryTasks(progress.mistakeStats);
    setShowHeartsModal(false);
    setActiveSession({
      mode: 'recovery',
      lesson: null,
      tasks,
    });
  };

  const handleStartMistakeReview = useCallback(() => {
    const tasks = buildHeartRecoveryTasks(progress.mistakeStats);
    if (tasks.length === 0) return;
    setActiveSession({
      mode: 'review',
      lesson: null,
      tasks,
    });
  }, [progress.mistakeStats]);

  const handleOpenStructureIn3D = useCallback((structure: AnatomicalStructure) => {
    const targetRegion = resolveBestRegionalKeyForStructure(structure.id, structure.region);
    setExplorerRegion(targetRegion);
    setExplorerJumpTarget({
      region: targetRegion,
      structureId: structure.id,
      isolateIfMuscle: structure.category === 'muscle',
      requestId: ++jumpCounterRef.current,
    });
    setActiveView('explorer');
  }, []);

  const handleOpenCustomTargetIn3D = useCallback(
    (target: {
      region: ViewportModelMode;
      structureId?: string;
      landmarkId?: string;
      isolateIfMuscle?: boolean;
    }) => {
      setExplorerRegion(target.region);
      setExplorerJumpTarget({
        ...target,
        requestId: ++jumpCounterRef.current,
      });
      setActiveView('explorer');
    },
    [],
  );

  const handleVisualizeClinicalTestIn3D = useCallback((test: ClinicalTestEntry) => {
    const targetRegion: ViewportModelMode =
      test.id === 'test_lasegue_slump' ||
      test.id === 'test_bragard' ||
      test.id === 'test_adson_wright_tos'
        ? 'full_body'
        : test.region === 'shoulder' || test.region === 'upper_limb'
          ? 'upper_limb_right'
          : test.region === 'knee' || test.region === 'lower_limb' || test.region === 'pelvis_hip'
            ? 'lower_limb_right'
            : test.region === 'head_neck'
              ? 'head_neck'
              : 'torso';
    setExplorerRegion(targetRegion);
    setExplorerJumpTarget({
      region: targetRegion,
      clinicalTestId: test.id,
      requestId: ++jumpCounterRef.current,
    });
    setActiveView('explorer');
  }, []);

  const handleCompletePatientCase = useCallback((entry: PatientCaseHistoryEntry) => {
    setProgress((prev) => ({
      ...prev,
      xp: prev.xp + entry.xpEarned,
      patientCaseHistory: [entry, ...(prev.patientCaseHistory ?? [])].slice(0, 30),
    }));
  }, []);

  const handleRecordCaseMistake = useCallback((structureId: string) => {
    setProgress((prev) => {
      const prevMistake = prev.mistakeStats[structureId];
      return {
        ...prev,
        mistakeStats: {
          ...prev.mistakeStats,
          [structureId]: {
            wrongCount: (prevMistake?.wrongCount ?? 0) + 1,
            lastMissedAt: new Date().toISOString(),
          },
        },
      };
    });
  }, []);

  const handlePinExamOutcome = useCallback(
    (isCorrect: boolean, structureId: string, xpGain: number) => {
      setProgress((prev) => {
        if (isCorrect) {
          return {
            ...prev,
            xp: prev.xp + xpGain,
          };
        }
        const prevMistake = prev.mistakeStats[structureId];
        return {
          ...prev,
          mistakeStats: {
            ...prev.mistakeStats,
            [structureId]: {
              wrongCount: (prevMistake?.wrongCount ?? 0) + 1,
              lastMissedAt: new Date().toISOString(),
            },
          },
        };
      });
    },
    [],
  );

  const handleRefillHearts = () => {
    setProgress((prev) => restoreHeartsProgress(prev, prev.maxHearts));
    setShowHeartsModal(false);
  };

  const handleAnswerOutcome = (isCorrect: boolean, structureId: string) => {
    setProgress((prev) => applyAnswerOutcome(prev, isCorrect, structureId, 10));
  };

  const handleCompleteLesson = (result: {
    xpEarned: number;
    accuracy: number;
    correctCount: number;
    totalCount: number;
    durationSeconds: number;
  }): LessonSummaryResult => {
    const lesson = activeSession?.lesson;
    if (!lesson) {
      return {
        lessonId: 'unknown',
        lessonTitle: 'Lekcja',
        xpEarned: result.xpEarned,
        accuracy: result.accuracy,
        correctCount: result.correctCount,
        totalCount: result.totalCount,
        durationSeconds: result.durationSeconds,
        streakIncremented: false,
        newlyUnlockedLessonTitle: null,
      };
    }

    const bonusXp = lesson.xpReward;
    const { nextProgress, streakIncremented } = completeLessonProgress(
      progress,
      lesson.id,
      result.accuracy,
      bonusXp,
    );
    setProgress(nextProgress);

    const newlyUnlocked = getNextUnlockedLessonTitle(nextProgress.completedLessonIds);

    return {
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      xpEarned: result.xpEarned,
      accuracy: result.accuracy,
      correctCount: result.correctCount,
      totalCount: result.totalCount,
      durationSeconds: result.durationSeconds,
      streakIncremented,
      newlyUnlockedLessonTitle: newlyUnlocked,
    };
  };

  const handleCompleteRecovery = (correctCount: number) => {
    const restoreAmount = Math.max(2, correctCount + 2);
    setProgress((prev) => restoreHeartsProgress(prev, restoreAmount));
  };

  const handleChangeView = useCallback((nextView: AppView) => {
    setActiveView(nextView);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const isDarkMode = progress.theme === 'dark';

  // Full-screen focus mode while inside an active lesson or heart recovery quiz
  if (activeSession) {
    return (
      <div className="min-h-screen bg-[#f4faf6] text-emerald-950 dark:bg-[#0b1510] dark:text-emerald-50">
        <Suspense
          fallback={
            <div className="flex min-h-[60vh] items-center justify-center text-sm font-bold text-[#52695b] dark:text-[#94b0a0]">
              Ładowanie lekcji...
            </div>
          }
        >
          <LessonPlayer
            mode={activeSession.mode}
            lesson={activeSession.lesson}
            tasks={activeSession.tasks}
            hearts={progress.hearts}
            maxHearts={progress.maxHearts}
            studyMode={progress.studyMode}
            isDarkMode={isDarkMode}
            onAnswerOutcome={handleAnswerOutcome}
            onCompleteLesson={handleCompleteLesson}
            onCompleteRecovery={handleCompleteRecovery}
            onOpenHeartsModal={() => setShowHeartsModal(true)}
            onExit={() => setActiveSession(null)}
          />
        </Suspense>

        {showHeartsModal && (
          <HeartsModal
            hearts={progress.hearts}
            maxHearts={progress.maxHearts}
            onStartRecoveryQuiz={handleStartRecoveryQuiz}
            onRefillHearts={handleRefillHearts}
            onClose={() => setShowHeartsModal(false)}
          />
        )}
      </div>
    );
  }

  const deviceMode: DeviceViewMode = progress.deviceMode ?? 'auto';
  const isPhoneFrame = deviceMode === 'phone';
  const isIpadFrame = deviceMode === 'ipad';

  return (
    <div
      data-device-mode={deviceMode}
      className={
        isPhoneFrame || isIpadFrame
          ? 'min-h-screen overflow-x-clip bg-[#e5f2ea] dark:bg-[#060c09]'
          : 'min-h-screen overflow-x-clip bg-[#f4faf6] dark:bg-[#0b1510]'
      }
    >
      <div
        className={`flex min-h-screen bg-[#f4faf6] text-emerald-950 dark:bg-[#0b1510] dark:text-emerald-50 ${
          isPhoneFrame
            ? 'mx-auto w-full max-w-[430px] flex-col shadow-2xl ring-1 ring-[#c2d8ca] dark:ring-[#233d2f]'
            : isIpadFrame
              ? 'mx-auto w-full max-w-[860px] shadow-2xl ring-1 ring-[#c2d8ca] dark:ring-[#233d2f]'
              : ''
        }`}
      >
        {!isPhoneFrame && (
          <NavigationBar
            activeView={activeView}
            onChangeView={handleChangeView}
            completedCount={progress.completedLessonIds.length}
            totalLessons={totalLessons}
            deviceMode={deviceMode}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            progress={progress}
            authUser={authUser}
            syncStatus={syncStatus}
            isOnline={isOnline}
            canInstallPwa={Boolean(deferredInstallPrompt && !isPwaInstalled)}
            onTriggerInstallPwa={handleTriggerInstallPwa}
            onOpenOfflineManager={() => handleOpenAccountModal('offline')}
            onOpenAccountModal={() => handleOpenAccountModal('account')}
            onToggleTheme={handleToggleTheme}
            onToggleStudyMode={handleToggleStudyMode}
            onChangeDeviceMode={handleChangeDeviceMode}
            onChangeUiScale={handleChangeUiScale}
            onOpenHeartsModal={() => setShowHeartsModal(true)}
          />

          <main
            className={`min-w-0 flex-1 ${
              isPhoneFrame ? 'px-3 py-4 pb-24' : 'px-3 py-4 pb-24 sm:px-6 sm:py-6 lg:px-8 lg:pb-8'
            }`}
          >
            {activeView === 'tree' && (
              <SkillTree
                progress={progress}
                onStartLesson={handleStartLesson}
                onOpenExplorerForRegion={(sectionId) => {
                  setExplorerJumpTarget(null);
                  const mapped: ViewportModelMode =
                    sectionId === 'visceral'
                      ? 'torso'
                      : sectionId === 'vascular' ||
                          sectionId === 'nervous' ||
                          sectionId === 'connective'
                        ? 'full_body'
                        : sectionId;
                  setExplorerRegion(mapped);
                  setActiveView('explorer');
                }}
                onInspectStructureIn3D={handleOpenStructureIn3D}
                onStartMistakeReview={handleStartMistakeReview}
              />
            )}

            {activeView === 'explorer' && (
              <Suspense
                fallback={
                  <div className="flex min-h-[420px] items-center justify-center rounded-2xl border-2 border-[#d6e7dc] bg-white text-sm font-bold text-[#52695b] dark:border-[#233d2f] dark:bg-[#112018] dark:text-[#c7dbcf]">
                    Inicjalizacja silnika anatomii 3D...
                  </div>
                }
              >
                <Explorer3DView
                  initialRegion={explorerRegion}
                  initialTarget={explorerJumpTarget}
                  isDarkMode={isDarkMode}
                  deviceMode={deviceMode}
                />
              </Suspense>
            )}

            {activeView === 'pin_exam' && (
              <Suspense
                fallback={
                  <div className="flex min-h-[420px] items-center justify-center rounded-2xl border-2 border-[#d6e7dc] bg-white text-sm font-bold text-[#52695b] dark:border-[#233d2f] dark:bg-[#112018] dark:text-[#c7dbcf]">
                    Ładowanie egzaminu praktycznego Szpilki 3D...
                  </div>
                }
              >
                <PinExam3DView
                  isDarkMode={isDarkMode}
                  initialMode={pinExamInitialMode}
                  initialModeRequestId={pinExamModeRequestId}
                  srsProgress={progress.srsProgress ?? {}}
                  onRecordOutcome={handlePinExamOutcome}
                  onCompleteExamHistory={handleCompletePinExamHistory}
                  onReviewSrsCard={handleReviewSrsCard}
                  onShowIn3D={handleOpenCustomTargetIn3D}
                />
              </Suspense>
            )}

            {activeView === 'cases' && (
              <Suspense
                fallback={
                  <div className="flex min-h-[420px] items-center justify-center rounded-2xl border-2 border-[#d6e7dc] bg-white text-sm font-bold text-[#52695b] dark:border-[#233d2f] dark:bg-[#112018] dark:text-[#c7dbcf]">
                    Ładowanie Symulatora Pacjenta 3D...
                  </div>
                }
              >
                <PatientSimulator3DView
                  isDarkMode={isDarkMode}
                  caseHistory={progress.patientCaseHistory ?? []}
                  onCompleteCase={handleCompletePatientCase}
                  onRecordStructureMistake={handleRecordCaseMistake}
                  onVisualizeTestIn3D={(testId) => {
                    const testObj = CLINICAL_TEST_MAP[testId];
                    if (testObj) handleVisualizeClinicalTestIn3D(testObj);
                  }}
                  onInspectStructureIn3D={(structureId) => {
                    const st = ANATOMY_MAP[structureId];
                    if (st) handleOpenStructureIn3D(st);
                  }}
                />
              </Suspense>
            )}

            {activeView === 'atlas' && (
              <AtlasDictionary
                mistakeStats={progress.mistakeStats}
                onShowIn3D={handleOpenStructureIn3D}
                onVisualizeClinicalTest={handleVisualizeClinicalTestIn3D}
                deviceMode={deviceMode}
              />
            )}
          </main>

          {isPhoneFrame && (
            <NavigationBar
              activeView={activeView}
              onChangeView={handleChangeView}
              completedCount={progress.completedLessonIds.length}
              totalLessons={totalLessons}
              deviceMode={deviceMode}
            />
          )}
        </div>
      </div>

      {showHeartsModal && (
        <HeartsModal
          hearts={progress.hearts}
          maxHearts={progress.maxHearts}
          onStartRecoveryQuiz={handleStartRecoveryQuiz}
          onRefillHearts={handleRefillHearts}
          onClose={() => setShowHeartsModal(false)}
        />
      )}

      {showAccountModal && (
        <Suspense fallback={null}>
          <AccountModal
            isOpen={showAccountModal}
            initialTab={accountModalInitialTab}
            isOnline={isOnline}
            canInstallPwa={Boolean(deferredInstallPrompt && !isPwaInstalled)}
            isPwaInstalled={isPwaInstalled}
            onTriggerInstallPwa={handleTriggerInstallPwa}
            onClose={() => setShowAccountModal(false)}
            user={authUser}
            backend={authBackend}
            syncStatus={syncStatus}
            lastSyncedAt={lastSyncedAt}
            progress={progress}
            onLogin={handleLogin}
            onRegister={handleRegister}
            onLogout={handleLogout}
            onChangePassword={handleChangePassword}
            onDeleteAccount={handleDeleteAccount}
            onImportProgress={handleImportProgress}
            onInspectStructureIn3D={handleOpenStructureIn3D}
          />
        </Suspense>
      )}
    </div>
  );
}
