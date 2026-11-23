/**
 * tests/e2e/tier1-features/tier1_f03_nose_geometry.test.ts
 * Tier 1 Feature 3: Nose Geometry & Visibility (Requirement R1)
 */

import { describe, it, expect, setTestTier } from '../harness/testContext.ts';
import { Model3DInspector } from '../harness/model3dInspector.ts';
import { AppSimulator, formatBilingualName } from '../harness/appSimulator.ts';

export function registerTier1NoseGeometryTests(): void {
  setTestTier('Tier 1: Features');

  describe('Feature 3: Nose Geometry & Visibility', () => {
    const inspector = Model3DInspector.getDefault();

    it('T1_F3_01_NasalBonesBilingualTranslation: Nasal bone translates to Polish Kość nosowa in bone category', () => {
      const res = AppSimulator.translateMeshNameToPolish('Nasal bone');
      const bName = formatBilingualName(res.namePl, 'Nasal bone');
      expect(bName).toContain('Kość nosowa');
      expect(bName).toContain('(Nasal bone)');
      expect(res.category).toBe('bone');
    });

    it('T1_F3_02_NasalSeptalCartilageIdentification: Nasal septal cartilage detected as cartilage tissue', () => {
      const isCart = Model3DInspector.isCartilageMesh('Nasal septal cartilage');
      expect(isCart).toBe(true);

      const bName = formatBilingualName('Chrząstka przegrody nosa', 'Nasal septal cartilage');
      expect(bName).toBe('Chrząstka przegrody nosa (Nasal septal cartilage)');
    });

    it('T1_F3_03_MajorAlarCartilageIdentification: Major alar cartilage detected as cartilage tissue', () => {
      const isCart = Model3DInspector.isCartilageMesh('Major alar cartilage.001');
      expect(isCart).toBe(true);

      const bName = formatBilingualName('Chrząstka skrzydłowa większa', 'Major alar cartilage');
      expect(bName).toBe('Chrząstka skrzydłowa większa (Major alar cartilage)');
    });

    it('T1_F3_04_NasalisMuscleIdentification: Nasalis muscle categorized as muscle', () => {
      const res = AppSimulator.translateMeshNameToPolish('Nasalis muscle');
      expect(res.category).toBe('muscle');
      const bName = formatBilingualName('Mięsień nosowy', 'Nasalis muscle');
      expect(bName).toContain('nosowy');
      expect(bName).toContain('(Nasalis muscle)');
    });

    it('T1_F3_05_NoseSpatialCoordinatesValidation: Nose structures lie anterior (Z>0.05m) and at craniofacial elevation (Y>1.50m)', () => {
      const noseMeshes = inspector.getNoseMeshes();
      expect(noseMeshes.length).toBeGreaterThan(0, 'body.glb must contain discrete nose meshes');

      for (const m of noseMeshes) {
        // Facial elevation
        expect(m.bounds.center[1]).toBeGreaterThan(1.50, `Mesh ${m.rawName} must be at head elevation (Y > 1.50m)`);
        // Anterior to cervical spine / coronal midline
        expect(m.bounds.center[2]).toBeGreaterThan(0.04, `Mesh ${m.rawName} must project anteriorly (Z > 0.04m)`);
        // Symmetrical along midline
        expect(Math.abs(m.bounds.center[0])).toBeLessThan(0.05, `Mesh ${m.rawName} must be centered near sagittal midline`);
      }
    });
  });
}
