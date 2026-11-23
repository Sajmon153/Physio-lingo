import * as THREE from 'three';
import { ANATOMY_DB, ANATOMY_MAP } from '../data/anatomyDb';
import { BonyLandmarkExtended } from '../data/bonyLandmarks';

export type BoneSurfaceZoneMode = 'landmarks' | 'attachments' | 'off';

export interface BoneZoneMeshData {
  landmarks: BonyLandmarkExtended[];
  vertexZoneIndex: Int16Array;
  faceZoneIndex: Int16Array;
  zoneCentroids: THREE.Vector3[];
  zoneRadii: number[];
  colorAttr: THREE.BufferAttribute;
}

// Distinct anatomical landmark palette (Mode 1: "Struktury kostne")
const LANDMARK_ZONE_PALETTE: number[] = [
  0x10b981, // Szmaragdowy (Emerald)
  0xf59e0b, // Bursztynowy (Amber)
  0xe11d48, // Karmazynowy (Crimson-Rose)
  0x84cc16, // Oliwkowa limonka (Lime-Olive)
  0xa855f7, // Ametystowy (Amethyst)
  0xf97316, // Koralowy (Coral-Orange)
  0x14b8a6, // Morski szmaragd (Sea-Emerald)
];

// Netter attachment convention (Mode 2: "Przyczepy PP/PK")
const NETTER_PP_HEX = 0xdc2626; // Przyczep początkowy (Origin) - Netter Crimson Red
const NETTER_PK_HEX = 0x059669; // Przyczep końcowy (Insertion) - Contrasting Deep Emerald
const NETTER_LANDMARK_HEX = 0xd97706; // Punkt kostny (Bony Landmark) - Warm Gold Amber

const BASE_BONE_IVORY_HEX = 0xefe5d2;
const HOVER_ZONE_HEX = 0xfbbf24;
const SELECTED_ZONE_HEX = 0x22c55e;
const WRONG_ZONE_HEX = 0xef4444;

const tempColor = new THREE.Color();
const tempBaseBone = new THREE.Color(BASE_BONE_IVORY_HEX);

function stripDiacriticsLower(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .trim();
}

/**
 * Determines the anatomical attachment role ('pp' origin, 'pk' insertion, or 'landmark')
 * of a bony landmark for a specific muscle, returning null if that muscle does not attach there.
 * Handles multi-muscle shared landmarks accurately (e.g., coracoid process is PK for
 * Pectoralis minor and PP for Biceps brachii short head & Coracobrachialis).
 */
export function getLandmarkAttachmentRoleForMuscle(
  lm: BonyLandmarkExtended,
  muscleStructureId?: string | null,
  muscleNamePl?: string | null,
): 'pp' | 'pk' | 'landmark' | null {
  if (!lm.attachedMuscles || lm.attachedMuscles.length === 0) return null;

  const dbEntry = muscleStructureId ? ANATOMY_MAP[muscleStructureId] : undefined;
  const rawNames: string[] = [];

  if (dbEntry) {
    rawNames.push(dbEntry.namePl);
    if (dbEntry.nameEn) rawNames.push(dbEntry.nameEn);
  }
  if (muscleNamePl) {
    const cleaned = muscleNamePl
      .replace(/\s*\(strona\s+(prawa|lewa)\)/gi, '')
      .replace(/\s*\([^)]*\)\s*$/, '')
      .trim();
    if (cleaned) rawNames.push(cleaned);
  }

  const needles = rawNames
    .map((n) =>
      stripDiacriticsLower(n)
        .replace(/\s*\([^)]*\)\s*/g, ' ')
        .replace(/^(miesien|miesnie|m\.|mm\.|muscle|muscles)\s+/i, '')
        .replace(/\b(muscle|muscles)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((n) => n.length >= 4);

  if (needles.length === 0) return null;

  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const isNonAttachmentReference = (hay: string) =>
    /\b(przebieg\s+w\s+bruzdzie|w\s+bruzdzie\s+za\s+kostka|nad\s+sciegnem|w\s+poblizu|deltoid\s*\/\s*medial\s+collateral|deltoid\s+ligament|staw\s+ramienno-)\b/i.test(
      hay,
    ) || /—\s*za\s+kostka\b/i.test(hay);

  let matchedRole: 'pp' | 'pk' | 'landmark' | null = null;

  for (const attached of lm.attachedMuscles) {
    const hay = stripDiacriticsLower(attached);
    if (isNonAttachmentReference(hay)) continue;

    const isMatch = needles.some((needle) => {
      // Prevent false substring collisions:
      // - "czworoboczny" (trapezius) must NOT match "czworoboczny ledzwi" or "czworoboczny uda"
      // - "deltoid" (deltoid muscle) must NOT match ankle "deltoid ligament"
      if (needle === 'czworoboczny' && /\bczworoboczny\s+(ledzwi|uda)\b/.test(hay)) {
        return false;
      }
      if (needle === 'deltoid' && /\bdeltoid\b[^)]*\bligament\b/.test(hay)) {
        return false;
      }
      // Allow singular/plural prefix for "pochyle" / "scalene"
      if (needle === 'pochyle' || needle === 'scalene') {
        return /\b(pochyl(e|y|ych)|scalen(e|es|us))\b/i.test(hay);
      }
      const re = new RegExp(`(?<![a-z0-9-])${escapeRe(needle)}(?![a-z0-9-])`, 'i');
      return re.test(hay);
    });

    if (!isMatch) continue;

    // Infer explicit per-muscle PP/PK role when specified on shared landmarks
    if (/\b(przyczep\s+poczatkowy|origin)\b/i.test(hay)) {
      return 'pp';
    }
    if (/\b(przyczep\s+koncowy|sciegno\s+koncowe|insertion)\b/i.test(hay)) {
      return 'pk';
    }
    matchedRole = lm.type;
  }

  return matchedRole;
}

/**
 * Checks if a bony landmark lists a given muscle (by structureId or Polish/English name)
 * in its `attachedMuscles` array.
 */
export function doesLandmarkAttachMuscle(
  lm: BonyLandmarkExtended,
  muscleStructureId?: string | null,
  muscleNamePl?: string | null,
): boolean {
  return getLandmarkAttachmentRoleForMuscle(lm, muscleStructureId, muscleNamePl) !== null;
}

/**
 * Returns deduplicated 3D bony attachment zones grouped into PP (origin) and PK (insertion)
 * for a given muscle, preferring the same anatomical side (right/left) when multiple sides exist.
 */
export function getMuscleAttachmentZones(
  landmarks: readonly BonyLandmarkExtended[],
  muscleStructureId?: string | null,
  muscleNamePl?: string | null,
  preferredSide?: 'right' | 'left' | 'midline',
): { pp: BonyLandmarkExtended[]; pk: BonyLandmarkExtended[] } {
  const ppMap = new Map<string, BonyLandmarkExtended>();
  const pkMap = new Map<string, BonyLandmarkExtended>();

  const sideFromName =
    preferredSide ??
    (muscleNamePl && /\(strona\s+lewa\)/i.test(muscleNamePl)
      ? 'left'
      : muscleNamePl && /\(strona\s+prawa\)/i.test(muscleNamePl)
        ? 'right'
        : 'right');

  for (const lm of landmarks) {
    const role = getLandmarkAttachmentRoleForMuscle(lm, muscleStructureId, muscleNamePl);
    if (role !== 'pp' && role !== 'pk') continue;
    const baseKey = lm.id.replace(/_(r|l)$/, '');
    const targetMap = role === 'pp' ? ppMap : pkMap;
    const existing = targetMap.get(baseKey);
    if (!existing) {
      targetMap.set(baseKey, lm);
    } else if (lm.side === sideFromName && existing.side !== sideFromName) {
      targetMap.set(baseKey, lm);
    }
  }

  return {
    pp: Array.from(ppMap.values()),
    pk: Array.from(pkMap.values()),
  };
}

/**
 * Resolves a human-readable attached muscle/structure string from `lm.attachedMuscles`
 * (e.g. "Mięsień nadgrzebieniowy (Supraspinatus muscle)") to a canonical `structureId`
 * in `ANATOMY_DB` or a clean search query for selecting the corresponding 3D mesh.
 */
export function resolveAttachedMuscleTarget(attachedText: string): {
  structureId?: string;
  coreNamePl: string;
  coreNameEn?: string;
} {
  // 1. Extract trailing parenthesized English name FIRST before stripping em-dash qualifiers
  const trailingParen = attachedText.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  const rawPlPart = (trailingParen ? trailingParen[1] : attachedText).trim();
  const rawEnPart = trailingParen?.[2]?.trim();

  const coreNamePl = rawPlPart.split(/\s*[—–]\s*/)[0].trim();
  const coreNameEn = rawEnPart ? rawEnPart.split(/\s*[—–]\s*/)[0].trim() : undefined;

  const fullNorm = stripDiacriticsLower(attachedText);
  const normPl = stripDiacriticsLower(coreNamePl)
    .replace(/^(miesien|m\.|sciegno|sciegna)\s+/i, '')
    .trim();
  const normEn = coreNameEn
    ? stripDiacriticsLower(coreNameEn)
        .replace(/\b(muscle|muscles|tendon|tendons)\b/gi, '')
        .trim()
    : '';

  // 2. Explicit anatomical synonym & compound-entry resolution to actual 3D meshes in body.glb
  const SYNONYM_RULES: Array<{
    test: RegExp;
    structureId?: string;
    coreNamePl: string;
    coreNameEn: string;
  }> = [
    {
      test: /\bbiceps\s+brachii\b|\bdwuglow(y|ego)\s+ramienia\b/i,
      structureId: 'm_biceps_brachii',
      coreNamePl: 'Mięsień dwugłowy ramienia',
      coreNameEn: 'Biceps brachii',
    },
    {
      test: /\btriceps\s+brachii\b|\btrojglow(y|ego)\s+ramienia\b/i,
      structureId: 'm_triceps_brachii',
      coreNamePl: 'Mięsień trójgłowy ramienia',
      coreNameEn: 'Triceps brachii',
    },
    {
      test: /\b(rectus\s+femoris|quadriceps|patellar\s+ligament|wiezadlo\s+rzepki|prosty\s+uda|czworoglow(y|ego)\s+uda|patellofemoral|rzepkowo-udowy)\b/i,
      structureId: 'm_quadriceps_femoris',
      coreNamePl: 'Mięsień czworogłowy uda',
      coreNameEn: 'Quadriceps femoris',
    },
    {
      test: /\b(soleus|plaszczkowat(y|ego))\b/i,
      structureId: 'm_soleus',
      coreNamePl: 'Mięsień płaszczkowaty',
      coreNameEn: 'Soleus',
    },
    {
      test: /\b(achilles|triceps\s+surae|trojglow(y|ego)\s+lydki|gastrocnemius|brzuchat(y|ego)\s+lydki|plantar\s+aponeurosis|rozciegno\s+podeszwowe)\b/i,
      structureId: 'm_gastrocnemius',
      coreNamePl: 'Mięsień brzuchaty łydki',
      coreNameEn: 'Gastrocnemius',
    },
    {
      test: /\b(scalen(e|es|us)|pochyl(e|y|ych))\b/i,
      structureId: 'm_scaleni',
      coreNamePl: 'Mięśnie pochyłe',
      coreNameEn: 'Scalene',
    },
    {
      test: /\b(quadratus\s+lumborum|czworoboczny\s+ledzwi)\b/i,
      structureId: 'm_quadratus_lumborum',
      coreNamePl: 'Mięsień czworoboczny lędźwi',
      coreNameEn: 'Quadratus lumborum',
    },
    {
      test: /\b(gluteus\s+maximus|posladkow(y|ego)\s+wielki(ego)?)\b/i,
      structureId: 'm_gluteus_maximus',
      coreNamePl: 'Mięsień pośladkowy wielki',
      coreNameEn: 'Gluteus maximus',
    },
    {
      test: /\b(tensor\s+fasciae\s+latae|naprezacz\s+powiezi|iliotibial\s+tract|pasmo\s+biodrowo-piszczelowe)\b/i,
      structureId: 'm_gluteus_medius',
      coreNamePl: 'Mięsień pośladkowy średni',
      coreNameEn: 'Gluteus medius',
    },
    {
      test: /\b(internal.*oblique|skosny\s+wewnetrzny)\b/i,
      coreNamePl: 'Mięsień skośny wewnętrzny brzucha',
      coreNameEn: 'Internal abdominal oblique',
    },
    {
      test: /\b(obturator\s+internus|zaslaniacz\s+wewnetrzny)\b/i,
      coreNamePl: 'Mięsień zasłaniacz wewnętrzny',
      coreNameEn: 'Obturator internus',
    },
    {
      test: /\b(adductor\s+longus|przywodziciel\s+dlugi)\b/i,
      structureId: 'm_adductor_longus',
      coreNamePl: 'Mięsień przywodziciel długi',
      coreNameEn: 'Adductor longus',
    },
    {
      test: /\b(adductor\s+magnus|przywodziciel\s+wielki)\b/i,
      structureId: 'm_adductor_magnus',
      coreNamePl: 'Mięsień przywodziciel wielki',
      coreNameEn: 'Adductor magnus',
    },
    {
      test: /\b(tibialis\s+posterior|piszczelow(y|ego)\s+tyln(y|ego)|deltoid\s*\/\s*medial\s+collateral)\b/i,
      structureId: 'm_tibialis_posterior',
      coreNamePl: 'Mięsień piszczelowy tylny',
      coreNameEn: 'Tibialis posterior',
    },
    {
      test: /\b(fibularis\s+longus|peroneus\s+longus|strzalkow(y|ego|ych)\s+dlugi(ego)?|talofibular|calcaneofibular)\b/i,
      structureId: 'm_peroneus_longus',
      coreNamePl: 'Mięsień strzałkowy długi',
      coreNameEn: 'Fibularis longus',
    },
    {
      test: /\b(fibularis\s+brevis|peroneus\s+brevis|strzalkow(y|ego)\s+krotki(ego)?)\b/i,
      structureId: 'm_fibularis_brevis',
      coreNamePl: 'Mięsień strzałkowy krótki',
      coreNameEn: 'Fibularis brevis',
    },
    {
      test: /\b(external.*oblique|skosny\s+zewnetrzny|inguinal\s+ligament|wiezadlo\s+pachwinowe)\b/i,
      structureId: 'm_obliquus_externus_abdominis',
      coreNamePl: 'Mięsień skośny zewnętrzny brzucha',
      coreNameEn: 'External abdominal oblique',
    },
    {
      test: /\b(sacrotuberous|sacroiliac|krzyzowo-guzowe|krzyzowo-biodrowe)\b/i,
      structureId: 'm_gluteus_maximus',
      coreNamePl: 'Mięsień pośladkowy wielki',
      coreNameEn: 'Gluteus maximus',
    },
    {
      test: /\b(coracoacromial|kruczo-barkowe|coracoid\s+process\s+to\s+acromion|wiezadlo\s+wlasne\s+lopatki|glenohumeral|obrabkowo-ramienne|supraspinatus|nadgrzebieniow(y|ego))\b/i,
      structureId: 'm_supraspinatus',
      coreNamePl: 'Mięsień nadgrzebieniowy',
      coreNameEn: 'Supraspinatus',
    },
    {
      test: /\b(axillary\s+nerve|nerwu\s+pachowego|deltoid|naramienny)\b/i,
      structureId: 'm_deltoideus',
      coreNamePl: 'Mięsień naramienny',
      coreNameEn: 'Deltoid',
    },
    {
      test: /\b(nuchal\s+ligament|wiezadlo\s+karkowe|conoid\s+ligament|kruczo-obojczykowe|trapezius|czworoboczny)\b/i,
      structureId: 'm_trapezius',
      coreNamePl: 'Mięsień czworoboczny',
      coreNameEn: 'Trapezius',
    },
    {
      test: /\b(thoracolumbar\s+fascia|powiez\s+piersiowo-ledzwiowa)\b/i,
      structureId: 'm_latissimus_dorsi',
      coreNamePl: 'Mięsień najszerszy grzbietu',
      coreNameEn: 'Latissimus dorsi',
    },
    {
      test: /\b(interclavicular\s+ligament|miedzyobojczykowe)\b/i,
      structureId: 'clavicula',
      coreNamePl: 'Obojczyk',
      coreNameEn: 'Clavicle',
    },
    {
      test: /\b(2nd\s+costal\s+cartilage|ii\s+chrzastka\s+zebrowa)\b/i,
      coreNamePl: 'Chrząstka żebrowa II',
      coreNameEn: 'Second costal cartilage',
    },
    {
      test: /\b(iliofemoral|biodrowo-udowe|ligament\s+of\s+head\s+of\s+femur|wiezadlo\s+glowy\s+kosci\s+udowej|iliopsoas|biodrowo-ledzwiowy|iliacus)\b/i,
      structureId: 'm_iliopsoas',
      coreNamePl: 'Mięsień biodrowo-lędźwiowy',
      coreNameEn: 'Iliopsoas',
    },
    {
      test: /\b(medial\s+collateral\s+ligament|poboczne\s+piszczelowe|medial\s+femoral\s+epicondyle|nadklykiec\s+przysrodkowy\s+kosci\s+udowej|medial\s+meniscus|lakotk(a|a)\s+przysrodkow(a|a)|semimembranosus|polbloniasty)\b/i,
      structureId: 'm_semimembranosus',
      coreNamePl: 'Mięsień półbłoniasty',
      coreNameEn: 'Semimembranosus',
    },
    {
      test: /\b(lateral\s+collateral\s+ligament|poboczne\s+strzalkowe|biceps\s+femoris|dwuglow(y|ego)\s+uda)\b/i,
      structureId: 'm_biceps_femoris',
      coreNamePl: 'Mięsień dwugłowy uda',
      coreNameEn: 'Biceps femoris',
    },
    {
      test: /\b(anterior\s+intercondylar|lateral\s+femoral\s+condyle|miedzyklykciowe|klykcia\s+bocznego)\b/i,
      structureId: 'm_quadriceps_femoris',
      coreNamePl: 'Mięsień czworogłowy uda',
      coreNameEn: 'Quadriceps femoris',
    },
    {
      test: /\b(annular\s+ligament|obraczkowate|supinator|odwracacz)\b/i,
      coreNamePl: 'Mięsień odwracacz',
      coreNameEn: 'Supinator',
    },
    {
      test: /\b(radial\s+collateral\s+ligament|poboczne\s+promieniowe|brachioradialis|ramienno-promieniowy)\b/i,
      structureId: 'm_brachioradialis',
      coreNamePl: 'Mięsień ramienno-promieniowy',
      coreNameEn: 'Brachioradialis',
    },
    {
      test: /\b(ulnar\s+collateral\s+ligament|poboczne\s+lokciowe|triangular\s+fibrocartilage|tfcc|chrzastki\s+trojkatnej)\b/i,
      coreNamePl: 'Mięsień prostownik łokciowy nadgarstka',
      coreNameEn: 'Extensor carpi ulnaris',
    },
    {
      test: /\b(posterior\s+capsule\s+of\s+elbow|torebka\s+stawu\s+lokciowego)\b/i,
      structureId: 'm_triceps_brachii',
      coreNamePl: 'Mięsień trójgłowy ramienia',
      coreNameEn: 'Triceps brachii',
    },
    {
      test: /\b(ramienno-lokciowy|bloczek.*glowka)\b/i,
      structureId: 'm_brachialis',
      coreNamePl: 'Mięsień ramienny',
      coreNameEn: 'Brachialis',
    },
  ];

  for (const syn of SYNONYM_RULES) {
    if (syn.test.test(fullNorm)) {
      return {
        structureId: syn.structureId,
        coreNamePl: syn.coreNamePl,
        coreNameEn: syn.coreNameEn,
      };
    }
  }

  for (const entry of ANATOMY_DB) {
    if (entry.category !== 'muscle') continue;
    const entryPl = stripDiacriticsLower(entry.namePl)
      .replace(/^(miesien|m\.)\s+/i, '')
      .trim();
    const entryEn = entry.nameEn
      ? stripDiacriticsLower(entry.nameEn)
          .replace(/\bmuscle\b/gi, '')
          .trim()
      : '';
    if (
      (normPl.length >= 4 && (entryPl.includes(normPl) || normPl.includes(entryPl))) ||
      (normEn.length >= 4 && entryEn && (entryEn.includes(normEn) || normEn.includes(entryEn)))
    ) {
      return { structureId: entry.id, coreNamePl, coreNameEn };
    }
  }

  return { coreNamePl, coreNameEn };
}

const tempSegAB = new THREE.Vector3();
const tempSegAP = new THREE.Vector3();
const tempClosest = new THREE.Vector3();
const tempDelta = new THREE.Vector3();

function distPointToSegment(
  p: THREE.Vector3,
  a: THREE.Vector3,
  b: THREE.Vector3,
  closestOut?: THREE.Vector3,
): number {
  tempSegAB.subVectors(b, a);
  const lenSq = tempSegAB.lengthSq();
  if (lenSq < 1e-8) {
    if (closestOut) closestOut.copy(a);
    return p.distanceTo(a);
  }
  tempSegAP.subVectors(p, a);
  const t = THREE.MathUtils.clamp(tempSegAP.dot(tempSegAB) / lenSq, 0, 1);
  const out = closestOut ?? tempClosest;
  out.copy(a).addScaledVector(tempSegAB, t);
  return p.distanceTo(out);
}

interface SubdivideZoneSpec {
  segA: THREE.Vector3;
  segB: THREE.Vector3;
  normal: THREE.Vector3 | null;
  radius: number;
}

/**
 * Performs 2-pass adaptive 1-to-4 midpoint subdivision on triangles near landmark segments
 * whose longest edge exceeds the target threshold, converting the geometry to non-indexed
 * so every triangle has 3 independent vertices (zero Gouraud gradient blur across boundaries).
 */
function prepareCrispNonIndexedGeometry(
  sourceGeom: THREE.BufferGeometry,
  specs: SubdivideZoneSpec[],
): THREE.BufferGeometry {
  let currentGeom = sourceGeom.index ? sourceGeom.toNonIndexed() : sourceGeom.clone();
  if (!currentGeom.getAttribute('normal')) {
    currentGeom.computeVertexNormals();
  }

  // Ensure triangle winding is strictly CCW outward AND normals point strictly OUTWARD using
  // the Divergence Theorem signed volume: left-side mirrored meshes exported from Blender
  // (scale.x = -1) have negative signed volume (inverted CW winding + inward normals), which
  // caused WebGL FrontSide culling to render left bones (e.g. Hip bone.002) inside-out!
  {
    currentGeom.computeBoundingBox();
    const meshCenter = currentGeom.boundingBox
      ? currentGeom.boundingBox.getCenter(new THREE.Vector3())
      : new THREE.Vector3();
    const pos0 = currentGeom.getAttribute('position') as THREE.BufferAttribute;
    const norm0 = currentGeom.getAttribute('normal') as THREE.BufferAttribute;
    let signedVolume6 = 0;
    let normalAlignSum = 0;
    const va = new THREE.Vector3();
    const vb = new THREE.Vector3();
    const vc = new THREE.Vector3();
    const e1 = new THREE.Vector3();
    const e2 = new THREE.Vector3();
    const cross = new THREE.Vector3();
    const nTmp = new THREE.Vector3();

    for (let i = 0; i < pos0.count; i += 3) {
      va.fromBufferAttribute(pos0, i).sub(meshCenter);
      vb.fromBufferAttribute(pos0, i + 1).sub(meshCenter);
      vc.fromBufferAttribute(pos0, i + 2).sub(meshCenter);
      e1.subVectors(vb, va);
      e2.subVectors(vc, va);
      cross.crossVectors(e1, e2);
      signedVolume6 += va.dot(cross);

      nTmp.fromBufferAttribute(norm0, i);
      normalAlignSum += cross.dot(nTmp);
    }

    const pArr = pos0.array as Float32Array;
    const nArr = norm0.array as Float32Array;

    // 1. If signedVolume6 < 0, reverse triangle winding (swap vertex 1 and vertex 2 of each tri)
    //    so Three.js FrontSide renders the exterior face of mirrored left bones cleanly!
    if (signedVolume6 < 0) {
      for (let i = 0; i < pos0.count; i += 3) {
        const idx1 = (i + 1) * 3;
        const idx2 = (i + 2) * 3;
        for (let k = 0; k < 3; k++) {
          const tp = pArr[idx1 + k];
          pArr[idx1 + k] = pArr[idx2 + k];
          pArr[idx2 + k] = tp;

          const tn = nArr[idx1 + k];
          nArr[idx1 + k] = nArr[idx2 + k];
          nArr[idx2 + k] = tn;
        }
      }
      pos0.needsUpdate = true;
      norm0.needsUpdate = true;
    }

    // 2. Ensure vertex normals agree with outward CCW winding
    const windingSign = signedVolume6 >= 0 ? 1 : -1;
    const currentNormSign = normalAlignSum >= 0 ? 1 : -1;
    if (windingSign * currentNormSign < 0) {
      for (let i = 0; i < nArr.length; i++) {
        nArr[i] = -nArr[i];
      }
      norm0.needsUpdate = true;
    }
  }

  const passes = [
    { pad: 0.022, maxEdgeLenSq: 0.0095 * 0.0095, minDot: -0.05 },
    { pad: 0.014, maxEdgeLenSq: 0.0072 * 0.0072, minDot: 0.10 },
  ];

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const na = new THREE.Vector3();
  const nb = new THREE.Vector3();
  const nc = new THREE.Vector3();
  const centroid = new THREE.Vector3();
  const fn = new THREE.Vector3();

  for (let passIdx = 0; passIdx < passes.length; passIdx++) {
    const { pad, maxEdgeLenSq, minDot } = passes[passIdx];
    const posAttr = currentGeom.getAttribute('position') as THREE.BufferAttribute;
    const normAttr = currentGeom.getAttribute('normal') as THREE.BufferAttribute;
    const triCount = Math.floor(posAttr.count / 3);

    const outPos: number[] = [];
    const outNorm: number[] = [];
    let subdividedCount = 0;

    const pushTri = (
      p0: THREE.Vector3,
      p1: THREE.Vector3,
      p2: THREE.Vector3,
      n0: THREE.Vector3,
      n1: THREE.Vector3,
      n2: THREE.Vector3,
    ) => {
      outPos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
      outNorm.push(n0.x, n0.y, n0.z, n1.x, n1.y, n1.z, n2.x, n2.y, n2.z);
    };

    for (let f = 0; f < triCount; f++) {
      const i0 = f * 3;
      const i1 = i0 + 1;
      const i2 = i0 + 2;
      a.fromBufferAttribute(posAttr, i0);
      b.fromBufferAttribute(posAttr, i1);
      c.fromBufferAttribute(posAttr, i2);
      na.fromBufferAttribute(normAttr, i0);
      nb.fromBufferAttribute(normAttr, i1);
      nc.fromBufferAttribute(normAttr, i2);

      centroid.copy(a).add(b).add(c).multiplyScalar(1 / 3);
      const maxEdge = Math.max(
        a.distanceToSquared(b),
        b.distanceToSquared(c),
        c.distanceToSquared(a),
      );

      let nearTarget = false;
      if (maxEdge > maxEdgeLenSq) {
        fn.copy(na).add(nb).add(nc).normalize();
        for (let s = 0; s < specs.length; s++) {
          const sp = specs[s];
          if (sp.normal && fn.dot(sp.normal) < minDot) continue;
          const d = distPointToSegment(centroid, sp.segA, sp.segB);
          if (d <= sp.radius + pad) {
            nearTarget = true;
            break;
          }
        }
      }

      if (nearTarget) {
        subdividedCount++;
        const ab = a.clone().add(b).multiplyScalar(0.5);
        const bc = b.clone().add(c).multiplyScalar(0.5);
        const ca = c.clone().add(a).multiplyScalar(0.5);
        const nab = na.clone().add(nb).normalize();
        const nbc = nb.clone().add(nc).normalize();
        const nca = nc.clone().add(na).normalize();

        pushTri(a, ab, ca, na, nab, nca);
        pushTri(ab, b, bc, nab, nb, nbc);
        pushTri(ca, bc, c, nca, nbc, nc);
        pushTri(ab, bc, ca, nab, nbc, nca);
      } else {
        pushTri(a, b, c, na, nb, nc);
      }
    }

    currentGeom.dispose();
    const nextGeom = new THREE.BufferGeometry();
    nextGeom.setAttribute('position', new THREE.Float32BufferAttribute(outPos, 3));
    nextGeom.setAttribute('normal', new THREE.Float32BufferAttribute(outNorm, 3));
    currentGeom = nextGeom;
    if (subdividedCount === 0) break;
  }

  currentGeom.computeBoundingBox();
  currentGeom.computeBoundingSphere();
  return currentGeom;
}

/**
 * Builds crisp, zero-gradient, strictly single-sided face-colored anatomical surface zones
 * on a bone mesh for all its landmarks (preventing any bleed-through across thin bones).
 */
export function buildBoneSurfaceZones(
  mesh: THREE.Mesh,
  landmarks: BonyLandmarkExtended[],
): BoneZoneMeshData | null {
  const origGeom = mesh.geometry;
  const origPos = origGeom.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!origPos || origPos.count === 0 || landmarks.length === 0) return null;

  const K = landmarks.length;
  const segA: THREE.Vector3[] = landmarks.map(
    (lm) => new THREE.Vector3(lm.position[0], lm.position[1], lm.position[2]),
  );
  const segB: THREE.Vector3[] = landmarks.map((lm, k) =>
    lm.segmentEnd
      ? new THREE.Vector3(lm.segmentEnd[0], lm.segmentEnd[1], lm.segmentEnd[2])
      : segA[k].clone(),
  );
  const segMid: THREE.Vector3[] = landmarks.map((_, k) =>
    segA[k].clone().add(segB[k]).multiplyScalar(0.5),
  );
  const explicitNormals: Array<THREE.Vector3 | null> = landmarks.map((lm) =>
    lm.normal && lm.normal.length === 3
      ? new THREE.Vector3(lm.normal[0], lm.normal[1], lm.normal[2]).normalize()
      : null,
  );
  const minNormalDots: number[] = landmarks.map((lm) => lm.minNormalDot ?? 0.35);

  // Compute initial radii from explicit lm.zoneRadius or neighbor spacing
  const radii: number[] = landmarks.map((lm, k) => {
    if (typeof lm.zoneRadius === 'number' && lm.zoneRadius > 0) {
      return lm.zoneRadius;
    }
    let minNeighborDist = Infinity;
    for (let j = 0; j < K; j++) {
      if (j === k) continue;
      const d = segMid[k].distanceTo(segMid[j]);
      if (d > 1e-4 && d < minNeighborDist) {
        minNeighborDist = d;
      }
    }
    if (!Number.isFinite(minNeighborDist)) {
      return 0.016;
    }
    return THREE.MathUtils.clamp(minNeighborDist * 0.45, 0.010, 0.022);
  });

  const subdivideSpecs: SubdivideZoneSpec[] = landmarks.map((_, k) => ({
    segA: segA[k],
    segB: segB[k],
    normal: explicitNormals[k],
    radius: radii[k],
  }));

  // Convert to non-indexed and run 2-pass adaptive subdivision near landmark segments
  const geom = prepareCrispNonIndexedGeometry(origGeom, subdivideSpecs);
  mesh.geometry = geom;

  const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
  const normAttr = geom.getAttribute('normal') as THREE.BufferAttribute;
  const vertexCount = posAttr.count;
  const faceCount = Math.floor(vertexCount / 3);

  // Precompute triangle centroids and outward unit normals
  const faceCentroids = new Array<THREE.Vector3>(faceCount);
  const faceNormals = new Array<THREE.Vector3>(faceCount);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const na = new THREE.Vector3();
  const nb = new THREE.Vector3();
  const nc = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();

  for (let f = 0; f < faceCount; f++) {
    const i0 = f * 3;
    a.fromBufferAttribute(posAttr, i0);
    b.fromBufferAttribute(posAttr, i0 + 1);
    c.fromBufferAttribute(posAttr, i0 + 2);
    faceCentroids[f] = new THREE.Vector3()
      .copy(a)
      .add(b)
      .add(c)
      .multiplyScalar(1 / 3);

    na.fromBufferAttribute(normAttr, i0);
    nb.fromBufferAttribute(normAttr, i0 + 1);
    nc.fromBufferAttribute(normAttr, i0 + 2);
    const fn = new THREE.Vector3().copy(na).add(nb).add(nc);
    if (fn.lengthSq() < 1e-6) {
      ab.subVectors(b, a);
      ac.subVectors(c, a);
      fn.crossVectors(ab, ac);
    }
    fn.normalize();
    faceNormals[f] = fn;
  }

  // 1. Snap each landmark to its best seed triangle on the correct anatomical face
  const seeds = new Array<THREE.Vector3>(K);
  const seedNormals = new Array<THREE.Vector3>(K);
  const seedFaces = new Int32Array(K);

  for (let k = 0; k < K; k++) {
    const expNorm = explicitNormals[k];
    const reqDot = minNormalDots[k] * 0.7;
    let bestDist = Infinity;
    let bestF = 0;

    for (let f = 0; f < faceCount; f++) {
      if (expNorm && faceNormals[f].dot(expNorm) < reqDot) continue;
      const d = distPointToSegment(faceCentroids[f], segA[k], segB[k]);
      if (d < bestDist) {
        bestDist = d;
        bestF = f;
      }
    }

    // Fallback if no face met reqDot (e.g. synthetic geometry)
    if (!Number.isFinite(bestDist)) {
      for (let f = 0; f < faceCount; f++) {
        if (expNorm && faceNormals[f].dot(expNorm) < 0.0) continue;
        const d = distPointToSegment(faceCentroids[f], segA[k], segB[k]);
        if (d < bestDist) {
          bestDist = d;
          bestF = f;
        }
      }
    }

    seedFaces[k] = bestF;
    seeds[k] = faceCentroids[bestF].clone();
    seedNormals[k] = expNorm ? expNorm.clone() : faceNormals[bestF].clone();
  }

  // 2. Assign each triangle face f strictly to one side of the bone using normal, depth, and segment distance
  const faceZoneIndex = new Int16Array(faceCount);
  faceZoneIndex.fill(-1);
  const zoneFaceCounts = new Int32Array(K);
  const closestPt = new THREE.Vector3();

  for (let f = 0; f < faceCount; f++) {
    const fc = faceCentroids[f];
    const fn = faceNormals[f];
    let bestK = -1;
    let bestScore = Infinity;
    let secondBestScore = Infinity;

    for (let k = 0; k < K; k++) {
      // A. Hard Single-Sided Outward Normal Gate (prevents painting the opposite side of any bone)
      const nDot = fn.dot(seedNormals[k]);
      if (nDot < minNormalDots[k]) continue;

      // B. Distance to anatomical landmark segment [segA, segB]
      const d = distPointToSegment(fc, segA[k], segB[k], closestPt);
      if (d > radii[k]) continue;

      // C. Normal-plane depth thickness gate (blocks bleeding across thin 3-6mm bone blades)
      const signedDepth = tempDelta.subVectors(fc, closestPt).dot(seedNormals[k]);
      const maxBackDepth = -Math.min(radii[k] * 0.45, 0.0065);
      const maxFrontDepth = Math.min(radii[k] * 0.85, 0.015);
      if (signedDepth < maxBackDepth || signedDepth > maxFrontDepth) continue;

      // D. Normalized competition score between adjacent zones on the same bone face
      const score = d / radii[k] - 0.14 * nDot;
      if (score < bestScore) {
        secondBestScore = bestScore;
        bestScore = score;
        bestK = k;
      } else if (score < secondBestScore) {
        secondBestScore = score;
      }
    }

    // E. Guarantee a crisp margin of clean ivory bone between adjacent zones so they never merge
    if (bestK >= 0 && secondBestScore - bestScore >= 0.16) {
      faceZoneIndex[f] = bestK;
      zoneFaceCounts[bestK] += 1;
    }
  }

  // 3. Topological Connected-Component Filter: keep only triangles connected to the primary surface patch
  //    (eliminates stray disconnected triangles on adjacent ridges/folds)
  const quantizeVertex = (v: THREE.Vector3) =>
    `${Math.round(v.x * 2500)},${Math.round(v.y * 2500)},${Math.round(v.z * 2500)}`;

  for (let k = 0; k < K; k++) {
    if (zoneFaceCounts[k] <= 2) continue;
    const zoneFaces: number[] = [];
    for (let f = 0; f < faceCount; f++) {
      if (faceZoneIndex[f] === k) zoneFaces.push(f);
    }

    // Build vertex-to-local-face map for faces in zone k
    const vertToFaces = new Map<string, number[]>();
    for (let idx = 0; idx < zoneFaces.length; idx++) {
      const f = zoneFaces[idx];
      for (let vi = 0; vi < 3; vi++) {
        a.fromBufferAttribute(posAttr, f * 3 + vi);
        const key = quantizeVertex(a);
        let list = vertToFaces.get(key);
        if (!list) {
          list = [];
          vertToFaces.set(key, list);
        }
        list.push(idx);
      }
    }

    // Seed BFS with the triangle(s) closest to [segA[k], segB[k]] on the front surface
    const visited = new Uint8Array(zoneFaces.length);
    const queue: number[] = [];
    let minCoreDist = Infinity;
    let bestLocalIdx = 0;
    const localDists = new Float32Array(zoneFaces.length);

    for (let idx = 0; idx < zoneFaces.length; idx++) {
      const f = zoneFaces[idx];
      const d = distPointToSegment(faceCentroids[f], segA[k], segB[k], closestPt);
      localDists[idx] = d;
      if (d < minCoreDist) {
        minCoreDist = d;
        bestLocalIdx = idx;
      }
    }

    const coreThresh = Math.max(minCoreDist + 0.0045, radii[k] * 0.42);
    for (let idx = 0; idx < zoneFaces.length; idx++) {
      if (
        idx === bestLocalIdx ||
        (localDists[idx] <= coreThresh &&
          faceNormals[zoneFaces[idx]].dot(seedNormals[k]) >= minNormalDots[k] + 0.1)
      ) {
        visited[idx] = 1;
        queue.push(idx);
      }
    }

    while (queue.length > 0) {
      const currIdx = queue.pop()!;
      const currF = zoneFaces[currIdx];
      const currN = faceNormals[currF];

      for (let vi = 0; vi < 3; vi++) {
        a.fromBufferAttribute(posAttr, currF * 3 + vi);
        const neighbors = vertToFaces.get(quantizeVertex(a));
        if (!neighbors) continue;
        for (let n = 0; n < neighbors.length; n++) {
          const nextIdx = neighbors[n];
          if (visited[nextIdx]) continue;
          const nextF = zoneFaces[nextIdx];
          // Do not jump across sharp >75 deg creases
          if (currN.dot(faceNormals[nextF]) < 0.25) continue;
          visited[nextIdx] = 1;
          queue.push(nextIdx);
        }
      }
    }

    let keptCount = 0;
    for (let idx = 0; idx < zoneFaces.length; idx++) {
      if (visited[idx]) {
        keptCount++;
      } else {
        faceZoneIndex[zoneFaces[idx]] = -1;
      }
    }
    zoneFaceCounts[k] = keptCount;
  }

  // 4. Same-Side Minimum Patch Guarantee (strictly preserving the outward normal constraint!)
  const minPatchFaces = 6;
  for (let k = 0; k < K; k++) {
    if (zoneFaceCounts[k] >= minPatchFaces) continue;

    const candidates: Array<{ f: number; dist: number }> = [];
    for (let f = 0; f < faceCount; f++) {
      // NEVER allow opposite-side triangles even in fallback!
      const nDot = faceNormals[f].dot(seedNormals[k]);
      if (nDot < minNormalDots[k] * 0.7) continue;

      const fc = faceCentroids[f];
      const d = distPointToSegment(fc, segA[k], segB[k], closestPt);
      if (faceZoneIndex[f] === -1 || faceZoneIndex[f] === k) {
        candidates.push({ f, dist: d });
      }
    }
    candidates.sort((x, y) => x.dist - y.dist);
    const take = Math.min(minPatchFaces, candidates.length);
    for (let idx = 0; idx < take; idx++) {
      const f = candidates[idx].f;
      if (faceZoneIndex[f] !== k) {
        faceZoneIndex[f] = k;
        zoneFaceCounts[k] += 1;
      }
    }
  }

  // 5. Propagate faceZoneIndex[f] uniformly to all 3 vertices (3f, 3f+1, 3f+2) -> zero gradient blur!
  const vertexZoneIndex = new Int16Array(vertexCount);
  vertexZoneIndex.fill(-1);
  const zoneCentroids: THREE.Vector3[] = seeds.map((s) => s.clone());
  const zoneSum = Array.from({ length: K }, () => new THREE.Vector3());
  const finalFaceCounts = new Int32Array(K);

  for (let f = 0; f < faceCount; f++) {
    const z = faceZoneIndex[f];
    vertexZoneIndex[f * 3] = z;
    vertexZoneIndex[f * 3 + 1] = z;
    vertexZoneIndex[f * 3 + 2] = z;
    if (z >= 0) {
      zoneSum[z].add(faceCentroids[f]);
      finalFaceCounts[z] += 1;
    }
  }
  for (let k = 0; k < K; k++) {
    if (finalFaceCounts[k] > 0) {
      zoneCentroids[k].copy(zoneSum[k]).divideScalar(finalFaceCounts[k]);
    }
  }

  // 6. Attach vertex color BufferAttribute and configure MeshStandardMaterial with vertexColors: true
  const colorArray = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i++) {
    colorArray[i * 3] = tempBaseBone.r;
    colorArray[i * 3 + 1] = tempBaseBone.g;
    colorArray[i * 3 + 2] = tempBaseBone.b;
  }
  const colorAttr = new THREE.BufferAttribute(colorArray, 3);
  geom.setAttribute('color', colorAttr);

  const zoneMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.68,
    metalness: 0.04,
    vertexColors: true,
  });
  mesh.material = zoneMat;

  const zoneData: BoneZoneMeshData = {
    landmarks,
    vertexZoneIndex,
    faceZoneIndex,
    zoneCentroids,
    zoneRadii: radii,
    colorAttr,
  };
  mesh.userData.boneZoneData = zoneData;
  return zoneData;
}

/**
 * Updates vertex colors across all bone meshes with surface zones according to:
 * - current mode ('landmarks' | 'attachments' | 'off')
 * - hovered/selected landmark
 * - bidirectional muscle selection (highlights PP & PK zones where the selected muscle attaches)
 * - whole-bone selection/hover
 */
export function updateAllBoneSurfaceColors(
  interactables: THREE.Mesh[],
  options: {
    mode: BoneSurfaceZoneMode;
    selectedLandmarkId: string | null;
    hoveredLandmarkId: string | null;
    selectedPartId: string | null;
    selectedStructureId: string | null;
    selectedPartNamePl: string | null;
    hoveredPartId: string | null;
    highlightMode: 'neutral' | 'correct' | 'wrong';
  },
): void {
  const {
    mode,
    selectedLandmarkId,
    hoveredLandmarkId,
    selectedPartId,
    selectedStructureId,
    selectedPartNamePl,
    hoveredPartId,
    highlightMode,
  } = options;

  for (const mesh of interactables) {
    const zoneData = mesh.userData.boneZoneData as BoneZoneMeshData | undefined;
    if (!zoneData) continue;

    const { landmarks, vertexZoneIndex, colorAttr } = zoneData;
    const K = landmarks.length;
    const isBoneSelected =
      !selectedLandmarkId &&
      Boolean(
        selectedPartId &&
          (mesh.userData.id === selectedPartId ||
            (mesh.userData.structureId && mesh.userData.structureId === selectedPartId)),
      );
    const isBoneHovered =
      !hoveredLandmarkId && !isBoneSelected && Boolean(hoveredPartId && mesh.userData.id === hoveredPartId);

    const baseBoneColor = tempBaseBone.clone();
    if (isBoneSelected) {
      baseBoneColor.lerp(
        new THREE.Color(highlightMode === 'wrong' ? WRONG_ZONE_HEX : SELECTED_ZONE_HEX),
        0.55,
      );
    } else if (isBoneHovered) {
      baseBoneColor.lerp(new THREE.Color(HOVER_ZONE_HEX), 0.38);
    }

    const zoneRgb: Array<[number, number, number]> = new Array(K);
    for (let k = 0; k < K; k++) {
      const lm = landmarks[k];
      const isThisLandmarkSelected =
        selectedLandmarkId === lm.id ||
        Boolean(
          selectedPartId &&
            (selectedPartId === lm.id ||
              (lm.structureId && selectedPartId === lm.structureId) ||
              (lm.structureId && selectedStructureId === lm.structureId)),
        );
      const isThisLandmarkHovered = !isThisLandmarkSelected && hoveredLandmarkId === lm.id;
      const muscleAttachRole = !isThisLandmarkSelected
        ? getLandmarkAttachmentRoleForMuscle(lm, selectedStructureId, selectedPartNamePl)
        : null;

      if (isThisLandmarkSelected) {
        tempColor.setHex(highlightMode === 'wrong' ? WRONG_ZONE_HEX : SELECTED_ZONE_HEX);
      } else if (isThisLandmarkHovered) {
        tempColor.setHex(HOVER_ZONE_HEX);
      } else if (muscleAttachRole) {
        // Bidirectional muscle -> bone PP (Red) / PK (Green) highlight with per-muscle role accuracy
        tempColor.setHex(
          muscleAttachRole === 'pp' ? 0xef4444 : muscleAttachRole === 'pk' ? 0x10b981 : 0xf59e0b,
        );
      } else if (mode === 'off') {
        tempColor.copy(baseBoneColor);
      } else if (mode === 'attachments') {
        // Mode 2 ("Przyczepy PP/PK"): paint ONLY actual muscle origins (PP) and insertions (PK),
        // leaving pure articular/osteological landmarks in natural ivory bone color
        if (lm.type === 'pp') {
          tempColor.setHex(NETTER_PP_HEX).lerp(baseBoneColor, 0.06);
        } else if (lm.type === 'pk') {
          tempColor.setHex(NETTER_PK_HEX).lerp(baseBoneColor, 0.06);
        } else {
          tempColor.copy(baseBoneColor);
        }
      } else {
        // Mode 1: 'landmarks' ("Struktury kostne")
        const paletteHex = LANDMARK_ZONE_PALETTE[k % LANDMARK_ZONE_PALETTE.length];
        tempColor.setHex(paletteHex).lerp(baseBoneColor, 0.08);
      }

      zoneRgb[k] = [tempColor.r, tempColor.g, tempColor.b];
    }

    const arr = colorAttr.array as Float32Array;
    const count = vertexZoneIndex.length;
    for (let i = 0; i < count; i++) {
      const z = vertexZoneIndex[i];
      if (z >= 0) {
        const rgb = zoneRgb[z];
        arr[i * 3] = rgb[0];
        arr[i * 3 + 1] = rgb[1];
        arr[i * 3 + 2] = rgb[2];
      } else {
        arr[i * 3] = baseBoneColor.r;
        arr[i * 3 + 1] = baseBoneColor.g;
        arr[i * 3 + 2] = baseBoneColor.b;
      }
    }
    colorAttr.needsUpdate = true;

    if (mesh.material instanceof THREE.MeshStandardMaterial) {
      if (isBoneSelected) {
        mesh.material.emissive.setHex(highlightMode === 'wrong' ? 0x991b1b : 0x065f46);
        mesh.material.emissiveIntensity = 0.25;
      } else if (isBoneHovered) {
        mesh.material.emissive.setHex(0x92400e);
        mesh.material.emissiveIntensity = 0.18;
      } else {
        mesh.material.emissive.setHex(0x000000);
        mesh.material.emissiveIntensity = 0.0;
      }
    }
  }
}

/**
 * Triangle-level raycast detector: determines which face-colored bone surface zone
 * was hit by a Three.js raycast intersection.
 */
export function detectHitBoneSurfaceZone(
  hit: THREE.Intersection,
  mode: BoneSurfaceZoneMode,
): BonyLandmarkExtended | null {
  if (mode === 'off') return null;
  const mesh = hit.object;
  if (!(mesh instanceof THREE.Mesh)) return null;
  const zoneData = mesh.userData.boneZoneData as BoneZoneMeshData | undefined;
  if (!zoneData) return null;

  const { landmarks, vertexZoneIndex, faceZoneIndex, zoneCentroids, zoneRadii } = zoneData;
  const isZoneActiveInMode = (lm: BonyLandmarkExtended) =>
    mode === 'landmarks' || (mode === 'attachments' && (lm.type === 'pp' || lm.type === 'pk'));

  if (typeof hit.faceIndex === 'number' && hit.faceIndex >= 0 && hit.faceIndex < faceZoneIndex.length) {
    const fz = faceZoneIndex[hit.faceIndex];
    if (fz >= 0 && isZoneActiveInMode(landmarks[fz])) return landmarks[fz];
  }

  if (hit.face) {
    const za = vertexZoneIndex[hit.face.a] ?? -1;
    if (za >= 0 && isZoneActiveInMode(landmarks[za])) return landmarks[za];
  }

  const localPt = mesh.worldToLocal(hit.point.clone());
  let bestK = -1;
  let bestDist = Infinity;
  for (let k = 0; k < landmarks.length; k++) {
    if (!isZoneActiveInMode(landmarks[k])) continue;
    const d = localPt.distanceTo(zoneCentroids[k]);
    if (d <= zoneRadii[k] * 1.15 && d < bestDist) {
      bestDist = d;
      bestK = k;
    }
  }

  return bestK >= 0 ? landmarks[bestK] : null;
}

/**
 * Finds a bone mesh and zone centroid in world coordinates for focusing the camera
 * onto a specific bony landmark zone.
 */
export function getBoneZoneWorldPosition(
  interactables: THREE.Mesh[],
  landmarkIdOrStructureId: string,
): { mesh: THREE.Mesh; landmark: BonyLandmarkExtended; worldPos: THREE.Vector3 } | null {
  for (const mesh of interactables) {
    const zoneData = mesh.userData.boneZoneData as BoneZoneMeshData | undefined;
    if (!zoneData) continue;
    const idx = zoneData.landmarks.findIndex(
      (lm) => lm.id === landmarkIdOrStructureId || lm.structureId === landmarkIdOrStructureId,
    );
    if (idx >= 0) {
      mesh.updateWorldMatrix(true, false);
      const worldPos = zoneData.zoneCentroids[idx].clone().applyMatrix4(mesh.matrixWorld);
      return {
        mesh,
        landmark: zoneData.landmarks[idx],
        worldPos,
      };
    }
  }
  return null;
}
