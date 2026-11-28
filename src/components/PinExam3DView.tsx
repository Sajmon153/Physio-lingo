import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Award,
  Box,
  CheckCircle2,
  Clock,
  Compass,
  Crosshair,
  Eye,
  Focus,
  Keyboard,
  Layers,
  ListChecks,
  Play,
  RotateCcw,
  Sparkles,
  Stethoscope,
  Target,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { ANATOMY_MAP } from '../data/anatomyDb';
import {
  BIOMECHANICS_MOVEMENTS,
  buildBiomechanicsQuizQuestions,
  type BiomechanicsQuizQuestion,
  type BiomechanicsQuizScope,
} from '../data/biomechanicsDb';
import {
  buildDermatomeQuizQuestions,
  DERMATOME_MYOTOME_LEVELS,
  type DermatomeQuizQuestion,
  type DermatomeQuizScope,
} from '../data/dermatomesMyotomes';
import { formatBilingualName } from '../three/anatomyTranslator';
import {
  AnatomicalLayerId,
  DermatomeDisplayMode,
  PinExamHistoryEntry,
  RegionId,
  SrsCardState,
} from '../types/anatomy';
import { getLocalDateKey } from '../utils/gameLogic';
import {
  buildPinExamQuestions,
  buildReversePinOptions,
  evaluatePinExamAnswer,
  evaluateReverseTypingAnswer,
  getPinExamPoolCounts,
  PIN_EXAM_REGIONS,
  type PinExamPool,
  type PinExamQuestion,
  type PinExamRegion,
  type ReversePinOption,
} from '../utils/pinExamLogic';
import {
  applySrsReview,
  buildSrsDeck,
  buildSrsStudyQueue,
  getAllSrsCards,
  getSrsDeckStats,
  previewNextIntervals,
  SRS_DECK_META,
  type SrsDeckId,
  type SrsFlashcard,
  type SrsRating,
} from '../utils/srsLogic';
import {
  AnatomyViewport3D,
  resolveBestRegionalKeyForStructure,
  type AnatomyViewport3DHandle,
  type SelectedPartInfo,
  type ViewportModelMode,
} from './AnatomyViewport3D';

export type PinHubMode = 'locate' | 'identify' | 'dermatomes' | 'biomechanics' | 'srs';
type ReverseAnswerFormat = 'abcd' | 'typing';

interface DermatomeQuizResultItem {
  question: DermatomeQuizQuestion;
  selectedRootId: string;
  isCorrect: boolean;
}

interface BiomechanicsQuizResultItem {
  question: BiomechanicsQuizQuestion;
  selectedOptionId: string;
  isCorrect: boolean;
}

interface PinExamResultItem {
  question: PinExamQuestion;
  selectedLabel: string | null;
  isCorrect: boolean;
  timedOut: boolean;
  elapsedSeconds: number;
}

interface PinExam3DViewProps {
  isDarkMode: boolean;
  initialMode?: PinHubMode;
  initialModeRequestId?: number;
  srsProgress: Record<string, SrsCardState>;
  onRecordOutcome: (isCorrect: boolean, structureId: string, xpGain: number) => void;
  onCompleteExamHistory?: (entry: PinExamHistoryEntry) => void;
  onReviewSrsCard: (cardId: string, nextState: SrsCardState, xpGain: number) => void;
  onShowIn3D: (target: {
    region: ViewportModelMode;
    structureId?: string;
    landmarkId?: string;
    isolateIfMuscle?: boolean;
  }) => void;
}

const POOL_OPTIONS: Array<{ id: PinExamPool; label: string; desc: string }> = [
  {
    id: 'all',
    label: 'Układ ruchu (Mięśnie + PP/PK)',
    desc: 'Przekrojowy zestaw mięśni oraz punktów kostnych i przyczepów',
  },
  {
    id: 'muscles',
    label: 'Tylko mięśnie',
    desc: 'Identyfikacja brzuśców i głów mięśni na modelu 3D',
  },
  {
    id: 'landmarks',
    label: 'Punkty kostne i PP/PK',
    desc: 'Wskazywanie stref na kościach: guzków, dołów, grzebieni i przyczepów',
  },
  {
    id: 'vessels',
    label: 'Naczynia (Tętnice i żyły)',
    desc: 'Główne pnie tętnicze i żylne na tle szkieletu 3D',
  },
  {
    id: 'nerves',
    label: 'Nerwy i układ nerwowy',
    desc: 'Sploty, nerwy obwodowe, mózgowie i rdzeń kręgowy',
  },
  {
    id: 'connective',
    label: 'Więzadła, kaletki i ścięgna',
    desc: 'Złociste więzadła, perłowe ścięgna, lazurowe pochewki i fioletowe kaletki maziowe',
  },
  {
    id: 'organs',
    label: 'Narządy wewnętrzne',
    desc: 'Serce, płuca, wątroba, żołądek, nerki i trzewia (Tułów / Całe ciało)',
  },
];

function getPinQuestionCategoryBadge(q: PinExamQuestion): string {
  if (q.kind === 'landmark') return 'Punkt kostny / Przyczep';
  const cat = ANATOMY_MAP[q.structureId]?.category;
  if (cat === 'artery') return 'Tętnica';
  if (cat === 'vein') return 'Żyła';
  if (q.systemGroup === 'vessels') return 'Tętnica / Żyła';
  if (cat === 'nerve' || q.systemGroup === 'nerves') return 'Nerw / Układ nerwowy';
  if (cat === 'organ' || q.systemGroup === 'organs') return 'Narząd wewnętrzny';
  if (cat === 'bursa') return 'Kaletka maziowa';
  if (cat === 'tendon') return 'Ścięgno / Pochewka';
  if (cat === 'ligament' || cat === 'joint_ligament' || q.systemGroup === 'connective') {
    return 'Więzadło / Aparat stawowy';
  }
  if (cat === 'bone') return 'Kość';
  return 'Mięsień';
}

const QUESTION_COUNTS = [5, 10, 15] as const;

const SRS_REGION_FILTERS: Array<{ id: RegionId | 'all'; label: string }> = [
  { id: 'all', label: 'Wszystkie działy' },
  { id: 'shoulder', label: 'Bark' },
  { id: 'knee', label: 'Kolano' },
  { id: 'spine_thorax', label: 'Kręgosłup' },
  { id: 'pelvis_hip', label: 'Biodro' },
  { id: 'head_neck', label: 'Głowa/szyja' },
  { id: 'upper_limb', label: 'Kończyna górna' },
  { id: 'lower_limb', label: 'Stopa/podudzie' },
];

export const PinExam3DView: React.FC<PinExam3DViewProps> = ({
  isDarkMode,
  initialMode = 'locate',
  initialModeRequestId = 0,
  srsProgress,
  onRecordOutcome,
  onCompleteExamHistory,
  onReviewSrsCard,
  onShowIn3D,
}) => {
  // Top-level hub mode
  const [hubMode, setHubMode] = useState<PinHubMode>(initialMode);

  useEffect(() => {
    if (initialModeRequestId > 0) {
      setHubMode(initialMode);
      setPhase('setup');
      setDermPhase('setup');
      setBiomPhase('setup');
    }
  }, [initialMode, initialModeRequestId]);

  // Pin exam configuration state (shared by 'locate' and 'identify')
  const [region, setRegion] = useState<PinExamRegion>('upper_limb_right');
  const [pool, setPool] = useState<PinExamPool>('all');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [reverseFormat, setReverseFormat] = useState<ReverseAnswerFormat>('abcd');

  // Active exam state
  const [phase, setPhase] = useState<'setup' | 'active' | 'summary'>('setup');
  const [questions, setQuestions] = useState<PinExamQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedPart, setSelectedPart] = useState<SelectedPartInfo | null>(null);
  const [reverseOptions, setReverseOptions] = useState<ReversePinOption[]>([]);
  const [selectedReverseOptionIdx, setSelectedReverseOptionIdx] = useState<number | null>(null);
  const [reverseTypingInput, setReverseTypingInput] = useState('');
  const [questionState, setQuestionState] = useState<'answering' | 'correct' | 'wrong'>('answering');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [results, setResults] = useState<PinExamResultItem[]>([]);
  const [totalXpEarned, setTotalXpEarned] = useState(0);
  const [modelLoadedTick, setModelLoadedTick] = useState(0);

  // SRS Flashcards state
  const [srsDeckId, setSrsDeckId] = useState<SrsDeckId>('all');
  const [srsRegionFilter, setSrsRegionFilter] = useState<RegionId | 'all'>('all');
  const [srsQueue, setSrsQueue] = useState<SrsFlashcard[]>([]);
  const [srsSessionStarted, setSrsSessionStarted] = useState(false);
  const [srsFlipped, setSrsFlipped] = useState(false);
  const [srsReviewedInSession, setSrsReviewedInSession] = useState(0);
  const [srsSessionXp, setSrsSessionXp] = useState(0);

  // Dermatome & Myotome 3D Quiz state
  const [dermScope, setDermScope] = useState<DermatomeQuizScope>('all');
  const [dermDisplayMode, setDermDisplayMode] = useState<DermatomeDisplayMode>('both');
  const [dermCount, setDermCount] = useState<number>(5);
  const [dermPhase, setDermPhase] = useState<'setup' | 'active' | 'summary'>('setup');
  const [dermQuestions, setDermQuestions] = useState<DermatomeQuizQuestion[]>([]);
  const [dermIndex, setDermIndex] = useState(0);
  const [dermSelectedOptionId, setDermSelectedOptionId] = useState<string | null>(null);
  const [dermResults, setDermResults] = useState<DermatomeQuizResultItem[]>([]);
  const [dermTotalXp, setDermTotalXp] = useState(0);

  // Biomechanics 3D Quiz state
  const [biomScope, setBiomScope] = useState<BiomechanicsQuizScope>('all');
  const [biomCount, setBiomCount] = useState<number>(5);
  const [biomPhase, setBiomPhase] = useState<'setup' | 'active' | 'summary'>('setup');
  const [biomQuestions, setBiomQuestions] = useState<BiomechanicsQuizQuestion[]>([]);
  const [biomIndex, setBiomIndex] = useState(0);
  const [biomSelectedOptionId, setBiomSelectedOptionId] = useState<string | null>(null);
  const [biomResults, setBiomResults] = useState<BiomechanicsQuizResultItem[]>([]);
  const [biomTotalXp, setBiomTotalXp] = useState(0);

  const viewportRef = useRef<AnatomyViewport3DHandle>(null);
  const questionStartRef = useRef<number>(Date.now());
  const modelReadyRef = useRef(false);

  const activeRegionMeta = useMemo(
    () => PIN_EXAM_REGIONS.find((r) => r.id === region) ?? PIN_EXAM_REGIONS[0],
    [region],
  );
  const poolCounts = useMemo(() => getPinExamPoolCounts(region), [region]);
  const getCountForPool = useCallback(
    (p: PinExamPool): number => {
      switch (p) {
        case 'muscles':
          return poolCounts.muscles;
        case 'landmarks':
          return poolCounts.landmarks;
        case 'vessels':
          return poolCounts.vessels;
        case 'nerves':
          return poolCounts.nerves;
        case 'connective':
          return poolCounts.connective;
        case 'organs':
          return poolCounts.organs;
        default:
          return poolCounts.total;
      }
    },
    [poolCounts],
  );
  const maxAvailableForPool = getCountForPool(pool);

  // Auto-fallback to 'all' if selected pool has 0 questions in newly selected region (e.g., organs on upper limb)
  useEffect(() => {
    if (maxAvailableForPool === 0 && pool !== 'all') {
      setPool('all');
    }
  }, [maxAvailableForPool, pool]);

  const currentQuestion = questions[currentIndex] ?? null;

  const pinExamVisibleLayers = useMemo<Partial<Record<AnatomicalLayerId, boolean>>>(() => {
    const grp = currentQuestion?.systemGroup;
    if (grp === 'vessels' || pool === 'vessels') {
      return {
        bone: true,
        cartilage: true,
        muscle: false,
        bursa: false,
        tendon: false,
        sheath: false,
        ligament: false,
        artery: true,
        vein: true,
        nerve: false,
        organ: false,
        skin: false,
      };
    }
    if (grp === 'nerves' || pool === 'nerves') {
      return {
        bone: true,
        cartilage: true,
        muscle: false,
        bursa: false,
        tendon: false,
        sheath: false,
        ligament: false,
        artery: false,
        vein: false,
        nerve: true,
        organ: false,
        skin: false,
      };
    }
    if (grp === 'connective' || pool === 'connective') {
      return {
        bone: true,
        cartilage: true,
        muscle: false,
        bursa: true,
        tendon: true,
        sheath: true,
        ligament: true,
        artery: false,
        vein: false,
        nerve: false,
        organ: false,
        skin: false,
      };
    }
    if (grp === 'organs' || pool === 'organs') {
      return {
        bone: true,
        cartilage: true,
        muscle: false,
        bursa: false,
        tendon: false,
        sheath: false,
        ligament: false,
        artery: false,
        vein: false,
        nerve: false,
        organ: true,
        skin: false,
      };
    }
    return {
      bone: true,
      cartilage: true,
      muscle: true,
      bursa: true,
      tendon: true,
      sheath: true,
      ligament: false,
      artery: false,
      vein: false,
      nerve: false,
      organ: false,
      skin: false,
    };
  }, [currentQuestion?.systemGroup, pool]);

  // SRS deck memo
  const srsFilteredDeck = useMemo(
    () => buildSrsDeck(srsDeckId, srsRegionFilter),
    [srsDeckId, srsRegionFilter],
  );
  const srsStats = useMemo(
    () => getSrsDeckStats(srsFilteredDeck, srsProgress),
    [srsFilteredDeck, srsProgress],
  );

  // Rebuild ABCD options whenever current reverse question changes
  useEffect(() => {
    if (hubMode === 'identify' && phase === 'active' && currentQuestion) {
      setReverseOptions(buildReversePinOptions(currentQuestion, region));
      setSelectedReverseOptionIdx(null);
      setReverseTypingInput('');
    }
  }, [hubMode, phase, currentQuestion, region]);

  // Focus & highlight target structure automatically in Reverse Pin mode ('identify')
  const focusReverseTarget = useCallback(() => {
    if (hubMode !== 'identify' || phase !== 'active' || !currentQuestion) return;
    viewportRef.current?.selectAndFocusTarget?.({
      landmarkId: currentQuestion.landmarkId,
      structureId: currentQuestion.structureId,
      isolateIfMuscle: currentQuestion.kind === 'mesh',
      silent: true,
    });
  }, [hubMode, phase, currentQuestion]);

  useEffect(() => {
    if (hubMode !== 'identify' || phase !== 'active' || !currentQuestion || !modelReadyRef.current) {
      return;
    }
    const raf = window.requestAnimationFrame(() => {
      focusReverseTarget();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [hubMode, phase, currentIndex, currentQuestion, modelLoadedTick, focusReverseTarget]);

  const switchHubMode = (nextMode: PinHubMode) => {
    setHubMode(nextMode);
    setPhase('setup');
    setDermPhase('setup');
    setBiomPhase('setup');
    setSrsSessionStarted(false);
    setSrsFlipped(false);
    modelReadyRef.current = false;
  };

  // Biomechanics 3D Quiz helpers
  const biomAvailableCount = useMemo(() => {
    if (biomScope === 'upper') {
      return BIOMECHANICS_MOVEMENTS.filter(
        (m) =>
          m.jointGroup === 'shoulder' ||
          m.jointGroup === 'elbow_forearm' ||
          m.jointGroup === 'wrist',
      ).length;
    }
    if (biomScope === 'lower_spine') {
      return BIOMECHANICS_MOVEMENTS.filter(
        (m) =>
          m.jointGroup === 'hip' ||
          m.jointGroup === 'knee' ||
          m.jointGroup === 'ankle_foot' ||
          m.jointGroup === 'spine',
      ).length;
    }
    return BIOMECHANICS_MOVEMENTS.length;
  }, [biomScope]);

  const currentBiomQ = biomQuestions[biomIndex] ?? null;

  const handleStartBiomechanicsQuiz = () => {
    const generated = buildBiomechanicsQuizQuestions(
      biomScope,
      Math.min(biomCount, biomAvailableCount),
    );
    if (generated.length === 0) return;
    setBiomQuestions(generated);
    setBiomIndex(0);
    setBiomSelectedOptionId(null);
    setBiomResults([]);
    setBiomTotalXp(0);
    setBiomPhase('active');
  };

  const handleSelectBiomechanicsOption = useCallback(
    (optionId: string) => {
      if (!currentBiomQ || biomSelectedOptionId !== null) return;
      const picked = currentBiomQ.options.find((o) => o.id === optionId);
      const isCorrect = Boolean(picked?.isCorrect);
      const xpGain = isCorrect ? 15 : 0;
      setBiomSelectedOptionId(optionId);
      setBiomResults((prev) => [
        ...prev,
        { question: currentBiomQ, selectedOptionId: optionId, isCorrect },
      ]);
      if (xpGain > 0) setBiomTotalXp((prev) => prev + xpGain);
      const trackedStructureId = currentBiomQ.movement.agonistIds[0] ?? 'm_deltoideus';
      onRecordOutcome(isCorrect, trackedStructureId, xpGain);
    },
    [currentBiomQ, biomSelectedOptionId, onRecordOutcome],
  );

  const handleNextBiomechanicsQuestion = useCallback(() => {
    if (biomIndex + 1 >= biomQuestions.length) {
      const correctCount = biomResults.filter((r) => r.isCorrect).length;
      const totalCount = biomQuestions.length;
      const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
      let finalXp = biomTotalXp;
      if (accuracy >= 80 && totalCount > 0) {
        const bonusXp = 20;
        finalXp += bonusXp;
        setBiomTotalXp((prev) => prev + bonusXp);
        const firstId = biomQuestions[0].movement.agonistIds[0] ?? 'm_deltoideus';
        onRecordOutcome(true, firstId, bonusXp);
      }
      if (onCompleteExamHistory) {
        const scopeLabel =
          biomScope === 'upper'
            ? 'Kończyna górna'
            : biomScope === 'lower_spine'
              ? 'Kończyna dolna i tułów'
              : 'Wszystkie stawy (24)';
        onCompleteExamHistory({
          id: `biom_${Date.now()}`,
          date: getLocalDateKey(),
          mode: 'biomechanics',
          region: scopeLabel,
          correctCount,
          totalCount,
          accuracy,
          xpEarned: finalXp,
        });
      }
      setBiomPhase('summary');
      return;
    }
    setBiomIndex((prev) => prev + 1);
    setBiomSelectedOptionId(null);
  }, [
    biomIndex,
    biomQuestions,
    biomResults,
    biomTotalXp,
    biomScope,
    onCompleteExamHistory,
    onRecordOutcome,
  ]);

  useEffect(() => {
    if (hubMode !== 'biomechanics' || biomPhase !== 'active' || !currentBiomQ) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      const targetEl = ev.target as HTMLElement | null;
      if (targetEl?.tagName === 'INPUT' || targetEl?.tagName === 'TEXTAREA') return;
      if (ev.key === 'Enter' && biomSelectedOptionId !== null) {
        ev.preventDefault();
        handleNextBiomechanicsQuestion();
        return;
      }
      if (biomSelectedOptionId === null) {
        const idx = ['1', '2', '3', '4'].indexOf(ev.key);
        if (idx >= 0 && idx < currentBiomQ.options.length) {
          ev.preventDefault();
          handleSelectBiomechanicsOption(currentBiomQ.options[idx].id);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    hubMode,
    biomPhase,
    currentBiomQ,
    biomSelectedOptionId,
    handleSelectBiomechanicsOption,
    handleNextBiomechanicsQuestion,
  ]);

  // Dermatome & Myotome 3D Quiz helpers
  const dermAvailableCount = useMemo(() => {
    if (dermScope === 'upper') {
      return DERMATOME_MYOTOME_LEVELS.filter((l) => l.group === 'cervical' || l.id === 'Th1').length;
    }
    if (dermScope === 'lower') {
      return DERMATOME_MYOTOME_LEVELS.filter((l) => l.group === 'lumbar' || l.group === 'sacral')
        .length;
    }
    return DERMATOME_MYOTOME_LEVELS.length;
  }, [dermScope]);

  const currentDermQ = dermQuestions[dermIndex] ?? null;

  const handleStartDermatomeQuiz = () => {
    const generated = buildDermatomeQuizQuestions(
      dermScope,
      Math.min(dermCount, dermAvailableCount),
      dermDisplayMode,
    );
    if (generated.length === 0) return;
    setDermQuestions(generated);
    setDermIndex(0);
    setDermSelectedOptionId(null);
    setDermResults([]);
    setDermTotalXp(0);
    setDermPhase('active');
  };

  const handleSelectDermatomeOption = useCallback(
    (rootId: string) => {
      if (!currentDermQ || dermSelectedOptionId !== null) return;
      const isCorrect = rootId === currentDermQ.target.id;
      const xpGain = isCorrect ? 15 : 0;
      setDermSelectedOptionId(rootId);
      setDermResults((prev) => [
        ...prev,
        { question: currentDermQ, selectedRootId: rootId, isCorrect },
      ]);
      if (xpGain > 0) {
        setDermTotalXp((prev) => prev + xpGain);
      }
      const trackedStructureId = currentDermQ.target.myotomeMuscleIds[0] ?? 'm_deltoideus';
      onRecordOutcome(isCorrect, trackedStructureId, xpGain);
    },
    [currentDermQ, dermSelectedOptionId, onRecordOutcome],
  );

  const handleNextDermatomeQuestion = useCallback(() => {
    if (dermIndex + 1 >= dermQuestions.length) {
      const correctCount = dermResults.filter((r) => r.isCorrect).length;
      const totalCount = dermQuestions.length;
      const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
      let finalXp = dermTotalXp;
      if (accuracy >= 80 && totalCount > 0) {
        const bonusXp = 20;
        finalXp += bonusXp;
        setDermTotalXp((prev) => prev + bonusXp);
        const firstId = dermQuestions[0].target.myotomeMuscleIds[0] ?? 'm_deltoideus';
        onRecordOutcome(true, firstId, bonusXp);
      }
      if (onCompleteExamHistory) {
        const scopeLabel =
          dermScope === 'upper'
            ? 'Kończyna górna (C4–Th1)'
            : dermScope === 'lower'
              ? 'Kończyna dolna (L1–S2)'
              : 'Całe ciało (C4–S2)';
        onCompleteExamHistory({
          id: `derm_${Date.now()}`,
          date: getLocalDateKey(),
          mode: 'dermatomes',
          region: scopeLabel,
          correctCount,
          totalCount,
          accuracy,
          xpEarned: finalXp,
        });
      }
      setDermPhase('summary');
      return;
    }
    setDermIndex((prev) => prev + 1);
    setDermSelectedOptionId(null);
  }, [
    dermIndex,
    dermQuestions,
    dermResults,
    dermTotalXp,
    dermScope,
    onCompleteExamHistory,
    onRecordOutcome,
  ]);

  // Keyboard shortcuts for Dermatome 3D quiz (1–4 to pick option, Enter to continue)
  useEffect(() => {
    if (hubMode !== 'dermatomes' || dermPhase !== 'active' || !currentDermQ) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      const targetEl = ev.target as HTMLElement | null;
      if (targetEl?.tagName === 'INPUT' || targetEl?.tagName === 'TEXTAREA') return;
      if (ev.key === 'Enter' && dermSelectedOptionId !== null) {
        ev.preventDefault();
        handleNextDermatomeQuestion();
        return;
      }
      if (dermSelectedOptionId === null) {
        const idx = ['1', '2', '3', '4'].indexOf(ev.key);
        if (idx >= 0 && idx < currentDermQ.options.length) {
          ev.preventDefault();
          handleSelectDermatomeOption(currentDermQ.options[idx].id);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    hubMode,
    dermPhase,
    currentDermQ,
    dermSelectedOptionId,
    handleSelectDermatomeOption,
    handleNextDermatomeQuestion,
  ]);

  const startExamWithQuestions = (list: PinExamQuestion[]) => {
    if (list.length === 0) return;
    modelReadyRef.current = false;
    setQuestions(list);
    setCurrentIndex(0);
    setSelectedPart(null);
    setSelectedReverseOptionIdx(null);
    setReverseTypingInput('');
    setQuestionState('answering');
    setResults([]);
    setTotalXpEarned(0);
    setTimeLeft(timerSeconds);
    questionStartRef.current = Date.now();
    setPhase('active');
  };

  const handleStartExam = () => {
    const generated = buildPinExamQuestions(
      region,
      pool,
      Math.min(questionCount, maxAvailableForPool),
    );
    startExamWithQuestions(generated);
  };

  const commitEvaluation = (timedOut: boolean) => {
    if (!currentQuestion || questionState !== 'answering') return;
    const elapsedSeconds = Math.max(
      1,
      Math.round((Date.now() - questionStartRef.current) / 1000),
    );

    let isCorrect = false;
    let selectedLabel: string | null = null;

    if (hubMode === 'locate') {
      isCorrect = !timedOut && evaluatePinExamAnswer(currentQuestion, selectedPart);
      selectedLabel = selectedPart
        ? selectedPart.bilingualName || formatBilingualName(selectedPart.namePl, selectedPart.nameLt)
        : null;
    } else if (hubMode === 'identify') {
      if (reverseFormat === 'abcd') {
        const chosen =
          selectedReverseOptionIdx !== null ? reverseOptions[selectedReverseOptionIdx] : null;
        isCorrect = !timedOut && Boolean(chosen?.isCorrect);
        selectedLabel = chosen?.label ?? null;
      } else {
        isCorrect = !timedOut && evaluateReverseTypingAnswer(currentQuestion, reverseTypingInput);
        selectedLabel = reverseTypingInput.trim() || null;
      }
    }

    const xpGain = isCorrect ? 15 : 0;

    setQuestionState(isCorrect ? 'correct' : 'wrong');
    setTotalXpEarned((prev) => prev + xpGain);
    onRecordOutcome(isCorrect, currentQuestion.structureId, xpGain);

    setResults((prev) => [
      ...prev,
      {
        question: currentQuestion,
        selectedLabel,
        isCorrect,
        timedOut,
        elapsedSeconds,
      },
    ]);

    // In locate mode, if missed or timed out, immediately reveal & focus the true target structure on the 3D model
    if (hubMode === 'locate' && !isCorrect) {
      viewportRef.current?.selectAndFocusTarget?.({
        landmarkId: currentQuestion.landmarkId,
        structureId: currentQuestion.structureId,
        isolateIfMuscle: currentQuestion.kind === 'mesh',
        silent: true,
      });
    }
  };

  // Countdown timer effect when timerSeconds is enabled
  useEffect(() => {
    if (
      hubMode === 'srs' ||
      phase !== 'active' ||
      questionState !== 'answering' ||
      timerSeconds === null
    ) {
      return;
    }
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      commitEvaluation(true);
      return;
    }
    const id = window.setTimeout(() => {
      setTimeLeft((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubMode, phase, questionState, timeLeft, timerSeconds]);

  const handleNextQuestion = () => {
    if (currentIndex + 1 >= questions.length) {
      const correctSoFar = results.filter((r) => r.isCorrect).length;
      const accuracy =
        questions.length > 0 ? Math.round((correctSoFar / questions.length) * 100) : 0;
      let finalXp = totalXpEarned;
      if (accuracy >= 80 && questions.length > 0) {
        const bonusXp = 25;
        finalXp += bonusXp;
        setTotalXpEarned((prev) => prev + bonusXp);
        onRecordOutcome(true, questions[0].structureId, bonusXp);
      }

      if (onCompleteExamHistory && (hubMode === 'locate' || hubMode === 'identify')) {
        onCompleteExamHistory({
          id: `pin_${Date.now()}`,
          date: getLocalDateKey(),
          mode: hubMode,
          region: activeRegionMeta.label,
          correctCount: correctSoFar,
          totalCount: questions.length,
          accuracy,
          xpEarned: finalXp,
        });
      }

      setPhase('summary');
      return;
    }

    setCurrentIndex((prev) => prev + 1);
    setSelectedPart(null);
    setSelectedReverseOptionIdx(null);
    setReverseTypingInput('');
    setQuestionState('answering');
    setTimeLeft(timerSeconds);
    questionStartRef.current = Date.now();

    if (hubMode === 'locate') {
      viewportRef.current?.clearIsolatedMuscle?.();
      viewportRef.current?.resetCamera();
    }
  };

  // Keyboard shortcuts for Reverse Pin ('identify') mode
  useEffect(() => {
    if (hubMode !== 'identify' || phase !== 'active' || !currentQuestion) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      const targetEl = ev.target as HTMLElement | null;
      const isTypingField =
        targetEl?.tagName === 'INPUT' || targetEl?.tagName === 'TEXTAREA';

      if (ev.key === 'Enter') {
        if (questionState !== 'answering') {
          ev.preventDefault();
          handleNextQuestion();
          return;
        }
        if (reverseFormat === 'abcd' && selectedReverseOptionIdx !== null) {
          ev.preventDefault();
          commitEvaluation(false);
        } else if (reverseFormat === 'typing' && reverseTypingInput.trim().length > 0) {
          ev.preventDefault();
          commitEvaluation(false);
        }
        return;
      }

      if (!isTypingField && questionState === 'answering' && reverseFormat === 'abcd') {
        const idx = ['1', '2', '3', '4'].indexOf(ev.key);
        if (idx >= 0 && idx < reverseOptions.length) {
          ev.preventDefault();
          setSelectedReverseOptionIdx(idx);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // SRS session handlers
  const handleStartSrsSession = (includeAllFromDeck = false) => {
    const queue = includeAllFromDeck
      ? srsFilteredDeck.slice(0, 25)
      : buildSrsStudyQueue(srsFilteredDeck, srsProgress, getLocalDateKey(), 20);
    setSrsQueue(queue);
    setSrsFlipped(false);
    setSrsReviewedInSession(0);
    setSrsSessionXp(0);
    setSrsSessionStarted(true);
  };

  const currentSrsCard = srsQueue[0] ?? null;

  const handleRateSrsCard = useCallback(
    (rating: SrsRating) => {
      if (!currentSrsCard) return;
      const prevState = srsProgress[currentSrsCard.id];
      const nextState = applySrsReview(prevState, rating);
      const xpGain = rating === 'again' ? 2 : 5;
      onReviewSrsCard(currentSrsCard.id, nextState, xpGain);
      setSrsReviewedInSession((c) => c + 1);
      setSrsSessionXp((x) => x + xpGain);
      setSrsFlipped(false);

      setSrsQueue((prev) => {
        const [, ...rest] = prev;
        if (rating === 'again') {
          return [...rest, currentSrsCard];
        }
        return rest;
      });
    },
    [currentSrsCard, srsProgress, onReviewSrsCard],
  );

  // Keyboard shortcuts for SRS mode (Space to flip, 1-4 to rate)
  useEffect(() => {
    if (hubMode !== 'srs' || !srsSessionStarted || !currentSrsCard) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      const targetEl = ev.target as HTMLElement | null;
      if (targetEl?.tagName === 'INPUT' || targetEl?.tagName === 'TEXTAREA') return;

      if (ev.code === 'Space' && !srsFlipped) {
        ev.preventDefault();
        setSrsFlipped(true);
        return;
      }
      if (srsFlipped) {
        if (ev.key === '1') {
          ev.preventDefault();
          handleRateSrsCard('again');
        } else if (ev.key === '2') {
          ev.preventDefault();
          handleRateSrsCard('hard');
        } else if (ev.key === '3') {
          ev.preventDefault();
          handleRateSrsCard('good');
        } else if (ev.key === '4') {
          ev.preventDefault();
          handleRateSrsCard('easy');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hubMode, srsSessionStarted, currentSrsCard, srsFlipped, handleRateSrsCard]);

  // Top 5-mode switcher bar (rendered on setup & SRS screens)
  const renderModeSwitcher = () => (
    <div
      role="tablist"
      aria-label="Tryby Szpilek 3D, Dermatomów, Biomechaniki i Powtórek"
      className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5"
    >
      <button
        type="button"
        role="tab"
        aria-selected={hubMode === 'locate'}
        data-testid="pin-mode-locate"
        onClick={() => switchHubMode('locate')}
        className={`flex items-center gap-2.5 rounded-2xl border-2 border-b-4 px-4 py-3 text-left transition active:translate-y-0.5 active:border-b-2 ${
          hubMode === 'locate'
            ? 'border-emerald-700 bg-emerald-500 text-white shadow-sm'
            : 'border-[#d6e7dc] bg-white text-emerald-950 hover:border-emerald-400 dark:border-[#233d2f] dark:bg-[#112018] dark:text-emerald-50'
        }`}
      >
        <Crosshair className="h-5 w-5 shrink-0" />
        <div>
          <div className="font-display text-sm font-extrabold">Wskaż na 3D</div>
          <div
            className={`text-[11px] font-medium ${
              hubMode === 'locate' ? 'text-white/90' : 'text-[#52695b] dark:text-[#94b0a0]'
            }`}
          >
            Kliknij strukturę lub PP/PK
          </div>
        </div>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={hubMode === 'identify'}
        data-testid="pin-mode-identify"
        onClick={() => switchHubMode('identify')}
        className={`flex items-center gap-2.5 rounded-2xl border-2 border-b-4 px-4 py-3 text-left transition active:translate-y-0.5 active:border-b-2 ${
          hubMode === 'identify'
            ? 'border-emerald-700 bg-emerald-500 text-white shadow-sm'
            : 'border-[#d6e7dc] bg-white text-emerald-950 hover:border-emerald-400 dark:border-[#233d2f] dark:bg-[#112018] dark:text-emerald-50'
        }`}
      >
        <Eye className="h-5 w-5 shrink-0" />
        <div>
          <div className="font-display text-sm font-extrabold">Co wskazuje szpilka?</div>
          <div
            className={`text-[11px] font-medium ${
              hubMode === 'identify' ? 'text-white/90' : 'text-[#52695b] dark:text-[#94b0a0]'
            }`}
          >
            Odwrócone szpilki (ABCD / pisanie)
          </div>
        </div>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={hubMode === 'dermatomes'}
        data-testid="pin-mode-dermatomes"
        onClick={() => switchHubMode('dermatomes')}
        className={`flex items-center gap-2.5 rounded-2xl border-2 border-b-4 px-3.5 py-3 text-left transition active:translate-y-0.5 active:border-b-2 ${
          hubMode === 'dermatomes'
            ? 'border-amber-700 bg-amber-500 text-white shadow-sm'
            : 'border-[#d6e7dc] bg-white text-emerald-950 hover:border-amber-400 dark:border-[#233d2f] dark:bg-[#112018] dark:text-emerald-50'
        }`}
      >
        <Activity className="h-5 w-5 shrink-0" />
        <div>
          <div className="font-display text-sm font-extrabold">Dermatomy 3D</div>
          <div
            className={`text-[11px] font-medium ${
              hubMode === 'dermatomes' ? 'text-white/90' : 'text-[#52695b] dark:text-[#94b0a0]'
            }`}
          >
            Korzenie C4–S2 na 3D
          </div>
        </div>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={hubMode === 'biomechanics'}
        data-testid="pin-mode-biomechanics"
        onClick={() => switchHubMode('biomechanics')}
        className={`flex items-center gap-2.5 rounded-2xl border-2 border-b-4 px-3.5 py-3 text-left transition active:translate-y-0.5 active:border-b-2 ${
          hubMode === 'biomechanics'
            ? 'border-emerald-700 bg-emerald-600 text-white shadow-sm'
            : 'border-[#d6e7dc] bg-white text-emerald-950 hover:border-emerald-400 dark:border-[#233d2f] dark:bg-[#112018] dark:text-emerald-50'
        }`}
      >
        <Compass className="h-5 w-5 shrink-0" />
        <div>
          <div className="font-display text-sm font-extrabold">Biomechanika 3D</div>
          <div
            className={`text-[11px] font-medium ${
              hubMode === 'biomechanics' ? 'text-white/90' : 'text-[#52695b] dark:text-[#94b0a0]'
            }`}
          >
            Ruchy, SFTR i łańcuchy
          </div>
        </div>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={hubMode === 'srs'}
        data-testid="pin-mode-srs"
        onClick={() => switchHubMode('srs')}
        className={`flex items-center gap-2.5 rounded-2xl border-2 border-b-4 px-3.5 py-3 text-left transition active:translate-y-0.5 active:border-b-2 ${
          hubMode === 'srs'
            ? 'border-green-700 bg-green-600 text-white shadow-sm'
            : 'border-[#d6e7dc] bg-white text-emerald-950 hover:border-emerald-400 dark:border-[#233d2f] dark:bg-[#112018] dark:text-emerald-50'
        }`}
      >
        <Layers className="h-5 w-5 shrink-0" />
        <div>
          <div className="font-display text-sm font-extrabold">Fiszki SRS</div>
          <div
            className={`text-[11px] font-medium ${
              hubMode === 'srs' ? 'text-white/90' : 'text-[#52695b] dark:text-[#94b0a0]'
            }`}
          >
            Powtórki SM-2 ({getAllSrsCards().length} kart)
          </div>
        </div>
      </button>
    </div>
  );

  // =========================================================================
  // MODE 3: QUIZ DERMATOMÓW I MIOTOMÓW 3D (C4–S2)
  // =========================================================================
  if (hubMode === 'dermatomes') {
    if (dermPhase === 'setup') {
      const scopeOptions: Array<{ id: DermatomeQuizScope; label: string; desc: string }> = [
        {
          id: 'all',
          label: 'Całe ciało (C4–S2)',
          desc: `Wszystkie ${DERMATOME_MYOTOME_LEVELS.length} kluczowych poziomów korzeniowych (szyjne, piersiowe, lędźwiowo-krzyżowe)`,
        },
        {
          id: 'upper',
          label: 'Kończyna górna (C4–Th1)',
          desc: 'Korzenie szyjne i Th1 — badania neurologiczne barku, ramienia i ręki (6 poziomów)',
        },
        {
          id: 'lower',
          label: 'Kończyna dolna (L1–S2)',
          desc: 'Korzenie lędźwiowe i krzyżowe — rwa kulszowa, rwa udowa, dyskopatie (7 poziomów)',
        },
      ];

      const displayModeOptions: Array<{
        id: DermatomeDisplayMode;
        label: string;
        desc: string;
      }> = [
        {
          id: 'both',
          label: 'Dermatom + Miotom',
          desc: 'Podświetlony pas skórny i odpowiadające mu mięśnie wskaźnikowe jednocześnie',
        },
        {
          id: 'dermatome',
          label: 'Tylko Dermatom (skóra)',
          desc: 'Rozpoznaj korzeń wyłącznie na podstawie obszaru unerwienia czuciowego skóry',
        },
        {
          id: 'myotome',
          label: 'Tylko Miotom (mięśnie)',
          desc: 'Rozpoznaj korzeń wyłącznie po podświetlonych mięśniach wskaźnikowych 3D',
        },
      ];

      return (
        <div
          data-testid="dermatome-quiz-setup-view"
          className="mx-auto w-full max-w-4xl space-y-6 pb-24 md:pb-12"
        >
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
              <Activity className="h-3.5 w-3.5" />
              <span>Neurologia kliniczna 3D • C4–S2</span>
            </div>
            <h1 className="mt-2 font-display text-2xl font-extrabold text-emerald-950 dark:text-white sm:text-3xl">
              Quiz Dermatomów i Miotomów 3D
            </h1>
            <p className="mt-1 text-sm text-[#354c3f] dark:text-[#94b0a0]">
              Rozpoznawaj poziomy korzeniowe na żywym modelu 3D bez podpowiedzi na etykiecie. Po każdej odpowiedzi otrzymasz pełną kartę radikulopatii, odruchów i dyskopatii.
            </p>
          </div>

          {renderModeSwitcher()}

          {/* Scope selector */}
          <section className="space-y-3 rounded-2xl border-2 border-[#d6e7dc] bg-white p-5 dark:border-[#233d2f] dark:bg-[#112018]">
            <h2 className="font-display text-sm font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
              1. Zakres korzeni rdzeniowych
            </h2>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {scopeOptions.map((opt) => {
                const selected = dermScope === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    data-testid={`derm-scope-${opt.id}`}
                    onClick={() => setDermScope(opt.id)}
                    className={`flex flex-col items-start rounded-2xl border-2 border-b-4 p-3.5 text-left transition active:translate-y-0.5 active:border-b-2 ${
                      selected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-white'
                        : 'border-[#d6e7dc] bg-[#f4faf6] text-[#16291f] hover:border-emerald-400 dark:border-[#294737] dark:bg-[#182b21] dark:text-[#e6f2ea]'
                    }`}
                  >
                    <span className="font-display text-sm font-extrabold">{opt.label}</span>
                    <span className="mt-1 text-xs text-[#52695b] dark:text-[#94b0a0]">
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Visual presentation mode */}
          <section className="space-y-3 rounded-2xl border-2 border-[#d6e7dc] bg-white p-5 dark:border-[#233d2f] dark:bg-[#112018]">
            <h2 className="font-display text-sm font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
              2. Co ma być podświetlone na modelu 3D?
            </h2>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {displayModeOptions.map((opt) => {
                const selected = dermDisplayMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    data-testid={`derm-mode-${opt.id}`}
                    onClick={() => setDermDisplayMode(opt.id)}
                    className={`flex flex-col items-start rounded-2xl border-2 border-b-4 p-3.5 text-left transition active:translate-y-0.5 active:border-b-2 ${
                      selected
                        ? 'border-amber-600 bg-amber-50 text-amber-950 dark:border-amber-500 dark:bg-amber-950/50 dark:text-white'
                        : 'border-[#d6e7dc] bg-[#f4faf6] text-[#16291f] hover:border-amber-400 dark:border-[#294737] dark:bg-[#182b21] dark:text-[#e6f2ea]'
                    }`}
                  >
                    <span className="font-display text-sm font-extrabold">{opt.label}</span>
                    <span className="mt-1 text-xs text-[#52695b] dark:text-[#94b0a0]">
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Question count & start CTA */}
          <section className="flex flex-col gap-4 rounded-2xl border-2 border-[#d6e7dc] bg-white p-5 sm:flex-row sm:items-center sm:justify-between dark:border-[#233d2f] dark:bg-[#112018]">
            <div>
              <h2 className="font-display text-sm font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
                3. Liczba pytań (dostępne: {dermAvailableCount})
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {QUESTION_COUNTS.map((cnt) => {
                  const effective = Math.min(cnt, dermAvailableCount);
                  const selected = dermCount === cnt;
                  return (
                    <button
                      key={cnt}
                      type="button"
                      data-testid={`derm-count-${cnt}`}
                      onClick={() => setDermCount(cnt)}
                      className={`font-mono-tabular rounded-xl border-2 px-4 py-2 text-sm font-extrabold transition ${
                        selected
                          ? 'border-emerald-600 bg-emerald-500 text-white'
                          : 'border-[#d6e7dc] bg-[#f4faf6] text-[#16291f] hover:border-emerald-400 dark:border-[#294737] dark:bg-[#182b21] dark:text-emerald-50'
                      }`}
                    >
                      {effective} pytań
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              data-testid="start-dermatome-quiz-btn"
              onClick={handleStartDermatomeQuiz}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-6 py-3.5 font-display text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Rozpocznij quiz 3D</span>
            </button>
          </section>
        </div>
      );
    }

    if (dermPhase === 'summary') {
      const correctCount = dermResults.filter((r) => r.isCorrect).length;
      const totalCount = dermQuestions.length;
      const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

      return (
        <div
          data-testid="dermatome-quiz-summary-view"
          className="mx-auto w-full max-w-3xl space-y-6 pb-24 md:pb-12"
        >
          <div className="rounded-3xl border-2 border-emerald-200 bg-white p-6 text-center shadow-sm dark:border-emerald-800 dark:bg-[#112018]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border-b-4 border-emerald-700 bg-emerald-500 text-white">
              <Award className="h-7 w-7" />
            </div>
            <h1 className="mt-3 font-display text-2xl font-extrabold text-emerald-950 dark:text-white">
              Quiz Dermatomów i Miotomów ukończony!
            </h1>
            <p className="mt-1 text-sm text-[#52695b] dark:text-[#94b0a0]">
              Wynik został zapisany w statystykach Twojego konta.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-[#d6e7dc] bg-[#f4faf6] p-3 dark:border-[#233d2f] dark:bg-[#182b21]">
                <div className="font-mono-tabular text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
                  {correctCount}/{totalCount}
                </div>
                <div className="text-xs font-bold text-[#52695b] dark:text-[#94b0a0]">Poprawne</div>
              </div>
              <div className="rounded-2xl border border-[#d6e7dc] bg-[#f4faf6] p-3 dark:border-[#233d2f] dark:bg-[#182b21]">
                <div className="font-mono-tabular text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
                  {accuracy}%
                </div>
                <div className="text-xs font-bold text-[#52695b] dark:text-[#94b0a0]">
                  Skuteczność
                </div>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/70 dark:bg-amber-950/40">
                <div className="font-mono-tabular text-2xl font-extrabold text-amber-600 dark:text-amber-400">
                  +{dermTotalXp} XP
                </div>
                <div className="text-xs font-bold text-amber-800 dark:text-amber-300">
                  Zdobyte XP
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                data-testid="derm-quiz-restart-btn"
                onClick={handleStartDermatomeQuiz}
                className="inline-flex items-center gap-2 rounded-2xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-5 py-2.5 text-sm font-extrabold text-white transition hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Jeszcze raz</span>
              </button>
              <button
                type="button"
                onClick={() => setDermPhase('setup')}
                className="inline-flex items-center gap-2 rounded-2xl border-2 border-b-4 border-[#c2d8ca] bg-white px-5 py-2.5 text-sm font-extrabold text-[#16291f] transition hover:border-emerald-400 dark:border-[#294737] dark:bg-[#182b21] dark:text-emerald-50"
              >
                <span>Zmień ustawienia</span>
              </button>
            </div>
          </div>

          <div className="space-y-2.5 rounded-2xl border-2 border-[#d6e7dc] bg-white p-5 dark:border-[#233d2f] dark:bg-[#112018]">
            <h2 className="font-display text-sm font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
              Podsumowanie korzeni
            </h2>
            <div className="space-y-2">
              {dermResults.map((res, idx) => (
                <div
                  key={`${res.question.id}_${idx}`}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs ${
                    res.isCorrect
                      ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-800/70 dark:bg-emerald-950/30'
                      : 'border-rose-200 bg-rose-50/70 dark:border-rose-800/70 dark:bg-rose-950/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {res.isCorrect ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                    )}
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: res.question.target.accentHex }}
                    />
                    <span className="font-extrabold text-[#16291f] dark:text-white">
                      {res.question.target.labelPl}
                    </span>
                    <span className="text-[#52695b] dark:text-[#94b0a0]">
                      — {res.question.target.keyMovementPl}
                    </span>
                  </div>
                  {!res.isCorrect && (
                    <span className="font-bold text-rose-700 dark:text-rose-300">
                      Wybrano: {res.selectedRootId}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // ACTIVE DERMATOME 3D QUIZ
    const answered = dermSelectedOptionId !== null;
    const isCorrectSelection =
      answered && currentDermQ !== null && dermSelectedOptionId === currentDermQ.target.id;

    return (
      <div
        data-testid="dermatome-quiz-active-view"
        className="mx-auto w-full max-w-6xl space-y-4 pb-24 md:pb-10"
      >
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-[#d6e7dc] bg-white px-4 py-3 dark:border-[#233d2f] dark:bg-[#112018]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDermPhase('setup')}
              aria-label="Zakończ quiz dermatomów"
              className="rounded-xl border border-[#d6e7dc] p-1.5 text-[#52695b] transition hover:bg-[#ebf5ee] dark:border-[#294737] dark:text-[#94b0a0] dark:hover:bg-[#182b21]"
            >
              <X className="h-4 w-4" />
            </button>
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Quiz Dermatomy i Miotomy 3D
              </div>
              <div className="font-mono-tabular text-sm font-extrabold text-emerald-950 dark:text-white">
                Pytanie {dermIndex + 1} / {dermQuestions.length}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-amber-100 px-3 py-1 font-mono-tabular text-xs font-extrabold text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
              +{dermTotalXp} XP
            </span>
          </div>
        </div>

        {/* Main 2-column quiz layout: 3D model + ABCD & Clinical Card */}
        {currentDermQ && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <AnatomyViewport3D
                region={currentDermQ.target.recommendedRegion}
                onSelectPart={() => {}}
                isDarkMode={isDarkMode}
                enableExtendedLayers
                showMuscleGroupingToggle={false}
                showClippingControl={false}
                hideHoverLabel
                hideHotspotOverlay
                dermatomeHighlight={{
                  rootId: currentDermQ.target.id,
                  mode: dermDisplayMode,
                  side: 'both',
                  maskedLabel: !answered,
                }}
                heightClassName="h-[360px] sm:h-[440px] lg:h-[520px]"
              />
            </div>

            <div className="flex flex-col gap-4 lg:col-span-5">
              <div className="rounded-2xl border-2 border-[#d6e7dc] bg-white p-5 dark:border-[#233d2f] dark:bg-[#112018]">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-extrabold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                  <Activity className="h-3.5 w-3.5" />
                  <span>
                    {dermDisplayMode === 'dermatome'
                      ? 'Podświetlony dermatom (skóra)'
                      : dermDisplayMode === 'myotome'
                        ? 'Podświetlony miotom (mięśnie)'
                        : 'Podświetlony dermatom + miotom'}
                  </span>
                </div>

                <h2 className="mt-3 font-display text-lg font-extrabold text-emerald-950 dark:text-white">
                  {currentDermQ.prompt}
                </h2>
                <p className="mt-1 text-xs text-[#52695b] dark:text-[#94b0a0]">
                  Obracaj i przybliżaj model 3D, aby dokładnie ocenić przebieg strefy skórnej lub mięśni wskaźnikowych. Skróty klawiszowe: 1–4.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  {currentDermQ.options.map((opt, idx) => {
                    const isPicked = dermSelectedOptionId === opt.id;
                    const isTrueTarget = opt.id === currentDermQ.target.id;

                    let btnTone =
                      'border-[#d6e7dc] bg-[#f4faf6] text-[#16291f] hover:border-emerald-500 hover:bg-emerald-50 dark:border-[#294737] dark:bg-[#182b21] dark:text-emerald-50';
                    if (answered) {
                      if (isTrueTarget) {
                        btnTone =
                          'border-emerald-600 bg-emerald-500 text-white shadow-sm';
                      } else if (isPicked) {
                        btnTone =
                          'border-rose-600 bg-rose-500 text-white shadow-sm';
                      } else {
                        btnTone =
                          'border-[#d6e7dc] bg-[#f4faf6]/60 text-[#7a9083] opacity-65 dark:border-[#233d2f] dark:bg-[#182b21]/60 dark:text-[#6f8a7a]';
                      }
                    }

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={answered}
                        data-testid={`derm-quiz-option-${idx}`}
                        onClick={() => handleSelectDermatomeOption(opt.id)}
                        className={`flex items-center justify-between gap-2 rounded-2xl border-2 border-b-4 px-4 py-3.5 text-left transition active:translate-y-0.5 active:border-b-2 disabled:cursor-default ${btnTone}`}
                      >
                        <div>
                          <div className="font-display text-base font-extrabold">{opt.id}</div>
                          <div
                            className={`text-[11px] font-semibold ${
                              answered && (isTrueTarget || isPicked)
                                ? 'text-white/90'
                                : 'text-[#52695b] dark:text-[#94b0a0]'
                            }`}
                          >
                            {opt.groupLabelPl}
                          </div>
                        </div>
                        <span
                          className={`font-mono-tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold ${
                            answered && (isTrueTarget || isPicked)
                              ? 'bg-white/20 text-white'
                              : 'bg-white text-emerald-800 dark:bg-[#112018] dark:text-emerald-300'
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Instant clinical feedback card after answering */}
              {answered && (
                <div
                  data-testid="derm-quiz-feedback"
                  className={`space-y-3 rounded-2xl border-2 p-4 ${
                    isCorrectSelection
                      ? 'border-emerald-300 bg-emerald-50/80 dark:border-emerald-700 dark:bg-emerald-950/40'
                      : 'border-rose-300 bg-rose-50/80 dark:border-rose-700 dark:bg-rose-950/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isCorrectSelection ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                      )}
                      <span className="font-display text-sm font-extrabold text-[#16291f] dark:text-white">
                        {isCorrectSelection
                          ? `Brawo! To ${currentDermQ.target.labelPl} (+15 XP)`
                          : `Poprawna odpowiedź: ${currentDermQ.target.labelPl}`}
                      </span>
                    </div>
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: currentDermQ.target.accentHex }}
                    />
                  </div>

                  <div className="space-y-1.5 text-xs text-[#16291f] dark:text-emerald-50">
                    <div>
                      <span className="font-extrabold text-amber-800 dark:text-amber-300">
                        Dermatom:{' '}
                      </span>
                      {currentDermQ.target.sensoryLandmarkPl}
                    </div>
                    <div>
                      <span className="font-extrabold text-emerald-800 dark:text-emerald-300">
                        Miotom:{' '}
                      </span>
                      {currentDermQ.target.keyMusclePl} ({currentDermQ.target.keyMovementPl})
                    </div>
                    <div>
                      <span className="font-extrabold text-[#354c3f] dark:text-[#b4cdbe]">
                        Odruch:{' '}
                      </span>
                      {currentDermQ.target.reflexPl}
                    </div>
                    <div className="rounded-xl border border-rose-200/80 bg-white/80 p-2.5 dark:border-rose-800/60 dark:bg-[#112018]/80">
                      <div className="flex items-center gap-1.5 font-extrabold text-rose-800 dark:text-rose-300">
                        <Stethoscope className="h-3.5 w-3.5" />
                        <span>Radikulopatia ({currentDermQ.target.commonDiscLevelPl})</span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-[#354c3f] dark:text-[#c7dbcf]">
                        {currentDermQ.target.radiculopathySignsPl}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    data-testid="derm-quiz-next-btn"
                    onClick={handleNextDermatomeQuestion}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-5 py-3 font-display text-sm font-extrabold text-white transition hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2"
                  >
                    <span>
                      {dermIndex + 1 >= dermQuestions.length
                        ? 'Zobacz podsumowanie'
                        : 'Następny korzeń'}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // MODE 4: QUIZ BIOMECHANIKI 3D (RUCHY, SFTR I ŁAŃCUCHY MIĘŚNIOWE)
  // =========================================================================
  if (hubMode === 'biomechanics') {
    if (biomPhase === 'setup') {
      const scopeOptions: Array<{ id: BiomechanicsQuizScope; label: string; desc: string }> = [
        {
          id: 'all',
          label: 'Wszystkie stawy (24 ruchy)',
          desc: 'Bark, łokieć, przedramię, nadgarstek, biodro, kolano, staw skokowy i kręgosłup',
        },
        {
          id: 'upper',
          label: 'Kończyna górna (11 ruchów)',
          desc: 'Staw ramienny, staw łokciowy, supinacja/pronacja i nadgarstek',
        },
        {
          id: 'lower_spine',
          label: 'Kończyna dolna i tułów (13 ruchów)',
          desc: 'Staw biodrowy, staw kolanowy, staw skokowy/stopa i kręgosłup',
        },
      ];

      return (
        <div
          data-testid="biomechanics-quiz-setup-view"
          className="mx-auto w-full max-w-4xl space-y-6 pb-24 md:pb-12"
        >
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
              <Compass className="h-3.5 w-3.5" />
              <span>Kinezyterapia i Biomechanika 3D • SFTR + Kaltenborn</span>
            </div>
            <h1 className="mt-2 font-display text-2xl font-extrabold text-emerald-950 dark:text-white sm:text-3xl">
              Quiz Biomechaniki 3D — Łańcuchy Mięśniowe i SFTR
            </h1>
            <p className="mt-1 text-sm text-[#354c3f] dark:text-[#94b0a0]">
              Mieszany sprawdzian 3D bez spoilerów: rozpoznawanie ruchu po podświetlonych agonistach 3D, dobór antagonistów oraz normy zapisu SFTR z płaszczyzną i osią obrotu.
            </p>
          </div>

          {renderModeSwitcher()}

          <section className="space-y-3 rounded-2xl border-2 border-[#d6e7dc] bg-white p-5 dark:border-[#233d2f] dark:bg-[#112018]">
            <h2 className="font-display text-sm font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
              1. Zakres stawów
            </h2>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {scopeOptions.map((opt) => {
                const selected = biomScope === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    data-testid={`biom-scope-${opt.id}`}
                    onClick={() => setBiomScope(opt.id)}
                    className={`flex flex-col items-start rounded-2xl border-2 border-b-4 p-3.5 text-left transition active:translate-y-0.5 active:border-b-2 ${
                      selected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-white'
                        : 'border-[#d6e7dc] bg-[#f4faf6] text-[#16291f] hover:border-emerald-400 dark:border-[#294737] dark:bg-[#182b21] dark:text-[#e6f2ea]'
                    }`}
                  >
                    <span className="font-display text-sm font-extrabold">{opt.label}</span>
                    <span className="mt-1 text-xs text-[#52695b] dark:text-[#94b0a0]">
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-4 rounded-2xl border-2 border-[#d6e7dc] bg-white p-5 sm:flex-row sm:items-center sm:justify-between dark:border-[#233d2f] dark:bg-[#112018]">
            <div>
              <h2 className="font-display text-sm font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
                2. Liczba pytań (dostępne: {biomAvailableCount})
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {QUESTION_COUNTS.map((cnt) => {
                  const effective = Math.min(cnt, biomAvailableCount);
                  const selected = biomCount === cnt;
                  return (
                    <button
                      key={cnt}
                      type="button"
                      data-testid={`biom-count-${cnt}`}
                      onClick={() => setBiomCount(cnt)}
                      className={`font-mono-tabular rounded-xl border-2 px-4 py-2 text-sm font-extrabold transition ${
                        selected
                          ? 'border-emerald-600 bg-emerald-500 text-white'
                          : 'border-[#d6e7dc] bg-[#f4faf6] text-[#16291f] hover:border-emerald-400 dark:border-[#294737] dark:bg-[#182b21] dark:text-emerald-50'
                      }`}
                    >
                      {effective} pytań
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              data-testid="start-biomechanics-quiz-btn"
              onClick={handleStartBiomechanicsQuiz}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-6 py-3.5 font-display text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Rozpocznij quiz biomechaniczny</span>
            </button>
          </section>
        </div>
      );
    }

    if (biomPhase === 'summary') {
      const correctCount = biomResults.filter((r) => r.isCorrect).length;
      const totalCount = biomQuestions.length;
      const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

      return (
        <div
          data-testid="biomechanics-quiz-summary-view"
          className="mx-auto w-full max-w-3xl space-y-6 pb-24 md:pb-12"
        >
          <div className="rounded-3xl border-2 border-emerald-200 bg-white p-6 text-center shadow-sm dark:border-emerald-800 dark:bg-[#112018]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border-b-4 border-emerald-700 bg-emerald-500 text-white">
              <Award className="h-7 w-7" />
            </div>
            <h1 className="mt-3 font-display text-2xl font-extrabold text-emerald-950 dark:text-white">
              Quiz Biomechaniki 3D ukończony!
            </h1>
            <p className="mt-1 text-sm text-[#52695b] dark:text-[#94b0a0]">
              Wynik został zapisany w statystykach Twojego konta.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-[#d6e7dc] bg-[#f4faf6] p-3 dark:border-[#233d2f] dark:bg-[#182b21]">
                <div className="font-mono-tabular text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
                  {correctCount}/{totalCount}
                </div>
                <div className="text-xs font-bold text-[#52695b] dark:text-[#94b0a0]">Poprawne</div>
              </div>
              <div className="rounded-2xl border border-[#d6e7dc] bg-[#f4faf6] p-3 dark:border-[#233d2f] dark:bg-[#182b21]">
                <div className="font-mono-tabular text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
                  {accuracy}%
                </div>
                <div className="text-xs font-bold text-[#52695b] dark:text-[#94b0a0]">
                  Skuteczność
                </div>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/70 dark:bg-amber-950/40">
                <div className="font-mono-tabular text-2xl font-extrabold text-amber-600 dark:text-amber-400">
                  +{biomTotalXp} XP
                </div>
                <div className="text-xs font-bold text-amber-800 dark:text-amber-300">
                  Zdobyte XP
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                data-testid="biom-quiz-restart-btn"
                onClick={handleStartBiomechanicsQuiz}
                className="inline-flex items-center gap-2 rounded-2xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-5 py-2.5 text-sm font-extrabold text-white transition hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Jeszcze raz</span>
              </button>
              <button
                type="button"
                onClick={() => setBiomPhase('setup')}
                className="inline-flex items-center gap-2 rounded-2xl border-2 border-b-4 border-[#c2d8ca] bg-white px-5 py-2.5 text-sm font-extrabold text-[#16291f] transition hover:border-emerald-400 dark:border-[#294737] dark:bg-[#182b21] dark:text-emerald-50"
              >
                <span>Zmień ustawienia</span>
              </button>
            </div>
          </div>

          <div className="space-y-2.5 rounded-2xl border-2 border-[#d6e7dc] bg-white p-5 dark:border-[#233d2f] dark:bg-[#112018]">
            <h2 className="font-display text-sm font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
              Podsumowanie ruchów i norm SFTR
            </h2>
            <div className="space-y-2">
              {biomResults.map((res, idx) => (
                <div
                  key={`${res.question.id}_${idx}`}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs ${
                    res.isCorrect
                      ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-800/70 dark:bg-emerald-950/30'
                      : 'border-rose-200 bg-rose-50/70 dark:border-rose-800/70 dark:bg-rose-950/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {res.isCorrect ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                    )}
                    <span className="font-extrabold text-[#16291f] dark:text-white">
                      {res.question.movement.namePl}
                    </span>
                    <span className="font-mono-tabular text-emerald-700 dark:text-emerald-300">
                      ({res.question.movement.sftrCode})
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-[#52695b] dark:text-[#94b0a0]">
                    {res.question.kindBadgePl}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // ACTIVE BIOMECHANICS 3D QUIZ
    const answered = biomSelectedOptionId !== null;
    const pickedOpt = currentBiomQ?.options.find((o) => o.id === biomSelectedOptionId) ?? null;
    const isCorrectSelection = Boolean(pickedOpt?.isCorrect);

    return (
      <div
        data-testid="biomechanics-quiz-active-view"
        className="mx-auto w-full max-w-6xl space-y-4 pb-24 md:pb-10"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-[#d6e7dc] bg-white px-4 py-3 dark:border-[#233d2f] dark:bg-[#112018]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setBiomPhase('setup')}
              aria-label="Zakończ quiz biomechaniki"
              className="rounded-xl border border-[#d6e7dc] p-1.5 text-[#52695b] transition hover:bg-[#ebf5ee] dark:border-[#294737] dark:text-[#94b0a0] dark:hover:bg-[#182b21]"
            >
              <X className="h-4 w-4" />
            </button>
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Quiz Biomechaniki 3D
              </div>
              <div className="font-mono-tabular text-sm font-extrabold text-emerald-950 dark:text-white">
                Pytanie {biomIndex + 1} / {biomQuestions.length}
              </div>
            </div>
          </div>

          <span className="rounded-xl bg-amber-100 px-3 py-1 font-mono-tabular text-xs font-extrabold text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
            +{biomTotalXp} XP
          </span>
        </div>

        {currentBiomQ && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <AnatomyViewport3D
                region={currentBiomQ.movement.recommendedRegion}
                onSelectPart={() => {}}
                isDarkMode={isDarkMode}
                enableExtendedLayers
                showMuscleGroupingToggle={false}
                showClippingControl={false}
                hideHoverLabel
                hideHotspotOverlay
                biomechanicsHighlight={{
                  movementId: currentBiomQ.movement.id,
                  side: currentBiomQ.movement.defaultSide,
                  showAgonists: answered ? true : currentBiomQ.showAgonists,
                  showSynergists: answered ? true : currentBiomQ.showSynergists,
                  showAntagonists: answered ? true : currentBiomQ.showAntagonists,
                  showPlaneHelper: answered ? true : currentBiomQ.showPlaneHelper,
                  maskedLabel: !answered,
                }}
                heightClassName="h-[360px] sm:h-[440px] lg:h-[520px]"
              />
            </div>

            <div className="flex flex-col gap-4 lg:col-span-5">
              <div className="rounded-2xl border-2 border-[#d6e7dc] bg-white p-5 dark:border-[#233d2f] dark:bg-[#112018]">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-extrabold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                  <Compass className="h-3.5 w-3.5" />
                  <span>{currentBiomQ.kindBadgePl}</span>
                </div>

                <h2 className="mt-3 font-display text-base font-extrabold leading-snug text-emerald-950 dark:text-white">
                  {currentBiomQ.promptPl}
                </h2>
                <p className="mt-1 text-xs text-[#52695b] dark:text-[#94b0a0]">
                  Obracaj i przybliżaj model 3D, aby ocenić przebieg włókien mięśniowych i płaszczyznę ruchu. Skróty: 1–4.
                </p>

                <div className="mt-4 space-y-2.5">
                  {currentBiomQ.options.map((opt, idx) => {
                    const isPicked = biomSelectedOptionId === opt.id;
                    let btnTone =
                      'border-[#d6e7dc] bg-[#f4faf6] text-[#16291f] hover:border-emerald-500 hover:bg-emerald-50 dark:border-[#294737] dark:bg-[#182b21] dark:text-emerald-50';
                    if (answered) {
                      if (opt.isCorrect) {
                        btnTone = 'border-emerald-600 bg-emerald-500 text-white shadow-sm';
                      } else if (isPicked) {
                        btnTone = 'border-rose-600 bg-rose-500 text-white shadow-sm';
                      } else {
                        btnTone =
                          'border-[#d6e7dc] bg-[#f4faf6]/60 text-[#7a9083] opacity-65 dark:border-[#233d2f] dark:bg-[#182b21]/60 dark:text-[#6f8a7a]';
                      }
                    }

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={answered}
                        data-testid={`biom-quiz-option-${idx}`}
                        onClick={() => handleSelectBiomechanicsOption(opt.id)}
                        className={`flex w-full items-center justify-between gap-2.5 rounded-2xl border-2 border-b-4 px-4 py-3 text-left transition active:translate-y-0.5 active:border-b-2 disabled:cursor-default ${btnTone}`}
                      >
                        <div className="min-w-0">
                          <div className="font-display text-sm font-extrabold">{opt.label}</div>
                          {opt.subtitle && (
                            <div
                              className={`text-[11px] font-medium ${
                                answered && (opt.isCorrect || isPicked)
                                  ? 'text-white/90'
                                  : 'text-[#52695b] dark:text-[#94b0a0]'
                              }`}
                            >
                              {opt.subtitle}
                            </div>
                          )}
                        </div>
                        <span
                          className={`font-mono-tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold ${
                            answered && (opt.isCorrect || isPicked)
                              ? 'bg-white/20 text-white'
                              : 'bg-white text-emerald-800 dark:bg-[#112018] dark:text-emerald-300'
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {answered && (
                <div
                  data-testid="biom-quiz-feedback"
                  className={`space-y-3 rounded-2xl border-2 p-4 ${
                    isCorrectSelection
                      ? 'border-emerald-300 bg-emerald-50/80 dark:border-emerald-700 dark:bg-emerald-950/40'
                      : 'border-rose-300 bg-rose-50/80 dark:border-rose-700 dark:bg-rose-950/40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isCorrectSelection ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                    )}
                    <span className="font-display text-sm font-extrabold text-[#16291f] dark:text-white">
                      {isCorrectSelection
                        ? `Brawo! ${currentBiomQ.movement.namePl} (+15 XP)`
                        : `Poprawnie: ${currentBiomQ.options.find((o) => o.isCorrect)?.label}`}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-[#16291f] dark:text-emerald-50">
                    <div>
                      <span className="font-extrabold text-emerald-800 dark:text-emerald-300">
                        SFTR i płaszczyzna:{' '}
                      </span>
                      {currentBiomQ.movement.sftrCode} • {currentBiomQ.movement.planeLabelPl} ({currentBiomQ.movement.axisLabelPl})
                    </div>
                    <div>
                      <span className="font-extrabold text-emerald-800 dark:text-emerald-300">
                        Agoniści:{' '}
                      </span>
                      {currentBiomQ.movement.agonistIds
                        .map((id) => ANATOMY_MAP[id]?.namePl ?? id)
                        .join(', ')}
                    </div>
                    <div>
                      <span className="font-extrabold text-rose-800 dark:text-rose-300">
                        Antagoniści:{' '}
                      </span>
                      {currentBiomQ.movement.antagonistIds
                        .map((id) => ANATOMY_MAP[id]?.namePl ?? id)
                        .join(', ')}
                    </div>
                    <div className="rounded-xl border border-amber-200/80 bg-white/85 p-2.5 text-[11px] leading-relaxed text-[#354c3f] dark:border-amber-800/60 dark:bg-[#112018]/85 dark:text-[#c7dbcf]">
                      <span className="font-extrabold text-amber-800 dark:text-amber-300">
                        Reguła wklęsło-wypukła:{' '}
                      </span>
                      {currentBiomQ.movement.convexConcaveRulePl}
                    </div>
                  </div>

                  <button
                    type="button"
                    data-testid="biom-quiz-next-btn"
                    onClick={handleNextBiomechanicsQuestion}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-5 py-3 font-display text-sm font-extrabold text-white transition hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2"
                  >
                    <span>
                      {biomIndex + 1 >= biomQuestions.length
                        ? 'Zobacz podsumowanie'
                        : 'Następne pytanie'}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // MODE 5: FISZKI SRS (SM-2)
  // =========================================================================
  if (hubMode === 'srs') {
    if (!srsSessionStarted) {
      return (
        <div
          data-testid="srs-setup-view"
          className="mx-auto w-full max-w-4xl space-y-6 pb-24 md:pb-12"
        >
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
              <Layers className="h-3.5 w-3.5" />
              <span>Active Recall • Algorytm SM-2</span>
            </div>
            <h1 className="mt-2 font-display text-2xl font-extrabold text-emerald-950 dark:text-white sm:text-3xl">
              Fiszki SRS — Anatomia, Testy i Kinezyterapia
            </h1>
            <p className="mt-1 text-sm text-[#354c3f] dark:text-[#94b0a0]">
              Powtarzaj przyczepy PP/PK, unerwienie, testy ortopedyczne i skalę Lovetta 0–5 w optymalnych odstępach czasowych, z natychmiastowym podglądem 3D na odwrocie karty.
            </p>
          </div>

          {renderModeSwitcher()}

          {/* Deck Selector */}
          <section className="space-y-3 rounded-2xl border-2 border-[#d6e7dc] bg-white p-5 dark:border-[#233d2f] dark:bg-[#112018]">
            <h2 className="font-display text-sm font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
              1. Wybierz talię fiszek
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {SRS_DECK_META.map((deck) => {
                const count = buildSrsDeck(deck.id, srsRegionFilter).length;
                const isSelected = srsDeckId === deck.id;
                return (
                  <button
                    key={deck.id}
                    type="button"
                    data-testid={`srs-deck-${deck.id}`}
                    onClick={() => setSrsDeckId(deck.id)}
                    className={`flex flex-col items-start rounded-2xl border-2 border-b-4 p-4 text-left transition active:translate-y-0.5 active:border-b-2 ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-white'
                        : 'border-[#d6e7dc] bg-[#f4faf6] text-[#16291f] hover:border-emerald-400 dark:border-[#294737] dark:bg-[#182b21] dark:text-[#e6f2ea]'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="font-display text-sm font-extrabold">{deck.label}</span>
                      <span className="font-mono-tabular rounded-lg bg-white px-2 py-0.5 text-xs font-extrabold text-emerald-700 dark:bg-[#112018] dark:text-emerald-300">
                        {count}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#52695b] dark:text-[#94b0a0]">
                      {deck.subtitle}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Region Filter & Deck Stats */}
          <section className="space-y-4 rounded-2xl border-2 border-[#d6e7dc] bg-white p-5 dark:border-[#233d2f] dark:bg-[#112018]">
            <div>
              <h2 className="font-display text-sm font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
                2. Filtruj według działu (opcjonalnie)
              </h2>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {SRS_REGION_FILTERS.map((rf) => (
                  <button
                    key={rf.id}
                    type="button"
                    onClick={() => setSrsRegionFilter(rf.id)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                      srsRegionFilter === rf.id
                        ? 'border-emerald-600 bg-emerald-500 text-white'
                        : 'border-[#d6e7dc] bg-[#f4faf6] text-[#354c3f] hover:bg-[#ebf5ee] dark:border-[#294737] dark:bg-[#182b21] dark:text-[#c7dbcf]'
                    }`}
                  >
                    {rf.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-[#d6e7dc] bg-[#f4faf6] p-3 text-center dark:border-[#294737] dark:bg-[#182b21]">
                <div className="text-[11px] font-extrabold uppercase text-[#52695b] dark:text-[#94b0a0]">
                  Do powtórki dziś
                </div>
                <div className="font-mono-tabular mt-1 text-xl font-extrabold text-amber-600 dark:text-amber-400">
                  {srsStats.dueReviews}
                </div>
              </div>
              <div className="rounded-xl border border-[#d6e7dc] bg-[#f4faf6] p-3 text-center dark:border-[#294737] dark:bg-[#182b21]">
                <div className="text-[11px] font-extrabold uppercase text-[#52695b] dark:text-[#94b0a0]">
                  Nowe karty
                </div>
                <div className="font-mono-tabular mt-1 text-xl font-extrabold text-emerald-700 dark:text-emerald-300">
                  {srsStats.newCards}
                </div>
              </div>
              <div className="rounded-xl border border-[#d6e7dc] bg-[#f4faf6] p-3 text-center dark:border-[#294737] dark:bg-[#182b21]">
                <div className="text-[11px] font-extrabold uppercase text-[#52695b] dark:text-[#94b0a0]">
                  Opanowane (≥6d)
                </div>
                <div className="font-mono-tabular mt-1 text-xl font-extrabold text-green-700 dark:text-green-400">
                  {srsStats.masteredCards}
                </div>
              </div>
              <div className="rounded-xl border border-[#d6e7dc] bg-[#f4faf6] p-3 text-center dark:border-[#294737] dark:bg-[#182b21]">
                <div className="text-[11px] font-extrabold uppercase text-[#52695b] dark:text-[#94b0a0]">
                  Razem w talii
                </div>
                <div className="font-mono-tabular mt-1 text-xl font-extrabold text-emerald-950 dark:text-white">
                  {srsStats.total}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                data-testid="srs-start-btn"
                disabled={srsStats.total === 0}
                onClick={() => handleStartSrsSession(false)}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-6 py-3.5 font-display text-base font-extrabold text-white shadow-sm transition hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Play className="h-5 w-5 fill-current" />
                <span>
                  {srsStats.dueReviews > 0
                    ? `Powtórz zaległe (${srsStats.dueReviews}) + nowe`
                    : 'Rozpocznij sesję fiszek SRS (do 20 kart)'}
                </span>
              </button>

              {srsStats.dueReviews === 0 && srsStats.newCards === 0 && srsStats.total > 0 && (
                <button
                  type="button"
                  onClick={() => handleStartSrsSession(true)}
                  className="rounded-2xl border-2 border-b-4 border-amber-600 bg-amber-500 px-5 py-3.5 font-display text-sm font-extrabold text-white transition hover:bg-amber-600"
                >
                  Powtórka dodatkowa (25 kart)
                </button>
              )}
            </div>
          </section>
        </div>
      );
    }

    // Active SRS session completed
    if (!currentSrsCard) {
      return (
        <div
          data-testid="srs-session-done"
          className="mx-auto w-full max-w-2xl space-y-6 pb-24 text-center md:pb-12"
        >
          <div className="rounded-3xl border-2 border-[#d6e7dc] bg-white p-8 shadow-sm dark:border-[#233d2f] dark:bg-[#112018]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400">
              <Sparkles className="h-9 w-9" />
            </div>
            <h1 className="mt-4 font-display text-2xl font-extrabold text-emerald-950 dark:text-white">
              Sesja fiszek SRS ukończona!
            </h1>
            <p className="mt-1 text-sm text-[#52695b] dark:text-[#94b0a0]">
              Oceniono <span className="font-bold">{srsReviewedInSession}</span> kart • zdobyto{' '}
              <span className="font-bold text-amber-600 dark:text-amber-400">+{srsSessionXp} XP</span>.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => setSrsSessionStarted(false)}
                className="rounded-2xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-5 py-2.5 text-sm font-extrabold text-white transition hover:bg-emerald-600"
              >
                Wróć do wyboru talii
              </button>
              {srsStats.newCards > 0 && (
                <button
                  type="button"
                  onClick={() => handleStartSrsSession(false)}
                  className="rounded-2xl border-2 border-b-4 border-green-700 bg-green-600 px-5 py-2.5 text-sm font-extrabold text-white transition hover:bg-green-700"
                >
                  Kolejna seria (20 kart)
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    const cardState = srsProgress[currentSrsCard.id];
    const intervals = previewNextIntervals(cardState);
    const linkedStructure = currentSrsCard.targetStructureId
      ? ANATOMY_MAP[currentSrsCard.targetStructureId]
      : undefined;

    return (
      <div
        data-testid="srs-active-view"
        className="mx-auto w-full max-w-3xl space-y-4 pb-24 md:pb-12"
      >
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-[#d6e7dc] bg-white px-4 py-3 dark:border-[#233d2f] dark:bg-[#112018]">
          <button
            type="button"
            onClick={() => setSrsSessionStarted(false)}
            className="inline-flex items-center gap-1 rounded-xl border border-[#d6e7dc] px-2.5 py-1.5 text-xs font-bold text-[#354c3f] hover:bg-[#f4faf6] dark:border-[#294737] dark:text-[#c7dbcf] dark:hover:bg-[#182b21]"
          >
            <X className="h-4 w-4" />
            <span>Zakończ</span>
          </button>

          <div className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
            Pozostało w kolejce: <span className="font-mono-tabular">{srsQueue.length}</span> • Oceniono:{' '}
            <span className="font-mono-tabular">{srsReviewedInSession}</span>
          </div>

          <span className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-2.5 py-1 font-mono-tabular text-xs font-extrabold text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            <Zap className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
            <span>+{srsSessionXp} XP</span>
          </span>
        </div>

        {/* Flashcard */}
        <div
          data-testid="srs-flashcard"
          className="rounded-3xl border-2 border-[#d6e7dc] bg-white p-6 shadow-sm dark:border-[#233d2f] dark:bg-[#112018]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
              {currentSrsCard.badge}
            </span>
            {cardState ? (
              <span className="font-mono-tabular text-[11px] font-bold text-[#52695b] dark:text-[#94b0a0]">
                Powtórki: {cardState.repetitions} • Interwał: {cardState.intervalDays}d • EF: {cardState.easeFactor}
              </span>
            ) : (
              <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-[11px] font-extrabold text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                Nowa fiszka
              </span>
            )}
          </div>

          <div className="mt-5 text-center">
            <h2
              data-testid="srs-card-title"
              className="font-display text-2xl font-extrabold text-emerald-950 dark:text-white sm:text-3xl"
            >
              {currentSrsCard.frontTitle}
            </h2>
            {currentSrsCard.frontSubtitle &&
              !currentSrsCard.frontTitle.includes(currentSrsCard.frontSubtitle) && (
                <div className="mt-1 text-sm font-medium text-[#52695b] dark:text-[#94b0a0]">
                  {currentSrsCard.frontSubtitle}
                </div>
              )}
            <p className="mx-auto mt-3 max-w-xl text-sm text-[#354c3f] dark:text-[#c7dbcf]">
              {currentSrsCard.frontPrompt}
            </p>
          </div>

          {!srsFlipped ? (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                data-testid="srs-reveal-btn"
                onClick={() => setSrsFlipped(true)}
                className="inline-flex items-center gap-2 rounded-2xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-8 py-3.5 font-display text-base font-extrabold text-white transition hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2"
              >
                <Eye className="h-5 w-5" />
                <span>Odsłoń odpowiedź (Spacja)</span>
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-4 border-t-2 border-[#e6f0ea] pt-5 dark:border-[#233d2f]">
              <div className="space-y-2.5 text-sm leading-relaxed">
                {currentSrsCard.backSections.map((sec, idx) => (
                  <div
                    key={`${sec.label}_${idx}`}
                    className={`rounded-2xl p-3.5 ${
                      sec.tone === 'rose'
                        ? 'border border-rose-200 bg-rose-50/70 dark:border-rose-800/70 dark:bg-rose-950/35'
                        : sec.tone === 'amber'
                          ? 'border border-amber-200 bg-amber-50/80 dark:border-amber-800/70 dark:bg-amber-950/35'
                          : sec.tone === 'emerald'
                            ? 'border border-emerald-200 bg-emerald-50/80 dark:border-emerald-800/70 dark:bg-emerald-950/35'
                            : 'bg-[#f4faf6] dark:bg-[#182b21]/80'
                    }`}
                  >
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
                      {sec.label}
                    </div>
                    <p className="mt-1 text-[#16291f] dark:text-emerald-50">{sec.value}</p>
                  </div>
                ))}
              </div>

              {linkedStructure && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    data-testid="srs-show-3d-btn"
                    onClick={() =>
                      onShowIn3D({
                        region: resolveBestRegionalKeyForStructure(
                          linkedStructure.id,
                          linkedStructure.region,
                        ),
                        structureId: linkedStructure.id,
                        isolateIfMuscle: linkedStructure.category === 'muscle',
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500 bg-emerald-50 px-4 py-2 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-200"
                  >
                    <Box className="h-4 w-4" />
                    <span>
                      Pokaż w 3D: {formatBilingualName(linkedStructure.namePl, linkedStructure.nameLt)}
                    </span>
                  </button>
                </div>
              )}

              {/* SM-2 Rating Buttons */}
              <div className="pt-2">
                <div className="mb-2 text-center text-xs font-bold text-[#52695b] dark:text-[#94b0a0]">
                  Jak dobrze pamiętałeś odpowiedź? (klawisze 1–4)
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <button
                    type="button"
                    data-testid="srs-rate-again"
                    onClick={() => handleRateSrsCard('again')}
                    className="flex flex-col items-center rounded-2xl border-2 border-b-4 border-rose-700 bg-rose-500 px-3 py-2.5 text-white transition hover:bg-rose-600 active:translate-y-0.5 active:border-b-2"
                  >
                    <span className="font-display text-sm font-extrabold">1. Powtórz</span>
                    <span className="text-[11px] font-semibold text-white/90">w tej sesji</span>
                  </button>
                  <button
                    type="button"
                    data-testid="srs-rate-hard"
                    onClick={() => handleRateSrsCard('hard')}
                    className="flex flex-col items-center rounded-2xl border-2 border-b-4 border-amber-700 bg-amber-500 px-3 py-2.5 text-white transition hover:bg-amber-600 active:translate-y-0.5 active:border-b-2"
                  >
                    <span className="font-display text-sm font-extrabold">2. Trudne</span>
                    <span className="font-mono-tabular text-[11px] font-semibold text-white/90">
                      za {intervals.hard} d
                    </span>
                  </button>
                  <button
                    type="button"
                    data-testid="srs-rate-good"
                    onClick={() => handleRateSrsCard('good')}
                    className="flex flex-col items-center rounded-2xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-3 py-2.5 text-white transition hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2"
                  >
                    <span className="font-display text-sm font-extrabold">3. Dobre</span>
                    <span className="font-mono-tabular text-[11px] font-semibold text-white/90">
                      za {intervals.good} d
                    </span>
                  </button>
                  <button
                    type="button"
                    data-testid="srs-rate-easy"
                    onClick={() => handleRateSrsCard('easy')}
                    className="flex flex-col items-center rounded-2xl border-2 border-b-4 border-green-700 bg-green-600 px-3 py-2.5 text-white transition hover:bg-green-700 active:translate-y-0.5 active:border-b-2"
                  >
                    <span className="font-display text-sm font-extrabold">4. Łatwe</span>
                    <span className="font-mono-tabular text-[11px] font-semibold text-white/90">
                      za {intervals.easy} d
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // SETUP SCREEN (for both 'locate' and 'identify' modes)
  // =========================================================================
  if (phase === 'setup') {
    const isReverse = hubMode === 'identify';
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6 pb-24 md:pb-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
              {isReverse ? <Eye className="h-3.5 w-3.5" /> : <Crosshair className="h-3.5 w-3.5" />}
              <span>{isReverse ? 'Odwrócone Szpilki 3D' : 'Egzamin praktyczny 3D'}</span>
            </div>
            <h1 className="mt-2 font-display text-2xl font-extrabold text-emerald-950 dark:text-white sm:text-3xl">
              {isReverse
                ? 'Co wskazuje szpilka? — Rozpoznawanie na modelu 3D'
                : 'Szpilki 3D — Test Praktyczny Anatomii'}
            </h1>
            <p className="mt-1 text-sm text-[#354c3f] dark:text-[#94b0a0]">
              {isReverse
                ? 'Model 3D automatycznie podświetla i przybliża wybraną strukturę lub punkt kostny (bez etykiet pod kursorem). Zgadnij jej nazwę z listy ABCD lub wpisz z klawiatury!'
                : 'Sprawdź praktyczną znajomość struktur, mięśni oraz obustronnych przyczepów kostnych PP/PK bez podpowiedzi pod kursorem — dokładnie jak na egzaminie ze „szpilek”.'}
            </p>
          </div>
        </div>

        {renderModeSwitcher()}

        {/* 1. Region Selection */}
        <section className="space-y-3 rounded-2xl border-2 border-[#d6e7dc] bg-white p-5 dark:border-[#233d2f] dark:bg-[#112018]">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
            1. Wybierz dział / model 3D
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PIN_EXAM_REGIONS.map((item) => {
              const counts = getPinExamPoolCounts(item.id);
              const isSelected = region === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`pin-exam-region-${item.id}`}
                  onClick={() => setRegion(item.id)}
                  className={`flex flex-col items-start rounded-2xl border-2 border-b-4 p-4 text-left transition active:translate-y-0.5 active:border-b-2 ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-white'
                      : 'border-[#d6e7dc] bg-[#f4faf6] text-[#16291f] hover:border-emerald-400 dark:border-[#294737] dark:bg-[#182b21] dark:text-[#e6f2ea]'
                  }`}
                >
                  <div className="font-display text-sm font-extrabold">{item.label}</div>
                  <p className="mt-1 text-xs leading-relaxed text-[#52695b] dark:text-[#94b0a0]">
                    {item.subtitle}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5 text-[10px] font-extrabold">
                    <span className="rounded-md bg-white px-2 py-0.5 text-emerald-700 dark:bg-[#112018] dark:text-emerald-300">
                      {counts.muscles} mięśni
                    </span>
                    <span className="rounded-md bg-white px-2 py-0.5 text-amber-700 dark:bg-[#112018] dark:text-amber-300">
                      {counts.landmarks} stref PP/PK
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. Pool + Question Count + Answer Format / Timer */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <section className="space-y-3 rounded-2xl border-2 border-[#d6e7dc] bg-white p-5 dark:border-[#233d2f] dark:bg-[#112018]">
            <h2 className="font-display text-sm font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
              2. Zakres pytań
            </h2>
            <div className="space-y-2">
              {POOL_OPTIONS.map((opt) => {
                const optCount = getCountForPool(opt.id);
                const disabled = optCount === 0;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    data-testid={`pin-exam-pool-${opt.id}`}
                    disabled={disabled}
                    onClick={() => setPool(opt.id)}
                    className={`flex w-full flex-col rounded-xl border-2 px-3.5 py-2.5 text-left transition ${
                      disabled
                        ? 'cursor-not-allowed border-transparent bg-[#f4faf6]/60 opacity-45 dark:bg-[#182b21]/50'
                        : pool === opt.id
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-white'
                          : 'border-[#d6e7dc] bg-[#f4faf6] text-[#16291f] hover:border-emerald-300 dark:border-[#294737] dark:bg-[#182b21] dark:text-[#e6f2ea]'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="text-xs font-extrabold">{opt.label}</span>
                      <span className="font-mono-tabular rounded-md bg-white px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:bg-[#112018] dark:text-emerald-300">
                        {optCount}
                      </span>
                    </div>
                    <span className="mt-0.5 text-[11px] text-[#52695b] dark:text-[#94b0a0]">
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col justify-between space-y-4 rounded-2xl border-2 border-[#d6e7dc] bg-white p-5 dark:border-[#233d2f] dark:bg-[#112018]">
            <div className="space-y-4">
              {isReverse && (
                <div>
                  <h2 className="font-display text-sm font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
                    3. Forma odpowiedzi
                  </h2>
                  <div className="mt-2.5 flex gap-2">
                    <button
                      type="button"
                      data-testid="reverse-format-abcd"
                      onClick={() => setReverseFormat('abcd')}
                      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-b-4 py-2.5 text-xs font-extrabold transition active:translate-y-0.5 active:border-b-2 ${
                        reverseFormat === 'abcd'
                          ? 'border-emerald-700 bg-emerald-500 text-white'
                          : 'border-[#d6e7dc] bg-[#f4faf6] text-[#16291f] hover:border-emerald-400 dark:border-[#294737] dark:bg-[#182b21] dark:text-[#e6f2ea]'
                      }`}
                    >
                      <ListChecks className="h-3.5 w-3.5" />
                      <span>Wybór ABCD</span>
                    </button>
                    <button
                      type="button"
                      data-testid="reverse-format-typing"
                      onClick={() => setReverseFormat('typing')}
                      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-b-4 py-2.5 text-xs font-extrabold transition active:translate-y-0.5 active:border-b-2 ${
                        reverseFormat === 'typing'
                          ? 'border-emerald-700 bg-emerald-500 text-white'
                          : 'border-[#d6e7dc] bg-[#f4faf6] text-[#16291f] hover:border-emerald-400 dark:border-[#294737] dark:bg-[#182b21] dark:text-[#e6f2ea]'
                      }`}
                    >
                      <Keyboard className="h-3.5 w-3.5" />
                      <span>Wpis z klawiatury</span>
                    </button>
                  </div>
                </div>
              )}

              <div>
                <h2 className="font-display text-sm font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
                  {isReverse ? '4. Liczba szpilek (pytań)' : '3. Liczba szpilek (pytań)'}
                </h2>
                <div className="mt-2.5 flex gap-2">
                  {QUESTION_COUNTS.map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      data-testid={`pin-exam-count-${cnt}`}
                      onClick={() => setQuestionCount(cnt)}
                      className={`flex-1 rounded-xl border-2 border-b-4 py-2.5 font-mono-tabular text-sm font-extrabold transition active:translate-y-0.5 active:border-b-2 ${
                        questionCount === cnt
                          ? 'border-emerald-700 bg-emerald-500 text-white'
                          : 'border-[#d6e7dc] bg-[#f4faf6] text-[#16291f] hover:border-emerald-400 dark:border-[#294737] dark:bg-[#182b21] dark:text-[#e6f2ea]'
                      }`}
                    >
                      {Math.min(cnt, maxAvailableForPool)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="font-display text-sm font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
                  {isReverse ? '5. Limit czasu na pytanie' : '4. Limit czasu na pytanie'}
                </h2>
                <div className="mt-2.5 flex gap-2">
                  {[
                    { value: null, label: 'Bez limitu' },
                    { value: 30, label: '30 s / szpilka' },
                  ].map((opt) => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      data-testid={`pin-exam-timer-${opt.value === null ? 'none' : opt.value}`}
                      onClick={() => setTimerSeconds(opt.value)}
                      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-b-4 py-2.5 text-xs font-extrabold transition active:translate-y-0.5 active:border-b-2 ${
                        timerSeconds === opt.value
                          ? 'border-emerald-700 bg-emerald-500 text-white'
                          : 'border-[#d6e7dc] bg-[#f4faf6] text-[#16291f] hover:border-emerald-400 dark:border-[#294737] dark:bg-[#182b21] dark:text-[#e6f2ea]'
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              data-testid="pin-exam-start-btn"
              onClick={handleStartExam}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-6 py-3.5 font-display text-base font-extrabold text-white shadow-sm transition hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2"
            >
              <Play className="h-5 w-5 fill-current" />
              <span>
                {isReverse
                  ? 'Rozpocznij test „Co wskazuje szpilka?”'
                  : 'Rozpocznij egzamin ze szpilek 3D'}
              </span>
            </button>
          </section>
        </div>
      </div>
    );
  }

  // =========================================================================
  // SUMMARY SCREEN (shared by 'locate' and 'identify')
  // =========================================================================
  if (phase === 'summary') {
    const correctCount = results.filter((r) => r.isCorrect).length;
    const totalCount = results.length;
    const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    const avgSec =
      totalCount > 0
        ? Math.round(results.reduce((acc, r) => acc + r.elapsedSeconds, 0) / totalCount)
        : 0;
    const missedQuestions = results.filter((r) => !r.isCorrect).map((r) => r.question);

    return (
      <div
        data-testid="pin-exam-summary"
        className="mx-auto w-full max-w-4xl space-y-6 pb-24 md:pb-12"
      >
        <div className="rounded-3xl border-2 border-[#d6e7dc] bg-white p-6 text-center shadow-sm dark:border-[#233d2f] dark:bg-[#112018]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400">
            <Award className="h-9 w-9" />
          </div>
          <h1 className="mt-3 font-display text-2xl font-extrabold text-emerald-950 dark:text-white">
            {hubMode === 'identify'
              ? 'Wynik testu „Co wskazuje szpilka?”'
              : 'Wynik egzaminu „Szpilki 3D”'}
          </h1>
          <p className="mt-1 text-sm text-[#52695b] dark:text-[#94b0a0]">
            Dział: {activeRegionMeta.label} • Trafiono {correctCount} z {totalCount} szpilek
          </p>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border-2 border-[#d6e7dc] bg-[#f4faf6] p-3 dark:border-[#233d2f] dark:bg-[#182b21]">
              <div className="text-[11px] font-extrabold uppercase text-[#52695b] dark:text-[#94b0a0]">
                Celność
              </div>
              <div className="mt-1 font-mono-tabular text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {accuracy}%
              </div>
            </div>
            <div className="rounded-2xl border-2 border-[#d6e7dc] bg-[#f4faf6] p-3 dark:border-[#233d2f] dark:bg-[#182b21]">
              <div className="text-[11px] font-extrabold uppercase text-[#52695b] dark:text-[#94b0a0]">
                Zdobyte XP
              </div>
              <div className="mt-1 inline-flex items-center gap-1 font-mono-tabular text-2xl font-extrabold text-amber-600 dark:text-amber-400">
                <Zap className="h-5 w-5 fill-amber-400 text-amber-500" />
                <span>+{totalXpEarned}</span>
              </div>
            </div>
            <div className="rounded-2xl border-2 border-[#d6e7dc] bg-[#f4faf6] p-3 dark:border-[#233d2f] dark:bg-[#182b21]">
              <div className="text-[11px] font-extrabold uppercase text-[#52695b] dark:text-[#94b0a0]">
                Śr. czas
              </div>
              <div className="mt-1 font-mono-tabular text-2xl font-extrabold text-emerald-950 dark:text-white">
                {avgSec} s
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {missedQuestions.length > 0 && (
              <button
                type="button"
                data-testid="pin-exam-retry-missed-btn"
                onClick={() => startExamWithQuestions(missedQuestions)}
                className="inline-flex items-center gap-2 rounded-2xl border-2 border-b-4 border-amber-600 bg-amber-500 px-5 py-2.5 text-sm font-extrabold text-white transition hover:bg-amber-600 active:translate-y-0.5 active:border-b-2"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Powtórz tylko błędy ({missedQuestions.length})</span>
              </button>
            )}
            <button
              type="button"
              data-testid="pin-exam-new-btn"
              onClick={() => setPhase('setup')}
              className="inline-flex items-center gap-2 rounded-2xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-5 py-2.5 text-sm font-extrabold text-white transition hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2"
            >
              <Target className="h-4 w-4" />
              <span>Nowy egzamin</span>
            </button>
          </div>
        </div>

        {/* Breakdown List with Jump to 3D */}
        <div className="rounded-2xl border-2 border-[#d6e7dc] bg-white p-5 dark:border-[#233d2f] dark:bg-[#112018]">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
            Przegląd odpowiedzi
          </h2>
          <ul className="mt-3 divide-y divide-[#e6f0ea] dark:divide-[#233d2f]">
            {results.map((item, idx) => (
              <li
                key={`${item.question.id}_${idx}`}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="flex items-start gap-2.5">
                  {item.isCorrect ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                  )}
                  <div>
                    <div className="text-sm font-bold text-emerald-950 dark:text-white">
                      {idx + 1}.{' '}
                      {formatBilingualName(item.question.targetNamePl, item.question.targetNameLt)}
                    </div>
                    {!item.isCorrect && (
                      <div className="text-xs text-rose-700 dark:text-rose-300">
                        {item.timedOut
                          ? 'Upłynął czas na odpowiedź'
                          : `Twoja odpowiedź: ${item.selectedLabel ?? 'brak wyboru'}`}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  data-testid={`pin-summary-show-3d-${idx}`}
                  onClick={() =>
                    onShowIn3D({
                      region: item.question.region,
                      structureId: item.question.structureId,
                      landmarkId: item.question.landmarkId,
                      isolateIfMuscle: item.question.kind === 'mesh',
                    })
                  }
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-500 bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-200"
                >
                  <Box className="h-3.5 w-3.5" />
                  <span>Pokaż w 3D</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // =========================================================================
  // ACTIVE EXAM SCREEN (supports both 'locate' and 'identify')
  // =========================================================================
  const isReverse = hubMode === 'identify';
  const progressPct =
    questions.length > 0
      ? Math.round(
          ((currentIndex + (questionState !== 'answering' ? 1 : 0)) / questions.length) * 100,
        )
      : 0;

  const canSubmitReverse =
    reverseFormat === 'abcd'
      ? selectedReverseOptionIdx !== null
      : reverseTypingInput.trim().length > 0;

  return (
    <div
      data-testid={isReverse ? 'reverse-pin-exam-active' : 'pin-exam-active'}
      className="mx-auto w-full max-w-6xl space-y-3 pt-1 pb-24 md:pb-8"
    >
      {/* Top Progress Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-[#d6e7dc] bg-white px-4 py-3 dark:border-[#233d2f] dark:bg-[#112018]">
        <button
          type="button"
          onClick={() => setPhase('setup')}
          aria-label="Zakończ egzamin"
          className="inline-flex items-center gap-1 rounded-xl border border-[#d6e7dc] px-2.5 py-1.5 text-xs font-bold text-[#354c3f] hover:bg-[#f4faf6] dark:border-[#294737] dark:text-[#c7dbcf] dark:hover:bg-[#182b21]"
        >
          <X className="h-4 w-4" />
          <span>Wyjdź</span>
        </button>

        <div className="flex min-w-[180px] flex-1 items-center gap-3">
          <span className="font-mono-tabular whitespace-nowrap text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
            Szpilka {currentIndex + 1} / {questions.length}
          </span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#d6e7dc] dark:bg-[#233d2f]">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isReverse && (
            <button
              type="button"
              onClick={focusReverseTarget}
              title="Skup kamerę ponownie na podświetlonej szpilce"
              className="inline-flex items-center gap-1 rounded-xl border border-[#d6e7dc] bg-[#f4faf6] px-2.5 py-1 text-xs font-bold text-[#16291f] hover:border-emerald-400 dark:border-[#294737] dark:bg-[#182b21] dark:text-emerald-50"
            >
              <Focus className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Skup kamerę</span>
            </button>
          )}
          {timeLeft !== null && (
            <span
              data-testid="pin-exam-timer-badge"
              className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 font-mono-tabular text-xs font-extrabold ${
                timeLeft <= 8
                  ? 'border-rose-400 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                  : 'border-[#d6e7dc] bg-[#f4faf6] text-[#16291f] dark:border-[#294737] dark:bg-[#182b21] dark:text-emerald-50'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>{timeLeft} s</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-2.5 py-1 font-mono-tabular text-xs font-extrabold text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            <Zap className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
            <span>+{totalXpEarned} XP</span>
          </span>
        </div>
      </div>

      {/* Question Prompt Card */}
      {currentQuestion && (
        <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 px-5 py-3 dark:border-emerald-800 dark:bg-emerald-950/40">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                {isReverse
                  ? `Odwrócona szpilka 3D • ${getPinQuestionCategoryBadge(currentQuestion)}`
                  : `Szpilka 3D • ${getPinQuestionCategoryBadge(currentQuestion)}`}
              </div>
              <h2
                data-testid="pin-exam-prompt"
                className="mt-0.5 font-display text-lg font-extrabold text-emerald-950 dark:text-white sm:text-xl"
              >
                {isReverse
                  ? 'Co wskazuje podświetlona struktura na modelu 3D?'
                  : currentQuestion.prompt}
              </h2>
            </div>

            {questionState === 'answering' ? (
              <button
                type="button"
                data-testid="pin-exam-submit-btn"
                disabled={isReverse ? !canSubmitReverse : !selectedPart}
                onClick={() => commitEvaluation(false)}
                className={`shrink-0 rounded-2xl border-2 border-b-4 px-5 py-2.5 font-display text-sm font-extrabold transition ${
                  (isReverse ? canSubmitReverse : Boolean(selectedPart))
                    ? 'border-emerald-700 bg-emerald-500 text-white hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2'
                    : 'cursor-not-allowed border-[#c2d8ca] bg-[#e2ede6] text-[#6b8274] dark:border-[#294737] dark:bg-[#182b21] dark:text-[#739180]'
                }`}
              >
                {isReverse ? 'Sprawdź odpowiedź' : 'Zatwierdź szpilkę'}
              </button>
            ) : (
              <button
                type="button"
                data-testid="pin-exam-next-btn"
                onClick={handleNextQuestion}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-2xl border-2 border-b-4 px-5 py-2.5 font-display text-sm font-extrabold text-white transition active:translate-y-0.5 active:border-b-2 ${
                  questionState === 'correct'
                    ? 'border-emerald-700 bg-emerald-500 hover:bg-emerald-600'
                    : 'border-rose-700 bg-rose-500 hover:bg-rose-600'
                }`}
              >
                <span>
                  {currentIndex + 1 >= questions.length ? 'Zobacz wynik' : 'Następna szpilka'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Feedback banner after submitting */}
          {questionState !== 'answering' && (
            <div
              data-testid={`pin-exam-feedback-${questionState}`}
              className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold ${
                questionState === 'correct'
                  ? 'border-emerald-400 bg-white text-emerald-900 dark:border-emerald-700 dark:bg-[#112018] dark:text-emerald-200'
                  : 'border-rose-400 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-950/60 dark:text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {questionState === 'correct' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
                )}
                <span>
                  {questionState === 'correct'
                    ? `Perfekcyjnie! +15 XP — ${formatBilingualName(currentQuestion.targetNamePl, currentQuestion.targetNameLt)}`
                    : `Poprawna nazwa podświetlonej struktury: ${formatBilingualName(currentQuestion.targetNamePl, currentQuestion.targetNameLt)}`}
                </span>
              </div>
              {currentQuestion.clinicalHint && (
                <span className="font-medium opacity-85">{currentQuestion.clinicalHint}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3D Viewport (hover labels disabled during exam!) */}
      <AnatomyViewport3D
        ref={viewportRef}
        region={region}
        modelUrl={activeRegionMeta.modelUrl}
        selectedId={isReverse ? null : (selectedPart?.id ?? null)}
        selectedPartId={isReverse ? null : (selectedPart?.id ?? null)}
        filterMode={currentQuestion?.kind === 'landmark' ? 'bone' : 'all'}
        enableExtendedLayers
        initialVisibleLayers={pinExamVisibleLayers}
        initialBoneZoneMode={
          currentQuestion?.kind === 'landmark' ? 'landmarks' : 'off'
        }
        onLoaded={() => {
          modelReadyRef.current = true;
          setModelLoadedTick((t) => t + 1);
        }}
        onSelectPart={(part) => {
          if (!isReverse && questionState === 'answering') {
            setSelectedPart(part);
          }
        }}
        hideHotspotOverlay
        hideHoverLabel={questionState === 'answering'}
        highlightMode={
          questionState === 'correct' ? 'correct' : questionState === 'wrong' ? 'wrong' : 'neutral'
        }
        heightClassName={isReverse ? 'h-[290px] sm:h-[340px]' : 'h-[430px] sm:h-[500px]'}
        isDarkMode={isDarkMode}
      />

      {/* Answer Panel for Reverse Mode OR Pin Status Bar for Locate Mode */}
      {isReverse ? (
        <div className="rounded-2xl border-2 border-[#d6e7dc] bg-white p-3.5 dark:border-[#233d2f] dark:bg-[#112018]">
          {reverseFormat === 'abcd' ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {reverseOptions.map((opt, idx) => {
                const isSelected = selectedReverseOptionIdx === idx;
                const showCorrect = questionState !== 'answering' && opt.isCorrect;
                const showWrong = questionState !== 'answering' && isSelected && !opt.isCorrect;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    data-testid={`reverse-option-${idx}`}
                    disabled={questionState !== 'answering'}
                    onClick={() => setSelectedReverseOptionIdx(idx)}
                    className={`flex items-center gap-3 rounded-2xl border-2 border-b-4 px-3.5 py-2.5 text-left text-sm font-bold transition ${
                      showCorrect
                        ? 'border-emerald-600 bg-emerald-100 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950/70 dark:text-emerald-100'
                        : showWrong
                          ? 'border-rose-500 bg-rose-50 text-rose-950 dark:border-rose-600 dark:bg-rose-950/60 dark:text-rose-100'
                          : isSelected
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-white'
                            : 'border-[#d6e7dc] bg-[#f4faf6] text-[#16291f] hover:border-emerald-400 dark:border-[#294737] dark:bg-[#182b21] dark:text-emerald-50'
                    }`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-current/25 font-mono-tabular text-xs font-extrabold">
                      {idx + 1}
                    </span>
                    <span className="leading-snug">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              <label
                htmlFor="reverse-pin-typing"
                className="block text-xs font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]"
              >
                Wpisz nazwę podświetlonej struktury (po polsku lub po łacinie):
              </label>
              <input
                id="reverse-pin-typing"
                type="text"
                data-testid="reverse-pin-typing-input"
                disabled={questionState !== 'answering'}
                value={reverseTypingInput}
                onChange={(e) => setReverseTypingInput(e.target.value)}
                placeholder="Np. mięsień nadgrzebieniowy lub musculus supraspinatus..."
                className="w-full rounded-xl border-2 border-[#d6e7dc] bg-[#f4faf6] px-4 py-3 text-sm font-semibold text-emerald-950 placeholder:text-[#6b8274] focus:border-emerald-500 focus:outline-none dark:border-[#294737] dark:bg-[#182b21] dark:text-white"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-[#d6e7dc] bg-white px-4 py-2.5 text-xs dark:border-[#233d2f] dark:bg-[#112018]">
          <span className="font-bold text-[#354c3f] dark:text-[#94b0a0]">Status szpilki 3D:</span>
          {selectedPart ? (
            <span className="font-extrabold text-emerald-700 dark:text-emerald-300">
              {questionState === 'answering'
                ? 'Szpilka wbita — kliknij „Zatwierdź szpilkę”, aby sprawdzić odpowiedź'
                : `Zaznaczono: ${selectedPart.bilingualName || formatBilingualName(selectedPart.namePl, selectedPart.nameLt)}`}
            </span>
          ) : (
            <span className="italic text-[#6b8274]">
              Obróć model i kliknij szukaną strukturę bezpośrednio na scenie 3D
            </span>
          )}
        </div>
      )}
    </div>
  );
};
