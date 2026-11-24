/**
 * Pure camera orbit-pivot math for PhysioLingo 3D viewport.
 * Ensures clicking/tapping any anatomical structure smoothly aims the OrbitControls
 * rotation axis (controls.target) directly at that structure while preserving viewing
 * direction and comfortable framing distance.
 */

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface ClickOrbitGoalInput {
  currentPos: Vec3Like;
  currentTarget: Vec3Like;
  structureCenter: Vec3Like;
  structureRadius: number;
  hitPoint: Vec3Like;
  minDistance: number;
  maxDistance: number;
  fovDeg: number;
  aspect: number;
}

export interface ClickOrbitGoal {
  target: Vec3Like;
  position: Vec3Like;
  distance: number;
  usedHitPoint: boolean;
}

/**
 * Threshold above which a mesh is treated as a sprawling full-body layer
 * (e.g. skin envelope or long vessel/nerve tree), so pivoting uses the exact
 * clicked surface point instead of a distant geometric center.
 */
export const SPRAWLING_MESH_RADIUS_THRESHOLD = 0.38;

export function computeClickOrbitGoal(input: ClickOrbitGoalInput): ClickOrbitGoal {
  const {
    currentPos,
    currentTarget,
    structureCenter,
    structureRadius,
    hitPoint,
    minDistance,
    maxDistance,
    fovDeg,
    aspect,
  } = input;

  const useHitPoint =
    !Number.isFinite(structureRadius) ||
    structureRadius <= 0 ||
    structureRadius >= SPRAWLING_MESH_RADIUS_THRESHOLD;

  const target: Vec3Like = useHitPoint
    ? { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z }
    : { x: structureCenter.x, y: structureCenter.y, z: structureCenter.z };

  // Preserve current viewing direction from old target to camera
  let dx = currentPos.x - currentTarget.x;
  let dy = currentPos.y - currentTarget.y;
  let dz = currentPos.z - currentTarget.z;
  const currentDist = Math.hypot(dx, dy, dz);

  if (currentDist < 1e-4) {
    dx = 0.18;
    dy = 0.12;
    dz = 0.98;
    const norm = Math.hypot(dx, dy, dz);
    dx /= norm;
    dy /= norm;
    dz /= norm;
  } else {
    dx /= currentDist;
    dy /= currentDist;
    dz /= currentDist;
  }

  const effectiveRadius = Math.max(
    useHitPoint ? 0.12 : structureRadius,
    0.04,
  );
  const halfFovRad = ((Math.max(fovDeg, 15) * Math.PI) / 180) / 2;
  const safeAspect = Math.max(aspect, 0.35);
  const aspectFactor = safeAspect < 1 ? 1 / Math.max(safeAspect, 0.55) : 1;
  const idealFramingDist = (effectiveRadius / Math.sin(halfFovRad)) * aspectFactor * 1.6;

  const minSafeDist = Math.max(minDistance * 2.2, effectiveRadius * 1.45, 0.24);
  const maxSafeDist = Math.max(maxDistance * 0.9, minSafeDist + 0.5);

  // If currently zoomed far out relative to the clicked structure, glide closer comfortably;
  // if already inspecting up close, preserve the user's current zoom level cleanly.
  const farThreshold = Math.max(idealFramingDist * 2.1, 1.35);
  const desiredDist =
    currentDist > farThreshold
      ? Math.max(idealFramingDist * 1.35, 0.85)
      : Math.max(currentDist, minSafeDist);

  const distance = Math.min(Math.max(desiredDist, minSafeDist), maxSafeDist);

  return {
    target,
    position: {
      x: target.x + dx * distance,
      y: target.y + dy * distance,
      z: target.z + dz * distance,
    },
    distance,
    usedHitPoint: useHitPoint,
  };
}
