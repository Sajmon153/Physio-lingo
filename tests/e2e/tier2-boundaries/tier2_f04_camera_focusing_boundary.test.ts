/**
 * tests/e2e/tier2-boundaries/tier2_f04_camera_focusing_boundary.test.ts
 * Tier 2 Boundary: Click Camera Focusing (Feature 4 Boundaries)
 */

import { describe, it, expect, setTestTier } from '../harness/testContext.ts';
import { Model3DInspector } from '../harness/model3dInspector.ts';

export function registerTier2CameraFocusingBoundaryTests(): void {
  setTestTier('Tier 2: Boundaries');

  describe('Boundary 4: Camera Focusing Edge Cases & Aspect Clamping', () => {
    it('T2_F4_01_FocusNonExistentMeshIdNoOp: Missing mesh returns undefined bounds without runtime crash', () => {
      const inspector = Model3DInspector.getDefault();
      const bounds = inspector.getMeshBounds('ghost_structure_xyz_123');
      expect(bounds).toBeUndefined();
    });

    it('T2_F4_02_ZeroVolumeBoundingBoxClamping: Radius 0 is clamped to minimum safe radius 0.035m', () => {
      const zeroBounds = {
        min: [0, 0, 0] as [number, number, number],
        max: [0, 0, 0] as [number, number, number],
        center: [0, 0, 0] as [number, number, number],
        size: [0, 0, 0] as [number, number, number],
      };

      const focus = Model3DInspector.computeFocusTargetAndDistance(zeroBounds);
      // At FOV 45, radius 0.035 -> distance = 0.035 / sin(22.5 deg) ≈ 0.091m
      expect(focus.distance).toBeGreaterThanOrEqual(0.08);
      expect(Number.isFinite(focus.distance)).toBe(true);
    });

    it('T2_F4_03_SuccessiveRapidClicksInterruptAnimation: Consecutive focus calls yield valid finite coordinates', () => {
      const inspector = Model3DInspector.getDefault();
      const meshes = inspector.getAllMeshes().slice(0, 10);

      for (const m of meshes) {
        const focus = Model3DInspector.computeFocusTargetAndDistance(m.bounds);
        expect(Number.isFinite(focus.distance)).toBe(true);
        expect(Number.isNaN(focus.target[0])).toBe(false);
        expect(Number.isNaN(focus.cameraPosition[0])).toBe(false);
      }
    });

    it('T2_F4_04_CameraAlreadyAtTargetPreventsSingularity: Camera position is strictly offset from target', () => {
      const bounds = {
        min: [-0.01, -0.01, -0.01] as [number, number, number],
        max: [0.01, 0.01, 0.01] as [number, number, number],
        center: [0, 0, 0] as [number, number, number],
        size: [0.02, 0.02, 0.02] as [number, number, number],
      };

      const focus = Model3DInspector.computeFocusTargetAndDistance(bounds);
      const dist = Math.hypot(
        focus.cameraPosition[0] - focus.target[0],
        focus.cameraPosition[1] - focus.target[1],
        focus.cameraPosition[2] - focus.target[2]
      );

      expect(dist).toBeGreaterThan(0.05);
    });

    it('T2_F4_05_ExtremeAspectRatioFocusBounding: Mobile portrait aspect (0.40) increases camera distance proportionally', () => {
      const bounds = {
        min: [-0.1, -0.1, -0.1] as [number, number, number],
        max: [0.1, 0.1, 0.1] as [number, number, number],
        center: [0, 0, 0] as [number, number, number],
        size: [0.2, 0.2, 0.2] as [number, number, number],
      };

      const landscapeFocus = Model3DInspector.computeFocusTargetAndDistance(bounds, 1.77); // 16:9
      const portraitFocus = Model3DInspector.computeFocusTargetAndDistance(bounds, 0.40); // 9:20 mobile

      expect(portraitFocus.distance).toBeGreaterThan(landscapeFocus.distance * 2);
    });
  });
}
