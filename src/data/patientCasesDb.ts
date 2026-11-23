import type {
  AnatomicalLayerId,
  DermatomeDisplayMode,
  PatientCaseRegionGroup,
} from '../types/anatomy';
import type { RegionalModelKey } from '../components/AnatomyViewport3D';

export interface PatientStageMcq {
  promptPl: string;
  options: string[];
  correctIndex: number;
  explanationPl: string;
}

export interface PatientStage2Neuro extends PatientStageMcq {
  /** Optional 3D dermatome/myotome highlight shown masked during questioning */
  dermatomeRootId?: string;
  dermatomeMode?: DermatomeDisplayMode;
  /** Optional 3D nerve-muscle highlight shown during questioning */
  nerveId?: string;
  /** Clinical exam note displayed alongside the 3D neuro view */
  neuroContextPl: string;
}

export interface PatientStage3Test {
  promptPl: string;
  /** 4 real test IDs from CLINICAL_TESTS_DB (first matching correctTestId is graded right) */
  optionTestIds: string[];
  correctTestId: string;
  /** What the therapist observes when performing the right test on this specific patient */
  patientFindingPl: string;
  explanationPl: string;
}

export interface PatientStage4Locate3D {
  promptPl: string;
  hintPl: string;
  targetStructureId: string;
  acceptedStructureIds: string[];
  visibleLayers: Partial<Record<AnatomicalLayerId, boolean>>;
  explanationPl: string;
}

export interface PatientCaseScenario {
  id: string;
  regionGroup: PatientCaseRegionGroup;
  regionLabelPl: string;
  region3D: RegionalModelKey;
  titlePl: string;
  subtitlePl: string;
  difficulty: 'podstawowy' | 'średni' | 'zaawansowany';
  isRedFlagCase?: boolean;
  patientCard: {
    initialsAndAge: string;
    occupation: string;
    chiefComplaint: string;
    duration: string;
    vasPain: string;
    quotePl: string;
  };
  stage1Interview: PatientStageMcq;
  stage2Neuro: PatientStage2Neuro;
  stage3Test: PatientStage3Test;
  stage4Locate3D: PatientStage4Locate3D;
  stage5Plan: PatientStageMcq & {
    finalDiagnosisPl: string;
  };
}

export const PATIENT_CASE_REGION_META: Array<{
  id: PatientCaseRegionGroup | 'all';
  label: string;
}> = [
  { id: 'all', label: 'Wszystkie (12)' },
  { id: 'shoulder', label: 'Bark' },
  { id: 'knee', label: 'Kolano' },
  { id: 'spine', label: 'Kręgosłup i rwa' },
  { id: 'hip_pelvis', label: 'Biodro i miednica' },
  { id: 'upper_limb', label: 'Kończyna górna' },
  { id: 'lower_limb', label: 'Stopa i podudzie' },
];

export const PATIENT_CASES_DB: PatientCaseScenario[] = [
  // =========================================================================
  // 1. BARK — KONFLIKT PODBARKOWY (IMPINGEMENT)
  // =========================================================================
  {
    id: 'case_shoulder_impingement',
    regionGroup: 'shoulder',
    regionLabelPl: 'Bark',
    region3D: 'upper_limb_right',
    titlePl: 'Bolesny łuk odwiedzenia u malarza pokojowego',
    subtitlePl: 'Zespół ciasnoty podbarkowej i tendinopatia stożka rotatorów',
    difficulty: 'podstawowy',
    patientCard: {
      initialsAndAge: 'M.K., 46 lat',
      occupation: 'Malarz / praca z rękami nad głową',
      chiefComplaint: 'Kłujący ból przednio-bocznej części prawego barku przy unoszeniu ręki',
      duration: '7 tygodni (narastający podstępnie)',
      vasPain: '6/10 przy sięganiu na półkę, 2/10 w spoczynku',
      quotePl:
        '„Najgorzej boli dokładnie w połowie podnoszenia ręki bokiem, gdy maluję sufit, i kiedy śpię na prawym boku. Ręka nie drętwieje aż do palców.”',
    },
    stage1Interview: {
      promptPl:
        'Który element wywiadu najsilniej wskazuje na mechaniczny konflikt w przestrzeni podbarkowej, a jednocześnie pomaga wstępnie wykluczyć czerwoną flagę naczyniowo-trzewną lub złamanie?',
      options: [
        'Ból nasilany ściśle w zakresie bolesnego łuku (60°–120°) przy pracy nad głową, bez urazu, gorączki, utraty masy ciała i objawów z klatki piersiowej',
        'Każdy ból barku trwający ponad 4 tygodnie oznacza bezwzględną czerwoną flagę nowotworową',
        'Ból przy leżeniu na chorym boku wyklucza jakąkolwiek patologię stożka rotatorów i kaletki',
        'Brak drętwienia palców całkowicie wyklucza potrzebę badania odcinka szyjnego',
      ],
      correctIndex: 0,
      explanationPl:
        'Klasyczny bolesny łuk (60°–120°) związany z powtarzalnym unoszeniem ramienia ponad głowę bez objawów ogólnych i bez ostrego urazu jest typowy dla zespołu ciasnoty podbarkowej. Mimo braku parestezji warto przesiewowo ocenić odcinek szyjny.',
    },
    stage2Neuro: {
      dermatomeRootId: 'C5',
      dermatomeMode: 'both',
      neuroContextPl:
        'Na modelu 3D podświetlono obszar czuciowy i mięśnie wskaźnikowe kluczowego poziomu szyjnego, z którym zawsze różnicuje się ból bocznej części barku. U pacjenta czucie w tej strefie oraz odruch z bicepsa są zachowane.',
      promptPl:
        'Który korzeń rdzeniowy (pokazany na 3D) zaopatruje czuciowo boczną powierzchnię ramienia nad mięśniem naramiennym oraz odwiedzenie barku, stanowiąc główne różnicowanie dla lokalnego konfliktu podbarkowego?',
      options: ['Korzeń C5', 'Korzeń C7', 'Korzeń C8', 'Korzeń Th1'],
      correctIndex: 0,
      explanationPl:
        'Korzeń C5 odpowiada za dermatom okolicy naramiennej, miotom odwiedzenia ramienia (m. naramienny i m. nadgrzebieniowy) oraz odruch z mięśnia dwugłowego ramienia. Prawidłowe czucie i odruch u tego pacjenta przemawiają za problemem lokalnym w barku.',
    },
    stage3Test: {
      promptPl:
        'Który test ortopedyczny (klasyczny element klastra diagnostycznego ciasnoty podbarkowej) prowokuje ucisk ścięgna i kaletki pod wyrostkiem barkowym poprzez bierne zgięcie ramienia w przód z ustabilizowaną łopatką?',
      optionTestIds: ['test_neer', 'test_gerber_liftoff', 'test_spurling', 'test_phalen_tinel'],
      correctTestId: 'test_neer',
      patientFindingPl:
        'Wynik DODATNI: przy stabilizacji łopatki i zdecydowanym biernym wznosie ramienia w przód w płaszczyźnie łopatki pacjent zgłasza dokładne odtworzenie kłującego bólu w końcowym zakresie ruchu (również dodatni test Hawkinsa-Kennedy’ego i Jobe’a).',
      explanationPl:
        'Według standardów klinicznych (m.in. fizjoterapeuty.pl) test Neera wywołuje ciasnotę pod sklepieniem kruczo-barkowym. Najwyższą wartość diagnostyczną daje łączenie go w klaster z testem Hawkinsa-Kennedy’ego, bolesnym łukiem i testem Jobe’a.',
    },
    stage4Locate3D: {
      promptPl:
        'Wskaż kliknięciem na modelu 3D główny mięsień stożka rotatorów (lub leżącą bezpośrednio nad nim kaletkę podbarkową), który ulega uciskowi w przestrzeni podbarkowej.',
      hintPl:
        'Spójrz na górną część łopatki (dół nadgrzebieniowy) i przestrzeń bezpośrednio pod wyrostkiem barkowym.',
      targetStructureId: 'm_supraspinatus',
      acceptedStructureIds: ['m_supraspinatus', 'bursa_subacromialis'],
      visibleLayers: {
        bone: true,
        cartilage: true,
        muscle: true,
        bursa: true,
        tendon: true,
        ligament: false,
        artery: false,
        vein: false,
        nerve: false,
        organ: false,
        skin: false,
      },
      explanationPl:
        'Ścięgno mięśnia nadgrzebieniowego oraz kaletka podbarkowa przebiegają w wąskiej przestrzeni między głową kości ramiennej a wyrostkiem barkowym i więzadłem kruczo-barkowym — to najczęstsze miejsce konfliktu podbarkowego.',
    },
    stage5Plan: {
      finalDiagnosisPl: 'Zespół ciasnoty podbarkowej z tendinopatią mięśnia nadgrzebieniowego',
      promptPl:
        'Jaki jest najważniejszy priorytet fizjoterapii opartej na dowodach (EBM) w pierwszych tygodniach postępowania u tego pacjenta?',
      options: [
        'Modyfikacja obciążeń nad głową, ćwiczenia kontroli łopatki (m. zębaty przedni, dolny czworoboczny) oraz stopniowo progresowany trening wzmacniający stożka rotatorów',
        'Bezwzględne unieruchomienie barku w temblaku na 6 tygodni bez żadnych ruchów',
        'Natychmiastowe skierowanie na pilną operację dekompresji w trybie ostrego dyżuru',
        'Wyłącznie bierne rozciąganie w bolesnym zakresie końcowego wznosu powyżej 140°',
      ],
      correctIndex: 0,
      explanationPl:
        'Leczeniem pierwszego wyboru w zespole bólu podbarkowego jest kinezyterapia celowana: czasowe ograniczenie drażniących prac nad głową, reedukacja rytmu łopatkowo-ramiennego oraz progresywne obciążanie stożka rotatorów (izometria -> ćwiczenia oporowe).',
    },
  },

  // =========================================================================
  // 2. BARK — ŁOPATKA SKRZYDŁOWATA (NERW PIERSIOWY DŁUGI)
  // =========================================================================
  {
    id: 'case_shoulder_winging',
    regionGroup: 'shoulder',
    regionLabelPl: 'Bark',
    region3D: 'torso',
    titlePl: 'Odstająca łopatka po długim noszeniu ciężkiego plecaka',
    subtitlePl: 'Neuropatia uciskowa nerwu piersiowego długiego i łopatka skrzydłowata',
    difficulty: 'średni',
    patientCard: {
      initialsAndAge: 'A.S., 27 lat',
      occupation: 'Przewodnik górski / student AWF',
      chiefComplaint: 'Brak możliwości pełnego uniesienia prawego ramienia i widoczne odstawanie łopatki',
      duration: '3 tygodnie po kilkudniowym marszu z ciężkim plecakiem',
      vasPain: '3/10 (tępe pobolewanie okolicy międzyłopatkowej, dominuje osłabienie)',
      quotePl:
        '„Po zejściu ze szlaku zauważyłem w lustrze, że prawa łopatka mocno odstaje od pleców jak skrzydło, a ręki nie mogę podnieść wyżej niż do poziomu barku.”',
    },
    stage1Interview: {
      promptPl:
        'Co w wywiadzie tłumaczy najbardziej prawdopodobny mechanizm uszkodzenia i wyklucza ostry uraz kostny?',
      options: [
        'Długotrwały ucisk i trakcja pasem plecaka w okolicy szyjno-pachowej (neuropatia przeciążeniowa) przy braku upadku, gorączki i bólu nocnego',
        'Złamanie obojczyka zawsze przebiega całkowicie bez urazu i bez bólu miejscowego',
        'Odstawanie łopatki po marszu z plecakiem wynika wyłącznie z uszkodzenia stawu łokciowego',
        'Objaw ten stanowi czerwoną flagę wymagającą natychmiastowej operacji w ciągu 6 godzin',
      ],
      correctIndex: 0,
      explanationPl:
        'Długi, powierzchowny przebieg nerwu piersiowego długiego wzdłuż bocznej ściany klatki piersiowej czyni go wyjątkowo podatnym na ucisk przez pasy ciężkiego plecaka (tzw. porażenie plecakowe) lub gwałtowną trakcję podczas sportów nadgłowowych.',
    },
    stage2Neuro: {
      nerveId: 'n_thoracicus_longus',
      neuroContextPl:
        'Na modelu 3D podświetlono szlak ruchowy badanej jednostki nerwowo-mięśniowej (korzenie C5–C7). W badaniu czucie skórne kończyny górnej jest w pełni prawidłowe — nerw ma charakter czysto ruchowy.',
      promptPl:
        'Który nerw splotu ramiennego uległ porażeniu, powodując przyśrodkowe odstawanie łopatki nasilające się przy zgięciu ramienia w przód?',
      options: [
        'Nerw piersiowy długi (C5–C7)',
        'Nerw łokciowy (C8–Th1)',
        'Nerw pachowy (C5–C6)',
        'Nerw mięśniowo-skórny (C5–C7)',
      ],
      correctIndex: 0,
      explanationPl:
        'Nerw piersiowy długi (C5–C7) unerwia wyłącznie mięsień zębaty przedni. Jego porażenie powoduje klasyczną przyśrodkową łopatkę skrzydłowatą i brak możliwości uniesienia ramienia powyżej 90°–110° przez utratę rotacji górnej łopatki.',
    },
    stage3Test: {
      promptPl:
        'Który test funkcjonalny najlepiej uwidacznia niewydolność mięśnia zębatego przedniego i przyśrodkową łopatkę skrzydłowatą?',
      optionTestIds: [
        'kin_wall_pushup_serratus',
        'test_hawkins_kennedy',
        'test_speed_yergason',
        'test_obrien_slap',
      ],
      correctTestId: 'kin_wall_pushup_serratus',
      patientFindingPl:
        'Wynik DODATNI: podczas nacisku dłońmi na ścianę przy wyprostowanych łokciach brzeg przyśrodkowy i kąt dolny prawej łopatki wyraźnie odrywają się od klatki piersiowej, a łopatka przesuwa się przyśrodkowo i ku górze.',
      explanationPl:
        'Test pompki przy ścianie (Wall Push-Up) obciąża protrakcję i docisk łopatki do klatki piersiowej — w porażeniu nerwu piersiowego długiego natychmiast ujawnia wyraźne odstawanie brzegu przyśrodkowego.',
    },
    stage4Locate3D: {
      promptPl:
        'Wskaż kliknięciem na modelu 3D tułowia mięsień odpowiadający za protrakcję, rotację górną i docisk łopatki do klatki piersiowej.',
      hintPl:
        'Obróć model tułowia bokiem — szukaj ząbkowanego mięśnia rozciągającego się na bocznej powierzchni żeber (I–IX) pod łopatką.',
      targetStructureId: 'm_serratus_anterior',
      acceptedStructureIds: ['m_serratus_anterior'],
      visibleLayers: {
        bone: true,
        cartilage: true,
        muscle: true,
        bursa: false,
        tendon: false,
        ligament: false,
        artery: false,
        vein: false,
        nerve: false,
        organ: false,
        skin: false,
      },
      explanationPl:
        'Mięsień zębaty przedni przyczepia się do żeber I–IX oraz brzegu przyśrodkowego łopatki. Jako główny stabilizator łopatki umożliwia płynne unoszenie ramienia powyżej poziomu barku.',
    },
    stage5Plan: {
      finalDiagnosisPl: 'Łopatka skrzydłowata wtórna do neuropraksji nerwu piersiowego długiego',
      promptPl:
        'Jakie postępowanie fizjoterapeutyczne jest najbardziej uzasadnione w okresie regeneracji nerwu (neuropraksji)?',
      options: [
        'Ochrona przed nadmiernym rozciąganiem nerwu i mięśnia, utrzymanie pełnego biernego zakresu ruchu barku, aktywacja zębatego przedniego w odciążeniu (np. leżenie tyłem „punch”) i kontrola EMG przy braku poprawy',
        'Ciężkie wyciskanie sztangi nad głowę mimo braku stabilizacji łopatki',
        'Całkowite unikanie jakiegokolwiek ruchu w stawie ramiennym przez 6 miesięcy',
        'Wyłącznie głęboki masaż poprzeczny mięśnia dwugłowego ramienia',
      ],
      correctIndex: 0,
      explanationPl:
        'Większość pourazowych/uciskowych neuropatii nerwu piersiowego długiego to neuropraksje regenerujące się w 6–12 miesięcy. Kluczowe jest zapobieganie przykurczowi torebki stawowej, unikanie obciążania plecakiem i bezpieczna reedukacja protrakcji łopatki.',
    },
  },

  // =========================================================================
  // 3. KOLANO — ZERWANIE ACL
  // =========================================================================
  {
    id: 'case_knee_acl',
    regionGroup: 'knee',
    regionLabelPl: 'Kolano',
    region3D: 'lower_limb_right',
    titlePl: 'Bezkontaktowy uraz skrętny kolana z trzaskiem na boisku',
    subtitlePl: 'Ostre uszkodzenie więzadła krzyżowego przedniego (ACL)',
    difficulty: 'podstawowy',
    patientCard: {
      initialsAndAge: 'K.W., 23 lata',
      occupation: 'Piłkarz amator / student',
      chiefComplaint: 'Uczucie „uciekania” kolana oraz masywny obrzęk narastający w 3 godziny po urazie',
      duration: '5 dni po urazie podczas gwałtownego hamowania i zwodu',
      vasPain: '5/10 przy obciążaniu, silny lęk przed niestabilnością',
      quotePl:
        '„Zatrzymałem się ostro na prawej nodze, kolano poszło do środka i usłyszałem głośny trzask. Jeszcze tego samego wieczoru było jak balon, a teraz czuję, jakby piszczel uciekała mi do przodu.”',
    },
    stage1Interview: {
      promptPl:
        'Która kombinacja objawów z wywiadu najsilniej wskazuje na uszkodzenie więzadła krzyżowego przedniego (ACL), a co jednocześnie wymaga oceny w ramach reguł Ottawskich kolana?',
      options: [
        'Mechanizm bezkontaktowy (hamowanie + koślawienie + rotacja), słyszalny trzask i szybki krwisty wysięk (<4 h); reguły Ottawskie oceniają ryzyko współistniejącego złamania kości',
        'Szybki obrzęk w 3 godziny świadczy zawsze wyłącznie o łagodnym naciągnięciu skóry',
        'Brak kontaktu z przeciwnikiem wyklucza zerwanie więzadła krzyżowego przedniego',
        'Trzask w stawie kolanowym zawsze oznacza wyłącznie uszkodzenie ścięgna Achillesa',
      ],
      correctIndex: 0,
      explanationPl:
        'Triada z wywiadu (bezkontaktowe hamowanie z koślawieniem, słyszalny „pop” i szybki krwiak śródstawowy w 2–6 h) ma bardzo wysoką wartość predykcyjną dla zerwania ACL. Przed badaniem manualnym zawsze stosujemy przesiewowe reguły Ottawskie kolana.',
    },
    stage2Neuro: {
      nerveId: 'n_fibularis_communis',
      neuroContextPl:
        'Po każdym wysokoenergetycznym urazie kolana sprawdzamy stan naczyniowo-nerwowy (tętno na stopie oraz podświetlony na 3D nerw biegnący wokół szyjki strzałki). U pacjenta czucie grzbietu stopy i zgięcie grzbietowe stopy są prawidłowe.',
      promptPl:
        'Który nerw obwodowy (widoczny na 3D po bocznej stronie kolana) jest szczególnie narażony przy ciężkich urazach więzadłowych i zwichnięciach kolana, powodując opadanie stopy?',
      options: [
        'Nerw strzałkowy wspólny',
        'Nerw zasłonowy',
        'Nerw pośladkowy górny',
        'Nerw pachowy',
      ],
      correctIndex: 0,
      explanationPl:
        'Nerw strzałkowy wspólny owija się powierzchownie wokół szyjki kości strzałkowej. Brak deficytu zgięcia grzbietowego stopy i zachowane tętno obwodowe wykluczają ostre powikłanie naczyniowo-nerwowe.',
    },
    stage3Test: {
      promptPl:
        'Który test ortopedyczny (uznawany za najczulszy w ostrej i przewlekłej fazie po urazie, wykonywany w 15°–30° zgięcia kolana) najlepiej ocenia ciągłość więzadła krzyżowego przedniego?',
      optionTestIds: ['test_lachman', 'test_mcmurray', 'test_thompson', 'kin_ely'],
      correctTestId: 'test_lachman',
      patientFindingPl:
        'Wynik DODATNI: w zgięciu 20° wyraźna zwiększona translacja przednia kości piszczelowej względem uda w porównaniu ze stroną zdrową oraz brak twardego punktu zatrzymania (tzw. miękki endpoint).',
      explanationPl:
        'Test Lachmana (15°–30° zgięcia) minimalizuje ochronne napięcie kulszowo-goleniowych i jest najczulszym testem klinicznym ACL. W diagnostyce łączy się go w klaster z testem Pivot-Shift (najwyższa swoistość dla niestabilności rotacyjnej).',
    },
    stage4Locate3D: {
      promptPl:
        'Wskaż kliknięciem na modelu 3D uszkodzone więzadło wewnątrzstawowe ograniczające nadmierną translację przednią piszczeli.',
      hintPl:
        'Przybliż wnętrze stawu kolanowego (dół międzykłykciowy) — mięśnie zostały wyłączone, aby odsłonić więzadła kolana.',
      targetStructureId: 'acl',
      acceptedStructureIds: ['acl'],
      visibleLayers: {
        bone: true,
        cartilage: true,
        muscle: false,
        bursa: false,
        tendon: false,
        ligament: true,
        artery: false,
        vein: false,
        nerve: false,
        organ: false,
        skin: false,
      },
      explanationPl:
        'Więzadło krzyżowe przednie (ACL) biegnie od wewnętrznej powierzchni kłykcia bocznego kości udowej ku przodowi i przyśrodkowo do pola międzykłykciowego przedniego piszczeli — jest głównym stabilizatorem przednio-rotacyjnym kolana.',
    },
    stage5Plan: {
      finalDiagnosisPl: 'Ostre uszkodzenie więzadła krzyżowego przedniego (ACL) prawego stawu kolanowego',
      promptPl:
        'Co jest absolutnym priorytetem wczesnej fizjoterapii przedoperacyjnej (prehabilitacji) lub zachowawczej w pierwszych 2–3 tygodniach po urazie ACL?',
      options: [
        'Redukcja wysięku, odzyskanie pełnego symetrycznego wyprostu kolana (0°), aktywacja mięśnia czworogłowego uda i chód bez utykania',
        'Natychmiastowy powrót do gry w piłkę nożną i gwałtownych zwrotów po 7 dniach',
        'Utrzymywanie kolana w stałym przykurczu zgięciowym 30° przez 4 tygodnie',
        'Całkowity zakaz napinania mięśnia czworogłowego uda przez pierwszy miesiąc',
      ],
      correctIndex: 0,
      explanationPl:
        '„Spokojne kolano” (brak wysięku, pełny bierny wyprost 0°, sprawny m. czworogłowy) jest kluczowym czynnikiem determinującym wynik zarówno leczenia zachowawczego, jak i rekonstrukcji ACL (zmniejsza ryzyko artrofibrozy).',
    },
  },

  // =========================================================================
  // 4. KOLANO — USZKODZENIE ŁĄKOTKI PRZYŚRODKOWEJ
  // =========================================================================
  {
    id: 'case_knee_meniscus',
    regionGroup: 'knee',
    regionLabelPl: 'Kolano',
    region3D: 'lower_limb_right',
    titlePl: 'Ból przyśrodkowej szpary stawowej i przeskakiwanie przy kucaniu',
    subtitlePl: 'Uszkodzenie łąkotki przyśrodkowej stawu kolanowego',
    difficulty: 'podstawowy',
    patientCard: {
      initialsAndAge: 'P.N., 38 lat',
      occupation: 'Mechanik samochodowy (częsta praca w głębokim przysiadzie)',
      chiefComplaint: 'Kłujący ból od wewnętrznej strony prawego kolana oraz okresowe blokowanie wyprostu',
      duration: '10 dni od nagłego wstania ze skręconego przysiadu',
      vasPain: '7/10 przy kucaniu i skręcie na obciążonej stopie',
      quotePl:
        '„Wstałem z przysiadu ze skręconym tułowiem, coś mnie ostro zakłuło od środka kolana. Następnego dnia kolano spuchło i czasami czuję, jakby coś blokowało mi pełne wyprostowanie nogi.”',
    },
    stage1Interview: {
      promptPl:
        'Która cecha z wywiadu odróżnia typowe uszkodzenie łąkotki od ostrego zerwania ACL oraz nakazuje pilną ocenę ortopedyczną przy utrzymującym się mechanicznym bloku?',
      options: [
        'Uraz skrętny w obciążonym zgięciu, opóźniony wysięk (po 12–24 h), tkliwość przyśrodkowej szpary stawowej oraz mechaniczne blokowanie/przeskakiwanie kolana',
        'Opóźniony wysięk po 24 godzinach oznacza zawsze złamanie otwarte kości udowej',
        'Ból przy kucaniu wyklucza jakiekolwiek uszkodzenie łąkotki przyśrodkowej',
        'Mechaniczne zablokowanie kolana (tzw. rączka od wiadra) zawsze ustępuje po forsownym biegu',
      ],
      correctIndex: 0,
      explanationPl:
        'Łąkotki są słabo unaczynione (strefa czerwono-biała/biała), dlatego wysięk narasta wolniej (12–24 h) niż krwisty wysięk w zerwaniu ACL (<4 h). Prawdziwy mechaniczny blok wyprostu (np. uszkodzenie typu „rączka od wiadra”) wymaga pilnej konsultacji ortopedycznej.',
    },
    stage2Neuro: {
      dermatomeRootId: 'L4',
      dermatomeMode: 'dermatome',
      neuroContextPl:
        'Na modelu 3D podświetlono dermatom biegnący po przednio-przyśrodkowej stronie kolana i podudzia aż do kostki przyśrodkowej. W badaniu czucie i odruch rzepkowy są prawidłowe, co wyklucza korzeniowe źródło bólu kolana.',
      promptPl:
        'Który korzeń rdzeniowy (pokazany na 3D) zaopatruje czuciowo przyśrodkową stronę kolana i podudzia oraz odpowiada za odruch kolanowy (rzepkowy)?',
      options: ['Korzeń L4', 'Korzeń S1', 'Korzeń L1', 'Korzeń S2'],
      correctIndex: 0,
      explanationPl:
        'Korzeń L4 zaopatruje przyśrodkową stronę podudzia/kolana, mięsień czworogłowy uda i piszczelowy przedni oraz odruch rzepkowy. Wykluczenie radikulopatii L4 potwierdza miejscowe źródło bólu w stawie kolanowym.',
    },
    stage3Test: {
      promptPl:
        'Który klasyczny test w leżeniu przodem z kolanem zgiętym do 90° różnicuje uszkodzenie łąkotek (ból podczas KOMPRESJI i rotacji) od uszkodzeń więzadłowo-torebkowych (ból podczas TRAKCJI)?',
      optionTestIds: [
        'test_apley_knee',
        'test_lachman',
        'test_valgus_varus_knee',
        'kin_ober',
      ],
      correctTestId: 'test_apley_knee',
      patientFindingPl:
        'Wynik DODATNI dla łąkotki przyśrodkowej: silny ból w przyśrodkowej szparze stawowej przy osiowej KOMPRESJI z rotacją zewnętrzną podudzia; wyraźna ulga podczas TRAKCJI (dodatnie są również test McMurraya i test Thessaly).',
      explanationPl:
        'Test Apleya (kompresyjno-dystrakcyjny, opisany m.in. na fizjoterapeuty.pl) stanowi świetny element klastra łąkotkowego obok testów McMurraya, Thessaly i palpacji szpary stawowej.',
    },
    stage4Locate3D: {
      promptPl:
        'Wskaż kliknięciem na modelu 3D strukturę chrzęstno-włóknistą w kształcie litery „C” po przyśrodkowej stronie stawu kolanowego.',
      hintPl:
        'Przybliż szparę stawową kolana od strony przyśrodkowej (wewnętrznej, nad piszczelą) — więzadła i łąkotki są włączone.',
      targetStructureId: 'meniscus_medialis',
      acceptedStructureIds: ['meniscus_medialis'],
      visibleLayers: {
        bone: true,
        cartilage: true,
        muscle: false,
        bursa: false,
        tendon: false,
        ligament: true,
        artery: false,
        vein: false,
        nerve: false,
        organ: false,
        skin: false,
      },
      explanationPl:
        'Łąkotka przyśrodkowa jest zrośnięta z więzadłem pobocznym piszczelowym (MCL) i mniej ruchoma niż boczna, dlatego znacznie częściej ulega rozerwaniu podczas skrętu na zgiętym, obciążonym kolanie.',
    },
    stage5Plan: {
      finalDiagnosisPl: 'Uszkodzenie łąkotki przyśrodkowej prawego stawu kolanowego',
      promptPl:
        'Jak zaplanujesz dalsze postępowanie kliniczne i fizjoterapeutyczne u tego pacjenta?',
      options: [
        'Kontrola wysięku, unikanie głębokich skrętnych przysiadów, wzmacnianie czworogłowego i pośladków w bezpiecznym zakresie; przy utrzymującym się mechanicznym bloku wyprostu — pilna konsultacja ortopedyczna (MRI / szew łąkotki)',
        'Forsowne wymuszanie głębokiego przysiadu z obciążeniem w celu „rozruszania” bloku',
        'Rutynowa manipulacja dużym impetem w skręcie goleni przy podejrzeniu zablokowanej łąkotki',
        'Wyłącznie masaż stopy bez badania zakresu wyprostu kolana',
      ],
      correctIndex: 0,
      explanationPl:
        'W stabilnych uszkodzeniach łąkotki leczeniem z wyboru jest dobrze prowadzona fizjoterapia. Jeśli jednak występuje prawdziwy mechaniczny blok wyprostu, konieczna jest szybka ocena ortopedyczna pod kątem naprawy (szycia) łąkotki.',
    },
  },

  // =========================================================================
  // 5. KRĘGOSŁUP — RADIKULOPATIA L5 (DYSKOPATIA L4–L5)
  // =========================================================================
  {
    id: 'case_spine_l5_radiculopathy',
    regionGroup: 'spine',
    regionLabelPl: 'Kręgosłup i rwa',
    region3D: 'lower_limb_right',
    titlePl: 'Promieniujący ból do grzbietu stopy i osłabienie unoszenia palucha',
    subtitlePl: 'Przepuklina krążka L4–L5 z radikulopatią korzenia L5',
    difficulty: 'średni',
    patientCard: {
      initialsAndAge: 'T.Z., 42 lata',
      occupation: 'Kierowca zawodowy (8–10 h siedzenia dziennie)',
      chiefComplaint: 'Ostry, rwący ból od pośladka po bocznej stronie podudzia aż do grzbietu stopy i palucha',
      duration: '12 dni po podnoszeniu ciężkiej skrzynki w skłonie',
      vasPain: '7/10 podczas siedzenia i kaszlu, 4/10 przy krótkim chodzeniu',
      quotePl:
        '„Prąd schodzi mi z lędźwi bokiem łydki na sam grzbiet stopy i duży palec. Zauważyłem, że ciężko mi chodzić na pięcie prawej nogi, ale z pęcherzem i czuciem w kroczu wszystko jest zupełnie normalnie.”',
    },
    stage1Interview: {
      promptPl:
        'Jak oceniasz bezpieczeństwo pacjenta na podstawie wywiadu w kontekście czerwonych flag kręgosłupa?',
      options: [
        'Brak zaburzeń zwieraczy, brak znieczulenia siodłowego, brak gorączki i urazu wysokoenergetycznego — brak ostrych czerwonych flag; można przeprowadzić pełne badanie neurologiczne i neurodynamiczne',
        'Każdy ból promieniujący poniżej kolana jest bezwzględną czerwoną flagą wymagającą wezwania karetki',
        'Nasilenie bólu przy kaszlu oznacza wyłącznie naciągnięcie mięśni brzucha',
        'Brak bólu w klatce piersiowej zwalnia fizjoterapeutę z badania siły mięśniowej stopy',
      ],
      correctIndex: 0,
      explanationPl:
        'Przesiew czerwonych flag (zwieracze, czucie siodłowe, szybki postępujący niedowład, gorączka, nowotwór) wypadł ujemnie. Nasilenie bólu przy siedzeniu i kaszlu (wzrost ciśnienia śródkanałowego) jest klasyczne dla konfliktu dyskowo-korzeniowego.',
    },
    stage2Neuro: {
      dermatomeRootId: 'L5',
      dermatomeMode: 'both',
      neuroContextPl:
        'Na modelu 3D podświetlono dokładnie obszar zaburzeń czucia pacjenta (przednio-boczne podudzie, grzbiet stopy i paluch) oraz osłabione mięśnie wskaźnikowe (m. prostownik długi palucha, m. piszczelowy przedni i m. pośladkowy średni). Odruch rzepkowy i skokowy są zachowane.',
      promptPl:
        'Ucisk którego korzenia nerwowego odpowiada za podświetlony na 3D dermatom i miotom oraz trudność w chodzeniu na piętach?',
      options: ['Korzeń L5', 'Korzeń S1', 'Korzeń L2', 'Korzeń L3'],
      correctIndex: 0,
      explanationPl:
        'Korzeń L5 (typowo uciskany w przepuklinie krążka L4–L5) zaopatruje czuciowo przednio-boczne podudzie, grzbiet stopy i paluch oraz ruchowo prostowanie palucha, zgięcie grzbietowe stopy i odwiedzenie biodra (chód na piętach utrudniony).',
    },
    stage3Test: {
      promptPl:
        'Podczas testu Lasègue’a (SLR) ból pojawił się przy 45° uniesienia nogi. Który test różnicujący potwierdza prawdziwe podrażnienie korzenia (odróżniając je od przykurczu mięśni kulszowo-goleniowych)?',
      optionTestIds: ['test_bragard', 'test_faber_patrick', 'kin_thomas', 'test_gillet_sij'],
      correctTestId: 'test_bragard',
      patientFindingPl:
        'Wynik DODATNI: po opuszczeniu nogi z 45° do ok. 38° (do ustąpienia bólu) bierne zgięcie grzbietowe stopy natychmiast odtwarza ostry ból promieniujący do grzbietu stopy (dodatni również test Slump).',
      explanationPl:
        'Test Bragarda (opisany m.in. na fizjoterapeuty.pl) napina struktury nerwowe bez zmiany długości mięśni kulszowo-goleniowych — nawrót promieniującego bólu po zgięciu grzbietowym stopy potwierdza podrażnienie korzenia L4–S1.',
    },
    stage4Locate3D: {
      promptPl:
        'Wskaż kliknięciem na modelu 3D mięsień przedniej komory podudzia (miotom L4–L5) odpowiedzialny za zgięcie grzbietowe stopy i chód na piętach (albo sam nerw kulszowy).',
      hintPl:
        'Spójrz na przednio-boczną stronę kości piszczelowej na podudziu (mięsień piszczelowy przedni).',
      targetStructureId: 'm_tibialis_anterior',
      acceptedStructureIds: ['m_tibialis_anterior', 'n_ischiadicus'],
      visibleLayers: {
        bone: true,
        cartilage: true,
        muscle: true,
        bursa: false,
        tendon: false,
        ligament: false,
        artery: false,
        vein: false,
        nerve: true,
        organ: false,
        skin: false,
      },
      explanationPl:
        'Mięsień piszczelowy przedni (wraz z prostownikiem długim palucha) jest kluczowym wskaźnikiem siły korzeni L4–L5. Monitorowanie jego siły (skala Lovetta) na każdej wizycie pozwala wcześnie wykryć ewentualne pogorszenie neurologiczne.',
    },
    stage5Plan: {
      finalDiagnosisPl: 'Radikulopatia korzenia L5 w przebiegu przepukliny krążka międzykręgowego L4–L5',
      promptPl:
        'Jaka strategia fizjoterapeutyczna jest najbezpieczniejsza i najskuteczniejsza na tym etapie rwy kulszowej L5?',
      options: [
        'Ocena preferencji kierunkowej (centralizacja objawów), delikatne neuromobilizacje ślizgowe nerwu kulszowego, edukacja (utrzymanie tolerowanej aktywności, krótkie spacery) i regularna kontrola siły stopy',
        'Bezwzględne leżenie w łóżku przez 4 tygodnie bez wstawania',
        'Agresywne naciąganie (tensionery) nerwu kulszowego przez silny ból w fazie ostrej',
        'Forsowne skłony tułowia ze skrętem z obciążeniem w celu „wciśnięcia dysku”',
      ],
      correctIndex: 0,
      explanationPl:
        'Wytyczne kliniczne odradzają długie leżenie i agresywne rozciąganie podrażnionego nerwu. Priorytetem są pozycje/ruchy centralizujące ból, łagodne techniki ślizgowe (sliders), utrzymanie lekkiej aktywności i monitorowanie siły mięśniowej (czerwona flaga w razie narastającego opadania stopy!).',
    },
  },

  // =========================================================================
  // 6. KRĘGOSŁUP — CZERWONA FLAGA: ZESPÓŁ OGONA KOŃSKIEGO
  // =========================================================================
  {
    id: 'case_spine_cauda_equina',
    regionGroup: 'spine',
    regionLabelPl: 'Kręgosłup i rwa',
    region3D: 'full_body',
    titlePl: 'Obustronna rwa i problemy z pęcherzem po nagłym dźwignięciu',
    subtitlePl: 'CZERWONA FLAGA: Podejrzenie zespołu ogona końskiego (CES)',
    difficulty: 'zaawansowany',
    isRedFlagCase: true,
    patientCard: {
      initialsAndAge: 'J.B., 51 lat',
      occupation: 'Magazynier',
      chiefComplaint: 'Silny ból pleców promieniujący do OBU nóg oraz nagłe drętwienie krocza',
      duration: '18 godzin po podniesieniu palety',
      vasPain: '9/10, ból ciągły niezależny od pozycji',
      quotePl:
        '„Od wczoraj wieczorem promieniuje mi na obie nogi naraz, a rano zauważyłem, że zupełnie nie czuję papieru toaletowego w okolicy krocza i nie mogę normalnie oddać moczu, tylko kapie samoistnie.”',
    },
    stage1Interview: {
      promptPl:
        'Która konstelacja objawów z wypowiedzi pacjenta stanowi ALARMOWĄ CZERWONĄ FLAGĘ (stan nagły neurochirurgiczny)?',
      options: [
        'Zatrzymanie / nietrzymanie moczu, znieczulenie siodłowe okolicy krocza i obustronna rwa kulszowa — klasyczne objawy zespołu ogona końskiego (CES)',
        'Ból o natężeniu 9/10 jest zjawiskiem normalnym w każdym lumbago i wymaga jedynie masażu rozluźniającego',
        'Zaburzenia oddawania moczu nie mają związku z kręgosłupem lędźwiowym',
        'Wystarczy obserwować pacjenta przez 2 tygodnie i powtórzyć wywiad na kolejnej wizycie',
      ],
      correctIndex: 0,
      explanationPl:
        'Według standardów bezpieczeństwa klinicznego (m.in. fizjoterapeuty.pl) anestezja siodłowa, dysfunkcja pęcherza/zwieraczy oraz obustronna rwa kulszowa wskazują na masywny ucisk ogona końskiego — stan nagły wymagający pilnej diagnostyki MRI i dekompresji chirurgicznej.',
    },
    stage2Neuro: {
      dermatomeRootId: 'S2',
      dermatomeMode: 'dermatome',
      neuroContextPl:
        'Na modelu 3D podświetlono dolny krzyżowy obszar czuciowy (tył uda i bezpośrednie sąsiedztwo strefy krocza S3–S5). W badaniu przesiewowym stwierdzono wyraźną niedoczulicę siodłową oraz osłabienie obu odruchów skokowych.',
      promptPl:
        'Ucisk których struktur rdzeniowych na poziomie poniżej stożka rdzeniowego (L1–L2) odpowiada za znieczulenie siodłowe (S2–S5) i dysfunkcję zwieraczy?',
      options: [
        'Korzeni krzyżowych ogona końskiego (S2–S5) w dolnym kanale kręgowym',
        'Wyłącznie nerwu mięśniowo-skórnego (C5–C7)',
        'Wyłącznie korzenia C4 w odcinku szyjnym',
        'Izolowanej gałęzi skórnej nerwu udowego (L2)',
      ],
      correctIndex: 0,
      explanationPl:
        'W dolnym odcinku lędźwiowym (poniżej L1/L2) w kanale kręgowym biegnie wiązka korzeni lędźwiowo-krzyżowych zwana ogonem końskim (S2–S5 unerwiają krocze, pęcherz moczowy i zwieracz odbytu).',
    },
    stage3Test: {
      promptPl:
        'W badaniu neurologicznym obserwuje się obustronnie dodatni objaw korzeniowy przy minimalnym uniesieniu kończyn (<30°). Który test neurodynamiczny opisuje tę próbę unoszenia wyprostowanej nogi?',
      optionTestIds: [
        'test_lasegue_slump',
        'kin_schober_ott',
        'test_fair_piriformis',
        'test_freiberg',
      ],
      correctTestId: 'test_lasegue_slump',
      patientFindingPl:
        'Wynik OBUSTRONNIE SILNIE DODATNI już przy 20°–25° unoszenia obu kończyn (z objawem skrzyżowanym). Przy podejrzeniu CES nie wykonujemy forsownych prowokacji ani testów ruchomości kręgosłupa — liczy się czas!',
      explanationPl:
        'Obustronny i skrzyżowany dodatni test Lasègue’a przy bardzo małym kącie (<30°) potwierdza masywną centralną przepuklinę uciskającą worek oponowy i ogon koński.',
    },
    stage4Locate3D: {
      promptPl:
        'Wskaż kliknięciem na modelu 3D ośrodkowo-korzeniową strukturę nerwową w dolnym kanale kręgowym (ogon koński / opona twarda rdzenia) lub nerw kulszowy.',
      hintPl:
        'Przybliż dolną część kręgosłupa lędźwiowo-krzyżowego na modelu całego ciała (mięśnie ukryto, układ nerwowy jest włączony na żółto).',
      targetStructureId: 'n_medulla_spinalis',
      acceptedStructureIds: ['n_medulla_spinalis', 'n_ischiadicus'],
      visibleLayers: {
        bone: true,
        cartilage: true,
        muscle: false,
        bursa: false,
        tendon: false,
        ligament: false,
        artery: false,
        vein: false,
        nerve: true,
        organ: false,
        skin: false,
      },
      explanationPl:
        'Worek oponowy z wiązką korzeni ogona końskiego przebiega centralnie w kanale kręgowym lędźwiowo-krzyżowym. Jego krytyczna kompresja grozi trwałym porażeniem zwieraczy i kończyn dolnych.',
    },
    stage5Plan: {
      finalDiagnosisPl: 'PILNA CZERWONA FLAGA: Zespół ogona końskiego (Cauda Equina Syndrome)',
      promptPl:
        'Jaką JEDYNĄ prawidłową decyzję kliniczną musi podjąć fizjoterapeuta w tej sytuacji?',
      options: [
        'Natychmiastowe przerwanie terapii i pilne skierowanie pacjenta na SOR / oddział neurochirurgii (pilne MRI i odbarczenie chirurgiczne — okno terapeutyczne <24–48 h); bezwzględne przeciwwskazanie do terapii manualnej',
        'Wykonanie manipulacji rotacyjnej odcinka lędźwiowego HVLA w celu odblokowania stawów',
        'Rozpisanie ćwiczeń rozciągających na 2 tygodnie i kontrola po tym czasie',
        'Zastosowanie termoterapii (ciepłych okładów) i masażu głębokiego pośladków',
      ],
      correctIndex: 0,
      explanationPl:
        'Zespół ogona końskiego jest bezwzględnym przeciwwskazaniem do kinezyterapii i terapii manualnej. Każda godzina zwłoki zwiększa ryzyko nieodwracalnej utraty kontroli zwieraczy — pacjent musi natychmiast trafić na SOR.',
    },
  },

  // =========================================================================
  // 7. BIODRO — NIEWYDOLNOŚĆ M. POŚLADKOWEGO ŚREDNIEGO (TRENDELENBURG)
  // =========================================================================
  {
    id: 'case_hip_gluteus_medius',
    regionGroup: 'hip_pelvis',
    regionLabelPl: 'Biodro i miednica',
    region3D: 'lower_limb_right',
    titlePl: 'Utykanie i ból nad krętarzem większym u biegaczki',
    subtitlePl: 'Niewydolność mięśnia pośladkowego średniego i objaw Trendelenburga / Duchenne’a',
    difficulty: 'podstawowy',
    patientCard: {
      initialsAndAge: 'E.R., 35 lat',
      occupation: 'Biegaczka długodystansowa / księgowa',
      chiefComplaint: 'Ból bocznej powierzchni prawego biodra i „kołyszący” chód po 5 km biegu',
      duration: '6 tygodni',
      vasPain: '6/10 przy schodzeniu ze schodów i leżeniu na prawym boku',
      quotePl:
        '„Boli mnie dokładnie z boku biodra nad wystającą kością, szczególnie gdy leżę w nocy na prawym boku albo wchodzę po schodach. Znajomi mówią, że pod koniec biegu mocno kiwam tułowiem na prawą stronę.”',
    },
    stage1Interview: {
      promptPl:
        'Co oznacza kompensacyjne przechylanie tułowia nad prawą nogę podczas fazy podporu (opisywane przez znajomych biegaczki)?',
      options: [
        'Objaw Duchenne’a — odruchowe przeniesienie środka ciężkości nad chore biodro, aby zmniejszyć pracę osłabionych odwodzicieli prawego biodra (m. pośladkowy średni i mały)',
        'Prawidłowy wzorzec ekonomicznego biegu długodystansowego',
        'Czerwoną flagę sugerującą natychmiastowe złamanie szyjki kości udowej mimo samodzielnego biegu 5 km',
        'Izolowany objaw zapalenia stawu łokciowego',
      ],
      correctIndex: 0,
      explanationPl:
        'Kompensacyjne pochylenie tułowia w stronę kończyny podporowej (objaw Duchenne’a) zmniejsza ramię siły grawitacji i odciąża niewydolne odwodziciele biodra po stronie podporowej.',
    },
    stage2Neuro: {
      nerveId: 'n_gluteus_superior',
      neuroContextPl:
        'Na modelu 3D podświetlono nerw ruchowy (L4–S1) oraz zaopatrywaną przez niego grupę odwodzicieli biodra stabilizującą miednicę w płaszczyźnie czołowej.',
      promptPl:
        'Który nerw zaopatruje ruchowo mięsień pośladkowy średni, mięsień pośladkowy mały oraz mięsień naprężacz powięzi szerokiej?',
      options: [
        'Nerw pośladkowy górny (L4–S1)',
        'Nerw zasłonowy (L2–L4)',
        'Nerw udowy (L2–L4)',
        'Nerw piszczelowy (L4–S3)',
      ],
      correctIndex: 0,
      explanationPl:
        'Nerw pośladkowy górny (L4–S1) wychodzi przez otwór nadgruszkowy i unerwia m. pośladkowy średni, mały oraz TFL — ich osłabienie lub tendinopatia upośledza stabilizację miednicy w staniu jednonóż.',
    },
    stage3Test: {
      promptPl:
        'Który test funkcjonalny w staniu jednonóż potwierdza niewydolność mięśnia pośladkowego średniego i małego po stronie kończyny podporowej?',
      optionTestIds: [
        'test_trendelenburg',
        'test_faber_patrick',
        'kin_thomas',
        'test_freiberg',
      ],
      correctTestId: 'test_trendelenburg',
      patientFindingPl:
        'Wynik DODATNI: podczas stania jednonóż na PRAWEJ kończynie lewy kolec biodrowy (po stronie uniesionej nogi) wyraźnie opada w dół po 8 sekundach, a pacjentka zaczyna przechylać tułów w prawo (objaw Duchenne’a).',
      explanationPl:
        'Kluczowa zasada egzaminacyjna (podkreślana na fizjoterapeuty.pl): miednica opada po stronie nogi UNIESIONEJ, co oznacza słabość mięśnia pośladkowego średniego po stronie nogi PODPOROWEJ!',
    },
    stage4Locate3D: {
      promptPl:
        'Wskaż kliknięciem na modelu 3D główny mięsień odwodzący staw biodrowy i stabilizujący miednicę w płaszczyźnie czołowej.',
      hintPl:
        'Spójrz na boczno-tylną powierzchnię talerza biodrowego tuż nad krętarzem większym (mięsień pośladkowy średni).',
      targetStructureId: 'm_gluteus_medius',
      acceptedStructureIds: ['m_gluteus_medius', 'm_gluteus_minimus'],
      visibleLayers: {
        bone: true,
        cartilage: true,
        muscle: true,
        bursa: false,
        tendon: false,
        ligament: false,
        artery: false,
        vein: false,
        nerve: false,
        organ: false,
        skin: false,
      },
      explanationPl:
        'Mięsień pośladkowy średni przyczepia się do powierzchni pośladkowej kości biodrowej i krętarza większego kości udowej; w fazie podporu chodu zapobiega opadaniu przeciwnej strony miednicy.',
    },
    stage5Plan: {
      finalDiagnosisPl: 'Zespół bólowy krętarza większego (GTPS) z niewydolnością mięśnia pośladkowego średniego',
      promptPl:
        'Jaki plan postępowania fizjoterapeutycznego ma najlepszą skuteczność w tendinopatii pośladkowej z dodatnim objawem Trendelenburga?',
      options: [
        'Unikanie kompresji ścięgna (zakładania nogi na nogę, leżenia na chorym boku i agresywnego rozciągania ITB) + progresywne wzmacnianie odwodzicieli (izometria -> ćwiczenia w staniu i kontroli miednicy)',
        'Intensywne rozciąganie pasma biodrowo-piszczelowego w skrajnym przywiedzeniu 5 razy dziennie',
        'Całkowity zakaz jakiegokolwiek wzmacniania mięśni pośladkowych',
        'Wyłącznie bierny drenaż limfatyczny kończyny górnej',
      ],
      correctIndex: 0,
      explanationPl:
        'W tendinopatii m. pośladkowego średniego (GTPS) przywiedzenie biodra dociska ścięgno do krętarza większego i nasila ból! Kluczowa jest edukacja (bez zakładania nogi na nogę, poduszka między kolana w nocy) oraz stopniowe obciążanie izometryczne i ekscentryczno-koncentryczne.',
    },
  },

  // =========================================================================
  // 8. BIODRO — ZESPÓŁ MIĘŚNIA GRUSZKOWATEGO (TEST FREIBERGA / FAIR)
  // =========================================================================
  {
    id: 'case_hip_piriformis',
    regionGroup: 'hip_pelvis',
    regionLabelPl: 'Biodro i miednica',
    region3D: 'lower_limb_right',
    titlePl: 'Głęboki ból pośladka po wielogodzinnym siedzeniu i bieganiu pod górę',
    subtitlePl: 'Zespół mięśnia gruszkowatego i pułapka nerwu kulszowego',
    difficulty: 'średni',
    patientCard: {
      initialsAndAge: 'D.M., 33 lata',
      occupation: 'Programista i triathlonista',
      chiefComplaint: 'Głęboki, kłujący ból pośladka promieniujący w tył uda podczas siedzenia',
      duration: '4 tygodnie',
      vasPain: '6/10 po 20 minutach siedzenia na twardym krześle',
      quotePl:
        '„Ból zaczyna się głęboko w środku prawego pośladka i czasem ciągnie w dół z tyłu uda, ale same plecy mnie w ogóle nie bolą, a kichanie nie nasila dolegliwości.”',
    },
    stage1Interview: {
      promptPl:
        'Które wskazówki z wywiadu przemawiają za pozakręgosłupowym (pośladkowym) źródłem podrażnienia nerwu kulszowego zamiast typowej dyskopatii lędźwiowej?',
      options: [
        'Ból zlokalizowany głęboko w środku pośladka, nasilany uciskiem podczas siedzenia i wchodzeniem po schodach, bez bólu lędźwiowego i bez nasilenia przy kaszlu/kichaniu',
        'Brak bólu kręgosłupa wyklucza jakiekolwiek podrażnienie nerwu kulszowego',
        'Nasilenie przy siedzeniu na twardym krześle jest zawsze czerwoną flagą nowotworową',
        'Ból pośladka po biegu pod górę świadczy wyłącznie o uszkodzeniu łąkotki bocznej',
      ],
      correctIndex: 0,
      explanationPl:
        'W zespole mięśnia gruszkowatego ból jest głęboki, punktowy w połowie linii między kością krzyżową a krętarzem większym, nasila się w siedzeniu i nie wykazuje typowego dla dyskopatii wzrostu przy próbie Valsalvy (kaszlu).',
    },
    stage2Neuro: {
      nerveId: 'n_ischiadicus',
      neuroContextPl:
        'Na modelu 3D podświetlono najgrubszy nerw ludzkiego ciała opuszczający miednicę przez otwór podgruszkowy bezpośrednio pod (lub w wariantach anatomicznych przez) brzuścem mięśnia gruszkowatego.',
      promptPl:
        'Który nerw ulega wtórnemu drażnieniu przez napięty lub przeciążony mięsień gruszkowaty, wywołując tzw. rzekomą rwę kulszową?',
      options: [
        'Nerw kulszowy (L4–S3)',
        'Nerw udowy (L2–L4)',
        'Nerw zasłonowy (L2–L4)',
        'Nerw promieniowy (C5–Th1)',
      ],
      correctIndex: 0,
      explanationPl:
        'Nerw kulszowy wychodzi z miednicy mniejszej przez otwór kulszowy większy (otwór podgruszkowy) tuż poniżej mięśnia gruszkowatego — jego kompresja w tej okolicy daje objawy zbliżone do rwy kulszowej.',
    },
    stage3Test: {
      promptPl:
        'Który klasyczny test w leżeniu tyłem (opisany m.in. na fizjoterapeuty.pl) polega na maksymalnej biernej rotacji wewnętrznej wyprostowanej kończyny dolnej, rozciągając mięsień gruszkowaty?',
      optionTestIds: ['test_freiberg', 'test_trendelenburg', 'kin_ely', 'test_gillet_sij'],
      correctTestId: 'test_freiberg',
      patientFindingPl:
        'Wynik DODATNI: maksymalna bierna rotacja wewnętrzna wyprostowanego prawego uda odtwarza głęboki ból w środku pośladka i mrowienie tylnej części uda (w klastrze dodatni również test FAIR w leżeniu bokiem; ujemny test Bragarda).',
      explanationPl:
        'Test Freiberga (obok testu FAIR i tkliwości palpacyjnej pośladka) stanowi podstawę diagnostyki różnicowej zespołu mięśnia gruszkowatego — łączenie testów w klaster znacznie zwiększa trafność rozpoznania.',
    },
    stage4Locate3D: {
      promptPl:
        'Obróć model na widok tylny i wskaż kliknięciem mięsień gruszkowaty lub przebiegający bezpośrednio pod nim nerw kulszowy.',
      hintPl:
        'Na widoku tylnym miednicy i pośladka odszukaj nerw kulszowy (żółty pień) lub mięsień gruszkowaty wychodzący z kości krzyżowej ku krętarzowi większemu.',
      targetStructureId: 'm_piriformis',
      acceptedStructureIds: ['m_piriformis', 'n_ischiadicus'],
      visibleLayers: {
        bone: true,
        cartilage: true,
        muscle: true,
        bursa: false,
        tendon: false,
        ligament: false,
        artery: false,
        vein: false,
        nerve: true,
        organ: false,
        skin: false,
      },
      explanationPl:
        'Mięsień gruszkowaty łączy powierzchnię miedniczną kości krzyżowej z krętarzem większym kości udowej; przy wyproście biodra jest rotatorem zewnętrznym, a poniżej niego przebiega nerw kulszowy.',
    },
    stage5Plan: {
      finalDiagnosisPl: 'Zespół mięśnia gruszkowatego (głęboki zespół bólowy pośladka)',
      promptPl:
        'Jaki kierunek fizjoterapii przynosi najlepszą i trwałą poprawę w zespole mięśnia gruszkowatego?',
      options: [
        'Modyfikacja pozycji siedzącej (przerwy, wyjęcie portfela z tylnej kieszeni), delikatna terapia tkanek miękkich/PIR, ślizgowa neuromobilizacja nerwu kulszowego oraz wzmocnienie mięśni pośladkowych (odciążenie m. gruszkowatego)',
        'Codzienne wielogodzinne rolowanie twardą piłką w miejscu maksymalnego prądu nerwowego aż do drętwienia stopy',
        'Unieruchomienie biodra w opatrunku gipsowym na 4 tygodnie',
        'Wyłącznie ćwiczenia prostowników nadgarstka',
      ],
      correctIndex: 0,
      explanationPl:
        'Zbyt agresywny ucisk piłką bezpośrednio na podrażniony nerw kulszowy może zaostrzyć objawy! Najlepsze efekty daje połączenie ergonomii siedzenia, łagodnej relaksacji (PIR), neuromobilizacji ślizgowych i wzmocnienia głównych stabilizatorów biodra.',
    },
  },

  // =========================================================================
  // 9. KOŃCZYNA GÓRNA — ZESPÓŁ CIEŚNI NADGARSTKA
  // =========================================================================
  {
    id: 'case_upper_carpal_tunnel',
    regionGroup: 'upper_limb',
    regionLabelPl: 'Kończyna górna',
    region3D: 'upper_limb_right',
    titlePl: 'Nocne drętwienie kciuka i palców II–III u higienistki stomatologicznej',
    subtitlePl: 'Zespół cieśni nadgarstka — neuropatia uciskowa nerwu pośrodkowego',
    difficulty: 'podstawowy',
    patientCard: {
      initialsAndAge: 'M.L., 44 lata',
      occupation: 'Higienistka stomatologiczna (precyzyjny chwyt narzędzi)',
      chiefComplaint: 'Budzące w nocy drętwienie i mrowienie kciuka, palca wskazującego i środkowego prawej ręki',
      duration: '3 miesiące',
      vasPain: '5/10 w nocy (ulga po energicznym strzepnięciu dłoni)',
      quotePl:
        '„Budzę się o 3 nad ranem z całkowicie zdrętwiałym kciukiem, wskazującym i środkowym palcem. Muszę spuścić rękę z łóżka i nią strzepnąć, wtedy powoli puszcza. Mały palec jest całkiem zdrowy.”',
    },
    stage1Interview: {
      promptPl:
        'Dlaczego klasyczny „objaw strzepywania dłoni” (Flick sign) w nocy oraz oszczędzenie V palca są kluczowe w wywiadzie?',
      options: [
        'Objaw strzepywania dłoni ma bardzo wysoką czułość dla zespołu cieśni nadgarstka, a brak objawów w V palcu od razu odróżnia ucisk nerwu pośrodkowego od neuropatii nerwu łokciowego',
        'Nocne drętwienie palców oznacza zawsze złamanie kości łódeczkowatej',
        'Prawidłowe czucie V palca wskazuje na wyłączne uszkodzenie nerwu łokciowego',
        'Strzepywanie dłoni wyklucza ucisk w kanale nadgarstka',
      ],
      correctIndex: 0,
      explanationPl:
        'W nocy nadgarstek często pozostaje w zgięciu, co podnosi ciśnienie w kanale nadgarstka. Strzepnięcie ręki poprawia mikrokrążenie nerwu pośrodkowego. Oszczędzenie V palca (obszar nerwu łokciowego) zawęża rozpoznanie.',
    },
    stage2Neuro: {
      nerveId: 'n_medianus',
      neuroContextPl:
        'Na modelu 3D podświetlono nerw przechodzący pod troczkiem zginaczy do dłoni. Czucie skóry na samym kłębie kciuka (gałąź dłoniowa biegnąca NAD troczkiem) jest zachowane — to potwierdza ucisk właśnie w kanale nadgarstka (a nie wyżej w przedramieniu!).',
      promptPl:
        'Który nerw (pokazany na 3D) zaopatruje czuciowo dłoniową stronę palców I–III i połowy IV oraz ruchowo mięśnie kłębu kciuka?',
      options: [
        'Nerw pośrodkowy',
        'Nerw łokciowy',
        'Nerw promieniowy',
        'Nerw pachowy',
      ],
      correctIndex: 0,
      explanationPl:
        'Nerw pośrodkowy unerwia dłoniową powierzchnię palców I–III i promieniową połowę IV oraz mięśnie kłębu (w zaawansowanej cieśni pojawia się zanik kłębu i osłabienie opozycji kciuka).',
    },
    stage3Test: {
      promptPl:
        'Który zestaw dwóch klasycznych testów prowokacyjnych (złączenie grzbietów dłoni na 60 s oraz delikatne opukiwanie kanału nadgarstka) potwierdza zespół cieśni nadgarstka?',
      optionTestIds: [
        'test_phalen_tinel',
        'test_finkelstein',
        'test_cozen_mills',
        'test_adson_wright_tos',
      ],
      correctTestId: 'test_phalen_tinel',
      patientFindingPl:
        'Wynik DODATNI: po 25 sekundach utrzymywania maksymalnego zgięcia dłoniowego (test Phalena) pojawia się silne mrowienie palców I–III; opukiwanie nad troczkiem zginaczy (objaw Tinela-Hoffmana) wywołuje uczucie „przebiegania prądu” do palca wskazującego i środkowego.',
      explanationPl:
        'Połączenie testu Phalena (wzrost ciśnienia śródkanałowego) i objawu Tinela-Hoffmana (mechaniczna nadwrażliwość uciśniętego pnia nerwu) stanowi standard diagnostyki fizjoterapeutycznej cieśni nadgarstka.',
    },
    stage4Locate3D: {
      promptPl:
        'Wskaż kliknięciem na modelu 3D nerw ulegający kompresji w kanale nadgarstka (po dłoniowej stronie przedramienia i ręki).',
      hintPl:
        'Mięśnie zostały ukryte, a układ nerwowy włączony na żółto — przybliż dłoniową stronę nadgarstka i palców I–III.',
      targetStructureId: 'n_medianus',
      acceptedStructureIds: ['n_medianus'],
      visibleLayers: {
        bone: true,
        cartilage: true,
        muscle: false,
        bursa: false,
        tendon: false,
        ligament: false,
        artery: false,
        vein: false,
        nerve: true,
        organ: false,
        skin: false,
      },
      explanationPl:
        'Nerw pośrodkowy biegnie przez kanał nadgarstka wspólnie z 9 ścięgnami mięśni zginaczy palców i kciuka — ich obrzęk lub długotrwałe zgięcie nadgarstka drastycznie zmniejsza wolną przestrzeń dla nerwu.',
    },
    stage5Plan: {
      finalDiagnosisPl: 'Zespół cieśni nadgarstka (łagodna / umiarkowana neuropatia nerwu pośrodkowego)',
      promptPl:
        'Jakie leczenie zachowawcze pierwszego rzutu ma najsilniejsze poparcie w badaniach klinicznych w łagodnym i umiarkowanym zespole cieśni nadgarstka?',
      options: [
        'Orteza nocna utrzymująca nadgarstek w pozycji neutralnej (0°), ćwiczenia ślizgowe ścięgien i nerwu pośrodkowego (tendon & nerve gliding) oraz ergonomia pracy',
        'Spanie z nadgarstkiem maksymalnie zgiętym dłoniowo i ściśniętym bandażem elastycznym',
        'Ciężkie wielokrotne ściskanie twardego ściskacza dłoniowego przez ból',
        'Wyłącznie ćwiczenia mięśnia trójgłowego łydki',
      ],
      correctIndex: 0,
      explanationPl:
        'Neutralne ustawienie nadgarstka w ortezie nocnej natychmiast obniża ciśnienie w kanale nadgarstka, a delikatne ślizgi ścięgien i nerwu poprawiają jego odżywienie i ruchomość. Przy zaniku kłębu lub braku poprawy konieczna jest diagnostyka ENG/USG i konsultacja chirurgiczna.',
    },
  },

  // =========================================================================
  // 10. KOŃCZYNA GÓRNA — PORAŻENIE NERWU PROMIENIOWEGO („RĘKA OPADAJĄCA”)
  // =========================================================================
  {
    id: 'case_upper_radial_palsy',
    regionGroup: 'upper_limb',
    regionLabelPl: 'Kończyna górna',
    region3D: 'upper_limb_right',
    titlePl: 'Nagła „ręka opadająca” po zaśnięciu z ramieniem przewieszonym przez oparcie',
    subtitlePl: 'Porażenie nerwu promieniowego w bruździe kości ramiennej („porażenie sobotniej nocy”)',
    difficulty: 'średni',
    patientCard: {
      initialsAndAge: 'R.G., 31 lat',
      occupation: 'Grafik komputerowy',
      chiefComplaint: 'Całkowita niemożność uniesienia (wyprostu) prawego nadgarstka i palców',
      duration: '2 dni po długim śnie z ramieniem opartym o twardą krawędź krzesła',
      vasPain: '1/10 (brak silnego bólu, dominuje bezwładny opad dłoni i drętwienie grzbietu kciuka)',
      quotePl:
        '„Obudziłem się z zupełnie bezwładną dłonią — opada mi w dół i nie potrafię wyprostować nadgarstka ani odgiąć palców do góry. Czuję też drętwienie z wierzchu ręki między kciukiem a palcem wskazującym.”',
    },
    stage1Interview: {
      promptPl:
        'Dlaczego wywiad długotrwałego ucisku tylno-bocznej powierzchni ramienia (bez urazu głowy, zaburzeń mowy czy osłabienia nogi) jest kluczowy w różnicowaniu nagłego niedowładu ręki?',
      options: [
        'Wskazuje na obwodową neuropatię uciskową w bruździe nerwu promieniowego kości ramiennej, jednocześnie pozwalając odróżnić ją od ośrodkowego udaru mózgu (gdzie szukamy objawów FAST — twarz, mowa, noga)',
        'Brak bólu oznacza, że pacjent symuluje opadanie dłoni',
        'Opadanie nadgarstka zawsze oznacza wyłącznie zespół cieśni nadgarstka',
        'Każde drętwienie grzbietu kciuka wymaga natychmiastowej artroskopii stawu barkowego',
      ],
      correctIndex: 0,
      explanationPl:
        'Przy każdym nagłym niedowładzie należy błyskawicznie wykluczyć czerwoną flagę ośrodkową (udar — symetria twarzy, mowa, siła innych kończyn). Izolowany deficyt prostowników po ucisku ramienia to klasyczne „porażenie sobotniej nocy”.',
    },
    stage2Neuro: {
      nerveId: 'n_radialis',
      neuroContextPl:
        'Na modelu 3D podświetlono nerw owijający się wokół tylnej powierzchni trzonu kości ramiennej i unerwiający całą tylną grupę mięśni ramienia i przedramienia. Uwaga kliniczna: wyprost łokcia (m. trójgłowy) bywa częściowo zachowany, jeśli ucisk nastąpił dystalnie od gałęzi do tricepsa!',
      promptPl:
        'Uszkodzenie którego nerwu wywołuje klasyczny obraz „ręki opadającej” (brak czynnego wyprostu nadgarstka i palców w stawach MCP) oraz zaburzenia czucia na grzbiecie I przestrzeni międzykostnej?',
      options: [
        'Nerw promieniowy (C5–Th1)',
        'Nerw łokciowy (C8–Th1)',
        'Nerw pośrodkowy (C6–Th1)',
        'Nerw mięśniowo-skórny (C5–C7)',
      ],
      correctIndex: 0,
      explanationPl:
        'Nerw promieniowy unerwia wszystkie prostowniki nadgarstka, prostowniki palców (w stawach śródręczno-paliczkowych) oraz m. odwracacz i ramienno-promieniowy. Jego ucisk w bruździe kości ramiennej daje charakterystyczną „rękę opadającą”.',
    },
    stage3Test: {
      promptPl:
        'Aby precyzyjnie ustalić POZIOM uszkodzenia nerwu promieniowego (pacha vs bruzda kości ramiennej vs przedramię), oceniamy siłę mięśnia trójgłowego ramienia oraz prostowników nadgarstka. Która próba z bazy testów ocenia wyprost łokcia w skali Lovetta 0–5?',
      optionTestIds: [
        'lovett_elbow_extension',
        'test_phalen_tinel',
        'test_golfer_elbow',
        'test_finkelstein',
      ],
      correctTestId: 'lovett_elbow_extension',
      patientFindingPl:
        'Wynik badania: wyprost w stawie łokciowym (m. trójgłowy ramienia) zachowany na 4+/5 w skali Lovetta, natomiast prostowniki nadgarstka i palców na 1/5 — precyzyjnie lokalizuje to ucisk w bruździe nerwu promieniowego (poniżej odejścia głównych gałęzi do tricepsa).',
      explanationPl:
        'Ocena siły m. trójgłowego ramienia w skali Lovetta różnicuje wysokie uszkodzenie w dole pachowym (triceps porażony, np. porażenie „o kulach”) od klasycznego ucisku w bruździe kości ramiennej (triceps zachowany!).',
    },
    stage4Locate3D: {
      promptPl:
        'Wskaż kliknięciem na modelu 3D nerw promieniowy przebiegający wzdłuż tylno-bocznej strony ramienia i przedramienia.',
      hintPl:
        'Mięśnie zostały ukryte, układ nerwowy jest widoczny na żółto — kliknij gałęzie nerwu promieniowego po bocznej / grzbietowej stronie przedramienia.',
      targetStructureId: 'n_radialis',
      acceptedStructureIds: ['n_radialis'],
      visibleLayers: {
        bone: true,
        cartilage: true,
        muscle: false,
        bursa: false,
        tendon: false,
        ligament: false,
        artery: false,
        vein: false,
        nerve: true,
        organ: false,
        skin: false,
      },
      explanationPl:
        'Nerw promieniowy przylega bezpośrednio do okostnej trzonu kości ramiennej w bruździe nerwu promieniowego, dlatego jest szczególnie podatny na ucisk z zewnątrz oraz złamania trzonu kości ramiennej.',
    },
    stage5Plan: {
      finalDiagnosisPl: 'Obwodowe porażenie nerwu promieniowego na poziomie bruzdy kości ramiennej (neuropraksja)',
      promptPl:
        'Co jest kluczowe w programie fizjoterapii od pierwszych dni po porażeniu nerwu promieniowego?',
      options: [
        'Dynamiczna orteza (szyna) podtrzymująca nadgarstek i palce w lekkim wyproście (ochrona przed nadmiernym rozciągnięciem prostowników i przykurczem zginaczy), pełne ćwiczenia bierne/wspomagane, PNF/elektrostymulacja i monitorowanie powrotu funkcji',
        'Pozostawienie dłoni zwisającej bez żadnego zaopatrzenia i unikanie ruszania palcami przez 2 miesiące',
        'Wyłącznie intensywne wzmacnianie zginaczy nadgarstka ciężkimi hantlami',
        'Gipsowe unieruchomienie stawu barkowego w przywiedzeniu',
      ],
      correctIndex: 0,
      explanationPl:
        'Orteza dynamiczna ustawia rękę w pozycji funkcjonalnej (odzyskując siłę chwytu!), zapobiega przeciążeniowemu rozciąganiu porażonych prostowników i wtórnym przykurczom zginaczy w czasie regeneracji nerwu.',
    },
  },

  // =========================================================================
  // 11. STOPA I PODUDZIE — ZERWANIE ŚCIĘGNA ACHILLESA
  // =========================================================================
  {
    id: 'case_lower_achilles',
    regionGroup: 'lower_limb',
    regionLabelPl: 'Stopa i podudzie',
    region3D: 'lower_limb_right',
    titlePl: 'Nagłe uczucie „kopnięcia w łydkę” podczas gry w tenisa',
    subtitlePl: 'Ostre całkowite zerwanie ścięgna Achillesa (piętowego)',
    difficulty: 'podstawowy',
    patientCard: {
      initialsAndAge: 'W.P., 41 lat',
      occupation: 'Inżynier (rekreacyjny tenis raz w tygodniu)',
      chiefComplaint: 'Nagły ból z tyłu nad piętą, brak możliwości wspięcia na palce prawej stopy',
      duration: '1 dzień po gwałtownym starcie do piłki na korcie',
      vasPain: '6/10 przy próbie obciążenia, wyczuwalny ubytek (dołek) 4 cm nad guzem piętowym',
      quotePl:
        '„Obejrzałem się za siebie, bo byłem pewien, że partner rzucił we mnie piłką albo kopnął mnie w łydkę — słyszałem głośny trzask. Dziś mogę trochę ruszać palcami, ale nie potrafię w ogóle wspiąć się na palce tej nogi.”',
    },
    stage1Interview: {
      promptPl:
        'Dlaczego pacjent mimo całkowitego zerwania ścięgna Achillesa może nadal wykonywać słabe czynne zgięcie podeszwowe stopy w powietrzu (bez obciążenia)?',
      options: [
        'Dzięki zachowanej pracy głębokich zginaczy (m. piszczelowy tylny, zginacz długi palców, zginacz długi palucha oraz strzałkowe) — dlatego samo słabe ruszenie stopą w powietrzu NIE wyklucza zerwania Achillesa!',
        'Oznacza to, że ścięgno Achillesa jest na pewno w 100% nienaruszone',
        'Ruch ten wykonuje wyłącznie mięsień piszczelowy przedni',
        'Uczucie „kopnięcia w łydkę” świadczy wyłącznie o skurczu mięśnia czworogłowego uda',
      ],
      correctIndex: 0,
      explanationPl:
        'To jedna z najczęstszych pułapek klinicznych! Głębokie mięśnie goleni nadal słabo zginają stopę podeszwowo w odciążeniu, co może uśpić czujność — rozstrzygające jest badanie palpacyjne ubytku i test Thompsona.',
    },
    stage2Neuro: {
      dermatomeRootId: 'S1',
      dermatomeMode: 'both',
      neuroContextPl:
        'Na modelu 3D podświetlono dermatom i miotom korzenia odpowiadającego za zgięcie podeszwowe stopy (wspięcie na palce) oraz odruch ze ścięgna Achillesa. U pacjenta czucie podeszwy i bocznego brzegu stopy jest zupełnie prawidłowe — brak problemu korzeniowego.',
      promptPl:
        'Który korzeń rdzeniowy (pokazany na 3D) odpowiada za mięsień trójgłowy łydki, wspięcie na palce oraz odruch skokowy (Achillesa)?',
      options: ['Korzeń S1', 'Korzeń L4', 'Korzeń L2', 'Korzeń C7'],
      correctIndex: 0,
      explanationPl:
        'Korzeń S1 zaopatruje czuciowo boczny brzeg stopy i podeszwę oraz ruchowo mięsień brzuchaty i płaszczkowaty łydki (odruch skokowy). Prawidłowe czucie S1 oraz wyczuwalny ubytek w ścięgnie jednoznacznie wskazują na miejscowe zerwanie ścięgna.',
    },
    stage3Test: {
      promptPl:
        'Który test kliniczny o bardzo wysokiej swoistości (opisany m.in. na fizjoterapeuty.pl) potwierdza przerwanie ciągłości ścięgna Achillesa w leżeniu przodem ze stopami poza kozetką?',
      optionTestIds: [
        'test_thompson',
        'test_ankle_drawer_navicular',
        'kin_silfverskiold',
        'test_pivot_shift',
      ],
      correctTestId: 'test_thompson',
      patientFindingPl:
        'Wynik DODATNI: przy energicznym ściśnięciu brzuśca prawego mięśnia brzuchatego łydki brak jakiegokolwiek biernego zgięcia podeszwowego stopy (w porównaniu do wyraźnego ruchu po stronie lewej).',
      explanationPl:
        'W teście Thompsona ściśnięcie brzuśca mięśnia trójgłowego łydki przy ciągłym ścięgnie zawsze wywołuje bierne zgięcie podeszwowe stopy. Jego brak potwierdza całkowite zerwanie ścięgna piętowego.',
    },
    stage4Locate3D: {
      promptPl:
        'Wskaż kliknięciem na modelu 3D powierzchowny dwugłowy mięsień łydki przechodzący w ścięgno Achillesa (lub leżącą głębiej warstwę mięśnia płaszczkowatego / kaletkę piętową).',
      hintPl:
        'Obróć model kończyny dolnej na widok tylny i kliknij główny brzusiec łydki (mięsień brzuchaty łydki).',
      targetStructureId: 'm_gastrocnemius',
      acceptedStructureIds: ['m_gastrocnemius', 'm_soleus', 'bursa_calcanea'],
      visibleLayers: {
        bone: true,
        cartilage: true,
        muscle: true,
        bursa: true,
        tendon: true,
        ligament: false,
        artery: false,
        vein: false,
        nerve: false,
        organ: false,
        skin: false,
      },
      explanationPl:
        'Mięsień brzuchaty łydki i mięsień płaszczkowaty tworzą mięsień trójgłowy łydki, który kończy się najgrubszym ścięgnem ludzkiego ciała — ścięgnem piętowym (Achillesa).',
    },
    stage5Plan: {
      finalDiagnosisPl: 'Ostre całkowite zerwanie ścięgna piętowego (Achillesa)',
      promptPl:
        'Jakie pilne działanie należy podjąć natychmiast po stwierdzeniu dodatniego testu Thompsona?',
      options: [
        'Unieruchomienie stopy w lekkim zgięciu podeszwowym (zbliżenie kikutów ścięgna), odciążenie o kulach i pilna konsultacja ortopedyczna z badaniem USG (kwalifikacja do leczenia operacyjnego lub wczesnego funkcjonalnego w ortezie Walker z klinami)',
        'Intensywny stretching mięśnia brzuchatego łydki na stopniu schodowym przez ból',
        'Bieganie truchtem w celu „rozruszania zrostów” jeszcze w tym samym tygodniu',
        'Natychmiastowe forsowne zgięcie grzbietowe stopy do oporu',
      ],
      correctIndex: 0,
      explanationPl:
        'Po świeżym zerwaniu Achillesa absolutnie NIE wolno biernie rozciągać stopy w zgięcie grzbietowe! Priorytetem jest ustawienie końskie (zbliżające końce ścięgna), odciążenie i pilna ocena USG/ortopedyczna, a następnie kontrolowana rehabilitacja funkcjonalna.',
    },
  },

  // =========================================================================
  // 12. STOPA I PODUDZIE — SKRĘCENIE INWERSYJNE STAWU SKOKOWEGO (ATFL)
  // =========================================================================
  {
    id: 'case_lower_ankle_atfl',
    regionGroup: 'lower_limb',
    regionLabelPl: 'Stopa i podudzie',
    region3D: 'lower_limb_right',
    titlePl: 'Inwersyjne podkręcenie kostki przy lądowaniu z bloku w siatkówce',
    subtitlePl: 'Uszkodzenie więzadła skokowo-strzałkowego przedniego (ATFL)',
    difficulty: 'podstawowy',
    patientCard: {
      initialsAndAge: 'Z.K., 21 lat',
      occupation: 'Studentka fizjoterapii / siatkarka',
      chiefComplaint: 'Obrzęk i zasinienie przed i pod kostką boczną prawej stopy po lądowaniu na stopie rywalki',
      duration: '4 dni po urazie',
      vasPain: '5/10 przy obciążaniu, samodzielnie przechodzi ponad 4 kroki z lekkim utykaniem',
      quotePl:
        '„Wylądowałam na krawędzi stopy, kostka wygięła mi się mocno do środka w podeszwowym zgięciu. Najbardziej boli z przodu pod kostką boczną, ale samej kości z tyłu kostek i łódkowatej nie boli, mogę zrobić kilka kroków.”',
    },
    stage1Interview: {
      promptPl:
        'Jaką funkcję pełnią Reguły Ottawskie stawu skokowego (Ottawa Ankle Rules) na etapie badania wstępnego po skręceniu kostki?',
      options: [
        'Służą do bezpiecznego przesiewu w kierunku złamań kostek lub śródstopia (ocena tkliwości tylnych brzegów kostek, kości łódkowatej, podstawy V kości śródstopia oraz zdolności przejścia 4 kroków) przed podjęciem rehabilitacji',
        'Służą wyłącznie do pomiaru długości mięśnia czworogłowego uda',
        'Nakazują założenie gipsu na 6 tygodni u każdego pacjenta po skręceniu kostki',
        'Potwierdzają zerwanie więzadła krzyżowego przedniego kolana',
      ],
      correctIndex: 0,
      explanationPl:
        'Reguły Ottawskie mają niemal 100% czułość w wykluczaniu istotnych złamań kostki i stopy. U pacjentki reguły Ottawskie są ujemne (brak tkliwości kostnej w punktach krytycznych, zdolność przejścia >4 kroków), co pozwala bezpiecznie badać aparat więzadłowy.',
    },
    stage2Neuro: {
      nerveId: 'n_fibularis_communis',
      neuroContextPl:
        'Na modelu 3D podświetlono szlak nerwu strzałkowego (w tym gałęzi powierzchownej biegnącej po bocznej stronie podudzia i grzbiecie stopy), który bywa nadmiernie rozciągany w ciężkich skręceniach inwersyjnych. U pacjentki czucie grzbietu stopy i siła mięśni strzałkowych (ewersja) są zachowane.',
      promptPl:
        'Który nerw i zaopatrywana przez niego boczna grupa mięśni goleni (mięśnie strzałkowe) stanowią kluczową czynną ochronę przed nawracającym skręceniem inwersyjnym?',
      options: [
        'Nerw strzałkowy wspólny (gałąź powierzchowna -> mięśnie strzałkowe długi i krótki)',
        'Nerw zasłonowy (mięśnie przywodziciele uda)',
        'Nerw pośrodkowy (zginacze nadgarstka)',
        'Nerw udowy (mięsień czworogłowy uda)',
      ],
      correctIndex: 0,
      explanationPl:
        'Mięśnie strzałkowe długi i krótki (nerw strzałkowy powierzchowny) wykonują nawracanie (ewersję) stopy i są głównymi dynamicznymi stabilizatorami chroniącymi przed kolejnym skręceniem inwersyjnym!',
    },
    stage3Test: {
      promptPl:
        'Który test ortopedyczny (w 15° zgięcia podeszwowego stopy ze stabilizacją piszczeli) najlepiej ocenia ciągłość więzadła skokowo-strzałkowego przedniego (ATFL)?',
      optionTestIds: [
        'test_ankle_drawer_navicular',
        'test_thompson',
        'kin_silfverskiold',
        'test_lachman',
      ],
      correctTestId: 'test_ankle_drawer_navicular',
      patientFindingPl:
        'Wynik DODATNI (szuflada przednia stawu skokowego): zwiększone przemieszczenie kości skokowej ku przodowi w porównaniu ze stroną lewą, delikatne „wciągnięcie” skóry przed kostką boczną i odtworzenie bólu nad ATFL (najwyższa trafność 4–5 dni po urazie).',
      explanationPl:
        'Test szuflady przedniej stawu skokowego (wykonywany najlepiej po 4–5 dniach, gdy ostry obrzęk i skurcz ochronny nieco ustąpią) jest złotym standardem klinicznej oceny ATFL.',
    },
    stage4Locate3D: {
      promptPl:
        'Wskaż kliknięciem na modelu 3D najczęściej uszkadzane więzadło bocznego przedziału stawu skokowego (biegnące od kostki bocznej do szyjki kości skokowej).',
      hintPl:
        'Przybliż boczną stronę stawu skokowego (mięśnie są ukryte, więzadła włączone) — kliknij krótkie przednie pasmo między strzałką a kością skokową (ATFL).',
      targetStructureId: 'lig_talofibulare_anterius',
      acceptedStructureIds: ['lig_talofibulare_anterius'],
      visibleLayers: {
        bone: true,
        cartilage: true,
        muscle: false,
        bursa: false,
        tendon: false,
        ligament: true,
        artery: false,
        vein: false,
        nerve: false,
        organ: false,
        skin: false,
      },
      explanationPl:
        'Więzadło skokowo-strzałkowe przednie (ATFL) jest najsłabszym z trzech bocznych więzadeł stawu skokowego i jako pierwsze ulega rozciągnięciu lub zerwaniu podczas inwersji w zgięciu podeszwowym.',
    },
    stage5Plan: {
      finalDiagnosisPl: 'Skręcenie inwersyjne stawu skokowego II stopnia — uszkodzenie więzadła ATFL',
      promptPl:
        'Który model postępowania najlepiej zapobiega rozwojowi przewlekłej niestabilności stawu skokowego (CAI)?',
      options: [
        'Zasada PEACE & LOVE: krótka ochrona w ortezie półsztywnej, wczesne tolerowane obciążanie i mobilizacja zgięcia grzbietowego, wzmocnienie mięśni strzałkowych oraz intensywny trening propriocepcji i równowagi jednonóż',
        'Sztywny gips marszowy na 6 tygodni i zakaz ćwiczeń równoważnych po zdjęciu gipsu',
        'Natychmiastowy powrót do skoków w siatkówce bez ochrony i bez odbudowy propriocepcji',
        'Wyłącznie chłodzenie lodem przez 3 tygodnie bez ruszania stopą',
      ],
      correctIndex: 0,
      explanationPl:
        'Współczesne wytyczne (PEACE & LOVE) jednoznacznie wykazują przewagę wczesnej rehabilitacji funkcjonalnej i treningu nerwowo-mięśniowego (propriocepcja + mięśnie strzałkowe) nad długotrwałym unieruchomieniem w gipsie — znacząco redukuje to ryzyko nawrotowych skręceń.',
    },
  },
];

export const PATIENT_CASE_MAP: Record<string, PatientCaseScenario> = Object.fromEntries(
  PATIENT_CASES_DB.map((c) => [c.id, c]),
);
