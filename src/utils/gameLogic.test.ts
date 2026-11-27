import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as THREE from 'three';
import { ANATOMY_DB, ANATOMY_MAP } from '../data/anatomyDb.ts';
import { BONY_LANDMARKS } from '../data/bonyLandmarks.ts';
import { CLINICAL_TESTS_DB, CLINICAL_TEST_MAP } from '../data/clinicalTestsDb.ts';
import { LESSON_TASK_BANKS, SKILL_SECTIONS } from '../data/curriculum.ts';
import {
  buildDermatomeQuizQuestions,
  DERMATOME_MYOTOME_LEVELS,
  doesMuscleMeshMatchMyotome,
  doesSkinMeshMatchDermatome,
  getDermatomeLevelById,
} from '../data/dermatomesMyotomes.ts';
import {
  CLINICAL_NERVE_PROFILES,
  doesMeshMatchNerveInnervation,
  getNerveProfileByStructureId,
  getNervesForMuscle,
} from '../data/nerveMuscleMap.ts';
import { PATIENT_CASE_MAP, PATIENT_CASES_DB } from '../data/patientCasesDb.ts';
import {
  BIOMECHANICS_JOINT_GROUPS,
  BIOMECHANICS_MAP,
  BIOMECHANICS_MOVEMENTS,
  buildBiomechanicsQuizQuestions,
  getMovementById,
  getMovementsForMuscle,
  resolveMuscleBiomechanicsRole,
} from '../data/biomechanicsDb.ts';
import {
  buildMuscleActionsQuizQuestions,
  compareTwoMuscles,
  findMusclesByJointAndMovement,
  JOINT_MOVEMENT_CATALOG,
  MUSCLE_ACTIONS_DB,
  MUSCLE_ACTIONS_MAP,
} from '../data/muscleActionsDb.ts';
import {
  classifyBoneSegment,
  computeFiberBundlePoints,
  computeJointPivotFromBoneBoxes,
  computeProtractorArcPoints,
  deriveMuscleAnchorsFromBox,
  evaluateKinematicFrame,
  SIMULATOR_SCENE_FILES,
} from '../three/muscleKinematics.ts';
import {
  buildBoneSurfaceZones,
  detectHitBoneSurfaceZone,
  doesLandmarkAttachMuscle,
  getLandmarkAttachmentRoleForMuscle,
  getMuscleAttachmentZones,
  resolveAttachedMuscleTarget,
  updateAllBoneSurfaceColors,
} from '../three/boneSurfaceZones.ts';
import {
  buildPinExamQuestions,
  buildReversePinOptions,
  evaluatePinExamAnswer,
  evaluateReverseTypingAnswer,
  getPinExamPoolCounts,
  PIN_EXAM_REGIONS,
} from './pinExamLogic.ts';
import {
  applySrsReview,
  buildSrsDeck,
  buildSrsStudyQueue,
  getAllSrsCards,
  getSrsDeckStats,
} from './srsLogic.ts';
import {
  classifyBaseGlbMeshLayer,
  createDefaultLayerVisibility,
  createMaterialForLayer,
  formatMuscleSubpartPolish,
  getUnifiedMeshGroupKey,
} from '../three/anatomyLayers.ts';
import { translateMeshNameToPolish } from './anatomyTranslator.ts';
import {
  buildJsDelivrUrl,
  extractGlbModelsFromTree,
  parseOwnerRepo,
} from './githubModels.ts';
import {
  applyAnswerOutcome,
  buildHeartRecoveryTasks,
  buildLessonTasks,
  calculateOsceGrade,
  completeLessonProgress,
  createInitialProgress,
  exportProgressToJson,
  filterAtlasStructures,
  getAllLessonsOrdered,
  getLessonStatuses,
  getStructureDetailLabels,
  isClinicalOrKinesitherapyLesson,
  isTypingAnswerCorrect,
  normalizeAnatomyAnswer,
  parseImportedProgress,
  restoreHeartsProgress,
} from './gameLogic.ts';
import {
  CORE_OFFLINE_3D_ASSETS,
  OFFLINE_MODEL_PACKS,
  PHYSIOLINGO_APP_CACHE,
  PHYSIOLINGO_MODELS_CACHE,
  TOTAL_OFFLINE_3D_BYTES,
  TOTAL_OFFLINE_3D_FILES,
  formatBytesPl,
} from '../services/pwaOfflineService.ts';
import { computeClickOrbitGoal } from '../three/cameraFocus.ts';

test('anatomical database covers both required regions in 100% Polish without Latin fields', () => {
  const shoulder = ANATOMY_DB.filter((s) => s.region === 'shoulder');
  const knee = ANATOMY_DB.filter((s) => s.region === 'knee');
  assert.ok(shoulder.length >= 15, 'Should have comprehensive shoulder anatomy entries');
  assert.ok(knee.length >= 15, 'Should have comprehensive knee anatomy entries');

  for (const item of ANATOMY_DB) {
    assert.ok(item.namePl.trim().length > 0, `Missing namePl for ${item.id}`);
    assert.equal('nameLat' in item, false, `nameLat should be removed from ${item.id}`);
    assert.ok(item.pp.trim().length > 0, `Missing PP for ${item.id}`);
    assert.ok(item.pk.trim().length > 0, `Missing PK for ${item.id}`);
    assert.ok(item.functionDesc.trim().length > 0, `Missing function for ${item.id}`);
    assert.ok(item.clinicalCorrelation.trim().length > 0, `Missing clinic for ${item.id}`);
    const fullText = `${item.namePl} ${item.pp} ${item.pk} ${item.functionDesc} ${item.innervation} ${item.clinicalCorrelation} ${item.funFact}`;
    assert.equal(
      /\b(musculus|ligamentum|tuberculum|articulatio|processus)\b/i.test(fullText),
      false,
      `Entry ${item.id} still contains Latin anatomical terminology`,
    );
  }

  // Verify muscles are unified as whole anatomical muscles (no split quadriceps parts)
  assert.ok(ANATOMY_MAP.m_quadriceps_femoris, 'Unified m_quadriceps_femoris must exist');
  for (const splitId of [
    'm_rectus_femoris',
    'm_vastus_lateralis',
    'm_vastus_medialis',
    'm_vastus_intermedius',
  ]) {
    assert.equal(ANATOMY_MAP[splitId], undefined, `Split muscle ${splitId} must not exist`);
  }
});

test('every lesson in skill tree contains all 5 task types in 100% Polish', () => {
  const lessons = getAllLessonsOrdered();
  assert.equal(SKILL_SECTIONS.length, 11);
  assert.equal(lessons.length, 37);

  const expectedTypes = ['matching', 'model3d', 'multiple_choice', 'clinical_case', 'typing'];
  for (const lesson of lessons) {
    for (const sId of lesson.structureIds) {
      assert.ok(
        ANATOMY_MAP[sId],
        `Lesson ${lesson.id} structureIds contains unknown structureId ${sId}`,
      );
    }
    const bank = LESSON_TASK_BANKS[lesson.id];
    assert.ok(bank && bank.length >= 5, `Lesson ${lesson.id} should have at least 5 tasks`);
    for (const task of bank) {
      assert.ok(
        ANATOMY_MAP[task.structureId],
        `Task ${task.id} references unknown structureId ${task.structureId}`,
      );
      if (task.type === 'model3d') {
        assert.equal('targetNameLat' in task, false, `Task ${task.id} should not have targetNameLat`);
        assert.ok(
          typeof task.targetNameEn === 'string' && task.targetNameEn.trim().length > 0,
          `Task ${task.id} must have non-empty targetNameEn`,
        );
      }
      if ('prompt' in task && typeof task.prompt === 'string') {
        assert.equal(
          /po łacinie|łacińsk|\b(musculus|ligamentum|tuberculum|articulatio)\b/i.test(task.prompt),
          false,
          `Task ${task.id} should be 100% Polish: ${task.prompt}`,
        );
      }
      if (task.type === 'typing') {
        assert.equal(task.targetLanguage, 'pl', `Typing task ${task.id} must target Polish`);
      }
    }

    const built = buildLessonTasks(lesson.id);
    assert.ok(built.length >= 5 && built.length <= 8, `Built tasks count for ${lesson.id}: ${built.length}`);
    for (const t of expectedTypes) {
      assert.ok(
        built.some((item) => item.type === t),
        `Lesson ${lesson.id} built tasks missing type ${t}`,
      );
    }
  }
});

test('typing challenge normalizes Polish answers, case, and diacritics accurately', () => {
  const acceptedQuad = ['mięsień czworogłowy uda', 'czworogłowy uda'];
  assert.equal(isTypingAnswerCorrect('mięsień czworogłowy uda', acceptedQuad), true);
  assert.equal(isTypingAnswerCorrect('Miesien Czworoglowy Uda', acceptedQuad), true);
  assert.equal(isTypingAnswerCorrect('m. czworogłowy uda', acceptedQuad), true);
  assert.equal(isTypingAnswerCorrect('czworogłowy uda', acceptedQuad), true);
  assert.equal(isTypingAnswerCorrect('mięsień dwugłowy uda', acceptedQuad), false);
  assert.equal(isTypingAnswerCorrect('', acceptedQuad), false);

  assert.equal(normalizeAnatomyAnswer('Więzadło krzyżowe przednie'), 'krzyzowe przednie');
  assert.equal(normalizeAnatomyAnswer('Staw ramienny'), 'ramienny');
  assert.equal(normalizeAnatomyAnswer('art. ramienny'), 'ramienny');
  assert.equal(normalizeAnatomyAnswer('articulatio humeri'), 'humeri');
  assert.equal(normalizeAnatomyAnswer('lig. patellae'), 'patellae');
  assert.equal(normalizeAnatomyAnswer('ligamentum patellae'), 'patellae');
});

test('GitHub API tree parser and jsDelivr CDN URL builder extract GLB/GLTF paths cleanly', () => {
  assert.equal(
    buildJsDelivrUrl('hpfrei', 'body-anatomy-3d-viewer', 'main', '/public/body.glb'),
    'https://cdn.jsdelivr.net/gh/hpfrei/body-anatomy-3d-viewer@main/public/body.glb',
  );

  const models = extractGlbModelsFromTree('organui', 'muscles-3d', 'main', [
    { path: 'README.md', type: 'blob' },
    { path: 'src/App.tsx', type: 'blob' },
    { path: 'public/models/muscles.glb', type: 'blob' },
    { path: 'models/extra.gltf', type: 'blob' },
  ]);
  assert.equal(models.length, 2);
  assert.equal(
    models[0].cdnUrl,
    'https://cdn.jsdelivr.net/gh/organui/muscles-3d@main/public/models/muscles.glb',
  );

  assert.deepEqual(parseOwnerRepo('https://github.com/ashemag/human-atlas/'), {
    owner: 'ashemag',
    repo: 'human-atlas',
  });
  assert.equal(parseOwnerRepo('anatomy 3d'), null);
});

test('English/technical mesh names translate to Polish anatomical terminology', () => {
  assert.equal(translateMeshNameToPolish('Scapula_L').namePl, 'Łopatka (strona lewa)');
  assert.equal(translateMeshNameToPolish('Supraspinatus_R').namePl, 'Mięsień nadgrzebieniowy (strona prawa)');
  assert.equal(translateMeshNameToPolish('Deltoid').structureId, 'm_deltoideus');
  assert.equal(translateMeshNameToPolish('Patella').namePl, 'Rzepka');
  assert.equal(translateMeshNameToPolish('ACL').structureId, 'acl');
  assert.equal(translateMeshNameToPolish('Clavicle').structureId, 'clavicula');
  assert.equal(translateMeshNameToPolish('Clavicle001').structureId, 'clavicula');
  assert.equal(translateMeshNameToPolish('Humerus003').structureId, 'humerus');
  assert.equal(translateMeshNameToPolish('Parietal_bone001').namePl, 'Kość ciemieniowa');

  // All quadriceps sub-mesh names map to unified whole m_quadriceps_femoris
  for (const rawQuad of [
    'Quadriceps',
    'Rectus femoris',
    'Vastus lateralis',
    'Vastus medialis',
    'Vastus intermedius',
  ]) {
    const mapped = translateMeshNameToPolish(rawQuad);
    assert.equal(mapped.structureId, 'm_quadriceps_femoris');
    assert.equal(mapped.namePl, 'Mięsień czworogłowy uda');
  }
});

test('gamification XP, hearts, mistake stats, and streak progression behave accurately', () => {
  let state = createInitialProgress();
  assert.equal(state.hearts, 5);
  assert.equal(state.xp, 0);
  assert.equal(state.streak, 0);

  state = applyAnswerOutcome(state, true, 'm_supraspinatus', 10, '2026-05-01T10:00:00Z');
  assert.equal(state.xp, 10);
  assert.equal(state.hearts, 5);

  for (let i = 0; i < 6; i++) {
    state = applyAnswerOutcome(state, false, 'acl', 10, '2026-05-01T10:05:00Z');
  }
  assert.equal(state.hearts, 0);
  assert.equal(state.mistakeStats.acl.wrongCount, 6);

  const recovery = buildHeartRecoveryTasks(state.mistakeStats);
  assert.equal(recovery.length, 3);
  assert.ok(recovery.some((t) => t.structureId === 'acl'));

  state = restoreHeartsProgress(state, 5);
  assert.equal(state.hearts, 5);

  const firstCompletion = completeLessonProgress(state, 'shoulder_1_bones', 88, 40, '2026-05-01');
  state = firstCompletion.nextProgress;
  assert.equal(firstCompletion.streakIncremented, true);
  assert.equal(state.streak, 1);
  assert.equal(state.xp, 50);

  const sameDay = completeLessonProgress(state, 'shoulder_2_joints', 100, 45, '2026-05-01');
  state = sameDay.nextProgress;
  assert.equal(sameDay.streakIncremented, false);
  assert.equal(state.streak, 1);

  const nextDay = completeLessonProgress(state, 'shoulder_3_rotators', 90, 50, '2026-05-02');
  state = nextDay.nextProgress;
  assert.equal(nextDay.streakIncremented, true);
  assert.equal(state.streak, 2);
});

test('skill tree node statuses unlock sequentially', () => {
  const initialStatuses = getLessonStatuses([]);
  assert.equal(initialStatuses.shoulder_1_bones, 'active');
  assert.equal(initialStatuses.shoulder_2_joints, 'locked');

  const afterFirst = getLessonStatuses(['shoulder_1_bones']);
  assert.equal(afterFirst.shoulder_1_bones, 'completed');
  assert.equal(afterFirst.shoulder_2_joints, 'active');
  assert.equal(afterFirst.shoulder_3_rotators, 'locked');
});

test('Atlas search filters by Polish name, bony landmarks, muscles, PP/PK, innervation, region, and category', () => {
  const byNerw = filterAtlasStructures('nadłopatkowy', 'all', 'all');
  assert.ok(byNerw.some((s) => s.id === 'm_supraspinatus'));
  assert.ok(byNerw.some((s) => s.id === 'm_infraspinatus'));

  const byPolish = filterAtlasStructures('guzek większy', 'shoulder', 'bone');
  assert.ok(byPolish.some((s) => s.id === 'tuberculum_majus'));

  const byClavicleLandmark = filterAtlasStructures('guzek stożkowaty', 'shoulder', 'bone');
  assert.equal(byClavicleLandmark.length, 1);
  assert.equal(byClavicleLandmark[0].id, 'clavicula');

  const byAttachingMuscle = filterAtlasStructures('mostkowo-obojczykowo-sutkowy', 'shoulder', 'bone');
  assert.equal(byAttachingMuscle.length, 1);
  assert.equal(byAttachingMuscle[0].id, 'clavicula');

  const kneeLigaments = filterAtlasStructures('', 'knee', 'joint_ligament');
  assert.equal(kneeLigaments.length, 6);

  const boneLabels = getStructureDetailLabels('bone');
  assert.equal(boneLabels.firstLabel, 'Struktury kostne');
  assert.equal(boneLabels.secondLabel, 'Mięśnie przyczepiające się');

  const muscleLabels = getStructureDetailLabels('muscle');
  assert.equal(muscleLabels.firstLabel, 'Przyczep początkowy (PP)');
  assert.equal(muscleLabels.secondLabel, 'Przyczep końcowy (PK)');

  const byQuadHeadAlias = filterAtlasStructures('prosty uda', 'knee', 'muscle');
  assert.equal(byQuadHeadAlias.length, 1);
  assert.equal(byQuadHeadAlias[0].id, 'm_quadriceps_femoris');
});

test('vertex-colored bone surface zones partition bone geometry, switch modes, and link bidirectionally with muscles', () => {
  assert.ok(BONY_LANDMARKS.length >= 130, `Expected >= 130 bony landmarks, got ${BONY_LANDMARKS.length}`);
  const humerusLandmarks = BONY_LANDMARKS.filter((lm) => lm.parentMesh === 'Humerus.003');
  assert.ok(humerusLandmarks.length >= 10, 'Right humerus must have >= 10 anatomical surface zones');

  // Create a synthetic bone mesh covering the right humerus landmark bounding box
  const geo = new THREE.BoxGeometry(0.12, 0.36, 0.12, 16, 36, 16);
  geo.translate(-0.19, 1.25, -0.02);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
  mesh.name = 'Humerus003';
  mesh.userData = { id: 'glb_humerus_r', structureId: 'humerus', namePl: 'Kość ramienna' };

  const zoneData = buildBoneSurfaceZones(mesh, humerusLandmarks);
  assert.ok(zoneData, 'buildBoneSurfaceZones must return zoneData');
  if (!zoneData) throw new Error('zoneData missing');
  assert.equal(zoneData.landmarks.length, humerusLandmarks.length);
  assert.equal(mesh.geometry.index, null, 'Geometry must be converted to non-indexed for crisp zero-gradient triangles');

  // Verify every triangle face has uniform zone assignment across all 3 of its vertices (zero gradient blur)
  const faceCount = zoneData.faceZoneIndex.length;
  for (let f = 0; f < faceCount; f++) {
    const fz: number = zoneData.faceZoneIndex[f];
    assert.equal(zoneData.vertexZoneIndex[f * 3], fz);
    assert.equal(zoneData.vertexZoneIndex[f * 3 + 1], fz);
    assert.equal(zoneData.vertexZoneIndex[f * 3 + 2], fz);
  }

  // Every landmark on the bone must have assigned vertices
  for (let k = 0; k < humerusLandmarks.length; k++) {
    const count = zoneData.vertexZoneIndex.filter((z) => z === k).length;
    assert.ok(count >= 18, `Landmark ${humerusLandmarks[k].id} must have >= 18 painted vertices, got ${count}`);
  }

  // Verify Mode 1 ('landmarks') vs Mode 2 ('attachments') vs 'off' update vertex colors
  updateAllBoneSurfaceColors([mesh], {
    mode: 'landmarks',
    selectedLandmarkId: null,
    hoveredLandmarkId: null,
    selectedPartId: null,
    selectedStructureId: null,
    selectedPartNamePl: null,
    hoveredPartId: null,
    highlightMode: 'neutral',
  });
  const firstZoneVert = zoneData.vertexZoneIndex.findIndex((z) => z === 0);
  assert.ok(firstZoneVert >= 0);
  const rLandmarks = zoneData.colorAttr.getX(firstZoneVert);

  updateAllBoneSurfaceColors([mesh], {
    mode: 'attachments',
    selectedLandmarkId: null,
    hoveredLandmarkId: null,
    selectedPartId: null,
    selectedStructureId: null,
    selectedPartNamePl: null,
    hoveredPartId: null,
    highlightMode: 'neutral',
  });
  const rAttachments = zoneData.colorAttr.getX(firstZoneVert);
  assert.notEqual(rLandmarks, rAttachments, 'Mode switch must update vertex zone colors');

  // Verify bidirectional muscle -> bone attachment matching
  const greaterTubercle = humerusLandmarks.find((lm) => lm.structureId === 'tuberculum_majus')!;
  assert.equal(
    doesLandmarkAttachMuscle(greaterTubercle, 'm_supraspinatus', 'Mięsień nadgrzebieniowy'),
    true,
  );
  const resolved = resolveAttachedMuscleTarget(greaterTubercle.attachedMuscles![0]);
  assert.equal(resolved.structureId, 'm_supraspinatus');

  // Verify triangle-level raycast hit detection on a zone centroid
  const hitMock = {
    object: mesh,
    point: zoneData.zoneCentroids[0].clone(),
    distance: 0.5,
  } as unknown as THREE.Intersection;
  const detected = detectHitBoneSurfaceZone(hitMock, 'landmarks');
  assert.equal(detected?.id, humerusLandmarks[0].id);
  assert.equal(detectHitBoneSurfaceZone(hitMock, 'off'), null);
});

test('mirrored left-side bones reverse inverted CW winding and every skeletal muscle has bilateral PP & PK zones', () => {
  // 1. Simulate a mirrored left hip bone (scale.x = -1 -> negative signed volume + inward normals)
  const leftHipLandmarks = BONY_LANDMARKS.filter((lm) => lm.parentMesh === 'Hip bone.002');
  assert.ok(leftHipLandmarks.some((lm) => lm.id === 'pelvis_iliac_fossa_l'));
  assert.ok(leftHipLandmarks.some((lm) => lm.id === 'pelvis_gluteal_surface_l'));

  const geo = new THREE.BoxGeometry(0.14, 0.24, 0.16, 12, 20, 12);
  geo.scale(-1, 1, 1); // Mirror along X -> CW inverted triangle winding (negative signed volume)
  geo.translate(0.08, 0.92, -0.01);
  const leftHipMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
  leftHipMesh.name = 'Hip_bone002';

  const leftData = buildBoneSurfaceZones(leftHipMesh, leftHipLandmarks);
  assert.ok(leftData, 'Left mirrored bone must build valid bone surface zones');

  // Verify post-processing reversed winding to positive outward signed volume
  const posAttr = leftHipMesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  const normAttr = leftHipMesh.geometry.getAttribute('normal') as THREE.BufferAttribute;
  leftHipMesh.geometry.computeBoundingBox();
  const center = leftHipMesh.geometry.boundingBox!.getCenter(new THREE.Vector3());
  let signedVol6 = 0;
  let normAlign = 0;
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const cr = new THREE.Vector3();
  const n0 = new THREE.Vector3();
  for (let i = 0; i < posAttr.count; i += 3) {
    va.fromBufferAttribute(posAttr, i).sub(center);
    vb.fromBufferAttribute(posAttr, i + 1).sub(center);
    vc.fromBufferAttribute(posAttr, i + 2).sub(center);
    e1.subVectors(vb, va);
    e2.subVectors(vc, va);
    cr.crossVectors(e1, e2);
    signedVol6 += va.dot(cr);
    n0.fromBufferAttribute(normAttr, i);
    normAlign += cr.dot(n0);
  }
  assert.ok(signedVol6 > 0, `Expected positive outward CCW volume after winding fix, got ${signedVol6}`);
  assert.ok(normAlign > 0, `Expected outward vertex normals aligned with CCW winding, got ${normAlign}`);

  // 2. Verify every right-side landmark has a mirrored left-side partner
  const byId = new Map(BONY_LANDMARKS.map((lm) => [lm.id, lm]));
  for (const lm of BONY_LANDMARKS) {
    if (lm.side === 'right') {
      const leftId = lm.id.replace(/_r$/, '_l');
      const partner = byId.get(leftId);
      assert.ok(partner, `Missing bilateral left partner for ${lm.id}`);
      assert.equal(partner.side, 'left');
      assert.equal(partner.type, lm.type);
      assert.deepEqual(partner.attachedMuscles, lm.attachedMuscles);
    }
  }

  // 3. Verify per-muscle PP/PK role differentiation & zero false-positive collisions
  const spineR = byId.get('scapula_spine_r')!;
  assert.equal(getLandmarkAttachmentRoleForMuscle(spineR, 'm_trapezius', 'Mięsień czworoboczny'), 'pk');
  assert.equal(getLandmarkAttachmentRoleForMuscle(spineR, 'm_deltoideus', 'Mięsień naramienny'), 'pp');

  const malleolusR = byId.get('tibia_medial_malleolus_r')!;
  assert.equal(getLandmarkAttachmentRoleForMuscle(malleolusR, 'm_deltoideus', 'Mięsień naramienny'), null);

  const trochleaR = byId.get('humerus_trochlea_capitulum_r')!;
  assert.equal(getLandmarkAttachmentRoleForMuscle(trochleaR, 'm_brachioradialis', 'Mięsień ramienno-promieniowy'), null);

  // 4. Verify every skeletal muscle in ANATOMY_DB has BOTH PP and PK attachment zones
  const nonBonyFacialIds = new Set([
    'pes_anserinus',
    'm_nasalis',
    'm_depressor_septi_nasi',
    'm_procerus',
    'm_levator_labii_superioris_alaeque_nasi',
  ]);
  const nonBonyInsertionIds = new Set([
    'm_diaphragma', // PK na niekostnym środku ścięgnistym (centrum tendineum)
  ]);
  for (const entry of ANATOMY_DB) {
    if (entry.category !== 'muscle' || nonBonyFacialIds.has(entry.id)) continue;
    const roles = BONY_LANDMARKS.map((lm) =>
      getLandmarkAttachmentRoleForMuscle(lm, entry.id, entry.namePl),
    ).filter(Boolean);
    assert.ok(roles.includes('pp'), `Muscle ${entry.id} (${entry.namePl}) is missing a PP origin zone`);
    if (!nonBonyInsertionIds.has(entry.id)) {
      assert.ok(roles.includes('pk'), `Muscle ${entry.id} (${entry.namePl}) is missing a PK insertion zone`);
    }
  }
});

test('Phase 4: expanded 160-entry ANATOMY_DB, clickable PP/PK muscle zones, and Szpilki 3D Pin Exam logic', () => {
  // 1. Verify expanded database count and key new physiotherapy muscle bindings
  assert.ok(ANATOMY_DB.length >= 160, `Expected >= 160 structures in ANATOMY_DB, got ${ANATOMY_DB.length}`);
  const expectedNewMuscles = [
    ['Clavicular head of pectoralis major muscle.001', 'm_pectoralis_major'],
    ['Pectoralis minor muscle.009', 'm_pectoralis_minor'],
    ['Serratus anterior muscle.001', 'm_serratus_anterior'],
    ['Rhomboid major muscle.001', 'm_rhomboideus_major'],
    ['Levator scapulae.011', 'm_levator_scapulae'],
    ['Sartorius muscle.001', 'm_sartorius'],
    ['Gracilis muscle.005', 'm_gracilis'],
    ['Rectus abdominis muscle.001', 'm_rectus_abdominis'],
    ['Quadratus lumborum muscle.001', 'm_quadratus_lumborum'],
    ['Tibialis posterior muscle.003', 'm_tibialis_posterior'],
    ['Fibularis brevis muscle.005', 'm_fibularis_brevis'],
  ] as const;
  for (const [meshName, expectedId] of expectedNewMuscles) {
    assert.ok(ANATOMY_MAP[expectedId], `Missing ANATOMY_MAP entry for ${expectedId}`);
    const translated = translateMeshNameToPolish(meshName, 'muscle');
    assert.equal(translated.structureId, expectedId, `Expected ${meshName} -> ${expectedId}`);
  }

  // 2. Verify getMuscleAttachmentZones deduplicates bilateral pairs and distinguishes PP vs PK roles
  const trapZones = getMuscleAttachmentZones(BONY_LANDMARKS, 'm_trapezius', 'Mięsień czworoboczny');
  assert.ok(trapZones.pp.some((z) => z.id === 'occipital_external_protuberance'));
  assert.ok(trapZones.pk.some((z) => z.id === 'scapula_spine_r'));
  assert.equal(trapZones.pk.filter((z) => z.id.startsWith('scapula_spine')).length, 1);

  const pecMinorZones = getMuscleAttachmentZones(BONY_LANDMARKS, 'm_pectoralis_minor', 'Mięsień piersiowy mniejszy');
  assert.ok(pecMinorZones.pp.some((z) => z.id === 'rib4_anterior_r'));
  assert.ok(pecMinorZones.pk.some((z) => z.id === 'scapula_coracoid_process_r'));

  // 3. Verify Szpilki 3D Pin Exam generator & bilateral evaluator across all 5 regions
  for (const reg of PIN_EXAM_REGIONS) {
    const counts = getPinExamPoolCounts(reg.id);
    assert.ok(counts.muscles >= 8, `Region ${reg.id} must have >= 8 exam muscles`);
    assert.ok(counts.landmarks >= 8, `Region ${reg.id} must have >= 8 exam landmarks`);

    const mixed = buildPinExamQuestions(reg.id, 'all', 10);
    assert.equal(mixed.length, 10);
    assert.equal(new Set(mixed.map((q) => q.id)).size, 10, 'Exam questions must not duplicate');
    for (const q of mixed) {
      assert.ok(q.prompt.startsWith('Wskaż: '), `Prompt should be concise: ${q.prompt}`);
      assert.ok(!q.prompt.includes('na kości:'), `Prompt must not include bone hint: ${q.prompt}`);
      assert.ok(!/\(PP\)|\(PK\)/.test(q.prompt), `Prompt must not reveal PP/PK role: ${q.prompt}`);
    }
  }

  // Bilateral tolerance: clicking left Dół biodrowy satisfies a question targeting right pelvis_iliac_fossa_r
  const torsoLandmarks = buildPinExamQuestions('torso', 'landmarks', 30);
  const iliacFossaQ = torsoLandmarks.find((q) => q.landmarkId === 'pelvis_iliac_fossa_r');
  assert.ok(iliacFossaQ, 'Torso landmark pool must include pelvis_iliac_fossa_r');
  assert.equal(
    evaluatePinExamAnswer(iliacFossaQ!, {
      id: 'pelvis_iliac_fossa_l',
      namePl: 'Dół biodrowy',
      structureId: 'pelvis_iliac_fossa_l',
    }),
    true,
    'Clicking left Dół biodrowy must pass bilateral Pin Exam evaluation',
  );
  assert.equal(
    evaluatePinExamAnswer(iliacFossaQ!, {
      id: 'pelvis_asis_r',
      namePl: 'Kolec biodrowy przedni górny',
      structureId: 'pelvis_asis_r',
    }),
    false,
  );
});

test('Phase 5: clinical & kinesitherapy DB (50 entries), SRS SM-2 flashcards (210), reverse pin exam, free mode, and JSON export/import', () => {
  // 1. Validate 54-entry Clinical & Kinesitherapy DB (including 4 fizjoterapeuty.pl additions)
  assert.equal(CLINICAL_TESTS_DB.length, 54);
  const ortho = CLINICAL_TESTS_DB.filter((t) => t.category === 'orthopedic');
  const lengths = CLINICAL_TESTS_DB.filter((t) => t.category === 'kinesitherapy_length');
  const lovetts = CLINICAL_TESTS_DB.filter((t) => t.category === 'lovett');
  const methods = CLINICAL_TESTS_DB.filter((t) => t.category === 'kinesitherapy_method');
  assert.equal(ortho.length, 28);
  assert.equal(lengths.length, 10);
  assert.equal(lovetts.length, 10);
  assert.equal(methods.length, 6);

  const uniqueTestIds = new Set(CLINICAL_TESTS_DB.map((t) => t.id));
  assert.equal(uniqueTestIds.size, 54, 'All clinical test IDs must be unique');

  for (const entry of CLINICAL_TESTS_DB) {
    assert.ok(CLINICAL_TEST_MAP[entry.id]);
    assert.ok(entry.structureIds.length >= 1, `Test ${entry.id} must link at least 1 3D structure`);
    for (const sid of entry.structureIds) {
      assert.ok(ANATOMY_MAP[sid], `Test ${entry.id} references unknown structureId ${sid}`);
    }
    if (entry.category === 'lovett') {
      assert.ok(entry.lovettGravity && entry.lovettGravity.length > 10);
      assert.ok(entry.lovettEliminated && entry.lovettEliminated.length > 10);
      assert.ok(entry.stabilization && entry.stabilization.length > 5);
      assert.ok(entry.resistancePoint && entry.resistancePoint.length > 5);
    }
    const textBlob = `${entry.namePl} ${entry.targetSummary} ${entry.patientPosition} ${entry.procedure} ${entry.positiveSign} ${entry.clinicalInterpretation}`;
    assert.equal(
      /\b(musculus|ligamentum|tuberculum|articulatio|processus)\b/i.test(textBlob),
      false,
      `Clinical test ${entry.id} should avoid Latin anatomical keywords`,
    );
  }

  // 2. Validate SRS Flashcards Deck (anatomy + clinical/kinesitherapy + dermatomes/myotomes) & SM-2 transitions
  const allSrs = getAllSrsCards();
  assert.equal(
    allSrs.length,
    ANATOMY_DB.length +
      MUSCLE_ACTIONS_DB.length +
      CLINICAL_TESTS_DB.length +
      DERMATOME_MYOTOME_LEVELS.length +
      BIOMECHANICS_MOVEMENTS.length,
  );
  assert.equal(buildSrsDeck('anatomy').length, ANATOMY_DB.length);
  assert.equal(buildSrsDeck('orthopedic').length, 28);
  assert.equal(buildSrsDeck('kinesitherapy').length, 26);
  assert.equal(buildSrsDeck('dermatomes').length, DERMATOME_MYOTOME_LEVELS.length);

  const r1 = applySrsReview(undefined, 'good', '2026-06-01');
  assert.equal(r1.repetitions, 1);
  assert.equal(r1.intervalDays, 1);
  assert.equal(r1.nextReviewDate, '2026-06-02');

  const r2 = applySrsReview(r1, 'good', '2026-06-02');
  assert.equal(r2.repetitions, 2);
  assert.equal(r2.intervalDays, 6);
  assert.equal(r2.nextReviewDate, '2026-06-08');

  const r3 = applySrsReview(r2, 'good', '2026-06-08');
  assert.equal(r3.repetitions, 3);
  assert.equal(r3.intervalDays, 15);

  const rAgain = applySrsReview(r3, 'again', '2026-06-23');
  assert.equal(rAgain.repetitions, 0);
  assert.equal(rAgain.intervalDays, 1);
  assert.ok(rAgain.easeFactor >= 1.3);

  const rEasy = applySrsReview(undefined, 'easy', '2026-06-01');
  assert.equal(rEasy.intervalDays, 4);
  assert.ok(rEasy.easeFactor > 2.5);

  // Overdue card must appear BEFORE unseen new cards in queue
  const srsProgress = {
    [allSrs[5].id]: {
      intervalDays: 1,
      easeFactor: 2.5,
      repetitions: 1,
      nextReviewDate: '2026-05-30',
    },
  };
  const stats = getSrsDeckStats(allSrs, srsProgress, '2026-06-01');
  assert.equal(stats.dueReviews, 1);
  assert.equal(stats.newCards, allSrs.length - 1);
  const queue = buildSrsStudyQueue(allSrs, srsProgress, '2026-06-01', 10);
  assert.equal(queue[0].id, allSrs[5].id);
  assert.equal(queue.length, 11);

  // 3. Validate Reverse Pin Exam options & flexible typing grading
  const upperQuestions = buildPinExamQuestions('upper_limb_right', 'all', 8);
  for (const q of upperQuestions) {
    const opts = buildReversePinOptions(q, 'upper_limb_right');
    assert.equal(opts.length, 4, `Reverse pin options for ${q.id} must have 4 choices`);
    assert.equal(opts.filter((o) => o.isCorrect).length, 1, 'Exactly 1 option must be correct');
    assert.equal(new Set(opts.map((o) => o.label)).size, 4, 'All 4 options must be distinct');
    assert.equal(evaluateReverseTypingAnswer(q, q.targetNamePl), true);
    if (q.targetNameEn) {
      assert.equal(evaluateReverseTypingAnswer(q, q.targetNameEn), true);
    }
    assert.equal(evaluateReverseTypingAnswer(q, 'nieistniejaca struktura xyz'), false);
  }

  // 4. Validate Free Study Mode unlocking all 25 lessons & preserving hearts
  const freeStatuses = getLessonStatuses(['shoulder_1_bones'], 'free');
  const allLessons = getAllLessonsOrdered();
  assert.equal(freeStatuses.shoulder_1_bones, 'completed');
  for (const l of allLessons.slice(1)) {
    assert.equal(freeStatuses[l.id], 'active', `Lesson ${l.id} must be unlocked in free study mode`);
  }

  let freeProgress = createInitialProgress();
  freeProgress = { ...freeProgress, studyMode: 'free' };
  freeProgress = applyAnswerOutcome(freeProgress, false, 'm_serratus_anterior', 10);
  assert.equal(freeProgress.hearts, 5, 'Free study mode must not deduct hearts on wrong answers');
  assert.equal(freeProgress.mistakeStats.m_serratus_anterior.wrongCount, 1);

  // 5. Validate JSON Export / Import round-trip and malformed input rejection
  const populated = {
    ...freeProgress,
    xp: 420,
    streak: 4,
    completedLessonIds: ['shoulder_1_bones', 'shoulder_5_kinesitherapy'],
    srsProgress,
    pinExamHistory: [
      {
        id: 'pin_1',
        date: '2026-06-01',
        mode: 'identify' as const,
        region: 'Kończyna górna',
        correctCount: 5,
        totalCount: 5,
        accuracy: 100,
        xpEarned: 100,
      },
    ],
  };
  const exported = exportProgressToJson(populated);
  const reimported = parseImportedProgress(exported);
  assert.ok(reimported, 'Valid exported JSON must parse cleanly');
  assert.equal(reimported!.xp, 420);
  assert.equal(reimported!.studyMode, 'free');
  assert.deepEqual(reimported!.completedLessonIds, ['shoulder_1_bones', 'shoulder_5_kinesitherapy']);
  assert.equal(reimported!.pinExamHistory?.length, 1);
  assert.equal(reimported!.srsProgress?.[allSrs[5].id]?.intervalDays, 1);
  assert.equal(parseImportedProgress('{bad json'), null);
  assert.equal(parseImportedProgress('{}'), null);
});

test('Phase 6: extended anatomical systems (arteries, veins, nerves, organs, bursae, tendons, ligaments, skin), unified deltoid, white connective materials, and device scaling', () => {
  // 1. Extended systems DB coverage (160 base + 94 extended = 254 structures; 304 SRS cards)
  assert.ok(ANATOMY_DB.length >= 250, `Expected >= 250 structures, got ${ANATOMY_DB.length}`);
  const requiredCategories = [
    'artery',
    'vein',
    'nerve',
    'organ',
    'bursa',
    'tendon',
    'ligament',
    'skin',
  ] as const;
  for (const cat of requiredCategories) {
    const matches = ANATOMY_DB.filter((s) => s.category === cat);
    assert.ok(matches.length >= 6, `Expected >= 6 entries in category '${cat}', got ${matches.length}`);
  }
  assert.equal(
    getAllSrsCards().length,
    ANATOMY_DB.length +
      MUSCLE_ACTIONS_DB.length +
      CLINICAL_TESTS_DB.length +
      DERMATOME_MYOTOME_LEVELS.length +
      BIOMECHANICS_MOVEMENTS.length,
  );

  // 2. Unified Deltoid grouping per side (all 3 aktony merge; non-muscle deltoid items do NOT merge)
  const rightHeads = [
    'Acromial part of deltoid muscle.003',
    'Clavicular part of deltoid muscle.003',
    'Scapular spinal part of deltoid muscle.003',
  ];
  const rightKeys = new Set(
    rightHeads.map((name) => getUnifiedMeshGroupKey(name, 'm_deltoideus', 'muscle', -0.2)),
  );
  assert.equal(rightKeys.size, 1);
  assert.equal([...rightKeys][0], 'unified_m_deltoideus_right');

  const leftKeys = new Set(
    rightHeads.map((name) => getUnifiedMeshGroupKey(name, 'm_deltoideus', 'muscle', 0.2)),
  );
  assert.equal(leftKeys.size, 1);
  assert.equal([...leftKeys][0], 'unified_m_deltoideus_left');

  assert.equal(getUnifiedMeshGroupKey('Subdeltoid bursa', 'bursa_subdeltoidea', 'bursa', -0.2), null);
  assert.equal(getUnifiedMeshGroupKey('Deltoid ligament.r', 'lig_deltoideum_ankle', 'ligament', -0.1), null);
  assert.equal(getUnifiedMeshGroupKey('Deltoid region.r', 'skin_upper_limb', 'skin', -0.2), null);
  assert.equal(getUnifiedMeshGroupKey('Sartorius muscle', 'm_sartorius', 'muscle', -0.2), null);
  assert.equal(getUnifiedMeshGroupKey('Biceps brachii muscle', 'm_biceps_brachii', 'muscle', -0.2, 'parts'), null);

  // 3. White PBR materials for bursae, tendons, and ligaments + distinct system colors + default skin OFF
  const bursaMat = createMaterialForLayer('bursa', 'Subacromial bursa') as THREE.MeshPhysicalMaterial;
  const tendonMat = createMaterialForLayer('tendon', 'Common flexor tendon sheath') as THREE.MeshStandardMaterial;
  const ligMat = createMaterialForLayer('ligament', 'Iliofemoral ligament.r') as THREE.MeshStandardMaterial;
  const artMat = createMaterialForLayer('artery', 'Brachial artery.r') as THREE.MeshStandardMaterial;
  const veinMat = createMaterialForLayer('vein', 'Great saphenous vein.r') as THREE.MeshStandardMaterial;
  const nerveMat = createMaterialForLayer('nerve', 'Sciatic nerve.r') as THREE.MeshStandardMaterial;
  const skinMat = createMaterialForLayer('skin', 'Deltoid region.r', undefined, 0.3) as THREE.MeshPhysicalMaterial;

  assert.equal(bursaMat.color.getHex(), 0xf4f8fb);
  assert.equal(tendonMat.color.getHex(), 0xf7f6f2);
  assert.equal(ligMat.color.getHex(), 0xe6edf2);
  assert.equal(artMat.color.getHex(), 0xdc2626);
  assert.equal(veinMat.color.getHex(), 0x2563eb);
  assert.equal(nerveMat.color.getHex(), 0xeab308);
  assert.equal(skinMat.transparent, true);
  assert.ok(Math.abs(skinMat.opacity - 0.3) < 0.01);

  assert.equal(classifyBaseGlbMeshLayer('Subacromial bursa.001', '', 'mat_muscle_pro', false), 'bursa');
  assert.equal(classifyBaseGlbMeshLayer('Intertubercular tendon sheath.001', '', 'mat_muscle_pro', false), 'tendon');
  const defaults = createDefaultLayerVisibility(true);
  assert.equal(defaults.artery, true);
  assert.equal(defaults.vein, true);
  assert.equal(defaults.nerve, true);
  assert.equal(defaults.organ, true);
  assert.equal(defaults.bursa, true);
  assert.equal(defaults.skin, false);

  // 4. Cross-system translator accuracy (no false matches to muscles/bones)
  assert.equal(translateMeshNameToPolish('Brachial artery.r', 'artery').structureId, 'a_brachialis');
  assert.equal(translateMeshNameToPolish('Great saphenous vein.l', 'vein').structureId, 'v_saphena_magna');
  assert.equal(translateMeshNameToPolish('Sciatic nerve.r', 'nerve').structureId, 'n_ischiadicus');
  assert.equal(translateMeshNameToPolish('Right atrium', 'organ').structureId, 'org_cor');
  assert.equal(translateMeshNameToPolish('Subacromial bursa', 'bursa').structureId, 'bursa_subacromialis');
  assert.equal(translateMeshNameToPolish('Iliofemoral ligament.r', 'ligament').structureId, 'lig_iliofemorale');
  assert.equal(translateMeshNameToPolish('Deltoid region.r', 'skin').structureId, 'skin_upper_limb');

  // 5. New Pin Exam 3D pools (vessels, nerves, connective, organs) + reverse options
  const torsoCounts = getPinExamPoolCounts('torso');
  assert.ok(torsoCounts.vessels >= 5);
  assert.ok(torsoCounts.organs >= 10);
  const fullNerves = buildPinExamQuestions('full_body', 'nerves', 6);
  assert.equal(fullNerves.length, 6);
  const nerveOpts = buildReversePinOptions(fullNerves[0], 'full_body');
  assert.equal(nerveOpts.length, 4);
  assert.equal(nerveOpts.filter((o) => o.isCorrect).length, 1);

  // 6. Device mode & UI scale persistence and clamping
  const scaled = parseImportedProgress(
    JSON.stringify({ xp: 10, deviceMode: 'ipad', uiScale: 140 }),
  );
  assert.ok(scaled);
  assert.equal(scaled!.deviceMode, 'ipad');
  assert.equal(scaled!.uiScale, 115);

  const phone = parseImportedProgress(
    JSON.stringify({ xp: 10, deviceMode: 'phone', uiScale: 50 }),
  );
  assert.ok(phone);
  assert.equal(phone!.deviceMode, 'phone');
  assert.equal(phone!.uiScale, 85);
});

test('Phase 7: multi-head muscle grouping (whole/parts), bidirectional Nerve-Muscle 3D map, and 4 new Skill Tree sections', () => {
  // 1. Multi-head muscles unify per side in 'whole' mode and split cleanly in 'parts' mode
  const pairs: Array<[string, string, string]> = [
    ['Long head of biceps brachii', 'Short head of biceps brachii', 'unified_m_biceps_brachii_right'],
    ['Lateral head of triceps brachii', 'Medial head of triceps brachii', 'unified_m_triceps_brachii_right'],
    ['Descending part of trapezius muscle', 'Ascending part of trapezius muscle', 'unified_m_trapezius_right'],
    ['Clavicular head of pectoralis major muscle', 'Sternocostal head of pectoralis major muscle', 'unified_m_pectoralis_major_right'],
    ['Lateral head of gastrocnemius', 'Medial head of gastrocnemius', 'unified_m_gastrocnemius_right'],
    ['Long head of biceps femoris', 'Short head of biceps femoris', 'unified_m_biceps_femoris_right'],
  ];

  for (const [partA, partB, expectedKey] of pairs) {
    assert.equal(getUnifiedMeshGroupKey(partA, undefined, 'muscle', -0.15, 'whole'), expectedKey);
    assert.equal(getUnifiedMeshGroupKey(partB, undefined, 'muscle', -0.15, 'whole'), expectedKey);
    assert.equal(getUnifiedMeshGroupKey(partA, undefined, 'muscle', -0.15, 'parts'), null);
  }

  // Quadriceps femoris heads must remain separate even in 'whole' mode
  assert.equal(getUnifiedMeshGroupKey('Rectus femoris muscle', undefined, 'muscle', -0.1, 'whole'), null);
  assert.equal(getUnifiedMeshGroupKey('Vastus lateralis muscle', undefined, 'muscle', -0.1, 'whole'), null);
  assert.equal(getUnifiedMeshGroupKey('Vastus medialis muscle', undefined, 'muscle', -0.1, 'whole'), null);

  // Polish subpart extraction for 'parts' mode (including GLTF sanitized underscores & numeric suffixes)
  assert.equal(formatMuscleSubpartPolish('Long head of biceps brachii'), 'głowa długa');
  assert.equal(formatMuscleSubpartPolish('Long_head_of_biceps_brachii003'), 'głowa długa');
  assert.equal(formatMuscleSubpartPolish('Descending part of trapezius muscle'), 'część zstępująca (górna)');
  assert.equal(formatMuscleSubpartPolish('Sternocostal_head_of_pectoralis_major_muscle002'), 'część mostkowo-żebrowa');
  assert.equal(
    getUnifiedMeshGroupKey('Anterior_belly_of_digastric_muscle001', undefined, 'muscle', -0.05, 'whole'),
    'unified_m_digastricus_right',
  );

  // 2. Bidirectional Nerve <-> Innervated Muscles clinical map integrity
  assert.equal(CLINICAL_NERVE_PROFILES.length, 16);
  for (const prof of CLINICAL_NERVE_PROFILES) {
    assert.ok(ANATOMY_MAP[prof.nerveStructureId], `Unknown nerve ID ${prof.nerveStructureId}`);
    assert.ok(prof.innervatedMuscleIds.length >= 1, `Nerve ${prof.nerveStructureId} must list >= 1 muscle`);
    for (const mId of prof.innervatedMuscleIds) {
      assert.ok(ANATOMY_MAP[mId], `Nerve ${prof.nerveStructureId} references unknown muscle ${mId}`);
    }
  }

  const radial = getNerveProfileByStructureId('n_radialis')!;
  assert.ok(radial);
  assert.equal(doesMeshMatchNerveInnervation(radial, 'm_triceps_brachii', 'Long head of triceps brachii', 'muscle'), true);
  assert.equal(doesMeshMatchNerveInnervation(radial, undefined, 'Supinator muscle.r', 'muscle'), true);
  assert.equal(doesMeshMatchNerveInnervation(radial, 'm_biceps_brachii', 'Long head of biceps brachii', 'muscle'), false);

  assert.equal(getNervesForMuscle('m_deltoideus')[0]?.nerveStructureId, 'n_axillaris');
  assert.equal(getNervesForMuscle('m_serratus_anterior')[0]?.nerveStructureId, 'n_thoracicus_longus');
  assert.equal(getNervesForMuscle('m_gluteus_medius')[0]?.nerveStructureId, 'n_gluteus_superior');
  assert.equal(getNervesForMuscle('m_tibialis_anterior')[0]?.nerveStructureId, 'n_fibularis_communis');

  // 3. Verify 4 new Skill Tree sections (Sections 8-11, 12 lessons)
  const newSectionIds = ['vascular', 'nervous', 'visceral', 'connective'];
  for (const secId of newSectionIds) {
    const sec = SKILL_SECTIONS.find((s) => s.id === secId);
    assert.ok(sec, `Missing new section ${secId}`);
    assert.equal(sec!.lessons.length, 3, `Section ${secId} must have 3 lessons`);
  }
});

test('Phase 8 (v3): 3D Dermatome/Myotome map (C4–S2), enriched 50 Clinical Tests, SRS dermatome deck & quiz builder', () => {
  // 1. All 15 spinal root levels have valid myotome structureIds, clean Polish text, and match real meshes in skin.glb
  assert.equal(DERMATOME_MYOTOME_LEVELS.length, 15);
  const bannedLatin = /\b(musculus|ligamentum|tuberculum|articulatio|processus)\b/i;

  // Parse GLB JSON header from public/models/layers/full_body/skin.glb to verify real skin region mesh names
  const skinGlbPath = path.resolve(process.cwd(), 'public/models/layers/full_body/skin.glb');
  const buf = fs.readFileSync(skinGlbPath);
  const jsonLen = buf.readUInt32LE(12);
  const gltfJson = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8')) as {
    nodes?: Array<{ name?: string }>;
    meshes?: Array<{ name?: string }>;
  };
  const skinNames = new Set<string>([
    ...(gltfJson.nodes ?? []).map((n) => n.name ?? '').filter(Boolean),
    ...(gltfJson.meshes ?? []).map((m) => m.name ?? '').filter(Boolean),
  ]);
  assert.ok(skinNames.size >= 100, `Expected >= 100 named skin nodes in skin.glb, got ${skinNames.size}`);

  for (const lvl of DERMATOME_MYOTOME_LEVELS) {
    assert.equal(getDermatomeLevelById(lvl.id)?.id, lvl.id);
    assert.ok(lvl.myotomeMuscleIds.length >= 1, `Root ${lvl.id} must have >= 1 myotome muscle`);
    for (const mId of lvl.myotomeMuscleIds) {
      assert.ok(ANATOMY_MAP[mId], `Dermatome ${lvl.id} references unknown muscle ${mId}`);
    }
    const textBlob = [
      lvl.labelPl,
      lvl.groupLabelPl,
      lvl.keyMusclePl,
      lvl.keyMovementPl,
      lvl.sensoryLandmarkPl,
      lvl.reflexPl,
      lvl.commonDiscLevelPl,
      lvl.radiculopathySignsPl,
      ...lvl.provocationTestsPl,
    ].join(' ');
    assert.equal(bannedLatin.test(textBlob), false, `Banned Latin term found in dermatome ${lvl.id}`);

    const matchedSkinMeshes = [...skinNames].filter((name) => doesSkinMeshMatchDermatome(lvl, name));
    assert.ok(
      matchedSkinMeshes.length >= 1,
      `Dermatome ${lvl.id} matched 0 skin meshes in full_body/skin.glb`,
    );
  }

  // Spot-check key dermatome/myotome matches including GLTF underscore names
  const l5 = getDermatomeLevelById('L5')!;
  assert.equal(doesSkinMeshMatchDermatome(l5, 'Dorsum_of_foot.r'), true);
  assert.equal(doesSkinMeshMatchDermatome(l5, 'Deltoid_region.r'), false);
  assert.equal(doesMuscleMeshMatchMyotome(l5, 'm_tibialis_anterior', 'Tibialis_anterior'), true);
  assert.equal(doesMuscleMeshMatchMyotome(l5, undefined, 'Extensor_hallucis_longus_muscle.r'), true);
  assert.equal(doesMuscleMeshMatchMyotome(l5, 'm_gastrocnemius', 'Gastrocnemius'), false);

  const c6 = getDermatomeLevelById('C6')!;
  assert.equal(doesSkinMeshMatchDermatome(c6, 'Radial_foveola.r'), true);
  assert.equal(doesMuscleMeshMatchMyotome(c6, 'm_biceps_brachii', 'Biceps_brachii'), true);

  // 2. All 54 enriched clinical tests reference valid ANATOMY_MAP structureIds and contain extended Z-Anatomy layers
  assert.equal(CLINICAL_TESTS_DB.length, 54);
  for (const t of CLINICAL_TESTS_DB) {
    assert.ok(t.structureIds.length >= 1, `Test ${t.id} must have >= 1 structureId`);
    for (const sId of t.structureIds) {
      assert.ok(ANATOMY_MAP[sId], `Clinical test ${t.id} references unknown structureId ${sId}`);
    }
  }
  const neer = CLINICAL_TEST_MAP['test_neer'];
  assert.ok(neer.structureIds.includes('bursa_subacromialis'));
  assert.ok(neer.structureIds.includes('m_supraspinatus'));
  const lasegue = CLINICAL_TEST_MAP['test_lasegue_slump'];
  assert.ok(lasegue.structureIds.includes('n_ischiadicus'));
  const phalen = CLINICAL_TEST_MAP['test_phalen_tinel'];
  assert.ok(phalen.structureIds.includes('n_medianus'));

  // 3. New SRS dermatome deck (15 cards) & total SRS deck count (323 cards)
  const dermDeck = buildSrsDeck('dermatomes', 'all');
  assert.equal(dermDeck.length, DERMATOME_MYOTOME_LEVELS.length);
  assert.ok(dermDeck.every((c) => c.id.startsWith('srs_derm_') && c.backSections.length >= 4));
  assert.equal(
    getAllSrsCards().length,
    ANATOMY_DB.length +
      MUSCLE_ACTIONS_DB.length +
      CLINICAL_TESTS_DB.length +
      DERMATOME_MYOTOME_LEVELS.length +
      BIOMECHANICS_MOVEMENTS.length,
  );

  // 4. Dermatome 3D quiz generator produces unique targets & 4 unique options with exactly 1 correct answer
  const allQs = buildDermatomeQuizQuestions('all', 10, 'both');
  assert.equal(allQs.length, 10);
  const targetIds = new Set(allQs.map((q) => q.target.id));
  assert.equal(targetIds.size, 10);
  for (const q of allQs) {
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options.map((o) => o.id)).size, 4);
    assert.equal(q.options.filter((o) => o.id === q.target.id).length, 1);
  }
  const upperQs = buildDermatomeQuizQuestions('upper', 5, 'dermatome');
  assert.equal(upperQs.length, 5);
  assert.ok(upperQs.every((q) => q.target.group === 'cervical' || q.target.id === 'Th1'));
  const lowerQs = buildDermatomeQuizQuestions('lower', 5, 'myotome');
  assert.equal(lowerQs.length, 5);
  assert.ok(lowerQs.every((q) => q.target.group === 'lumbar' || q.target.group === 'sacral'));
});

test('Phase 9 (v4): 5-stage Patient Simulator 3D (12 cases), fizjoterapeuty.pl tests (54), Skill Tree clinical cases (>=2/lesson), and OSCE persistence', () => {
  const bannedLatin = /\b(musculus|ligamentum|tuberculum|articulatio|processus)\b/i;

  // 1. Verify 4 new orthopedic tests from fizjoterapeuty.pl (54 tests total, 327 SRS cards)
  for (const tid of ['test_apley_knee', 'test_pivot_shift', 'test_bragard', 'test_freiberg']) {
    assert.ok(CLINICAL_TEST_MAP[tid], `Missing fizjoterapeuty.pl test ${tid}`);
  }
  assert.equal(CLINICAL_TESTS_DB.length, 54);
  assert.equal(
    getAllSrsCards().length,
    ANATOMY_DB.length +
      MUSCLE_ACTIONS_DB.length +
      CLINICAL_TESTS_DB.length +
      DERMATOME_MYOTOME_LEVELS.length +
      BIOMECHANICS_MOVEMENTS.length,
  );

  // 2. Verify all 12 five-stage 3D patient cases and their real clickable 3D GLB meshes
  assert.equal(PATIENT_CASES_DB.length, 12);
  assert.equal(new Set(PATIENT_CASES_DB.map((c) => c.id)).size, 12);
  assert.ok(PATIENT_CASES_DB.some((c) => c.isRedFlagCase), 'Must include at least 1 red flag case');

  const glbCache = new Map<string, string[]>();
  const readGlbNames = (relPath: string): string[] => {
    const cached = glbCache.get(relPath);
    if (cached) return cached;
    const abs = path.resolve(process.cwd(), relPath);
    if (!fs.existsSync(abs)) {
      glbCache.set(relPath, []);
      return [];
    }
    const buf = fs.readFileSync(abs);
    const gltf = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8')) as {
      nodes?: Array<{ name?: string }>;
      meshes?: Array<{ name?: string }>;
    };
    const names = [
      ...new Set([
        ...(gltf.nodes ?? []).map((n) => n.name ?? ''),
        ...(gltf.meshes ?? []).map((m) => m.name ?? ''),
      ].filter(Boolean)),
    ];
    glbCache.set(relPath, names);
    return names;
  };

  for (const scenario of PATIENT_CASES_DB) {
    assert.equal(PATIENT_CASE_MAP[scenario.id]?.id, scenario.id);
    assert.equal(scenario.stage1Interview.options.length, 4);
    assert.equal(scenario.stage2Neuro.options.length, 4);
    assert.equal(scenario.stage3Test.optionTestIds.length, 4);
    assert.equal(scenario.stage5Plan.options.length, 4);

    if (scenario.stage2Neuro.dermatomeRootId) {
      assert.ok(
        getDermatomeLevelById(scenario.stage2Neuro.dermatomeRootId),
        `Case ${scenario.id} references unknown dermatome ${scenario.stage2Neuro.dermatomeRootId}`,
      );
    }
    if (scenario.stage2Neuro.nerveId) {
      assert.ok(
        getNerveProfileByStructureId(scenario.stage2Neuro.nerveId),
        `Case ${scenario.id} references unknown nerve ${scenario.stage2Neuro.nerveId}`,
      );
    }

    assert.ok(
      scenario.stage3Test.optionTestIds.includes(scenario.stage3Test.correctTestId),
      `Case ${scenario.id} correctTestId must be in optionTestIds`,
    );
    for (const tid of scenario.stage3Test.optionTestIds) {
      assert.ok(CLINICAL_TEST_MAP[tid], `Case ${scenario.id} references unknown test ${tid}`);
    }

    assert.ok(
      ANATOMY_MAP[scenario.stage4Locate3D.targetStructureId],
      `Case ${scenario.id} references unknown Stage 4 structureId ${scenario.stage4Locate3D.targetStructureId}`,
    );
    for (const sid of scenario.stage4Locate3D.acceptedStructureIds) {
      assert.ok(ANATOMY_MAP[sid], `Case ${scenario.id} acceptedStructureId ${sid} missing in ANATOMY_MAP`);
    }

    // Confirm Stage 4 targetStructureId actually exists as a clickable mesh in its region's GLB files
    const baseFile =
      scenario.region3D === 'full_body'
        ? 'public/models/body.glb'
        : `public/models/regional/${scenario.region3D}.glb`;
    const candidateFiles: Array<{ file: string; hint?: 'ligament' | 'nerve' | 'artery' | 'vein' | 'organ' }> = [
      { file: baseFile },
    ];
    if (scenario.stage4Locate3D.visibleLayers.ligament) {
      candidateFiles.push({
        file: `public/models/layers/${scenario.region3D}/ligaments.glb`,
        hint: 'ligament',
      });
    }
    if (scenario.stage4Locate3D.visibleLayers.nerve) {
      candidateFiles.push({
        file: `public/models/layers/${scenario.region3D}/nerves.glb`,
        hint: 'nerve',
      });
    }
    let foundMesh = false;
    for (const cf of candidateFiles) {
      for (const meshName of readGlbNames(cf.file)) {
        const tr = translateMeshNameToPolish(meshName, cf.hint);
        if (tr.structureId === scenario.stage4Locate3D.targetStructureId) {
          foundMesh = true;
          break;
        }
      }
      if (foundMesh) break;
    }
    assert.ok(
      foundMesh,
      `Case ${scenario.id} Stage 4 target ${scenario.stage4Locate3D.targetStructureId} did not match any mesh in ${scenario.region3D}`,
    );

    const caseBlob = [
      scenario.titlePl,
      scenario.subtitlePl,
      scenario.patientCard.chiefComplaint,
      scenario.patientCard.quotePl,
      scenario.stage1Interview.promptPl,
      ...scenario.stage1Interview.options,
      scenario.stage1Interview.explanationPl,
      scenario.stage2Neuro.promptPl,
      ...scenario.stage2Neuro.options,
      scenario.stage2Neuro.explanationPl,
      scenario.stage3Test.promptPl,
      scenario.stage3Test.patientFindingPl,
      scenario.stage3Test.explanationPl,
      scenario.stage4Locate3D.promptPl,
      scenario.stage4Locate3D.hintPl,
      scenario.stage4Locate3D.explanationPl,
      scenario.stage5Plan.finalDiagnosisPl,
      scenario.stage5Plan.promptPl,
      ...scenario.stage5Plan.options,
      scenario.stage5Plan.explanationPl,
    ].join(' ');
    assert.equal(bannedLatin.test(caseBlob), false, `Banned Latin term in patient case ${scenario.id}`);
  }

  // 3. Verify all 37 Skill Tree lessons have exact 3 clinical_case tasks in bank (111 total)
  //    and balanced session density (exact 1 for anatomical lessons, exact 2 for clinic/kinesitherapy)
  let totalSkillTreeCases = 0;
  for (const sec of SKILL_SECTIONS) {
    for (const lesson of sec.lessons) {
      const bank = LESSON_TASK_BANKS[lesson.id] ?? [];
      const bankCases = bank.filter((t) => t.type === 'clinical_case');
      totalSkillTreeCases += bankCases.length;
      assert.equal(
        bankCases.length,
        3,
        `Lesson ${lesson.id} must have exactly 3 clinical_case tasks in bank, got ${bankCases.length}`,
      );
      for (const c of bankCases) {
        assert.ok(ANATOMY_MAP[c.structureId], `Lesson ${lesson.id} case ${c.id} has invalid structureId`);
        const blob = `${c.patientProfile} ${c.clinicalVignette} ${c.options.join(' ')} ${c.explanation}`;
        assert.equal(bannedLatin.test(blob), false, `Banned Latin term in lesson clinical case ${c.id}`);
      }
      const built = buildLessonTasks(lesson.id);
      const builtCases = built.filter((t) => t.type === 'clinical_case');
      const expectedCasesInSession = isClinicalOrKinesitherapyLesson(lesson.id) ? 2 : 1;
      assert.equal(
        builtCases.length,
        expectedCasesInSession,
        `buildLessonTasks(${lesson.id}) must serve exact ${expectedCasesInSession} clinical_case task(s), got ${builtCases.length}`,
      );
    }
  }
  assert.equal(totalSkillTreeCases, 111, `Expected exact 111 clinical cases across 37 lessons, got ${totalSkillTreeCases}`);

  // 4. Verify OSCE grading & patientCaseHistory JSON persistence round-trip
  assert.equal(calculateOsceGrade(5, 5), 5.0);
  assert.equal(calculateOsceGrade(4, 5), 4.5);
  assert.equal(calculateOsceGrade(3, 5), 3.5);
  assert.equal(calculateOsceGrade(2, 5), 2.0);
  assert.equal(calculateOsceGrade(0, 5), 2.0);

  const prog = createInitialProgress();
  prog.patientCaseHistory = [
    {
      id: 'pcase_test_1',
      caseId: 'case_spine_cauda_equina',
      caseTitle: 'Obustronna rwa i problemy z pęcherzem',
      date: '2026-11-23',
      mode: 'osce',
      correctStages: 5,
      totalStages: 5,
      accuracy: 100,
      grade: 5.0,
      xpEarned: 125,
    },
  ];
  const exported = exportProgressToJson(prog);
  const reimported = parseImportedProgress(exported);
  assert.ok(reimported);
  assert.equal(reimported!.patientCaseHistory?.length, 1);
  assert.equal(reimported!.patientCaseHistory?.[0].grade, 5.0);
  assert.equal(reimported!.patientCaseHistory?.[0].mode, 'osce');
});

test('Phase 10 (v5): Biomechanics 3D (7 joints / 24 movements, SFTR, Kaltenborn), GLB muscle coverage, SRS biomechanics deck (351), and mixed quiz', () => {
  const bannedLatin = /\b(musculus|ligamentum|tuberculum|articulatio|processus)\b/i;

  // 1. Validate 7 joint groups and 24 unique movements
  assert.equal(BIOMECHANICS_JOINT_GROUPS.length, 7);
  assert.equal(BIOMECHANICS_MOVEMENTS.length, 24);
  assert.equal(new Set(BIOMECHANICS_MOVEMENTS.map((m) => m.id)).size, 24);

  const glbCache = new Map<string, string[]>();
  const readGlbNames = (relPath: string): string[] => {
    const cached = glbCache.get(relPath);
    if (cached) return cached;
    const abs = path.resolve(process.cwd(), relPath);
    const buf = fs.readFileSync(abs);
    const gltf = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8')) as {
      nodes?: Array<{ name?: string }>;
      meshes?: Array<{ name?: string }>;
    };
    const names = [
      ...new Set([
        ...(gltf.nodes ?? []).map((n) => n.name ?? ''),
        ...(gltf.meshes ?? []).map((m) => m.name ?? ''),
      ].filter(Boolean)),
    ];
    glbCache.set(relPath, names);
    return names;
  };

  for (const m of BIOMECHANICS_MOVEMENTS) {
    assert.equal(BIOMECHANICS_MAP[m.id]?.id, m.id);
    assert.equal(getMovementById(m.id)?.id, m.id);
    assert.ok(m.agonistIds.length >= 1, `Movement ${m.id} must have >= 1 agonist`);
    assert.ok(m.antagonistIds.length >= 1, `Movement ${m.id} must have >= 1 antagonist`);
    assert.ok(m.anchorBoneIds.length >= 2, `Movement ${m.id} must define >= 2 anchor bones`);

    for (const sid of [...m.agonistIds, ...m.synergistIds, ...m.antagonistIds, ...m.anchorBoneIds]) {
      assert.ok(ANATOMY_MAP[sid], `Movement ${m.id} references unknown structureId ${sid}`);
    }
    if (m.lovettTestId) {
      assert.ok(CLINICAL_TEST_MAP[m.lovettTestId], `Movement ${m.id} references unknown Lovett test ${m.lovettTestId}`);
    }

    const blob = [
      m.jointLabelPl,
      m.namePl,
      m.planeLabelPl,
      m.axisLabelPl,
      m.sftrCode,
      m.normRangePl,
      m.convexConcaveRulePl,
      m.clinicalTipPl,
    ].join(' ');
    assert.equal(bannedLatin.test(blob), false, `Banned Latin term in biomechanics movement ${m.id}`);

    // Verify real GLB muscle meshes match both agonist & antagonist roles in recommendedRegion
    const glbFile =
      m.recommendedRegion === 'full_body'
        ? 'public/models/body.glb'
        : `public/models/regional/${m.recommendedRegion}.glb`;
    const names = readGlbNames(glbFile);
    let matchedAgonist = false;
    let matchedAntagonist = false;
    for (const rawName of names) {
      const tr = translateMeshNameToPolish(rawName);
      const role = resolveMuscleBiomechanicsRole(m, tr.structureId, rawName);
      if (role === 'agonist') matchedAgonist = true;
      if (role === 'antagonist') matchedAntagonist = true;
      if (matchedAgonist && matchedAntagonist) break;
    }
    assert.ok(matchedAgonist, `Movement ${m.id} matched 0 agonist meshes in ${glbFile}`);
    assert.ok(matchedAntagonist, `Movement ${m.id} matched 0 antagonist meshes in ${glbFile}`);
  }

  // 2. Verify reverse lookup getMovementsForMuscle & role resolution
  const deltoidMoves = getMovementsForMuscle('m_deltoideus');
  assert.ok(deltoidMoves.some((x) => x.movement.id === 'shoulder_abduction' && x.role === 'agonist'));
  const quadMoves = getMovementsForMuscle('m_quadriceps_femoris');
  assert.ok(quadMoves.some((x) => x.movement.id === 'knee_extension' && x.role === 'agonist'));
  assert.ok(quadMoves.some((x) => x.movement.id === 'knee_flexion' && x.role === 'antagonist'));
  assert.equal(
    resolveMuscleBiomechanicsRole(getMovementById('forearm_supination')!, undefined, 'Supinator_muscle.r'),
    'agonist',
  );

  // 3. Verify SRS biomechanics deck (24 cards -> 351 total)
  const biomDeck = buildSrsDeck('biomechanics', 'all');
  assert.equal(biomDeck.length, BIOMECHANICS_MOVEMENTS.length);
  assert.ok(biomDeck.every((c) => c.id.startsWith('srs_biom_') && c.backSections.length === 5));
  assert.equal(
    getAllSrsCards().length,
    ANATOMY_DB.length +
      MUSCLE_ACTIONS_DB.length +
      CLINICAL_TESTS_DB.length +
      DERMATOME_MYOTOME_LEVELS.length +
      BIOMECHANICS_MOVEMENTS.length,
  );

  // 4. Verify mixed Biomechanics 3D quiz generator (3 question kinds, 4 unique options, 1 correct)
  const qs = buildBiomechanicsQuizQuestions('all', 12);
  assert.equal(qs.length, 12);
  const kinds = new Set(qs.map((q) => q.kind));
  assert.equal(kinds.size, 3, 'Mixed quiz must cover all 3 question kinds');
  for (const q of qs) {
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options.map((o) => o.id)).size, 4);
    assert.equal(q.options.filter((o) => o.isCorrect).length, 1);
  }
});

test('Phase 11 (v6): Balanced 111 clinical cases, fizjoterapeuty.pl clinical reconciliation, and full Offline PWA 3D manifest + Service Worker', () => {
  const bannedLatin = /\b(musculus|ligamentum|tuberculum|articulatio|processus)\b/i;

  // 1. Balanced clinical case bank (37 x 3 = 111) & deterministic session ratios across 26 anatomical / 11 clinical lessons
  const allLessons = getAllLessonsOrdered();
  assert.equal(allLessons.length, 37);
  const clinicalLessons = allLessons.filter((l) => isClinicalOrKinesitherapyLesson(l.id));
  const anatomicalLessons = allLessons.filter((l) => !isClinicalOrKinesitherapyLesson(l.id));
  assert.equal(clinicalLessons.length, 11);
  assert.equal(anatomicalLessons.length, 26);

  for (const lesson of allLessons) {
    const bankCases = (LESSON_TASK_BANKS[lesson.id] ?? []).filter((t) => t.type === 'clinical_case');
    assert.equal(bankCases.length, 3, `Lesson ${lesson.id} must have 3 clinical cases`);
    assert.equal(new Set(bankCases.map((c) => c.id)).size, 3, `Duplicate clinical case IDs in ${lesson.id}`);

    for (let trial = 0; trial < 3; trial++) {
      let seed = (trial + 1) * 7919 + lesson.id.length * 31;
      const deterministicRng = () => {
        seed = (seed * 48271) % 2147483647;
        return seed / 2147483647;
      };
      const built = buildLessonTasks(lesson.id, deterministicRng);
      const ccCount = built.filter((t) => t.type === 'clinical_case').length;
      if (isClinicalOrKinesitherapyLesson(lesson.id)) {
        assert.equal(ccCount, 2, `Clinical lesson ${lesson.id} must have exact 2 cases`);
        assert.ok(built.length >= 6 && built.length <= 7, `Clinical lesson ${lesson.id} length ${built.length}`);
      } else {
        assert.equal(ccCount, 1, `Anatomical lesson ${lesson.id} must have exact 1 case`);
        assert.ok(built.length >= 5 && built.length <= 6, `Anatomical lesson ${lesson.id} length ${built.length}`);
      }
    }
  }

  // 2. Verify fizjoterapeuty.pl clinical reconciliations
  const lovettCard = CLINICAL_TEST_MAP['kin_method_lovett_exercises'];
  assert.ok(lovettCard);
  assert.match(lovettCard.procedure, /0 \(0%\)/);
  assert.match(lovettCard.procedure, /1 \(10%\)/);
  assert.match(lovettCard.procedure, /2 \(25%\)/);
  assert.match(lovettCard.procedure, /3 \(50%\)/);
  assert.match(lovettCard.procedure, /4 \(75%\)/);
  assert.match(lovettCard.procedure, /5 \(100%\)/);
  assert.match(lovettCard.patientPosition, /stopnia 3/i);

  const contraCard = CLINICAL_TEST_MAP['kin_method_contraindications'];
  assert.ok(contraCard);
  assert.match(contraCard.procedure, /160\/100/);
  assert.match(contraCard.procedure, /180\/110/);
  assert.match(contraCard.procedure, /nakłucie lędźwiowe/i);

  const ugulCard = CLINICAL_TEST_MAP['kin_method_ugul'];
  assert.ok(ugulCard);
  assert.match(ugulCard.clinicalInterpretation, /160\/100/);
  assert.match(ugulCard.clinicalInterpretation, /gorączka >38°C/i);

  const sftrCard = CLINICAL_TEST_MAP['kin_method_sftr'];
  assert.ok(sftrCard);
  assert.match(sftrCard.normsOrRules ?? '', /S: 0–0–130/);
  assert.match(sftrCard.normsOrRules ?? '', /F: 20–0/);
  assert.match(sftrCard.normsOrRules ?? '', /F: 0–20/);

  const lachmanCard = CLINICAL_TEST_MAP['test_lachman'];
  assert.ok(lachmanCard);
  assert.match(lachmanCard.patientPosition, /15–30°/);

  const gerberCard = CLINICAL_TEST_MAP['test_gerber_liftoff'];
  assert.ok(gerberCard);
  assert.match(gerberCard.namePl, /Test startu Gerbera/);

  const apleyCard = CLINICAL_TEST_MAP['test_apley_knee'];
  assert.ok(apleyCard);
  assert.match(apleyCard.clinicalInterpretation, /Apley Scratch/i);

  const l5 = DERMATOME_MYOTOME_LEVELS.find((d) => d.id === 'L5');
  assert.ok(l5 && l5.myotomeMuscleIds.includes('m_tibialis_posterior'));
  const c8 = DERMATOME_MYOTOME_LEVELS.find((d) => d.id === 'C8');
  assert.ok(c8 && /Trömnera/i.test(c8.reflexPl));

  const sup = getMovementById('forearm_supination');
  const pron = getMovementById('forearm_pronation');
  assert.ok(sup && /80–0–90°/.test(sup.clinicalTipPl));
  assert.ok(pron && /80–0–90°/.test(pron.clinicalTipPl));

  for (const t of CLINICAL_TESTS_DB) {
    const blob = [t.namePl, t.targetSummary, t.patientPosition, t.procedure, t.positiveSign, t.clinicalInterpretation, t.normsOrRules ?? ''].join(' ');
    assert.equal(bannedLatin.test(blob), false, `Banned Latin term in clinical test ${t.id}`);
  }

  // 3. Verify Offline PWA 3D Model Manifest (all 45 .glb + core Draco/manifest physically exist with exact bytes)
  assert.equal(OFFLINE_MODEL_PACKS.length, 5);
  assert.equal(TOTAL_OFFLINE_3D_FILES, 45);
  assert.ok(TOTAL_OFFLINE_3D_BYTES > 20_000_000);

  const manifestUrls = new Set<string>();
  for (const asset of [...CORE_OFFLINE_3D_ASSETS, ...OFFLINE_MODEL_PACKS.flatMap((p) => p.assets)]) {
    assert.equal(manifestUrls.has(asset.url), false, `Duplicate offline asset URL: ${asset.url}`);
    manifestUrls.add(asset.url);
    const diskPath = path.resolve(process.cwd(), 'public', asset.url.replace(/^\//, ''));
    assert.equal(fs.existsSync(diskPath), true, `Offline asset missing on disk: ${diskPath}`);
    const actualSize = fs.statSync(diskPath).size;
    assert.equal(
      actualSize,
      asset.bytes,
      `Byte size mismatch for ${asset.url}: manifest=${asset.bytes}, disk=${actualSize}`,
    );
  }

  // Ensure 100% of .glb files under public/models/ are covered by OFFLINE_MODEL_PACKS (no forgotten 3D models)
  const walkGlb = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walkGlb(full));
      else if (entry.name.endsWith('.glb')) {
        const rel = '/' + path.relative(path.resolve(process.cwd(), 'public'), full).replace(/\\/g, '/');
        out.push(rel);
      }
    }
    return out;
  };
  const diskGlbs = walkGlb(path.resolve(process.cwd(), 'public/models'));
  assert.equal(diskGlbs.length, TOTAL_OFFLINE_3D_FILES);
  for (const glbUrl of diskGlbs) {
    assert.equal(manifestUrls.has(glbUrl), true, `Disk 3D model missing from OFFLINE_MODEL_PACKS: ${glbUrl}`);
  }

  // 4. Verify Service Worker file & formatting helper
  const swPath = path.resolve(process.cwd(), 'public/sw.js');
  assert.equal(fs.existsSync(swPath), true, 'public/sw.js must exist');
  const swSource = fs.readFileSync(swPath, 'utf8');
  assert.ok(swSource.includes(PHYSIOLINGO_APP_CACHE));
  assert.ok(swSource.includes(PHYSIOLINGO_MODELS_CACHE));
  assert.ok(swSource.includes("url.pathname.startsWith('/api/')"));
  assert.ok(swSource.includes("pathname.startsWith('/@vite')"));

  assert.equal(formatBytesPl(0), '0 B');
  assert.equal(formatBytesPl(512), '512 B');
  assert.equal(formatBytesPl(2048), '2 KB');
  assert.equal(formatBytesPl(2_553_148), '2,4 MB');
  assert.equal(formatBytesPl(TOTAL_OFFLINE_3D_BYTES), '22,8 MB');

  // 5. Verify GitHub Actions CI + Cloudflare Pages / Netlify static PWA deployment config
  for (const rel of ['.github/workflows/ci.yml', 'public/_headers', 'netlify.toml', '.nvmrc']) {
    const abs = path.resolve(process.cwd(), rel);
    assert.equal(fs.existsSync(abs), true, `Missing CI/deploy file: ${rel}`);
  }
  const ciYaml = fs.readFileSync(path.resolve(process.cwd(), '.github/workflows/ci.yml'), 'utf8');
  assert.ok(ciYaml.includes('npm run lint'));
  assert.ok(ciYaml.includes('npm test'));
  assert.ok(ciYaml.includes('npm run test:e2e'));
  assert.ok(ciYaml.includes('npm run build:static'));

  const headersTxt = fs.readFileSync(path.resolve(process.cwd(), 'public/_headers'), 'utf8');
  assert.ok(headersTxt.includes('/sw.js') && headersTxt.includes('no-cache'));
  assert.ok(headersTxt.includes('/models/*') && headersTxt.includes('immutable'));
  assert.ok(headersTxt.includes('/draco/*') && headersTxt.includes('immutable'));

  const netlifyToml = fs.readFileSync(path.resolve(process.cwd(), 'netlify.toml'), 'utf8');
  assert.ok(netlifyToml.includes('npm run build:static') && netlifyToml.includes('publish = "dist"'));

  // 6. Verify Android/iOS PWA installability PNG icons (192x192, 512x512, maskable, 180x180 apple-touch-icon)
  const manifestJson = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'public/manifest.webmanifest'), 'utf8'),
  ) as { id?: string; scope?: string; icons: Array<{ src: string; sizes: string; type: string; purpose?: string }> };
  assert.equal(manifestJson.id, '/');
  assert.equal(manifestJson.scope, '/');
  assert.ok(manifestJson.icons.some((i) => i.type === 'image/png' && i.sizes === '192x192'));
  assert.ok(manifestJson.icons.some((i) => i.type === 'image/png' && i.sizes === '512x512' && i.purpose === 'any'));
  assert.ok(manifestJson.icons.some((i) => i.type === 'image/png' && i.sizes === '512x512' && i.purpose === 'maskable'));
  for (const iconRel of [
    'public/icons/icon-192.png',
    'public/icons/icon-512.png',
    'public/icons/icon-512-maskable.png',
    'public/icons/apple-touch-icon.png',
  ]) {
    const buf = fs.readFileSync(path.resolve(process.cwd(), iconRel));
    assert.equal(buf[0], 0x89, `${iconRel} must have PNG signature`);
    assert.equal(buf[1], 0x50, `${iconRel} must have PNG signature`);
    assert.equal(buf[2], 0x4e, `${iconRel} must have PNG signature`);
    assert.equal(buf[3], 0x47, `${iconRel} must have PNG signature`);
  }
  const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
  assert.ok(indexHtml.includes('rel="apple-touch-icon"') && indexHtml.includes('/icons/apple-touch-icon.png'));

  // 7. Verify 3D click-to-pivot camera orbit targeting math (small structure center vs sprawling mesh hit point)
  const clavicleGoal = computeClickOrbitGoal({
    currentPos: { x: 0, y: 0.2, z: 3.5 },
    currentTarget: { x: 0, y: 0.05, z: 0 },
    structureCenter: { x: -0.22, y: 1.42, z: 0.08 },
    structureRadius: 0.11,
    hitPoint: { x: -0.19, y: 1.4, z: 0.1 },
    minDistance: 0.06,
    maxDistance: 18,
    fovDeg: 42,
    aspect: 0.85,
  });
  assert.equal(clavicleGoal.usedHitPoint, false);
  assert.deepEqual(clavicleGoal.target, { x: -0.22, y: 1.42, z: 0.08 });
  assert.ok(clavicleGoal.distance < 3.5 && clavicleGoal.distance >= 0.85, `Expected gentle zoom-in from full body, got ${clavicleGoal.distance}`);

  // When already zoomed in close, clicking an adjacent structure preserves close zoom without jumping back
  const closeGoal = computeClickOrbitGoal({
    currentPos: { x: 0, y: 1.42, z: 0.58 },
    currentTarget: { x: 0, y: 1.42, z: 0.08 },
    structureCenter: { x: -0.18, y: 1.42, z: 0.08 },
    structureRadius: 0.09,
    hitPoint: { x: -0.16, y: 1.42, z: 0.11 },
    minDistance: 0.06,
    maxDistance: 18,
    fovDeg: 42,
    aspect: 0.85,
  });
  assert.ok(Math.abs(closeGoal.distance - 0.5) < 0.01, `Expected preserved close distance 0.5, got ${closeGoal.distance}`);

  // For sprawling full-body mesh (radius >= 0.38), orbit target snaps to exact clicked hitPoint
  const sprawlingGoal = computeClickOrbitGoal({
    currentPos: { x: 0, y: 0.5, z: 2.5 },
    currentTarget: { x: 0, y: 0.5, z: 0 },
    structureCenter: { x: 0, y: 0, z: 0 },
    structureRadius: 0.95,
    hitPoint: { x: 0.25, y: 1.15, z: 0.12 },
    minDistance: 0.06,
    maxDistance: 18,
    fovDeg: 42,
    aspect: 1.0,
  });
  assert.equal(sprawlingGoal.usedHitPoint, true);
  assert.deepEqual(sprawlingGoal.target, { x: 0.25, y: 1.15, z: 0.12 });
});

test('Phase 12 (v7): 74-muscle Actions DB, real-bone 3D kinematics, reverse lookup, comparator, 4-type quiz & SRS deck', () => {
  // 1. Exact 74-muscle inventory + 100% integrity across ANATOMY_DB, GLB nodes, Lovett links, zero banned Latin & zero external URLs
  assert.equal(MUSCLE_ACTIONS_DB.length, 74);
  assert.equal(new Set(MUSCLE_ACTIONS_DB.map((m) => m.muscleId)).size, 74);

  const bannedLatin = /\b(musculus|ligamentum|tuberculum|articulatio|processus)\b/i;
  const externalUrl = /https?:\/\/|youtube\.com|youtu\.be|anatomik\.pl/i;
  const catalogKeySet = new Set(JOINT_MOVEMENT_CATALOG.map((c) => `${c.joint}:${c.movementKey}`));

  const readGlbNodeNames = (relPath: string): string[] => {
    const abs = path.resolve(process.cwd(), 'public', relPath.replace(/^\//, ''));
    assert.equal(fs.existsSync(abs), true, `Missing GLB file: ${abs}`);
    const buf = fs.readFileSync(abs);
    const gltf = JSON.parse(buf.slice(20, 20 + buf.readUInt32LE(12)).toString('utf8')) as {
      nodes?: Array<{ name?: string }>;
    };
    return (gltf.nodes ?? []).filter((n) => n.name).map((n) => n.name!);
  };

  const sceneNodes: Record<string, string[]> = {};
  for (const [sceneKey, urls] of Object.entries(SIMULATOR_SCENE_FILES)) {
    sceneNodes[sceneKey] = urls.flatMap(readGlbNodeNames);
  }

  for (const profile of MUSCLE_ACTIONS_DB) {
    assert.ok(ANATOMY_MAP[profile.muscleId], `Missing ANATOMY_DB entry for ${profile.muscleId}`);
    assert.ok(profile.actions.some((a) => a.role === 'primary'), `${profile.muscleId} must have >=1 primary action`);
    assert.ok(profile.openChainSummaryPl.length > 20, `${profile.muscleId} missing openChainSummaryPl`);
    assert.ok(profile.closedChainReversedPl.length > 20, `${profile.muscleId} missing closedChainReversedPl`);
    assert.ok(profile.concentricWorkPl.length > 15, `${profile.muscleId} missing concentricWorkPl`);
    assert.ok(profile.eccentricWorkPl.length > 15, `${profile.muscleId} missing eccentricWorkPl`);
    assert.ok(profile.stretchingPositionPl.length > 15, `${profile.muscleId} missing stretchingPositionPl`);
    assert.ok(profile.palpationLandmarkPl.length > 15, `${profile.muscleId} missing palpationLandmarkPl`);
    assert.ok(profile.weaknessAndPalsyPl.length > 20, `${profile.muscleId} missing weaknessAndPalsyPl`);
    assert.ok(profile.examTrapPl.length > 20, `${profile.muscleId} missing examTrapPl`);
    assert.ok(profile.kinematicPresets.length >= 1, `${profile.muscleId} must have >=1 kinematicPreset`);

    if (profile.lovettTestId) {
      assert.ok(CLINICAL_TEST_MAP[profile.lovettTestId], `Invalid lovettTestId on ${profile.muscleId}`);
    }
    for (const linkedId of [...profile.synergistIds, ...profile.antagonistIds]) {
      assert.ok(ANATOMY_MAP[linkedId], `Invalid linked muscle ${linkedId} on ${profile.muscleId}`);
    }
    for (const act of profile.actions) {
      assert.ok(
        catalogKeySet.has(`${act.joint}:${act.movementKey}`),
        `Unknown catalog movement ${act.joint}:${act.movementKey} on ${profile.muscleId}`,
      );
    }

    for (const preset of profile.kinematicPresets) {
      const nodes = sceneNodes[preset.scene];
      assert.ok(nodes && nodes.length > 20, `Missing nodes for scene ${preset.scene}`);
      if (!preset.explicitAnchors) {
        const re = new RegExp(preset.meshPattern || profile.meshMatchPattern, 'i');
        assert.ok(
          nodes.some((n) => re.test(n)),
          `No GLB mesh match for ${profile.muscleId}/${preset.id} in ${preset.scene}`,
        );
      }
    }

    const serialized = JSON.stringify(profile);
    assert.equal(bannedLatin.test(serialized), false, `Banned Latin found in ${profile.muscleId}`);
    assert.equal(externalUrl.test(serialized), false, `External link found in ${profile.muscleId}`);
  }

  // 2. Verify high-yield anatomical exam truths across tricky muscles
  assert.equal(MUSCLE_ACTIONS_MAP.m_deltoideus.subparts?.length, 3);
  assert.equal(MUSCLE_ACTIONS_MAP.m_trapezius.subparts?.length, 3);
  assert.equal(MUSCLE_ACTIONS_MAP.m_pectoralis_major.subparts?.length, 3);
  assert.equal(MUSCLE_ACTIONS_MAP.m_quadriceps_femoris.subparts?.length, 4);
  assert.equal(MUSCLE_ACTIONS_MAP.m_gastrocnemius.biarticular, true);
  assert.equal(MUSCLE_ACTIONS_MAP.m_soleus.biarticular, false);
  assert.ok(/60|90/.test(MUSCLE_ACTIONS_MAP.m_piriformis.openChainSummaryPl));
  assert.ok(/odblokow/i.test(MUSCLE_ACTIONS_MAP.m_popliteus.closedChainReversedPl));
  assert.ok(/przeciwn/i.test(MUSCLE_ACTIONS_MAP.m_sternocleidomastoideus.openChainSummaryPl));
  assert.ok(/tę samą|ipsilateral/i.test(MUSCLE_ACTIONS_MAP.m_splenius_capitis.openChainSummaryPl));
  assert.ok(/L5/i.test(ANATOMY_MAP.m_extensor_hallucis_longus.spinalSegments));
  assert.ok(/C3–C5/i.test(ANATOMY_MAP.m_diaphragma.spinalSegments));

  // 3. Verify pure real-bone 3D kinematic engine math (including GLTFLoader dot-stripped sanitized names!)
  assert.equal(classifyBoneSegment('Humerus.003', 'shoulder'), 'distal');
  assert.equal(classifyBoneSegment('Humerus003', 'shoulder'), 'distal');
  assert.equal(classifyBoneSegment('Scapula.003', 'shoulder'), 'proximal');
  assert.equal(classifyBoneSegment('Scapula003', 'shoulder'), 'proximal');
  assert.equal(classifyBoneSegment('Clavicle001', 'shoulder'), 'proximal');
  assert.equal(classifyBoneSegment('Scapula.003', 'scapula'), 'distal');
  assert.equal(classifyBoneSegment('Radius003', 'radioulnar'), 'distal');
  assert.equal(classifyBoneSegment('Ulna003', 'radioulnar'), 'proximal');
  assert.equal(classifyBoneSegment('Femur003', 'hip'), 'distal');
  assert.equal(classifyBoneSegment('Hip_bone003', 'hip'), 'proximal');
  assert.equal(classifyBoneSegment('Tibia003', 'knee'), 'distal');
  assert.equal(classifyBoneSegment('Femur.003', 'knee'), 'proximal');
  assert.equal(classifyBoneSegment('Talus001', 'ankle'), 'distal');
  assert.equal(classifyBoneSegment('Talus.001', 'subtalar'), 'proximal');
  assert.equal(classifyBoneSegment('Calcaneus001', 'subtalar'), 'distal');
  assert.equal(classifyBoneSegment('Mandible', 'tmj'), 'distal');
  assert.equal(classifyBoneSegment('Frontal_bone', 'tmj'), 'proximal');
  assert.equal(classifyBoneSegment('Vertebra_C4', 'cervical_spine'), 'distal');
  assert.equal(classifyBoneSegment('Vertebra_C6', 'cervical_spine'), 'proximal');
  assert.equal(classifyBoneSegment('Trochanteric bursa of gluteus maximus', 'hip'), 'ignore');

  const deltoidPreset = MUSCLE_ACTIONS_MAP.m_deltoideus.kinematicPresets[0];
  const concStart = evaluateKinematicFrame(deltoidPreset, 0, 'concentric');
  const concEnd = evaluateKinematicFrame(deltoidPreset, 1, 'concentric');
  assert.equal(concStart.movingSegment, 'distal');
  assert.equal(concEnd.sweepAngleDeg, 105);
  assert.ok(concEnd.fiberThicknessScale > concStart.fiberThicknessScale, 'Concentric contraction thickens muscle belly');
  assert.ok(concEnd.rotationRad.z < 0, 'Right shoulder abduction rotates around -Z toward -X');

  const eccEnd = evaluateKinematicFrame(deltoidPreset, 1, 'eccentric');
  assert.equal(eccEnd.motionT, 0, 'Eccentric lengthens back toward start angle');
  assert.ok(eccEnd.fiberThicknessScale < concEnd.fiberThicknessScale, 'Eccentric elongation thins belly relative to concentric peak');

  const closedEnd = evaluateKinematicFrame(deltoidPreset, 1, 'closed_chain');
  assert.equal(closedEnd.movingSegment, 'proximal');
  assert.ok(closedEnd.rotationRad.z > 0, 'Closed chain inverts rotation sign onto proximal segment');

  // Right-sided QL & Scaleni bend upward spine (+Y) ipsilaterally to anatomical right (-X) via +Z rotation
  const qlFrame = evaluateKinematicFrame(MUSCLE_ACTIONS_MAP.m_quadratus_lumborum.kinematicPresets[0], 1, 'concentric');
  assert.ok(qlFrame.rotationRad.z > 0, 'Right QL lateral flexion rotates upward spine around +Z toward -X');
  const scmFrame = evaluateKinematicFrame(MUSCLE_ACTIONS_MAP.m_sternocleidomastoideus.kinematicPresets[0], 1, 'concentric');
  assert.ok(scmFrame.rotationRad.y > 0 && scmFrame.rotationRad.z > 0, 'Right SCM rotates face left (+Y) and tilts head right (+Z)');

  const pivot = computeJointPivotFromBoneBoxes('hip', {
    'Femur.003': { min: { x: -0.15, y: 0.43, z: -0.06 }, max: { x: -0.03, y: 0.885, z: 0.02 } },
  });
  assert.ok(pivot.y > 0.85 && pivot.y < 0.88, `Expected hip pivot near femoral head ~0.86, got ${pivot.y}`);

  const anchors = deriveMuscleAnchorsFromBox(
    { min: { x: -0.22, y: 1.15, z: -0.05 }, max: { x: -0.14, y: 1.40, z: 0.02 } },
    'vertical',
  );
  assert.ok(anchors.pp.y > anchors.pk.y);

  const strands = computeFiberBundlePoints(anchors.pp, anchors.pk, 1.15, 5, 11);
  assert.equal(strands.length, 5);
  assert.equal(strands[0].length, 11);
  assert.deepEqual(strands[0][0], anchors.pp);
  assert.deepEqual(strands[0][10], anchors.pk);

  const arcPts = computeProtractorArcPoints(pivot, 'z', 0, -90, 0.1, 16);
  assert.equal(arcPts.length, 17);

  // 4. Reverse lookup ("Kto wykonuje ten ruch?"), 2-muscle comparator, 4-type quiz & SRS deck
  const abdLookup = findMusclesByJointAndMovement('shoulder', 'shoulder_abduction');
  assert.ok(abdLookup);
  assert.ok(abdLookup.primary.some((m) => m.muscleId === 'm_deltoideus'));
  assert.ok(abdLookup.primary.some((m) => m.muscleId === 'm_supraspinatus'));
  assert.ok(abdLookup.antagonists.some((m) => m.muscleId === 'm_latissimus_dorsi'));

  const calfCmp = compareTwoMuscles('m_gastrocnemius', 'm_soleus');
  assert.ok(calfCmp);
  assert.equal(calfCmp.areSynergists, true);
  assert.equal(calfCmp.sameInnervation, true);
  assert.ok(calfCmp.onlyInA.some((a) => a.joint === 'knee'));

  const quizQs = buildMuscleActionsQuizQuestions({ count: 8, seed: 2026 });
  assert.equal(quizQs.length, 8);
  const quizKinds = new Set(quizQs.map((q) => q.kind));
  assert.equal(quizKinds.size, 4, 'Mixed quiz must cover all 4 question types');
  for (const q of quizQs) {
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options).size, 4, `Duplicate options in ${q.id}`);
    assert.ok(q.correctIndex >= 0 && q.correctIndex < 4);
  }

  const srsMuscles = buildSrsDeck('muscle_actions', 'all');
  assert.equal(srsMuscles.length, 74);
  assert.ok(srsMuscles.every((c) => c.id.startsWith('srs_musc_') && c.backSections.length >= 4));

  // 5. Verify no forbidden Tailwind blue/sky/indigo classes in new v7 UI components
  const forbiddenPalette = /\b(?:bg|text|border|ring|from|to|via)-(?:blue|sky|indigo)-\d{2,3}\b/;
  for (const rel of ['src/components/MuscleActionsView.tsx', 'src/components/MuscleMotionSimulator3D.tsx']) {
    const src = fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
    assert.equal(forbiddenPalette.test(src), false, `Forbidden blue/sky/indigo class in ${rel}`);
  }
});
