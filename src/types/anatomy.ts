export type RegionId =
  | 'shoulder'
  | 'knee'
  | 'spine_thorax'
  | 'pelvis_hip'
  | 'head_neck'
  | 'upper_limb'
  | 'lower_limb';

export type StructureCategory =
  | 'bone'
  | 'joint_ligament'
  | 'muscle'
  | 'bursa'
  | 'tendon'
  | 'ligament'
  | 'artery'
  | 'vein'
  | 'nerve'
  | 'organ'
  | 'skin';

export type AnatomicalLayerId =
  | 'bone'
  | 'cartilage'
  | 'muscle'
  | 'tendon'
  | 'sheath'
  | 'ligament'
  | 'bursa'
  | 'artery'
  | 'vein'
  | 'nerve'
  | 'organ'
  | 'skin';

export type DeviceViewMode = 'auto' | 'phone' | 'ipad' | 'desktop';

export type MuscleGroupingMode = 'whole' | 'parts';

export type ClippingPlaneAxis = 'off' | 'axial' | 'sagittal' | 'coronal';

export interface ClippingPlaneState {
  axis: ClippingPlaneAxis;
  /** Normalized depth along active axis in range [0, 1] */
  depth: number;
  /** Flip which half of the model is cut away */
  inverted: boolean;
}

export interface ClinicalNerveHighlight {
  nerveStructureId: string;
  nerveNamePl: string;
  muscleIds: string[];
  side?: 'left' | 'right';
}

export type DermatomeDisplayMode = 'both' | 'dermatome' | 'myotome';

export interface DermatomeHighlightState {
  rootId: string;
  mode: DermatomeDisplayMode;
  side?: 'left' | 'right' | 'both';
  /** Hide root label in 3D viewport banner (used during Dermatomy 3D quiz answering) */
  maskedLabel?: boolean;
}

export interface ClinicalTestHighlightState {
  testId: string;
  testNamePl: string;
  structureIds: string[];
}

export type BiomechanicsPlaneId = 'sagittal' | 'frontal' | 'transverse';

export type BiomechanicsMuscleRole = 'agonist' | 'synergist' | 'antagonist';

export interface BiomechanicsHighlightState {
  movementId: string;
  side: 'both' | 'right' | 'left';
  showAgonists: boolean;
  showSynergists: boolean;
  showAntagonists: boolean;
  showPlaneHelper: boolean;
  /** Hide movement label in 3D viewport banner during Biomechanika 3D quiz answering */
  maskedLabel?: boolean;
}

export type SkillSectionId =
  | RegionId
  | 'vascular'
  | 'nervous'
  | 'visceral'
  | 'connective';

export interface AnatomicalStructure {
  id: string;
  region: RegionId;
  category: StructureCategory;
  namePl: string;
  nameEn?: string;
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
  subStructures?: string[];
}

export interface BonyLandmarkHotspot {
  id: string;
  boneId: string;
  namePl: string;
  nameLt?: string;
  nameEn?: string;
  bilingualName: string;
  type: 'landmark' | 'pp' | 'pk';
  position: [number, number, number];
  attachedMuscles?: string[];
  clinicalNotes?: string;
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
  region: RegionId | 'head_neck' | 'upper_limb_left' | 'upper_limb_right' | 'lower_limb_left' | 'lower_limb_right' | 'torso' | 'full_body' | string;
  targetMeshId: string;
  targetNamePl: string;
  targetNameEn?: string;
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
  sectionId: SkillSectionId;
  order: number;
  title: string;
  subtitle: string;
  iconName: 'bone' | 'shield' | 'activity' | 'stethoscope';
  xpReward: number;
  structureIds: string[];
}

export interface SkillSection {
  id: any;
  number: number;
  title: string;
  subtitle: string;
  accentColor: 'emerald' | 'green';
  lessons: LessonNode[];
}

export type StudyMode = 'course' | 'free';

export interface SrsCardState {
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  nextReviewDate: string; // YYYY-MM-DD
  lastReviewedAt?: string;
}

export interface PinExamHistoryEntry {
  id: string;
  date: string; // YYYY-MM-DD
  mode: 'locate' | 'identify' | 'dermatomes' | 'biomechanics' | 'muscle_actions';
  region: string;
  correctCount: number;
  totalCount: number;
  accuracy: number;
  xpEarned: number;
}

export type PatientCaseMode = 'learn' | 'osce';

export type PatientCaseRegionGroup =
  | 'shoulder'
  | 'knee'
  | 'spine'
  | 'hip_pelvis'
  | 'upper_limb'
  | 'lower_limb';

export interface PatientCaseHistoryEntry {
  id: string;
  caseId: string;
  caseTitle: string;
  date: string; // YYYY-MM-DD
  mode: PatientCaseMode;
  correctStages: number;
  totalStages: number;
  accuracy: number;
  grade: number; // Polish academic scale: 2.0 | 3.0 | 3.5 | 4.0 | 4.5 | 5.0
  xpEarned: number;
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
  studyMode?: StudyMode;
  deviceMode?: DeviceViewMode;
  uiScale?: number;
  srsProgress?: Record<string, SrsCardState>;
  pinExamHistory?: PinExamHistoryEntry[];
  patientCaseHistory?: PatientCaseHistoryEntry[];
}

export interface LessonSummaryResult {
  lessonId: string;
  lessonTitle: string;
  xpEarned: number;
  accuracy: number;
  correctCount: number;
  totalCount: number;
  durationSeconds: number;
  streakIncremented: boolean;
  newlyUnlockedLessonTitle: string | null;
}
