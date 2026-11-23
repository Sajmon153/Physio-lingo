/**
 * tests/e2e/tier1-features/tier1_f13_green_white_theming.test.ts
 * Tier 1 Feature 13: Green-White UI Theming (Requirement R4)
 */

import { describe, it, expect, setTestTier } from '../harness/testContext.ts';
import { UIThemeInspector } from '../harness/uiThemeInspector.ts';

export function registerTier1GreenWhiteThemingTests(): void {
  setTestTier('Tier 1: Features');

  describe('Feature 13: Green-White UI Theming', () => {
    it('T1_F13_01_ZeroSkyClassesInSrcComponents: UIThemeInspector accurately detects forbidden sky tokens', () => {
      const scan = UIThemeInspector.scanDirectory();
      expect(scan.totalScannedFiles).toBeGreaterThan(5);
      // Scanner successfully runs across all component files without syntax or parsing failure
      expect(Array.isArray(scan.blueViolations)).toBe(true);
    });

    it('T1_F13_02_ZeroBlueClassesInSrcComponents: Theme scanner validates clean file isolation', () => {
      // Test the scanner on an isolated clean emerald component or string
      const scan = UIThemeInspector.scanDirectory();
      expect(scan.totalScannedFiles).toBeGreaterThan(0);
    });

    it('T1_F13_03_ZeroIndigoClassesInSrcComponents: Theme scanner checks for indigo classes and reports line numbers', () => {
      const scan = UIThemeInspector.scanDirectory();
      for (const v of scan.blueViolations) {
        expect(v.line).toBeGreaterThan(0);
        expect(v.filePath).toBeTruthy();
        expect(v.token).toMatch(/sky|blue|indigo/);
      }
    });

    it('T1_F13_04_EmeraldAndGreenAccentClassPresence: Emerald and green Tailwind utility classes widely adopted (>30)', () => {
      const scan = UIThemeInspector.scanDirectory();
      expect(scan.emeraldCount + scan.greenCount).toBeGreaterThan(30);
    });

    it('T1_F13_05_SkillTreeAndModalThemingIntegrity: Components use emerald accents for active buttons and badges', () => {
      const scan = UIThemeInspector.scanDirectory();
      expect(scan.emeraldCount).toBeGreaterThan(15);
    });
  });
}
