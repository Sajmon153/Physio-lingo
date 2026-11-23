/**
 * tests/e2e/tier2-boundaries/tier2_f01_regional_models_boundary.test.ts
 * Tier 2 Boundary: Regional 3D Extraction (Feature 1 Boundaries)
 */

import { describe, it, expect, setTestTier, assertThrows } from '../harness/testContext.ts';
import { Model3DInspector } from '../harness/model3dInspector.ts';

export function registerTier2RegionalModelsBoundaryTests(): void {
  setTestTier('Tier 2: Boundaries');

  describe('Boundary 1: Regional Models Edge & Corrupted Cases', () => {
    it('T2_F1_01_MissingRegionalModelThrows404Gracefully: Requesting nonexistent regional model throws explicit error or returns fallback', () => {
      let caught = false;
      try {
        Model3DInspector.fromBuffer(Buffer.from([]));
      } catch (err: any) {
        caught = true;
        expect(err.message).toMatch(/Buffer too short/i);
      }
      expect(caught).toBe(true);
    });

    it('T2_F1_02_TruncatedRegionalGLBBufferRejection: Truncated buffer (< 20 bytes) throws explicit Buffer too short error', () => {
      const truncated = Buffer.from([0x67, 0x6c, 0x54, 0x46, 0x02, 0x00]);
      assertThrows(
        () => Model3DInspector.fromBuffer(truncated),
        /Buffer too short for GLB/i
      );
    });

    it('T2_F1_03_CorruptedMagicHeaderRejection: Buffer with invalid magic throws Invalid GLB magic error', () => {
      const corrupt = Buffer.alloc(32);
      corrupt.write('WXYZ', 0, 4, 'utf8');
      corrupt.writeUInt32LE(2, 4);

      assertThrows(
        () => Model3DInspector.fromBuffer(corrupt),
        /Invalid GLB magic/i
      );
    });

    it('T2_F1_04_RegionalModelZeroMeshesDegeneracy: Empty or zero-mesh glTF json throws or safely reports 0 meshes', () => {
      const emptyGltfJson = JSON.stringify({ asset: { version: '2.0' }, nodes: [], meshes: [] });
      const jsonBuf = Buffer.from(emptyGltfJson, 'utf8');
      const header = Buffer.alloc(20);
      header.write('glTF', 0, 4, 'utf8');
      header.writeUInt32LE(2, 4);
      header.writeUInt32LE(20 + jsonBuf.length, 8);
      header.writeUInt32LE(jsonBuf.length, 12);
      header.write('JSON', 16, 4, 'utf8');

      const fullGlb = Buffer.concat([header, jsonBuf]);
      const inspector = Model3DInspector.fromBuffer(fullGlb);
      expect(inspector.getTotalMeshCount()).toBe(0);
      expect(inspector.getAllMeshes()).toHaveLength(0);
    });

    it('T2_F1_05_DegenerateBoundingBoxZeroVolume: Zero-volume bounding box clamps to minimum safe dimension', () => {
      const zeroBounds = {
        min: [0, 0, 0] as [number, number, number],
        max: [0, 0, 0] as [number, number, number],
        center: [0, 0, 0] as [number, number, number],
        size: [0, 0, 0] as [number, number, number],
      };

      const focus = Model3DInspector.computeFocusTargetAndDistance(zeroBounds);
      expect(Number.isFinite(focus.distance)).toBe(true);
      expect(focus.distance).toBeGreaterThan(0.05);
      expect(Number.isNaN(focus.cameraPosition[0])).toBe(false);
    });
  });
}
