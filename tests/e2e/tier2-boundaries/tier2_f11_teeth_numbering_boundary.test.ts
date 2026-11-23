/**
 * tests/e2e/tier2-boundaries/tier2_f11_teeth_numbering_boundary.test.ts
 * Tier 2 Boundary: Teeth Numbering (Feature 11 Boundaries)
 */

import { describe, it, expect, setTestTier } from '../harness/testContext.ts';
import { Model3DInspector } from '../harness/model3dInspector.ts';

export function registerTier2TeethNumberingBoundaryTests(): void {
  setTestTier('Tier 2: Boundaries');

  describe('Boundary 11: Teeth FDI Numbering & Arch Disambiguation', () => {
    const inspector = Model3DInspector.getDefault();

    it('T2_F11_01_OutOfRangeFDIQuerySafelyUndefined: Non-dental mesh name returns undefined from getFdiCodeForMesh', () => {
      expect(Model3DInspector.getFdiCodeForMesh('Humerus')).toBeUndefined();
      expect(Model3DInspector.getFdiCodeForMesh('Patella')).toBeUndefined();
      expect(Model3DInspector.getFdiCodeForMesh('')).toBeUndefined();
    });

    it('T2_F11_02_ToothSubMeshesAssociation: Crown and root dental descriptors categorized under bone', () => {
      const teeth = inspector.getTeethMeshes();
      for (const t of teeth) {
        expect(t.category).toBe('bone');
      }
    });

    it('T2_F11_03_SearchByFdiKeyword: getFdiCodeForMesh returns valid two-digit FDI code for canine and incisor variants', () => {
      expect(Model3DInspector.getFdiCodeForMesh('Upper canine')).toBe(13);
      expect(Model3DInspector.getFdiCodeForMesh('Upper canine.001')).toBe(23);
      expect(Model3DInspector.getFdiCodeForMesh('Lower canine.001')).toBe(33);
      expect(Model3DInspector.getFdiCodeForMesh('Lower canine')).toBe(43);
    });

    it('T2_F11_04_BilateralToothMeshDisambiguation: Right tooth vs left tooth (.001) resolve to distinct quadrants', () => {
      const fdiRight = Model3DInspector.getFdiCodeForMesh('Upper first molar tooth');
      const fdiLeft = Model3DInspector.getFdiCodeForMesh('Upper first molar tooth.001');

      expect(fdiRight).toBe(16);
      expect(fdiLeft).toBe(26);
      expect(fdiRight).not.toBe(fdiLeft);
    });

    it('T2_F11_05_MaxillaryVsMandibularArchSeparation: Maxillary teeth have higher vertical Y elevation than mandibular teeth', () => {
      const teeth = inspector.getTeethMeshes();
      const upperTeeth = teeth.filter((t) => t.fdiNumber < 30);
      const lowerTeeth = teeth.filter((t) => t.fdiNumber >= 30);

      expect(upperTeeth.length).toBe(14);
      expect(lowerTeeth.length).toBe(14);

      const avgUpperY = upperTeeth.reduce((acc, t) => acc + t.bounds.center[1], 0) / upperTeeth.length;
      const avgLowerY = lowerTeeth.reduce((acc, t) => acc + t.bounds.center[1], 0) / lowerTeeth.length;

      expect(avgUpperY).toBeGreaterThan(avgLowerY);
    });
  });
}
