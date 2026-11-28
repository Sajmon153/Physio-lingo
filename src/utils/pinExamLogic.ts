import { ANATOMY_MAP } from '../data/anatomyDb';
import { BONY_LANDMARKS, type BonyLandmarkExtended } from '../data/bonyLandmarks';
import { capitalizeLatinTerm, formatBilingualName } from '../three/anatomyTranslator';
import { isTypingAnswerCorrect, normalizeAnatomyAnswer, shuffleArray } from './gameLogic';

export type PinExamRegion =
  | 'head_neck'
  | 'torso'
  | 'upper_limb_right'
  | 'lower_limb_right'
  | 'full_body';

export type PinExamPool =
  | 'all'
  | 'muscles'
  | 'landmarks'
  | 'vessels'
  | 'nerves'
  | 'connective'
  | 'organs';

export interface PinExamQuestion {
  id: string;
  kind: 'mesh' | 'landmark';
  systemGroup?: 'muscle' | 'landmark' | 'vessels' | 'nerves' | 'connective' | 'organs';
  region: PinExamRegion;
  structureId: string;
  landmarkId?: string;
  targetNamePl: string;
  targetNameLt?: string;
  targetNameEn?: string;
  boneNamePl?: string;
  roleHint?: 'pp' | 'pk' | 'landmark';
  clinicalHint?: string;
  prompt: string;
}

export interface PinExamSelectedPart {
  id: string;
  namePl: string;
  nameLt?: string;
  nameEn?: string;
  structureId?: string;
}

const REGION_MUSCLE_IDS: Record<Exclude<PinExamRegion, 'full_body'>, string[]> = {
  head_neck: [
    'm_sternocleidomastoideus',
    'm_scaleni',
    'm_masseter',
    'm_temporalis',
    'm_erector_spinae',
    'm_nasalis',
    'm_procerus',
    'm_levator_labii_superioris_alaeque_nasi',
  ],
  torso: [
    'm_pectoralis_major',
    'm_pectoralis_minor',
    'm_serratus_anterior',
    'm_trapezius',
    'm_latissimus_dorsi',
    'm_erector_spinae',
    'm_rhomboideus_major',
    'm_rhomboideus_minor',
    'm_iliopsoas',
    'm_rectus_abdominis',
    'm_obliquus_externus_abdominis',
    'm_quadratus_lumborum',
  ],
  upper_limb_right: [
    'm_supraspinatus',
    'm_infraspinatus',
    'm_teres_minor',
    'm_teres_major',
    'm_subscapularis',
    'm_deltoideus',
    'm_biceps_brachii',
    'm_triceps_brachii',
    'm_brachialis',
    'm_brachioradialis',
    'm_coracobrachialis',
    'm_levator_scapulae',
    'm_pronator_teres',
    'm_flexor_carpi_radialis',
    'm_flexor_carpi_ulnaris',
    'm_extensor_digitorum',
    'm_extensor_carpi_radialis_longus',
  ],
  lower_limb_right: [
    'm_quadriceps_femoris',
    'm_biceps_femoris',
    'm_semitendinosus',
    'm_semimembranosus',
    'm_popliteus',
    'm_gluteus_maximus',
    'm_gluteus_medius',
    'm_gluteus_minimus',
    'm_piriformis',
    'm_sartorius',
    'm_gracilis',
    'm_adductor_longus',
    'm_adductor_magnus',
    'm_gastrocnemius',
    'm_soleus',
    'm_tibialis_anterior',
    'm_tibialis_posterior',
    'm_peroneus_longus',
    'm_fibularis_brevis',
  ],
};

const REGION_LANDMARK_MESHES: Record<Exclude<PinExamRegion, 'full_body'>, Set<string>> = {
  head_neck: new Set([
    'Occipital bone',
    'Temporal bone.001',
    'Temporal bone',
    'Zygomatic bone.001',
    'Zygomatic bone',
    'Mandible',
    'Vertebra C5',
    'Vertebra C7',
  ]),
  torso: new Set([
    'Hip bone.003',
    'Hip bone.002',
    'Sacrum',
    'Manubrium of sternum',
    'Body of sternum',
    'Xiphoid process',
    'First rib.001',
    'First rib',
    'Fourth rib.001',
    'Fourth rib',
    'Seventh rib.001',
    'Seventh rib',
    'Twelfth rib.001',
    'Twelfth rib',
    'Vertebra T6',
    'Vertebra L1',
    'Vertebra L4',
  ]),
  upper_limb_right: new Set([
    'Clavicle.001',
    'Scapula.003',
    'Humerus.003',
    'Radius.003',
    'Ulna.003',
    'Second metacarpal bone.001',
    'Pisiform bone.001',
    'Middle phalanx of third finger of hand.001',
  ]),
  lower_limb_right: new Set([
    'Femur.003',
    'Patella.001',
    'Tibia.003',
    'Fibula.003',
    'Calcaneus.001',
    'First metatarsal bone.003',
    'Fifth metatarsal bone.003',
    'Navicular bone.001',
  ]),
};

export const PIN_EXAM_REGIONS: Array<{
  id: PinExamRegion;
  label: string;
  subtitle: string;
  modelUrl: string;
}> = [
  {
    id: 'upper_limb_right',
    label: 'Kończyna górna',
    subtitle: 'Obręcz barkowa, ramię, przedramię, ręka i przyczepy PP/PK',
    modelUrl: '/models/regional/upper_limb_right.glb',
  },
  {
    id: 'lower_limb_right',
    label: 'Kończyna dolna',
    subtitle: 'Pośladek, udo, staw kolanowy, podudzie i stopa',
    modelUrl: '/models/regional/lower_limb_right.glb',
  },
  {
    id: 'torso',
    label: 'Tułów i miednica',
    subtitle: 'Miednica (obie kości biodrowe), kręgosłup, klatka piersiowa i brzuch',
    modelUrl: '/models/regional/torso.glb',
  },
  {
    id: 'head_neck',
    label: 'Głowa i szyja',
    subtitle: 'Czaszka, żuchwa, kręgosłup szyjny, mięśnie żucia i szyi',
    modelUrl: '/models/regional/head_neck.glb',
  },
  {
    id: 'full_body',
    label: 'Całe ciało (Egzamin przekrojowy)',
    subtitle: 'Wszystkie mięśnie szkieletowe i punkty kostne z całego organizmu',
    modelUrl: '/models/body.glb',
  },
];

function getEligibleLandmarksForRegion(region: PinExamRegion): BonyLandmarkExtended[] {
  const seenBase = new Set<string>();
  const out: BonyLandmarkExtended[] = [];

  for (const lm of BONY_LANDMARKS) {
    if (lm.side === 'left') continue; // deduplicate R/L pairs (evaluation accepts either side!)
    if (region !== 'full_body') {
      const allowed = REGION_LANDMARK_MESHES[region];
      if (!lm.parentMesh || !allowed.has(lm.parentMesh)) continue;
    }
    const baseId = lm.id.replace(/_(r|l)$/, '');
    if (seenBase.has(baseId)) continue;
    seenBase.add(baseId);
    out.push(lm);
  }
  return out;
}

function getEligibleMuscleIdsForRegion(region: PinExamRegion): string[] {
  if (region === 'full_body') {
    const unique = new Set<string>([
      ...REGION_MUSCLE_IDS.head_neck,
      ...REGION_MUSCLE_IDS.torso,
      ...REGION_MUSCLE_IDS.upper_limb_right,
      ...REGION_MUSCLE_IDS.lower_limb_right,
    ]);
    return Array.from(unique).filter((id) => Boolean(ANATOMY_MAP[id]));
  }
  return REGION_MUSCLE_IDS[region].filter((id) => Boolean(ANATOMY_MAP[id]));
}

const REGION_VESSEL_IDS: Record<Exclude<PinExamRegion, 'full_body'>, string[]> = {
  head_neck: ['a_carotis_communis', 'a_carotis_interna', 'a_vertebralis', 'v_jugularis_interna'],
  torso: ['a_aorta', 'a_subclavia', 'a_iliaca_communis', 'v_cava_superior', 'v_cava_inferior', 'v_subclavia', 'v_portae'],
  upper_limb_right: ['a_axillaris', 'a_brachialis', 'a_radialis', 'a_ulnaris', 'v_cephalica', 'v_basilica', 'v_mediana_cubiti'],
  lower_limb_right: ['a_femoralis', 'a_profunda_femoris', 'a_poplitea', 'a_tibialis_anterior', 'a_tibialis_posterior', 'a_dorsalis_pedis', 'v_femoralis', 'v_saphena_magna', 'v_saphena_parva', 'v_poplitea'],
};

const REGION_NERVE_IDS: Record<Exclude<PinExamRegion, 'full_body'>, string[]> = {
  head_neck: ['n_cerebrum', 'n_cerebellum', 'n_trigeminus', 'n_facialis', 'n_vagus', 'n_phrenicus'],
  torso: ['n_medulla_spinalis', 'n_vagus', 'n_phrenicus'],
  upper_limb_right: ['n_plexus_brachialis', 'n_axillaris', 'n_musculocutaneus', 'n_radialis', 'n_medianus', 'n_ulnaris'],
  lower_limb_right: ['n_femoralis', 'n_ischiadicus', 'n_tibialis', 'n_fibularis_communis', 'n_obturatorius'],
};

const REGION_CONNECTIVE_IDS: Record<Exclude<PinExamRegion, 'full_body'>, string[]> = {
  head_neck: ['tendon_epicranial_aponeurosis'],
  torso: ['lig_longitudinale_anterius', 'lig_flavum', 'lig_sacrotuberale', 'bursa_iliopectinea', 'discus_intervertebralis'],
  upper_limb_right: [
    'bursa_subacromialis',
    'bursa_subdeltoidea',
    'bursa_subtendinea_tricipitis',
    'tendon_intertubercular_sheath',
    'tendon_common_flexor_sheath',
    'tendon_fpl_sheath',
    'tendon_extensor_digitorum_sheath',
    'lig_coracoclaviculare',
    'lig_coracoacromiale',
    'lig_annulare_radii',
    'labrum_glenoidale',
  ],
  lower_limb_right: [
    'bursa_trochanterica',
    'bursa_suprapatellaris',
    'bursa_praepatellaris',
    'bursa_infrapatellaris_profunda',
    'bursa_anserina',
    'bursa_calcanea',
    'tendon_tibialis_anterior_sheath',
    'tendon_tibialis_posterior_sheath',
    'tendon_fibularis_sheath',
    'lig_iliofemorale',
    'lig_ischiofemorale',
    'lig_pubofemorale',
    'lig_talofibulare_anterius',
    'lig_deltoideum_ankle',
    'acl',
    'pcl',
    'mcl',
    'lcl',
    'meniscus_medialis',
    'meniscus_lateralis',
  ],
};

const REGION_ORGAN_IDS: Record<Exclude<PinExamRegion, 'full_body'>, string[]> = {
  head_neck: ['org_glandula_thyroidea'],
  torso: [
    'org_cor',
    'org_pulmo',
    'org_trachea',
    'org_oesophagus',
    'org_gaster',
    'org_hepar',
    'org_vesica_biliaris',
    'org_pancreas',
    'org_splen',
    'org_intestinum_tenue',
    'org_colon',
    'org_ren',
    'org_vesica_urinaria',
  ],
  upper_limb_right: [],
  lower_limb_right: [],
};

function getEligibleSystemIdsForRegion(
  map: Record<Exclude<PinExamRegion, 'full_body'>, string[]>,
  region: PinExamRegion,
): string[] {
  if (region === 'full_body') {
    const unique = new Set<string>([
      ...map.head_neck,
      ...map.torso,
      ...map.upper_limb_right,
      ...map.lower_limb_right,
    ]);
    return Array.from(unique).filter((id) => Boolean(ANATOMY_MAP[id]));
  }
  return map[region].filter((id) => Boolean(ANATOMY_MAP[id]));
}

function buildStructureQuestion(
  region: PinExamRegion,
  structureId: string,
  systemGroup: 'muscle' | 'vessels' | 'nerves' | 'connective' | 'organs',
): PinExamQuestion {
  const entry = ANATOMY_MAP[structureId];
  const targetNameLt = capitalizeLatinTerm(entry.nameLt);
  const label = formatBilingualName(entry.namePl, targetNameLt);
  const hint =
    systemGroup === 'muscle'
      ? `Unerwienie: ${entry.innervation}${entry.spinalSegments && entry.spinalSegments !== '—' ? ` (${entry.spinalSegments})` : ''}.`
      : entry.functionDesc;
  return {
    id: `pin_mesh_${structureId}`,
    kind: 'mesh',
    systemGroup,
    region,
    structureId,
    targetNamePl: entry.namePl,
    targetNameLt,
    targetNameEn: entry.nameEn,
    clinicalHint: hint,
    prompt: `Wskaż: ${label}`,
  };
}

function buildMuscleQuestion(region: PinExamRegion, structureId: string): PinExamQuestion {
  return buildStructureQuestion(region, structureId, 'muscle');
}

function buildLandmarkQuestion(region: PinExamRegion, lm: BonyLandmarkExtended): PinExamQuestion {
  const targetNameLt = capitalizeLatinTerm(lm.nameLt);
  const label = formatBilingualName(lm.namePl, targetNameLt);
  const roleLabel =
    lm.type === 'pp'
      ? 'przyczep początkowy (PP)'
      : lm.type === 'pk'
        ? 'przyczep końcowy (PK)'
        : 'punkt kostny';
  const firstMuscle = lm.attachedMuscles?.[0]?.split('(')[0]?.trim();

  return {
    id: `pin_lm_${lm.id}`,
    kind: 'landmark',
    region,
    structureId: lm.structureId || lm.id,
    landmarkId: lm.id,
    targetNamePl: lm.namePl,
    targetNameLt,
    targetNameEn: lm.nameEn,
    boneNamePl: lm.boneNamePl,
    roleHint: lm.type,
    clinicalHint: firstMuscle
      ? `${roleLabel} — ${firstMuscle}.`
      : `Kategoria strefy: ${roleLabel}.`,
    prompt: `Wskaż: ${label}`,
  };
}

export function getPinExamPoolCounts(region: PinExamRegion): {
  muscles: number;
  landmarks: number;
  vessels: number;
  nerves: number;
  connective: number;
  organs: number;
  total: number;
} {
  const muscles = getEligibleMuscleIdsForRegion(region).length;
  const landmarks = getEligibleLandmarksForRegion(region).length;
  const vessels = getEligibleSystemIdsForRegion(REGION_VESSEL_IDS, region).length;
  const nerves = getEligibleSystemIdsForRegion(REGION_NERVE_IDS, region).length;
  const connective = getEligibleSystemIdsForRegion(REGION_CONNECTIVE_IDS, region).length;
  const organs = getEligibleSystemIdsForRegion(REGION_ORGAN_IDS, region).length;
  return { muscles, landmarks, vessels, nerves, connective, organs, total: muscles + landmarks };
}

export function buildPinExamQuestions(
  region: PinExamRegion,
  pool: PinExamPool,
  count: number,
  rng: () => number = Math.random,
): PinExamQuestion[] {
  if (pool === 'vessels') {
    const qs = getEligibleSystemIdsForRegion(REGION_VESSEL_IDS, region).map((id) =>
      buildStructureQuestion(region, id, 'vessels'),
    );
    return shuffleArray(qs, rng).slice(0, count);
  }
  if (pool === 'nerves') {
    const qs = getEligibleSystemIdsForRegion(REGION_NERVE_IDS, region).map((id) =>
      buildStructureQuestion(region, id, 'nerves'),
    );
    return shuffleArray(qs, rng).slice(0, count);
  }
  if (pool === 'connective') {
    const qs = getEligibleSystemIdsForRegion(REGION_CONNECTIVE_IDS, region).map((id) =>
      buildStructureQuestion(region, id, 'connective'),
    );
    return shuffleArray(qs, rng).slice(0, count);
  }
  if (pool === 'organs') {
    const qs = getEligibleSystemIdsForRegion(REGION_ORGAN_IDS, region).map((id) =>
      buildStructureQuestion(region, id, 'organs'),
    );
    return shuffleArray(qs, rng).slice(0, count);
  }

  const muscleQuestions = getEligibleMuscleIdsForRegion(region).map((id) =>
    buildMuscleQuestion(region, id),
  );
  const landmarkQuestions = getEligibleLandmarksForRegion(region).map((lm) =>
    buildLandmarkQuestion(region, lm),
  );

  if (pool === 'muscles') {
    return shuffleArray(muscleQuestions, rng).slice(0, count);
  }
  if (pool === 'landmarks') {
    return shuffleArray(landmarkQuestions, rng).slice(0, count);
  }

  // Balanced mix of muscles & bony landmarks/PP-PK zones
  const shuffledM = shuffleArray(muscleQuestions, rng);
  const shuffledL = shuffleArray(landmarkQuestions, rng);
  const targetM = Math.min(shuffledM.length, Math.ceil(count * 0.5));
  const targetL = Math.min(shuffledL.length, count - targetM);
  const combined = [...shuffledM.slice(0, targetM), ...shuffledL.slice(0, targetL)];

  if (combined.length < count) {
    const usedIds = new Set(combined.map((q) => q.id));
    const extras = shuffleArray([...shuffledM, ...shuffledL], rng).filter(
      (q) => !usedIds.has(q.id),
    );
    for (const ex of extras) {
      if (combined.length >= count) break;
      combined.push(ex);
    }
  }

  return shuffleArray(combined, rng);
}

export function evaluatePinExamAnswer(
  question: PinExamQuestion,
  selectedPart: PinExamSelectedPart | null,
): boolean {
  if (!selectedPart) return false;

  const cleanSelectedPl = normalizeAnatomyAnswer(
    selectedPart.namePl.replace(/\s*\(strona\s+(prawa|lewa)\)/gi, ''),
  );
  const cleanTargetPl = normalizeAnatomyAnswer(question.targetNamePl);

  if (question.kind === 'landmark') {
    const selBase = selectedPart.id.replace(/_(r|l)$/, '');
    const targetBase = (question.landmarkId ?? question.structureId).replace(/_(r|l)$/, '');
    if (selBase === targetBase) return true;
    if (selectedPart.structureId && selectedPart.structureId === question.structureId) {
      return true;
    }
    return cleanSelectedPl.length > 0 && cleanSelectedPl === cleanTargetPl;
  }

  if (selectedPart.structureId && selectedPart.structureId === question.structureId) {
    return true;
  }
  return cleanSelectedPl.length > 0 && cleanSelectedPl === cleanTargetPl;
}

export interface ReversePinOption {
  id: string;
  label: string;
  isCorrect: boolean;
}

export function buildReversePinOptions(
  question: PinExamQuestion,
  region: PinExamRegion = question.region,
  rng: () => number = Math.random,
): ReversePinOption[] {
  const correctLabel = formatBilingualName(question.targetNamePl, question.targetNameLt);
  const targetNorm = normalizeAnatomyAnswer(question.targetNamePl);

  const gatherCandidates = (r: PinExamRegion): PinExamQuestion[] => {
    if (question.kind === 'landmark') {
      return getEligibleLandmarksForRegion(r).map((lm) => buildLandmarkQuestion(r, lm));
    }
    if (question.systemGroup === 'vessels') {
      return getEligibleSystemIdsForRegion(REGION_VESSEL_IDS, r).map((id) =>
        buildStructureQuestion(r, id, 'vessels'),
      );
    }
    if (question.systemGroup === 'nerves') {
      return getEligibleSystemIdsForRegion(REGION_NERVE_IDS, r).map((id) =>
        buildStructureQuestion(r, id, 'nerves'),
      );
    }
    if (question.systemGroup === 'connective') {
      return getEligibleSystemIdsForRegion(REGION_CONNECTIVE_IDS, r).map((id) =>
        buildStructureQuestion(r, id, 'connective'),
      );
    }
    if (question.systemGroup === 'organs') {
      return getEligibleSystemIdsForRegion(REGION_ORGAN_IDS, r).map((id) =>
        buildStructureQuestion(r, id, 'organs'),
      );
    }
    return getEligibleMuscleIdsForRegion(r).map((id) => buildMuscleQuestion(r, id));
  };

  const seenNorm = new Set<string>([targetNorm]);
  const distractors: ReversePinOption[] = [];

  const addFromPool = (pool: PinExamQuestion[]) => {
    for (const candidate of shuffleArray(pool, rng)) {
      if (distractors.length >= 3) break;
      const norm = normalizeAnatomyAnswer(candidate.targetNamePl);
      if (!norm || seenNorm.has(norm)) continue;
      seenNorm.add(norm);
      distractors.push({
        id: candidate.id,
        label: formatBilingualName(candidate.targetNamePl, candidate.targetNameLt),
        isCorrect: false,
      });
    }
  };

  addFromPool(gatherCandidates(region));
  if (distractors.length < 3) {
    addFromPool(gatherCandidates('full_body'));
  }

  return shuffleArray(
    [
      {
        id: question.id,
        label: correctLabel,
        isCorrect: true,
      },
      ...distractors.slice(0, 3),
    ],
    rng,
  );
}

export function evaluateReverseTypingAnswer(
  question: PinExamQuestion,
  userInput: string,
): boolean {
  const accepted = new Set<string>();
  accepted.add(question.targetNamePl);
  if (question.targetNameLt) {
    accepted.add(question.targetNameLt);
  }
  if (question.targetNameEn) {
    accepted.add(question.targetNameEn);
  }
  const strippedPl = question.targetNamePl.replace(/\s*\([^)]*\)/g, '').trim();
  if (strippedPl) accepted.add(strippedPl);

  const entry = ANATOMY_MAP[question.structureId];
  if (entry) {
    accepted.add(entry.namePl);
    if (entry.nameLt) accepted.add(entry.nameLt);
    if (entry.nameEn) accepted.add(entry.nameEn);
    for (const alias of entry.aliases) {
      accepted.add(alias);
    }
  }

  return isTypingAnswerCorrect(userInput, Array.from(accepted));
}

