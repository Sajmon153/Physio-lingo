/**
 * tests/e2e/tier1-features/tier1_f10_vertebrae_numbering.test.ts
 * Tier 1 Feature 10: Vertebral Column Numbering (Requirement R3)
 */

import { describe, it, expect, setTestTier } from '../harness/testContext.ts';
import { Model3DInspector } from '../harness/model3dInspector.ts';
import { formatBilingualName } from '../harness/appSimulator.ts';

export function registerTier1VertebraeNumberingTests(): void {
  setTestTier('Tier 1: Features');

  describe('Feature 10: Vertebral Column Numbering', () => {
    const inspector = Model3DInspector.getDefault();

    it('T1_F10_01_CervicalVertebraeC1ToC7Resolution: Cervical vertebrae C1–C7 are present in model and resolve to respective levels', () => {
      const vertebrae = inspector.getVertebraeMeshes();
      const levels = vertebrae.map((v) => v.level);

      expect(levels).toContain('C1');
      expect(levels).toContain('C2');
      for (let i = 3; i <= 7; i++) {
        expect(levels).toContain(`C${i}`);
      }

      const c1Bilingual = formatBilingualName('Kręg szczytowy C1 (Atlas)', 'Atlas (C1)');
      expect(c1Bilingual).toContain('C1');
    });

    it('T1_F10_02_ThoracicVertebraeTh1ToTh12Resolution: Thoracic vertebrae map to Polish clinical designation Th1–Th12', () => {
      const vertebrae = inspector.getVertebraeMeshes();
      const levels = vertebrae.map((v) => v.level);

      for (let i = 1; i <= 12; i++) {
        expect(levels).toContain(`Th${i}`);
        const bilingual = formatBilingualName(`Kręg piersiowy Th${i}`, `Thoracic vertebra T${i}`);
        expect(bilingual).toContain(`Th${i}`);
        expect(bilingual).toContain(`T${i}`);
      }
    });

    it('T1_F10_03_LumbarVertebraeL1ToL5Resolution: Lumbar vertebrae map to levels L1–L5', () => {
      const vertebrae = inspector.getVertebraeMeshes();
      const levels = vertebrae.map((v) => v.level);

      for (let i = 1; i <= 5; i++) {
        expect(levels).toContain(`L${i}`);
        const bilingual = formatBilingualName(`Kręg lędźwiowy L${i}`, `Lumbar vertebra L${i}`);
        expect(bilingual).toContain(`L${i}`);
      }
    });

    it('T1_F10_04_SacrumAndCoccyxResolution: Sacrum and Coccyx resolve to Polish and English bilingual names', () => {
      const vertebrae = inspector.getVertebraeMeshes();
      const levels = vertebrae.map((v) => v.level);

      expect(levels).toContain('Sacrum');
      expect(levels).toContain('Coccyx');

      const sacrumBilingual = formatBilingualName('Kość krzyżowa', 'Sacrum');
      const coccyxBilingual = formatBilingualName('Kość guziczna', 'Coccyx');

      expect(sacrumBilingual).toBe('Kość krzyżowa (Sacrum)');
      expect(coccyxBilingual).toBe('Kość guziczna (Coccyx)');
    });

    it('T1_F10_05_VertebraeRaycastHitsSpecificLevel: Raycast aimed at posterior thoracic spine intersects discrete vertebra level', () => {
      // Raycast from posterior (Z = -1.0) directed anteriorly (Z = +1) at thoracic height (Y ≈ 1.35)
      const hits = inspector.raycast([0, 1.35, -1.0], [0, 0, 1]);
      expect(hits.length).toBeGreaterThan(0, 'Raycast should hit posterior spine');

      const spineHit = hits.find((h) => /vertebra/i.test(h.mesh.rawName));
      expect(spineHit).toBeTruthy('Raycast hit must be a vertebra mesh');
      expect(spineHit!.mesh.rawName).toMatch(/Vertebra\s+[TL]\d+/i);
    });
  });
}
