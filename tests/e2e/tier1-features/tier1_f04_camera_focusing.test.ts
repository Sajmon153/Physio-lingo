/**
 * tests/e2e/tier1-features/tier1_f04_camera_focusing.test.ts
 * Tier 1 Feature 4: Click Camera Focusing (Requirement R2)
 */

import { describe, it, expect, setTestTier } from '../harness/testContext.ts';
import { Model3DInspector } from '../harness/model3dInspector.ts';

export function registerTier1CameraFocusingTests(): void {
  setTestTier('Tier 1: Features');

  describe('Feature 4: Click Camera Focusing', () => {
    const inspector = Model3DInspector.getDefault();

    it('T1_F4_01_FocusMeshTargetVectorUpdate: computeFocusTargetAndDistance returns target vector matching mesh center', () => {
      const scapulaMesh = inspector.findMesh((m) => /scapula/i.test(m.rawName));
      expect(scapulaMesh).toBeTruthy();

      const focus = Model3DInspector.computeFocusTargetAndDistance(scapulaMesh!.bounds);
      expect(focus.target[0]).toBe(scapulaMesh!.bounds.center[0]);
      expect(focus.target[1]).toBe(scapulaMesh!.bounds.center[1]);
      expect(focus.target[2]).toBe(scapulaMesh!.bounds.center[2]);
    });

    it('T1_F4_02_CameraDistanceScalingByObjectRadius: Distance scales proportionally with bounding sphere radius', () => {
      const femurMesh = inspector.findMesh((m) => /femur/i.test(m.rawName));
      const toothMesh = inspector.findMesh((m) => /incisor|tooth/i.test(m.rawName));

      expect(femurMesh).toBeTruthy();
      expect(toothMesh).toBeTruthy();

      const femurFocus = Model3DInspector.computeFocusTargetAndDistance(femurMesh!.bounds);
      const toothFocus = Model3DInspector.computeFocusTargetAndDistance(toothMesh!.bounds);

      expect(femurFocus.distance).toBeGreaterThan(toothFocus.distance * 2);
    });

    it('T1_F4_03_CameraTargetTransitionElevation: Target elevation accurately matches clicked knee elevation (Y ≈ 0.44m)', () => {
      const patellaMesh = inspector.findMesh((m) => /patella/i.test(m.rawName));
      expect(patellaMesh).toBeTruthy();

      const focus = Model3DInspector.computeFocusTargetAndDistance(patellaMesh!.bounds);
      expect(focus.target[1]).toBeGreaterThan(0.35);
      expect(focus.target[1]).toBeLessThan(0.55);
    });

    it('T1_F4_04_OrbitControlsUpdateTriggered: Camera focus position produces strictly finite numbers and non-zero distance', () => {
      const mesh = inspector.getAllMeshes()[0];
      const focus = Model3DInspector.computeFocusTargetAndDistance(mesh.bounds);

      for (let i = 0; i < 3; i++) {
        expect(Number.isFinite(focus.target[i])).toBe(true);
        expect(Number.isFinite(focus.cameraPosition[i])).toBe(true);
      }
      expect(focus.distance).toBeGreaterThan(0.05);
    });

    it('T1_F4_05_CameraDirectionPreservation: Normalized direction vector aligns with primary viewing angle', () => {
      const mesh = inspector.getAllMeshes()[5];
      const focus = Model3DInspector.computeFocusTargetAndDistance(mesh.bounds);

      const dx = focus.cameraPosition[0] - focus.target[0];
      const dy = focus.cameraPosition[1] - focus.target[1];
      const dz = focus.cameraPosition[2] - focus.target[2];
      const len = Math.hypot(dx, dy, dz);

      // Camera is placed anteriorly (positive Z)
      expect(dz / len).toBeGreaterThan(0.5);
    });
  });
}
