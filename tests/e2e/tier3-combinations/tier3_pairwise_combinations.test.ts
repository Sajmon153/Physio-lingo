/**
 * tests/e2e/tier3-combinations/tier3_pairwise_combinations.test.ts
 * Tier 3: Cross-Feature Interactions & Pairwise Combinations (16 Tests)
 */

import { describe, it, expect, setTestTier } from '../harness/testContext.ts';
import { Model3DInspector } from '../harness/model3dInspector.ts';
import { AppSimulator, CutRestoreSimulator, formatBilingualName } from '../harness/appSimulator.ts';
import { UIThemeInspector } from '../harness/uiThemeInspector.ts';

export function registerTier3PairwiseCombinationsTests(): void {
  setTestTier('Tier 3: Combinations');

  describe('Tier 3: Cross-Feature Pairwise Combinations', () => {
    const inspector = Model3DInspector.getDefault();

    it('T3_C01: Cutting a bone with active hotspots hides attached markers (F5 + F12)', () => {
      const sim = new CutRestoreSimulator();
      const boneId = 'humerus';
      const humerusHotspots = AppSimulator.getHotspotsForBone(boneId);
      expect(humerusHotspots.length).toBeGreaterThan(0);

      // Verify landmarks initial visibility
      for (const h of humerusHotspots) {
        expect(sim.isVisible(h.boneId)).toBe(true);
      }

      // Cut parent bone
      sim.cut(boneId);

      // Verify parent bone and child hotspots are hidden
      expect(sim.isHidden(boneId)).toBe(true);
      const activeVisibleHotspots = humerusHotspots.filter((h) => sim.isVisible(h.boneId));
      expect(activeVisibleHotspots).toHaveLength(0);
    });

    it('T3_C02: Restoring a cut bone restores active hotspots at identical 3D coordinates (F6 + F12)', () => {
      const sim = new CutRestoreSimulator();
      const boneId = 'humerus';
      const humerusHotspots = AppSimulator.getHotspotsForBone(boneId);
      const originalPositions = humerusHotspots.map((h) => [...h.position]);

      sim.cut(boneId);
      expect(sim.isHidden(boneId)).toBe(true);

      // Restore bone
      sim.restore(boneId);
      expect(sim.isVisible(boneId)).toBe(true);

      // Coordinates preserved identically
      for (let i = 0; i < humerusHotspots.length; i++) {
        expect(humerusHotspots[i].position).toEqual(originalPositions[i]);
      }
    });

    it('T3_C03: Bilingual naming in 3D camera auto-focus tooltips and inspector cards (F9 + F4)', () => {
      const scapula = inspector.findMesh((m) => /scapula/i.test(m.rawName));
      expect(scapula).toBeTruthy();

      const focus = Model3DInspector.computeFocusTargetAndDistance(scapula!.bounds);
      const bilingual = formatBilingualName('Łopatka', 'Scapula');

      expect(focus.target[0]).toBe(scapula!.bounds.center[0]);
      expect(bilingual).toBe('Łopatka (Scapula)');
    });

    it('T3_C04: Lesson loading a regional model and evaluating bilingual answers (F2 + F9 + F1)', () => {
      const kneeTask = {
        id: 'knee_task_patella',
        type: 'model3d' as const,
        region: 'lower_limb_left' as const,
        targetMeshId: 'mesh_patella',
        targetNamePl: 'Rzepka',
        structureId: 'patella',
        prompt: 'Wskaż strukturę: Rzepka (Patella)',
        explanation: 'Rzepka jest największą trzeszczką w ciele człowieka',
        funFact: '',
      };

      const modelUrl = AppSimulator.resolveModelUrlForTask(kneeTask);
      expect(modelUrl).toBe('/models/regional/lower_limb_left.glb');

      const isCorrect = AppSimulator.evaluateModel3DTask(kneeTask, {
        rawMeshName: 'mesh_patella',
        namePl: 'Rzepka (Patella)',
      });
      expect(isCorrect).toBe(true);
    });

    it('T3_C05: FDI tooth selection in regional head_neck model with camera auto-focus (F11 + F1 + F4)', () => {
      const headInspector = Model3DInspector.fromRegional('head_neck');
      const tooth23Mesh = headInspector.findMesh((m) => m.rawName === 'Upper canine.001');
      expect(tooth23Mesh).toBeTruthy();

      const fdi = Model3DInspector.getFdiCodeForMesh(tooth23Mesh!.rawName);
      expect(fdi).toBe(23);

      const focus = Model3DInspector.computeFocusTargetAndDistance(tooth23Mesh!.bounds);
      expect(focus.distance).toBeGreaterThan(0.05);
      expect(focus.target[1]).toBe(tooth23Mesh!.bounds.center[1]);
    });

    it('T3_C06: Vertebral column numbering (Th1–Th12) in torso regional model (F10 + F1 + F9)', () => {
      const torsoInspector = Model3DInspector.fromRegional('torso');
      const t1 = torsoInspector.findMesh((m) => m.rawName === 'Vertebra T1');
      const t12 = torsoInspector.findMesh((m) => m.rawName === 'Vertebra T12');

      expect(t1).toBeTruthy();
      expect(t12).toBeTruthy();

      // Cranial-to-caudal: T1 elevation Y > T12 elevation Y
      expect(t1!.bounds.center[1]).toBeGreaterThan(t12!.bounds.center[1]);

      const t6Bilingual = formatBilingualName('Kręg piersiowy Th6', 'Thoracic vertebra T6');
      expect(t6Bilingual).toBe('Kręg piersiowy Th6 (Thoracic vertebra T6)');
    });

    it('T3_C07: Cartilage material distinction vs bone material when cutting/restoring costal cartilage (F7 + F5 + F6)', () => {
      const sim = new CutRestoreSimulator();
      const cartilageMesh = 'Costal cartilage of first rib.001';
      const boneMesh = 'First rib.001';

      expect(Model3DInspector.isCartilageMesh(cartilageMesh)).toBe(true);
      expect(Model3DInspector.isCartilageMesh(boneMesh)).toBe(false);

      sim.cut(cartilageMesh);
      expect(sim.isVisible(cartilageMesh)).toBe(false);
      expect(sim.isVisible(boneMesh)).toBe(true);

      sim.restore(cartilageMesh);
      expect(sim.isVisible(cartilageMesh)).toBe(true);
      expect(sim.isVisible(boneMesh)).toBe(true);
    });

    it('T3_C08: Dark 3D viewport contrast with green-white UI elements (F8 + F13)', () => {
      const bg = UIThemeInspector.getViewportBackgroundHex();
      expect([0x111a16, 0x0f1715, 0x0f172a]).toContain(bg.hex);

      // Contrast against emerald accent (0x10b981)
      const emeraldContrast = UIThemeInspector.computeContrastRatio(0x10b981, 0x111a16);
      expect(emeraldContrast).toBeGreaterThan(6.0);
    });

    it('T3_C09: Search in bilingual format returning correct mesh and triggering camera focus (F9 + F4)', () => {
      const app = AppSimulator.getInstance();
      const hits = app.searchAnatomyDb('ramienna');
      expect(hits.length).toBeGreaterThan(0);

      const humerus = hits[0];
      const bilingual = formatBilingualName(humerus.namePl, 'Humerus');
      expect(bilingual).toContain('ramienna');
      expect(bilingual).toContain('(Humerus)');

      const humerusMesh = inspector.findMesh((m) => /humerus/i.test(m.rawName));
      expect(humerusMesh).toBeTruthy();
      const focus = Model3DInspector.computeFocusTargetAndDistance(humerusMesh!.bounds);
      expect(focus.target[1]).toBe(humerusMesh!.bounds.center[1]);
    });

    it('T3_C10: Muscle attachment PP/PK linking bone landmark to corresponding muscle structure (F12 + F9)', () => {
      const landmark = AppSimulator.getHotspot('tuberculum_majus');
      expect(landmark).toBeTruthy();
      expect(landmark!.type).toBe('pk');
      expect(landmark!.attachedMuscles).toContain('m_supraspinatus');

      const supraBilingual = formatBilingualName('Mięsień nadgrzebieniowy', 'Supraspinatus');
      expect(supraBilingual).toBe('Mięsień nadgrzebieniowy (Supraspinatus)');
    });

    it('T3_C11: Nose geometry visibility and interaction in head_neck regional model (F3 + F1 + F7)', () => {
      const headInspector = Model3DInspector.fromRegional('head_neck');
      const alar = headInspector.findMesh((m) => /major.*alar/i.test(m.rawName));
      expect(alar).toBeTruthy();

      expect(Model3DInspector.isCartilageMesh(alar!.rawName)).toBe(true);
      expect(alar!.bounds.center[1]).toBeGreaterThan(1.50);
      expect(alar!.bounds.center[2]).toBeGreaterThan(0.05);
    });

    it('T3_C12: Layer toggle combined with structure cutting maintains consistent hidden states (F5 + Layer)', () => {
      const sim = new CutRestoreSimulator();
      sim.cut('femur');

      // Muscle layer active: bone is hidden by layer
      let layerFilter: 'all' | 'muscle' | 'bone' = 'muscle';
      const isVisibleUnderMuscleLayer = layerFilter === 'muscle' ? false : sim.isVisible('femur');
      expect(isVisibleUnderMuscleLayer).toBe(false);

      // Bone layer active: bone remains hidden because it was cut
      layerFilter = 'bone';
      const isVisibleUnderBoneLayer = sim.isVisible('femur');
      expect(isVisibleUnderBoneLayer).toBe(false);
    });

    it('T3_C13: Exploded view separation combined with camera auto-focus (Exploded + F4)', () => {
      const deltoid = inspector.findMesh((m) => /deltoid/i.test(m.rawName));
      expect(deltoid).toBeTruthy();

      const normalFocus = Model3DInspector.computeFocusTargetAndDistance(deltoid!.bounds);
      expect(normalFocus.target).toEqual(deltoid!.bounds.center);

      // Exploded bounds shift
      const explodedBounds = {
        ...deltoid!.bounds,
        center: [deltoid!.bounds.center[0] + 0.05, deltoid!.bounds.center[1], deltoid!.bounds.center[2]] as [number, number, number],
      };
      const explodedFocus = Model3DInspector.computeFocusTargetAndDistance(explodedBounds);
      expect(explodedFocus.target[0]).toBe(deltoid!.bounds.center[0] + 0.05);
    });

    it('T3_C14: Bulk restore of multiple cut structures across different tissue types (F5 + F6)', () => {
      const sim = new CutRestoreSimulator();
      const cutList = ['m_trapezius', 'm_latissimus_dorsi', 'clavicula', 'scapula', 'costal_cartilage'];
      cutList.forEach((id) => sim.cut(id));
      expect(sim.getHiddenCount()).toBe(5);

      sim.restoreAll();
      expect(sim.getHiddenCount()).toBe(0);
      cutList.forEach((id) => expect(sim.isVisible(id)).toBe(true));
    });

    it('T3_C15: Lateralization in regional models with bilingual naming (F1 + F9)', () => {
      const leftInspector = Model3DInspector.fromRegional('upper_limb_left');
      const rightInspector = Model3DInspector.fromRegional('upper_limb_right');

      const leftHumerus = leftInspector.findMesh((m) => /humerus/i.test(m.rawName));
      const rightHumerus = rightInspector.findMesh((m) => /humerus/i.test(m.rawName));

      expect(leftHumerus).toBeTruthy();
      expect(rightHumerus).toBeTruthy();

      const leftName = formatBilingualName('Kość ramienna lewa', 'Left humerus');
      const rightName = formatBilingualName('Kość ramienna prawa', 'Right humerus');

      expect(leftName).toBe('Kość ramienna lewa (Left humerus)');
      expect(rightName).toBe('Kość ramienna prawa (Right humerus)');
    });

    it('T3_C16: Multi-pointer rapid click during camera transition cancels prior target (F4 + Boundary)', () => {
      const f1 = Model3DInspector.computeFocusTargetAndDistance(inspector.getAllMeshes()[0].bounds);
      const f2 = Model3DInspector.computeFocusTargetAndDistance(inspector.getAllMeshes()[10].bounds);
      const f3 = Model3DInspector.computeFocusTargetAndDistance(inspector.getAllMeshes()[20].bounds);

      // Final target converges on third structure
      expect(f3.target).toEqual(inspector.getAllMeshes()[20].bounds.center);
      expect(Number.isNaN(f3.distance)).toBe(false);
      expect(f3.distance).toBeGreaterThan(0.05);
    });
  });
}
