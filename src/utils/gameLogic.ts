import { ANATOMY_DB, ANATOMY_MAP } from '../data/anatomyDb';
import { LESSON_TASK_BANKS, SKILL_SECTIONS } from '../data/curriculum';
import { formatBilingualName } from '../three/anatomyTranslator';
import {
  AnatomicalStructure,
  DeviceViewMode,
  LessonNode,
  LessonTask,
  PatientCaseHistoryEntry,
  PinExamHistoryEntry,
  RegionId,
  SrsCardState,
  StructureCategory,
  StudyMode,
  TaskType,
  UserProgress,
} from '../types/anatomy';

export { formatBilingualName };

export const STORAGE_KEY = 'physiolingo_progress_v1';
export const DEFAULT_MAX_HEARTS = 5;

const POLISH_DIACRITICS: Record<string, string> = {
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

export function createInitialProgress(): UserProgress {
  return {
    xp: 0,
    streak: 0,
    lastStudyDate: null,
    hearts: DEFAULT_MAX_HEARTS,
    maxHearts: DEFAULT_MAX_HEARTS,
    completedLessonIds: [],
    lessonBestAccuracy: {},
    mistakeStats: {},
    theme: 'light',
    studyMode: 'course',
    deviceMode: 'auto',
    uiScale: 100,
    srsProgress: {},
    pinExamHistory: [],
    patientCaseHistory: [],
  };
}

export function sanitizeProgressObject(parsed: Partial<UserProgress>): UserProgress {
  const base = createInitialProgress();
  const srsProgress: Record<string, SrsCardState> = {};
  if (parsed.srsProgress && typeof parsed.srsProgress === 'object') {
    for (const [k, v] of Object.entries(parsed.srsProgress)) {
      if (
        v &&
        typeof v === 'object' &&
        typeof v.intervalDays === 'number' &&
        typeof v.easeFactor === 'number' &&
        typeof v.repetitions === 'number' &&
        typeof v.nextReviewDate === 'string'
      ) {
        srsProgress[k] = v;
      }
    }
  }
  const pinExamHistory: PinExamHistoryEntry[] = Array.isArray(parsed.pinExamHistory)
    ? parsed.pinExamHistory
        .filter(
          (entry): entry is PinExamHistoryEntry =>
            Boolean(entry) &&
            typeof entry.id === 'string' &&
            typeof entry.accuracy === 'number' &&
            typeof entry.totalCount === 'number',
        )
        .slice(0, 15)
    : [];

  const patientCaseHistory: PatientCaseHistoryEntry[] = Array.isArray(parsed.patientCaseHistory)
    ? parsed.patientCaseHistory
        .filter(
          (entry): entry is PatientCaseHistoryEntry =>
            Boolean(entry) &&
            typeof entry.id === 'string' &&
            typeof entry.caseId === 'string' &&
            typeof entry.caseTitle === 'string' &&
            typeof entry.accuracy === 'number' &&
            typeof entry.grade === 'number' &&
            typeof entry.totalStages === 'number',
        )
        .slice(0, 30)
    : [];

  return {
    xp: typeof parsed.xp === 'number' && parsed.xp >= 0 ? parsed.xp : base.xp,
    streak: typeof parsed.streak === 'number' && parsed.streak >= 0 ? parsed.streak : base.streak,
    lastStudyDate: typeof parsed.lastStudyDate === 'string' ? parsed.lastStudyDate : null,
    hearts:
      typeof parsed.hearts === 'number'
        ? Math.max(0, Math.min(DEFAULT_MAX_HEARTS, parsed.hearts))
        : DEFAULT_MAX_HEARTS,
    maxHearts: DEFAULT_MAX_HEARTS,
    completedLessonIds: Array.isArray(parsed.completedLessonIds)
      ? parsed.completedLessonIds.filter((id): id is string => typeof id === 'string')
      : [],
    lessonBestAccuracy:
      parsed.lessonBestAccuracy && typeof parsed.lessonBestAccuracy === 'object'
        ? parsed.lessonBestAccuracy
        : {},
    mistakeStats:
      parsed.mistakeStats && typeof parsed.mistakeStats === 'object' ? parsed.mistakeStats : {},
    theme: parsed.theme === 'dark' ? 'dark' : 'light',
    studyMode: parsed.studyMode === 'free' ? 'free' : 'course',
    deviceMode: (
      parsed.deviceMode === 'phone' ||
      parsed.deviceMode === 'ipad' ||
      parsed.deviceMode === 'desktop'
        ? parsed.deviceMode
        : 'auto'
    ) as DeviceViewMode,
    uiScale:
      typeof parsed.uiScale === 'number' && Number.isFinite(parsed.uiScale)
        ? Math.max(85, Math.min(115, Math.round(parsed.uiScale)))
        : 100,
    srsProgress,
    pinExamHistory,
    patientCaseHistory,
  };
}

/**
 * Maps OSCE / Patient Simulator stage accuracy to the Polish academic grading scale (2.0–5.0).
 */
export function calculateOsceGrade(correctStages: number, totalStages: number): number {
  if (totalStages <= 0) return 2.0;
  const pct = (correctStages / totalStages) * 100;
  if (pct >= 92) return 5.0;
  if (pct >= 80) return 4.5;
  if (pct >= 70) return 4.0;
  if (pct >= 60) return 3.5;
  if (pct >= 50) return 3.0;
  return 2.0;
}

export function loadProgress(): UserProgress {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createInitialProgress();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialProgress();
    const parsed = JSON.parse(raw) as Partial<UserProgress>;
    return sanitizeProgressObject(parsed);
  } catch {
    return createInitialProgress();
  }
}

export function exportProgressToJson(progress: UserProgress): string {
  return JSON.stringify(
    {
      app: 'PhysioLingo',
      version: 2,
      exportedAt: new Date().toISOString(),
      progress: sanitizeProgressObject(progress),
    },
    null,
    2,
  );
}

export function parseImportedProgress(rawJson: string): UserProgress | null {
  try {
    const parsed = JSON.parse(rawJson) as
      | { progress?: Partial<UserProgress> }
      | Partial<UserProgress>;
    if (!parsed || typeof parsed !== 'object') return null;
    const candidate =
      'progress' in parsed && parsed.progress && typeof parsed.progress === 'object'
        ? parsed.progress
        : (parsed as Partial<UserProgress>);
    if (
      typeof candidate.xp !== 'number' &&
      !Array.isArray(candidate.completedLessonIds) &&
      typeof candidate.srsProgress !== 'object'
    ) {
      return null;
    }
    return sanitizeProgressObject(candidate);
  } catch {
    return null;
  }
}

export function saveProgress(progress: UserProgress): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

/**
 * Normalizes Polish anatomical answers for flexible yet accurate grading:
 * - lowercases & trims
 * - normalizes Polish diacritics optionally
 * - expands common Polish abbreviations ("m." -> "mięsień", "w." -> "więzadło")
 * - collapses punctuation and repeated whitespace
 */
export function normalizeAnatomyAnswer(input: string): string {
  let text = input
    .toLowerCase()
    .trim()
    .replace(/[ąśćźżęółń]/g, (ch) => POLISH_DIACRITICS[ch] ?? ch)
    .replace(/[()[\],.;:–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  text = text
    .replace(/^(miesien|m\.?)\s+/i, '')
    .replace(/^(staw|articulatio|art\.?)\s+/i, '')
    .replace(/^(wiezadlo|w\.?|ligamentum|lig\.?)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}

export function isTypingAnswerCorrect(userInput: string, acceptedAnswers: string[]): boolean {
  const normalizedInput = normalizeAnatomyAnswer(userInput);
  if (!normalizedInput) return false;

  return acceptedAnswers.some((candidate) => {
    const normalizedCandidate = normalizeAnatomyAnswer(candidate);
    if (normalizedInput === normalizedCandidate) return true;
    // Also allow full exact match before prefix stripping (e.g. "m. supraspinatus" vs "musculus supraspinatus")
    const rawUser = userInput.toLowerCase().trim().replace(/\s+/g, ' ');
    const rawCandidate = candidate.toLowerCase().trim().replace(/\s+/g, ' ');
    return rawUser === rawCandidate;
  });
}

export function shuffleArray<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const REQUIRED_NON_CLINICAL_TASK_TYPES: TaskType[] = [
  'matching',
  'model3d',
  'multiple_choice',
  'typing',
];

/**
 * Identifies clinical / kinesitherapy lessons in the Skill Tree (11 out of 37 lessons),
 * which serve 2 clinical cases per session instead of 1 (lighter ratio for anatomical lessons).
 */
export function isClinicalOrKinesitherapyLesson(lessonId: string): boolean {
  return /(clinic|kinesitherapy)$/i.test(lessonId);
}

/**
 * Builds dynamically shuffled tasks for a lesson while guaranteeing all 5 task types appear
 * and keeping clinical case density balanced:
 * - Anatomical lessons (26): 5–6 tasks total with EXACTLY 1 random clinical_case from the 3-case bank.
 * - Clinical & kinesitherapy lessons (11): 6–7 tasks total with EXACTLY 2 distinct clinical_case tasks from the 3-case bank.
 * Shuffles option order cleanly inside MCQ and Clinical Case tasks and updates correctIndex.
 */
export function buildLessonTasks(
  lessonId: string,
  rng: () => number = Math.random,
): LessonTask[] {
  const bank = LESSON_TASK_BANKS[lessonId] ?? [];
  if (bank.length === 0) return [];

  const isClinicalLesson = isClinicalOrKinesitherapyLesson(lessonId);
  const targetClinicalCases = isClinicalLesson ? 2 : 1;
  const targetSessionLength = isClinicalLesson ? 7 : 6;

  const picked: LessonTask[] = [];
  const usedIds = new Set<string>();

  // 1. Guarantee at least 1 task of each of the 4 anatomical interaction types when present in bank
  for (const type of REQUIRED_NON_CLINICAL_TASK_TYPES) {
    const matchingType = bank.filter((t) => t.type === type && !usedIds.has(t.id));
    if (matchingType.length > 0) {
      const chosen = shuffleArray(matchingType, rng)[0];
      picked.push(chosen);
      usedIds.add(chosen.id);
    }
  }

  // 2. Pick exact targetClinicalCases (1 for anatomical lessons, 2 for clinic/kinesitherapy lessons)
  const clinicalPool = shuffleArray(
    bank.filter((t) => t.type === 'clinical_case' && !usedIds.has(t.id)),
    rng,
  );
  for (const clinicalTask of clinicalPool.slice(0, targetClinicalCases)) {
    picked.push(clinicalTask);
    usedIds.add(clinicalTask.id);
  }

  // 3. Fill remaining slots up to targetSessionLength exclusively from non-clinical tasks
  //    so anatomical lessons always keep exact 1 clinical case and clinical lessons keep exact 2
  const remainingNonClinical = shuffleArray(
    bank.filter((t) => t.type !== 'clinical_case' && !usedIds.has(t.id)),
    rng,
  );
  for (const extra of remainingNonClinical) {
    if (picked.length >= targetSessionLength) break;
    picked.push(extra);
    usedIds.add(extra.id);
  }

  // Shuffle task order and shuffle option order inside MCQ / ClinicalCase tasks
  return shuffleArray(picked, rng).map((task) => {
    if (task.type === 'multiple_choice' || task.type === 'clinical_case') {
      const indexed = task.options.map((label, idx) => ({
        label,
        isCorrect: idx === task.correctIndex,
      }));
      const shuffledOptions = shuffleArray(indexed, rng);
      return {
        ...task,
        options: shuffledOptions.map((o) => o.label),
        correctIndex: shuffledOptions.findIndex((o) => o.isCorrect),
      };
    }
    return task;
  });
}

/**
 * Generates 3 quick review tasks to recover hearts, prioritizing structures the student missed before.
 */
export function buildHeartRecoveryTasks(
  mistakeStats: Record<string, { wrongCount: number }>,
  rng: () => number = Math.random,
): LessonTask[] {
  const allTasks = Object.values(LESSON_TASK_BANKS).flat().filter(
    (t) => t.type === 'multiple_choice' || t.type === 'clinical_case',
  );

  const missedTasks = shuffleArray(
    allTasks.filter((t) => (mistakeStats[t.structureId]?.wrongCount ?? 0) > 0),
    rng,
  ).sort((a, b) => {
    const errA = mistakeStats[a.structureId]?.wrongCount ?? 0;
    const errB = mistakeStats[b.structureId]?.wrongCount ?? 0;
    return errB - errA;
  });

  const nonMissedTasks = shuffleArray(
    allTasks.filter((t) => (mistakeStats[t.structureId]?.wrongCount ?? 0) === 0),
    rng,
  );

  const selected = [...missedTasks, ...nonMissedTasks].slice(0, 3);
  return selected.map((task) => {
    if (task.type === 'multiple_choice' || task.type === 'clinical_case') {
      const indexed = task.options.map((label, idx) => ({
        label,
        isCorrect: idx === task.correctIndex,
      }));
      const shuffledOptions = shuffleArray(indexed, rng);
      return {
        ...task,
        options: shuffledOptions.map((o) => o.label),
        correctIndex: shuffledOptions.findIndex((o) => o.isCorrect),
      };
    }
    return task;
  });
}

export function applyAnswerOutcome(
  progress: UserProgress,
  isCorrect: boolean,
  structureId: string,
  xpGainPerCorrect = 10,
  nowIso: string = new Date().toISOString(),
  studyMode: StudyMode = progress.studyMode ?? 'course',
): UserProgress {
  if (isCorrect) {
    return {
      ...progress,
      xp: progress.xp + xpGainPerCorrect,
    };
  }

  const prevMistake = progress.mistakeStats[structureId];
  return {
    ...progress,
    hearts: studyMode === 'free' ? progress.hearts : Math.max(0, progress.hearts - 1),
    mistakeStats: {
      ...progress.mistakeStats,
      [structureId]: {
        wrongCount: (prevMistake?.wrongCount ?? 0) + 1,
        lastMissedAt: nowIso,
      },
    },
  };
}

export function getLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function completeLessonProgress(
  progress: UserProgress,
  lessonId: string,
  accuracy: number,
  bonusXp: number,
  todayKey: string = getLocalDateKey(),
): { nextProgress: UserProgress; streakIncremented: boolean } {
  const completedSet = new Set(progress.completedLessonIds);
  completedSet.add(lessonId);

  const prevBest = progress.lessonBestAccuracy[lessonId] ?? 0;
  let nextStreak = progress.streak;
  let streakIncremented = false;

  if (progress.lastStudyDate !== todayKey) {
    if (!progress.lastStudyDate) {
      nextStreak = Math.max(1, progress.streak + 1);
    } else {
      const prevDate = new Date(`${progress.lastStudyDate}T00:00:00`);
      const currDate = new Date(`${todayKey}T00:00:00`);
      const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      nextStreak = diffDays === 1 ? progress.streak + 1 : 1;
    }
    streakIncremented = true;
  }

  return {
    streakIncremented,
    nextProgress: {
      ...progress,
      xp: progress.xp + bonusXp,
      streak: nextStreak,
      lastStudyDate: todayKey,
      completedLessonIds: Array.from(completedSet),
      lessonBestAccuracy: {
        ...progress.lessonBestAccuracy,
        [lessonId]: Math.max(prevBest, accuracy),
      },
    },
  };
}

export function restoreHeartsProgress(
  progress: UserProgress,
  amount: number = DEFAULT_MAX_HEARTS,
): UserProgress {
  return {
    ...progress,
    hearts: Math.min(progress.maxHearts, Math.max(progress.hearts, 0) + amount),
  };
}

export function getAllLessonsOrdered(): LessonNode[] {
  return SKILL_SECTIONS.flatMap((section) => section.lessons);
}

export type LessonNodeStatus = 'completed' | 'active' | 'locked';

export function getLessonStatuses(
  completedLessonIds: string[],
  studyMode: StudyMode = 'course',
): Record<string, LessonNodeStatus> {
  const ordered = getAllLessonsOrdered();
  const completed = new Set(completedLessonIds);
  const statuses: Record<string, LessonNodeStatus> = {};

  let foundFirstIncomplete = false;
  for (const lesson of ordered) {
    if (completed.has(lesson.id)) {
      statuses[lesson.id] = 'completed';
    } else if (studyMode === 'free') {
      statuses[lesson.id] = 'active';
    } else if (!foundFirstIncomplete) {
      statuses[lesson.id] = 'active';
      foundFirstIncomplete = true;
    } else {
      statuses[lesson.id] = 'locked';
    }
  }

  return statuses;
}

export function getNextUnlockedLessonTitle(completedLessonIds: string[]): string | null {
  const ordered = getAllLessonsOrdered();
  const completed = new Set(completedLessonIds);
  const next = ordered.find((l) => !completed.has(l.id));
  return next ? next.title : null;
}

function buildSearchHaystack(item: AnatomicalStructure): string {
  return [
    item.namePl,
    ...(item.nameEn ? [item.nameEn] : []),
    ...(item.nameLt ? [item.nameLt] : []),
    ...item.aliases,
    item.pp,
    item.pk,
    item.innervation,
    item.functionDesc,
    item.clinicalCorrelation,
  ]
    .map(normalizeAnatomyAnswer)
    .join(' ');
}

const ATLAS_SEARCH_INDEX: Map<string, string> = new Map(
  ANATOMY_DB.map((item) => [item.id, buildSearchHaystack(item)]),
);

export function filterAtlasStructures(
  query: string,
  region: RegionId | 'all',
  category: StructureCategory | 'all',
  structures: AnatomicalStructure[] = ANATOMY_DB,
): AnatomicalStructure[] {
  const q = normalizeAnatomyAnswer(query);
  return structures.filter((item) => {
    if (region !== 'all' && item.region !== region) return false;
    if (category !== 'all' && item.category !== category) return false;
    if (!q) return true;

    const haystack = ATLAS_SEARCH_INDEX.get(item.id) ?? buildSearchHaystack(item);
    return haystack.includes(q);
  });
}

export function getStructureById(id: string): AnatomicalStructure | undefined {
  return ANATOMY_MAP[id];
}

export interface StructureDetailLabels {
  firstLabel: string;
  secondLabel: string;
  firstShort: string;
  secondShort: string;
}

export function getStructureDetailLabels(category: StructureCategory): StructureDetailLabels {
  switch (category) {
    case 'bone':
      return {
        firstLabel: 'Struktury kostne',
        secondLabel: 'Mięśnie przyczepiające się',
        firstShort: 'Struktury kostne',
        secondShort: 'Mięśnie',
      };
    case 'artery':
      return {
        firstLabel: 'Pochodzenie i przebieg',
        secondLabel: 'Obszar unaczynienia i gałęzie',
        firstShort: 'Pochodzenie',
        secondShort: 'Unaczynienie',
      };
    case 'vein':
      return {
        firstLabel: 'Obszar spływu (dopływy)',
        secondLabel: 'Ujście i przebieg',
        firstShort: 'Dopływy',
        secondShort: 'Ujście',
      };
    case 'nerve':
      return {
        firstLabel: 'Pochodzenie i korzenie',
        secondLabel: 'Obszar unerwienia (ruch / czucie)',
        firstShort: 'Korzenie',
        secondShort: 'Unerwienie',
      };
    case 'organ':
      return {
        firstLabel: 'Położenie topograficzne',
        secondLabel: 'Budowa i relacje anatomiczne',
        firstShort: 'Położenie',
        secondShort: 'Relacje',
      };
    case 'bursa':
      return {
        firstLabel: 'Położenie anatomiczne',
        secondLabel: 'Sąsiadujące kości i ścięgna',
        firstShort: 'Położenie',
        secondShort: 'Sąsiedztwo',
      };
    case 'tendon':
      return {
        firstLabel: 'Połączenie mięśniowo-ścięgniste',
        secondLabel: 'Przyczep kostny i przebieg',
        firstShort: 'Początek',
        secondShort: 'Przyczep',
      };
    case 'ligament':
      return {
        firstLabel: 'Przyczep początkowy więzadła',
        secondLabel: 'Przyczep końcowy i stabilizacja',
        firstShort: 'Przyczep 1',
        secondShort: 'Przyczep 2',
      };
    case 'skin':
      return {
        firstLabel: 'Granice i warstwy powłoki',
        secondLabel: 'Unerwienie skórne i punkty palpacyjne',
        firstShort: 'Granice',
        secondShort: 'Palpacja / Skóra',
      };
    default:
      return {
        firstLabel: 'Przyczep początkowy (PP)',
        secondLabel: 'Przyczep końcowy (PK)',
        firstShort: 'PP',
        secondShort: 'PK',
      };
  }
}

