import * as THREE from 'three';
import type {
  AnatomicalPlanePl,
  FiberAnchorAxis,
  MuscleJointGroupId,
  MuscleKinematicPreset,
  SimulatorScenePreset,
} from '../data/muscleActionsTypes';

export type KinematicSimulationMode = 'concentric' | 'eccentric' | 'closed_chain';

export type BoneSegmentRole = 'proximal' | 'distal' | 'muscle' | 'ignore';

export interface Vec3Tuple {
  x: number;
  y: number;
  z: number;
}

export interface SimpleBox3 {
  min: Vec3Tuple;
  max: Vec3Tuple;
}

export interface EvaluatedKinematicFrame {
  /** Effective motion interpolation ratio [0..1] between startDeg and endDeg */
  motionT: number;
  /** Primary quaternion rotation around true anatomical joint axis */
  quaternion: { x: number; y: number; z: number; w: number };
  /** Legacy/test-friendly approximate Euler delta (radians) */
  rotationRad: Vec3Tuple;
  /** Applied translation delta (meters) on the moving bone pivot */
  translationMeters: Vec3Tuple;
  /** Unit rotation axis vector in Z-Anatomy world space */
  axisWorld: Vec3Tuple;
  /** Which segment moves around the joint pivot */
  movingSegment: 'distal' | 'proximal';
  /** Current absolute sweep angle in degrees (0..abs(endDeg - startDeg)) */
  sweepAngleDeg: number;
  /** Total ROM sweep in degrees */
  totalRangeDeg: number;
  /** Current signed joint angle in degrees */
  currentAngleDeg: number;
  /** Coupled scapular upward rotation in degrees (scapulohumeral rhythm 2:1 for shoulder elevation > 30°) */
  coupledScapulaDeg: number;
  /** Axis around which coupled scapular upward tilt occurs ('z' frontal abduction, 'x' sagittal flexion) */
  coupledScapulaAxis: 'x' | 'z';
  /** Pure glenohumeral quaternion relative to the scapula when distalPivot is parented inside scapulaOffset */
  glenohumeralQuaternion: { x: number; y: number; z: number; w: number };
  /** Coupled patella flexion tracking angle in degrees (for knee flexion/extension) */
  coupledPatellaDeg: number;
  /** Fiber activation intensity [0..1] for color & thickness modulation */
  fiberActivation: number;
  /** Fiber thickness multiplier (>1 concentric swelling, <1 eccentric lengthening) */
  fiberThicknessScale: number;
  /** Outward belly bulge multiplier */
  bellyBulgeScale: number;
  /** Localized phase badge */
  phaseLabelPl: string;
}

export const SIMULATOR_SCENE_FILES: Record<SimulatorScenePreset, string[]> = {
  upper_limb: ['/models/regional/upper_limb_right.glb'],
  torso_upper: ['/models/regional/torso.glb', '/models/regional/upper_limb_right.glb'],
  torso_only: ['/models/regional/torso.glb'],
  torso_lower: ['/models/regional/torso.glb', '/models/regional/lower_limb_right.glb'],
  lower_limb: ['/models/regional/lower_limb_right.glb'],
  head_neck: ['/models/regional/head_neck.glb'],
};

const NON_BONE_IGNORE_REGEX =
  /\b(bursa|sheath|ligament|cartilage|meniscus|capsule|tendon|retinaculum|fascia|aponeurosis|nerve|artery|vein|disc|intervertebral|labrum|membrane|sinus|gland|lung|heart|liver|kidney|trachea|esophagus|eye|tooth|teeth|enamel|gum|gingiva|tongue|larynx|pharynx|thyroid|skin)\b/i;

const BONE_MATCH_REGEX =
  /\b(humerus|radius|ulna|scapula|clavicle|metacarpal|carpal|phalanx|scaphoid|lunate|triquetrum|pisiform|trapezium|trapezoid|capitate|hamate|femur|patella|tibia|fibula|talus|calcaneus|navicular|cuboid|cuneiform|metatarsal|hip\s+bone|ilium|ischium|pubis|sacrum|coccyx|vertebra|atlas|axis|rib|sternum|manubrium|xiphoid|mandible|maxilla|frontal|parietal|temporal|occipital|sphenoid|ethmoid|zygomatic|nasal\s+bone|lacrimal|palatine|vomer|hyoid)\b/i;

const CARPAL_HAND_REGEX =
  /\b(capitate|hamate|lunate|pisiform|scaphoid|trapezium|trapezoid|triquetrum|metacarpal|phalanx.*hand|carpal)\b/i;

const FOOT_BONES_REGEX =
  /\b(talus|calcaneus|navicular|cuboid|cuneiform|metatarsal|phalanx.*foot)\b/i;

const SUBTALAR_DISTAL_REGEX =
  /\b(calcaneus|navicular|cuboid|cuneiform|metatarsal|phalanx.*foot)\b/i;

const CRANIUM_REGEX =
  /\b(frontal|parietal|temporal|occipital|sphenoid|ethmoid|zygomatic|maxilla|nasal\s+bone|lacrimal|palatine|vomer)\b/i;

/**
 * Normalizes raw GLB / Three.js GLTFLoader sanitized node names
 * (e.g. "Humerus003", "Scapula.003", "Hip_bone003") back into clean anatomical names
 * while preserving spinal level tokens like "C5", "T12", "L4".
 */
export function normalizeGlbNodeName(raw: string): string {
  return raw
    .replace(/[._]?\d{3,}$/g, '')
    .replace(/\.\d+$/g, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isBoneMeshName(name: string): boolean {
  const clean = normalizeGlbNodeName(name);
  if (!clean || NON_BONE_IGNORE_REGEX.test(clean)) return false;
  if (/\bmuscle\b/i.test(clean)) return false;
  return BONE_MATCH_REGEX.test(clean);
}

/**
 * Classifies a Z-Anatomy GLB node name into proximal bone, distal bone, muscle, or ignored tissue
 * for real-time bone articulation around the target joint.
 */
export function classifyBoneSegment(
  nodeName: string,
  joint: MuscleJointGroupId,
): BoneSegmentRole {
  const clean = normalizeGlbNodeName(nodeName);
  if (!clean || NON_BONE_IGNORE_REGEX.test(clean)) {
    return 'ignore';
  }

  const isBone = isBoneMeshName(clean);
  if (!isBone) {
    return 'muscle';
  }

  const lower = clean.toLowerCase();

  switch (joint) {
    case 'shoulder': {
      if (/\b(humerus|radius|ulna)\b/.test(lower) || CARPAL_HAND_REGEX.test(lower)) {
        return 'distal';
      }
      return 'proximal';
    }
    case 'scapula': {
      if (
        /\b(scapula|clavicle|humerus|radius|ulna)\b/.test(lower) ||
        CARPAL_HAND_REGEX.test(lower)
      ) {
        return 'distal';
      }
      return 'proximal';
    }
    case 'elbow': {
      if (/\b(radius|ulna)\b/.test(lower) || CARPAL_HAND_REGEX.test(lower)) {
        return 'distal';
      }
      return 'proximal';
    }
    case 'radioulnar': {
      if (/\bradius\b/.test(lower) || CARPAL_HAND_REGEX.test(lower)) {
        return 'distal';
      }
      return 'proximal';
    }
    case 'wrist': {
      if (CARPAL_HAND_REGEX.test(lower)) {
        return 'distal';
      }
      return 'proximal';
    }
    case 'fingers': {
      if (/phalanx.*hand/.test(lower)) {
        return 'distal';
      }
      return 'proximal';
    }
    case 'hip': {
      if (/\b(femur|patella|tibia|fibula)\b/.test(lower) || FOOT_BONES_REGEX.test(lower)) {
        return 'distal';
      }
      return 'proximal';
    }
    case 'knee': {
      if (/\b(tibia|fibula)\b/.test(lower) || FOOT_BONES_REGEX.test(lower)) {
        return 'distal';
      }
      return 'proximal';
    }
    case 'ankle': {
      if (FOOT_BONES_REGEX.test(lower)) {
        return 'distal';
      }
      return 'proximal';
    }
    case 'subtalar': {
      if (SUBTALAR_DISTAL_REGEX.test(lower)) {
        return 'distal';
      }
      return 'proximal';
    }
    case 'toes': {
      if (/phalanx.*foot/.test(lower)) {
        return 'distal';
      }
      return 'proximal';
    }
    case 'tmj': {
      if (/\bmandible\b/.test(lower)) {
        return 'distal';
      }
      return 'proximal';
    }
    case 'cervical_spine': {
      if (
        CRANIUM_REGEX.test(lower) ||
        /\b(mandible|atlas|axis|vertebra\s+c[1-4])\b/.test(lower)
      ) {
        return 'distal';
      }
      return 'proximal';
    }
    case 'thoracolumbar_spine': {
      if (/\b(hip\s+bone|sacrum|coccyx|vertebra\s+l[4-5])\b/.test(lower)) {
        return 'proximal';
      }
      return 'distal';
    }
    case 'ribcage_diaphragm': {
      if (/\b(rib|sternum|manubrium|xiphoid)\b/.test(lower)) {
        return 'distal';
      }
      return 'proximal';
    }
    case 'facial': {
      return 'proximal';
    }
  }
}

/**
 * Verified Z-Anatomy world-space joint pivot coordinates (in meters).
 */
export const DEFAULT_JOINT_PIVOTS: Record<MuscleJointGroupId, Vec3Tuple> = {
  shoulder: { x: -0.178, y: 1.385, z: -0.026 },
  scapula: { x: -0.117, y: 1.336, z: -0.056 },
  elbow: { x: -0.215, y: 1.098, z: -0.026 },
  radioulnar: { x: -0.237, y: 0.974, z: -0.014 },
  wrist: { x: -0.264, y: 0.856, z: 0.012 },
  fingers: { x: -0.273, y: 0.771, z: 0.036 },
  hip: { x: -0.056, y: 0.862, z: -0.018 },
  knee: { x: -0.084, y: 0.445, z: -0.022 },
  ankle: { x: -0.076, y: 0.082, z: -0.032 },
  subtalar: { x: -0.082, y: 0.056, z: -0.015 },
  toes: { x: -0.074, y: 0.024, z: 0.082 },
  tmj: { x: 0.0, y: 1.568, z: 0.008 },
  cervical_spine: { x: 0.0, y: 1.48, z: -0.03 },
  thoracolumbar_spine: { x: 0.0, y: 1.015, z: -0.024 },
  ribcage_diaphragm: { x: 0.0, y: 1.154, z: -0.015 },
  facial: { x: 0.0, y: 1.575, z: 0.075 },
};

function boxCenter(b: SimpleBox3): Vec3Tuple {
  return {
    x: (b.min.x + b.max.x) * 0.5,
    y: (b.min.y + b.max.y) * 0.5,
    z: (b.min.z + b.max.z) * 0.5,
  };
}

function normalizeVec3(v: Vec3Tuple): Vec3Tuple {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/**
 * Computes exact anatomical joint pivot directly from the actual loaded GLB bone bounding boxes.
 */
export function computeJointPivotFromBoneBoxes(
  joint: MuscleJointGroupId,
  boneBoxes: Record<string, SimpleBox3>,
): Vec3Tuple {
  const findBox = (re: RegExp): SimpleBox3 | undefined => {
    for (const [name, box] of Object.entries(boneBoxes)) {
      if (re.test(name)) return box;
    }
    return undefined;
  };

  switch (joint) {
    case 'shoulder': {
      const hum = findBox(/^humerus/i);
      if (hum) {
        return {
          x: hum.min.x + (hum.max.x - hum.min.x) * 0.68,
          y: hum.max.y - 0.02,
          z: (hum.min.z + hum.max.z) * 0.5,
        };
      }
      break;
    }
    case 'scapula': {
      const scap = findBox(/^scapula/i);
      if (scap) return boxCenter(scap);
      break;
    }
    case 'elbow': {
      const hum = findBox(/^humerus/i);
      if (hum) {
        return {
          x: hum.min.x + (hum.max.x - hum.min.x) * 0.34,
          y: hum.min.y + 0.014,
          z: (hum.min.z + hum.max.z) * 0.5,
        };
      }
      break;
    }
    case 'radioulnar': {
      // Pivot directly on the anatomical axis connecting proximal radial head and distal ulnar head
      const ulna = findBox(/^ulna/i);
      const rad = findBox(/^radius/i);
      if (ulna && rad) {
        const proxRad: Vec3Tuple = {
          x: rad.max.x - 0.006,
          y: rad.max.y - 0.006,
          z: rad.min.z + 0.018,
        };
        const distUlna: Vec3Tuple = {
          x: ulna.min.x + 0.01,
          y: ulna.min.y + 0.006,
          z: ulna.max.z - 0.016,
        };
        return {
          x: (proxRad.x + distUlna.x) * 0.5,
          y: (proxRad.y + distUlna.y) * 0.5,
          z: (proxRad.z + distUlna.z) * 0.5,
        };
      }
      break;
    }
    case 'wrist': {
      const rad = findBox(/^radius/i);
      if (rad) {
        return {
          x: rad.min.x + (rad.max.x - rad.min.x) * 0.4,
          y: rad.min.y + 0.004,
          z: rad.max.z - 0.014,
        };
      }
      break;
    }
    case 'fingers': {
      const mc =
        findBox(/^third\s+metacarpal/i) ??
        findBox(/^second\s+metacarpal/i) ??
        findBox(/metacarpal/i);
      if (mc) {
        return {
          x: (mc.min.x + mc.max.x) * 0.5,
          y: mc.min.y + 0.004,
          z: (mc.min.z + mc.max.z) * 0.5,
        };
      }
      break;
    }
    case 'hip': {
      const fem = findBox(/^femur/i);
      if (fem) {
        // Femoral head sits on the medial-superior corner of the right femur bounding box
        return {
          x: fem.max.x - 0.023,
          y: fem.max.y - 0.022,
          z: (fem.min.z + fem.max.z) * 0.5,
        };
      }
      break;
    }
    case 'knee': {
      const fem = findBox(/^femur/i);
      if (fem) {
        return {
          x: (fem.min.x + fem.max.x) * 0.52,
          y: fem.min.y + 0.018,
          z: (fem.min.z + fem.max.z) * 0.5,
        };
      }
      break;
    }
    case 'ankle': {
      const tal = findBox(/^talus/i);
      if (tal) {
        return {
          x: (tal.min.x + tal.max.x) * 0.5,
          y: tal.max.y - 0.006,
          z: (tal.min.z + tal.max.z) * 0.5,
        };
      }
      const tib = findBox(/^tibia/i);
      if (tib) {
        return {
          x: (tib.min.x + tib.max.x) * 0.5,
          y: tib.min.y + 0.01,
          z: (tib.min.z + tib.max.z) * 0.5,
        };
      }
      break;
    }
    case 'subtalar': {
      const tal = findBox(/^talus/i);
      if (tal) {
        // Sinus tarsi center between talar neck and anterior calcaneus
        return {
          x: tal.min.x + (tal.max.x - tal.min.x) * 0.35,
          y: tal.min.y + 0.008,
          z: tal.max.z - 0.014,
        };
      }
      break;
    }
    case 'toes': {
      const mt = findBox(/first\s+metatarsal|second\s+metatarsal|metatarsal/i);
      if (mt) {
        return {
          x: (mt.min.x + mt.max.x) * 0.5,
          y: mt.min.y + 0.01,
          z: mt.max.z - 0.004,
        };
      }
      break;
    }
    case 'tmj': {
      const mand = findBox(/^mandible/i);
      if (mand) {
        return {
          x: (mand.min.x + mand.max.x) * 0.5,
          y: mand.max.y - 0.008,
          z: mand.min.z + 0.01,
        };
      }
      break;
    }
    case 'cervical_spine': {
      const c5 = findBox(/vertebra\s+c5|vertebra\s+c4/i);
      if (c5) return boxCenter(c5);
      break;
    }
    case 'thoracolumbar_spine': {
      const l4 = findBox(/vertebra\s+l4|vertebra\s+l3/i);
      if (l4) return boxCenter(l4);
      break;
    }
    case 'ribcage_diaphragm': {
      const t12 = findBox(/vertebra\s+t12|vertebra\s+t11/i);
      if (t12) return boxCenter(t12);
      break;
    }
    case 'facial': {
      const max = findBox(/^maxilla/i);
      if (max) return boxCenter(max);
      break;
    }
  }

  return { ...DEFAULT_JOINT_PIVOTS[joint] };
}

/**
 * Computes the true anatomical 3D unit axis vector for a joint & primary axis code,
 * accounting for oblique bone shafts (radioulnar axis, humeral shaft, femoral mechanical axis,
 * and Henke's oblique subtalar axis!).
 */
export function computeAnatomicalJointAxis(
  joint: MuscleJointGroupId,
  rotAxis: 'x' | 'y' | 'z',
  boneBoxes?: Record<string, SimpleBox3>,
): Vec3Tuple {
  const findBox = (re: RegExp): SimpleBox3 | undefined => {
    if (!boneBoxes) return undefined;
    for (const [name, box] of Object.entries(boneBoxes)) {
      if (re.test(name)) return box;
    }
    return undefined;
  };

  // 1. Radioulnar pronation/supination: true oblique line from distal ulnar head -> proximal radial head
  if (joint === 'radioulnar' && rotAxis === 'y') {
    const ulna = findBox(/^ulna/i);
    const rad = findBox(/^radius/i);
    if (ulna && rad) {
      return normalizeVec3({
        x: rad.max.x - 0.006 - (ulna.min.x + 0.01),
        y: rad.max.y - 0.006 - (ulna.min.y + 0.006),
        z: rad.min.z + 0.018 - (ulna.max.z - 0.016),
      });
    }
    return normalizeVec3({ x: 0.08, y: 0.988, z: -0.14 });
  }

  // 2. Shoulder internal/external rotation: true humeral shaft vector (elbow -> humeral head)
  if (joint === 'shoulder' && rotAxis === 'y') {
    const hum = findBox(/^humerus/i);
    if (hum) {
      const headX = hum.min.x + (hum.max.x - hum.min.x) * 0.68;
      const elbowX = hum.min.x + (hum.max.x - hum.min.x) * 0.34;
      return normalizeVec3({
        x: headX - elbowX,
        y: hum.max.y - 0.02 - (hum.min.y + 0.014),
        z: 0.004,
      });
    }
    return normalizeVec3({ x: 0.128, y: 0.992, z: 0.007 });
  }

  // 3. Hip internal/external rotation: true mechanical axis of femur (knee center -> femoral head)
  if (joint === 'hip' && rotAxis === 'y') {
    const fem = findBox(/^femur/i);
    if (fem) {
      const headX = fem.max.x - 0.023;
      const kneeX = (fem.min.x + fem.max.x) * 0.52;
      return normalizeVec3({
        x: headX - kneeX,
        y: fem.max.y - 0.022 - (fem.min.y + 0.018),
        z: 0.008,
      });
    }
    return normalizeVec3({ x: 0.067, y: 0.998, z: 0.01 });
  }

  // 4. Subtalar inversion/eversion: Henke's oblique triplanar axis through sinus tarsi
  if (joint === 'subtalar' && rotAxis === 'z') {
    return normalizeVec3({ x: 0.18, y: 0.52, z: 0.83 });
  }

  // 5. Talocrural (ankle) bimaleolar axis: tilted ~8° posterolaterally on right ankle
  if (joint === 'ankle' && rotAxis === 'x') {
    return normalizeVec3({ x: 0.985, y: 0.06, z: 0.15 });
  }

  if (rotAxis === 'x') return { x: 1, y: 0, z: 0 };
  if (rotAxis === 'y') return { x: 0, y: 1, z: 0 };
  return { x: 0, y: 0, z: 1 };
}

/**
 * Derives fallback PP & PK 3D anchor points from a bounding box when full vertex skinning isn't used.
 */
export function deriveMuscleAnchorsFromBox(
  box: SimpleBox3,
  fiberAxis: FiberAnchorAxis = 'vertical',
): { pp: Vec3Tuple; pk: Vec3Tuple } {
  const cx = (box.min.x + box.max.x) * 0.5;
  const cy = (box.min.y + box.max.y) * 0.5;
  const cz = (box.min.z + box.max.z) * 0.5;
  const dx = box.max.x - box.min.x;
  const dy = box.max.y - box.min.y;
  const dz = box.max.z - box.min.z;

  switch (fiberAxis) {
    case 'mediolateral':
      return {
        pp: { x: box.max.x - dx * 0.12, y: cy + dy * 0.12, z: cz },
        pk: { x: box.min.x + dx * 0.12, y: cy - dy * 0.12, z: cz },
      };
    case 'lateromedial':
      return {
        pp: { x: box.min.x + dx * 0.12, y: cy + dy * 0.18, z: cz },
        pk: { x: box.max.x - dx * 0.12, y: cy - dy * 0.18, z: cz },
      };
    case 'anteroposterior':
      return {
        pp: { x: cx, y: cy, z: box.max.z - dz * 0.12 },
        pk: { x: cx, y: cy, z: box.min.z + dz * 0.12 },
      };
    case 'posteroanterior':
      return {
        pp: { x: cx, y: cy, z: box.min.z + dz * 0.12 },
        pk: { x: cx, y: cy, z: box.max.z - dz * 0.12 },
      };
    case 'vertical':
    default:
      return {
        pp: { x: cx, y: box.max.y - dy * 0.08, z: cz },
        pk: { x: cx, y: box.min.y + dy * 0.08, z: cz },
      };
  }
}

const DEG_TO_RAD = Math.PI / 180;

/**
 * Evaluates a single frame of kinematic simulation using true 3D axis-angle quaternions,
 * coupled scapulohumeral / patellar tracking, and Open vs Closed Kinetic Chain reversal.
 */
export function evaluateKinematicFrame(
  preset: MuscleKinematicPreset,
  progress01: number,
  mode: KinematicSimulationMode,
  boneBoxes?: Record<string, SimpleBox3>,
): EvaluatedKinematicFrame {
  const clamped = Math.max(0, Math.min(1, progress01));
  const eased = clamped * clamped * (3 - 2 * clamped);
  const motionT = mode === 'eccentric' ? 1 - eased : eased;

  const primaryDeg = preset.startDeg + (preset.endDeg - preset.startDeg) * motionT;
  const secondaryDeg = preset.secondaryRot
    ? preset.secondaryRot.startDeg +
      (preset.secondaryRot.endDeg - preset.secondaryRot.startDeg) * motionT
    : 0;

  const sign = mode === 'closed_chain' ? -1 : 1;

  const primaryAxis = computeAnatomicalJointAxis(preset.joint, preset.rotAxis, boneBoxes);
  const qPrimary = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(primaryAxis.x, primaryAxis.y, primaryAxis.z),
    primaryDeg * DEG_TO_RAD * sign,
  );

  if (preset.secondaryRot) {
    const secAxis = computeAnatomicalJointAxis(preset.joint, preset.secondaryRot.axis, boneBoxes);
    const qSec = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(secAxis.x, secAxis.y, secAxis.z),
      secondaryDeg * DEG_TO_RAD * sign,
    );
    qPrimary.multiply(qSec);
  }

  const euler = new THREE.Euler().setFromQuaternion(qPrimary, 'XYZ');
  const rotationRad: Vec3Tuple = { x: euler.x, y: euler.y, z: euler.z };

  const baseTrans = preset.translationMeters ?? [0, 0, 0];
  const translationMeters: Vec3Tuple = {
    x: baseTrans[0] * motionT * sign,
    y: baseTrans[1] * motionT * sign,
    z: baseTrans[2] * motionT * sign,
  };

  // Coupled Scapulohumeral Rhythm (2:1 above 30° of shoulder abduction or flexion)
  let coupledScapulaDeg = 0;
  let coupledScapulaAxis: 'x' | 'z' = preset.rotAxis === 'x' ? 'x' : 'z';
  if (
    preset.joint === 'shoulder' &&
    mode !== 'closed_chain' &&
    (preset.rotAxis === 'z' || preset.rotAxis === 'x') &&
    primaryDeg < -30
  ) {
    coupledScapulaDeg = (primaryDeg + 30) * 0.32;
    coupledScapulaAxis = preset.rotAxis;
  }

  // Pure glenohumeral rotation relative to scapula (keeps humeral head seated in glenoid!)
  const ghPrimaryDeg = primaryDeg - coupledScapulaDeg;
  const qGH = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(primaryAxis.x, primaryAxis.y, primaryAxis.z),
    ghPrimaryDeg * DEG_TO_RAD * sign,
  );
  if (preset.secondaryRot) {
    const secAxis = computeAnatomicalJointAxis(preset.joint, preset.secondaryRot.axis, boneBoxes);
    const qSec = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(secAxis.x, secAxis.y, secAxis.z),
      secondaryDeg * DEG_TO_RAD * sign,
    );
    qGH.multiply(qSec);
  }

  // Coupled Patellar Tracking during knee flexion/extension (patella glides along trochlea at ~38% of tibial angle)
  let coupledPatellaDeg = 0;
  if (preset.joint === 'knee' && preset.rotAxis === 'x' && primaryDeg > 0) {
    coupledPatellaDeg = primaryDeg * 0.38 * sign;
  }

  const primarySpan = Math.abs(preset.endDeg - preset.startDeg);
  const useSecondaryForSweep = primarySpan < 0.5 && Boolean(preset.secondaryRot);
  const totalRangeDeg = useSecondaryForSweep && preset.secondaryRot
    ? Math.abs(preset.secondaryRot.endDeg - preset.secondaryRot.startDeg)
    : primarySpan;
  const sweepAngleDeg = Math.round(totalRangeDeg * motionT);
  const effectiveAxisWorld =
    useSecondaryForSweep && preset.secondaryRot
      ? computeAnatomicalJointAxis(preset.joint, preset.secondaryRot.axis, boneBoxes)
      : primaryAxis;
  const effectiveCurrentAngleDeg = useSecondaryForSweep
    ? Math.round(secondaryDeg)
    : Math.round(primaryDeg);

  const fiberActivation =
    mode === 'eccentric' ? 0.45 + 0.55 * eased : 0.2 + 0.8 * motionT;

  const fiberThicknessScale =
    mode === 'eccentric' ? 1.15 - 0.25 * eased : 0.9 + 0.34 * motionT;

  const bellyBulgeScale =
    mode === 'eccentric' ? 1.1 - 0.3 * eased : 0.85 + 0.45 * motionT;

  const phaseLabelPl =
    mode === 'concentric'
      ? 'Skurcz koncentryczny (skracanie i grubienie brzuśca)'
      : mode === 'eccentric'
        ? 'Praca ekscentryczna (hamowanie — wydłużanie pod napięciem)'
        : 'Łańcuch zamknięty — odwrócony przyczep (PK ustalone!)';

  return {
    motionT,
    quaternion: { x: qPrimary.x, y: qPrimary.y, z: qPrimary.z, w: qPrimary.w },
    rotationRad,
    translationMeters,
    axisWorld: effectiveAxisWorld,
    movingSegment: mode === 'closed_chain' ? 'proximal' : 'distal',
    sweepAngleDeg,
    totalRangeDeg: Math.round(totalRangeDeg),
    currentAngleDeg: effectiveCurrentAngleDeg,
    coupledScapulaDeg,
    coupledScapulaAxis,
    glenohumeralQuaternion: { x: qGH.x, y: qGH.y, z: qGH.z, w: qGH.w },
    coupledPatellaDeg,
    fiberActivation,
    fiberThicknessScale,
    bellyBulgeScale,
    phaseLabelPl,
  };
}

// ============================================================================
// REAL-TIME PER-VERTEX SOFT-TISSUE MUSCLE MESH SKINNING & ISOCHORIC BULGE
// ============================================================================

export interface PreparedDeformableMuscle {
  /** World-space rest vertex positions (Float32Array of length 3 * vertexCount) */
  restWorldPositions: Float32Array;
  /** Per-vertex distal skinning weight w_i in [0..1] (0 = welded to proximal PP, 1 = welded to distal PK) */
  weights: Float32Array;
  /** Per-vertex rest cross-sectional offset from its longitudinal slice centroid (length 3 * vertexCount) */
  sliceRadialOffsets: Float32Array;
  /** Per-vertex rest distance from joint pivot for joint-capsule pulley wrap */
  restPivotDistances: Float32Array;
  /** Slice centroids in rest world space (SLICE_COUNT * 3) */
  sliceRestCentroids: Float32Array;
  /** True anatomical PP centroid on proximal bone in rest world space */
  ppRestWorld: Vec3Tuple;
  /** True anatomical PK centroid on muscle distal end in rest world space */
  pkRestWorld: Vec3Tuple;
  /** Closest insertion point on the actual distal bone surface (differs from pkRestWorld when a long tendon bridges the joint, e.g. gastrocnemius -> calcaneus!) */
  distalBoneInsertionWorld: Vec3Tuple;
  /** True when the muscle belly terminates into a long tendon proximal to the moving bone (>35mm gap) */
  usesTendonExcursion: boolean;
  /** True when this mesh slip lies wholly on one bone segment and does not span the active joint */
  isSingleSegment: boolean;
  /** Optional anatomical bony pulley point (patella, malleolus, lesser sciatic notch) for curved tendon arc-length */
  pulleyRestWorld: Vec3Tuple | null;
  /** Rest tendon-muscle path length in meters */
  restLength: number;
  /** Effective joint capsule wrap radius in meters */
  wrapRadius: number;
  /** Joint kind for special facial skin contraction */
  joint: MuscleJointGroupId;
}

const SLICE_COUNT = 8;

function smoothstep01(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(1e-6, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Samples up to `maxSamples` world-space surface vertices from a list of bone meshes
 * for ultra-fast bone-proximity PP/PK attachment detection.
 */
export function sampleBoneSurfacePoints(
  boneMeshes: THREE.Mesh[],
  maxSamples = 360,
): Float32Array {
  let totalVerts = 0;
  for (const m of boneMeshes) {
    const pos = m.geometry.getAttribute('position');
    if (pos) totalVerts += pos.count;
  }
  if (totalVerts === 0) return new Float32Array(0);

  const stride = Math.max(1, Math.floor(totalVerts / maxSamples));
  const pts: number[] = [];
  const tmp = new THREE.Vector3();

  for (const m of boneMeshes) {
    const pos = m.geometry.getAttribute('position');
    if (!pos) continue;
    for (let i = 0; i < pos.count; i += stride) {
      tmp.fromBufferAttribute(pos, i).applyMatrix4(m.matrix);
      pts.push(tmp.x, tmp.y, tmp.z);
    }
  }
  return new Float32Array(pts);
}

function minDistanceToPointCloud(
  vx: number,
  vy: number,
  vz: number,
  cloud: Float32Array,
): number {
  if (cloud.length === 0) return 1.0;
  let minD2 = Infinity;
  for (let i = 0; i < cloud.length; i += 3) {
    const dx = vx - cloud[i];
    const dy = vy - cloud[i + 1];
    const dz = vz - cloud[i + 2];
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < minD2) minD2 = d2;
  }
  return Math.sqrt(minD2);
}

/**
 * Prepares a real Z-Anatomy muscle mesh for 60 FPS biomechanical deformation:
 * - Binds proximal tendon vertices (w -> 0) rigidly to the proximal bone
 * - Binds distal tendon vertices (w -> 1) rigidly to the moving distal bone
 * - Precomputes longitudinal slice centroids for volume-preserving radial contraction swelling
 * - Precomputes joint-capsule pulley radii to prevent bone penetration at deep joint angles
 */
export function prepareDeformableMuscle(params: {
  geometry: THREE.BufferGeometry;
  worldMatrix: THREE.Matrix4;
  proximalBoneCloud: Float32Array;
  distalBoneCloud: Float32Array;
  jointPivot: Vec3Tuple;
  joint: MuscleJointGroupId;
}): PreparedDeformableMuscle {
  const { geometry, worldMatrix, proximalBoneCloud, distalBoneCloud, jointPivot, joint } = params;
  const posAttr = geometry.getAttribute('position');
  const count = posAttr.count;
  const restWorldPositions = new Float32Array(count * 3);
  const weights = new Float32Array(count);
  const restPivotDistances = new Float32Array(count);

  const tmp = new THREE.Vector3();
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < count; i += 1) {
    tmp.fromBufferAttribute(posAttr, i).applyMatrix4(worldMatrix);
    restWorldPositions[i * 3] = tmp.x;
    restWorldPositions[i * 3 + 1] = tmp.y;
    restWorldPositions[i * 3 + 2] = tmp.z;
    if (tmp.y < minY) minY = tmp.y;
    if (tmp.y > maxY) maxY = tmp.y;
    if (tmp.z < minZ) minZ = tmp.z;
    if (tmp.z > maxZ) maxZ = tmp.z;

    restPivotDistances[i] = Math.hypot(
      tmp.x - jointPivot.x,
      tmp.y - jointPivot.y,
      tmp.z - jointPivot.z,
    );
  }

  const spanY = Math.max(0.01, maxY - minY);
  const spanZ = Math.max(0.01, maxZ - minZ);

  // Special physiological skinning for dome-shaped diaphragm & skin-inserting facial muscles
  if (joint === 'ribcage_diaphragm') {
    for (let i = 0; i < count; i += 1) {
      const vx = restWorldPositions[i * 3];
      const vy = restWorldPositions[i * 3 + 1];
      const dProx = minDistanceToPointCloud(
        vx,
        vy,
        restWorldPositions[i * 3 + 2],
        proximalBoneCloud,
      );
      const heightRatio = (vy - minY) / spanY;
      // Central dome apex has high heightRatio and is far from spine/ribs -> moves piston-like
      const raw = Math.min(1, heightRatio * 0.75 + Math.min(0.4, dProx * 3.2));
      weights[i] = smoothstep01(0.18, 0.86, raw);
    }
  } else if (joint === 'facial') {
    // Bind skull-bone attachment vertices as PP (w=0) and free cutaneous insertion as PK (w=1)
    let minBoneD = Infinity;
    let maxBoneD = -Infinity;
    const boneDists = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const d = minDistanceToPointCloud(
        restWorldPositions[i * 3],
        restWorldPositions[i * 3 + 1],
        restWorldPositions[i * 3 + 2],
        proximalBoneCloud,
      );
      boneDists[i] = d;
      if (d < minBoneD) minBoneD = d;
      if (d > maxBoneD) maxBoneD = d;
    }
    const spanD = Math.max(1e-4, maxBoneD - minBoneD);
    for (let i = 0; i < count; i += 1) {
      weights[i] = smoothstep01(0.08, 0.92, (boneDists[i] - minBoneD) / spanD);
    }
  } else {
    // For scapular muscles (descending trapezius, levator scapulae) loaded without head_neck.glb,
    // augment proximalBoneCloud with C1-C7 nuchal/transverse spinous midline points (y = 1.44..1.55)
    let effectiveProxCloud = proximalBoneCloud;
    if (joint === 'scapula' && proximalBoneCloud.length > 0) {
      const extra = [
        0.0, 1.44, -0.055,
        0.0, 1.47, -0.055,
        0.0, 1.50, -0.052,
        0.0, 1.53, -0.050,
        -0.022, 1.48, -0.035,
        -0.022, 1.51, -0.032,
      ];
      effectiveProxCloud = new Float32Array(proximalBoneCloud.length + extra.length);
      effectiveProxCloud.set(proximalBoneCloud, 0);
      effectiveProxCloud.set(extra, proximalBoneCloud.length);
    }

    // General dual-bone proximity skinning — works automatically for ALL upward, downward, horizontal & spiral muscles!
    for (let i = 0; i < count; i += 1) {
      const vx = restWorldPositions[i * 3];
      const vy = restWorldPositions[i * 3 + 1];
      const vz = restWorldPositions[i * 3 + 2];
      const dProx = Math.max(0.0015, minDistanceToPointCloud(vx, vy, vz, effectiveProxCloud));
      const dDist = Math.max(0.0015, minDistanceToPointCloud(vx, vy, vz, distalBoneCloud));
      const pProx = Math.pow(dProx, 1.65);
      const pDist = Math.pow(dDist, 1.65);
      const u = pProx / (pProx + pDist);
      weights[i] = smoothstep01(0.07, 0.93, u);
    }
  }

  // Extract true PP (lowest weights) and PK (highest tendon-tip weights) centroids
  let ppX = 0, ppY = 0, ppZ = 0, ppN = 0;
  let pkX = 0, pkY = 0, pkZ = 0, pkN = 0;

  for (let i = 0; i < count; i += 1) {
    const w = weights[i];
    if (w <= 0.14) {
      ppX += restWorldPositions[i * 3];
      ppY += restWorldPositions[i * 3 + 1];
      ppZ += restWorldPositions[i * 3 + 2];
      ppN += 1;
    }
    if (w >= 0.9) {
      pkX += restWorldPositions[i * 3];
      pkY += restWorldPositions[i * 3 + 1];
      pkZ += restWorldPositions[i * 3 + 2];
      pkN += 1;
    }
  }

  const allowTendonExcursion =
    joint === 'elbow' ||
    joint === 'ankle' ||
    joint === 'subtalar' ||
    joint === 'toes' ||
    joint === 'wrist' ||
    joint === 'fingers';

  // Fallback when weights did not hit both extremes:
  // Distinguish pure single-segment slips (minW > 0.80 or maxW < 0.15 when not bridged by a long distal tendon)
  // from genuine joint-spanning muscles whose attachment gap is bridged by a tendon/aponeurosis.
  let isSingleSegment = false;
  if (ppN === 0 || pkN === 0) {
    let minW = Infinity;
    let maxW = -Infinity;
    for (let i = 0; i < count; i += 1) {
      if (weights[i] < minW) minW = weights[i];
      if (weights[i] > maxW) maxW = weights[i];
    }

    if (minW > 0.8 && maxW - minW < 0.18) {
      // Entire slip lies far on the distal segment (e.g. cervical erector slips during lumbar motion)
      isSingleSegment = true;
      weights.fill(1.0);
      ppX = restWorldPositions[0];
      ppY = restWorldPositions[1];
      ppZ = restWorldPositions[2];
      pkX = ppX;
      pkY = ppY + 0.02;
      pkZ = ppZ;
      ppN = pkN = 1;
    } else if (!allowTendonExcursion && maxW < 0.15 && maxW - minW < 0.14) {
      // Entire slip lies far on the proximal segment without a distal tendon excursion
      isSingleSegment = true;
      weights.fill(0.0);
      ppX = restWorldPositions[0];
      ppY = restWorldPositions[1];
      ppZ = restWorldPositions[2];
      pkX = ppX;
      pkY = ppY - 0.02;
      pkZ = ppZ;
      ppN = pkN = 1;
    } else {
      const spanW = Math.max(1e-4, maxW - minW);
      ppX = ppY = ppZ = ppN = 0;
      pkX = pkY = pkZ = pkN = 0;
      for (let i = 0; i < count; i += 1) {
        const nw = (weights[i] - minW) / spanW;
        weights[i] = smoothstep01(0.05, 0.95, nw);
        if (weights[i] <= 0.16) {
          ppX += restWorldPositions[i * 3];
          ppY += restWorldPositions[i * 3 + 1];
          ppZ += restWorldPositions[i * 3 + 2];
          ppN += 1;
        }
        if (weights[i] >= 0.88) {
          pkX += restWorldPositions[i * 3];
          pkY += restWorldPositions[i * 3 + 1];
          pkZ += restWorldPositions[i * 3 + 2];
          pkN += 1;
        }
      }
    }
  }

  const ppRestWorld: Vec3Tuple =
    ppN > 0
      ? { x: ppX / ppN, y: ppY / ppN, z: ppZ / ppN }
      : { x: restWorldPositions[0], y: restWorldPositions[1], z: restWorldPositions[2] };
  const pkRestWorld: Vec3Tuple =
    pkN > 0
      ? { x: pkX / pkN, y: pkY / pkN, z: pkZ / pkN }
      : {
          x: restWorldPositions[(count - 1) * 3],
          y: restWorldPositions[(count - 1) * 3 + 1],
          z: restWorldPositions[(count - 1) * 3 + 2],
        };

  // Locate closest actual point on the distal bone cloud ONLY for distal limb joints bridged by long tendons
  // (e.g. Gastrocnemius -> Calcaneus via Achilles tendon, Short head of biceps -> Radius, or EDL/EHL -> dorsum of foot)
  let distalBoneInsertionWorld: Vec3Tuple = { ...pkRestWorld };
  let minDistToDistalBone = 0;
  if (!isSingleSegment && allowTendonExcursion && distalBoneCloud.length >= 3) {
    const requireAnteriorFoot =
      (joint === 'toes' && ppRestWorld.z > -0.035) ||
      (joint === 'ankle' && ppRestWorld.y < 0.35 && ppRestWorld.z > -0.035);
    let bestD2 = Infinity;
    let bestIdx = -1;
    for (let i = 0; i < distalBoneCloud.length; i += 3) {
      if (requireAnteriorFoot && distalBoneCloud[i + 2] < jointPivot.z + 0.04) {
        continue;
      }
      const dx = pkRestWorld.x - distalBoneCloud[i];
      const dy = pkRestWorld.y - distalBoneCloud[i + 1];
      const dz = pkRestWorld.z - distalBoneCloud[i + 2];
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      minDistToDistalBone = Math.sqrt(bestD2);
      if (minDistToDistalBone > 0.035) {
        distalBoneInsertionWorld = {
          x: distalBoneCloud[bestIdx],
          y: distalBoneCloud[bestIdx + 1],
          z: distalBoneCloud[bestIdx + 2],
        };
      }
    }
  }
  const usesTendonExcursion = allowTendonExcursion && minDistToDistalBone > 0.035;

  // Identify anatomical bony pulley when the muscle/tendon wraps over a joint prominence or retinaculum
  let pulleyRestWorld: Vec3Tuple | null = null;
  if (joint === 'knee') {
    if (ppRestWorld.z > jointPivot.z + 0.01 && pkRestWorld.x < jointPivot.x + 0.015) {
      // Anterior patellar / trochlear pulley for quadriceps
      pulleyRestWorld = { x: jointPivot.x, y: jointPivot.y + 0.005, z: jointPivot.z + 0.044 };
    } else if (pkRestWorld.x >= jointPivot.x + 0.012 && pkRestWorld.z > jointPivot.z - 0.015) {
      // Posteromedial femoral condyle pulley for pes anserinus (sartorius, gracilis, semitendinosus)
      pulleyRestWorld = { x: jointPivot.x + 0.032, y: jointPivot.y + 0.004, z: jointPivot.z - 0.028 };
    }
  } else if (joint === 'elbow' && ppRestWorld.z < jointPivot.z - 0.01) {
    // Posterior humeral trochlea / olecranon pulley for triceps & anconeus
    pulleyRestWorld = { x: jointPivot.x, y: jointPivot.y + 0.006, z: jointPivot.z - 0.028 };
  } else if (joint === 'fingers' && ppRestWorld.z < jointPivot.z - 0.01) {
    // Dorsal MCP extensor hood pulley for extensor digitorum
    pulleyRestWorld = { x: jointPivot.x, y: jointPivot.y + 0.002, z: jointPivot.z - 0.024 };
  } else if (joint === 'ankle') {
    if (ppRestWorld.x < -0.095 && ppRestWorld.z < jointPivot.z - 0.008 && distalBoneInsertionWorld.z > jointPivot.z) {
      // Lateral malleolus retro-malleolar pulley for fibularis longus & brevis
      pulleyRestWorld = { x: -0.104, y: 0.072, z: -0.046 };
    } else if (ppRestWorld.y < 0.35 && ppRestWorld.z > -0.035 && usesTendonExcursion) {
      // Anterior ankle extensor retinaculum pulley for EDL / EHL
      pulleyRestWorld = { x: jointPivot.x - 0.008, y: 0.082, z: 0.008 };
    }
  } else if (joint === 'toes') {
    if (ppRestWorld.z > -0.035) {
      // Inferior extensor retinaculum in front of ankle for EDL / EHL
      pulleyRestWorld = { x: jointPivot.x - 0.008, y: 0.072, z: 0.018 };
    } else {
      // Sustentaculum tali / retro-malleolar groove for FHL
      pulleyRestWorld = { x: -0.062, y: 0.042, z: -0.038 };
    }
  } else if (joint === 'subtalar') {
    if (ppRestWorld.z < -0.03 && distalBoneInsertionWorld.x > -0.078) {
      // Medial malleolus groove for tibialis posterior
      pulleyRestWorld = { x: -0.062, y: 0.064, z: -0.048 };
    } else if (ppRestWorld.x < -0.095 && ppRestWorld.z < -0.035) {
      // Lateral malleolus groove for fibularis longus & brevis
      pulleyRestWorld = { x: -0.104, y: 0.068, z: -0.044 };
    }
  } else if (
    joint === 'hip' &&
    Math.abs(ppRestWorld.y - pkRestWorld.y) < 0.06 &&
    pkRestWorld.z < ppRestWorld.z - 0.015
  ) {
    // Lesser sciatic notch posterior pulley for obturator internus
    pulleyRestWorld = { x: -0.052, y: 0.842, z: -0.062 };
  }

  const measurePathLength = (pp: Vec3Tuple, pk: Vec3Tuple, pulley: Vec3Tuple | null): number => {
    if (pulley) {
      return (
        Math.hypot(pp.x - pulley.x, pp.y - pulley.y, pp.z - pulley.z) +
        Math.hypot(pulley.x - pk.x, pulley.y - pk.y, pulley.z - pk.z)
      );
    }
    return Math.hypot(pk.x - pp.x, pk.y - pp.y, pk.z - pp.z);
  };

  const restLength = Math.max(
    0.012,
    measurePathLength(ppRestWorld, distalBoneInsertionWorld, pulleyRestWorld),
  );

  // Precompute longitudinal slice centroids & radial offsets for volume-preserving belly bulge
  const sliceSums = new Float32Array(SLICE_COUNT * 3);
  const sliceCounts = new Uint32Array(SLICE_COUNT);
  for (let i = 0; i < count; i += 1) {
    const sIdx = Math.min(SLICE_COUNT - 1, Math.floor(weights[i] * SLICE_COUNT));
    sliceSums[sIdx * 3] += restWorldPositions[i * 3];
    sliceSums[sIdx * 3 + 1] += restWorldPositions[i * 3 + 1];
    sliceSums[sIdx * 3 + 2] += restWorldPositions[i * 3 + 2];
    sliceCounts[sIdx] += 1;
  }

  const sliceRestCentroids = new Float32Array(SLICE_COUNT * 3);
  for (let s = 0; s < SLICE_COUNT; s += 1) {
    const c = sliceCounts[s];
    if (c > 0) {
      sliceRestCentroids[s * 3] = sliceSums[s * 3] / c;
      sliceRestCentroids[s * 3 + 1] = sliceSums[s * 3 + 1] / c;
      sliceRestCentroids[s * 3 + 2] = sliceSums[s * 3 + 2] / c;
    } else {
      const f = (s + 0.5) / SLICE_COUNT;
      sliceRestCentroids[s * 3] = ppRestWorld.x + (pkRestWorld.x - ppRestWorld.x) * f;
      sliceRestCentroids[s * 3 + 1] = ppRestWorld.y + (pkRestWorld.y - ppRestWorld.y) * f;
      sliceRestCentroids[s * 3 + 2] = ppRestWorld.z + (pkRestWorld.z - ppRestWorld.z) * f;
    }
  }

  const sliceRadialOffsets = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const sFloat = weights[i] * (SLICE_COUNT - 1);
    const s0 = Math.min(SLICE_COUNT - 1, Math.floor(sFloat));
    const s1 = Math.min(SLICE_COUNT - 1, s0 + 1);
    const frac = sFloat - s0;
    const cx = sliceRestCentroids[s0 * 3] * (1 - frac) + sliceRestCentroids[s1 * 3] * frac;
    const cy = sliceRestCentroids[s0 * 3 + 1] * (1 - frac) + sliceRestCentroids[s1 * 3 + 1] * frac;
    const cz = sliceRestCentroids[s0 * 3 + 2] * (1 - frac) + sliceRestCentroids[s1 * 3 + 2] * frac;
    sliceRadialOffsets[i * 3] = restWorldPositions[i * 3] - cx;
    sliceRadialOffsets[i * 3 + 1] = restWorldPositions[i * 3 + 1] - cy;
    sliceRadialOffsets[i * 3 + 2] = restWorldPositions[i * 3 + 2] - cz;
  }

  const wrapRadius =
    joint === 'shoulder' || joint === 'hip' || joint === 'knee'
      ? 0.085
      : joint === 'elbow' || joint === 'ankle'
        ? 0.055
        : 0.038;

  return {
    restWorldPositions,
    weights,
    sliceRadialOffsets,
    restPivotDistances,
    sliceRestCentroids,
    ppRestWorld,
    pkRestWorld,
    distalBoneInsertionWorld,
    usesTendonExcursion,
    isSingleSegment,
    pulleyRestWorld,
    restLength,
    wrapRadius,
    joint,
  };
}

/**
 * Updates a prepared 3D muscle geometry in place for the current frame:
 * 1. Applies dual-pivot rigid transformations at PP (w=0) and PK (w=1)
 * 2. Applies spherical joint-capsule pulley wrap so the muscle glides over the joint without sinking into bone
 * 3. Applies volume-preserving physiological radial belly swelling (when shortening) or slimming (when stretching)
 * Returns live PP, PK, and stretch ratio lambda = L(t) / L0 (< 1 means physical shortening!).
 */
export function deformMuscleGeometryInPlace(params: {
  prepared: PreparedDeformableMuscle;
  targetGeometry: THREE.BufferGeometry;
  proximalMatrix: THREE.Matrix4;
  distalMatrix: THREE.Matrix4;
  jointPivot: Vec3Tuple;
  /** 1.0 for active contracting muscle/akton, 0.3 for passive head, 0.8 for stretching antagonist */
  bulgeGain?: number;
  /** Optional 0..1 contraction progress used for cutaneous facial muscles */
  facialContractionT?: number;
  /** Optional lengthened reference ratio (>= 1.0) so pre-stretched muscles (quadriceps, triceps, masseter) bulge at peak contraction */
  referenceStretchRatio?: number;
}): { ppWorld: Vec3Tuple; pkWorld: Vec3Tuple; stretchRatio: number; rawStretchRatio: number } {
  const {
    prepared,
    targetGeometry,
    proximalMatrix,
    distalMatrix,
    jointPivot,
    bulgeGain = 1.0,
    facialContractionT = 0,
    referenceStretchRatio = 1.0,
  } = params;

  const pe = proximalMatrix.elements;
  const de = distalMatrix.elements;

  const transformPoint = (m: ArrayLike<number>, x: number, y: number, z: number): Vec3Tuple => ({
    x: m[0] * x + m[4] * y + m[8] * z + m[12],
    y: m[1] * x + m[5] * y + m[9] * z + m[13],
    z: m[2] * x + m[6] * y + m[10] * z + m[14],
  });

  const ppWorld = transformPoint(
    pe,
    prepared.ppRestWorld.x,
    prepared.ppRestWorld.y,
    prepared.ppRestWorld.z,
  );

  // Special handling for cutaneous facial muscles (PK skin pulls smoothly toward bony PP!)
  if (prepared.joint === 'facial') {
    const posAttr = targetGeometry.getAttribute('position') as THREE.BufferAttribute;
    const outArr = posAttr.array as Float32Array;
    const count = prepared.weights.length;
    const pull = 0.24 * Math.max(0, Math.min(1, facialContractionT));
    const stretchRatio = 1 - pull;
    const rawIsochoric = 1 / Math.sqrt(Math.max(0.6, stretchRatio)) - 1;

    for (let i = 0; i < count; i += 1) {
      const w = prepared.weights[i];
      const rx = prepared.restWorldPositions[i * 3];
      const ry = prepared.restWorldPositions[i * 3 + 1];
      const rz = prepared.restWorldPositions[i * 3 + 2];
      const px = pe[0] * rx + pe[4] * ry + pe[8] * rz + pe[12];
      const py = pe[1] * rx + pe[5] * ry + pe[9] * rz + pe[13];
      const pz = pe[2] * rx + pe[6] * ry + pe[10] * rz + pe[14];

      const belly = Math.sin(Math.PI * w);
      const radialScale = rawIsochoric * bulgeGain * belly;
      outArr[i * 3] = px + (ppWorld.x - px) * pull * w + prepared.sliceRadialOffsets[i * 3] * radialScale;
      outArr[i * 3 + 1] = py + (ppWorld.y - py) * pull * w + prepared.sliceRadialOffsets[i * 3 + 1] * radialScale;
      outArr[i * 3 + 2] = pz + (ppWorld.z - pz) * pull * w + prepared.sliceRadialOffsets[i * 3 + 2] * radialScale;
    }
    posAttr.needsUpdate = true;
    targetGeometry.computeVertexNormals();

    const pkRestT = transformPoint(
      pe,
      prepared.pkRestWorld.x,
      prepared.pkRestWorld.y,
      prepared.pkRestWorld.z,
    );
    const pkWorld: Vec3Tuple = {
      x: pkRestT.x + (ppWorld.x - pkRestT.x) * pull,
      y: pkRestT.y + (ppWorld.y - pkRestT.y) * pull,
      z: pkRestT.z + (ppWorld.z - pkRestT.z) * pull,
    };
    return { ppWorld, pkWorld, stretchRatio, rawStretchRatio: stretchRatio };
  }

  const distalBoneLive = transformPoint(
    de,
    prepared.distalBoneInsertionWorld.x,
    prepared.distalBoneInsertionWorld.y,
    prepared.distalBoneInsertionWorld.z,
  );

  const pulleyLive = prepared.pulleyRestWorld
    ? transformPoint(
        pe,
        prepared.pulleyRestWorld.x,
        prepared.pulleyRestWorld.y,
        prepared.pulleyRestWorld.z,
      )
    : null;

  const liveLen = pulleyLive
    ? Math.hypot(ppWorld.x - pulleyLive.x, ppWorld.y - pulleyLive.y, ppWorld.z - pulleyLive.z) +
      Math.hypot(
        pulleyLive.x - distalBoneLive.x,
        pulleyLive.y - distalBoneLive.y,
        pulleyLive.z - distalBoneLive.z,
      )
    : Math.hypot(
        distalBoneLive.x - ppWorld.x,
        distalBoneLive.y - ppWorld.y,
        distalBoneLive.z - ppWorld.z,
      );

  const rawStretchRatio = prepared.isSingleSegment
    ? 1.0
    : Math.max(0.55, Math.min(1.65, liveLen / prepared.restLength));
  const stretchRatio = prepared.isSingleSegment
    ? 1.0
    : Math.max(0.58, Math.min(1.5, rawStretchRatio / Math.max(0.5, referenceStretchRatio)));
  const rawIsochoric = 1 / Math.sqrt(stretchRatio) - 1;

  // When a long tendon bridges the joint (e.g. Gastrocnemius -> Achilles -> Calcaneus),
  // translate the myotendinous junction along the muscle's longitudinal axis by the tendon excursion!
  const axisRest = normalizeVec3({
    x: prepared.pkRestWorld.x - prepared.ppRestWorld.x,
    y: prepared.pkRestWorld.y - prepared.ppRestWorld.y,
    z: prepared.pkRestWorld.z - prepared.ppRestWorld.z,
  });
  const bellyRestSpan = Math.hypot(
    prepared.pkRestWorld.x - prepared.ppRestWorld.x,
    prepared.pkRestWorld.y - prepared.ppRestWorld.y,
    prepared.pkRestWorld.z - prepared.ppRestWorld.z,
  );
  const excursionDeltaLen = (rawStretchRatio - 1) * bellyRestSpan;
  const tendonShift: Vec3Tuple = {
    x: axisRest.x * excursionDeltaLen,
    y: axisRest.y * excursionDeltaLen,
    z: axisRest.z * excursionDeltaLen,
  };

  const pkWorld: Vec3Tuple = prepared.usesTendonExcursion
    ? transformPoint(
        pe,
        prepared.pkRestWorld.x + tendonShift.x,
        prepared.pkRestWorld.y + tendonShift.y,
        prepared.pkRestWorld.z + tendonShift.z,
      )
    : transformPoint(
        de,
        prepared.pkRestWorld.x,
        prepared.pkRestWorld.y,
        prepared.pkRestWorld.z,
      );

  const posAttr = targetGeometry.getAttribute('position') as THREE.BufferAttribute;
  const outArr = posAttr.array as Float32Array;
  const count = prepared.weights.length;

  for (let i = 0; i < count; i += 1) {
    const w = prepared.weights[i];
    const rx = prepared.restWorldPositions[i * 3];
    const ry = prepared.restWorldPositions[i * 3 + 1];
    const rz = prepared.restWorldPositions[i * 3 + 2];

    const px = pe[0] * rx + pe[4] * ry + pe[8] * rz + pe[12];
    const py = pe[1] * rx + pe[5] * ry + pe[9] * rz + pe[13];
    const pz = pe[2] * rx + pe[6] * ry + pe[10] * rz + pe[14];

    let bx: number;
    let by: number;
    let bz: number;

    if (prepared.usesTendonExcursion) {
      // Proximal bone frame + axial tendon excursion proportional to w
      const sx = rx + tendonShift.x * w;
      const sy = ry + tendonShift.y * w;
      const sz = rz + tendonShift.z * w;
      bx = pe[0] * sx + pe[4] * sy + pe[8] * sz + pe[12];
      by = pe[1] * sx + pe[5] * sy + pe[9] * sz + pe[13];
      bz = pe[2] * sx + pe[6] * sy + pe[10] * sz + pe[14];
    } else {
      const dx = de[0] * rx + de[4] * ry + de[8] * rz + de[12];
      const dy = de[1] * rx + de[5] * ry + de[9] * rz + de[13];
      const dz = de[2] * rx + de[6] * ry + de[10] * rz + de[14];

      bx = px * (1 - w) + dx * w;
      by = py * (1 - w) + dy * w;
      bz = pz * (1 - w) + dz * w;
    }

    // 2. Joint-capsule pulley wrap FIRST (prevents linear-blend chord collapse into joint center
    // before applying physiological radial belly swelling/slimming!)
    const midWeight = 4 * w * (1 - w);
    const r0 = prepared.restPivotDistances[i];
    if (midWeight > 0.05 && r0 < prepared.wrapRadius) {
      const jx = bx - jointPivot.x;
      const jy = by - jointPivot.y;
      const jz = bz - jointPivot.z;
      const currR = Math.hypot(jx, jy, jz);
      const minAllowedR = r0 * 0.94;
      if (currR < minAllowedR) {
        const jx0 = Math.abs(rx - jointPivot.x);
        const jy0 = Math.abs(ry - jointPivot.y);
        const jz0 = Math.abs(rz - jointPivot.z);
        let wx = Math.abs(jx) < jx0 * 0.88 ? jx : 0;
        let wy = Math.abs(jy) < jy0 * 0.88 ? jy : 0;
        let wz = Math.abs(jz) < jz0 * 0.88 ? jz : 0;
        if (pulleyLive) {
          wx += (pulleyLive.x - jointPivot.x) * 0.25;
          wy += (pulleyLive.y - jointPivot.y) * 0.25;
          wz += (pulleyLive.z - jointPivot.z) * 0.25;
        }
        const wLen = Math.hypot(wx, wy, wz);
        if (wLen > 1e-5) {
          const pushDist = (minAllowedR - currR) * midWeight;
          bx += (wx / wLen) * pushDist;
          by += (wy / wLen) * pushDist;
          bz += (wz / wLen) * pushDist;
        }
      }
    }

    // 3. Isochoric physiological radial belly bulge/slimming ON TOP of the wrapped path
    // (peaks at mid-belly sin(pi * w), zero at PP/PK tendons!)
    const bellyProfile = Math.sin(Math.PI * w);
    if (bellyProfile > 0.02 && Math.abs(rawIsochoric) > 0.003) {
      const radialScale = Math.max(-0.22, Math.min(0.36, rawIsochoric * bulgeGain * bellyProfile));
      const ox = prepared.sliceRadialOffsets[i * 3];
      const oy = prepared.sliceRadialOffsets[i * 3 + 1];
      const oz = prepared.sliceRadialOffsets[i * 3 + 2];
      // Rotate radial offset smoothly by blended orientation (3x3 upper-left)
      const rox =
        (pe[0] * ox + pe[4] * oy + pe[8] * oz) * (1 - w) +
        (de[0] * ox + de[4] * oy + de[8] * oz) * w;
      const roy =
        (pe[1] * ox + pe[5] * oy + pe[9] * oz) * (1 - w) +
        (de[1] * ox + de[5] * oy + de[9] * oz) * w;
      const roz =
        (pe[2] * ox + pe[6] * oy + pe[10] * oz) * (1 - w) +
        (de[2] * ox + de[6] * oy + de[10] * oz) * w;
      bx += rox * radialScale;
      by += roy * radialScale;
      bz += roz * radialScale;
    }

    outArr[i * 3] = bx;
    outArr[i * 3 + 1] = by;
    outArr[i * 3 + 2] = bz;
  }

  posAttr.needsUpdate = true;
  targetGeometry.computeVertexNormals();

  return { ppWorld, pkWorld, stretchRatio, rawStretchRatio };
}

/**
 * Generates 5 parallel spindle-shaped 3D force-vector curves between live world PP and PK points
 * (used when the optional "Wektory PP–PK" overlay is toggled on).
 */
export function computeFiberBundlePoints(
  pp: Vec3Tuple,
  pk: Vec3Tuple,
  bellyBulgeScale: number,
  strandCount = 5,
  samplesPerStrand = 11,
): Vec3Tuple[][] {
  const vx = pk.x - pp.x;
  const vy = pk.y - pp.y;
  const vz = pk.z - pp.z;
  const len = Math.hypot(vx, vy, vz);
  if (len < 0.002) return [];

  const ux = vx / len;
  const uy = vy / len;
  const uz = vz / len;

  const ref: Vec3Tuple = Math.abs(uy) < 0.85 ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 };
  let ax = uy * ref.z - uz * ref.y;
  let ay = uz * ref.x - ux * ref.z;
  let az = ux * ref.y - uy * ref.x;
  const aLen = Math.hypot(ax, ay, az) || 1;
  ax /= aLen;
  ay /= aLen;
  az /= aLen;

  const bx = uy * az - uz * ay;
  const by = uz * ax - ux * az;
  const bz = ux * ay - uy * ax;

  const baseSpread = Math.min(0.02, Math.max(0.005, len * 0.065)) * bellyBulgeScale;
  const strands: Vec3Tuple[][] = [];

  for (let s = 0; s < strandCount; s += 1) {
    const isCenter = s === 0;
    const angle = isCenter ? 0 : ((s - 1) / Math.max(1, strandCount - 1)) * Math.PI * 2;
    const radialFactor = isCenter ? 0.15 : 1.0;
    const offA = Math.cos(angle) * baseSpread * radialFactor;
    const offB = Math.sin(angle) * baseSpread * radialFactor;

    const pts: Vec3Tuple[] = [];
    for (let i = 0; i < samplesPerStrand; i += 1) {
      const t = i / (samplesPerStrand - 1);
      const belly = Math.sin(Math.PI * t);
      pts.push({
        x: pp.x + vx * t + (ax * offA + bx * offB) * belly,
        y: pp.y + vy * t + (ay * offA + by * offB) * belly,
        z: pp.z + vz * t + (az * offA + bz * offB) * belly,
      });
    }
    strands.push(pts);
  }

  return strands;
}

/**
 * Generates points along a 3D SFTR angle protractor arc in the exact plane orthogonal to `axisWorld`.
 */
export function computeProtractorArcPoints(
  pivot: Vec3Tuple,
  rotAxisOrVec: 'x' | 'y' | 'z' | Vec3Tuple,
  startDeg: number,
  currentDeg: number,
  radius = 0.095,
  segments = 24,
): Vec3Tuple[] {
  const pts: Vec3Tuple[] = [];
  const spanDeg = currentDeg - startDeg;
  if (Math.abs(spanDeg) < 1) return pts;

  const axis =
    typeof rotAxisOrVec === 'string'
      ? rotAxisOrVec === 'x'
        ? new THREE.Vector3(1, 0, 0)
        : rotAxisOrVec === 'y'
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(0, 0, 1)
      : new THREE.Vector3(rotAxisOrVec.x, rotAxisOrVec.y, rotAxisOrVec.z).normalize();

  // Base zero-degree reference ray orthogonal to rotation axis
  const fallbackRef =
    Math.abs(axis.y) < 0.85 ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(0, 0, 1);
  const baseDir = fallbackRef
    .clone()
    .sub(axis.clone().multiplyScalar(fallbackRef.dot(axis)))
    .normalize()
    .multiplyScalar(radius);

  const q = new THREE.Quaternion();
  for (let i = 0; i <= segments; i += 1) {
    const deg = startDeg + (spanDeg * i) / segments;
    q.setFromAxisAngle(axis, deg * DEG_TO_RAD);
    const v = baseDir.clone().applyQuaternion(q);
    pts.push({ x: pivot.x + v.x, y: pivot.y + v.y, z: pivot.z + v.z });
  }
  return pts;
}

/**
 * Computes orientation quaternion for the semi-transparent 3D anatomical plane card
 * orthogonal to the active rotation axis (or aligned with sagittal/frontal/transverse plane).
 */
export function computePlaneHelperBasis(
  planePl: AnatomicalPlanePl,
  axisWorld: Vec3Tuple,
): { normal: Vec3Tuple } {
  if (planePl === 'Płaszczyzna strzałkowa') {
    return { normal: { x: 1, y: 0, z: 0 } };
  }
  if (planePl === 'Płaszczyzna czołowa') {
    return { normal: { x: 0, y: 0, z: 1 } };
  }
  if (planePl === 'Płaszczyzna poprzeczna') {
    return { normal: { x: 0, y: 1, z: 0 } };
  }
  return { normal: normalizeVec3(axisWorld) };
}
