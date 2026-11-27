import type {
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
  /** Applied Euler delta (radians) on the moving bone pivot */
  rotationRad: Vec3Tuple;
  /** Applied translation delta (meters) on the moving bone pivot */
  translationMeters: Vec3Tuple;
  /** Which segment moves around the joint pivot */
  movingSegment: 'distal' | 'proximal';
  /** Current absolute sweep angle in degrees (0..abs(endDeg - startDeg)) */
  sweepAngleDeg: number;
  /** Total ROM sweep in degrees */
  totalRangeDeg: number;
  /** Current signed joint angle in degrees */
  currentAngleDeg: number;
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
    // Check if it looks like a muscle (even if name omits the word "muscle", e.g., "Supinator.005")
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
 * Default Z-Anatomy meter joint pivot coordinates (fallback when specific reference bone isn't isolated).
 */
export const DEFAULT_JOINT_PIVOTS: Record<MuscleJointGroupId, Vec3Tuple> = {
  shoulder: { x: -0.185, y: 1.382, z: -0.028 },
  scapula: { x: -0.115, y: 1.34, z: -0.068 },
  elbow: { x: -0.205, y: 1.102, z: -0.028 },
  radioulnar: { x: -0.218, y: 0.99, z: -0.022 },
  wrist: { x: -0.232, y: 0.855, z: -0.015 },
  fingers: { x: -0.242, y: 0.775, z: -0.006 },
  hip: { x: -0.088, y: 0.865, z: -0.018 },
  knee: { x: -0.082, y: 0.448, z: -0.022 },
  ankle: { x: -0.076, y: 0.084, z: -0.026 },
  subtalar: { x: -0.076, y: 0.056, z: -0.022 },
  toes: { x: -0.076, y: 0.022, z: 0.085 },
  tmj: { x: 0.0, y: 1.568, z: 0.008 },
  cervical_spine: { x: 0.0, y: 1.485, z: -0.028 },
  thoracolumbar_spine: { x: 0.0, y: 0.995, z: -0.042 },
  ribcage_diaphragm: { x: 0.0, y: 1.16, z: -0.015 },
  facial: { x: 0.0, y: 1.575, z: 0.075 },
};

function boxCenter(b: SimpleBox3): Vec3Tuple {
  return {
    x: (b.min.x + b.max.x) * 0.5,
    y: (b.min.y + b.max.y) * 0.5,
    z: (b.min.z + b.max.z) * 0.5,
  };
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
          x: hum.min.x + (hum.max.x - hum.min.x) * 0.65,
          y: hum.max.y - 0.022,
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
          x: (hum.min.x + hum.max.x) * 0.5,
          y: hum.min.y + 0.016,
          z: (hum.min.z + hum.max.z) * 0.5,
        };
      }
      break;
    }
    case 'radioulnar': {
      const ulna = findBox(/^ulna/i);
      const rad = findBox(/^radius/i);
      if (ulna && rad) {
        const cu = boxCenter(ulna);
        const cr = boxCenter(rad);
        return { x: (cu.x + cr.x) * 0.5, y: cr.y, z: (cu.z + cr.z) * 0.5 };
      }
      break;
    }
    case 'wrist': {
      const rad = findBox(/^radius/i);
      if (rad) {
        return {
          x: (rad.min.x + rad.max.x) * 0.5,
          y: rad.min.y + 0.008,
          z: (rad.min.z + rad.max.z) * 0.5,
        };
      }
      break;
    }
    case 'fingers': {
      const mc = findBox(/third\s+metacarpal|second\s+metacarpal|metacarpal/i);
      if (mc) {
        return {
          x: (mc.min.x + mc.max.x) * 0.5,
          y: mc.min.y + 0.006,
          z: (mc.min.z + mc.max.z) * 0.5,
        };
      }
      break;
    }
    case 'hip': {
      const fem = findBox(/^femur/i);
      if (fem) {
        return {
          x: fem.max.x - 0.022,
          y: fem.max.y - 0.024,
          z: (fem.min.z + fem.max.z) * 0.5,
        };
      }
      break;
    }
    case 'knee': {
      const fem = findBox(/^femur/i);
      if (fem) {
        return {
          x: (fem.min.x + fem.max.x) * 0.5,
          y: fem.min.y + 0.022,
          z: (fem.min.z + fem.max.z) * 0.5,
        };
      }
      break;
    }
    case 'ankle': {
      const tib = findBox(/^tibia/i);
      if (tib) {
        return {
          x: (tib.min.x + tib.max.x) * 0.5,
          y: tib.min.y + 0.012,
          z: (tib.min.z + tib.max.z) * 0.5,
        };
      }
      break;
    }
    case 'subtalar': {
      const tal = findBox(/^talus/i);
      if (tal) {
        return {
          x: (tal.min.x + tal.max.x) * 0.5,
          y: tal.min.y + 0.012,
          z: (tal.min.z + tal.max.z) * 0.5,
        };
      }
      break;
    }
    case 'toes': {
      const mt = findBox(/first\s+metatarsal|second\s+metatarsal|metatarsal/i);
      if (mt) {
        return {
          x: (mt.min.x + mt.max.x) * 0.5,
          y: (mt.min.y + mt.max.y) * 0.5,
          z: mt.max.z - 0.008,
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
          z: mand.min.z + 0.012,
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
      const t11 = findBox(/vertebra\s+t11|vertebra\s+t10/i);
      if (t11) return boxCenter(t11);
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
 * Derives anatomically aligned PP & PK 3D anchor points from a muscle's actual GLB bounding box.
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
      // In Z-Anatomy right limb/torso, +X is medial (toward midline 0), -X is lateral
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
 * Evaluates a single frame of kinematic simulation for Open Chain Concentric,
 * Eccentric Braking, or Closed Kinetic Chain (Reversed Origin-Insertion / Punctum Fixum).
 */
export function evaluateKinematicFrame(
  preset: MuscleKinematicPreset,
  progress01: number,
  mode: KinematicSimulationMode,
): EvaluatedKinematicFrame {
  const clamped = Math.max(0, Math.min(1, progress01));
  // Smooth ease-in-out curve for natural biological motion
  const eased = clamped * clamped * (3 - 2 * clamped);

  // Concentric shortens from startDeg -> endDeg; Eccentric lengthens from endDeg -> startDeg under load
  const motionT = mode === 'eccentric' ? 1 - eased : eased;

  const primaryDeg = preset.startDeg + (preset.endDeg - preset.startDeg) * motionT;
  const secondaryDeg = preset.secondaryRot
    ? preset.secondaryRot.startDeg +
      (preset.secondaryRot.endDeg - preset.secondaryRot.startDeg) * motionT
    : 0;

  // In closed chain, distal segment is fixed (Punctum Fixum), so proximal segment rotates oppositely
  const sign = mode === 'closed_chain' ? -1 : 1;

  const rotationRad: Vec3Tuple = { x: 0, y: 0, z: 0 };
  rotationRad[preset.rotAxis] += primaryDeg * DEG_TO_RAD * sign;
  if (preset.secondaryRot) {
    rotationRad[preset.secondaryRot.axis] += secondaryDeg * DEG_TO_RAD * sign;
  }

  const baseTrans = preset.translationMeters ?? [0, 0, 0];
  const translationMeters: Vec3Tuple = {
    x: baseTrans[0] * motionT * sign,
    y: baseTrans[1] * motionT * sign,
    z: baseTrans[2] * motionT * sign,
  };

  const totalRangeDeg = Math.abs(preset.endDeg - preset.startDeg);
  const sweepAngleDeg = Math.round(totalRangeDeg * motionT);

  // Concentric: fiber shortens & swells as motionT grows; Eccentric: stays under braking tension while elongating
  const fiberActivation =
    mode === 'eccentric'
      ? 0.45 + 0.55 * eased
      : 0.2 + 0.8 * motionT;

  const fiberThicknessScale =
    mode === 'eccentric'
      ? 1.15 - 0.25 * eased // stretches thinner under tension
      : 0.9 + 0.34 * motionT; // thickens during concentric shortening

  const bellyBulgeScale =
    mode === 'eccentric'
      ? 1.1 - 0.3 * eased
      : 0.85 + 0.45 * motionT;

  const phaseLabelPl =
    mode === 'concentric'
      ? 'Skurcz koncentryczny (zbliżanie PK → PP)'
      : mode === 'eccentric'
        ? 'Praca ekscentryczna (hamowanie — wydłużanie pod napięciem)'
        : 'Łańcuch zamknięty — odwrócony przyczep (PK ustalone!)';

  return {
    motionT,
    rotationRad,
    translationMeters,
    movingSegment: mode === 'closed_chain' ? 'proximal' : 'distal',
    sweepAngleDeg,
    totalRangeDeg: Math.round(totalRangeDeg),
    currentAngleDeg: Math.round(primaryDeg),
    fiberActivation,
    fiberThicknessScale,
    bellyBulgeScale,
    phaseLabelPl,
  };
}

/**
 * Generates 5 parallel spindle-shaped 3D muscle fascicle curves between live world PP and PK points.
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

  // Pick a stable reference vector not collinear with u
  const ref: Vec3Tuple = Math.abs(uy) < 0.85 ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 };
  // Basis vector a = normalize(u x ref)
  let ax = uy * ref.z - uz * ref.y;
  let ay = uz * ref.x - ux * ref.z;
  let az = ux * ref.y - uy * ref.x;
  const aLen = Math.hypot(ax, ay, az) || 1;
  ax /= aLen;
  ay /= aLen;
  az /= aLen;

  // Basis vector b = u x a
  const bx = uy * az - uz * ay;
  const by = uz * ax - ux * az;
  const bz = ux * ay - uy * ax;

  const baseSpread = Math.min(0.022, Math.max(0.006, len * 0.075)) * bellyBulgeScale;
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
      // Spindle belly profile: 0 at PP and PK tendons, 1.0 at mid-belly
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
 * Generates points along a 3D SFTR angle protractor arc around the joint pivot.
 */
export function computeProtractorArcPoints(
  pivot: Vec3Tuple,
  rotAxis: 'x' | 'y' | 'z',
  startDeg: number,
  currentDeg: number,
  radius = 0.095,
  segments = 24,
): Vec3Tuple[] {
  const pts: Vec3Tuple[] = [];
  const startRad = startDeg * DEG_TO_RAD;
  const currRad = currentDeg * DEG_TO_RAD;
  const span = currRad - startRad;
  if (Math.abs(span) < 0.02) return pts;

  for (let i = 0; i <= segments; i += 1) {
    const a = startRad + (span * i) / segments;
    let dx = 0;
    let dy = 0;
    let dz = 0;
    if (rotAxis === 'x') {
      // Base limb vector points down (-Y): rotated around +X by a -> (0, -cos a, -sin a)
      dy = -Math.cos(a) * radius;
      dz = -Math.sin(a) * radius;
    } else if (rotAxis === 'z') {
      // Base limb vector points down (-Y): rotated around +Z by a -> (+sin a, -cos a, 0)
      dx = Math.sin(a) * radius;
      dy = -Math.cos(a) * radius;
    } else {
      // Rotation around +Y: base anterior vector (+Z) -> (+sin a, 0, +cos a)
      dx = Math.sin(a) * radius;
      dz = Math.cos(a) * radius;
    }
    pts.push({ x: pivot.x + dx, y: pivot.y + dy, z: pivot.z + dz });
  }
  return pts;
}
