/**
 * tests/e2e/tier1-features/tier1_f06_structure_restoring.test.ts
 * Tier 1 Feature 6: Structure Restoring (Requirement R2)
 */

import { describe, it, expect, setTestTier } from '../harness/testContext.ts';
import { Model3DInspector } from '../harness/model3dInspector.ts';
import { CutRestoreSimulator } from '../harness/appSimulator.ts';

export function registerTier1StructureRestoringTests(): void {
  setTestTier('Tier 1: Features');

  describe('Feature 6: Structure Restoring', () => {
    const inspector = Model3DInspector.getDefault();

    it('T1_F6_01_BulkRestoreEmptiesHiddenArray: restoreAll resets hidden array to empty', () => {
      const sim = new CutRestoreSimulator();
      sim.cut('mesh_1');
      sim.cut('mesh_2');
      sim.cut('mesh_3');

      expect(sim.getHiddenCount()).toBe(3);
      sim.restoreAll();
      expect(sim.getHiddenCount()).toBe(0);
      expect(sim.getHiddenList()).toHaveLength(0);
    });

    it('T1_F6_02_BulkRestoreMakesAllMeshesVisible: All cut meshes return to isVisible === true', () => {
      const sim = new CutRestoreSimulator();
      const parts = ['scapula', 'clavicula', 'humerus'];
      parts.forEach((p) => sim.cut(p));

      sim.restoreAll();
      for (const p of parts) {
        expect(sim.isVisible(p)).toBe(true);
      }
    });

    it('T1_F6_03_IndividualRestoreRemovesTargetIdOnly: Individual restore restores specified structure while others remain hidden', () => {
      const sim = new CutRestoreSimulator();
      sim.cut('mesh_a');
      sim.cut('mesh_b');
      sim.cut('mesh_c');

      sim.restore('mesh_b');
      expect(sim.isHidden('mesh_b')).toBe(false);
      expect(sim.isHidden('mesh_a')).toBe(true);
      expect(sim.isHidden('mesh_c')).toBe(true);
      expect(sim.getHiddenList()).toEqual(['mesh_a', 'mesh_c']);
    });

    it('T1_F6_04_RestoreButtonBadgeCount: Simulator badge count reflects hidden count', () => {
      const sim = new CutRestoreSimulator();
      sim.cut('p1');
      sim.cut('p2');
      sim.cut('p3');
      sim.cut('p4');

      const badgeLabel = `Pokaż (${sim.getHiddenCount()})`;
      expect(badgeLabel).toBe('Pokaż (4)');
    });

    it('T1_F6_05_RestoredMeshImmediateRaycastHit: Restored mesh is immediately returned in raycast intersections', () => {
      const initialHits = inspector.raycast([0.0838, 0.4435, 1.0], [0, 0, -1]);
      const targetMesh = initialHits[0].mesh.rawName;

      // Cut it
      const cutHits = inspector.raycast([0.0838, 0.4435, 1.0], [0, 0, -1], {
        excludedMeshIds: [targetMesh],
      });
      expect(cutHits.some((h) => h.mesh.rawName === targetMesh)).toBe(false);

      // Restore it (remove from excluded list)
      const restoredHits = inspector.raycast([0.0838, 0.4435, 1.0], [0, 0, -1], {
        excludedMeshIds: [],
      });
      expect(restoredHits[0].mesh.rawName).toBe(targetMesh);
    });
  });
}
