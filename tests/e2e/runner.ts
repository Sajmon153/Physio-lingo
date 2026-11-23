/**
 * tests/e2e/runner.ts
 * Master E2E Test Suite Runner for Fizjolingo Production Release
 * Executes Tier 1 (14 Features × 5 = 70 tests), Tier 2 (14 Boundaries × 5 = 70 tests),
 * Tier 3 (16 Pairwise Combinations), and Tier 4 (7 Clinical User Journeys).
 * Total: 163 tests (asserts >= 161).
 * Supports tier filtering via CLI flag (--tier=1|2|3|4) or env var TIER.
 */

import {
  runRegisteredSuites,
  printSummaryTable,
  ANSI,
  registry,
} from './harness/testContext.ts';

// --- Tier 1: Feature Suites (14 Features × 5 tests = 70 tests) ---
import { registerTier1RegionalModelsTests } from './tier1-features/tier1_f01_regional_models.test.ts';
import { registerTier1LessonRegionalLoadingTests } from './tier1-features/tier1_f02_lesson_regional_loading.test.ts';
import { registerTier1NoseGeometryTests } from './tier1-features/tier1_f03_nose_geometry.test.ts';
import { registerTier1CameraFocusingTests } from './tier1-features/tier1_f04_camera_focusing.test.ts';
import { registerTier1StructureCuttingTests } from './tier1-features/tier1_f05_structure_cutting.test.ts';
import { registerTier1StructureRestoringTests } from './tier1-features/tier1_f06_structure_restoring.test.ts';
import { registerTier1CartilageMaterialsTests } from './tier1-features/tier1_f07_cartilage_materials.test.ts';
import { registerTier1DarkBackgroundTests } from './tier1-features/tier1_f08_dark_background.test.ts';
import { registerTier1BilingualNamingTests } from './tier1-features/tier1_f09_bilingual_naming.test.ts';
import { registerTier1VertebraeNumberingTests } from './tier1-features/tier1_f10_vertebrae_numbering.test.ts';
import { registerTier1TeethNumberingTests } from './tier1-features/tier1_f11_teeth_numbering.test.ts';
import { registerTier1HotspotsAttachmentsTests } from './tier1-features/tier1_f12_hotspots_attachments.test.ts';
import { registerTier1GreenWhiteThemingTests } from './tier1-features/tier1_f13_green_white_theming.test.ts';
import { registerTier1E2ERunnerIntegrityTests } from './tier1-features/tier1_f14_e2e_runner_integrity.test.ts';

// --- Tier 2: Boundary Suites (14 Features × 5 tests = 70 tests) ---
import { registerTier2RegionalModelsBoundaryTests } from './tier2-boundaries/tier2_f01_regional_models_boundary.test.ts';
import { registerTier2LessonLoadingBoundaryTests } from './tier2-boundaries/tier2_f02_lesson_loading_boundary.test.ts';
import { registerTier2NoseGeometryBoundaryTests } from './tier2-boundaries/tier2_f03_nose_geometry_boundary.test.ts';
import { registerTier2CameraFocusingBoundaryTests } from './tier2-boundaries/tier2_f04_camera_focusing_boundary.test.ts';
import { registerTier2StructureCuttingBoundaryTests } from './tier2-boundaries/tier2_f05_structure_cutting_boundary.test.ts';
import { registerTier2StructureRestoringBoundaryTests } from './tier2-boundaries/tier2_f06_structure_restoring_boundary.test.ts';
import { registerTier2CartilageMaterialsBoundaryTests } from './tier2-boundaries/tier2_f07_cartilage_materials_boundary.test.ts';
import { registerTier2DarkBackgroundBoundaryTests } from './tier2-boundaries/tier2_f08_dark_background_boundary.test.ts';
import { registerTier2BilingualNamingBoundaryTests } from './tier2-boundaries/tier2_f09_bilingual_naming_boundary.test.ts';
import { registerTier2VertebraeNumberingBoundaryTests } from './tier2-boundaries/tier2_f10_vertebrae_numbering_boundary.test.ts';
import { registerTier2TeethNumberingBoundaryTests } from './tier2-boundaries/tier2_f11_teeth_numbering_boundary.test.ts';
import { registerTier2HotspotsAttachmentsBoundaryTests } from './tier2-boundaries/tier2_f12_hotspots_attachments_boundary.test.ts';
import { registerTier2GreenWhiteThemingBoundaryTests } from './tier2-boundaries/tier2_f13_green_white_theming_boundary.test.ts';
import { registerTier2E2ERunnerBoundaryTests } from './tier2-boundaries/tier2_f14_e2e_runner_boundary.test.ts';

// --- Tier 3: Combinations Suite (16 pairwise interaction tests) ---
import { registerTier3PairwiseCombinationsTests } from './tier3-combinations/tier3_pairwise_combinations.test.ts';

// --- Tier 4: Applications Suite (7 clinical & educational user journeys) ---
import { registerTier4UserJourneysTests } from './tier4-applications/tier4_user_journeys.test.ts';

function parseTierFilter(): number | null {
  // Check CLI arguments (e.g. --tier=1, --tier=2)
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--tier=(\d+)$/i);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  // Check environment variable TIER
  if (process.env.TIER) {
    const val = parseInt(process.env.TIER, 10);
    if (!isNaN(val)) return val;
  }
  return null;
}

async function main(): Promise<void> {
  const tierFilter = parseTierFilter();

  console.log(`\n${ANSI.bold}${ANSI.bgGreen} FIZJOLINGO PRODUCTION E2E TEST RUNNER ${ANSI.reset}`);
  console.log(
    `${ANSI.dim}Automated 4-tier requirement verification (163 tests | Target: >=161)${ANSI.reset}`
  );
  if (tierFilter !== null) {
    console.log(`${ANSI.yellow}Filtering execution to Tier ${tierFilter} only${ANSI.reset}`);
  }

  // --- Register Tier 1 (Features) ---
  if (tierFilter === null || tierFilter === 1) {
    registerTier1RegionalModelsTests();
    registerTier1LessonRegionalLoadingTests();
    registerTier1NoseGeometryTests();
    registerTier1CameraFocusingTests();
    registerTier1StructureCuttingTests();
    registerTier1StructureRestoringTests();
    registerTier1CartilageMaterialsTests();
    registerTier1DarkBackgroundTests();
    registerTier1BilingualNamingTests();
    registerTier1VertebraeNumberingTests();
    registerTier1TeethNumberingTests();
    registerTier1HotspotsAttachmentsTests();
    registerTier1GreenWhiteThemingTests();
    registerTier1E2ERunnerIntegrityTests();
  }

  // --- Register Tier 2 (Boundaries) ---
  if (tierFilter === null || tierFilter === 2) {
    registerTier2RegionalModelsBoundaryTests();
    registerTier2LessonLoadingBoundaryTests();
    registerTier2NoseGeometryBoundaryTests();
    registerTier2CameraFocusingBoundaryTests();
    registerTier2StructureCuttingBoundaryTests();
    registerTier2StructureRestoringBoundaryTests();
    registerTier2CartilageMaterialsBoundaryTests();
    registerTier2DarkBackgroundBoundaryTests();
    registerTier2BilingualNamingBoundaryTests();
    registerTier2VertebraeNumberingBoundaryTests();
    registerTier2TeethNumberingBoundaryTests();
    registerTier2HotspotsAttachmentsBoundaryTests();
    registerTier2GreenWhiteThemingBoundaryTests();
    registerTier2E2ERunnerBoundaryTests();
  }

  // --- Register Tier 3 (Combinations) ---
  if (tierFilter === null || tierFilter === 3) {
    registerTier3PairwiseCombinationsTests();
  }

  // --- Register Tier 4 (Applications) ---
  if (tierFilter === null || tierFilter === 4) {
    registerTier4UserJourneysTests();
  }

  // Run all registered suites
  const summary = await runRegisteredSuites(true);

  // Print ANSI dashboard
  printSummaryTable(summary);

  // Threshold validation when running full suite
  if (tierFilter === null) {
    if (summary.totalTests < 161) {
      console.error(
        `\n${ANSI.bold}${ANSI.bgRed} COVERAGE FAILURE ${ANSI.reset} Total registered tests (${summary.totalTests}) is below requirement threshold (161)!`
      );
      process.exit(1);
    }
  }

  if (!summary.passed) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(`\n${ANSI.bold}${ANSI.bgRed} FATAL RUNNER ERROR ${ANSI.reset}`, err);
  process.exit(1);
});
