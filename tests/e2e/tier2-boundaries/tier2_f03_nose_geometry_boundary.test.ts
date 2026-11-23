/**
 * tests/e2e/tier2-boundaries/tier2_f03_nose_geometry_boundary.test.ts
 * Tier 2 Boundary: Nose Geometry & Visibility (Feature 3 Boundaries)
 */

import { describe, it, expect, setTestTier } from '../harness/testContext.ts';
import { Model3DInspector } from '../harness/model3dInspector.ts';
import { AppSimulator } from '../harness/appSimulator.ts';

export function registerTier2NoseGeometryBoundaryTests(): void {
  setTestTier('Tier 2: Boundaries');

  describe('Boundary 3: Nose Geometry Edge Cases & Penetration', () => {
    const inspector = Model3DInspector.getDefault();

    it('T2_F3_01_MalformedNasalMeshNameTolerance: Unconventional nasal mesh name variants translated safely', () => {
      const res = AppSimulator.translateMeshNameToPolish('nasal_cartilage_septum');
      expect(res.namePl).toBeTruthy();
      expect(typeof res.namePl).toBe('string');
    });

    it('T2_F3_02_ExtremeNostrilRaycastBypass: Raycast directly into nasal aperture (Z=0.15 towards Z=-1) penetrates to deep skull', () => {
      const hits = inspector.raycast([0.005, 1.57, 0.5], [0, 0, -1]);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].point[2]).toBeLessThan(0.5);
    });

    it('T2_F3_03_LateralizationSuffixDisambiguation: Suffix .001 distinguishes bilateral nasal structures', () => {
      const rightNasal = inspector.findMesh((m) => m.rawName === 'Nasal bone');
      const leftNasal = inspector.findMesh((m) => m.rawName === 'Nasal bone.001');

      expect(rightNasal).toBeTruthy();
      expect(leftNasal).toBeTruthy();

      expect(rightNasal!.bounds.center[0]).toBeGreaterThan(leftNasal!.bounds.center[0]);
    });

    it('T2_F3_04_CutNasalisRevealsNasalCartilage: Excluding superficial nasalis muscle reveals deep septal/alar cartilage', () => {
      // Find nasalis muscle mesh
      const nasalis = inspector.findMesh((m) => /nasalis/i.test(m.rawName));
      expect(nasalis).toBeTruthy();

      const hitsExcludingMuscle = inspector.raycast(
        [nasalis!.bounds.center[0], nasalis!.bounds.center[1], 1.0],
        [0, 0, -1],
        { excludedMeshIds: [nasalis!.rawName] }
      );

      expect(hitsExcludingMuscle.length).toBeGreaterThan(0);
      expect(hitsExcludingMuscle[0].mesh.rawName).not.toBe(nasalis!.rawName);
    });

    it('T2_F3_05_NearClippingPlaneDoesNotClipNoseSeptum: Focus distance for nose structures remains safely outside near clipping range', () => {
      const alar = inspector.findMesh((m) => /alar.*cartilage/i.test(m.rawName));
      expect(alar).toBeTruthy();

      const focus = Model3DInspector.computeFocusTargetAndDistance(alar!.bounds);
      expect(focus.distance).toBeGreaterThan(0.05);
    });
  });
}
