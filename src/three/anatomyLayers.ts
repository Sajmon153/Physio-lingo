import * as THREE from 'three';
import {
  AnatomicalLayerId,
  MuscleGroupingMode,
  StructureCategory,
} from '../types/anatomy';

export type OverlayGlbLayerKey =
  | 'ligaments'
  | 'arteries'
  | 'veins'
  | 'nerves'
  | 'organs'
  | 'skin';

export interface LayerMeta {
  id: AnatomicalLayerId;
  labelPl: string;
  labelLt: string;
  shortPl: string;
  swatchHex: string;
  overlayKey?: OverlayGlbLayerKey;
}

/**
 * 12-tissue Atlas Pro color system: every single anatomical structure family has
 * an unmistakable, non-colliding color & PBR finish.
 */
export const ANATOMY_LAYERS_META: LayerMeta[] = [
  { id: 'bone', labelPl: 'Kości', labelLt: 'Ossa', shortPl: 'Kości', swatchHex: '#e8dcc4' },
  { id: 'cartilage', labelPl: 'Chrząstki i łąkotki', labelLt: 'Cartilagines et menisci', shortPl: 'Chrząstki', swatchHex: '#74e3c4' },
  { id: 'muscle', labelPl: 'Brzuśce mięśniowe', labelLt: 'Ventres musculorum', shortPl: 'Mięśnie', swatchHex: '#b82e2a' },
  { id: 'tendon', labelPl: 'Ścięgna i rozcięgna', labelLt: 'Tendines et aponeuroses', shortPl: 'Ścięgna', swatchHex: '#f6f3e8' },
  { id: 'sheath', labelPl: 'Pochewki i troczki', labelLt: 'Vaginae et retinacula', shortPl: 'Pochewki', swatchHex: '#4fc3d9' },
  { id: 'ligament', labelPl: 'Więzadła i torebki', labelLt: 'Ligamenta et capsulae', shortPl: 'Więzadła', swatchHex: '#d4af5a', overlayKey: 'ligaments' },
  { id: 'bursa', labelPl: 'Kaletki maziowe', labelLt: 'Bursae synoviales', shortPl: 'Kaletki', swatchHex: '#b794f4' },
  { id: 'artery', labelPl: 'Tętnice', labelLt: 'Arteriae', shortPl: 'Tętnice', swatchHex: '#e11d48', overlayKey: 'arteries' },
  { id: 'vein', labelPl: 'Żyły i zatoki', labelLt: 'Venae et sinus', shortPl: 'Żyły', swatchHex: '#2563eb', overlayKey: 'veins' },
  { id: 'nerve', labelPl: 'Nerwy i OUN', labelLt: 'Nervi et SNC', shortPl: 'Nerwy', swatchHex: '#facc15', overlayKey: 'nerves' },
  { id: 'organ', labelPl: 'Narządy wewnętrzne', labelLt: 'Viscera', shortPl: 'Narządy', swatchHex: '#c95d52', overlayKey: 'organs' },
  { id: 'skin', labelPl: 'Powłoki skórne', labelLt: 'Integumentum commune', shortPl: 'Skóra', swatchHex: '#e8be9e', overlayKey: 'skin' },
];

export const OVERLAY_KEY_TO_LAYER_ID: Record<OverlayGlbLayerKey, AnatomicalLayerId> = {
  ligaments: 'ligament',
  arteries: 'artery',
  veins: 'vein',
  nerves: 'nerve',
  organs: 'organ',
  skin: 'skin',
};

export function createDefaultLayerVisibility(includeExtendedSystems = true): Record<AnatomicalLayerId, boolean> {
  return {
    bone: true,
    cartilage: true,
    muscle: true,
    tendon: true,
    sheath: true,
    ligament: includeExtendedSystems,
    bursa: true,
    artery: includeExtendedSystems,
    vein: includeExtendedSystems,
    nerve: includeExtendedSystems,
    organ: includeExtendedSystems,
    skin: false, // Skin always starts hidden so internal structures are visible immediately
  };
}

export interface LayersManifestEntry {
  url: string;
  meshes: number;
  bytes: number;
}

export interface LayersManifest {
  version: number;
  source: string;
  layers: OverlayGlbLayerKey[];
  regions: Record<string, Partial<Record<OverlayGlbLayerKey, LayersManifestEntry>>>;
}

let cachedManifestPromise: Promise<LayersManifest | null> | null = null;

export function loadLayersManifest(): Promise<LayersManifest | null> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') {
    return Promise.resolve(null);
  }
  if (!cachedManifestPromise) {
    cachedManifestPromise = fetch('/models/layers/manifest.json')
      .then((res) => (res.ok ? (res.json() as Promise<LayersManifest>) : null))
      .catch(() => null);
  }
  return cachedManifestPromise;
}

export interface UnifiedMuscleGroupRule {
  groupId: string;
  structureId?: string;
  namePl: string;
  nameLt: string;
  nameEn: string;
  pattern: RegExp;
  exclude?: RegExp;
}

/**
 * All major multi-head / multi-part skeletal muscles unified per side in 'whole' mode.
 * NOTE: Quadriceps femoris is intentionally kept as 4 separate muscles (rectus femoris + 3 vasti)
 * in 'parts' mode because physiotherapy students evaluate & palpate each head separately.
 */
export const UNIFIED_MULTI_HEAD_MUSCLES: UnifiedMuscleGroupRule[] = [
  {
    groupId: 'm_deltoideus',
    structureId: 'm_deltoideus',
    namePl: 'Mięsień naramienny',
    nameLt: 'Musculus deltoideus',
    nameEn: 'Deltoid muscle',
    pattern: /\bdeltoid(eus)?\b/i,
    exclude: /\b(bursa|ligament|region)\b/i,
  },
  {
    groupId: 'm_trapezius',
    structureId: 'm_trapezius',
    namePl: 'Mięsień czworoboczny',
    nameLt: 'Musculus trapezius',
    nameEn: 'Trapezius muscle',
    pattern: /\btrapezius\b/i,
    exclude: /\b(bursa|ligament|region)\b/i,
  },
  {
    groupId: 'm_pectoralis_major',
    structureId: 'm_pectoralis_major',
    namePl: 'Mięsień piersiowy większy',
    nameLt: 'Musculus pectoralis major',
    nameEn: 'Pectoralis major muscle',
    pattern: /\bpectoralis\s+major\b/i,
  },
  {
    groupId: 'm_biceps_brachii',
    structureId: 'm_biceps_brachii',
    namePl: 'Mięsień dwugłowy ramienia',
    nameLt: 'Musculus biceps brachii',
    nameEn: 'Biceps brachii muscle',
    pattern: /\bbiceps\s+brachii\b/i,
    exclude: /\b(bursa|sheath|tendon|aponeurosis)\b/i,
  },
  {
    groupId: 'm_triceps_brachii',
    structureId: 'm_triceps_brachii',
    namePl: 'Mięsień trójgłowy ramienia',
    nameLt: 'Musculus triceps brachii',
    nameEn: 'Triceps brachii muscle',
    pattern: /\btriceps\s+brachii\b/i,
    exclude: /\b(bursa|sheath|tendon)\b/i,
  },
  {
    groupId: 'm_biceps_femoris',
    structureId: 'm_biceps_femoris',
    namePl: 'Mięsień dwugłowy uda',
    nameLt: 'Musculus biceps femoris',
    nameEn: 'Biceps femoris muscle',
    pattern: /\bbiceps\s+femoris\b/i,
    exclude: /\b(bursa|sheath|tendon)\b/i,
  },
  {
    groupId: 'm_gastrocnemius',
    structureId: 'm_gastrocnemius',
    namePl: 'Mięsień brzuchaty łydki',
    nameLt: 'Musculus gastrocnemius',
    nameEn: 'Gastrocnemius muscle',
    pattern: /\bgastrocnemius\b/i,
    exclude: /\b(bursa|sheath|tendon)\b/i,
  },
  {
    groupId: 'm_masseter',
    structureId: 'm_masseter',
    namePl: 'Mięsień żwacz',
    nameLt: 'Musculus masseter',
    nameEn: 'Masseter muscle',
    pattern: /\bmasseter\b/i,
  },
  {
    groupId: 'm_digastricus',
    namePl: 'Mięsień dwubrzuścowy',
    nameLt: 'Musculus digastricus',
    nameEn: 'Digastric muscle',
    pattern: /\bdigastric\b/i,
    exclude: /\bintermediate\s+tendon\b/i,
  },
  {
    groupId: 'm_pronator_teres',
    structureId: 'm_pronator_teres',
    namePl: 'Mięsień nawrotny obły',
    nameLt: 'Musculus pronator teres',
    nameEn: 'Pronator teres muscle',
    pattern: /\bpronator\s+teres\b/i,
  },
  {
    groupId: 'm_flexor_digitorum_superficialis',
    structureId: 'm_flexor_digitorum_superficialis',
    namePl: 'Mięsień zginacz powierzchowny palców',
    nameLt: 'Musculus flexor digitorum superficialis',
    nameEn: 'Flexor digitorum superficialis',
    pattern: /\bflexor\s+digitorum\s+superficialis\b/i,
  },
  {
    groupId: 'm_flexor_carpi_ulnaris',
    structureId: 'm_flexor_carpi_ulnaris',
    namePl: 'Mięsień zginacz łokciowy nadgarstka',
    nameLt: 'Musculus flexor carpi ulnaris',
    nameEn: 'Flexor carpi ulnaris muscle',
    pattern: /\bflexor\s+carpi\s+ulnaris\b/i,
  },
  {
    groupId: 'm_extensor_carpi_ulnaris',
    structureId: 'm_extensor_carpi_ulnaris',
    namePl: 'Mięsień prostownik łokciowy nadgarstka',
    nameLt: 'Musculus extensor carpi ulnaris',
    nameEn: 'Extensor carpi ulnaris muscle',
    pattern: /\bextensor\s+carpi\s+ulnaris\b/i,
    exclude: /\bsheath\b/i,
  },
  {
    groupId: 'm_flexor_pollicis_brevis',
    namePl: 'Mięsień zginacz krótki kciuka',
    nameLt: 'Musculus flexor pollicis brevis',
    nameEn: 'Flexor pollicis brevis',
    pattern: /\bflexor\s+pollicis\s+brevis\b/i,
  },
  {
    groupId: 'm_flexor_hallucis_brevis',
    namePl: 'Mięsień zginacz krótki palucha',
    nameLt: 'Musculus flexor hallucis brevis',
    nameEn: 'Flexor hallucis brevis',
    pattern: /\bflexor\s+hallucis\s+brevis\b/i,
  },
  {
    groupId: 'm_adductor_pollicis',
    namePl: 'Mięsień przywodziciel kciuka',
    nameLt: 'Musculus adductor pollicis',
    nameEn: 'Adductor pollicis',
    pattern: /\badductor\s+pollicis\b/i,
  },
  {
    groupId: 'm_adductor_hallucis',
    namePl: 'Mięsień przywodziciel palucha',
    nameLt: 'Musculus adductor hallucis',
    nameEn: 'Adductor hallucis',
    pattern: /\badductor\s+hallucis\b/i,
  },
  {
    groupId: 'm_pterygoideus_lateralis',
    namePl: 'Mięsień skrzydłowy boczny',
    nameLt: 'Musculus pterygoideus lateralis',
    nameEn: 'Lateral pterygoid muscle',
    pattern: /\blateral\s+pterygoid\b/i,
  },
];

function normalizeRawMeshTitle(rawTitle: string): string {
  return rawTitle
    .replace(/[_]+/g, ' ')
    .replace(/\.(r|l)(?:\.\d+)?$/i, '')
    .replace(/\.?\d{3}$/, '')
    .replace(/^\((.*)\)$/, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchUnifiedMuscleRule(
  rawTitle: string,
  structureId: string | undefined,
  layerId: AnatomicalLayerId,
): UnifiedMuscleGroupRule | null {
  if (layerId !== 'muscle') return null;
  const normalized = normalizeRawMeshTitle(rawTitle);
  for (const rule of UNIFIED_MULTI_HEAD_MUSCLES) {
    if (rule.exclude && rule.exclude.test(normalized)) continue;
    if ((rule.structureId && structureId === rule.structureId) || rule.pattern.test(normalized)) {
      return rule;
    }
  }
  return null;
}

/**
 * Resolves unified structure group keys for multi-head / multi-part muscles per side.
 * Returns null in 'parts' mode so each head/akton can be inspected independently.
 */
export function getUnifiedMeshGroupKey(
  rawTitle: string,
  structureId: string | undefined,
  layerId: AnatomicalLayerId,
  anatomicalX: number,
  groupingMode: MuscleGroupingMode = 'whole',
): string | null {
  if (groupingMode === 'parts') return null;
  const rule = matchUnifiedMuscleRule(rawTitle, structureId, layerId);
  if (!rule) return null;
  const side = anatomicalX > 0.002 ? 'left' : 'right';
  return `unified_${rule.groupId}_${side}`;
}

/**
 * Extracts a concise Polish subpart/head label when viewing multi-head muscles in 'parts' mode.
 */
export function formatMuscleSubpartPolish(rawTitle: string): string | null {
  const low = normalizeRawMeshTitle(rawTitle).toLowerCase();
  if (/\bacromial\s+part\b/.test(low)) return 'część barkowa';
  if (/\bclavicular\s+(part|head)\b/.test(low)) return 'część obojczykowa';
  if (/\bscapular\s+spinal\s+part\b/.test(low)) return 'część grzebieniowa';
  // Note: Z-Anatomy's Ascending/Descending trapezius node names are inverted in Y on torso.glb;
  // check raw title words accurately:
  if (/\bdescending\s+part\b/.test(low)) return 'część zstępująca (górna)';
  if (/\btransverse\s+part\b/.test(low)) return 'część poprzeczna (środkowa)';
  if (/\bascending\s+part\b/.test(low)) return 'część wstępująca (dolna)';
  if (/\bsternocostal\s+head\b/.test(low)) return 'część mostkowo-żebrowa';
  if (/\babdominal\s+part\b/.test(low)) return 'część brzuszna';
  if (/\blong\s+head\b/.test(low)) return 'głowa długa';
  if (/\bshort\s+head\b/.test(low)) return 'głowa krótka';
  if (/\blateral\s+head\b/.test(low)) return 'głowa boczna';
  if (/\bmedial\s+head\b/.test(low)) return 'głowa przyśrodkowa';
  if (/\bhumero-?ulnar\s+head\b/.test(low)) return 'głowa ramienno-łokciowa';
  if (/\bhumeral\s+head\b/.test(low)) return 'głowa ramienna';
  if (/\bulnar\s+head\b/.test(low)) return 'głowa łokciowa';
  if (/\bradial\s+head\b/.test(low)) return 'głowa promieniowa';
  if (/\bdeep\s+(head|part)\b/.test(low)) return 'część głęboka';
  if (/\bsuperficial\s+(head|part)\b/.test(low)) return 'część powierzchowna';
  if (/\banterior\s+belly\b/.test(low)) return 'brzusiec przedni';
  if (/\bposterior\s+belly\b/.test(low)) return 'brzusiec tylny';
  if (/\boblique\s+head\b/.test(low)) return 'głowa skośna';
  if (/\btransverse\s+head\b/.test(low)) return 'głowa poprzeczna';
  if (/\bsuperior\s+head\b/.test(low)) return 'głowa górna';
  if (/\binferior\s+head\b/.test(low)) return 'głowa dolna';
  if (/\brectus\s+femoris\b/.test(low)) return 'głowa prosta (m. prosty uda)';
  if (/\bvastus\s+lateralis\b/.test(low)) return 'głowa boczna (m. obszerny boczny)';
  if (/\bvastus\s+medialis\b/.test(low)) return 'głowa przyśrodkowa (m. obszerny przyśrodkowy)';
  if (/\bvastus\s+intermedius\b/.test(low)) return 'głowa pośrednia (m. obszerny pośredni)';
  return null;
}

/**
 * Extracts Terminologia Anatomica Latin subpart/head label for 'parts' mode.
 */
export function formatMuscleSubpartLatin(rawTitle: string): string | null {
  const low = normalizeRawMeshTitle(rawTitle).toLowerCase();
  if (/\bacromial\s+part\b/.test(low)) return 'pars acromialis';
  if (/\bclavicular\s+part\b/.test(low)) return 'pars clavicularis';
  if (/\bclavicular\s+head\b/.test(low)) return 'pars clavicularis';
  if (/\bscapular\s+spinal\s+part\b/.test(low)) return 'pars spinalis';
  if (/\bdescending\s+part\b/.test(low)) return 'pars descendens';
  if (/\btransverse\s+part\b/.test(low)) return 'pars transversa';
  if (/\bascending\s+part\b/.test(low)) return 'pars ascendens';
  if (/\bsternocostal\s+head\b/.test(low)) return 'pars sternocostalis';
  if (/\babdominal\s+part\b/.test(low)) return 'pars abdominalis';
  if (/\blong\s+head\b/.test(low)) return 'caput longum';
  if (/\bshort\s+head\b/.test(low)) return 'caput breve';
  if (/\blateral\s+head\b/.test(low)) return 'caput laterale';
  if (/\bmedial\s+head\b/.test(low)) return 'caput mediale';
  if (/\bhumero-?ulnar\s+head\b/.test(low)) return 'caput humeroulnare';
  if (/\bhumeral\s+head\b/.test(low)) return 'caput humerale';
  if (/\bulnar\s+head\b/.test(low)) return 'caput ulnare';
  if (/\bradial\s+head\b/.test(low)) return 'caput radiale';
  if (/\bdeep\s+(head|part)\b/.test(low)) return 'pars profunda';
  if (/\bsuperficial\s+(head|part)\b/.test(low)) return 'pars superficialis';
  if (/\banterior\s+belly\b/.test(low)) return 'venter anterior';
  if (/\bposterior\s+belly\b/.test(low)) return 'venter posterior';
  if (/\boblique\s+head\b/.test(low)) return 'caput obliquum';
  if (/\btransverse\s+head\b/.test(low)) return 'caput transversum';
  if (/\bsuperior\s+head\b/.test(low)) return 'caput superius';
  if (/\binferior\s+head\b/.test(low)) return 'caput inferius';
  if (/\brectus\s+femoris\b/.test(low)) return 'musculus rectus femoris';
  if (/\bvastus\s+lateralis\b/.test(low)) return 'musculus vastus lateralis';
  if (/\bvastus\s+medialis\b/.test(low)) return 'musculus vastus medialis';
  if (/\bvastus\s+intermedius\b/.test(low)) return 'musculus vastus intermedius';
  return null;
}

/**
 * Deterministic sub-part color variant index (0..3) so adjacent heads/aktony in 'Głowy / aktony'
 * mode are visually distinguishable while staying within natural striated muscle crimson tones.
 */
export function getMuscleSubpartVariantIndex(rawTitle: string): number {
  const low = normalizeRawMeshTitle(rawTitle).toLowerCase();
  if (/\b(clavicular|long\s+head|descending|rectus\s+femoris|anterior\s+belly|superficial|humeral\s+head|oblique\s+head|superior\s+head)\b/.test(low)) {
    return 1;
  }
  if (/\b(acromial|short\s+head|transverse|vastus\s+lateralis|lateral\s+head|ulnar\s+head|humero-?ulnar)\b/.test(low)) {
    return 2;
  }
  if (/\b(spinal|ascending|abdominal\s+part|medial\s+head|vastus\s+medialis|posterior\s+belly|deep|radial\s+head|inferior\s+head)\b/.test(low)) {
    return 3;
  }
  if (/\b(sternocostal|vastus\s+intermedius)\b/.test(low)) {
    return 0;
  }
  return 0;
}

/**
 * Classifies a mesh from the base body.glb / regional GLB or overlay GLB into one of the 12
 * fine-grained AnatomicalLayerIds, guarding against bony landmark name collisions (e.g. "Groove for tendon...").
 */
export function classifyBaseGlbMeshLayer(
  rawTitle: string,
  rawType: string,
  matName: string,
  isCartilage: boolean,
  translatedCategory?: StructureCategory,
): AnatomicalLayerId {
  const clean = normalizeRawMeshTitle(rawTitle);

  // Guard 0: Bony grooves/sulci/tubercles/surfaces/facets/lips are ALWAYS bone even if named "Groove for tendon..."
  if (
    rawType === 'bone' ||
    matName === 'mat_bone_pro' ||
    /\b(groove\s+for|grooves\s+for|sulcus|tubercle\s+of|tuberosity|articular\s+facet|facet\s+for|surface\s+of|linea\s+a[sp]pera|process\s+of\s+calcane)\b/i.test(
      clean,
    )
  ) {
    if (!isCartilage) return 'bone';
  }

  if (
    isCartilage ||
    /\b(cartilages?|meniscus|labrum|articular\s+disc|intervertebral\s+disc|discus|pubic\s+symphysis)\b/i.test(
      clean,
    )
  ) {
    return 'cartilage';
  }

  if (/\bbursae?\b/i.test(clean) || translatedCategory === 'bursa') {
    return 'bursa';
  }

  if (/\b(sheaths?|retinaculum|retinacula)\b/i.test(clean)) {
    return 'sheath';
  }

  if (
    /\b(tendon|tendons|aponeurosis|fascia|tract|linea\s+alba|trochlea\s+of\s+superior\s+oblique|common\s+tendinous\s+ring)\b/i.test(
      clean,
    ) ||
    translatedCategory === 'tendon'
  ) {
    return 'tendon';
  }

  if (
    /\b(ligaments?|ligamenta|capsule|interosseous\s+membrane|obturator\s+membrane|quadrangular\s+membrane|oblique\s+cord|fat\s+pad)\b/i.test(
      clean,
    ) ||
    translatedCategory === 'ligament'
  ) {
    return 'ligament';
  }

  if (translatedCategory === 'artery') return 'artery';
  if (translatedCategory === 'vein') return 'vein';
  if (translatedCategory === 'nerve') return 'nerve';
  if (translatedCategory === 'organ') return 'organ';
  if (translatedCategory === 'skin') return 'skin';

  if (
    rawType === 'muscle' ||
    matName.includes('muscle') ||
    matName === 'mat_muscle_pro' ||
    /\bmuscle\b/i.test(clean) ||
    translatedCategory === 'muscle'
  ) {
    return 'muscle';
  }
  return 'bone';
}

/**
 * Maps fine-grained AnatomicalLayerId to legacy 3-way tissueType ('muscle' | 'bone' | 'other')
 * for backward compatibility with existing filters, highlights, and tests.
 */
export function layerIdToLegacyTissueType(layerId: AnatomicalLayerId): 'muscle' | 'bone' | 'other' {
  if (layerId === 'muscle') return 'muscle';
  if (layerId === 'bone') return 'bone';
  return 'other';
}

function getOrganColorHex(rawTitle: string, origMaterial?: string): number {
  const hay = `${rawTitle} ${origMaterial || ''}`.toLowerCase();
  if (/\b(valve|leaflet)\b/.test(hay)) return 0xf1ece4;
  if (/\b(atrium|ventricle|papillary|heart|myocard|auricle)\b/.test(hay)) return 0xb8292f;
  if (/\b(lung|pleura)\b/.test(hay)) return 0xde9196;
  if (/\b(trachea|bronch|carina)\b/.test(hay)) return 0xc7dce8;
  if (/\bliver\b/.test(hay)) return 0x7d3026;
  if (/\b(gallbladder|cystic|bile|biliary)\b/.test(hay)) return 0x5f8540;
  if (/\bspleen\b/.test(hay)) return 0x6b2740;
  if (/\b(stomach|o?esophagus|pylorus|cardiac\s+part)\b/.test(hay)) return 0xd68978;
  if (/\b(duodenum|jejunum|ileum|colon|cecum|caecum|rectum|appendix|taenia|intestin)\b/.test(hay)) return 0xd8a38c;
  if (/\b(kidney|ureter|renal)\b/.test(hay)) return 0x8c3a32;
  if (/\b(pancreas|thyroid|parathyroid|gland|thymus|parotid|submandibular|sublingual|tonsil|suprarenal|adrenal)\b/.test(hay)) {
    return 0xdba866;
  }
  if (/\b(bladder|urethra|prostate|uterus|ovary|seminal|corpus\s+cavernosum|corpus\s+spongiosum)\b/.test(hay)) return 0xd48e76;
  if (/\b(peritoneum|omentum|mesentery)\b/.test(hay)) return 0xe4c78a;
  return 0xc46055;
}

/**
 * Creates a distinct, non-colliding Atlas Pro PBR material for every anatomical tissue layer:
 * - Bone: warm matte ivory-beige (#e8dcc4, roughness 0.72)
 * - Cartilage / menisci / labra / discs: pearly cyan-mint (#74e3c4, MeshPhysicalMaterial with transmission)
 * - Muscle: vertex-colored striated crimson belly (#b82e2a) -> pearly tendinous ends (#f6f3e8)
 * - Tendon & aponeuroses: glistening collagenous satin pearl-white (#f6f3e8)
 * - Tendon sheaths & retinacula: semi-transparent icy turquoise (#4fc3d9)
 * - Ligaments & capsules: warm fibrous golden-ochre (#d4af5a) & bronze-taupe capsules (#a98b68)
 * - Bursae: semi-transparent synovial amethyst-lavender (#b794f4)
 * - Arteries: vivid arterial crimson (#e11d48 / #dc2626)
 * - Veins: deep venous cobalt-blue (#2563eb)
 * - Nerves & CNS: vivid golden-yellow (#facc15) & rose-beige brain cortex (#e4c7b7)
 * - Organs: anatomically differentiated visceral tones
 * - Skin: translucent natural skin (#e8be9e)
 */
export function createMaterialForLayer(
  layerId: AnatomicalLayerId,
  rawTitle: string,
  origMaterial?: string,
  skinOpacity = 0.3,
): THREE.Material | null {
  const low = `${rawTitle} ${origMaterial || ''}`.toLowerCase();

  switch (layerId) {
    case 'bone':
      return new THREE.MeshStandardMaterial({
        color: /\b(tooth|incisor|canine|premolar|molar)\b/.test(low) ? 0xf6f3ea : 0xe8dcc4,
        roughness: /\b(tooth|incisor|canine|premolar|molar)\b/.test(low) ? 0.32 : 0.72,
        metalness: 0.03,
        side: THREE.DoubleSide,
      });

    case 'cartilage':
      return new THREE.MeshPhysicalMaterial({
        color: 0x74e3c4,
        roughness: 0.22,
        metalness: 0.0,
        transmission: 0.28,
        clearcoat: 0.7,
        clearcoatRoughness: 0.18,
        reflectivity: 0.65,
        side: THREE.DoubleSide,
      });

    case 'tendon':
      return new THREE.MeshPhysicalMaterial({
        color: 0xf6f3e8,
        roughness: 0.26,
        metalness: 0.04,
        clearcoat: 0.55,
        clearcoatRoughness: 0.22,
        side: THREE.DoubleSide,
      });

    case 'sheath':
      return new THREE.MeshPhysicalMaterial({
        color: 0x4fc3d9,
        roughness: 0.2,
        metalness: 0.02,
        clearcoat: 0.65,
        clearcoatRoughness: 0.16,
        transparent: true,
        opacity: 0.68,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

    case 'bursa':
      return new THREE.MeshPhysicalMaterial({
        color: 0xb794f4,
        roughness: 0.18,
        metalness: 0.0,
        clearcoat: 0.75,
        clearcoatRoughness: 0.15,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

    case 'ligament': {
      // Menisci, labra, articular & intervertebral discs use pearly cartilage appearance
      if (/\b(disc|meniscus|labrum|cartilage|symphysis)\b/.test(low)) {
        return new THREE.MeshPhysicalMaterial({
          color: 0x74e3c4,
          roughness: 0.22,
          metalness: 0.0,
          transmission: 0.28,
          clearcoat: 0.7,
          clearcoatRoughness: 0.18,
          side: THREE.DoubleSide,
        });
      }
      // Ligamenta flava: elastic bright yellow-gold
      if (/\bflav(um|a)\b/.test(low)) {
        return new THREE.MeshStandardMaterial({
          color: 0xeed268,
          roughness: 0.36,
          metalness: 0.04,
          side: THREE.DoubleSide,
        });
      }
      // Infrapatellar / articular fat pads: warm adipose amber
      if (/\bfat\s+pad\b/.test(low)) {
        return new THREE.MeshStandardMaterial({
          color: 0xf2ca6b,
          roughness: 0.48,
          metalness: 0.02,
          side: THREE.DoubleSide,
        });
      }
      // Joint capsules & interosseous/obturator membranes: warm bronze-taupe, subtly translucent so ligaments stand out
      if (/\b(capsule|membrane)\b/.test(low)) {
        return new THREE.MeshStandardMaterial({
          color: 0xa98b68,
          roughness: 0.46,
          metalness: 0.04,
          transparent: true,
          opacity: 0.82,
          side: THREE.DoubleSide,
        });
      }
      // True fibrous ligaments (ACL, PCL, MCL, LCL, ATFL, iliofemoral, etc.): distinct golden-olive ochre
      return new THREE.MeshStandardMaterial({
        color: 0xd4af5a,
        roughness: 0.36,
        metalness: 0.06,
        side: THREE.DoubleSide,
      });
    }

    case 'artery':
      return new THREE.MeshStandardMaterial({
        color: /\bpulmonary\b/.test(low) ? 0xb91c1c : 0xe11d48,
        roughness: 0.3,
        metalness: 0.06,
        side: THREE.DoubleSide,
      });

    case 'vein':
      return new THREE.MeshStandardMaterial({
        color: /\bpulmonary\b/.test(low) ? 0x3b82f6 : 0x2563eb,
        roughness: 0.34,
        metalness: 0.06,
        side: THREE.DoubleSide,
      });

    case 'nerve': {
      const isBrainCortex =
        /\b(lobe|lobule|gyrus|gyri|sulcus|sulci|cerebell|cerebr|pole|insula|hippocampus|amygdal|thalamus|corpus\s+callosum|brain|pons|medulla\s+oblongata|nucleus|white\s+matter|commissure|colliculus|vermis|flocculus|geniculate|mamillary|peduncle|aqueduct|ventricle)\b/.test(
          low,
        ) && !/\bnerve\b/.test(low);
      if (/\b(falx|tentorium|dura)\b/.test(low)) {
        return new THREE.MeshStandardMaterial({
          color: 0xa98b68,
          roughness: 0.45,
          metalness: 0.02,
          side: THREE.DoubleSide,
        });
      }
      return new THREE.MeshStandardMaterial({
        color: isBrainCortex ? 0xe4c7b7 : 0xfacc15,
        roughness: isBrainCortex ? 0.48 : 0.34,
        metalness: 0.04,
        side: THREE.DoubleSide,
      });
    }

    case 'organ':
      return new THREE.MeshStandardMaterial({
        color: getOrganColorHex(rawTitle, origMaterial),
        roughness: 0.42,
        metalness: 0.04,
        side: THREE.DoubleSide,
      });

    case 'skin': {
      const clamped = Math.max(0.05, Math.min(1, skinOpacity));
      return new THREE.MeshPhysicalMaterial({
        color: 0xe8be9e,
        roughness: 0.58,
        metalness: 0.0,
        transparent: clamped < 0.99,
        opacity: clamped,
        depthWrite: clamped > 0.85,
        side: THREE.DoubleSide,
      });
    }

    default:
      return null;
  }
}

// =============================================================================
// PER-VERTEX MYOTENDINOUS SHADING (BRZUSIEC MIĘŚNIOWY <-> CZĘŚĆ ŚCIĘGNISTA)
// =============================================================================

const BELLY_VARIANT_HEX: readonly number[] = [
  0xb62b28, // 0: classic deep striated crimson
  0xc83732, // 1: bright arterial-scarlet muscle head (e.g. caput longum / pars clavicularis)
  0x9e2326, // 2: deep burgundy muscle head (e.g. caput breve / pars acromialis)
  0xc44836, // 3: warm terracotta-crimson head (e.g. caput mediale / pars spinalis)
];

const MYOTENDINOUS_JUNCTION_COLOR = new THREE.Color(0xd98274);
const TENDINOUS_PEARL_COLOR = new THREE.Color(0xf6f3e8);

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (Math.abs(edge1 - edge0) < 1e-6) return x >= edge1 ? 1 : 0;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Computes anatomically realistic per-vertex myotendinous shading (`COLOR_0`) on a skeletal muscle
 * BufferGeometry, transitioning smoothly from striated crimson muscle belly (`venter`) through the
 * myotendinous junction (`junctio myotendinea`) into glistening pearly collagenous tendinous ends
 * (`tendines / aponeuroses`), and stores `geometry.userData.tendonWeights` (Float32Array) for 3D click detection.
 */
export function applyMuscleMyotendinousVertexColors(
  geometry: THREE.BufferGeometry,
  rawTitle: string,
  variantIndex = 0,
): THREE.BufferGeometry {
  const posAttr = geometry.getAttribute('position');
  if (!posAttr || posAttr.count < 4) return geometry;

  const clean = normalizeRawMeshTitle(rawTitle).toLowerCase();
  const count = posAttr.count;

  // Sphincters & tiny facial/laryngeal/intrinsic muscles have minimal free tendon cords
  const isSphincterOrFacial =
    /\b(orbicularis|nasalis|procerus|corrugator|risorius|mentalis|buccinator|arytenoid|cricothyroid|crico\s*arytenoid|thyro\s*arytenoid|pharyngeal\s+constrictor|genioglossus|hyoglossus)\b/.test(
      clean,
    );
  const isLongTendonLimbMuscle =
    /\b(flexor|extensor|tibialis|fibularis|peroneus|palmaris|plantaris|biceps|semitendinosus|semimembranosus|gracilis|sartorius|gastrocnemius|soleus|abductor\s+pollicis\s+longus|popliteus|subscapularis|supraspinatus|infraspinatus|teres|pectoralis|latissimus|rectus\s+femoris|vastus|triceps)\b/.test(
      clean,
    );
  const isSheetAponeurosisMuscle =
    /\b(latissimus\s+dorsi|external\s+abdominal\s+oblique|internal\s+abdominal\s+oblique|transversus\s+abdominis|trapezius|diaphragm)\b/.test(
      clean,
    );

  // 1. Compute centroid & covariance to find principal longitudinal axis of the muscle
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (let i = 0; i < count; i++) {
    cx += posAttr.getX(i);
    cy += posAttr.getY(i);
    cz += posAttr.getZ(i);
  }
  cx /= count;
  cy /= count;
  cz /= count;

  let xx = 0;
  let xy = 0;
  let xz = 0;
  let yy = 0;
  let yz = 0;
  let zz = 0;
  for (let i = 0; i < count; i++) {
    const dx = posAttr.getX(i) - cx;
    const dy = posAttr.getY(i) - cy;
    const dz = posAttr.getZ(i) - cz;
    xx += dx * dx;
    xy += dx * dy;
    xz += dx * dz;
    yy += dy * dy;
    yz += dy * dz;
    zz += dz * dz;
  }

  // Power-iteration (8 steps) for dominant eigenvector (principal fiber axis)
  let ax = xx >= yy && xx >= zz ? 1 : 0;
  let ay = yy > xx && yy >= zz ? 1 : 0;
  let az = ax === 0 && ay === 0 ? 1 : 0;
  for (let iter = 0; iter < 8; iter++) {
    const nx = xx * ax + xy * ay + xz * az;
    const ny = xy * ax + yy * ay + yz * az;
    const nz = xz * ax + yz * ay + zz * az;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-9) break;
    ax = nx / len;
    ay = ny / len;
    az = nz / len;
  }
  // Canonicalize axis direction so +s points superiorly (+Y) or distally/laterally consistently
  if (ay < -0.15 || (Math.abs(ay) <= 0.15 && Math.abs(ax) > 0.15 && ax < 0)) {
    ax = -ax;
    ay = -ay;
    az = -az;
  }

  let minProj = Infinity;
  let maxProj = -Infinity;
  const proj = new Float32Array(count);
  const radDist = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const dx = posAttr.getX(i) - cx;
    const dy = posAttr.getY(i) - cy;
    const dz = posAttr.getZ(i) - cz;
    const p = dx * ax + dy * ay + dz * az;
    proj[i] = p;
    if (p < minProj) minProj = p;
    if (p > maxProj) maxProj = p;
    const rx = dx - p * ax;
    const ry = dy - p * ay;
    const rz = dz - p * az;
    radDist[i] = Math.hypot(rx, ry, rz);
  }

  const span = Math.max(1e-5, maxProj - minProj);

  // 2. Measure cross-sectional girth profile across 20 longitudinal bins
  const NUM_BINS = 20;
  const binMaxR = new Float32Array(NUM_BINS);
  for (let i = 0; i < count; i++) {
    const s = (proj[i] - minProj) / span;
    const b = Math.min(NUM_BINS - 1, Math.max(0, Math.floor(s * NUM_BINS)));
    if (radDist[i] > binMaxR[b]) binMaxR[b] = radDist[i];
  }
  // Smooth bin profile slightly so local mesh facets don't create jagged rings
  const smoothR = new Float32Array(NUM_BINS);
  let peakGirth = 1e-5;
  for (let b = 0; b < NUM_BINS; b++) {
    const prev = binMaxR[Math.max(0, b - 1)];
    const curr = binMaxR[b];
    const next = binMaxR[Math.min(NUM_BINS - 1, b + 1)];
    smoothR[b] = prev * 0.25 + curr * 0.5 + next * 0.25;
    if (smoothR[b] > peakGirth) peakGirth = smoothR[b];
  }

  const bellyBase = new THREE.Color(
    BELLY_VARIANT_HEX[((variantIndex % BELLY_VARIANT_HEX.length) + BELLY_VARIANT_HEX.length) % BELLY_VARIANT_HEX.length],
  );
  const tmpColor = new THREE.Color();
  const colors = new Float32Array(count * 3);
  const tendonWeights = new Float32Array(count);

  const tipWidth = isSphincterOrFacial ? 0.035 : isLongTendonLimbMuscle ? 0.145 : 0.095;

  for (let i = 0; i < count; i++) {
    const s = (proj[i] - minProj) / span; // 0 = caudal/distal end, 1 = cranial/proximal end
    const endDist = Math.min(s, 1 - s); // distance to nearest attachment pole [0..0.5]

    // Continuous girth lookup along s
    const binFloat = s * (NUM_BINS - 1);
    const b0 = Math.min(NUM_BINS - 1, Math.max(0, Math.floor(binFloat)));
    const b1 = Math.min(NUM_BINS - 1, b0 + 1);
    const frac = binFloat - b0;
    const localGirth = smoothR[b0] * (1 - frac) + smoothR[b1] * frac;
    const girthRatio = localGirth / peakGirth; // small (<0.42) along slender tendons!

    // A) Attachment-tip tendinous collar at origin & insertion
    let wTendon = 1 - smoothstep(tipWidth * 0.35, tipWidth * 1.35, endDist);

    // B) Elongated narrow tendon tail detection (wrist/hand & ankle/foot tendons, plantaris, biceps long head)
    if (!isSphincterOrFacial && endDist < 0.44) {
      const slenderness = 1 - smoothstep(0.28, 0.56, girthRatio);
      const extremityBias = 1 - smoothstep(0.10, 0.44, endDist);
      const cordWeight = slenderness * (isLongTendonLimbMuscle ? 0.96 : 0.72) * (0.45 + 0.55 * extremityBias);
      if (cordWeight > wTendon) wTendon = cordWeight;
    }

    // C) Specific anatomical aponeuroses (thoracolumbar fascia on latissimus dorsi, central tendon of diaphragm, linea semilunaris/rectus sheath on obliques)
    if (isSheetAponeurosisMuscle) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      if (clean.includes('latissimus') && Math.abs(vx) < 0.085 && vy < cy + span * 0.12) {
        const medialFactor = 1 - smoothstep(0.03, 0.095, Math.abs(vx));
        wTendon = Math.max(wTendon, medialFactor * 0.92);
      } else if (clean.includes('diaphragm')) {
        // Central trefoil tendon of diaphragm (centrum tendineum) sits at the superior dome!
        const domeFactor = smoothstep(0.72, 0.94, s) * (1 - smoothstep(0.03, 0.11, Math.abs(vx)));
        wTendon = Math.max(wTendon, domeFactor * 0.9);
      } else if (clean.includes('abdomin') && clean.includes('oblique')) {
        const lineaAlbaFactor = 1 - smoothstep(0.025, 0.085, Math.abs(vx));
        wTendon = Math.max(wTendon, lineaAlbaFactor * 0.88);
      } else if (clean.includes('gastrocnemius') || clean.includes('soleus')) {
        // Distal triceps surae aponeurosis transitioning into Tendo calcaneus (Achillesa)
        const distalAchillesFactor = 1 - smoothstep(0.08, 0.28, s);
        wTendon = Math.max(wTendon, distalAchillesFactor * 0.95);
      }
    } else if (clean.includes('gastrocnemius') || clean.includes('soleus')) {
      const distalAchillesFactor = 1 - smoothstep(0.08, 0.28, s);
      wTendon = Math.max(wTendon, distalAchillesFactor * 0.95);
    }

    wTendon = Math.max(0, Math.min(1, wTendon));
    tendonWeights[i] = wTendon;

    // Subtle organic longitudinal fiber striation on the fleshy belly
    const fiberWave = Math.sin((radDist[i] / Math.max(peakGirth, 0.005)) * 18.0 + s * 6.0) * 0.045 * (1 - wTendon);

    if (wTendon <= 0.45) {
      const t = wTendon / 0.45;
      tmpColor.copy(bellyBase).lerp(MYOTENDINOUS_JUNCTION_COLOR, t);
    } else {
      const t = (wTendon - 0.45) / 0.55;
      tmpColor.copy(MYOTENDINOUS_JUNCTION_COLOR).lerp(TENDINOUS_PEARL_COLOR, t);
    }
    tmpColor.offsetHSL(0, 0, fiberWave);

    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.userData.tendonWeights = tendonWeights;
  geometry.userData.muscleVariantIndex = variantIndex;
  return geometry;
}

export function createMuscleVertexColorMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.46,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
}

/**
 * Inspects a raycast hit on a muscle mesh and returns true when the clicked triangle sits
 * on the tendinous region (`tendonWeight >= 0.55`).
 */
export function isRaycastHitOnTendinousPart(
  mesh: THREE.Mesh,
  face?: THREE.Face | null,
): boolean {
  const weights = mesh.geometry?.userData?.tendonWeights as Float32Array | undefined;
  if (!weights || !face) return false;
  const wa = weights[face.a] ?? 0;
  const wb = weights[face.b] ?? 0;
  const wc = weights[face.c] ?? 0;
  return (wa + wb + wc) / 3 >= 0.55;
}

// =============================================================================
// SYNTHESIZED SCULPTED 3D MAJOR TENDONS (MISSING FROM Z-ANATOMY BASE GLBS)
// =============================================================================

export interface SynthesizedTendonSpec {
  mesh: THREE.Mesh;
  rawName: string;
  namePl: string;
  nameLt: string;
  nameEn: string;
  structureId: string;
  category: StructureCategory;
  layerId: AnatomicalLayerId;
  side: 'right' | 'left';
  anatomicalX: number;
}

function createSculptedFlatTendonGeometry(
  points: THREE.Vector3[],
  radiiX: number[],
  radiiZ: number[],
  tubularSegments = 20,
  radialSegments = 14,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  // Use consistent anatomical coronal/sagittal basis (+X medial-lateral, +Z anterior-posterior)
  // so flattened tendons never twist unnaturally along vertical paths
  const refForward = new THREE.Vector3(0, 0, 1);

  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments;
    const center = curve.getPointAt(u);
    const tangent = frames.tangents[i].clone().normalize();
    let sideAxis = new THREE.Vector3().crossVectors(tangent, refForward);
    if (sideAxis.lengthSq() < 1e-4) {
      sideAxis = new THREE.Vector3(1, 0, 0);
    } else {
      sideAxis.normalize();
    }
    const apAxis = new THREE.Vector3().crossVectors(sideAxis, tangent).normalize();

    const idxFloat = u * (radiiX.length - 1);
    const k0 = Math.min(radiiX.length - 1, Math.floor(idxFloat));
    const k1 = Math.min(radiiX.length - 1, k0 + 1);
    const f = idxFloat - k0;
    const rx = radiiX[k0] * (1 - f) + radiiX[k1] * f;
    const rz = radiiZ[k0] * (1 - f) + radiiZ[k1] * f;

    for (let j = 0; j <= radialSegments; j++) {
      const theta = (j / radialSegments) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      const px = center.x + sideAxis.x * cosT * rx + apAxis.x * sinT * rz;
      const py = center.y + sideAxis.y * cosT * rx + apAxis.y * sinT * rz;
      const pz = center.z + sideAxis.z * cosT * rx + apAxis.z * sinT * rz;
      positions.push(px, py, pz);

      const nx = sideAxis.x * (cosT / Math.max(rx, 1e-4)) + apAxis.x * (sinT / Math.max(rz, 1e-4));
      const ny = sideAxis.y * (cosT / Math.max(rx, 1e-4)) + apAxis.y * (sinT / Math.max(rz, 1e-4));
      const nz = sideAxis.z * (cosT / Math.max(rx, 1e-4)) + apAxis.z * (sinT / Math.max(rz, 1e-4));
      const nLen = Math.hypot(nx, ny, nz) || 1;
      normals.push(nx / nLen, ny / nLen, nz / nLen);
    }
  }

  const stride = radialSegments + 1;
  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  // Close proximal & distal tendon poles cleanly so semi-transparent surrounding muscles never reveal open tube rims
  const startPoleIdx = positions.length / 3;
  const startCenter = curve.getPointAt(0);
  const startTan = frames.tangents[0].clone().negate();
  positions.push(startCenter.x, startCenter.y, startCenter.z);
  normals.push(startTan.x, startTan.y, startTan.z);
  for (let j = 0; j < radialSegments; j++) {
    indices.push(startPoleIdx, j + 1, j);
  }

  const endPoleIdx = positions.length / 3;
  const endCenter = curve.getPointAt(1);
  const endTan = frames.tangents[tubularSegments].clone();
  positions.push(endCenter.x, endCenter.y, endCenter.z);
  normals.push(endTan.x, endTan.y, endTan.z);
  const lastRingOffset = tubularSegments * stride;
  for (let j = 0; j < radialSegments; j++) {
    indices.push(endPoleIdx, lastRingOffset + j, lastRingOffset + j + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Synthesizes anatomically accurate, sculpted 3D tendon/ligament meshes directly in the model's
 * local coordinate space for major clinical structures absent from Z-Anatomy's base GLB export:
 * - Ścięgno piętowe / Achillesa (Tendo calcaneus)
 * - Ścięgno mięśnia czworogłowego uda (Tendo musculi quadricipitis femoris)
 * - Więzadło rzepki (Ligamentum patellae)
 * - Pasmo biodrowo-piszczelowe (Tractus iliotibialis)
 */
export function buildSynthesizedAnatomicalTendons(modelRoot: THREE.Object3D): SynthesizedTendonSpec[] {
  const results: SynthesizedTendonSpec[] = [];
  const invRoot = new THREE.Matrix4().copy(modelRoot.matrixWorld).invert();

  const localBoundsBySide = {
    right: new Map<string, THREE.Box3>(),
    left: new Map<string, THREE.Box3>(),
  };

  modelRoot.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || !obj.geometry) return;
    const clean = normalizeRawMeshTitle(obj.name || '').toLowerCase();
    if (!clean) return;
    if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
    const bb = obj.geometry.boundingBox;
    if (!bb) return;

    const localMat = new THREE.Matrix4().multiplyMatrices(invRoot, obj.matrixWorld);
    const localBox = bb.clone().applyMatrix4(localMat);
    const cx = (localBox.min.x + localBox.max.x) * 0.5;
    // Z-Anatomy convention: X < 0 = anatomical right, X > 0 = anatomical left
    const side: 'right' | 'left' | null = cx < -0.004 ? 'right' : cx > 0.004 ? 'left' : null;
    if (!side) return;

    const map = localBoundsBySide[side];
    const registerKey = (key: string) => {
      const prev = map.get(key);
      if (prev) prev.union(localBox);
      else map.set(key, localBox.clone());
    };

    if (/\bcalcaneus\b/.test(clean)) registerKey('calcaneus');
    if (/\bsoleus\b/.test(clean)) registerKey('soleus');
    if (/\bgastrocnemius\b/.test(clean)) registerKey('gastrocnemius');
    if (/\bpatella\b/.test(clean) && !/\bbursa|retinaculum|ligament\b/.test(clean)) registerKey('patella');
    if (/\brectus\s+femoris\b/.test(clean)) registerKey('rectus_femoris');
    if (/\bvastus\b/.test(clean)) registerKey('vastus');
    if (/\btibia\b/.test(clean) && !/\btibialis|fibula|bursa|sheath\b/.test(clean)) registerKey('tibia');
    if (/\bvastus\s+lateralis\b/.test(clean)) registerKey('vastus_lateralis');
    if (/\bgluteus\s+maximus\b/.test(clean)) registerKey('gluteus_maximus');
  });

  for (const side of ['right', 'left'] as const) {
    const map = localBoundsBySide[side];
    const sideSuffixPl = side === 'right' ? ' (strona prawa)' : ' (strona lewa)';
    const signX = side === 'right' ? -1 : 1;

    // 1. Ścięgno piętowe — Achillesa (Tendo calcaneus)
    const calcBox = map.get('calcaneus');
    const soleusBox = map.get('soleus');
    const gastrocBox = map.get('gastrocnemius');
    if (calcBox && (soleusBox || gastrocBox)) {
      const topY = gastrocBox
        ? gastrocBox.min.y + (gastrocBox.max.y - gastrocBox.min.y) * 0.1
        : soleusBox!.min.y + 0.065;
      const midSoleusY = soleusBox ? soleusBox.min.y + 0.015 : (topY + calcBox.max.y) * 0.55;
      const insertY = calcBox.min.y + (calcBox.max.y - calcBox.min.y) * 0.52;
      const insertX = (calcBox.min.x + calcBox.max.x) * 0.5;
      const insertZ = calcBox.min.z + (calcBox.max.z - calcBox.min.z) * 0.15;
      const upperX = soleusBox ? (soleusBox.min.x + soleusBox.max.x) * 0.5 : insertX;
      const upperZ = soleusBox
        ? soleusBox.min.z + (soleusBox.max.z - soleusBox.min.z) * 0.16
        : insertZ - 0.005;

      const pts = [
        new THREE.Vector3(insertX, insertY, insertZ),
        new THREE.Vector3(insertX * 0.72 + upperX * 0.28, (insertY + midSoleusY) * 0.5, (insertZ + upperZ) * 0.5 - 0.002),
        new THREE.Vector3(upperX, midSoleusY, upperZ),
        new THREE.Vector3(upperX, (midSoleusY + topY) * 0.55, upperZ + 0.001),
        new THREE.Vector3(upperX, topY, upperZ + 0.003),
      ];
      const geo = createSculptedFlatTendonGeometry(
        pts,
        [0.0095, 0.0076, 0.0115, 0.0155, 0.0065], // narrow waist ~4 cm above calcaneus, tapering smoothly into calf aponeurosis!
        [0.0044, 0.0038, 0.0042, 0.0038, 0.0024],
      );
      const mat = createMaterialForLayer('tendon', 'Calcaneal tendon')!;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = `Calcaneal tendon.${side === 'right' ? 'r' : 'l'}`;
      results.push({
        mesh,
        rawName: mesh.name,
        namePl: `Ścięgno Achillesa (piętowe)${sideSuffixPl}`,
        nameLt: 'Tendo calcaneus',
        nameEn: 'Calcaneal tendon (Achilles tendon)',
        structureId: 'achilles_tendon',
        category: 'tendon',
        layerId: 'tendon',
        side,
        anatomicalX: insertX,
      });
    }

    // 2. Ścięgno mięśnia czworogłowego uda (Tendo musculi quadricipitis femoris) & 3. Więzadło rzepki (Ligamentum patellae)
    const patellaBox = map.get('patella');
    const rfBox = map.get('rectus_femoris') || map.get('vastus');
    const tibiaBox = map.get('tibia');
    if (patellaBox && rfBox) {
      const patX = (patellaBox.min.x + patellaBox.max.x) * 0.5;
      const patTopY = patellaBox.max.y - 0.003;
      const patFrontZ = patellaBox.max.z - 0.006;
      const quadTopY = patTopY + 0.068;
      const quadX = patX + signX * 0.003;

      const qPts = [
        new THREE.Vector3(patX, patTopY, patFrontZ),
        new THREE.Vector3((patX + quadX) * 0.5, (patTopY + quadTopY) * 0.5, patFrontZ + 0.002),
        new THREE.Vector3(quadX, quadTopY, patFrontZ - 0.003),
      ];
      const qGeo = createSculptedFlatTendonGeometry(
        qPts,
        [0.015, 0.017, 0.021],
        [0.0042, 0.0045, 0.004],
        14,
        12,
      );
      const qMesh = new THREE.Mesh(qGeo, createMaterialForLayer('tendon', 'Quadriceps tendon')!);
      qMesh.name = `Quadriceps femoris tendon.${side === 'right' ? 'r' : 'l'}`;
      results.push({
        mesh: qMesh,
        rawName: qMesh.name,
        namePl: `Ścięgno mięśnia czworogłowego uda${sideSuffixPl}`,
        nameLt: 'Tendo musculi quadricipitis femoris',
        nameEn: 'Quadriceps femoris tendon',
        structureId: 'tendon_quadriceps',
        category: 'tendon',
        layerId: 'tendon',
        side,
        anatomicalX: patX,
      });
    }

    if (patellaBox && tibiaBox) {
      const patX = (patellaBox.min.x + patellaBox.max.x) * 0.5;
      const patBotY = patellaBox.min.y + 0.004;
      const patZ = patellaBox.max.z - 0.006;
      const tubY = tibiaBox.max.y - 0.042;
      const tubZ = tibiaBox.max.z - 0.006;

      const pPts = [
        new THREE.Vector3(patX, patBotY, patZ),
        new THREE.Vector3(patX, (patBotY + tubY) * 0.5, (patZ + tubZ) * 0.5 + 0.002),
        new THREE.Vector3(patX + signX * 0.002, tubY, tubZ),
      ];
      const pGeo = createSculptedFlatTendonGeometry(
        pPts,
        [0.013, 0.0115, 0.0105],
        [0.004, 0.0038, 0.0036],
        14,
        12,
      );
      // Patellar ligament uses golden ligament material so students visually distinguish Lig. patellae vs Tendo quadricipitis!
      const pMesh = new THREE.Mesh(pGeo, createMaterialForLayer('ligament', 'Patellar ligament')!);
      pMesh.name = `Patellar ligament.${side === 'right' ? 'r' : 'l'}`;
      results.push({
        mesh: pMesh,
        rawName: pMesh.name,
        namePl: `Więzadło rzepki${sideSuffixPl}`,
        nameLt: 'Ligamentum patellae',
        nameEn: 'Patellar ligament',
        structureId: 'lig_patellae',
        category: 'ligament',
        layerId: 'ligament',
        side,
        anatomicalX: patX,
      });
    }

    // 4. Pasmo biodrowo-piszczelowe (Tractus iliotibialis)
    const vlBox = map.get('vastus_lateralis');
    if (vlBox && tibiaBox) {
      const latX = side === 'right' ? vlBox.min.x - 0.002 : vlBox.max.x + 0.002;
      const topY = vlBox.max.y - 0.02;
      const midY = (vlBox.min.y + vlBox.max.y) * 0.5;
      const gerdyY = tibiaBox.max.y - 0.016;
      const gerdyX = side === 'right' ? tibiaBox.min.x + 0.012 : tibiaBox.max.x - 0.012;
      const midZ = (vlBox.min.z + vlBox.max.z) * 0.5;
      const gerdyZ = (tibiaBox.min.z + tibiaBox.max.z) * 0.5 + 0.012;

      const itPts = [
        new THREE.Vector3(gerdyX, gerdyY, gerdyZ),
        new THREE.Vector3(latX * 0.88 + gerdyX * 0.12, vlBox.min.y + 0.03, (midZ + gerdyZ) * 0.5),
        new THREE.Vector3(latX, midY, midZ),
        new THREE.Vector3(latX, topY, midZ - 0.004),
      ];
      // Orient flat ribbon tangentially along lateral thigh (narrow in X, broad in Z!)
      const itGeo = createSculptedFlatTendonGeometry(
        itPts,
        [0.0032, 0.0035, 0.0038, 0.004],
        [0.011, 0.015, 0.022, 0.026],
        20,
        12,
      );
      const itMesh = new THREE.Mesh(itGeo, createMaterialForLayer('tendon', 'Iliotibial tract')!);
      itMesh.name = `Iliotibial tract.${side === 'right' ? 'r' : 'l'}`;
      results.push({
        mesh: itMesh,
        rawName: itMesh.name,
        namePl: `Pasmo biodrowo-piszczelowe${sideSuffixPl}`,
        nameLt: 'Tractus iliotibialis',
        nameEn: 'Iliotibial tract',
        structureId: 'tractus_iliotibialis',
        category: 'tendon',
        layerId: 'tendon',
        side,
        anatomicalX: latX,
      });
    }
  }

  return results;
}
