/**
 * tests/e2e/tier1-features/tier1_f02_lesson_regional_loading.test.ts
 * Tier 1 Feature 2: Lesson Regional Loading (Requirement R1)
 */

import { describe, it, expect, setTestTier } from '../harness/testContext.ts';
import { AppSimulator } from '../harness/appSimulator.ts';
import { Model3DInspector, REGIONAL_MODEL_PATHS } from '../harness/model3dInspector.ts';

export function registerTier1LessonRegionalLoadingTests(): void {
  setTestTier('Tier 1: Features');

  describe('Feature 2: Lesson Regional Loading', () => {
    it('T1_F2_01_RegionalPathsMapContract: REGIONAL_MODEL_PATHS maps all 6 regional keys and full_body to valid paths', () => {
      const expectedKeys = [
        'head_neck',
        'upper_limb_left',
        'upper_limb_right',
        'lower_limb_left',
        'lower_limb_right',
        'torso',
        'full_body',
      ];

      for (const k of expectedKeys) {
        expect(REGIONAL_MODEL_PATHS[k]).toBeTruthy(`Key ${k} must exist in REGIONAL_MODEL_PATHS`);
        expect(REGIONAL_MODEL_PATHS[k].startsWith('/models/')).toBe(true);
        expect(REGIONAL_MODEL_PATHS[k].endsWith('.glb')).toBe(true);
      }
    });

    it('T1_F2_02_LessonTaskRegionModelResolution: resolveModelUrlForTask resolves regional task to correct GLB path', () => {
      const headTask = { id: 'task_head', type: 'model3d', region: 'head_neck' };
      const torsoTask = { id: 'task_torso', type: 'model3d', region: 'torso' };
      const fullTask = { id: 'task_full', type: 'model3d', region: 'full_body' };

      expect(AppSimulator.resolveModelUrlForTask(headTask)).toBe('/models/regional/head_neck.glb');
      expect(AppSimulator.resolveModelUrlForTask(torsoTask)).toBe('/models/regional/torso.glb');
      expect(AppSimulator.resolveModelUrlForTask(fullTask)).toBe('/models/body.glb');
    });

    it('T1_F2_03_LessonTaskTargetMeshPresenceInRegionalModel: Regional model contains target mesh for head_neck task', () => {
      const headInspector = Model3DInspector.fromRegional('head_neck');
      const nasalMesh = headInspector.findMesh((m) => /nasal|mandib|cranium/i.test(m.rawName));
      expect(nasalMesh).toBeTruthy('head_neck model must contain cranial or facial target mesh');
    });

    it('T1_F2_04_LowerLimbTaskLoadsRegionalLimbModel: Lower limb task targets mesh found within lower limb model', () => {
      const lowerInspector = Model3DInspector.fromRegional('lower_limb');
      const patellaMesh = lowerInspector.findMesh((m) => /patella|femur|tibia/i.test(m.rawName));
      expect(patellaMesh).toBeTruthy('lower_limb model must contain patella or knee structures');
    });

    it('T1_F2_05_Curriculum3DTasksAllHaveResolvableRegionalModels: 100% of curriculum 3D tasks specify valid region', () => {
      const app = AppSimulator.getInstance();
      let count3dTasks = 0;

      for (const tasks of Object.values(app.lessonTaskBanks)) {
        for (const t of tasks) {
          if (t.type === 'model3d') {
            count3dTasks++;
            const resolved = AppSimulator.resolveModelUrlForTask(t);
            expect(resolved).toBeTruthy(`Task ${t.id} must resolve to a valid model URL`);
            expect(resolved.endsWith('.glb')).toBe(true);
          }
        }
      }

      expect(count3dTasks).toBeGreaterThan(0, 'Curriculum must contain 3D model pinpointing tasks');
    });
  });
}
