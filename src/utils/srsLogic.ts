import { ANATOMY_DB, ANATOMY_MAP } from '../data/anatomyDb';
import { BIOMECHANICS_MOVEMENTS } from '../data/biomechanicsDb';
import { CLINICAL_TESTS_DB, type ClinicalTestCategory } from '../data/clinicalTestsDb';
import { DERMATOME_MYOTOME_LEVELS } from '../data/dermatomesMyotomes';
import { MUSCLE_ACTIONS_DB } from '../data/muscleActionsDb';
import { formatBilingualName } from '../three/anatomyTranslator';
import { RegionId, SrsCardState } from '../types/anatomy';
import { getLocalDateKey, getStructureDetailLabels } from './gameLogic';

export type SrsRating = 'again' | 'hard' | 'good' | 'easy';
export type SrsDeckId =
  | 'all'
  | 'anatomy'
  | 'muscle_actions'
  | 'orthopedic'
  | 'kinesitherapy'
  | 'dermatomes'
  | 'biomechanics';

export interface SrsFlashcardSection {
  label: string;
  value: string;
  tone?: 'emerald' | 'amber' | 'rose' | 'neutral';
}

export interface SrsFlashcard {
  id: string;
  deck: Exclude<SrsDeckId, 'all'>;
  badge: string;
  region: RegionId;
  frontTitle: string;
  frontSubtitle?: string;
  frontPrompt: string;
  backSections: SrsFlashcardSection[];
  targetStructureId?: string;
}

export interface SrsDeckStats {
  total: number;
  dueReviews: number;
  newCards: number;
  masteredCards: number;
  reviewedCards: number;
}

const ORTHOPEDIC_TEST_COUNT = CLINICAL_TESTS_DB.filter((t) => t.category === 'orthopedic').length;
const KINESITHERAPY_TEST_COUNT = CLINICAL_TESTS_DB.length - ORTHOPEDIC_TEST_COUNT;

export const SRS_DECK_META: Array<{
  id: SrsDeckId;
  label: string;
  subtitle: string;
}> = [
  {
    id: 'all',
    label: 'Wszystkie fiszki',
    subtitle: `Anatomia (${ANATOMY_DB.length}) + ruchy mięśni (${MUSCLE_ACTIONS_DB.length}) + testy (${CLINICAL_TESTS_DB.length}) + dermatomy (${DERMATOME_MYOTOME_LEVELS.length}) + biomechanika (${BIOMECHANICS_MOVEMENTS.length})`,
  },
  {
    id: 'muscle_actions',
    label: 'Ruchy mięśni i Punctum Fixum',
    subtitle: `Ruchy główne i pomocnicze, podział na aktony, łańcuch zamknięty i pułapki (${MUSCLE_ACTIONS_DB.length} mięśni)`,
  },
  {
    id: 'anatomy',
    label: 'Anatomia — wszystkie układy',
    subtitle: `Kości, mięśnie, naczynia, nerwy, narządy, kaletki, ścięgna, więzadła i skóra (${ANATOMY_DB.length})`,
  },
  {
    id: 'orthopedic',
    label: 'Testy ortopedyczne',
    subtitle: `Pozycja, wykonanie i objaw dodatni ${ORTHOPEDIC_TEST_COUNT} testów klinicznych`,
  },
  {
    id: 'kinesitherapy',
    label: 'Kinezyterapia i Lovett',
    subtitle: 'Testy przykurczów, skala Lovetta 0–5, UGUL, PNF i SFTR',
  },
  {
    id: 'dermatomes',
    label: 'Dermatomy i miotomy (C4–S2)',
    subtitle: 'Korzenie rdzeniowe, obszary czuciowe, mięśnie wskaźnikowe, odruchy i radikulopatie',
  },
  {
    id: 'biomechanics',
    label: 'Biomechanika i SFTR',
    subtitle: `Agoniści, synergiści, antagoniści, normy SFTR i reguła wklęsło-wypukła (${BIOMECHANICS_MOVEMENTS.length} ruchów)`,
  },
];

function getClinicalBadge(category: ClinicalTestCategory): string {
  switch (category) {
    case 'orthopedic':
      return 'Test ortopedyczny';
    case 'kinesitherapy_length':
      return 'Test przykurczu / długości';
    case 'lovett':
      return 'Skala Lovetta 0–5';
    case 'kinesitherapy_method':
      return 'Metodyka kinezyterapii';
  }
}

function getClinicalPrompt(category: ClinicalTestCategory): string {
  switch (category) {
    case 'orthopedic':
      return 'Przypomnij pozycję pacjenta, sposób wykonania oraz objaw dodatni i interpretację kliniczną.';
    case 'kinesitherapy_length':
      return 'Przypomnij ocenianą strukturę, pozycję wyjściową, normę i kryterium przykurczu.';
    case 'lovett':
      return 'Przypomnij pozycję w odciążeniu (0–2), przeciw grawitacji (3–5), stabilizację i punkt oporu.';
    case 'kinesitherapy_method':
      return 'Przypomnij kluczowe zasady metodyczne, wskazania i najczęstsze pytania egzaminacyjne.';
  }
}

let cachedAllCards: SrsFlashcard[] | null = null;

export function getAllSrsCards(): SrsFlashcard[] {
  if (cachedAllCards) return cachedAllCards;

  const anatomyCards: SrsFlashcard[] = ANATOMY_DB.map((item) => {
    const labels = getStructureDetailLabels(item.category);
    const badge =
      item.category === 'muscle'
        ? 'Mięsień'
        : item.category === 'bone'
          ? 'Kość / punkt kostny'
          : item.category === 'artery'
            ? 'Tętnica'
            : item.category === 'vein'
              ? 'Żyła'
              : item.category === 'nerve'
                ? 'Nerw / OUN'
                : item.category === 'organ'
                  ? 'Narząd wewnętrzny'
                  : item.category === 'bursa'
                    ? 'Kaletka maziowa'
                    : item.category === 'tendon'
                      ? 'Ścięgno / pochewka'
                      : item.category === 'ligament'
                        ? 'Więzadło'
                        : item.category === 'skin'
                          ? 'Powłoka skórna'
                          : 'Staw / więzadło';

    const frontPrompt =
      item.category === 'muscle'
        ? 'Przypomnij przyczep początkowy (PP), przyczep końcowy (PK), czynność i unerwienie.'
        : item.category === 'bone'
          ? 'Przypomnij główne struktury kostne, przyczepiające się mięśnie oraz znaczenie kliniczne.'
          : item.category === 'artery'
            ? 'Przypomnij pochodzenie tętnicy, jej przebieg, obszar unaczynienia i znaczenie kliniczne.'
            : item.category === 'vein'
              ? 'Przypomnij obszar spływu żylnego, ujście oraz korelacje naczyniowe.'
              : item.category === 'nerve'
                ? 'Przypomnij korzenie/segmenty, przebieg, obszar unerwienia ruchowego i czuciowego oraz objawy uszkodzenia.'
                : item.category === 'organ'
                  ? 'Przypomnij położenie topograficzne, funkcję, unerwienie i bóle rzutowane istotne w fizjoterapii.'
                  : item.category === 'bursa'
                    ? 'Przypomnij położenie kaletki, sąsiadujące struktury oraz objawy jej zapalenia.'
                    : item.category === 'tendon'
                      ? 'Przypomnij przebieg ścięgna/pochewki, funkcję ślizgową oraz najczęstsze przeciążenia.'
                      : item.category === 'skin'
                        ? 'Przypomnij granice okolicy, kluczowe dermatomy i punkty palpacyjne.'
                        : 'Przypomnij przyczepy, stabilizowaną płaszczyznę ruchu oraz mechanizm urazu.';

    const sections: SrsFlashcardSection[] = [
      { label: labels.firstLabel, value: item.pp, tone: 'rose' },
      { label: labels.secondLabel, value: item.pk, tone: 'emerald' },
      { label: 'Czynność / Biomechanika', value: item.functionDesc, tone: 'neutral' },
    ];

    if (item.innervation && item.innervation !== '—') {
      sections.push({
        label: 'Unerwienie',
        value:
          item.spinalSegments && item.spinalSegments !== '—'
            ? `${item.innervation} (${item.spinalSegments})`
            : item.innervation,
        tone: 'amber',
      });
    }

    sections.push({
      label: 'Korelacja kliniczna',
      value: item.clinicalCorrelation,
      tone: 'neutral',
    });

    return {
      id: `srs_anat_${item.id}`,
      deck: 'anatomy',
      badge,
      region: item.region,
      frontTitle: formatBilingualName(item.namePl, item.nameEn),
      frontSubtitle: item.nameEn,
      frontPrompt,
      backSections: sections,
      targetStructureId: item.id,
    };
  });

  const clinicalCards: SrsFlashcard[] = CLINICAL_TESTS_DB.map((test) => {
    const deck: Exclude<SrsDeckId, 'all'> =
      test.category === 'orthopedic' ? 'orthopedic' : 'kinesitherapy';

    const sections: SrsFlashcardSection[] = [
      { label: 'Cel / Oceniana struktura', value: test.targetSummary, tone: 'emerald' },
      { label: 'Pozycja wyjściowa', value: test.patientPosition, tone: 'neutral' },
      { label: 'Wykonanie', value: test.procedure, tone: 'neutral' },
    ];

    if (test.lovettEliminated) {
      sections.push({
        label: 'Stopnie 0–2 (bez grawitacji / w odciążeniu)',
        value: test.lovettEliminated,
        tone: 'amber',
      });
    }
    if (test.lovettGravity) {
      sections.push({
        label: 'Stopnie 3–5 (przeciw sile grawitacji + opór)',
        value: test.lovettGravity,
        tone: 'emerald',
      });
    }
    if (test.stabilization) {
      sections.push({
        label: 'Stabilizacja',
        value: test.stabilization,
        tone: 'neutral',
      });
    }
    if (test.resistancePoint) {
      sections.push({
        label: 'Punkt przyłożenia oporu',
        value: test.resistancePoint,
        tone: 'rose',
      });
    }

    sections.push({
      label: test.category === 'lovett' ? 'Kryteria stopni 0–5 w skali Lovetta' : 'Objaw dodatni / Kryterium',
      value: test.positiveSign,
      tone: 'rose',
    });

    sections.push({
      label: 'Interpretacja kliniczna',
      value: test.clinicalInterpretation,
      tone: 'neutral',
    });

    if (test.normsOrRules) {
      sections.push({
        label: 'Normy i zasady egzaminacyjne',
        value: test.normsOrRules,
        tone: 'amber',
      });
    }

    return {
      id: `srs_clin_${test.id}`,
      deck,
      badge: getClinicalBadge(test.category),
      region: test.region,
      frontTitle: test.namePl,
      frontSubtitle: test.nameEn,
      frontPrompt: getClinicalPrompt(test.category),
      backSections: sections,
      targetStructureId: test.structureIds[0],
    };
  });

  const dermatomeCards: SrsFlashcard[] = DERMATOME_MYOTOME_LEVELS.map((lvl) => {
    const region: RegionId =
      lvl.id === 'Th1' || lvl.group === 'cervical'
        ? 'upper_limb'
        : lvl.group === 'thoracic'
          ? 'spine_thorax'
          : 'lower_limb';

    const sections: SrsFlashcardSection[] = [
      { label: 'Dermatom (kluczowy punkt czuciowy)', value: lvl.sensoryLandmarkPl, tone: 'amber' },
      {
        label: 'Miotom (mięśnie wskaźnikowe i ruch)',
        value: `${lvl.keyMusclePl} — ruch kluczowy: ${lvl.keyMovementPl}.`,
        tone: 'emerald',
      },
      { label: 'Odruch ścięgnisty', value: lvl.reflexPl, tone: 'neutral' },
      {
        label: 'Typowa dyskopatia i obraz radikulopatii',
        value: `${lvl.commonDiscLevelPl}. ${lvl.radiculopathySignsPl}`,
        tone: 'rose',
      },
      {
        label: 'Testy prowokacyjne i badanie',
        value: lvl.provocationTestsPl.join(' • '),
        tone: 'neutral',
      },
    ];

    return {
      id: `srs_derm_${lvl.id}`,
      deck: 'dermatomes',
      badge: `Dermatom i miotom • ${lvl.groupLabelPl}`,
      region,
      frontTitle: `${lvl.labelPl} — dermatom, miotom i odruch`,
      frontSubtitle: `Poziom rdzeniowy ${lvl.id} (${lvl.groupLabelPl})`,
      frontPrompt:
        'Przypomnij obszar czuciowy (dermatom), mięśnie wskaźnikowe i kluczowy ruch (miotom), odruch głęboki oraz typowe objawy radikulopatii.',
      backSections: sections,
      targetStructureId: lvl.myotomeMuscleIds[0],
    };
  });

  const biomechanicsCards: SrsFlashcard[] = BIOMECHANICS_MOVEMENTS.map((m) => {
    const mapNames = (ids: string[]) =>
      ids.map((id) => ANATOMY_MAP[id]?.namePl ?? id).join(', ');

    const sections: SrsFlashcardSection[] = [
      {
        label: 'Norma SFTR, płaszczyzna i oś',
        value: `${m.sftrCode} — ${m.normRangePl}. ${m.planeLabelPl}, ${m.axisLabelPl}.`,
        tone: 'emerald',
      },
      {
        label: 'Agoniści (główni sprawcy)',
        value: mapNames(m.agonistIds),
        tone: 'emerald',
      },
      {
        label: 'Synergiści i stabilizatory',
        value: mapNames(m.synergistIds),
        tone: 'amber',
      },
      {
        label: 'Antagoniści (przeciwstawni)',
        value: mapNames(m.antagonistIds),
        tone: 'rose',
      },
      {
        label: 'Artrokinematyka — reguła wklęsło-wypukła (Kaltenborn)',
        value: m.convexConcaveRulePl,
        tone: 'neutral',
      },
    ];

    return {
      id: `srs_biom_${m.id}`,
      deck: 'biomechanics',
      badge: `Biomechanika • ${m.jointLabelPl}`,
      region: m.srsRegion,
      frontTitle: `${m.namePl} — SFTR i łańcuch mięśniowy`,
      frontSubtitle: `${m.jointLabelPl} (${m.planeLabelPl})`,
      frontPrompt:
        'Przypomnij głównych agonistów, synergistów, antagonistów, normę zapisu SFTR oraz regułę wklęsło-wypukłą (kierunek ślizgu).',
      backSections: sections,
      targetStructureId: m.agonistIds[0],
    };
  });

  const muscleActionCards: SrsFlashcard[] = MUSCLE_ACTIONS_DB.map((profile) => {
    const anat = ANATOMY_MAP[profile.muscleId];
    const primaryMoves = profile.actions
      .filter((a) => a.role === 'primary')
      .map((a) => `${a.jointLabelPl}: ${a.movementLabelPl} (${a.sftrRangePl})`)
      .join(' • ');
    const secondaryMoves = profile.actions
      .filter((a) => a.role === 'secondary')
      .map((a) => `${a.jointLabelPl}: ${a.movementLabelPl}`)
      .join(' • ');

    const sections: SrsFlashcardSection[] = [
      { label: 'Główne ruchy w stawach', value: primaryMoves || profile.openChainSummaryPl, tone: 'emerald' },
    ];
    if (secondaryMoves) {
      sections.push({ label: 'Ruchy pomocnicze', value: secondaryMoves, tone: 'neutral' });
    }
    if (profile.subparts && profile.subparts.length > 0) {
      sections.push({
        label: 'Podział na aktony / głowy',
        value: profile.subparts.map((s) => `${s.namePl}: ${s.actionsPl}`).join(' | '),
        tone: 'amber',
      });
    }
    sections.push(
      {
        label: 'Punctum Fixum — łańcuch zamknięty (odwrócony przyczep)',
        value: profile.closedChainReversedPl,
        tone: 'emerald',
      },
      {
        label: 'Pozycja rozciągania / PIR',
        value: profile.stretchingPositionPl,
        tone: 'neutral',
      },
      {
        label: 'Pułapka egzaminacyjna',
        value: profile.examTrapPl,
        tone: 'rose',
      },
    );

    return {
      id: `srs_musc_${profile.muscleId}`,
      deck: 'muscle_actions',
      badge: `Ruchy mięśnia • ${profile.regionGroupPl}`,
      region: profile.region,
      frontTitle: `${anat?.namePl ?? profile.muscleId} — ruchy i łańcuch zamknięty`,
      frontSubtitle: anat?.nameEn,
      frontPrompt:
        'Przypomnij główne ruchy mięśnia, podział na aktony/głowy (jeśli dotyczy), czynność w łańcuchu zamkniętym (odwrócony przyczep) oraz pozycję rozciągania.',
      backSections: sections,
      targetStructureId: profile.muscleId,
    };
  });

  cachedAllCards = [
    ...anatomyCards,
    ...muscleActionCards,
    ...clinicalCards,
    ...dermatomeCards,
    ...biomechanicsCards,
  ];
  return cachedAllCards;
}

export function buildSrsDeck(
  deckId: SrsDeckId = 'all',
  region: RegionId | 'all' = 'all',
): SrsFlashcard[] {
  return getAllSrsCards().filter((card) => {
    if (deckId !== 'all' && card.deck !== deckId) return false;
    if (region !== 'all' && card.region !== region) return false;
    return true;
  });
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const base = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(base.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + days);
    return getLocalDateKey(fallback);
  }
  base.setDate(base.getDate() + days);
  return getLocalDateKey(base);
}

export function applySrsReview(
  prev: SrsCardState | undefined,
  rating: SrsRating,
  todayKey: string = getLocalDateKey(),
  nowIso: string = new Date().toISOString(),
): SrsCardState {
  const prevEf = prev?.easeFactor ?? 2.5;
  const prevReps = prev?.repetitions ?? 0;
  const prevInterval = prev?.intervalDays ?? 0;

  let intervalDays = 1;
  let repetitions = prevReps;
  let easeFactor = prevEf;

  switch (rating) {
    case 'again': {
      repetitions = 0;
      intervalDays = 1;
      easeFactor = Math.max(1.3, Number((prevEf - 0.2).toFixed(2)));
      break;
    }
    case 'hard': {
      repetitions = prevReps + 1;
      intervalDays = prevReps === 0 ? 1 : Math.max(1, Math.round(prevInterval * 1.2));
      easeFactor = Math.max(1.3, Number((prevEf - 0.15).toFixed(2)));
      break;
    }
    case 'good': {
      repetitions = prevReps + 1;
      if (prevReps === 0) {
        intervalDays = 1;
      } else if (prevReps === 1) {
        intervalDays = 6;
      } else {
        intervalDays = Math.max(2, Math.round(prevInterval * prevEf));
      }
      easeFactor = Math.max(1.3, Number(prevEf.toFixed(2)));
      break;
    }
    case 'easy': {
      repetitions = prevReps + 1;
      if (prevReps === 0) {
        intervalDays = 4;
      } else if (prevReps === 1) {
        intervalDays = 10;
      } else {
        intervalDays = Math.max(4, Math.round(prevInterval * prevEf * 1.3));
      }
      easeFactor = Math.min(3.0, Number((prevEf + 0.15).toFixed(2)));
      break;
    }
  }

  return {
    intervalDays,
    easeFactor,
    repetitions,
    nextReviewDate: addDaysToDateKey(todayKey, intervalDays),
    lastReviewedAt: nowIso,
  };
}

export function previewNextIntervals(prev: SrsCardState | undefined): Record<SrsRating, number> {
  const dummyToday = '2026-01-01';
  return {
    again: applySrsReview(prev, 'again', dummyToday).intervalDays,
    hard: applySrsReview(prev, 'hard', dummyToday).intervalDays,
    good: applySrsReview(prev, 'good', dummyToday).intervalDays,
    easy: applySrsReview(prev, 'easy', dummyToday).intervalDays,
  };
}

export function isSrsCardDueForReview(
  state: SrsCardState | undefined,
  todayKey: string = getLocalDateKey(),
): boolean {
  if (!state) return false;
  return state.nextReviewDate <= todayKey;
}

export function getSrsDeckStats(
  cards: SrsFlashcard[],
  srsProgress: Record<string, SrsCardState> = {},
  todayKey: string = getLocalDateKey(),
): SrsDeckStats {
  let dueReviews = 0;
  let newCards = 0;
  let masteredCards = 0;
  let reviewedCards = 0;

  for (const card of cards) {
    const state = srsProgress[card.id];
    if (!state) {
      newCards += 1;
      continue;
    }
    reviewedCards += 1;
    if (state.nextReviewDate <= todayKey) {
      dueReviews += 1;
    }
    if (state.repetitions >= 2 && state.intervalDays >= 6) {
      masteredCards += 1;
    }
  }

  return {
    total: cards.length,
    dueReviews,
    newCards,
    masteredCards,
    reviewedCards,
  };
}

export function getSrsDueCount(
  srsProgress: Record<string, SrsCardState> = {},
  todayKey: string = getLocalDateKey(),
): number {
  return getSrsDeckStats(getAllSrsCards(), srsProgress, todayKey).dueReviews;
}

/**
 * Returns cards ordered for study:
 * 1) Overdue / due-today reviewed cards (oldest due date first)
 * 2) Unseen new cards (so a fresh student always has cards ready to study)
 */
export function buildSrsStudyQueue(
  cards: SrsFlashcard[],
  srsProgress: Record<string, SrsCardState> = {},
  todayKey: string = getLocalDateKey(),
  maxNewPerSession = 20,
): SrsFlashcard[] {
  const due: SrsFlashcard[] = [];
  const unseen: SrsFlashcard[] = [];

  for (const card of cards) {
    const state = srsProgress[card.id];
    if (!state) {
      unseen.push(card);
    } else if (state.nextReviewDate <= todayKey) {
      due.push(card);
    }
  }

  due.sort((a, b) => {
    const da = srsProgress[a.id]?.nextReviewDate ?? '';
    const db = srsProgress[b.id]?.nextReviewDate ?? '';
    return da.localeCompare(db);
  });

  return [...due, ...unseen.slice(0, maxNewPerSession)];
}
