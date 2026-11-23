/**
 * tests/e2e/harness/appSimulator.ts
 * Headless Application Simulator for Fizjolingo:
 * Production Bridge executing real application logic from:
 * - src/data/anatomyDb.ts
 * - src/data/curriculum.ts
 * - src/three/anatomyTranslator.ts (translateMeshNameToPolish)
 * - src/utils/gameLogic.ts (normalizeAnatomyAnswer, isTypingAnswerCorrect, filterAtlasStructures,
 *   getStructureDetailLabels, createInitialProgress, applyAnswerOutcome, completeLessonProgress,
 *   restoreHeartsProgress, buildLessonTasks, buildHeartRecoveryTasks, getLessonStatuses)
 */

import esbuild from 'esbuild';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ZipLoader } from './zipLoader.ts';
import { REGIONAL_MODEL_PATHS } from './model3dInspector.ts';

export interface BonyLandmarkHotspot {
  id: string;
  boneId: string;
  namePl: string;
  nameEn: string;
  bilingualName: string;
  type: 'landmark' | 'pp' | 'pk';
  position: [number, number, number];
  attachedMuscles?: string[];
  clinicalNotes?: string;
}

export function formatBilingualName(namePl: string, nameEn?: string): string {
  if (!namePl && !nameEn) return 'Struktura anatomiczna';
  const cleanPl = (namePl || '').trim();
  const cleanEn = (nameEn || '').trim();

  if (!cleanEn) return cleanPl || 'Struktura anatomiczna';
  if (cleanPl.toLowerCase().includes(`(${cleanEn.toLowerCase()})`)) return cleanPl;

  const latMatch = cleanPl.match(/^(.+?)\s+(\((?:strona\s+(?:lewa|prawa)|część\s+[^)]+)\))$/i);
  if (latMatch) {
    return `${latMatch[1]} (${cleanEn}) ${latMatch[2]}`;
  }

  if (/\([^)]+\)$/.test(cleanPl)) {
    return cleanPl;
  }

  return `${cleanPl} (${cleanEn})`;
}

export class CutRestoreSimulator {
  private hiddenPartIds: Set<string> = new Set();

  public cut(partId: string | null | undefined): void {
    if (!partId) return;
    this.hiddenPartIds.add(partId);
  }

  public restore(partId: string): void {
    this.hiddenPartIds.delete(partId);
  }

  public restoreAll(): void {
    this.hiddenPartIds.clear();
  }

  public isHidden(partId: string): boolean {
    return this.hiddenPartIds.has(partId);
  }

  public isVisible(partId: string): boolean {
    return !this.hiddenPartIds.has(partId);
  }

  public getHiddenList(): string[] {
    return Array.from(this.hiddenPartIds);
  }

  public getHiddenCount(): number {
    return this.hiddenPartIds.size;
  }
}

export type RegionId =
  | 'shoulder'
  | 'knee'
  | 'spine_thorax'
  | 'pelvis_hip'
  | 'head_neck'
  | 'upper_limb'
  | 'lower_limb';

export type StructureCategory = 'bone' | 'joint_ligament' | 'muscle';

export interface AnatomicalStructure {
  id: string;
  region: RegionId;
  category: StructureCategory;
  namePl: string;
  nameLt?: string;
  aliases: string[];
  pp: string;
  pk: string;
  functionDesc: string;
  innervation: string;
  spinalSegments: string;
  bloodSupply?: string;
  clinicalCorrelation: string;
  funFact: string;
  modelMeshId?: string;
}

export type TaskType =
  | 'matching'
  | 'model3d'
  | 'multiple_choice'
  | 'clinical_case'
  | 'typing';

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

export interface BaseTask {
  id: string;
  type: TaskType;
  structureId: string;
  prompt: string;
  explanation: string;
  funFact: string;
}

export interface MatchingPairsTask extends BaseTask {
  type: 'matching';
  pairs: MatchingPair[];
}

export interface Model3DTask extends BaseTask {
  type: 'model3d';
  region: RegionId | string;
  targetMeshId: string;
  targetNamePl: string;
}

export interface MultipleChoiceTask extends BaseTask {
  type: 'multiple_choice';
  options: string[];
  correctIndex: number;
}

export interface ClinicalCaseTask extends Omit<BaseTask, 'prompt'> {
  type: 'clinical_case';
  prompt?: string;
  patientProfile: string;
  clinicalVignette: string;
  options: string[];
  correctIndex: number;
}

export interface TypingTask extends BaseTask {
  type: 'typing';
  targetLanguage: 'pl';
  acceptedAnswers: string[];
  displayAnswer: string;
  hintChips: string[];
  placeholder: string;
}

export type LessonTask =
  | MatchingPairsTask
  | Model3DTask
  | MultipleChoiceTask
  | ClinicalCaseTask
  | TypingTask;

export interface LessonNode {
  id: string;
  sectionId: RegionId;
  order: number;
  title: string;
  subtitle: string;
  iconName: 'bone' | 'shield' | 'activity' | 'stethoscope';
  xpReward: number;
  structureIds: string[];
}

export interface SkillSection {
  id: RegionId;
  number: number;
  title: string;
  subtitle: string;
  accentColor: 'emerald' | 'green';
  lessons: LessonNode[];
}

export interface MistakeStat {
  wrongCount: number;
  lastMissedAt: string;
}

export interface UserProgress {
  xp: number;
  streak: number;
  lastStudyDate: string | null;
  hearts: number;
  maxHearts: number;
  completedLessonIds: string[];
  lessonBestAccuracy: Record<string, number>;
  mistakeStats: Record<string, MistakeStat>;
  theme: 'light' | 'dark';
}

export interface TranslatedMeshInfo {
  namePl: string;
  structureId?: string;
  category: StructureCategory;
}

export interface DetailLabels {
  firstLabel: string;
  secondLabel: string;
  firstShort: string;
  secondShort: string;
}

export const DEFAULT_MAX_HEARTS = 5;

export const POLISH_DIACRITICS: Record<string, string> = {
  ą: 'a',
  ć: 'c',
  ę: 'e',
  ł: 'l',
  ń: 'n',
  ó: 'o',
  ś: 's',
  ź: 'z',
  ż: 'z',
};

function transpileAndEvalModule(
  sourceCode: string,
  argNames: string[],
  argValues: any[],
  exportNames: string[]
): any {
  let js = esbuild.transformSync(sourceCode, { loader: 'ts' }).code;
  // Remove multiline and single-line imports
  js = js.replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?/gm, '');
  js = js.replace(/^\s*import\s+[^;]+;\s*$/gm, '');
  // Replace export statements
  js = js.replace(/^\s*export\s+const\s+(\w+)/gm, 'const $1');
  js = js.replace(/^\s*export\s+function\s+(\w+)/gm, 'function $1');
  js = js.replace(/^\s*export\s*\{[^}]*\};?/gm, '');
  js = js.replace(/^\s*export\s+default\s+[^;]+;?/gm, '');
  js = js.replace(/^\s*export\s+\*[^;]+;?/gm, '');
  js = js.replace(/^\s*export\s+type[^\n]+/gm, '');
  js = js.replace(/^\s*export\s+interface[^\n]+/gm, '');

  const returnObj = '{ ' + exportNames.join(', ') + ' }';
  const fnBody = js + '\nreturn ' + returnObj + ';';
  const fn = new Function(...argNames, fnBody);
  return fn(...argValues);
}

export class AppSimulator {
  private static instance: AppSimulator | null = null;
  public anatomyDb: AnatomicalStructure[] = [];
  public anatomyMap: Record<string, AnatomicalStructure> = {};
  public skillSections: SkillSection[] = [];
  public lessonTaskBanks: Record<string, LessonTask[]> = {};

  // Real production functions dynamically bridged from src/
  private static prodTranslateMesh: (
    rawName: string,
    tissueHint?: 'muscle' | 'bone' | 'other'
  ) => TranslatedMeshInfo;
  private static prodGameLogic: any;

  private constructor() {
    this.loadData();
  }

  public static getInstance(): AppSimulator {
    if (!AppSimulator.instance) {
      AppSimulator.instance = new AppSimulator();
    }
    return AppSimulator.instance;
  }

  private static ensureLoaded(): void {
    if (!AppSimulator.instance) {
      AppSimulator.getInstance();
    }
  }

  private loadData(): void {
    const loader = ZipLoader.getInstance();

    // 1. Load production ANATOMY_DB & ANATOMY_MAP from src/data/anatomyDb.ts
    const rawDb = loader.readText('src/data/anatomyDb.ts');
    const evalDb = transpileAndEvalModule(rawDb, [], [], ['ANATOMY_DB', 'ANATOMY_MAP']);
    this.anatomyDb = evalDb.ANATOMY_DB || [];
    this.anatomyMap = evalDb.ANATOMY_MAP || {};

    // 2. Load production SKILL_SECTIONS & LESSON_TASK_BANKS from src/data/curriculum.ts
    const rawCurr = loader.readText('src/data/curriculum.ts');
    const evalCurr = transpileAndEvalModule(
      rawCurr,
      ['ANATOMY_DB', 'ANATOMY_MAP'],
      [this.anatomyDb, this.anatomyMap],
      ['SKILL_SECTIONS', 'LESSON_TASK_BANKS']
    );
    this.skillSections = evalCurr.SKILL_SECTIONS || [];
    this.lessonTaskBanks = evalCurr.LESSON_TASK_BANKS || {};

    // 3. Load production anatomyTranslator.ts (translateMeshNameToPolish)
    const rawTrans = loader.readText('src/three/anatomyTranslator.ts');
    const evalTrans = transpileAndEvalModule(
      rawTrans,
      ['ANATOMY_DB'],
      [this.anatomyDb],
      ['translateMeshNameToPolish']
    );
    AppSimulator.prodTranslateMesh = evalTrans.translateMeshNameToPolish;

    // 4. Load production gameLogic.ts
    const rawLogic = loader.readText('src/utils/gameLogic.ts');
    const evalLogic = transpileAndEvalModule(
      rawLogic,
      ['ANATOMY_DB', 'ANATOMY_MAP', 'SKILL_SECTIONS', 'LESSON_TASK_BANKS', 'formatBilingualName'],
      [this.anatomyDb, this.anatomyMap, this.skillSections, this.lessonTaskBanks, formatBilingualName],
      [
        'normalizeAnatomyAnswer',
        'isTypingAnswerCorrect',
        'filterAtlasStructures',
        'getStructureDetailLabels',
        'createInitialProgress',
        'applyAnswerOutcome',
        'completeLessonProgress',
        'restoreHeartsProgress',
        'buildLessonTasks',
        'buildHeartRecoveryTasks',
        'getLessonStatuses',
      ]
    );
    AppSimulator.prodGameLogic = evalLogic;
  }

  // ==========================================================================
  // REAL PRODUCTION BRIDGES
  // ==========================================================================

  public static translateMeshNameToPolish(
    rawName: string,
    tissueHint?: 'muscle' | 'bone' | 'other'
  ): TranslatedMeshInfo {
    AppSimulator.ensureLoaded();
    return AppSimulator.prodTranslateMesh(rawName, tissueHint);
  }

  public static normalizeAnatomyAnswer(raw: string | null | undefined): string {
    AppSimulator.ensureLoaded();
    if (raw === null || raw === undefined) return '';
    return AppSimulator.prodGameLogic.normalizeAnatomyAnswer(raw);
  }

  public static isTypingAnswerCorrect(userInput: string, acceptedAnswers: string[]): boolean {
    AppSimulator.ensureLoaded();
    return AppSimulator.prodGameLogic.isTypingAnswerCorrect(userInput, acceptedAnswers);
  }

  public filterAtlasStructures(
    structures: AnatomicalStructure[],
    query: string,
    regionFilter: string,
    categoryFilter: string
  ): AnatomicalStructure[] {
    AppSimulator.ensureLoaded();
    return AppSimulator.prodGameLogic.filterAtlasStructures(
      query,
      regionFilter,
      categoryFilter,
      structures
    );
  }

  public static getStructureDetailLabels(category: StructureCategory): DetailLabels {
    AppSimulator.ensureLoaded();
    return AppSimulator.prodGameLogic.getStructureDetailLabels(category);
  }

  public static createInitialProgress(): UserProgress {
    AppSimulator.ensureLoaded();
    return AppSimulator.prodGameLogic.createInitialProgress();
  }

  public static applyAnswerOutcome(
    current: UserProgress,
    isCorrect: boolean,
    arg3?: any,
    arg4?: any
  ): UserProgress {
    AppSimulator.ensureLoaded();
    let xpReward = 10;
    let structureId = '';
    if (typeof arg3 === 'number') {
      xpReward = arg3;
      if (typeof arg4 === 'string') {
        structureId = arg4;
      }
    } else if (typeof arg3 === 'string') {
      structureId = arg3;
      if (typeof arg4 === 'number') {
        xpReward = arg4;
      }
    }
    return AppSimulator.prodGameLogic.applyAnswerOutcome(current, isCorrect, structureId, xpReward);
  }

  public static completeLessonProgress(
    progress: UserProgress,
    lessonId: string,
    correctCount: number,
    totalCount: number,
    currentDateStr = new Date().toISOString().slice(0, 10),
    bonusXp = 0
  ): { nextProgress: UserProgress; accuracy: number; streakIncremented: boolean } {
    AppSimulator.ensureLoaded();
    const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    const res = AppSimulator.prodGameLogic.completeLessonProgress(
      progress,
      lessonId,
      accuracy,
      bonusXp,
      currentDateStr
    );
    return {
      nextProgress: res.nextProgress,
      accuracy,
      streakIncremented: res.streakIncremented,
    };
  }

  public static restoreHeartsProgress(progress: UserProgress, amount?: number): UserProgress {
    AppSimulator.ensureLoaded();
    return AppSimulator.prodGameLogic.restoreHeartsProgress(progress, amount);
  }

  public buildHeartRecoveryTasks(mistakeStats: Record<string, MistakeStat>): LessonTask[] {
    AppSimulator.ensureLoaded();
    return AppSimulator.prodGameLogic.buildHeartRecoveryTasks(mistakeStats);
  }

  public getLessonStatuses(
    allLessons: LessonNode[],
    completedLessonIds: string[]
  ): Record<string, 'completed' | 'active' | 'locked'> {
    AppSimulator.ensureLoaded();
    return AppSimulator.prodGameLogic.getLessonStatuses(completedLessonIds);
  }

  public buildLessonTasks(lessonId: string): LessonTask[] {
    AppSimulator.ensureLoaded();
    return AppSimulator.prodGameLogic.buildLessonTasks(lessonId);
  }

  // ==========================================================================
  // 5 QUIZ TASK EVALUATORS
  // ==========================================================================

  public static evaluateMatchingPairs(
    task: MatchingPairsTask,
    userPairs: { left: string; right: string }[]
  ): { isComplete: boolean; matchedCount: number; wrongCount: number } {
    let matchedCount = 0;
    let wrongCount = 0;

    for (const up of userPairs) {
      const match = task.pairs.find(
        (p) =>
          (p.left === up.left && p.right === up.right) ||
          (p.left === up.right && p.right === up.left)
      );
      if (match) {
        matchedCount++;
      } else {
        wrongCount++;
      }
    }

    const isComplete = matchedCount === task.pairs.length && wrongCount === 0;
    return { isComplete, matchedCount, wrongCount };
  }

  public static evaluateModel3DTask(
    task: Model3DTask,
    selected: { rawMeshName?: string; structureId?: string; namePl?: string }
  ): boolean {
    if (selected.structureId && selected.structureId === task.structureId) return true;
    if (
      selected.rawMeshName &&
      task.targetMeshId &&
      selected.rawMeshName.toLowerCase() === task.targetMeshId.toLowerCase()
    ) {
      return true;
    }
    if (selected.namePl && task.targetNamePl) {
      const normSel = AppSimulator.normalizeAnatomyAnswer(selected.namePl);
      const normTarget = AppSimulator.normalizeAnatomyAnswer(task.targetNamePl);
      if (normSel === normTarget || normSel.includes(normTarget) || normTarget.includes(normSel)) {
        return true;
      }
    }
    return false;
  }

  public static evaluateMultipleChoice(task: MultipleChoiceTask, selectedIndex: number | null): boolean {
    if (selectedIndex === null || selectedIndex === undefined) return false;
    return selectedIndex === task.correctIndex;
  }

  public static evaluateClinicalCase(task: ClinicalCaseTask, selectedIndex: number | null): boolean {
    if (selectedIndex === null || selectedIndex === undefined) return false;
    return selectedIndex === task.correctIndex;
  }

  public static evaluateTyping(task: TypingTask, userInput: string): boolean {
    return AppSimulator.isTypingAnswerCorrect(userInput, task.acceptedAnswers);
  }

  // ==========================================================================
  // BONY LANDMARKS & HOTSPOTS CATALOG
  // ==========================================================================

  public static readonly BONY_LANDMARK_HOTSPOTS: BonyLandmarkHotspot[] = [
    {
      id: 'tuberculum_majus',
      boneId: 'humerus',
      namePl: 'Guzek większy kości ramiennej',
      nameEn: 'Greater tubercle of humerus',
      bilingualName: 'Guzek większy kości ramiennej (Greater tubercle of humerus)',
      type: 'pk',
      position: [0.22, 1.37, -0.03],
      attachedMuscles: ['m_supraspinatus', 'm_infraspinatus', 'm_teres_minor'],
      clinicalNotes: "Test Neera i Hawkinsa-Kennedy'ego; bolesny łuk 60–120°",
    },
    {
      id: 'tuberculum_minus',
      boneId: 'humerus',
      namePl: 'Guzek mniejszy kości ramiennej',
      nameEn: 'Lesser tubercle of humerus',
      bilingualName: 'Guzek mniejszy kości ramiennej (Lesser tubercle of humerus)',
      type: 'pk',
      position: [0.18, 1.36, 0.02],
      attachedMuscles: ['m_subscapularis'],
      clinicalNotes: 'Przyczep mięśnia podłopatkowego; test Gerber Lift-Off',
    },
    {
      id: 'sulcus_intertubercularis',
      boneId: 'humerus',
      namePl: 'Bruzda międzyguzkowa',
      nameEn: 'Intertubercular sulcus',
      bilingualName: 'Bruzda międzyguzkowa (Intertubercular sulcus)',
      type: 'landmark',
      position: [0.20, 1.35, 0.01],
      clinicalNotes: 'Ścięgno głowy długiej mięśnia dwugłowego ramienia (biceps); test Yergasona',
    },
    {
      id: 'tuberositas_deltoidea',
      boneId: 'humerus',
      namePl: 'Guzowatość naramienna',
      nameEn: 'Deltoid tuberosity',
      bilingualName: 'Guzowatość naramienna (Deltoid tuberosity)',
      type: 'pk',
      position: [0.23, 1.25, 0.02],
      attachedMuscles: ['m_deltoideus'],
      clinicalNotes: 'Przyczep końcowy mięśnia naramiennego na trzonie kości ramiennej',
    },
    {
      id: 'epicondylus_medialis_humeri',
      boneId: 'humerus',
      namePl: 'Nadkłykieć przyśrodkowy kości ramiennej',
      nameEn: 'Medial epicondyle of humerus',
      bilingualName: 'Nadkłykieć przyśrodkowy kości ramiennej (Medial epicondyle of humerus)',
      type: 'pp',
      position: [0.15, 1.08, -0.01],
      attachedMuscles: ['m_pronator_teres', 'm_flexor_carpi_radialis', 'm_palmaris_longus'],
      clinicalNotes: 'Łokieć golfisty (epicondylitis medialis); bruzda nerwu łokciowego',
    },
    {
      id: 'epicondylus_lateralis_humeri',
      boneId: 'humerus',
      namePl: 'Nadkłykieć boczny kości ramiennej',
      nameEn: 'Lateral epicondyle of humerus',
      bilingualName: 'Nadkłykieć boczny kości ramiennej (Lateral epicondyle of humerus)',
      type: 'pp',
      position: [0.25, 1.08, -0.01],
      attachedMuscles: ['m_extensor_carpi_radialis_brevis', 'm_extensor_digitorum'],
      clinicalNotes: 'Łokieć tenisisty (epicondylitis lateralis); test Cozena i Millsa',
    },
    {
      id: 'processus_coracoideus',
      boneId: 'scapula',
      namePl: 'Wyrostek kruczy łopatki',
      nameEn: 'Coracoid process of scapula',
      bilingualName: 'Wyrostek kruczy łopatki (Coracoid process of scapula)',
      type: 'pp',
      position: [0.14, 1.38, 0.06],
      attachedMuscles: ['m_pectoralis_minor', 'm_coracobrachialis', 'm_biceps_brachii_caput_breve'],
      clinicalNotes: 'Palpacja przedniego barku; więzadło kruczo-barkowe',
    },
    {
      id: 'acromion',
      boneId: 'scapula',
      namePl: 'Wyrostek barkowy łopatki',
      nameEn: 'Acromion of scapula',
      bilingualName: 'Wyrostek barkowy łopatki (Acromion of scapula)',
      type: 'landmark',
      position: [0.22, 1.40, 0.01],
      clinicalNotes: 'Staw obojczykowo-barkowy (ACJ); typy akromionu wg Biglianiego I-III',
    },
    {
      id: 'spina_iliaca_anterior_superior',
      boneId: 'pelvis',
      namePl: 'Kolce biodrowy przedni górny (SIAS)',
      nameEn: 'Anterior superior iliac spine (ASIS)',
      bilingualName: 'Kolce biodrowy przedni górny (Anterior superior iliac spine)',
      type: 'pp',
      position: [0.14, 0.98, 0.08],
      attachedMuscles: ['m_sartorius', 'm_tensor_fasciae_latae'],
      clinicalNotes: 'Punkt orientacyjny pomiaru długości bezwzględnej i względnej kończyny dolnej',
    },
    {
      id: 'trochanter_major',
      boneId: 'femur',
      namePl: 'Krętarz większy kości udowej',
      nameEn: 'Greater trochanter of femur',
      bilingualName: 'Krętarz większy kości udowej (Greater trochanter of femur)',
      type: 'pk',
      position: [0.17, 0.88, 0.01],
      attachedMuscles: ['m_gluteus_medius', 'm_gluteus_minimus', 'm_piriformis'],
      clinicalNotes: 'Zespół bólowy krętarza większego (GTPS); objaw Trendelenburga',
    },
    {
      id: 'trochanter_minor',
      boneId: 'femur',
      namePl: 'Krętarz mniejszy kości udowej',
      nameEn: 'Lesser trochanter of femur',
      bilingualName: 'Krętarz mniejszy kości udowej (Lesser trochanter of femur)',
      type: 'pk',
      position: [0.10, 0.83, -0.02],
      attachedMuscles: ['m_iliopsoas'],
      clinicalNotes: 'Przyczep końcowy mięśnia biodrowo-lędźwiowego; złamania awulsyjne',
    },
    {
      id: 'tuberositas_tibiae',
      boneId: 'tibia',
      namePl: 'Guzowatość piszczeli',
      nameEn: 'Tibial tuberosity',
      bilingualName: 'Guzowatość piszczeli (Tibial tuberosity)',
      type: 'pk',
      position: [0.08, 0.42, 0.04],
      attachedMuscles: ['m_quadriceps_femoris'],
      clinicalNotes: 'Choroba Osgood-Schlattera; przyczep więzadła rzepki',
    },
    {
      id: 'epicondylus_medialis_femoris',
      boneId: 'femur',
      namePl: 'Nadkłykieć przyśrodkowy kości udowej',
      nameEn: 'Medial epicondyle of femur',
      bilingualName: 'Nadkłykieć przyśrodkowy kości udowej (Medial epicondyle of femur)',
      type: 'landmark',
      position: [0.04, 0.46, 0.01],
      clinicalNotes: 'Przyczep więzadła pobocznego piszczelowego (MCL) i guzek przywodzicieli',
    },
    {
      id: 'processus_spinosus_c7',
      boneId: 'vertebra_c7',
      namePl: 'Wyrostek kolczysty C7 (Vertebra prominens)',
      nameEn: 'Spinous process of C7',
      bilingualName: 'Wyrostek kolczysty C7 (Spinous process of C7)',
      type: 'landmark',
      position: [0.00, 1.45, -0.08],
      clinicalNotes: 'Vertebra prominens; punkt odniesienia palpacji kręgosłupa szyjnego i piersiowego',
    },
    {
      id: 'promontorium',
      boneId: 'sacrum',
      namePl: 'Wzgórek kości krzyżowej (Promontorium)',
      nameEn: 'Sacral promontory',
      bilingualName: 'Wzgórek kości krzyżowej (Sacral promontory)',
      type: 'landmark',
      position: [0.00, 0.95, -0.02],
      clinicalNotes: 'Wymiar sprzężnej prawdziwej miednicy (conjugata vera); kąt lędźwiowo-krzyżowy',
    },
  ];

  public static getHotspot(id: string): BonyLandmarkHotspot | undefined {
    return AppSimulator.BONY_LANDMARK_HOTSPOTS.find((h) => h.id === id);
  }

  public static getHotspotsForBone(boneId: string): BonyLandmarkHotspot[] {
    return AppSimulator.BONY_LANDMARK_HOTSPOTS.filter(
      (h) => h.boneId.toLowerCase() === boneId.toLowerCase()
    );
  }

  public static resolveModelUrlForTask(task: { region?: string }): string {
    if (!task || !task.region) {
      return REGIONAL_MODEL_PATHS.full_body;
    }
    return REGIONAL_MODEL_PATHS[task.region] || REGIONAL_MODEL_PATHS.full_body;
  }

  public searchAnatomyDb(
    query: string,
    regionFilter = 'all',
    categoryFilter = 'all'
  ): AnatomicalStructure[] {
    AppSimulator.ensureLoaded();
    const qNorm = AppSimulator.normalizeAnatomyAnswer(query).toLowerCase();

    return this.anatomyDb.filter((s) => {
      if (regionFilter !== 'all' && s.region !== regionFilter) return false;
      if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
      if (!qNorm) return true;

      const plNorm = AppSimulator.normalizeAnatomyAnswer(s.namePl).toLowerCase();
      const ltNorm = s.nameLt ? AppSimulator.normalizeAnatomyAnswer(s.nameLt).toLowerCase() : '';
      const idNorm = s.id.toLowerCase();
      const aliasesNorm = s.aliases.map((a) => AppSimulator.normalizeAnatomyAnswer(a).toLowerCase());

      return (
        plNorm.includes(qNorm) ||
        ltNorm.includes(qNorm) ||
        idNorm.includes(qNorm) ||
        aliasesNorm.some((a) => a.includes(qNorm))
      );
    });
  }
}

export const translateMeshNameToPolish = AppSimulator.translateMeshNameToPolish;
export const BONY_LANDMARK_HOTSPOTS = AppSimulator.BONY_LANDMARK_HOTSPOTS;
