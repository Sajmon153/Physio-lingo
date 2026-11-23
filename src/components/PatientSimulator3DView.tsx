import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  Box,
  CheckCircle2,
  ClipboardCheck,
  Crosshair,
  FileText,
  GraduationCap,
  Play,
  RotateCcw,
  ShieldAlert,
  Stethoscope,
  User,
  XCircle,
} from 'lucide-react';
import { ANATOMY_MAP } from '../data/anatomyDb';
import { CLINICAL_TEST_MAP } from '../data/clinicalTestsDb';
import { getNerveProfileByStructureId } from '../data/nerveMuscleMap';
import {
  PATIENT_CASE_REGION_META,
  PATIENT_CASES_DB,
  type PatientCaseScenario,
} from '../data/patientCasesDb';
import { formatBilingualName } from '../three/anatomyTranslator';
import type {
  AnatomicalLayerId,
  ClinicalNerveHighlight,
  ClinicalTestHighlightState,
  DermatomeHighlightState,
  PatientCaseHistoryEntry,
  PatientCaseMode,
  PatientCaseRegionGroup,
} from '../types/anatomy';
import { calculateOsceGrade, getLocalDateKey } from '../utils/gameLogic';
import {
  AnatomyViewport3D,
  type AnatomyViewport3DHandle,
  type SelectedPartInfo,
} from './AnatomyViewport3D';

interface PatientSimulator3DViewProps {
  isDarkMode: boolean;
  caseHistory: PatientCaseHistoryEntry[];
  onCompleteCase: (entry: PatientCaseHistoryEntry) => void;
  onRecordStructureMistake?: (structureId: string) => void;
  onVisualizeTestIn3D?: (testId: string) => void;
  onInspectStructureIn3D?: (structureId: string) => void;
}

interface ShuffledOption {
  label: string;
  subtitle?: string;
  valueKey: string;
  isCorrect: boolean;
}

interface CaseSessionShuffled {
  stage1: ShuffledOption[];
  stage2: ShuffledOption[];
  stage3: ShuffledOption[];
  stage5: ShuffledOption[];
}

interface StageOutcome {
  stageIndex: number; // 0..4
  stageTitle: string;
  isCorrect: boolean;
  chosenLabel: string;
  correctLabel: string;
  explanationPl: string;
  extraNotePl?: string;
}

const STAGE_TITLES = [
  '1. Wywiad i czerwone flagi',
  '2. Badanie neuro 3D',
  '3. Dobór testu 3D',
  '4. Wskaż strukturę 3D',
  '5. Plan fizjoterapii',
] as const;

const BASE_CONTEXT_LAYERS: Partial<Record<AnatomicalLayerId, boolean>> = {
  bone: true,
  cartilage: true,
  muscle: true,
  bursa: false,
  tendon: false,
  ligament: false,
  artery: false,
  vein: false,
  nerve: false,
  organ: false,
  skin: false,
};

function shuffleList<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildShuffledCaseOptions(scenario: PatientCaseScenario): CaseSessionShuffled {
  const mapMcq = (options: string[], correctIndex: number): ShuffledOption[] =>
    shuffleList(
      options.map((label, idx) => ({
        label,
        valueKey: `opt_${idx}`,
        isCorrect: idx === correctIndex,
      })),
    );

  const stage3 = shuffleList(
    scenario.stage3Test.optionTestIds.map((testId) => {
      const test = CLINICAL_TEST_MAP[testId];
      return {
        label: test ? test.namePl : testId,
        subtitle: test ? test.targetSummary : undefined,
        valueKey: testId,
        isCorrect: testId === scenario.stage3Test.correctTestId,
      };
    }),
  );

  return {
    stage1: mapMcq(scenario.stage1Interview.options, scenario.stage1Interview.correctIndex),
    stage2: mapMcq(scenario.stage2Neuro.options, scenario.stage2Neuro.correctIndex),
    stage3,
    stage5: mapMcq(scenario.stage5Plan.options, scenario.stage5Plan.correctIndex),
  };
}

function formatGradeLabel(grade: number): string {
  return grade.toFixed(1).replace('.', ',');
}

export const PatientSimulator3DView: React.FC<PatientSimulator3DViewProps> = ({
  isDarkMode,
  caseHistory,
  onCompleteCase,
  onRecordStructureMistake,
  onVisualizeTestIn3D,
  onInspectStructureIn3D,
}) => {
  const [mode, setMode] = useState<PatientCaseMode>('learn');
  const [regionFilter, setRegionFilter] = useState<PatientCaseRegionGroup | 'all'>('all');

  // Active simulation state
  const [activeCase, setActiveCase] = useState<PatientCaseScenario | null>(null);
  const [shuffled, setShuffled] = useState<CaseSessionShuffled | null>(null);
  const [stageIndex, setStageIndex] = useState<number>(0); // 0..4
  const [selectedOptionKey, setSelectedOptionKey] = useState<string | null>(null);
  const [stage4Selection, setStage4Selection] = useState<SelectedPartInfo | null>(null);
  const [stageCommitted, setStageCommitted] = useState<boolean>(false);
  const [outcomes, setOutcomes] = useState<StageOutcome[]>([]);
  const [showSummary, setShowSummary] = useState<boolean>(false);
  const [lastAttemptEntry, setLastAttemptEntry] = useState<PatientCaseHistoryEntry | null>(null);

  const viewportRef = useRef<AnatomyViewport3DHandle>(null);

  // Best previous attempt per caseId for catalog badges
  const bestByCaseId = useMemo(() => {
    const map: Record<string, PatientCaseHistoryEntry> = {};
    for (const entry of caseHistory) {
      const prev = map[entry.caseId];
      if (!prev || entry.grade > prev.grade || entry.accuracy > prev.accuracy) {
        map[entry.caseId] = entry;
      }
    }
    return map;
  }, [caseHistory]);

  const completedUniqueCount = Object.keys(bestByCaseId).length;

  const filteredCases = useMemo(
    () =>
      PATIENT_CASES_DB.filter(
        (c) => regionFilter === 'all' || c.regionGroup === regionFilter,
      ),
    [regionFilter],
  );

  const startCase = useCallback((scenario: PatientCaseScenario) => {
    setActiveCase(scenario);
    setShuffled(buildShuffledCaseOptions(scenario));
    setStageIndex(0);
    setSelectedOptionKey(null);
    setStage4Selection(null);
    setStageCommitted(false);
    setOutcomes([]);
    setShowSummary(false);
    setLastAttemptEntry(null);
  }, []);

  const exitCase = useCallback(() => {
    setActiveCase(null);
    setShuffled(null);
    setStageIndex(0);
    setSelectedOptionKey(null);
    setStage4Selection(null);
    setStageCommitted(false);
    setOutcomes([]);
    setShowSummary(false);
    setLastAttemptEntry(null);
  }, []);

  const evaluateCurrentStage = useCallback((): StageOutcome | null => {
    if (!activeCase || !shuffled) return null;

    if (stageIndex === 0) {
      const picked = shuffled.stage1.find((o) => o.valueKey === selectedOptionKey);
      const correct = shuffled.stage1.find((o) => o.isCorrect);
      if (!picked || !correct) return null;
      return {
        stageIndex: 0,
        stageTitle: STAGE_TITLES[0],
        isCorrect: picked.isCorrect,
        chosenLabel: picked.label,
        correctLabel: correct.label,
        explanationPl: activeCase.stage1Interview.explanationPl,
      };
    }

    if (stageIndex === 1) {
      const picked = shuffled.stage2.find((o) => o.valueKey === selectedOptionKey);
      const correct = shuffled.stage2.find((o) => o.isCorrect);
      if (!picked || !correct) return null;
      return {
        stageIndex: 1,
        stageTitle: STAGE_TITLES[1],
        isCorrect: picked.isCorrect,
        chosenLabel: picked.label,
        correctLabel: correct.label,
        explanationPl: activeCase.stage2Neuro.explanationPl,
      };
    }

    if (stageIndex === 2) {
      const picked = shuffled.stage3.find((o) => o.valueKey === selectedOptionKey);
      const correct = shuffled.stage3.find((o) => o.isCorrect);
      if (!picked || !correct) return null;
      return {
        stageIndex: 2,
        stageTitle: STAGE_TITLES[2],
        isCorrect: picked.isCorrect,
        chosenLabel: picked.label,
        correctLabel: correct.label,
        explanationPl: activeCase.stage3Test.explanationPl,
        extraNotePl: activeCase.stage3Test.patientFindingPl,
      };
    }

    if (stageIndex === 3) {
      if (!stage4Selection) return null;
      const accepted = activeCase.stage4Locate3D.acceptedStructureIds;
      const isCorrect = Boolean(
        stage4Selection.structureId && accepted.includes(stage4Selection.structureId),
      );
      const targetEntry = ANATOMY_MAP[activeCase.stage4Locate3D.targetStructureId];
      const correctLabel = targetEntry
        ? formatBilingualName(targetEntry.namePl, targetEntry.nameEn)
        : activeCase.stage4Locate3D.targetStructureId;
      const chosenLabel =
        stage4Selection.bilingualName ||
        formatBilingualName(stage4Selection.namePl, stage4Selection.nameEn);
      return {
        stageIndex: 3,
        stageTitle: STAGE_TITLES[3],
        isCorrect,
        chosenLabel,
        correctLabel,
        explanationPl: activeCase.stage4Locate3D.explanationPl,
      };
    }

    if (stageIndex === 4) {
      const picked = shuffled.stage5.find((o) => o.valueKey === selectedOptionKey);
      const correct = shuffled.stage5.find((o) => o.isCorrect);
      if (!picked || !correct) return null;
      return {
        stageIndex: 4,
        stageTitle: STAGE_TITLES[4],
        isCorrect: picked.isCorrect,
        chosenLabel: picked.label,
        correctLabel: correct.label,
        explanationPl: activeCase.stage5Plan.explanationPl,
      };
    }

    return null;
  }, [activeCase, shuffled, stageIndex, selectedOptionKey, stage4Selection]);

  const finishCase = useCallback(
    (finalOutcomes: StageOutcome[]) => {
      if (!activeCase) return;
      const correctStages = finalOutcomes.filter((o) => o.isCorrect).length;
      const totalStages = 5;
      const accuracy = Math.round((correctStages / totalStages) * 100);
      const grade = calculateOsceGrade(correctStages, totalStages);
      const xpEarned = correctStages * 20 + (correctStages >= 4 ? 25 : 0);

      const entry: PatientCaseHistoryEntry = {
        id: `pcase_${Date.now()}`,
        caseId: activeCase.id,
        caseTitle: activeCase.titlePl,
        date: getLocalDateKey(),
        mode,
        correctStages,
        totalStages,
        accuracy,
        grade,
        xpEarned,
      };

      setLastAttemptEntry(entry);
      setShowSummary(true);
      onCompleteCase(entry);
    },
    [activeCase, mode, onCompleteCase],
  );

  // Confirm stage in Learn mode (reveals feedback + 3D highlight) or immediately advance in OSCE mode
  const handleCommitStage = useCallback(() => {
    const outcome = evaluateCurrentStage();
    if (!outcome || !activeCase) return;

    if (!outcome.isCorrect && stageIndex === 3) {
      onRecordStructureMistake?.(activeCase.stage4Locate3D.targetStructureId);
    }

    const nextOutcomes = [...outcomes, outcome];

    if (mode === 'osce') {
      setOutcomes(nextOutcomes);
      if (stageIndex >= 4) {
        finishCase(nextOutcomes);
      } else {
        setStageIndex((prev) => prev + 1);
        setSelectedOptionKey(null);
        setStage4Selection(null);
        setStageCommitted(false);
        viewportRef.current?.clearIsolatedMuscle?.();
      }
      return;
    }

    // Learn mode: stay on stage and reveal instant clinical explanation + 3D visual confirmation
    setOutcomes(nextOutcomes);
    setStageCommitted(true);

    if (stageIndex === 3 && !outcome.isCorrect) {
      viewportRef.current?.selectAndFocusTarget?.({
        structureId: activeCase.stage4Locate3D.targetStructureId,
        silent: true,
      });
    }
  }, [
    evaluateCurrentStage,
    activeCase,
    stageIndex,
    outcomes,
    mode,
    finishCase,
    onRecordStructureMistake,
  ]);

  const handleAdvanceFromLearnFeedback = useCallback(() => {
    if (!activeCase) return;
    if (stageIndex >= 4) {
      finishCase(outcomes);
      return;
    }
    setStageIndex((prev) => prev + 1);
    setSelectedOptionKey(null);
    setStage4Selection(null);
    setStageCommitted(false);
    viewportRef.current?.clearIsolatedMuscle?.();
  }, [activeCase, stageIndex, outcomes, finishCase]);

  // Compute dynamic 3D overlays & layer visibility per stage
  const stageVisualConfig = useMemo<{
    visibleLayers: Partial<Record<AnatomicalLayerId, boolean>>;
    dermatomeHighlight: DermatomeHighlightState | null;
    clinicalNerveHighlight: ClinicalNerveHighlight | null;
    clinicalTestHighlight: ClinicalTestHighlightState | null;
  }>(() => {
    if (!activeCase) {
      return {
        visibleLayers: BASE_CONTEXT_LAYERS,
        dermatomeHighlight: null,
        clinicalNerveHighlight: null,
        clinicalTestHighlight: null,
      };
    }

    const revealInLearn = mode === 'learn' && stageCommitted;

    // Stage 2 (index 1): Neurological 3D exam (masked dermatome or masked nerve-muscle highlight)
    if (stageIndex === 1) {
      if (activeCase.stage2Neuro.dermatomeRootId) {
        return {
          visibleLayers: BASE_CONTEXT_LAYERS,
          dermatomeHighlight: {
            rootId: activeCase.stage2Neuro.dermatomeRootId,
            mode: activeCase.stage2Neuro.dermatomeMode ?? 'both',
            side: 'both',
            maskedLabel: !revealInLearn,
          },
          clinicalNerveHighlight: null,
          clinicalTestHighlight: null,
        };
      }
      if (activeCase.stage2Neuro.nerveId) {
        const prof = getNerveProfileByStructureId(activeCase.stage2Neuro.nerveId);
        if (prof) {
          return {
            visibleLayers: {
              ...BASE_CONTEXT_LAYERS,
              nerve: true,
            },
            dermatomeHighlight: null,
            clinicalNerveHighlight: {
              nerveStructureId: prof.nerveStructureId,
              nerveNamePl: revealInLearn
                ? prof.nerveNamePl
                : 'Badany szlak nerwowy (nazwa ukryta)',
              muscleIds: prof.innervatedMuscleIds,
            },
            clinicalTestHighlight: null,
          };
        }
      }
    }

    // Stage 3 (index 2): After answering in Learn mode, highlight ALL structures of the chosen clinical test
    if (stageIndex === 2 && revealInLearn) {
      const testObj = CLINICAL_TEST_MAP[activeCase.stage3Test.correctTestId];
      if (testObj) {
        return {
          visibleLayers: BASE_CONTEXT_LAYERS,
          dermatomeHighlight: null,
          clinicalNerveHighlight: null,
          clinicalTestHighlight: {
            testId: testObj.id,
            testNamePl: testObj.namePl,
            structureIds: testObj.structureIds,
          },
        };
      }
    }

    // Stage 4 (index 3): Pure interactive 3D structure clicking with target layers exposed
    if (stageIndex === 3) {
      return {
        visibleLayers: activeCase.stage4Locate3D.visibleLayers,
        dermatomeHighlight: null,
        clinicalNerveHighlight: null,
        clinicalTestHighlight: null,
      };
    }

    // Stage 5 (index 4): In Learn mode show test context on 3D; in OSCE keep clean neutral anatomy
    if (stageIndex === 4 && mode === 'learn') {
      const testObj = CLINICAL_TEST_MAP[activeCase.stage3Test.correctTestId];
      if (testObj) {
        return {
          visibleLayers: BASE_CONTEXT_LAYERS,
          dermatomeHighlight: null,
          clinicalNerveHighlight: null,
          clinicalTestHighlight: {
            testId: testObj.id,
            testNamePl: testObj.namePl,
            structureIds: testObj.structureIds,
          },
        };
      }
    }

    return {
      visibleLayers: BASE_CONTEXT_LAYERS,
      dermatomeHighlight: null,
      clinicalNerveHighlight: null,
      clinicalTestHighlight: null,
    };
  }, [activeCase, stageIndex, mode, stageCommitted]);

  // =========================================================================
  // VIEW 1: PATIENT CASE CATALOG
  // =========================================================================
  if (!activeCase) {
    return (
      <div
        data-testid="patient-simulator-catalog"
        className="mx-auto w-full max-w-5xl space-y-6 pb-24 md:pb-12"
      >
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
              <Stethoscope className="h-3.5 w-3.5" />
              <span>Symulator Pacjenta 3D • 5-etapowe badanie kliniczne</span>
            </div>
            <h1 className="mt-2 font-display text-2xl font-extrabold text-emerald-950 dark:text-white sm:text-3xl">
              Przypadki Kliniczne 3D
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[#354c3f] dark:text-[#94b0a0]">
              Przeprowadź kompletne badanie fizjoterapeutyczne: wywiad i czerwone flagi → badanie neurologiczne 3D → dobór testu 3D → wskazanie uszkodzonej struktury na modelu 3D → plan terapii.
            </p>
          </div>

          <div className="rounded-2xl border-2 border-[#d6e7dc] bg-white px-4 py-3 text-right dark:border-[#233d2f] dark:bg-[#112018]">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
              Ukończone przypadki
            </div>
            <div
              data-testid="patient-cases-completed-count"
              className="font-mono-tabular text-xl font-extrabold text-emerald-700 dark:text-emerald-300"
            >
              {completedUniqueCount} / {PATIENT_CASES_DB.length}
            </div>
          </div>
        </div>

        {/* Mode Toggle: Learn vs OSCE Exam */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            data-testid="case-mode-learn"
            onClick={() => setMode('learn')}
            className={`flex items-start gap-3 rounded-2xl border-2 border-b-4 p-4 text-left transition active:translate-y-0.5 active:border-b-2 ${
              mode === 'learn'
                ? 'border-emerald-700 bg-emerald-500 text-white shadow-sm'
                : 'border-[#d6e7dc] bg-white text-emerald-950 hover:border-emerald-400 dark:border-[#233d2f] dark:bg-[#112018] dark:text-emerald-50'
            }`}
          >
            <Activity className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <div className="font-display text-sm font-extrabold">Tryb nauki (z omówieniem 3D)</div>
              <p
                className={`mt-0.5 text-xs ${
                  mode === 'learn' ? 'text-white/90' : 'text-[#52695b] dark:text-[#94b0a0]'
                }`}
              >
                Natychmiastowe wyjaśnienie kliniczne i podświetlenie struktur testu/nerwu na 3D po każdym z 5 etapów. Bez utraty serc.
              </p>
            </div>
          </button>

          <button
            type="button"
            data-testid="case-mode-osce"
            onClick={() => setMode('osce')}
            className={`flex items-start gap-3 rounded-2xl border-2 border-b-4 p-4 text-left transition active:translate-y-0.5 active:border-b-2 ${
              mode === 'osce'
                ? 'border-amber-700 bg-amber-500 text-white shadow-sm'
                : 'border-[#d6e7dc] bg-white text-emerald-950 hover:border-amber-400 dark:border-[#233d2f] dark:bg-[#112018] dark:text-emerald-50'
            }`}
          >
            <GraduationCap className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <div className="font-display text-sm font-extrabold">
                Tryb egzaminacyjny OSCE (ocena 2,0–5,0)
              </div>
              <p
                className={`mt-0.5 text-xs ${
                  mode === 'osce' ? 'text-white/90' : 'text-[#52695b] dark:text-[#94b0a0]'
                }`}
              >
                Zero podpowiedzi między etapami — sprawdzian realnego wnioskowania klinicznego z pełnym protokołem i oceną akademicką na końcu.
              </p>
            </div>
          </button>
        </section>

        {/* Region Filter Chips */}
        <div className="flex flex-wrap gap-2">
          {PATIENT_CASE_REGION_META.map((item) => {
            const active = regionFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`case-region-filter-${item.id}`}
                onClick={() => setRegionFilter(item.id)}
                className={`rounded-xl border-2 px-3.5 py-1.5 text-xs font-extrabold transition ${
                  active
                    ? 'border-emerald-600 bg-emerald-500 text-white'
                    : 'border-[#d6e7dc] bg-white text-[#16291f] hover:border-emerald-400 dark:border-[#233d2f] dark:bg-[#112018] dark:text-emerald-50'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Cases Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredCases.map((scenario) => {
            const best = bestByCaseId[scenario.id];
            return (
              <div
                key={scenario.id}
                data-testid={`patient-case-card-${scenario.id}`}
                className={`flex flex-col justify-between rounded-2xl border-2 bg-white p-5 shadow-xs transition hover:border-emerald-400 dark:bg-[#112018] ${
                  scenario.isRedFlagCase
                    ? 'border-rose-300 dark:border-rose-800/80'
                    : 'border-[#d6e7dc] dark:border-[#233d2f]'
                }`}
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-lg bg-emerald-100 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                        {scenario.regionLabelPl}
                      </span>
                      <span className="rounded-lg bg-[#f4faf6] px-2 py-0.5 text-[11px] font-bold capitalize text-[#52695b] dark:bg-[#182b21] dark:text-[#94b0a0]">
                        {scenario.difficulty}
                      </span>
                      {scenario.isRedFlagCase && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-2 py-0.5 text-[11px] font-extrabold text-rose-800 dark:bg-rose-950/80 dark:text-rose-300">
                          <ShieldAlert className="h-3 w-3" />
                          <span>Czerwona flaga</span>
                        </span>
                      )}
                    </div>

                    {best && (
                      <span className="font-mono-tabular inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-extrabold text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>
                          {formatGradeLabel(best.grade)} ({best.correctStages}/5)
                        </span>
                      </span>
                    )}
                  </div>

                  <h2 className="mt-3 font-display text-base font-extrabold text-emerald-950 dark:text-white">
                    {scenario.titlePl}
                  </h2>
                  <p className="mt-0.5 text-xs font-semibold text-[#52695b] dark:text-[#94b0a0]">
                    {scenario.subtitlePl}
                  </p>

                  <div className="mt-3 rounded-xl border border-[#e6f0ea] bg-[#f4faf6] p-3 text-xs dark:border-[#233d2f] dark:bg-[#182b21]/70">
                    <div className="flex items-center gap-1.5 font-extrabold text-[#16291f] dark:text-emerald-100">
                      <User className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>
                        {scenario.patientCard.initialsAndAge} • {scenario.patientCard.occupation}
                      </span>
                    </div>
                    <p className="mt-1 leading-relaxed text-[#354c3f] dark:text-[#c7dbcf]">
                      {scenario.patientCard.chiefComplaint}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  data-testid={`start-patient-case-${scenario.id}`}
                  onClick={() => startCase(scenario)}
                  className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-b-4 px-4 py-2.5 font-display text-sm font-extrabold text-white transition active:translate-y-0.5 active:border-b-2 ${
                    mode === 'osce'
                      ? 'border-amber-700 bg-amber-500 hover:bg-amber-600'
                      : 'border-emerald-700 bg-emerald-500 hover:bg-emerald-600'
                  }`}
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>
                    {mode === 'osce'
                      ? 'Rozpocznij egzamin OSCE (5 etapów)'
                      : 'Rozpocznij badanie 3D (5 etapów)'}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: SUMMARY / OSCE PROTOCOL
  // =========================================================================
  if (showSummary && lastAttemptEntry) {
    const passed = lastAttemptEntry.grade >= 3.0;
    return (
      <div
        data-testid="patient-case-summary"
        className="mx-auto w-full max-w-4xl space-y-6 pb-24 md:pb-12"
      >
        <div className="rounded-3xl border-2 border-emerald-200 bg-white p-6 text-center shadow-sm dark:border-emerald-800 dark:bg-[#112018]">
          <div
            className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border-b-4 text-white ${
              passed
                ? 'border-emerald-700 bg-emerald-500'
                : 'border-rose-700 bg-rose-500'
            }`}
          >
            {passed ? <Award className="h-7 w-7" /> : <AlertTriangle className="h-7 w-7" />}
          </div>

          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#f4faf6] px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-emerald-800 dark:bg-[#182b21] dark:text-emerald-300">
            <span>
              {lastAttemptEntry.mode === 'osce'
                ? 'Protokół Egzaminu OSCE'
                : 'Podsumowanie Badania Klinicznego 3D'}
            </span>
          </div>

          <h1 className="mt-2 font-display text-xl font-extrabold text-emerald-950 dark:text-white sm:text-2xl">
            {activeCase.stage5Plan.finalDiagnosisPl}
          </h1>
          <p className="mt-1 text-xs font-semibold text-[#52695b] dark:text-[#94b0a0]">
            Pacjent: {activeCase.patientCard.initialsAndAge} • {activeCase.titlePl}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-800 dark:bg-emerald-950/40">
              <div
                data-testid="case-summary-grade"
                className="font-mono-tabular text-2xl font-extrabold text-emerald-700 dark:text-emerald-300"
              >
                {formatGradeLabel(lastAttemptEntry.grade)}
              </div>
              <div className="text-[11px] font-bold text-[#52695b] dark:text-[#94b0a0]">
                Ocena (2,0–5,0)
              </div>
            </div>
            <div className="rounded-2xl border border-[#d6e7dc] bg-[#f4faf6] p-3 dark:border-[#233d2f] dark:bg-[#182b21]">
              <div className="font-mono-tabular text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
                {lastAttemptEntry.correctStages}/{lastAttemptEntry.totalStages}
              </div>
              <div className="text-[11px] font-bold text-[#52695b] dark:text-[#94b0a0]">
                Zaliczone etapy
              </div>
            </div>
            <div className="rounded-2xl border border-[#d6e7dc] bg-[#f4faf6] p-3 dark:border-[#233d2f] dark:bg-[#182b21]">
              <div className="font-mono-tabular text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
                {lastAttemptEntry.accuracy}%
              </div>
              <div className="text-[11px] font-bold text-[#52695b] dark:text-[#94b0a0]">
                Skuteczność
              </div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/70 dark:bg-amber-950/40">
              <div className="font-mono-tabular text-2xl font-extrabold text-amber-600 dark:text-amber-400">
                +{lastAttemptEntry.xpEarned} XP
              </div>
              <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
                Zdobyte XP
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            {onVisualizeTestIn3D && (
              <button
                type="button"
                data-testid="case-summary-open-test-3d"
                onClick={() => onVisualizeTestIn3D(activeCase.stage3Test.correctTestId)}
                className="inline-flex items-center gap-2 rounded-2xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2"
              >
                <Box className="h-4 w-4" />
                <span>Zobacz test w Eksploratorze 3D</span>
              </button>
            )}
            {onInspectStructureIn3D && (
              <button
                type="button"
                onClick={() => onInspectStructureIn3D(activeCase.stage4Locate3D.targetStructureId)}
                className="inline-flex items-center gap-2 rounded-2xl border-2 border-b-4 border-[#c2d8ca] bg-white px-4 py-2.5 text-xs font-extrabold text-[#16291f] transition hover:border-emerald-400 dark:border-[#294737] dark:bg-[#182b21] dark:text-emerald-50"
              >
                <Crosshair className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Obejrzyj uszkodzoną strukturę 3D</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => startCase(activeCase)}
              className="inline-flex items-center gap-2 rounded-2xl border-2 border-b-4 border-[#c2d8ca] bg-white px-4 py-2.5 text-xs font-extrabold text-[#16291f] transition hover:border-emerald-400 dark:border-[#294737] dark:bg-[#182b21] dark:text-emerald-50"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Powtórz przypadek</span>
            </button>
            <button
              type="button"
              data-testid="case-summary-back-catalog"
              onClick={exitCase}
              className="inline-flex items-center gap-2 rounded-2xl border-2 border-b-4 border-[#c2d8ca] bg-[#f4faf6] px-4 py-2.5 text-xs font-extrabold text-[#16291f] transition hover:border-emerald-400 dark:border-[#294737] dark:bg-[#182b21] dark:text-emerald-50"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Wróć do katalogu (12)</span>
            </button>
          </div>
        </div>

        {/* Full 5-stage clinical debrief */}
        <section
          data-testid="case-summary-debrief"
          className="space-y-3 rounded-2xl border-2 border-[#d6e7dc] bg-white p-5 dark:border-[#233d2f] dark:bg-[#112018]"
        >
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="font-display text-sm font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
              Szczegółowy protokół 5 etapów badania
            </h2>
          </div>

          <div className="space-y-3">
            {outcomes.map((item) => (
              <div
                key={item.stageIndex}
                className={`rounded-2xl border-2 p-4 text-xs ${
                  item.isCorrect
                    ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/70 dark:bg-emerald-950/30'
                    : 'border-rose-200 bg-rose-50/50 dark:border-rose-800/70 dark:bg-rose-950/30'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-display text-sm font-extrabold text-[#16291f] dark:text-white">
                    {item.isCorrect ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                    )}
                    <span>{item.stageTitle}</span>
                  </div>
                  <span
                    className={`rounded-lg px-2 py-0.5 text-[11px] font-extrabold ${
                      item.isCorrect
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    }`}
                  >
                    {item.isCorrect ? 'Poprawnie' : 'Do poprawy'}
                  </span>
                </div>

                {!item.isCorrect && (
                  <div className="mt-2 space-y-1">
                    <div className="text-rose-800 dark:text-rose-300">
                      <span className="font-extrabold">Twój wybór: </span>
                      {item.chosenLabel}
                    </div>
                    <div className="text-emerald-800 dark:text-emerald-300">
                      <span className="font-extrabold">Prawidłowa odpowiedź: </span>
                      {item.correctLabel}
                    </div>
                  </div>
                )}

                {item.extraNotePl && (
                  <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50/80 p-2.5 text-[11px] font-semibold text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-200">
                    {item.extraNotePl}
                  </div>
                )}

                <p className="mt-2 leading-relaxed text-[#354c3f] dark:text-[#c7dbcf]">
                  {item.explanationPl}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: ACTIVE 5-STAGE CLINICAL EXAMINATION
  // =========================================================================
  const currentOptions: ShuffledOption[] =
    shuffled === null
      ? []
      : stageIndex === 0
        ? shuffled.stage1
        : stageIndex === 1
          ? shuffled.stage2
          : stageIndex === 2
            ? shuffled.stage3
            : stageIndex === 4
              ? shuffled.stage5
              : [];

  const currentPrompt =
    stageIndex === 0
      ? activeCase.stage1Interview.promptPl
      : stageIndex === 1
        ? activeCase.stage2Neuro.promptPl
        : stageIndex === 2
          ? activeCase.stage3Test.promptPl
          : stageIndex === 3
            ? activeCase.stage4Locate3D.promptPl
            : activeCase.stage5Plan.promptPl;

  const latestOutcome = stageCommitted ? outcomes[outcomes.length - 1] ?? null : null;
  const canCommitStage =
    !stageCommitted && (stageIndex === 3 ? stage4Selection !== null : selectedOptionKey !== null);

  return (
    <div
      data-testid="patient-case-active-view"
      className="mx-auto w-full max-w-6xl space-y-4 pb-24 md:pb-10"
    >
      {/* Top Bar + 5-step Progress Stepper */}
      <div className="rounded-2xl border-2 border-[#d6e7dc] bg-white p-4 dark:border-[#233d2f] dark:bg-[#112018]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-testid="case-exit-btn"
              onClick={exitCase}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#d6e7dc] px-2.5 py-1.5 text-xs font-extrabold text-[#354c3f] transition hover:bg-[#ebf5ee] dark:border-[#294737] dark:text-[#c7dbcf] dark:hover:bg-[#182b21]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Katalog</span>
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-sm font-extrabold text-emerald-950 dark:text-white sm:text-base">
                  {activeCase.titlePl}
                </span>
                {activeCase.isRedFlagCase && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                    <ShieldAlert className="h-3 w-3" />
                    <span>Uwaga: wywiad alarmowy</span>
                  </span>
                )}
              </div>
              <div className="text-[11px] font-semibold text-[#52695b] dark:text-[#94b0a0]">
                {activeCase.patientCard.initialsAndAge} • {activeCase.patientCard.occupation} •{' '}
                {activeCase.patientCard.duration}
              </div>
            </div>
          </div>

          <span
            className={`rounded-xl px-3 py-1 text-xs font-extrabold ${
              mode === 'osce'
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
            }`}
          >
            {mode === 'osce' ? 'Tryb egzaminacyjny OSCE' : 'Tryb nauki'}
          </span>
        </div>

        {/* 5-step progress indicator */}
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {STAGE_TITLES.map((title, idx) => {
            const doneOutcome = outcomes.find((o) => o.stageIndex === idx);
            const isCurrent = idx === stageIndex;
            let pillClass =
              'border-[#d6e7dc] bg-[#f4faf6] text-[#6b8274] dark:border-[#233d2f] dark:bg-[#182b21] dark:text-[#739180]';
            if (isCurrent) {
              pillClass =
                'border-emerald-600 bg-emerald-500 text-white shadow-xs';
            } else if (doneOutcome) {
              if (mode === 'osce') {
                pillClass =
                  'border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200';
              } else if (doneOutcome.isCorrect) {
                pillClass =
                  'border-emerald-400 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200';
              } else {
                pillClass =
                  'border-rose-400 bg-rose-100 text-rose-900 dark:border-rose-700 dark:bg-rose-950/60 dark:text-rose-200';
              }
            }
            return (
              <div
                key={title}
                className={`truncate rounded-xl border px-2 py-1.5 text-center text-[10px] font-extrabold sm:text-[11px] ${pillClass}`}
              >
                {title}
              </div>
            );
          })}
        </div>
      </div>

      {/* Patient Chart Strip (always visible for clinical reasoning) */}
      <div
        data-testid="patient-case-card-header"
        className="rounded-2xl border-2 border-[#d6e7dc] bg-[#f4faf6] px-4 py-3 dark:border-[#233d2f] dark:bg-[#15261d]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="inline-flex items-center gap-1.5 font-extrabold text-emerald-950 dark:text-emerald-100">
            <FileText className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Karta wywiadu pacjenta</span>
          </div>
          <span className="rounded-lg bg-white px-2 py-0.5 font-mono-tabular text-[11px] font-bold text-amber-700 dark:bg-[#112018] dark:text-amber-300">
            VAS: {activeCase.patientCard.vasPain}
          </span>
        </div>
        <p className="mt-1.5 text-xs italic leading-relaxed text-[#26382e] dark:text-[#d1e5d9]">
          {activeCase.patientCard.quotePl}
        </p>
      </div>

      {/* Main 2-column Workspace: 3D Viewport + Active Clinical Decision Panel */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <AnatomyViewport3D
            ref={viewportRef}
            region={activeCase.region3D}
            isDarkMode={isDarkMode}
            enableExtendedLayers
            initialVisibleLayers={stageVisualConfig.visibleLayers}
            dermatomeHighlight={stageVisualConfig.dermatomeHighlight}
            clinicalNerveHighlight={stageVisualConfig.clinicalNerveHighlight}
            clinicalTestHighlight={stageVisualConfig.clinicalTestHighlight}
            showMuscleGroupingToggle={false}
            showClippingControl={false}
            hideHoverLabel
            hideHotspotOverlay
            selectedPartId={stageIndex === 3 ? stage4Selection?.id ?? null : null}
            onSelectPart={(part) => {
              if (stageIndex === 3 && !stageCommitted) {
                setStage4Selection(part);
              }
            }}
            heightClassName="h-[360px] sm:h-[440px] lg:h-[520px]"
          />
        </div>

        <div className="flex flex-col gap-4 lg:col-span-5">
          <div className="rounded-2xl border-2 border-[#d6e7dc] bg-white p-5 dark:border-[#233d2f] dark:bg-[#112018]">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-extrabold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
              <Stethoscope className="h-3.5 w-3.5" />
              <span>{STAGE_TITLES[stageIndex]}</span>
            </div>

            {stageIndex === 1 && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs leading-relaxed text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-100">
                {activeCase.stage2Neuro.neuroContextPl}
              </div>
            )}

            <h2 className="mt-3 font-display text-base font-extrabold leading-snug text-emerald-950 dark:text-white">
              {currentPrompt}
            </h2>

            {/* Stage 4: Interactive 3D Picking UI */}
            {stageIndex === 3 ? (
              <div className="mt-4 space-y-3">
                <p className="rounded-xl border border-[#d6e7dc] bg-[#f4faf6] p-3 text-xs leading-relaxed text-[#354c3f] dark:border-[#294737] dark:bg-[#182b21] dark:text-[#c7dbcf]">
                  <span className="font-extrabold text-emerald-800 dark:text-emerald-300">
                    Wskazówka badania:{' '}
                  </span>
                  {activeCase.stage4Locate3D.hintPl}
                </p>

                <div
                  data-testid="case-stage4-selection-status"
                  className={`flex items-center gap-2 rounded-2xl border-2 px-3.5 py-3 text-xs font-extrabold ${
                    stage4Selection
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-200'
                      : 'border-dashed border-[#c2d8ca] bg-[#f4faf6] text-[#52695b] dark:border-[#294737] dark:bg-[#182b21] dark:text-[#94b0a0]'
                  }`}
                >
                  <Crosshair className="h-4 w-4 shrink-0" />
                  <span>
                    {stage4Selection
                      ? stageCommitted && mode === 'learn'
                        ? `Wybrano: ${stage4Selection.bilingualName || formatBilingualName(stage4Selection.namePl, stage4Selection.nameEn)}`
                        : 'Zaznaczono strukturę na modelu 3D — kliknij „Zatwierdź”, aby ocenić wybór'
                      : 'Obróć / przybliż model 3D po lewej i kliknij podejrzewaną strukturę'}
                  </span>
                </div>
              </div>
            ) : (
              /* Stages 1, 2, 3, 5: Shuffled ABCD Options */
              <div className="mt-4 space-y-2.5">
                {currentOptions.map((opt, idx) => {
                  const isPicked = selectedOptionKey === opt.valueKey;
                  let tone =
                    'border-[#d6e7dc] bg-[#f4faf6] text-[#16291f] hover:border-emerald-500 hover:bg-emerald-50 dark:border-[#294737] dark:bg-[#182b21] dark:text-emerald-50';

                  if (stageCommitted && mode === 'learn') {
                    if (opt.isCorrect) {
                      tone = 'border-emerald-600 bg-emerald-500 text-white shadow-sm';
                    } else if (isPicked) {
                      tone = 'border-rose-600 bg-rose-500 text-white shadow-sm';
                    } else {
                      tone =
                        'border-[#d6e7dc] bg-[#f4faf6]/60 text-[#7a9083] opacity-65 dark:border-[#233d2f] dark:bg-[#182b21]/60 dark:text-[#6f8a7a]';
                    }
                  } else if (isPicked) {
                    tone =
                      mode === 'osce'
                        ? 'border-amber-600 bg-amber-50 text-amber-950 dark:border-amber-500 dark:bg-amber-950/60 dark:text-amber-100'
                        : 'border-emerald-600 bg-emerald-50 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-white';
                  }

                  return (
                    <button
                      key={opt.valueKey}
                      type="button"
                      disabled={stageCommitted}
                      data-testid={`case-option-${idx}`}
                      onClick={() => setSelectedOptionKey(opt.valueKey)}
                      className={`flex w-full items-start gap-2.5 rounded-2xl border-2 border-b-4 px-3.5 py-3 text-left text-xs font-bold transition active:translate-y-0.5 active:border-b-2 disabled:cursor-default ${tone}`}
                    >
                      <span
                        className={`font-mono-tabular mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-extrabold ${
                          stageCommitted && mode === 'learn' && (opt.isCorrect || isPicked)
                            ? 'bg-white/20 text-white'
                            : 'bg-white text-emerald-800 dark:bg-[#112018] dark:text-emerald-300'
                        }`}
                      >
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="leading-snug">{opt.label}</div>
                        {opt.subtitle && (
                          <div
                            className={`mt-0.5 text-[11px] font-medium ${
                              stageCommitted && mode === 'learn' && (opt.isCorrect || isPicked)
                                ? 'text-white/90'
                                : 'text-[#52695b] dark:text-[#94b0a0]'
                            }`}
                          >
                            {opt.subtitle}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Primary Commit / Next Button when not yet showing Learn feedback */}
            {!stageCommitted && (
              <button
                type="button"
                disabled={!canCommitStage}
                data-testid={
                  stageIndex === 3 ? 'case-stage4-submit-btn' : 'case-commit-stage-btn'
                }
                onClick={handleCommitStage}
                className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-b-4 px-5 py-3 font-display text-sm font-extrabold text-white transition active:translate-y-0.5 active:border-b-2 disabled:cursor-not-allowed disabled:opacity-45 ${
                  mode === 'osce'
                    ? 'border-amber-700 bg-amber-500 hover:bg-amber-600'
                    : 'border-emerald-700 bg-emerald-500 hover:bg-emerald-600'
                }`}
              >
                <span>
                  {mode === 'osce'
                    ? stageIndex >= 4
                      ? 'Zakończ egzamin OSCE i sprawdź ocenę'
                      : 'Zapisz decyzję i przejdź dalej'
                    : stageIndex === 3
                      ? 'Zatwierdź strukturę na 3D'
                      : 'Sprawdź odpowiedź'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Learn Mode Instant Feedback Card */}
          {stageCommitted && mode === 'learn' && latestOutcome && (
            <div
              data-testid="case-stage-feedback"
              className={`space-y-3 rounded-2xl border-2 p-4 ${
                latestOutcome.isCorrect
                  ? 'border-emerald-300 bg-emerald-50/90 dark:border-emerald-700 dark:bg-emerald-950/40'
                  : 'border-rose-300 bg-rose-50/90 dark:border-rose-700 dark:bg-rose-950/40'
              }`}
            >
              <div className="flex items-center gap-2">
                {latestOutcome.isCorrect ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <XCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
                )}
                <span className="font-display text-sm font-extrabold text-[#16291f] dark:text-white">
                  {latestOutcome.isCorrect
                    ? 'Świetna decyzja kliniczna! (+20 XP)'
                    : `Prawidłowa odpowiedź: ${latestOutcome.correctLabel}`}
                </span>
              </div>

              {latestOutcome.extraNotePl && (
                <div className="rounded-xl border border-amber-200 bg-white/90 p-2.5 text-xs font-semibold text-amber-950 dark:border-amber-800/70 dark:bg-[#112018]/90 dark:text-amber-200">
                  {latestOutcome.extraNotePl}
                </div>
              )}

              <p className="text-xs leading-relaxed text-[#26382e] dark:text-[#d1e5d9]">
                {latestOutcome.explanationPl}
              </p>

              <button
                type="button"
                data-testid="case-next-stage-btn"
                onClick={handleAdvanceFromLearnFeedback}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-5 py-3 font-display text-sm font-extrabold text-white transition hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2"
              >
                <span>
                  {stageIndex >= 4 ? 'Zobacz podsumowanie i ocenę' : 'Przejdź do kolejnego etapu'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
