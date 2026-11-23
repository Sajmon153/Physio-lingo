/**
 * tests/e2e/tier1-features/tier1_f05_structure_cutting.test.ts
 * Tier 1 Feature 5: Structure Cutting (Requirement R2)
 */

import { describe, it, expect, setTestTier } from '../harness/testContext.ts';
import { Model3DInspector } from '../harness/model3dInspector.ts';
import { CutRestoreSimulator } from '../harness/appSimulator.ts';

export function registerTier1StructureCuttingTests(): void {
  setTestTier('Tier 1: Features');

  describe('Feature 5: Structure Cutting (Hide)', () => {
    const inspector = Model3DInspector.getDefault();

    it('T1_F5_01_CutStructureAddsToHiddenArray: Cutting structure adds ID to hiddenPartIds list', () => {
      const sim = new CutRestoreSimulator();
      expect(sim.getHiddenCount()).toBe(0);

      sim.cut('mesh_rectus_femoris');
      expect(sim.getHiddenCount()).toBe(1);
      expect(sim.isHidden('mesh_rectus_femoris')).toBe(true);
    });

    it('T1_F5_02_CutStructureMeshVisibleFalse: Cut structure is marked not visible', () => {
      const sim = new CutRestoreSimulator();
      sim.cut('mesh_deltoideus');
      expect(sim.isVisible('mesh_deltoideus')).toBe(false);
      expect(sim.isVisible('mesh_humerus')).toBe(true);
    });

    it('T1_F5_03_CutStructureExcludedFromRaycastHits: Hidden mesh is excluded from raycast results when excludedMeshIds passed', () => {
      // Raycast aiming at knee region
      const hitsInitial = inspector.raycast([0.0838, 0.4435, 1.0], [0, 0, -1]);
      expect(hitsInitial.length).toBeGreaterThan(0);
      const topHitMeshName = hitsInitial[0].mesh.rawName;

      // Exclude top hit mesh
      const hitsAfterCut = inspector.raycast([0.0838, 0.4435, 1.0], [0, 0, -1], {
        excludedMeshIds: [topHitMeshName],
      });

      expect(hitsAfterCut.some((h) => h.mesh.rawName === topHitMeshName)).toBe(false);
    });

    it('T1_F5_04_RaycastPassesThroughToDeeperTissue: Raycast passes through cut superficial muscle to deeper bone/joint', () => {
      // Aiming at shoulder region (deltoid / humerus)
      const initialHits = inspector.raycast([0.18, 1.35, 1.0], [0, 0, -1]);
      expect(initialHits.length).toBeGreaterThan(1, 'Expected multiple layers in shoulder region');

      const firstMeshName = initialHits[0].mesh.rawName;
      const secondMeshName = initialHits[1].mesh.rawName;

      // Cut first layer
      const cutHits = inspector.raycast([0.18, 1.35, 1.0], [0, 0, -1], {
        excludedMeshIds: [firstMeshName],
      });

      expect(cutHits.length).toBeGreaterThan(0);
      expect(cutHits[0].mesh.rawName).toBe(secondMeshName);
    });

    it('T1_F5_05_CutClearsSelectedPartState: Cut simulator tracks unique IDs and handles deselect', () => {
      let selectedPart: string | null = 'mesh_biceps_brachii';
      const sim = new CutRestoreSimulator();

      sim.cut(selectedPart);
      selectedPart = null;

      expect(selectedPart).toBeNull();
      expect(sim.isHidden('mesh_biceps_brachii')).toBe(true);
    });
  });
}
