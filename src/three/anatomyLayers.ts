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
  shortPl: string;
  swatchHex: string;
  overlayKey?: OverlayGlbLayerKey;
}

export const ANATOMY_LAYERS_META: LayerMeta[] = [
  { id: 'bone', labelPl: 'Kości', shortPl: 'Kości', swatchHex: '#efe5d2' },
  { id: 'cartilage', labelPl: 'Chrząstki', shortPl: 'Chrząstki', swatchHex: '#a7f3d0' },
  { id: 'muscle', labelPl: 'Mięśnie', shortPl: 'Mięśnie', swatchHex: '#9f2c23' },
  { id: 'bursa', labelPl: 'Kaletki maziowe', shortPl: 'Kaletki', swatchHex: '#f4f8fb' },
  { id: 'tendon', labelPl: 'Ścięgna i pochewki', shortPl: 'Ścięgna', swatchHex: '#f7f6f2' },
  { id: 'ligament', labelPl: 'Więzadła i torebki', shortPl: 'Więzadła', swatchHex: '#e6edf2', overlayKey: 'ligaments' },
  { id: 'artery', labelPl: 'Tętnice', shortPl: 'Tętnice', swatchHex: '#dc2626', overlayKey: 'arteries' },
  { id: 'vein', labelPl: 'Żyły', shortPl: 'Żyły', swatchHex: '#2563eb', overlayKey: 'veins' },
  { id: 'nerve', labelPl: 'Nerwy i OUN', shortPl: 'Nerwy', swatchHex: '#eab308', overlayKey: 'nerves' },
  { id: 'organ', labelPl: 'Narządy wewnętrzne', shortPl: 'Narządy', swatchHex: '#c95d52', overlayKey: 'organs' },
  { id: 'skin', labelPl: 'Powłoki skórne', shortPl: 'Skóra', swatchHex: '#e8be9e', overlayKey: 'skin' },
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
    bursa: true,
    tendon: true,
    ligament: includeExtendedSystems,
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
  nameEn: string;
  pattern: RegExp;
  exclude?: RegExp;
}

/**
 * All major multi-head / multi-part skeletal muscles unified per side in 'whole' mode.
 * NOTE: Quadriceps femoris is intentionally kept as 4 separate muscles (rectus femoris + 3 vasti)
 * because physiotherapy students evaluate & palpate each head separately.
 */
export const UNIFIED_MULTI_HEAD_MUSCLES: UnifiedMuscleGroupRule[] = [
  {
    groupId: 'm_deltoideus',
    structureId: 'm_deltoideus',
    namePl: 'Mięsień naramienny',
    nameEn: 'Deltoid muscle',
    pattern: /\bdeltoid(eus)?\b/i,
    exclude: /\b(bursa|ligament|region)\b/i,
  },
  {
    groupId: 'm_trapezius',
    structureId: 'm_trapezius',
    namePl: 'Mięsień czworoboczny',
    nameEn: 'Trapezius muscle',
    pattern: /\btrapezius\b/i,
    exclude: /\b(bursa|ligament|region)\b/i,
  },
  {
    groupId: 'm_pectoralis_major',
    structureId: 'm_pectoralis_major',
    namePl: 'Mięsień piersiowy większy',
    nameEn: 'Pectoralis major muscle',
    pattern: /\bpectoralis\s+major\b/i,
  },
  {
    groupId: 'm_biceps_brachii',
    structureId: 'm_biceps_brachii',
    namePl: 'Mięsień dwugłowy ramienia',
    nameEn: 'Biceps brachii muscle',
    pattern: /\bbiceps\s+brachii\b/i,
    exclude: /\b(bursa|sheath|tendon|aponeurosis)\b/i,
  },
  {
    groupId: 'm_triceps_brachii',
    structureId: 'm_triceps_brachii',
    namePl: 'Mięsień trójgłowy ramienia',
    nameEn: 'Triceps brachii muscle',
    pattern: /\btriceps\s+brachii\b/i,
    exclude: /\b(bursa|sheath|tendon)\b/i,
  },
  {
    groupId: 'm_biceps_femoris',
    structureId: 'm_biceps_femoris',
    namePl: 'Mięsień dwugłowy uda',
    nameEn: 'Biceps femoris muscle',
    pattern: /\bbiceps\s+femoris\b/i,
    exclude: /\b(bursa|sheath|tendon)\b/i,
  },
  {
    groupId: 'm_gastrocnemius',
    structureId: 'm_gastrocnemius',
    namePl: 'Mięsień brzuchaty łydki',
    nameEn: 'Gastrocnemius muscle',
    pattern: /\bgastrocnemius\b/i,
    exclude: /\b(bursa|sheath|tendon)\b/i,
  },
  {
    groupId: 'm_masseter',
    structureId: 'm_masseter',
    namePl: 'Mięsień żwacz',
    nameEn: 'Masseter muscle',
    pattern: /\bmasseter\b/i,
  },
  {
    groupId: 'm_digastricus',
    namePl: 'Mięsień dwubrzuścowy',
    nameEn: 'Digastric muscle',
    pattern: /\bdigastric\b/i,
  },
  {
    groupId: 'm_pronator_teres',
    structureId: 'm_pronator_teres',
    namePl: 'Mięsień nawrotny obły',
    nameEn: 'Pronator teres muscle',
    pattern: /\bpronator\s+teres\b/i,
  },
  {
    groupId: 'm_flexor_digitorum_superficialis',
    namePl: 'Mięsień zginacz powierzchowny palców',
    nameEn: 'Flexor digitorum superficialis',
    pattern: /\bflexor\s+digitorum\s+superficialis\b/i,
  },
  {
    groupId: 'm_flexor_carpi_ulnaris',
    structureId: 'm_flexor_carpi_ulnaris',
    namePl: 'Mięsień zginacz łokciowy nadgarstka',
    nameEn: 'Flexor carpi ulnaris muscle',
    pattern: /\bflexor\s+carpi\s+ulnaris\b/i,
  },
  {
    groupId: 'm_extensor_carpi_ulnaris',
    namePl: 'Mięsień prostownik łokciowy nadgarstka',
    nameEn: 'Extensor carpi ulnaris muscle',
    pattern: /\bextensor\s+carpi\s+ulnaris\b/i,
  },
  {
    groupId: 'm_flexor_pollicis_brevis',
    namePl: 'Mięsień zginacz krótki kciuka',
    nameEn: 'Flexor pollicis brevis',
    pattern: /\bflexor\s+pollicis\s+brevis\b/i,
  },
  {
    groupId: 'm_flexor_hallucis_brevis',
    namePl: 'Mięsień zginacz krótki palucha',
    nameEn: 'Flexor hallucis brevis',
    pattern: /\bflexor\s+hallucis\s+brevis\b/i,
  },
  {
    groupId: 'm_adductor_pollicis',
    namePl: 'Mięsień przywodziciel kciuka',
    nameEn: 'Adductor pollicis',
    pattern: /\badductor\s+pollicis\b/i,
  },
  {
    groupId: 'm_adductor_hallucis',
    namePl: 'Mięsień przywodziciel palucha',
    nameEn: 'Adductor hallucis',
    pattern: /\badductor\s+hallucis\b/i,
  },
  {
    groupId: 'm_pterygoideus_lateralis',
    namePl: 'Mięsień skrzydłowy boczny',
    nameEn: 'Lateral pterygoid muscle',
    pattern: /\blateral\s+pterygoid\b/i,
  },
];

function normalizeRawMeshTitle(rawTitle: string): string {
  return rawTitle
    .replace(/[_]+/g, ' ')
    .replace(/\.(r|l)$/i, '')
    .replace(/\.?\d{3}$/, '')
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
  return null;
}

/**
 * Classifies a mesh from the base body.glb / regional GLB into a fine-grained AnatomicalLayerId.
 */
export function classifyBaseGlbMeshLayer(
  rawTitle: string,
  rawType: string,
  matName: string,
  isCartilage: boolean,
  translatedCategory?: StructureCategory,
): AnatomicalLayerId {
  if (isCartilage) return 'cartilage';
  if (/\bbursae?\b/i.test(rawTitle) || translatedCategory === 'bursa') return 'bursa';
  if (
    /\b(tendon|sheath|aponeurosis|retinaculum|fascia|linea\s+alba|trochlea\s+of\s+superior\s+oblique|common\s+tendinous\s+ring)\b/i.test(
      rawTitle,
    ) ||
    translatedCategory === 'tendon'
  ) {
    return 'tendon';
  }
  if (/\b(ligaments?|capsule|labrum)\b/i.test(rawTitle) || translatedCategory === 'ligament') {
    return 'ligament';
  }
  if (
    rawType === 'muscle' ||
    matName.includes('muscle') ||
    matName === 'mat_muscle_pro' ||
    /\bmuscle\b/i.test(rawTitle) ||
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
  if (/\b(trachea|bronch|carina)\b/.test(hay)) return 0xd9e4ec;
  if (/\bliver\b/.test(hay)) return 0x7d3026;
  if (/\b(gallbladder|cystic|bile|biliary)\b/.test(hay)) return 0x5f8540;
  if (/\bspleen\b/.test(hay)) return 0x6b2740;
  if (/\b(stomach|o?esophagus|pylorus|cardiac\s+part)\b/.test(hay)) return 0xd68978;
  if (/\b(duodenum|jejunum|ileum|colon|cecum|caecum|rectum|appendix|taenia|intestin)\b/.test(hay)) return 0xd8a38c;
  if (/\b(kidney|ureter|renal)\b/.test(hay)) return 0x8c3a32;
  if (/\b(pancreas|thyroid|parathyroid|gland|thymus|parotid|submandibular|sublingual|tonsil|suprarenal|adrenal)\b/.test(hay)) {
    return 0xdba866;
  }
  if (/\b(bladder|urethra|prostate|uterus|ovary)\b/.test(hay)) return 0xd48e76;
  if (/\b(peritoneum|omentum|mesentery)\b/.test(hay)) return 0xe4c78a;
  return 0xc46055;
}

/**
 * Creates a distinct, anatomically clear PBR material for every layer:
 * - Bursae: pure pearly white with synovial clearcoat
 * - Tendons & sheaths: crisp fibrous satin white
 * - Ligaments & capsules: cool silvery-white distinct from warm ivory bones
 * - Cartilages: pearly emerald-mint (preserves E2E F07 invariant)
 * - Arteries: arterial crimson red
 * - Veins: venous royal blue
 * - Nerves & CNS: vivid yellow for peripheral nerves, natural pinkish-ivory for brain
 * - Organs: anatomically differentiated natural tones
 * - Skin: translucent natural skin shell with dynamic opacity
 */
export function createMaterialForLayer(
  layerId: AnatomicalLayerId,
  rawTitle: string,
  origMaterial?: string,
  skinOpacity = 0.3,
): THREE.Material | null {
  const low = `${rawTitle} ${origMaterial || ''}`.toLowerCase();

  switch (layerId) {
    case 'cartilage':
      return new THREE.MeshPhysicalMaterial({
        color: 0xa7f3d0,
        roughness: 0.25,
        metalness: 0.0,
        clearcoat: 0.7,
        clearcoatRoughness: 0.2,
        reflectivity: 0.6,
        side: THREE.DoubleSide,
      });

    case 'bursa':
      return new THREE.MeshPhysicalMaterial({
        color: 0xf4f8fb,
        roughness: 0.22,
        metalness: 0.0,
        clearcoat: 0.65,
        clearcoatRoughness: 0.18,
        side: THREE.DoubleSide,
      });

    case 'tendon':
      return new THREE.MeshStandardMaterial({
        color: 0xf7f6f2,
        roughness: 0.34,
        metalness: 0.04,
        side: THREE.DoubleSide,
      });

    case 'ligament': {
      // Intervertebral discs, menisci, labra & articular discs inside the joints layer use cartilage appearance
      if (/\b(disc|meniscus|labrum|cartilage|symphysis)\b/.test(low)) {
        return new THREE.MeshPhysicalMaterial({
          color: 0xa7f3d0,
          roughness: 0.25,
          metalness: 0.0,
          clearcoat: 0.7,
          clearcoatRoughness: 0.2,
          side: THREE.DoubleSide,
        });
      }
      if (/\bflav(um|a)\b/.test(low)) {
        return new THREE.MeshStandardMaterial({
          color: 0xf3e5ab,
          roughness: 0.4,
          metalness: 0.04,
          side: THREE.DoubleSide,
        });
      }
      return new THREE.MeshStandardMaterial({
        color: 0xe6edf2,
        roughness: 0.4,
        metalness: 0.05,
        side: THREE.DoubleSide,
      });
    }

    case 'artery':
      return new THREE.MeshStandardMaterial({
        color: /\bpulmonary\b/.test(low) ? 0xb91c1c : 0xdc2626,
        roughness: 0.32,
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
      // Brain hemispheres/cerebellum get soft pinkish-ivory cortex color; peripheral nerves & spinal cord get crisp yellow
      const isBrainCortex =
        /\b(lobe|gyrus|sulcus|cerebell|cerebr|pole|insula|hippocampus|amygdala|thalamus|corpus\s+callosum|brain|pons|medulla\s+oblongata|nucleus|white\s+matter)\b/.test(
          low,
        ) && !/\bnerve\b/.test(low);
      if (/\b(falx|tentorium|dura)\b/.test(low)) {
        return new THREE.MeshStandardMaterial({
          color: 0xe6edf2,
          roughness: 0.45,
          metalness: 0.02,
          side: THREE.DoubleSide,
        });
      }
      return new THREE.MeshStandardMaterial({
        color: isBrainCortex ? 0xe4c7b7 : 0xeab308,
        roughness: isBrainCortex ? 0.48 : 0.36,
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
      return null; // Keep original bone/muscle PBR materials from body.glb
  }
}
