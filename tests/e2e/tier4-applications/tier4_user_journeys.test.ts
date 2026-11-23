/**
 * tests/e2e/tier4-applications/tier4_user_journeys.test.ts
 * Tier 4: Real-World Clinical & Educational User Journeys (7 Scenarios)
 */

import { describe, it, expect, setTestTier } from '../harness/testContext.ts';
import { Model3DInspector } from '../harness/model3dInspector.ts';
import { AppSimulator, CutRestoreSimulator, formatBilingualName } from '../harness/appSimulator.ts';
import { UIThemeInspector } from '../harness/uiThemeInspector.ts';

export function registerTier4UserJourneysTests(): void {
  setTestTier('Tier 4: Scenarios');

  describe('Tier 4: Real-World Application Scenarios', () => {
    it('Scenario 1: Knee Joint Rehabilitation Lesson Workflow (F1, F2, F7, F9, F13)', () => {
      // 1. Session start with full health
      let progress = AppSimulator.createInitialProgress();
      expect(progress.hearts).toBe(5);
      expect(progress.xp).toBe(0);

      // 2. Regional Model Resolution for Knee Lesson
      const kneeTask = {
        id: 'knee_l1_t1',
        type: 'model3d' as const,
        region: 'lower_limb_left' as const,
        structureId: 'patella',
        targetMeshId: 'mesh_patella',
        targetNamePl: 'Rzepka',
        prompt: 'Wskaż strukturę: Rzepka (Patella)',
        explanation: 'Rzepka jest największą trzeszczką ciała',
        funFact: '',
      };
      const modelUrl = AppSimulator.resolveModelUrlForTask(kneeTask);
      expect(modelUrl).toBe('/models/regional/lower_limb_left.glb');

      // 3. Task 1: 3D Model Pinpointing
      const t1Correct = AppSimulator.evaluateModel3DTask(kneeTask, {
        rawMeshName: 'mesh_patella',
        namePl: 'Rzepka',
      });
      expect(t1Correct).toBe(true);
      progress = AppSimulator.applyAnswerOutcome(progress, true, 15, 'patella');
      expect(progress.xp).toBe(15);

      // 4. Task 2: Multiple Choice
      const mcTask = {
        id: 'knee_l1_t2',
        type: 'multiple_choice' as const,
        structureId: 'patella',
        prompt: 'Gdzie przyczepia się więzadło rzepki?',
        options: [
          'Guzowatość piszczeli (Tibial tuberosity)',
          'Krętarz większy (Greater trochanter)',
          'Głowa strzałki (Fibular head)',
          'Kłykieć przyśrodkowy (Medial condyle)',
        ],
        correctIndex: 0,
        explanation: 'Więzadło rzepki kończy się na guzowatości piszczeli',
        funFact: '',
      };
      const t2Correct = AppSimulator.evaluateMultipleChoice(mcTask, 0);
      expect(t2Correct).toBe(true);
      progress = AppSimulator.applyAnswerOutcome(progress, true, 10, 'patella');

      // 5. Task 3: Matching Pairs
      const matchTask = {
        id: 'knee_l1_t3',
        type: 'matching' as const,
        structureId: 'knee_ligaments',
        prompt: 'Dopasuj więzadła do funkcji',
        pairs: [
          { id: '1', left: 'ACL', right: 'Stabilizacja przednia piszczeli' },
          { id: '2', left: 'PCL', right: 'Stabilizacja tylna piszczeli' },
          { id: '3', left: 'MCL', right: 'Stabilizacja koślawości' },
        ],
        explanation: '',
        funFact: '',
      };
      const t3Eval = AppSimulator.evaluateMatchingPairs(matchTask, [
        { left: 'ACL', right: 'Stabilizacja przednia piszczeli' },
        { left: 'PCL', right: 'Stabilizacja tylna piszczeli' },
        { left: 'MCL', right: 'Stabilizacja koślawości' },
      ]);
      expect(t3Eval.isComplete).toBe(true);
      progress = AppSimulator.applyAnswerOutcome(progress, true, 10, 'knee_ligaments');

      // 6. Task 4: Free-form Typing with Diacritic Normalization
      const typeTask = {
        id: 'knee_l1_t4',
        type: 'typing' as const,
        structureId: 'femur',
        targetLanguage: 'pl' as const,
        prompt: 'Wpisz nazwę najdłuższej kości (kość udowa)',
        acceptedAnswers: ['kość udowa', 'kosc udowa', 'udowa', 'femur'],
        displayAnswer: 'Kość udowa (Femur)',
        hintChips: ['kosc', 'udowa'],
        placeholder: 'Wpisz odpowiedź...',
        explanation: '',
        funFact: '',
      };
      const t4Correct = AppSimulator.evaluateTyping(typeTask, 'kosc udowa');
      expect(t4Correct).toBe(true);
      progress = AppSimulator.applyAnswerOutcome(progress, true, 15, 'femur');

      // 7. Task 5: Clinical Case Vignette
      const caseTask = {
        id: 'knee_l1_t5',
        type: 'clinical_case' as const,
        structureId: 'patella',
        patientProfile: '22-letnia biegaczka z bólem przedniego przedziału kolana',
        clinicalVignette: 'Ból nasila się przy schodzeniu po schodach',
        options: [
          'Konflikt rzepkowo-udowy / osłabienie VMO',
          'Zerwanie ścięgna Achillesa',
          'Zespół cieśni nadgarstka',
        ],
        correctIndex: 0,
        explanation: 'Osłabienie m. obszernego przyśrodkowego prowadzi do bocznego przyparcia rzepki',
        funFact: '',
      };
      const t5Correct = AppSimulator.evaluateClinicalCase(caseTask, 0);
      expect(t5Correct).toBe(true);
      progress = AppSimulator.applyAnswerOutcome(progress, true, 10, 'patella');

      // 8. Lesson Completion Summary
      const completion = AppSimulator.completeLessonProgress(progress, 'knee_lesson_1', 5, 5);
      expect(completion.accuracy).toBe(100);
      expect(completion.nextProgress.xp).toBe(60);
      expect(completion.nextProgress.hearts).toBe(5);
    });

    it('Scenario 2: Thoracic Spine Manual Therapy Inspection (F1, F4, F9, F10, F12)', () => {
      const torsoInspector = Model3DInspector.fromRegional('torso');

      // 1. Locate Thoracic Vertebra T4
      const t4Mesh = torsoInspector.findMesh((m) => m.rawName === 'Vertebra T4');
      expect(t4Mesh).toBeTruthy();

      // 2. Camera Auto-Focus Framing
      const focus = Model3DInspector.computeFocusTargetAndDistance(t4Mesh!.bounds);
      expect(Math.abs(focus.target[1] - t4Mesh!.bounds.center[1])).toBeLessThan(0.01);
      expect(focus.distance).toBeGreaterThan(0.05);

      // 3. Bilingual Card Formatting
      const bTitle = formatBilingualName('Kręg piersiowy Th4', 'Thoracic vertebra T4');
      expect(bTitle).toBe('Kręg piersiowy Th4 (Thoracic vertebra T4)');

      // 4. Cartilage Joint Articulation
      const costalCartilage = torsoInspector.findMesh((m) => /costal.*cartilage/i.test(m.rawName));
      expect(costalCartilage).toBeTruthy();
      expect(Model3DInspector.isCartilageMesh(costalCartilage!.rawName)).toBe(true);
    });

    it('Scenario 3: Shoulder Rotator Cuff Inspection & Bony Landmark Hotspots (F1, F4, F9, F12)', () => {
      const armInspector = Model3DInspector.fromRegional('upper_limb_right');
      const humerus = armInspector.findMesh((m) => /humerus/i.test(m.rawName));
      expect(humerus).toBeTruthy();

      // Greater tubercle landmark
      const tubMajus = AppSimulator.getHotspot('tuberculum_majus');
      expect(tubMajus).toBeTruthy();
      expect(tubMajus!.type).toBe('pk');
      expect(tubMajus!.attachedMuscles).toContain('m_supraspinatus');
      expect(tubMajus!.attachedMuscles).toContain('m_infraspinatus');
      expect(tubMajus!.attachedMuscles).toContain('m_teres_minor');

      // Camera frames landmark
      const landmarkBounds = {
        min: [0.21, 1.36, -0.04] as [number, number, number],
        max: [0.23, 1.38, -0.02] as [number, number, number],
        center: tubMajus!.position,
        size: [0.02, 0.02, 0.02] as [number, number, number],
      };
      const focus = Model3DInspector.computeFocusTargetAndDistance(landmarkBounds);
      expect(focus.target).toEqual(tubMajus!.position);
    });

    it('Scenario 4: Craniofacial & Temporomandibular Joint (TMJ) Examination (F1, F3, F9, F11)', () => {
      const headInspector = Model3DInspector.fromRegional('head_neck');

      // Nose integrity
      const noseMeshes = headInspector.getNoseMeshes();
      expect(noseMeshes.length).toBeGreaterThan(0);

      // FDI Teeth Examination
      const teeth = headInspector.getTeethMeshes();
      expect(teeth.length).toBeGreaterThanOrEqual(14); // Head/neck model includes teeth

      const tooth13 = teeth.find((t) => t.fdiNumber === 13);
      const tooth21 = teeth.find((t) => t.fdiNumber === 21);
      const tooth36 = teeth.find((t) => t.fdiNumber === 36);

      expect(tooth13).toBeTruthy();
      expect(tooth21).toBeTruthy();
      expect(tooth36).toBeTruthy();

      const bName21 = formatBilingualName('Siekacz przyśrodkowy górny lewy', 'Upper left central incisor');
      expect(bName21).toBe('Siekacz przyśrodkowy górny lewy (Upper left central incisor)');
    });

    it('Scenario 5: Deep Spinal Muscle Dissection Workflow (F4, F5, F6, F10)', () => {
      const sim = new CutRestoreSimulator();

      // Stepwise dissection of back muscles
      sim.cut('m_trapezius');
      sim.cut('m_latissimus_dorsi');
      sim.cut('m_rhomboid');
      sim.cut('m_erector_spinae');

      expect(sim.getHiddenCount()).toBe(4);
      expect(sim.isVisible('m_trapezius')).toBe(false);
      expect(sim.isVisible('m_latissimus_dorsi')).toBe(false);

      // Unobscured deep thoracic vertebra hit
      const torsoInspector = Model3DInspector.fromRegional('torso');
      const t7 = torsoInspector.findMesh((m) => m.rawName === 'Vertebra T7');
      expect(t7).toBeTruthy();

      const focus = Model3DInspector.computeFocusTargetAndDistance(t7!.bounds);
      expect(focus.target[1]).toBe(t7!.bounds.center[1]);

      // Bulk restore
      sim.restoreAll();
      expect(sim.getHiddenCount()).toBe(0);
      expect(sim.isVisible('m_trapezius')).toBe(true);
      expect(sim.isVisible('m_latissimus_dorsi')).toBe(true);
    });

    it('Scenario 6: Full Bilingual Atlas Search & Nomenclature Exploration (F4, F9, F10, F11, F12)', () => {
      const app = AppSimulator.getInstance();

      // Polish search
      const plHits = app.searchAnatomyDb('ramienna');
      expect(plHits.length).toBeGreaterThan(0);

      // Verify bilingual formatted title
      const humerus = plHits[0];
      const bilingual = formatBilingualName(humerus.namePl, 'Humerus');
      expect(bilingual).toBe('Kość ramienna (Humerus)');

      // Landmark lookup on humerus
      const hotspots = AppSimulator.getHotspotsForBone('humerus');
      expect(hotspots.length).toBeGreaterThanOrEqual(4);
      for (const h of hotspots) {
        expect(h.bilingualName).toContain('(');
      }
    });

    it('Scenario 7: Application Theme & Visual Consistency Audit (F8, F13, F14)', () => {
      // 1. Theme Scanner Verification
      const scan = UIThemeInspector.scanDirectory();
      expect(scan.totalScannedFiles).toBeGreaterThan(5);

      // 2. Viewport Dark Canvas Background Check
      const bg = UIThemeInspector.getViewportBackgroundHex();
      expect([0x111a16, 0x0f1715, 0x0f172a]).toContain(bg.hex);

      // 3. Visual Accessibility Contrast
      const contrast = UIThemeInspector.computeContrastRatio(0xffffff, bg.hex);
      expect(contrast).toBeGreaterThan(7.0);

      // 4. Emerald Accent Class Adoption
      expect(scan.emeraldCount).toBeGreaterThan(15);
    });
  });
}
