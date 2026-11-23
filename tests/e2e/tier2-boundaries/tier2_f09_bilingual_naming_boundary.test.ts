/**
 * tests/e2e/tier2-boundaries/tier2_f09_bilingual_naming_boundary.test.ts
 * Tier 2 Boundary: Bilingual Naming Format (Feature 9 Boundaries)
 */

import { describe, it, expect, setTestTier } from '../harness/testContext.ts';
import { formatBilingualName } from '../harness/appSimulator.ts';

export function registerTier2BilingualNamingBoundaryTests(): void {
  setTestTier('Tier 2: Boundaries');

  describe('Boundary 9: Bilingual Naming Edge Cases & Idempotency', () => {
    it('T2_F9_01_IdempotentFormattingPreventsDoubleParentheses: Applying format to already formatted name avoids double parentheses', () => {
      const formatted = 'Kość ramienna (Humerus)';
      expect(formatBilingualName(formatted)).toBe('Kość ramienna (Humerus)');
      expect(formatBilingualName(formatted, 'Humerus')).toBe('Kość ramienna (Humerus)');
    });

    it('T2_F9_02_MissingEnglishNameOmitsEmptyParentheses: Undefined or empty English name returns Polish name without empty ()', () => {
      expect(formatBilingualName('Łopatka', undefined)).toBe('Łopatka');
      expect(formatBilingualName('Łopatka', '')).toBe('Łopatka');
      expect(formatBilingualName('Łopatka', '   ')).toBe('Łopatka');
    });

    it('T2_F9_03_WhitespacePaddingInNamesCleaned: Leading and trailing whitespace trimmed from both names', () => {
      const res = formatBilingualName('   Kość udowa   ', '   Femur   ');
      expect(res).toBe('Kość udowa (Femur)');
    });

    it('T2_F9_04_LateralizationSuffixPlacedOutsideParentheses: Lateralization suffix formatted cleanly without nested ()', () => {
      const res = formatBilingualName('Kość ramienna (strona lewa)', 'Left humerus');
      expect(/\(\s*\)/.test(res)).toBe(false);
      expect(res).toContain('Kość ramienna');
      expect(res).toContain('(Left humerus)');
    });

    it('T2_F9_05_EmptyStringsFallback: Empty strings for both names safely return generic fallback', () => {
      expect(formatBilingualName('', '')).toBe('Struktura anatomiczna');
      expect(formatBilingualName(undefined as any, undefined)).toBe('Struktura anatomiczna');
    });
  });
}
