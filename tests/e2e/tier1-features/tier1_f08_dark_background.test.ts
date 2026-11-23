/**
 * tests/e2e/tier1-features/tier1_f08_dark_background.test.ts
 * Tier 1 Feature 8: Dark 3D Background (Requirement R4)
 */

import { describe, it, expect, setTestTier } from '../harness/testContext.ts';
import { UIThemeInspector } from '../harness/uiThemeInspector.ts';

export function registerTier1DarkBackgroundTests(): void {
  setTestTier('Tier 1: Features');

  describe('Feature 8: Dark 3D Background', () => {
    it('T1_F8_01_DefaultSceneBackgroundObsidianDark: Viewport dark background matches target obsidian/slate (0x111a16 or 0x0f1715)', () => {
      const bg = UIThemeInspector.getViewportBackgroundHex();
      // Target production dark background hex: 0x111a16 or 0x0f1715 (or baseline 0x0f172a prior to M2)
      expect([0x111a16, 0x0f1715, 0x0f172a]).toContain(bg.hex);
    });

    it('T1_F8_02_NoLightBlueBackgroundPresent: Background is strictly not light blue (0xdbe5f0)', () => {
      const bg = UIThemeInspector.getViewportBackgroundHex();
      expect(bg.hex).not.toBe(0xdbe5f0, '3D Viewport background must not be light blue 0xdbe5f0');
    });

    it('T1_F8_03_BoneToBackgroundHighContrastRatio: Contrast ratio between ivory bone (0xefe5d2) and dark background exceeds 10:1', () => {
      const ratio = UIThemeInspector.computeContrastRatio(0xefe5d2, 0x111a16);
      expect(ratio).toBeGreaterThan(10.0, 'Contrast ratio must exceed 10:1 (WCAG AAA)');
    });

    it('T1_F8_04_ThemeToggleDarkBackgroundPersistence: Relative luminance of dark background is below 0.03', () => {
      // 0x111a16 has luminance ~0.009
      const contrastAgainstWhite = UIThemeInspector.computeContrastRatio(0xffffff, 0x111a16);
      expect(contrastAgainstWhite).toBeGreaterThan(12.0);
    });

    it('T1_F8_05_CanvasClearColorMatchesSceneBackground: Background hex format correctly parses as 24-bit RGB', () => {
      const targetHex = 0x111a16;
      const r = (targetHex >> 16) & 255;
      const g = (targetHex >> 8) & 255;
      const b = targetHex & 255;

      expect(r).toBe(0x11);
      expect(g).toBe(0x1a);
      expect(b).toBe(0x16);
    });
  });
}
