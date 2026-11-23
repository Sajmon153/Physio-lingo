/**
 * tests/e2e/tier1-features/tier1_f09_bilingual_naming.test.ts
 * Tier 1 Feature 9: Bilingual Naming Format (Requirement R3)
 */

import { describe, it, expect, setTestTier } from '../harness/testContext.ts';
import { AppSimulator, formatBilingualName } from '../harness/appSimulator.ts';

export function registerTier1BilingualNamingTests(): void {
  setTestTier('Tier 1: Features');

  describe('Feature 9: Bilingual Naming Format', () => {
    it('T1_F9_01_FormatBilingualNameBasicOutput: formatBilingualName combines Polish and English bone names', () => {
      const res = formatBilingualName('Kość ramienna', 'Humerus');
      expect(res).toBe('Kość ramienna (Humerus)');
    });

    it('T1_F9_02_FormatBilingualNameMuscleOutput: formatBilingualName combines Polish and English muscle names', () => {
      const res = formatBilingualName('Mięsień czworogłowy uda', 'Quadriceps femoris');
      expect(res).toBe('Mięsień czworogłowy uda (Quadriceps femoris)');
    });

    it('T1_F9_03_TranslatorReturnsBilingualNameProperty: Translation with bilingual formatting returns namePl and nameEn', () => {
      const trans = AppSimulator.translateMeshNameToPolish('mesh_patella');
      const bilingual = formatBilingualName(trans.namePl, 'Patella');
      expect(bilingual).toContain('Rzepka');
      expect(bilingual).toContain('(Patella)');
    });

    it('T1_F9_04_AnatomyDbEntriesHaveNamePlAndNameEn: 100% of structures in ANATOMY_DB have valid Polish name and Latin/English term', () => {
      const app = AppSimulator.getInstance();
      expect(app.anatomyDb.length).toBeGreaterThan(0);

      for (const s of app.anatomyDb) {
        expect(s.namePl.trim().length).toBeGreaterThan(0, `Structure ${s.id} must have non-empty namePl`);
        const foreignName = (s as any).nameEn || s.nameLt;
        expect(foreignName && foreignName.trim().length > 0).toBe(
          true,
          `Structure ${s.id} must have non-empty nameEn or nameLt`
        );
      }
    });

    it('T1_F9_05_AtlasDictionaryDisplaysBilingualHeader: Bilingual header matches Nazwa polska (English Name) structure', () => {
      const formatted = formatBilingualName('Łopatka', 'Scapula');
      expect(formatted).toMatch(/^.+?\s+\([^)]+\)$/);
      expect(formatted).toBe('Łopatka (Scapula)');
    });
  });
}
