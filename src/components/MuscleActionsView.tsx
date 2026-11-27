import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Award,
  BookOpen,
  Box,
  CheckCircle2,
  Dumbbell,
  Filter,
  Hand,
  Layers,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Stethoscope,
  Target,
  XCircle,
} from 'lucide-react';
import { ANATOMY_MAP } from '../data/anatomyDb';
import { CLINICAL_TEST_MAP, type ClinicalTestEntry } from '../data/clinicalTestsDb';
import {
  buildMuscleActionsQuizQuestions,
  compareTwoMuscles,
  FEATURED_MUSCLE_COMPARISONS,
  findMusclesByJointAndMovement,
  getMovementsForJoint,
  JOINT_GROUPS_META,
  MUSCLE_ACTIONS_DB,
  MUSCLE_ACTIONS_MAP,
  MUSCLE_REGION_GROUPS,
  type MuscleActionProfile,
  type MuscleActionsQuizQuestion,
  type MuscleJointGroupId,
  type MuscleQuizQuestionKind,
} from '../data/muscleActionsDb';
import type { AnatomicalStructure, PinExamHistoryEntry } from '../types/anatomy';
import { getLocalDateKey } from '../utils/gameLogic';
import { MuscleMotionSimulator3D } from './MuscleMotionSimulator3D';

type MuscleSubTab = 'encyclopedia' | 'reverse' | 'quiz';

interface MuscleActionsViewProps {
  isDarkMode?: boolean;
  onShowIn3D: (structure: AnatomicalStructure) => void;
  onVisualizeClinicalTest?: (test: ClinicalTestEntry) => void;
  onRecordQuizOutcome?: (structureId: string, isCorrect: boolean, xpGain: number) => void;
  onCompleteQuizHistory?: (entry: PinExamHistoryEntry) => void;
  onOpenSrsMusclesDeck?: () => void;
}

export const MuscleActionsView: React.FC<MuscleActionsViewProps> = ({
  isDarkMode = false,
  onShowIn3D,
  onVisualizeClinicalTest,
  onRecordQuizOutcome,
  onCompleteQuizHistory,
  onOpenSrsMusclesDeck,
}) => {
  const [subTab, setSubTab] = useState<MuscleSubTab>('encyclopedia');

  // --- Sub-Tab 1: Encyclopedia & 3D Simulator state ---
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState<MuscleActionProfile['regionGroupPl'] | 'all'>('all');
  const [selectedMuscleId, setSelectedMuscleId] = useState<string>('m_deltoideus');
  const [activePresetId, setActivePresetId] = useState<string | undefined>(undefined);

  // --- Sub-Tab 2: Reverse Lookup & 2-Muscle Comparator state ---
  const [selectedJoint, setSelectedJoint] = useState<MuscleJointGroupId>('shoulder');
  const [selectedMovementKey, setSelectedMovementKey] = useState<string>('shoulder_abduction');
  const [compareIdA, setCompareIdA] = useState<string>('m_gastrocnemius');
  const [compareIdB, setCompareIdB] = useState<string>('m_soleus');

  // --- Sub-Tab 3: Quiz 3D state ---
  const [quizRegion, setQuizRegion] = useState<MuscleActionProfile['regionGroupPl'] | 'all'>('all');
  const [quizKind, setQuizKind] = useState<MuscleQuizQuestionKind | 'mixed'>('mixed');
  const [quizCount, setQuizCount] = useState<5 | 10>(5);
  const [quizQuestions, setQuizQuestions] = useState<MuscleActionsQuizQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizSelectedOption, setQuizSelectedOption] = useState<number | null>(null);
  const [quizResults, setQuizResults] = useState<
    Array<{ question: MuscleActionsQuizQuestion; chosenIndex: number; isCorrect: boolean }>
  >([]);
  const [quizFinished, setQuizFinished] = useState(false);

  const selectedProfile = useMemo(
    () => MUSCLE_ACTIONS_MAP[selectedMuscleId] ?? MUSCLE_ACTIONS_DB[0],
    [selectedMuscleId],
  );
  const selectedAnatomy = ANATOMY_MAP[selectedProfile.muscleId];

  // Filtered muscles list for encyclopedia
  const filteredMuscles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return MUSCLE_ACTIONS_DB.filter((profile) => {
      if (regionFilter !== 'all' && profile.regionGroupPl !== regionFilter) return false;
      if (!q) return true;
      const anat = ANATOMY_MAP[profile.muscleId];
      const hay = [
        anat?.namePl ?? '',
        anat?.nameEn ?? '',
        ...(anat?.aliases ?? []),
        anat?.innervation ?? '',
        profile.shortTaglinePl,
        profile.regionGroupPl,
        ...profile.actions.map((a) => `${a.jointLabelPl} ${a.movementLabelPl}`),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [searchQuery, regionFilter]);

  // Reverse lookup derived data
  const jointMovements = useMemo(() => getMovementsForJoint(selectedJoint), [selectedJoint]);
  const reverseResult = useMemo(
    () => findMusclesByJointAndMovement(selectedJoint, selectedMovementKey),
    [selectedJoint, selectedMovementKey],
  );

  // Ensure movement key stays valid when switching joint
  const handleSelectJoint = (joint: MuscleJointGroupId) => {
    setSelectedJoint(joint);
    const moves = getMovementsForJoint(joint);
    if (moves.length > 0) {
      setSelectedMovementKey(moves[0].movementKey);
    }
  };

  // Side-by-side comparison derived data
  const comparison = useMemo(
    () => compareTwoMuscles(compareIdA, compareIdB),
    [compareIdA, compareIdB],
  );

  const jumpToMuscle = (muscleId: string, presetId?: string) => {
    if (!MUSCLE_ACTIONS_MAP[muscleId]) return;
    setSelectedMuscleId(muscleId);
    setActivePresetId(presetId);
    setSubTab('encyclopedia');
  };

  // --- Quiz Handlers ---
  const handleStartQuiz = () => {
    const qs = buildMuscleActionsQuizQuestions({
      regionGroupPl: quizRegion,
      kindFilter: quizKind,
      count: quizCount,
      seed: Math.floor(Date.now() % 100000),
    });
    setQuizQuestions(qs);
    setQuizIndex(0);
    setQuizSelectedOption(null);
    setQuizResults([]);
    setQuizFinished(false);
  };

  const currentQuestion = quizQuestions[quizIndex] ?? null;

  const handleChooseQuizOption = (optionIndex: number) => {
    if (!currentQuestion || quizSelectedOption !== null) return;
    const isCorrect = optionIndex === currentQuestion.correctIndex;
    setQuizSelectedOption(optionIndex);
    setQuizResults((prev) => [
      ...prev,
      { question: currentQuestion, chosenIndex: optionIndex, isCorrect },
    ]);
    onRecordQuizOutcome?.(currentQuestion.muscleId, isCorrect, isCorrect ? 15 : 0);
  };

  const handleNextQuizQuestion = () => {
    if (quizIndex + 1 >= quizQuestions.length) {
      const correctCount = quizResults.filter((r) => r.isCorrect).length;
      const totalCount = quizQuestions.length;
      const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
      onCompleteQuizHistory?.({
        id: `muscle_quiz_${Date.now()}`,
        date: getLocalDateKey(),
        mode: 'muscle_actions',
        region: quizRegion === 'all' ? 'Wszystkie (74)' : quizRegion,
        correctCount,
        totalCount,
        accuracy,
        xpEarned: correctCount * 15,
      });
      setQuizFinished(true);
    } else {
      setQuizIndex((i) => i + 1);
      setQuizSelectedOption(null);
    }
  };

  // Keyboard shortcuts 1-4 / Enter during active quiz
  useEffect(() => {
    if (subTab !== 'quiz' || !currentQuestion || quizFinished) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (quizSelectedOption === null && ['1', '2', '3', '4'].includes(e.key)) {
        const idx = Number(e.key) - 1;
        if (idx < currentQuestion.options.length) {
          handleChooseQuizOption(idx);
        }
      } else if (quizSelectedOption !== null && e.key === 'Enter') {
        e.preventDefault();
        handleNextQuizQuestion();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [subTab, currentQuestion, quizSelectedOption, quizFinished, quizResults]);

  const sortedMusclesForSelect = useMemo(
    () =>
      [...MUSCLE_ACTIONS_DB].sort((a, b) =>
        (ANATOMY_MAP[a.muscleId]?.namePl ?? a.muscleId).localeCompare(
          ANATOMY_MAP[b.muscleId]?.namePl ?? b.muscleId,
          'pl',
        ),
      ),
    [],
  );

  const selectedLovettTest = selectedProfile.lovettTestId
    ? CLINICAL_TEST_MAP[selectedProfile.lovettTestId]
    : undefined;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4" data-testid="muscle-actions-view">
      {/* Header Banner */}
      <div className="flex flex-col gap-3 rounded-2xl border-2 border-[#d6e7dc] bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between dark:border-[#233d2f] dark:bg-[#112018]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
              <Dumbbell className="h-5 w-5" />
            </span>
            <h1 className="font-display text-lg font-extrabold tracking-tight text-emerald-950 sm:text-xl dark:text-white">
              Ruchy mięśni 3D
            </h1>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              {MUSCLE_ACTIONS_DB.length} mięśni • 100% offline
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[#52695b] sm:text-sm dark:text-[#94b0a0]">
            Realistyczna symulacja 3D na kościach Z-Anatomy, aktony, odwrócony przyczep (Punctum Fixum), odwrotny filtr i quiz.
          </p>
        </div>

        {/* 3-Tab Sub-Navigation */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar sm:shrink-0">
          {(
            [
              { id: 'encyclopedia', label: 'Encyklopedia & 3D', icon: BookOpen },
              { id: 'reverse', label: 'Kto wykonuje? & Porównaj', icon: ArrowLeftRight },
              { id: 'quiz', label: 'Quiz 3D', icon: Target },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = subTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                data-testid={`muscle-subtab-${t.id}`}
                onClick={() => setSubTab(t.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border-2 px-3 py-2 text-xs font-extrabold transition ${
                  active
                    ? 'border-emerald-500 bg-emerald-600 text-white shadow-xs'
                    : 'border-[#d6e7dc] bg-[#f4faf6] text-[#354c3f] hover:bg-emerald-50 dark:border-[#233d2f] dark:bg-[#16291f] dark:text-[#c7dbcf]'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SUB-TAB 1: ENCYCLOPEDIA & LIVE 3D MOTION SIMULATOR                    */}
      {/* ===================================================================== */}
      {subTab === 'encyclopedia' && (
        <div className="space-y-4">
          {/* Search + Region Filters */}
          <div className="space-y-2.5 rounded-2xl border-2 border-[#d6e7dc] bg-white p-3 dark:border-[#233d2f] dark:bg-[#112018]">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#6b8274]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="muscle-search-input"
                placeholder="Szukaj mięśnia, ruchu, nerwu lub aktonu (np. naramienny, supinacja, L5, gruszkowaty)…"
                className="w-full rounded-xl border-2 border-[#d6e7dc] bg-[#f8fcfa] py-2 pr-3 pl-9 text-sm font-semibold text-emerald-950 outline-none transition focus:border-emerald-500 dark:border-[#233d2f] dark:bg-[#0d1912] dark:text-white"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              <button
                type="button"
                onClick={() => setRegionFilter('all')}
                className={`shrink-0 rounded-xl border px-2.5 py-1 text-xs font-extrabold transition ${
                  regionFilter === 'all'
                    ? 'border-emerald-500 bg-emerald-600 text-white'
                    : 'border-[#d6e7dc] bg-[#f4faf6] text-[#354c3f] hover:bg-emerald-50 dark:border-[#233d2f] dark:bg-[#16291f] dark:text-[#c7dbcf]'
                }`}
              >
                Wszystkie ({MUSCLE_ACTIONS_DB.length})
              </button>
              {MUSCLE_REGION_GROUPS.map((grp) => {
                const count = MUSCLE_ACTIONS_DB.filter((m) => m.regionGroupPl === grp).length;
                const active = regionFilter === grp;
                return (
                  <button
                    key={grp}
                    type="button"
                    onClick={() => setRegionFilter(grp)}
                    className={`shrink-0 rounded-xl border px-2.5 py-1 text-xs font-bold transition ${
                      active
                        ? 'border-emerald-500 bg-emerald-600 text-white'
                        : 'border-[#d6e7dc] bg-[#f4faf6] text-[#354c3f] hover:bg-emerald-50 dark:border-[#233d2f] dark:bg-[#16291f] dark:text-[#c7dbcf]'
                    }`}
                  >
                    {grp} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main 2-Column Workspace */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[310px_minmax(0,1fr)]">
            {/* Left Sidebar: Muscle List (Compact horizontal/collapsible picker on mobile, tall list on desktop) */}
            <aside className="rounded-2xl border-2 border-[#d6e7dc] bg-white p-2.5 dark:border-[#233d2f] dark:bg-[#112018]">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
                  Lista mięśni ({filteredMuscles.length})
                </span>
                {onOpenSrsMusclesDeck && (
                  <button
                    type="button"
                    onClick={onOpenSrsMusclesDeck}
                    className="text-[11px] font-extrabold text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    Fiszki SRS →
                  </button>
                )}
              </div>

              <div className="flex max-h-[210px] flex-col gap-1.5 overflow-y-auto pr-1 lg:max-h-[780px]">
                {filteredMuscles.length === 0 ? (
                  <p className="p-3 text-center text-xs font-semibold text-[#52695b] dark:text-[#94b0a0]">
                    Brak mięśni pasujących do frazy „{searchQuery}”.
                  </p>
                ) : (
                  filteredMuscles.map((profile) => {
                    const anat = ANATOMY_MAP[profile.muscleId];
                    const isSelected = profile.muscleId === selectedProfile.muscleId;
                    const primaryAct = profile.actions.find((a) => a.role === 'primary') ?? profile.actions[0];
                    return (
                      <button
                        key={profile.muscleId}
                        type="button"
                        data-testid={`muscle-list-item-${profile.muscleId}`}
                        onClick={() => {
                          setSelectedMuscleId(profile.muscleId);
                          setActivePresetId(undefined);
                        }}
                        className={`w-full rounded-xl border-2 px-3 py-2 text-left transition ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50/90 dark:border-emerald-600 dark:bg-emerald-950/60'
                            : 'border-transparent bg-[#f8fcfa] hover:border-[#c5dfd0] dark:bg-[#15271d] dark:hover:border-[#2a4a39]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-extrabold leading-snug text-emerald-950 dark:text-white">
                            {anat?.namePl ?? profile.muscleId}
                          </span>
                          {profile.biarticular && (
                            <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-amber-900 dark:bg-amber-950/70 dark:text-amber-300">
                              2-staw.
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] font-semibold text-[#52695b] dark:text-[#94b0a0]">
                          {primaryAct?.movementLabelPl ?? profile.shortTaglinePl}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>

            {/* Right Main Panel: Selected Muscle 3D Simulator + Exhaustive Functional Card */}
            <div className="min-w-0 space-y-4">
              {/* Muscle Identity Header */}
              <div className="rounded-2xl border-2 border-[#d6e7dc] bg-white p-4 dark:border-[#233d2f] dark:bg-[#112018]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-lg bg-emerald-100 px-2 py-0.5 text-[11px] font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {selectedProfile.regionGroupPl}
                      </span>
                      <span
                        className={`rounded-lg px-2 py-0.5 text-[11px] font-extrabold ${
                          selectedProfile.biarticular
                            ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300'
                            : 'bg-[#ebf5ee] text-[#354c3f] dark:bg-[#1b3125] dark:text-[#c7dbcf]'
                        }`}
                      >
                        {selectedProfile.biarticular ? 'Mięsień dwustawowy / wielostawowy' : 'Mięsień jednostawowy'}
                      </span>
                      {selectedAnatomy?.spinalSegments && (
                        <span className="rounded-lg bg-rose-100 px-2 py-0.5 font-mono-tabular text-[11px] font-extrabold text-rose-800 dark:bg-rose-950/70 dark:text-rose-300">
                          {selectedAnatomy.spinalSegments}
                        </span>
                      )}
                    </div>
                    <h2 className="mt-1.5 font-display text-xl font-extrabold text-emerald-950 sm:text-2xl dark:text-white">
                      {selectedAnatomy?.namePl ?? selectedProfile.muscleId}
                    </h2>
                    {selectedAnatomy?.nameEn && (
                      <div className="text-xs font-semibold text-[#52695b] dark:text-[#94b0a0]">
                        {selectedAnatomy.nameEn}
                      </div>
                    )}
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-[#2d4337] dark:text-[#d1e4d9]">
                      {selectedProfile.shortTaglinePl}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-1.5 sm:shrink-0">
                    {selectedAnatomy && (
                      <button
                        type="button"
                        onClick={() => onShowIn3D(selectedAnatomy)}
                        className="inline-flex items-center gap-1.5 rounded-xl border-b-2 border-emerald-700 bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-emerald-500"
                      >
                        <Box className="h-3.5 w-3.5" />
                        <span>Eksplorator 3D</span>
                      </button>
                    )}
                    {selectedLovettTest && onVisualizeClinicalTest && (
                      <button
                        type="button"
                        onClick={() => onVisualizeClinicalTest(selectedLovettTest)}
                        className="inline-flex items-center gap-1.5 rounded-xl border-2 border-amber-400 bg-amber-50 px-3 py-1.5 text-xs font-extrabold text-amber-900 transition hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
                      >
                        <Stethoscope className="h-3.5 w-3.5" />
                        <span>Test Lovetta</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setCompareIdA(selectedProfile.muscleId);
                        if (selectedProfile.antagonistIds[0]) {
                          setCompareIdB(selectedProfile.antagonistIds[0]);
                        }
                        setSubTab('reverse');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#c5dfd0] bg-[#f4faf6] px-3 py-1.5 text-xs font-extrabold text-emerald-900 transition hover:bg-emerald-50 dark:border-[#2a4a39] dark:bg-[#16291f] dark:text-emerald-200"
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                      <span>Porównaj</span>
                    </button>
                  </div>
                </div>

                {/* Quick PP / PK / Innervation Grid */}
                {selectedAnatomy && (
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-2.5 dark:border-rose-900/60 dark:bg-rose-950/30">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                        Przyczep początkowy (PP)
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-emerald-950 dark:text-[#e3efe8]">
                        {selectedAnatomy.pp}
                      </p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                        Przyczep końcowy (PK)
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-emerald-950 dark:text-[#e3efe8]">
                        {selectedAnatomy.pk}
                      </p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 dark:border-amber-900/60 dark:bg-amber-950/30">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                        Unerwienie i segmenty
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-emerald-950 dark:text-[#e3efe8]">
                        {selectedAnatomy.innervation}
                        {selectedAnatomy.spinalSegments ? ` (${selectedAnatomy.spinalSegments})` : ''}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* LIVE 3D REAL-BONE KINEMATIC MOTION SIMULATOR */}
              <MuscleMotionSimulator3D
                profile={selectedProfile}
                activePresetId={activePresetId}
                onSelectPreset={setActivePresetId}
                isDarkMode={isDarkMode}
              />

              {/* Section 1: Detailed Joint Actions Table */}
              <section className="rounded-2xl border-2 border-[#d6e7dc] bg-white p-4 dark:border-[#233d2f] dark:bg-[#112018]">
                <h3 className="flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                  <Activity className="h-4 w-4" />
                  <span>Szczegółowe ruchy w stawach ({selectedProfile.actions.length})</span>
                </h3>
                <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {selectedProfile.actions.map((act, idx) => (
                    <div
                      key={`${act.joint}_${act.movementKey}_${idx}`}
                      className={`rounded-xl border-2 p-3 ${
                        act.role === 'primary'
                          ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/70 dark:bg-emerald-950/30'
                          : 'border-[#d6e7dc] bg-[#f8fcfa] dark:border-[#233d2f] dark:bg-[#15261d]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="text-[11px] font-extrabold uppercase tracking-wide text-[#52695b] dark:text-[#94b0a0]">
                          {act.jointLabelPl}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                            act.role === 'primary'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300'
                          }`}
                        >
                          {act.role === 'primary' ? 'Główny agonista' : 'Pomocniczy'}
                        </span>
                      </div>
                      <div className="mt-1 text-sm font-extrabold text-emerald-950 dark:text-white">
                        {act.movementLabelPl}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] font-semibold text-[#52695b] dark:text-[#94b0a0]">
                        <span>{act.planePl}</span>
                        <span>•</span>
                        <span>{act.axisPl}</span>
                      </div>
                      <div className="mt-1 font-mono-tabular text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                        SFTR: {act.sftrRangePl}
                      </div>
                      {act.notePl && (
                        <p className="mt-1 text-xs leading-snug text-[#354c3f] dark:text-[#c7dbcf]">
                          {act.notePl}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Section 2: Subparts / Heads / Aktony (when present) */}
              {selectedProfile.subparts && selectedProfile.subparts.length > 0 && (
                <section className="rounded-2xl border-2 border-[#d6e7dc] bg-white p-4 dark:border-[#233d2f] dark:bg-[#112018]">
                  <h3 className="flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                    <Layers className="h-4 w-4" />
                    <span>Podział na aktony / głowy — zróżnicowanie czynności</span>
                  </h3>
                  <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {selectedProfile.subparts.map((sp) => (
                      <div
                        key={sp.namePl}
                        className="flex flex-col justify-between rounded-xl border-2 border-[#d6e7dc] bg-[#f8fcfa] p-3 dark:border-[#233d2f] dark:bg-[#15261d]"
                      >
                        <div>
                          <div className="text-xs font-extrabold text-emerald-950 dark:text-white">
                            {sp.namePl}
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-[#2d4337] dark:text-[#c7dbcf]">
                            {sp.actionsPl}
                          </p>
                          {sp.clinicalNotePl && (
                            <p className="mt-1.5 rounded-lg bg-amber-50/90 px-2 py-1 text-[11px] font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                              {sp.clinicalNotePl}
                            </p>
                          )}
                        </div>
                        {sp.presetId && (
                          <button
                            type="button"
                            onClick={() => setActivePresetId(sp.presetId)}
                            className="mt-2.5 inline-flex w-fit items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-[11px] font-extrabold text-emerald-800 transition hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                          >
                            <Play className="h-3 w-3" />
                            <span>Symuluj w 3D</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Section 3: Punctum Fixum (Open vs Closed Kinetic Chain) */}
              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border-2 border-[#d6e7dc] bg-white p-4 dark:border-[#233d2f] dark:bg-[#112018]">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                    Łańcuch otwarty (Punctum Fixum = PP)
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[#2d4337] sm:text-sm dark:text-[#d1e4d9]">
                    {selectedProfile.openChainSummaryPl}
                  </p>
                </div>
                <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/60 p-4 dark:border-emerald-800 dark:bg-emerald-950/35">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Łańcuch zamknięty / Odwrócony przyczep (PF = PK!)
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-emerald-950 sm:text-sm dark:text-emerald-100">
                    {selectedProfile.closedChainReversedPl}
                  </p>
                </div>
              </section>

              {/* Section 4: Concentric / Eccentric / Stabilization */}
              <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-2xl border-2 border-[#d6e7dc] bg-white p-3.5 dark:border-[#233d2f] dark:bg-[#112018]">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                    Praca koncentryczna
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#2d4337] dark:text-[#c7dbcf]">
                    {selectedProfile.concentricWorkPl}
                  </p>
                </div>
                <div className="rounded-2xl border-2 border-[#d6e7dc] bg-white p-3.5 dark:border-[#233d2f] dark:bg-[#112018]">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    Praca ekscentryczna (hamowanie)
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#2d4337] dark:text-[#c7dbcf]">
                    {selectedProfile.eccentricWorkPl}
                  </p>
                </div>
                <div className="rounded-2xl border-2 border-[#d6e7dc] bg-white p-3.5 dark:border-[#233d2f] dark:bg-[#112018]">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    Rola stabilizacyjna
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#2d4337] dark:text-[#c7dbcf]">
                    {selectedProfile.stabilizationRolePl}
                  </p>
                </div>
              </section>

              {/* Section 5: Physio Practice — Stretch/PIR, Functional Exercise, Lovett, Palpation */}
              <section className="rounded-2xl border-2 border-[#d6e7dc] bg-white p-4 dark:border-[#233d2f] dark:bg-[#112018]">
                <h3 className="flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                  <Hand className="h-4 w-4" />
                  <span>Warsztat fizjoterapeuty — rozciąganie, Lovett, palpacja</span>
                </h3>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-[#f4faf6] p-3 dark:bg-[#15261d]">
                    <div className="text-[11px] font-extrabold uppercase text-emerald-800 dark:text-emerald-300">
                      Pozycja rozciągania / PIR
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-[#2d4337] dark:text-[#d1e4d9]">
                      {selectedProfile.stretchingPositionPl}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#f4faf6] p-3 dark:bg-[#15261d]">
                    <div className="text-[11px] font-extrabold uppercase text-emerald-800 dark:text-emerald-300">
                      Ćwiczenie wzmacniające / funkcjonalne
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-[#2d4337] dark:text-[#d1e4d9]">
                      {selectedProfile.functionalExercisePl}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#f4faf6] p-3 dark:bg-[#15261d]">
                    <div className="text-[11px] font-extrabold uppercase text-emerald-800 dark:text-emerald-300">
                      Badanie siły (Skala Lovetta 0–5 / test kliniczny)
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-[#2d4337] dark:text-[#d1e4d9]">
                      {selectedProfile.lovettPositionPl}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#f4faf6] p-3 dark:bg-[#15261d]">
                    <div className="text-[11px] font-extrabold uppercase text-emerald-800 dark:text-emerald-300">
                      Palpacja (jak wyczuć mięsień pod palcami)
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-[#2d4337] dark:text-[#d1e4d9]">
                      {selectedProfile.palpationLandmarkPl}
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 6: Clinical Palsy & Exam Trap */}
              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border-2 border-rose-200 bg-rose-50/75 p-4 dark:border-rose-900/70 dark:bg-rose-950/35">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                    <Stethoscope className="h-4 w-4" />
                    <span>Objawy osłabienia, przykurczu i porażenia nerwu</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-rose-950 sm:text-sm dark:text-rose-100">
                    {selectedProfile.weaknessAndPalsyPl}
                  </p>
                </div>
                <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/85 p-4 dark:border-amber-800 dark:bg-amber-950/40">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Pułapka egzaminacyjna — zapamiętaj!</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-amber-950 sm:text-sm dark:text-amber-100">
                    {selectedProfile.examTrapPl}
                  </p>
                </div>
              </section>

              {/* Section 7: Clickable Synergists & Antagonists */}
              <section className="rounded-2xl border-2 border-[#d6e7dc] bg-white p-4 dark:border-[#233d2f] dark:bg-[#112018]">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                      Synergiści (kliknij, aby uruchomić 3D)
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedProfile.synergistIds.length === 0 ? (
                        <span className="text-xs text-[#52695b]">Brak bezpośrednich synergistów w bazie</span>
                      ) : (
                        selectedProfile.synergistIds.map((id) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => jumpToMuscle(id)}
                            className="rounded-xl border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-900 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
                          >
                            {ANATOMY_MAP[id]?.namePl ?? id}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                      Antagoniści (przeciwstawni)
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedProfile.antagonistIds.length === 0 ? (
                        <span className="text-xs text-[#52695b]">Mięsień bez pojedynczego antagonisty kostnego</span>
                      ) : (
                        selectedProfile.antagonistIds.map((id) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => jumpToMuscle(id)}
                            className="rounded-xl border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-900 transition hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200"
                          >
                            {ANATOMY_MAP[id]?.namePl ?? id}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 2: REVERSE FILTER ("KTO WYKONUJE TEN RUCH?") & COMPARATOR     */}
      {/* ===================================================================== */}
      {subTab === 'reverse' && (
        <div className="space-y-5">
          {/* PART A: Reverse Filter */}
          <section
            className="space-y-3 rounded-2xl border-2 border-[#d6e7dc] bg-white p-4 dark:border-[#233d2f] dark:bg-[#112018]"
            data-testid="reverse-movement-lookup"
          >
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-emerald-600" />
              <h2 className="font-display text-base font-extrabold text-emerald-950 dark:text-white">
                Odwrotny filtr: „Kto wykonuje ten ruch?”
              </h2>
            </div>

            {/* Joint pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {JOINT_GROUPS_META.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  data-testid={`reverse-joint-${j.id}`}
                  onClick={() => handleSelectJoint(j.id)}
                  className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-extrabold transition ${
                    selectedJoint === j.id
                      ? 'border-emerald-500 bg-emerald-600 text-white'
                      : 'border-[#d6e7dc] bg-[#f4faf6] text-[#354c3f] hover:bg-emerald-50 dark:border-[#233d2f] dark:bg-[#16291f] dark:text-[#c7dbcf]'
                  }`}
                >
                  {j.shortLabelPl}
                </button>
              ))}
            </div>

            {/* Movement pills for selected joint */}
            <div className="flex flex-wrap gap-1.5">
              {jointMovements.map((mv) => (
                <button
                  key={mv.movementKey}
                  type="button"
                  data-testid={`reverse-move-${mv.movementKey}`}
                  onClick={() => setSelectedMovementKey(mv.movementKey)}
                  className={`rounded-xl border-2 px-3 py-1.5 text-xs font-bold transition ${
                    selectedMovementKey === mv.movementKey
                      ? 'border-amber-500 bg-amber-50 text-amber-950 dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-200'
                      : 'border-[#d6e7dc] bg-white text-[#354c3f] hover:bg-[#f4faf6] dark:border-[#233d2f] dark:bg-[#0f1d15] dark:text-[#c7dbcf]'
                  }`}
                >
                  {mv.movementLabelPl}
                </button>
              ))}
            </div>

            {/* Results Grid */}
            {reverseResult && (
              <div className="space-y-3 pt-1">
                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[#f4faf6] px-3 py-2 text-xs font-bold text-[#354c3f] dark:bg-[#15271d] dark:text-[#c7dbcf]">
                  <span className="font-extrabold text-emerald-800 dark:text-emerald-300">
                    {reverseResult.option.jointLabelPl} → {reverseResult.option.movementLabelPl}
                  </span>
                  <span>•</span>
                  <span>{reverseResult.option.planePl}</span>
                  <span>•</span>
                  <span className="font-mono-tabular">SFTR: {reverseResult.option.sftrNormPl}</span>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {/* Primary Agonists */}
                  <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800/70 dark:bg-emerald-950/25">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      Główni agoniści ({reverseResult.primary.length})
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {reverseResult.primary.length === 0 ? (
                        <p className="text-xs text-[#52695b]">Brak wpisów w tej kategorii.</p>
                      ) : (
                        reverseResult.primary.map((m) => (
                          <button
                            key={m.muscleId}
                            type="button"
                            onClick={() => jumpToMuscle(m.muscleId)}
                            className="flex w-full items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-white px-2.5 py-2 text-left text-xs font-extrabold text-emerald-950 transition hover:border-emerald-500 dark:border-emerald-900 dark:bg-[#112018] dark:text-white"
                          >
                            <span className="truncate">{ANATOMY_MAP[m.muscleId]?.namePl ?? m.muscleId}</span>
                            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Secondary Synergists */}
                  <div className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800/70 dark:bg-amber-950/25">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                      Pomocniczy synergiści ({reverseResult.secondary.length})
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {reverseResult.secondary.length === 0 ? (
                        <p className="text-xs text-[#52695b]">Brak dodatkowych synergistów w bazie.</p>
                      ) : (
                        reverseResult.secondary.map((m) => (
                          <button
                            key={m.muscleId}
                            type="button"
                            onClick={() => jumpToMuscle(m.muscleId)}
                            className="flex w-full items-center justify-between gap-2 rounded-xl border border-amber-200 bg-white px-2.5 py-2 text-left text-xs font-bold text-emerald-950 transition hover:border-amber-500 dark:border-amber-900 dark:bg-[#112018] dark:text-white"
                          >
                            <span className="truncate">{ANATOMY_MAP[m.muscleId]?.namePl ?? m.muscleId}</span>
                            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Antagonists */}
                  <div className="rounded-xl border-2 border-rose-200 bg-rose-50/50 p-3 dark:border-rose-800/70 dark:bg-rose-950/25">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                      Antagoniści ({reverseResult.antagonists.length})
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {reverseResult.antagonists.length === 0 ? (
                        <p className="text-xs text-[#52695b]">Brak bezpośredniego ruchu przeciwstawnego.</p>
                      ) : (
                        reverseResult.antagonists.map((m) => (
                          <button
                            key={m.muscleId}
                            type="button"
                            onClick={() => jumpToMuscle(m.muscleId)}
                            className="flex w-full items-center justify-between gap-2 rounded-xl border border-rose-200 bg-white px-2.5 py-2 text-left text-xs font-bold text-emerald-950 transition hover:border-rose-500 dark:border-rose-900 dark:bg-[#112018] dark:text-white"
                          >
                            <span className="truncate">{ANATOMY_MAP[m.muscleId]?.namePl ?? m.muscleId}</span>
                            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* PART B: 2-Muscle Side-by-Side Comparator */}
          <section
            className="space-y-4 rounded-2xl border-2 border-[#d6e7dc] bg-white p-4 dark:border-[#233d2f] dark:bg-[#112018]"
            data-testid="muscle-comparator"
          >
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-emerald-600" />
              <h2 className="font-display text-base font-extrabold text-emerald-950 dark:text-white">
                Porównywarka 2 mięśni (egzaminacyjne pary!)
              </h2>
            </div>

            {/* Featured quick pairs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {FEATURED_MUSCLE_COMPARISONS.map((pair) => (
                <button
                  key={`${pair.idA}_${pair.idB}`}
                  type="button"
                  onClick={() => {
                    setCompareIdA(pair.idA);
                    setCompareIdB(pair.idB);
                  }}
                  className={`shrink-0 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition ${
                    compareIdA === pair.idA && compareIdB === pair.idB
                      ? 'border-emerald-500 bg-emerald-600 text-white'
                      : 'border-[#d6e7dc] bg-[#f4faf6] text-[#354c3f] hover:bg-emerald-50 dark:border-[#233d2f] dark:bg-[#16291f] dark:text-[#c7dbcf]'
                  }`}
                >
                  {pair.labelPl}
                </button>
              ))}
            </div>

            {/* Two Selectors */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Mięsień A
                </label>
                <select
                  value={compareIdA}
                  onChange={(e) => setCompareIdA(e.target.value)}
                  data-testid="compare-select-a"
                  className="w-full rounded-xl border-2 border-[#d6e7dc] bg-[#f8fcfa] px-3 py-2 text-xs font-bold text-emerald-950 dark:border-[#233d2f] dark:bg-[#0d1912] dark:text-white"
                >
                  {sortedMusclesForSelect.map((m) => (
                    <option key={m.muscleId} value={m.muscleId}>
                      {ANATOMY_MAP[m.muscleId]?.namePl ?? m.muscleId}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Mięsień B
                </label>
                <select
                  value={compareIdB}
                  onChange={(e) => setCompareIdB(e.target.value)}
                  data-testid="compare-select-b"
                  className="w-full rounded-xl border-2 border-[#d6e7dc] bg-[#f8fcfa] px-3 py-2 text-xs font-bold text-emerald-950 dark:border-[#233d2f] dark:bg-[#0d1912] dark:text-white"
                >
                  {sortedMusclesForSelect.map((m) => (
                    <option key={m.muscleId} value={m.muscleId}>
                      {ANATOMY_MAP[m.muscleId]?.namePl ?? m.muscleId}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {comparison && (
              <div className="space-y-3">
                {/* Summary Badges */}
                <div className="flex flex-wrap gap-2">
                  {comparison.areSynergists && (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      Synergiści ({comparison.sharedActions.length} wspólne ruchy)
                    </span>
                  )}
                  {comparison.areAntagonists && (
                    <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-extrabold text-rose-800 dark:bg-rose-950/70 dark:text-rose-300">
                      Antagoniści ({comparison.oppositeActionPairs.length} pary przeciwstawne)
                    </span>
                  )}
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-900 dark:bg-amber-950/70 dark:text-amber-300">
                    {comparison.sameInnervation ? 'Wspólny nerw główny' : 'Różne unerwienie'}
                  </span>
                </div>

                {/* Shared vs Opposite Actions */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800/70 dark:bg-emerald-950/25">
                    <div className="text-[11px] font-extrabold uppercase text-emerald-800 dark:text-emerald-300">
                      Wspólne ruchy (synergia)
                    </div>
                    {comparison.sharedActions.length === 0 ? (
                      <p className="mt-1 text-xs text-[#52695b]">Brak wspólnych ruchów w tym samym stawie.</p>
                    ) : (
                      <ul className="mt-1.5 space-y-1 text-xs font-semibold text-emerald-950 dark:text-emerald-100">
                        {comparison.sharedActions.map((s, idx) => (
                          <li key={idx}>
                            • <strong>{s.jointLabelPl}:</strong> {s.movementLabelPl}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 dark:border-rose-800/70 dark:bg-rose-950/25">
                    <div className="text-[11px] font-extrabold uppercase text-rose-800 dark:text-rose-300">
                      Ruchy przeciwstawne (antagonizm)
                    </div>
                    {comparison.oppositeActionPairs.length === 0 ? (
                      <p className="mt-1 text-xs text-[#52695b]">Brak przeciwstawnych wektorów w tym samym stawie.</p>
                    ) : (
                      <ul className="mt-1.5 space-y-1 text-xs font-semibold text-rose-950 dark:text-rose-100">
                        {comparison.oppositeActionPairs.map((op, idx) => (
                          <li key={idx}>
                            • <strong>{op.jointLabelPl}:</strong> {op.actionAPl} ↔ {op.actionBPl}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Side-by-side detail cards */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[comparison.muscleA, comparison.muscleB].map((prof, idx) => {
                    const anat = ANATOMY_MAP[prof.muscleId];
                    const uniqueActs = idx === 0 ? comparison.onlyInA : comparison.onlyInB;
                    return (
                      <div
                        key={prof.muscleId + idx}
                        className="space-y-2 rounded-xl border-2 border-[#d6e7dc] bg-[#f8fcfa] p-3.5 dark:border-[#233d2f] dark:bg-[#15261d]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-extrabold text-emerald-950 dark:text-white">
                              {anat?.namePl ?? prof.muscleId}
                            </div>
                            <div className="text-[11px] font-bold text-[#52695b] dark:text-[#94b0a0]">
                              {prof.biarticular ? 'Dwustawowy' : 'Jednostawowy'} • {anat?.spinalSegments}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => jumpToMuscle(prof.muscleId)}
                            className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-extrabold text-white hover:bg-emerald-500"
                          >
                            Symuluj 3D
                          </button>
                        </div>
                        <div className="text-xs text-[#2d4337] dark:text-[#d1e4d9]">
                          <strong>PP:</strong> {anat?.pp}
                        </div>
                        <div className="text-xs text-[#2d4337] dark:text-[#d1e4d9]">
                          <strong>PK:</strong> {anat?.pk}
                        </div>
                        <div className="text-xs text-[#2d4337] dark:text-[#d1e4d9]">
                          <strong>Unerwienie:</strong> {anat?.innervation}
                        </div>
                        <div className="text-xs text-[#2d4337] dark:text-[#d1e4d9]">
                          <strong>Łańcuch zamknięty:</strong> {prof.closedChainReversedPl}
                        </div>
                        {uniqueActs.length > 0 && (
                          <div className="rounded-lg bg-white p-2 text-xs dark:bg-[#0f1d15]">
                            <span className="font-extrabold text-emerald-700 dark:text-emerald-300">
                              Wyłącznie w tym mięśniu:{' '}
                            </span>
                            {uniqueActs.map((u) => u.movementLabelPl).join('; ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 3: INTERACTIVE 3D MUSCLE ACTIONS QUIZ                         */}
      {/* ===================================================================== */}
      {subTab === 'quiz' && (
        <div className="space-y-4" data-testid="muscle-actions-quiz">
          {quizQuestions.length === 0 ? (
            /* Quiz Setup Card */
            <div className="space-y-4 rounded-2xl border-2 border-[#d6e7dc] bg-white p-5 dark:border-[#233d2f] dark:bg-[#112018]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-extrabold text-emerald-950 dark:text-white">
                    Quiz Ruchów Mięśni 3D
                  </h2>
                  <p className="mt-0.5 text-xs text-[#52695b] dark:text-[#94b0a0]">
                    Rozpoznawaj mięśnie z żywej animacji 3D, sprawdzaj podział na aktony i odwrócony przyczep (Punctum Fixum). +15 XP za każdą poprawną odpowiedź!
                  </p>
                </div>
                {onOpenSrsMusclesDeck && (
                  <button
                    type="button"
                    onClick={onOpenSrsMusclesDeck}
                    className="inline-flex items-center gap-1.5 rounded-xl border-2 border-emerald-400 bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Otwórz Fiszki SRS (74 mięśnie)</span>
                  </button>
                )}
              </div>

              {/* Quiz Type */}
              <div>
                <div className="mb-1.5 text-xs font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
                  1. Rodzaj pytań
                </div>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: 'mixed', label: 'Mieszany (wszystkie 4 tryby)' },
                      { id: 'visual_3d_motion', label: 'Rozpoznaj z animacji 3D' },
                      { id: 'subpart_akton', label: 'Aktony i głowy mięśni' },
                      { id: 'closed_chain_pf', label: 'Punctum Fixum (łańcuch zamknięty)' },
                      { id: 'function_and_nerve', label: 'Funkcja i unerwienie' },
                    ] as const
                  ).map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => setQuizKind(k.id)}
                      className={`rounded-xl border-2 px-3 py-2 text-xs font-extrabold transition ${
                        quizKind === k.id
                          ? 'border-emerald-500 bg-emerald-600 text-white'
                          : 'border-[#d6e7dc] bg-[#f4faf6] text-[#354c3f] hover:bg-emerald-50 dark:border-[#233d2f] dark:bg-[#16291f] dark:text-[#c7dbcf]'
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Region Filter */}
              <div>
                <div className="mb-1.5 text-xs font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
                  2. Zakres regionalny
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setQuizRegion('all')}
                    className={`rounded-xl border px-2.5 py-1.5 text-xs font-bold ${
                      quizRegion === 'all'
                        ? 'border-emerald-500 bg-emerald-600 text-white'
                        : 'border-[#d6e7dc] bg-[#f4faf6] text-[#354c3f] dark:border-[#233d2f] dark:bg-[#16291f] dark:text-[#c7dbcf]'
                    }`}
                  >
                    Całe ciało (74)
                  </button>
                  {MUSCLE_REGION_GROUPS.map((grp) => (
                    <button
                      key={grp}
                      type="button"
                      onClick={() => setQuizRegion(grp)}
                      className={`rounded-xl border px-2.5 py-1.5 text-xs font-bold ${
                        quizRegion === grp
                          ? 'border-emerald-500 bg-emerald-600 text-white'
                          : 'border-[#d6e7dc] bg-[#f4faf6] text-[#354c3f] dark:border-[#233d2f] dark:bg-[#16291f] dark:text-[#c7dbcf]'
                      }`}
                    >
                      {grp}
                    </button>
                  ))}
                </div>
              </div>

              {/* Count + Start */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-[#52695b] dark:text-[#94b0a0]">Liczba pytań:</span>
                  {([5, 10] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setQuizCount(n)}
                      className={`rounded-xl border-2 px-3 py-1.5 text-xs font-extrabold ${
                        quizCount === n
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                          : 'border-[#d6e7dc] text-[#52695b] dark:border-[#233d2f] dark:text-[#94b0a0]'
                      }`}
                    >
                      {n} pytań
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  data-testid="start-muscle-quiz-btn"
                  onClick={handleStartQuiz}
                  className="inline-flex items-center gap-2 rounded-2xl border-b-4 border-emerald-700 bg-emerald-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-500"
                >
                  <Play className="h-4 w-4" />
                  <span>Rozpocznij Quiz 3D</span>
                </button>
              </div>
            </div>
          ) : quizFinished ? (
            /* Quiz Summary Card */
            <div className="space-y-4 rounded-2xl border-2 border-[#d6e7dc] bg-white p-5 dark:border-[#233d2f] dark:bg-[#112018]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    <Award className="h-7 w-7" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-extrabold text-emerald-950 dark:text-white">
                      Podsumowanie Quizu Ruchów Mięśni
                    </h2>
                    <p className="text-xs font-bold text-[#52695b] dark:text-[#94b0a0]">
                      Wynik: {quizResults.filter((r) => r.isCorrect).length}/{quizResults.length} (
                      {Math.round((quizResults.filter((r) => r.isCorrect).length / Math.max(1, quizResults.length)) * 100)}
                      %) • +{quizResults.filter((r) => r.isCorrect).length * 15} XP
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleStartQuiz}
                    className="inline-flex items-center gap-1.5 rounded-xl border-b-2 border-emerald-700 bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Nowa seria</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuizQuestions([]);
                      setQuizFinished(false);
                    }}
                    className="rounded-xl border-2 border-[#d6e7dc] px-4 py-2 text-xs font-extrabold text-[#354c3f] dark:border-[#233d2f] dark:text-[#c7dbcf]"
                  >
                    Zmień ustawienia
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {quizResults.map((res, idx) => (
                  <div
                    key={res.question.id}
                    className={`flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${
                      res.isCorrect
                        ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/25'
                        : 'border-rose-200 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/30'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold">
                        {res.isCorrect ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        ) : (
                          <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
                        )}
                        <span className="text-emerald-950 dark:text-white">
                          Pytanie {idx + 1}: {ANATOMY_MAP[res.question.muscleId]?.namePl}
                        </span>
                        <span className="rounded-md bg-white/80 px-1.5 py-0.5 text-[10px] text-[#52695b] dark:bg-[#0f1d15] dark:text-[#94b0a0]">
                          {res.question.kindLabelPl}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#354c3f] dark:text-[#c7dbcf]">
                        {res.question.explanationPl}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => jumpToMuscle(res.question.muscleId, res.question.kinematicPresetId)}
                      className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-extrabold text-white hover:bg-emerald-500"
                    >
                      Zobacz w 3D
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : currentQuestion ? (
            /* Active Quiz Question */
            <div className="space-y-4 rounded-2xl border-2 border-[#d6e7dc] bg-white p-4 sm:p-5 dark:border-[#233d2f] dark:bg-[#112018]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-emerald-100 px-2.5 py-1 font-mono-tabular text-xs font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    Pytanie {quizIndex + 1} / {quizQuestions.length}
                  </span>
                  <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-extrabold text-amber-900 dark:bg-amber-950/70 dark:text-amber-300">
                    {currentQuestion.kindLabelPl}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQuizQuestions([]);
                    setQuizFinished(false);
                  }}
                  className="text-xs font-bold text-[#52695b] hover:underline dark:text-[#94b0a0]"
                >
                  Zakończ quiz
                </button>
              </div>

              {/* Embedded Masked Live 3D Simulator for visual_3d_motion questions */}
              {currentQuestion.kind === 'visual_3d_motion' && MUSCLE_ACTIONS_MAP[currentQuestion.muscleId] && (
                <MuscleMotionSimulator3D
                  profile={MUSCLE_ACTIONS_MAP[currentQuestion.muscleId]}
                  activePresetId={currentQuestion.kinematicPresetId}
                  maskedQuizMode={quizSelectedOption === null}
                  compact
                  isDarkMode={isDarkMode}
                />
              )}

              <div className="space-y-1">
                <h3 className="text-sm font-extrabold leading-relaxed text-emerald-950 sm:text-base dark:text-white">
                  {currentQuestion.promptPl}
                </h3>
                <p className="text-xs font-semibold text-[#52695b] dark:text-[#94b0a0]">
                  {currentQuestion.hintPl}
                </p>
              </div>

              {/* Options 1-4 */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {currentQuestion.options.map((opt, idx) => {
                  const answered = quizSelectedOption !== null;
                  const isCorrect = idx === currentQuestion.correctIndex;
                  const isChosen = idx === quizSelectedOption;
                  let cls =
                    'border-[#d6e7dc] bg-[#f8fcfa] text-emerald-950 hover:border-emerald-500 dark:border-[#233d2f] dark:bg-[#15261d] dark:text-white';
                  if (answered) {
                    if (isCorrect) {
                      cls =
                        'border-emerald-500 bg-emerald-50 text-emerald-950 dark:border-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-100';
                    } else if (isChosen) {
                      cls =
                        'border-rose-500 bg-rose-50 text-rose-950 dark:border-rose-600 dark:bg-rose-950/60 dark:text-rose-100';
                    } else {
                      cls =
                        'border-[#d6e7dc] bg-white opacity-60 dark:border-[#233d2f] dark:bg-[#0f1d15]';
                    }
                  }
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={answered}
                      data-testid={`muscle-quiz-opt-${idx}`}
                      onClick={() => handleChooseQuizOption(idx)}
                      className={`flex items-start gap-2.5 rounded-xl border-2 p-3 text-left text-xs font-bold transition sm:text-sm ${cls}`}
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/90 font-mono-tabular text-[11px] font-extrabold text-emerald-800 shadow-xs dark:bg-[#0d1912] dark:text-emerald-300">
                        {idx + 1}
                      </span>
                      <span className="leading-snug">{opt}</span>
                    </button>
                  );
                })}
              </div>

              {/* Instant Explanation + Next */}
              {quizSelectedOption !== null && (
                <div className="space-y-3 rounded-xl border-2 border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-800 dark:bg-emerald-950/40">
                  <div className="flex items-center gap-2 text-xs font-extrabold">
                    {quizSelectedOption === currentQuestion.correctIndex ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span className="text-emerald-800 dark:text-emerald-300">
                          Brawo! +15 XP
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-rose-600" />
                        <span className="text-rose-800 dark:text-rose-300">
                          Poprawna odpowiedź: {currentQuestion.options[currentQuestion.correctIndex]}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed text-emerald-950 dark:text-emerald-100">
                    {currentQuestion.explanationPl}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => jumpToMuscle(currentQuestion.muscleId, currentQuestion.kinematicPresetId)}
                      className="text-xs font-extrabold text-emerald-700 hover:underline dark:text-emerald-300"
                    >
                      Otwórz kartę mięśnia i pełny symulator 3D →
                    </button>
                    <button
                      type="button"
                      data-testid="muscle-quiz-next-btn"
                      onClick={handleNextQuizQuestion}
                      className="inline-flex items-center gap-1.5 rounded-xl border-b-2 border-emerald-700 bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-emerald-500"
                    >
                      <span>
                        {quizIndex + 1 >= quizQuestions.length ? 'Zobacz wynik' : 'Następne pytanie (Enter)'}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
