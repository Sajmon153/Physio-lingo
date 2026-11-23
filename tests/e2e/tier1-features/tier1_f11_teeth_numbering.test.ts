/**
 * tests/e2e/tier1-features/tier1_f11_teeth_numbering.test.ts
 * Tier 1 Feature 11: Teeth Numbering (FDI Standard) (Requirement R3)
 */

import { describe, it, expect, setTestTier } from '../harness/testContext.ts';
import { Model3DInspector } from '../harness/model3dInspector.ts';

export function registerTier1TeethNumberingTests(): void {
  setTestTier('Tier 1: Features');

  describe('Feature 11: Teeth Numbering (FDI Standard)', () => {
    const inspector = Model3DInspector.getDefault();

    it('T1_F11_01_Quadrant1FDI11To17Mapping: Upper right dental meshes map to FDI codes 11–17', () => {
      const teeth = inspector.getTeethMeshes();
      const q1 = teeth.filter((t) => t.fdiNumber >= 11 && t.fdiNumber <= 17);
      expect(q1.length).toBe(7, 'Quadrant 1 must contain exactly 7 permanent teeth (11–17)');
      for (let i = 1; i <= 7; i++) {
        expect(q1.some((t) => t.fdiNumber === 10 + i)).toBe(true);
      }
    });

    it('T1_F11_02_Quadrant2FDI21To27Mapping: Upper left dental meshes map to FDI codes 21–27', () => {
      const teeth = inspector.getTeethMeshes();
      const q2 = teeth.filter((t) => t.fdiNumber >= 21 && t.fdiNumber <= 27);
      expect(q2.length).toBe(7, 'Quadrant 2 must contain exactly 7 permanent teeth (21–27)');
      for (let i = 1; i <= 7; i++) {
        expect(q2.some((t) => t.fdiNumber === 20 + i)).toBe(true);
      }
    });

    it('T1_F11_03_Quadrant3FDI31To37Mapping: Lower left dental meshes map to FDI codes 31–37', () => {
      const teeth = inspector.getTeethMeshes();
      const q3 = teeth.filter((t) => t.fdiNumber >= 31 && t.fdiNumber <= 37);
      expect(q3.length).toBe(7, 'Quadrant 3 must contain exactly 7 permanent teeth (31–37)');
      for (let i = 1; i <= 7; i++) {
        expect(q3.some((t) => t.fdiNumber === 30 + i)).toBe(true);
      }
    });

    it('T1_F11_04_Quadrant4FDI41To47Mapping: Lower right dental meshes map to FDI codes 41–47', () => {
      const teeth = inspector.getTeethMeshes();
      const q4 = teeth.filter((t) => t.fdiNumber >= 41 && t.fdiNumber <= 47);
      expect(q4.length).toBe(7, 'Quadrant 4 must contain exactly 7 permanent teeth (41–47)');
      for (let i = 1; i <= 7; i++) {
        expect(q4.some((t) => t.fdiNumber === 40 + i)).toBe(true);
      }
    });

    it('T1_F11_05_Total28DiscreteTeethMeshesMapped: Model contains exactly 28 discrete permanent teeth mapped to FDI standard', () => {
      const teeth = inspector.getTeethMeshes();
      expect(teeth.length).toBe(28, 'Must map exactly 28 teeth (FDI 11–47)');

      // Verify all teeth coordinates lie at maxillary/mandibular elevation (Y ≈ 1.50 - 1.58m)
      for (const t of teeth) {
        expect(t.bounds.center[1]).toBeGreaterThan(1.48);
        expect(t.bounds.center[1]).toBeLessThan(1.60);
      }
    });
  });
}
