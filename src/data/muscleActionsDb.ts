import { ANATOMY_MAP } from './anatomyDb';
import { LOWER_LIMB_MUSCLE_ACTIONS } from './muscleActionsLower';
import { TRUNK_HEAD_MUSCLE_ACTIONS } from './muscleActionsTrunkHead';
import type {
  JointMovementOption,
  MuscleActionProfile,
  MuscleActionsQuizQuestion,
  MuscleComparisonResult,
  MuscleJointGroupId,
  MuscleQuizQuestionKind,
  ReverseMovementLookupResult,
} from './muscleActionsTypes';
import { UPPER_LIMB_MUSCLE_ACTIONS } from './muscleActionsUpper';

export * from './muscleActionsTypes';

export const MUSCLE_ACTIONS_DB: MuscleActionProfile[] = [
  ...UPPER_LIMB_MUSCLE_ACTIONS,
  ...TRUNK_HEAD_MUSCLE_ACTIONS,
  ...LOWER_LIMB_MUSCLE_ACTIONS,
];

export const MUSCLE_ACTIONS_MAP: Record<string, MuscleActionProfile> = Object.fromEntries(
  MUSCLE_ACTIONS_DB.map((profile) => [profile.muscleId, profile]),
);

export const MUSCLE_REGION_GROUPS: Array<MuscleActionProfile['regionGroupPl']> = [
  'Obręcz barkowa i ramię',
  'Przedramię i ręka',
  'Tułów, grzbiet i przepona',
  'Miednica i biodro',
  'Udo i kolano',
  'Podudzie i stopa',
  'Głowa, szyja i żucie',
];

export const JOINT_GROUPS_META: Array<{
  id: MuscleJointGroupId;
  labelPl: string;
  shortLabelPl: string;
}> = [
  { id: 'shoulder', labelPl: 'Staw ramienny', shortLabelPl: 'Bark' },
  { id: 'scapula', labelPl: 'Obręcz barkowa (łopatka)', shortLabelPl: 'Łopatka' },
  { id: 'elbow', labelPl: 'Staw łokciowy', shortLabelPl: 'Łokieć' },
  { id: 'radioulnar', labelPl: 'Stawy promieniowo-łokciowe', shortLabelPl: 'Przedramię' },
  { id: 'wrist', labelPl: 'Nadgarstek', shortLabelPl: 'Nadgarstek' },
  { id: 'fingers', labelPl: 'Stawy palców ręki', shortLabelPl: 'Palce ręki' },
  { id: 'thoracolumbar_spine', labelPl: 'Kręgosłup piersiowo-lędźwiowy', shortLabelPl: 'Tułów / Lędźwie' },
  { id: 'ribcage_diaphragm', labelPl: 'Klatka piersiowa i oddychanie', shortLabelPl: 'Oddech' },
  { id: 'cervical_spine', labelPl: 'Kręgosłup szyjny', shortLabelPl: 'Szyja' },
  { id: 'tmj', labelPl: 'Staw skroniowo-żuchwowy (SSŻ)', shortLabelPl: 'Żuchwa' },
  { id: 'facial', labelPl: 'Mimika twarzy', shortLabelPl: 'Mimika' },
  { id: 'hip', labelPl: 'Staw biodrowy', shortLabelPl: 'Biodro' },
  { id: 'knee', labelPl: 'Staw kolanowy', shortLabelPl: 'Kolano' },
  { id: 'ankle', labelPl: 'Staw skokowy górny', shortLabelPl: 'Skokowy' },
  { id: 'subtalar', labelPl: 'Staw skokowy dolny', shortLabelPl: 'Podskokowy' },
  { id: 'toes', labelPl: 'Stawy palców stopy', shortLabelPl: 'Palce stopy' },
];

export const JOINT_MOVEMENT_CATALOG: JointMovementOption[] = [
  // Staw ramienny
  { joint: 'shoulder', jointLabelPl: 'Staw ramienny', movementKey: 'shoulder_flexion', movementLabelPl: 'Zgięcie (unoszenie przodem)', planePl: 'Płaszczyzna strzałkowa', sftrNormPl: 'S 0-0-170°' },
  { joint: 'shoulder', jointLabelPl: 'Staw ramienny', movementKey: 'shoulder_extension', movementLabelPl: 'Wyprost (cofanie ramienia)', planePl: 'Płaszczyzna strzałkowa', sftrNormPl: 'S 50-0-0°' },
  { joint: 'shoulder', jointLabelPl: 'Staw ramienny', movementKey: 'shoulder_abduction', movementLabelPl: 'Odwiedzenie ramienia', planePl: 'Płaszczyzna czołowa', sftrNormPl: 'F 170-0-0°' },
  { joint: 'shoulder', jointLabelPl: 'Staw ramienny', movementKey: 'shoulder_adduction', movementLabelPl: 'Przywiedzenie ramienia', planePl: 'Płaszczyzna czołowa', sftrNormPl: 'F 0-0-30°' },
  { joint: 'shoulder', jointLabelPl: 'Staw ramienny', movementKey: 'shoulder_external_rotation', movementLabelPl: 'Rotacja zewnętrzna ramienia', planePl: 'Płaszczyzna poprzeczna', sftrNormPl: 'R 60-0-0°' },
  { joint: 'shoulder', jointLabelPl: 'Staw ramienny', movementKey: 'shoulder_internal_rotation', movementLabelPl: 'Rotacja wewnętrzna ramienia', planePl: 'Płaszczyzna poprzeczna', sftrNormPl: 'R 0-0-70°' },

  // Łopatka
  { joint: 'scapula', jointLabelPl: 'Obręcz barkowa (łopatka)', movementKey: 'scapula_elevation', movementLabelPl: 'Unoszenie (elewacja) łopatki', planePl: 'Płaszczyzna czołowa', sftrNormPl: 'Ruch dogłowowy obręczy' },
  { joint: 'scapula', jointLabelPl: 'Obręcz barkowa (łopatka)', movementKey: 'scapula_depression', movementLabelPl: 'Obniżenie (depresja) łopatki', planePl: 'Płaszczyzna czołowa', sftrNormPl: 'Ruch doogonowy obręczy' },
  { joint: 'scapula', jointLabelPl: 'Obręcz barkowa (łopatka)', movementKey: 'scapula_protraction', movementLabelPl: 'Protrakcja (wysunięcie w przód)', planePl: 'Płaszczyzna poprzeczna', sftrNormPl: 'Ślizg boczno-przedni po żebrach' },
  { joint: 'scapula', jointLabelPl: 'Obręcz barkowa (łopatka)', movementKey: 'scapula_retraction', movementLabelPl: 'Retrakcja (cofnięcie do kręgosłupa)', planePl: 'Płaszczyzna poprzeczna', sftrNormPl: 'Ślizg przyśrodkowy' },
  { joint: 'scapula', jointLabelPl: 'Obręcz barkowa (łopatka)', movementKey: 'scapula_upward_rotation', movementLabelPl: 'Rotacja górna (panewka ku górze)', planePl: 'Płaszczyzna czołowa', sftrNormPl: 'Ok. 60° przy pełnym uniesieniu ręki' },
  { joint: 'scapula', jointLabelPl: 'Obręcz barkowa (łopatka)', movementKey: 'scapula_downward_rotation', movementLabelPl: 'Rotacja dolna (panewka ku dołowi)', planePl: 'Płaszczyzna czołowa', sftrNormPl: 'Powrót z uniesienia ramienia' },

  // Łokieć i przedramię
  { joint: 'elbow', jointLabelPl: 'Staw łokciowy', movementKey: 'elbow_flexion', movementLabelPl: 'Zgięcie łokcia', planePl: 'Płaszczyzna strzałkowa', sftrNormPl: 'S 0-0-145°' },
  { joint: 'elbow', jointLabelPl: 'Staw łokciowy', movementKey: 'elbow_extension', movementLabelPl: 'Wyprost łokcia', planePl: 'Płaszczyzna strzałkowa', sftrNormPl: 'S 0-0-0° (do 10° przeprostu)' },
  { joint: 'radioulnar', jointLabelPl: 'Stawy promieniowo-łokciowe', movementKey: 'forearm_supination', movementLabelPl: 'Odwracanie (supinacja) przedramienia', planePl: 'Płaszczyzna poprzeczna', sftrNormPl: 'R 85-0-0°' },
  { joint: 'radioulnar', jointLabelPl: 'Stawy promieniowo-łokciowe', movementKey: 'forearm_pronation', movementLabelPl: 'Nawracanie (pronacja) przedramienia', planePl: 'Płaszczyzna poprzeczna', sftrNormPl: 'R 0-0-85°' },

  // Nadgarstek i palce ręki
  { joint: 'wrist', jointLabelPl: 'Nadgarstek', movementKey: 'wrist_flexion', movementLabelPl: 'Zgięcie dłoniowe nadgarstka', planePl: 'Płaszczyzna strzałkowa', sftrNormPl: 'S 0-0-75°' },
  { joint: 'wrist', jointLabelPl: 'Nadgarstek', movementKey: 'wrist_extension', movementLabelPl: 'Wyprost grzbietowy nadgarstka', planePl: 'Płaszczyzna strzałkowa', sftrNormPl: 'S 70-0-0°' },
  { joint: 'wrist', jointLabelPl: 'Nadgarstek', movementKey: 'wrist_radial_deviation', movementLabelPl: 'Odchylenie promieniowe ręki', planePl: 'Płaszczyzna czołowa', sftrNormPl: 'F 20-0-0°' },
  { joint: 'wrist', jointLabelPl: 'Nadgarstek', movementKey: 'wrist_ulnar_deviation', movementLabelPl: 'Odchylenie łokciowe ręki', planePl: 'Płaszczyzna czołowa', sftrNormPl: 'F 0-0-35°' },
  { joint: 'fingers', jointLabelPl: 'Stawy palców ręki', movementKey: 'finger_flexion', movementLabelPl: 'Zgięcie palców ręki (MCP / PIP / DIP)', planePl: 'Płaszczyzna strzałkowa', sftrNormPl: 'PIP 100°, DIP 80°' },
  { joint: 'fingers', jointLabelPl: 'Stawy palców ręki', movementKey: 'finger_extension', movementLabelPl: 'Wyprost palców ręki (MCP)', planePl: 'Płaszczyzna strzałkowa', sftrNormPl: 'MCP S 30-0-0°' },

  // Kręgosłup piersiowo-lędźwiowy i oddychanie
  { joint: 'thoracolumbar_spine', jointLabelPl: 'Kręgosłup piersiowo-lędźwiowy', movementKey: 'trunk_flexion', movementLabelPl: 'Zgięcie tułowia w przód', planePl: 'Płaszczyzna strzałkowa', sftrNormPl: 'S 0-0-60°' },
  { joint: 'thoracolumbar_spine', jointLabelPl: 'Kręgosłup piersiowo-lędźwiowy', movementKey: 'trunk_extension', movementLabelPl: 'Wyprost tułowia w tył', planePl: 'Płaszczyzna strzałkowa', sftrNormPl: 'S 30-0-0°' },
  { joint: 'thoracolumbar_spine', jointLabelPl: 'Kręgosłup piersiowo-lędźwiowy', movementKey: 'trunk_lateral_flexion', movementLabelPl: 'Zgięcie boczne tułowia', planePl: 'Płaszczyzna czołowa', sftrNormPl: 'F 35-0-35°' },
  { joint: 'thoracolumbar_spine', jointLabelPl: 'Kręgosłup piersiowo-lędźwiowy', movementKey: 'trunk_rotation', movementLabelPl: 'Rotacja tułowia', planePl: 'Płaszczyzna poprzeczna', sftrNormPl: 'R 45-0-45°' },
  { joint: 'thoracolumbar_spine', jointLabelPl: 'Kręgosłup piersiowo-lędźwiowy', movementKey: 'pelvic_posterior_tilt', movementLabelPl: 'Tyłopochylenie miednicy', planePl: 'Płaszczyzna strzałkowa', sftrNormPl: 'Spłaszczenie lordozy lędźwiowej' },
  { joint: 'thoracolumbar_spine', jointLabelPl: 'Kręgosłup piersiowo-lędźwiowy', movementKey: 'pelvic_elevation', movementLabelPl: 'Unoszenie miednicy (hip hiking)', planePl: 'Płaszczyzna czołowa', sftrNormPl: 'Łańcuch zamknięty / chód' },
  { joint: 'thoracolumbar_spine', jointLabelPl: 'Kręgosłup piersiowo-lędźwiowy', movementKey: 'core_stabilization', movementLabelPl: 'Głęboka stabilizacja centralna (IAP)', planePl: 'Płaszczyzna poprzeczna', sftrNormPl: 'Cylinder stabilizacyjny tułowia' },
  { joint: 'ribcage_diaphragm', jointLabelPl: 'Klatka piersiowa i oddychanie', movementKey: 'inspiration', movementLabelPl: 'Wdech (główny i pomocniczy)', planePl: 'Płaszczyzna skośna / złożona', sftrNormPl: 'Obniżenie przepony + unoszenie żeber' },
  { joint: 'ribcage_diaphragm', jointLabelPl: 'Klatka piersiowa i oddychanie', movementKey: 'forced_expiration', movementLabelPl: 'Forsowny wydech i tłocznia brzuszna', planePl: 'Płaszczyzna skośna / złożona', sftrNormPl: 'Kaszel, śpiew, stabilizacja' },

  // Kręgosłup szyjny, SSŻ, mimika
  { joint: 'cervical_spine', jointLabelPl: 'Kręgosłup szyjny', movementKey: 'cervical_flexion', movementLabelPl: 'Zgięcie odcinka szyjnego', planePl: 'Płaszczyzna strzałkowa', sftrNormPl: 'S 0-0-45°' },
  { joint: 'cervical_spine', jointLabelPl: 'Kręgosłup szyjny', movementKey: 'cervical_extension', movementLabelPl: 'Wyprost odcinka szyjnego', planePl: 'Płaszczyzna strzałkowa', sftrNormPl: 'S 45-0-0°' },
  { joint: 'cervical_spine', jointLabelPl: 'Kręgosłup szyjny', movementKey: 'cervical_lateral_flexion', movementLabelPl: 'Zgięcie boczne szyi', planePl: 'Płaszczyzna czołowa', sftrNormPl: 'F 45-0-45°' },
  { joint: 'cervical_spine', jointLabelPl: 'Kręgosłup szyjny', movementKey: 'cervical_rotation', movementLabelPl: 'Rotacja głowy i szyi', planePl: 'Płaszczyzna poprzeczna', sftrNormPl: 'R 70-0-70°' },
  { joint: 'tmj', jointLabelPl: 'Staw skroniowo-żuchwowy (SSŻ)', movementKey: 'jaw_elevation', movementLabelPl: 'Unoszenie żuchwy (zwieranie szczęk)', planePl: 'Płaszczyzna strzałkowa', sftrNormPl: 'Zamknięcie z 40–50 mm → 0 mm' },
  { joint: 'tmj', jointLabelPl: 'Staw skroniowo-żuchwowy (SSŻ)', movementKey: 'jaw_protrusion', movementLabelPl: 'Protruzja (wysuwanie) żuchwy', planePl: 'Płaszczyzna strzałkowa', sftrNormPl: '6–10 mm w przód' },
  { joint: 'tmj', jointLabelPl: 'Staw skroniowo-żuchwowy (SSŻ)', movementKey: 'jaw_retrusion', movementLabelPl: 'Retruzja (cofanie) żuchwy', planePl: 'Płaszczyzna strzałkowa', sftrNormPl: '2–4 mm w tył' },
  { joint: 'facial', jointLabelPl: 'Mimika twarzy', movementKey: 'facial_nose_expression', movementLabelPl: 'Ruchy skrzydeł nosa i górnej wargi', planePl: 'Płaszczyzna skośna / złożona', sftrNormPl: 'Mimika oddechowa (n. VII)' },
  { joint: 'facial', jointLabelPl: 'Mimika twarzy', movementKey: 'facial_brow_expression', movementLabelPl: 'Obniżanie gładzizny i brwi', planePl: 'Płaszczyzna strzałkowa', sftrNormPl: 'Ekspresja górnego piętra (n. VII)' },

  // Biodro
  { joint: 'hip', jointLabelPl: 'Staw biodrowy', movementKey: 'hip_flexion', movementLabelPl: 'Zgięcie biodra', planePl: 'Płaszczyzna strzałkowa', sftrNormPl: 'S 0-0-125°' },
  { joint: 'hip', jointLabelPl: 'Staw biodrowy', movementKey: 'hip_extension', movementLabelPl: 'Wyprost biodra', planePl: 'Płaszczyzna strzałkowa', sftrNormPl: 'S 15-0-0°' },
  { joint: 'hip', jointLabelPl: 'Staw biodrowy', movementKey: 'hip_abduction', movementLabelPl: 'Odwiedzenie biodra', planePl: 'Płaszczyzna czołowa', sftrNormPl: 'F 45-0-0°' },
  { joint: 'hip', jointLabelPl: 'Staw biodrowy', movementKey: 'hip_adduction', movementLabelPl: 'Przywiedzenie biodra', planePl: 'Płaszczyzna czołowa', sftrNormPl: 'F 0-0-30°' },
  { joint: 'hip', jointLabelPl: 'Staw biodrowy', movementKey: 'hip_external_rotation', movementLabelPl: 'Rotacja zewnętrzna biodra', planePl: 'Płaszczyzna poprzeczna', sftrNormPl: 'R 45-0-0°' },
  { joint: 'hip', jointLabelPl: 'Staw biodrowy', movementKey: 'hip_internal_rotation', movementLabelPl: 'Rotacja wewnętrzna biodra', planePl: 'Płaszczyzna poprzeczna', sftrNormPl: 'R 0-0-40°' },

  // Kolano
  { joint: 'knee', jointLabelPl: 'Staw kolanowy', movementKey: 'knee_extension', movementLabelPl: 'Wyprost kolana', planePl: 'Płaszczyzna strzałkowa', sftrNormPl: 'S 0-0-0°' },
  { joint: 'knee', jointLabelPl: 'Staw kolanowy', movementKey: 'knee_flexion', movementLabelPl: 'Zgięcie kolana', planePl: 'Płaszczyzna strzałkowa', sftrNormPl: 'S 0-0-135°' },
  { joint: 'knee', jointLabelPl: 'Staw kolanowy', movementKey: 'knee_internal_rotation', movementLabelPl: 'Rotacja wewnętrzna podudzia (odblokowanie)', planePl: 'Płaszczyzna poprzeczna', sftrNormPl: 'R 0-0-15° (przy zgiętym kolanie)' },
  { joint: 'knee', jointLabelPl: 'Staw kolanowy', movementKey: 'knee_external_rotation', movementLabelPl: 'Rotacja zewnętrzna podudzia', planePl: 'Płaszczyzna poprzeczna', sftrNormPl: 'R 30-0-0° (przy zgiętym kolanie)' },

  // Staw skokowy i stopa
  { joint: 'ankle', jointLabelPl: 'Staw skokowy górny', movementKey: 'ankle_dorsiflexion', movementLabelPl: 'Zgięcie grzbietowe stopy', planePl: 'Płaszczyzna strzałkowa', sftrNormPl: 'S 20-0-0°' },
  { joint: 'ankle', jointLabelPl: 'Staw skokowy górny', movementKey: 'ankle_plantarflexion', movementLabelPl: 'Zgięcie podeszwowe stopy', planePl: 'Płaszczyzna strzałkowa', sftrNormPl: 'S 0-0-50°' },
  { joint: 'subtalar', jointLabelPl: 'Staw skokowy dolny', movementKey: 'foot_inversion', movementLabelPl: 'Odwracanie (inwersja / supinacja) stopy', planePl: 'Płaszczyzna czołowa', sftrNormPl: 'R 35-0-0°' },
  { joint: 'subtalar', jointLabelPl: 'Staw skokowy dolny', movementKey: 'foot_eversion', movementLabelPl: 'Nawracanie (ewersja / pronacja) stopy', planePl: 'Płaszczyzna czołowa', sftrNormPl: 'R 0-0-20°' },
  { joint: 'toes', jointLabelPl: 'Stawy palców stopy', movementKey: 'toe_extension', movementLabelPl: 'Wyprost (zgięcie grzbietowe) palców i palucha', planePl: 'Płaszczyzna strzałkowa', sftrNormPl: 'I MTP: S 70-0-0°' },
  { joint: 'toes', jointLabelPl: 'Stawy palców stopy', movementKey: 'toe_flexion', movementLabelPl: 'Zgięcie podeszwowe palców i palucha', planePl: 'Płaszczyzna strzałkowa', sftrNormPl: 'Paluch IP: S 0-0-60°' },
];

export const OPPOSITE_MOVEMENT_KEYS: Record<string, string> = {
  shoulder_flexion: 'shoulder_extension',
  shoulder_extension: 'shoulder_flexion',
  shoulder_abduction: 'shoulder_adduction',
  shoulder_adduction: 'shoulder_abduction',
  shoulder_external_rotation: 'shoulder_internal_rotation',
  shoulder_internal_rotation: 'shoulder_external_rotation',
  scapula_elevation: 'scapula_depression',
  scapula_depression: 'scapula_elevation',
  scapula_protraction: 'scapula_retraction',
  scapula_retraction: 'scapula_protraction',
  scapula_upward_rotation: 'scapula_downward_rotation',
  scapula_downward_rotation: 'scapula_upward_rotation',
  elbow_flexion: 'elbow_extension',
  elbow_extension: 'elbow_flexion',
  forearm_supination: 'forearm_pronation',
  forearm_pronation: 'forearm_supination',
  wrist_flexion: 'wrist_extension',
  wrist_extension: 'wrist_flexion',
  wrist_radial_deviation: 'wrist_ulnar_deviation',
  wrist_ulnar_deviation: 'wrist_radial_deviation',
  finger_flexion: 'finger_extension',
  finger_extension: 'finger_flexion',
  trunk_flexion: 'trunk_extension',
  trunk_extension: 'trunk_flexion',
  inspiration: 'forced_expiration',
  forced_expiration: 'inspiration',
  cervical_flexion: 'cervical_extension',
  cervical_extension: 'cervical_flexion',
  jaw_protrusion: 'jaw_retrusion',
  jaw_retrusion: 'jaw_protrusion',
  hip_flexion: 'hip_extension',
  hip_extension: 'hip_flexion',
  hip_abduction: 'hip_adduction',
  hip_adduction: 'hip_abduction',
  hip_external_rotation: 'hip_internal_rotation',
  hip_internal_rotation: 'hip_external_rotation',
  knee_extension: 'knee_flexion',
  knee_flexion: 'knee_extension',
  knee_internal_rotation: 'knee_external_rotation',
  knee_external_rotation: 'knee_internal_rotation',
  ankle_dorsiflexion: 'ankle_plantarflexion',
  ankle_plantarflexion: 'ankle_dorsiflexion',
  foot_inversion: 'foot_eversion',
  foot_eversion: 'foot_inversion',
  toe_extension: 'toe_flexion',
  toe_flexion: 'toe_extension',
};

export function getMuscleActionProfile(muscleId: string): MuscleActionProfile | undefined {
  return MUSCLE_ACTIONS_MAP[muscleId];
}

export function getMovementsForJoint(joint: MuscleJointGroupId): JointMovementOption[] {
  return JOINT_MOVEMENT_CATALOG.filter((item) => item.joint === joint);
}

/**
 * Odwrotny filtr: „Kto wykonuje ten ruch?”
 * Zwraca głównych agonistów, pomocniczych synergistów oraz antagonistów dla wybranego stawu i ruchu.
 */
export function findMusclesByJointAndMovement(
  joint: MuscleJointGroupId,
  movementKey: string,
): ReverseMovementLookupResult | null {
  const option = JOINT_MOVEMENT_CATALOG.find(
    (item) => item.joint === joint && item.movementKey === movementKey,
  );
  if (!option) return null;

  const primary: MuscleActionProfile[] = [];
  const secondary: MuscleActionProfile[] = [];
  const matchedIds = new Set<string>();

  for (const profile of MUSCLE_ACTIONS_DB) {
    const matching = profile.actions.filter(
      (a) => a.joint === joint && a.movementKey === movementKey,
    );
    if (matching.length === 0) continue;
    matchedIds.add(profile.muscleId);
    if (matching.some((a) => a.role === 'primary')) {
      primary.push(profile);
    } else {
      secondary.push(profile);
    }
  }

  const oppositeKey = OPPOSITE_MOVEMENT_KEYS[movementKey];
  const antagonists: MuscleActionProfile[] = [];

  if (oppositeKey) {
    for (const profile of MUSCLE_ACTIONS_DB) {
      if (matchedIds.has(profile.muscleId)) continue;
      const isOpp = profile.actions.some(
        (a) => a.joint === joint && a.movementKey === oppositeKey && a.role === 'primary',
      );
      if (isOpp) {
        antagonists.push(profile);
      }
    }
    // If no primary opposite found, include secondary opposites
    if (antagonists.length === 0) {
      for (const profile of MUSCLE_ACTIONS_DB) {
        if (matchedIds.has(profile.muscleId)) continue;
        if (profile.actions.some((a) => a.joint === joint && a.movementKey === oppositeKey)) {
          antagonists.push(profile);
        }
      }
    }
  }

  return { option, primary, secondary, antagonists };
}

/**
 * Porównywarka 2 dowolnych mięśni: wspólne ruchy, ruchy przeciwstawne, unerwienie i relacja.
 */
export function compareTwoMuscles(
  muscleIdA: string,
  muscleIdB: string,
): MuscleComparisonResult | null {
  const muscleA = MUSCLE_ACTIONS_MAP[muscleIdA];
  const muscleB = MUSCLE_ACTIONS_MAP[muscleIdB];
  if (!muscleA || !muscleB) return null;

  const sharedActions: MuscleComparisonResult['sharedActions'] = [];
  const oppositeActionPairs: MuscleComparisonResult['oppositeActionPairs'] = [];
  const sharedKeys = new Set<string>();

  for (const actA of muscleA.actions) {
    const key = `${actA.joint}:${actA.movementKey}`;
    const matchB = muscleB.actions.find(
      (b) => b.joint === actA.joint && b.movementKey === actA.movementKey,
    );
    if (matchB && !sharedKeys.has(key)) {
      sharedKeys.add(key);
      const catalog = JOINT_MOVEMENT_CATALOG.find(
        (c) => c.joint === actA.joint && c.movementKey === actA.movementKey,
      );
      sharedActions.push({
        jointLabelPl: catalog?.jointLabelPl ?? actA.jointLabelPl,
        movementLabelPl: catalog?.movementLabelPl ?? actA.movementLabelPl,
        roleA: actA.role,
        roleB: matchB.role,
      });
    }

    const oppKey = OPPOSITE_MOVEMENT_KEYS[actA.movementKey];
    if (oppKey) {
      const oppB = muscleB.actions.find(
        (b) => b.joint === actA.joint && b.movementKey === oppKey,
      );
      if (oppB) {
        const pairKey = `${actA.joint}:${[actA.movementKey, oppKey].sort().join('|')}`;
        if (
          !oppositeActionPairs.some(
            (p) => `${p.jointLabelPl}:${p.actionAPl}|${p.actionBPl}` === pairKey,
          )
        ) {
          const catA = JOINT_MOVEMENT_CATALOG.find(
            (c) => c.joint === actA.joint && c.movementKey === actA.movementKey,
          );
          const catB = JOINT_MOVEMENT_CATALOG.find(
            (c) => c.joint === oppB.joint && c.movementKey === oppB.movementKey,
          );
          oppositeActionPairs.push({
            jointLabelPl: catA?.jointLabelPl ?? actA.jointLabelPl,
            actionAPl: catA?.movementLabelPl ?? actA.movementLabelPl,
            actionBPl: catB?.movementLabelPl ?? oppB.movementLabelPl,
          });
        }
      }
    }
  }

  const onlyInA = muscleA.actions.filter(
    (a) => !muscleB.actions.some((b) => b.joint === a.joint && b.movementKey === a.movementKey),
  );
  const onlyInB = muscleB.actions.filter(
    (b) => !muscleA.actions.some((a) => a.joint === b.joint && a.movementKey === b.movementKey),
  );

  const anatA = ANATOMY_MAP[muscleIdA];
  const anatB = ANATOMY_MAP[muscleIdB];
  const normNerve = (s?: string) =>
    (s ?? '')
      .toLowerCase()
      .replace(/\(.*?\)/g, '')
      .split(/[.,;]/)[0]
      .trim();

  const sameInnervation =
    Boolean(anatA && anatB) &&
    normNerve(anatA.innervation).length > 4 &&
    normNerve(anatA.innervation) === normNerve(anatB.innervation);

  const areAntagonists =
    muscleA.antagonistIds.includes(muscleIdB) ||
    muscleB.antagonistIds.includes(muscleIdA) ||
    oppositeActionPairs.length > 0;

  const areSynergists =
    muscleA.synergistIds.includes(muscleIdB) ||
    muscleB.synergistIds.includes(muscleIdA) ||
    sharedActions.length > 0;

  return {
    muscleA,
    muscleB,
    sharedActions,
    oppositeActionPairs,
    onlyInA,
    onlyInB,
    sameInnervation,
    areAntagonists,
    areSynergists,
  };
}

/** Curated popular side-by-side comparison pairs for 1-click study */
export const FEATURED_MUSCLE_COMPARISONS: Array<{
  idA: string;
  idB: string;
  labelPl: string;
}> = [
  { idA: 'm_gastrocnemius', idB: 'm_soleus', labelPl: 'Brzuchaty łydki vs Płaszczkowaty' },
  { idA: 'm_biceps_brachii', idB: 'm_brachialis', labelPl: 'Dwugłowy ramienia vs Ramienny' },
  { idA: 'm_obliquus_externus_abdominis', idB: 'm_obliquus_internus_abdominis', labelPl: 'Skośny zewnętrzny vs wewnętrzny brzucha' },
  { idA: 'm_sternocleidomastoideus', idB: 'm_splenius_capitis', labelPl: 'MOS vs Płatowaty głowy (rotacja!)' },
  { idA: 'm_tibialis_anterior', idB: 'm_peroneus_longus', labelPl: 'Piszczelowy przedni vs Strzałkowy długi (strzemię)' },
  { idA: 'm_teres_minor', idB: 'm_teres_major', labelPl: 'Obły mniejszy vs Obły większy' },
  { idA: 'm_flexor_digitorum_superficialis', idB: 'm_flexor_digitorum_profundus', labelPl: 'Zginacz powierzchowny vs głęboki palców' },
  { idA: 'm_gluteus_maximus', idB: 'm_iliopsoas', labelPl: 'Pośladkowy wielki vs Biodrowo-lędźwiowy' },
];

function deterministicShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = seed | 0;
  for (let i = arr.length - 1; i > 0; i -= 1) {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    const j = Math.abs(s) % (i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function getMuscleDisplayName(muscleId: string): string {
  return ANATOMY_MAP[muscleId]?.namePl ?? muscleId;
}

function pickDistractorMuscles(
  target: MuscleActionProfile,
  pool: MuscleActionProfile[],
  count: number,
  seed: number,
): MuscleActionProfile[] {
  const sameRegion = pool.filter(
    (m) => m.muscleId !== target.muscleId && m.regionGroupPl === target.regionGroupPl,
  );
  const otherRegion = pool.filter(
    (m) => m.muscleId !== target.muscleId && m.regionGroupPl !== target.regionGroupPl,
  );
  const ordered = [
    ...deterministicShuffle(sameRegion, seed + 17),
    ...deterministicShuffle(otherRegion, seed + 31),
  ];
  return ordered.slice(0, count);
}

/**
 * Generator interaktywnego Quizu Ruchów Mięśni 3D (4 typy pytań):
 * 1. visual_3d_motion — rozpoznaj mięsień na podstawie żywej, zamaskowanej symulacji 3D
 * 2. subpart_akton — pytania o podział na głowy / aktony
 * 3. closed_chain_pf — pytania o łańcuch zamknięty i odwrócony przyczep (Punctum Fixum)
 * 4. function_and_nerve — rozpoznaj mięsień po czynności, unerwieniu i pułapce klinicznej
 */
export function buildMuscleActionsQuizQuestions(options?: {
  regionGroupPl?: MuscleActionProfile['regionGroupPl'] | 'all';
  kindFilter?: MuscleQuizQuestionKind | 'mixed';
  count?: number;
  seed?: number;
}): MuscleActionsQuizQuestion[] {
  const regionGroupPl = options?.regionGroupPl ?? 'all';
  const kindFilter = options?.kindFilter ?? 'mixed';
  const count = Math.max(1, Math.min(options?.count ?? 8, 20));
  const seed = options?.seed ?? Math.floor(Date.now() % 100000);

  const filteredPool =
    regionGroupPl === 'all'
      ? MUSCLE_ACTIONS_DB
      : MUSCLE_ACTIONS_DB.filter((m) => m.regionGroupPl === regionGroupPl);

  const workingPool = filteredPool.length >= 4 ? filteredPool : MUSCLE_ACTIONS_DB;
  const shuffledPool = deterministicShuffle(workingPool, seed);

  const allKinds: MuscleQuizQuestionKind[] =
    kindFilter === 'mixed'
      ? ['visual_3d_motion', 'subpart_akton', 'closed_chain_pf', 'function_and_nerve']
      : [kindFilter];

  const questions: MuscleActionsQuizQuestion[] = [];
  const usedMuscleIds = new Set<string>();

  for (let i = 0; i < count; i += 1) {
    let desiredKind = allKinds[i % allKinds.length];

    // Pick candidate muscle suitable for desiredKind
    let target: MuscleActionProfile | undefined;
    if (desiredKind === 'subpart_akton') {
      target = shuffledPool.find(
        (m) => !usedMuscleIds.has(m.muscleId) && m.subparts && m.subparts.length >= 2,
      );
      if (!target) {
        // Fallback to full DB for subpart questions if region has fewer multi-head muscles
        target = deterministicShuffle(MUSCLE_ACTIONS_DB, seed + i * 7).find(
          (m) => !usedMuscleIds.has(m.muscleId) && m.subparts && m.subparts.length >= 2,
        );
      }
      if (!target) desiredKind = 'function_and_nerve';
    }

    if (!target) {
      target =
        shuffledPool.find((m) => !usedMuscleIds.has(m.muscleId)) ??
        shuffledPool[i % shuffledPool.length];
    }

    usedMuscleIds.add(target.muscleId);
    const distractors = pickDistractorMuscles(target, workingPool, 3, seed + i * 29);
    const targetName = getMuscleDisplayName(target.muscleId);
    const anat = ANATOMY_MAP[target.muscleId];

    if (desiredKind === 'visual_3d_motion') {
      const preset = target.kinematicPresets[0];
      const rawOptions = deterministicShuffle(
        [
          { text: targetName, correct: true },
          ...distractors.map((d) => ({ text: getMuscleDisplayName(d.muscleId), correct: false })),
        ],
        seed + i * 53,
      );
      const correctIndex = rawOptions.findIndex((o) => o.correct);

      questions.push({
        id: `mq_vis_${target.muscleId}_${i}`,
        kind: 'visual_3d_motion',
        kindLabelPl: 'Symulacja 3D ruchu',
        muscleId: target.muscleId,
        kinematicPresetId: preset.id,
        promptPl: `Obserwuj animację 3D (${preset.planePl}, ${preset.sftrLabel}). Który mięsień jest głównym sprawcą tego ruchu?`,
        hintPl: `Region: ${target.regionGroupPl} • Staw: ${target.actions[0]?.jointLabelPl ?? ''}.`,
        options: rawOptions.map((o) => o.text),
        correctIndex,
        explanationPl: `${targetName}: ${preset.labelPl}. ${preset.openChainCaptionPl} ${target.examTrapPl}`,
      });
    } else if (desiredKind === 'subpart_akton' && target.subparts && target.subparts.length >= 2) {
      const subpart = target.subparts[i % target.subparts.length];
      const rawOptions = deterministicShuffle(
        [
          { text: `${targetName} — ${subpart.namePl}`, correct: true },
          ...distractors.map((d) => ({
            text:
              d.subparts && d.subparts.length > 0
                ? `${getMuscleDisplayName(d.muscleId)} — ${d.subparts[0].namePl}`
                : getMuscleDisplayName(d.muscleId),
            correct: false,
          })),
        ],
        seed + i * 67,
      );
      const correctIndex = rawOptions.findIndex((o) => o.correct);

      questions.push({
        id: `mq_sub_${target.muscleId}_${i}`,
        kind: 'subpart_akton',
        kindLabelPl: 'Aktony i głowy mięśnia',
        muscleId: target.muscleId,
        promptPl: `Który akton / głowa mięśnia odpowiada za opisaną czynność: „${subpart.actionsPl}”?`,
        hintPl: `Region: ${target.regionGroupPl}. Zwróć uwagę na specyficzny kierunek włókien!`,
        options: rawOptions.map((o) => o.text),
        correctIndex,
        explanationPl: `${targetName} (${subpart.namePl}): ${subpart.actionsPl} ${subpart.clinicalNotePl ?? target.examTrapPl}`,
      });
    } else if (desiredKind === 'closed_chain_pf') {
      const rawOptions = deterministicShuffle(
        [
          { text: targetName, correct: true },
          ...distractors.map((d) => ({ text: getMuscleDisplayName(d.muscleId), correct: false })),
        ],
        seed + i * 79,
      );
      const correctIndex = rawOptions.findIndex((o) => o.correct);

      questions.push({
        id: `mq_pf_${target.muscleId}_${i}`,
        kind: 'closed_chain_pf',
        kindLabelPl: 'Punctum Fixum (łańcuch zamknięty)',
        muscleId: target.muscleId,
        promptPl: `Dla którego mięśnia charakterystyczna jest taka praca przy odwróconym przyczepie (łańcuch zamknięty): „${target.closedChainReversedPl}”?`,
        hintPl: `Staw główny: ${target.actions[0]?.jointLabelPl ?? target.regionGroupPl}.`,
        options: rawOptions.map((o) => o.text),
        correctIndex,
        explanationPl: `${targetName} — łańcuch otwarty: ${target.openChainSummaryPl} Łańcuch zamknięty: ${target.closedChainReversedPl}`,
      });
    } else {
      const primaryActionsText = target.actions
        .filter((a) => a.role === 'primary')
        .map((a) => a.movementLabelPl)
        .slice(0, 2)
        .join('; ');
      const rawOptions = deterministicShuffle(
        [
          { text: targetName, correct: true },
          ...distractors.map((d) => ({ text: getMuscleDisplayName(d.muscleId), correct: false })),
        ],
        seed + i * 97,
      );
      const correctIndex = rawOptions.findIndex((o) => o.correct);

      questions.push({
        id: `mq_fn_${target.muscleId}_${i}`,
        kind: 'function_and_nerve',
        kindLabelPl: 'Funkcja i unerwienie',
        muscleId: target.muscleId,
        promptPl: `Który mięsień wykonuje: „${primaryActionsText}”, a jego unerwienie to: ${anat?.innervation ?? '—'} (${anat?.spinalSegments ?? '—'})?`,
        hintPl: `Wskazówka palpacyjna: ${target.palpationLandmarkPl.slice(0, 120)}`,
        options: rawOptions.map((o) => o.text),
        correctIndex,
        explanationPl: `${targetName}: ${target.shortTaglinePl}. Pułapka egzaminacyjna: ${target.examTrapPl}`,
      });
    }
  }

  return questions;
}
