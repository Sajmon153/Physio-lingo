import { ANATOMY_DB } from '../data/anatomyDb';
import type { StructureCategory } from '../types/anatomy';

export interface MeshTranslationResult {
  namePl: string;
  nameLt: string;
  nameEn: string;
  bilingualName: string;
  tendinousNamePl?: string;
  tendinousNameLt?: string;
  structureId?: string;
  category: StructureCategory;
  isCartilage?: boolean;
}

// Backwards-compatible alias
export type TranslatedMeshInfo = MeshTranslationResult;

function flattenInnerParens(text: string): string {
  return text
    .replace(/\s*\(([^)]+)\)/g, ', $1')
    .replace(/\s+,/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
}

export function capitalizeLatinTerm(term?: string): string {
  const clean = (term || '').trim();
  if (!clean) return '';
  // Take primary Terminologia Anatomica synonym if comma-separated
  const primary = clean.split(',')[0].trim();
  return primary.charAt(0).toUpperCase() + primary.slice(1);
}

/**
 * Formats a primary Polish anatomical name with its secondary (Latin Terminologia Anatomica)
 * name in parentheses, preserving lateralization/subpart tags cleanly outside.
 */
export function formatBilingualName(namePl: string, secondaryName?: string): string {
  const cleanPl = (namePl || '').trim();
  const cleanSec = (secondaryName || '').trim();
  if (!cleanPl && !cleanSec) return 'Struktura anatomiczna';
  if (!cleanSec) return cleanPl || 'Struktura anatomiczna';

  // Extract trailing lateralization/part suffix so it stays outside the Latin parentheses
  const sideMatch = cleanPl.match(/\s*\((strona\s+(?:lewa|prawa)|część\s+[^)]+)\)$/i);
  const sideTag = sideMatch ? `(${sideMatch[1]})` : '';
  const basePlRaw = sideMatch ? cleanPl.slice(0, sideMatch.index).trim() : cleanPl;

  let secAdjusted = cleanSec;
  const tagInPl =
    basePlRaw.match(/\(([^)]+)\)\s*$/) || basePlRaw.match(/\s+—\s+([A-Z0-9]{2,10})$/);
  if (tagInPl) {
    const tagRegex = new RegExp(
      `\\s*\\(${tagInPl[1].trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)$`,
      'i',
    );
    secAdjusted = secAdjusted.replace(tagRegex, '').trim() || cleanSec;
  }

  const flatSec = flattenInnerParens(secAdjusted);

  const lowerPl = basePlRaw.toLowerCase();
  if (
    lowerPl === cleanSec.toLowerCase() ||
    lowerPl === flatSec.toLowerCase() ||
    lowerPl === secAdjusted.toLowerCase() ||
    lowerPl.includes(`(${cleanSec.toLowerCase()})`) ||
    lowerPl.includes(`(${flatSec.toLowerCase()})`)
  ) {
    return cleanPl;
  }

  const trailingMatch = basePlRaw.match(/\s+\(([^)]+)\)$/);
  if (trailingMatch) {
    const existing = trailingMatch[1].trim().toLowerCase();
    if (
      existing === cleanSec.toLowerCase() ||
      existing === flatSec.toLowerCase() ||
      existing === secAdjusted.toLowerCase() ||
      cleanSec.toLowerCase().startsWith(`${existing} (`)
    ) {
      return cleanPl;
    }
  }

  const formattedBasePl = basePlRaw
    .replace(/\s*\(([^)]+)\)/g, ' — $1')
    .replace(/\s+/g, ' ')
    .trim();

  if (!formattedBasePl) {
    return sideTag ? `${flatSec} ${sideTag}` : flatSec;
  }

  return sideTag
    ? `${formattedBasePl} (${flatSec}) ${sideTag}`
    : `${formattedBasePl} (${flatSec})`;
}

export function formatPolishLatinName(namePl: string, nameLt?: string): string {
  return formatBilingualName(namePl, capitalizeLatinTerm(nameLt));
}

interface TranslationRule {
  pattern: RegExp;
  namePl: string;
  nameLt?: string;
  nameEn?: string;
  structureId?: string;
  category: StructureCategory;
  isCartilage?: boolean;
}

const ORDINAL_PAIRS: Array<{ en: string; roman: string; ltOrd: string; ltGen: string }> = [
  { en: 'first', roman: 'I', ltOrd: 'prima', ltGen: 'primae' },
  { en: 'second', roman: 'II', ltOrd: 'secunda', ltGen: 'secundae' },
  { en: 'third', roman: 'III', ltOrd: 'tertia', ltGen: 'tertiae' },
  { en: 'fourth', roman: 'IV', ltOrd: 'quarta', ltGen: 'quartae' },
  { en: 'fifth', roman: 'V', ltOrd: 'quinta', ltGen: 'quintae' },
  { en: 'sixth', roman: 'VI', ltOrd: 'sexta', ltGen: 'sextae' },
  { en: 'seventh', roman: 'VII', ltOrd: 'septima', ltGen: 'septimae' },
  { en: 'eighth', roman: 'VIII', ltOrd: 'octava', ltGen: 'octavae' },
  { en: 'ninth', roman: 'IX', ltOrd: 'nona', ltGen: 'nonae' },
  { en: 'tenth', roman: 'X', ltOrd: 'decima', ltGen: 'decimae' },
  { en: 'eleventh', roman: 'XI', ltOrd: 'undecima', ltGen: 'undecimae' },
  { en: 'twelfth', roman: 'XII', ltOrd: 'duodecima', ltGen: 'duodecimae' },
];

const PHALANX_SEGMENTS: Array<{ en: string; pl: string; lt: string }> = [
  { en: 'proximal', pl: 'bliższy', lt: 'proximalis' },
  { en: 'middle', pl: 'środkowy', lt: 'media' },
  { en: 'distal', pl: 'dalszy', lt: 'distalis' },
];

const PHALANX_DIGITS = ORDINAL_PAIRS.slice(0, 5);

const COSTAL_CARTILAGE_RULES: TranslationRule[] = ORDINAL_PAIRS.slice(0, 10).map((ord) => ({
  pattern: new RegExp(`\\bcostal\\s+cartilage\\s+of\\s+${ord.en}\\s+rib\\b`, 'i'),
  namePl: `Chrząstka żebrowa ${ord.roman} żebra`,
  nameLt: `Cartilago costalis ${ord.roman}`,
  nameEn: `Costal cartilage of ${ord.en} rib`,
  structureId: 'costae',
  category: 'joint_ligament',
  isCartilage: true,
}));

const RIB_RULES: TranslationRule[] = ORDINAL_PAIRS.map((ord, idx) => ({
  pattern: new RegExp(
    `\\b${ord.en}\\s+rib\\b` + (idx === 0 ? `|\\brib_1\\b|\\bfirst_rib\\b|\\bcosta_prima\\b` : ''),
    'i',
  ),
  namePl: `Żebro ${ord.roman}`,
  nameLt: `Costa ${ord.roman} (${ord.ltOrd})`,
  nameEn: `${ord.en.charAt(0).toUpperCase()}${ord.en.slice(1)} rib`,
  structureId: 'costae',
  category: 'bone',
}));

const METACARPAL_RULES: TranslationRule[] = PHALANX_DIGITS.map((ord) => ({
  pattern: new RegExp(`\\b${ord.en}\\s+metacarpal(\\s+bone)?\\b`, 'i'),
  namePl: `${ord.roman} kość śródręcza`,
  nameLt: `Os metacarpi ${ord.roman}`,
  nameEn: `${ord.en.charAt(0).toUpperCase()}${ord.en.slice(1)} metacarpal bone`,
  category: 'bone',
}));

const METATARSAL_RULES: TranslationRule[] = PHALANX_DIGITS.map((ord) => ({
  pattern: new RegExp(`\\b${ord.en}\\s+metatarsal(\\s+bone)?\\b`, 'i'),
  namePl: `${ord.roman} kość śródstopia`,
  nameLt: `Os metatarsi ${ord.roman}`,
  nameEn: `${ord.en.charAt(0).toUpperCase()}${ord.en.slice(1)} metatarsal bone`,
  category: 'bone',
}));

const PHALANX_HAND_RULES: TranslationRule[] = [];
const PHALANX_FOOT_RULES: TranslationRule[] = [];

for (const seg of PHALANX_SEGMENTS) {
  for (const dig of PHALANX_DIGITS) {
    if (dig.en === 'first' && seg.en === 'middle') continue;
    const segCap = `${seg.en.charAt(0).toUpperCase()}${seg.en.slice(1)}`;
    PHALANX_HAND_RULES.push({
      pattern: new RegExp(
        `\\b${seg.en}\\s+phalanx\\s+of\\s+${dig.en}\\s+finger\\s+of\\s+hand\\b`,
        'i',
      ),
      namePl: `Paliczek ${seg.pl} ${dig.roman} palca ręki`,
      nameLt: `Phalanx ${seg.lt} digiti ${dig.roman} manus`,
      nameEn: `${segCap} phalanx of ${dig.en} finger of hand`,
      category: 'bone',
    });
    PHALANX_FOOT_RULES.push({
      pattern: new RegExp(
        `\\b${seg.en}\\s+phalanx\\s+of\\s+${dig.en}\\s+(?:finger\\s+of\\s+foot|toe)\\b`,
        'i',
      ),
      namePl: `Paliczek ${seg.pl} ${dig.roman} palca stopy`,
      nameLt: `Phalanx ${seg.lt} digiti ${dig.roman} pedis`,
      nameEn: `${segCap} phalanx of ${dig.en} toe`,
      category: 'bone',
    });
  }
}

export const ANATOMY_TRANSLATION_RULES: TranslationRule[] = [
  // =========================================================================
  // PRECEDENCE 0: BONY GROOVES / TUBERCLES / FACETS / MALLEOLI
  // (Must precede tendon/ligament/artery rules so "Groove for tendon..." stays bone!)
  // =========================================================================
  { pattern: /\bgroove\s+for\s+tendon\s+of\s+flexor\s+hallucis\s+longus\s+of\s+talus\b/i, namePl: 'Bruzda ścięgna zginacza długiego palucha na kości skokowej', nameLt: 'Sulcus tendinis musculi flexoris hallucis longi tali', nameEn: 'Groove for tendon of flexor hallucis longus of talus', structureId: 'talus', category: 'bone' },
  { pattern: /\bgroove\s+for\s+tendon\s+of\s+flexor\s+hallucis\s+longus\s+of\s+calcaneus\b/i, namePl: 'Bruzda ścięgna zginacza długiego palucha na kości piętowej', nameLt: 'Sulcus tendinis musculi flexoris hallucis longi calcanei', nameEn: 'Groove for tendon of flexor hallucis longus of calcaneus', structureId: 'calcaneus', category: 'bone' },
  { pattern: /\bgroove\s+for\s+tendon\s+of\s+fibularis\s+longus(\s+muscle)?\s+of\s+cuboid(\s+bone)?\b/i, namePl: 'Bruzda ścięgna mięśnia strzałkowego długiego na kości sześciennej', nameLt: 'Sulcus tendinis musculi fibularis longi ossis cuboidei', nameEn: 'Groove for tendon of fibularis longus of cuboid bone', category: 'bone' },
  { pattern: /\bgrooves?\s+for\s+extensor\s+tendons?\b/i, namePl: 'Bruzdy ścięgien prostowników', nameLt: 'Sulci tendinum musculorum extensorum', nameEn: 'Grooves for extensor tendons', structureId: 'radius', category: 'bone' },
  { pattern: /\btubercle\s+of\s+iliotibial\s+tract\b/i, namePl: 'Guzek pasma biodrowo-piszczelowego (Gerdy’ego)', nameLt: 'Tuberculum tractus iliotibialis', nameEn: 'Tubercle of iliotibial tract', structureId: 'tibia', category: 'bone' },
  { pattern: /\blateral\s+lip\s+of\s+linea\s+as?pera\b/i, namePl: 'Warga boczna kresy chropawej kości udowej', nameLt: 'Labium laterale lineae asperae', nameEn: 'Lateral lip of linea aspera', structureId: 'femur', category: 'bone' },
  { pattern: /\bmedial\s+lip\s+of\s+linea\s+as?pera\b/i, namePl: 'Warga przyśrodkowa kresy chropawej kości udowej', nameLt: 'Labium mediale lineae asperae', nameEn: 'Medial lip of linea aspera', structureId: 'femur', category: 'bone' },
  { pattern: /\blinea\s+as?pera\b/i, namePl: 'Kresa chropawa kości udowej', nameLt: 'Linea aspera femoris', nameEn: 'Linea aspera', structureId: 'femur', category: 'bone' },
  { pattern: /\bpatellar\s+surface\s+of\s+femur\b/i, namePl: 'Powierzchnia rzepkowa kości udowej', nameLt: 'Facies patellaris femoris', nameEn: 'Patellar surface of femur', structureId: 'femur', category: 'bone' },
  { pattern: /\bcalcaneal\s+tuberosity\b/i, namePl: 'Guz piętowy', nameLt: 'Tuber calcanei', nameEn: 'Calcaneal tuberosity', structureId: 'calcaneus', category: 'bone' },
  { pattern: /\blateral\s+process\s+of\s+calcaneal\s+tuberosity\b/i, namePl: 'Wyrostek boczny guza piętowego', nameLt: 'Processus lateralis tuberis calcanei', nameEn: 'Lateral process of calcaneal tuberosity', structureId: 'calcaneus', category: 'bone' },
  { pattern: /\bmedial\s+process\s+of\s+calcaneal\s+tuberosity\b/i, namePl: 'Wyrostek przyśrodkowy guza piętowego', nameLt: 'Processus medialis tuberis calcanei', nameEn: 'Medial process of calcaneal tuberosity', structureId: 'calcaneus', category: 'bone' },
  { pattern: /\banterior\s+process\s+of\s+calcaneus\b/i, namePl: 'Wyrostek przedni kości piętowej', nameLt: 'Processus anterior calcanei', nameEn: 'Anterior process of calcaneus', structureId: 'calcaneus', category: 'bone' },
  { pattern: /\bcalcaneal\s+sulcus\b/i, namePl: 'Bruzda piętowa', nameLt: 'Sulcus calcanei', nameEn: 'Calcaneal sulcus', structureId: 'calcaneus', category: 'bone' },
  { pattern: /\bcalcaneal\s+tubercle\b/i, namePl: 'Guzek piętowy', nameLt: 'Tuberculum calcanei', nameEn: 'Calcaneal tubercle', structureId: 'calcaneus', category: 'bone' },
  { pattern: /\bposterior\s+calcaneal\s+articular\s+facet\b/i, namePl: 'Powierzchnia stawowa piętowa tylna', nameLt: 'Facies articularis calcanea posterior', nameEn: 'Posterior calcaneal articular facet', structureId: 'talus', category: 'bone' },
  { pattern: /\bmiddle\s+facet\s+for\s+calcaneus\b/i, namePl: 'Powierzchnia stawowa piętowa środkowa', nameLt: 'Facies articularis calcanea media', nameEn: 'Middle facet for calcaneus', structureId: 'talus', category: 'bone' },
  { pattern: /\blateral\s+malleolus\b/i, namePl: 'Kostka boczna', nameLt: 'Malleolus lateralis', nameEn: 'Lateral malleolus', structureId: 'fibula', category: 'bone' },
  { pattern: /\bmedial\s+malleolus\b/i, namePl: 'Kostka przyśrodkowa', nameLt: 'Malleolus medialis', nameEn: 'Medial malleolus', structureId: 'tibia', category: 'bone' },

  // =========================================================================
  // PRECEDENCE 1: ARTERIES, VEINS, NERVES, INTERNAL ORGANS, LIGAMENTS & SKIN
  // =========================================================================
  // --- ARTERIES ---
  { pattern: /\baortic\s+arch\b|\barch\s+of\s+aorta\b/i, namePl: 'Łuk aorty', nameLt: 'Arcus aortae', nameEn: 'Aortic arch', structureId: 'a_aorta', category: 'artery' },
  { pattern: /\bascending\s+aorta\b/i, namePl: 'Aorta wstępująca', nameLt: 'Aorta ascendens', nameEn: 'Ascending aorta', structureId: 'a_aorta', category: 'artery' },
  { pattern: /\bthoracic\s+aorta\b/i, namePl: 'Aorta piersiowa', nameLt: 'Aorta thoracica', nameEn: 'Thoracic aorta', structureId: 'a_aorta', category: 'artery' },
  { pattern: /\babdominal\s+aorta\b/i, namePl: 'Aorta brzuszna', nameLt: 'Aorta abdominalis', nameEn: 'Abdominal aorta', structureId: 'a_aorta', category: 'artery' },
  { pattern: /\bdescending\s+aorta\b|\baorta\b/i, namePl: 'Aorta (tętnica główna)', nameLt: 'Aorta', nameEn: 'Aorta', structureId: 'a_aorta', category: 'artery' },
  { pattern: /\bc(?:o)?eliac\s+trunk\b/i, namePl: 'Pień trzewny', nameLt: 'Truncus coeliacus', nameEn: 'Coeliac trunk', structureId: 'a_aorta', category: 'artery' },
  { pattern: /\bthyrocervical\s+trunk\b/i, namePl: 'Pień tarczowo-szyjny', nameLt: 'Truncus thyrocervicalis', nameEn: 'Thyrocervical trunk', structureId: 'a_subclavia', category: 'artery' },
  { pattern: /\bcostocervical\s+trunk\b/i, namePl: 'Pień żebrowo-szyjny', nameLt: 'Truncus costocervicalis', nameEn: 'Costocervical trunk', structureId: 'a_subclavia', category: 'artery' },
  { pattern: /\bbrachiocephalic\s+trunk\b/i, namePl: 'Pień ramienno-głowowy', nameLt: 'Truncus brachiocephalicus', nameEn: 'Brachiocephalic trunk', structureId: 'a_aorta', category: 'artery' },
  { pattern: /\bdeep\s+palmar\s+arch\b/i, namePl: 'Łuk dłoniowy głęboki', nameLt: 'Arcus palmaris profundus', nameEn: 'Deep palmar arch', structureId: 'a_radialis', category: 'artery' },
  { pattern: /\bsuperficial\s+palmar\s+arch\b/i, namePl: 'Łuk dłoniowy powierzchowny', nameLt: 'Arcus palmaris superficialis', nameEn: 'Superficial palmar arch', structureId: 'a_ulnaris', category: 'artery' },
  { pattern: /\bdeep\s+plantar\s+arch\b|\bplantar\s+arch\b/i, namePl: 'Łuk podeszwowy głęboki', nameLt: 'Arcus plantaris profundus', nameEn: 'Deep plantar arch', structureId: 'a_tibialis_posterior', category: 'artery' },
  { pattern: /\bcommon\s+carotid\s+artery\b/i, namePl: 'Tętnica szyjna wspólna', nameLt: 'Arteria carotis communis', nameEn: 'Common carotid artery', structureId: 'a_carotis_communis', category: 'artery' },
  { pattern: /\binternal\s+carotid\s+artery\b/i, namePl: 'Tętnica szyjna wewnętrzna', nameLt: 'Arteria carotis interna', nameEn: 'Internal carotid artery', structureId: 'a_carotis_interna', category: 'artery' },
  { pattern: /\bexternal\s+carotid\s+artery\b/i, namePl: 'Tętnica szyjna zewnętrzna', nameLt: 'Arteria carotis externa', nameEn: 'External carotid artery', structureId: 'a_carotis_communis', category: 'artery' },
  { pattern: /\bvertebral\s+artery\b/i, namePl: 'Tętnica kręgowa', nameLt: 'Arteria vertebralis', nameEn: 'Vertebral artery', structureId: 'a_vertebralis', category: 'artery' },
  { pattern: /\bbasilar\s+artery\b/i, namePl: 'Tętnica podstawna', nameLt: 'Arteria basilaris', nameEn: 'Basilar artery', structureId: 'a_vertebralis', category: 'artery' },
  { pattern: /\bsubclavian\s+artery\b/i, namePl: 'Tętnica podobojczykowa', nameLt: 'Arteria subclavia', nameEn: 'Subclavian artery', structureId: 'a_subclavia', category: 'artery' },
  { pattern: /\baxillary\s+artery\b/i, namePl: 'Tętnica pachowa', nameLt: 'Arteria axillaris', nameEn: 'Axillary artery', structureId: 'a_axillaris', category: 'artery' },
  { pattern: /\bbrachial\s+artery\b/i, namePl: 'Tętnica ramienna', nameLt: 'Arteria brachialis', nameEn: 'Brachial artery', structureId: 'a_brachialis', category: 'artery' },
  { pattern: /\bradial\s+artery\b/i, namePl: 'Tętnica promieniowa', nameLt: 'Arteria radialis', nameEn: 'Radial artery', structureId: 'a_radialis', category: 'artery' },
  { pattern: /\bulnar\s+artery\b/i, namePl: 'Tętnica łokciowa', nameLt: 'Arteria ulnaris', nameEn: 'Ulnar artery', structureId: 'a_ulnaris', category: 'artery' },
  { pattern: /\bcommon\s+iliac\s+artery\b/i, namePl: 'Tętnica biodrowa wspólna', nameLt: 'Arteria iliaca communis', nameEn: 'Common iliac artery', structureId: 'a_iliaca_communis', category: 'artery' },
  { pattern: /\bexternal\s+iliac\s+artery\b/i, namePl: 'Tętnica biodrowa zewnętrzna', nameLt: 'Arteria iliaca externa', nameEn: 'External iliac artery', structureId: 'a_iliaca_communis', category: 'artery' },
  { pattern: /\binternal\s+iliac\s+artery\b/i, namePl: 'Tętnica biodrowa wewnętrzna', nameLt: 'Arteria iliaca interna', nameEn: 'Internal iliac artery', structureId: 'a_iliaca_communis', category: 'artery' },
  { pattern: /\b(deep\s+artery\s+of\s+thigh|deep\s+femoral\s+artery|profunda\s+femoris)\b/i, namePl: 'Tętnica głęboka uda', nameLt: 'Arteria profunda femoris', nameEn: 'Deep femoral artery', structureId: 'a_profunda_femoris', category: 'artery' },
  { pattern: /\bfemoral\s+artery\b/i, namePl: 'Tętnica udowa', nameLt: 'Arteria femoralis', nameEn: 'Femoral artery', structureId: 'a_femoralis', category: 'artery' },
  { pattern: /\bpopliteal\s+artery\b/i, namePl: 'Tętnica podkolanowa', nameLt: 'Arteria poplitea', nameEn: 'Popliteal artery', structureId: 'a_poplitea', category: 'artery' },
  { pattern: /\banterior\s+tibial\s+artery\b/i, namePl: 'Tętnica piszczelowa przednia', nameLt: 'Arteria tibialis anterior', nameEn: 'Anterior tibial artery', structureId: 'a_tibialis_anterior', category: 'artery' },
  { pattern: /\bposterior\s+tibial\s+artery\b/i, namePl: 'Tętnica piszczelowa tylna', nameLt: 'Arteria tibialis posterior', nameEn: 'Posterior tibial artery', structureId: 'a_tibialis_posterior', category: 'artery' },
  { pattern: /\bdorsalis\s+pedis\s+artery\b/i, namePl: 'Tętnica grzbietowa stopy', nameLt: 'Arteria dorsalis pedis', nameEn: 'Dorsalis pedis artery', structureId: 'a_dorsalis_pedis', category: 'artery' },
  { pattern: /\bpulmonary\s+trunk\b/i, namePl: 'Pień płucny', nameLt: 'Truncus pulmonalis', nameEn: 'Pulmonary trunk', structureId: 'org_cor', category: 'artery' },
  { pattern: /\bpulmonary\s+artery\b/i, namePl: 'Tętnica płucna', nameLt: 'Arteria pulmonalis', nameEn: 'Pulmonary artery', structureId: 'org_cor', category: 'artery' },
  { pattern: /\brenal\s+artery\b/i, namePl: 'Tętnica nerkowa', nameLt: 'Arteria renalis', nameEn: 'Renal artery', structureId: 'org_ren', category: 'artery' },
  { pattern: /\bcircumflex\s+artery\s+of\s+heart\b/i, namePl: 'Gałąź okalająca lewej tętnicy wieńcowej', nameLt: 'Ramus circumflexus arteriae coronariae sinistrae', nameEn: 'Circumflex branch of left coronary artery', structureId: 'org_cor', category: 'artery' },

  // --- VEINS & DURAL SINUSES ---
  { pattern: /\bsuperior\s+vena\s+cava\b/i, namePl: 'Żyła główna górna', nameLt: 'Vena cava superior', nameEn: 'Superior vena cava', structureId: 'v_cava_superior', category: 'vein' },
  { pattern: /\binferior\s+vena\s+cava\b/i, namePl: 'Żyła główna dolna', nameLt: 'Vena cava inferior', nameEn: 'Inferior vena cava', structureId: 'v_cava_inferior', category: 'vein' },
  { pattern: /\binternal\s+jugular\s+vein\b/i, namePl: 'Żyła szyjna wewnętrzna', nameLt: 'Vena jugularis interna', nameEn: 'Internal jugular vein', structureId: 'v_jugularis_interna', category: 'vein' },
  { pattern: /\bexternal\s+jugular\s+vein\b/i, namePl: 'Żyła szyjna zewnętrzna', nameLt: 'Vena jugularis externa', nameEn: 'External jugular vein', structureId: 'v_jugularis_interna', category: 'vein' },
  { pattern: /\banterior\s+jugular\s+vein\b/i, namePl: 'Żyła szyjna przednia', nameLt: 'Vena jugularis anterior', nameEn: 'Anterior jugular vein', structureId: 'v_jugularis_interna', category: 'vein' },
  { pattern: /\bsubclavian\s+vein\b/i, namePl: 'Żyła podobojczykowa', nameLt: 'Vena subclavia', nameEn: 'Subclavian vein', structureId: 'v_subclavia', category: 'vein' },
  { pattern: /\bcephalic\s+vein\b/i, namePl: 'Żyła odpromieniowa', nameLt: 'Vena cephalica', nameEn: 'Cephalic vein', structureId: 'v_cephalica', category: 'vein' },
  { pattern: /\bbasilic\s+vein\b/i, namePl: 'Żyła odłokciowa', nameLt: 'Vena basilica', nameEn: 'Basilic vein', structureId: 'v_basilica', category: 'vein' },
  { pattern: /\bmedian\s+cubital\s+vein\b/i, namePl: 'Żyła pośrodkowa łokcia', nameLt: 'Vena mediana cubiti', nameEn: 'Median cubital vein', structureId: 'v_mediana_cubiti', category: 'vein' },
  { pattern: /\b(hepatic\s+)?portal\s+vein\b/i, namePl: 'Żyła wrotna wątroby', nameLt: 'Vena portae hepatis', nameEn: 'Hepatic portal vein', structureId: 'v_portae', category: 'vein' },
  { pattern: /\bfemoral\s+vein\b/i, namePl: 'Żyła udowa', nameLt: 'Vena femoralis', nameEn: 'Femoral vein', structureId: 'v_femoralis', category: 'vein' },
  { pattern: /\bgreat\s+saphenous\s+vein\b/i, namePl: 'Żyła odpiszczelowa', nameLt: 'Vena saphena magna', nameEn: 'Great saphenous vein', structureId: 'v_saphena_magna', category: 'vein' },
  { pattern: /\bsmall\s+saphenous\s+vein\b/i, namePl: 'Żyła odstrzałkowa', nameLt: 'Vena saphena parva', nameEn: 'Small saphenous vein', structureId: 'v_saphena_parva', category: 'vein' },
  { pattern: /\bpopliteal\s+vein\b/i, namePl: 'Żyła podkolanowa', nameLt: 'Vena poplitea', nameEn: 'Popliteal vein', structureId: 'v_poplitea', category: 'vein' },
  { pattern: /\bsuperior\s+sagittal\s+sinus\b/i, namePl: 'Zatoka strzałkowa górna', nameLt: 'Sinus sagittalis superior', nameEn: 'Superior sagittal sinus', category: 'vein' },
  { pattern: /\binferior\s+sagittal\s+sinus\b/i, namePl: 'Zatoka strzałkowa dolna', nameLt: 'Sinus sagittalis inferior', nameEn: 'Inferior sagittal sinus', category: 'vein' },
  { pattern: /\bstraight\s+sinus\b/i, namePl: 'Zatoka prosta', nameLt: 'Sinus rectus', nameEn: 'Straight sinus', category: 'vein' },
  { pattern: /\btransverse\s+sinus\b/i, namePl: 'Zatoka poprzeczna', nameLt: 'Sinus transversus', nameEn: 'Transverse sinus', category: 'vein' },
  { pattern: /\bsigmoid\s+sinus\b/i, namePl: 'Zatoka esowata', nameLt: 'Sinus sigmoideus', nameEn: 'Sigmoid sinus', category: 'vein' },
  { pattern: /\bcavernous\s+sinus\b/i, namePl: 'Zatoka jamista', nameLt: 'Sinus cavernosus', nameEn: 'Cavernous sinus', category: 'vein' },
  { pattern: /\boccipital\s+sinus\b/i, namePl: 'Zatoka potyliczna', nameLt: 'Sinus occipitalis', nameEn: 'Occipital sinus', category: 'vein' },
  { pattern: /\bsuperior\s+petrosal\s+sinus\b/i, namePl: 'Zatoka skalista górna', nameLt: 'Sinus petrosus superior', nameEn: 'Superior petrosal sinus', category: 'vein' },
  { pattern: /\binferior\s+petrosal\s+sinus\b/i, namePl: 'Zatoka skalista dolna', nameLt: 'Sinus petrosus inferior', nameEn: 'Inferior petrosal sinus', category: 'vein' },
  { pattern: /\banterior\s+intercavernous\s+sinus\b/i, namePl: 'Zatoka międzyjamista przednia', nameLt: 'Sinus intercavernosus anterior', nameEn: 'Anterior intercavernous sinus', category: 'vein' },
  { pattern: /\bposterior\s+intercavernous\s+sinus\b/i, namePl: 'Zatoka międzyjamista tylna', nameLt: 'Sinus intercavernosus posterior', nameEn: 'Posterior intercavernous sinus', category: 'vein' },
  { pattern: /\bcoronary\s+sinus\b/i, namePl: 'Zatoka wieńcowa serca', nameLt: 'Sinus coronarius', nameEn: 'Coronary sinus', structureId: 'org_cor', category: 'vein' },
  { pattern: /\bbasilar\s+venous\s+plexus\b/i, namePl: 'Splot żylny podstawny', nameLt: 'Plexus venosus basilaris', nameEn: 'Basilar venous plexus', category: 'vein' },

  // --- NERVES & CNS ---
  { pattern: /\b(spinal\s+cord|spinal\s+dura|conus\s+medullaris|cauda\s+equina)\b/i, namePl: 'Rdzeń kręgowy', nameLt: 'Medulla spinalis', nameEn: 'Spinal cord', structureId: 'n_medulla_spinalis', category: 'nerve' },
  { pattern: /\bcerebell(um|ar)\b/i, namePl: 'Móżdżek', nameLt: 'Cerebellum', nameEn: 'Cerebellum', structureId: 'n_cerebellum', category: 'nerve' },
  { pattern: /\b(frontal|parietal|temporal|occipital)\s+(lobe|gyrus|gyri|pole|sulcus|sulci|lobule)\b|\bcorpus\s+callosum\b|\bcerebr(um|al\s+hemisphere)\b|\binsula\b|\bhippocampus\b|\bthalamus\b/i, namePl: 'Mózgowie (półkule mózgu)', nameLt: 'Cerebrum (Telencephalon)', nameEn: 'Cerebrum', structureId: 'n_cerebrum', category: 'nerve' },
  { pattern: /\b(trigeminal|ophthalmic|maxillary|mandibular)\s+nerve\b/i, namePl: 'Nerw trójdzielny (V)', nameLt: 'Nervus trigeminus (V)', nameEn: 'Trigeminal nerve', structureId: 'n_trigeminus', category: 'nerve' },
  { pattern: /\binferior\s+alveolar\s+nerve\b/i, namePl: 'Nerw zębodołowy dolny', nameLt: 'Nervus alveolaris inferior', nameEn: 'Inferior alveolar nerve', structureId: 'n_trigeminus', category: 'nerve' },
  { pattern: /\bfacial\s+nerve\b/i, namePl: 'Nerw twarzowy (VII)', nameLt: 'Nervus facialis (VII)', nameEn: 'Facial nerve', structureId: 'n_facialis', category: 'nerve' },
  { pattern: /\bvagus\s+nerve\b/i, namePl: 'Nerw błędny (X)', nameLt: 'Nervus vagus (X)', nameEn: 'Vagus nerve', structureId: 'n_vagus', category: 'nerve' },
  { pattern: /\baccessory\s+nerve\b/i, namePl: 'Nerw dodatkowy (XI)', nameLt: 'Nervus accessorius (XI)', nameEn: 'Accessory nerve (XI)', structureId: 'n_accessorius', category: 'nerve' },
  { pattern: /\bphrenic\s+nerve\b/i, namePl: 'Nerw przeponowy', nameLt: 'Nervus phrenicus', nameEn: 'Phrenic nerve', structureId: 'n_phrenicus', category: 'nerve' },
  { pattern: /\bdorsal\s+scapular\s+nerve\b/i, namePl: 'Nerw grzbietowy łopatki', nameLt: 'Nervus dorsalis scapulae', nameEn: 'Dorsal scapular nerve', structureId: 'n_plexus_brachialis', category: 'nerve' },
  { pattern: /\blateral\s+pectoral\s+nerve\b/i, namePl: 'Nerw piersiowy boczny', nameLt: 'Nervus pectoralis lateralis', nameEn: 'Lateral pectoral nerve', structureId: 'n_plexus_brachialis', category: 'nerve' },
  { pattern: /\bmedial\s+pectoral\s+nerve\b/i, namePl: 'Nerw piersiowy przyśrodkowy', nameLt: 'Nervus pectoralis medialis', nameEn: 'Medial pectoral nerve', structureId: 'n_plexus_brachialis', category: 'nerve' },
  { pattern: /\bsuperior\s+subscapular\s+nerve\b/i, namePl: 'Nerw podłopatkowy górny', nameLt: 'Nervus subscapularis superior', nameEn: 'Superior subscapular nerve', structureId: 'n_plexus_brachialis', category: 'nerve' },
  { pattern: /\binferior\s+subscapular\s+nerve\b/i, namePl: 'Nerw podłopatkowy dolny', nameLt: 'Nervus subscapularis inferior', nameEn: 'Inferior subscapular nerve', structureId: 'n_plexus_brachialis', category: 'nerve' },
  { pattern: /\bbrachial\s+plexus\b|\b(superior|middle|inferior)\s+trunk\s+of\s+brachial|\b(lateral|medial|posterior)\s+cord\b/i, namePl: 'Splot ramienny', nameLt: 'Plexus brachialis', nameEn: 'Brachial plexus', structureId: 'n_plexus_brachialis', category: 'nerve' },
  { pattern: /\bsuprascapular\s+nerve\b/i, namePl: 'Nerw nadłopatkowy', nameLt: 'Nervus suprascapularis', nameEn: 'Suprascapular nerve', structureId: 'n_suprascapularis', category: 'nerve' },
  { pattern: /\blong\s+thoracic\s+nerve\b/i, namePl: 'Nerw piersiowy długi', nameLt: 'Nervus thoracicus longus', nameEn: 'Long thoracic nerve', structureId: 'n_thoracicus_longus', category: 'nerve' },
  { pattern: /\baxillary\s+nerve\b/i, namePl: 'Nerw pachowy', nameLt: 'Nervus axillaris', nameEn: 'Axillary nerve', structureId: 'n_axillaris', category: 'nerve' },
  { pattern: /\bmusculocutaneous\s+nerve\b/i, namePl: 'Nerw mięśniowo-skórny', nameLt: 'Nervus musculocutaneus', nameEn: 'Musculocutaneous nerve', structureId: 'n_musculocutaneus', category: 'nerve' },
  { pattern: /\bradial\s+nerve\b|\bposterior\s+interosseous\s+nerve\b/i, namePl: 'Nerw promieniowy', nameLt: 'Nervus radialis', nameEn: 'Radial nerve', structureId: 'n_radialis', category: 'nerve' },
  { pattern: /\bmedian\s+nerve\b|\banterior\s+interosseous\s+nerve\b/i, namePl: 'Nerw pośrodkowy', nameLt: 'Nervus medianus', nameEn: 'Median nerve', structureId: 'n_medianus', category: 'nerve' },
  { pattern: /\bulnar\s+nerve\b/i, namePl: 'Nerw łokciowy', nameLt: 'Nervus ulnaris', nameEn: 'Ulnar nerve', structureId: 'n_ulnaris', category: 'nerve' },
  { pattern: /\bsaphenous\s+nerve\b/i, namePl: 'Nerw udowo-goleniowy', nameLt: 'Nervus saphenus', nameEn: 'Saphenous nerve', structureId: 'n_femoralis', category: 'nerve' },
  { pattern: /\blateral\s+femoral\s+cutaneous\s+nerve\b/i, namePl: 'Nerw skórny boczny uda', nameLt: 'Nervus cutaneus femoris lateralis', nameEn: 'Lateral femoral cutaneous nerve', category: 'nerve' },
  { pattern: /\bposterior\s+femoral\s+cutaneous\s+nerve\b/i, namePl: 'Nerw skórny tylny uda', nameLt: 'Nervus cutaneus femoris posterior', nameEn: 'Posterior femoral cutaneous nerve', category: 'nerve' },
  { pattern: /\bfemoral\s+nerve\b/i, namePl: 'Nerw udowy', nameLt: 'Nervus femoralis', nameEn: 'Femoral nerve', structureId: 'n_femoralis', category: 'nerve' },
  { pattern: /\bsuperior\s+gluteal\s+nerve\b/i, namePl: 'Nerw pośladkowy górny', nameLt: 'Nervus gluteus superior', nameEn: 'Superior gluteal nerve', structureId: 'n_gluteus_superior', category: 'nerve' },
  { pattern: /\binferior\s+gluteal\s+nerve\b/i, namePl: 'Nerw pośladkowy dolny', nameLt: 'Nervus gluteus inferior', nameEn: 'Inferior gluteal nerve', category: 'nerve' },
  { pattern: /\bsciatic\s+nerve\b/i, namePl: 'Nerw kulszowy', nameLt: 'Nervus ischiadicus', nameEn: 'Sciatic nerve', structureId: 'n_ischiadicus', category: 'nerve' },
  { pattern: /\bmedial\s+plantar\s+nerve\b/i, namePl: 'Nerw podeszwowy przyśrodkowy', nameLt: 'Nervus plantaris medialis', nameEn: 'Medial plantar nerve', structureId: 'n_tibialis', category: 'nerve' },
  { pattern: /\blateral\s+plantar\s+nerve\b/i, namePl: 'Nerw podeszwowy boczny', nameLt: 'Nervus plantaris lateralis', nameEn: 'Lateral plantar nerve', structureId: 'n_tibialis', category: 'nerve' },
  { pattern: /\btibial\s+nerve\b/i, namePl: 'Nerw piszczelowy', nameLt: 'Nervus tibialis', nameEn: 'Tibial nerve', structureId: 'n_tibialis', category: 'nerve' },
  { pattern: /\bdeep\s+(fibular|peroneal)\s+nerve\b/i, namePl: 'Nerw strzałkowy głęboki', nameLt: 'Nervus fibularis profundus', nameEn: 'Deep fibular nerve', structureId: 'n_fibularis_communis', category: 'nerve' },
  { pattern: /\bsuperficial\s+(fibular|peroneal)\s+nerve\b/i, namePl: 'Nerw strzałkowy powierzchowny', nameLt: 'Nervus fibularis superficialis', nameEn: 'Superficial fibular nerve', structureId: 'n_fibularis_communis', category: 'nerve' },
  { pattern: /\bcommon\s+(fibular|peroneal)\s+nerve\b/i, namePl: 'Nerw strzałkowy wspólny', nameLt: 'Nervus fibularis communis', nameEn: 'Common fibular nerve', structureId: 'n_fibularis_communis', category: 'nerve' },
  { pattern: /\bobturator\s+nerve\b/i, namePl: 'Nerw zasłonowy', nameLt: 'Nervus obturatorius', nameEn: 'Obturator nerve', structureId: 'n_obturatorius', category: 'nerve' },
  { pattern: /\bsympathetic\s+trunk\b/i, namePl: 'Pień współczulny', nameLt: 'Truncus sympathicus', nameEn: 'Sympathetic trunk', category: 'nerve' },
  { pattern: /\bganglia\s+of\s+sympathetic\s+trunk\b/i, namePl: 'Zwoje pnia współczulnego', nameLt: 'Ganglia trunci sympathici', nameEn: 'Ganglia of sympathetic trunk', category: 'nerve' },
  { pattern: /\bspinal\s+ganglion\b/i, namePl: 'Zwój rdzeniowy', nameLt: 'Ganglion spinale', nameEn: 'Spinal ganglion', structureId: 'n_medulla_spinalis', category: 'nerve' },
  { pattern: /\bposterior\s+root\s+of\s+spinal\s+nerve\b/i, namePl: 'Korzeń tylny (grzbietowy) nerwu rdzeniowego', nameLt: 'Radix posterior nervi spinalis', nameEn: 'Posterior root of spinal nerve', structureId: 'n_medulla_spinalis', category: 'nerve' },
  { pattern: /\banterior\s+root\s+of\s+spinal\s+nerve\b/i, namePl: 'Korzeń przedni (brzuszny) nerwu rdzeniowego', nameLt: 'Radix anterior nervi spinalis', nameEn: 'Anterior root of spinal nerve', structureId: 'n_medulla_spinalis', category: 'nerve' },

  // --- INTERNAL ORGANS & GLANDS ---
  { pattern: /\b(right|left)\s+(atrium|ventricle)\b|\b(atrioventricular|pulmonary|aortic|mitral|tricuspid)\s+valve\b|\bpapillary\s+muscle\b|\bheart\b/i, namePl: 'Serce', nameLt: 'Cor', nameEn: 'Heart', structureId: 'org_cor', category: 'organ' },
  { pattern: /\b(right|left)?\s*(superior|middle|inferior)?\s*(lobe\s+of\s+)?lung\b/i, namePl: 'Płuco', nameLt: 'Pulmo', nameEn: 'Lung', structureId: 'org_pulmo', category: 'organ' },
  { pattern: /\b(trachea|bronchus|bronchi|carina)\b/i, namePl: 'Tchawica i oskrzela', nameLt: 'Trachea et bronchi', nameEn: 'Trachea and bronchi', structureId: 'org_trachea', category: 'organ' },
  { pattern: /\bo?esophagus\b/i, namePl: 'Przełyk', nameLt: 'Oesophagus', nameEn: 'Esophagus', structureId: 'org_oesophagus', category: 'organ' },
  { pattern: /\bstomach\b|\bcardiac\s+part\s+of\s+stomach\b|\bpylorus\b/i, namePl: 'Żołądek', nameLt: 'Gaster (Ventriculus)', nameEn: 'Stomach', structureId: 'org_gaster', category: 'organ' },
  { pattern: /\bliver\b/i, namePl: 'Wątroba', nameLt: 'Hepar', nameEn: 'Liver', structureId: 'org_hepar', category: 'organ' },
  { pattern: /\bgallbladder\b|\bcystic\s+duct\b|\bcommon\s+bile\s+duct\b|\bbile\s+duct\b/i, namePl: 'Pęcherzyk żółciowy i drogi żółciowe', nameLt: 'Vesica biliaris et ductus choledochus', nameEn: 'Gallbladder and bile duct', structureId: 'org_vesica_biliaris', category: 'organ' },
  { pattern: /\bpancreas\b|\bpancreatic\s+duct\b/i, namePl: 'Trzustka', nameLt: 'Pancreas', nameEn: 'Pancreas', structureId: 'org_pancreas', category: 'organ' },
  { pattern: /\bspleen\b/i, namePl: 'Śledziona', nameLt: 'Splen (Lien)', nameEn: 'Spleen', structureId: 'org_splen', category: 'organ' },
  { pattern: /\b(duodenum|jejunum|ileum|small\s+intestine)\b/i, namePl: 'Jelito cienkie', nameLt: 'Intestinum tenue', nameEn: 'Small intestine', structureId: 'org_intestinum_tenue', category: 'organ' },
  { pattern: /\b(colon|cecum|caecum|rectum|vermiform\s+appendix|taenia)\b/i, namePl: 'Jelito grube (okrężnica)', nameLt: 'Intestinum crassum (Colon)', nameEn: 'Large intestine (Colon)', structureId: 'org_colon', category: 'organ' },
  { pattern: /\b(kidney|ureter|renal\s+pelvis)\b/i, namePl: 'Nerka', nameLt: 'Ren', nameEn: 'Kidney', structureId: 'org_ren', category: 'organ' },
  { pattern: /\bsuprarenal\s+gland\b|\badrenal\s+gland\b/i, namePl: 'Nadnercze', nameLt: 'Glandula suprarenalis', nameEn: 'Suprarenal gland', category: 'organ' },
  { pattern: /\burinary\s+bladder\b|\burethra\b/i, namePl: 'Pęcherz moczowy', nameLt: 'Vesica urinaria', nameEn: 'Urinary bladder', structureId: 'org_vesica_urinaria', category: 'organ' },
  { pattern: /\bthyroid\s+gland\b|\bparathyroid\s+gland\b/i, namePl: 'Gruczoł tarczowy (tarczyca)', nameLt: 'Glandula thyroidea', nameEn: 'Thyroid gland', structureId: 'org_glandula_thyroidea', category: 'organ' },
  { pattern: /\bthymus\b|\blobe\s+of\s+thymus\b/i, namePl: 'Grasica', nameLt: 'Thymus', nameEn: 'Thymus', category: 'organ' },
  { pattern: /\baccessory\s+parotid\s+gland\b/i, namePl: 'Ślinianka przyuszna dodatkowa', nameLt: 'Glandula parotis accessoria', nameEn: 'Accessory parotid gland', category: 'organ' },
  { pattern: /\bparotid\s+gland\b/i, namePl: 'Ślinianka przyuszna', nameLt: 'Glandula parotidea', nameEn: 'Parotid gland', category: 'organ' },
  { pattern: /\bparotid\s+duct\b/i, namePl: 'Przewód przyuszny (Stenona)', nameLt: 'Ductus parotideus', nameEn: 'Parotid duct', category: 'organ' },
  { pattern: /\bsubmandibular\s+gland\b/i, namePl: 'Ślinianka podżuchwowa', nameLt: 'Glandula submandibularis', nameEn: 'Submandibular gland', category: 'organ' },
  { pattern: /\bsubmandibular\s+duct\b/i, namePl: 'Przewód podżuchwowy (Whartona)', nameLt: 'Ductus submandibularis', nameEn: 'Submandibular duct', category: 'organ' },
  { pattern: /\bsublingual\s+gland\b/i, namePl: 'Ślinianka podjęzykowa', nameLt: 'Glandula sublingualis', nameEn: 'Sublingual gland', category: 'organ' },
  { pattern: /\blacrimal\s+gland\b/i, namePl: 'Gruczoł łzowy', nameLt: 'Glandula lacrimalis', nameEn: 'Lacrimal gland', category: 'organ' },
  { pattern: /\bampulla\s+of\s+lacrimal\s+canaliculus\b/i, namePl: 'Bańka kanalika łzowego', nameLt: 'Ampulla canaliculi lacrimalis', nameEn: 'Ampulla of lacrimal canaliculus', category: 'organ' },
  { pattern: /\bnasolacrimal\s+duct\b/i, namePl: 'Przewód nosowo-łzowy', nameLt: 'Ductus nasolacrimalis', nameEn: 'Nasolacrimal duct', category: 'organ' },
  { pattern: /\bpineal\s+gland\b/i, namePl: 'Szyszynka', nameLt: 'Glandula pinealis', nameEn: 'Pineal gland', category: 'organ' },
  { pattern: /\bseminal\s+gland\b/i, namePl: 'Pęcherzyk nasienny', nameLt: 'Glandula vesiculosa', nameEn: 'Seminal gland', category: 'organ' },
  { pattern: /\bejaculatory\s+duct\b/i, namePl: 'Przewód wytryskowy', nameLt: 'Ductus ejaculatorius', nameEn: 'Ejaculatory duct', category: 'organ' },
  { pattern: /\bcorpus\s+cavernosum(\s+of\s+penis)?\b/i, namePl: 'Ciało jamiste', nameLt: 'Corpus cavernosum', nameEn: 'Corpus cavernosum', category: 'organ' },
  { pattern: /\bcorpus\s+spongiosum(\s+of\s+penis)?\b/i, namePl: 'Ciało gąbczaste', nameLt: 'Corpus spongiosum', nameEn: 'Corpus spongiosum', category: 'organ' },
  { pattern: /\buvula\s+of\s+palate\b/i, namePl: 'Języczek podniebienny', nameLt: 'Uvula palatina', nameEn: 'Palatine uvula', category: 'organ' },
  { pattern: /\bmucosa\s+of\s+nasal\s+cavity\b/i, namePl: 'Błona śluzowa jamy nosowej', nameLt: 'Tunica mucosa cavitatis nasi', nameEn: 'Mucosa of nasal cavity', category: 'organ' },
  { pattern: /\btympanic\s+membrane\b/i, namePl: 'Błona bębenkowa', nameLt: 'Membrana tympanica', nameEn: 'Tympanic membrane', category: 'organ' },
  { pattern: /\bvitreous\s+body\b/i, namePl: 'Ciało szkliste oka', nameLt: 'Corpus vitreum', nameEn: 'Vitreous body', category: 'organ' },
  { pattern: /\banterior\s+chamber\s+of\s+eyeball\b/i, namePl: 'Komora przednia gałki ocznej', nameLt: 'Camera anterior bulbi', nameEn: 'Anterior chamber of eyeball', category: 'organ' },
  { pattern: /\banterior\s+segment\s+of\s+eyeball\b/i, namePl: 'Odcinek przedni gałki ocznej', nameLt: 'Segmentum anterius bulbi', nameEn: 'Anterior segment of eyeball', category: 'organ' },
  { pattern: /\bposterior\s+segment\s+of\s+eyeball\b/i, namePl: 'Odcinek tylny gałki ocznej', nameLt: 'Segmentum posterius bulbi', nameEn: 'Posterior segment of eyeball', category: 'organ' },

  // --- ARTICULAR DISCS, LABRA, MENISCI & FAT PADS ---
  { pattern: /\barticular\s+disc\s+of\s+temporomandibular\s+joint\b/i, namePl: 'Krążek stawowy stawu skroniowo-żuchwowego', nameLt: 'Discus articularis temporomandibularis', nameEn: 'Articular disc of temporomandibular joint', category: 'joint_ligament', isCartilage: true },
  { pattern: /\barticular\s+disc\s+of\s+sternoclavicular\s+joint\b/i, namePl: 'Krążek stawowy stawu mostkowo-obojczykowego', nameLt: 'Discus articularis sternoclavicularis', nameEn: 'Articular disc of sternoclavicular joint', category: 'joint_ligament', isCartilage: true },
  { pattern: /\barticular\s+disc\s+of\s+distal\s+radio-?ulnar\s+joint\b/i, namePl: 'Krążek stawowy stawu promieniowo-łokciowego dalszego (TFCC)', nameLt: 'Discus articularis radioulnaris distalis', nameEn: 'Articular disc of distal radioulnar joint', category: 'joint_ligament', isCartilage: true },
  { pattern: /\bacetabular\s+labrum\b/i, namePl: 'Obrąbek panewkowy stawu biodrowego', nameLt: 'Labrum acetabulare', nameEn: 'Acetabular labrum', category: 'joint_ligament', isCartilage: true },
  { pattern: /\bglenoid\s+labrum\b|\blabrum\s+glenoidale\b/i, namePl: 'Obrąbek stawowy łopatki', nameLt: 'Labrum glenoidale', nameEn: 'Glenoid labrum', structureId: 'labrum_glenoidale', category: 'joint_ligament', isCartilage: true },
  { pattern: /\bmedial\s+meniscus\b|\bmeniscus\s+medialis\b/i, namePl: 'Łąkotka przyśrodkowa', nameLt: 'Meniscus medialis', nameEn: 'Medial meniscus', structureId: 'meniscus_medialis', category: 'joint_ligament', isCartilage: true },
  { pattern: /\blateral\s+meniscus\b|\bmeniscus\s+lateralis\b/i, namePl: 'Łąkotka boczna', nameLt: 'Meniscus lateralis', nameEn: 'Lateral meniscus', structureId: 'meniscus_lateralis', category: 'joint_ligament', isCartilage: true },
  { pattern: /\btriradiate\s+cartilage\b/i, namePl: 'Chrząstka trójramienna (Y) panewki', nameLt: 'Cartilago triradiata acetabuli', nameEn: 'Triradiate cartilage', category: 'joint_ligament', isCartilage: true },
  { pattern: /\binfrapatellar\s+fat\s+pad\b/i, namePl: 'Ciało tłuszczowe podrzepkowe (Hoffy)', nameLt: 'Corpus adiposum infrapatellare', nameEn: 'Infrapatellar fat pad', category: 'ligament' },

  // --- LIGAMENTS, MEMBRANES & ARTICULAR CAPSULES ---
  { pattern: /\biliofemoral\s+ligament\b/i, namePl: 'Więzadło biodrowo-udowe (Bertina)', nameLt: 'Ligamentum iliofemorale', nameEn: 'Iliofemoral ligament', structureId: 'lig_iliofemorale', category: 'ligament' },
  { pattern: /\bischiofemoral\s+ligament\b/i, namePl: 'Więzadło kulszowo-udowe', nameLt: 'Ligamentum ischiofemorale', nameEn: 'Ischiofemoral ligament', structureId: 'lig_ischiofemorale', category: 'ligament' },
  { pattern: /\bpubofemoral\s+ligament\b/i, namePl: 'Więzadło łonowo-udowe', nameLt: 'Ligamentum pubofemorale', nameEn: 'Pubofemoral ligament', structureId: 'lig_pubofemorale', category: 'ligament' },
  { pattern: /\bsacrotuberous\s+ligament\b/i, namePl: 'Więzadło krzyżowo-guzowe', nameLt: 'Ligamentum sacrotuberale', nameEn: 'Sacrotuberous ligament', structureId: 'lig_sacrotuberale', category: 'ligament' },
  { pattern: /\bsacrospinous\s+ligament\b/i, namePl: 'Więzadło krzyżowo-kolcowe', nameLt: 'Ligamentum sacrospinale', nameEn: 'Sacrospinous ligament', category: 'ligament' },
  { pattern: /\biliolumbar\s+ligament\b/i, namePl: 'Więzadło biodrowo-lędźwiowe', nameLt: 'Ligamentum iliolumbale', nameEn: 'Iliolumbar ligament', category: 'ligament' },
  { pattern: /\banterior\s+longitudinal\s+ligament\b/i, namePl: 'Więzadło podłużne przednie', nameLt: 'Ligamentum longitudinale anterius', nameEn: 'Anterior longitudinal ligament', structureId: 'lig_longitudinale_anterius', category: 'ligament' },
  { pattern: /\bposterior\s+longitudinal\s+ligament\b/i, namePl: 'Więzadło podłużne tylne', nameLt: 'Ligamentum longitudinale posterius', nameEn: 'Posterior longitudinal ligament', category: 'ligament' },
  { pattern: /\b(ligamentum|ligamenta)\s+flav(um|a)\b|\byellow\s+ligament\b/i, namePl: 'Więzadło żółte', nameLt: 'Ligamentum flavum', nameEn: 'Ligamentum flavum', structureId: 'lig_flavum', category: 'ligament' },
  { pattern: /\bsupraspinous\s+ligament\b/i, namePl: 'Więzadło nadkolcowe', nameLt: 'Ligamentum supraspinale', nameEn: 'Supraspinous ligament', category: 'ligament' },
  { pattern: /\binterspinous\s+ligaments?\b/i, namePl: 'Więzadła międzykolcowe', nameLt: 'Ligamenta interspinalia', nameEn: 'Interspinous ligaments', category: 'ligament' },
  { pattern: /\bnuchal\s+ligament\b/i, namePl: 'Więzadło karkowe', nameLt: 'Ligamentum nuchae', nameEn: 'Nuchal ligament', category: 'ligament' },
  { pattern: /\btrapezoid\s+ligament\b/i, namePl: 'Więzadło czworoboczne (część więzadła kruczo-obojczykowego)', nameLt: 'Ligamentum trapezoideum', nameEn: 'Trapezoid ligament', structureId: 'lig_coracoclaviculare', category: 'ligament' },
  { pattern: /\bconoid\s+ligament\b/i, namePl: 'Więzadło stożkowate (część więzadła kruczo-obojczykowego)', nameLt: 'Ligamentum conoideum', nameEn: 'Conoid ligament', structureId: 'lig_coracoclaviculare', category: 'ligament' },
  { pattern: /\bcoracoclavicular\s+ligament\b/i, namePl: 'Więzadło kruczo-obojczykowe', nameLt: 'Ligamentum coracoclaviculare', nameEn: 'Coracoclavicular ligament', structureId: 'lig_coracoclaviculare', category: 'ligament' },
  { pattern: /\bcoraco-?acromial\s+ligament\b|\blig\s+coracoacromiale\b/i, namePl: 'Więzadło kruczo-barkowe', nameLt: 'Ligamentum coracoacromiale', nameEn: 'Coracoacromial ligament', structureId: 'lig_coracoacromiale', category: 'joint_ligament' },
  { pattern: /\bcoracohumeral\s+ligament\b/i, namePl: 'Więzadło kruczo-ramienne', nameLt: 'Ligamentum coracohumerale', nameEn: 'Coracohumeral ligament', category: 'ligament' },
  { pattern: /\btransverse\s+humeral\s+ligament\b/i, namePl: 'Więzadło poprzeczne ramienia (Brodiego)', nameLt: 'Ligamentum transversum humeri', nameEn: 'Transverse humeral ligament', category: 'ligament' },
  { pattern: /\bsuperior\s+transverse\s+scapular\s+ligament\b/i, namePl: 'Więzadło poprzeczne łopatki górne', nameLt: 'Ligamentum transversum scapulae superius', nameEn: 'Superior transverse scapular ligament', category: 'ligament' },
  { pattern: /\binferior\s+transverse\s+scapular\s+ligament\b/i, namePl: 'Więzadło poprzeczne łopatki dolne', nameLt: 'Ligamentum transversum scapulae inferius', nameEn: 'Inferior transverse scapular ligament', category: 'ligament' },
  { pattern: /\bcostoclavicular\s+ligament\b/i, namePl: 'Więzadło żebrowo-obojczykowe', nameLt: 'Ligamentum costoclaviculare', nameEn: 'Costoclavicular ligament', category: 'ligament' },
  { pattern: /\binterclavicular\s+ligament\b/i, namePl: 'Więzadło międzyobojczykowe', nameLt: 'Ligamentum interclaviculare', nameEn: 'Interclavicular ligament', category: 'ligament' },
  { pattern: /\bannular\s+ligament\s+of\s+radius\b/i, namePl: 'Więzadło pierścieniowate kości promieniowej', nameLt: 'Ligamentum anulare radii', nameEn: 'Annular ligament of radius', structureId: 'lig_annulare_radii', category: 'ligament' },
  { pattern: /\bquadrate\s+ligament\b/i, namePl: 'Więzadło czworokątne stawu łokciowego', nameLt: 'Ligamentum quadratum', nameEn: 'Quadrate ligament', category: 'ligament' },
  { pattern: /\boblique\s+cord\b/i, namePl: 'Struna skośna przedramienia', nameLt: 'Chorda obliqua', nameEn: 'Oblique cord', category: 'ligament' },
  { pattern: /\binterosseous\s+membrane\s+of\s+forearm\b/i, namePl: 'Błona międzykostna przedramienia', nameLt: 'Membrana interossea antebrachii', nameEn: 'Interosseous membrane of forearm', category: 'ligament' },
  { pattern: /\binterosseous\s+membrane\s+of\s+leg\b/i, namePl: 'Błona międzykostna goleni', nameLt: 'Membrana interossea cruris', nameEn: 'Interosseous membrane of leg', category: 'ligament' },
  { pattern: /\bobturator\s+membrane\b/i, namePl: 'Błona zasłonowa', nameLt: 'Membrana obturatoria', nameEn: 'Obturator membrane', category: 'ligament' },
  { pattern: /\bquadrangular\s+membrane\b/i, namePl: 'Błona czworokątna krtani', nameLt: 'Membrana quadrangularis', nameEn: 'Quadrangular membrane', category: 'ligament' },
  { pattern: /\banterior\s+talofibular\s+ligament\b/i, namePl: 'Więzadło skokowo-strzałkowe przednie (ATFL)', nameLt: 'Ligamentum talofibulare anterius', nameEn: 'Anterior talofibular ligament', structureId: 'lig_talofibulare_anterius', category: 'ligament' },
  { pattern: /\bposterior\s+talofibular\s+ligament\b/i, namePl: 'Więzadło skokowo-strzałkowe tylne (PTFL)', nameLt: 'Ligamentum talofibulare posterius', nameEn: 'Posterior talofibular ligament', category: 'ligament' },
  { pattern: /\bcalcaneofibular\s+ligament\b/i, namePl: 'Więzadło piętowo-strzałkowe (CFL)', nameLt: 'Ligamentum calcaneofibulare', nameEn: 'Calcaneofibular ligament', category: 'ligament' },
  { pattern: /\bplantar\s+calcaneonavicular\s+ligament\b/i, namePl: 'Więzadło piętowo-łódkowe podeszwowe (sprężyste)', nameLt: 'Ligamentum calcaneonaviculare plantare', nameEn: 'Plantar calcaneonavicular (spring) ligament', category: 'ligament' },
  { pattern: /\blong\s+plantar\s+ligament\b/i, namePl: 'Więzadło podeszwowe długie', nameLt: 'Ligamentum plantare longum', nameEn: 'Long plantar ligament', category: 'ligament' },
  { pattern: /\b(deltoid|tibiocalcaneal|tibionavicular|tibiotalar)\s+ligament\b/i, namePl: 'Więzadło przyśrodkowe (trójgraniaste) stawu skokowego', nameLt: 'Ligamentum collaterale mediale (deltoideum)', nameEn: 'Medial collateral (deltoid) ligament of ankle', structureId: 'lig_deltoideum_ankle', category: 'ligament' },
  { pattern: /\banterior\s+cruciate\s+ligament\b|\banterior\s+cruciate\b|\bacl\b|\bligamentum\s+cruciatum\s+anterius\b/i, namePl: 'Więzadło krzyżowe przednie (ACL)', nameLt: 'Ligamentum cruciatum anterius', nameEn: 'Anterior cruciate ligament (ACL)', structureId: 'acl', category: 'joint_ligament' },
  { pattern: /\bposterior\s+cruciate\s+ligament\b|\bposterior\s+cruciate\b|\bpcl\b|\bligamentum\s+cruciatum\s+posterius\b/i, namePl: 'Więzadło krzyżowe tylne (PCL)', nameLt: 'Ligamentum cruciatum posterius', nameEn: 'Posterior cruciate ligament (PCL)', structureId: 'pcl', category: 'joint_ligament' },
  { pattern: /\btibial\s+collateral\s+ligament\b|\bmcl\b/i, namePl: 'Więzadło poboczne piszczelowe (MCL)', nameLt: 'Ligamentum collaterale tibiale', nameEn: 'Tibial collateral ligament (MCL)', structureId: 'mcl', category: 'joint_ligament' },
  { pattern: /\bfibular\s+collateral\s+ligament\b|\blcl\b/i, namePl: 'Więzadło poboczne strzałkowe (LCL)', nameLt: 'Ligamentum collaterale fibulare', nameEn: 'Fibular collateral ligament (LCL)', structureId: 'lcl', category: 'joint_ligament' },
  { pattern: /\bpatellar\s+ligament\b|\bligamentum\s+patellae\b/i, namePl: 'Więzadło rzepki', nameLt: 'Ligamentum patellae', nameEn: 'Patellar ligament', structureId: 'lig_patellae', category: 'ligament' },
  { pattern: /\boblique\s+popliteal\s+ligament\b/i, namePl: 'Więzadło podkolanowe skośne', nameLt: 'Ligamentum popliteum obliquum', nameEn: 'Oblique popliteal ligament', category: 'ligament' },
  { pattern: /\barcuate\s+popliteal\s+ligament\b/i, namePl: 'Więzadło podkolanowe łukowate', nameLt: 'Ligamentum popliteum arcuatum', nameEn: 'Arcuate popliteal ligament', category: 'ligament' },
  { pattern: /\bpopliteofibular\s+ligament\b/i, namePl: 'Więzadło podkolanowo-strzałkowe', nameLt: 'Ligamentum popliteofibulare', nameEn: 'Popliteofibular ligament', category: 'ligament' },
  { pattern: /\btransverse\s+ligament\s+of\s+knee\b/i, namePl: 'Więzadło poprzeczne kolana', nameLt: 'Ligamentum transversum genus', nameEn: 'Transverse ligament of knee', category: 'ligament' },
  { pattern: /\bmeniscopatellar\s+ligament\b/i, namePl: 'Więzadło łąkotkowo-rzepkowe', nameLt: 'Ligamentum meniscopatellare', nameEn: 'Meniscopatellar ligament', category: 'ligament' },
  { pattern: /\banterior\s+meniscotibial\s+ligament\b/i, namePl: 'Więzadło łąkotkowo-piszczelowe przednie (wieńcowe)', nameLt: 'Ligamentum meniscotibiale anterius', nameEn: 'Anterior meniscotibial ligament', category: 'ligament' },
  { pattern: /\bposterior\s+meniscotibial\s+ligament\b/i, namePl: 'Więzadło łąkotkowo-piszczelowe tylne (wieńcowe)', nameLt: 'Ligamentum meniscotibiale posterius', nameEn: 'Posterior meniscotibial ligament', category: 'ligament' },
  { pattern: /\btransverse\s+acetabular\s+ligament\b/i, namePl: 'Więzadło poprzeczne panewki', nameLt: 'Ligamentum transversum acetabuli', nameEn: 'Transverse acetabular ligament', category: 'ligament' },

  // =========================================================================
  // PRECEDENCE 2: BURSAE (Kaletki maziowe)
  // =========================================================================
  { pattern: /\biliopectineal\s+bursa\b/i, namePl: 'Kaletka biodrowo-grzebieniowa', nameLt: 'Bursa iliopectinea', nameEn: 'Iliopectineal bursa', structureId: 'bursa_iliopectinea', category: 'bursa' },
  { pattern: /\banserine\s+bursa\b/i, namePl: 'Kaletka gęsiej stopki', nameLt: 'Bursa anserina', nameEn: 'Anserine bursa', structureId: 'bursa_anserina', category: 'bursa' },
  { pattern: /\bbicipitoradial\s+bursa\b/i, namePl: 'Kaletka dwugłowo-promieniowa', nameLt: 'Bursa bicipitoradialis', nameEn: 'Bicipitoradial bursa', category: 'bursa' },
  { pattern: /\bbursa\s+of\s+piriformis\b/i, namePl: 'Kaletka mięśnia gruszkowatego', nameLt: 'Bursa musculi piriformis', nameEn: 'Bursa of piriformis muscle', category: 'bursa' },
  { pattern: /\bcoracobrachial\s+bursa\b/i, namePl: 'Kaletka kruczo-ramienna', nameLt: 'Bursa coracobrachialis', nameEn: 'Coracobrachial bursa', category: 'bursa' },
  { pattern: /\bdeep\s+infrapatellar\s+bursa\b/i, namePl: 'Kaletka podrzepkowa głęboka', nameLt: 'Bursa infrapatellaris profunda', nameEn: 'Deep infrapatellar bursa', structureId: 'bursa_infrapatellaris_profunda', category: 'bursa' },
  { pattern: /\binferior\s+subtendinous\s+bursa\s+of\s+biceps\s+femoris\b/i, namePl: 'Kaletka podścięgnowa dolna mięśnia dwugłowego uda', nameLt: 'Bursa subtendinea musculi bicipitis femoris inferior', nameEn: 'Inferior subtendinous bursa of biceps femoris', category: 'bursa' },
  { pattern: /\bintermuscular\s+gluteal\s+bursae?\b/i, namePl: 'Kaletki międzymięśniowe pośladkowe', nameLt: 'Bursae intermusculares musculorum gluteorum', nameEn: 'Intermuscular gluteal bursae', category: 'bursa' },
  { pattern: /\blateral\s+subtendinous\s+bursa\s+of\s+gastrocnemius\b/i, namePl: 'Kaletka podścięgnowa boczna mięśnia brzuchatego łydki', nameLt: 'Bursa subtendinea musculi gastrocnemii lateralis', nameEn: 'Lateral subtendinous bursa of gastrocnemius', category: 'bursa' },
  { pattern: /\bmedial\s+subtendinous\s+bursa\s+of\s+gastrocnemius\b/i, namePl: 'Kaletka podścięgnowa przyśrodkowa mięśnia brzuchatego łydki', nameLt: 'Bursa subtendinea musculi gastrocnemii medialis', nameEn: 'Medial subtendinous bursa of gastrocnemius', category: 'bursa' },
  { pattern: /\bsciatic\s+bursa\s+of\s+gluteus\s+maximus\b/i, namePl: 'Kaletka kulszowa mięśnia pośladkowego wielkiego', nameLt: 'Bursa ischiadica musculi glutei maximi', nameEn: 'Sciatic bursa of gluteus maximus', category: 'bursa' },
  { pattern: /\bsciatic\s+bursa\s+of\s+obturator\s+internus\b/i, namePl: 'Kaletka kulszowa mięśnia zasłaniacza wewnętrznego', nameLt: 'Bursa ischiadica musculi obturatorii interni', nameEn: 'Sciatic bursa of obturator internus', category: 'bursa' },
  { pattern: /\bsemimembranosus\s+bursa\b/i, namePl: 'Kaletka mięśnia półbłoniastego', nameLt: 'Bursa musculi semimembranosi', nameEn: 'Semimembranosus bursa', category: 'bursa' },
  { pattern: /\bsubacromial\s+bursa\b/i, namePl: 'Kaletka podbarkowa', nameLt: 'Bursa subacromialis', nameEn: 'Subacromial bursa', structureId: 'bursa_subacromialis', category: 'bursa' },
  { pattern: /\bsubcutaneous\s+acromial\s+bursa\b/i, namePl: 'Kaletka podskórna barkowa', nameLt: 'Bursa subcutanea acromialis', nameEn: 'Subcutaneous acromial bursa', category: 'bursa' },
  { pattern: /\bsubcutaneous\s+bursa\s+of\s+lateral\s+malleolus\b/i, namePl: 'Kaletka podskórna kostki bocznej', nameLt: 'Bursa subcutanea malleoli lateralis', nameEn: 'Subcutaneous bursa of lateral malleolus', category: 'bursa' },
  { pattern: /\bsubcutaneous\s+bursa\s+of\s+medial\s+malleolus\b/i, namePl: 'Kaletka podskórna kostki przyśrodkowej', nameLt: 'Bursa subcutanea malleoli medialis', nameEn: 'Subcutaneous bursa of medial malleolus', category: 'bursa' },
  { pattern: /\bsubcutaneous\s+bursa\s+of\s+(?:tuberosity\s+of\s+tibia|tibial\s+tuberosity)\b/i, namePl: 'Kaletka podskórna guzowatości piszczeli', nameLt: 'Bursa subcutanea tuberositatis tibiae', nameEn: 'Subcutaneous bursa of tibial tuberosity', category: 'bursa' },
  { pattern: /\bsubcutaneous\s+calcaneal\s+bursa\b/i, namePl: 'Kaletka podskórna piętowa', nameLt: 'Bursa subcutanea calcanea', nameEn: 'Subcutaneous calcaneal bursa', category: 'bursa' },
  { pattern: /\bsubcutaneous\s+infrapatellar\s+bursa\b/i, namePl: 'Kaletka podskórna podrzepkowa', nameLt: 'Bursa subcutanea infrapatellaris', nameEn: 'Subcutaneous infrapatellar bursa', category: 'bursa' },
  { pattern: /\bsubcutaneous\s+prepatellar\s+bursa\b/i, namePl: 'Kaletka przedrzepkowa podskórna', nameLt: 'Bursa subcutanea praepatellaris', nameEn: 'Subcutaneous prepatellar bursa', structureId: 'bursa_praepatellaris', category: 'bursa' },
  { pattern: /\bsubcutaneous\s+trochanteric\s+bursa\b/i, namePl: 'Kaletka podskórna krętarzowa', nameLt: 'Bursa subcutanea trochanterica', nameEn: 'Subcutaneous trochanteric bursa', category: 'bursa' },
  { pattern: /\bsubdeltoid\s+bursa\b/i, namePl: 'Kaletka podnaramienna', nameLt: 'Bursa subdeltoidea', nameEn: 'Subdeltoid bursa', structureId: 'bursa_subdeltoidea', category: 'bursa' },
  { pattern: /\bsubfa(?:s)?cial\s+prepatellar\s+bursa\b/i, namePl: 'Kaletka podpowięziowa przedrzepkowa', nameLt: 'Bursa subfascialis praepatellaris', nameEn: 'Subfascial prepatellar bursa', category: 'bursa' },
  { pattern: /\bsubtendinous\s+bursa\s+of\s+iliacus\b/i, namePl: 'Kaletka podścięgnowa mięśnia biodrowego', nameLt: 'Bursa subtendinea iliaca', nameEn: 'Subtendinous bursa of iliacus', category: 'bursa' },
  { pattern: /\bsubtendinous\s+bursa\s+of\s+infraspinatus\b/i, namePl: 'Kaletka podścięgnowa mięśnia podgrzebieniowego', nameLt: 'Bursa subtendinea musculi infraspinati', nameEn: 'Subtendinous bursa of infraspinatus', category: 'bursa' },
  { pattern: /\bsubtendinous\s+bursa\s+of\s+obturator\s+internus\b/i, namePl: 'Kaletka podścięgnowa mięśnia zasłaniacza wewnętrznego', nameLt: 'Bursa subtendinea musculi obturatorii interni', nameEn: 'Subtendinous bursa of obturator internus', category: 'bursa' },
  { pattern: /\bsubtendinous\s+bursa\s+of\s+sartorius\b/i, namePl: 'Kaletka podścięgnowa mięśnia krawieckiego', nameLt: 'Bursa subtendinea musculi sartorii', nameEn: 'Subtendinous bursa of sartorius', category: 'bursa' },
  { pattern: /\bsubtendinous\s+bursa\s+of\s+teres\s+major\b/i, namePl: 'Kaletka podścięgnowa mięśnia obłego większego', nameLt: 'Bursa subtendinea musculi teretis majoris', nameEn: 'Subtendinous bursa of teres major', category: 'bursa' },
  { pattern: /\bsubtendinous\s+bursa\s+of\s+tibialis\s+anterior\b/i, namePl: 'Kaletka podścięgnowa mięśnia piszczelowego przedniego', nameLt: 'Bursa subtendinea musculi tibialis anterioris', nameEn: 'Subtendinous bursa of tibialis anterior', category: 'bursa' },
  { pattern: /\bsubtendinous\s+bursa\s+of\s+trapezius\b/i, namePl: 'Kaletka podścięgnowa mięśnia czworobocznego', nameLt: 'Bursa subtendinea musculi trapezii', nameEn: 'Subtendinous bursa of trapezius', category: 'bursa' },
  { pattern: /\bsubtendinous\s+bursa\s+of\s+triceps\s+brachii\b/i, namePl: 'Kaletka podścięgnowa mięśnia trójgłowego ramienia', nameLt: 'Bursa subtendinea musculi tricipitis brachii', nameEn: 'Subtendinous bursa of triceps brachii', structureId: 'bursa_subtendinea_tricipitis', category: 'bursa' },
  { pattern: /\bsubtendinous\s+calcaneal\s+bursa\b/i, namePl: 'Kaletka podścięgnowa piętowa (ścięgna Achillesa)', nameLt: 'Bursa tendinis calcanei', nameEn: 'Subtendinous calcaneal bursa', structureId: 'bursa_calcanea', category: 'bursa' },
  { pattern: /\bsubtendinous\s+prepatellar\s+bursa\b/i, namePl: 'Kaletka podścięgnowa przedrzepkowa', nameLt: 'Bursa subtendinea praepatellaris', nameEn: 'Subtendinous prepatellar bursa', category: 'bursa' },
  { pattern: /\bsuperior\s+bursa\s+of\s+biceps\s+femoris\b/i, namePl: 'Kaletka górna mięśnia dwugłowego uda', nameLt: 'Bursa musculi bicipitis femoris superior', nameEn: 'Superior bursa of biceps femoris', category: 'bursa' },
  { pattern: /\bsuprapatellar\s+bursa\b/i, namePl: 'Kaletka nadrzepkowa', nameLt: 'Bursa suprapatellaris', nameEn: 'Suprapatellar bursa', structureId: 'bursa_suprapatellaris', category: 'bursa' },
  { pattern: /\btrochanteric\s+bursa\s+of\s+gluteus\s+maximus\b/i, namePl: 'Kaletka krętarzowa mięśnia pośladkowego wielkiego', nameLt: 'Bursa trochanterica musculi glutei maximi', nameEn: 'Trochanteric bursa of gluteus maximus', structureId: 'bursa_trochanterica', category: 'bursa' },
  { pattern: /\btrochanteric\s+bursa\s+of\s+gluteus\s+medius\b/i, namePl: 'Kaletka krętarzowa mięśnia pośladkowego średniego', nameLt: 'Bursa trochanterica musculi glutei medii', nameEn: 'Trochanteric bursa of gluteus medius', category: 'bursa' },
  { pattern: /\btrochanteric\s+bursa\s+of\s+gluteus\s+minimus\b/i, namePl: 'Kaletka krętarzowa mięśnia pośladkowego małego', nameLt: 'Bursa trochanterica musculi glutei minimi', nameEn: 'Trochanteric bursa of gluteus minimus', category: 'bursa' },
  { pattern: /\bbursae?\b/i, namePl: 'Kaletka maziowa', nameLt: 'Bursa synovialis', nameEn: 'Synovial bursa', category: 'bursa' },

  // =========================================================================
  // PRECEDENCE 3: TENDONS, APONEUROSES, RETINACULA & TENDON SHEATHS
  // =========================================================================
  { pattern: /\bachilles\b|\btendo\s+calcaneus\b|\bcalcaneal\s+tendon\b/i, namePl: 'Ścięgno Achillesa (piętowe)', nameLt: 'Tendo calcaneus', nameEn: 'Achilles tendon (Calcaneal tendon)', structureId: 'achilles_tendon', category: 'tendon' },
  { pattern: /\bquadriceps(\s+femoris)?\s+tendon\b/i, namePl: 'Ścięgno mięśnia czworogłowego uda', nameLt: 'Tendo musculi quadricipitis femoris', nameEn: 'Quadriceps femoris tendon', structureId: 'tendon_quadriceps', category: 'tendon' },
  { pattern: /\biliotibial\s+tract\b|\btractus\s+iliotibialis\b/i, namePl: 'Pasmo biodrowo-piszczelowe', nameLt: 'Tractus iliotibialis', nameEn: 'Iliotibial tract', structureId: 'tractus_iliotibialis', category: 'tendon' },
  { pattern: /\bpalmar\s+aponeurosis\b/i, namePl: 'Rozcięgno dłoniowe', nameLt: 'Aponeurosis palmaris', nameEn: 'Palmar aponeurosis', structureId: 'aponeurosis_palmaris', category: 'tendon' },
  { pattern: /\bplantar\s+aponeurosis\b/i, namePl: 'Rozcięgno podeszwowe', nameLt: 'Aponeurosis plantaris', nameEn: 'Plantar aponeurosis', structureId: 'aponeurosis_plantaris', category: 'tendon' },
  { pattern: /\blateral\s+patellar\s+retinaculum\b/i, namePl: 'Troczek rzepki boczny', nameLt: 'Retinaculum patellae laterale', nameEn: 'Lateral patellar retinaculum', category: 'tendon' },
  { pattern: /\bmedial\s+patellar\s+retinaculum\b/i, namePl: 'Troczek rzepki przyśrodkowy', nameLt: 'Retinaculum patellae mediale', nameEn: 'Medial patellar retinaculum', category: 'tendon' },
  { pattern: /\bcommon\s+flexor\s+tendon\s+sheath\b/i, namePl: 'Pochewka wspólna zginaczy palców (kaletka łokciowa)', nameLt: 'Vagina communis tendinum musculorum flexorum', nameEn: 'Common flexor tendon sheath', structureId: 'tendon_common_flexor_sheath', category: 'tendon' },
  { pattern: /\bcommon\s+tendon\s+sheath\s+of\s+fibularis\s+muscles\b/i, namePl: 'Pochewka wspólna mięśni strzałkowych', nameLt: 'Vagina communis tendinum musculorum fibularium', nameEn: 'Common tendon sheath of fibularis muscles', structureId: 'tendon_fibularis_sheath', category: 'tendon' },
  { pattern: /\bcruciform\s+part\s+of\s+fibrous\s+sheath\s+of\s+digit\s+of\s+hand\b/i, namePl: 'Część krzyżowa pochewki włóknistej palca ręki', nameLt: 'Pars cruciformis vaginae fibrosae digiti manus', nameEn: 'Cruciform part of fibrous digital sheath (hand)', category: 'tendon' },
  { pattern: /\bintertubercular\s+tendon\s+sheath\b/i, namePl: 'Pochewka międzyguzkowa ścięgna głowy długiej bicepsa', nameLt: 'Vagina tendinis intertubercularis', nameEn: 'Intertubercular tendon sheath', structureId: 'tendon_intertubercular_sheath', category: 'tendon' },
  { pattern: /\bplantar\s+tendon\s+sheath\s+of\s+fibularis\s+longus\b/i, namePl: 'Pochewka podeszwowa ścięgna mięśnia strzałkowego długiego', nameLt: 'Vagina plantaris tendinis musculi fibularis longi', nameEn: 'Plantar tendon sheath of fibularis longus', category: 'tendon' },
  { pattern: /\bsynovial\s+sheaths?\s+of\s+digits\s+of\s+hand\b|\btendon\s+sheaths?\s+of\s+digits\s+of\s+hand\b/i, namePl: 'Pochewki maziowe palców ręki', nameLt: 'Vaginae synoviales digitorum manus', nameEn: 'Synovial sheaths of digits of hand', category: 'tendon' },
  { pattern: /\btendon\s+sheaths?\s+of\s+toes\b/i, namePl: 'Pochewki ścięgien palców stopy', nameLt: 'Vaginae tendinum digitorum pedis', nameEn: 'Tendon sheaths of toes', category: 'tendon' },
  { pattern: /\btendon\s+sheath[\s-]+abd\b/i, namePl: 'Pochewka ścięgnista odwodziciela długiego i prostownika krótkiego kciuka (I przedział)', nameLt: 'Vagina tendinum musculorum abductoris longi et extensoris brevis pollicis', nameEn: 'Tendon sheath of abductor pollicis longus and extensor pollicis brevis', category: 'tendon' },
  { pattern: /\btendon\s+sheath\s+of\s+extensor\s+carpi\s+ulnaris\b/i, namePl: 'Pochewka ścięgna prostownika łokciowego nadgarstka (VI przedział)', nameLt: 'Vagina tendinis musculi extensoris carpi ulnaris', nameEn: 'Tendon sheath of extensor carpi ulnaris', category: 'tendon' },
  { pattern: /\btendon\s+sheath\s+of\s+extensor\s+digiti\s+minimi(\s+manus)?\b/i, namePl: 'Pochewka ścięgna prostownika palca małego ręki (V przedział)', nameLt: 'Vagina tendinis musculi extensoris digiti minimi', nameEn: 'Tendon sheath of extensor digiti minimi', category: 'tendon' },
  { pattern: /\btendon\s+sheath\s+of\s+extensor\s+digitorum\s+and\s+extensor\s+indicis\b/i, namePl: 'Pochewka prostowników palców i wskaziciela (IV przedział)', nameLt: 'Vagina tendinum musculorum extensoris digitorum et extensoris indicis', nameEn: 'Tendon sheath of extensor digitorum and extensor indicis', structureId: 'tendon_extensor_digitorum_sheath', category: 'tendon' },
  { pattern: /\btendon\s+sheath\s+of\s+extensor\s+digitorum\s+longus\b/i, namePl: 'Pochewka ścięgna prostownika długiego palców stopy', nameLt: 'Vagina tendinum musculi extensoris digitorum longi', nameEn: 'Tendon sheath of extensor digitorum longus', category: 'tendon' },
  { pattern: /\btendon\s+sheath\s+of\s+extensor\s+hallucis\s+longus\b/i, namePl: 'Pochewka ścięgna prostownika długiego palucha', nameLt: 'Vagina tendinis musculi extensoris hallucis longi', nameEn: 'Tendon sheath of extensor hallucis longus', category: 'tendon' },
  { pattern: /\btendon\s+sheath\s+of\s+extensor\s+pollicis\s+longus\b/i, namePl: 'Pochewka ścięgna prostownika długiego kciuka (III przedział)', nameLt: 'Vagina tendinis musculi extensoris pollicis longi', nameEn: 'Tendon sheath of extensor pollicis longus', category: 'tendon' },
  { pattern: /\btendon\s+sheath\s+of\s+extensors\s+carpi\s+radialis\b/i, namePl: 'Pochewka ścięgien prostowników promieniowych nadgarstka (II przedział)', nameLt: 'Vagina tendinum musculorum extensorum carpi radialium', nameEn: 'Tendon sheath of extensors carpi radialis', category: 'tendon' },
  { pattern: /\btendon\s+sheath\s+of\s+flexor\s+carpi\s+radialis\b/i, namePl: 'Pochewka ścięgna zginacza promieniowego nadgarstka', nameLt: 'Vagina tendinis musculi flexoris carpi radialis', nameEn: 'Tendon sheath of flexor carpi radialis', category: 'tendon' },
  { pattern: /\btendon\s+sheath\s+of\s+flexor\s+digitorum\s+longus\b/i, namePl: 'Pochewka ścięgna zginacza długiego palców stopy', nameLt: 'Vagina tendinum musculi flexoris digitorum longi', nameEn: 'Tendon sheath of flexor digitorum longus', category: 'tendon' },
  { pattern: /\btendon\s+sheath\s+of\s+flexor\s+hallucis\s+longus\b/i, namePl: 'Pochewka ścięgna zginacza długiego palucha', nameLt: 'Vagina tendinis musculi flexoris hallucis longi', nameEn: 'Tendon sheath of flexor hallucis longus', category: 'tendon' },
  { pattern: /\btendon\s+sheath\s+of\s+flexor\s+pollicis\s+longus\b/i, namePl: 'Pochewka ścięgna zginacza długiego kciuka', nameLt: 'Vagina tendinis musculi flexoris pollicis longi', nameEn: 'Tendon sheath of flexor pollicis longus', structureId: 'tendon_fpl_sheath', category: 'tendon' },
  { pattern: /\btendon\s+sheath\s+of\s+tibialis\s+anterior\b/i, namePl: 'Pochewka ścięgna mięśnia piszczelowego przedniego', nameLt: 'Vagina tendinis musculi tibialis anterioris', nameEn: 'Tendon sheath of tibialis anterior', structureId: 'tendon_tibialis_anterior_sheath', category: 'tendon' },
  { pattern: /\btendon\s+sheath\s+of\s+tibialis\s+posterior\b/i, namePl: 'Pochewka ścięgna mięśnia piszczelowego tylnego', nameLt: 'Vagina tendinis musculi tibialis posterioris', nameEn: 'Tendon sheath of tibialis posterior', structureId: 'tendon_tibialis_posterior_sheath', category: 'tendon' },
  { pattern: /\bpalmar\s+carpal\s+tendon\s+sheaths?\b/i, namePl: 'Pochewki ścięgien dłoniowe nadgarstka', nameLt: 'Vaginae tendinum carpales palmares', nameEn: 'Palmar carpal tendon sheaths', category: 'tendon' },
  { pattern: /\bdorsal\s+carpal\s+tendon\s+sheaths?\b/i, namePl: 'Pochewki ścięgien grzbietowe nadgarstka', nameLt: 'Vaginae tendinum carpales dorsales', nameEn: 'Dorsal carpal tendon sheaths', category: 'tendon' },
  { pattern: /\bcarpal\s+tendon\s+sheaths?\b/i, namePl: 'Pochewki ścięgien nadgarstka', nameLt: 'Vaginae tendinum carpi', nameEn: 'Carpal tendon sheaths', category: 'tendon' },
  { pattern: /\banterior\s+tarsal\s+tendon\s+sheaths?\b/i, namePl: 'Pochewki ścięgien przednie stępu', nameLt: 'Vaginae tendinum tarsales anteriores', nameEn: 'Anterior tarsal tendon sheaths', category: 'tendon' },
  { pattern: /\btibial\s+tarsal\s+tendon\s+sheaths?\b/i, namePl: 'Pochewki ścięgien piszczelowe stępu', nameLt: 'Vaginae tendinum tarsales tibiales', nameEn: 'Tibial tarsal tendon sheaths', category: 'tendon' },
  { pattern: /\bfibular\s+tarsal\s+tendon\s+sheaths?\b/i, namePl: 'Pochewki ścięgien strzałkowe stępu', nameLt: 'Vaginae tendinum tarsales fibulares', nameEn: 'Fibular tarsal tendon sheaths', category: 'tendon' },
  { pattern: /\btendon\s+sheaths?\s+of\s+upper\s+limb\b/i, namePl: 'Pochewki ścięgien kończyny górnej', nameLt: 'Vaginae tendinum membri superioris', nameEn: 'Tendon sheaths of upper limb', category: 'tendon' },
  { pattern: /\btendon\s+sheaths?\s+of\s+lower\s+limb\b/i, namePl: 'Pochewki ścięgien kończyny dolnej', nameLt: 'Vaginae tendinum membri inferioris', nameEn: 'Tendon sheaths of lower limb', category: 'tendon' },
  { pattern: /\b(tendon|synovial|fibrous)\s+sheaths?\b/i, namePl: 'Pochewka ścięgnista', nameLt: 'Vagina synovialis tendinis', nameEn: 'Tendon sheath', category: 'tendon' },
  { pattern: /\bintermediate\s+tendon\s+of\s+digastric\b|\bdigastric\s+muscle#intermediate\s+tendon\b/i, namePl: 'Ścięgno pośrednie mięśnia dwubrzuścowego', nameLt: 'Tendo intermedius musculi digastrici', nameEn: 'Intermediate tendon of digastric muscle', category: 'tendon' },
  { pattern: /\bcommon\s+tendinous\s+ring\b/i, namePl: 'Pierścień ścięgnisty wspólny (Zinna)', nameLt: 'Anulus tendineus communis', nameEn: 'Common tendinous ring', category: 'tendon' },
  { pattern: /\btrochlea\s+of\s+superior\s+oblique\b/i, namePl: 'Bloczek mięśnia skośnego górnego oka', nameLt: 'Trochlea musculi obliqui superioris', nameEn: 'Trochlea of superior oblique muscle', category: 'tendon' },
  { pattern: /\bepicranial\s+aponeurosis\b/i, namePl: 'Czepiec ścięgnisty', nameLt: 'Galea aponeurotica (Aponeurosis epicranialis)', nameEn: 'Epicranial aponeurosis', structureId: 'tendon_epicranial_aponeurosis', category: 'tendon' },
  { pattern: /\blinea\s+alba\b/i, namePl: 'Kresa biała', nameLt: 'Linea alba', nameEn: 'Linea alba', category: 'tendon' },
  { pattern: /\bintervertebral\s+disc\b|\bdiscus\s*intervertebralis\b|\bdiscus_intervertebralis\b/i, namePl: 'Krążek międzykręgowy', nameLt: 'Discus intervertebralis', nameEn: 'Intervertebral disc', structureId: 'discus_intervertebralis', category: 'joint_ligament', isCartilage: true },

  // --- SKIN / BODY SURFACE REGIONS ---
  { pattern: /\b(frontal|parietal|temporal|occipital|mastoid|orbital|infraorbital|zygomatic|buccal|parotideomasseteric|mental|oral|nasal|auricular|eyebrow|eyelid|neck|submental|submandibular|supraclavicular|sternocleidomastoid)\s+region\b|\bposterior\s+region\s+of\s+neck\b|\beyebrow\b|\bhairs\s+of\s+head\b|\bangle\s+of\s+mouth\b|\btubercle\s+of\s+upper\s+lip\b/i, namePl: 'Powłoki głowy i szyi', nameLt: 'Regiones capitis et cervicales', nameEn: 'Skin region of head and neck', structureId: 'skin_head_neck', category: 'skin' },
  { pattern: /\b(pectoral|sternal|infraclavicular|mammary|inframmary|hypochondriac|epigastric|umbilical|pubic|inguinal|abdominal|lateral\s+abdominal)\s+region\b|\blateral\s+region\s+of\s+(abdomen|thorax)\b|\binfraclavicular\s+fossa\b|\blesser\s+supraclavicular\s+fossa\b|\bgreater\s+supraclavicular\s+fossa\b/i, namePl: 'Powłoki klatki piersiowej i brzucha', nameLt: 'Regiones thoracicae et abdominales', nameEn: 'Thoracic / abdominal skin region', structureId: 'skin_thorax_abdomen', category: 'skin' },
  { pattern: /\b(vertebral|scapular|infrascapular|interscapular|lumbar|sacral|dorsal)\s+region\b|\btriangle\s+of\s+auscultation\b/i, namePl: 'Powłoki grzbietu i okolicy lędźwiowej', nameLt: 'Regiones dorsales et lumbales', nameEn: 'Dorsal / lumbar skin region', structureId: 'skin_back_lumbar', category: 'skin' },
  { pattern: /\b(deltoid|axillary|brachial|cubital|antebrachial|carpal|palmar|thenar|hypothenar|hand|digit.*hand)\s+region\b|\b(anterior|posterior)\s+region\s+of\s+(arm|elbow|forearm|wrist)\b|\bcubital\s+fossa\b|\b(lateral|medial)\s+border\s+of\s+forearm\b|\b(palmar|dorsal)\s+surfaces?\s+of\s+digits\s+of\s+hand\b|\bdorsum\s+of\s+hand\b|\bnail\s+plate\b(?!.*foot)/i, namePl: 'Powłoki kończyny górnej', nameLt: 'Regiones membri superioris', nameEn: 'Upper limb skin region', structureId: 'skin_upper_limb', category: 'skin' },
  { pattern: /\b(gluteal|hip|femoral|thigh|knee|popliteal)\s+region\b|\b(anterior|posterior)\s+region\s+of\s+knee\b|\bgluteal\s+fold\b|\bpopliteal\s+fossa\b/i, namePl: 'Powłoki okolicy pośladkowej i uda', nameLt: 'Regiones glutealis et femoralis', nameEn: 'Gluteal / femoral skin region', structureId: 'skin_gluteal_thigh', category: 'skin' },
  { pattern: /\b(crural|leg|sural|calf|ankle|talocrural|retromalleolar|calcaneal|foot|dorsum\s+of\s+foot|sole\s+of\s+foot|toe)\s+region\b|\banterior\s+region\s+of\s+ankle\b|\b(lateral|medial)\s+part\s+of\s+longitudinal\s+arch\s+of\s+foot\b|\b(proximal|distal)\s+transverse\s+arch\s+of\s+foot\b|\b(dorsal|plantar)\s+surfaces?\s+of\s+digits\s+of\s+foot\b|\b(lateral|medial)\s+border\s+of\s+foot\b|\bnail\s+plate\s*\(?foot\)?/i, namePl: 'Powłoki podudzia i stopy', nameLt: 'Regiones cruralis et pedis', nameEn: 'Crural / pedal skin region', structureId: 'skin_leg_foot', category: 'skin' },

  // =========================================================================
  // PRECEDENCE 4: CARTILAGES (Nasal, Auricular, Laryngeal, Costal)
  // =========================================================================
  { pattern: /\bmajor\s+alar\s+cartilage\b|\bcartilago\s+alaris\s+major\b/i, namePl: 'Chrząstka skrzydłowa większa', nameLt: 'Cartilago alaris major', nameEn: 'Major alar cartilage', structureId: 'major_alar_cartilage', category: 'joint_ligament', isCartilage: true },
  { pattern: /\b(lateral\s+process\s+of\s+nasal\s+septal|lateral\s+nasal)\s+cartilage\b/i, namePl: 'Chrząstka boczna nosa', nameLt: 'Cartilago nasi lateralis', nameEn: 'Lateral nasal cartilage', structureId: 'lateral_nasal_cartilage', category: 'joint_ligament', isCartilage: true },
  { pattern: /\bnasal\s+septal\s+cartilage\b|\bnasal\s+cartilages\b|\bcartilago\s+septi\s+nasi\b/i, namePl: 'Chrząstka przegrody nosa', nameLt: 'Cartilago septi nasi', nameEn: 'Nasal septal cartilage', structureId: 'nasal_septal_cartilage', category: 'joint_ligament', isCartilage: true },
  { pattern: /\bcartilages?\s+of\s+ear\b|\bauricular\s+cartilage\b|\bconcha\s+of\s+auricle\b|\bcavity\s+of\s+concha\b|\banterior\s+notch\s+of\s+auricle\b|\bapex\s+of\s+auricle\b|\bauricular\s+tubercle\b|\bcrura\s+of\s+antihelix\b|\bfossa\s+antihelica\b|\blobule\s+of\s+auricle\b|\btriangular\s+fossa\b|\bposterior\s+auricular\s+groove\b/i, namePl: 'Małżowina uszna (chrząstka małżowiny)', nameLt: 'Cartilago auriculae', nameEn: 'Auricular cartilage', category: 'joint_ligament', isCartilage: true },
  { pattern: /\barytenoid\s+cartilage\b/i, namePl: 'Chrząstka nalewkowata', nameLt: 'Cartilago arytenoidea', nameEn: 'Arytenoid cartilage', category: 'joint_ligament', isCartilage: true },
  { pattern: /\bcorniculate\s+cartilages?\b/i, namePl: 'Chrząstka różkowata', nameLt: 'Cartilago corniculata', nameEn: 'Corniculate cartilage', category: 'joint_ligament', isCartilage: true },
  { pattern: /\bcricoid\s+cartilage\b/i, namePl: 'Chrząstka pierścieniowata', nameLt: 'Cartilago cricoidea', nameEn: 'Cricoid cartilage', category: 'joint_ligament', isCartilage: true },
  { pattern: /\bthyroid\s+cartilage\b/i, namePl: 'Chrząstka tarczowata', nameLt: 'Cartilago thyroidea', nameEn: 'Thyroid cartilage', category: 'joint_ligament', isCartilage: true },
  { pattern: /\blaryngeal\s+cartilages?\b/i, namePl: 'Chrząstki krtani', nameLt: 'Cartilagines laryngis', nameEn: 'Laryngeal cartilages', category: 'joint_ligament', isCartilage: true },
  ...COSTAL_CARTILAGE_RULES,
  { pattern: /\bcostal\s+cartilage\b/i, namePl: 'Chrząstka żebrowa', nameLt: 'Cartilago costalis', nameEn: 'Costal cartilage', structureId: 'costae', category: 'joint_ligament', isCartilage: true },

  // =========================================================================
  // PRECEDENCE 5: EYELID TARSAL PLATES
  // =========================================================================
  { pattern: /\binferior\s+tarsus\b/i, namePl: 'Tarczka dolna powieki', nameLt: 'Tarsus inferior palpebrae', nameEn: 'Inferior tarsus (eyelid)', category: 'joint_ligament' },
  { pattern: /\bsuperior\s+tarsus\b/i, namePl: 'Tarczka górna powieki', nameLt: 'Tarsus superior palpebrae', nameEn: 'Superior tarsus (eyelid)', category: 'joint_ligament' },
  { pattern: /\btarsus\s*\(?\s*eyelids?\b/i, namePl: 'Tarczka powieki', nameLt: 'Tarsus palpebrae', nameEn: 'Tarsal plate (eyelid)', category: 'joint_ligament' },

  // =========================================================================
  // PRECEDENCE 6: DISCRETE VERTEBRAE (C1–C7, Th1–Th12, L1–L5, Sacrum, Coccyx)
  // =========================================================================
  { pattern: /\batlas(\s*\(c1\))?\b|\bvertebra\s+c1\b/i, namePl: 'Kręg szczytowy (C1)', nameLt: 'Atlas (Vertebra cervicalis I)', nameEn: 'Atlas (C1 vertebra)', structureId: 'atlas_c1', category: 'bone' },
  { pattern: /\baxis(\s*\(c2\))?\b|\bvertebra\s+c2\b/i, namePl: 'Kręg obrotowy (C2)', nameLt: 'Axis (Vertebra cervicalis II)', nameEn: 'Axis (C2 vertebra)', structureId: 'axis_c2', category: 'bone' },
  { pattern: /\bvertebra\s+c3\b|\bc3\s+vertebra\b/i, namePl: 'Kręg szyjny C3', nameLt: 'Vertebra cervicalis III', nameEn: 'Cervical vertebra C3', structureId: 'vertebra_c3', category: 'bone' },
  { pattern: /\bvertebra\s+c4\b|\bc4\s+vertebra\b/i, namePl: 'Kręg szyjny C4', nameLt: 'Vertebra cervicalis IV', nameEn: 'Cervical vertebra C4', structureId: 'vertebra_c4', category: 'bone' },
  { pattern: /\bvertebra\s+c5\b|\bc5\s+vertebra\b/i, namePl: 'Kręg szyjny C5', nameLt: 'Vertebra cervicalis V', nameEn: 'Cervical vertebra C5', structureId: 'vertebra_c5', category: 'bone' },
  { pattern: /\bvertebra\s+c6\b|\bc6\s+vertebra\b/i, namePl: 'Kręg szyjny C6', nameLt: 'Vertebra cervicalis VI', nameEn: 'Cervical vertebra C6', structureId: 'vertebra_c6', category: 'bone' },
  { pattern: /\bvertebra\s+c7\b|\bc7\s+vertebra\b|\bc7\b|\bvertebra\s+prominens\b/i, namePl: 'Kręg wystający (C7)', nameLt: 'Vertebra prominens (C7)', nameEn: 'Vertebra prominens (C7)', structureId: 'vertebra_c7', category: 'bone' },

  { pattern: /\bvertebra\s+(?:t|th)1\b/i, namePl: 'Kręg piersiowy Th1', nameLt: 'Vertebra thoracica I', nameEn: 'Thoracic vertebra T1', structureId: 'vertebra_th1', category: 'bone' },
  { pattern: /\bvertebra\s+(?:t|th)2\b/i, namePl: 'Kręg piersiowy Th2', nameLt: 'Vertebra thoracica II', nameEn: 'Thoracic vertebra T2', structureId: 'vertebra_th2', category: 'bone' },
  { pattern: /\bvertebra\s+(?:t|th)3\b/i, namePl: 'Kręg piersiowy Th3', nameLt: 'Vertebra thoracica III', nameEn: 'Thoracic vertebra T3', structureId: 'vertebra_th3', category: 'bone' },
  { pattern: /\bvertebra\s+(?:t|th)4\b/i, namePl: 'Kręg piersiowy Th4', nameLt: 'Vertebra thoracica IV', nameEn: 'Thoracic vertebra T4', structureId: 'vertebra_th4', category: 'bone' },
  { pattern: /\bvertebra\s+(?:t|th)5\b/i, namePl: 'Kręg piersiowy Th5', nameLt: 'Vertebra thoracica V', nameEn: 'Thoracic vertebra T5', structureId: 'vertebra_th5', category: 'bone' },
  { pattern: /\bvertebra\s+(?:t|th)6\b/i, namePl: 'Kręg piersiowy Th6', nameLt: 'Vertebra thoracica VI', nameEn: 'Thoracic vertebra T6', structureId: 'vertebra_th6', category: 'bone' },
  { pattern: /\bvertebra\s+(?:t|th)7\b/i, namePl: 'Kręg piersiowy Th7', nameLt: 'Vertebra thoracica VII', nameEn: 'Thoracic vertebra T7', structureId: 'vertebra_th7', category: 'bone' },
  { pattern: /\bvertebra\s+(?:t|th)8\b/i, namePl: 'Kręg piersiowy Th8', nameLt: 'Vertebra thoracica VIII', nameEn: 'Thoracic vertebra T8', structureId: 'vertebra_th8', category: 'bone' },
  { pattern: /\bvertebra\s+(?:t|th)9\b/i, namePl: 'Kręg piersiowy Th9', nameLt: 'Vertebra thoracica IX', nameEn: 'Thoracic vertebra T9', structureId: 'vertebra_th9', category: 'bone' },
  { pattern: /\bvertebra\s+(?:t|th)10\b/i, namePl: 'Kręg piersiowy Th10', nameLt: 'Vertebra thoracica X', nameEn: 'Thoracic vertebra T10', structureId: 'vertebra_th10', category: 'bone' },
  { pattern: /\bvertebra\s+(?:t|th)11\b/i, namePl: 'Kręg piersiowy Th11', nameLt: 'Vertebra thoracica XI', nameEn: 'Thoracic vertebra T11', structureId: 'vertebra_th11', category: 'bone' },
  { pattern: /\bvertebra\s+(?:t|th)12\b/i, namePl: 'Kręg piersiowy Th12', nameLt: 'Vertebra thoracica XII', nameEn: 'Thoracic vertebra T12', structureId: 'vertebra_th12', category: 'bone' },

  { pattern: /\bvertebra\s+l1\b/i, namePl: 'Kręg lędźwiowy L1', nameLt: 'Vertebra lumbalis I', nameEn: 'Lumbar vertebra L1', structureId: 'vertebra_l1', category: 'bone' },
  { pattern: /\bvertebra\s+l2\b/i, namePl: 'Kręg lędźwiowy L2', nameLt: 'Vertebra lumbalis II', nameEn: 'Lumbar vertebra L2', structureId: 'vertebra_l2', category: 'bone' },
  { pattern: /\bvertebra\s+l3\b/i, namePl: 'Kręg lędźwiowy L3', nameLt: 'Vertebra lumbalis III', nameEn: 'Lumbar vertebra L3', structureId: 'vertebra_l3', category: 'bone' },
  { pattern: /\bvertebra\s+l4\b/i, namePl: 'Kręg lędźwiowy L4', nameLt: 'Vertebra lumbalis IV', nameEn: 'Lumbar vertebra L4', structureId: 'vertebra_l4', category: 'bone' },
  { pattern: /\bvertebra\s+l5\b/i, namePl: 'Kręg lędźwiowy L5', nameLt: 'Vertebra lumbalis V', nameEn: 'Lumbar vertebra L5', structureId: 'vertebra_l5', category: 'bone' },

  { pattern: /\bsacrum\b|\bos\s+sacrum\b/i, namePl: 'Kość krzyżowa', nameLt: 'Os sacrum', nameEn: 'Sacrum', structureId: 'os_sacrum', category: 'bone' },
  { pattern: /\bcoccyx\b|\bos\s+coccygis\b/i, namePl: 'Kość guziczna', nameLt: 'Os coccygis', nameEn: 'Coccyx', structureId: 'os_coccygis', category: 'bone' },

  { pattern: /\bcervical\s+vertebra/i, namePl: 'Kręg szyjny', nameLt: 'Vertebra cervicalis', nameEn: 'Cervical vertebra', structureId: 'vertebra_c7', category: 'bone' },
  { pattern: /\bthoracic\s+vertebra/i, namePl: 'Kręg piersiowy', nameLt: 'Vertebra thoracica', nameEn: 'Thoracic vertebra', structureId: 'vertebrae_thoracicae', category: 'bone' },
  { pattern: /\blumbar\s+vertebra/i, namePl: 'Kręg lędźwiowy', nameLt: 'Vertebra lumbalis', nameEn: 'Lumbar vertebra', structureId: 'vertebrae_lumbales', category: 'bone' },
  { pattern: /\bvertebra\b/i, namePl: 'Kręg kręgosłupa', nameLt: 'Vertebra', nameEn: 'Vertebra', structureId: 'vertebrae_thoracicae', category: 'bone' },

  // =========================================================================
  // PRECEDENCE 7: SPECIFIC BONES & JOINTS
  // =========================================================================
  { pattern: /\b(mesh\s+)?scapula\b/i, namePl: 'Łopatka', nameLt: 'Scapula', nameEn: 'Scapula', structureId: 'scapula', category: 'bone' },
  { pattern: /\bacromion\b/i, namePl: 'Wyrostek barkowy łopatki', nameLt: 'Acromion', nameEn: 'Acromion of scapula', structureId: 'acromion', category: 'bone' },
  { pattern: /\bcoracoid\b|\bprocessus\s+coracoideus\b/i, namePl: 'Wyrostek kruczy łopatki', nameLt: 'Processus coracoideus', nameEn: 'Coracoid process of scapula', structureId: 'processus_coracoideus', category: 'bone' },
  { pattern: /\bglenoid\b|\bcavitas\s+glenoidalis\b/i, namePl: 'Wydrążenie stawowe łopatki', nameLt: 'Cavitas glenoidalis', nameEn: 'Glenoid cavity of scapula', structureId: 'cavitas_glenoidalis', category: 'bone' },
  { pattern: /\bfossa\s+supraspinata\b|\bsupraspinous\s+fossa\b/i, namePl: 'Dół nadgrzebieniowy łopatki', nameLt: 'Fossa supraspinata', nameEn: 'Supraspinous fossa of scapula', structureId: 'fossa_supraspinata', category: 'bone' },
  { pattern: /\bfossa\s+infraspinata\b|\binfraspinous\s+fossa\b/i, namePl: 'Dół podgrzebieniowy łopatki', nameLt: 'Fossa infraspinata', nameEn: 'Infraspinous fossa of scapula', structureId: 'fossa_infraspinata', category: 'bone' },
  { pattern: /\bclavicle\b|\bclavicula\b/i, namePl: 'Obojczyk', nameLt: 'Clavicula', nameEn: 'Clavicle', structureId: 'clavicula', category: 'bone' },
  { pattern: /\bgreater\s+tubercle\b|\btuberculum\s+majus\b/i, namePl: 'Guzek większy kości ramiennej', nameLt: 'Tuberculum majus humeri', nameEn: 'Greater tubercle of humerus', structureId: 'tuberculum_majus', category: 'bone' },
  { pattern: /\blesser\s+tubercle\b|\btuberculum\s+minus\b/i, namePl: 'Guzek mniejszy kości ramiennej', nameLt: 'Tuberculum minus humeri', nameEn: 'Lesser tubercle of humerus', structureId: 'tuberculum_minus', category: 'bone' },
  { pattern: /\bintertubercular\b|\bbicipital\s+groove\b|\bsulcus\s+intertubercularis\b/i, namePl: 'Bruzda międzyguzkowa', nameLt: 'Sulcus intertubercularis', nameEn: 'Intertubercular sulcus', structureId: 'sulcus_intertubercularis', category: 'bone' },
  { pattern: /\bacromioclavicular\b|\barticulatio\s+ac\b/i, namePl: 'Staw barkowo-obojczykowy', nameLt: 'Articulatio acromioclavicularis', nameEn: 'Acromioclavicular joint', structureId: 'articulatio_ac', category: 'joint_ligament' },
  { pattern: /\barticulatio\s+humeri\b|\bglenohumeral\b/i, namePl: 'Staw ramienny', nameLt: 'Articulatio humeri', nameEn: 'Glenohumeral joint', structureId: 'articulatio_humeri', category: 'joint_ligament' },
  { pattern: /\b(mesh\s+)?humerus\b/i, namePl: 'Kość ramienna', nameLt: 'Humerus', nameEn: 'Humerus', structureId: 'humerus', category: 'bone' },
  { pattern: /\bolecranon\b/i, namePl: 'Wyrostek łokciowy', nameLt: 'Olecranon', nameEn: 'Olecranon', structureId: 'ulna', category: 'bone' },
  { pattern: /\b(mesh\s+)?radius\b/i, namePl: 'Kość promieniowa', nameLt: 'Radius', nameEn: 'Radius', structureId: 'radius', category: 'bone' },
  { pattern: /\b(mesh\s+)?ulna\b/i, namePl: 'Kość łokciowa', nameLt: 'Ulna', nameEn: 'Ulna', structureId: 'ulna', category: 'bone' },
  { pattern: /\bscaphoid\s+bone\b/i, namePl: 'Kość łódeczkowata', nameLt: 'Os scaphoideum', nameEn: 'Scaphoid bone', structureId: 'ossa_carpi', category: 'bone' },
  { pattern: /\blunate\s+bone\b/i, namePl: 'Kość księżycowata', nameLt: 'Os lunatum', nameEn: 'Lunate bone', structureId: 'ossa_carpi', category: 'bone' },
  { pattern: /\btriquetrum\s+bone\b|\btriquetral\s+bone\b/i, namePl: 'Kość trójgraniasta', nameLt: 'Os triquetrum', nameEn: 'Triquetral bone', structureId: 'ossa_carpi', category: 'bone' },
  { pattern: /\bpisiform\s+bone\b/i, namePl: 'Kość grochowata', nameLt: 'Os pisiforme', nameEn: 'Pisiform bone', structureId: 'ossa_carpi', category: 'bone' },
  { pattern: /\btrapezium(\s+bone|\s*\(bone)?\b/i, namePl: 'Kość czworoboczna większa', nameLt: 'Os trapezium', nameEn: 'Trapezium bone', structureId: 'ossa_carpi', category: 'bone' },
  { pattern: /\btrapezoid\s+bone\b/i, namePl: 'Kość czworoboczna mniejsza', nameLt: 'Os trapezoideum', nameEn: 'Trapezoid bone', structureId: 'ossa_carpi', category: 'bone' },
  { pattern: /\bcapitate\s+bone\b/i, namePl: 'Kość główkowata', nameLt: 'Os capitatum', nameEn: 'Capitate bone', structureId: 'ossa_carpi', category: 'bone' },
  { pattern: /\bhamate\s+bone\b/i, namePl: 'Kość haczykowata', nameLt: 'Os hamatum', nameEn: 'Hamate bone', structureId: 'ossa_carpi', category: 'bone' },
  { pattern: /\bcarpal\b|\bossa\s+carpi\b/i, namePl: 'Kości nadgarstka', nameLt: 'Ossa carpi', nameEn: 'Carpal bones', structureId: 'ossa_carpi', category: 'bone' },
  ...METACARPAL_RULES,
  { pattern: /\bmetacarpal\b|\bossa\s+metacarpalia\b/i, namePl: 'Kości śródręcza', nameLt: 'Ossa metacarpi', nameEn: 'Metacarpal bones', category: 'bone' },
  ...PHALANX_HAND_RULES,
  { pattern: /\bphalanx\s+manus\b|\bphalanges\s+manus\b/i, namePl: 'Paliczki ręki', nameLt: 'Phalanges manus', nameEn: 'Phalanges of hand', category: 'bone' },

  { pattern: /\b(mesh\s+)?femur\b|\bfemoral\s+bone\b/i, namePl: 'Kość udowa', nameLt: 'Femur (Os femoris)', nameEn: 'Femur', structureId: 'femur', category: 'bone' },
  { pattern: /\btibial\s+tuberosity\b|\btuberositas\s+tibiae\b/i, namePl: 'Guzowatość kości piszczelowej', nameLt: 'Tuberositas tibiae', nameEn: 'Tibial tuberosity', structureId: 'tuberositas_tibiae', category: 'bone' },
  { pattern: /\b(mesh\s+)?tibia\b/i, namePl: 'Kość piszczelowa', nameLt: 'Tibia', nameEn: 'Tibia', structureId: 'tibia', category: 'bone' },
  { pattern: /\bpatella\b/i, namePl: 'Rzepka', nameLt: 'Patella', nameEn: 'Patella', structureId: 'patella', category: 'bone' },
  { pattern: /\bfibula\s+head\b|\bfibular\s+head\b/i, namePl: 'Głowa strzałki', nameLt: 'Caput fibulae', nameEn: 'Head of fibula', structureId: 'fibula_head', category: 'bone' },
  { pattern: /\bnavicular\s+bone\b|\bnavicular\b/i, namePl: 'Kość łódkowata stopy', nameLt: 'Os naviculare', nameEn: 'Navicular bone', structureId: 'talus', category: 'bone' },
  { pattern: /\bcuboid\s+bone\b|\bcuboid\b/i, namePl: 'Kość sześcienna stopy', nameLt: 'Os cuboideum', nameEn: 'Cuboid bone', structureId: 'calcaneus', category: 'bone' },
  { pattern: /\bmedial\s+cuneiform\s+bone\b/i, namePl: 'Kość klinowata przyśrodkowa', nameLt: 'Os cuneiforme mediale', nameEn: 'Medial cuneiform bone', category: 'bone' },
  { pattern: /\bintermediate\s+cuneiform\s+bone\b/i, namePl: 'Kość klinowata pośrednia', nameLt: 'Os cuneiforme intermedium', nameEn: 'Intermediate cuneiform bone', category: 'bone' },
  { pattern: /\blateral\s+cuneiform\s+bone\b/i, namePl: 'Kość klinowata boczna', nameLt: 'Os cuneiforme laterale', nameEn: 'Lateral cuneiform bone', category: 'bone' },
  { pattern: /\bcuneiform\s+bones?\b/i, namePl: 'Kości klinowate stępu', nameLt: 'Ossa cuneiformia', nameEn: 'Cuneiform bones', category: 'bone' },
  { pattern: /\btalus\b/i, namePl: 'Kość skokowa', nameLt: 'Talus', nameEn: 'Talus', structureId: 'talus', category: 'bone' },
  { pattern: /\bcalcaneus\b|\bcalcaneum\b/i, namePl: 'Kość piętowa', nameLt: 'Calcaneus', nameEn: 'Calcaneus', structureId: 'calcaneus', category: 'bone' },
  { pattern: /\bsesamoid\s+bones?\s+of\s+foot\b|\bsesamoid\s+bone\b/i, namePl: 'Trzeszczki stopy', nameLt: 'Ossa sesamoidea pedis', nameEn: 'Sesamoid bones of foot', category: 'bone' },
  ...METATARSAL_RULES,
  { pattern: /\bmetatarsal\b|\bossa\s+metatarsalia\b/i, namePl: 'Kości śródstopia', nameLt: 'Ossa metatarsi', nameEn: 'Metatarsal bones', category: 'bone' },
  ...PHALANX_FOOT_RULES,
  { pattern: /\bphalanx\s+pedis\b|\bphalanges\s+pedis\b/i, namePl: 'Paliczki stopy', nameLt: 'Phalanges pedis', nameEn: 'Phalanges of foot', category: 'bone' },
  { pattern: /\bphalanx\b/i, namePl: 'Paliczek', nameLt: 'Phalanx', nameEn: 'Phalanx', category: 'bone' },

  { pattern: /\bxiphoid\b/i, namePl: 'Wyrostek mieczykowaty mostka', nameLt: 'Processus xiphoideus', nameEn: 'Xiphoid process', structureId: 'sternum', category: 'bone' },
  { pattern: /\bmanubrium(\s+of\s+sternum)?\b/i, namePl: 'Rękojeść mostka', nameLt: 'Manubrium sterni', nameEn: 'Manubrium of sternum', structureId: 'sternum', category: 'bone' },
  { pattern: /\bbody\s+of\s+sternum\b/i, namePl: 'Trzon mostka', nameLt: 'Corpus sterni', nameEn: 'Body of sternum', structureId: 'sternum', category: 'bone' },
  { pattern: /\bsternum\b/i, namePl: 'Mostek', nameLt: 'Sternum', nameEn: 'Sternum', structureId: 'sternum', category: 'bone' },
  ...RIB_RULES,
  { pattern: /\brib\s+cage\b|\bribs\b|\bcostae\b/i, namePl: 'Żebra', nameLt: 'Costae', nameEn: 'Ribs', structureId: 'costae', category: 'bone' },
  { pattern: /\b(mesh\s+)?pelvis\b|\bos\s+coxae\b|\bhip\s+bone\b/i, namePl: 'Kość miedniczna', nameLt: 'Os coxae', nameEn: 'Hip bone (Pelvis)', structureId: 'os_coxae', category: 'bone' },
  { pattern: /\bilium\b|\bos\s+ilium\b/i, namePl: 'Kość biodrowa', nameLt: 'Os ilium', nameEn: 'Ilium', structureId: 'os_coxae', category: 'bone' },
  { pattern: /\bischium\b|\bos\s+ischii\b/i, namePl: 'Kość kulszowa', nameLt: 'Os ischii', nameEn: 'Ischium', structureId: 'os_coxae', category: 'bone' },
  { pattern: /\bpubis\b|\bos\s+pubis\b/i, namePl: 'Kość łonowa', nameLt: 'Os pubis', nameEn: 'Pubis', structureId: 'os_coxae', category: 'bone' },
  { pattern: /\bacetabulum\b/i, namePl: 'Panewka stawu biodrowego', nameLt: 'Acetabulum', nameEn: 'Acetabulum', structureId: 'acetabulum', category: 'bone' },
  { pattern: /\barticulatio\s+coxae\b|\bhip\s+joint\b/i, namePl: 'Staw biodrowy', nameLt: 'Articulatio coxae', nameEn: 'Hip joint', structureId: 'acetabulum', category: 'joint_ligament' },

  { pattern: /\bnasal\s+bone\b|\bos\s+nasale\b/i, namePl: 'Kość nosowa', nameLt: 'Os nasale', nameEn: 'Nasal bone', structureId: 'nasal_bone', category: 'bone' },
  { pattern: /\binferior\s+nasal\s+concha\b|\bconcha\s+nasalis\s+inferior\b/i, namePl: 'Małżowina nosowa dolna', nameLt: 'Concha nasalis inferior', nameEn: 'Inferior nasal concha', structureId: 'inferior_nasal_concha', category: 'bone', isCartilage: false },
  { pattern: /\bvomer\b/i, namePl: 'Lemiesz', nameLt: 'Vomer', nameEn: 'Vomer', structureId: 'vomer', category: 'bone' },
  { pattern: /\bfrontal\s+bone\b|\bos\s+frontale\b/i, namePl: 'Kość czołowa', nameLt: 'Os frontale', nameEn: 'Frontal bone', structureId: 'cranium', category: 'bone' },
  { pattern: /\bparietal\s+bone\b|\bos\s+parietale\b/i, namePl: 'Kość ciemieniowa', nameLt: 'Os parietale', nameEn: 'Parietal bone', structureId: 'cranium', category: 'bone' },
  { pattern: /\boccipital\s+bone\b|\bos\s+occipitale\b/i, namePl: 'Kość potyliczna', nameLt: 'Os occipitale', nameEn: 'Occipital bone', structureId: 'cranium', category: 'bone' },
  { pattern: /\btemporal\s+bone\b|\bos\s+temporale\b/i, namePl: 'Kość skroniowa', nameLt: 'Os temporale', nameEn: 'Temporal bone', structureId: 'cranium', category: 'bone' },
  { pattern: /\bsphenoid\s+bone\b|\bos\s+sphenoidale\b/i, namePl: 'Kość klinowa', nameLt: 'Os sphenoidale', nameEn: 'Sphenoid bone', structureId: 'cranium', category: 'bone' },
  { pattern: /\bethmoid\s+bone\b|\bos\s+ethmoidale\b/i, namePl: 'Kość sitowa', nameLt: 'Os ethmoidale', nameEn: 'Ethmoid bone', structureId: 'cranium', category: 'bone' },
  { pattern: /\blacrimal\s+bone\b/i, namePl: 'Kość łzowa', nameLt: 'Os lacrimale', nameEn: 'Lacrimal bone', category: 'bone' },
  { pattern: /\bpalatine\s+bone\b/i, namePl: 'Kość podniebienna', nameLt: 'Os palatinum', nameEn: 'Palatine bone', category: 'bone' },
  { pattern: /\bmalleus\b/i, namePl: 'Młoteczek', nameLt: 'Malleus', nameEn: 'Malleus', category: 'bone' },
  { pattern: /\bincus\b/i, namePl: 'Kowadełko', nameLt: 'Incus', nameEn: 'Incus', category: 'bone' },
  { pattern: /\bstapes\b/i, namePl: 'Strzemiączko', nameLt: 'Stapes', nameEn: 'Stapes', category: 'bone' },
  { pattern: /\bmandible\b|\bmandibula\b/i, namePl: 'Żuchwa', nameLt: 'Mandibula', nameEn: 'Mandible', structureId: 'mandibula', category: 'bone' },
  { pattern: /\bmaxilla\b/i, namePl: 'Szczęka', nameLt: 'Maxilla', nameEn: 'Maxilla', structureId: 'cranium', category: 'bone' },
  { pattern: /\bzygomatic\b|\bos\s+zygomaticum\b/i, namePl: 'Kość jarzmowa', nameLt: 'Os zygomaticum', nameEn: 'Zygomatic bone', structureId: 'cranium', category: 'bone' },
  { pattern: /\bhyoid\b|\bos\s+hyoideum\b/i, namePl: 'Kość gnykowa', nameLt: 'Os hyoideum', nameEn: 'Hyoid bone', category: 'bone' },
  { pattern: /\bcranium\b|\bskull\b/i, namePl: 'Czaszka', nameLt: 'Cranium', nameEn: 'Cranium', structureId: 'cranium', category: 'bone' },

  // =========================================================================
  // PRECEDENCE 8: SKELETAL MUSCLES (100% Terminologia Anatomica Latin)
  // =========================================================================
  { pattern: /\bsupraspinatus\b|\bm\s+supraspinatus\b/i, namePl: 'Mięsień nadgrzebieniowy', nameLt: 'Musculus supraspinatus', nameEn: 'Supraspinatus muscle', structureId: 'm_supraspinatus', category: 'muscle' },
  { pattern: /\binfraspinatus\b|\bm\s+infraspinatus\b/i, namePl: 'Mięsień podgrzebieniowy', nameLt: 'Musculus infraspinatus', nameEn: 'Infraspinatus muscle', structureId: 'm_infraspinatus', category: 'muscle' },
  { pattern: /\bteres\s+minor\b|\bm\s+teres\s+minor\b/i, namePl: 'Mięsień obły mniejszy', nameLt: 'Musculus teres minor', nameEn: 'Teres minor muscle', structureId: 'm_teres_minor', category: 'muscle' },
  { pattern: /\bteres\s+major\b|\bm\s+teres\s+major\b/i, namePl: 'Mięsień obły większy', nameLt: 'Musculus teres major', nameEn: 'Teres major muscle', structureId: 'm_teres_major', category: 'muscle' },
  { pattern: /\bsubscapularis\b|\bm\s+subscapularis\b/i, namePl: 'Mięsień podłopatkowy', nameLt: 'Musculus subscapularis', nameEn: 'Subscapularis muscle', structureId: 'm_subscapularis', category: 'muscle' },
  { pattern: /\bdeltoid(eus)?\b|\bm\s+deltoideus\b/i, namePl: 'Mięsień naramienny', nameLt: 'Musculus deltoideus', nameEn: 'Deltoid muscle', structureId: 'm_deltoideus', category: 'muscle' },
  { pattern: /\bpectoralis\s+major\b|\bm\s+pectoralis\s+major\b/i, namePl: 'Mięsień piersiowy większy', nameLt: 'Musculus pectoralis major', nameEn: 'Pectoralis major muscle', structureId: 'm_pectoralis_major', category: 'muscle' },
  { pattern: /\bpectoralis\s+minor\b|\bm\s+pectoralis\s+minor\b/i, namePl: 'Mięsień piersiowy mniejszy', nameLt: 'Musculus pectoralis minor', nameEn: 'Pectoralis minor muscle', structureId: 'm_pectoralis_minor', category: 'muscle' },
  { pattern: /\bserratus\s+anterior\b|\bm\s+serratus\s+anterior\b/i, namePl: 'Mięsień zębaty przedni', nameLt: 'Musculus serratus anterior', nameEn: 'Serratus anterior muscle', structureId: 'm_serratus_anterior', category: 'muscle' },
  { pattern: /\bcoracobrachialis\b|\bm\s+coracobrachialis\b/i, namePl: 'Mięsień kruczo-ramienny', nameLt: 'Musculus coracobrachialis', nameEn: 'Coracobrachialis muscle', structureId: 'm_coracobrachialis', category: 'muscle' },
  { pattern: /\bbiceps\s+brachii\b|\bm\s+biceps\s+brachii\b/i, namePl: 'Mięsień dwugłowy ramienia', nameLt: 'Musculus biceps brachii', nameEn: 'Biceps brachii muscle', structureId: 'm_biceps_brachii', category: 'muscle' },
  { pattern: /\btriceps\s+brachii\b|\bm\s+triceps\s+brachii\b/i, namePl: 'Mięsień trójgłowy ramienia', nameLt: 'Musculus triceps brachii', nameEn: 'Triceps brachii muscle', structureId: 'm_triceps_brachii', category: 'muscle' },
  { pattern: /\bbrachioradialis\b|\bm\s+brachioradialis\b/i, namePl: 'Mięsień ramienno-promieniowy', nameLt: 'Musculus brachioradialis', nameEn: 'Brachioradialis muscle', structureId: 'm_brachioradialis', category: 'muscle' },
  { pattern: /\bbrachialis\b|\bm\s+brachialis\b/i, namePl: 'Mięsień ramienny', nameLt: 'Musculus brachialis', nameEn: 'Brachialis muscle', structureId: 'm_brachialis', category: 'muscle' },
  { pattern: /\banconeus\b/i, namePl: 'Mięsień łokciowy', nameLt: 'Musculus anconeus', nameEn: 'Anconeus muscle', category: 'muscle' },
  { pattern: /\bpronator\s+teres\b|\bm\s+pronator\s+teres\b/i, namePl: 'Mięsień nawrotny obły', nameLt: 'Musculus pronator teres', nameEn: 'Pronator teres muscle', structureId: 'm_pronator_teres', category: 'muscle' },
  { pattern: /\bpronator\s+quadratus\b/i, namePl: 'Mięsień nawrotny czworoboczny', nameLt: 'Musculus pronator quadratus', nameEn: 'Pronator quadratus muscle', structureId: 'm_pronator_quadratus', category: 'muscle' },
  { pattern: /\bsupinator\b|\bm\s+supinator\b/i, namePl: 'Mięsień odwracacz', nameLt: 'Musculus supinator', nameEn: 'Supinator muscle', structureId: 'm_supinator', category: 'muscle' },
  { pattern: /\bflexor\s+carpi\s+radialis\b/i, namePl: 'Mięsień zginacz promieniowy nadgarstka', nameLt: 'Musculus flexor carpi radialis', nameEn: 'Flexor carpi radialis muscle', structureId: 'm_flexor_carpi_radialis', category: 'muscle' },
  { pattern: /\bflexor\s+carpi\s+ulnaris\b/i, namePl: 'Mięsień zginacz łokciowy nadgarstka', nameLt: 'Musculus flexor carpi ulnaris', nameEn: 'Flexor carpi ulnaris muscle', structureId: 'm_flexor_carpi_ulnaris', category: 'muscle' },
  { pattern: /\bpalmaris\s+longus\b/i, namePl: 'Mięsień dłoniowy długi', nameLt: 'Musculus palmaris longus', nameEn: 'Palmaris longus muscle', category: 'muscle' },
  { pattern: /\bflexor\s+digitorum\s+superficialis\b/i, namePl: 'Mięsień zginacz powierzchowny palców', nameLt: 'Musculus flexor digitorum superficialis', nameEn: 'Flexor digitorum superficialis muscle', structureId: 'm_flexor_digitorum_superficialis', category: 'muscle' },
  { pattern: /\bflexor\s+digitorum\s+profundus\b/i, namePl: 'Mięsień zginacz głęboki palców', nameLt: 'Musculus flexor digitorum profundus', nameEn: 'Flexor digitorum profundus muscle', structureId: 'm_flexor_digitorum_profundus', category: 'muscle' },
  { pattern: /\bflexor\s+pollicis\s+longus\b/i, namePl: 'Mięsień zginacz długi kciuka', nameLt: 'Musculus flexor pollicis longus', nameEn: 'Flexor pollicis longus muscle', category: 'muscle' },
  { pattern: /\bflexor\s+pollicis\s+brevis\b/i, namePl: 'Mięsień zginacz krótki kciuka', nameLt: 'Musculus flexor pollicis brevis', nameEn: 'Flexor pollicis brevis muscle', category: 'muscle' },
  { pattern: /\bextensor\s+carpi\s+radialis\s+brevis\b/i, namePl: 'Mięsień prostownik promieniowy krótki nadgarstka', nameLt: 'Musculus extensor carpi radialis brevis', nameEn: 'Extensor carpi radialis brevis muscle', category: 'muscle' },
  { pattern: /\bextensor\s+carpi\s+radialis\s+longus\b/i, namePl: 'Mięsień prostownik promieniowy długi nadgarstka', nameLt: 'Musculus extensor carpi radialis longus', nameEn: 'Extensor carpi radialis longus muscle', structureId: 'm_extensor_carpi_radialis_longus', category: 'muscle' },
  { pattern: /\bextensor\s+carpi\s+radialis\b/i, namePl: 'Mięsień prostownik promieniowy nadgarstka', nameLt: 'Musculus extensor carpi radialis', nameEn: 'Extensor carpi radialis muscle', category: 'muscle' },
  { pattern: /\bextensor\s+carpi\s+ulnaris\b/i, namePl: 'Mięsień prostownik łokciowy nadgarstka', nameLt: 'Musculus extensor carpi ulnaris', nameEn: 'Extensor carpi ulnaris muscle', structureId: 'm_extensor_carpi_ulnaris', category: 'muscle' },
  { pattern: /\bextensor\s+digitorum\s+longus\b/i, namePl: 'Mięsień prostownik długi palców stopy', nameLt: 'Musculus extensor digitorum longus', nameEn: 'Extensor digitorum longus muscle', structureId: 'm_extensor_digitorum_longus', category: 'muscle' },
  { pattern: /\bextensor\s+digitorum\b/i, namePl: 'Mięsień prostownik palców', nameLt: 'Musculus extensor digitorum', nameEn: 'Extensor digitorum muscle', structureId: 'm_extensor_digitorum', category: 'muscle' },
  { pattern: /\bextensor\s+digiti\s+minimi\b/i, namePl: 'Mięsień prostownik palca małego', nameLt: 'Musculus extensor digiti minimi', nameEn: 'Extensor digiti minimi muscle', category: 'muscle' },
  { pattern: /\bextensor\s+indicis\b/i, namePl: 'Mięsień prostownik wskaziciela', nameLt: 'Musculus extensor indicis', nameEn: 'Extensor indicis muscle', category: 'muscle' },
  { pattern: /\babductor\s+pollicis\s+longus\b/i, namePl: 'Mięsień odwodziciel długi kciuka', nameLt: 'Musculus abductor pollicis longus', nameEn: 'Abductor pollicis longus muscle', category: 'muscle' },
  { pattern: /\babductor\s+pollicis\s+brevis\b/i, namePl: 'Mięsień odwodziciel krótki kciuka', nameLt: 'Musculus abductor pollicis brevis', nameEn: 'Abductor pollicis brevis muscle', category: 'muscle' },
  { pattern: /\bextensor\s+pollicis\s+brevis\b/i, namePl: 'Mięsień prostownik krótki kciuka', nameLt: 'Musculus extensor pollicis brevis', nameEn: 'Extensor pollicis brevis muscle', category: 'muscle' },
  { pattern: /\bextensor\s+pollicis\s+longus\b/i, namePl: 'Mięsień prostownik długi kciuka', nameLt: 'Musculus extensor pollicis longus', nameEn: 'Extensor pollicis longus muscle', category: 'muscle' },
  { pattern: /\bopponens\s+pollicis\b/i, namePl: 'Mięsień przeciwstawiacz kciuka', nameLt: 'Musculus opponens pollicis', nameEn: 'Opponens pollicis muscle', category: 'muscle' },
  { pattern: /\badductor\s+pollicis\b/i, namePl: 'Mięsień przywodziciel kciuka', nameLt: 'Musculus adductor pollicis', nameEn: 'Adductor pollicis muscle', category: 'muscle' },
  { pattern: /\babductor\s+digiti\s+minimi(\s+muscle)?\s+of\s+hand\b/i, namePl: 'Mięsień odwodziciel palca małego ręki', nameLt: 'Musculus abductor digiti minimi manus', nameEn: 'Abductor digiti minimi (hand)', category: 'muscle' },
  { pattern: /\bflexor\s+digiti\s+minimi\s+(?:brevis\s+muscle\s*\(?\s*)?(?:of\s+)?hand\b/i, namePl: 'Mięsień zginacz krótki palca małego ręki', nameLt: 'Musculus flexor digiti minimi brevis manus', nameEn: 'Flexor digiti minimi brevis (hand)', category: 'muscle' },
  { pattern: /\bopponens\s+digiti\s+minimi(\s+muscle)?\s+of\s+hand\b/i, namePl: 'Mięsień przeciwstawiacz palca małego ręki', nameLt: 'Musculus opponens digiti minimi manus', nameEn: 'Opponens digiti minimi (hand)', category: 'muscle' },
  { pattern: /\babductor\s+digiti\s+minimi(\s+muscle)?\s+of\s+foot\b/i, namePl: 'Mięsień odwodziciel palca małego stopy', nameLt: 'Musculus abductor digiti minimi pedis', nameEn: 'Abductor digiti minimi (foot)', category: 'muscle' },
  { pattern: /\bflexor\s+digiti\s+minimi(\s+brevis)?(\s+muscle)?\s+of\s+foot\b/i, namePl: 'Mięsień zginacz krótki palca małego stopy', nameLt: 'Musculus flexor digiti minimi brevis pedis', nameEn: 'Flexor digiti minimi brevis (foot)', category: 'muscle' },
  { pattern: /\babductor\s+hallucis\b/i, namePl: 'Mięsień odwodziciel palucha', nameLt: 'Musculus abductor hallucis', nameEn: 'Abductor hallucis muscle', category: 'muscle' },
  { pattern: /\bextensor\s+digitorum\s+brevis\b/i, namePl: 'Mięsień prostownik krótki palców stopy', nameLt: 'Musculus extensor digitorum brevis', nameEn: 'Extensor digitorum brevis muscle', category: 'muscle' },
  { pattern: /\bextensor\s+hallucis\s+brevis\b/i, namePl: 'Mięsień prostownik krótki palucha', nameLt: 'Musculus extensor hallucis brevis', nameEn: 'Extensor hallucis brevis muscle', category: 'muscle' },
  { pattern: /\bflexor\s+digitorum\s+brevis\b/i, namePl: 'Mięsień zginacz krótki palców stopy', nameLt: 'Musculus flexor digitorum brevis', nameEn: 'Flexor digitorum brevis muscle', category: 'muscle' },
  { pattern: /\bquadratus\s+plantae\b/i, namePl: 'Mięsień czworoboczny podeszwy', nameLt: 'Musculus quadratus plantae', nameEn: 'Quadratus plantae muscle', category: 'muscle' },
  { pattern: /\blumbricals?(\s+muscles)?\s+of(\s+the)?\s+foot\b/i, namePl: 'Mięśnie glistowate stopy', nameLt: 'Musculi lumbricales pedis', nameEn: 'Lumbrical muscles of foot', category: 'muscle' },
  { pattern: /\bplantar\s+interossei\b/i, namePl: 'Mięśnie międzykostne podeszwowe', nameLt: 'Musculi interossei plantares', nameEn: 'Plantar interossei muscles', category: 'muscle' },
  { pattern: /\bdorsal\s+interossei(\s+muscles)?\s+of(\s+the)?\s+foot\b/i, namePl: 'Mięśnie międzykostne grzbietowe stopy', nameLt: 'Musculi interossei dorsales pedis', nameEn: 'Dorsal interossei of foot', category: 'muscle' },
  { pattern: /\blumbricals?(\s+muscles)?\s+of(\s+the)?\s+hand\b/i, namePl: 'Mięśnie glistowate ręki', nameLt: 'Musculi lumbricales manus', nameEn: 'Lumbrical muscles of hand', category: 'muscle' },
  { pattern: /\bpalmar\s+interossei\s+muscles\b/i, namePl: 'Mięśnie międzykostne dłoniowe', nameLt: 'Musculi interossei palmares', nameEn: 'Palmar interossei muscles', category: 'muscle' },
  { pattern: /\bdorsal\s+interossei(\s+muscles)?\s+of(\s+the)?\s+hand\b/i, namePl: 'Mięśnie międzykostne grzbietowe ręki', nameLt: 'Musculi interossei dorsales manus', nameEn: 'Dorsal interossei of hand', category: 'muscle' },

  { pattern: /\b(quadriceps|rectus\s+femoris|vastus\s+lateralis|vastus\s+medialis|vastus\s+intermedius)\b/i, namePl: 'Mięsień czworogłowy uda', nameLt: 'Musculus quadriceps femoris', nameEn: 'Quadriceps femoris muscle', structureId: 'm_quadriceps_femoris', category: 'muscle' },
  { pattern: /\bbiceps\s+femoris\b|\bm\s+biceps\s+femoris\b/i, namePl: 'Mięsień dwugłowy uda', nameLt: 'Musculus biceps femoris', nameEn: 'Biceps femoris muscle', structureId: 'm_biceps_femoris', category: 'muscle' },
  { pattern: /\bsemitendinosus\b|\bm\s+semitendinosus\b/i, namePl: 'Mięsień półścięgnisty', nameLt: 'Musculus semitendinosus', nameEn: 'Semitendinosus muscle', structureId: 'm_semitendinosus', category: 'muscle' },
  { pattern: /\bsemimembranosus\b|\bm\s+semimembranosus\b/i, namePl: 'Mięsień półbłoniasty', nameLt: 'Musculus semimembranosus', nameEn: 'Semimembranosus muscle', structureId: 'm_semimembranosus', category: 'muscle' },
  { pattern: /\bpopliteus\b|\bm\s+popliteus\b/i, namePl: 'Mięsień podkolanowy', nameLt: 'Musculus popliteus', nameEn: 'Popliteus muscle', structureId: 'm_popliteus', category: 'muscle' },
  { pattern: /\bpes\s+anserinus\b/i, namePl: 'Gęsia stopka powierzchowna', nameLt: 'Pes anserinus superficialis', nameEn: 'Pes anserinus superficialis', structureId: 'pes_anserinus', category: 'muscle' },
  { pattern: /\bgluteus\s+maximus\b|\bm\s+gluteus\s+maximus\b/i, namePl: 'Mięsień pośladkowy wielki', nameLt: 'Musculus gluteus maximus', nameEn: 'Gluteus maximus muscle', structureId: 'm_gluteus_maximus', category: 'muscle' },
  { pattern: /\bgluteus\s+medius\b|\bm\s+gluteus\s+medius\b/i, namePl: 'Mięsień pośladkowy średni', nameLt: 'Musculus gluteus medius', nameEn: 'Gluteus medius muscle', structureId: 'm_gluteus_medius', category: 'muscle' },
  { pattern: /\bgluteus\s+minimus\b|\bm\s+gluteus\s+minimus\b/i, namePl: 'Mięsień pośladkowy mały', nameLt: 'Musculus gluteus minimus', nameEn: 'Gluteus minimus muscle', structureId: 'm_gluteus_minimus', category: 'muscle' },
  { pattern: /\bpiriformis\b|\bm\s+piriformis\b/i, namePl: 'Mięsień gruszkowaty', nameLt: 'Musculus piriformis', nameEn: 'Piriformis muscle', structureId: 'm_piriformis', category: 'muscle' },
  { pattern: /\bobturator\s+internus\b|\binternal\s+obturator\b/i, namePl: 'Mięsień zasłaniacz wewnętrzny', nameLt: 'Musculus obturatorius internus', nameEn: 'Obturator internus muscle', structureId: 'm_obturator_internus', category: 'muscle' },
  { pattern: /\bobturator\s+externus\b|\bexternal\s+obturator\b/i, namePl: 'Mięsień zasłaniacz zewnętrzny', nameLt: 'Musculus obturatorius externus', nameEn: 'Obturator externus muscle', category: 'muscle' },
  { pattern: /\bsuperior\s+gemellus\b/i, namePl: 'Mięsień bliźniaczy górny', nameLt: 'Musculus gemellus superior', nameEn: 'Superior gemellus muscle', category: 'muscle' },
  { pattern: /\binferior\s+gemellus\b/i, namePl: 'Mięsień bliźniaczy dolny', nameLt: 'Musculus gemellus inferior', nameEn: 'Inferior gemellus muscle', category: 'muscle' },
  { pattern: /\bgemelli\s+muscles\b/i, namePl: 'Mięśnie bliźniacze', nameLt: 'Musculi gemelli', nameEn: 'Gemelli muscles', category: 'muscle' },
  { pattern: /\bquadratus\s+femoris\b/i, namePl: 'Mięsień czworoboczny uda', nameLt: 'Musculus quadratus femoris', nameEn: 'Quadratus femoris muscle', structureId: 'm_quadratus_femoris', category: 'muscle' },
  { pattern: /\bpectineus\b/i, namePl: 'Mięsień grzebieniowy', nameLt: 'Musculus pectineus', nameEn: 'Pectineus muscle', structureId: 'm_pectineus', category: 'muscle' },
  { pattern: /\biliacus\b/i, namePl: 'Mięsień biodrowy (część m. biodrowo-lędźwiowego)', nameLt: 'Musculus iliacus (Musculus iliopsoas)', nameEn: 'Iliacus muscle', structureId: 'm_iliopsoas', category: 'muscle' },
  { pattern: /\bpsoas\s+major\b/i, namePl: 'Mięsień lędźwiowy większy (część m. biodrowo-lędźwiowego)', nameLt: 'Musculus psoas major (Musculus iliopsoas)', nameEn: 'Psoas major muscle', structureId: 'm_iliopsoas', category: 'muscle' },
  { pattern: /\bpsoas\s+minor\b/i, namePl: 'Mięsień lędźwiowy mniejszy', nameLt: 'Musculus psoas minor', nameEn: 'Psoas minor muscle', category: 'muscle' },
  { pattern: /\biliopsoas\b|\bpsoas\b|\bm\s+iliopsoas\b/i, namePl: 'Mięsień biodrowo-lędźwiowy', nameLt: 'Musculus iliopsoas', nameEn: 'Iliopsoas muscle', structureId: 'm_iliopsoas', category: 'muscle' },
  { pattern: /\btensor\s+fasciae\s+latae\b|\btfl\b|\bm\s+tensor\s+fasciae\s+latae\b/i, namePl: 'Mięsień naprężacz powięzi szerokiej', nameLt: 'Musculus tensor fasciae latae', nameEn: 'Tensor fasciae latae muscle', structureId: 'm_tensor_fasciae_latae', category: 'muscle' },
  { pattern: /\bquadratus\s+lumborum\b|\bm\s+quadratus\s+lumborum\b/i, namePl: 'Mięsień czworoboczny lędźwi', nameLt: 'Musculus quadratus lumborum', nameEn: 'Quadratus lumborum muscle', structureId: 'm_quadratus_lumborum', category: 'muscle' },
  { pattern: /\badductor\s+magnus\b|\bm\s+adductor\s+magnus\b/i, namePl: 'Mięsień przywodziciel wielki', nameLt: 'Musculus adductor magnus', nameEn: 'Adductor magnus muscle', structureId: 'm_adductor_magnus', category: 'muscle' },
  { pattern: /\badductor\s+longus\b|\bm\s+adductor\s+longus\b/i, namePl: 'Mięsień przywodziciel długi', nameLt: 'Musculus adductor longus', nameEn: 'Adductor longus muscle', structureId: 'm_adductor_longus', category: 'muscle' },
  { pattern: /\badductor\s+brevis\b|\bm\s+adductor\s+brevis\b/i, namePl: 'Mięsień przywodziciel krótki', nameLt: 'Musculus adductor brevis', nameEn: 'Adductor brevis muscle', structureId: 'm_adductor_brevis', category: 'muscle' },
  { pattern: /\badductor\s+hallucis\b/i, namePl: 'Mięsień przywodziciel palucha', nameLt: 'Musculus adductor hallucis', nameEn: 'Adductor hallucis muscle', category: 'muscle' },
  { pattern: /\bgracilis\b|\bm\s+gracilis\b/i, namePl: 'Mięsień smukły', nameLt: 'Musculus gracilis', nameEn: 'Gracilis muscle', structureId: 'm_gracilis', category: 'muscle' },
  { pattern: /\bsartorius\b|\bm\s+sartorius\b/i, namePl: 'Mięsień krawiecki', nameLt: 'Musculus sartorius', nameEn: 'Sartorius muscle', structureId: 'm_sartorius', category: 'muscle' },
  { pattern: /\bgastrocnemius\b|\bm\s+gastrocnemius\b/i, namePl: 'Mięsień brzuchaty łydki', nameLt: 'Musculus gastrocnemius', nameEn: 'Gastrocnemius muscle', structureId: 'm_gastrocnemius', category: 'muscle' },
  { pattern: /\bsoleus\b|\bm\s+soleus\b/i, namePl: 'Mięsień płaszczkowaty', nameLt: 'Musculus soleus', nameEn: 'Soleus muscle', structureId: 'm_soleus', category: 'muscle' },
  { pattern: /\bplantaris\b/i, namePl: 'Mięsień podeszwowy', nameLt: 'Musculus plantaris', nameEn: 'Plantaris muscle', category: 'muscle' },
  { pattern: /\btibialis\s+anterior\b|\bm\s+tibialis\s+anterior\b/i, namePl: 'Mięsień piszczelowy przedni', nameLt: 'Musculus tibialis anterior', nameEn: 'Tibialis anterior muscle', structureId: 'm_tibialis_anterior', category: 'muscle' },
  { pattern: /\btibialis\s+posterior\b|\bm\s+tibialis\s+posterior\b/i, namePl: 'Mięsień piszczelowy tylny', nameLt: 'Musculus tibialis posterior', nameEn: 'Tibialis posterior muscle', structureId: 'm_tibialis_posterior', category: 'muscle' },
  { pattern: /\b(peroneus|fibularis)\s+longus\b/i, namePl: 'Mięsień strzałkowy długi', nameLt: 'Musculus fibularis longus', nameEn: 'Fibularis longus muscle', structureId: 'm_peroneus_longus', category: 'muscle' },
  { pattern: /\b(peroneus|fibularis)\s+brevis\b/i, namePl: 'Mięsień strzałkowy krótki', nameLt: 'Musculus fibularis brevis', nameEn: 'Fibularis brevis muscle', structureId: 'm_fibularis_brevis', category: 'muscle' },
  { pattern: /\b(peroneus|fibularis)\s+tertius\b/i, namePl: 'Mięsień strzałkowy trzeci', nameLt: 'Musculus fibularis tertius', nameEn: 'Fibularis tertius muscle', category: 'muscle' },
  { pattern: /\bextensor\s+hallucis\s+longus\b/i, namePl: 'Mięsień prostownik długi palucha', nameLt: 'Musculus extensor hallucis longus', nameEn: 'Extensor hallucis longus muscle', structureId: 'm_extensor_hallucis_longus', category: 'muscle' },
  { pattern: /\bflexor\s+digitorum\s+longus\b/i, namePl: 'Mięsień zginacz długi palców stopy', nameLt: 'Musculus flexor digitorum longus', nameEn: 'Flexor digitorum longus muscle', category: 'muscle' },
  { pattern: /\bflexor\s+hallucis\s+longus\b/i, namePl: 'Mięsień zginacz długi palucha', nameLt: 'Musculus flexor hallucis longus', nameEn: 'Flexor hallucis longus muscle', structureId: 'm_flexor_hallucis_longus', category: 'muscle' },
  { pattern: /\bflexor\s+hallucis\s+brevis\b/i, namePl: 'Mięsień zginacz krótki palucha', nameLt: 'Musculus flexor hallucis brevis', nameEn: 'Flexor hallucis brevis muscle', category: 'muscle' },

  { pattern: /\btrapezius\b|\bm\s+trapezius\b/i, namePl: 'Mięsień czworoboczny', nameLt: 'Musculus trapezius', nameEn: 'Trapezius muscle', structureId: 'm_trapezius', category: 'muscle' },
  { pattern: /\blatissimus\s+dorsi\b|\bm\s+latissimus\s+dorsi\b/i, namePl: 'Mięsień najszerszy grzbietu', nameLt: 'Musculus latissimus dorsi', nameEn: 'Latissimus dorsi muscle', structureId: 'm_latissimus_dorsi', category: 'muscle' },
  { pattern: /\brhomboid\s+major\b/i, namePl: 'Mięsień równoległoboczny większy', nameLt: 'Musculus rhomboideus major', nameEn: 'Rhomboid major muscle', structureId: 'm_rhomboideus_major', category: 'muscle' },
  { pattern: /\brhomboid\s+minor\b/i, namePl: 'Mięsień równoległoboczny mniejszy', nameLt: 'Musculus rhomboideus minor', nameEn: 'Rhomboid minor muscle', structureId: 'm_rhomboideus_minor', category: 'muscle' },
  { pattern: /\brhomboid\b/i, namePl: 'Mięsień równoległoboczny', nameLt: 'Musculus rhomboideus', nameEn: 'Rhomboid muscle', category: 'muscle' },
  { pattern: /\blevator\s+scapulae\b/i, namePl: 'Mięsień dźwigacz łopatki', nameLt: 'Musculus levator scapulae', nameEn: 'Levator scapulae muscle', structureId: 'm_levator_scapulae', category: 'muscle' },
  { pattern: /\bsubclavius\b/i, namePl: 'Mięsień podobojczykowy', nameLt: 'Musculus subclavius', nameEn: 'Subclavius muscle', category: 'muscle' },
  { pattern: /\bserratus\s+posterior\s+superior\b/i, namePl: 'Mięsień zębaty tylny górny', nameLt: 'Musculus serratus posterior superior', nameEn: 'Serratus posterior superior muscle', category: 'muscle' },
  { pattern: /\bserratus\s+posterior\s+inferior\b/i, namePl: 'Mięsień zębaty tylny dolny', nameLt: 'Musculus serratus posterior inferior', nameEn: 'Serratus posterior inferior muscle', category: 'muscle' },
  { pattern: /\biliocostalis\s+(colli|cervicis)\b/i, namePl: 'Mięsień biodrowo-żebrowy szyi', nameLt: 'Musculus iliocostalis cervicis', nameEn: 'Iliocostalis cervicis muscle', structureId: 'm_erector_spinae', category: 'muscle' },
  { pattern: /\biliocostalis\s+thoracis\b/i, namePl: 'Mięsień biodrowo-żebrowy klatki piersiowej', nameLt: 'Musculus iliocostalis thoracis', nameEn: 'Iliocostalis thoracis muscle', structureId: 'm_erector_spinae', category: 'muscle' },
  { pattern: /\biliocostalis\s+lumborum\b/i, namePl: 'Mięsień biodrowo-żebrowy lędźwi', nameLt: 'Musculus iliocostalis lumborum', nameEn: 'Iliocostalis lumborum muscle', structureId: 'm_erector_spinae', category: 'muscle' },
  { pattern: /\blongissimus\s+capitis\b/i, namePl: 'Mięsień najdłuższy głowy', nameLt: 'Musculus longissimus capitis', nameEn: 'Longissimus capitis muscle', structureId: 'm_erector_spinae', category: 'muscle' },
  { pattern: /\blongissimus\s+(colli|cervicis)\b/i, namePl: 'Mięsień najdłuższy szyi', nameLt: 'Musculus longissimus cervicis', nameEn: 'Longissimus cervicis muscle', structureId: 'm_erector_spinae', category: 'muscle' },
  { pattern: /\blongissimus\s+thoracis\b/i, namePl: 'Mięsień najdłuższy klatki piersiowej', nameLt: 'Musculus longissimus thoracis', nameEn: 'Longissimus thoracis muscle', structureId: 'm_erector_spinae', category: 'muscle' },
  { pattern: /\bspinalis\s+capitis\b/i, namePl: 'Mięsień kolcowy głowy', nameLt: 'Musculus spinalis capitis', nameEn: 'Spinalis capitis muscle', structureId: 'm_erector_spinae', category: 'muscle' },
  { pattern: /\bspinalis\s+(colli|cervicis)\b/i, namePl: 'Mięsień kolcowy szyi', nameLt: 'Musculus spinalis cervicis', nameEn: 'Spinalis cervicis muscle', structureId: 'm_erector_spinae', category: 'muscle' },
  { pattern: /\bspinalis\s+thoracis\b/i, namePl: 'Mięsień kolcowy klatki piersiowej', nameLt: 'Musculus spinalis thoracis', nameEn: 'Spinalis thoracis muscle', structureId: 'm_erector_spinae', category: 'muscle' },
  { pattern: /\biliocostalis\b/i, namePl: 'Mięsień biodrowo-żebrowy', nameLt: 'Musculus iliocostalis', nameEn: 'Iliocostalis muscle', structureId: 'm_erector_spinae', category: 'muscle' },
  { pattern: /\blongissimus\b/i, namePl: 'Mięsień najdłuższy', nameLt: 'Musculus longissimus', nameEn: 'Longissimus muscle', structureId: 'm_erector_spinae', category: 'muscle' },
  { pattern: /\bspinalis\b/i, namePl: 'Mięsień kolcowy', nameLt: 'Musculus spinalis', nameEn: 'Spinalis muscle', structureId: 'm_erector_spinae', category: 'muscle' },
  { pattern: /\berector\s+spinae\b|\bm\s+erector\s+spinae\b/i, namePl: 'Mięsień prostownik grzbietu', nameLt: 'Musculus erector spinae', nameEn: 'Erector spinae muscle', structureId: 'm_erector_spinae', category: 'muscle' },
  { pattern: /\bsemispinalis\s+capitis\b/i, namePl: 'Mięsień półkolcowy głowy', nameLt: 'Musculus semispinalis capitis', nameEn: 'Semispinalis capitis muscle', category: 'muscle' },
  { pattern: /\bsemispinalis\s+(colli|cervicis)\b/i, namePl: 'Mięsień półkolcowy szyi', nameLt: 'Musculus semispinalis cervicis', nameEn: 'Semispinalis cervicis muscle', category: 'muscle' },
  { pattern: /\bsemispinalis\s+thoracis\b/i, namePl: 'Mięsień półkolcowy klatki piersiowej', nameLt: 'Musculus semispinalis thoracis', nameEn: 'Semispinalis thoracis muscle', category: 'muscle' },
  { pattern: /\bsemispinalis\b/i, namePl: 'Mięsień półkolcowy', nameLt: 'Musculus semispinalis', nameEn: 'Semispinalis muscle', category: 'muscle' },
  { pattern: /\bmultifidus\s+(colli|cervicis)\b/i, namePl: 'Mięsień wielodzielny szyi', nameLt: 'Musculus multifidus cervicis', nameEn: 'Multifidus cervicis muscle', category: 'muscle' },
  { pattern: /\bmultifidus\s+thoracis\b/i, namePl: 'Mięsień wielodzielny klatki piersiowej', nameLt: 'Musculus multifidus thoracis', nameEn: 'Multifidus thoracis muscle', category: 'muscle' },
  { pattern: /\bmultifidus\s+lumborum\b/i, namePl: 'Mięsień wielodzielny lędźwi', nameLt: 'Musculus multifidus lumborum', nameEn: 'Multifidus lumborum muscle', category: 'muscle' },
  { pattern: /\bmultifidus\b/i, namePl: 'Mięsień wielodzielny', nameLt: 'Musculus multifidus', nameEn: 'Multifidus muscle', category: 'muscle' },
  { pattern: /\brotatores\b/i, namePl: 'Mięśnie skręcające', nameLt: 'Musculi rotatores', nameEn: 'Rotatores muscles', category: 'muscle' },
  { pattern: /\binterspinales\s+(colli|cervicis)\b/i, namePl: 'Mięśnie międzykolcowe szyi', nameLt: 'Musculi interspinales cervicis', nameEn: 'Interspinales cervicis muscles', category: 'muscle' },
  { pattern: /\binterspinales\s+thoracis\b/i, namePl: 'Mięśnie międzykolcowe klatki piersiowej', nameLt: 'Musculi interspinales thoracis', nameEn: 'Interspinales thoracis muscles', category: 'muscle' },
  { pattern: /\binterspinales\s+lumborum\b/i, namePl: 'Mięśnie międzykolcowe lędźwi', nameLt: 'Musculi interspinales lumborum', nameEn: 'Interspinales lumborum muscles', category: 'muscle' },
  { pattern: /\binterspinales\b/i, namePl: 'Mięśnie międzykolcowe', nameLt: 'Musculi interspinales', nameEn: 'Interspinales muscles', category: 'muscle' },
  { pattern: /\bdorsal\s+parts\s+of\s+lateral\s+intertransversarii\s+lumborum\b/i, namePl: 'Mięśnie międzypoprzeczne boczne lędźwi — część grzbietowa', nameLt: 'Musculi intertransversarii laterales lumborum (partes dorsales)', nameEn: 'Lateral lumbar intertransversarii (dorsal parts)', category: 'muscle' },
  { pattern: /\bventral\s+parts\s+of\s+lateral\s+intertransversarii\s+lumborum\b/i, namePl: 'Mięśnie międzypoprzeczne boczne lędźwi — część brzuszna', nameLt: 'Musculi intertransversarii laterales lumborum (partes ventrales)', nameEn: 'Lateral lumbar intertransversarii (ventral parts)', category: 'muscle' },
  { pattern: /\bintertransversarii\b/i, namePl: 'Mięśnie międzypoprzeczne', nameLt: 'Musculi intertransversarii', nameEn: 'Intertransversarii muscles', category: 'muscle' },
  { pattern: /\blevatores\s+breves\s+costarum\b/i, namePl: 'Mięśnie dźwigacze krótkie żeber', nameLt: 'Musculi levatores costarum breves', nameEn: 'Levatores costarum breves muscles', category: 'muscle' },
  { pattern: /\blevatores\s+longi\s+costarum\b/i, namePl: 'Mięśnie dźwigacze długie żeber', nameLt: 'Musculi levatores costarum longi', nameEn: 'Levatores costarum longi muscles', category: 'muscle' },
  { pattern: /\blevatores\s+costarum\b/i, namePl: 'Mięśnie dźwigacze żeber', nameLt: 'Musculi levatores costarum', nameEn: 'Levatores costarum muscles', category: 'muscle' },
  { pattern: /\bexternal\s+intercostal\b/i, namePl: 'Mięśnie międzyżebrowe zewnętrzne', nameLt: 'Musculi intercostales externi', nameEn: 'External intercostal muscles', category: 'muscle' },
  { pattern: /\binternal\s+intercostal\b/i, namePl: 'Mięśnie międzyżebrowe wewnętrzne', nameLt: 'Musculi intercostales interni', nameEn: 'Internal intercostal muscles', category: 'muscle' },
  { pattern: /\binnermost\s+intercostal\b/i, namePl: 'Mięśnie międzyżebrowe najgłębsze', nameLt: 'Musculi intercostales intimi', nameEn: 'Innermost intercostal muscles', category: 'muscle' },
  { pattern: /\bintercostal\b/i, namePl: 'Mięśnie międzyżebrowe', nameLt: 'Musculi intercostales', nameEn: 'Intercostal muscles', category: 'muscle' },
  { pattern: /\btransversus\s+thoracis\b/i, namePl: 'Mięsień poprzeczny klatki piersiowej', nameLt: 'Musculus transversus thoracis', nameEn: 'Transversus thoracis muscle', category: 'muscle' },
  { pattern: /\bdiaphragm\b/i, namePl: 'Przepona', nameLt: 'Diaphragma', nameEn: 'Thoracic diaphragm', structureId: 'm_diaphragma', category: 'muscle' },
  { pattern: /\brectus\s+abdominis\b/i, namePl: 'Mięsień prosty brzucha', nameLt: 'Musculus rectus abdominis', nameEn: 'Rectus abdominis muscle', structureId: 'm_rectus_abdominis', category: 'muscle' },
  { pattern: /\bexternal\s+abdominal\s+oblique\b|\babdominal\s+external\s+oblique\b/i, namePl: 'Mięsień skośny zewnętrzny brzucha', nameLt: 'Musculus obliquus externus abdominis', nameEn: 'External abdominal oblique muscle', structureId: 'm_obliquus_externus_abdominis', category: 'muscle' },
  { pattern: /\binternal\s+abdominal\s+oblique\b|\babdominal\s+internal\s+oblique\b/i, namePl: 'Mięsień skośny wewnętrzny brzucha', nameLt: 'Musculus obliquus internus abdominis', nameEn: 'Internal abdominal oblique muscle', structureId: 'm_obliquus_internus_abdominis', category: 'muscle' },
  { pattern: /\btransversus\s+abdominis\b|\btransverse\s+abdominal\b/i, namePl: 'Mięsień poprzeczny brzucha', nameLt: 'Musculus transversus abdominis', nameEn: 'Transversus abdominis muscle', structureId: 'm_transversus_abdominis', category: 'muscle' },
  { pattern: /\bpyramidalis\b/i, namePl: 'Mięsień piramidowy', nameLt: 'Musculus pyramidalis', nameEn: 'Pyramidalis muscle', category: 'muscle' },
  { pattern: /\bcoccygeus\b|\bischiococcygeus\b/i, namePl: 'Mięsień guziczny', nameLt: 'Musculus coccygeus', nameEn: 'Coccygeus muscle', category: 'muscle' },
  { pattern: /\blevator\s+ani\b|\bpubococcygeus\b|\biliococcygeus\b|\bpuborectalis\b/i, namePl: 'Mięsień dźwigacz odbytu', nameLt: 'Musculus levator ani', nameEn: 'Levator ani muscle', category: 'muscle' },

  { pattern: /\bnasalis(\s+muscle)?\b|\bm\s+nasalis\b/i, namePl: 'Mięsień nosowy', nameLt: 'Musculus nasalis', nameEn: 'Nasalis muscle', structureId: 'm_nasalis', category: 'muscle' },
  { pattern: /\bdepressor\s+septi(\s+nasi)?\b|\bm\s+depressor\s+septi\s+nasi\b/i, namePl: 'Mięsień obniżacz przegrody nosa', nameLt: 'Musculus depressor septi nasi', nameEn: 'Depressor septi nasi muscle', structureId: 'm_depressor_septi_nasi', category: 'muscle' },
  { pattern: /\bprocerus(\s+muscle)?\b|\bm\s+procerus\b/i, namePl: 'Mięsień podłużny', nameLt: 'Musculus procerus', nameEn: 'Procerus muscle', structureId: 'm_procerus', category: 'muscle' },
  { pattern: /\b(levator\s+nasolabialis|levator\s+labii\s+superioris\s+alaeque\s+nasi)\b/i, namePl: 'Mięsień dźwigacz wargi górnej i skrzydła nosa', nameLt: 'Musculus levator labii superioris alaeque nasi', nameEn: 'Levator labii superioris alaeque nasi muscle', structureId: 'm_levator_labii_superioris_alaeque_nasi', category: 'muscle' },
  { pattern: /\blevator\s+labii\s+superioris\b/i, namePl: 'Mięsień dźwigacz wargi górnej', nameLt: 'Musculus levator labii superioris', nameEn: 'Levator labii superioris muscle', category: 'muscle' },
  { pattern: /\blevator\s+anguli\s+oris\b/i, namePl: 'Mięsień dźwigacz kąta ust', nameLt: 'Musculus levator anguli oris', nameEn: 'Levator anguli oris muscle', category: 'muscle' },
  { pattern: /\bdepressor\s+anguli\s+oris\b/i, namePl: 'Mięsień obniżacz kąta ust', nameLt: 'Musculus depressor anguli oris', nameEn: 'Depressor anguli oris muscle', category: 'muscle' },
  { pattern: /\bdepressor\s+labii\s+inferioris\b/i, namePl: 'Mięsień obniżacz wargi dolnej', nameLt: 'Musculus depressor labii inferioris', nameEn: 'Depressor labii inferioris muscle', category: 'muscle' },
  { pattern: /\bzygomaticus\s+major\b/i, namePl: 'Mięsień jarzmowy większy', nameLt: 'Musculus zygomaticus major', nameEn: 'Zygomaticus major muscle', category: 'muscle' },
  { pattern: /\bzygomaticus\s+minor\b/i, namePl: 'Mięsień jarzmowy mniejszy', nameLt: 'Musculus zygomaticus minor', nameEn: 'Zygomaticus minor muscle', category: 'muscle' },
  { pattern: /\borbicularis\s+oris\b/i, namePl: 'Mięsień okrężny ust', nameLt: 'Musculus orbicularis oris', nameEn: 'Orbicularis oris muscle', category: 'muscle' },
  { pattern: /\bbuc{1,2}inator\b/i, namePl: 'Mięsień policzkowy', nameLt: 'Musculus buccinator', nameEn: 'Buccinator muscle', category: 'muscle' },
  { pattern: /\bmentalis\b/i, namePl: 'Mięsień bródkowy', nameLt: 'Musculus mentalis', nameEn: 'Mentalis muscle', category: 'muscle' },
  { pattern: /\brisorius\b/i, namePl: 'Mięsień śmiechowy', nameLt: 'Musculus risorius', nameEn: 'Risorius muscle', category: 'muscle' },
  { pattern: /\borbital\s+part\s+of\s+orbicularis\s+oculi\b/i, namePl: 'Mięsień okrężny oka — część oczodołowa', nameLt: 'Musculus orbicularis oculi (pars orbitalis)', nameEn: 'Orbicularis oculi (orbital part)', category: 'muscle' },
  { pattern: /\bpalpebral\s+part\s+of\s+orbicularis\s+oculi\b/i, namePl: 'Mięsień okrężny oka — część powiekowa', nameLt: 'Musculus orbicularis oculi (pars palpebralis)', nameEn: 'Orbicularis oculi (palpebral part)', category: 'muscle' },
  { pattern: /\borbicularis\s+oculi\b/i, namePl: 'Mięsień okrężny oka', nameLt: 'Musculus orbicularis oculi', nameEn: 'Orbicularis oculi muscle', category: 'muscle' },
  { pattern: /\bcorrugator\s+supercilii\b/i, namePl: 'Mięsień marszczący brwi', nameLt: 'Musculus corrugator supercilii', nameEn: 'Corrugator supercilii muscle', category: 'muscle' },
  { pattern: /\blevator\s+palpebrae\s+superioris\b/i, namePl: 'Mięsień dźwigacz powieki górnej', nameLt: 'Musculus levator palpebrae superioris', nameEn: 'Levator palpebrae superioris muscle', category: 'muscle' },
  { pattern: /\bsuperior\s+rectus\b/i, namePl: 'Mięsień prosty górny oka', nameLt: 'Musculus rectus superior bulbi', nameEn: 'Superior rectus muscle', category: 'muscle' },
  { pattern: /\binferior\s+rectus\b/i, namePl: 'Mięsień prosty dolny oka', nameLt: 'Musculus rectus inferior bulbi', nameEn: 'Inferior rectus muscle', category: 'muscle' },
  { pattern: /\bmedial\s+rectus\b/i, namePl: 'Mięsień prosty przyśrodkowy oka', nameLt: 'Musculus rectus medialis bulbi', nameEn: 'Medial rectus muscle', category: 'muscle' },
  { pattern: /\blateral\s+rectus\b/i, namePl: 'Mięsień prosty boczny oka', nameLt: 'Musculus rectus lateralis bulbi', nameEn: 'Lateral rectus muscle', category: 'muscle' },
  { pattern: /\bsuperior\s+oblique\b/i, namePl: 'Mięsień skośny górny oka', nameLt: 'Musculus obliquus superior bulbi', nameEn: 'Superior oblique muscle', category: 'muscle' },
  { pattern: /\binferior\s+oblique\b/i, namePl: 'Mięsień skośny dolny oka', nameLt: 'Musculus obliquus inferior bulbi', nameEn: 'Inferior oblique muscle', category: 'muscle' },
  { pattern: /\bfrontalis\b/i, namePl: 'Brzusiec czołowy mięśnia naczasznego', nameLt: 'Venter frontalis musculi occipitofrontalis', nameEn: 'Frontalis muscle', category: 'muscle' },
  { pattern: /\boccipitalis\b/i, namePl: 'Brzusiec potyliczny mięśnia naczasznego', nameLt: 'Venter occipitalis musculi occipitofrontalis', nameEn: 'Occipitalis muscle', category: 'muscle' },
  { pattern: /\btemporoparietalis\b/i, namePl: 'Mięsień skroniowo-ciemieniowy', nameLt: 'Musculus temporoparietalis', nameEn: 'Temporoparietalis muscle', category: 'muscle' },
  { pattern: /\bmasseter\b|\bm\s+masseter\b/i, namePl: 'Mięsień żwacz', nameLt: 'Musculus masseter', nameEn: 'Masseter muscle', structureId: 'm_masseter', category: 'muscle' },
  { pattern: /\btemporalis\b|\bm\s+temporalis\b/i, namePl: 'Mięsień skroniowy', nameLt: 'Musculus temporalis', nameEn: 'Temporalis muscle', structureId: 'm_temporalis', category: 'muscle' },
  { pattern: /\bmedial\s+pterygoid\b/i, namePl: 'Mięsień skrzydłowy przyśrodkowy', nameLt: 'Musculus pterygoideus medialis', nameEn: 'Medial pterygoid muscle', category: 'muscle' },
  { pattern: /\bsuperior\s+head\s+of\s+lateral\s+pterygoid\b/i, namePl: 'Mięsień skrzydłowy boczny — głowa górna', nameLt: 'Musculus pterygoideus lateralis (caput superius)', nameEn: 'Lateral pterygoid muscle (superior head)', category: 'muscle' },
  { pattern: /\binferior\s+head\s+of\s+lateral\s+pterygoid\b/i, namePl: 'Mięsień skrzydłowy boczny — głowa dolna', nameLt: 'Musculus pterygoideus lateralis (caput inferius)', nameEn: 'Lateral pterygoid muscle (inferior head)', category: 'muscle' },
  { pattern: /\blateral\s+pterygoid\b/i, namePl: 'Mięsień skrzydłowy boczny', nameLt: 'Musculus pterygoideus lateralis', nameEn: 'Lateral pterygoid muscle', category: 'muscle' },
  { pattern: /\bpterygoideus\b|\bm\s+pterygoideus\b/i, namePl: 'Mięsień skrzydłowy', nameLt: 'Musculus pterygoideus', nameEn: 'Pterygoid muscle', category: 'muscle' },
  { pattern: /\bplatysma\b/i, namePl: 'Mięsień szeroki szyi', nameLt: 'Platysma', nameEn: 'Platysma muscle', category: 'muscle' },
  { pattern: /\bsternocleidomastoid\b|\bscm\b|\bm\s+sternocleidomastoideus\b/i, namePl: 'Mięsień mostkowo-obojczykowo-sutkowy (MOS)', nameLt: 'Musculus sternocleidomastoideus', nameEn: 'Sternocleidomastoid muscle (SCM)', structureId: 'm_sternocleidomastoideus', category: 'muscle' },
  { pattern: /\bscalenus\s+anterior\b/i, namePl: 'Mięsień pochyły przedni', nameLt: 'Musculus scalenus anterior', nameEn: 'Anterior scalene muscle', structureId: 'm_scaleni', category: 'muscle' },
  { pattern: /\bscalenus\s+medius\b/i, namePl: 'Mięsień pochyły środkowy', nameLt: 'Musculus scalenus medius', nameEn: 'Middle scalene muscle', structureId: 'm_scaleni', category: 'muscle' },
  { pattern: /\bscalenus\s+posterior\b/i, namePl: 'Mięsień pochyły tylny', nameLt: 'Musculus scalenus posterior', nameEn: 'Posterior scalene muscle', structureId: 'm_scaleni', category: 'muscle' },
  { pattern: /\bscalene\b|\bscaleni\b|\bm\s+scaleni\b/i, namePl: 'Mięśnie pochyłe szyi', nameLt: 'Musculi scaleni', nameEn: 'Scalene muscles', structureId: 'm_scaleni', category: 'muscle' },
  { pattern: /\blongus\s+capitis\b/i, namePl: 'Mięsień długi głowy', nameLt: 'Musculus longus capitis', nameEn: 'Longus capitis muscle', category: 'muscle' },
  { pattern: /\blongus\s+colli\b/i, namePl: 'Mięsień długi szyi', nameLt: 'Musculus longus colli', nameEn: 'Longus colli muscle', structureId: 'm_longus_colli', category: 'muscle' },
  { pattern: /\brectus\s+anterior\s+capitis\b|\brectus\s+capitis\s+anterior\b/i, namePl: 'Mięsień prosty przedni głowy', nameLt: 'Musculus rectus capitis anterior', nameEn: 'Rectus capitis anterior muscle', category: 'muscle' },
  { pattern: /\brectus\s+lateralis\s+capitis\b|\brectus\s+capitis\s+lateralis\b/i, namePl: 'Mięsień prosty boczny głowy', nameLt: 'Musculus rectus capitis lateralis', nameEn: 'Rectus capitis lateralis muscle', category: 'muscle' },
  { pattern: /\brectus\s+(?:posterior\s+major\s+capitis|capitis\s+posterior\s+major)\b/i, namePl: 'Mięsień prosty tylny większy głowy', nameLt: 'Musculus rectus capitis posterior major', nameEn: 'Rectus capitis posterior major muscle', category: 'muscle' },
  { pattern: /\brectus\s+(?:posterior\s+minor\s+capitis|capitis\s+posterior\s+minor)\b/i, namePl: 'Mięsień prosty tylny mniejszy głowy', nameLt: 'Musculus rectus capitis posterior minor', nameEn: 'Rectus capitis posterior minor muscle', category: 'muscle' },
  { pattern: /\bobliquus\s+(?:inferior\s+capitis|capitis\s+inferior)\b/i, namePl: 'Mięsień skośny dolny głowy', nameLt: 'Musculus obliquus capitis inferior', nameEn: 'Obliquus capitis inferior muscle', category: 'muscle' },
  { pattern: /\bobliquus\s+(?:superior\s+capitis|capitis\s+superior)\b/i, namePl: 'Mięsień skośny górny głowy', nameLt: 'Musculus obliquus capitis superior', nameEn: 'Obliquus capitis superior muscle', category: 'muscle' },
  { pattern: /\bsplenius\s+capitis\b/i, namePl: 'Mięsień płatowaty głowy', nameLt: 'Musculus splenius capitis', nameEn: 'Splenius capitis muscle', structureId: 'm_splenius_capitis', category: 'muscle' },
  { pattern: /\bsplenius\s+(colli|cervicis)\b/i, namePl: 'Mięsień płatowaty szyi', nameLt: 'Musculus splenius cervicis', nameEn: 'Splenius cervicis muscle', category: 'muscle' },
  { pattern: /\bgenioglossus\b/i, namePl: 'Mięsień bródkowo-językowy', nameLt: 'Musculus genioglossus', nameEn: 'Genioglossus muscle', category: 'muscle' },
  { pattern: /\bhyoglossus\b/i, namePl: 'Mięsień gnykowo-językowy', nameLt: 'Musculus hyoglossus', nameEn: 'Hyoglossus muscle', category: 'muscle' },
  { pattern: /\bstyloglossus\b/i, namePl: 'Mięsień rylcowo-językowy', nameLt: 'Musculus styloglossus', nameEn: 'Styloglossus muscle', category: 'muscle' },
  { pattern: /\bgeniohyoid\b/i, namePl: 'Mięsień bródkowo-gnykowy', nameLt: 'Musculus geniohyoideus', nameEn: 'Geniohyoid muscle', category: 'muscle' },
  { pattern: /\bmylohyoid\b/i, namePl: 'Mięsień żuchwowo-gnykowy', nameLt: 'Musculus mylohyoideus', nameEn: 'Mylohyoid muscle', category: 'muscle' },
  { pattern: /\bstylohyoid\s+muscle\b/i, namePl: 'Mięsień rylcowo-gnykowy', nameLt: 'Musculus stylohyoideus', nameEn: 'Stylohyoid muscle', category: 'muscle' },
  { pattern: /\bomohyoid\b/i, namePl: 'Mięsień łopatkowo-gnykowy', nameLt: 'Musculus omohyoideus', nameEn: 'Omohyoid muscle', category: 'muscle' },
  { pattern: /\bsternohyoid\b/i, namePl: 'Mięsień mostkowo-gnykowy', nameLt: 'Musculus sternohyoideus', nameEn: 'Sternohyoid muscle', category: 'muscle' },
  { pattern: /\bsternothyroid\b/i, namePl: 'Mięsień mostkowo-tarczowy', nameLt: 'Musculus sternothyroideus', nameEn: 'Sternothyroid muscle', category: 'muscle' },
  { pattern: /\bthyrohyoid\s+muscle\b/i, namePl: 'Mięsień tarczowo-gnykowy', nameLt: 'Musculus thyrohyoideus', nameEn: 'Thyrohyoid muscle', category: 'muscle' },
  { pattern: /\banterior\s+belly\s+of\s+digastric\b/i, namePl: 'Mięsień dwubrzuścowy — brzusiec przedni', nameLt: 'Musculus digastricus (venter anterior)', nameEn: 'Digastric muscle (anterior belly)', category: 'muscle' },
  { pattern: /\bposterior\s+belly\s+of\s+digastric\b/i, namePl: 'Mięsień dwubrzuścowy — brzusiec tylny', nameLt: 'Musculus digastricus (venter posterior)', nameEn: 'Digastric muscle (posterior belly)', category: 'muscle' },
  { pattern: /\bdigastric\b/i, namePl: 'Mięsień dwubrzuścowy', nameLt: 'Musculus digastricus', nameEn: 'Digastric muscle', category: 'muscle' },
  { pattern: /\bsuperior\s+pharyngeal\s+constrictor\b/i, namePl: 'Mięsień zwieracz górny gardła', nameLt: 'Musculus constrictor pharyngis superior', nameEn: 'Superior pharyngeal constrictor', category: 'muscle' },
  { pattern: /\bmiddle\s+pharyngeal\s+constrictor\b/i, namePl: 'Mięsień zwieracz środkowy gardła', nameLt: 'Musculus constrictor pharyngis medius', nameEn: 'Middle pharyngeal constrictor', category: 'muscle' },
  { pattern: /\binferior\s+pharyngeal\s+constrictor\b/i, namePl: 'Mięsień zwieracz dolny gardła', nameLt: 'Musculus constrictor pharyngis inferior', nameEn: 'Inferior pharyngeal constrictor', category: 'muscle' },
  { pattern: /\bpalatopharyngeus\b/i, namePl: 'Mięsień podniebienno-gardłowy', nameLt: 'Musculus palatopharyngeus', nameEn: 'Palatopharyngeus muscle', category: 'muscle' },
  { pattern: /\bstylopharyngeus\b/i, namePl: 'Mięsień rylcowo-gardłowy', nameLt: 'Musculus stylopharyngeus', nameEn: 'Stylopharyngeus muscle', category: 'muscle' },
  { pattern: /\bstraight\s+part\s+of\s+cricothyroid\b/i, namePl: 'Mięsień pierścienno-tarczowy — część prosta', nameLt: 'Musculus cricothyroideus (pars recta)', nameEn: 'Cricothyroid muscle (straight part)', category: 'muscle' },
  { pattern: /\boblique\s+part\s+of\s+cricothyroid\b/i, namePl: 'Mięsień pierścienno-tarczowy — część skośna', nameLt: 'Musculus cricothyroideus (pars obliqua)', nameEn: 'Cricothyroid muscle (oblique part)', category: 'muscle' },
  { pattern: /\bthyro[-\s]*epiglottic\s+part\s+of\s+thyro[-\s]*arytenoid\b/i, namePl: 'Mięsień tarczowo-nagłośniowy', nameLt: 'Pars thyroepiglottica musculi thyroarytenoidei', nameEn: 'Thyroepiglottic part of thyroarytenoid muscle', category: 'muscle' },
  { pattern: /\bexternal\s+part\s+of\s+thyro[-\s]*arytenoid\b/i, namePl: 'Mięsień tarczowo-nalewkowy — część zewnętrzna', nameLt: 'Musculus thyroarytenoideus (pars externa)', nameEn: 'Thyroarytenoid muscle (external part)', category: 'muscle' },
  { pattern: /\bary[-\s]*epiglottic\s+part\s+of\s+oblique\s+arytenoid\b/i, namePl: 'Mięsień nalewkowo-nagłośniowy', nameLt: 'Pars aryepiglottica musculi arytenoidei obliqui', nameEn: 'Aryepiglottic part of oblique arytenoid muscle', category: 'muscle' },
  { pattern: /\btransverse\s+arytenoid\b/i, namePl: 'Mięsień nalewkowy poprzeczny', nameLt: 'Musculus arytenoideus transversus', nameEn: 'Transverse arytenoid muscle', category: 'muscle' },
  { pattern: /\blateral\s+crico[-\s]*arytenoid\b/i, namePl: 'Mięsień pierścienno-nalewkowy boczny', nameLt: 'Musculus cricoarytenoideus lateralis', nameEn: 'Lateral cricoarytenoid muscle', category: 'muscle' },
  { pattern: /\bposterior\s+crico[-\s]*arytenoid\b/i, namePl: 'Mięsień pierścienno-nalewkowy tylny', nameLt: 'Musculus cricoarytenoideus posterior', nameEn: 'Posterior cricoarytenoid muscle', category: 'muscle' },

  // Short generic fallbacks (only after all specific multi-word rules above)
  { pattern: /\b(mesh\s+)?fibula\b/i, namePl: 'Kość strzałkowa', nameLt: 'Fibula', nameEn: 'Fibula', structureId: 'fibula', category: 'bone' },
  { pattern: /\btarsus\b|\bossa\s+tarsi\b/i, namePl: 'Kości stępu', nameLt: 'Ossa tarsi', nameEn: 'Tarsal bones', structureId: 'talus', category: 'bone' },
  { pattern: /\bbiceps\b(?!.*femor)/i, namePl: 'Mięsień dwugłowy ramienia', nameLt: 'Musculus biceps brachii', nameEn: 'Biceps brachii muscle', structureId: 'm_biceps_brachii', category: 'muscle' },
  { pattern: /\btriceps\b/i, namePl: 'Mięsień trójgłowy ramienia', nameLt: 'Musculus triceps brachii', nameEn: 'Triceps brachii muscle', structureId: 'm_triceps_brachii', category: 'muscle' },
  { pattern: /^\s*temporal\s*$/i, namePl: 'Kość skroniowa', nameLt: 'Os temporale', nameEn: 'Temporal bone', structureId: 'cranium', category: 'bone' },
];

// =============================================================================
// COMPOSITIONAL POLISH + TERMINOLOGIA ANATOMICA LATIN ENGINE FOR DEEP Z-ANATOMY MESHES
// =============================================================================

interface LexPair {
  re: RegExp;
  pl: string;
  lt: string;
}

const COMPOUND_PHRASE_LEXICON: LexPair[] = [
  // Multi-word clinical structures & vessels/ligaments/CNS
  { re: /\barticular\s+capsules?\s+of\s+proximal\s+interphalangeal\s+joints?\s+of\s+fo(?:ot)?\b/gi, pl: 'torebki stawowe stawów międzypaliczkowych bliższych stopy', lt: 'capsulae articulares articulationum interphalangearum proximalium pedis' },
  { re: /\barticular\s+capsules?\s+of\s+distal\s+interphalangeal\s+joints?\s+of\s+foot\b/gi, pl: 'torebki stawowe stawów międzypaliczkowych dalszych stopy', lt: 'capsulae articulares articulationum interphalangearum distalium pedis' },
  { re: /\barticular\s+capsule\s+of\s+interphalangeal\s+joint\s+of\s+great\s+toe\b/gi, pl: 'torebka stawowa stawu międzypaliczkowego palucha', lt: 'capsula articularis articulationis interphalangeae hallucis' },
  { re: /\barticular\s+capsules?\s+of\s+metatarsophalangeal\s+joints?\b/gi, pl: 'torebki stawowe stawów śródstopno-paliczkowych', lt: 'capsulae articulares articulationum metatarsophalangearum' },
  { re: /\barticular\s+capsules?\s+of\s+metacarpophalangeal\s+joints?\b/gi, pl: 'torebki stawowe stawów śródręczno-paliczkowych', lt: 'capsulae articulares articulationum metacarpophalangearum' },
  { re: /\barticular\s+capsules?\s+of\s+proximal\s+interphalangeal\s+joints?\b/gi, pl: 'torebki stawowe stawów międzypaliczkowych bliższych ręki', lt: 'capsulae articulares articulationum interphalangearum proximalium manus' },
  { re: /\barticular\s+capsules?\s+of\s+distal\s+interphalangeal\s+joints?\b/gi, pl: 'torebki stawowe stawów międzypaliczkowych dalszych ręki', lt: 'capsulae articulares articulationum interphalangearum distalium manus' },
  { re: /\barticular\s+capsule\s+of\s+temporomandibular\s+joint\b/gi, pl: 'torebka stawowa stawu skroniowo-żuchwowego', lt: 'capsula articularis temporomandibularis' },
  { re: /\barticular\s+capsule\s+of\s+sternoclavicular\s+joint\b/gi, pl: 'torebka stawowa stawu mostkowo-obojczykowego', lt: 'capsula articularis sternoclavicularis' },
  { re: /\barticular\s+capsule\s+of\s+elbow\s+joint\b/gi, pl: 'torebka stawowa stawu łokciowego', lt: 'capsula articularis cubiti' },
  { re: /\barticular\s+capsule\s+of\s+radiocarpal\s+joint\b/gi, pl: 'torebka stawowa stawu promieniowo-nadgarstkowego', lt: 'capsula articularis radiocarpalis' },
  { re: /\barticular\s+capsule\s+of\s+knee\s+joint\b/gi, pl: 'torebka stawowa stawu kolanowego', lt: 'capsula articularis genus' },
  { re: /\barticular\s+capsule\s+of\s+superior\s+tibiofibular\s+joint\b/gi, pl: 'torebka stawowa stawu piszczelowo-strzałkowego górnego', lt: 'capsula articularis tibiofibularis' },
  { re: /\bsuspensory\s+ligament\s+of\s+eyeball\b/gi, pl: 'więzadło wieszadłowe gałki ocznej (Lockwooda)', lt: 'ligamentum suspensorium bulbi' },
  { re: /\bintra-?articular\s+ligament\s+of\s+head\s+of\s+rib\b/gi, pl: 'więzadło śródstawowe głowy żebra', lt: 'ligamentum capitis costae intraarticulare' },
  { re: /\bradiate\s+ligament\s+of\s+head\s+of\s+rib\b/gi, namePl: '', pl: 'więzadło promieniste głowy żebra', lt: 'ligamentum capitis costae radiatum' } as unknown as LexPair,
  { re: /\bulnar\s+collateral\s+ligament\s+of\s+wrist(\s+joint)?\b/gi, pl: 'więzadło poboczne łokciowe nadgarstka', lt: 'ligamentum collaterale carpi ulnare' },
  { re: /\bradial\s+collateral\s+ligament\s+of\s+wrist(\s+joint)?\b/gi, pl: 'więzadło poboczne promieniowe nadgarstka', lt: 'ligamentum collaterale carpi radiale' },
  { re: /\bdorsal\s+venous\s+network\s+of\s+hand\b/gi, pl: 'sieć żylna grzbietowa ręki', lt: 'rete venosum dorsale manus' },
  { re: /\bsuperficial\s+venous\s+palmar\s+arch\b/gi, pl: 'łuk żylny dłoniowy powierzchowny', lt: 'arcus venosus palmaris superficialis' },
  { re: /\bdeep\s+venous\s+palmar\s+arch\b/gi, pl: 'łuk żylny dłoniowy głęboki', lt: 'arcus venosus palmaris profundus' },
  { re: /\bdorsal\s+venous\s+arch\s+of\s+foot\b/gi, pl: 'łuk żylny grzbietowy stopy', lt: 'arcus venosus dorsalis pedis' },
  { re: /\bplantar\s+venous\s+arch\b/gi, pl: 'łuk żylny podeszwowy', lt: 'arcus venosus plantaris' },
  { re: /\bwhite\s+matter\s+of\s+telencephalon\b/gi, pl: 'istota biała kresomózgowia', lt: 'substantia alba telencephali' },
  { re: /\baqueduct\s+of\s+midbrain\b/gi, pl: 'wodociąg śródmózgowia (Sylwiusza)', lt: 'aqueductus mesencephali' },
  { re: /\bbase\s+of\s+peduncle\b/gi, pl: 'podstawa konaru mózgu', lt: 'basis pedunculi cerebri' },
  { re: /\binterpeduncular\s+fossa\b/gi, pl: 'dół międzykonarowy', lt: 'fossa interpeduncularis' },
  { re: /\bamygdaloid\s+body\b/gi, pl: 'ciało migdałowate', lt: 'corpus amygdaloideum' },
  { re: /\bmamillary\s+body\b/gi, pl: 'ciało suteczkowate', lt: 'corpus mamillare' },
  { re: /\blateral\s+geniculate\s+body\b/gi, pl: 'ciało kolankowate boczne', lt: 'corpus geniculatum laterale' },
  { re: /\bmedial\s+geniculate\s+body\b/gi, pl: 'ciało kolankowate przyśrodkowe', lt: 'corpus geniculatum mediale' },
  { re: /\blateral\s+ventricle\b/gi, pl: 'komora boczna mózgu', lt: 'ventriculus lateralis' },
  { re: /\bsuperior\s+colliculus\b/gi, pl: 'wzgórek górny blaszki czworaczej', lt: 'colliculus superior' },
  { re: /\binferior\s+colliculus\b/gi, pl: 'wzgórek dolny blaszki czworaczej', lt: 'colliculus inferior' },
  { re: /\banterior\s+commissure\b/gi, pl: 'spoidło przednie mózgu', lt: 'commissura anterior' },
  { re: /\bposterior\s+commissure\b/gi, pl: 'spoidło tylne mózgu', lt: 'commissura posterior' },
  { re: /\bpyramid\s+of\s+medulla\s+oblongata\b/gi, pl: 'piramida rdzenia przedłużonego', lt: 'pyramis medullae oblongatae' },
  { re: /\bwing\s+of\s+central\s+lobule\b/gi, pl: 'skrzydło płacika środkowego móżdżku', lt: 'ala lobuli centralis' },
  { re: /\buvula\s+of\s+vermis\b/gi, pl: 'języczek robaka móżdżku', lt: 'uvula vermis' },
  { re: /\btuber\s+of\s+vermis\b/gi, pl: 'guz robaka móżdżku', lt: 'tuber vermis' },
  { re: /\bpyramis\s+of\s+vermis\b/gi, pl: 'piramida robaka móżdżku', lt: 'pyramis vermis' },
  { re: /\bnodule\s+of\s+vermis\b/gi, pl: 'grudka robaka móżdżku', lt: 'nodulus vermis' },
  { re: /\bfolium\s+of\s+vermis\b/gi, pl: 'liść robaka móżdżku', lt: 'folium vermis' },
  { re: /\bpeduncle\s+of\s+flocculus\b/gi, pl: 'konar kłaczka móżdżku', lt: 'pedunculus flocculi' },
  { re: /\bspinal\s+reticular\s+process\b/gi, pl: 'twór siatkowaty rdzenia kręgowego', lt: 'formatio reticularis spinalis' },
  { re: /\blateral\s+intermediate\s+substance\b/gi, pl: 'istota pośrednia boczna rdzenia kręgowego', lt: 'substantia intermedia lateralis' },
  { re: /\bartery\s+of\s+pterygoid\s+canal\b/gi, pl: 'tętnica kanału skrzydłowego', lt: 'arteria canalis pterygoidei' },
  { re: /\bartery\s+of\s+central\s+sulcus\b/gi, pl: 'tętnica bruzdy środkowej', lt: 'arteria sulci centralis' },
  { re: /\bartery\s+of\s+precentral\s+sulcus\b/gi, pl: 'tętnica bruzdy przedśrodkowej', lt: 'arteria sulci praecentralis' },
  { re: /\bdeep\s+artery\s+of\s+penis\b/gi, pl: 'tętnica głęboka prącia', lt: 'arteria profunda penis' },
  { re: /\bdorsal\s+artery\s+of\s+penis\b/gi, pl: 'tętnica grzbietowa prącia', lt: 'arteria dorsalis penis' },
  { re: /\bdeep\s+dorsal\s+vein\s+of\s+penis\b/gi, pl: 'żyła grzbietowa głęboka prącia', lt: 'vena dorsalis profunda penis' },
  { re: /\bsuperficial\s+dorsal\s+veins?\s+of\s+penis\b/gi, pl: 'żyły grzbietowe powierzchowne prącia', lt: 'venae dorsales superficiales penis' },
  { re: /\binferior\s+vein\s+of\s+left\s+ventricle\b/gi, pl: 'żyła tylna komory lewej serca', lt: 'vena ventriculi sinistri posterior' },
  { re: /\bnerve\s+to\s+mylohyoid(\s+muscle)?\b/gi, pl: 'nerw żuchwowo-gnykowy', lt: 'nervus mylohyoideus' },
  { re: /\bnerve\s+to\s+piriformis(\s+muscle)?\b/gi, pl: 'nerw mięśnia gruszkowatego', lt: 'nervus musculi piriformis' },
  { re: /\bnerve\s+to\s+quadratus\s+femoris(\s+muscle)?\b/gi, pl: 'nerw mięśnia czworobocznego uda', lt: 'nervus musculi quadrati femoris' },
  { re: /\bolfactory\s+nerve(\s*\(I\))?\b/gi, pl: 'nerw węchowy (I)', lt: 'nervus olfactorius (I)' },
  { re: /\boptic\s+nerve(\s*\(II\))?\b/gi, pl: 'nerw wzrokowy (II)', lt: 'nervus opticus (II)' },
  { re: /\boculomotor\s+nerve(\s*\(III\))?\b/gi, pl: 'nerw okoruchowy (III)', lt: 'nervus oculomotorius (III)' },
  { re: /\btrochlear\s+nerve(\s*\(IV\))?\b/gi, pl: 'nerw bloczkowy (IV)', lt: 'nervus trochlearis (IV)' },
  { re: /\babducens\s+nerve(\s*\(VI\))?\b/gi, pl: 'nerw odwodzący (VI)', lt: 'nervus abducens (VI)' },
  { re: /\bvestibulocochlear\s+nerve(\s*\(VIII\))?\b/gi, pl: 'nerw przedsionkowo-ślimakowy (VIII)', lt: 'nervus vestibulocochlearis (VIII)' },
  { re: /\bglossopharyngeal\s+nerve(\s*\(IX\))?\b/gi, pl: 'nerw językowo-gardłowy (IX)', lt: 'nervus glossopharyngeus (IX)' },
  { re: /\bhypoglossal\s+nerve(\s*\(XII\))?\b/gi, pl: 'nerw podjęzykowy (XII)', lt: 'nervus hypoglossus (XII)' },
  { re: /\bchorda\s+tympani\b/gi, pl: 'struna bębenkowa', lt: 'chorda tympani' },
  { re: /\boptic\s+chiasm\b/gi, pl: 'skrzyżowanie wzrokowe', lt: 'chiasma opticum' },
  { re: /\boptic\s+tract\b/gi, pl: 'pasmo wzrokowe', lt: 'tractus opticus' },
  { re: /\bred\s+nucleus\b/gi, pl: 'jądro czerwienne', lt: 'nucleus ruber' },
  { re: /\bnucleus\s+ambiguus\b/gi, pl: 'jądro dwuznaczne', lt: 'nucleus ambiguus' },
  { re: /\bnucleus\s+proprius\b/gi, pl: 'jądro własne rogu tylnego', lt: 'nucleus proprius' },
  { re: /\bcaudate\s+nucleus\b/gi, pl: 'jądro ogoniaste', lt: 'nucleus caudatus' },
  { re: /\blentiform\s+nucleus\b/gi, pl: 'jądro soczewkowate', lt: 'nucleus lentiformis' },
  { re: /\bseptal\s+nuclei\b/gi, pl: 'jądra przegrodowe', lt: 'nuclei septales' },
  { re: /\bvestibular\s+nuclei\b/gi, pl: 'jądra przedsionkowe', lt: 'nuclei vestibulares' },
  { re: /\bglobus\s+pallidus\b/gi, pl: 'gałka blada', lt: 'globus pallidus' },
  { re: /\bputamen\b/gi, pl: 'skorupa', lt: 'putamen' },
  { re: /\bfornix\b/gi, pl: 'sklepienie mózgu', lt: 'fornix' },
  { re: /\bhabenula\b/gi, pl: 'uzdeczka nadwzgórza', lt: 'habenula' },
  { re: /\bhypothalamus\b/gi, pl: 'podwzgórze', lt: 'hypothalamus' },
  { re: /\bmidbrain\b/gi, pl: 'śródmózgowie', lt: 'mesencephalon' },
  { re: /\bpons\b/gi, pl: 'most (tyłomózgowie)', lt: 'pons' },
  { re: /\bmedulla\s+oblongata\b/gi, pl: 'rdzeń przedłużony', lt: 'medulla oblongata' },
  { re: /\bolive\b/gi, pl: 'oliwka rdzenia przedłużonego', lt: 'oliva' },
  { re: /\bthird\s+ventricle\b/gi, pl: 'komora trzecia mózgu', lt: 'ventriculus tertius' },
  { re: /\bfourth\s+ventricle\b/gi, pl: 'komora czwarta mózgu', lt: 'ventriculus quartus' },
  { re: /\bcentral\s+canal'?\b/gi, pl: 'kanał środkowy rdzenia kręgowego', lt: 'canalis centralis' },
  { re: /\bstria\s+terminalis\b/gi, pl: 'prążek krańcowy', lt: 'stria terminalis' },
  { re: /\bstria\s+medullaris\s+thalami\b/gi, pl: 'prążek rdzenny wzgórza', lt: 'stria medullaris thalami' },
  { re: /\bseptum\s+pellucidum\b/gi, pl: 'przegroda przezroczysta', lt: 'septum pellucidum' },
  { re: /\bhippocampal\s+commissure\b/gi, pl: 'spoidło hipokampa (sklepienia)', lt: 'commissura fornicis' },
  { re: /\bprecuneus\b/gi, pl: 'przedklinek', lt: 'praecuneus' },
  { re: /\bcuneus\b/gi, pl: 'klinek płata potylicznego', lt: 'cuneus' },
  { re: /\bstraight\s+gyrus(?:\s*\(gyrus\s+rectus\))?/gi, pl: 'zakręt prosty', lt: 'gyrus rectus' },
  { re: /\blat[\s_]+fis-ant-vertical\b/gi, pl: 'bruzda boczna mózgu — gałąź wstępująca', lt: 'sulcus lateralis (ramus ascendens)' },
  { re: /\blat[\s_]+fis-ant-horizont\b/gi, pl: 'bruzda boczna mózgu — gałąź przednia', lt: 'sulcus lateralis (ramus anterior)' },
  { re: /\blat[\s_]+fis-post\b/gi, pl: 'bruzda boczna mózgu — gałąź tylna', lt: 'sulcus lateralis (ramus posterior)' },
  { re: /\bsulcus\s+interm[\s_]+prim-jensen\b/gi, pl: 'bruzda pośrednia pierwsza (Jensena)', lt: 'sulcus intermedius primus' },
  { re: /\bh-shaped\s+orbital\s+sulci\b/gi, pl: 'bruzdy oczodołowe w kształcie litery H', lt: 'sulci orbitales' },
  { re: /\bgracile\s+fasciculus\b/gi, pl: 'pęczek smukły (Golla)', lt: 'fasciculus gracilis' },
  { re: /\bcuneate\s+fasciculus\b/gi, pl: 'pęczek klinowaty (Burdacha)', lt: 'fasciculus cuneatus' },
  { re: /\bflocculus\b/gi, pl: 'kłaczek móżdżku', lt: 'flocculus' },
  { re: /\bdeclive\b/gi, pl: 'stok robaka móżdżku', lt: 'declive' },
  { re: /\bculmen\b/gi, pl: 'wierzchołek robaka móżdżku', lt: 'culmen' },
  { re: /\btentorium\s+cerebelli\b/gi, pl: 'namiot móżdżku', lt: 'tentorium cerebelli' },
  { re: /\bfalx\s+cerebri\b/gi, pl: 'sierp mózgu', lt: 'falx cerebri' },
  { re: /\bpubic\s+symphysis\b/gi, pl: 'spojenie łonowe', lt: 'symphysis pubica' },
  { re: /\binterpubic\s+disc\b/gi, pl: 'krążek międzyłonowy', lt: 'discus interpubicus' },
  { re: /\bsacrococcygeal\s+symphysis\b/gi, pl: 'spojenie krzyżowo-guziczne', lt: 'symphysis sacrococcygea' },
  { re: /\bfrenula\s+capsulae\b/gi, pl: 'wędzidełka torebki stawowej', lt: 'frenula capsulae' },
  { re: /\bpatellar\s+anastomosis\b/gi, pl: 'sieć tętnicza stawowa kolana', lt: 'rete articulare genus' },
  { re: /\baccessory\s+hemi-?azygos\s+vein\b/gi, pl: 'żyła nieparzysta krótka dodatkowa', lt: 'vena hemiazygos accessoria' },
  { re: /\bhemi-?azygos\s+vein\b/gi, pl: 'żyła nieparzysta krótka', lt: 'vena hemiazygos' },
  { re: /\bazygos\s+vein\b/gi, pl: 'żyła nieparzysta', lt: 'vena azygos' },
  { re: /\bgreat\s+cardiac\s+vein\b/gi, pl: 'żyła wielka serca', lt: 'vena cardiaca magna' },
  { re: /\blacrimal\s+canaliculus\b/gi, pl: 'kanalik łzowy', lt: 'canaliculus lacrimalis' },
  { re: /\blacrimal\s+sac\b/gi, pl: 'woreczek łzowy', lt: 'saccus lacrimalis' },
  { re: /\bauditory\s+tube\b/gi, pl: 'trąbka słuchowa (Eustachiusza)', lt: 'tuba auditiva' },
  { re: /\bvestibule\b/gi, pl: 'przedsionek błędnika', lt: 'vestibulum labyrinthi' },
  { re: /\bcochlea\b/gi, pl: 'ślimak ucha wewnętrznego', lt: 'cochlea' },
  { re: /\bzonular\s+fibres\b/gi, pl: 'włókna obwódkowe soczewki (Zinna)', lt: 'fibrae zonulares' },
  { re: /\bretina\b/gi, pl: 'siatkówka gałki ocznej', lt: 'retina' },
  { re: /\bsclera\b/gi, pl: 'twardówka gałki ocznej', lt: 'sclera' },
  { re: /\blens\b/gi, pl: 'soczewka oka', lt: 'lens' },
  { re: /\biris\b/gi, pl: 'tęczówka oka', lt: 'iris' },
  { re: /\bcornea\b/gi, pl: 'rogówka oka', lt: 'cornea' },
  { re: /\bleft\s+coronary\s+leaflet\b/gi, pl: 'płatek wieńcowy lewy zastawki aorty', lt: 'valvula semilunaris sinistra aortae' },
  { re: /\bright\s+coronary\s+leaflet\b/gi, pl: 'płatek wieńcowy prawy zastawki aorty', lt: 'valvula semilunaris dextra aortae' },
  { re: /\bnon-?coronary\s+leaflet\b/gi, pl: 'płatek niewieńcowy zastawki aorty', lt: 'valvula semilunaris posterior aortae' },
  { re: /\btongue\b/gi, pl: 'język', lt: 'lingua' },
  { re: /\bepiglottis\b/gi, pl: 'nagłośnia', lt: 'epiglottis' },
  { re: /\bsoft\s+palate\b/gi, pl: 'podniebienie miękkie', lt: 'palatum molle' },
  { re: /\bpalatine\s+tonsil\b/gi, pl: 'migdałek podniebienny', lt: 'tonsilla palatina' },
  { re: /\bnasopharynx\b/gi, pl: 'część nosowa gardła (nosogardło)', lt: 'pars nasalis pharyngis' },
  { re: /\boropharynx\b/gi, pl: 'część ustna gardła', lt: 'pars oralis pharyngis' },
  { re: /\blaryngopharynx\b/gi, pl: 'część krtaniowa gardła', lt: 'pars laryngea pharyngis' },
  { re: /\bpleura\b/gi, pl: 'opłucna', lt: 'pleura' },
  { re: /\bgreater\s+omentum\b/gi, pl: 'sieć większa', lt: 'omentum majus' },
  { re: /\blesser\s+omentum\b/gi, pl: 'sieć mniejsza', lt: 'omentum minus' },
  { re: /\bmesocolon\b/gi, pl: 'krezka okrężnicy', lt: 'mesocolon' },
  { re: /\badenohypophysis\b/gi, pl: 'przysadka mózgowa — płat przedni (gruczołowy)', lt: 'adenohypophysis' },
  { re: /\bneurohypophysis\b/gi, pl: 'przysadka mózgowa — płat tylny (nerwowy)', lt: 'neurohypophysis' },
  { re: /\bprostate\b/gi, pl: 'gruczoł krokowy (prostata)', lt: 'prostata' },
  { re: /\btestis\b/gi, pl: 'jądro (gruczoł płciowy)', lt: 'testis' },
  { re: /\bepididymis\b/gi, pl: 'najądrze', lt: 'epididymis' },
  { re: /\bductus\s+deferens\b/gi, pl: 'nasieniowód', lt: 'ductus deferens' },
  { re: /\bglans\s+penis\b/gi, pl: 'żołądź prącia', lt: 'glans penis' },
  { re: /\bcymba\s+conchae\b/gi, pl: 'czółenko muszli małżowiny usznej', lt: 'cymba conchae' },
  { re: /\bantihelix\b/gi, pl: 'grobelka małżowiny usznej', lt: 'antihelix' },
  { re: /\bantitragus\b/gi, pl: 'przeciwskrawek małżowiny usznej', lt: 'antitragus' },
  { re: /\bhelix\b/gi, pl: 'obrąbek małżowiny usznej', lt: 'helix' },
  { re: /\bscapha\b/gi, pl: 'czółenko małżowiny usznej', lt: 'scapha' },
  { re: /\btragus\b/gi, pl: 'skrawek małżowiny usznej', lt: 'tragus' },
  { re: /\beminentia\s+conchae\b/gi, pl: 'wyniosłość muszli małżowiny usznej', lt: 'eminentia conchae' },
  { re: /\beminentia\s+fossae\s+triangularis\b/gi, pl: 'wyniosłość dołu trójkątnego małżowiny', lt: 'eminentia fossae triangularis' },
  { re: /\beminentia\s+scaphae\b/gi, pl: 'wyniosłość czółenka małżowiny', lt: 'eminentia scaphae' },
  { re: /\bintertragic\s+incisure\b/gi, pl: 'wcięcie międzyskrawkowe', lt: 'incisura intertragica' },
  { re: /\blobule\s+of\s+auricle\b/gi, pl: 'płatek małżowiny usznej', lt: 'lobulus auriculae' },
  { re: /\blabial\s+commissure\b/gi, pl: 'spoidło warg', lt: 'commissura labiorum' },
  { re: /\bphiltrum\b/gi, pl: 'rynienka podnosowa', lt: 'philtrum' },
  { re: /\bumbilicus\b/gi, pl: 'pępek', lt: 'umbilicus' },
  { re: /\bradial\s+foveola\b/gi, pl: 'dołek promieniowy (tabakierka anatomiczna)', lt: 'foveola radialis' },
  { re: /\bfemoral\s+triangle\b/gi, pl: 'trójkąt udowy (Scarpy)', lt: 'trigonum femorale' },
  { re: /\bdeltopectoral\s+triangle\b/gi, pl: 'trójkąt naramienno-piersiowy', lt: 'trigonum clavipectorale' },
  { re: /\bsubmandibular\s+triangle\b/gi, pl: 'trójkąt podżuchwowy', lt: 'trigonum submandibulare' },
  { re: /\bsubmental\s+triangle\b/gi, pl: 'trójkąt podbródkowy', lt: 'trigonum submentale' },
  { re: /\bcarotid\s+triangle\b/gi, pl: 'trójkąt tętnicy szyjnej', lt: 'trigonum caroticum' },
  { re: /\bmuscular\s+triangle\b/gi, pl: 'trójkąt mięśniowy (tarczowy) szyi', lt: 'trigonum musculare' },
  { re: /\bhallucial\s+eminence\b/gi, pl: 'kłąb palucha', lt: 'eminentia plantaris medialis' },
  { re: /\bpalm\b/gi, pl: 'dłoń', lt: 'palma manus' },
  { re: /\bsole\b/gi, pl: 'podeszwa stopy', lt: 'planta pedis' },
  { re: /\bpubic\s+hairs\b/gi, pl: 'owłosienie łonowe', lt: 'pubes' },
  { re: /\beyelashes\b/gi, pl: 'rzęsy', lt: 'cilia' },
  { re: /\bperionyx\s*\(?foot\)?/gi, pl: 'obrąbek naskórkowy paznokcia stopy', lt: 'perionyx pedis' },
  { re: /\bperionyx\b/gi, pl: 'obrąbek naskórkowy paznokcia', lt: 'perionyx' },
  { re: /\bexternal\s+intercostal\s+membrane\b/gi, pl: 'błona międzyżebrowa zewnętrzna', lt: 'membrana intercostalis externa' },
  { re: /\binternal\s+intercostal\s+membrane\b/gi, pl: 'błona międzyżebrowa wewnętrzna', lt: 'membrana intercostalis interna' },
  { re: /\bligament\s+of\s+head\s+of\s+femur\b/gi, pl: 'więzadło głowy kości udowej', lt: 'ligamentum capitis femoris' },
  { re: /\banterior\s+ligament\s+of\s+fibular\s+head\b/gi, pl: 'więzadło przednie głowy strzałki', lt: 'ligamentum capitis fibulae anterius' },
  { re: /\bposterior\s+ligament\s+of\s+fibular\s+head\b/gi, pl: 'więzadło tylne głowy strzałki', lt: 'ligamentum capitis fibulae posterius' },
  { re: /\blacrimal\s+gland\b/gi, pl: 'gruczoł łzowy', lt: 'glandula lacrimalis' },
  { re: /\bnasolacrimal\s+duct\b/gi, pl: 'przewód nosowo-łzowy', lt: 'ductus nasolacrimalis' },
  { re: /\btympanic\s+membrane\b/gi, pl: 'błona bębenkowa', lt: 'membrana tympanica' },
  { re: /\bvitreous\s+body\b/gi, pl: 'ciało szkliste', lt: 'corpus vitreum' },
  { re: /\bauricular\s+tubercle\b/gi, pl: 'guzek małżowiny usznej (Darwina)', lt: 'tuberculum auriculae' },
  { re: /\bposterior\s+auricular\s+groove\b/gi, pl: 'bruzda uszna tylna', lt: 'sulcus auricularis posterior' },
  { re: /\blateral\s+bicipital\s+groove\b/gi, pl: 'bruzda dwugłowa boczna', lt: 'sulcus bicipitalis lateralis' },
  { re: /\bmedial\s+bicipital\s+groove\b/gi, pl: 'bruzda dwugłowa przyśrodkowa', lt: 'sulcus bicipitalis medialis' },
];

const WORD_TOKEN_LEXICON: Array<{ en: RegExp; pl: string; lt: string }> = [
  // Nouns / structural heads
  { en: /\barteries\b/gi, pl: 'tętnice', lt: 'arteriae' },
  { en: /\bartery\b/gi, pl: 'tętnica', lt: 'arteria' },
  { en: /\barterial\b/gi, pl: 'tętnicza', lt: 'arteriosus' },
  { en: /\bveins\b/gi, pl: 'żyły', lt: 'venae' },
  { en: /\bvein\b/gi, pl: 'żyła', lt: 'vena' },
  { en: /\bvenous\b/gi, pl: 'żylny', lt: 'venosus' },
  { en: /\bnerves\b/gi, pl: 'nerwy', lt: 'nervi' },
  { en: /\bnerve\b/gi, pl: 'nerw', lt: 'nervus' },
  { en: /\bligaments\b/gi, pl: 'więzadła', lt: 'ligamenta' },
  { en: /\bligament\b/gi, pl: 'więzadło', lt: 'ligamentum' },
  { en: /\bbranches\b/gi, pl: 'gałęzie', lt: 'rami' },
  { en: /\bbranch\b/gi, pl: 'gałąź', lt: 'ramus' },
  { en: /\bdivisions\b/gi, pl: 'gałęzie dzielące', lt: 'divisiones' },
  { en: /\bdivision\b/gi, pl: 'gałąź dzieląca', lt: 'divisio' },
  { en: /\btrunks\b/gi, pl: 'pnie', lt: 'trunci' },
  { en: /\btrunk\b/gi, pl: 'pień', lt: 'truncus' },
  { en: /\btracts\b/gi, pl: 'drogi', lt: 'tractus' },
  { en: /\btract\b/gi, pl: 'droga', lt: 'tractus' },
  { en: /\bfasciculus\s+proprius\b/gi, pl: 'pęczek własny rdzenia', lt: 'fasciculus proprius' },
  { en: /\bnucleus\b/gi, pl: 'jądro', lt: 'nucleus' },
  { en: /\bgyri\b/gi, pl: 'zakręty', lt: 'gyri' },
  { en: /\bgyrus\b/gi, pl: 'zakręt', lt: 'gyrus' },
  { en: /\bsulci\b/gi, pl: 'bruzdy', lt: 'sulci' },
  { en: /\bsulcus\b/gi, pl: 'bruzda', lt: 'sulcus' },
  { en: /\blobules\b/gi, pl: 'płaciki', lt: 'lobuli' },
  { en: /\blobule\b/gi, pl: 'płacik', lt: 'lobulus' },
  { en: /\broots\b/gi, pl: 'korzenie', lt: 'radices' },
  { en: /\broot\b/gi, pl: 'korzeń', lt: 'radix' },
  { en: /\bsegments?\b/gi, pl: 'odcinek', lt: 'segmentum' },
  { en: /\bparts\b/gi, pl: 'części', lt: 'partes' },
  { en: /\bpart\b/gi, pl: 'część', lt: 'pars' },

  // Genitive phrases ("of right lung", "of hand", "of foot", etc.)
  { en: /\bof\s+right\s+lung\b/gi, pl: 'płuca prawego', lt: 'pulmonis dextri' },
  { en: /\bof\s+left\s+lung\b/gi, pl: 'płuca lewego', lt: 'pulmonis sinistri' },
  { en: /\bof\s+lung\b/gi, pl: 'płuca', lt: 'pulmonis' },
  { en: /\bof\s+right\s+kidney\b/gi, pl: 'nerki prawej', lt: 'renis dextri' },
  { en: /\bof\s+left\s+kidney\b/gi, pl: 'nerki lewej', lt: 'renis sinistri' },
  { en: /\bof\s+kidney\b/gi, pl: 'nerki', lt: 'renis' },
  { en: /\bof\s+hand\b/gi, pl: 'ręki', lt: 'manus' },
  { en: /\bof\s+foot\b/gi, pl: 'stopy', lt: 'pedis' },
  { en: /\bof\s+great\s+toe\b/gi, pl: 'palucha', lt: 'hallucis' },
  { en: /\bof\s+heart\b/gi, pl: 'serca', lt: 'cordis' },
  { en: /\bof\s+oculomotor\b/gi, pl: 'nerwu okoruchowego (III)', lt: 'nervi oculomotorii' },
  { en: /\bof\s+trochlear\b/gi, pl: 'nerwu bloczkowego (IV)', lt: 'nervi trochlearis' },
  { en: /\bof\s+abducens\b/gi, pl: 'nerwu odwodzącego (VI)', lt: 'nervi abducentis' },
  { en: /\bof\s+hypoglossal\b/gi, pl: 'nerwu podjęzykowego (XII)', lt: 'nervi hypoglossi' },
  { en: /\bto\s+angular\b/gi, pl: 'do zakrętu kątowego', lt: 'gyri angularis' },
  { en: /\bof\b/gi, pl: '', lt: '' },
  { en: /\band\b/gi, pl: 'i', lt: 'et' },

  // Compound anatomical adjectives (longest / hyphenated first!)
  { en: /\bsupra-?orbital\b/gi, pl: 'nadoczodołowa', lt: 'supraorbitalis' },
  { en: /\binfra-?orbital\b/gi, pl: 'podoczodołowa', lt: 'infraorbitalis' },
  { en: /\bparieto-?occipital\b/gi, pl: 'ciemieniowo-potyliczna', lt: 'parietooccipitalis' },
  { en: /\bsacro-?iliac\b/gi, pl: 'krzyżowo-biodrowe', lt: 'sacroiliacum' },
  { en: /\bgastro-?omental\b/gi, pl: 'żołądkowo-sieciowa', lt: 'gastroomentalis' },
  { en: /\bilio-?inguinal\b/gi, pl: 'biodrowo-pachwinowy', lt: 'ilioinguinalis' },
  { en: /\bpancreaticoduodenal\b/gi, pl: 'trzustkowo-dwunastnicza', lt: 'pancreaticoduodenalis' },
  { en: /\bsphenopalatine\b/gi, pl: 'klinowo-podniebienna', lt: 'sphenopalatina' },
  { en: /\bcallosomarginal\b/gi, pl: 'spoidłowo-brzeżna', lt: 'callosomarginalis' },
  { en: /\borbitofrontal\b/gi, pl: 'oczodołowo-czołowe', lt: 'orbitofrontales' },
  { en: /\bfrontobasal\b/gi, pl: 'czołowo-podstawna', lt: 'frontobasalis' },
  { en: /\bfrontomarginal\b/gi, pl: 'czołowo-brzeżny', lt: 'frontomarginalis' },
  { en: /\bfrontopolar\b/gi, pl: 'biegunowo-czołowy', lt: 'frontopolaris' },
  { en: /\btemporo-?occipital\b/gi, pl: 'skroniowo-potyliczna', lt: 'temporooccipitalis' },
  { en: /\boccipitotemporal\b/gi, pl: 'potyliczno-skroniowy', lt: 'occipitotemporalis' },
  { en: /\bparahippocampal\b/gi, pl: 'przyhipokampowy', lt: 'parahippocampalis' },
  { en: /\bthoraco-?acromial\b/gi, pl: 'piersiowo-barkowa', lt: 'thoracoacromialis' },
  { en: /\bretromandibular\b/gi, pl: 'zażuchwowa', lt: 'retromandibularis' },
  { en: /\bgenitofemoral\b/gi, pl: 'płciowo-udowy', lt: 'genitofemoralis' },
  { en: /\biliolumbar\b/gi, pl: 'biodrowo-lędźwiowa', lt: 'iliolumbalis' },
  { en: /\bileocolic\b/gi, pl: 'krętniczo-okrężnicza', lt: 'ileocolica' },
  { en: /\banorectal\b/gi, pl: 'odbytnicza górna', lt: 'rectalis' },
  { en: /\binferolateral\b/gi, pl: 'dolno-boczna', lt: 'inferolateralis' },
  { en: /\bapicoposterior\b/gi, pl: 'szczytowo-tylna', lt: 'apicoposterior' },
  { en: /\bintercapitular\b/gi, pl: 'międzygłowowe', lt: 'intercapitulares' },

  // Joint / ligament specific compounds
  { en: /\bscaphotrapeziotrapezoidal\b/gi, pl: 'łódeczkowo-czworoboczne', lt: 'scaphotrapeziotrapezoideum' },
  { en: /\btrapeziotrapezoidal\b/gi, pl: 'czworoboczno-czworoboczne', lt: 'trapeziotrapezoideum' },
  { en: /\btrapezoideocapitate\b/gi, pl: 'czworoboczno-główkowate', lt: 'trapezoideocapitatum' },
  { en: /\bradioscaphocapitate\b/gi, pl: 'promieniowo-łódeczkowo-główkowate', lt: 'radioscaphocapitatum' },
  { en: /\bscaphotriquetral\b/gi, pl: 'łódeczkowo-trójgraniaste', lt: 'scaphotriquetrum' },
  { en: /\bscaphocapitate\b/gi, pl: 'łódeczkowo-główkowate', lt: 'scaphocapitatum' },
  { en: /\bscapholunate\b/gi, pl: 'łódeczkowo-księżycowate', lt: 'scapholunatum' },
  { en: /\btriquetrocapitate\b/gi, pl: 'trójgraniasto-główkowate', lt: 'triquetrocapitatum' },
  { en: /\btriquetrohamate\b/gi, pl: 'trójgraniasto-haczykowate', lt: 'triquetrohamatum' },
  { en: /\bpisotriquetral\b/gi, pl: 'grochowato-trójgraniaste', lt: 'pisotriquetrum' },
  { en: /\bcapitohamate\b/gi, pl: 'główkowato-haczykowate', lt: 'capitohamatum' },
  { en: /\blunotriquetral\b/gi, pl: 'księżycowato-trójgraniaste', lt: 'lunotriquetrum' },
  { en: /\bpisohamate\b/gi, pl: 'grochowato-haczykowate', lt: 'pisohamatum' },
  { en: /\bpisometacarpal\b/gi, pl: 'grochowato-śródręczne', lt: 'pisometacarpale' },
  { en: /\bcarpometacarpal\b/gi, pl: 'nadgarstkowo-śródręczne', lt: 'carpometacarpalia' },
  { en: /\bmetacarpophalangeal\b/gi, pl: 'śródręczno-paliczkowe', lt: 'metacarpophalangea' },
  { en: /\bmetatarsophalangeal\b/gi, pl: 'śródstopno-paliczkowe', lt: 'metatarsophalangea' },
  { en: /\binterphalangeal\b/gi, pl: 'międzypaliczkowe', lt: 'interphalangea' },
  { en: /\bradio-?ulnar\b/gi, pl: 'promieniowo-łokciowe', lt: 'radioulnare' },
  { en: /\bradiocarpal\b/gi, pl: 'promieniowo-nadgarstkowe', lt: 'radiocarpale' },
  { en: /\bradiocapitate\b/gi, pl: 'promieniowo-główkowate', lt: 'radiocapitatum' },
  { en: /\bulnocarpal\b/gi, pl: 'łokciowo-nadgarstkowe', lt: 'ulnocarpale' },
  { en: /\bulnocapitate\b/gi, pl: 'łokciowo-główkowate', lt: 'ulnocapitatum' },
  { en: /\bulnopisiform\b/gi, pl: 'łokciowo-grochowate', lt: 'ulnopisiforme' },
  { en: /\bulnotriquetral\b/gi, pl: 'łokciowo-trójgraniaste', lt: 'ulnotriquetrum' },
  { en: /\bulnolunate\b/gi, pl: 'łokciowo-księżycowate', lt: 'ulnolunatum' },
  { en: /\bintercarpal\b/gi, pl: 'międzynadgarstkowe', lt: 'intercarpalia' },
  { en: /\bstylomandibular\b/gi, pl: 'rylcowo-żuchwowe', lt: 'stylomandibulare' },
  { en: /\bstylohyoid\b/gi, pl: 'rylcowo-gnykowe', lt: 'stylohyoideum' },
  { en: /\bpterygospinous\b/gi, pl: 'skrzydłowo-kolcowe', lt: 'pterygospinale' },
  { en: /\bsphenomandibular\b/gi, pl: 'klinowo-żuchwowe', lt: 'sphenomandibulare' },
  { en: /\btemporomandibular\b/gi, pl: 'skroniowo-żuchwowe', lt: 'temporomandibulare' },
  { en: /\bthyrohyoid\b/gi, pl: 'tarczowo-gnykowe', lt: 'thyrohyoideum' },
  { en: /\bcricothyroid\b/gi, pl: 'pierścienno-tarczowe', lt: 'cricothyroideum' },
  { en: /\bcricopharyngeal\b/gi, pl: 'pierścienno-gardłowe', lt: 'cricopharyngeum' },
  { en: /\bintercornual\b/gi, pl: 'międzyrożkowe krzyżowo-guziczne', lt: 'intercornuale' },
  { en: /\bcostotransverse\b/gi, pl: 'żebrowo-poprzeczne', lt: 'costotransversarium' },
  { en: /\bsternoclavicular\b/gi, pl: 'mostkowo-obojczykowe', lt: 'sternoclaviculare' },
  { en: /\btibiofibular\b/gi, pl: 'piszczelowo-strzałkowe', lt: 'tibiofibulare' },
  { en: /\btalocalcaneal\b/gi, pl: 'skokowo-piętowe', lt: 'talocalcaneum' },
  { en: /\bcalcaneonavicular\b/gi, pl: 'piętowo-łódkowe', lt: 'calcaneonaviculare' },
  { en: /\bcalcaneocuboid\b/gi, pl: 'piętowo-sześcienne', lt: 'calcaneocuboideum' },
  { en: /\btalonavicular\b/gi, pl: 'skokowo-łódkowe', lt: 'talonaviculare' },
  { en: /\bcuneonavicular\b/gi, pl: 'klinowo-łódkowe', lt: 'cuneonavicularia' },
  { en: /\bcuneocuboid\b/gi, pl: 'klinowo-sześcienne', lt: 'cuneocuboideum' },
  { en: /\bcuboideonavicular\b/gi, pl: 'sześcienno-łódkowe', lt: 'cuboideonaviculare' },
  { en: /\bintercuneiform\b/gi, pl: 'międzyklinowe', lt: 'intercuneiformia' },
  { en: /\btarsometatarsal\b/gi, pl: 'stępowo-śródstopne', lt: 'tarsometatarsalia' },
  { en: /\bcuneometatarsal\b/gi, pl: 'klinowo-śródstopne', lt: 'cuneometatarsalia' },
  { en: /\bintersesamoid\b/gi, pl: 'międzytrzeszczkowe', lt: 'intersesamoideum' },

  // CNS spinal tracts & nuclei
  { en: /\bcorticospinal\b/gi, pl: 'korowo-rdzeniowa', lt: 'corticospinalis' },
  { en: /\breticulospinal\b/gi, pl: 'siatkowato-rdzeniowa', lt: 'reticulospinalis' },
  { en: /\bvestibulospinal\b/gi, pl: 'przedsionkowo-rdzeniowa', lt: 'vestibulospinalis' },
  { en: /\bspinothalamic\b/gi, pl: 'rdzeniowo-wzgórzowa', lt: 'spinothalamicus' },
  { en: /\bspinocerebellar\b/gi, pl: 'rdzeniowo-móżdżkowa', lt: 'spinocerebellaris' },
  { en: /\bsalivatory\b/gi, pl: 'ślinowe', lt: 'salivatorius' },
  { en: /\bcochlear\b/gi, pl: 'ślimakowe', lt: 'cochlearis' },
  { en: /\bsemilunar\b/gi, pl: 'półksiężycowaty', lt: 'semilunaris' },
  { en: /\bquadrangular\b/gi, pl: 'czworokątny', lt: 'quadrangularis' },
  { en: /\bparacentral\b/gi, pl: 'przyśrodkowy okołośrodkowy', lt: 'paracentralis' },
  { en: /\bprecentral\b/gi, pl: 'przedśrodkowa', lt: 'praecentralis' },
  { en: /\bpostcentral\b/gi, pl: 'zaśrodkowa', lt: 'postcentralis' },
  { en: /\bcingulate\b/gi, pl: 'obręczy', lt: 'cinguli' },
  { en: /\binsular\b/gi, pl: 'wyspowe', lt: 'insulares' },
  { en: /\bstriate\b/gi, pl: 'prążkowiowe', lt: 'striati' },

  // Standard anatomical directional & regional adjectives
  { en: /\banterior\b/gi, pl: 'przednia', lt: 'anterior' },
  { en: /\bposterior\b/gi, pl: 'tylna', lt: 'posterior' },
  { en: /\bsuperior\b/gi, pl: 'górna', lt: 'superior' },
  { en: /\binferior\b/gi, pl: 'dolna', lt: 'inferior' },
  { en: /\bmiddle\b/gi, pl: 'środkowa', lt: 'media' },
  { en: /\bmedian\b/gi, pl: 'pośrodkowa', lt: 'mediana' },
  { en: /\bmedial\b/gi, pl: 'przyśrodkowa', lt: 'medialis' },
  { en: /\blateral\b/gi, pl: 'boczna', lt: 'lateralis' },
  { en: /\bintermediate\b/gi, pl: 'pośrednia', lt: 'intermedius' },
  { en: /\bsuperficial\b/gi, pl: 'powierzchowna', lt: 'superficialis' },
  { en: /\bdeep\b/gi, pl: 'głęboka', lt: 'profunda' },
  { en: /\binternal\b/gi, pl: 'wewnętrzna', lt: 'interna' },
  { en: /\bexternal\b/gi, pl: 'zewnętrzna', lt: 'externa' },
  { en: /\bcommon\b/gi, pl: 'wspólna', lt: 'communis' },
  { en: /\bproper\b/gi, pl: 'właściwa', lt: 'propria' },
  { en: /\baccessory\b/gi, pl: 'dodatkowa', lt: 'accessoria' },
  { en: /\bascending\b/gi, pl: 'wstępująca', lt: 'ascendens' },
  { en: /\bdescending\b/gi, pl: 'zstępująca', lt: 'descendens' },
  { en: /\btransverse\b/gi, pl: 'poprzeczna', lt: 'transversa' },
  { en: /\bcircumflex\b/gi, pl: 'okalająca', lt: 'circumflexa' },
  { en: /\brecurrent\b/gi, pl: 'wsteczna', lt: 'recurrens' },
  { en: /\bperforating\b/gi, pl: 'przeszywające', lt: 'perforantes' },
  { en: /\bcommunicating\b/gi, pl: 'łącząca', lt: 'communicans' },
  { en: /\bcollateral\b/gi, pl: 'poboczna', lt: 'collateralis' },
  { en: /\binterosseous\b/gi, pl: 'międzykostna', lt: 'interossea' },
  { en: /\bcutaneous\b/gi, pl: 'skórny', lt: 'cutaneus' },
  { en: /\bdorsal\b/gi, pl: 'grzbietowa', lt: 'dorsalis' },
  { en: /\bpalmar\b/gi, pl: 'dłoniowa', lt: 'palmaris' },
  { en: /\bplantar\b/gi, pl: 'podeszwowa', lt: 'plantaris' },
  { en: /\bproximal\b/gi, pl: 'bliższa', lt: 'proximalis' },
  { en: /\bdistal\b/gi, pl: 'dalsza', lt: 'distalis' },
  { en: /\bapical\b/gi, pl: 'szczytowa', lt: 'apicalis' },
  { en: /\bbasal\b/gi, pl: 'podstawna', lt: 'basalis' },
  { en: /\blobar\b/gi, pl: 'płatowa', lt: 'lobaris' },
  { en: /\bsegmental\b/gi, pl: 'segmentowa', lt: 'segmentalis' },
  { en: /\blingular\b/gi, pl: 'języczkowa', lt: 'lingularis' },
  { en: /\bseptal\b/gi, pl: 'przegrodowe', lt: 'septales' },
  { en: /\bshort\b/gi, pl: 'krótkie', lt: 'breves' },
  { en: /\blong\b/gi, pl: 'długie', lt: 'longa' },
  { en: /\bfirst\b/gi, pl: 'pierwsza', lt: 'prima' },
  { en: /\bsecond\b/gi, pl: 'druga', lt: 'secunda' },
  { en: /\bright\b/gi, pl: 'prawa', lt: 'dextra' },
  { en: /\bleft\b/gi, pl: 'lewa', lt: 'sinistra' },

  // Organ / regional adjectives
  { en: /\bpulmonary\b/gi, pl: 'płucna', lt: 'pulmonalis' },
  { en: /\bcoronary\b/gi, pl: 'wieńcowa', lt: 'coronaria' },
  { en: /\bcardiac\b/gi, pl: 'serca', lt: 'cordis' },
  { en: /\binterventricular\b/gi, pl: 'międzykomorowa', lt: 'interventricularis' },
  { en: /\bintercostal\b/gi, pl: 'międzyżebrowa', lt: 'intercostalis' },
  { en: /\bphrenic\b/gi, pl: 'przeponowa', lt: 'phrenica' },
  { en: /\bsuprarenal\b/gi, pl: 'nadnerczowa', lt: 'suprarenalis' },
  { en: /\bintrarenal\b/gi, pl: 'wewnątrznerkowe', lt: 'intrarenales' },
  { en: /\blumbar\b/gi, pl: 'lędźwiowa', lt: 'lumbalis' },
  { en: /\bmesenteric\b/gi, pl: 'krezkowa', lt: 'mesenterica' },
  { en: /\bhepatic\b/gi, pl: 'wątrobowa', lt: 'hepatica' },
  { en: /\bcolic\b/gi, pl: 'okrężnicza', lt: 'colica' },
  { en: /\bileal\b/gi, pl: 'krętnicza', lt: 'ilealis' },
  { en: /\bsacral\b/gi, pl: 'krzyżowa', lt: 'sacralis' },
  { en: /\biliacus\b/gi, pl: 'biodrowa', lt: 'iliaca' },
  { en: /\biliac\b/gi, pl: 'biodrowa', lt: 'iliaca' },
  { en: /\bgluteal\b/gi, pl: 'pośladkowa', lt: 'glutea' },
  { en: /\bepigastric\b/gi, pl: 'nabrzuszna', lt: 'epigastrica' },
  { en: /\bpudendal\b/gi, pl: 'sromowa', lt: 'pudenda' },
  { en: /\blabial\b/gi, pl: 'wargowa', lt: 'labialis' },
  { en: /\btemporal\b/gi, pl: 'skroniowa', lt: 'temporalis' },
  { en: /\bfacial\b/gi, pl: 'twarzowa', lt: 'facialis' },
  { en: /\bmental\b/gi, pl: 'bródkowa', lt: 'mentalis' },
  { en: /\balveolar\b/gi, pl: 'zębodołowa', lt: 'alveolaris' },
  { en: /\bmylohyoid\b/gi, pl: 'żuchwowo-gnykowa', lt: 'mylohyoidea' },
  { en: /\bmeningeal\b/gi, pl: 'oponowa', lt: 'meningea' },
  { en: /\bciliary\b/gi, pl: 'rzęskowe', lt: 'ciliares' },
  { en: /\bethmoidal\b/gi, pl: 'sitowa', lt: 'ethmoidalis' },
  { en: /\bnasal\b/gi, pl: 'nosowe', lt: 'nasales' },
  { en: /\bophthalmic\b/gi, pl: 'oczna', lt: 'ophthalmica' },
  { en: /\bauricular\b/gi, pl: 'uszna', lt: 'auricularis' },
  { en: /\bcerebral\b/gi, pl: 'mózgu', lt: 'cerebri' },
  { en: /\bcerebellar\b/gi, pl: 'móżdżku', lt: 'cerebelli' },
  { en: /\boccipital\b/gi, pl: 'potyliczna', lt: 'occipitalis' },
  { en: /\bparietal\b/gi, pl: 'ciemieniowa', lt: 'parietalis' },
  { en: /\bfrontal\b/gi, pl: 'czołowa', lt: 'frontalis' },
  { en: /\borbital\b/gi, pl: 'oczodołowe', lt: 'orbitales' },
  { en: /\bspinal\b/gi, pl: 'rdzeniowa', lt: 'spinalis' },
  { en: /\bthoracic\b/gi, pl: 'piersiowa', lt: 'thoracica' },
  { en: /\bthyroid\b/gi, pl: 'tarczowa', lt: 'thyroidea' },
  { en: /\bcervical\b/gi, pl: 'szyjna', lt: 'cervicalis' },
  { en: /\bpectoral\b/gi, pl: 'piersiowe', lt: 'pectorales' },
  { en: /\bmetacarpal\b/gi, pl: 'śródręczne', lt: 'metacarpales' },
  { en: /\bmetatarsal\b/gi, pl: 'śródstopne', lt: 'metatarsales' },
  { en: /\bdigital\b/gi, pl: 'palcowe', lt: 'digitales' },
  { en: /\bulnar\b/gi, pl: 'łokciowa', lt: 'ulnaris' },
  { en: /\bradial\b/gi, pl: 'promieniowa', lt: 'radialis' },
  { en: /\bhumeral\b/gi, pl: 'ramienna', lt: 'humeri' },
  { en: /\bbrachial\b/gi, pl: 'ramienia', lt: 'brachii' },
  { en: /\bantebrachial\b/gi, pl: 'przedramienia', lt: 'antebrachii' },
  { en: /\bfemoral\b/gi, pl: 'udowa', lt: 'femoralis' },
  { en: /\bgenicular\b/gi, pl: 'kolana', lt: 'genus' },
  { en: /\btibial\b/gi, pl: 'piszczelowa', lt: 'tibialis' },
  { en: /\bfibular\b/gi, pl: 'strzałkowa', lt: 'fibularis' },
  { en: /\bsural\b/gi, pl: 'łydkowy', lt: 'suralis' },
  { en: /\btarsal\b/gi, pl: 'stępowa', lt: 'tarsea' },
  { en: /\bcalcaneal\b/gi, pl: 'piętowe', lt: 'calcanei' },
  { en: /\bregions\b/gi, pl: 'okolice', lt: 'regiones' },
  { en: /\bregion\b/gi, pl: 'okolica', lt: 'regio' },
  { en: /\btriangle\b/gi, pl: 'trójkąt', lt: 'trigonum' },
  { en: /\bgastroduodenal\b/gi, pl: 'żołądkowo-dwunastnicza', lt: 'gastroduodenalis' },
  { en: /\bgastro-?omental\b/gi, pl: 'żołądkowo-sieciowa', lt: 'gastroomentalis' },
  { en: /\bmusculophrenic\b/gi, pl: 'mięśniowo-przeponowa', lt: 'musculophrenica' },
  { en: /\bbrachiocephalic\b/gi, pl: 'ramienno-głowowa', lt: 'brachiocephalica' },
  { en: /\bparieto-?occipital\b/gi, pl: 'ciemieniowo-potyliczna', lt: 'parietooccipitalis' },
  { en: /\bsacro-?iliac\b/gi, pl: 'krzyżowo-biodrowe', lt: 'sacroiliacum' },
  { en: /\bilio-?inguinal\b/gi, pl: 'biodrowo-pachwinowy', lt: 'ilioinguinalis' },
  { en: /\biliohypogastric\b/gi, pl: 'biodrowo-podbrzuszny', lt: 'iliohypogastricus' },
  { en: /\bsupra-?orbital\b/gi, pl: 'nadoczodołowa', lt: 'supraorbitalis' },
  { en: /\binfra-?orbital\b/gi, pl: 'podoczodołowa', lt: 'infraorbitalis' },
  { en: /\bsupratrochlear\b/gi, pl: 'nadbloczkowa', lt: 'supratrochlearis' },
  { en: /\bsuprascapular\b/gi, pl: 'nadłopatkowa', lt: 'suprascapularis' },
  { en: /\bsubscapular\b/gi, pl: 'podłopatkowa', lt: 'subscapularis' },
  { en: /\bthoracodorsal\b/gi, pl: 'piersiowo-grzbietowa', lt: 'thoracodorsalis' },
  { en: /\bpericallosal\b/gi, pl: 'okołospoidłowa', lt: 'pericallosa' },
  { en: /\bsupramarginal\b/gi, pl: 'nadbrzeżny', lt: 'supramarginalis' },
  { en: /\bintraparietal\b/gi, pl: 'śródciemieniowa', lt: 'intraparietalis' },
  { en: /\bsubparietal\b/gi, pl: 'podciemieniowa', lt: 'subparietalis' },
  { en: /\bposteroventral\b/gi, pl: 'tylno-brzuszna', lt: 'posteroventralis' },
  { en: /\bposterolateral\b/gi, pl: 'tylno-boczna', lt: 'posterolateralis' },
  { en: /\bintermediolateral\b/gi, pl: 'pośrednio-boczne', lt: 'intermediolateralis' },
  { en: /\bintermediomedial\b/gi, pl: 'pośrednio-przyśrodkowe', lt: 'intermediomedialis' },
  { en: /\brubrospinal\b/gi, pl: 'czerwienno-rdzeniowa', lt: 'rubrospinalis' },
  { en: /\btectospinal\b/gi, pl: 'pokrywowo-rdzeniowa', lt: 'tectospinalis' },
  { en: /\bspinotectal\b/gi, pl: 'rdzeniowo-pokrywowa', lt: 'spinotectalis' },
  { en: /\bmentolabial\b/gi, pl: 'bródkowo-wargowa', lt: 'mentolabialis' },
  { en: /\bnasolabial\b/gi, pl: 'nosowo-wargowa', lt: 'nasolabialis' },
  { en: /\binframammary\b/gi, pl: 'podsutkowa', lt: 'inframammaria' },
  { en: /\bpresternal\b/gi, pl: 'przedmostkowa', lt: 'praesternalis' },
  { en: /\bhypogastric\b/gi, pl: 'podbrzuszna', lt: 'hypogastrica' },
  { en: /\burogenital\b/gi, pl: 'moczowo-płciowa', lt: 'urogenitalis' },
  { en: /\banal\b/gi, pl: 'odbytowa', lt: 'analis' },
  { en: /\bheel\b/gi, pl: 'piętowa', lt: 'calcanea' },
  { en: /\bprefrontal\b/gi, pl: 'przedczołowa', lt: 'praefrontalis' },
  { en: /\bsubcostal\b/gi, pl: 'podżebrowa', lt: 'subcostalis' },
  { en: /\bsplenic\b/gi, pl: 'śledzionowa', lt: 'splenica' },
  { en: /\bappendicular\b/gi, pl: 'wyrostka robaczkowego', lt: 'appendicularis' },
  { en: /\bmarginal\b/gi, pl: 'brzeżna', lt: 'marginalis' },
  { en: /\bgastric\b/gi, pl: 'żołądkowa', lt: 'gastrica' },
  { en: /\btesticular\b/gi, pl: 'jądrowa', lt: 'testicularis' },
  { en: /\bsigmoid\b/gi, pl: 'esowata', lt: 'sigmoidea' },
  { en: /\bpharyngeal\b/gi, pl: 'gardłowa', lt: 'pharyngea' },
  { en: /\bangular\b/gi, pl: 'kątowa', lt: 'angularis' },
  { en: /\bsubmental\b/gi, pl: 'podbródkowa', lt: 'submentalis' },
  { en: /\bmaxillary\b/gi, pl: 'szczękowa', lt: 'maxillaris' },
  { en: /\bretinal\b/gi, pl: 'siatkówki', lt: 'centralis retinae' },
  { en: /\blacrimal\b/gi, pl: 'łzowa', lt: 'lacrimalis' },
  { en: /\barcuate\b/gi, pl: 'łukowata', lt: 'arcuata' },
  { en: /\bsupreme\b/gi, pl: 'najwyższa', lt: 'suprema' },
  { en: /\bscapular\b/gi, pl: 'łopatkowa', lt: 'scapulae' },
  { en: /\bbuccal\b/gi, pl: 'policzkowa', lt: 'buccalis' },
  { en: /\bpalatine\b/gi, pl: 'podniebienna', lt: 'palatina' },
  { en: /\bgreater\b/gi, pl: 'większa', lt: 'major' },
  { en: /\blesser\b/gi, pl: 'mniejsza', lt: 'minor' },
  { en: /\bobturator\b/gi, pl: 'zasłonowa', lt: 'obturatoria' },
  { en: /\bpubic\b/gi, pl: 'łonowe', lt: 'pubicum' },
  { en: /\bcentral\b/gi, pl: 'środkowa', lt: 'centralis' },
  { en: /\bolfactory\b/gi, pl: 'węchowa', lt: 'olfactorius' },
  { en: /\blingual\b/gi, pl: 'językowa', lt: 'lingualis' },
  { en: /\bcalcarine\b/gi, pl: 'ostrogowa', lt: 'calcarinus' },
  { en: /\blunate\b/gi, pl: 'księżycowata', lt: 'lunatus' },
  { en: /\bvestibular\b/gi, pl: 'przedsionkowy', lt: 'vestibularis' },
  { en: /\bsubclavian\b/gi, pl: 'podobojczykowy', lt: 'subclavius' },
  { en: /\bgenital\b/gi, pl: 'płciowa', lt: 'genitalis' },
  { en: /\bsympathetic\b/gi, pl: 'współczulne', lt: 'sympathici' },
  { en: /\bgracile\b/gi, pl: 'smukły', lt: 'gracilis' },
  { en: /\bbiventral\b/gi, pl: 'dwubrzuścowy', lt: 'biventer' },
  { en: /\bvertebral\b/gi, pl: 'kręgowa', lt: 'vertebralis' },
  { en: /\baxillary\b/gi, pl: 'pachowa', lt: 'axillaris' },
  { en: /\brenal\b/gi, pl: 'nerkowa', lt: 'renalis' },
];

function translateCompositionalAnatomy(
  cleanEn: string,
  fallbackCat: StructureCategory,
): { namePl: string; nameLt: string; category: StructureCategory; isCartilage?: boolean } {
  let working = cleanEn
    .replace(/\(\/\/[^)]*\)/g, '')
    .replace(/\*/g, '')
    .replace(/\b(M[1-4])[- ]segment\b/gi, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  // Refine category from keywords if unhinted
  let category = fallbackCat;
  if (/\b(artery|arteries|arterial|aortic|palmar\s+arch|plantar\s+arch|trunk)\b/i.test(working) && !/\bsympathetic|pulmonary\s+vein\b/i.test(working)) {
    if (!/\bsympathetic\b/i.test(working)) category = 'artery';
  } else if (/\b(vein|veins|venous|sinus)\b/i.test(working)) {
    category = 'vein';
  } else if (/\b(nerve|nerves|gyrus|gyri|sulcus|sulci|lobule|nucleus|tract|commissure|colliculus|vermis|flocculus|geniculate|mamillary|amygdaloid|ventricle|peduncle|aqueduct|fasciculus|substance|sympathetic)\b/i.test(working)) {
    category = 'nerve';
  } else if (/\b(ligament|ligaments|capsule|capsules|membrane|cord)\b/i.test(working)) {
    category = 'ligament';
  }

  for (const phrase of COMPOUND_PHRASE_LEXICON) {
    if (phrase.re.test(working)) {
      phrase.re.lastIndex = 0;
      const pl = working.replace(phrase.re, phrase.pl).replace(/\s+/g, ' ').trim();
      phrase.re.lastIndex = 0;
      const lt = working.replace(phrase.re, phrase.lt).replace(/\s+/g, ' ').trim();
      // Continue token pass in case modifiers surround the phrase
      let plPass = pl;
      let ltPass = lt;
      for (const tok of WORD_TOKEN_LEXICON) {
        tok.en.lastIndex = 0;
        plPass = plPass.replace(tok.en, tok.pl);
        tok.en.lastIndex = 0;
        ltPass = ltPass.replace(tok.en, tok.lt);
      }
      plPass = plPass.replace(/\s+/g, ' ').trim();
      ltPass = ltPass.replace(/\s+/g, ' ').trim();
      return {
        namePl: plPass.charAt(0).toUpperCase() + plPass.slice(1),
        nameLt: ltPass.charAt(0).toUpperCase() + ltPass.slice(1),
        category,
      };
    }
  }

  // Reorder English head noun to Polish/Latin head-first word order!
  // e.g. "Superior lobar artery of right lung" -> head="Artery", rest="Superior lobar of right lung"
  const headPatterns: Array<{ re: RegExp; plSing: string; ltSing: string }> = [
    { re: /^(.*?)\s+\b(arteries)\b(.*)$/i, plSing: 'Tętnice', ltSing: 'Arteriae' },
    { re: /^(.*?)\s+\b(artery)\b(.*)$/i, plSing: 'Tętnica', ltSing: 'Arteria' },
    { re: /^(.*?)\s+\b(veins)\b(.*)$/i, plSing: 'Żyły', ltSing: 'Venae' },
    { re: /^(.*?)\s+\b(vein)\b(.*)$/i, plSing: 'Żyła', ltSing: 'Vena' },
    { re: /^(.*?)\s+\b(nerves)\b(.*)$/i, plSing: 'Nerwy', ltSing: 'Nervi' },
    { re: /^(.*?)\s+\b(nerve)\b(.*)$/i, plSing: 'Nerw', ltSing: 'Nervus' },
    { re: /^(.*?)\s+\b(ligaments)\b(.*)$/i, plSing: 'Więzadła', ltSing: 'Ligamenta' },
    { re: /^(.*?)\s+\b(ligament)\b(.*)$/i, plSing: 'Więzadło', ltSing: 'Ligamentum' },
    { re: /^(.*?)\s+\b(branches)\b(.*)$/i, plSing: 'Gałęzie', ltSing: 'Rami' },
    { re: /^(.*?)\s+\b(branch)\b(.*)$/i, plSing: 'Gałąź', ltSing: 'Ramus' },
    { re: /^(.*?)\s+\b(division)\b(.*)$/i, plSing: 'Gałąź dzieląca', ltSing: 'Divisio' },
    { re: /^(.*?)\s+\b(tract)\b(.*)$/i, plSing: 'Droga', ltSing: 'Tractus' },
    { re: /^(.*?)\s+\b(fasciculus\s+proprius)\b(.*)$/i, plSing: 'Pęczek własny rdzenia', ltSing: 'Fasciculus proprius' },
    { re: /^(.*?)\s+\b(nucleus)\b(.*)$/i, plSing: 'Jądro', ltSing: 'Nucleus' },
    { re: /^(.*?)\s+\b(gyrus\s+and\s+sulcus)\b(.*)$/i, plSing: 'Zakręt i bruzda', ltSing: 'Gyrus et sulcus' },
    { re: /^(.*?)\s+\b(gyri)\b(.*)$/i, plSing: 'Zakręty', ltSing: 'Gyri' },
    { re: /^(.*?)\s+\b(gyrus)\b(.*)$/i, plSing: 'Zakręt', ltSing: 'Gyrus' },
    { re: /^(.*?)\s+\b(sulci)\b(.*)$/i, plSing: 'Bruzdy', ltSing: 'Sulci' },
    { re: /^(.*?)\s+\b(sulcus)\b(.*)$/i, plSing: 'Bruzda', ltSing: 'Sulcus' },
    { re: /^(.*?)\s+\b(lobule)\b(.*)$/i, plSing: 'Płacik', ltSing: 'Lobulus' },
    { re: /^(.*?)\s+\b(root)\b(.*)$/i, plSing: 'Korzeń', ltSing: 'Radix' },
    { re: /^(.*?)\s+\b(region)\b(.*)$/i, plSing: 'Okolica', ltSing: 'Regio' },
    { re: /^(.*?)\s+\b(triangle)\b(.*)$/i, plSing: 'Trójkąt', ltSing: 'Trigonum' },
    { re: /^(.*?)\s+\b(membrane)\b(.*)$/i, plSing: 'Błona', ltSing: 'Membrana' },
    { re: /^(.*?)\s+\b(gland)\b(.*)$/i, plSing: 'Gruczoł', ltSing: 'Glandula' },
    { re: /^(.*?)\s+\b(duct)\b(.*)$/i, plSing: 'Przewód', ltSing: 'Ductus' },
    { re: /^(.*?)\s+\b(groove)\b(.*)$/i, plSing: 'Bruzda', ltSing: 'Sulcus' },
    { re: /^(.*?)\s+\b(tubercle)\b(.*)$/i, plSing: 'Guzek', ltSing: 'Tuberculum' },
  ];

  let headPl = '';
  let headLt = '';
  let rest = working;
  for (const hp of headPatterns) {
    const m = working.match(hp.re);
    if (m) {
      headPl = hp.plSing;
      headLt = hp.ltSing;
      rest = `${m[1]} ${m[3]}`.replace(/\s+/g, ' ').trim();
      break;
    }
  }

  let plRest = rest;
  let ltRest = rest;
  for (const tok of WORD_TOKEN_LEXICON) {
    tok.en.lastIndex = 0;
    plRest = plRest.replace(tok.en, tok.pl);
    tok.en.lastIndex = 0;
    ltRest = ltRest.replace(tok.en, tok.lt);
  }

  plRest = plRest.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();
  ltRest = ltRest.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();

  const fullPl = (headPl ? `${headPl} ${plRest}` : plRest).replace(/\s+/g, ' ').trim();
  const fullLt = (headLt ? `${headLt} ${ltRest}` : ltRest).replace(/\s+/g, ' ').trim();

  // Harmonize neuter Polish adjectives for "Więzadło" / "Jądro" & masculine for "Nerw" / "Zakręt" / "Płacik" / "Korzeń"
  let adjustedPl = fullPl;
  if (/^Więzadło\b/.test(adjustedPl)) {
    adjustedPl = adjustedPl
      .replace(/\bprzednia\b/g, 'przednie')
      .replace(/\btylna\b/g, 'tylne')
      .replace(/\bgórna\b/g, 'górne')
      .replace(/\bdolna\b/g, 'dolne')
      .replace(/\bprzyśrodkowa\b/g, 'przyśrodkowe')
      .replace(/\bboczna\b/g, 'boczne')
      .replace(/\bmiędzykostna\b/g, 'międzykostne')
      .replace(/\bpoboczna\b/g, 'poboczne')
      .replace(/\bdłoniowa\b/g, 'dłoniowe')
      .replace(/\bgrzbietowa\b/g, 'grzbietowe')
      .replace(/\bpodeszwowa\b/g, 'podeszwowe')
      .replace(/\bpośrodkowa\b/g, 'pośrodkowe')
      .replace(/\bpoprzeczna\b/g, 'poprzeczne')
      .replace(/\bdługie\b/g, 'długie');
  } else if (/^(Nerw|Zakręt|Płacik|Korzeń)\b/.test(adjustedPl)) {
    adjustedPl = adjustedPl
      .replace(/\bprzednia\b/g, 'przedni')
      .replace(/\btylna\b/g, 'tylny')
      .replace(/\bgórna\b/g, 'górny')
      .replace(/\bdolna\b/g, 'dolny')
      .replace(/\bprzyśrodkowa\b/g, 'przyśrodkowy')
      .replace(/\bboczna\b/g, 'boczny')
      .replace(/\bpośrednia\b/g, 'pośredni')
      .replace(/\bgrzbietowa\b/g, 'grzbietowy')
      .replace(/\bpodeszwowa\b/g, 'podeszwowy')
      .replace(/\bwspólna\b/g, 'wspólny')
      .replace(/\bwłaściwa\b/g, 'właściwy')
      .replace(/\bdodatkowa\b/g, 'dodatkowy');
  }

  return {
    namePl: adjustedPl ? adjustedPl.charAt(0).toUpperCase() + adjustedPl.slice(1) : 'Struktura anatomiczna',
    nameLt: fullLt ? fullLt.charAt(0).toUpperCase() + fullLt.slice(1) : 'Structura anatomica',
    category,
  };
}

function buildMuscleTendinousLabels(
  namePl: string,
  nameLt: string,
  structureId?: string,
): { tendinousNamePl?: string; tendinousNameLt?: string } {
  const cleanPl = namePl.replace(/\s*\(strona\s+(prawa|lewa)\)/i, '').trim();
  const sideMatch = namePl.match(/\s*\(strona\s+(prawa|lewa)\)/i);
  const side = sideMatch ? sideMatch[0] : '';

  if (structureId === 'm_gastrocnemius' || structureId === 'm_soleus') {
    return {
      tendinousNamePl: `Ścięgno Achillesa — część ścięgnista (${cleanPl})${side}`,
      tendinousNameLt: 'Tendo calcaneus',
    };
  }
  if (structureId === 'm_quadriceps_femoris') {
    return {
      tendinousNamePl: `Ścięgno mięśnia czworogłowego uda${side}`,
      tendinousNameLt: 'Tendo musculi quadricipitis femoris',
    };
  }
  if (structureId === 'm_latissimus_dorsi') {
    return {
      tendinousNamePl: `Rozcięgno piersiowo-lędźwiowe (${cleanPl})${side}`,
      tendinousNameLt: 'Fascia thoracolumbalis (Aponeurosis)',
    };
  }
  if (structureId === 'm_diaphragma') {
    return {
      tendinousNamePl: 'Środek ścięgnisty przepony',
      tendinousNameLt: 'Centrum tendineum diaphragmatis',
    };
  }
  if (
    structureId === 'm_obliquus_externus_abdominis' ||
    structureId === 'm_obliquus_internus_abdominis' ||
    structureId === 'm_transversus_abdominis'
  ) {
    return {
      tendinousNamePl: `Rozcięgno brzuszne — ${cleanPl}${side}`,
      tendinousNameLt: `Aponeurosis — ${capitalizeLatinTerm(nameLt)}`,
    };
  }
  return {
    tendinousNamePl: `Część ścięgnista (ścięgno) — ${cleanPl}${side}`,
    tendinousNameLt: `Tendo — ${capitalizeLatinTerm(nameLt)}`,
  };
}

function resolveToothTranslation(
  rawName: string,
  normalized: string,
  meshWorldX?: number,
): MeshTranslationResult | undefined {
  const explicitToothId = rawName.match(/\b(?:mesh_)?tooth_([1-4][1-7])\b/i);
  if (explicitToothId) {
    const dbMatch = ANATOMY_DB.find((item) => item.id === `tooth_${explicitToothId[1]}`);
    if (dbMatch) {
      const namePl = dbMatch.namePl;
      const nameLt = capitalizeLatinTerm(dbMatch.nameLt) || 'Dens';
      const nameEn = dbMatch.nameEn || dbMatch.namePl;
      return {
        namePl,
        nameLt,
        nameEn,
        bilingualName: formatBilingualName(namePl, nameLt),
        structureId: dbMatch.id,
        category: dbMatch.category,
        isCartilage: false,
      };
    }
  }

  const isUpper = /\b(upper|maxill)\b/i.test(normalized);
  const isLower = /\b(lower|mandib)\b/i.test(normalized);
  if (isUpper === isLower) {
    if (/^\s*incisor\s*$/i.test(normalized)) {
      return {
        namePl: 'Ząb sieczny',
        nameLt: 'Dens incisivus',
        nameEn: 'Incisor',
        bilingualName: formatBilingualName('Ząb sieczny', 'Dens incisivus'),
        category: 'bone',
        isCartilage: false,
      };
    }
    if (/^\s*canine(\s+tooth)?\s*$/i.test(normalized)) {
      return {
        namePl: 'Kieł',
        nameLt: 'Dens caninus',
        nameEn: 'Canine tooth',
        bilingualName: formatBilingualName('Kieł', 'Dens caninus'),
        category: 'bone',
        isCartilage: false,
      };
    }
    if (/^\s*premolar\s*$/i.test(normalized)) {
      return {
        namePl: 'Ząb przedtrzonowy',
        nameLt: 'Dens premolaris',
        nameEn: 'Premolar',
        bilingualName: formatBilingualName('Ząb przedtrzonowy', 'Dens premolaris'),
        category: 'bone',
        isCartilage: false,
      };
    }
    if (/^\s*molar(\s*\(?\s*tooth\)?)?\s*$/i.test(normalized)) {
      return {
        namePl: 'Ząb trzonowy',
        nameLt: 'Dens molaris',
        nameEn: 'Molar tooth',
        bilingualName: formatBilingualName('Ząb trzonowy', 'Dens molaris'),
        category: 'bone',
        isCartilage: false,
      };
    }
    return undefined;
  }

  let toothNum = 0;
  if (/\b(medial|central)\s+incisor\b/i.test(normalized)) toothNum = 1;
  else if (/\blateral\s+incisor\b/i.test(normalized)) toothNum = 2;
  else if (/\bcanine\b/i.test(normalized)) toothNum = 3;
  else if (/\bfirst\s+premolar\b/i.test(normalized)) toothNum = 4;
  else if (/\bsecond\s+premolar\b/i.test(normalized)) toothNum = 5;
  else if (/\bfirst\s+molar\b/i.test(normalized)) toothNum = 6;
  else if (/\bsecond\s+molar\b/i.test(normalized)) toothNum = 7;

  if (!toothNum) return undefined;

  let isPatientLeft: boolean;
  if (typeof meshWorldX === 'number' && Number.isFinite(meshWorldX) && Math.abs(meshWorldX) > 0.0005) {
    isPatientLeft = meshWorldX > 0;
  } else if (/\bleft\b/i.test(normalized)) {
    isPatientLeft = true;
  } else if (/\bright\b/i.test(normalized)) {
    isPatientLeft = false;
  } else {
    const hasDot001 = /\.\s*001\b|001\b/i.test(rawName);
    isPatientLeft = isLower && toothNum === 1 ? hasDot001 : !hasDot001;
  }

  const quadrant = isUpper ? (isPatientLeft ? 2 : 1) : isPatientLeft ? 3 : 4;
  const fdi = quadrant * 10 + toothNum;
  const dbMatch = ANATOMY_DB.find((item) => item.id === `tooth_${fdi}`);
  if (!dbMatch) return undefined;

  const namePl = dbMatch.namePl;
  const nameLt = capitalizeLatinTerm(dbMatch.nameLt) || 'Dens';
  const nameEn = dbMatch.nameEn || dbMatch.namePl;
  return {
    namePl,
    nameLt,
    nameEn,
    bilingualName: formatBilingualName(namePl, nameLt),
    structureId: dbMatch.id,
    category: dbMatch.category,
    isCartilage: false,
  };
}

const escapeRegExp = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function hasWordBoundaryMatch(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const regex = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(needle)}(?![\\p{L}\\p{N}])`, 'iu');
  return regex.test(haystack);
}

export type MeshTissueHint =
  | 'muscle'
  | 'bone'
  | 'other'
  | 'cartilage'
  | 'bursa'
  | 'tendon'
  | 'sheath'
  | 'ligament'
  | 'artery'
  | 'vein'
  | 'nerve'
  | 'organ'
  | 'skin';

/**
 * Translates any 3D mesh node name from body.glb, regional GLBs, Z-Anatomy overlay layers,
 * synthesized tendons, or procedural models into 100% Polish + Terminologia Anatomica Latin.
 */
export function translateMeshNameToPolish(
  rawName: string,
  tissueHint?: MeshTissueHint,
  meshWorldX?: number,
): MeshTranslationResult {
  const rawStr = rawName || '';
  const isBonyGrooveOrTubercle =
    /\b(groove\s+for|grooves\s+for|tubercle\s+of|calcaneal\s+(sulcus|tubercle|tuberosity)|patellar\s+surface|linea\s+as?pera|articular\s+facet|facet\s+for|process\s+of\s+calcane)\b/i.test(
      rawStr,
    );

  const isCartilageName =
    !isBonyGrooveOrTubercle &&
    /\b(cartilages?|cartilago|meniscus|articular\s+disc|intervertebral\s+disc|discus|labrum)\b/i.test(
      rawStr,
    );
  const isBursaName = /\bbursae?\b/i.test(rawStr);
  const isTendonName =
    !isBonyGrooveOrTubercle &&
    /\b(tendon|sheath|aponeurosis|retinaculum|fascia|linea\s+alba|iliotibial\s+tract)\b/i.test(
      rawStr,
    );
  const isLigamentName =
    !isBonyGrooveOrTubercle &&
    /\b(ligaments?|ligamentum|ligamenta|lig_|articular\s+capsule|capsules?|symphysis|suture|interosseous\s+membrane|obturator\s+membrane|quadrangular\s+membrane|oblique\s+cord|fat\s+pad)\b/i.test(
      rawStr,
    );
  const isArteryName =
    /\b(artery|arteries|aorta|aortic|arterial|pulmonary\s+trunk|c(?:o)?eliac\s+trunk|thyrocervical\s+trunk|costocervical\s+trunk|brachiocephalic\s+trunk|palmar\s+arch|plantar\s+arch)\b/i.test(
      rawStr,
    ) && !/\bvenous\b/i.test(rawStr);
  const isVeinName = /\b(vein|veins|vena|venae|venous|sinus)\b/i.test(rawStr);
  const isNerveName =
    /\b(nerve|nerves|plexus|ganglion|ganglia|spinal\s+cord|cerebr|cerebell|pons|medulla|brain|gyrus|gyri|sulcus|sulci|thalamus|hippocampus|lobule|vermis|colliculus|commissure|geniculate|mamillary|amygdaloid|sympathetic\s+trunk|corticospinal|spinothalamic|spinocerebellar|reticulospinal|vestibulospinal|fasciculus\s+proprius|salivatory\s+nucleus|cochlear\s+nucleus)\b/i.test(
      rawStr,
    ) && !/\bvenous\s+plexus\b/i.test(rawStr);
  const isSkinName = /\b(region\s+of|regions\s+of|\w+\s+region|eyebrow|hairs\s+of\s+head|nail\s+plate)\b/i.test(
    rawStr,
  );
  const isJointLigamentName =
    !isBonyGrooveOrTubercle &&
    /\b(cartilages?|cartilago|meniscus|ligament|tendon|bursa|bursae|sheath|aponeurosis|retinaculum|capsule|labrum|lig_|articulatio|discus|intervertebral\s+disc)\b/i.test(
      rawStr,
    );

  const strictLayerCategory: StructureCategory | null =
    tissueHint === 'artery'
      ? 'artery'
      : tissueHint === 'vein'
        ? 'vein'
        : tissueHint === 'nerve'
          ? 'nerve'
          : tissueHint === 'organ'
            ? 'organ'
            : tissueHint === 'skin'
              ? 'skin'
              : tissueHint === 'ligament'
                ? 'ligament'
                : tissueHint === 'bursa'
                  ? 'bursa'
                  : tissueHint === 'tendon' || tissueHint === 'sheath'
                    ? 'tendon'
                    : isArteryName
                      ? 'artery'
                      : isVeinName
                        ? 'vein'
                        : isNerveName
                          ? 'nerve'
                          : isSkinName
                            ? 'skin'
                            : null;

  const fallbackCategory: StructureCategory =
    strictLayerCategory ??
    (tissueHint === 'muscle'
      ? 'muscle'
      : isBursaName
        ? 'bursa'
        : isTendonName
          ? 'tendon'
          : tissueHint === 'cartilage' || isCartilageName
            ? 'joint_ligament'
            : isLigamentName
              ? 'ligament'
              : tissueHint === 'bone' || isBonyGrooveOrTubercle
                ? 'bone'
                : /\b(muscle|musculus|m_|myo)\b/i.test(rawStr)
                  ? 'muscle'
                  : 'bone');

  if (!rawName || !rawName.trim()) {
    return {
      namePl: 'Struktura anatomiczna',
      nameLt: 'Structura anatomica',
      nameEn: 'Anatomical structure',
      bilingualName: 'Struktura anatomiczna (Structura anatomica)',
      category: fallbackCategory,
      isCartilage: isCartilageName,
    };
  }

  // Strip Blender numeric suffix (.001, .015) & lateralization suffix (.r, .l, .r.001, .l.001) cleanly!
  const explicitLeft = /\b(left|lt|sinister|sin)\b|(?:[_.-\s])l(?:\.\d+)?$/i.test(rawName);
  const explicitRight = /\b(right|rt|dexter|dex)\b|(?:[_.-\s])r(?:\.\d+)?$/i.test(rawName);

  const normalized = rawName
    .replace(/^(mesh_|geo_|node_|object_)+/i, '')
    .replace(/\.(r|l)(?:\.\d+)?$/i, '')
    .replace(/\.\d{3}$/, '')
    .replace(/([a-zA-Z])(\d{3})\b/g, '$1')
    .replace(/^\((.*)\)(?:\.\d+)?$/, '$1')
    .replace(/[_]+/g, ' ')
    .replace(/\.\.+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return {
      namePl: 'Struktura anatomiczna',
      nameLt: 'Structura anatomica',
      nameEn: 'Anatomical structure',
      bilingualName: 'Struktura anatomiczna (Structura anatomica)',
      category: fallbackCategory,
      isCartilage: isCartilageName,
    };
  }

  const hasWorldXSide =
    !explicitLeft &&
    !explicitRight &&
    typeof meshWorldX === 'number' &&
    Number.isFinite(meshWorldX) &&
    Math.abs(meshWorldX) > 0.002;
  const isLeft = explicitLeft || (hasWorldXSide && (meshWorldX as number) > 0.002);
  const isRight = explicitRight || (hasWorldXSide && (meshWorldX as number) < -0.002);
  const sideSuffix = isLeft ? ' (strona lewa)' : isRight ? ' (strona prawa)' : '';

  const isCategoryCompatible = (ruleCat: StructureCategory): boolean => {
    if (!strictLayerCategory) return true;
    if (strictLayerCategory === ruleCat) return true;
    if (strictLayerCategory === 'ligament' && ruleCat === 'joint_ligament') return true;
    if (strictLayerCategory === 'tendon' && ruleCat === 'joint_ligament') return true;
    return false;
  };

  // 0. Deterministic FDI Tooth resolution
  if (!strictLayerCategory) {
    const toothResult = resolveToothTranslation(rawName, normalized, meshWorldX);
    if (toothResult) {
      return toothResult;
    }
  }

  // 1. Direct rule match (ordered by anatomical precedence)
  for (const rule of ANATOMY_TRANSLATION_RULES) {
    if (!isCategoryCompatible(rule.category)) continue;
    if (rule.pattern.test(normalized)) {
      const dbMatch = rule.structureId
        ? ANATOMY_DB.find((item) => item.id === rule.structureId)
        : undefined;
      const effectiveSide = rule.structureId?.startsWith('tooth_') ? '' : sideSuffix;
      const namePl = `${rule.namePl}${effectiveSide}`;
      const nameLt =
        capitalizeLatinTerm(rule.nameLt) ||
        capitalizeLatinTerm(dbMatch?.nameLt) ||
        rule.namePl;
      const nameEn = rule.nameEn || dbMatch?.nameEn || rule.namePl;
      const bilingualName = formatBilingualName(namePl, nameLt);
      const effectiveCat = rule.category ?? dbMatch?.category ?? fallbackCategory;
      const tendinous =
        effectiveCat === 'muscle'
          ? buildMuscleTendinousLabels(namePl, nameLt, rule.structureId)
          : {};
      return {
        namePl,
        nameLt,
        nameEn,
        bilingualName,
        ...tendinous,
        structureId: rule.structureId,
        category: effectiveCat,
        isCartilage: rule.isCartilage ?? isCartilageName,
      };
    }
  }

  // 2. Direct lookup in ANATOMY_DB by ID, nameLt, or aliases
  const step2Target = normalized.replace(/\s+\d{3}$/, '').toLowerCase().trim();
  for (const entry of ANATOMY_DB) {
    if (!isCategoryCompatible(entry.category)) continue;
    const idMatch = entry.id.toLowerCase() === step2Target;
    const meshIdMatch = Boolean(
      entry.modelMeshId && entry.modelMeshId.toLowerCase() === rawName.toLowerCase(),
    );
    const nameLtMatch = Boolean(
      entry.nameLt &&
        (entry.nameLt.toLowerCase() === step2Target ||
          hasWordBoundaryMatch(step2Target, entry.nameLt.toLowerCase())),
    );
    const aliasMatch = entry.aliases.some((alias) => {
      const a = alias.trim().toLowerCase();
      if (!a || /^\d+$/.test(a)) return false;
      return hasWordBoundaryMatch(step2Target, a);
    });

    if (idMatch || meshIdMatch || nameLtMatch || aliasMatch) {
      const effectiveSide = entry.id.startsWith('tooth_') ? '' : sideSuffix;
      const namePl = `${entry.namePl}${effectiveSide}`;
      const nameLt = capitalizeLatinTerm(entry.nameLt) || entry.namePl;
      const nameEn = entry.nameEn || entry.namePl;
      const bilingualName = formatBilingualName(namePl, nameLt);
      const effectiveCat =
        strictLayerCategory ??
        (isJointLigamentName &&
        entry.category !== 'bursa' &&
        entry.category !== 'tendon' &&
        entry.category !== 'ligament'
          ? 'joint_ligament'
          : entry.category);
      const tendinous =
        effectiveCat === 'muscle' ? buildMuscleTendinousLabels(namePl, nameLt, entry.id) : {};
      return {
        namePl,
        nameLt,
        nameEn,
        bilingualName,
        ...tendinous,
        structureId: entry.id,
        category: effectiveCat,
        isCartilage: isCartilageName,
      };
    }
  }

  // 3. Compositional Polish + Terminologia Anatomica Latin translation for deep Z-Anatomy meshes
  const cleanLabel = normalized
    .replace(/\s+\d{3}$/, '')
    .replace(/\b(mesh|geo|node)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const comp = translateCompositionalAnatomy(cleanLabel, fallbackCategory);
  // Avoid duplicating "(strona prawa/lewa)" if "prawa/lewa" is already inside the Polish stem
  const alreadyHasSideInStem = /\b(prawa|prawego|prawej|prawy|lewa|lewego|lewej|lewy)\b/i.test(
    comp.namePl,
  );
  const namePl = `${comp.namePl}${alreadyHasSideInStem ? '' : sideSuffix}`;
  const nameLt = capitalizeLatinTerm(comp.nameLt) || 'Structura anatomica';
  const nameEn = cleanLabel || 'Anatomical structure';
  const bilingualName = formatBilingualName(namePl, nameLt);

  return {
    namePl,
    nameLt,
    nameEn,
    bilingualName,
    category: comp.category,
    isCartilage: comp.isCartilage ?? isCartilageName,
  };
}

export function getMeshIdForStructure(structureId: string): string | undefined {
  const match = ANATOMY_DB.find((s) => s.id === structureId);
  return match?.modelMeshId;
}

export function getStructureIdForMesh(meshName: string): string | undefined {
  return translateMeshNameToPolish(meshName).structureId;
}
