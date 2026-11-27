import { ANATOMY_DB } from '../data/anatomyDb';
import { StructureCategory } from '../types/anatomy';

export interface MeshTranslationResult {
  namePl: string;
  nameEn: string;
  bilingualName: string;
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

export function formatBilingualName(namePl: string, nameEn?: string): string {
  const cleanPl = (namePl || '').trim();
  const cleanEn = (nameEn || '').trim();
  if (!cleanPl && !cleanEn) return 'Struktura anatomiczna';
  if (!cleanEn) return cleanPl || 'Struktura anatomiczna';

  // Extract trailing lateralization/part suffix so it stays outside the English parentheses
  const sideMatch = cleanPl.match(/\s*\((strona\s+(?:lewa|prawa)|część\s+[^)]+)\)$/i);
  const sideTag = sideMatch ? `(${sideMatch[1]})` : '';
  const basePlRaw = sideMatch ? cleanPl.slice(0, sideMatch.index).trim() : cleanPl;

  // Deduplicate identical abbreviation tag (e.g. (C7), (ACL), (TFL)) if present in both PL and EN
  let enAdjusted = cleanEn;
  const tagInPl = basePlRaw.match(/\(([^)]+)\)\s*$/) || basePlRaw.match(/\s+—\s+([A-Z0-9]{2,10})$/);
  if (tagInPl) {
    const tagRegex = new RegExp(
      `\\s*\\(${tagInPl[1].trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)$`,
      'i'
    );
    enAdjusted = enAdjusted.replace(tagRegex, '').trim() || cleanEn;
  }

  const flatEn = flattenInnerParens(enAdjusted);

  // Idempotency: return as-is if already formatted with this English label
  const lowerPl = basePlRaw.toLowerCase();
  if (
    lowerPl === cleanEn.toLowerCase() ||
    lowerPl === flatEn.toLowerCase() ||
    lowerPl === enAdjusted.toLowerCase() ||
    lowerPl.includes(`(${cleanEn.toLowerCase()})`) ||
    lowerPl.includes(`(${flatEn.toLowerCase()})`)
  ) {
    return cleanPl;
  }

  const trailingEnMatch = basePlRaw.match(/\s+\(([^)]+)\)$/);
  if (trailingEnMatch) {
    const existingEn = trailingEnMatch[1].trim().toLowerCase();
    if (
      existingEn === cleanEn.toLowerCase() ||
      existingEn === flatEn.toLowerCase() ||
      existingEn === enAdjusted.toLowerCase() ||
      cleanEn.toLowerCase().startsWith(`${existingEn} (`)
    ) {
      return cleanPl;
    }
  }

  // Convert inner parens in Polish base (e.g. "Kręg wystający (C7)" -> "Kręg wystający — C7")
  // so the final string has a single clean "(English name)" block without nested/adjacent parens.
  const formattedBasePl = basePlRaw
    .replace(/\s*\(([^)]+)\)/g, ' — $1')
    .replace(/\s+/g, ' ')
    .trim();

  if (!formattedBasePl) {
    return sideTag ? `${flatEn} ${sideTag}` : flatEn;
  }

  return sideTag
    ? `${formattedBasePl} (${flatEn}) ${sideTag}`
    : `${formattedBasePl} (${flatEn})`;
}

interface TranslationRule {
  pattern: RegExp;
  namePl: string;
  nameEn?: string;
  structureId?: string;
  category: StructureCategory;
  isCartilage?: boolean;
}

const ORDINAL_PAIRS: Array<{ en: string; roman: string }> = [
  { en: 'first', roman: 'I' },
  { en: 'second', roman: 'II' },
  { en: 'third', roman: 'III' },
  { en: 'fourth', roman: 'IV' },
  { en: 'fifth', roman: 'V' },
  { en: 'sixth', roman: 'VI' },
  { en: 'seventh', roman: 'VII' },
  { en: 'eighth', roman: 'VIII' },
  { en: 'ninth', roman: 'IX' },
  { en: 'tenth', roman: 'X' },
  { en: 'eleventh', roman: 'XI' },
  { en: 'twelfth', roman: 'XII' },
];

const PHALANX_SEGMENTS: Array<{ en: string; pl: string }> = [
  { en: 'proximal', pl: 'bliższy' },
  { en: 'middle', pl: 'środkowy' },
  { en: 'distal', pl: 'dalszy' },
];

const PHALANX_DIGITS = ORDINAL_PAIRS.slice(0, 5);

const COSTAL_CARTILAGE_RULES: TranslationRule[] = ORDINAL_PAIRS.slice(0, 10).map((ord) => ({
  pattern: new RegExp(`\\bcostal\\s+cartilage\\s+of\\s+${ord.en}\\s+rib\\b`, 'i'),
  namePl: `Chrząstka żebrowa ${ord.roman} żebra`,
  nameEn: `Costal cartilage of ${ord.en} rib`,
  structureId: 'costae',
  category: 'joint_ligament',
  isCartilage: true,
}));

const RIB_RULES: TranslationRule[] = ORDINAL_PAIRS.map((ord, idx) => ({
  pattern: new RegExp(
    `\\b${ord.en}\\s+rib\\b` + (idx === 0 ? `|\\brib_1\\b|\\bfirst_rib\\b|\\bcosta_prima\\b` : ''),
    'i'
  ),
  namePl: `Żebro ${ord.roman}`,
  nameEn: `${ord.en.charAt(0).toUpperCase()}${ord.en.slice(1)} rib`,
  structureId: 'costae',
  category: 'bone',
}));

const METACARPAL_RULES: TranslationRule[] = PHALANX_DIGITS.map((ord) => ({
  pattern: new RegExp(`\\b${ord.en}\\s+metacarpal(\\s+bone)?\\b`, 'i'),
  namePl: `${ord.roman} kość śródręcza`,
  nameEn: `${ord.en.charAt(0).toUpperCase()}${ord.en.slice(1)} metacarpal bone`,
  category: 'bone',
}));

const METATARSAL_RULES: TranslationRule[] = PHALANX_DIGITS.map((ord) => ({
  pattern: new RegExp(`\\b${ord.en}\\s+metatarsal(\\s+bone)?\\b`, 'i'),
  namePl: `${ord.roman} kość śródstopia`,
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
        'i'
      ),
      namePl: `Paliczek ${seg.pl} ${dig.roman} palca ręki`,
      nameEn: `${segCap} phalanx of ${dig.en} finger of hand`,
      category: 'bone',
    });
    PHALANX_FOOT_RULES.push({
      pattern: new RegExp(
        `\\b${seg.en}\\s+phalanx\\s+of\\s+${dig.en}\\s+(?:finger\\s+of\\s+foot|toe)\\b`,
        'i'
      ),
      namePl: `Paliczek ${seg.pl} ${dig.roman} palca stopy`,
      nameEn: `${segCap} phalanx of ${dig.en} toe`,
      category: 'bone',
    });
  }
}

export const ANATOMY_TRANSLATION_RULES: TranslationRule[] = [
  // =========================================================================
  // PRECEDENCE 0: ARTERIES, VEINS, NERVES, INTERNAL ORGANS, LIGAMENTS & SKIN
  // (Placed BEFORE muscle/bone rules so e.g. "Brachial artery" doesn't match "Brachialis")
  // =========================================================================
  // --- ARTERIES ---
  { pattern: /\b(ascending\s+aorta|arch\s+of\s+aorta|thoracic\s+aorta|abdominal\s+aorta|descending\s+aorta|aorta)\b/i, namePl: 'Aorta (Tętnica główna)', nameEn: 'Aorta', structureId: 'a_aorta', category: 'artery' },
  { pattern: /\bcommon\s+carotid\s+artery\b/i, namePl: 'Tętnica szyjna wspólna', nameEn: 'Common carotid artery', structureId: 'a_carotis_communis', category: 'artery' },
  { pattern: /\binternal\s+carotid\s+artery\b/i, namePl: 'Tętnica szyjna wewnętrzna', nameEn: 'Internal carotid artery', structureId: 'a_carotis_interna', category: 'artery' },
  { pattern: /\bexternal\s+carotid\s+artery\b/i, namePl: 'Tętnica szyjna zewnętrzna', nameEn: 'External carotid artery', structureId: 'a_carotis_communis', category: 'artery' },
  { pattern: /\bvertebral\s+artery\b/i, namePl: 'Tętnica kręgowa', nameEn: 'Vertebral artery', structureId: 'a_vertebralis', category: 'artery' },
  { pattern: /\bbasilar\s+artery\b/i, namePl: 'Tętnica podstawna', nameEn: 'Basilar artery', structureId: 'a_vertebralis', category: 'artery' },
  { pattern: /\bsubclavian\s+artery\b/i, namePl: 'Tętnica podobojczykowa', nameEn: 'Subclavian artery', structureId: 'a_subclavia', category: 'artery' },
  { pattern: /\baxillary\s+artery\b/i, namePl: 'Tętnica pachowa', nameEn: 'Axillary artery', structureId: 'a_axillaris', category: 'artery' },
  { pattern: /\bbrachial\s+artery\b/i, namePl: 'Tętnica ramienna', nameEn: 'Brachial artery', structureId: 'a_brachialis', category: 'artery' },
  { pattern: /\bradial\s+artery\b/i, namePl: 'Tętnica promieniowa', nameEn: 'Radial artery', structureId: 'a_radialis', category: 'artery' },
  { pattern: /\bulnar\s+artery\b/i, namePl: 'Tętnica łokciowa', nameEn: 'Ulnar artery', structureId: 'a_ulnaris', category: 'artery' },
  { pattern: /\b(common|external|internal)\s+iliac\s+artery\b/i, namePl: 'Tętnica biodrowa', nameEn: 'Iliac artery', structureId: 'a_iliaca_communis', category: 'artery' },
  { pattern: /\b(deep\s+artery\s+of\s+thigh|deep\s+femoral\s+artery|profunda\s+femoris)\b/i, namePl: 'Tętnica głęboka uda', nameEn: 'Deep femoral artery', structureId: 'a_profunda_femoris', category: 'artery' },
  { pattern: /\bfemoral\s+artery\b/i, namePl: 'Tętnica udowa', nameEn: 'Femoral artery', structureId: 'a_femoralis', category: 'artery' },
  { pattern: /\bpopliteal\s+artery\b/i, namePl: 'Tętnica podkolanowa', nameEn: 'Popliteal artery', structureId: 'a_poplitea', category: 'artery' },
  { pattern: /\banterior\s+tibial\s+artery\b/i, namePl: 'Tętnica piszczelowa przednia', nameEn: 'Anterior tibial artery', structureId: 'a_tibialis_anterior', category: 'artery' },
  { pattern: /\bposterior\s+tibial\s+artery\b/i, namePl: 'Tętnica piszczelowa tylna', nameEn: 'Posterior tibial artery', structureId: 'a_tibialis_posterior', category: 'artery' },
  { pattern: /\bdorsalis\s+pedis\s+artery\b/i, namePl: 'Tętnica grzbietowa stopy', nameEn: 'Dorsalis pedis artery', structureId: 'a_dorsalis_pedis', category: 'artery' },
  { pattern: /\bpulmonary\s+(trunk|artery)\b/i, namePl: 'Pień / tętnica płucna', nameEn: 'Pulmonary trunk / artery', structureId: 'org_cor', category: 'artery' },
  { pattern: /\brenal\s+artery\b/i, namePl: 'Tętnica nerkowa', nameEn: 'Renal artery', structureId: 'org_ren', category: 'artery' },
  { pattern: /\bbrachiocephalic\s+trunk\b/i, namePl: 'Pień ramienno-głowowy', nameEn: 'Brachiocephalic trunk', structureId: 'a_aorta', category: 'artery' },

  // --- VEINS ---
  { pattern: /\bsuperior\s+vena\s+cava\b/i, namePl: 'Żyła główna górna', nameEn: 'Superior vena cava', structureId: 'v_cava_superior', category: 'vein' },
  { pattern: /\binferior\s+vena\s+cava\b/i, namePl: 'Żyła główna dolna', nameEn: 'Inferior vena cava', structureId: 'v_cava_inferior', category: 'vein' },
  { pattern: /\binternal\s+jugular\s+vein\b/i, namePl: 'Żyła szyjna wewnętrzna', nameEn: 'Internal jugular vein', structureId: 'v_jugularis_interna', category: 'vein' },
  { pattern: /\bexternal\s+jugular\s+vein\b/i, namePl: 'Żyła szyjna zewnętrzna', nameEn: 'External jugular vein', structureId: 'v_jugularis_interna', category: 'vein' },
  { pattern: /\bsubclavian\s+vein\b/i, namePl: 'Żyła podobojczykowa', nameEn: 'Subclavian vein', structureId: 'v_subclavia', category: 'vein' },
  { pattern: /\bcephalic\s+vein\b/i, namePl: 'Żyła odpromieniowa', nameEn: 'Cephalic vein', structureId: 'v_cephalica', category: 'vein' },
  { pattern: /\bbasilic\s+vein\b/i, namePl: 'Żyła odłokciowa', nameEn: 'Basilic vein', structureId: 'v_basilica', category: 'vein' },
  { pattern: /\bmedian\s+cubital\s+vein\b/i, namePl: 'Żyła pośrodkowa łokcia', nameEn: 'Median cubital vein', structureId: 'v_mediana_cubiti', category: 'vein' },
  { pattern: /\b(hepatic\s+)?portal\s+vein\b/i, namePl: 'Żyła wrotna wątroby', nameEn: 'Hepatic portal vein', structureId: 'v_portae', category: 'vein' },
  { pattern: /\bfemoral\s+vein\b/i, namePl: 'Żyła udowa', nameEn: 'Femoral vein', structureId: 'v_femoralis', category: 'vein' },
  { pattern: /\bgreat\s+saphenous\s+vein\b/i, namePl: 'Żyła odpiszczelowa', nameEn: 'Great saphenous vein', structureId: 'v_saphena_magna', category: 'vein' },
  { pattern: /\bsmall\s+saphenous\s+vein\b/i, namePl: 'Żyła odstrzałkowa', nameEn: 'Small saphenous vein', structureId: 'v_saphena_parva', category: 'vein' },
  { pattern: /\bpopliteal\s+vein\b/i, namePl: 'Żyła podkolanowa', nameEn: 'Popliteal vein', structureId: 'v_poplitea', category: 'vein' },

  // --- NERVES & CNS ---
  { pattern: /\b(spinal\s+cord|spinal\s+dura|conus\s+medullaris|cauda\s+equina)\b/i, namePl: 'Rdzeń kręgowy', nameEn: 'Spinal cord', structureId: 'n_medulla_spinalis', category: 'nerve' },
  { pattern: /\bcerebell(um|ar)\b/i, namePl: 'Móżdżek', nameEn: 'Cerebellum', structureId: 'n_cerebellum', category: 'nerve' },
  { pattern: /\b(frontal|parietal|temporal|occipital)\s+(lobe|gyrus|pole|sulcus)\b|\bcorpus\s+callosum\b|\bcerebr(um|al\s+hemisphere)\b|\binsula\b|\bhippocampus\b|\bthalamus\b/i, namePl: 'Mózgowie (Półkule mózgu)', nameEn: 'Cerebrum', structureId: 'n_cerebrum', category: 'nerve' },
  { pattern: /\b(trigeminal|ophthalmic|maxillary|mandibular)\s+nerve\b/i, namePl: 'Nerw trójdzielny (V)', nameEn: 'Trigeminal nerve', structureId: 'n_trigeminus', category: 'nerve' },
  { pattern: /\bfacial\s+nerve\b/i, namePl: 'Nerw twarzowy (VII)', nameEn: 'Facial nerve', structureId: 'n_facialis', category: 'nerve' },
  { pattern: /\bvagus\s+nerve\b/i, namePl: 'Nerw błędny (X)', nameEn: 'Vagus nerve', structureId: 'n_vagus', category: 'nerve' },
  { pattern: /\baccessory\s+nerve\b/i, namePl: 'Nerw dodatkowy (XI)', nameEn: 'Accessory nerve (XI)', structureId: 'n_accessorius', category: 'nerve' },
  { pattern: /\bphrenic\s+nerve\b/i, namePl: 'Nerw przeponowy', nameEn: 'Phrenic nerve', structureId: 'n_phrenicus', category: 'nerve' },
  { pattern: /\bbrachial\s+plexus\b|\b(superior|middle|inferior)\s+trunk\s+of\s+brachial|\b(lateral|medial|posterior)\s+cord\b/i, namePl: 'Splot ramienny', nameEn: 'Brachial plexus', structureId: 'n_plexus_brachialis', category: 'nerve' },
  { pattern: /\bsuprascapular\s+nerve\b/i, namePl: 'Nerw nadłopatkowy', nameEn: 'Suprascapular nerve', structureId: 'n_suprascapularis', category: 'nerve' },
  { pattern: /\blong\s+thoracic\s+nerve\b/i, namePl: 'Nerw piersiowy długi', nameEn: 'Long thoracic nerve', structureId: 'n_thoracicus_longus', category: 'nerve' },
  { pattern: /\baxillary\s+nerve\b/i, namePl: 'Nerw pachowy', nameEn: 'Axillary nerve', structureId: 'n_axillaris', category: 'nerve' },
  { pattern: /\bmusculocutaneous\s+nerve\b/i, namePl: 'Nerw mięśniowo-skórny', nameEn: 'Musculocutaneous nerve', structureId: 'n_musculocutaneus', category: 'nerve' },
  { pattern: /\bradial\s+nerve\b|\bposterior\s+interosseous\s+nerve\b/i, namePl: 'Nerw promieniowy', nameEn: 'Radial nerve', structureId: 'n_radialis', category: 'nerve' },
  { pattern: /\bmedian\s+nerve\b|\banterior\s+interosseous\s+nerve\b/i, namePl: 'Nerw pośrodkowy', nameEn: 'Median nerve', structureId: 'n_medianus', category: 'nerve' },
  { pattern: /\bulnar\s+nerve\b/i, namePl: 'Nerw łokciowy', nameEn: 'Ulnar nerve', structureId: 'n_ulnaris', category: 'nerve' },
  { pattern: /\b(femoral|saphenous)\s+nerve\b/i, namePl: 'Nerw udowy', nameEn: 'Femoral nerve', structureId: 'n_femoralis', category: 'nerve' },
  { pattern: /\bsuperior\s+gluteal\s+nerve\b/i, namePl: 'Nerw pośladkowy górny', nameEn: 'Superior gluteal nerve', structureId: 'n_gluteus_superior', category: 'nerve' },
  { pattern: /\bsciatic\s+nerve\b/i, namePl: 'Nerw kulszowy', nameEn: 'Sciatic nerve', structureId: 'n_ischiadicus', category: 'nerve' },
  { pattern: /\btibial\s+nerve\b/i, namePl: 'Nerw piszczelowy', nameEn: 'Tibial nerve', structureId: 'n_tibialis', category: 'nerve' },
  { pattern: /\b(common|deep|superficial)\s+(fibular|peroneal)\s+nerve\b/i, namePl: 'Nerw strzałkowy wspólny', nameEn: 'Common fibular nerve', structureId: 'n_fibularis_communis', category: 'nerve' },
  { pattern: /\bobturator\s+nerve\b/i, namePl: 'Nerw zasłonowy', nameEn: 'Obturator nerve', structureId: 'n_obturatorius', category: 'nerve' },

  // --- INTERNAL ORGANS ---
  { pattern: /\b(right|left)\s+(atrium|ventricle)\b|\b(atrioventricular|pulmonary|aortic|mitral|tricuspid)\s+valve\b|\bpapillary\s+muscle\b|\bheart\b/i, namePl: 'Serce', nameEn: 'Heart', structureId: 'org_cor', category: 'organ' },
  { pattern: /\b(right|left)?\s*(superior|middle|inferior)?\s*(lobe\s+of\s+)?lung\b/i, namePl: 'Płuca', nameEn: 'Lungs', structureId: 'org_pulmo', category: 'organ' },
  { pattern: /\b(trachea|bronchus|bronchi|carina)\b/i, namePl: 'Tchawica i oskrzela', nameEn: 'Trachea and bronchi', structureId: 'org_trachea', category: 'organ' },
  { pattern: /\bo?esophagus\b/i, namePl: 'Przełyk', nameEn: 'Esophagus', structureId: 'org_oesophagus', category: 'organ' },
  { pattern: /\bstomach\b|\bcardiac\s+part\s+of\s+stomach\b|\bpylorus\b/i, namePl: 'Żołądek', nameEn: 'Stomach', structureId: 'org_gaster', category: 'organ' },
  { pattern: /\bliver\b/i, namePl: 'Wątroba', nameEn: 'Liver', structureId: 'org_hepar', category: 'organ' },
  { pattern: /\bgallbladder\b|\bcystic\s+duct\b|\bcommon\s+bile\s+duct\b/i, namePl: 'Pęcherzyk żółciowy', nameEn: 'Gallbladder', structureId: 'org_vesica_biliaris', category: 'organ' },
  { pattern: /\bpancreas\b|\bpancreatic\s+duct\b/i, namePl: 'Trzustka', nameEn: 'Pancreas', structureId: 'org_pancreas', category: 'organ' },
  { pattern: /\bspleen\b/i, namePl: 'Śledziona', nameEn: 'Spleen', structureId: 'org_splen', category: 'organ' },
  { pattern: /\b(duodenum|jejunum|ileum|small\s+intestine)\b/i, namePl: 'Jelito cienkie', nameEn: 'Small intestine', structureId: 'org_intestinum_tenue', category: 'organ' },
  { pattern: /\b(colon|cecum|caecum|rectum|vermiform\s+appendix|taenia)\b/i, namePl: 'Jelito grube (Okrężnica)', nameEn: 'Large intestine (Colon)', structureId: 'org_colon', category: 'organ' },
  { pattern: /\b(kidney|ureter|renal\s+pelvis)\b/i, namePl: 'Nerki', nameEn: 'Kidneys', structureId: 'org_ren', category: 'organ' },
  { pattern: /\burinary\s+bladder\b|\burethra\b/i, namePl: 'Pęcherz moczowy', nameEn: 'Urinary bladder', structureId: 'org_vesica_urinaria', category: 'organ' },
  { pattern: /\bthyroid\s+gland\b|\bparathyroid\s+gland\b/i, namePl: 'Tarczyca', nameEn: 'Thyroid gland', structureId: 'org_glandula_thyroidea', category: 'organ' },

  // --- LIGAMENTS & ARTICULAR CAPSULES (Z-Anatomy 3: Joints) ---
  { pattern: /\biliofemoral\s+ligament\b/i, namePl: 'Więzadło biodrowo-udowe (Bertina)', nameEn: 'Iliofemoral ligament', structureId: 'lig_iliofemorale', category: 'ligament' },
  { pattern: /\bischiofemoral\s+ligament\b/i, namePl: 'Więzadło kulszowo-udowe', nameEn: 'Ischiofemoral ligament', structureId: 'lig_ischiofemorale', category: 'ligament' },
  { pattern: /\bpubofemoral\s+ligament\b/i, namePl: 'Więzadło łonowo-udowe', nameEn: 'Pubofemoral ligament', structureId: 'lig_pubofemorale', category: 'ligament' },
  { pattern: /\bsacrotuberous\s+ligament\b/i, namePl: 'Więzadło krzyżowo-guzowe', nameEn: 'Sacrotuberous ligament', structureId: 'lig_sacrotuberale', category: 'ligament' },
  { pattern: /\banterior\s+longitudinal\s+ligament\b/i, namePl: 'Więzadło podłużne przednie', nameEn: 'Anterior longitudinal ligament', structureId: 'lig_longitudinale_anterius', category: 'ligament' },
  { pattern: /\b(ligamentum|ligamenta)\s+flav(um|a)\b|\byellow\s+ligament\b/i, namePl: 'Więzadło żółte', nameEn: 'Ligamentum flavum', structureId: 'lig_flavum', category: 'ligament' },
  { pattern: /\b(coracoclavicular|trapezoid|conoid)\s+ligament\b/i, namePl: 'Więzadło kruczo-obojczykowe', nameEn: 'Coracoclavicular ligament', structureId: 'lig_coracoclaviculare', category: 'ligament' },
  { pattern: /\bannular\s+ligament\s+of\s+radius\b/i, namePl: 'Więzadło pierścieniowate kości promieniowej', nameEn: 'Annular ligament of radius', structureId: 'lig_annulare_radii', category: 'ligament' },
  { pattern: /\banterior\s+talofibular\s+ligament\b/i, namePl: 'Więzadło skokowo-strzałkowe przednie (ATFL)', nameEn: 'Anterior talofibular ligament', structureId: 'lig_talofibulare_anterius', category: 'ligament' },
  { pattern: /\b(deltoid|medial\s+collateral|tibiocalcaneal|tibionavicular|tibiotalar)\s+ligament\b/i, namePl: 'Więzadło przyśrodkowe (trójgraniaste) stawu skokowego', nameEn: 'Medial collateral (deltoid) ligament of ankle', structureId: 'lig_deltoideum_ankle', category: 'ligament' },
  { pattern: /\bcoracoacromial\s+ligament\b/i, namePl: 'Więzadło kruczo-barkowe', nameEn: 'Coracoacromial ligament', structureId: 'lig_coracoacromiale', category: 'joint_ligament' },
  { pattern: /\banterior\s+cruciate\s+ligament\b/i, namePl: 'Więzadło krzyżowe przednie (ACL)', nameEn: 'Anterior cruciate ligament (ACL)', structureId: 'acl', category: 'joint_ligament' },
  { pattern: /\bposterior\s+cruciate\s+ligament\b/i, namePl: 'Więzadło krzyżowe tylne (PCL)', nameEn: 'Posterior cruciate ligament (PCL)', structureId: 'pcl', category: 'joint_ligament' },
  { pattern: /\btibial\s+collateral\s+ligament\b/i, namePl: 'Więzadło poboczne piszczelowe (MCL)', nameEn: 'Tibial collateral ligament (MCL)', structureId: 'mcl', category: 'joint_ligament' },
  { pattern: /\bfibular\s+collateral\s+ligament\b/i, namePl: 'Więzadło poboczne strzałkowe (LCL)', nameEn: 'Fibular collateral ligament (LCL)', structureId: 'lcl', category: 'joint_ligament' },
  { pattern: /\bmedial\s+meniscus\b/i, namePl: 'Łąkotka przyśrodkowa', nameEn: 'Medial meniscus', structureId: 'meniscus_medialis', category: 'joint_ligament', isCartilage: true },
  { pattern: /\blateral\s+meniscus\b/i, namePl: 'Łąkotka boczna', nameEn: 'Lateral meniscus', structureId: 'meniscus_lateralis', category: 'joint_ligament', isCartilage: true },
  { pattern: /\bglenoid\s+labrum\b/i, namePl: 'Obrąbek stawowy panewki barku', nameEn: 'Glenoid labrum', structureId: 'labrum_glenoidale', category: 'joint_ligament', isCartilage: true },

  // =========================================================================
  // PRECEDENCE 1: BURSAE (Kaletki maziowe — must precede all muscle/bone rules)
  // =========================================================================
  { pattern: /\biliopectineal\s+bursa\b/i, namePl: 'Kaletka biodrowo-grzebieniowa (biodrowo-lędźwiowa)', nameEn: 'Iliopectineal bursa', structureId: 'bursa_iliopectinea', category: 'bursa' },
  { pattern: /\banserine\s+bursa\b/i, namePl: 'Kaletka gęsiej stopki', nameEn: 'Anserine bursa', structureId: 'bursa_anserina', category: 'bursa' },
  { pattern: /\bbicipitoradial\s+bursa\b/i, namePl: 'Kaletka dwugłowo-promieniowa', nameEn: 'Bicipitoradial bursa', category: 'bursa' },
  { pattern: /\bbursa\s+of\s+piriformis\b/i, namePl: 'Kaletka mięśnia gruszkowatego', nameEn: 'Bursa of piriformis muscle', category: 'bursa' },
  { pattern: /\bcoracobrachial\s+bursa\b/i, namePl: 'Kaletka kruczo-ramienna', nameEn: 'Coracobrachial bursa', category: 'bursa' },
  { pattern: /\bdeep\s+infrapatellar\s+bursa\b/i, namePl: 'Kaletka podrzepkowa głęboka', nameEn: 'Deep infrapatellar bursa', structureId: 'bursa_infrapatellaris_profunda', category: 'bursa' },
  { pattern: /\binferior\s+subtendinous\s+bursa\s+of\s+biceps\s+femoris\b/i, namePl: 'Kaletka podścięgnowa dolna mięśnia dwugłowego uda', nameEn: 'Inferior subtendinous bursa of biceps femoris', category: 'bursa' },
  { pattern: /\bintermuscular\s+gluteal\s+bursae?\b/i, namePl: 'Kaletki międzymięśniowe pośladkowe', nameEn: 'Intermuscular gluteal bursae', category: 'bursa' },
  { pattern: /\blateral\s+subtendinous\s+bursa\s+of\s+gastrocnemius\b/i, namePl: 'Kaletka podścięgnowa boczna mięśnia brzuchatego łydki', nameEn: 'Lateral subtendinous bursa of gastrocnemius', category: 'bursa' },
  { pattern: /\bmedial\s+subtendinous\s+bursa\s+of\s+gastrocnemius\b/i, namePl: 'Kaletka podścięgnowa przyśrodkowa mięśnia brzuchatego łydki', nameEn: 'Medial subtendinous bursa of gastrocnemius', category: 'bursa' },
  { pattern: /\bsciatic\s+bursa\s+of\s+gluteus\s+maximus\b/i, namePl: 'Kaletka kulszowa mięśnia pośladkowego wielkiego', nameEn: 'Sciatic bursa of gluteus maximus', category: 'bursa' },
  { pattern: /\bsciatic\s+bursa\s+of\s+obturator\s+internus\b/i, namePl: 'Kaletka kulszowa mięśnia zasłaniacza wewnętrznego', nameEn: 'Sciatic bursa of obturator internus', category: 'bursa' },
  { pattern: /\bsemimembranosus\s+bursa\b/i, namePl: 'Kaletka mięśnia półbłoniastego', nameEn: 'Semimembranosus bursa', category: 'bursa' },
  { pattern: /\bsubacromial\s+bursa\b/i, namePl: 'Kaletka podbarkowa', nameEn: 'Subacromial bursa', structureId: 'bursa_subacromialis', category: 'bursa' },
  { pattern: /\bsubcutaneous\s+acromial\s+bursa\b/i, namePl: 'Kaletka podskórna barkowa', nameEn: 'Subcutaneous acromial bursa', category: 'bursa' },
  { pattern: /\bsubcutaneous\s+bursa\s+of\s+lateral\s+malleolus\b/i, namePl: 'Kaletka podskórna kostki bocznej', nameEn: 'Subcutaneous bursa of lateral malleolus', category: 'bursa' },
  { pattern: /\bsubcutaneous\s+bursa\s+of\s+medial\s+malleolus\b/i, namePl: 'Kaletka podskórna kostki przyśrodkowej', nameEn: 'Subcutaneous bursa of medial malleolus', category: 'bursa' },
  { pattern: /\bsubcutaneous\s+bursa\s+of\s+(?:tuberosity\s+of\s+tibia|tibial\s+tuberosity)\b/i, namePl: 'Kaletka podskórna guzowatości piszczeli', nameEn: 'Subcutaneous bursa of tibial tuberosity', category: 'bursa' },
  { pattern: /\bsubcutaneous\s+calcaneal\s+bursa\b/i, namePl: 'Kaletka podskórna piętowa', nameEn: 'Subcutaneous calcaneal bursa', category: 'bursa' },
  { pattern: /\bsubcutaneous\s+infrapatellar\s+bursa\b/i, namePl: 'Kaletka podskórna podrzepkowa', nameEn: 'Subcutaneous infrapatellar bursa', category: 'bursa' },
  { pattern: /\bsubcutaneous\s+prepatellar\s+bursa\b/i, namePl: 'Kaletka przedrzepkowa podskórna', nameEn: 'Subcutaneous prepatellar bursa', structureId: 'bursa_praepatellaris', category: 'bursa' },
  { pattern: /\bsubcutaneous\s+trochanteric\s+bursa\b/i, namePl: 'Kaletka podskórna krętarzowa', nameEn: 'Subcutaneous trochanteric bursa', category: 'bursa' },
  { pattern: /\bsubdeltoid\s+bursa\b/i, namePl: 'Kaletka podnaramienna', nameEn: 'Subdeltoid bursa', structureId: 'bursa_subdeltoidea', category: 'bursa' },
  { pattern: /\bsubfa(?:s)?cial\s+prepatellar\s+bursa\b/i, namePl: 'Kaletka podpowięziowa przedrzepkowa', nameEn: 'Subfascial prepatellar bursa', category: 'bursa' },
  { pattern: /\bsubtendinous\s+bursa\s+of\s+iliacus\b/i, namePl: 'Kaletka podścięgnowa mięśnia biodrowego', nameEn: 'Subtendinous bursa of iliacus', category: 'bursa' },
  { pattern: /\bsubtendinous\s+bursa\s+of\s+infraspinatus\b/i, namePl: 'Kaletka podścięgnowa mięśnia podgrzebieniowego', nameEn: 'Subtendinous bursa of infraspinatus', category: 'bursa' },
  { pattern: /\bsubtendinous\s+bursa\s+of\s+obturator\s+internus\b/i, namePl: 'Kaletka podścięgnowa mięśnia zasłaniacza wewnętrznego', nameEn: 'Subtendinous bursa of obturator internus', category: 'bursa' },
  { pattern: /\bsubtendinous\s+bursa\s+of\s+sartorius\b/i, namePl: 'Kaletka podścięgnowa mięśnia krawieckiego', nameEn: 'Subtendinous bursa of sartorius', category: 'bursa' },
  { pattern: /\bsubtendinous\s+bursa\s+of\s+teres\s+major\b/i, namePl: 'Kaletka podścięgnowa mięśnia obłego większego', nameEn: 'Subtendinous bursa of teres major', category: 'bursa' },
  { pattern: /\bsubtendinous\s+bursa\s+of\s+tibialis\s+anterior\b/i, namePl: 'Kaletka podścięgnowa mięśnia piszczelowego przedniego', nameEn: 'Subtendinous bursa of tibialis anterior', category: 'bursa' },
  { pattern: /\bsubtendinous\s+bursa\s+of\s+trapezius\b/i, namePl: 'Kaletka podścięgnowa mięśnia czworobocznego', nameEn: 'Subtendinous bursa of trapezius', category: 'bursa' },
  { pattern: /\bsubtendinous\s+bursa\s+of\s+triceps\s+brachii\b/i, namePl: 'Kaletka podścięgnowa mięśnia trójgłowego ramienia', nameEn: 'Subtendinous bursa of triceps brachii', structureId: 'bursa_subtendinea_tricipitis', category: 'bursa' },
  { pattern: /\bsubtendinous\s+calcaneal\s+bursa\b/i, namePl: 'Kaletka podścięgnowa piętowa (ścięgna Achillesa)', nameEn: 'Subtendinous calcaneal bursa', structureId: 'bursa_calcanea', category: 'bursa' },
  { pattern: /\bsubtendinous\s+prepatellar\s+bursa\b/i, namePl: 'Kaletka podścięgnowa przedrzepkowa', nameEn: 'Subtendinous prepatellar bursa', category: 'bursa' },
  { pattern: /\bsuperior\s+bursa\s+of\s+biceps\s+femoris\b/i, namePl: 'Kaletka górna mięśnia dwugłowego uda', nameEn: 'Superior bursa of biceps femoris', category: 'bursa' },
  { pattern: /\bsuprapatellar\s+bursa\b/i, namePl: 'Kaletka nadrzepkowa', nameEn: 'Suprapatellar bursa', structureId: 'bursa_suprapatellaris', category: 'bursa' },
  { pattern: /\btrochanteric\s+bursa\s+of\s+gluteus\s+maximus\b/i, namePl: 'Kaletka krętarzowa mięśnia pośladkowego wielkiego', nameEn: 'Trochanteric bursa of gluteus maximus', structureId: 'bursa_trochanterica', category: 'bursa' },
  { pattern: /\btrochanteric\s+bursa\s+of\s+gluteus\s+medius\b/i, namePl: 'Kaletka krętarzowa mięśnia pośladkowego średniego', nameEn: 'Trochanteric bursa of gluteus medius', category: 'bursa' },
  { pattern: /\btrochanteric\s+bursa\s+of\s+gluteus\s+minimus\b/i, namePl: 'Kaletka krętarzowa mięśnia pośladkowego małego', nameEn: 'Trochanteric bursa of gluteus minimus', category: 'bursa' },
  { pattern: /\bbursae?\b/i, namePl: 'Kaletka maziowa', nameEn: 'Synovial bursa', category: 'bursa' },

  // =========================================================================
  // PRECEDENCE 2: TENDON & FIBROUS SHEATHS / TENDONS / APONEUROSES / DISCS
  // =========================================================================
  { pattern: /\bcommon\s+flexor\s+tendon\s+sheath\b/i, namePl: 'Pochewka wspólna zginaczy palców (kaletka łokciowa)', nameEn: 'Common flexor tendon sheath', structureId: 'tendon_common_flexor_sheath', category: 'tendon' },
  { pattern: /\bcommon\s+tendon\s+sheath\s+of\s+fibularis\s+muscles\b/i, namePl: 'Pochewka wspólna mięśni strzałkowych', nameEn: 'Common tendon sheath of fibularis muscles', structureId: 'tendon_fibularis_sheath', category: 'tendon' },
  { pattern: /\bcruciform\s+part\s+of\s+fibrous\s+sheath\s+of\s+digit\s+of\s+hand\b/i, namePl: 'Część krzyżowa pochewki włóknistej palca ręki', nameEn: 'Cruciform part of fibrous digital sheath (hand)', category: 'tendon' },
  { pattern: /\bintertubercular\s+tendon\s+sheath\b/i, namePl: 'Pochewka ścięgna głowy długiej bicepsa', nameEn: 'Intertubercular tendon sheath', structureId: 'tendon_intertubercular_sheath', category: 'tendon' },
  { pattern: /\bplantar\s+tendon\s+sheath\s+of\s+fibularis\s+longus\b/i, namePl: 'Pochewka podeszwowa ścięgna mięśnia strzałkowego długiego', nameEn: 'Plantar tendon sheath of fibularis longus', category: 'tendon' },
  { pattern: /\bsynovial\s+sheaths?\s+of\s+digits\s+of\s+hand\b/i, namePl: 'Pochewki maziowe palców ręki', nameEn: 'Synovial sheaths of digits of hand', category: 'tendon' },
  { pattern: /\btendon\s+sheath[\s-]+abd\b/i, namePl: 'Pochewka ścięgnista odwodziciela długiego i prostownika krótkiego kciuka', nameEn: 'Tendon sheath of abductor pollicis longus and extensor pollicis brevis', category: 'tendon' },
  { pattern: /\btendon\s+sheath\s+of\s+extensor\s+carpi\s+ulnaris\b/i, namePl: 'Pochewka ścięgna prostownika łokciowego nadgarstka', nameEn: 'Tendon sheath of extensor carpi ulnaris', category: 'tendon' },
  { pattern: /\btendon\s+sheath\s+of\s+extensor\s+digiti\s+minimi(\s+manus)?\b/i, namePl: 'Pochewka ścięgna prostownika palca małego ręki', nameEn: 'Tendon sheath of extensor digiti minimi', category: 'tendon' },
  { pattern: /\btendon\s+sheath\s+of\s+extensor\s+digitorum\s+and\s+extensor\s+indicis\b/i, namePl: 'Pochewka prostowników palców i wskaziciela', nameEn: 'Tendon sheath of extensor digitorum and extensor indicis', structureId: 'tendon_extensor_digitorum_sheath', category: 'tendon' },
  { pattern: /\btendon\s+sheath\s+of\s+extensor\s+digitorum\s+longus\b/i, namePl: 'Pochewka ścięgna prostownika długiego palców stopy', nameEn: 'Tendon sheath of extensor digitorum longus', category: 'tendon' },
  { pattern: /\btendon\s+sheath\s+of\s+extensor\s+hallucis\s+longus\b/i, namePl: 'Pochewka ścięgna prostownika długiego palucha', nameEn: 'Tendon sheath of extensor hallucis longus', category: 'tendon' },
  { pattern: /\btendon\s+sheath\s+of\s+extensor\s+pollicis\s+longus\b/i, namePl: 'Pochewka ścięgna prostownika długiego kciuka', nameEn: 'Tendon sheath of extensor pollicis longus', category: 'tendon' },
  { pattern: /\btendon\s+sheath\s+of\s+extensors\s+carpi\s+radialis\b/i, namePl: 'Pochewka ścięgien prostowników promieniowych nadgarstka', nameEn: 'Tendon sheath of extensors carpi radialis', category: 'tendon' },
  { pattern: /\btendon\s+sheath\s+of\s+flexor\s+carpi\s+radialis\b/i, namePl: 'Pochewka ścięgna zginacza promieniowego nadgarstka', nameEn: 'Tendon sheath of flexor carpi radialis', category: 'tendon' },
  { pattern: /\btendon\s+sheath\s+of\s+flexor\s+digitorum\s+longus\b/i, namePl: 'Pochewka ścięgna zginacza długiego palców stopy', nameEn: 'Tendon sheath of flexor digitorum longus', category: 'tendon' },
  { pattern: /\btendon\s+sheath\s+of\s+flexor\s+hallucis\s+longus\b/i, namePl: 'Pochewka ścięgna zginacza długiego palucha', nameEn: 'Tendon sheath of flexor hallucis longus', category: 'tendon' },
  { pattern: /\btendon\s+sheath\s+of\s+flexor\s+pollicis\s+longus\b/i, namePl: 'Pochewka ścięgna zginacza długiego kciuka', nameEn: 'Tendon sheath of flexor pollicis longus', structureId: 'tendon_fpl_sheath', category: 'tendon' },
  { pattern: /\btendon\s+sheath\s+of\s+tibialis\s+anterior\b/i, namePl: 'Pochewka ścięgna mięśnia piszczelowego przedniego', nameEn: 'Tendon sheath of tibialis anterior', structureId: 'tendon_tibialis_anterior_sheath', category: 'tendon' },
  { pattern: /\btendon\s+sheath\s+of\s+tibialis\s+posterior\b/i, namePl: 'Pochewka ścięgna mięśnia piszczelowego tylnego', nameEn: 'Tendon sheath of tibialis posterior', structureId: 'tendon_tibialis_posterior_sheath', category: 'tendon' },
  { pattern: /\b(tendon|synovial|fibrous)\s+sheath\b/i, namePl: 'Pochewka ścięgnista', nameEn: 'Tendon sheath', category: 'tendon' },
  { pattern: /\bintermediate\s+tendon\s+of\s+digastric\b|\bdigastric\s+muscle#intermediate\s+tendon\b/i, namePl: 'Ścięgno pośrednie mięśnia dwubrzuścowego', nameEn: 'Intermediate tendon of digastric muscle', category: 'tendon' },
  { pattern: /\bcommon\s+tendinous\s+ring\b/i, namePl: 'Pierścień ścięgnisty wspólny', nameEn: 'Common tendinous ring', category: 'tendon' },
  { pattern: /\btrochlea\s+of\s+superior\s+oblique\b/i, namePl: 'Bloczek mięśnia skośnego górnego oka', nameEn: 'Trochlea of superior oblique muscle', category: 'tendon' },
  { pattern: /\bepicranial\s+aponeurosis\b/i, namePl: 'Czepiec ścięgnisty', nameEn: 'Epicranial aponeurosis', structureId: 'tendon_epicranial_aponeurosis', category: 'tendon' },
  { pattern: /\blinea\s+alba\b/i, namePl: 'Kresa biała', nameEn: 'Linea alba', category: 'tendon' },
  { pattern: /\bintervertebral\s+disc\b|\bdiscus\s*intervertebralis\b|\bdiscus_intervertebralis\b/i, namePl: 'Krążek międzykręgowy', nameEn: 'Intervertebral disc', structureId: 'discus_intervertebralis', category: 'joint_ligament' },

  // --- SKIN / BODY SURFACE REGIONS (Z-Anatomy 9: Regions of human body) ---
  { pattern: /\b(frontal|parietal|temporal|occipital|mastoid|orbital|infraorbital|zygomatic|buccal|parotideomasseteric|mental|oral|nasal|auricular|eyebrow|eyelid|neck|submental|submandibular|supraclavicular|sternocleidomastoid)\s+region\b|\beyebrow\b/i, namePl: 'Powłoki głowy i szyi', nameEn: 'Skin region of head and neck', structureId: 'skin_head_neck', category: 'skin' },
  { pattern: /\b(pectoral|sternal|infraclavicular|mammary|inframmary|hypochondriac|epigastric|umbilical|pubic|inguinal|abdominal|lateral\s+abdominal)\s+region\b/i, namePl: 'Powłoki klatki piersiowej i brzucha', nameEn: 'Thoracic / abdominal skin region', structureId: 'skin_thorax_abdomen', category: 'skin' },
  { pattern: /\b(vertebral|scapular|infrascapular|interscapular|lumbar|sacral|dorsal)\s+region\b/i, namePl: 'Powłoki grzbietu i okolicy lędźwiowej', nameEn: 'Dorsal / lumbar skin region', structureId: 'skin_back_lumbar', category: 'skin' },
  { pattern: /\b(deltoid|axillary|brachial|cubital|antebrachial|carpal|palmar|thenar|hypothenar|hand|digit.*hand)\s+region\b/i, namePl: 'Powłoki kończyny górnej', nameEn: 'Upper limb skin region', structureId: 'skin_upper_limb', category: 'skin' },
  { pattern: /\b(gluteal|hip|femoral|thigh|knee|popliteal)\s+region\b/i, namePl: 'Powłoki okolicy pośladkowej i uda', nameEn: 'Gluteal / femoral skin region', structureId: 'skin_gluteal_thigh', category: 'skin' },
  { pattern: /\b(crural|leg|sural|calf|ankle|talocrural|retromalleolar|calcaneal|foot|dorsum\s+of\s+foot|sole\s+of\s+foot|toe)\s+region\b/i, namePl: 'Powłoki podudzia i stopy', nameEn: 'Crural / pedal skin region', structureId: 'skin_leg_foot', category: 'skin' },

  // =========================================================================
  // PRECEDENCE 3: CARTILAGES (Nasal, Laryngeal, Costal, Menisci — isCartilage: true)
  // =========================================================================
  { pattern: /\bmajor\s+alar\s+cartilage\b|\bcartilago\s+alaris\s+major\b/i, namePl: 'Chrząstka skrzydłowa większa', nameEn: 'Major alar cartilage', structureId: 'major_alar_cartilage', category: 'joint_ligament', isCartilage: true },
  { pattern: /\b(lateral\s+process\s+of\s+nasal\s+septal|lateral\s+nasal)\s+cartilage\b/i, namePl: 'Chrząstka boczna nosa', nameEn: 'Lateral nasal cartilage', structureId: 'lateral_nasal_cartilage', category: 'joint_ligament', isCartilage: true },
  { pattern: /\bnasal\s+septal\s+cartilage\b|\bnasal\s+cartilages\b|\bcartilago\s+septi\s+nasi\b/i, namePl: 'Chrząstka przegrody nosa', nameEn: 'Nasal septal cartilage', structureId: 'nasal_septal_cartilage', category: 'joint_ligament', isCartilage: true },
  { pattern: /\barytenoid\s+cartilage\b/i, namePl: 'Chrząstka nalewkowata', nameEn: 'Arytenoid cartilage', category: 'joint_ligament', isCartilage: true },
  { pattern: /\bcorniculate\s+cartilages?\b/i, namePl: 'Chrząstka różkowata', nameEn: 'Corniculate cartilage', category: 'joint_ligament', isCartilage: true },
  { pattern: /\bcricoid\s+cartilage\b/i, namePl: 'Chrząstka pierścieniowata', nameEn: 'Cricoid cartilage', category: 'joint_ligament', isCartilage: true },
  { pattern: /\bthyroid\s+cartilage\b/i, namePl: 'Chrząstka tarczowata', nameEn: 'Thyroid cartilage', category: 'joint_ligament', isCartilage: true },
  ...COSTAL_CARTILAGE_RULES,
  { pattern: /\bcostal\s+cartilage\b/i, namePl: 'Chrząstka żebrowa', nameEn: 'Costal cartilage', structureId: 'costae', category: 'joint_ligament', isCartilage: true },

  // =========================================================================
  // PRECEDENCE 4: EYELID TARSAL PLATES (Must precede ankle \btarsus\b!)
  // =========================================================================
  { pattern: /\binferior\s+tarsus\b/i, namePl: 'Tarczka dolna powieki', nameEn: 'Inferior tarsus (eyelid)', category: 'joint_ligament' },
  { pattern: /\bsuperior\s+tarsus\b/i, namePl: 'Tarczka górna powieki', nameEn: 'Superior tarsus (eyelid)', category: 'joint_ligament' },
  { pattern: /\btarsus\s*\(?\s*eyelids?\b/i, namePl: 'Tarczka powieki', nameEn: 'Tarsal plate (eyelid)', category: 'joint_ligament' },

  // =========================================================================
  // PRECEDENCE 5: DISCRETE VERTEBRAE (C1–C7, Th1–Th12, L1–L5, Sacrum, Coccyx)
  // =========================================================================
  { pattern: /\batlas(\s*\(c1\))?\b|\bvertebra\s+c1\b/i, namePl: 'Kręg szczytowy (C1 / Atlas)', nameEn: 'Atlas (C1 vertebra)', structureId: 'atlas_c1', category: 'bone' },
  { pattern: /\baxis(\s*\(c2\))?\b|\bvertebra\s+c2\b/i, namePl: 'Kręg obrotowy (C2 / Axis)', nameEn: 'Axis (C2 vertebra)', structureId: 'axis_c2', category: 'bone' },
  { pattern: /\bvertebra\s+c3\b|\bc3\s+vertebra\b/i, namePl: 'Kręg szyjny C3', nameEn: 'Cervical vertebra C3', structureId: 'vertebra_c3', category: 'bone' },
  { pattern: /\bvertebra\s+c4\b|\bc4\s+vertebra\b/i, namePl: 'Kręg szyjny C4', nameEn: 'Cervical vertebra C4', structureId: 'vertebra_c4', category: 'bone' },
  { pattern: /\bvertebra\s+c5\b|\bc5\s+vertebra\b/i, namePl: 'Kręg szyjny C5', nameEn: 'Cervical vertebra C5', structureId: 'vertebra_c5', category: 'bone' },
  { pattern: /\bvertebra\s+c6\b|\bc6\s+vertebra\b/i, namePl: 'Kręg szyjny C6', nameEn: 'Cervical vertebra C6', structureId: 'vertebra_c6', category: 'bone' },
  { pattern: /\bvertebra\s+c7\b|\bc7\s+vertebra\b|\bc7\b|\bvertebra\s+prominens\b/i, namePl: 'Kręg wystający (C7)', nameEn: 'Vertebra prominens (C7)', structureId: 'vertebra_c7', category: 'bone' },

  { pattern: /\bvertebra\s+(?:t|th)1\b/i, namePl: 'Kręg piersiowy Th1', nameEn: 'Thoracic vertebra T1', structureId: 'vertebra_th1', category: 'bone' },
  { pattern: /\bvertebra\s+(?:t|th)2\b/i, namePl: 'Kręg piersiowy Th2', nameEn: 'Thoracic vertebra T2', structureId: 'vertebra_th2', category: 'bone' },
  { pattern: /\bvertebra\s+(?:t|th)3\b/i, namePl: 'Kręg piersiowy Th3', nameEn: 'Thoracic vertebra T3', structureId: 'vertebra_th3', category: 'bone' },
  { pattern: /\bvertebra\s+(?:t|th)4\b/i, namePl: 'Kręg piersiowy Th4', nameEn: 'Thoracic vertebra T4', structureId: 'vertebra_th4', category: 'bone' },
  { pattern: /\bvertebra\s+(?:t|th)5\b/i, namePl: 'Kręg piersiowy Th5', nameEn: 'Thoracic vertebra T5', structureId: 'vertebra_th5', category: 'bone' },
  { pattern: /\bvertebra\s+(?:t|th)6\b/i, namePl: 'Kręg piersiowy Th6', nameEn: 'Thoracic vertebra T6', structureId: 'vertebra_th6', category: 'bone' },
  { pattern: /\bvertebra\s+(?:t|th)7\b/i, namePl: 'Kręg piersiowy Th7', nameEn: 'Thoracic vertebra T7', structureId: 'vertebra_th7', category: 'bone' },
  { pattern: /\bvertebra\s+(?:t|th)8\b/i, namePl: 'Kręg piersiowy Th8', nameEn: 'Thoracic vertebra T8', structureId: 'vertebra_th8', category: 'bone' },
  { pattern: /\bvertebra\s+(?:t|th)9\b/i, namePl: 'Kręg piersiowy Th9', nameEn: 'Thoracic vertebra T9', structureId: 'vertebra_th9', category: 'bone' },
  { pattern: /\bvertebra\s+(?:t|th)10\b/i, namePl: 'Kręg piersiowy Th10', nameEn: 'Thoracic vertebra T10', structureId: 'vertebra_th10', category: 'bone' },
  { pattern: /\bvertebra\s+(?:t|th)11\b/i, namePl: 'Kręg piersiowy Th11', nameEn: 'Thoracic vertebra T11', structureId: 'vertebra_th11', category: 'bone' },
  { pattern: /\bvertebra\s+(?:t|th)12\b/i, namePl: 'Kręg piersiowy Th12', nameEn: 'Thoracic vertebra T12', structureId: 'vertebra_th12', category: 'bone' },

  { pattern: /\bvertebra\s+l1\b/i, namePl: 'Kręg lędźwiowy L1', nameEn: 'Lumbar vertebra L1', structureId: 'vertebra_l1', category: 'bone' },
  { pattern: /\bvertebra\s+l2\b/i, namePl: 'Kręg lędźwiowy L2', nameEn: 'Lumbar vertebra L2', structureId: 'vertebra_l2', category: 'bone' },
  { pattern: /\bvertebra\s+l3\b/i, namePl: 'Kręg lędźwiowy L3', nameEn: 'Lumbar vertebra L3', structureId: 'vertebra_l3', category: 'bone' },
  { pattern: /\bvertebra\s+l4\b/i, namePl: 'Kręg lędźwiowy L4', nameEn: 'Lumbar vertebra L4', structureId: 'vertebra_l4', category: 'bone' },
  { pattern: /\bvertebra\s+l5\b/i, namePl: 'Kręg lędźwiowy L5', nameEn: 'Lumbar vertebra L5', structureId: 'vertebra_l5', category: 'bone' },

  { pattern: /\bsacrum\b|\bos\s+sacrum\b/i, namePl: 'Kość krzyżowa', nameEn: 'Sacrum', structureId: 'os_sacrum', category: 'bone' },
  { pattern: /\bcoccyx\b|\bos\s+coccygis\b/i, namePl: 'Kość guziczna', nameEn: 'Coccyx', structureId: 'os_coccygis', category: 'bone' },

  { pattern: /\bcervical\s+vertebra/i, namePl: 'Kręg szyjny', nameEn: 'Cervical vertebra', structureId: 'vertebra_c7', category: 'bone' },
  { pattern: /\bthoracic\s+vertebra/i, namePl: 'Kręg piersiowy', nameEn: 'Thoracic vertebra', structureId: 'vertebrae_thoracicae', category: 'bone' },
  { pattern: /\blumbar\s+vertebra/i, namePl: 'Kręg lędźwiowy', nameEn: 'Lumbar vertebra', structureId: 'vertebrae_lumbales', category: 'bone' },
  { pattern: /\bvertebra\b/i, namePl: 'Kręg kręgosłupa', nameEn: 'Vertebra', structureId: 'vertebrae_thoracicae', category: 'bone' },

  // =========================================================================
  // PRECEDENCE 6: SPECIFIC MULTI-WORD BONES, JOINTS & MUSCLES
  // =========================================================================
  // Shoulder & Upper Limb Bones / Joints
  { pattern: /\b(mesh\s+)?scapula\b/i, namePl: 'Łopatka', nameEn: 'Scapula', structureId: 'scapula', category: 'bone' },
  { pattern: /\bacromion\b/i, namePl: 'Wyrostek barkowy łopatki', nameEn: 'Acromion of scapula', structureId: 'acromion', category: 'bone' },
  { pattern: /\bcoracoid\b|\bprocessus\s+coracoideus\b/i, namePl: 'Wyrostek kruczy łopatki', nameEn: 'Coracoid process of scapula', structureId: 'processus_coracoideus', category: 'bone' },
  { pattern: /\bglenoid\s+labrum\b|\blabrum\s+glenoidale\b/i, namePl: 'Obrąbek stawowy łopatki', nameEn: 'Glenoid labrum', structureId: 'labrum_glenoidale', category: 'joint_ligament' },
  { pattern: /\bglenoid\b|\bcavitas\s+glenoidalis\b/i, namePl: 'Wydrążenie stawowe łopatki', nameEn: 'Glenoid cavity of scapula', structureId: 'cavitas_glenoidalis', category: 'bone' },
  { pattern: /\bfossa\s+supraspinata\b|\bsupraspinous\s+fossa\b/i, namePl: 'Dół nadgrzebieniowy łopatki', nameEn: 'Supraspinous fossa of scapula', structureId: 'fossa_supraspinata', category: 'bone' },
  { pattern: /\bfossa\s+infraspinata\b|\binfraspinous\s+fossa\b/i, namePl: 'Dół podgrzebieniowy łopatki', nameEn: 'Infraspinous fossa of scapula', structureId: 'fossa_infraspinata', category: 'bone' },
  { pattern: /\bclavicle\b|\bclavicula\b/i, namePl: 'Obojczyk', nameEn: 'Clavicle', structureId: 'clavicula', category: 'bone' },
  { pattern: /\bgreater\s+tubercle\b|\btuberculum\s+majus\b/i, namePl: 'Guzek większy kości ramiennej', nameEn: 'Greater tubercle of humerus', structureId: 'tuberculum_majus', category: 'bone' },
  { pattern: /\blesser\s+tubercle\b|\btuberculum\s+minus\b/i, namePl: 'Guzek mniejszy kości ramiennej', nameEn: 'Lesser tubercle of humerus', structureId: 'tuberculum_minus', category: 'bone' },
  { pattern: /\bintertubercular\b|\bbicipital\s+groove\b|\bsulcus\s+intertubercularis\b/i, namePl: 'Bruzda międzyguzkowa', nameEn: 'Intertubercular sulcus', structureId: 'sulcus_intertubercularis', category: 'bone' },
  { pattern: /\bcoracoacromial\b|\blig\s+coracoacromiale\b/i, namePl: 'Więzadło kruczo-barkowe', nameEn: 'Coracoacromial ligament', structureId: 'lig_coracoacromiale', category: 'joint_ligament' },
  { pattern: /\bacromioclavicular\b|\barticulatio\s+ac\b/i, namePl: 'Staw barkowo-obojczykowy', nameEn: 'Acromioclavicular joint', structureId: 'articulatio_ac', category: 'joint_ligament' },
  { pattern: /\barticulatio\s+humeri\b|\bglenohumeral\b/i, namePl: 'Staw ramienny', nameEn: 'Glenohumeral joint', structureId: 'articulatio_humeri', category: 'joint_ligament' },
  { pattern: /\b(mesh\s+)?humerus\b/i, namePl: 'Kość ramienna', nameEn: 'Humerus', structureId: 'humerus', category: 'bone' },
  { pattern: /\bolecranon\b/i, namePl: 'Wyrostek łokciowy', nameEn: 'Olecranon', structureId: 'ulna', category: 'bone' },
  { pattern: /\b(mesh\s+)?radius\b/i, namePl: 'Kość promieniowa', nameEn: 'Radius', structureId: 'radius', category: 'bone' },
  { pattern: /\b(mesh\s+)?ulna\b/i, namePl: 'Kość łokciowa', nameEn: 'Ulna', structureId: 'ulna', category: 'bone' },
  { pattern: /\bscaphoid\s+bone\b/i, namePl: 'Kość łódeczkowata', nameEn: 'Scaphoid bone', structureId: 'ossa_carpi', category: 'bone' },
  { pattern: /\blunate\s+bone\b/i, namePl: 'Kość księżycowata', nameEn: 'Lunate bone', structureId: 'ossa_carpi', category: 'bone' },
  { pattern: /\btriquetrum\s+bone\b|\btriquetral\s+bone\b/i, namePl: 'Kość trójgraniasta', nameEn: 'Triquetral bone', structureId: 'ossa_carpi', category: 'bone' },
  { pattern: /\bpisiform\s+bone\b/i, namePl: 'Kość grochowata', nameEn: 'Pisiform bone', structureId: 'ossa_carpi', category: 'bone' },
  { pattern: /\btrapezium(\s+bone|\s*\(bone)?\b/i, namePl: 'Kość czworoboczna większa', nameEn: 'Trapezium bone', structureId: 'ossa_carpi', category: 'bone' },
  { pattern: /\btrapezoid\s+bone\b/i, namePl: 'Kość czworoboczna mniejsza', nameEn: 'Trapezoid bone', structureId: 'ossa_carpi', category: 'bone' },
  { pattern: /\bcapitate\s+bone\b/i, namePl: 'Kość główkowata', nameEn: 'Capitate bone', structureId: 'ossa_carpi', category: 'bone' },
  { pattern: /\bhamate\s+bone\b/i, namePl: 'Kość haczykowata', nameEn: 'Hamate bone', structureId: 'ossa_carpi', category: 'bone' },
  { pattern: /\bcarpal\b|\bossa\s+carpi\b/i, namePl: 'Kości nadgarstka', nameEn: 'Carpal bones', structureId: 'ossa_carpi', category: 'bone' },
  ...METACARPAL_RULES,
  { pattern: /\bmetacarpal\b|\bossa\s+metacarpalia\b/i, namePl: 'Kości śródręcza', nameEn: 'Metacarpal bones', category: 'bone' },
  ...PHALANX_HAND_RULES,
  { pattern: /\bphalanx\s+manus\b|\bphalanges\s+manus\b/i, namePl: 'Paliczki ręki', nameEn: 'Phalanges of hand', category: 'bone' },

  // Knee & Lower Limb Bones / Joints
  { pattern: /\b(mesh\s+)?femur\b|\bfemoral\b/i, namePl: 'Kość udowa', nameEn: 'Femur', structureId: 'femur', category: 'bone' },
  { pattern: /\btibial\s+tuberosity\b|\btuberositas\s+tibiae\b/i, namePl: 'Guzowatość kości piszczelowej', nameEn: 'Tibial tuberosity', structureId: 'tuberositas_tibiae', category: 'bone' },
  { pattern: /\b(mesh\s+)?tibia\b/i, namePl: 'Kość piszczelowa', nameEn: 'Tibia', structureId: 'tibia', category: 'bone' },
  { pattern: /\bpatellar\s+ligament\b|\bligamentum\s+patellae\b/i, namePl: 'Więzadło rzepki', nameEn: 'Patellar ligament', structureId: 'patella', category: 'joint_ligament' },
  { pattern: /\bpatella\b/i, namePl: 'Rzepka', nameEn: 'Patella', structureId: 'patella', category: 'bone' },
  { pattern: /\bfibula\s+head\b|\bfibular\s+head\b/i, namePl: 'Głowa strzałki', nameEn: 'Head of fibula', structureId: 'fibula_head', category: 'bone' },
  { pattern: /\banterior\s+cruciate\b|\bacl\b|\bligamentum\s+cruciatum\s+anterius\b/i, namePl: 'Więzadło krzyżowe przednie (ACL)', nameEn: 'Anterior cruciate ligament (ACL)', structureId: 'acl', category: 'joint_ligament' },
  { pattern: /\bposterior\s+cruciate\b|\bpcl\b|\bligamentum\s+cruciatum\s+posterius\b/i, namePl: 'Więzadło krzyżowe tylne (PCL)', nameEn: 'Posterior cruciate ligament (PCL)', structureId: 'pcl', category: 'joint_ligament' },
  { pattern: /\bmedial\s+collateral\b|\btibial\s+collateral\b|\bmcl\b/i, namePl: 'Więzadło poboczne piszczelowe (MCL)', nameEn: 'Medial collateral ligament (MCL)', structureId: 'mcl', category: 'joint_ligament' },
  { pattern: /\blateral\s+collateral\b|\bfibular\s+collateral\b|\blcl\b/i, namePl: 'Więzadło poboczne strzałkowe (LCL)', nameEn: 'Lateral collateral ligament (LCL)', structureId: 'lcl', category: 'joint_ligament' },
  { pattern: /\bmedial\s+meniscus\b|\bmeniscus\s+medialis\b/i, namePl: 'Łąkotka przyśrodkowa', nameEn: 'Medial meniscus', structureId: 'meniscus_medialis', category: 'joint_ligament', isCartilage: true },
  { pattern: /\blateral\s+meniscus\b|\bmeniscus\s+lateralis\b/i, namePl: 'Łąkotka boczna', nameEn: 'Lateral meniscus', structureId: 'meniscus_lateralis', category: 'joint_ligament', isCartilage: true },
  { pattern: /\bnavicular\s+bone\b|\bnavicular\b/i, namePl: 'Kość łódkowata stopy', nameEn: 'Navicular bone', structureId: 'talus', category: 'bone' },
  { pattern: /\bcuboid\s+bone\b|\bcuboid\b/i, namePl: 'Kość sześcienna stopy', nameEn: 'Cuboid bone', structureId: 'calcaneus', category: 'bone' },
  { pattern: /\bmedial\s+cuneiform\s+bone\b/i, namePl: 'Kość klinowata przyśrodkowa', nameEn: 'Medial cuneiform bone', category: 'bone' },
  { pattern: /\bintermediate\s+cuneiform\s+bone\b/i, namePl: 'Kość klinowata pośrednia', nameEn: 'Intermediate cuneiform bone', category: 'bone' },
  { pattern: /\blateral\s+cuneiform\s+bone\b/i, namePl: 'Kość klinowata boczna', nameEn: 'Lateral cuneiform bone', category: 'bone' },
  { pattern: /\bcuneiform\s+bones?\b/i, namePl: 'Kości klinowate stępu', nameEn: 'Cuneiform bones', category: 'bone' },
  { pattern: /\btalus\b/i, namePl: 'Kość skokowa', nameEn: 'Talus', structureId: 'talus', category: 'bone' },
  { pattern: /\bcalcaneus\b|\bcalcaneum\b/i, namePl: 'Kość piętowa', nameEn: 'Calcaneus', structureId: 'calcaneus', category: 'bone' },
  { pattern: /\bsesamoid\s+bones?\s+of\s+foot\b|\bsesamoid\s+bone\b/i, namePl: 'Trzeszczki stopy', nameEn: 'Sesamoid bones of foot', category: 'bone' },
  ...METATARSAL_RULES,
  { pattern: /\bmetatarsal\b|\bossa\s+metatarsalia\b/i, namePl: 'Kości śródstopia', nameEn: 'Metatarsal bones', category: 'bone' },
  ...PHALANX_FOOT_RULES,
  { pattern: /\bphalanx\s+pedis\b|\bphalanges\s+pedis\b/i, namePl: 'Paliczki stopy', nameEn: 'Phalanges of foot', category: 'bone' },
  { pattern: /\bphalanx\b/i, namePl: 'Paliczek', nameEn: 'Phalanx', category: 'bone' },

  // Thorax, Pelvis & Skull Bones
  { pattern: /\bxiphoid\b/i, namePl: 'Wyrostek mieczykowaty mostka', nameEn: 'Xiphoid process', structureId: 'sternum', category: 'bone' },
  { pattern: /\bmanubrium(\s+of\s+sternum)?\b/i, namePl: 'Rękojeść mostka', nameEn: 'Manubrium of sternum', structureId: 'sternum', category: 'bone' },
  { pattern: /\bbody\s+of\s+sternum\b/i, namePl: 'Trzon mostka', nameEn: 'Body of sternum', structureId: 'sternum', category: 'bone' },
  { pattern: /\bsternum\b/i, namePl: 'Mostek', nameEn: 'Sternum', structureId: 'sternum', category: 'bone' },
  ...RIB_RULES,
  { pattern: /\brib\s+cage\b|\bribs\b|\bcostae\b/i, namePl: 'Żebra', nameEn: 'Ribs', structureId: 'costae', category: 'bone' },
  { pattern: /\b(mesh\s+)?pelvis\b|\bos\s+coxae\b|\bhip\s+bone\b/i, namePl: 'Kość miedniczna (miednica)', nameEn: 'Hip bone (Pelvis)', structureId: 'os_coxae', category: 'bone' },
  { pattern: /\bilium\b|\bos\s+ilium\b|\biliac\b/i, namePl: 'Kość biodrowa', nameEn: 'Ilium', structureId: 'os_coxae', category: 'bone' },
  { pattern: /\bischium\b|\bos\s+ischii\b|\bischial\b/i, namePl: 'Kość kulszowa', nameEn: 'Ischium', structureId: 'os_coxae', category: 'bone' },
  { pattern: /\bpubis\b|\bos\s+pubis\b|\bpubic\b/i, namePl: 'Kość łonowa', nameEn: 'Pubis', structureId: 'os_coxae', category: 'bone' },
  { pattern: /\bacetabulum\b/i, namePl: 'Panewka stawu biodrowego', nameEn: 'Acetabulum', structureId: 'acetabulum', category: 'bone' },
  { pattern: /\barticulatio\s+coxae\b|\bhip\s+joint\b/i, namePl: 'Staw biodrowy', nameEn: 'Hip joint', structureId: 'acetabulum', category: 'joint_ligament' },

  // Head & Neck Bones + Nasal Structures
  { pattern: /\bnasal\s+bone\b|\bos\s+nasale\b/i, namePl: 'Kość nosowa', nameEn: 'Nasal bone', structureId: 'nasal_bone', category: 'bone' },
  { pattern: /\binferior\s+nasal\s+concha\b|\bconcha\s+nasalis\s+inferior\b/i, namePl: 'Małżowina nosowa dolna', nameEn: 'Inferior nasal concha', structureId: 'inferior_nasal_concha', category: 'bone', isCartilage: false },
  { pattern: /\bvomer\b/i, namePl: 'Lemiesz', nameEn: 'Vomer', structureId: 'vomer', category: 'bone' },
  { pattern: /\bfrontal\s+bone\b|\bos\s+frontale\b/i, namePl: 'Kość czołowa', nameEn: 'Frontal bone', structureId: 'cranium', category: 'bone' },
  { pattern: /\bparietal\s+bone\b|\bos\s+parietale\b/i, namePl: 'Kość ciemieniowa', nameEn: 'Parietal bone', structureId: 'cranium', category: 'bone' },
  { pattern: /\boccipital\s+bone\b|\bos\s+occipitale\b/i, namePl: 'Kość potyliczna', nameEn: 'Occipital bone', structureId: 'cranium', category: 'bone' },
  { pattern: /\btemporal\s+bone\b|\bos\s+temporale\b/i, namePl: 'Kość skroniowa', nameEn: 'Temporal bone', structureId: 'cranium', category: 'bone' },
  { pattern: /\bsphenoid\s+bone\b|\bos\s+sphenoidale\b/i, namePl: 'Kość klinowa', nameEn: 'Sphenoid bone', structureId: 'cranium', category: 'bone' },
  { pattern: /\bethmoid\s+bone\b|\bos\s+ethmoidale\b/i, namePl: 'Kość sitowa', nameEn: 'Ethmoid bone', structureId: 'cranium', category: 'bone' },
  { pattern: /\blacrimal\s+bone\b/i, namePl: 'Kość łzowa', nameEn: 'Lacrimal bone', category: 'bone' },
  { pattern: /\bpalatine\s+bone\b/i, namePl: 'Kość podniebienna', nameEn: 'Palatine bone', category: 'bone' },
  { pattern: /\bmalleus\b/i, namePl: 'Młoteczek', nameEn: 'Malleus', category: 'bone' },
  { pattern: /\bincus\b/i, namePl: 'Kowadełko', nameEn: 'Incus', category: 'bone' },
  { pattern: /\bstapes\b/i, namePl: 'Strzemiączko', nameEn: 'Stapes', category: 'bone' },
  { pattern: /\bmandible\b|\bmandibula\b/i, namePl: 'Żuchwa', nameEn: 'Mandible', structureId: 'mandibula', category: 'bone' },
  { pattern: /\bmaxilla\b/i, namePl: 'Szczęka', nameEn: 'Maxilla', structureId: 'cranium', category: 'bone' },
  { pattern: /\bzygomatic\b|\bos\s+zygomaticum\b/i, namePl: 'Kość jarzmowa', nameEn: 'Zygomatic bone', structureId: 'cranium', category: 'bone' },
  { pattern: /\bhyoid\b|\bos\s+hyoideum\b/i, namePl: 'Kość gnykowa', nameEn: 'Hyoid bone', category: 'bone' },
  { pattern: /\bcranium\b|\bskull\b/i, namePl: 'Czaszka', nameEn: 'Cranium', structureId: 'cranium', category: 'bone' },

  // =========================================================================
  // PRECEDENCE 7: MUSCLES (Specific multi-word rules BEFORE shorter/generic)
  // =========================================================================
  // Shoulder & Upper Limb Muscles
  { pattern: /\bsupraspinatus\b|\bm\s+supraspinatus\b/i, namePl: 'Mięsień nadgrzebieniowy', nameEn: 'Supraspinatus muscle', structureId: 'm_supraspinatus', category: 'muscle' },
  { pattern: /\binfraspinatus\b|\bm\s+infraspinatus\b/i, namePl: 'Mięsień podgrzebieniowy', nameEn: 'Infraspinatus muscle', structureId: 'm_infraspinatus', category: 'muscle' },
  { pattern: /\bteres\s+minor\b|\bm\s+teres\s+minor\b/i, namePl: 'Mięsień obły mniejszy', nameEn: 'Teres minor muscle', structureId: 'm_teres_minor', category: 'muscle' },
  { pattern: /\bteres\s+major\b|\bm\s+teres\s+major\b/i, namePl: 'Mięsień obły większy', nameEn: 'Teres major muscle', structureId: 'm_teres_major', category: 'muscle' },
  { pattern: /\bsubscapularis\b|\bm\s+subscapularis\b/i, namePl: 'Mięsień podłopatkowy', nameEn: 'Subscapularis muscle', structureId: 'm_subscapularis', category: 'muscle' },
  { pattern: /\bdeltoid(eus)?\b|\bm\s+deltoideus\b/i, namePl: 'Mięsień naramienny', nameEn: 'Deltoid muscle', structureId: 'm_deltoideus', category: 'muscle' },
  { pattern: /\bpectoralis\s+major\b|\bm\s+pectoralis\s+major\b/i, namePl: 'Mięsień piersiowy większy', nameEn: 'Pectoralis major muscle', structureId: 'm_pectoralis_major', category: 'muscle' },
  { pattern: /\bpectoralis\s+minor\b|\bm\s+pectoralis\s+minor\b/i, namePl: 'Mięsień piersiowy mniejszy', nameEn: 'Pectoralis minor muscle', structureId: 'm_pectoralis_minor', category: 'muscle' },
  { pattern: /\bserratus\s+anterior\b|\bm\s+serratus\s+anterior\b/i, namePl: 'Mięsień zębaty przedni', nameEn: 'Serratus anterior muscle', structureId: 'm_serratus_anterior', category: 'muscle' },
  { pattern: /\bcoracobrachialis\b|\bm\s+coracobrachialis\b/i, namePl: 'Mięsień kruczo-ramienny', nameEn: 'Coracobrachialis muscle', structureId: 'm_coracobrachialis', category: 'muscle' },
  { pattern: /\bbiceps\s+brachii\b|\bm\s+biceps\s+brachii\b/i, namePl: 'Mięsień dwugłowy ramienia', nameEn: 'Biceps brachii muscle', structureId: 'm_biceps_brachii', category: 'muscle' },
  { pattern: /\btriceps\s+brachii\b|\bm\s+triceps\s+brachii\b/i, namePl: 'Mięsień trójgłowy ramienia', nameEn: 'Triceps brachii muscle', structureId: 'm_triceps_brachii', category: 'muscle' },
  { pattern: /\bbrachioradialis\b|\bm\s+brachioradialis\b/i, namePl: 'Mięsień ramienno-promieniowy', nameEn: 'Brachioradialis muscle', structureId: 'm_brachioradialis', category: 'muscle' },
  { pattern: /\bbrachialis\b|\bm\s+brachialis\b/i, namePl: 'Mięsień ramienny', nameEn: 'Brachialis muscle', structureId: 'm_brachialis', category: 'muscle' },
  { pattern: /\banconeus\b/i, namePl: 'Mięsień łokciowy', nameEn: 'Anconeus muscle', category: 'muscle' },
  { pattern: /\bpronator\s+teres\b|\bm\s+pronator\s+teres\b/i, namePl: 'Mięsień nawrotny obły', nameEn: 'Pronator teres muscle', structureId: 'm_pronator_teres', category: 'muscle' },
  { pattern: /\bpronator\s+quadratus\b/i, namePl: 'Mięsień nawrotny czworoboczny', nameEn: 'Pronator quadratus muscle', structureId: 'm_pronator_quadratus', category: 'muscle' },
  { pattern: /\bsupinator\b|\bm\s+supinator\b/i, namePl: 'Mięsień odwracacz', nameEn: 'Supinator muscle', structureId: 'm_supinator', category: 'muscle' },
  { pattern: /\bflexor\s+carpi\s+radialis\b/i, namePl: 'Mięsień zginacz promieniowy nadgarstka', nameEn: 'Flexor carpi radialis muscle', structureId: 'm_flexor_carpi_radialis', category: 'muscle' },
  { pattern: /\bflexor\s+carpi\s+ulnaris\b/i, namePl: 'Mięsień zginacz łokciowy nadgarstka', nameEn: 'Flexor carpi ulnaris muscle', structureId: 'm_flexor_carpi_ulnaris', category: 'muscle' },
  { pattern: /\bpalmaris\s+longus\b/i, namePl: 'Mięsień dłoniowy długi', nameEn: 'Palmaris longus muscle', category: 'muscle' },
  { pattern: /\bflexor\s+digitorum\s+superficialis\b/i, namePl: 'Mięsień zginacz powierzchowny palców', nameEn: 'Flexor digitorum superficialis muscle', structureId: 'm_flexor_digitorum_superficialis', category: 'muscle' },
  { pattern: /\bflexor\s+digitorum\s+profundus\b/i, namePl: 'Mięsień zginacz głęboki palców', nameEn: 'Flexor digitorum profundus muscle', structureId: 'm_flexor_digitorum_profundus', category: 'muscle' },
  { pattern: /\bflexor\s+pollicis\s+longus\b/i, namePl: 'Mięsień zginacz długi kciuka', nameEn: 'Flexor pollicis longus muscle', category: 'muscle' },
  { pattern: /\bflexor\s+pollicis\s+brevis\b/i, namePl: 'Mięsień zginacz krótki kciuka', nameEn: 'Flexor pollicis brevis muscle', category: 'muscle' },
  { pattern: /\bextensor\s+carpi\s+radialis\s+brevis\b/i, namePl: 'Mięsień prostownik promieniowy krótki nadgarstka', nameEn: 'Extensor carpi radialis brevis muscle', category: 'muscle' },
  { pattern: /\bextensor\s+carpi\s+radialis\s+longus\b/i, namePl: 'Mięsień prostownik promieniowy długi nadgarstka', nameEn: 'Extensor carpi radialis longus muscle', structureId: 'm_extensor_carpi_radialis_longus', category: 'muscle' },
  { pattern: /\bextensor\s+carpi\s+radialis\b/i, namePl: 'Mięsień prostownik promieniowy nadgarstka', nameEn: 'Extensor carpi radialis muscle', category: 'muscle' },
  { pattern: /\bextensor\s+carpi\s+ulnaris\b/i, namePl: 'Mięsień prostownik łokciowy nadgarstka', nameEn: 'Extensor carpi ulnaris muscle', structureId: 'm_extensor_carpi_ulnaris', category: 'muscle' },
  { pattern: /\bextensor\s+digitorum\s+longus\b/i, namePl: 'Mięsień prostownik długi palców stopy', nameEn: 'Extensor digitorum longus muscle', structureId: 'm_extensor_digitorum_longus', category: 'muscle' },
  { pattern: /\bextensor\s+digitorum\b/i, namePl: 'Mięsień prostownik palców', nameEn: 'Extensor digitorum muscle', structureId: 'm_extensor_digitorum', category: 'muscle' },
  { pattern: /\bextensor\s+digiti\s+minimi\b/i, namePl: 'Mięsień prostownik palca małego', nameEn: 'Extensor digiti minimi muscle', category: 'muscle' },
  { pattern: /\bextensor\s+indicis\b/i, namePl: 'Mięsień prostownik wskaziciela', nameEn: 'Extensor indicis muscle', category: 'muscle' },
  { pattern: /\babductor\s+pollicis\s+longus\b/i, namePl: 'Mięsień odwodziciel długi kciuka', nameEn: 'Abductor pollicis longus muscle', category: 'muscle' },
  { pattern: /\babductor\s+pollicis\s+brevis\b/i, namePl: 'Mięsień odwodziciel krótki kciuka', nameEn: 'Abductor pollicis brevis muscle', category: 'muscle' },
  { pattern: /\bextensor\s+pollicis\s+brevis\b/i, namePl: 'Mięsień prostownik krótki kciuka', nameEn: 'Extensor pollicis brevis muscle', category: 'muscle' },
  { pattern: /\bextensor\s+pollicis\s+longus\b/i, namePl: 'Mięsień prostownik długi kciuka', nameEn: 'Extensor pollicis longus muscle', category: 'muscle' },
  { pattern: /\bopponens\s+pollicis\b/i, namePl: 'Mięsień przeciwstawiacz kciuka', nameEn: 'Opponens pollicis muscle', category: 'muscle' },
  { pattern: /\badductor\s+pollicis\b/i, namePl: 'Mięsień przywodziciel kciuka', nameEn: 'Adductor pollicis muscle', category: 'muscle' },
  { pattern: /\babductor\s+digiti\s+minimi(\s+muscle)?\s+of\s+hand\b/i, namePl: 'Mięsień odwodziciel palca małego ręki', nameEn: 'Abductor digiti minimi (hand)', category: 'muscle' },
  { pattern: /\bflexor\s+digiti\s+minimi\s+(?:brevis\s+muscle\s*\(?\s*)?(?:of\s+)?hand\b/i, namePl: 'Mięsień zginacz krótki palca małego ręki', nameEn: 'Flexor digiti minimi brevis (hand)', category: 'muscle' },
  { pattern: /\bopponens\s+digiti\s+minimi(\s+muscle)?\s+of\s+hand\b/i, namePl: 'Mięsień przeciwstawiacz palca małego ręki', nameEn: 'Opponens digiti minimi (hand)', category: 'muscle' },
  { pattern: /\blumbricals?(\s+muscles)?\s+of(\s+the)?\s+hand\b/i, namePl: 'Mięśnie glistowate ręki', nameEn: 'Lumbrical muscles of hand', category: 'muscle' },
  { pattern: /\bpalmar\s+interossei\s+muscles\b/i, namePl: 'Mięśnie międzykostne dłoniowe', nameEn: 'Palmar interossei muscles', category: 'muscle' },
  { pattern: /\bdorsal\s+interossei(\s+muscles)?\s+of(\s+the)?\s+hand\b/i, namePl: 'Mięśnie międzykostne grzbietowe ręki', nameEn: 'Dorsal interossei of hand', category: 'muscle' },

  // Knee, Pelvis & Lower Limb Muscles
  { pattern: /\b(quadriceps|rectus\s+femoris|vastus\s+lateralis|vastus\s+medialis|vastus\s+intermedius)\b/i, namePl: 'Mięsień czworogłowy uda', nameEn: 'Quadriceps femoris muscle', structureId: 'm_quadriceps_femoris', category: 'muscle' },
  { pattern: /\bbiceps\s+femoris\b|\bm\s+biceps\s+femoris\b/i, namePl: 'Mięsień dwugłowy uda', nameEn: 'Biceps femoris muscle', structureId: 'm_biceps_femoris', category: 'muscle' },
  { pattern: /\bsemitendinosus\b|\bm\s+semitendinosus\b/i, namePl: 'Mięsień półścięgnisty', nameEn: 'Semitendinosus muscle', structureId: 'm_semitendinosus', category: 'muscle' },
  { pattern: /\bsemimembranosus\b|\bm\s+semimembranosus\b/i, namePl: 'Mięsień półbłoniasty', nameEn: 'Semimembranosus muscle', structureId: 'm_semimembranosus', category: 'muscle' },
  { pattern: /\bpopliteus\b|\bm\s+popliteus\b/i, namePl: 'Mięsień podkolanowy', nameEn: 'Popliteus muscle', structureId: 'm_popliteus', category: 'muscle' },
  { pattern: /\bpes\s+anserinus\b/i, namePl: 'Gęsia stopka powierzchowna', nameEn: 'Pes anserinus superficialis', structureId: 'pes_anserinus', category: 'muscle' },
  { pattern: /\bgluteus\s+maximus\b|\bm\s+gluteus\s+maximus\b/i, namePl: 'Mięsień pośladkowy wielki', nameEn: 'Gluteus maximus muscle', structureId: 'm_gluteus_maximus', category: 'muscle' },
  { pattern: /\bgluteus\s+medius\b|\bm\s+gluteus\s+medius\b/i, namePl: 'Mięsień pośladkowy średni', nameEn: 'Gluteus medius muscle', structureId: 'm_gluteus_medius', category: 'muscle' },
  { pattern: /\bgluteus\s+minimus\b|\bm\s+gluteus\s+minimus\b/i, namePl: 'Mięsień pośladkowy mały', nameEn: 'Gluteus minimus muscle', structureId: 'm_gluteus_minimus', category: 'muscle' },
  { pattern: /\bpiriformis\b|\bm\s+piriformis\b/i, namePl: 'Mięsień gruszkowaty', nameEn: 'Piriformis muscle', structureId: 'm_piriformis', category: 'muscle' },
  { pattern: /\bobturator\s+internus\b|\binternal\s+obturator\b/i, namePl: 'Mięsień zasłaniacz wewnętrzny', nameEn: 'Obturator internus muscle', structureId: 'm_obturator_internus', category: 'muscle' },
  { pattern: /\bobturator\s+externus\b|\bexternal\s+obturator\b/i, namePl: 'Mięsień zasłaniacz zewnętrzny', nameEn: 'Obturator externus muscle', category: 'muscle' },
  { pattern: /\bsuperior\s+gemellus\b/i, namePl: 'Mięsień bliźniaczy górny', nameEn: 'Superior gemellus muscle', category: 'muscle' },
  { pattern: /\binferior\s+gemellus\b/i, namePl: 'Mięsień bliźniaczy dolny', nameEn: 'Inferior gemellus muscle', category: 'muscle' },
  { pattern: /\bgemelli\s+muscles\b/i, namePl: 'Mięśnie bliźniacze', nameEn: 'Gemelli muscles', category: 'muscle' },
  { pattern: /\bquadratus\s+femoris\b/i, namePl: 'Mięsień czworoboczny uda', nameEn: 'Quadratus femoris muscle', structureId: 'm_quadratus_femoris', category: 'muscle' },
  { pattern: /\bpectineus\b/i, namePl: 'Mięsień grzebieniowy', nameEn: 'Pectineus muscle', structureId: 'm_pectineus', category: 'muscle' },
  { pattern: /\biliacus\b|\biliopsoas\b|\bpsoas\s+major\b|\bpsoas\b|\bm\s+iliopsoas\b/i, namePl: 'Mięsień biodrowo-lędźwiowy', nameEn: 'Iliopsoas muscle', structureId: 'm_iliopsoas', category: 'muscle' },
  { pattern: /\btensor\s+fasciae\s+latae\b|\btfl\b|\bm\s+tensor\s+fasciae\s+latae\b/i, namePl: 'Mięsień naprężacz powięzi szerokiej', nameEn: 'Tensor fasciae latae muscle', structureId: 'm_tensor_fasciae_latae', category: 'muscle' },
  { pattern: /\bquadratus\s+lumborum\b|\bm\s+quadratus\s+lumborum\b/i, namePl: 'Mięsień czworoboczny lędźwi', nameEn: 'Quadratus lumborum muscle', structureId: 'm_quadratus_lumborum', category: 'muscle' },
  { pattern: /\badductor\s+magnus\b|\bm\s+adductor\s+magnus\b/i, namePl: 'Mięsień przywodziciel wielki', nameEn: 'Adductor magnus muscle', structureId: 'm_adductor_magnus', category: 'muscle' },
  { pattern: /\badductor\s+longus\b|\bm\s+adductor\s+longus\b/i, namePl: 'Mięsień przywodziciel długi', nameEn: 'Adductor longus muscle', structureId: 'm_adductor_longus', category: 'muscle' },
  { pattern: /\badductor\s+brevis\b|\bm\s+adductor\s+brevis\b/i, namePl: 'Mięsień przywodziciel krótki', nameEn: 'Adductor brevis muscle', structureId: 'm_adductor_brevis', category: 'muscle' },
  { pattern: /\badductor\s+hallucis\b/i, namePl: 'Mięsień przywodziciel palucha', nameEn: 'Adductor hallucis muscle', category: 'muscle' },
  { pattern: /\bgracilis\b|\bm\s+gracilis\b/i, namePl: 'Mięsień smukły', nameEn: 'Gracilis muscle', structureId: 'm_gracilis', category: 'muscle' },
  { pattern: /\bsartorius\b|\bm\s+sartorius\b/i, namePl: 'Mięsień krawiecki', nameEn: 'Sartorius muscle', structureId: 'm_sartorius', category: 'muscle' },
  { pattern: /\bgastrocnemius\b|\bm\s+gastrocnemius\b/i, namePl: 'Mięsień brzuchaty łydki', nameEn: 'Gastrocnemius muscle', structureId: 'm_gastrocnemius', category: 'muscle' },
  { pattern: /\bsoleus\b|\bm\s+soleus\b/i, namePl: 'Mięsień płaszczkowaty', nameEn: 'Soleus muscle', structureId: 'm_soleus', category: 'muscle' },
  { pattern: /\bplantaris\b/i, namePl: 'Mięsień podeszwowy', nameEn: 'Plantaris muscle', category: 'muscle' },
  { pattern: /\bachilles\b|\btendo\s+calcaneus\b|\bcalcaneal\s+tendon\b/i, namePl: 'Ścięgno Achillesa (piętowe)', nameEn: 'Achilles tendon (Calcaneal tendon)', structureId: 'achilles_tendon', category: 'joint_ligament' },
  { pattern: /\btibialis\s+anterior\b|\bm\s+tibialis\s+anterior\b/i, namePl: 'Mięsień piszczelowy przedni', nameEn: 'Tibialis anterior muscle', structureId: 'm_tibialis_anterior', category: 'muscle' },
  { pattern: /\btibialis\s+posterior\b|\bm\s+tibialis\s+posterior\b/i, namePl: 'Mięsień piszczelowy tylny', nameEn: 'Tibialis posterior muscle', structureId: 'm_tibialis_posterior', category: 'muscle' },
  { pattern: /\b(peroneus|fibularis)\s+longus\b/i, namePl: 'Mięsień strzałkowy długi', nameEn: 'Fibularis longus muscle (Peroneus longus)', structureId: 'm_peroneus_longus', category: 'muscle' },
  { pattern: /\b(peroneus|fibularis)\s+brevis\b/i, namePl: 'Mięsień strzałkowy krótki', nameEn: 'Fibularis brevis muscle (Peroneus brevis)', structureId: 'm_fibularis_brevis', category: 'muscle' },
  { pattern: /\b(peroneus|fibularis)\s+tertius\b/i, namePl: 'Mięsień strzałkowy trzeci', nameEn: 'Fibularis tertius muscle', category: 'muscle' },
  { pattern: /\bextensor\s+hallucis\s+longus\b/i, namePl: 'Mięsień prostownik długi palucha', nameEn: 'Extensor hallucis longus muscle', structureId: 'm_extensor_hallucis_longus', category: 'muscle' },
  { pattern: /\bflexor\s+digitorum\s+longus\b/i, namePl: 'Mięsień zginacz długi palców stopy', nameEn: 'Flexor digitorum longus muscle', category: 'muscle' },
  { pattern: /\bflexor\s+hallucis\s+longus\b/i, namePl: 'Mięsień zginacz długi palucha', nameEn: 'Flexor hallucis longus muscle', structureId: 'm_flexor_hallucis_longus', category: 'muscle' },
  { pattern: /\bflexor\s+hallucis\s+brevis\b/i, namePl: 'Mięsień zginacz krótki palucha', nameEn: 'Flexor hallucis brevis muscle', category: 'muscle' },

  // Back, Neck & Thorax / Abdomen Muscles
  { pattern: /\btrapezius\b|\bm\s+trapezius\b/i, namePl: 'Mięsień czworoboczny', nameEn: 'Trapezius muscle', structureId: 'm_trapezius', category: 'muscle' },
  { pattern: /\blatissimus\s+dorsi\b|\bm\s+latissimus\s+dorsi\b/i, namePl: 'Mięsień najszerszy grzbietu', nameEn: 'Latissimus dorsi muscle', structureId: 'm_latissimus_dorsi', category: 'muscle' },
  { pattern: /\brhomboid\s+major\b/i, namePl: 'Mięsień równoległoboczny większy', nameEn: 'Rhomboid major muscle', structureId: 'm_rhomboideus_major', category: 'muscle' },
  { pattern: /\brhomboid\s+minor\b/i, namePl: 'Mięsień równoległoboczny mniejszy', nameEn: 'Rhomboid minor muscle', structureId: 'm_rhomboideus_minor', category: 'muscle' },
  { pattern: /\brhomboid\b/i, namePl: 'Mięsień równoległoboczny', nameEn: 'Rhomboid muscle', category: 'muscle' },
  { pattern: /\blevator\s+scapulae\b/i, namePl: 'Mięsień dźwigacz łopatki', nameEn: 'Levator scapulae muscle', structureId: 'm_levator_scapulae', category: 'muscle' },
  { pattern: /\bsubclavius\b/i, namePl: 'Mięsień podobojczykowy', nameEn: 'Subclavius muscle', category: 'muscle' },
  { pattern: /\bserratus\s+posterior\s+superior\b/i, namePl: 'Mięsień zębaty tylny górny', nameEn: 'Serratus posterior superior muscle', category: 'muscle' },
  { pattern: /\bserratus\s+posterior\s+inferior\b/i, namePl: 'Mięsień zębaty tylny dolny', nameEn: 'Serratus posterior inferior muscle', category: 'muscle' },
  { pattern: /\biliocostalis\s+(colli|cervicis)\b/i, namePl: 'Mięsień biodrowo-żebrowy szyi', nameEn: 'Iliocostalis cervicis muscle', structureId: 'm_erector_spinae', category: 'muscle' },
  { pattern: /\biliocostalis\s+thoracis\b/i, namePl: 'Mięsień biodrowo-żebrowy klatki piersiowej', nameEn: 'Iliocostalis thoracis muscle', structureId: 'm_erector_spinae', category: 'muscle' },
  { pattern: /\biliocostalis\s+lumborum\b/i, namePl: 'Mięsień biodrowo-żebrowy lędźwi', nameEn: 'Iliocostalis lumborum muscle', structureId: 'm_erector_spinae', category: 'muscle' },
  { pattern: /\blongissimus\s+capitis\b/i, namePl: 'Mięsień najdłuższy głowy', nameEn: 'Longissimus capitis muscle', structureId: 'm_erector_spinae', category: 'muscle' },
  { pattern: /\blongissimus\s+(colli|cervicis)\b/i, namePl: 'Mięsień najdłuższy szyi', nameEn: 'Longissimus cervicis muscle', structureId: 'm_erector_spinae', category: 'muscle' },
  { pattern: /\blongissimus\s+thoracis\b/i, namePl: 'Mięsień najdłuższy klatki piersiowej', nameEn: 'Longissimus thoracis muscle', structureId: 'm_erector_spinae', category: 'muscle' },
  { pattern: /\bspinalis\s+capitis\b/i, namePl: 'Mięsień kolcowy głowy', nameEn: 'Spinalis capitis muscle', structureId: 'm_erector_spinae', category: 'muscle' },
  { pattern: /\bspinalis\s+(colli|cervicis)\b/i, namePl: 'Mięsień kolcowy szyi', nameEn: 'Spinalis cervicis muscle', structureId: 'm_erector_spinae', category: 'muscle' },
  { pattern: /\bspinalis\s+thoracis\b/i, namePl: 'Mięsień kolcowy klatki piersiowej', nameEn: 'Spinalis thoracis muscle', structureId: 'm_erector_spinae', category: 'muscle' },
  { pattern: /\biliocostalis\b/i, namePl: 'Mięsień biodrowo-żebrowy', nameEn: 'Iliocostalis muscle', structureId: 'm_erector_spinae', category: 'muscle' },
  { pattern: /\blongissimus\b/i, namePl: 'Mięsień najdłuższy', nameEn: 'Longissimus muscle', structureId: 'm_erector_spinae', category: 'muscle' },
  { pattern: /\bspinalis\b/i, namePl: 'Mięsień kolcowy', nameEn: 'Spinalis muscle', structureId: 'm_erector_spinae', category: 'muscle' },
  { pattern: /\berector\s+spinae\b|\bm\s+erector\s+spinae\b/i, namePl: 'Mięsień prostownik grzbietu', nameEn: 'Erector spinae muscle', structureId: 'm_erector_spinae', category: 'muscle' },
  { pattern: /\bsemispinalis\s+(colli|cervicis)\b/i, namePl: 'Mięsień półkolcowy szyi', nameEn: 'Semispinalis cervicis muscle', category: 'muscle' },
  { pattern: /\bsemispinalis\s+thoracis\b/i, namePl: 'Mięsień półkolcowy klatki piersiowej', nameEn: 'Semispinalis thoracis muscle', category: 'muscle' },
  { pattern: /\bsemispinalis\b/i, namePl: 'Mięsień półkolcowy', nameEn: 'Semispinalis muscle', category: 'muscle' },
  { pattern: /\bmultifidus\s+(colli|cervicis)\b/i, namePl: 'Mięsień wielodzielny szyi', nameEn: 'Multifidus cervicis muscle', category: 'muscle' },
  { pattern: /\bmultifidus\s+thoracis\b/i, namePl: 'Mięsień wielodzielny klatki piersiowej', nameEn: 'Multifidus thoracis muscle', category: 'muscle' },
  { pattern: /\bmultifidus\s+lumborum\b/i, namePl: 'Mięsień wielodzielny lędźwi', nameEn: 'Multifidus lumborum muscle', category: 'muscle' },
  { pattern: /\bmultifidus\b/i, namePl: 'Mięsień wielodzielny', nameEn: 'Multifidus muscle', category: 'muscle' },
  { pattern: /\brotatores\b/i, namePl: 'Mięśnie skręcające', nameEn: 'Rotatores muscles', category: 'muscle' },
  { pattern: /\binterspinales\s+(colli|cervicis)\b/i, namePl: 'Mięśnie międzykolcowe szyi', nameEn: 'Interspinales cervicis muscles', category: 'muscle' },
  { pattern: /\binterspinales\s+thoracis\b/i, namePl: 'Mięśnie międzykolcowe klatki piersiowej', nameEn: 'Interspinales thoracis muscles', category: 'muscle' },
  { pattern: /\binterspinales\s+lumborum\b/i, namePl: 'Mięśnie międzykolcowe lędźwi', nameEn: 'Interspinales lumborum muscles', category: 'muscle' },
  { pattern: /\binterspinales\b/i, namePl: 'Mięśnie międzykolcowe', nameEn: 'Interspinales muscles', category: 'muscle' },
  { pattern: /\bdorsal\s+parts\s+of\s+lateral\s+intertransversarii\s+lumborum\b/i, namePl: 'Mięśnie międzypoprzeczne boczne lędźwi (część grzbietowa)', nameEn: 'Lateral lumbar intertransversarii (dorsal parts)', category: 'muscle' },
  { pattern: /\bventral\s+parts\s+of\s+lateral\s+intertransversarii\s+lumborum\b/i, namePl: 'Mięśnie międzypoprzeczne boczne lędźwi (część brzuszna)', nameEn: 'Lateral lumbar intertransversarii (ventral parts)', category: 'muscle' },
  { pattern: /\blevatores\s+breves\s+costarum\b/i, namePl: 'Mięśnie dźwigacze krótkie żeber', nameEn: 'Levatores costarum breves muscles', category: 'muscle' },
  { pattern: /\blevatores\s+longi\s+costarum\b/i, namePl: 'Mięśnie dźwigacze długie żeber', nameEn: 'Levatores costarum longi muscles', category: 'muscle' },
  { pattern: /\blevatores\s+costarum\b/i, namePl: 'Mięśnie dźwigacze żeber', nameEn: 'Levatores costarum muscles', category: 'muscle' },
  { pattern: /\bexternal\s+intercostal\b/i, namePl: 'Mięśnie międzyżebrowe zewnętrzne', nameEn: 'External intercostal muscles', category: 'muscle' },
  { pattern: /\binternal\s+intercostal\b/i, namePl: 'Mięśnie międzyżebrowe wewnętrzne', nameEn: 'Internal intercostal muscles', category: 'muscle' },
  { pattern: /\binnermost\s+intercostal\b/i, namePl: 'Mięśnie międzyżebrowe najgłębsze', nameEn: 'Innermost intercostal muscles', category: 'muscle' },
  { pattern: /\bintercostal\b/i, namePl: 'Mięśnie międzyżebrowe', nameEn: 'Intercostal muscles', category: 'muscle' },
  { pattern: /\btransversus\s+thoracis\b/i, namePl: 'Mięsień poprzeczny klatki piersiowej', nameEn: 'Transversus thoracis muscle', category: 'muscle' },
  { pattern: /\bdiaphragm\b/i, namePl: 'Przepona', nameEn: 'Thoracic diaphragm', structureId: 'm_diaphragma', category: 'muscle' },
  { pattern: /\brectus\s+abdominis\b/i, namePl: 'Mięsień prosty brzucha', nameEn: 'Rectus abdominis muscle', structureId: 'm_rectus_abdominis', category: 'muscle' },
  { pattern: /\bexternal\s+abdominal\s+oblique\b|\babdominal\s+external\s+oblique\b/i, namePl: 'Mięsień skośny zewnętrzny brzucha', nameEn: 'External abdominal oblique muscle', structureId: 'm_obliquus_externus_abdominis', category: 'muscle' },
  { pattern: /\binternal\s+abdominal\s+oblique\b|\babdominal\s+internal\s+oblique\b/i, namePl: 'Mięsień skośny wewnętrzny brzucha', nameEn: 'Internal abdominal oblique muscle', structureId: 'm_obliquus_internus_abdominis', category: 'muscle' },
  { pattern: /\btransversus\s+abdominis\b|\btransverse\s+abdominal\b/i, namePl: 'Mięsień poprzeczny brzucha', nameEn: 'Transversus abdominis muscle', structureId: 'm_transversus_abdominis', category: 'muscle' },
  { pattern: /\bpyramidalis\b/i, namePl: 'Mięsień piramidowy', nameEn: 'Pyramidalis muscle', category: 'muscle' },

  // Head & Neck Muscles (Nasal, Facial, Eye, Tongue, Supra/Infrahyoid, Pharyngeal, Laryngeal, Suboccipital)
  { pattern: /\bnasalis(\s+muscle)?\b|\bm\s+nasalis\b/i, namePl: 'Mięsień nosowy', nameEn: 'Nasalis muscle', structureId: 'm_nasalis', category: 'muscle' },
  { pattern: /\bdepressor\s+septi(\s+nasi)?\b|\bm\s+depressor\s+septi\s+nasi\b/i, namePl: 'Mięsień obniżacz przegrody nosa', nameEn: 'Depressor septi nasi muscle', structureId: 'm_depressor_septi_nasi', category: 'muscle' },
  { pattern: /\bprocerus(\s+muscle)?\b|\bm\s+procerus\b/i, namePl: 'Mięsień podłużny', nameEn: 'Procerus muscle', structureId: 'm_procerus', category: 'muscle' },
  { pattern: /\b(levator\s+nasolabialis|levator\s+labii\s+superioris\s+alaeque\s+nasi)\b/i, namePl: 'Mięsień dźwigacz wargi górnej i skrzydła nosa', nameEn: 'Levator labii superioris alaeque nasi muscle', structureId: 'm_levator_labii_superioris_alaeque_nasi', category: 'muscle' },
  { pattern: /\blevator\s+labii\s+superioris\b/i, namePl: 'Mięsień dźwigacz wargi górnej', nameEn: 'Levator labii superioris muscle', category: 'muscle' },
  { pattern: /\blevator\s+anguli\s+oris\b/i, namePl: 'Mięsień dźwigacz kąta ust', nameEn: 'Levator anguli oris muscle', category: 'muscle' },
  { pattern: /\bdepressor\s+anguli\s+oris\b/i, namePl: 'Mięsień obniżacz kąta ust', nameEn: 'Depressor anguli oris muscle', category: 'muscle' },
  { pattern: /\bdepressor\s+labii\s+inferioris\b/i, namePl: 'Mięsień obniżacz wargi dolnej', nameEn: 'Depressor labii inferioris muscle', category: 'muscle' },
  { pattern: /\bzygomaticus\s+major\b/i, namePl: 'Mięsień jarzmowy większy', nameEn: 'Zygomaticus major muscle', category: 'muscle' },
  { pattern: /\bzygomaticus\s+minor\b/i, namePl: 'Mięsień jarzmowy mniejszy', nameEn: 'Zygomaticus minor muscle', category: 'muscle' },
  { pattern: /\borbicularis\s+oris\b/i, namePl: 'Mięsień okrężny ust', nameEn: 'Orbicularis oris muscle', category: 'muscle' },
  { pattern: /\bbuc{1,2}inator\b/i, namePl: 'Mięsień policzkowy', nameEn: 'Buccinator muscle', category: 'muscle' },
  { pattern: /\bmentalis\b/i, namePl: 'Mięsień bródkowy', nameEn: 'Mentalis muscle', category: 'muscle' },
  { pattern: /\brisorius\b/i, namePl: 'Mięsień śmiechowy', nameEn: 'Risorius muscle', category: 'muscle' },
  { pattern: /\borbital\s+part\s+of\s+orbicularis\s+oculi\b/i, namePl: 'Mięsień okrężny oka (część oczodołowa)', nameEn: 'Orbicularis oculi (orbital part)', category: 'muscle' },
  { pattern: /\bpalpebral\s+part\s+of\s+orbicularis\s+oculi\b/i, namePl: 'Mięsień okrężny oka (część powiekowa)', nameEn: 'Orbicularis oculi (palpebral part)', category: 'muscle' },
  { pattern: /\borbicularis\s+oculi\b/i, namePl: 'Mięsień okrężny oka', nameEn: 'Orbicularis oculi muscle', category: 'muscle' },
  { pattern: /\bcorrugator\s+supercilii\b/i, namePl: 'Mięsień marszczący brwi', nameEn: 'Corrugator supercilii muscle', category: 'muscle' },
  { pattern: /\blevator\s+palpebrae\s+superioris\b/i, namePl: 'Mięsień dźwigacz powieki górnej', nameEn: 'Levator palpebrae superioris muscle', category: 'muscle' },
  { pattern: /\bsuperior\s+rectus\b/i, namePl: 'Mięsień prosty górny oka', nameEn: 'Superior rectus muscle', category: 'muscle' },
  { pattern: /\binferior\s+rectus\b/i, namePl: 'Mięsień prosty dolny oka', nameEn: 'Inferior rectus muscle', category: 'muscle' },
  { pattern: /\bmedial\s+rectus\b/i, namePl: 'Mięsień prosty przyśrodkowy oka', nameEn: 'Medial rectus muscle', category: 'muscle' },
  { pattern: /\blateral\s+rectus\b/i, namePl: 'Mięsień prosty boczny oka', nameEn: 'Lateral rectus muscle', category: 'muscle' },
  { pattern: /\bsuperior\s+oblique\b/i, namePl: 'Mięsień skośny górny oka', nameEn: 'Superior oblique muscle', category: 'muscle' },
  { pattern: /\binferior\s+oblique\b/i, namePl: 'Mięsień skośny dolny oka', nameEn: 'Inferior oblique muscle', category: 'muscle' },
  { pattern: /\bfrontalis\b/i, namePl: 'Mięsień czołowy (brzusiec czołowy)', nameEn: 'Frontalis muscle', category: 'muscle' },
  { pattern: /\boccipitalis\b/i, namePl: 'Mięsień potyliczny (brzusiec potyliczny)', nameEn: 'Occipitalis muscle', category: 'muscle' },
  { pattern: /\btemporoparietalis\b/i, namePl: 'Mięsień skroniowo-ciemieniowy', nameEn: 'Temporoparietalis muscle', category: 'muscle' },
  { pattern: /\bmasseter\b|\bm\s+masseter\b/i, namePl: 'Mięsień żwacz', nameEn: 'Masseter muscle', structureId: 'm_masseter', category: 'muscle' },
  { pattern: /\btemporalis\b|\bm\s+temporalis\b/i, namePl: 'Mięsień skroniowy', nameEn: 'Temporalis muscle', structureId: 'm_temporalis', category: 'muscle' },
  { pattern: /\bmedial\s+pterygoid\b/i, namePl: 'Mięsień skrzydłowy przyśrodkowy', nameEn: 'Medial pterygoid muscle', category: 'muscle' },
  { pattern: /\bsuperior\s+head\s+of\s+lateral\s+pterygoid\b/i, namePl: 'Mięsień skrzydłowy boczny (głowa górna)', nameEn: 'Lateral pterygoid muscle (superior head)', category: 'muscle' },
  { pattern: /\binferior\s+head\s+of\s+lateral\s+pterygoid\b/i, namePl: 'Mięsień skrzydłowy boczny (głowa dolna)', nameEn: 'Lateral pterygoid muscle (inferior head)', category: 'muscle' },
  { pattern: /\blateral\s+pterygoid\b|\bpterygoideus\b|\bm\s+pterygoideus\b/i, namePl: 'Mięsień skrzydłowy', nameEn: 'Pterygoid muscle', category: 'muscle' },
  { pattern: /\bplatysma\b/i, namePl: 'Mięsień szeroki szyi (Platysma)', nameEn: 'Platysma muscle', category: 'muscle' },
  { pattern: /\bsternocleidomastoid\b|\bscm\b|\bm\s+sternocleidomastoideus\b/i, namePl: 'Mięsień mostkowo-obojczykowo-sutkowy (MOS)', nameEn: 'Sternocleidomastoid muscle (SCM)', structureId: 'm_sternocleidomastoideus', category: 'muscle' },
  { pattern: /\bscalenus\s+anterior\b/i, namePl: 'Mięsień pochyły przedni', nameEn: 'Anterior scalene muscle', structureId: 'm_scaleni', category: 'muscle' },
  { pattern: /\bscalenus\s+medius\b/i, namePl: 'Mięsień pochyły środkowy', nameEn: 'Middle scalene muscle', structureId: 'm_scaleni', category: 'muscle' },
  { pattern: /\bscalenus\s+posterior\b/i, namePl: 'Mięsień pochyły tylny', nameEn: 'Posterior scalene muscle', structureId: 'm_scaleni', category: 'muscle' },
  { pattern: /\bscalene\b|\bscaleni\b|\bm\s+scaleni\b/i, namePl: 'Mięśnie pochyłe szyi', nameEn: 'Scalene muscles', structureId: 'm_scaleni', category: 'muscle' },
  { pattern: /\blongus\s+capitis\b/i, namePl: 'Mięsień długi głowy', nameEn: 'Longus capitis muscle', category: 'muscle' },
  { pattern: /\blongus\s+colli\b/i, namePl: 'Mięsień długi szyi', nameEn: 'Longus colli muscle', structureId: 'm_longus_colli', category: 'muscle' },
  { pattern: /\brectus\s+anterior\s+capitis\b/i, namePl: 'Mięsień prosty przedni głowy', nameEn: 'Rectus capitis anterior muscle', category: 'muscle' },
  { pattern: /\brectus\s+lateralis\s+capitis\b/i, namePl: 'Mięsień prosty boczny głowy', nameEn: 'Rectus capitis lateralis muscle', category: 'muscle' },
  { pattern: /\brectus\s+(?:posterior\s+major\s+capitis|capitis\s+posterior\s+major)\b/i, namePl: 'Mięsień prosty tylny większy głowy', nameEn: 'Rectus capitis posterior major muscle', category: 'muscle' },
  { pattern: /\brectus\s+(?:posterior\s+minor\s+capitis|capitis\s+posterior\s+minor)\b/i, namePl: 'Mięsień prosty tylny mniejszy głowy', nameEn: 'Rectus capitis posterior minor muscle', category: 'muscle' },
  { pattern: /\bobliquus\s+(?:inferior\s+capitis|capitis\s+inferior)\b/i, namePl: 'Mięsień skośny dolny głowy', nameEn: 'Obliquus capitis inferior muscle', category: 'muscle' },
  { pattern: /\bobliquus\s+(?:superior\s+capitis|capitis\s+superior)\b/i, namePl: 'Mięsień skośny górny głowy', nameEn: 'Obliquus capitis superior muscle', category: 'muscle' },
  { pattern: /\bsplenius\s+capitis\b/i, namePl: 'Mięsień płatowaty głowy', nameEn: 'Splenius capitis muscle', structureId: 'm_splenius_capitis', category: 'muscle' },
  { pattern: /\bsplenius\s+(colli|cervicis)\b/i, namePl: 'Mięsień płatowaty szyi', nameEn: 'Splenius cervicis muscle', category: 'muscle' },
  { pattern: /\bgenioglossus\b/i, namePl: 'Mięsień bródkowo-językowy', nameEn: 'Genioglossus muscle', category: 'muscle' },
  { pattern: /\bhyoglossus\b/i, namePl: 'Mięsień gnykowo-językowy', nameEn: 'Hyoglossus muscle', category: 'muscle' },
  { pattern: /\bgeniohyoid\b/i, namePl: 'Mięsień bródkowo-gnykowy', nameEn: 'Geniohyoid muscle', category: 'muscle' },
  { pattern: /\bmylohyoid\b/i, namePl: 'Mięsień żuchwowo-gnykowy', nameEn: 'Mylohyoid muscle', category: 'muscle' },
  { pattern: /\bstylohyoid\b/i, namePl: 'Mięsień rylcowo-gnykowy', nameEn: 'Stylohyoid muscle', category: 'muscle' },
  { pattern: /\bomohyoid\b/i, namePl: 'Mięsień łopatkowo-gnykowy', nameEn: 'Omohyoid muscle', category: 'muscle' },
  { pattern: /\bsternohyoid\b/i, namePl: 'Mięsień mostkowo-gnykowy', nameEn: 'Sternohyoid muscle', category: 'muscle' },
  { pattern: /\bsternothyroid\b/i, namePl: 'Mięsień mostkowo-tarczowy', nameEn: 'Sternothyroid muscle', category: 'muscle' },
  { pattern: /\bthyrohyoid\b/i, namePl: 'Mięsień tarczowo-gnykowy', nameEn: 'Thyrohyoid muscle', category: 'muscle' },
  { pattern: /\banterior\s+belly\s+of\s+digastric\b/i, namePl: 'Mięsień dwubrzuścowy (brzusiec przedni)', nameEn: 'Digastric muscle (anterior belly)', category: 'muscle' },
  { pattern: /\bposterior\s+belly\s+of\s+digastric\b/i, namePl: 'Mięsień dwubrzuścowy (brzusiec tylny)', nameEn: 'Digastric muscle (posterior belly)', category: 'muscle' },
  { pattern: /\bdigastric\b/i, namePl: 'Mięsień dwubrzuścowy', nameEn: 'Digastric muscle', category: 'muscle' },
  { pattern: /\bsuperior\s+pharyngeal\s+constrictor\b/i, namePl: 'Mięsień zwieracz górny gardła', nameEn: 'Superior pharyngeal constrictor', category: 'muscle' },
  { pattern: /\bmiddle\s+pharyngeal\s+constrictor\b/i, namePl: 'Mięsień zwieracz środkowy gardła', nameEn: 'Middle pharyngeal constrictor', category: 'muscle' },
  { pattern: /\binferior\s+pharyngeal\s+constrictor\b/i, namePl: 'Mięsień zwieracz dolny gardła', nameEn: 'Inferior pharyngeal constrictor', category: 'muscle' },
  { pattern: /\bpalatopharyngeus\b/i, namePl: 'Mięsień podniebienno-gardłowy', nameEn: 'Palatopharyngeus muscle', category: 'muscle' },
  { pattern: /\bstylopharyngeus\b/i, namePl: 'Mięsień rylcowo-gardłowy', nameEn: 'Stylopharyngeus muscle', category: 'muscle' },
  { pattern: /\bstraight\s+part\s+of\s+cricothyroid\b/i, namePl: 'Mięsień pierścienno-tarczowy (część prosta)', nameEn: 'Cricothyroid muscle (straight part)', category: 'muscle' },
  { pattern: /\boblique\s+part\s+of\s+cricothyroid\b/i, namePl: 'Mięsień pierścienno-tarczowy (część skośna)', nameEn: 'Cricothyroid muscle (oblique part)', category: 'muscle' },
  { pattern: /\bthyro\s+epiglottic\s+part\s+of\s+thyro\s+arytenoid\b/i, namePl: 'Mięsień tarczowo-nagłośniowy', nameEn: 'Thyroepiglottic part of thyroarytenoid muscle', category: 'muscle' },
  { pattern: /\bexternal\s+part\s+of\s+thyro\s+arytenoid\b/i, namePl: 'Mięsień tarczowo-nalewkowy (część zewnętrzna)', nameEn: 'Thyroarytenoid muscle (external part)', category: 'muscle' },
  { pattern: /\bary\s+epiglottic\s+part\s+of\s+oblique\s+arytenoid\b/i, namePl: 'Mięsień nalewkowo-nagłośniowy', nameEn: 'Aryepiglottic part of oblique arytenoid muscle', category: 'muscle' },
  { pattern: /\btransverse\s+arytenoid\b/i, namePl: 'Mięsień nalewkowy poprzeczny', nameEn: 'Transverse arytenoid muscle', category: 'muscle' },
  { pattern: /\blateral\s+crico\s+arytenoid\b/i, namePl: 'Mięsień pierścienno-nalewkowy boczny', nameEn: 'Lateral cricoarytenoid muscle', category: 'muscle' },
  { pattern: /\bposterior\s+crico\s+arytenoid\b/i, namePl: 'Mięsień pierścienno-nalewkowy tylny', nameEn: 'Posterior cricoarytenoid muscle', category: 'muscle' },

  // Short generic fallbacks (only if specific rules above did not match)
  { pattern: /\b(mesh\s+)?fibula\b/i, namePl: 'Kość strzałkowa', nameEn: 'Fibula', structureId: 'fibula', category: 'bone' },
  { pattern: /\btarsus\b|\bossa\s+tarsi\b/i, namePl: 'Kości stępu', nameEn: 'Tarsal bones', structureId: 'talus', category: 'bone' },
  { pattern: /\bbiceps\b(?!.*femor)/i, namePl: 'Mięsień dwugłowy ramienia', nameEn: 'Biceps brachii muscle', structureId: 'm_biceps_brachii', category: 'muscle' },
  { pattern: /\btriceps\b/i, namePl: 'Mięsień trójgłowy ramienia', nameEn: 'Triceps brachii muscle', structureId: 'm_triceps_brachii', category: 'muscle' },
  { pattern: /^\s*temporal\s*$/i, namePl: 'Kość skroniowa', nameEn: 'Temporal bone', structureId: 'cranium', category: 'bone' },
];

function resolveToothTranslation(
  rawName: string,
  normalized: string,
  meshWorldX?: number
): MeshTranslationResult | undefined {
  // Explicit FDI code in technical IDs (e.g. mesh_tooth_11, tooth_24)
  const explicitToothId = rawName.match(/\b(?:mesh_)?tooth_([1-4][1-7])\b/i);
  if (explicitToothId) {
    const dbMatch = ANATOMY_DB.find((item) => item.id === `tooth_${explicitToothId[1]}`);
    if (dbMatch) {
      const namePl = dbMatch.namePl;
      const nameEn = dbMatch.nameEn || dbMatch.namePl;
      return {
        namePl,
        nameEn,
        bilingualName: formatBilingualName(namePl, nameEn),
        structureId: dbMatch.id,
        category: dbMatch.category,
        isCartilage: false,
      };
    }
  }

  const isUpper = /\b(upper|maxill)\b/i.test(normalized);
  const isLower = /\b(lower|mandib)\b/i.test(normalized);
  if (isUpper === isLower) {
    // Handle generic extras.name strings ("Incisor", "Canine Tooth", "Premolar", "Molar (Tooth")
    if (/^\s*incisor\s*$/i.test(normalized)) {
      return {
        namePl: 'Ząb sieczny',
        nameEn: 'Incisor',
        bilingualName: formatBilingualName('Ząb sieczny', 'Incisor'),
        category: 'bone',
        isCartilage: false,
      };
    }
    if (/^\s*canine(\s+tooth)?\s*$/i.test(normalized)) {
      return {
        namePl: 'Kieł',
        nameEn: 'Canine tooth',
        bilingualName: formatBilingualName('Kieł', 'Canine tooth'),
        category: 'bone',
        isCartilage: false,
      };
    }
    if (/^\s*premolar\s*$/i.test(normalized)) {
      return {
        namePl: 'Ząb przedtrzonowy',
        nameEn: 'Premolar',
        bilingualName: formatBilingualName('Ząb przedtrzonowy', 'Premolar'),
        category: 'bone',
        isCartilage: false,
      };
    }
    if (/^\s*molar(\s*\(?\s*tooth\)?)?\s*$/i.test(normalized)) {
      return {
        namePl: 'Ząb trzonowy',
        nameEn: 'Molar tooth',
        bilingualName: formatBilingualName('Ząb trzonowy', 'Molar tooth'),
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
    // +X = anatomical LEFT (Q2 upper, Q3 lower); -X = anatomical RIGHT (Q1 upper, Q4 lower)
    isPatientLeft = meshWorldX > 0;
  } else if (/\bleft\b/i.test(normalized)) {
    isPatientLeft = true;
  } else if (/\bright\b/i.test(normalized)) {
    isPatientLeft = false;
  } else {
    // body.glb node-name fallback when meshWorldX is omitted:
    // 13 bilateral tooth pairs place .001 on anatomical RIGHT (-X); Lower medial incisor is inverted (.001 on +X).
    const hasDot001 = /\.\s*001\b|001\b/i.test(rawName);
    isPatientLeft = isLower && toothNum === 1 ? hasDot001 : !hasDot001;
  }

  const quadrant = isUpper ? (isPatientLeft ? 2 : 1) : isPatientLeft ? 3 : 4;
  const fdi = quadrant * 10 + toothNum;
  const dbMatch = ANATOMY_DB.find((item) => item.id === `tooth_${fdi}`);
  if (!dbMatch) return undefined;

  const namePl = dbMatch.namePl;
  const nameEn = dbMatch.nameEn || dbMatch.namePl;
  return {
    namePl,
    nameEn,
    bilingualName: formatBilingualName(namePl, nameEn),
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
  | 'ligament'
  | 'artery'
  | 'vein'
  | 'nerve'
  | 'organ'
  | 'skin';

function formatFallbackPolishForCategory(
  cleanEn: string,
  category: StructureCategory,
): string {
  if (!cleanEn) return 'Struktura anatomiczna';
  const low = cleanEn.toLowerCase();
  switch (category) {
    case 'artery':
      return /\barter(y|ies)\b/i.test(low) ? `Tętnica — ${cleanEn.replace(/\s*arter(y|ies)\b/i, '').trim() || cleanEn}` : `Tętnica — ${cleanEn}`;
    case 'vein':
      return /\b(veins?|venae?|sinus)\b/i.test(low)
        ? `Żyła / zatoka — ${cleanEn.replace(/\s*(veins?|venae?)\b/i, '').trim() || cleanEn}`
        : `Żyła — ${cleanEn}`;
    case 'nerve':
      if (/\b(nerves?)\b/i.test(low)) {
        return `Nerw — ${cleanEn.replace(/\s*nerves?\b/i, '').trim() || cleanEn}`;
      }
      if (/\bplexus\b/i.test(low)) {
        return `Splot nerwowy — ${cleanEn.replace(/\s*plexus\b/i, '').trim() || cleanEn}`;
      }
      return `Układ nerwowy — ${cleanEn}`;
    case 'ligament':
      if (/\bcapsule\b/i.test(low)) {
        return `Torebka stawowa — ${cleanEn.replace(/\s*(articular\s+)?capsule(\s+of)?\b/i, '').trim() || cleanEn}`;
      }
      if (/\bligament/i.test(low)) {
        return `Więzadło — ${cleanEn.replace(/\s*ligaments?\b/i, '').trim() || cleanEn}`;
      }
      return `Aparat więzadłowo-stawowy — ${cleanEn}`;
    case 'organ':
      return `Narząd wewnętrzny — ${cleanEn}`;
    case 'skin':
      return `Okolica skórna — ${cleanEn.replace(/\s*regions?(\s+of)?\b/i, '').trim() || cleanEn}`;
    case 'bursa':
      return `Kaletka — ${cleanEn.replace(/\s*bursae?\b/i, '').trim() || cleanEn}`;
    case 'tendon':
      return `Ścięgno / pochewka — ${cleanEn.replace(/\s*(tendon\s+sheath|sheath|tendon)\b/i, '').trim() || cleanEn}`;
    default:
      return cleanEn;
  }
}

/**
 * Translates a 3D mesh node name from body.glb, Z-Anatomy overlay layers, or procedural models
 * into Polish terminology, resolving to a structure in ANATOMY_DB whenever possible.
 */
export function translateMeshNameToPolish(
  rawName: string,
  tissueHint?: MeshTissueHint,
  meshWorldX?: number
): MeshTranslationResult {
  const isCartilageName = /\b(cartilages?|cartilago|meniscus)\b/i.test(rawName || '');
  const isBursaName = /\bbursae?\b/i.test(rawName || '');
  const isTendonName = /\b(tendon|sheath|aponeurosis|retinaculum|fascia|linea\s+alba)\b/i.test(rawName || '');
  const isLigamentName = /\b(ligaments?|ligamentum|lig_|articular\s+capsule|capsule|labrum|symphysis|suture|interosseous\s+membrane)\b/i.test(rawName || '');
  const isArteryName = /\b(artery|arteries|aorta|arterial|pulmonary\s+trunk)\b/i.test(rawName || '');
  const isVeinName = /\b(vein|veins|vena|venae|venous|sinus)\b/i.test(rawName || '');
  const isNerveName = /\b(nerve|nerves|plexus|ganglion|spinal\s+cord|cerebr|cerebell|pons|medulla|brain|gyrus|sulcus|thalamus|hippocampus)\b/i.test(rawName || '');
  const isSkinName = /\b(region\s+of|regions\s+of|\w+\s+region|eyebrow)\b/i.test(rawName || '');
  const isJointLigamentName =
    /\b(cartilages?|cartilago|meniscus|ligament|tendon|bursa|bursae|sheath|aponeurosis|retinaculum|capsule|labrum|lig_|articulatio|discus|intervertebral\s+disc)\b/i.test(
      rawName || ''
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
                  : tissueHint === 'tendon'
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
              : tissueHint === 'bone'
                ? 'bone'
                : /\b(muscle|musculus|m_|myo)\b/i.test(rawName || '')
                  ? 'muscle'
                  : 'bone');

  if (!rawName || !rawName.trim()) {
    return {
      namePl: 'Struktura anatomiczna',
      nameEn: 'Anatomical structure',
      bilingualName: 'Struktura anatomiczna (Anatomical structure)',
      category: fallbackCategory,
      isCartilage: isCartilageName,
    };
  }

  const normalized = rawName
    .replace(/^(mesh_|geo_|node_|object_)+/i, '')
    .replace(/\.(r|l)$/i, '')
    .replace(/([a-zA-Z])(\d{3})\b/g, '$1 $2')
    .replace(/[_.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return {
      namePl: 'Struktura anatomiczna',
      nameEn: 'Anatomical structure',
      bilingualName: 'Struktura anatomiczna (Anatomical structure)',
      category: fallbackCategory,
      isCartilage: isCartilageName,
    };
  }

  // Lateralization detection (+X = anatomical LEFT, -X = anatomical RIGHT)
  const explicitLeft = /\b(left|lt|sinister|sin)\b|[_.\s]l$/i.test(rawName);
  const explicitRight = /\b(right|rt|dexter|dex)\b|[_.\s]r$/i.test(rawName);
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
    // Allow ligament layer meshes to match joint_ligament entries (ACL, PCL, MCL, LCL, meniscus, labrum, disc)
    if (strictLayerCategory === 'ligament' && ruleCat === 'joint_ligament') return true;
    return false;
  };

  // 0. Deterministic FDI Tooth resolution (only for skeletal/unhinted meshes)
  if (!strictLayerCategory) {
    const toothResult = resolveToothTranslation(rawName, normalized, meshWorldX);
    if (toothResult) {
      return toothResult;
    }
  }

  // 1. Direct rule match (strictly ordered by anatomical precedence & guarded against cross-system leaks)
  for (const rule of ANATOMY_TRANSLATION_RULES) {
    if (!isCategoryCompatible(rule.category)) continue;
    if (rule.pattern.test(normalized)) {
      const dbMatch = rule.structureId
        ? ANATOMY_DB.find((item) => item.id === rule.structureId)
        : undefined;
      const effectiveSide = rule.structureId?.startsWith('tooth_') ? '' : sideSuffix;
      const namePl = `${rule.namePl}${effectiveSide}`;
      const nameEn = rule.nameEn || dbMatch?.nameEn || rule.namePl;
      const bilingualName = formatBilingualName(namePl, nameEn);
      return {
        namePl,
        nameEn,
        bilingualName,
        structureId: rule.structureId,
        category: rule.category ?? dbMatch?.category,
        isCartilage: rule.isCartilage ?? isCartilageName,
      };
    }
  }

  // 2. Direct lookup in ANATOMY_DB by ID, nameLt, or aliases (word-boundary safe, stripping trailing Blender copy suffix)
  const step2Target = normalized.replace(/\s+\d{3}$/, '').toLowerCase().trim();
  for (const entry of ANATOMY_DB) {
    if (!isCategoryCompatible(entry.category)) continue;
    const idMatch = entry.id.toLowerCase() === step2Target;
    const meshIdMatch = Boolean(entry.modelMeshId && entry.modelMeshId.toLowerCase() === rawName.toLowerCase());
    const nameLtMatch = Boolean(
      entry.nameLt &&
        (entry.nameLt.toLowerCase() === step2Target ||
          hasWordBoundaryMatch(step2Target, entry.nameLt.toLowerCase()))
    );
    const aliasMatch = entry.aliases.some((alias) => {
      const a = alias.trim().toLowerCase();
      if (!a || /^\d+$/.test(a)) return false;
      return hasWordBoundaryMatch(step2Target, a);
    });

    if (idMatch || meshIdMatch || nameLtMatch || aliasMatch) {
      const effectiveSide = entry.id.startsWith('tooth_') ? '' : sideSuffix;
      const namePl = `${entry.namePl}${effectiveSide}`;
      const nameEn = entry.nameEn || entry.namePl;
      const bilingualName = formatBilingualName(namePl, nameEn);
      return {
        namePl,
        nameEn,
        bilingualName,
        structureId: entry.id,
        category: strictLayerCategory ?? (isJointLigamentName && entry.category !== 'bursa' && entry.category !== 'tendon' && entry.category !== 'ligament' ? 'joint_ligament' : entry.category),
        isCartilage: isCartilageName,
      };
    }
  }

  // 3. Fallback category heuristic with Polish anatomical prefix for new Z-Anatomy layers
  const cleanLabel = normalized
    .replace(/\s+\d{3}$/, '')
    .replace(/\b(left|right|muscle|bone|mesh|geo|node)\b/gi, '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const basePl = strictLayerCategory
    ? formatFallbackPolishForCategory(cleanLabel, fallbackCategory)
    : cleanLabel || 'Struktura anatomiczna';
  const namePl = `${basePl}${sideSuffix}`;
  const nameEn = cleanLabel ? cleanLabel : 'Anatomical structure';
  const bilingualName = formatBilingualName(namePl, nameEn);

  return {
    namePl,
    nameEn,
    bilingualName,
    category: fallbackCategory,
    isCartilage: isCartilageName,
  };
}

/**
 * Bidirectional mapping helper: returns the primary 3D mesh identifier for an ANATOMY_DB structure ID.
 */
export function getMeshIdForStructure(structureId: string): string | undefined {
  const match = ANATOMY_DB.find((s) => s.id === structureId);
  return match?.modelMeshId;
}

/**
 * Bidirectional mapping helper: returns the ANATOMY_DB structure ID for a 3D mesh identifier.
 */
export function getStructureIdForMesh(meshName: string): string | undefined {
  return translateMeshNameToPolish(meshName).structureId;
}
