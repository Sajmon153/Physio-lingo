/**
 * tests/e2e/tier1-features/tier1_f07_cartilage_materials.test.ts
 * Tier 1 Feature 7: Cartilage Material Distinction (Requirement R4)
 */

import { describe, it, expect, setTestTier } from '../harness/testContext.ts';
import { Model3DInspector } from '../harness/model3dInspector.ts';

export function registerTier1CartilageMaterialsTests(): void {
  setTestTier('Tier 1: Features');

  describe('Feature 7: Cartilage Material Distinction', () => {
    it('T1_F7_01_CartilageMeshPhysicalMaterialInstance: Cartilage material is designated as MeshPhysicalMaterial with transmission', () => {
      const cartMat = Model3DInspector.getCartilageMaterialProperties();
      expect(cartMat.isPhysical).toBe(true);
      expect(cartMat.transmission).toBeGreaterThan(0.2);
    });

    it('T1_F7_02_BoneMeshStandardMaterialInstance: Bone material is designated as MeshStandardMaterial', () => {
      const boneMat = Model3DInspector.getBoneMaterialProperties();
      expect(boneMat.isStandard).toBe(true);
    });

    it('T1_F7_03_CartilageRoughnessSignificantlyLowerThanBone: Cartilage roughness (<=0.30) is lower than bone (>=0.65)', () => {
      const cartMat = Model3DInspector.getCartilageMaterialProperties();
      const boneMat = Model3DInspector.getBoneMaterialProperties();

      expect(cartMat.roughness).toBeLessThanOrEqual(0.30);
      expect(boneMat.roughness).toBeGreaterThanOrEqual(0.65);
      expect(boneMat.roughness - cartMat.roughness).toBeGreaterThan(0.35);
    });

    it('T1_F7_04_CartilagePearlyCyanColorHue: Cartilage color exhibits cyan/pearly hue with dominant blue/green components', () => {
      const cartMat = Model3DInspector.getCartilageMaterialProperties();
      const hex = cartMat.color;

      const r = (hex >> 16) & 255;
      const g = (hex >> 8) & 255;
      const b = hex & 255;

      // Cyan / pearly: blue and green are both greater than red
      expect(g).toBeGreaterThan(r);
      expect(b).toBeGreaterThan(r);
    });

    it('T1_F7_05_TranslatorSetsIsCartilageFlag: Costal cartilage identified as cartilage tissue', () => {
      expect(Model3DInspector.isCartilageMesh('Costal cartilage of first rib.001')).toBe(true);
      expect(Model3DInspector.isCartilageMesh('Nasal septal cartilage')).toBe(true);
      expect(Model3DInspector.isCartilageMesh('Major alar cartilage')).toBe(true);
      expect(Model3DInspector.isCartilageMesh('Femur')).toBe(false);
      expect(Model3DInspector.isCartilageMesh('Humerus.002')).toBe(false);
    });
  });
}
