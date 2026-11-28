import { ANATOMY_MAP } from './anatomyDb';
import type {
  BiomechanicsMuscleRole,
  BiomechanicsPlaneId,
  RegionId,
} from '../types/anatomy';
import type { RegionalModelKey } from '../components/AnatomyViewport3D';

export type JointBiomechanicsGroup =
  | 'shoulder'
  | 'elbow_forearm'
  | 'wrist'
  | 'hip'
  | 'knee'
  | 'ankle_foot'
  | 'spine';

export interface JointMovementProfile {
  id: string;
  jointGroup: JointBiomechanicsGroup;
  jointLabelPl: string;
  namePl: string;
  shortLabelPl: string;
  recommendedRegion: Extract<
    RegionalModelKey,
    'full_body' | 'upper_limb_right' | 'lower_limb_right' | 'torso'
  >;
  defaultSide: 'right' | 'both';
  /** Bone structureIds adjacent to this joint used to anchor the 3D plane & axis helper */
  anchorBoneIds: string[];
  planeId: BiomechanicsPlaneId;
  planeLabelPl: string;
  axisLabelPl: string;
  /** Standard Polish ISOM / Zembaty / fizjoterapeuty.pl SFTR notation */
  sftrCode: string;
  normRangePl: string;
  /** Kaltenborn convex-concave arthrokinematics (roll, glide, and manual mobilization direction) */
  convexConcaveRulePl: string;
  agonistIds: string[];
  synergistIds: string[];
  antagonistIds: string[];
  extraAgonistPattern?: RegExp;
  extraSynergistPattern?: RegExp;
  extraAntagonistPattern?: RegExp;
  /** Optional direct link to a matching Lovett 0–5 entry in CLINICAL_TESTS_DB */
  lovettTestId?: string;
  clinicalTipPl: string;
  srsRegion: RegionId;
}

export const BIOMECHANICS_JOINT_GROUPS: Array<{
  id: JointBiomechanicsGroup;
  label: string;
  shortLabel: string;
}> = [
  { id: 'shoulder', label: 'Staw ramienny (Bark)', shortLabel: 'Bark (5)' },
  { id: 'elbow_forearm', label: 'Łokieć i przedramię', shortLabel: 'Łokieć (4)' },
  { id: 'wrist', label: 'Nadgarstek', shortLabel: 'Nadgarstek (2)' },
  { id: 'hip', label: 'Staw biodrowy', shortLabel: 'Biodro (5)' },
  { id: 'knee', label: 'Staw kolanowy', shortLabel: 'Kolano (2)' },
  { id: 'ankle_foot', label: 'Staw skokowy i stopa', shortLabel: 'Stopa (4)' },
  { id: 'spine', label: 'Kręgosłup i tułów', shortLabel: 'Kręgosłup (2)' },
];

export const BIOMECHANICS_MOVEMENTS: JointMovementProfile[] = [
  // =========================================================================
  // 1. STAW RAMIENNY (BARK) — 5 RUCHÓW
  // =========================================================================
  {
    id: 'shoulder_flexion',
    jointGroup: 'shoulder',
    jointLabelPl: 'Staw ramienny (Bark)',
    namePl: 'Zgięcie ramienia (wznos przodem)',
    shortLabelPl: 'Zgięcie',
    recommendedRegion: 'full_body',
    defaultSide: 'right',
    anchorBoneIds: ['humerus', 'scapula'],
    planeId: 'sagittal',
    planeLabelPl: 'Płaszczyzna strzałkowa (S)',
    axisLabelPl: 'Oś poprzeczna (czołowa)',
    sftrCode: 'S: 50–0–170°',
    normRangePl: 'Zgięcie: 170° (wyprost 50°)',
    convexConcaveRulePl:
      'Wypukła głowa kości ramiennej porusza się we wklęsłej panewce łopatki: toczenie ku przodowi i górze, ślizg w kierunku PRZECIWNYM — do tyłu i doogonowo (w dół). Mobilizacja zgięcia: ślizg tylno-dolny.',
    agonistIds: ['m_deltoideus', 'm_pectoralis_major', 'm_coracobrachialis'],
    synergistIds: ['m_biceps_brachii', 'm_serratus_anterior', 'm_trapezius'],
    antagonistIds: ['m_latissimus_dorsi', 'm_teres_major', 'm_triceps_brachii'],
    clinicalTipPl:
      'Powyżej 90° kluczowy jest rytm łopatkowo-ramienny (2:1) — bez rotacji górnej łopatki (m. zębaty przedni + czworoboczny) dochodzi do ciasnoty podbarkowej.',
    srsRegion: 'shoulder',
  },
  {
    id: 'shoulder_extension',
    jointGroup: 'shoulder',
    jointLabelPl: 'Staw ramienny (Bark)',
    namePl: 'Wyprost ramienia (ruch w tył)',
    shortLabelPl: 'Wyprost',
    recommendedRegion: 'full_body',
    defaultSide: 'right',
    anchorBoneIds: ['humerus', 'scapula'],
    planeId: 'sagittal',
    planeLabelPl: 'Płaszczyzna strzałkowa (S)',
    axisLabelPl: 'Oś poprzeczna (czołowa)',
    sftrCode: 'S: 50–0–170°',
    normRangePl: 'Wyprost: 50° (pierwsza cyfra w SFTR)',
    convexConcaveRulePl:
      'Wypukła głowa kości ramiennej we wklęsłej panewce: toczenie ku tyłowi, ślizg w kierunku PRZECIWNYM — ku przodowi (dobrzusznie). Mobilizacja wyprostu: ślizg przedni.',
    agonistIds: ['m_latissimus_dorsi', 'm_teres_major', 'm_deltoideus'],
    synergistIds: ['m_triceps_brachii', 'm_rhomboideus_major'],
    antagonistIds: ['m_pectoralis_major', 'm_coracobrachialis', 'm_biceps_brachii'],
    clinicalTipPl:
      'W zapisie SFTR pierwsza cyfra zawsze oznacza wyprost (ruch od ciała / ku tyłowi) — ograniczenie wyprostu barku utrudnia np. sięgnięcie do tylnej kieszeni i zapięcie paska.',
    srsRegion: 'shoulder',
  },
  {
    id: 'shoulder_abduction',
    jointGroup: 'shoulder',
    jointLabelPl: 'Staw ramienny (Bark)',
    namePl: 'Odwiedzenie ramienia',
    shortLabelPl: 'Odwiedzenie',
    recommendedRegion: 'full_body',
    defaultSide: 'right',
    anchorBoneIds: ['humerus', 'scapula'],
    planeId: 'frontal',
    planeLabelPl: 'Płaszczyzna czołowa (F)',
    axisLabelPl: 'Oś strzałkowa (przednio-tylna)',
    sftrCode: 'F: 170–0–0°',
    normRangePl: 'Odwiedzenie: 170° (przywiedzenie 0° przy tułowiu)',
    convexConcaveRulePl:
      'Wypukła głowa kości ramiennej we wklęsłej panewce: toczenie dogłowowo (w górę), ślizg w kierunku PRZECIWNYM — DOOGONOWO (w dół). Mobilizacja odwiedzenia wg Kaltenborna: ślizg doogonowy głowy kości ramiennej!',
    agonistIds: ['m_deltoideus', 'm_supraspinatus'],
    synergistIds: ['m_serratus_anterior', 'm_trapezius', 'm_biceps_brachii'],
    antagonistIds: ['m_pectoralis_major', 'm_latissimus_dorsi', 'm_teres_major'],
    lovettTestId: 'lovett_shoulder_abduction',
    clinicalTipPl:
      'Mięsień nadgrzebieniowy inicjuje pierwsze 0–15° i centruje głowę kości ramiennej w panewce (przeciwdziałając jej podciąganiu pod wyrostek barkowy przez część barkową naramiennego).',
    srsRegion: 'shoulder',
  },
  {
    id: 'shoulder_ext_rotation',
    jointGroup: 'shoulder',
    jointLabelPl: 'Staw ramienny (Bark)',
    namePl: 'Rotacja zewnętrzna ramienia',
    shortLabelPl: 'Rotacja zewn.',
    recommendedRegion: 'full_body',
    defaultSide: 'right',
    anchorBoneIds: ['humerus', 'scapula'],
    planeId: 'transverse',
    planeLabelPl: 'Płaszczyzna poprzeczna (R)',
    axisLabelPl: 'Oś podłużna kości ramiennej',
    sftrCode: 'R(F90): 90–0–80°',
    normRangePl: 'Rotacja zewnętrzna: 90° (przy odwiedzeniu 90°)',
    convexConcaveRulePl:
      'Wypukła głowa kości ramiennej we wklęsłej panewce: toczenie ku tyłowi, ślizg w kierunku PRZECIWNYM — DO PRZODU (dobrzusznie). W zamrożonym barku rotacja zewnętrzna ogranicza się jako pierwsza (wzorzec torebkowy Cyriaxa)!',
    agonistIds: ['m_infraspinatus', 'm_teres_minor'],
    synergistIds: ['m_deltoideus', 'm_supraspinatus'],
    antagonistIds: ['m_subscapularis', 'm_pectoralis_major', 'm_latissimus_dorsi', 'm_teres_major'],
    clinicalTipPl:
      'Pełne odwiedzenie ramienia ponad 90° wymaga automatycznej rotacji zewnętrznej, aby guzek większy przeszedł swobodnie pod wyrostkiem barkowym bez konfliktu podbarkowego.',
    srsRegion: 'shoulder',
  },
  {
    id: 'shoulder_int_rotation',
    jointGroup: 'shoulder',
    jointLabelPl: 'Staw ramienny (Bark)',
    namePl: 'Rotacja wewnętrzna ramienia',
    shortLabelPl: 'Rotacja wewn.',
    recommendedRegion: 'full_body',
    defaultSide: 'right',
    anchorBoneIds: ['humerus', 'scapula'],
    planeId: 'transverse',
    planeLabelPl: 'Płaszczyzna poprzeczna (R)',
    axisLabelPl: 'Oś podłużna kości ramiennej',
    sftrCode: 'R(F90): 90–0–80°',
    normRangePl: 'Rotacja wewnętrzna: 80° (ostatnia cyfra w SFTR)',
    convexConcaveRulePl:
      'Wypukła głowa kości ramiennej we wklęsłej panewce: toczenie ku przodowi, ślizg w kierunku PRZECIWNYM — DO TYŁU (dogrzbietowo). Mobilizacja rotacji wewnętrznej: ślizg tylny.',
    agonistIds: ['m_subscapularis', 'm_pectoralis_major', 'm_latissimus_dorsi', 'm_teres_major'],
    synergistIds: ['m_deltoideus'],
    antagonistIds: ['m_infraspinatus', 'm_teres_minor'],
    clinicalTipPl:
      'Deficyt rotacji wewnętrznej barku (GIRD) u siatkarzy i miotaczy wiąże się z przykurczem tylnej torebki stawowej i zwiększa ryzyko uszkodzeń obrąbka SLAP.',
    srsRegion: 'shoulder',
  },

  // =========================================================================
  // 2. STAW ŁOKCIOWY I PRZEDRAMIĘ — 4 RUCHY
  // =========================================================================
  {
    id: 'elbow_flexion',
    jointGroup: 'elbow_forearm',
    jointLabelPl: 'Staw łokciowy i przedramię',
    namePl: 'Zgięcie stawu łokciowego',
    shortLabelPl: 'Zgięcie łokcia',
    recommendedRegion: 'upper_limb_right',
    defaultSide: 'right',
    anchorBoneIds: ['humerus', 'ulna'],
    planeId: 'sagittal',
    planeLabelPl: 'Płaszczyzna strzałkowa (S)',
    axisLabelPl: 'Oś poprzeczna przez bloczek i główkę kości ramiennej',
    sftrCode: 'S: 0–0–150°',
    normRangePl: 'Zgięcie: 150° (wyprost 0°)',
    convexConcaveRulePl:
      'Wklęsłe wcięcie bloczkowe kości łokciowej (oraz dołek głowy kości promieniowej) porusza się po wypukłym bloczku kości ramiennej: toczenie i ślizg zachodzą w TYM SAMYM kierunku — ku przodowi (dobrzusznie).',
    agonistIds: ['m_brachialis', 'm_biceps_brachii', 'm_brachioradialis'],
    synergistIds: ['m_pronator_teres', 'm_extensor_carpi_radialis_longus'],
    antagonistIds: ['m_triceps_brachii'],
    lovettTestId: 'lovett_elbow_flexion',
    clinicalTipPl:
      'Ustawienie przedramienia zmienia dominującego zginacza: supinacja maksymalizuje biceps, pozycja pośrednia (młotkowa) — m. ramienno-promieniowy, a pronacja izoluje m. ramienny!',
    srsRegion: 'upper_limb',
  },
  {
    id: 'elbow_extension',
    jointGroup: 'elbow_forearm',
    jointLabelPl: 'Staw łokciowy i przedramię',
    namePl: 'Wyprost stawu łokciowego',
    shortLabelPl: 'Wyprost łokcia',
    recommendedRegion: 'upper_limb_right',
    defaultSide: 'right',
    anchorBoneIds: ['humerus', 'ulna'],
    planeId: 'sagittal',
    planeLabelPl: 'Płaszczyzna strzałkowa (S)',
    axisLabelPl: 'Oś poprzeczna przez bloczek kości ramiennej',
    sftrCode: 'S: 0–0–150°',
    normRangePl: 'Wyprost: 0° (u kobiet/hipermobilnych możliwy przeprost do 10°)',
    convexConcaveRulePl:
      'Wklęsłe wcięcie bloczkowe kości łokciowej porusza się po wypukłym bloczku kości ramiennej: toczenie i ślizg zachodzą w TYM SAMYM kierunku — ku tyłowi (dogrzbietowo) aż do oparcia wyrostka łokciowego w dole wyrostka łokciowego.',
    agonistIds: ['m_triceps_brachii'],
    synergistIds: ['m_extensor_digitorum'],
    antagonistIds: ['m_brachialis', 'm_biceps_brachii', 'm_brachioradialis'],
    lovettTestId: 'lovett_elbow_extension',
    clinicalTipPl:
      'Ocena wyprostu łokcia w skali Lovetta różnicuje poziom uszkodzenia nerwu promieniowego (pacha — triceps porażony vs bruzda kości ramiennej — triceps zachowany).',
    srsRegion: 'upper_limb',
  },
  {
    id: 'forearm_supination',
    jointGroup: 'elbow_forearm',
    jointLabelPl: 'Staw łokciowy i przedramię',
    namePl: 'Odwracanie (supinacja) przedramienia',
    shortLabelPl: 'Supinacja',
    recommendedRegion: 'upper_limb_right',
    defaultSide: 'right',
    anchorBoneIds: ['radius', 'ulna'],
    planeId: 'transverse',
    planeLabelPl: 'Płaszczyzna poprzeczna (R)',
    axisLabelPl: 'Oś skośna od głowy kości promieniowej do głowy kości łokciowej',
    sftrCode: 'R: 90–0–80°',
    normRangePl: 'Supinacja (odwracanie): 90° (pronacja: 80°)',
    convexConcaveRulePl:
      'W stawie promieniowo-łokciowym bliższym wypukła głowa kości promieniowej wykonuje ślizg w kierunku PRZECIWNYM (dobrzusznie/ku przodowi), a w dalszym wklęsłe wcięcie łokciowe kości promieniowej ślizga się w TYM SAMYM kierunku (dogrzbietowo).',
    agonistIds: ['m_biceps_brachii'],
    synergistIds: ['m_brachioradialis', 'm_extensor_carpi_radialis_longus'],
    antagonistIds: ['m_pronator_teres', 'm_flexor_carpi_radialis'],
    extraAgonistPattern: /\bsupinator\b/i,
    clinicalTipPl:
      'Mięsień dwugłowy ramienia jest najsilniejszym supinatorem przy łokciu zgiętym do 90° (np. wkręcanie śruby); przy pełnym wyproście łokcia dominuje mięsień odwracacz. Uwaga SFTR: standardowo zapisujemy R: 90–0–80° (supinacja od ciała 90° – pronacja do ciała 80°), choć w części skryptów spotyka się odwrotną kolejność pronacja–supinacja (80–0–90°).',
    srsRegion: 'upper_limb',
  },
  {
    id: 'forearm_pronation',
    jointGroup: 'elbow_forearm',
    jointLabelPl: 'Staw łokciowy i przedramię',
    namePl: 'Nawracanie (pronacja) przedramienia',
    shortLabelPl: 'Pronacja',
    recommendedRegion: 'upper_limb_right',
    defaultSide: 'right',
    anchorBoneIds: ['radius', 'ulna'],
    planeId: 'transverse',
    planeLabelPl: 'Płaszczyzna poprzeczna (R)',
    axisLabelPl: 'Oś skośna przedramienia',
    sftrCode: 'R: 90–0–80°',
    normRangePl: 'Pronacja (nawracanie): 80°',
    convexConcaveRulePl:
      'W stawie promieniowo-łokciowym bliższym wypukła głowa kości promieniowej ślizga się dogrzbietowo (PRZECIWNIE), a w dalszym wklęsły koniec dalszy kości promieniowej ślizga się dobrzusznie (W TYM SAMYM kierunku) nad kością łokciową.',
    agonistIds: ['m_pronator_teres'],
    synergistIds: ['m_flexor_carpi_radialis', 'm_brachioradialis'],
    antagonistIds: ['m_biceps_brachii'],
    extraAgonistPattern: /\bpronator\s+quadratus\b/i,
    extraAntagonistPattern: /\bsupinator\b/i,
    clinicalTipPl:
      'Powtarzalna oporowana pronacja (np. stolarze, wkręcanie) przeciąża mięsień nawrotny obły, między którego głowami przebiega nerw pośrodkowy (zespół mięśnia nawrotnego obłego). Zapis SFTR przedramienia R: 90–0–80° oznacza supinację 90° (od ciała) i pronację 80° (do ciała); w części podręczników spotyka się konwencję odwrotną 80–0–90°.',
    srsRegion: 'upper_limb',
  },

  // =========================================================================
  // 3. STAW PROMIENIOWO-NADGARSTKOWY (NADGARSTEK) — 2 RUCHY
  // =========================================================================
  {
    id: 'wrist_flexion',
    jointGroup: 'wrist',
    jointLabelPl: 'Staw promieniowo-nadgarstkowy',
    namePl: 'Zgięcie dłoniowe nadgarstka',
    shortLabelPl: 'Zgięcie dłoniowe',
    recommendedRegion: 'upper_limb_right',
    defaultSide: 'right',
    anchorBoneIds: ['radius', 'ossa_carpi'],
    planeId: 'sagittal',
    planeLabelPl: 'Płaszczyzna strzałkowa (S)',
    axisLabelPl: 'Oś poprzeczna przez głowę kości główkowatej',
    sftrCode: 'S: 50–0–60°',
    normRangePl: 'Zgięcie dłoniowe: 60° (wyprost grzbietowy 50°)',
    convexConcaveRulePl:
      'Wypukły bliższy szereg kości nadgarstka porusza się we wklęsłej powierzchni kości promieniowej: toczenie dłoniowo, ślizg w kierunku PRZECIWNYM — DOGRZBIETOWO (w górę).',
    agonistIds: ['m_flexor_carpi_radialis', 'm_flexor_carpi_ulnaris'],
    synergistIds: ['m_pronator_teres'],
    antagonistIds: ['m_extensor_carpi_radialis_longus', 'm_extensor_digitorum'],
    clinicalTipPl:
      'Maksymalne zgięcie dłoniowe nadgarstka przez 60 s (test Phalena) drastycznie podnosi ciśnienie w kanale nadgarstka i prowokuje objawy zespołu cieśni nadgarstka.',
    srsRegion: 'upper_limb',
  },
  {
    id: 'wrist_extension',
    jointGroup: 'wrist',
    jointLabelPl: 'Staw promieniowo-nadgarstkowy',
    namePl: 'Wyprost (zgięcie grzbietowe) nadgarstka',
    shortLabelPl: 'Wyprost grzbietowy',
    recommendedRegion: 'upper_limb_right',
    defaultSide: 'right',
    anchorBoneIds: ['radius', 'ossa_carpi'],
    planeId: 'sagittal',
    planeLabelPl: 'Płaszczyzna strzałkowa (S)',
    axisLabelPl: 'Oś poprzeczna nadgarstka',
    sftrCode: 'S: 50–0–60°',
    normRangePl: 'Wyprost grzbietowy: 50° (pierwsza cyfra w SFTR)',
    convexConcaveRulePl:
      'Wypukły bliższy szereg nadgarstka we wklęsłej panewce kości promieniowej: toczenie dogrzbietowo, ślizg w kierunku PRZECIWNYM — DŁONIOWO (dobrzusznie). Mobilizacja wyprostu po złamaniu Collesa: ślizg dłoniowy!',
    agonistIds: ['m_extensor_carpi_radialis_longus', 'm_extensor_digitorum'],
    synergistIds: ['m_brachioradialis'],
    antagonistIds: ['m_flexor_carpi_radialis', 'm_flexor_carpi_ulnaris'],
    clinicalTipPl:
      'Lekki wyprost nadgarstka (ok. 20°–30°) jest niezbędny do wygenerowania maksymalnej siły chwytu dłoni (efekt tenodezy) — dlatego jego utrata w porażeniu nerwu promieniowego osłabia nawet zginacze palców.',
    srsRegion: 'upper_limb',
  },

  // =========================================================================
  // 4. STAW BIODROWY — 5 RUCHÓW
  // =========================================================================
  {
    id: 'hip_flexion',
    jointGroup: 'hip',
    jointLabelPl: 'Staw biodrowy',
    namePl: 'Zgięcie stawu biodrowego',
    shortLabelPl: 'Zgięcie biodra',
    recommendedRegion: 'lower_limb_right',
    defaultSide: 'right',
    anchorBoneIds: ['os_coxae', 'femur'],
    planeId: 'sagittal',
    planeLabelPl: 'Płaszczyzna strzałkowa (S)',
    axisLabelPl: 'Oś poprzeczna przez głowę kości udowej',
    sftrCode: 'S: 15–0–125°',
    normRangePl: 'Zgięcie: 125° (ze zgiętym kolanem; wyprost 15°)',
    convexConcaveRulePl:
      'Wypukła głowa kości udowej we wklęsłej panewce miednicy: toczenie ku przodowi i górze, ślizg w kierunku PRZECIWNYM — DO TYŁU i DOOGONOWO (w dół). Mobilizacja zgięcia biodra: ślizg tylno-dolny.',
    agonistIds: ['m_iliopsoas', 'm_quadriceps_femoris'],
    synergistIds: ['m_sartorius', 'm_tensor_fasciae_latae', 'm_adductor_longus'],
    antagonistIds: ['m_gluteus_maximus', 'm_biceps_femoris', 'm_semitendinosus', 'm_semimembranosus'],
    lovettTestId: 'lovett_hip_flexion',
    clinicalTipPl:
      'Przykurcz zginaczy biodra (oceniany zmodyfikowanym testem Thomasa) zwiększa przodopochylenie miednicy i pogłębia lordozę lędźwiową.',
    srsRegion: 'pelvis_hip',
  },
  {
    id: 'hip_extension',
    jointGroup: 'hip',
    jointLabelPl: 'Staw biodrowy',
    namePl: 'Wyprost stawu biodrowego',
    shortLabelPl: 'Wyprost biodra',
    recommendedRegion: 'lower_limb_right',
    defaultSide: 'right',
    anchorBoneIds: ['os_coxae', 'femur'],
    planeId: 'sagittal',
    planeLabelPl: 'Płaszczyzna strzałkowa (S)',
    axisLabelPl: 'Oś poprzeczna przez głowę kości udowej',
    sftrCode: 'S: 15–0–125°',
    normRangePl: 'Wyprost: 15° (pierwsza cyfra w SFTR)',
    convexConcaveRulePl:
      'Wypukła głowa kości udowej we wklęsłej panewce: toczenie ku tyłowi, ślizg w kierunku PRZECIWNYM — DO PRZODU (dobrzusznie). Aby zwiększyć wyprost biodra, mobilizujemy głowę kości udowej ku przodowi!',
    agonistIds: ['m_gluteus_maximus', 'm_biceps_femoris', 'm_semitendinosus', 'm_semimembranosus'],
    synergistIds: ['m_adductor_magnus', 'm_gluteus_medius'],
    antagonistIds: ['m_iliopsoas', 'm_quadriceps_femoris', 'm_tensor_fasciae_latae'],
    lovettTestId: 'lovett_hip_extension',
    clinicalTipPl:
      'W badaniu Lovetta zgięcie kolana do 90° skraca (niewydolność czynna) mięśnie kulszowo-goleniowe, pozwalając precyzyjnie wyizolować siłę mięśnia pośladkowego wielkiego!',
    srsRegion: 'pelvis_hip',
  },
  {
    id: 'hip_abduction',
    jointGroup: 'hip',
    jointLabelPl: 'Staw biodrowy',
    namePl: 'Odwiedzenie stawu biodrowego',
    shortLabelPl: 'Odwiedzenie',
    recommendedRegion: 'lower_limb_right',
    defaultSide: 'right',
    anchorBoneIds: ['os_coxae', 'femur'],
    planeId: 'frontal',
    planeLabelPl: 'Płaszczyzna czołowa (F)',
    axisLabelPl: 'Oś strzałkowa przez głowę kości udowej',
    sftrCode: 'F: 45–0–25°',
    normRangePl: 'Odwiedzenie: 45° (przywiedzenie 25°)',
    convexConcaveRulePl:
      'Wypukła głowa kości udowej we wklęsłej panewce: toczenie bocznie i w górę, ślizg w kierunku PRZECIWNYM — DOOGONOWO (w dół). Mobilizacja odwiedzenia: trakcja i ślizg doogonowy.',
    agonistIds: ['m_gluteus_medius', 'm_gluteus_minimus'],
    synergistIds: ['m_tensor_fasciae_latae', 'm_piriformis', 'm_sartorius'],
    antagonistIds: ['m_adductor_longus', 'm_adductor_magnus', 'm_gracilis'],
    lovettTestId: 'lovett_hip_abduction',
    clinicalTipPl:
      'W fazie podporu chodu odwodziciele nie unoszą nogi w bok, lecz działają w łańcuchu zamkniętym — utrzymują poziom miednicy i zapobiegają dodatniemu objawowi Trendelenburga.',
    srsRegion: 'pelvis_hip',
  },
  {
    id: 'hip_adduction',
    jointGroup: 'hip',
    jointLabelPl: 'Staw biodrowy',
    namePl: 'Przywiedzenie stawu biodrowego',
    shortLabelPl: 'Przywiedzenie',
    recommendedRegion: 'lower_limb_right',
    defaultSide: 'right',
    anchorBoneIds: ['os_coxae', 'femur'],
    planeId: 'frontal',
    planeLabelPl: 'Płaszczyzna czołowa (F)',
    axisLabelPl: 'Oś strzałkowa przez głowę kości udowej',
    sftrCode: 'F: 45–0–25°',
    normRangePl: 'Przywiedzenie: 25° (ostatnia cyfra w SFTR)',
    convexConcaveRulePl:
      'Wypukła głowa kości udowej we wklęsłej panewce: toczenie przyśrodkowo, ślizg w kierunku PRZECIWNYM — DOGŁOWOWO (w górę i nieco bocznie).',
    agonistIds: ['m_adductor_longus', 'm_adductor_magnus', 'm_gracilis'],
    synergistIds: ['m_iliopsoas', 'm_gluteus_maximus'],
    antagonistIds: ['m_gluteus_medius', 'm_gluteus_minimus', 'm_tensor_fasciae_latae'],
    clinicalTipPl:
      'Przykurcz przywodzicieli ogranicza opadanie kolana w teście Patricka (FABER), a ich osłabienie w stosunku do odwodzicieli predysponuje piłkarzy do bólów pachwiny (test Squeeze).',
    srsRegion: 'pelvis_hip',
  },
  {
    id: 'hip_ext_rotation',
    jointGroup: 'hip',
    jointLabelPl: 'Staw biodrowy',
    namePl: 'Rotacja zewnętrzna stawu biodrowego',
    shortLabelPl: 'Rotacja zewn.',
    recommendedRegion: 'lower_limb_right',
    defaultSide: 'right',
    anchorBoneIds: ['os_coxae', 'femur'],
    planeId: 'transverse',
    planeLabelPl: 'Płaszczyzna poprzeczna (R)',
    axisLabelPl: 'Oś podłużna kości udowej',
    sftrCode: 'R(S90): 45–0–45°',
    normRangePl: 'Rotacja zewnętrzna: 45° (mierzona przy zgięciu biodra 90°)',
    convexConcaveRulePl:
      'Wypukła głowa kości udowej we wklęsłej panewce: toczenie ku tyłowi, ślizg w kierunku PRZECIWNYM — DO PRZODU (dobrzusznie).',
    agonistIds: ['m_piriformis', 'm_gluteus_maximus'],
    synergistIds: ['m_sartorius', 'm_iliopsoas', 'm_biceps_femoris'],
    antagonistIds: ['m_gluteus_minimus', 'm_gluteus_medius', 'm_tensor_fasciae_latae'],
    clinicalTipPl:
      'Ciekawostka biomechaniczna: mięsień gruszkowaty jest silnym rotatorem zewnętrznym w wyproście biodra (stąd rozciąga go test Freiberga!), ale powyżej 60°–90° zgięcia biodra zmienia funkcję na rotatora wewnętrznego!',
    srsRegion: 'pelvis_hip',
  },

  // =========================================================================
  // 5. STAW KOLANOWY — 2 RUCHY
  // =========================================================================
  {
    id: 'knee_extension',
    jointGroup: 'knee',
    jointLabelPl: 'Staw kolanowy',
    namePl: 'Wyprost stawu kolanowego',
    shortLabelPl: 'Wyprost kolana',
    recommendedRegion: 'lower_limb_right',
    defaultSide: 'right',
    anchorBoneIds: ['femur', 'tibia'],
    planeId: 'sagittal',
    planeLabelPl: 'Płaszczyzna strzałkowa (S)',
    axisLabelPl: 'Oś poprzeczna przez kłykcie kości udowej',
    sftrCode: 'S: 0–0–130°',
    normRangePl: 'Wyprost: 0° (zgięcie 130°)',
    convexConcaveRulePl:
      'Łańcuch otwarty (ruch goleni w siadzie): wklęsła piszczel na wypukłej kości udowej -> toczenie i ślizg W TYM SAMYM kierunku (DO PRZODU). Łańcuch zamknięty (wstawanie z przysiadu): wypukła kość udowa ślizga się PRZECIWNIE (do tyłu)!',
    agonistIds: ['m_quadriceps_femoris'],
    synergistIds: ['m_tensor_fasciae_latae'],
    antagonistIds: ['m_biceps_femoris', 'm_semitendinosus', 'm_semimembranosus', 'm_gastrocnemius', 'm_popliteus'],
    lovettTestId: 'lovett_knee_extension',
    clinicalTipPl:
      'W ostatnich 15°–20° wyprostu zachodzi automatyczny mechanizm ryglowania stawu (screw-home): rotacja zewnętrzna piszczeli (w łańcuchu otwartym) stabilizująca kolano bez wysiłku mięśniowego.',
    srsRegion: 'knee',
  },
  {
    id: 'knee_flexion',
    jointGroup: 'knee',
    jointLabelPl: 'Staw kolanowy',
    namePl: 'Zgięcie stawu kolanowego',
    shortLabelPl: 'Zgięcie kolana',
    recommendedRegion: 'lower_limb_right',
    defaultSide: 'right',
    anchorBoneIds: ['femur', 'tibia'],
    planeId: 'sagittal',
    planeLabelPl: 'Płaszczyzna strzałkowa (S)',
    axisLabelPl: 'Oś poprzeczna przez kłykcie kości udowej',
    sftrCode: 'S: 0–0–130°',
    normRangePl: 'Zgięcie: 130° (aktywne) / 140° (bierne)',
    convexConcaveRulePl:
      'Łańcuch otwarty: wklęsłe plateau piszczeli porusza się po wypukłych kłykciach uda -> toczenie i ślizg W TYM SAMYM kierunku (DO TYŁU). Mobilizacja zgięcia w leżeniu przodem: ślizg tylny piszczeli!',
    agonistIds: ['m_biceps_femoris', 'm_semitendinosus', 'm_semimembranosus'],
    synergistIds: ['m_gastrocnemius', 'm_sartorius', 'm_gracilis', 'm_popliteus'],
    antagonistIds: ['m_quadriceps_femoris'],
    clinicalTipPl:
      'Zgięcie z pełnego wyprostu musi zostać najpierw odblokowane przez mięsień podkolanowy („klucz kolana”), a w końcowej fazie zgięcia aktywne są także mięśnie gęsiej stopki i brzuchaty łydki.',
    srsRegion: 'knee',
  },

  // =========================================================================
  // 6. STAW SKOKOWY I STOPA — 4 RUCHY
  // =========================================================================
  {
    id: 'ankle_dorsiflexion',
    jointGroup: 'ankle_foot',
    jointLabelPl: 'Staw skokowy i stopa',
    namePl: 'Zgięcie grzbietowe (wyprost) stopy',
    shortLabelPl: 'Zgięcie grzbietowe',
    recommendedRegion: 'lower_limb_right',
    defaultSide: 'right',
    anchorBoneIds: ['tibia', 'talus'],
    planeId: 'sagittal',
    planeLabelPl: 'Płaszczyzna strzałkowa (S)',
    axisLabelPl: 'Oś poprzeczno-skośna przez obie kostki',
    sftrCode: 'S: 20–0–45°',
    normRangePl: 'Zgięcie grzbietowe (wyprost w SFTR): 20° (zgięcie podeszwowe 45–50°)',
    convexConcaveRulePl:
      'Wypukły bloczek kości skokowej we wklęsłych widełkach goleni: toczenie do przodu (palce w górę), ślizg w kierunku PRZECIWNYM — DO TYŁU! Mobilizacja zgięcia grzbietowego po skręceniu kostki: ślizg tylny kości skokowej.',
    agonistIds: ['m_tibialis_anterior'],
    synergistIds: ['m_peroneus_longus'],
    antagonistIds: ['m_gastrocnemius', 'm_soleus', 'm_tibialis_posterior'],
    extraSynergistPattern: /\bextensor\s+(hallucis|digitorum)\s+longus\b/i,
    lovettTestId: 'lovett_ankle_dorsi_plantar',
    clinicalTipPl:
      'Minimum 10° zgięcia grzbietowego przy wyproście kolana (test Silfverskiölda) jest niezbędne do prawidłowej fazy odbicia chodu — mniejszy zakres wymusza kompensacyjną nadpronację stopy.',
    srsRegion: 'lower_limb',
  },
  {
    id: 'ankle_plantarflexion',
    jointGroup: 'ankle_foot',
    jointLabelPl: 'Staw skokowy i stopa',
    namePl: 'Zgięcie podeszwowe stopy',
    shortLabelPl: 'Zgięcie podeszwowe',
    recommendedRegion: 'lower_limb_right',
    defaultSide: 'right',
    anchorBoneIds: ['tibia', 'talus'],
    planeId: 'sagittal',
    planeLabelPl: 'Płaszczyzna strzałkowa (S)',
    axisLabelPl: 'Oś poprzeczno-skośna przez obie kostki',
    sftrCode: 'S: 20–0–45°',
    normRangePl: 'Zgięcie podeszwowe: 45–50° (ostatnia cyfra w SFTR)',
    convexConcaveRulePl:
      'Wypukły bloczek kości skokowej we wklęsłych widełkach goleni: toczenie w dół/ku tyłowi, ślizg w kierunku PRZECIWNYM — DO PRZODU (dobrzusznie).',
    agonistIds: ['m_gastrocnemius', 'm_soleus'],
    synergistIds: ['m_tibialis_posterior', 'm_peroneus_longus', 'm_fibularis_brevis'],
    antagonistIds: ['m_tibialis_anterior'],
    lovettTestId: 'lovett_ankle_dorsi_plantar',
    clinicalTipPl:
      'W skali Lovetta stopień 5 dla zginaczy podeszwowych ocenia się w staniu jednonóż (wspięcia na palce), ponieważ ręczny opór fizjoterapeuty w leżeniu nie zrównoważy olbrzymiej siły mięśnia trójgłowego łydki.',
    srsRegion: 'lower_limb',
  },
  {
    id: 'ankle_inversion',
    jointGroup: 'ankle_foot',
    jointLabelPl: 'Staw skokowy i stopa',
    namePl: 'Odwracanie (inwersja / supinacja) stopy',
    shortLabelPl: 'Inwersja',
    recommendedRegion: 'lower_limb_right',
    defaultSide: 'right',
    anchorBoneIds: ['talus', 'calcaneus'],
    planeId: 'frontal',
    planeLabelPl: 'Płaszczyzna czołowo-skośna (T/R stawu podskokowego)',
    axisLabelPl: 'Oś skośna Henkego (przez staw podskokowy)',
    sftrCode: 'T/R: 40–0–20°',
    normRangePl: 'Odwracanie (supinacja / inwersja): 40° (nawracanie 20°)',
    convexConcaveRulePl:
      'W tylnym stawie podskokowym wypukła powierzchnia kości piętowej ślizga się na wklęsłej kości skokowej w kierunku PRZECIWNYM (bocznie) przy inwersji; w przednim wklęsła łódkowata ślizga się przyśrodkowo.',
    agonistIds: ['m_tibialis_posterior', 'm_tibialis_anterior'],
    synergistIds: ['m_gastrocnemius', 'm_soleus'],
    antagonistIds: ['m_peroneus_longus', 'm_fibularis_brevis'],
    clinicalTipPl:
      'Niekontrolowana, gwałtowna inwersja w zgięciu podeszwowym to klasyczny mechanizm ponad 85% skręceń stawu skokowego (uszkodzenie więzadła ATFL).',
    srsRegion: 'lower_limb',
  },
  {
    id: 'ankle_eversion',
    jointGroup: 'ankle_foot',
    jointLabelPl: 'Staw skokowy i stopa',
    namePl: 'Nawracanie (ewersja / pronacja) stopy',
    shortLabelPl: 'Ewersja',
    recommendedRegion: 'lower_limb_right',
    defaultSide: 'right',
    anchorBoneIds: ['talus', 'calcaneus'],
    planeId: 'frontal',
    planeLabelPl: 'Płaszczyzna czołowo-skośna (T/R stawu podskokowego)',
    axisLabelPl: 'Oś skośna Henkego (przez staw podskokowy)',
    sftrCode: 'T/R: 40–0–20°',
    normRangePl: 'Nawracanie (pronacja / ewersja): 20°',
    convexConcaveRulePl:
      'Podczas ewersji kość piętowa pochyla się koślawo (bocznie), a jej wypukła powierzchnia tylna ślizga się przyśrodkowo; fizjologiczna pronacja stopy w fazie amortyzacji chodu pochłania wstrząsy.',
    agonistIds: ['m_peroneus_longus', 'm_fibularis_brevis'],
    synergistIds: ['m_tibialis_anterior'],
    antagonistIds: ['m_tibialis_posterior', 'm_gastrocnemius'],
    clinicalTipPl:
      'Mięśnie strzałkowe (unerwione przez nerw strzałkowy powierzchowny) są głównymi dynamicznymi strażnikami chroniącymi staw skokowy przed nawracającymi skręceniami inwersyjnymi.',
    srsRegion: 'lower_limb',
  },

  // =========================================================================
  // 7. KRĘGOSŁUP I TUŁÓW — 2 RUCHY
  // =========================================================================
  {
    id: 'spine_trunk_flexion',
    jointGroup: 'spine',
    jointLabelPl: 'Kręgosłup i tułów',
    namePl: 'Zgięcie tułowia (skłon w przód)',
    shortLabelPl: 'Zgięcie tułowia',
    recommendedRegion: 'torso',
    defaultSide: 'both',
    anchorBoneIds: ['vertebrae_lumbales', 'sternum'],
    planeId: 'sagittal',
    planeLabelPl: 'Płaszczyzna strzałkowa (S)',
    axisLabelPl: 'Osie poprzeczne w krążkach międzykręgowych',
    sftrCode: 'S: 30–0–85° (Schober: +4–5 cm)',
    normRangePl: 'Zgięcie piersiowo-lędźwiowe: ok. 85° (wyprost 30°)',
    convexConcaveRulePl:
      'W stawach międzykręgowych (wyrostkowych) podczas zgięcia wyrostki stawowe dolne górnego kręgu ślizgają się obustronnie DO PRZODU I W GÓRĘ (otwieranie otworów międzykręgowych; jądro miażdżyste przesuwa się ku tyłowi).',
    agonistIds: ['m_rectus_abdominis', 'm_obliquus_externus_abdominis'],
    synergistIds: ['m_iliopsoas'],
    antagonistIds: ['m_erector_spinae', 'm_quadratus_lumborum'],
    lovettTestId: 'lovett_trunk_flexion',
    clinicalTipPl:
      'Otwieranie otworów międzykręgowych i poszerzanie kanału kręgowego w zgięciu tłumaczy, dlaczego pacjenci ze stenozą lędźwiową odczuwają ulgę przy pochyleniu nad wózkiem sklepowym!',
    srsRegion: 'spine_thorax',
  },
  {
    id: 'spine_trunk_extension',
    jointGroup: 'spine',
    jointLabelPl: 'Kręgosłup i tułów',
    namePl: 'Wyprost kręgosłupa (tułowia)',
    shortLabelPl: 'Wyprost tułowia',
    recommendedRegion: 'torso',
    defaultSide: 'both',
    anchorBoneIds: ['vertebrae_lumbales', 'sternum'],
    planeId: 'sagittal',
    planeLabelPl: 'Płaszczyzna strzałkowa (S)',
    axisLabelPl: 'Osie poprzeczne w krążkach międzykręgowych',
    sftrCode: 'S: 30–0–85°',
    normRangePl: 'Wyprost piersiowo-lędźwiowy: 30° (pierwsza cyfra w SFTR)',
    convexConcaveRulePl:
      'Podczas wyprostu kręgosłupa wyrostki stawowe dolne górnego kręgu ślizgają się obustronnie DO TYŁU I W DÓŁ (zamykanie stawów międzywyrostkowych i zwężanie otworów międzykręgowych; jądro miażdżyste przemieszcza się ku przodowi).',
    agonistIds: ['m_erector_spinae', 'm_quadratus_lumborum'],
    synergistIds: ['m_latissimus_dorsi', 'm_trapezius'],
    antagonistIds: ['m_rectus_abdominis', 'm_obliquus_externus_abdominis'],
    clinicalTipPl:
      'W dyskopatii lędźwiowej z uwypukleniem tylnym kontrolowany wyprost (preferencja kierunkowa McKenzie) często centralizuje ból promieniujący do nogi, natomiast w stenozie i zespole stawów międzykręgowych wyprost nasila objawy.',
    srsRegion: 'spine_thorax',
  },
];

export const BIOMECHANICS_MAP: Record<string, JointMovementProfile> = Object.fromEntries(
  BIOMECHANICS_MOVEMENTS.map((m) => [m.id, m]),
);

export function getMovementById(id?: string | null): JointMovementProfile | null {
  if (!id) return null;
  return BIOMECHANICS_MAP[id] ?? null;
}

export function getMovementsForMuscle(
  structureId?: string | null,
): Array<{ movement: JointMovementProfile; role: BiomechanicsMuscleRole }> {
  if (!structureId) return [];
  const results: Array<{ movement: JointMovementProfile; role: BiomechanicsMuscleRole }> = [];
  for (const m of BIOMECHANICS_MOVEMENTS) {
    if (m.agonistIds.includes(structureId)) {
      results.push({ movement: m, role: 'agonist' });
    } else if (m.synergistIds.includes(structureId)) {
      results.push({ movement: m, role: 'synergist' });
    } else if (m.antagonistIds.includes(structureId)) {
      results.push({ movement: m, role: 'antagonist' });
    }
  }
  return results;
}

export function resolveMuscleBiomechanicsRole(
  movement: JointMovementProfile,
  structureId?: string | null,
  rawMeshName?: string | null,
): BiomechanicsMuscleRole | null {
  const cleanName = rawMeshName ? rawMeshName.replace(/[_]+/g, ' ').trim() : '';

  if (
    (structureId && movement.agonistIds.includes(structureId)) ||
    (cleanName && movement.extraAgonistPattern?.test(cleanName))
  ) {
    return 'agonist';
  }
  if (
    (structureId && movement.synergistIds.includes(structureId)) ||
    (cleanName && movement.extraSynergistPattern?.test(cleanName))
  ) {
    return 'synergist';
  }
  if (
    (structureId && movement.antagonistIds.includes(structureId)) ||
    (cleanName && movement.extraAntagonistPattern?.test(cleanName))
  ) {
    return 'antagonist';
  }
  return null;
}

// =========================================================================
// BIOMECHANICS 3D MIXED QUIZ GENERATOR
// =========================================================================

export type BiomechanicsQuizScope = 'all' | 'upper' | 'lower_spine';
export type BiomechanicsQuizKind =
  | 'identify_movement_3d'
  | 'identify_antagonist_3d'
  | 'identify_sftr_plane';

export interface BiomechanicsQuizOption {
  id: string;
  label: string;
  subtitle?: string;
  isCorrect: boolean;
}

export interface BiomechanicsQuizQuestion {
  id: string;
  kind: BiomechanicsQuizKind;
  kindBadgePl: string;
  movement: JointMovementProfile;
  promptPl: string;
  /** Which muscle roles to glow on the 3D model before answering (maskedLabel = true) */
  showAgonists: boolean;
  showSynergists: boolean;
  showAntagonists: boolean;
  showPlaneHelper: boolean;
  options: BiomechanicsQuizOption[];
}

function shuffle<T>(list: T[]): T[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function buildBiomechanicsQuizQuestions(
  scope: BiomechanicsQuizScope,
  count: number,
): BiomechanicsQuizQuestion[] {
  const pool = BIOMECHANICS_MOVEMENTS.filter((m) => {
    if (scope === 'upper') {
      return (
        m.jointGroup === 'shoulder' ||
        m.jointGroup === 'elbow_forearm' ||
        m.jointGroup === 'wrist'
      );
    }
    if (scope === 'lower_spine') {
      return (
        m.jointGroup === 'hip' ||
        m.jointGroup === 'knee' ||
        m.jointGroup === 'ankle_foot' ||
        m.jointGroup === 'spine'
      );
    }
    return true;
  });

  const chosen = shuffle(pool).slice(0, Math.min(count, pool.length));
  const kindsCycle: BiomechanicsQuizKind[] = [
    'identify_movement_3d',
    'identify_antagonist_3d',
    'identify_sftr_plane',
  ];

  return chosen.map((movement, idx) => {
    const kind = kindsCycle[idx % kindsCycle.length];

    if (kind === 'identify_antagonist_3d') {
      const primaryAntagonistId = movement.antagonistIds[0];
      const primaryAntagonist = ANATOMY_MAP[primaryAntagonistId];
      const allCandidateMuscles = [
        ...movement.agonistIds,
        ...movement.synergistIds,
        ...BIOMECHANICS_MOVEMENTS.flatMap((other) =>
          other.jointGroup === movement.jointGroup ? other.agonistIds : [],
        ),
        'm_deltoideus',
        'm_quadriceps_femoris',
        'm_triceps_brachii',
        'm_gastrocnemius',
      ];
      const distractors = shuffle(
        [...new Set(allCandidateMuscles)].filter(
          (id) => !movement.antagonistIds.includes(id) && Boolean(ANATOMY_MAP[id]),
        ),
      ).slice(0, 3);

      const fmtLt = (lt?: string) => (lt ? lt.split(',')[0].trim().replace(/^./, (c) => c.toUpperCase()) : undefined);
      const options = shuffle([
        {
          id: primaryAntagonistId,
          label: primaryAntagonist?.namePl ?? primaryAntagonistId,
          subtitle: fmtLt(primaryAntagonist?.nameLt),
          isCorrect: true,
        },
        ...distractors.map((id) => ({
          id,
          label: ANATOMY_MAP[id]?.namePl ?? id,
          subtitle: fmtLt(ANATOMY_MAP[id]?.nameLt),
          isCorrect: false,
        })),
      ]);

      return {
        id: `biom_q_${idx}_${movement.id}_antag`,
        kind,
        kindBadgePl: 'Antagonista ruchu (3D)',
        movement,
        promptPl: `Na modelu 3D podświetlono mięśnie wykonujące ruch: ${movement.namePl} (${movement.jointLabelPl}). Który mięsień działa jako ANTAGONISTA tego ruchu?`,
        showAgonists: true,
        showSynergists: true,
        showAntagonists: false,
        showPlaneHelper: false,
        options,
      };
    }

    if (kind === 'identify_sftr_plane') {
      const correctCombo = `${movement.sftrCode} • ${movement.planeLabelPl}`;
      const distractorCandidates = shuffle(
        BIOMECHANICS_MOVEMENTS.filter(
          (other) =>
            other.id !== movement.id &&
            `${other.sftrCode} • ${other.planeLabelPl}` !== correctCombo,
        ),
      );
      const uniqueDistractors: JointMovementProfile[] = [];
      const seenLabels = new Set<string>([correctCombo]);
      for (const cand of distractorCandidates) {
        const lbl = `${cand.sftrCode} • ${cand.planeLabelPl}`;
        if (!seenLabels.has(lbl)) {
          seenLabels.add(lbl);
          uniqueDistractors.push(cand);
        }
        if (uniqueDistractors.length >= 3) break;
      }

      const options = shuffle([
        {
          id: movement.id,
          label: movement.sftrCode,
          subtitle: `${movement.planeLabelPl} • ${movement.axisLabelPl}`,
          isCorrect: true,
        },
        ...uniqueDistractors.map((d) => ({
          id: d.id,
          label: d.sftrCode,
          subtitle: `${d.planeLabelPl} • ${d.axisLabelPl}`,
          isCorrect: false,
        })),
      ]);

      return {
        id: `biom_q_${idx}_${movement.id}_sftr`,
        kind,
        kindBadgePl: 'Norma SFTR i płaszczyzna 3D',
        movement,
        promptPl: `Wskaż prawidłowy zapis normy SFTR i płaszczyznę ruchu dla: ${movement.namePl} (${movement.jointLabelPl}).`,
        showAgonists: true,
        showSynergists: false,
        showAntagonists: true,
        showPlaneHelper: true,
        options,
      };
    }

    // Default: identify_movement_3d — agonists glowing in emerald on 3D without spoiler label
    const sameJointOthers = pool.filter(
      (m) => m.id !== movement.id && m.jointGroup === movement.jointGroup,
    );
    const otherJoints = pool.filter(
      (m) => m.id !== movement.id && m.jointGroup !== movement.jointGroup,
    );
    const distractors = [...shuffle(sameJointOthers), ...shuffle(otherJoints)].slice(0, 3);

    const options = shuffle([
      {
        id: movement.id,
        label: movement.namePl,
        subtitle: movement.jointLabelPl,
        isCorrect: true,
      },
      ...distractors.map((d) => ({
        id: d.id,
        label: d.namePl,
        subtitle: d.jointLabelPl,
        isCorrect: false,
      })),
    ]);

    return {
      id: `biom_q_${idx}_${movement.id}_move`,
      kind: 'identify_movement_3d',
      kindBadgePl: 'Rozpoznaj ruch na 3D',
      movement,
      promptPl: `Który ruch stawowy wykonują główne mięśnie AGONISTYCZNE podświetlone na szmaragdowo na modelu 3D?`,
      showAgonists: true,
      showSynergists: false,
      showAntagonists: false,
      showPlaneHelper: true,
      options,
    };
  });
}
