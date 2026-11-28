/**
 * Bidirectional clinical Nerve <-> Innervated Muscles 3D mapping.
 * Used in Explorer 3D to highlight all muscles innervated by a selected peripheral/cranial nerve
 * (with palsy syndrome card) and to jump from any muscle directly to its supplying nerve on 3D.
 */

export interface ClinicalNerveProfile {
  nerveStructureId: string;
  nerveNamePl: string;
  nerveNameEn: string;
  segments: string;
  nerveMeshPattern: RegExp;
  /** DB structure IDs of primary innervated muscles */
  innervatedMuscleIds: string[];
  /** Additional raw GLB mesh patterns for muscles without dedicated DB entries */
  extraMuscleMeshPattern?: RegExp;
  palsySyndromePl: string;
  motorDeficitPl: string;
  sensoryAreaPl: string;
  keyTestsPl: string[];
  recommendedRegion: 'head_neck' | 'torso' | 'upper_limb_right' | 'lower_limb_right' | 'full_body';
}

export const CLINICAL_NERVE_PROFILES: ClinicalNerveProfile[] = [
  {
    nerveStructureId: 'n_axillaris',
    nerveNamePl: 'Nerw pachowy',
    nerveNameEn: 'Axillary nerve',
    segments: 'C5–C6',
    nerveMeshPattern: /\baxillary\s+nerve\b/i,
    innervatedMuscleIds: ['m_deltoideus', 'm_teres_minor'],
    palsySyndromePl: 'Porażenie nerwu pachowego — zanik obrysu barku („bark kwadratowy”)',
    motorDeficitPl: 'Osłabienie odwodzenia ramienia powyżej 15–30° i rotacji zewnętrznej; niemożność uniesienia ramienia bokiem.',
    sensoryAreaPl: 'Skóra bocznej powierzchni barku nad mięśniem naramiennym („obszar odznaki żołnierskiej”).',
    keyTestsPl: ['Badanie czucia okolicy naramiennej po zwichnięciu stawu ramiennego', 'Skala Lovetta — odwodzenie barku'],
    recommendedRegion: 'upper_limb_right',
  },
  {
    nerveStructureId: 'n_suprascapularis',
    nerveNamePl: 'Nerw nadłopatkowy',
    nerveNameEn: 'Suprascapular nerve',
    segments: 'C5–C6',
    nerveMeshPattern: /\bsuprascapular\s+nerve\b/i,
    innervatedMuscleIds: ['m_supraspinatus', 'm_infraspinatus'],
    palsySyndromePl: 'Neuropatia wcięcia łopatki / wcięcia grzebieniowo-panewkowego',
    motorDeficitPl: 'Osłabienie inicjacji odwodzenia ramienia i rotacji zewnętrznej; widoczny zanik w dole nad- i podgrzebieniowym.',
    sensoryAreaPl: 'Brak unerwienia skórnego — wyłącznie głęboki ból tylno-górnej okolicy barku (torebka stawowa).',
    keyTestsPl: ['Test Jobe’a (Empty Can)', 'Test oporowy rotacji zewnętrznej (ERLS)'],
    recommendedRegion: 'upper_limb_right',
  },
  {
    nerveStructureId: 'n_thoracicus_longus',
    nerveNamePl: 'Nerw piersiowy długi',
    nerveNameEn: 'Long thoracic nerve',
    segments: 'C5–C7',
    nerveMeshPattern: /\blong\s+thoracic\s+nerve\b/i,
    innervatedMuscleIds: ['m_serratus_anterior'],
    palsySyndromePl: 'Przyśrodkowa łopatka skrzydlata (scapula alata)',
    motorDeficitPl: 'Odstający brzeg przyśrodkowy łopatki przy odpychaniu od ściany i trudność z uniesieniem ramienia ponad 90°.',
    sensoryAreaPl: 'Nerw czysto ruchowy (brak zaburzeń czucia skórnego).',
    keyTestsPl: ['Test ściany (Wall Push-Up)', 'Skala Lovetta — protrakcja łopatki'],
    recommendedRegion: 'torso',
  },
  {
    nerveStructureId: 'n_accessorius',
    nerveNamePl: 'Nerw dodatkowy (XI)',
    nerveNameEn: 'Accessory nerve (XI)',
    segments: 'C1–C5, n. XI',
    nerveMeshPattern: /\baccessory\s+nerve\b/i,
    innervatedMuscleIds: ['m_trapezius', 'm_sternocleidomastoideus'],
    palsySyndromePl: 'Porażenie nerwu XI — opadanie barku i boczna łopatka skrzydlata',
    motorDeficitPl: 'Opadnięcie obręczy barkowej, osłabienie unoszenia barku i rotacji głowy w stronę przeciwną.',
    sensoryAreaPl: 'Nerw ruchowy — możliwy wtórny ból przeciążeniowy mięśnia dźwigacza łopatki.',
    keyTestsPl: ['Unoszenie barków przeciw oporowi', 'Rotacja głowy z oporem (ocena MOS)'],
    recommendedRegion: 'head_neck',
  },
  {
    nerveStructureId: 'n_musculocutaneus',
    nerveNamePl: 'Nerw mięśniowo-skórny',
    nerveNameEn: 'Musculocutaneous nerve',
    segments: 'C5–C7',
    nerveMeshPattern: /\bmusculocutaneous\s+nerve\b/i,
    innervatedMuscleIds: ['m_biceps_brachii', 'm_brachialis', 'm_coracobrachialis'],
    palsySyndromePl: 'Porażenie grupy przedniej ramienia (osłabienie zgięcia i supinacji)',
    motorDeficitPl: 'Wyraźne osłabienie zgięcia łokcia (zwłaszcza w supinacji) oraz odwracania przedramienia; zniesienie odruchu z bicepsa.',
    sensoryAreaPl: 'Boczna powierzchnia przedramienia (przez nerw skórny boczny przedramienia).',
    keyTestsPl: ['Test Speeda / Yergasona', 'Odruch ze ścięgna mięśnia dwugłowego (C5–C6)'],
    recommendedRegion: 'upper_limb_right',
  },
  {
    nerveStructureId: 'n_radialis',
    nerveNamePl: 'Nerw promieniowy',
    nerveNameEn: 'Radial nerve',
    segments: 'C5–Th1',
    nerveMeshPattern: /\bradial\s+nerve\b|\bposterior\s+interosseous\s+nerve\b/i,
    innervatedMuscleIds: [
      'm_triceps_brachii',
      'm_brachioradialis',
      'm_extensor_carpi_radialis_longus',
      'm_extensor_digitorum',
    ],
    extraMuscleMeshPattern: /\b(anconeus|supinator|extensor\s+carpi\s+radialis\s+brevis|extensor\s+carpi\s+ulnaris|extensor\s+digiti\s+minimi|extensor\s+indicis|extensor\s+pollicis|abductor\s+pollicis\s+longus)\b/i,
    palsySyndromePl: 'Ręka opadająca (porażenie sobotniej nocy / złamanie trzonu kości ramiennej)',
    motorDeficitPl: 'Niemożność wyprostu nadgarstka i palców w stawach śródręczno-paliczkowych; przy wysokim uszkodzeniu również brak wyprostu łokcia.',
    sensoryAreaPl: 'Grzbietowo-promieniowa część ręki i pierwsza przestrzeń międzykostna (tabakierka anatomiczna).',
    keyTestsPl: ['Test wyprostu nadgarstka i palców', 'Test neurodynamiczny ULNT 2b (nerw promieniowy)'],
    recommendedRegion: 'upper_limb_right',
  },
  {
    nerveStructureId: 'n_medianus',
    nerveNamePl: 'Nerw pośrodkowy',
    nerveNameEn: 'Median nerve',
    segments: 'C6–Th1',
    nerveMeshPattern: /\bmedian\s+nerve\b|\banterior\s+interosseous\s+nerve\b/i,
    innervatedMuscleIds: ['m_pronator_teres', 'm_flexor_carpi_radialis'],
    extraMuscleMeshPattern: /\b(palmaris\s+longus|flexor\s+digitorum\s+superficialis|flexor\s+pollicis\s+longus|pronator\s+quadratus|abductor\s+pollicis\s+brevis|opponens\s+pollicis)\b/i,
    palsySyndromePl: 'Zespół cieśni nadgarstka / ręka błogosławiąca / ręka małpia',
    motorDeficitPl: 'Osłabienie opozycji kciuka i zanik kłębu; przy wysokim uszkodzeniu brak zgięcia palców I–III i pronacji przedramienia.',
    sensoryAreaPl: 'Powierzchnia dłoniowa kciuka, palca II, III i promieniowej połowy IV (oraz ich opuszki grzbietowe).',
    keyTestsPl: ['Test Phalena', 'Objaw Tinela nad kanałem nadgarstka', 'Test neurodynamiczny ULNT 1'],
    recommendedRegion: 'upper_limb_right',
  },
  {
    nerveStructureId: 'n_ulnaris',
    nerveNamePl: 'Nerw łokciowy',
    nerveNameEn: 'Ulnar nerve',
    segments: 'C8–Th1',
    nerveMeshPattern: /\bulnar\s+nerve\b/i,
    innervatedMuscleIds: ['m_flexor_carpi_ulnaris'],
    extraMuscleMeshPattern: /\b(adductor\s+pollicis|abductor\s+digiti\s+minimi.*hand|flexor\s+digiti\s+minimi.*hand|opponens\s+digiti\s+minimi|interosse.*hand|palmaris\s+brevis)\b/i,
    palsySyndromePl: 'Zespół rowka nerwu łokciowego / ręka szponiasta (palce IV–V)',
    motorDeficitPl: 'Osłabienie przywodzenia/odwodzenia palców (mięśnie międzykostne), zanik I przestrzeni międzykostnej i dodatni objaw Fromenta.',
    sensoryAreaPl: 'Palec V oraz łokciowa połowa palca IV (strona dłoniowa i grzbietowa).',
    keyTestsPl: ['Objaw Fromenta (chwyt kartki)', 'Test zgięcia łokcia', 'ULNT 3 (nerw łokciowy)'],
    recommendedRegion: 'upper_limb_right',
  },
  {
    nerveStructureId: 'n_femoralis',
    nerveNamePl: 'Nerw udowy',
    nerveNameEn: 'Femoral nerve',
    segments: 'L2–L4',
    nerveMeshPattern: /\b(femoral|saphenous)\s+nerve\b/i,
    innervatedMuscleIds: ['m_quadriceps_femoris', 'm_sartorius', 'm_iliopsoas'],
    extraMuscleMeshPattern: /\b(rectus\s+femoris|vastus\s+(lateralis|medialis|intermedius)|pectineus|iliacus)\b/i,
    palsySyndromePl: 'Porażenie mięśnia czworogłowego — niestabilność i „uciekanie” kolana',
    motorDeficitPl: 'Niemożność czynnego wyprostu kolana, trudność przy wchodzeniu po schodach i zniesiony odruch kolanowy (L3–L4).',
    sensoryAreaPl: 'Przednia powierzchnia uda oraz przyśrodkowa strona podudzia (nerw udowo-goleniowy).',
    keyTestsPl: ['Test napięciowy nerwu udowego (PKB / Nachlasa)', 'Odruch z więzadła rzepki'],
    recommendedRegion: 'lower_limb_right',
  },
  {
    nerveStructureId: 'n_obturatorius',
    nerveNamePl: 'Nerw zasłonowy',
    nerveNameEn: 'Obturator nerve',
    segments: 'L2–L4',
    nerveMeshPattern: /\bobturator\s+nerve\b/i,
    innervatedMuscleIds: ['m_gracilis', 'm_adductor_longus', 'm_adductor_magnus'],
    extraMuscleMeshPattern: /\b(adductor\s+brevis|obturator\s+externus)\b/i,
    palsySyndromePl: 'Osłabienie przywodzicieli uda i ból przyśrodkowej strony uda',
    motorDeficitPl: 'Osłabienie przywodzenia w stawie biodrowym i niestabilność kroku przy zmianach kierunku biegu.',
    sensoryAreaPl: 'Owalne pole skórne w dolno-przyśrodkowej części uda powyżej kolana.',
    keyTestsPl: ['Test przywodzenia z oporem (Squeeze Test)', 'Palpacja kanału zasłonowego'],
    recommendedRegion: 'lower_limb_right',
  },
  {
    nerveStructureId: 'n_gluteus_superior',
    nerveNamePl: 'Nerw pośladkowy górny',
    nerveNameEn: 'Superior gluteal nerve',
    segments: 'L4–S1',
    nerveMeshPattern: /\bsuperior\s+gluteal\s+nerve\b/i,
    innervatedMuscleIds: ['m_gluteus_medius', 'm_gluteus_minimus', 'm_tensor_fasciae_latae'],
    palsySyndromePl: 'Dodatni objaw Trendelenburga i chód kaczkowaty (Duchenne’a)',
    motorDeficitPl: 'Opadanie przeciwnej strony miednicy podczas stania jednonóż na kończynie chorej oraz osłabienie odwodzenia biodra.',
    sensoryAreaPl: 'Nerw czysto ruchowy (brak deficytów czucia skórnego).',
    keyTestsPl: ['Test Trendelenburga', 'Skala Lovetta — odwodzenie biodra w leżeniu bokiem'],
    recommendedRegion: 'lower_limb_right',
  },
  {
    nerveStructureId: 'n_ischiadicus',
    nerveNamePl: 'Nerw kulszowy',
    nerveNameEn: 'Sciatic nerve',
    segments: 'L4–S3',
    nerveMeshPattern: /\bsciatic\s+nerve\b/i,
    innervatedMuscleIds: [
      'm_biceps_femoris',
      'm_semitendinosus',
      'm_semimembranosus',
      'm_adductor_magnus',
      'm_gastrocnemius',
      'm_soleus',
      'm_tibialis_anterior',
      'm_tibialis_posterior',
      'm_peroneus_longus',
      'm_fibularis_brevis',
    ],
    palsySyndromePl: 'Rwa kulszowa / zespół mięśnia gruszkowatego / ciężkie porażenie podudzia',
    motorDeficitPl: 'Osłabienie zgięcia kolana (kulszowo-goleniowe) oraz wszystkich mięśni podudzia i stopy.',
    sensoryAreaPl: 'Tylno-boczna powierzchnia podudzia oraz niemal cała stopa (poza brzegiem przyśrodkowym).',
    keyTestsPl: ['Test Lasègue’a (SLR)', 'Test Slump', 'Test FAIR (mięsień gruszkowaty)'],
    recommendedRegion: 'lower_limb_right',
  },
  {
    nerveStructureId: 'n_tibialis',
    nerveNamePl: 'Nerw piszczelowy',
    nerveNameEn: 'Tibial nerve',
    segments: 'L4–S3',
    nerveMeshPattern: /\btibial\s+nerve\b/i,
    innervatedMuscleIds: ['m_gastrocnemius', 'm_soleus', 'm_tibialis_posterior', 'm_popliteus'],
    extraMuscleMeshPattern: /\b(plantaris|flexor\s+digitorum\s+longus|flexor\s+hallucis\s+longus)\b/i,
    palsySyndromePl: 'Zespół kanału stępu / stopa piętowa (brak wspięcia na palce)',
    motorDeficitPl: 'Niemożność wspięcia na palce (zgięcia podeszwowego), osłabienie inwersji stopy i zniesiony odruch ze ścięgna Achillesa (S1).',
    sensoryAreaPl: 'Podeszwa stopy oraz pięta (nerwy podeszwowe przyśrodkowy i boczny).',
    keyTestsPl: ['Wspięcie jednonóż na palce', 'Objaw Tinela za kostką przyśrodkową', 'Odruch skokowy S1'],
    recommendedRegion: 'lower_limb_right',
  },
  {
    nerveStructureId: 'n_fibularis_communis',
    nerveNamePl: 'Nerw strzałkowy wspólny',
    nerveNameEn: 'Common fibular nerve',
    segments: 'L4–S2',
    nerveMeshPattern: /\b(common|deep|superficial)\s+(fibular|peroneal)\s+nerve\b/i,
    innervatedMuscleIds: ['m_tibialis_anterior', 'm_peroneus_longus', 'm_fibularis_brevis'],
    extraMuscleMeshPattern: /\b(extensor\s+digitorum\s+longus|extensor\s+hallucis\s+longus|fibularis\s+tertius|extensor\s+digitorum\s+brevis)\b/i,
    palsySyndromePl: 'Stopa opadająca i chód brodzący (koguci)',
    motorDeficitPl: 'Brak zgięcia grzbietowego stopy i palców oraz osłabienie ewersji — pacjent musi wysoko unosić kolano w chodzie.',
    sensoryAreaPl: 'Przednio-boczna strona podudzia, grzbiet stopy i I przestrzeń międzypalcowa.',
    keyTestsPl: ['Chód na piętach', 'Skala Lovetta — zgięcie grzbietowe i ewersja stopy'],
    recommendedRegion: 'lower_limb_right',
  },
  {
    nerveStructureId: 'n_facialis',
    nerveNamePl: 'Nerw twarzowy (VII)',
    nerveNameEn: 'Facial nerve (VII)',
    segments: 'n. czaszkowy VII',
    nerveMeshPattern: /\bfacial\s+nerve\b/i,
    innervatedMuscleIds: ['m_nasalis', 'm_procerus', 'm_depressor_septi_nasi', 'm_levator_labii_superioris_alaeque_nasi'],
    extraMuscleMeshPattern: /\b(orbicularis\s+(oculi|oris)|frontalis|occipitofrontalis|zygomaticus|buccinator|mentalis|risorius|platysma|corrugator\s+supercilii|depressor\s+anguli|levator\s+anguli)\b/i,
    palsySyndromePl: 'Obwodowe porażenie nerwu twarzowego (porażenie Bella)',
    motorDeficitPl: 'Asymetria całej połowy twarzy: brak marszczenia czoła, niedomykalność szpary powiekowej (objaw Bella) i opadanie kącika ust.',
    sensoryAreaPl: 'Smak z przednich 2/3 języka (struna bębenkowa); brak czucia dotykowego skóry twarzy.',
    keyTestsPl: ['Ocena symetrii mimiki (skala House-Brackmanna)', 'Zaciskanie powiek i unoszenie brwi'],
    recommendedRegion: 'head_neck',
  },
  {
    nerveStructureId: 'n_trigeminus',
    nerveNamePl: 'Nerw trójdzielny (V)',
    nerveNameEn: 'Trigeminal nerve (V)',
    segments: 'n. czaszkowy V — gałąź V3 ruchowo',
    nerveMeshPattern: /\b(trigeminal|mandibular|ophthalmic|maxillary)\s+nerve\b/i,
    innervatedMuscleIds: ['m_masseter', 'm_temporalis'],
    extraMuscleMeshPattern: /\b(lateral\s+pterygoid|medial\s+pterygoid|mylohyoid|anterior\s+belly\s+of\s+digastric)\b/i,
    palsySyndromePl: 'Osłabienie mięśni żucia i zbaczanie żuchwy w stronę chorą',
    motorDeficitPl: 'Osłabienie siły zgryzu oraz zbaczanie żuchwy podczas otwierania ust na stronę uszkodzoną (brak przeciwwagi m. skrzydłowego bocznego).',
    sensoryAreaPl: 'Cała skóra twarzy i przedniej części głowy (3 gałęzie: oczna V1, szczękowa V2, żuchwowa V3).',
    keyTestsPl: ['Ocena toru odwodzenia żuchwy (SSŻ)', 'Palpacja napięcia żwacza i skroniowego'],
    recommendedRegion: 'head_neck',
  },
];

const PROFILE_BY_NERVE_ID = new Map<string, ClinicalNerveProfile>(
  CLINICAL_NERVE_PROFILES.map((p) => [p.nerveStructureId, p]),
);

export function getNerveProfileByStructureId(structureId?: string | null): ClinicalNerveProfile | null {
  if (!structureId) return null;
  return PROFILE_BY_NERVE_ID.get(structureId) ?? null;
}

export function getNerveProfileForMesh(
  structureId?: string | null,
  rawMeshName?: string | null,
): ClinicalNerveProfile | null {
  if (structureId) {
    const direct = PROFILE_BY_NERVE_ID.get(structureId);
    if (direct) return direct;
  }
  if (rawMeshName) {
    for (const profile of CLINICAL_NERVE_PROFILES) {
      if (profile.nerveMeshPattern.test(rawMeshName)) {
        return profile;
      }
    }
  }
  return null;
}

/**
 * Returns all clinical nerve profiles that innervate the given muscle structureId or raw mesh name.
 * Prefers specific distal nerves (e.g., tibial / common fibular) before parent trunk (sciatic).
 */
export function getNervesForMuscle(
  muscleStructureId?: string | null,
  rawMeshName?: string | null,
): ClinicalNerveProfile[] {
  const matches: ClinicalNerveProfile[] = [];
  for (const profile of CLINICAL_NERVE_PROFILES) {
    const byId = Boolean(muscleStructureId && profile.innervatedMuscleIds.includes(muscleStructureId));
    const byPattern = Boolean(
      rawMeshName && profile.extraMuscleMeshPattern && profile.extraMuscleMeshPattern.test(rawMeshName),
    );
    if (byId || byPattern) {
      matches.push(profile);
    }
  }
  // Put more specific distal nerves (fewer muscles) before broad parent trunks like sciatic
  matches.sort((a, b) => a.innervatedMuscleIds.length - b.innervatedMuscleIds.length);
  return matches;
}

/**
 * Checks whether a 3D mesh belongs to the innervated muscle group of a clinical nerve profile.
 */
export function doesMeshMatchNerveInnervation(
  profile: ClinicalNerveProfile,
  meshStructureId?: string | null,
  meshRawName?: string | null,
  meshLayerId?: string | null,
): boolean {
  if (meshLayerId && meshLayerId !== 'muscle') return false;
  if (meshStructureId && profile.innervatedMuscleIds.includes(meshStructureId)) {
    return true;
  }
  if (meshRawName && profile.extraMuscleMeshPattern && profile.extraMuscleMeshPattern.test(meshRawName)) {
    return true;
  }
  return false;
}
