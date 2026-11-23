/**
 * Clinical Dermatology & Myotome 3D Registry (15 key spinal root levels: C4–S2).
 * Maps each spinal nerve root to:
 * - Actual skin body-region meshes from Z-Anatomy skin.glb (129 named surface regions)
 * - Key indicator myotome muscles in ANATOMY_DB + body.glb
 * - Tendon reflexes, typical disc herniation level, radiculopathy signs, and provocation tests
 */

export type SpinalRootGroup = 'cervical' | 'thoracic' | 'lumbar' | 'sacral';

export interface DermatomeMyotomeLevel {
  id: string;
  labelPl: string;
  group: SpinalRootGroup;
  groupLabelPl: string;
  /** High-contrast clinical overlay color for 3D skin dermatome visualization */
  accentHex: string;
  /** Matches Z-Anatomy skin.glb surface region mesh names */
  skinRegionPatterns: RegExp[];
  /** Indicator myotome muscle structureIds present in ANATOMY_DB */
  myotomeMuscleIds: string[];
  /** Additional raw GLB muscle mesh pattern for distal myotome muscles without dedicated DB entries */
  extraMuscleMeshPattern?: RegExp;
  keyMusclePl: string;
  keyMovementPl: string;
  sensoryLandmarkPl: string;
  reflexPl: string;
  commonDiscLevelPl: string;
  radiculopathySignsPl: string;
  provocationTestsPl: string[];
  recommendedRegion: 'head_neck' | 'torso' | 'upper_limb_right' | 'lower_limb_right' | 'full_body';
}

export const DERMATOME_MYOTOME_LEVELS: DermatomeMyotomeLevel[] = [
  {
    id: 'C4',
    labelPl: 'Korzeń C4',
    group: 'cervical',
    groupLabelPl: 'Odcinek szyjny',
    accentHex: '#f59e0b',
    skinRegionPatterns: [
      /\b(greater|lesser)\s+supraclavicular\s+fossa\b/i,
      /\binfraclavicular\s+fossa\b/i,
      /\bdeltopectoral\s+triangle\b/i,
      /\blateral\s+region\s+of\s+neck\b/i,
      /\bscapular\s+region\b/i,
    ],
    myotomeMuscleIds: ['m_trapezius', 'm_levator_scapulae'],
    extraMuscleMeshPattern: /\bdiaphragm\b/i,
    keyMusclePl: 'Mięsień czworoboczny (część górna), dźwigacz łopatki i przepona',
    keyMovementPl: 'Unoszenie obręczy barkowej (wzruszanie ramionami) oraz praca przepony',
    sensoryLandmarkPl: 'Szczyt stawu barkowo-obojczykowego i dół nadobojczykowy (okolica „naramiennika”).',
    reflexPl: 'Brak typowego odruchu głębokiego.',
    commonDiscLevelPl: 'Krążek międzykręgowy C3–C4',
    radiculopathySignsPl: 'Ból podstawy szyi i szczytu barku, osłabienie unoszenia barku; przy ciężkim ucisku na poziomie C3–C5 możliwe osłabienie oddechu przeponowego.',
    provocationTestsPl: ['Test Spurlinga', 'Test unoszenia barków przeciw oporowi'],
    recommendedRegion: 'full_body',
  },
  {
    id: 'C5',
    labelPl: 'Korzeń C5',
    group: 'cervical',
    groupLabelPl: 'Odcinek szyjny',
    accentHex: '#ef4444',
    skinRegionPatterns: [
      /\bdeltoid\s+region\b/i,
      /\blateral\s+bicipital\s+groove\b/i,
      /\banterior\s+region\s+of\s+arm\b/i,
    ],
    myotomeMuscleIds: ['m_deltoideus', 'm_supraspinatus', 'm_infraspinatus', 'm_biceps_brachii'],
    keyMusclePl: 'Mięsień naramienny oraz dwugłowy ramienia',
    keyMovementPl: 'Odwodzenie ramienia w stawie ramiennym i zgięcie łokcia',
    sensoryLandmarkPl: 'Boczna powierzchnia barku i ramienia aż do bocznego dołu łokciowego (obszar nad m. naramiennym).',
    reflexPl: 'Odruch ze ścięgna mięśnia dwugłowego ramienia (C5–C6).',
    commonDiscLevelPl: 'Krążek międzykręgowy C4–C5',
    radiculopathySignsPl: 'Ból promieniujący z szyi na boczną stronę barku i ramienia, trudność w odwodzeniu ramienia oraz osłabienie odruchu z bicepsa.',
    provocationTestsPl: ['Test Spurlinga', 'Test dystrakcji szyjnej', 'Badanie odwodzenia ramienia (Lovett)'],
    recommendedRegion: 'upper_limb_right',
  },
  {
    id: 'C6',
    labelPl: 'Korzeń C6',
    group: 'cervical',
    groupLabelPl: 'Odcinek szyjny',
    accentHex: '#f97316',
    skinRegionPatterns: [
      /\blateral\s+border\s+of\s+forearm\b/i,
      /\bradial\s+foveola\b/i,
      /\banterior\s+region\s+of\s+forearm\b/i,
    ],
    myotomeMuscleIds: ['m_extensor_carpi_radialis_longus', 'm_brachioradialis', 'm_biceps_brachii'],
    extraMuscleMeshPattern: /\bextensor\s+carpi\s+radialis\s+brevis\b/i,
    keyMusclePl: 'Prostowniki promieniowe nadgarstka i mięsień ramienno-promieniowy',
    keyMovementPl: 'Wyprost nadgarstka oraz zgięcie łokcia (w pozycji neutralnej)',
    sensoryLandmarkPl: 'Promieniowy (boczny) brzeg przedramienia, tabakierka anatomiczna, kciuk i palec wskazujący.',
    reflexPl: 'Odruch ramienno-promieniowy (z wyrostka rylcowatego kości promieniowej) oraz z bicepsa.',
    commonDiscLevelPl: 'Krążek międzykręgowy C5–C6 (jedna z najczęstszych dyskopatii szyjnych)',
    radiculopathySignsPl: 'Drętwienie kciuka i bocznego brzegu przedramienia, osłabienie wyprostu nadgarstka i zgięcia łokcia; wymaga różnicowania z zespołem cieśni nadgarstka.',
    provocationTestsPl: ['Test Spurlinga', 'ULNT 1 (neurodynamika nerwu pośrodkowego)', 'Test wyprostu nadgarstka'],
    recommendedRegion: 'upper_limb_right',
  },
  {
    id: 'C7',
    labelPl: 'Korzeń C7',
    group: 'cervical',
    groupLabelPl: 'Odcinek szyjny',
    accentHex: '#eab308',
    skinRegionPatterns: [
      /\bposterior\s+region\s+of\s+arm\b/i,
      /\bposterior\s+region\s+of\s+elbow\b/i,
      /\bposterior\s+region\s+of\s+forearm\b/i,
      /\bdorsum\s+of\s+hand\b/i,
      /\bdorsal\s+surfaces\s+of\s+digits\s+of\s+hand\b/i,
    ],
    myotomeMuscleIds: ['m_triceps_brachii', 'm_flexor_carpi_radialis', 'm_extensor_digitorum'],
    keyMusclePl: 'Mięsień trójgłowy ramienia, zginacze nadgarstka i prostowniki palców',
    keyMovementPl: 'Wyprost stawu łokciowego, zgięcie nadgarstka i wyprost palców',
    sensoryLandmarkPl: 'Tylna powierzchnia ramienia i przedramienia, środek grzbietu ręki oraz palec środkowy (III).',
    reflexPl: 'Odruch ze ścięgna mięśnia trójgłowego ramienia (C7).',
    commonDiscLevelPl: 'Krążek międzykręgowy C6–C7 (najczęstsza radikulopatia szyjna!)',
    radiculopathySignsPl: 'Ból tylnej strony ramienia i łopatki z mrowieniem palca środkowego, osłabienie wyprostu łokcia oraz osłabiony odruch z tricepsa.',
    provocationTestsPl: ['Test Spurlinga', 'Objaw odwiedzenia barku (ulga po położeniu dłoni na głowie)', 'Odruch z tricepsa'],
    recommendedRegion: 'upper_limb_right',
  },
  {
    id: 'C8',
    labelPl: 'Korzeń C8',
    group: 'cervical',
    groupLabelPl: 'Odcinek szyjny',
    accentHex: '#10b981',
    skinRegionPatterns: [
      /\bmedial\s+border\s+of\s+forearm\b/i,
      /\bposterior\s+region\s+of\s+wrist\b/i,
      /\banterior\s+region\s+of\s+wrist\b/i,
      /\bpalm\b/i,
      /\bpalmar\s+surfaces\s+of\s+digits\s+of\s+hand\b/i,
    ],
    myotomeMuscleIds: ['m_flexor_carpi_ulnaris'],
    extraMuscleMeshPattern: /\b(flexor\s+digitorum\s+(profundus|superficialis)|flexor\s+pollicis\s+longus)\b/i,
    keyMusclePl: 'Zginacze długie palców (głęboki i powierzchowny) oraz zginacz łokciowy nadgarstka',
    keyMovementPl: 'Zgięcie palców (siła chwytu pięści) i odchylenie łokciowe nadgarstka',
    sensoryLandmarkPl: 'Łokciowy brzeg dalszego przedramienia, kłębik oraz palec IV (połowa łokciowa) i V.',
    reflexPl: 'Brak standardowego odruchu głębokiego (ew. odruch ze zginaczy palców / objaw Trömnera wg fizjoterapeuty.pl).',
    commonDiscLevelPl: 'Krążek międzykręgowy C7–Th1',
    radiculopathySignsPl: 'Osłabienie siły chwytu dłoni oraz drętwienie małego i serdecznego palca — wymaga różnicowania z zespołem rowka nerwu łokciowego i zespołem TOS.',
    provocationTestsPl: ['Test Spurlinga', 'ULNT 3 (nerw łokciowy)', 'Test siły chwytu palców'],
    recommendedRegion: 'upper_limb_right',
  },
  {
    id: 'Th1',
    labelPl: 'Korzeń Th1',
    group: 'thoracic',
    groupLabelPl: 'Odcinek piersiowy',
    accentHex: '#14b8a6',
    skinRegionPatterns: [
      /\bmedial\s+bicipital\s+groove\b/i,
      /\banterior\s+region\s+of\s+elbow\b/i,
      /\bcubital\s+fossa\b/i,
      /\bmedial\s+border\s+of\s+forearm\b/i,
    ],
    myotomeMuscleIds: ['m_flexor_carpi_ulnaris'],
    extraMuscleMeshPattern: /\b(interosse.*hand|abductor\s+digiti\s+minimi.*hand|adductor\s+pollicis|abductor\s+pollicis\s+brevis)\b/i,
    keyMusclePl: 'Drobne mięśnie wewnętrzne ręki (międzykostne, kłębu i kłębika)',
    keyMovementPl: 'Odwodzenie i przywodzenie palców ręki (rozszerzanie i złączanie palców)',
    sensoryLandmarkPl: 'Przyśrodkowa powierzchnia ramienia i łokcia (okolica nadkłykcia przyśrodkowego).',
    reflexPl: 'Brak typowego odruchu głębokiego.',
    commonDiscLevelPl: 'Krążek międzykręgowy Th1–Th2 lub ucisk dolnego pnia splotu (TOS)',
    radiculopathySignsPl: 'Zanik drobnych mięśni dłoni i niezgrabność ruchów precyzyjnych (zapinanie guzików); zawsze należy wykluczyć zespół górnego otworu klatki piersiowej (TOS).',
    provocationTestsPl: ['Test odwodzenia palców przeciw oporowi', 'Test Adsona i Wrighta (TOS)'],
    recommendedRegion: 'upper_limb_right',
  },
  {
    id: 'Th4',
    labelPl: 'Korzeń Th4',
    group: 'thoracic',
    groupLabelPl: 'Odcinek piersiowy',
    accentHex: '#22c55e',
    skinRegionPatterns: [
      /\bmammary\s+region\b/i,
      /\bpresternal\s+region\b/i,
      /\bpectoral\s+region\b/i,
      /\binterscapular\s+region\b/i,
    ],
    myotomeMuscleIds: ['m_erector_spinae'],
    extraMuscleMeshPattern: /\bintercostal\b/i,
    keyMusclePl: 'Mięśnie międzyżebrowe i prostownik grzbietu odcinka piersiowego',
    keyMovementPl: 'Stabilizacja klatki piersiowej i ruchomość oddechowa żeber',
    sensoryLandmarkPl: 'Linia brodawek sutkowych z przodu oraz przestrzeń międzyłopatkowa z tyłu (punkt orientacyjny T4).',
    reflexPl: 'Brak (poziom czuciowy w badaniu neurologicznym rdzenia).',
    commonDiscLevelPl: 'Segment piersiowy Th4–Th5',
    radiculopathySignsPl: 'Opasujący ból międzyżebrowy na wysokości linii sutkowej; wymaga różnicowania z bólem wieńcowym, chorobą płuc oraz półpaścem.',
    provocationTestsPl: ['Badanie czucia w linii brodawek sutkowych', 'Ocena ruchomości klatki piersiowej'],
    recommendedRegion: 'torso',
  },
  {
    id: 'Th10',
    labelPl: 'Korzeń Th10',
    group: 'thoracic',
    groupLabelPl: 'Odcinek piersiowy',
    accentHex: '#84cc16',
    skinRegionPatterns: [
      /\bumbilical\s+region\b/i,
      /\bumbilicus\b/i,
      /\blateral\s+region\s+of\s+abdomen\b/i,
      /\binfrascapular\s+region\b/i,
    ],
    myotomeMuscleIds: ['m_rectus_abdominis', 'm_obliquus_externus_abdominis'],
    keyMusclePl: 'Mięsień prosty brzucha i skośne brzucha (część środkowo-dolna)',
    keyMovementPl: 'Zgięcie tułowia i kontrola ciśnienia śródbrzusznego (objaw Beevora)',
    sensoryLandmarkPl: 'Pas skórny na wysokości pępka (kluczowy punkt orientacyjny T10 w badaniu rdzenia).',
    reflexPl: 'Odruchy skórne brzuszne (Th8–Th12).',
    commonDiscLevelPl: 'Segment piersiowy Th10–Th11',
    radiculopathySignsPl: 'Przesunięcie pępka ku górze podczas uniesienia głowy w leżeniu tyłem (dodatni objaw Beevora) świadczy o osłabieniu dolnej części mięśnia prostego brzucha poniżej Th10.',
    provocationTestsPl: ['Objaw Beevora (uniesienie głowy w leżeniu tyłem)', 'Badanie czucia na linii pępka'],
    recommendedRegion: 'torso',
  },
  {
    id: 'L1',
    labelPl: 'Korzeń L1',
    group: 'lumbar',
    groupLabelPl: 'Odcinek lędźwiowy',
    accentHex: '#a3e635',
    skinRegionPatterns: [
      /\binguinal\s+region\b/i,
      /\bhypogastric\s+region\b/i,
      /\blumbar\s+region\b/i,
    ],
    myotomeMuscleIds: ['m_iliopsoas', 'm_quadratus_lumborum'],
    keyMusclePl: 'Mięsień biodrowo-lędźwiowy (część górna) i czworoboczny lędźwi',
    keyMovementPl: 'Inicjacja zgięcia stawu biodrowego',
    sensoryLandmarkPl: 'Pas pachwinowy wzdłuż więzadła pachwinowego oraz górna część pośladka.',
    reflexPl: 'Odruch mięśnia dźwigacza jądra (L1–L2).',
    commonDiscLevelPl: 'Krążek międzykręgowy Th12–L1 / L1–L2',
    radiculopathySignsPl: 'Ból i zaburzenia czucia w pachwinie promieniujące z pogranicza piersiowo-lędźwiowego (często mylone z patologią stawu biodrowego lub przepukliną pachwinową).',
    provocationTestsPl: ['Test napięciowy nerwu udowego (PKB)', 'Palpacja przejścia Th12–L1'],
    recommendedRegion: 'torso',
  },
  {
    id: 'L2',
    labelPl: 'Korzeń L2',
    group: 'lumbar',
    groupLabelPl: 'Odcinek lędźwiowy',
    accentHex: '#facc15',
    skinRegionPatterns: [
      /\bfemoral\s+triangle\b/i,
      /\bhip\s+region\b/i,
      /\banterior\s+region\s+of\s+thigh\b/i,
    ],
    myotomeMuscleIds: ['m_iliopsoas', 'm_sartorius', 'm_adductor_longus'],
    keyMusclePl: 'Mięsień biodrowo-lędźwiowy oraz przywodziciele uda',
    keyMovementPl: 'Zgięcie stawu biodrowego (unoszenie kolana w siadzie przeciw oporowi)',
    sensoryLandmarkPl: 'Przednio-górna i przyśrodkowa powierzchnia uda (trójkąt udowy).',
    reflexPl: 'Brak typowego odruchu ścięgnistego (częściowo odruch z przywodzicieli).',
    commonDiscLevelPl: 'Krążek międzykręgowy L1–L2 / L2–L3',
    radiculopathySignsPl: 'Osłabienie zgięcia biodra (trudność przy wsiadaniu do auta i wchodzeniu na wysoki stopień) oraz parestezje górnej części przedniego uda.',
    provocationTestsPl: ['Test napięciowy nerwu udowego (PKB w leżeniu przodem)', 'Lovett — zgięcie biodra'],
    recommendedRegion: 'lower_limb_right',
  },
  {
    id: 'L3',
    labelPl: 'Korzeń L3',
    group: 'lumbar',
    groupLabelPl: 'Odcinek lędźwiowy',
    accentHex: '#fb923c',
    skinRegionPatterns: [
      /\banterior\s+region\s+of\s+thigh\b/i,
      /\banterior\s+region\s+of\s+knee\b/i,
    ],
    myotomeMuscleIds: ['m_quadriceps_femoris', 'm_adductor_longus', 'm_adductor_magnus', 'm_gracilis'],
    keyMusclePl: 'Mięsień czworogłowy uda oraz przywodziciele uda',
    keyMovementPl: 'Wyprost stawu kolanowego i przywodzenie uda',
    sensoryLandmarkPl: 'Dalsza przednio-przyśrodkowa część uda i przednio-przyśrodkowa powierzchnia kolana (kłykieć przyśrodkowy kości udowej).',
    reflexPl: 'Odruch z więzadła rzepki / kolanowy (L3–L4).',
    commonDiscLevelPl: 'Krążek międzykręgowy L2–L3 / L3–L4',
    radiculopathySignsPl: 'Ból promieniujący do przedniej strony kolana, uczucie „uciekania” kolana podczas schodzenia ze schodów oraz osłabienie czworogłowego.',
    provocationTestsPl: ['Test napięciowy nerwu udowego (PKB)', 'Odruch kolanowy (L3–L4)'],
    recommendedRegion: 'lower_limb_right',
  },
  {
    id: 'L4',
    labelPl: 'Korzeń L4',
    group: 'lumbar',
    groupLabelPl: 'Odcinek lędźwiowy',
    accentHex: '#f43f5e',
    skinRegionPatterns: [
      /\banterior\s+region\s+of\s+knee\b/i,
      /\banterior\s+region\s+of\s+leg\b/i,
      /\bmedial\s+malleolus\b/i,
      /\bmedial\s+border\s+of\s+foot\b/i,
      /\bmedial\s+part\s+of\s+longitudinal\s+arch\s+of\s+foot\b/i,
    ],
    myotomeMuscleIds: ['m_tibialis_anterior', 'm_quadriceps_femoris'],
    keyMusclePl: 'Mięsień piszczelowy przedni (wskaźnikowy) i czworogłowy uda',
    keyMovementPl: 'Zgięcie grzbietowe i inwersja stopy (chód na piętach) + wyprost kolana',
    sensoryLandmarkPl: 'Przyśrodkowa strona podudzia, kostka przyśrodkowa i przyśrodkowy brzeg stopy.',
    reflexPl: 'Odruch kolanowy z więzadła rzepki (głównie L4!).',
    commonDiscLevelPl: 'Krążek międzykręgowy L3–L4 (lub boczna przepuklina L4–L5)',
    radiculopathySignsPl: 'Osłabienie zgięcia grzbietowego stopy, osłabiony lub zniesiony odruch kolanowy oraz drętwienie wzdłuż przyśrodkowej krawędzi piszczeli i kostki przyśrodkowej.',
    provocationTestsPl: ['Odruch z więzadła rzepki', 'Chód na piętach', 'Test PKB / Lasègue’a'],
    recommendedRegion: 'lower_limb_right',
  },
  {
    id: 'L5',
    labelPl: 'Korzeń L5',
    group: 'lumbar',
    groupLabelPl: 'Odcinek lędźwiowy',
    accentHex: '#e11d48',
    skinRegionPatterns: [
      /\banterior\s+region\s+of\s+leg\b/i,
      /\banterior\s+region\s+of\s+ankle\b/i,
      /\bdorsum\s+of\s+foot\b/i,
      /\bdorsal\s+surfaces\s+of\s+digits\s+of\s+foot\b/i,
      /\bhallucial\s+eminence\b/i,
      /\bmetatarsal\s+region\b/i,
    ],
    myotomeMuscleIds: ['m_tibialis_anterior', 'm_tibialis_posterior', 'm_gluteus_medius', 'm_gluteus_minimus'],
    extraMuscleMeshPattern: /\b(extensor\s+hallucis\s+longus|extensor\s+digitorum\s+longus)\b/i,
    keyMusclePl: 'Prostownik długi palucha (EHL), piszczelowy przedni, piszczelowy tylny, strzałkowe i pośladkowy średni',
    keyMovementPl: 'Wyprost (zgięcie grzbietowe) palucha, chód na piętach i odwodzenie biodra',
    sensoryLandmarkPl: 'Przednio-boczna strona podudzia, grzbiet stopy oraz paluch (I palec) i palce II–III.',
    reflexPl: 'Brak pewnego odruchu standardowego (ew. ze ścięgna piszczelowego tylnego / przyśrodkowych kulszowo-goleniowych).',
    commonDiscLevelPl: 'Krążek międzykręgowy L4–L5 (jedna z najczęstszych dyskopatii lędźwiowych!)',
    radiculopathySignsPl: 'Klasyczna rwa kulszowa z drętwieniem grzbietu stopy i palucha, opadaniem stopy/palucha przy chodzeniu na piętach oraz możliwym objawem Trendelenburga.',
    provocationTestsPl: ['Test Lasègue’a (SLR)', 'Test Slump', 'Wyprost palucha przeciw oporowi', 'Chód na piętach'],
    recommendedRegion: 'lower_limb_right',
  },
  {
    id: 'S1',
    labelPl: 'Korzeń S1',
    group: 'sacral',
    groupLabelPl: 'Odcinek krzyżowy',
    accentHex: '#d97706',
    skinRegionPatterns: [
      /\bposterior\s+region\s+of\s+leg\b/i,
      /\blateral\s+malleolus\b/i,
      /\blateral\s+retromalleolar\s+region\b/i,
      /\blateral\s+border\s+of\s+foot\b/i,
      /\bheel\s+region\b/i,
      /\bsole\b/i,
      /\bplantar\s+surfaces\s+of\s+digits\s+of\s+foot\b/i,
    ],
    myotomeMuscleIds: ['m_gastrocnemius', 'm_soleus', 'm_peroneus_longus', 'm_fibularis_brevis', 'm_gluteus_maximus'],
    keyMusclePl: 'Mięsień trójgłowy łydki (brzuchaty i płaszczkowaty), mięśnie strzałkowe i pośladkowy wielki',
    keyMovementPl: 'Zgięcie podeszwowe stopy (wspięcie na palce), ewersja stopy i wyprost biodra',
    sensoryLandmarkPl: 'Tylna strona łydki, kostka boczna, pięta, podeszwa i boczny brzeg stopy (V palec).',
    reflexPl: 'Odruch skokowy ze ścięgna Achillesa (głównie S1!).',
    commonDiscLevelPl: 'Krążek międzykręgowy L5–S1 (najczęstsza rwa z wypadniętym odruchem Achillesa)',
    radiculopathySignsPl: 'Ból tylnej strony uda i łydki sięgający do pięty i małego palca, trudność we wspięciu jednonóż na palce oraz osłabiony lub zniesiony odruch ze ścięgna Achillesa.',
    provocationTestsPl: ['Test Lasègue’a (SLR)', 'Test Slump', 'Wspięcie jednonóż na palce', 'Odruch ze ścięgna Achillesa'],
    recommendedRegion: 'lower_limb_right',
  },
  {
    id: 'S2',
    labelPl: 'Korzeń S2',
    group: 'sacral',
    groupLabelPl: 'Odcinek krzyżowy',
    accentHex: '#059669',
    skinRegionPatterns: [
      /\bgluteal\s+region\b/i,
      /\bgluteal\s+fold\b/i,
      /\bposterior\s+region\s+of\s+thigh\b/i,
      /\bpopliteal\s+fossa\b/i,
      /\bsacral\s+region\b/i,
    ],
    myotomeMuscleIds: ['m_biceps_femoris', 'm_semitendinosus', 'm_semimembranosus'],
    extraMuscleMeshPattern: /\b(flexor\s+digitorum\s+longus|flexor\s+hallucis\s+longus)\b/i,
    keyMusclePl: 'Mięśnie kulszowo-goleniowe oraz drobne zginacze palców stopy',
    keyMovementPl: 'Zgięcie kolana oraz zgięcie podeszwowe palców stopy',
    sensoryLandmarkPl: 'Tylno-przyśrodkowa strona uda, dół podkolanowy oraz fałd pośladkowy i okolica krzyżowa.',
    reflexPl: 'Częściowo odruch skokowy (S1–S2).',
    commonDiscLevelPl: 'Masywna centralna przepuklina L5–S1 / ucisk korzeni krzyżowych',
    radiculopathySignsPl: 'Pionowy pas zaburzeń czucia z tyłu uda i pod kolanem; współwystępowanie znieczulenia krocza (S3–S5) i zaburzeń zwieraczy to alarmowy zespół ogona końskiego!',
    provocationTestsPl: ['Test Slump', 'Badanie czucia tylnej strony uda i okolicy krocza (czerwona flaga)'],
    recommendedRegion: 'lower_limb_right',
  },
];

const DERMATOME_BY_ID = new Map<string, DermatomeMyotomeLevel>(
  DERMATOME_MYOTOME_LEVELS.map((d) => [d.id, d]),
);

export function getDermatomeLevelById(rootId?: string | null): DermatomeMyotomeLevel | null {
  if (!rootId) return null;
  return DERMATOME_BY_ID.get(rootId) ?? null;
}

export function doesSkinMeshMatchDermatome(
  level: DermatomeMyotomeLevel,
  rawMeshName?: string | null,
): boolean {
  if (!rawMeshName) return false;
  const clean = rawMeshName
    .replace(/[_]+/g, ' ')
    .replace(/\.(r|l)$/i, '')
    .replace(/\.?\d{3}$/, '')
    .trim();
  return level.skinRegionPatterns.some((re) => re.test(clean));
}

export function doesMuscleMeshMatchMyotome(
  level: DermatomeMyotomeLevel,
  meshStructureId?: string | null,
  rawMeshName?: string | null,
): boolean {
  if (meshStructureId && level.myotomeMuscleIds.includes(meshStructureId)) {
    return true;
  }
  if (rawMeshName && level.extraMuscleMeshPattern) {
    const clean = rawMeshName.replace(/[_]+/g, ' ').trim();
    if (level.extraMuscleMeshPattern.test(clean)) return true;
  }
  return false;
}

export interface DermatomeQuizQuestion {
  id: string;
  target: DermatomeMyotomeLevel;
  options: DermatomeMyotomeLevel[];
  prompt: string;
}

export type DermatomeQuizScope = 'all' | 'upper' | 'lower';

export function buildDermatomeQuizQuestions(
  scope: DermatomeQuizScope,
  count: number,
  displayMode: 'both' | 'dermatome' | 'myotome',
): DermatomeQuizQuestion[] {
  const pool = DERMATOME_MYOTOME_LEVELS.filter((lvl) => {
    if (scope === 'upper') return lvl.group === 'cervical' || lvl.id === 'Th1';
    if (scope === 'lower') return lvl.group === 'lumbar' || lvl.group === 'sacral';
    return true;
  });

  // Fisher-Yates shuffle
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const chosen = shuffled.slice(0, Math.min(count, shuffled.length));
  return chosen.map((target, idx) => {
    const sameGroup = pool.filter((l) => l.id !== target.id && l.group === target.group);
    const others = pool.filter((l) => l.id !== target.id && l.group !== target.group);
    const distractorCandidates = [...sameGroup, ...others];
    for (let i = distractorCandidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [distractorCandidates[i], distractorCandidates[j]] = [
        distractorCandidates[j],
        distractorCandidates[i],
      ];
    }
    const opts = [target, ...distractorCandidates.slice(0, 3)];
    // Sort options anatomically by canonical index in DERMATOME_MYOTOME_LEVELS for clear clinical presentation
    opts.sort(
      (a, b) =>
        DERMATOME_MYOTOME_LEVELS.findIndex((x) => x.id === a.id) -
        DERMATOME_MYOTOME_LEVELS.findIndex((x) => x.id === b.id),
    );
    const prompt =
      displayMode === 'dermatome'
        ? 'Któremu korzeniowi rdzeniowemu odpowiada podświetlony na modelu 3D obszar skóry (dermatom)?'
        : displayMode === 'myotome'
          ? 'Który korzeń rdzeniowy zaopatruje podświetloną na modelu 3D grupę mięśniową (miotom)?'
          : 'Któremu korzeniowi rdzeniowemu odpowiadają podświetlone na modelu 3D strefa skóry (dermatom) i mięśnie (miotom)?';
    return {
      id: `derm_q_${idx}_${target.id}`,
      target,
      options: opts,
      prompt,
    };
  });
}
