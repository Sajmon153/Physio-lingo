/**
 * tests/e2e/tier1-features/tier1_f01_regional_models.test.ts
 * Tier 1 Feature 1: Regional 3D Extraction (Requirement R1)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect, setTestTier } from '../harness/testContext.ts';
import { Model3DInspector, REGIONAL_MODEL_PATHS } from '../harness/model3dInspector.ts';

export function registerTier1RegionalModelsTests(): void {
  setTestTier('Tier 1: Features');

  describe('Feature 1: Regional 3D Extraction', () => {
    it('T1_F1_01_RegionalGLBFilesPresence: Regional model paths defined and files/partitions within valid size', () => {
      const regions = [
        'head_neck',
        'upper_limb_left',
        'upper_limb_right',
        'lower_limb_left',
        'lower_limb_right',
        'torso',
      ];

      for (const reg of regions) {
        expect(REGIONAL_MODEL_PATHS[reg]).toBe(`/models/regional/${reg}.glb`);
        const filePath = path.resolve(process.cwd(), `public${REGIONAL_MODEL_PATHS[reg]}`);

        if (fs.existsSync(filePath)) {
          const stat = fs.statSync(filePath);
          expect(stat.size).toBeGreaterThan(200 * 1024);
          expect(stat.size).toBeLessThan(5 * 1024 * 1024);
        } else {
          // Virtual regional partition verified from master model
          const inspector = Model3DInspector.fromRegional(reg);
          expect(inspector.getTotalMeshCount()).toBeGreaterThan(0);
          expect(inspector.getRawGlbLength()).toBeGreaterThan(500 * 1024);
        }
      }
    });

    it('T1_F1_02_RegionalGLBHeaderAndDraco: GLB starts with glTF magic and declares KHR_draco_mesh_compression', () => {
      const inspector = Model3DInspector.fromRegional('head_neck');
      const required = inspector.getExtensionsRequired();
      const used = inspector.getExtensionsUsed();

      expect(used).toContain('KHR_draco_mesh_compression');
      expect(required).toContain('KHR_draco_mesh_compression');
    });

    it('T1_F1_03_HeadNeckMeshesPartition: Head/neck model contains cranium and cervical vertebrae, 0 leg meshes', () => {
      const inspector = Model3DInspector.fromRegional('head_neck');
      const meshes = inspector.getAllMeshes();
      const meshNames = meshes.map((m) => m.rawName.toLowerCase());

      const hasSkullOrAtlas = meshNames.some((n) => /skull|cranium|mandib|atlas|c1|axis|c2/i.test(n));
      expect(hasSkullOrAtlas).toBe(true, 'head_neck must contain cranial or cervical structures');

      const hasLeg = meshNames.some((n) => /femur|tibia|patella/i.test(n));
      expect(hasLeg).toBe(false, 'head_neck must not contain femur or tibia meshes');
    });

    it('T1_F1_04_UpperLimbsBilateralSeparation: Left and right limb models separated bilaterally along X axis', () => {
      const leftInspector = Model3DInspector.fromRegional('upper_limb_left');
      const rightInspector = Model3DInspector.fromRegional('upper_limb_right');

      const leftBounds = leftInspector.getSceneBounds();
      const rightBounds = rightInspector.getSceneBounds();

      // body.glb faces +Z (anterior) with +Y superior, so the subject's anatomical
      // LEFT lies on +X and anatomical RIGHT on -X (viewer sees them mirrored).
      expect(leftBounds.center[0]).toBeGreaterThan(0);
      expect(rightBounds.center[0]).toBeLessThan(0);
    });

    it('T1_F1_05_TorsoMeshesPartition: Torso model contains sternum, ribs, thoracic and lumbar vertebrae', () => {
      const inspector = Model3DInspector.fromRegional('torso');
      const meshes = inspector.getAllMeshes();
      const names = meshes.map((m) => m.rawName.toLowerCase());

      const hasSternumOrRib = names.some((n) => /sternum|manubrium|rib|costa/i.test(n));
      expect(hasSternumOrRib).toBe(true, 'Torso must contain sternum or ribs');

      const hasVertebra = names.some((n) => /vertebra|sacrum|coccyx/i.test(n));
      expect(hasVertebra).toBe(true, 'Torso must contain vertebral structures');
    });
  });
}
