import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  Flame,
  Heart,
  Sparkles,
  Stethoscope,
  Target,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { ANATOMY_MAP } from '../data/anatomyDb';
import {
  AnatomicalLayerId,
  LessonNode,
  LessonSummaryResult,
  LessonTask,
  MatchingPairsTask,
  StudyMode,
} from '../types/anatomy';
import {
  isTypingAnswerCorrect,
  normalizeAnatomyAnswer,
  shuffleArray,
} from '../utils/gameLogic';
import { formatBilingualName } from '../three/anatomyTranslator';
import {
  resolveBestRegionalKeyForStructure,
  resolveRegionalModelPath,
  type SelectedPartInfo,
  type ViewportModelMode,
} from './AnatomyViewport3D';

const AnatomyViewport3D = lazy(() =>
  import('./AnatomyViewport3D').then((m) => ({ default: m.AnatomyViewport3D })),
);

interface LessonPlayerProps {
  mode: 'lesson' | 'recovery' | 'review';
  lesson: LessonNode | null;
  tasks: LessonTask[];
  hearts: number;
  maxHearts: number;
  studyMode?: StudyMode;
  isDarkMode: boolean;
  onAnswerOutcome: (isCorrect: boolean, structureId: string) => void;
  onCompleteLesson: (result: {
    xpEarned: number;
    accuracy: number;
    correctCount: number;
    totalCount: number;
    durationSeconds: number;
  }) => LessonSummaryResult;
  onCompleteRecovery: (correctCount: number) => void;
  onOpenHeartsModal: () => void;
  onExit: () => void;
}

const MOTIVATIONAL_PHRASES = [
  'Świetna robota!',
  'Doskonale!',
  'Perfekcyjna znajomość anatomii!',
  'Brawo, kliniczne oko!',
  'Bezbłędnie!',
];

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function resolveTaskModelTarget(
  taskRegion: string,
  structureId: string,
): { region: ViewportModelMode; modelUrl: string } {
  const bestKey = resolveBestRegionalKeyForStructure(structureId, taskRegion);
  return {
    region: bestKey,
    modelUrl: resolveRegionalModelPath(bestKey, structureId),
  };
}

function formatSelectedPartLabel(part: SelectedPartInfo): string {
  const en =
    part.nameEn?.trim() ||
    (part.structureId ? ANATOMY_MAP[part.structureId]?.nameEn : undefined);
  if (en) return formatBilingualName(part.namePl, en);
  if (part.bilingualName && part.bilingualName.trim()) return part.bilingualName.trim();
  return part.namePl;
}

export const LessonPlayer: React.FC<LessonPlayerProps> = ({
  mode,
  lesson,
  tasks,
  hearts,
  maxHearts,
  studyMode = 'course',
  isDarkMode,
  onAnswerOutcome,
  onCompleteLesson,
  onCompleteRecovery,
  onOpenHeartsModal,
  onExit,
}) => {
  const isFreeMode = studyMode === 'free';
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalChecks, setTotalChecks] = useState(0);
  const [xpEarnedInSession, setXpEarnedInSession] = useState(0);
  const [summary, setSummary] = useState<LessonSummaryResult | null>(null);
  const [recoveryDone, setRecoveryDone] = useState(false);

  const startedAtRef = useRef<number>(Date.now());
  const matchFlashTimeoutRef = useRef<number | null>(null);

  // Task-specific local interaction states
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [typingInput, setTypingInput] = useState('');
  const [selected3DPart, setSelected3DPart] = useState<SelectedPartInfo | null>(null);

  // Matching Pairs state
  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);
  const [selectedRightId, setSelectedRightId] = useState<string | null>(null);
  const [matchedPairIds, setMatchedPairIds] = useState<string[]>([]);
  const [wrongMatchFlash, setWrongMatchFlash] = useState<{
    left: string;
    right: string;
  } | null>(null);
  const [hadMatchingMistake, setHadMatchingMistake] = useState(false);

  // Bottom sheet feedback state
  const [feedback, setFeedback] = useState<{
    status: 'correct' | 'wrong';
    title: string;
    correctAnswerText?: string;
    detailText: string;
    triviaText?: string;
  } | null>(null);

  const currentTask = tasks[currentIndex] ?? null;

  const regionalModelTarget = useMemo(() => {
    if (!currentTask || currentTask.type !== 'model3d') return null;
    return resolveTaskModelTarget(currentTask.region, currentTask.structureId);
  }, [currentTask]);

  const task3DLayerConfig = useMemo<{
    enableExtended: boolean;
    visibleLayers?: Partial<Record<AnatomicalLayerId, boolean>>;
  }>(() => {
    if (!currentTask || currentTask.type !== 'model3d') {
      return { enableExtended: false };
    }
    const cat = ANATOMY_MAP[currentTask.structureId]?.category;
    if (cat === 'artery' || cat === 'vein') {
      return {
        enableExtended: true,
        visibleLayers: {
          bone: true,
          cartilage: true,
          muscle: false,
          bursa: false,
          tendon: false,
          ligament: false,
          artery: true,
          vein: true,
          nerve: false,
          organ: false,
          skin: false,
        },
      };
    }
    if (cat === 'nerve') {
      return {
        enableExtended: true,
        visibleLayers: {
          bone: true,
          cartilage: true,
          muscle: false,
          bursa: false,
          tendon: false,
          ligament: false,
          artery: false,
          vein: false,
          nerve: true,
          organ: false,
          skin: false,
        },
      };
    }
    if (cat === 'organ') {
      return {
        enableExtended: true,
        visibleLayers: {
          bone: true,
          cartilage: true,
          muscle: false,
          bursa: false,
          tendon: false,
          ligament: false,
          artery: false,
          vein: false,
          nerve: false,
          organ: true,
          skin: false,
        },
      };
    }
    if (cat === 'ligament' || cat === 'bursa' || cat === 'tendon') {
      return {
        enableExtended: true,
        visibleLayers: {
          bone: true,
          cartilage: true,
          muscle: false,
          bursa: true,
          tendon: true,
          ligament: true,
          artery: false,
          vein: false,
          nerve: false,
          organ: false,
          skin: false,
        },
      };
    }
    return { enableExtended: false };
  }, [currentTask]);

  // Reset per-task input and clear pending flash timers when moving to next task
  useEffect(() => {
    if (matchFlashTimeoutRef.current !== null) {
      window.clearTimeout(matchFlashTimeoutRef.current);
      matchFlashTimeoutRef.current = null;
    }
    setSelectedOption(null);
    setTypingInput('');
    setSelected3DPart(null);
    setSelectedLeftId(null);
    setSelectedRightId(null);
    setMatchedPairIds([]);
    setWrongMatchFlash(null);
    setHadMatchingMistake(false);
    setFeedback(null);
  }, [currentIndex, tasks]);

  useEffect(() => {
    return () => {
      if (matchFlashTimeoutRef.current !== null) {
        window.clearTimeout(matchFlashTimeoutRef.current);
      }
    };
  }, []);

  // Shuffled columns for current matching task
  const matchingColumns = useMemo(() => {
    if (!currentTask || currentTask.type !== 'matching') return null;
    const mTask = currentTask as MatchingPairsTask;
    return {
      left: shuffleArray(mTask.pairs),
      right: shuffleArray(mTask.pairs),
    };
  }, [currentTask]);

  const progressPercent = tasks.length > 0 ? Math.round((currentIndex / tasks.length) * 100) : 0;

  // Handle Matching Pairs selection
  const handleMatchSelect = (side: 'left' | 'right', pairId: string) => {
    if (!currentTask || currentTask.type !== 'matching' || feedback) return;
    if (matchedPairIds.includes(pairId)) return;
    if (mode === 'lesson' && hearts <= 0) {
      onOpenHeartsModal();
      return;
    }

    const nextLeft = side === 'left' ? pairId : selectedLeftId;
    const nextRight = side === 'right' ? pairId : selectedRightId;

    setSelectedLeftId(nextLeft);
    setSelectedRightId(nextRight);

    if (nextLeft && nextRight) {
      if (nextLeft === nextRight) {
        const updated = [...matchedPairIds, nextLeft];
        setMatchedPairIds(updated);
        setSelectedLeftId(null);
        setSelectedRightId(null);

        if (updated.length === currentTask.pairs.length) {
          // Completed all 4 pairs!
          setTotalChecks((c) => c + 1);
          if (!hadMatchingMistake) {
            setCorrectCount((c) => c + 1);
          }
          const gained = mode === 'lesson' ? 15 : 5;
          setXpEarnedInSession((x) => x + gained);
          onAnswerOutcome(true, currentTask.structureId);
          setFeedback({
            status: 'correct',
            title: MOTIVATIONAL_PHRASES[currentIndex % MOTIVATIONAL_PHRASES.length],
            detailText: currentTask.explanation,
            triviaText: currentTask.funFact,
          });
        }
      } else {
        setHadMatchingMistake(true);
        setWrongMatchFlash({ left: nextLeft, right: nextRight });
        if (mode === 'lesson') {
          onAnswerOutcome(false, currentTask.structureId);
        }
        if (matchFlashTimeoutRef.current !== null) {
          window.clearTimeout(matchFlashTimeoutRef.current);
        }
        matchFlashTimeoutRef.current = window.setTimeout(() => {
          matchFlashTimeoutRef.current = null;
          setWrongMatchFlash(null);
          setSelectedLeftId(null);
          setSelectedRightId(null);
        }, 550);
      }
    }
  };

  // Evaluate Check button for Multiple Choice, Clinical Case, Model 3D, Typing
  const handleCheckAnswer = () => {
    if (!currentTask || feedback) return;
    if (mode === 'lesson' && hearts <= 0) {
      onOpenHeartsModal();
      return;
    }

    let isCorrect = false;
    let correctAnswerText = '';

    if (currentTask.type === 'multiple_choice' || currentTask.type === 'clinical_case') {
      if (selectedOption === null) return;
      isCorrect = selectedOption === currentTask.correctIndex;
      correctAnswerText = currentTask.options[currentTask.correctIndex] ?? '';
    } else if (currentTask.type === 'typing') {
      if (!typingInput.trim()) return;
      isCorrect = isTypingAnswerCorrect(typingInput, currentTask.acceptedAnswers);
      correctAnswerText = currentTask.displayAnswer;
    } else if (currentTask.type === 'model3d') {
      if (!selected3DPart) return;
      const normSelectedPl = normalizeAnatomyAnswer(selected3DPart.namePl);
      const normTargetPl = normalizeAnatomyAnswer(currentTask.targetNamePl);

      isCorrect =
        selected3DPart.id === currentTask.targetMeshId ||
        (Boolean(selected3DPart.rawMeshName) &&
          selected3DPart.rawMeshName!.toLowerCase() === currentTask.targetMeshId.toLowerCase()) ||
        selected3DPart.structureId === currentTask.structureId ||
        normSelectedPl === normTargetPl;
      const targetEn =
        currentTask.targetNameEn ?? ANATOMY_MAP[currentTask.structureId]?.nameEn;
      correctAnswerText = formatBilingualName(currentTask.targetNamePl, targetEn);
    }

    setTotalChecks((c) => c + 1);

    const structure = ANATOMY_MAP[currentTask.structureId];
    const ppPkNote =
      structure && structure.category === 'muscle'
        ? ` PP: ${structure.pp} → PK: ${structure.pk}.`
        : structure && structure.category === 'bone'
          ? ` Struktury kostne: ${structure.pp}. Mięśnie przyczepiające się: ${structure.pk}.`
          : '';

    if (isCorrect) {
      setCorrectCount((c) => c + 1);
      const gained = currentTask.type === 'model3d' || currentTask.type === 'typing' ? 15 : 10;
      setXpEarnedInSession((x) => x + gained);
      onAnswerOutcome(true, currentTask.structureId);
      setFeedback({
        status: 'correct',
        title: MOTIVATIONAL_PHRASES[currentIndex % MOTIVATIONAL_PHRASES.length],
        detailText: currentTask.explanation,
        triviaText: currentTask.funFact,
      });
    } else {
      if (mode === 'lesson') {
        onAnswerOutcome(false, currentTask.structureId);
      }
      setFeedback({
        status: 'wrong',
        title: 'Nie tym razem — przeanalizuj przebieg',
        correctAnswerText,
        detailText: `${currentTask.explanation}${ppPkNote}`,
      });
    }
  };

  const handleAdvance = () => {
    if (mode === 'lesson' && !isFreeMode && hearts <= 0) {
      onOpenHeartsModal();
      return;
    }

    if (currentIndex + 1 < tasks.length) {
      setCurrentIndex((i) => i + 1);
      return;
    }

    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    const finalTotal = Math.max(totalChecks, tasks.length);
    const accuracy = Math.min(100, Math.round((correctCount / finalTotal) * 100));

    if (mode === 'recovery' || mode === 'review') {
      setRecoveryDone(true);
      if (mode === 'recovery') {
        onCompleteRecovery(correctCount);
      }
      return;
    }

    const result = onCompleteLesson({
      xpEarned: xpEarnedInSession + (lesson?.xpReward ?? 40),
      accuracy,
      correctCount,
      totalCount: finalTotal,
      durationSeconds,
    });
    setSummary(result);
  };

  const canSubmit = (() => {
    if (!currentTask || feedback) return false;
    switch (currentTask.type) {
      case 'multiple_choice':
      case 'clinical_case':
        return selectedOption !== null;
      case 'typing':
        return typingInput.trim().length > 0;
      case 'model3d':
        return selected3DPart !== null;
      case 'matching':
        return false; // Auto-checks when all 4 pairs match
    }
  })();

  // Keyboard shortcuts: 1-4 select options in MCQ/Clinical Case; Enter submits or advances feedback
  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (summary || recoveryDone || !currentTask) return;
      const targetEl = ev.target as HTMLElement | null;
      const isTypingField =
        targetEl?.tagName === 'INPUT' || targetEl?.tagName === 'TEXTAREA';

      if (ev.key === 'Enter') {
        if (feedback) {
          ev.preventDefault();
          handleAdvance();
          return;
        }
        if (!isTypingField && canSubmit) {
          ev.preventDefault();
          handleCheckAnswer();
        }
        return;
      }

      if (
        !isTypingField &&
        !feedback &&
        (currentTask.type === 'multiple_choice' || currentTask.type === 'clinical_case')
      ) {
        const idx = ['1', '2', '3', '4'].indexOf(ev.key);
        if (idx >= 0 && idx < currentTask.options.length) {
          ev.preventDefault();
          setSelectedOption(idx);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // =========================================================================
  // RENDER: SUMMARY SCREEN
  // =========================================================================
  if (summary) {
    return (
      <div
        data-testid="lesson-summary"
        className="mx-auto flex min-h-[75vh] max-w-xl flex-col items-center justify-center px-4 py-8 text-center"
      >
        <div className="animate-duo-pop flex h-24 w-24 items-center justify-center rounded-3xl border-b-[6px] border-amber-600 bg-amber-400 text-amber-950 shadow-lg">
          <Award className="h-12 w-12" />
        </div>

        <h1 className="mt-6 font-display text-3xl font-extrabold text-emerald-950 dark:text-white">
          Lekcja ukończona!
        </h1>
        <p className="mt-2 text-sm font-medium text-[#354c3f] dark:text-[#c7dbcf]">
          {summary.lessonTitle}
        </p>

        <div className="mt-8 grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-3.5 dark:border-amber-700/80 dark:bg-amber-950/40">
            <div className="flex items-center justify-center gap-1 text-xs font-extrabold uppercase text-amber-700 dark:text-amber-300">
              <Zap className="h-4 w-4" />
              <span>Zdobyte XP</span>
            </div>
            <div className="font-mono-tabular mt-1 text-2xl font-extrabold text-amber-900 dark:text-amber-100">
              +{summary.xpEarned}
            </div>
          </div>

          <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-3.5 dark:border-emerald-700/80 dark:bg-emerald-950/40">
            <div className="flex items-center justify-center gap-1 text-xs font-extrabold uppercase text-emerald-700 dark:text-emerald-300">
              <Target className="h-4 w-4" />
              <span>Celność</span>
            </div>
            <div className="font-mono-tabular mt-1 text-2xl font-extrabold text-emerald-900 dark:text-emerald-100">
              {summary.accuracy}%
            </div>
          </div>

          <div className="rounded-2xl border-2 border-green-300 bg-green-50 p-3.5 dark:border-green-700/80 dark:bg-green-950/40">
            <div className="flex items-center justify-center gap-1 text-xs font-extrabold uppercase text-green-700 dark:text-green-300">
              <Clock className="h-4 w-4" />
              <span>Czas</span>
            </div>
            <div className="font-mono-tabular mt-1 text-2xl font-extrabold text-green-900 dark:text-green-100">
              {formatDuration(summary.durationSeconds)}
            </div>
          </div>

          <div className="rounded-2xl border-2 border-orange-300 bg-orange-50 p-3.5 dark:border-orange-700/80 dark:bg-orange-950/40">
            <div className="flex items-center justify-center gap-1 text-xs font-extrabold uppercase text-orange-700 dark:text-orange-300">
              <Flame className="h-4 w-4" />
              <span>Streak</span>
            </div>
            <div className="font-mono-tabular mt-1 text-lg font-extrabold text-orange-900 dark:text-orange-100">
              {summary.streakIncremented ? '+1 dzień!' : 'Aktywny'}
            </div>
          </div>
        </div>

        {summary.newlyUnlockedLessonTitle && (
          <div className="mt-5 flex items-center gap-2 rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            <span>Odblokowano kolejny poziom: {summary.newlyUnlockedLessonTitle}</span>
          </div>
        )}

        <button
          type="button"
          data-testid="btn-summary-return"
          onClick={onExit}
          className="mt-8 w-full max-w-xs rounded-2xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-6 py-4 font-display text-base font-extrabold text-white transition hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2"
        >
          Wróć do drzewka umiejętności
        </button>
      </div>
    );
  }

  // =========================================================================
  // RENDER: RECOVERY SUMMARY
  // =========================================================================
  if (recoveryDone) {
    const isMistakeReview = mode === 'review';
    return (
      <div
        data-testid="recovery-review-summary"
        className="mx-auto flex min-h-[65vh] max-w-lg flex-col items-center justify-center px-4 text-center"
      >
        <div
          className={`animate-duo-pop flex h-20 w-20 items-center justify-center rounded-3xl border-b-[6px] text-white shadow-lg ${
            isMistakeReview
              ? 'border-emerald-700 bg-emerald-500'
              : 'border-rose-700 bg-rose-500'
          }`}
        >
          {isMistakeReview ? (
            <Award className="h-10 w-10" />
          ) : (
            <Heart className="h-10 w-10 fill-white" />
          )}
        </div>
        <h2 className="mt-6 font-display text-2xl font-extrabold text-emerald-950 dark:text-white">
          {isMistakeReview ? 'Powtórka błędów ukończona!' : 'Serca odzyskane!'}
        </h2>
        <p className="mt-2 text-sm text-[#354c3f] dark:text-[#c7dbcf]">
          {isMistakeReview
            ? `Utrwalono trudne struktury (${correctCount}/${tasks.length} poprawnych, +${xpEarnedInSession} XP).`
            : `Powtórka zaliczona (${correctCount}/${tasks.length} poprawnych). Możesz kontynuować naukę anatomii.`}
        </p>
        <button
          type="button"
          onClick={onExit}
          className="mt-6 rounded-2xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-6 py-3.5 font-display text-sm font-extrabold text-white hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2"
        >
          Kontynuuj naukę
        </button>
      </div>
    );
  }

  if (!currentTask) return null;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl flex-col justify-between px-4 pt-4 pb-36">
      {/* Lesson Top Progress Header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          data-testid="btn-exit-lesson"
          onClick={onExit}
          aria-label="Zakończ lekcję"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-[#d6e7dc] bg-white text-[#52695b] transition hover:bg-[#ebf5ee] hover:text-emerald-950 dark:border-[#294737] dark:bg-[#112018] dark:text-[#94b0a0] dark:hover:bg-[#182b21]"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex-1">
          <div className="h-4 w-full overflow-hidden rounded-full bg-[#d6e7dc] dark:bg-[#182b21]">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${Math.max(8, progressPercent)}%` }}
            />
          </div>
        </div>

        <div className="font-mono-tabular shrink-0 text-xs font-extrabold text-[#52695b] dark:text-[#94b0a0]">
          {currentIndex + 1}/{tasks.length}
        </div>

        {mode === 'lesson' && (
          <button
            type="button"
            onClick={onOpenHeartsModal}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-[#d6e7dc] bg-white px-2.5 py-1.5 text-xs font-extrabold text-rose-600 dark:border-[#294737] dark:bg-[#112018] dark:text-rose-400"
          >
            <Heart
              className={`h-4 w-4 ${isFreeMode || hearts > 0 ? 'fill-rose-500 text-rose-500' : ''}`}
            />
            <span className="font-mono-tabular">{isFreeMode ? '∞' : hearts}</span>
          </button>
        )}
      </div>

      {/* Zero Hearts Guard Banner inside Lesson */}
      {mode === 'lesson' && !isFreeMode && hearts <= 0 && !feedback && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-rose-300 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-950/50">
          <div className="flex items-center gap-2 text-sm font-bold text-rose-800 dark:text-rose-200">
            <AlertTriangle className="h-5 w-5 text-rose-500" />
            <span>Brak serc! Uzupełnij serca lub zrób szybką powtórkę.</span>
          </div>
          <button
            type="button"
            onClick={onOpenHeartsModal}
            className="rounded-xl border-b-3 border-rose-700 bg-rose-500 px-4 py-2 text-xs font-extrabold text-white"
          >
            Odzyskaj serca
          </button>
        </div>
      )}

      {/* Task Body */}
      <div className="my-auto py-6">
        <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          {mode === 'recovery'
            ? 'Powtórka na odzyskanie serca'
            : currentTask.type === 'matching'
              ? 'Zadanie 1: Łączenie par'
              : currentTask.type === 'model3d'
                ? 'Zadanie 3D: Wskaż strukturę'
                : currentTask.type === 'clinical_case'
                  ? 'Przypadek kliniczny'
                  : currentTask.type === 'typing'
                    ? 'Zadanie z klawiatury'
                    : 'Pytanie testowe ABCD'}
        </div>

        <h2
          data-testid="task-prompt"
          className="font-display text-xl font-extrabold leading-snug text-emerald-950 dark:text-white sm:text-2xl"
        >
          {currentTask.prompt ?? 'Przeanalizuj przypadek kliniczny i wskaż strukturę:'}
        </h2>

        {/* 1. MATCHING PAIRS */}
        {currentTask.type === 'matching' && matchingColumns && (
          <div
            data-testid="task-matching"
            className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <div className="space-y-2.5">
              {matchingColumns.left.map((pair) => {
                const isMatched = matchedPairIds.includes(pair.id);
                const isSelected = selectedLeftId === pair.id;
                const isWrong = wrongMatchFlash?.left === pair.id;
                return (
                  <button
                    key={`L_${pair.id}`}
                    type="button"
                    data-testid={`match-left-${pair.id}`}
                    disabled={isMatched}
                    onClick={() => handleMatchSelect('left', pair.id)}
                    className={`w-full rounded-2xl border-2 border-b-4 px-4 py-3.5 text-left text-sm font-bold transition ${
                      isMatched
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700 opacity-65 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                        : isWrong
                          ? 'border-rose-500 bg-rose-50 text-rose-700 dark:border-rose-600 dark:bg-rose-950/60 dark:text-rose-200'
                          : isSelected
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-400/40 dark:border-emerald-400 dark:bg-emerald-950/80 dark:text-emerald-100 dark:ring-emerald-500/40'
                            : 'border-[#d6e7dc] bg-white text-[#16291f] hover:bg-[#f4faf6] active:translate-y-0.5 active:border-b-2 dark:border-[#294737] dark:bg-[#112018] dark:text-emerald-50 dark:hover:bg-[#182b21]'
                    }`}
                  >
                    {pair.left}
                  </button>
                );
              })}
            </div>

            <div className="space-y-2.5">
              {matchingColumns.right.map((pair) => {
                const isMatched = matchedPairIds.includes(pair.id);
                const isSelected = selectedRightId === pair.id;
                const isWrong = wrongMatchFlash?.right === pair.id;
                return (
                  <button
                    key={`R_${pair.id}`}
                    type="button"
                    data-testid={`match-right-${pair.id}`}
                    disabled={isMatched}
                    onClick={() => handleMatchSelect('right', pair.id)}
                    className={`w-full rounded-2xl border-2 border-b-4 px-4 py-3.5 text-left text-sm font-semibold transition ${
                      isMatched
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700 opacity-65 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                        : isWrong
                          ? 'border-rose-500 bg-rose-50 text-rose-700 dark:border-rose-600 dark:bg-rose-950/60 dark:text-rose-200'
                          : isSelected
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-400/40 dark:border-emerald-400 dark:bg-emerald-950/80 dark:text-emerald-100 dark:ring-emerald-500/40'
                            : 'border-[#d6e7dc] bg-white text-[#26382e] hover:bg-[#f4faf6] active:translate-y-0.5 active:border-b-2 dark:border-[#294737] dark:bg-[#112018] dark:text-[#e6f2ea] dark:hover:bg-[#182b21]'
                    }`}
                  >
                    {pair.right}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. MODEL 3D PICKER */}
        {currentTask.type === 'model3d' && (
          <div data-testid="task-model3d" className="mt-4 space-y-3">
            <Suspense
              fallback={
                <div className="flex h-[340px] items-center justify-center rounded-2xl border-2 border-[#d6e7dc] bg-white text-sm font-bold text-[#52695b] sm:h-[390px] dark:border-[#233d2f] dark:bg-[#112018] dark:text-[#c7dbcf]">
                  Ładowanie modelu 3D...
                </div>
              }
            >
              <AnatomyViewport3D
                region={regionalModelTarget?.region ?? currentTask.region}
                modelUrl={regionalModelTarget?.modelUrl}
                selectedId={selected3DPart?.id ?? null}
                filterMode={
                  task3DLayerConfig.enableExtended
                    ? 'all'
                    : ANATOMY_MAP[currentTask.structureId]?.category === 'bone'
                      ? 'bone'
                      : 'all'
                }
                enableExtendedLayers={task3DLayerConfig.enableExtended}
                initialVisibleLayers={task3DLayerConfig.visibleLayers}
                showMuscleGroupingToggle={false}
                showClippingControl={false}
                onSelectPart={(part) => {
                  if (!feedback) setSelected3DPart(part);
                }}
                heightClassName="h-[340px] sm:h-[390px]"
                isDarkMode={isDarkMode}
                allowUpload={false}
                hideHoverLabel={true}
                hideHotspotOverlay={true}
                highlightMode={
                  feedback ? (feedback.status === 'correct' ? 'correct' : 'wrong') : 'neutral'
                }
              />
            </Suspense>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-[#d6e7dc] bg-white px-4 py-2.5 text-sm dark:border-[#233d2f] dark:bg-[#112018]">
              <span className="font-semibold text-[#354c3f] dark:text-[#94b0a0]">
                Wybrana struktura:
              </span>
              {selected3DPart ? (
                feedback ? (
                  <span
                    data-testid="lesson-3d-selected-revealed"
                    className="font-display font-bold text-emerald-700 dark:text-emerald-300"
                  >
                    {formatSelectedPartLabel(selected3DPart)}
                  </span>
                ) : (
                  <span
                    data-testid="lesson-3d-selected-masked"
                    className="inline-flex items-center gap-1.5 font-display font-bold text-emerald-700 dark:text-emerald-300"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Zaznaczono element na modelu 3D</span>
                  </span>
                )
              ) : (
                <span className="text-xs italic text-[#6b8274]">
                  Kliknij element na modelu 3D powyżej
                </span>
              )}
            </div>
          </div>
        )}

        {/* 3. MULTIPLE CHOICE & 4. CLINICAL CASE */}
        {(currentTask.type === 'multiple_choice' || currentTask.type === 'clinical_case') && (
          <div className="mt-5 space-y-4">
            {currentTask.type === 'clinical_case' && (
              <div
                data-testid="clinical-case-card"
                className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-800 dark:bg-emerald-950/30"
              >
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  <Stethoscope className="h-4 w-4" />
                  <span>{currentTask.patientProfile}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[#16291f] dark:text-[#e6f2ea]">
                  {currentTask.clinicalVignette}
                </p>
              </div>
            )}

            <div className="space-y-2.5">
              {currentTask.options.map((opt, idx) => {
                const isSelected = selectedOption === idx;
                const letter = ['A', 'B', 'C', 'D'][idx] ?? String(idx + 1);
                const isCorrectOption = feedback && idx === currentTask.correctIndex;
                const isWrongSelected =
                  feedback && feedback.status === 'wrong' && isSelected && !isCorrectOption;

                return (
                  <button
                    key={opt}
                    type="button"
                    data-testid={`mcq-option-${idx}`}
                    disabled={Boolean(feedback)}
                    onClick={() => setSelectedOption(idx)}
                    className={`flex w-full items-center gap-3.5 rounded-2xl border-2 border-b-4 px-4 py-3.5 text-left transition ${
                      isCorrectOption
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-100'
                        : isWrongSelected
                          ? 'border-rose-500 bg-rose-50 text-rose-900 dark:border-rose-600 dark:bg-rose-950/60 dark:text-rose-100'
                          : isSelected
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-100'
                            : 'border-[#d6e7dc] bg-white text-[#16291f] hover:bg-[#f4faf6] active:translate-y-0.5 active:border-b-2 dark:border-[#294737] dark:bg-[#112018] dark:text-emerald-50 dark:hover:bg-[#182b21]'
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-xs font-extrabold ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-[#c2d8ca] bg-[#f4faf6] text-[#354c3f] dark:border-[#345945] dark:bg-[#182b21] dark:text-[#c7dbcf]'
                      }`}
                    >
                      {letter}
                    </span>
                    <span className="text-sm font-semibold">{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. TYPING CHALLENGE */}
        {currentTask.type === 'typing' && (
          <div data-testid="task-typing" className="mt-6 space-y-4">
            <input
              type="text"
              data-testid="typing-input"
              value={typingInput}
              disabled={Boolean(feedback)}
              onChange={(e) => setTypingInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSubmit) {
                  e.preventDefault();
                  handleCheckAnswer();
                }
              }}
              placeholder="Wpisz nazwę struktury po polsku..."
              className="w-full rounded-2xl border-2 border-[#c2d8ca] bg-white px-4 py-4 font-display text-lg font-bold text-emerald-950 placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:text-[#6b8274] focus:border-emerald-500 focus:outline-none dark:border-[#294737] dark:bg-[#112018] dark:text-white"
            />
          </div>
        )}
      </div>

      {/* Bottom Action Bar (when no feedback sheet is open) */}
      {!feedback && currentTask.type !== 'matching' && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-[#d6e7dc] bg-white px-4 py-4 dark:border-[#233d2f] dark:bg-[#112018]">
          <div className="mx-auto flex max-w-3xl items-center justify-end">
            <button
              type="button"
              data-testid="btn-check-answer"
              disabled={!canSubmit}
              onClick={handleCheckAnswer}
              className={`w-full rounded-2xl border-2 border-b-4 px-8 py-3.5 font-display text-base font-extrabold transition sm:w-auto ${
                canSubmit
                  ? 'border-emerald-700 bg-emerald-500 text-white hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2'
                  : 'cursor-not-allowed border-[#c2d8ca] bg-[#e2ede6] text-[#6b8274] dark:border-[#294737] dark:bg-[#182b21] dark:text-[#739180]'
              }`}
            >
              Sprawdź
            </button>
          </div>
        </div>
      )}

      {/* Duolingo-style Bottom Sheet Feedback */}
      {feedback && (
        <div
          data-testid={`feedback-sheet-${feedback.status}`}
          className={`animate-sheet-up fixed inset-x-0 bottom-0 z-40 border-t-2 px-4 py-5 shadow-2xl ${
            feedback.status === 'correct'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-50'
              : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-50'
          }`}
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              {feedback.status === 'correct' ? (
                <CheckCircle2 className="mt-0.5 h-8 w-8 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <XCircle className="mt-0.5 h-8 w-8 shrink-0 text-rose-600 dark:text-rose-400" />
              )}
              <div className="space-y-1">
                <div className="font-display text-lg font-extrabold">{feedback.title}</div>
                {feedback.correctAnswerText && (
                  <div className="text-sm font-bold">
                    Poprawna odpowiedź:{' '}
                    <span className="underline decoration-2">{feedback.correctAnswerText}</span>
                  </div>
                )}
                <p className="text-xs leading-relaxed opacity-90 sm:text-sm">
                  {feedback.detailText}
                </p>
                {feedback.triviaText && (
                  <p className="text-xs font-semibold italic text-emerald-800 dark:text-emerald-300">
                    Ciekawostka: {feedback.triviaText}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              data-testid="btn-next-task"
              onClick={handleAdvance}
              className={`inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border-2 border-b-4 px-7 py-3.5 font-display text-base font-extrabold text-white transition active:translate-y-0.5 active:border-b-2 ${
                feedback.status === 'correct'
                  ? 'border-emerald-700 bg-emerald-500 hover:bg-emerald-600'
                  : 'border-rose-700 bg-rose-500 hover:bg-rose-600'
              }`}
            >
              <span>{feedback.status === 'correct' ? 'Dalej' : 'Rozumiem'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
