import type { RegionId } from '../types/anatomy';

export type MuscleJointGroupId =
  | 'shoulder'
  | 'scapula'
  | 'elbow'
  | 'radioulnar'
  | 'wrist'
  | 'fingers'
  | 'hip'
  | 'knee'
  | 'ankle'
  | 'subtalar'
  | 'toes'
  | 'cervical_spine'
  | 'thoracolumbar_spine'
  | 'ribcage_diaphragm'
  | 'tmj'
  | 'facial';

export type SimulatorScenePreset =
  | 'upper_limb'
  | 'torso_upper'
  | 'torso_only'
  | 'torso_lower'
  | 'lower_limb'
  | 'head_neck';

export type MuscleActionRole = 'primary' | 'secondary';

export type AnatomicalPlanePl =
  | 'Płaszczyzna strzałkowa'
  | 'Płaszczyzna czołowa'
  | 'Płaszczyzna poprzeczna'
  | 'Płaszczyzna skośna / złożona';

export interface MuscleActionEntry {
  joint: MuscleJointGroupId;
  jointLabelPl: string;
  /** Canonical movement key matching JOINT_MOVEMENT_CATALOG for reverse lookup */
  movementKey: string;
  movementLabelPl: string;
  role: MuscleActionRole;
  planePl: AnatomicalPlanePl;
  axisPl: string;
  sftrRangePl: string;
  notePl?: string;
}

export interface MuscleSubpartAction {
  namePl: string;
  actionsPl: string;
  clinicalNotePl?: string;
  /** Optional ID of matching MuscleKinematicPreset so user can click subpart to simulate it */
  presetId?: string;
}

export type FiberAnchorAxis =
  | 'vertical'
  | 'mediolateral'
  | 'lateromedial'
  | 'anteroposterior'
  | 'posteroanterior';

export interface MuscleKinematicPreset {
  id: string;
  labelPl: string;
  subpartLabelPl?: string;
  joint: MuscleJointGroupId;
  scene: SimulatorScenePreset;
  planePl: AnatomicalPlanePl;
  axisPl: string;
  sftrLabel: string;
  /** Primary anatomical rotation axis in Z-Anatomy world space (+X left, +Y up, +Z anterior) */
  rotAxis: 'x' | 'y' | 'z';
  startDeg: number;
  endDeg: number;
  /** Optional coupled secondary rotation (e.g. SCM lateral flexion + contralateral rotation) */
  secondaryRot?: {
    axis: 'x' | 'y' | 'z';
    startDeg: number;
    endDeg: number;
  };
  /** Optional linear glide/descent in meters (scapula elevation/protraction, diaphragm dome, facial) */
  translationMeters?: [number, number, number];
  /** Optional regex source matching specific subpart mesh(es) in GLB for fiber anchoring & highlight */
  meshPattern?: string;
  /** How PP and PK lie along the muscle mesh bounding box (defaults to 'vertical': top=PP, bottom=PK) */
  fiberAxis?: FiberAnchorAxis;
  /** Optional explicit Z-Anatomy world coordinates [x,y,z] (in meters) when an isolated mesh is absent in GLB (e.g. TFL) */
  explicitAnchors?: {
    pp: [number, number, number];
    pk: [number, number, number];
  };
  /** Concise caption explaining what moves in open chain */
  openChainCaptionPl: string;
  /** Concise caption explaining what moves in closed chain (reversed origin-insertion) */
  closedChainCaptionPl: string;
}

export interface MuscleActionProfile {
  muscleId: string;
  region: RegionId;
  /** Display group for UI filtering */
  regionGroupPl:
    | 'Obręcz barkowa i ramię'
    | 'Przedramię i ręka'
    | 'Tułów, grzbiet i przepona'
    | 'Miednica i biodro'
    | 'Udo i kolano'
    | 'Podudzie i stopa'
    | 'Głowa, szyja i żucie';
  jointGroups: MuscleJointGroupId[];
  scenePreset: SimulatorScenePreset;
  /** Regex source string matching the muscle's real mesh(es) in the regional GLB */
  meshMatchPattern: string;
  /** Whether the muscle crosses two or more joints (crucial for active/passive insufficiency) */
  biarticular: boolean;
  shortTaglinePl: string;
  actions: MuscleActionEntry[];
  subparts?: MuscleSubpartAction[];
  /** Classic open kinetic chain action (PP fixed -> PK moves) */
  openChainSummaryPl: string;
  /** Closed kinetic chain / Punctum Fixum reversed (PK fixed -> PP moves) */
  closedChainReversedPl: string;
  concentricWorkPl: string;
  eccentricWorkPl: string;
  stabilizationRolePl: string;
  synergistIds: string[];
  antagonistIds: string[];
  stretchingPositionPl: string;
  functionalExercisePl: string;
  lovettPositionPl: string;
  /** Optional matching Lovett test ID in CLINICAL_TESTS_DB */
  lovettTestId?: string;
  palpationLandmarkPl: string;
  weaknessAndPalsyPl: string;
  examTrapPl: string;
  kinematicPresets: MuscleKinematicPreset[];
}

export interface JointMovementOption {
  joint: MuscleJointGroupId;
  jointLabelPl: string;
  movementKey: string;
  movementLabelPl: string;
  planePl: AnatomicalPlanePl;
  sftrNormPl: string;
}

export interface ReverseMovementLookupResult {
  option: JointMovementOption;
  primary: MuscleActionProfile[];
  secondary: MuscleActionProfile[];
  antagonists: MuscleActionProfile[];
}

export interface MuscleComparisonResult {
  muscleA: MuscleActionProfile;
  muscleB: MuscleActionProfile;
  sharedActions: Array<{
    jointLabelPl: string;
    movementLabelPl: string;
    roleA: MuscleActionRole;
    roleB: MuscleActionRole;
  }>;
  oppositeActionPairs: Array<{
    jointLabelPl: string;
    actionAPl: string;
    actionBPl: string;
  }>;
  onlyInA: MuscleActionEntry[];
  onlyInB: MuscleActionEntry[];
  sameInnervation: boolean;
  areAntagonists: boolean;
  areSynergists: boolean;
}

export type MuscleQuizQuestionKind =
  | 'visual_3d_motion'
  | 'subpart_akton'
  | 'closed_chain_pf'
  | 'function_and_nerve';

export interface MuscleActionsQuizQuestion {
  id: string;
  kind: MuscleQuizQuestionKind;
  kindLabelPl: string;
  muscleId: string;
  promptPl: string;
  hintPl: string;
  options: string[];
  correctIndex: number;
  explanationPl: string;
  /** Present when kind === 'visual_3d_motion' so the quiz renders live 3D animation */
  kinematicPresetId?: string;
}
