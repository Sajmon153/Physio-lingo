import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ANATOMY_MAP } from '../data/anatomyDb';
import { RegionId, StructureCategory } from '../types/anatomy';
import { capitalizeLatinTerm, formatBilingualName } from './anatomyTranslator';

export interface SelectableMeshMeta {
  id: string;
  namePl: string;
  nameLt?: string;
  nameEn: string;
  bilingualName: string;
  structureId?: string;
  category: StructureCategory;
}

export interface ProceduralAnatomyResult {
  root: THREE.Group;
  interactables: THREE.Mesh[];
  partMeshes: Map<string, THREE.Mesh[]>;
  partMetas: SelectableMeshMeta[];
  disposables: Array<{ dispose: () => void }>;
}

function createMuscleFiberTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 128, 128);
    // Longitudinal muscle fascicle striations along V
    for (let x = 0; x < 128; x += 4) {
      const shade = 108 + Math.round(Math.sin(x * 0.55) * 30);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(x, 0, 2, 128);
    }
    // Subtle cross-sarcomere micro-variation
    for (let y = 0; y < 128; y += 6) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(0, y, 128, 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

function createBoneGrainTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 128, 128);
    // Deterministic organic periosteal grain (no Math.random flicker)
    for (let y = 0; y < 128; y += 2) {
      for (let x = 0; x < 128; x += 4) {
        const wave = Math.sin(x * 0.37 + y * 0.19) * Math.cos(x * 0.13 - y * 0.41);
        const shade = Math.round(128 + wave * 18);
        ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
        ctx.fillRect(x, y, 4, 2);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(edge1 - edge0, 1e-5)));
  return t * t * (3 - 2 * t);
}

/**
 * Generates a closed, smoothly tapered, elliptical-cross-section organic sweep along a 3D spline,
 * with optional per-vertex color gradient (e.g. pearly tendon -> striated crimson belly -> tendon).
 */
function buildVariableRadiusTube(
  points: THREE.Vector3[],
  radiusFn: (t: number) => { rx: number; ry: number },
  tubularSegments = 28,
  radialSegments = 14,
  colorFn?: (t: number) => THREE.Color,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.45);
  const frames = curve.computeFrenetFrames(tubularSegments, false);

  const ringPoints: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  // Build ring at parameter t (cap rings shrink smoothly to close tips without pinching normals)
  const sampleParams: Array<{ t: number; scale: number }> = [];
  sampleParams.push({ t: 0, scale: 0.08 });
  for (let i = 0; i <= tubularSegments; i++) {
    sampleParams.push({ t: i / tubularSegments, scale: 1 });
  }
  sampleParams.push({ t: 1, scale: 0.08 });

  const totalRings = sampleParams.length;
  const ringStride = radialSegments + 1;

  for (let r = 0; r < totalRings; r++) {
    const { t, scale } = sampleParams[r];
    const frameIdx = Math.min(tubularSegments, Math.round(t * tubularSegments));
    const center = curve.getPointAt(t);
    const tangent = frames.tangents[frameIdx];
    const normal = frames.normals[frameIdx];
    const binormal = frames.binormals[frameIdx];

    const { rx, ry } = radiusFn(t);
    const effRx = Math.max(0.004, rx * scale);
    const effRy = Math.max(0.004, ry * scale);

    // Offset cap slightly along tangent for rounded hemispherical end
    const capOffset = r === 0 ? -Math.min(rx, ry) * 0.45 : r === totalRings - 1 ? Math.min(rx, ry) * 0.45 : 0;
    const col = colorFn ? colorFn(t) : null;

    for (let j = 0; j <= radialSegments; j++) {
      const theta = (j / radialSegments) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      const vx =
        center.x +
        tangent.x * capOffset +
        normal.x * (effRx * cosT) +
        binormal.x * (effRy * sinT);
      const vy =
        center.y +
        tangent.y * capOffset +
        normal.y * (effRx * cosT) +
        binormal.y * (effRy * sinT);
      const vz =
        center.z +
        tangent.z * capOffset +
        normal.z * (effRx * cosT) +
        binormal.z * (effRy * sinT);

      ringPoints.push(vx, vy, vz);
      uvs.push(j / radialSegments, t);
      if (col) {
        colors.push(col.r, col.g, col.b);
      }
    }
  }

  for (let r = 0; r < totalRings - 1; r++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = r * ringStride + j;
      const b = (r + 1) * ringStride + j;
      const c = (r + 1) * ringStride + (j + 1);
      const d = r * ringStride + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(ringPoints, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (colorFn) {
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function makeMuscleColorFn(
  bellyHex: number,
  proxEnd = 0.16,
  distStart = 0.82,
  tendonHex = 0xf5f7f5,
): (t: number) => THREE.Color {
  const belly = new THREE.Color(bellyHex);
  const tendon = new THREE.Color(tendonHex);
  return (t: number) => {
    const inBelly = smoothstep(proxEnd - 0.08, proxEnd + 0.09, t);
    const outBelly = 1 - smoothstep(distStart - 0.09, distStart + 0.08, t);
    const muscleWeight = Math.max(0, Math.min(1, inBelly * outBelly));
    return tendon.clone().lerp(belly, muscleWeight);
  };
}

/**
 * Builds a realistic wedge-cross-section fibrocartilage meniscus along an arc (thick outer rim,
 * thin inner concave margin, slightly hollowed superior surface).
 */
function buildWedgeMeniscusGeometry(
  radius: number,
  arcAngle: number,
  width: number,
  outerHeight: number,
  segments = 28,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Cross section 4 points per angular slice (outer-top, outer-bottom, inner-bottom, inner-top-sharp)
  const profile: Array<[number, number]> = [
    [radius + width * 0.5, outerHeight * 0.5],
    [radius + width * 0.5, -outerHeight * 0.5],
    [radius - width * 0.5, -outerHeight * 0.42],
    [radius - width * 0.5, -outerHeight * 0.18],
  ];

  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const angle = (u - 0.5) * arcAngle;
    // Taper horns softly at both ends
    const hornTaper = 0.45 + 0.55 * Math.sin(u * Math.PI);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    for (let p = 0; p < 4; p++) {
      const [pr, py] = profile[p];
      const rOffset = radius + (pr - radius) * hornTaper;
      const yOffset = py * (0.65 + 0.35 * hornTaper);
      positions.push(rOffset * cosA, yOffset, rOffset * sinA);
      uvs.push(u, p / 3);
    }
  }

  for (let i = 0; i < segments; i++) {
    const base = i * 4;
    const next = (i + 1) * 4;
    for (let p = 0; p < 4; p++) {
      const pNext = (p + 1) % 4;
      indices.push(base + p, next + p, base + pNext);
      indices.push(next + p, next + pNext, base + pNext);
    }
  }

  // Cap start and end horns
  indices.push(0, 2, 1, 0, 3, 2);
  const last = segments * 4;
  indices.push(last + 0, last + 1, last + 2, last + 0, last + 2, last + 3);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Normalizes geometries so BufferGeometryUtils.mergeGeometries merges multiple sculpted parts
 * cleanly into a single draw call per anatomical structure.
 */
function mergePartGeometries(
  parts: THREE.BufferGeometry[],
  withVertexColors: boolean,
  fallbackColor = 0xffffff,
): THREE.BufferGeometry {
  const defaultCol = new THREE.Color(fallbackColor);
  const normalized = parts.map((raw) => {
    const g = raw.index ? raw.toNonIndexed() : raw.clone();
    if (!g.attributes.normal) {
      g.computeVertexNormals();
    }
    const count = g.attributes.position.count;
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
    }
    if (withVertexColors) {
      if (!g.attributes.color) {
        const arr = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          arr[i * 3] = defaultCol.r;
          arr[i * 3 + 1] = defaultCol.g;
          arr[i * 3 + 2] = defaultCol.b;
        }
        g.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
      }
    } else if (g.attributes.color) {
      g.deleteAttribute('color');
    }
    // Remove tangent or extra attributes so all parts match identically
    for (const key of Object.keys(g.attributes)) {
      if (key !== 'position' && key !== 'normal' && key !== 'uv' && key !== 'color') {
        g.deleteAttribute(key);
      }
    }
    raw.dispose();
    return g;
  });

  const merged = mergeGeometries(normalized, false);
  normalized.forEach((g) => g.dispose());
  if (!merged) {
    throw new Error('mergePartGeometries failed to merge BufferGeometries');
  }
  return merged;
}

function bakeTransform(
  geo: THREE.BufferGeometry,
  pos: [number, number, number],
  rot?: [number, number, number],
  scale?: [number, number, number],
): THREE.BufferGeometry {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(rot?.[0] ?? 0, rot?.[1] ?? 0, rot?.[2] ?? 0),
  );
  m.compose(
    new THREE.Vector3(pos[0], pos[1], pos[2]),
    q,
    new THREE.Vector3(scale?.[0] ?? 1, scale?.[1] ?? 1, scale?.[2] ?? 1),
  );
  geo.applyMatrix4(m);
  return geo;
}

function registerPart(
  parent: THREE.Object3D,
  partId: string,
  structureId: string,
  meshes: THREE.Mesh[],
  interactables: THREE.Mesh[],
  partMeshes: Map<string, THREE.Mesh[]>,
  partMetas: SelectableMeshMeta[],
  disposables: Array<{ dispose: () => void }>,
  baseOffset?: THREE.Vector3,
  explodeVector?: THREE.Vector3,
) {
  const entry = ANATOMY_MAP[structureId];
  const namePl = entry?.namePl ?? partId;
  const nameLt = capitalizeLatinTerm(entry?.nameLt) || namePl;
  const nameEn = entry?.nameEn ?? entry?.nameLt ?? partId;
  const bilingualName = formatBilingualName(namePl, nameLt);
  const meta: SelectableMeshMeta = {
    id: partId,
    namePl,
    nameLt,
    nameEn,
    bilingualName,
    structureId,
    category: entry?.category ?? 'bone',
  };

  partMetas.push(meta);
  const existing = partMeshes.get(partId) ?? [];

  for (const mesh of meshes) {
    mesh.userData = {
      id: meta.id,
      namePl: meta.namePl,
      nameLt: meta.nameLt,
      nameEn: meta.nameEn,
      bilingualName: meta.bilingualName,
      structureId: meta.structureId,
      category: meta.category,
      basePosition: (baseOffset ?? mesh.position).clone(),
      explodeVector: (explodeVector ?? new THREE.Vector3()).clone(),
    };
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    interactables.push(mesh);
    existing.push(mesh);
    disposables.push(mesh.geometry);
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m) => disposables.push(m));
    } else {
      disposables.push(mesh.material);
    }
  }

  partMeshes.set(partId, existing);
}

export function buildProceduralAnatomyModel(region: RegionId): ProceduralAnatomyResult {
  const root = new THREE.Group();
  const interactables: THREE.Mesh[] = [];
  const partMeshes = new Map<string, THREE.Mesh[]>();
  const partMetas: SelectableMeshMeta[] = [];
  const disposables: Array<{ dispose: () => void }> = [];

  const fiberBump = createMuscleFiberTexture();
  const boneBump = createBoneGrainTexture();
  disposables.push(fiberBump, boneBump);

  const createBoneMat = (tint = 0xefe5d2) =>
    new THREE.MeshStandardMaterial({
      color: tint,
      roughness: 0.72,
      metalness: 0.02,
      bumpMap: boneBump,
      bumpScale: 0.012,
    });

  const createLandmarkMat = (tint = 0xe6d5b7) =>
    new THREE.MeshStandardMaterial({
      color: tint,
      roughness: 0.68,
      metalness: 0.03,
      bumpMap: boneBump,
      bumpScale: 0.014,
    });

  const createCartilageMat = (tint = 0xa7f3d0) =>
    new THREE.MeshPhysicalMaterial({
      color: tint,
      roughness: 0.25,
      metalness: 0.0,
      clearcoat: 0.7,
      clearcoatRoughness: 0.2,
      side: THREE.DoubleSide,
    });

  const createLigamentMat = (tint = 0xf5f7f5) =>
    new THREE.MeshStandardMaterial({
      color: tint,
      roughness: 0.42,
      metalness: 0.02,
      bumpMap: fiberBump,
      bumpScale: 0.016,
    });

  // Muscles use vertexColors (tendon-pearl -> deep striated crimson -> tendon-pearl)
  const createVertexMuscleMat = (opacity = 1) =>
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.52,
      metalness: 0.04,
      bumpMap: fiberBump,
      bumpScale: 0.03,
      transparent: opacity < 1,
      opacity,
    });

  if (region === 'shoulder') {
    // =========================================================================
    // RIGHT SHOULDER COMPLEX (+X lateral, -X medial, +Y superior, +Z anterior)
    // =========================================================================

    // 1. Łopatka (Scapula): curved triangular blade + oblique scapular spine + neck
    const scapulaShape = new THREE.Shape();
    scapulaShape.moveTo(-1.32, 0.92);
    scapulaShape.quadraticCurveTo(-0.68, 0.88, -0.18, 0.74);
    scapulaShape.quadraticCurveTo(-0.04, 0.58, 0.06, 0.36);
    scapulaShape.quadraticCurveTo(0.08, 0.06, -0.02, -0.18);
    scapulaShape.quadraticCurveTo(-0.42, -0.92, -0.78, -1.46);
    scapulaShape.quadraticCurveTo(-1.14, -0.75, -1.32, 0.92);

    const bladeGeo = new THREE.ExtrudeGeometry(scapulaShape, {
      depth: 0.09,
      bevelEnabled: true,
      bevelThickness: 0.032,
      bevelSize: 0.032,
      bevelSegments: 3,
    });
    // Sculpt natural costal concavity + thoracic curvature on scapular blade
    const bladePos = bladeGeo.attributes.position;
    for (let i = 0; i < bladePos.count; i++) {
      const vx = bladePos.getX(i);
      const vy = bladePos.getY(i);
      const vz = bladePos.getZ(i);
      const curveZ = -0.14 * Math.pow((vx + 0.5) * 0.75, 2) + 0.05 * Math.sin(vy * 1.1);
      bladePos.setZ(i, vz + curveZ);
    }
    bladeGeo.computeVertexNormals();
    bakeTransform(bladeGeo, [-0.12, -0.06, -0.44], [0.05, 0.24, 0]);

    const scapSpineGeo = buildVariableRadiusTube(
      [
        new THREE.Vector3(-1.38, 0.38, -0.34),
        new THREE.Vector3(-0.92, 0.52, -0.34),
        new THREE.Vector3(-0.42, 0.66, -0.28),
        new THREE.Vector3(0.06, 0.78, -0.21),
      ],
      (t) => ({
        rx: 0.05 + 0.045 * smoothstep(0, 0.85, t),
        ry: 0.075 + 0.04 * smoothstep(0.1, 0.9, t),
      }),
      24,
      12,
    );

    const scapNeckGeo = buildVariableRadiusTube(
      [
        new THREE.Vector3(-0.28, 0.24, -0.26),
        new THREE.Vector3(-0.08, 0.25, -0.12),
        new THREE.Vector3(0.05, 0.25, 0.0),
      ],
      (t) => ({ rx: 0.14 + 0.05 * t, ry: 0.18 + 0.06 * t }),
      14,
      14,
    );

    const scapulaMerged = mergePartGeometries([bladeGeo, scapSpineGeo, scapNeckGeo], false);
    const scapulaMesh = new THREE.Mesh(scapulaMerged, createBoneMat(0xede1cc));
    registerPart(
      root,
      'mesh_scapula',
      'scapula',
      [scapulaMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      undefined,
      new THREE.Vector3(-0.32, 0, -0.36),
    );

    // 2. Wyrostek barkowy (Acromion) - beveled curved arch (NO BoxGeometry!)
    const acromionShape = new THREE.Shape();
    acromionShape.moveTo(-0.28, -0.14);
    acromionShape.quadraticCurveTo(0.02, -0.18, 0.28, -0.1);
    acromionShape.quadraticCurveTo(0.42, 0.02, 0.34, 0.18);
    acromionShape.quadraticCurveTo(0.16, 0.24, -0.08, 0.14);
    acromionShape.quadraticCurveTo(-0.24, 0.04, -0.28, -0.14);

    const acromionGeo = new THREE.ExtrudeGeometry(acromionShape, {
      depth: 0.085,
      bevelEnabled: true,
      bevelThickness: 0.028,
      bevelSize: 0.025,
      bevelSegments: 3,
    });
    bakeTransform(acromionGeo, [0.22, 0.87, -0.06], [Math.PI / 2 - 0.18, 0.14, -0.22]);
    const acromionMesh = new THREE.Mesh(acromionGeo, createLandmarkMat(0xf4ead6));
    registerPart(
      root,
      'mesh_acromion',
      'acromion',
      [acromionMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      undefined,
      new THREE.Vector3(0.05, 0.36, 0),
    );

    // 3. Wyrostek kruczy (Processus coracoideus) - tapered hooked raven's beak
    const coracoidGeo = buildVariableRadiusTube(
      [
        new THREE.Vector3(-0.08, 0.44, -0.02),
        new THREE.Vector3(0.04, 0.56, 0.16),
        new THREE.Vector3(0.14, 0.52, 0.36),
        new THREE.Vector3(0.26, 0.43, 0.52),
      ],
      (t) => ({
        rx: 0.088 * (1 - 0.34 * t),
        ry: 0.072 * (1 - 0.28 * t),
      }),
      20,
      12,
    );
    const coracoidMesh = new THREE.Mesh(coracoidGeo, createLandmarkMat(0xebd8b8));
    registerPart(
      root,
      'mesh_coracoid',
      'processus_coracoideus',
      [coracoidMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      undefined,
      new THREE.Vector3(0.05, 0.12, 0.36),
    );

    // 4. Wydrążenie stawowe (Cavitas glenoidalis) - pear-shaped articular socket
    const glenoidGeo = new THREE.CylinderGeometry(0.28, 0.34, 0.11, 28);
    glenoidGeo.scale(0.84, 1.0, 1.15);
    const glenoidMesh = new THREE.Mesh(glenoidGeo, createCartilageMat(0xa7f3d0));
    glenoidMesh.position.set(0.06, 0.25, 0.02);
    glenoidMesh.rotation.z = Math.PI / 2;
    registerPart(
      root,
      'mesh_glenoid',
      'cavitas_glenoidalis',
      [glenoidMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      glenoidMesh.position,
      new THREE.Vector3(-0.15, 0, 0),
    );

    // 5. Obrąbek stawowy (Labrum glenoidale) - pear-contoured fibrocartilage rim
    const labrumGeo = new THREE.TorusGeometry(0.32, 0.048, 16, 32);
    labrumGeo.scale(0.84, 1.14, 1.0);
    const labrumMesh = new THREE.Mesh(labrumGeo, createCartilageMat(0x86efac));
    labrumMesh.position.set(0.11, 0.25, 0.02);
    labrumMesh.rotation.y = Math.PI / 2;
    registerPart(
      root,
      'mesh_labrum',
      'labrum_glenoidale',
      [labrumMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      labrumMesh.position,
      new THREE.Vector3(0.05, 0, 0),
    );

    // 6. Obojczyk (Clavicula) - anatomical S-curve with sternal & flattened acromial ends
    const clavGeo = buildVariableRadiusTube(
      [
        new THREE.Vector3(-1.48, 0.94, 0.42),
        new THREE.Vector3(-0.98, 1.0, 0.52),
        new THREE.Vector3(-0.46, 0.98, 0.34),
        new THREE.Vector3(-0.08, 0.95, 0.12),
        new THREE.Vector3(0.24, 0.94, 0.0),
      ],
      (t) => ({
        rx: 0.072 + 0.045 * Math.pow(1 - t, 3) + 0.032 * Math.pow(t, 3),
        ry: 0.078 + 0.04 * Math.pow(1 - t, 3) + 0.055 * Math.pow(t, 2.5),
      }),
      28,
      14,
    );
    const clavMesh = new THREE.Mesh(clavGeo, createBoneMat(0xf0e7d6));
    registerPart(
      root,
      'mesh_clavicula',
      'clavicula',
      [clavMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      undefined,
      new THREE.Vector3(-0.1, 0.46, 0.2),
    );

    // 7. Staw barkowo-obojczykowy (Articulatio AC)
    const acJointGeo = new THREE.SphereGeometry(0.12, 18, 16);
    acJointGeo.scale(1.15, 0.72, 1.25);
    const acJointMesh = new THREE.Mesh(acJointGeo, createLigamentMat(0xf5f7f5));
    acJointMesh.position.set(0.25, 0.93, -0.01);
    registerPart(
      root,
      'mesh_ac_joint',
      'articulatio_ac',
      [acJointMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      acJointMesh.position,
      new THREE.Vector3(0.1, 0.48, 0.08),
    );

    // 8. Więzadło kruczo-barkowe (Lig. coracoacromiale) - triangular flat arch band
    const coracoAcromialGeo = buildVariableRadiusTube(
      [
        new THREE.Vector3(0.21, 0.46, 0.46),
        new THREE.Vector3(0.32, 0.7, 0.27),
        new THREE.Vector3(0.36, 0.85, 0.03),
      ],
      (t) => ({
        rx: 0.095 * (1 - 0.35 * t),
        ry: 0.025,
      }),
      18,
      12,
    );
    const coracoAcromialMesh = new THREE.Mesh(coracoAcromialGeo, createLigamentMat(0xf5f7f5));
    registerPart(
      root,
      'mesh_lig_coracoacromiale',
      'lig_coracoacromiale',
      [coracoAcromialMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      undefined,
      new THREE.Vector3(0.18, 0.32, 0.2),
    );

    // 9. Kość ramienna (Humerus) - anatomical head + surgical neck + deltoid tuberosity + bicipital groove
    const humShaftGeo = buildVariableRadiusTube(
      [
        new THREE.Vector3(0.56, 0.28, 0.04),
        new THREE.Vector3(0.59, -0.15, 0.04),
        new THREE.Vector3(0.64, -0.68, 0.04),
        new THREE.Vector3(0.58, -1.28, 0.02),
        new THREE.Vector3(0.54, -1.82, 0.0),
      ],
      (t) => {
        // Subtle deltoid tuberosity flare around t = 0.42 + distal flare near t = 1
        const deltoidBump = 0.038 * Math.exp(-Math.pow((t - 0.42) / 0.14, 2));
        const proximalFlare = 0.12 * Math.exp(-Math.pow(t / 0.18, 2));
        return {
          rx: 0.145 + proximalFlare + deltoidBump + 0.05 * Math.pow(t, 4),
          ry: 0.145 + proximalFlare * 0.9 + 0.02 * Math.pow(t, 4),
        };
      },
      28,
      16,
    );

    const humeralHeadGeo = new THREE.SphereGeometry(0.35, 28, 22);
    humeralHeadGeo.scale(1.02, 0.96, 0.96);
    bakeTransform(humeralHeadGeo, [0.43, 0.26, 0.02], [0, -0.25, 0.35]);

    const humeralNeckGeo = buildVariableRadiusTube(
      [
        new THREE.Vector3(0.45, 0.26, 0.02),
        new THREE.Vector3(0.56, 0.16, 0.04),
      ],
      () => ({ rx: 0.24, ry: 0.24 }),
      8,
      16,
    );

    const humerusMerged = mergePartGeometries(
      [humShaftGeo, humeralHeadGeo, humeralNeckGeo],
      false,
    );
    const humerusMesh = new THREE.Mesh(humerusMerged, createBoneMat(0xf2e9d8));
    registerPart(
      root,
      'mesh_humerus',
      'humerus',
      [humerusMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      undefined,
      new THREE.Vector3(0.42, -0.1, 0),
    );

    // 10. Guzek większy (Tuberculum majus)
    const tubMajusGeo = new THREE.SphereGeometry(0.155, 20, 18);
    tubMajusGeo.scale(0.95, 1.38, 1.1);
    const tubMajusMesh = new THREE.Mesh(tubMajusGeo, createLandmarkMat(0xebd8b4));
    tubMajusMesh.position.set(0.75, 0.33, -0.04);
    registerPart(
      root,
      'mesh_tuberculum_majus',
      'tuberculum_majus',
      [tubMajusMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      tubMajusMesh.position,
      new THREE.Vector3(0.55, 0.05, -0.08),
    );

    // 11. Guzek mniejszy (Tuberculum minus)
    const tubMinusGeo = new THREE.SphereGeometry(0.12, 18, 16);
    tubMinusGeo.scale(1.0, 1.2, 0.95);
    const tubMinusMesh = new THREE.Mesh(tubMinusGeo, createLandmarkMat(0xe5cfa7));
    tubMinusMesh.position.set(0.51, 0.26, 0.33);
    registerPart(
      root,
      'mesh_tuberculum_minus',
      'tuberculum_minus',
      [tubMinusMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      tubMinusMesh.position,
      new THREE.Vector3(0.45, 0.02, 0.25),
    );

    // 12. M. nadgrzebieniowy (Mięsień nadgrzebieniowy) - tapered belly -> tendon under acromion
    const supraGeo = buildVariableRadiusTube(
      [
        new THREE.Vector3(-1.22, 0.72, -0.32),
        new THREE.Vector3(-0.62, 0.74, -0.25),
        new THREE.Vector3(-0.08, 0.66, -0.14),
        new THREE.Vector3(0.32, 0.56, -0.05),
        new THREE.Vector3(0.73, 0.43, -0.02),
      ],
      (t) => {
        const belly = 0.075 * Math.sin(Math.min(1, t * 1.15) * Math.PI);
        return { rx: 0.048 + belly * 1.15, ry: 0.04 + belly * 0.85 };
      },
      26,
      14,
      makeMuscleColorFn(0xc43446, 0.1, 0.68),
    );
    const supraMesh = new THREE.Mesh(supraGeo, createVertexMuscleMat());
    registerPart(
      root,
      'mesh_m_supraspinatus',
      'm_supraspinatus',
      [supraMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      undefined,
      new THREE.Vector3(0, 0.42, -0.15),
    );

    // 13. M. podgrzebieniowy (Mięsień podgrzebieniowy) - broad fan-shaped 2-fascicle belly -> tendon
    const infraUpper = buildVariableRadiusTube(
      [
        new THREE.Vector3(-1.18, 0.28, -0.42),
        new THREE.Vector3(-0.55, 0.38, -0.38),
        new THREE.Vector3(0.15, 0.39, -0.29),
        new THREE.Vector3(0.74, 0.33, -0.14),
      ],
      (t) => ({
        rx: 0.045 + 0.105 * Math.sin(Math.pow(t, 0.85) * Math.PI),
        ry: 0.036 + 0.075 * Math.sin(t * Math.PI),
      }),
      24,
      12,
      makeMuscleColorFn(0xb63242, 0.08, 0.74),
    );
    const infraLower = buildVariableRadiusTube(
      [
        new THREE.Vector3(-1.05, -0.35, -0.45),
        new THREE.Vector3(-0.48, 0.06, -0.42),
        new THREE.Vector3(0.16, 0.27, -0.32),
        new THREE.Vector3(0.74, 0.31, -0.15),
      ],
      (t) => ({
        rx: 0.04 + 0.105 * Math.sin(Math.pow(t, 0.85) * Math.PI),
        ry: 0.035 + 0.075 * Math.sin(t * Math.PI),
      }),
      24,
      12,
      makeMuscleColorFn(0xae2e3d, 0.08, 0.74),
    );
    const infraMerged = mergePartGeometries([infraUpper, infraLower], true);
    const infraMesh = new THREE.Mesh(infraMerged, createVertexMuscleMat());
    registerPart(
      root,
      'mesh_m_infraspinatus',
      'm_infraspinatus',
      [infraMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      undefined,
      new THREE.Vector3(-0.08, 0, -0.48),
    );

    // 14. M. obły mniejszy (Mięsień obły mniejszy)
    const teresGeo = buildVariableRadiusTube(
      [
        new THREE.Vector3(-0.84, -0.4, -0.41),
        new THREE.Vector3(-0.22, -0.08, -0.35),
        new THREE.Vector3(0.32, 0.1, -0.25),
        new THREE.Vector3(0.71, 0.2, -0.16),
      ],
      (t) => ({
        rx: 0.038 + 0.062 * Math.sin(t * Math.PI),
        ry: 0.036 + 0.058 * Math.sin(t * Math.PI),
      }),
      22,
      12,
      makeMuscleColorFn(0xce4454, 0.12, 0.78),
    );
    const teresMesh = new THREE.Mesh(teresGeo, createVertexMuscleMat());
    registerPart(
      root,
      'mesh_m_teres_minor',
      'm_teres_minor',
      [teresMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      undefined,
      new THREE.Vector3(0.05, -0.18, -0.46),
    );

    // 15. M. podłopatkowy (Mięsień podłopatkowy) - broad anterior multipennate fan -> lesser tubercle
    const subscapUpper = buildVariableRadiusTube(
      [
        new THREE.Vector3(-1.12, 0.42, -0.22),
        new THREE.Vector3(-0.42, 0.34, -0.02),
        new THREE.Vector3(0.16, 0.28, 0.21),
        new THREE.Vector3(0.52, 0.27, 0.33),
      ],
      (t) => ({
        rx: 0.05 + 0.095 * Math.sin(t * Math.PI),
        ry: 0.036 + 0.07 * Math.sin(t * Math.PI),
      }),
      24,
      12,
      makeMuscleColorFn(0xa82d3c, 0.08, 0.75),
    );
    const subscapLower = buildVariableRadiusTube(
      [
        new THREE.Vector3(-0.98, -0.32, -0.24),
        new THREE.Vector3(-0.36, 0.02, -0.02),
        new THREE.Vector3(0.16, 0.18, 0.22),
        new THREE.Vector3(0.51, 0.24, 0.33),
      ],
      (t) => ({
        rx: 0.048 + 0.095 * Math.sin(t * Math.PI),
        ry: 0.035 + 0.068 * Math.sin(t * Math.PI),
      }),
      24,
      12,
      makeMuscleColorFn(0xa22837, 0.08, 0.75),
    );
    const subscapMerged = mergePartGeometries([subscapUpper, subscapLower], true);
    const subscapMesh = new THREE.Mesh(subscapMerged, createVertexMuscleMat());
    registerPart(
      root,
      'mesh_m_subscapularis',
      'm_subscapularis',
      [subscapMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      undefined,
      new THREE.Vector3(-0.05, -0.08, 0.45),
    );

    // 16. M. naramienny (Mięsień naramienny) - WHOLE UNIFIED 3-PORTION MUSCLE (clavicular + acromial + spinal)
    // All 3 heads merge seamlessly into ONE single selectable BufferGeometry inserting onto deltoid tuberosity
    const deltoidAnterior = buildVariableRadiusTube(
      [
        new THREE.Vector3(-0.18, 0.94, 0.18),
        new THREE.Vector3(0.45, 0.68, 0.38),
        new THREE.Vector3(0.75, 0.12, 0.24),
        new THREE.Vector3(0.67, -0.68, 0.06),
      ],
      (t) => ({
        rx: 0.048 + 0.082 * Math.sin(t * Math.PI),
        ry: 0.034 + 0.052 * Math.sin(t * Math.PI),
      }),
      24,
      12,
      makeMuscleColorFn(0xd14456, 0.12, 0.78),
    );
    const deltoidMiddle = buildVariableRadiusTube(
      [
        new THREE.Vector3(0.32, 0.9, 0.02),
        new THREE.Vector3(0.88, 0.56, 0.02),
        new THREE.Vector3(0.92, -0.02, 0.04),
        new THREE.Vector3(0.68, -0.7, 0.04),
      ],
      (t) => ({
        rx: 0.055 + 0.115 * Math.sin(Math.pow(t, 0.85) * Math.PI),
        ry: 0.04 + 0.095 * Math.sin(Math.pow(t, 0.85) * Math.PI),
      }),
      24,
      14,
      makeMuscleColorFn(0xd84b5c, 0.12, 0.78),
    );
    const deltoidPosterior = buildVariableRadiusTube(
      [
        new THREE.Vector3(-0.48, 0.68, -0.32),
        new THREE.Vector3(0.36, 0.52, -0.38),
        new THREE.Vector3(0.78, 0.04, -0.22),
        new THREE.Vector3(0.67, -0.68, 0.02),
      ],
      (t) => ({
        rx: 0.046 + 0.085 * Math.sin(t * Math.PI),
        ry: 0.034 + 0.055 * Math.sin(t * Math.PI),
      }),
      24,
      12,
      makeMuscleColorFn(0xc4394a, 0.12, 0.78),
    );
    const deltoidMerged = mergePartGeometries(
      [deltoidAnterior, deltoidMiddle, deltoidPosterior],
      true,
    );
    const deltoidMesh = new THREE.Mesh(deltoidMerged, createVertexMuscleMat(0.76));
    registerPart(
      root,
      'mesh_m_deltoideus',
      'm_deltoideus',
      [deltoidMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      undefined,
      new THREE.Vector3(0.75, 0.15, 0.15),
    );

    // 17. M. dwugłowy ramienia (Mięsień dwugłowy ramienia) - WHOLE UNIFIED 2-HEAD MUSCLE
    // Long head tendon arching through intertubercular groove + short head tendon from coracoid uniting into 1 belly
    const bicepsLongHead = buildVariableRadiusTube(
      [
        new THREE.Vector3(0.08, 0.54, 0.02),
        new THREE.Vector3(0.45, 0.62, 0.1),
        new THREE.Vector3(0.62, 0.34, 0.24),
        new THREE.Vector3(0.62, -0.18, 0.29),
        new THREE.Vector3(0.58, -0.82, 0.28),
        new THREE.Vector3(0.54, -1.42, 0.2),
      ],
      (t) => {
        // Slender tendon inside groove until t~0.35, then swelling fusiform belly, then distal tendon
        const belly = 0.095 * smoothstep(0.28, 0.58, t) * (1 - smoothstep(0.62, 0.96, t));
        return { rx: 0.03 + belly, ry: 0.028 + belly * 0.9 };
      },
      28,
      12,
      makeMuscleColorFn(0xc33547, 0.34, 0.84),
    );
    const bicepsShortHead = buildVariableRadiusTube(
      [
        new THREE.Vector3(0.25, 0.43, 0.52),
        new THREE.Vector3(0.41, 0.12, 0.38),
        new THREE.Vector3(0.53, -0.25, 0.3),
        new THREE.Vector3(0.55, -0.82, 0.28),
        new THREE.Vector3(0.54, -1.42, 0.2),
      ],
      (t) => {
        const belly = 0.088 * smoothstep(0.22, 0.52, t) * (1 - smoothstep(0.62, 0.96, t));
        return { rx: 0.032 + belly, ry: 0.028 + belly * 0.9 };
      },
      26,
      12,
      makeMuscleColorFn(0xb83041, 0.25, 0.84),
    );
    const bicepsMerged = mergePartGeometries([bicepsLongHead, bicepsShortHead], true);
    const bicepsMesh = new THREE.Mesh(bicepsMerged, createVertexMuscleMat());
    registerPart(
      root,
      'mesh_m_biceps_brachii',
      'm_biceps_brachii',
      [bicepsMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      undefined,
      new THREE.Vector3(0.3, -0.2, 0.55),
    );
  } else {
    // =========================================================================
    // RIGHT KNEE & THIGH MODEL (+X lateral, -X medial, +Z anterior)
    // =========================================================================

    // 1. Kość udowa (Femur) - flared distal shaft + asymmetric condyles + trochlear bridge
    const femurShaftGeo = buildVariableRadiusTube(
      [
        new THREE.Vector3(0.0, 2.15, -0.02),
        new THREE.Vector3(0.0, 1.45, 0.0),
        new THREE.Vector3(0.0, 0.82, -0.01),
        new THREE.Vector3(0.0, 0.44, -0.03),
      ],
      (t) => ({
        rx: 0.21 + 0.19 * Math.pow(t, 2.4),
        ry: 0.2 + 0.12 * Math.pow(t, 2.4),
      }),
      22,
      16,
    );

    // Medial condyle (slightly lower & narrower) and Lateral condyle (broader anteriorly)
    const condyleMedGeo = new THREE.SphereGeometry(0.31, 24, 20);
    condyleMedGeo.scale(0.82, 0.98, 1.32);
    bakeTransform(condyleMedGeo, [-0.25, 0.31, -0.04], [0.06, -0.08, 0]);

    const condyleLatGeo = new THREE.SphereGeometry(0.31, 24, 20);
    condyleLatGeo.scale(0.88, 0.94, 1.36);
    bakeTransform(condyleLatGeo, [0.25, 0.34, -0.03], [0.06, 0.08, 0]);

    // Trochlear patellar surface bridge anteriorly
    const trochleaGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.36, 18);
    bakeTransform(trochleaGeo, [0.0, 0.41, 0.12], [0, 0, Math.PI / 2]);

    const femurMerged = mergePartGeometries(
      [femurShaftGeo, condyleMedGeo, condyleLatGeo, trochleaGeo],
      false,
    );
    const femurMesh = new THREE.Mesh(femurMerged, createBoneMat(0xf1e8d6));
    registerPart(
      root,
      'mesh_femur',
      'femur',
      [femurMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      undefined,
      new THREE.Vector3(0, 0.42, 0),
    );

    // 2. Kość piszczelowa (Tibia) - plateau + intercondylar eminence + flared triangular diaphysis
    const tibiaPlateauGeo = new THREE.CylinderGeometry(0.5, 0.36, 0.25, 28);
    tibiaPlateauGeo.scale(1.06, 1.0, 0.84);
    bakeTransform(tibiaPlateauGeo, [0, -0.34, -0.04]);

    const eminenceGeo = new THREE.ConeGeometry(0.11, 0.14, 14);
    bakeTransform(eminenceGeo, [0, -0.19, -0.02]);

    const tibiaShaftGeo = buildVariableRadiusTube(
      [
        new THREE.Vector3(-0.02, -0.45, -0.04),
        new THREE.Vector3(-0.04, -1.05, -0.04),
        new THREE.Vector3(-0.05, -1.88, -0.05),
      ],
      (t) => ({
        rx: 0.28 * (1 - 0.32 * smoothstep(0, 0.65, t)),
        ry: 0.24 * (1 - 0.28 * smoothstep(0, 0.65, t)),
      }),
      20,
      16,
    );

    const tibiaMerged = mergePartGeometries(
      [tibiaPlateauGeo, eminenceGeo, tibiaShaftGeo],
      false,
    );
    const tibiaMesh = new THREE.Mesh(tibiaMerged, createBoneMat(0xf0e6d3));
    registerPart(
      root,
      'mesh_tibia',
      'tibia',
      [tibiaMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      undefined,
      new THREE.Vector3(0, -0.35, 0),
    );

    // 3. Guzowatość kości piszczelowej (Tuberositas tibiae)
    const tubTibiaeGeo = new THREE.SphereGeometry(0.135, 20, 18);
    tubTibiaeGeo.scale(0.95, 1.45, 0.85);
    const tubTibiaeMesh = new THREE.Mesh(tubTibiaeGeo, createLandmarkMat(0xe5d1ad));
    tubTibiaeMesh.position.set(-0.02, -0.64, 0.27);
    registerPart(
      root,
      'mesh_tuberositas_tibiae',
      'tuberositas_tibiae',
      [tubTibiaeMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      tubTibiaeMesh.position,
      new THREE.Vector3(0, -0.25, 0.38),
    );

    // 4. Rzepka (Patella) - triangular sesamoid bone + patellar ligament
    const patellaShape = new THREE.Shape();
    patellaShape.moveTo(-0.2, 0.14);
    patellaShape.quadraticCurveTo(0, 0.22, 0.2, 0.14);
    patellaShape.quadraticCurveTo(0.21, -0.04, 0.04, -0.2);
    patellaShape.quadraticCurveTo(0, -0.24, -0.04, -0.2);
    patellaShape.quadraticCurveTo(-0.21, -0.04, -0.2, 0.14);

    const patellaBodyGeo = new THREE.ExtrudeGeometry(patellaShape, {
      depth: 0.09,
      bevelEnabled: true,
      bevelThickness: 0.032,
      bevelSize: 0.028,
      bevelSegments: 3,
    });
    bakeTransform(patellaBodyGeo, [0, 0.32, 0.38]);

    const patellarLigGeo = buildVariableRadiusTube(
      [
        new THREE.Vector3(0, 0.14, 0.42),
        new THREE.Vector3(-0.01, -0.24, 0.36),
        new THREE.Vector3(-0.02, -0.6, 0.29),
      ],
      () => ({ rx: 0.095, ry: 0.032 }),
      16,
      12,
    );

    const patellaMerged = mergePartGeometries([patellaBodyGeo, patellarLigGeo], false);
    const patellaMesh = new THREE.Mesh(patellaMerged, createLandmarkMat(0xf4ead6));
    registerPart(
      root,
      'mesh_patella',
      'patella',
      [patellaMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      undefined,
      new THREE.Vector3(0, 0.05, 0.58),
    );

    // 5. Głowa strzałki (Caput fibulae) + styloid apex + shaft
    const fibHeadGeo = new THREE.SphereGeometry(0.15, 20, 16);
    fibHeadGeo.scale(0.95, 1.18, 0.95);
    bakeTransform(fibHeadGeo, [0.49, -0.45, -0.14]);

    const fibApexGeo = new THREE.ConeGeometry(0.06, 0.11, 12);
    bakeTransform(fibApexGeo, [0.51, -0.29, -0.16]);

    const fibShaftGeo = buildVariableRadiusTube(
      [
        new THREE.Vector3(0.49, -0.52, -0.14),
        new THREE.Vector3(0.48, -1.2, -0.14),
        new THREE.Vector3(0.47, -1.86, -0.13),
      ],
      (t) => ({ rx: 0.085 - 0.02 * t, ry: 0.075 - 0.015 * t }),
      14,
      12,
    );

    const fibulaMerged = mergePartGeometries([fibHeadGeo, fibApexGeo, fibShaftGeo], false);
    const fibulaMesh = new THREE.Mesh(fibulaMerged, createBoneMat(0xebe0cd));
    registerPart(
      root,
      'mesh_fibula',
      'fibula_head',
      [fibulaMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      undefined,
      new THREE.Vector3(0.48, -0.28, -0.1),
    );

    // 6. Łąkotka przyśrodkowa (Meniscus medialis - wedge-profile C-shape)
    const medMenGeo = buildWedgeMeniscusGeometry(0.24, Math.PI * 1.4, 0.125, 0.085, 28);
    bakeTransform(medMenGeo, [-0.26, -0.15, -0.02], [0, Math.PI, 0]);
    const medMenMesh = new THREE.Mesh(medMenGeo, createCartilageMat(0x86efac));
    registerPart(
      root,
      'mesh_meniscus_medial',
      'meniscus_medialis',
      [medMenMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      undefined,
      new THREE.Vector3(-0.32, 0, 0.1),
    );

    // 7. Łąkotka boczna (Meniscus lateralis - wedge-profile near-O shape)
    const latMenGeo = buildWedgeMeniscusGeometry(0.215, Math.PI * 1.72, 0.12, 0.085, 30);
    bakeTransform(latMenGeo, [0.26, -0.15, -0.02], [0, 0, 0]);
    const latMenMesh = new THREE.Mesh(latMenGeo, createCartilageMat(0xa7f3d0));
    registerPart(
      root,
      'mesh_meniscus_lateral',
      'meniscus_lateralis',
      [latMenMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      undefined,
      new THREE.Vector3(0.32, 0, 0.1),
    );

    // 8. ACL (Więzadło krzyżowe przednie) - double-bundle oblique strap
    const aclGeo = buildVariableRadiusTube(
      [
        new THREE.Vector3(-0.04, -0.16, 0.14),
        new THREE.Vector3(0.06, 0.03, 0.0),
        new THREE.Vector3(0.16, 0.25, -0.14),
      ],
      () => ({ rx: 0.062, ry: 0.036 }),
      16,
      12,
    );
    const aclMesh = new THREE.Mesh(aclGeo, createLigamentMat(0xf4c430));
    registerPart(
      root,
      'mesh_acl',
      'acl',
      [aclMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      undefined,
      new THREE.Vector3(0.05, 0.05, 0.15),
    );

    // 9. PCL (Więzadło krzyżowe tylne) - thicker stout oblique strap
    const pclGeo = buildVariableRadiusTube(
      [
        new THREE.Vector3(0.03, -0.18, -0.18),
        new THREE.Vector3(-0.06, 0.05, -0.05),
        new THREE.Vector3(-0.15, 0.25, 0.05),
      ],
      () => ({ rx: 0.075, ry: 0.044 }),
      16,
      12,
    );
    const pclMesh = new THREE.Mesh(pclGeo, createLigamentMat(0xf5f7f5));
    registerPart(
      root,
      'mesh_pcl',
      'pcl',
      [pclMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      undefined,
      new THREE.Vector3(-0.05, 0.05, -0.2),
    );

    // 10. MCL (Więzadło poboczne piszczelowe) - broad flat medial strap hugging meniscus
    const mclGeo = buildVariableRadiusTube(
      [
        new THREE.Vector3(-0.49, 0.36, -0.03),
        new THREE.Vector3(-0.51, -0.06, -0.02),
        new THREE.Vector3(-0.43, -0.64, 0.02),
      ],
      (t) => ({
        rx: 0.03,
        ry: 0.095 + 0.025 * Math.sin(t * Math.PI),
      }),
      18,
      12,
    );
    const mclMesh = new THREE.Mesh(mclGeo, createLigamentMat(0xf5f7f5));
    registerPart(
      root,
      'mesh_mcl',
      'mcl',
      [mclMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      undefined,
      new THREE.Vector3(-0.48, 0, 0),
    );

    // 11. LCL (Więzadło poboczne strzałkowe) - taut round cord to fibular head
    const lclGeo = buildVariableRadiusTube(
      [
        new THREE.Vector3(0.49, 0.36, -0.06),
        new THREE.Vector3(0.54, -0.05, -0.11),
        new THREE.Vector3(0.5, -0.44, -0.14),
      ],
      () => ({ rx: 0.048, ry: 0.048 }),
      16,
      12,
    );
    const lclMesh = new THREE.Mesh(lclGeo, createLigamentMat(0xfafaf9));
    registerPart(
      root,
      'mesh_lcl',
      'lcl',
      [lclMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      undefined,
      new THREE.Vector3(0.48, 0, -0.08),
    );

    // 12. M. czworogłowy uda (Mięsień czworogłowy uda) — WHOLE UNIFIED 4-HEAD MUSCLE + COMMON TENDON
    // All 4 heads (rectus femoris, vastus lateralis, vastus medialis + VMO bulge, vastus intermedius)
    // converge into a single flat common quadriceps tendon attaching onto the patella!
    const qRectus = buildVariableRadiusTube(
      [
        new THREE.Vector3(0.0, 2.15, 0.25),
        new THREE.Vector3(0.0, 1.48, 0.36),
        new THREE.Vector3(0.0, 0.85, 0.39),
        new THREE.Vector3(0.0, 0.48, 0.41),
      ],
      (t) => ({
        rx: 0.065 + 0.115 * Math.sin(Math.pow(t, 0.8) * Math.PI),
        ry: 0.05 + 0.085 * Math.sin(Math.pow(t, 0.8) * Math.PI),
      }),
      26,
      14,
      makeMuscleColorFn(0xc93b4c, 0.1, 0.78),
    );

    const qVastusLat = buildVariableRadiusTube(
      [
        new THREE.Vector3(0.28, 2.02, 0.04),
        new THREE.Vector3(0.44, 1.32, 0.14),
        new THREE.Vector3(0.36, 0.76, 0.26),
        new THREE.Vector3(0.16, 0.46, 0.39),
      ],
      (t) => ({
        rx: 0.06 + 0.145 * Math.sin(Math.pow(t, 0.82) * Math.PI),
        ry: 0.05 + 0.115 * Math.sin(Math.pow(t, 0.82) * Math.PI),
      }),
      26,
      14,
      makeMuscleColorFn(0xb63141, 0.1, 0.8),
    );

    const qVastusMed = buildVariableRadiusTube(
      [
        new THREE.Vector3(-0.22, 1.82, 0.06),
        new THREE.Vector3(-0.34, 1.12, 0.18),
        new THREE.Vector3(-0.31, 0.62, 0.31),
        new THREE.Vector3(-0.15, 0.41, 0.4),
      ],
      (t) => {
        // Classic prominent distal oblique VMO teardrop belly around t=0.68
        const vmoBulge = 0.06 * Math.exp(-Math.pow((t - 0.7) / 0.18, 2));
        const baseBelly = 0.1 * Math.sin(t * Math.PI);
        return {
          rx: 0.05 + baseBelly + vmoBulge,
          ry: 0.045 + baseBelly * 0.85 + vmoBulge * 0.8,
        };
      },
      26,
      14,
      makeMuscleColorFn(0xd24657, 0.1, 0.84),
    );

    const qVastusInter = buildVariableRadiusTube(
      [
        new THREE.Vector3(0.0, 1.9, 0.12),
        new THREE.Vector3(0.02, 1.24, 0.21),
        new THREE.Vector3(0.0, 0.68, 0.28),
        new THREE.Vector3(0.0, 0.45, 0.38),
      ],
      (t) => ({
        rx: 0.055 + 0.105 * Math.sin(t * Math.PI),
        ry: 0.04 + 0.065 * Math.sin(t * Math.PI),
      }),
      22,
      12,
      makeMuscleColorFn(0xa22837, 0.08, 0.78),
    );

    const qCommonTendon = buildVariableRadiusTube(
      [
        new THREE.Vector3(0.0, 0.64, 0.39),
        new THREE.Vector3(0.0, 0.49, 0.42),
        new THREE.Vector3(0.0, 0.36, 0.41),
      ],
      (t) => ({
        rx: 0.22 - 0.06 * t,
        ry: 0.045,
      }),
      12,
      12,
      () => new THREE.Color(0xf5f7f5),
    );

    const quadMerged = mergePartGeometries(
      [qRectus, qVastusLat, qVastusMed, qVastusInter, qCommonTendon],
      true,
    );
    const quadMesh = new THREE.Mesh(quadMerged, createVertexMuscleMat());
    registerPart(
      root,
      'mesh_m_quadriceps_femoris',
      'm_quadriceps_femoris',
      [quadMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      undefined,
      new THREE.Vector3(0, 0.22, 0.48),
    );

    // 13. M. dwugłowy uda (Mięsień dwugłowy uda) — WHOLE UNIFIED 2-HEAD MUSCLE
    // Long head (posterior thigh) + Short head (lateral femur shaft) uniting into 1 cord tendon -> fibular head
    const bfLongHead = buildVariableRadiusTube(
      [
        new THREE.Vector3(0.16, 2.08, -0.24),
        new THREE.Vector3(0.28, 1.32, -0.32),
        new THREE.Vector3(0.38, 0.54, -0.28),
        new THREE.Vector3(0.45, -0.06, -0.2),
        new THREE.Vector3(0.49, -0.44, -0.14),
      ],
      (t) => ({
        rx: 0.04 + 0.095 * Math.sin(Math.pow(t, 0.78) * Math.PI),
        ry: 0.036 + 0.082 * Math.sin(Math.pow(t, 0.78) * Math.PI),
      }),
      26,
      12,
      makeMuscleColorFn(0xad2f3f, 0.1, 0.78),
    );
    const bfShortHead = buildVariableRadiusTube(
      [
        new THREE.Vector3(0.18, 1.18, -0.16),
        new THREE.Vector3(0.32, 0.62, -0.2),
        new THREE.Vector3(0.44, 0.0, -0.19),
        new THREE.Vector3(0.49, -0.44, -0.14),
      ],
      (t) => ({
        rx: 0.036 + 0.072 * Math.sin(t * Math.PI),
        ry: 0.034 + 0.064 * Math.sin(t * Math.PI),
      }),
      20,
      12,
      makeMuscleColorFn(0x9f2837, 0.12, 0.74),
    );
    const bicepsFemMerged = mergePartGeometries([bfLongHead, bfShortHead], true);
    const bicepsFemMesh = new THREE.Mesh(bicepsFemMerged, createVertexMuscleMat());
    registerPart(
      root,
      'mesh_m_biceps_femoris',
      'm_biceps_femoris',
      [bicepsFemMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      undefined,
      new THREE.Vector3(0.42, 0.05, -0.45),
    );

    // 14. M. półścięgnisty (Mięsień półścięgnisty) - upper belly + long slender white tendon
    const semiTendGeo = buildVariableRadiusTube(
      [
        new THREE.Vector3(-0.16, 2.06, -0.26),
        new THREE.Vector3(-0.28, 1.32, -0.34),
        new THREE.Vector3(-0.37, 0.56, -0.3),
        new THREE.Vector3(-0.42, -0.02, -0.2),
        new THREE.Vector3(-0.37, -0.44, 0.04),
        new THREE.Vector3(-0.22, -0.66, 0.22),
      ],
      (t) => {
        const upperBelly = 0.088 * Math.sin(Math.min(1, t / 0.56) * Math.PI);
        return {
          rx: 0.03 + upperBelly,
          ry: 0.028 + upperBelly * 0.9,
        };
      },
      28,
      12,
      makeMuscleColorFn(0xc43c4c, 0.08, 0.54),
    );
    const semiTendMesh = new THREE.Mesh(semiTendGeo, createVertexMuscleMat());
    registerPart(
      root,
      'mesh_m_semitendinosus',
      'm_semitendinosus',
      [semiTendMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      undefined,
      new THREE.Vector3(-0.38, 0, -0.45),
    );

    // 15. M. półbłoniasty (Mięsień półbłoniasty) - broad flat posteromedial belly
    const semiMemGeo = buildVariableRadiusTube(
      [
        new THREE.Vector3(-0.11, 1.98, -0.2),
        new THREE.Vector3(-0.22, 1.15, -0.26),
        new THREE.Vector3(-0.31, 0.38, -0.24),
        new THREE.Vector3(-0.33, -0.24, -0.16),
      ],
      (t) => ({
        rx: 0.045 + 0.088 * Math.sin(Math.pow(t, 1.15) * Math.PI),
        ry: 0.036 + 0.068 * Math.sin(t * Math.PI),
      }),
      22,
      12,
      makeMuscleColorFn(0x9e2938, 0.24, 0.82),
    );
    const semiMemMesh = new THREE.Mesh(semiMemGeo, createVertexMuscleMat());
    registerPart(
      root,
      'mesh_m_semimembranosus',
      'm_semimembranosus',
      [semiMemMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      undefined,
      new THREE.Vector3(-0.26, 0.05, -0.32),
    );

    // 16. M. podkolanowy (Mięsień podkolanowy) - flat oblique triangular fan unlocking the knee
    const popliteusGeo = buildVariableRadiusTube(
      [
        new THREE.Vector3(0.36, 0.26, -0.2),
        new THREE.Vector3(0.1, -0.1, -0.26),
        new THREE.Vector3(-0.22, -0.52, -0.24),
      ],
      (t) => ({
        rx: 0.032 + 0.072 * smoothstep(0.08, 0.95, t),
        ry: 0.024,
      }),
      18,
      12,
      makeMuscleColorFn(0xd55060, 0.22, 0.88),
    );
    const popliteusMesh = new THREE.Mesh(popliteusGeo, createVertexMuscleMat());
    registerPart(
      root,
      'mesh_m_popliteus',
      'm_popliteus',
      [popliteusMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      undefined,
      new THREE.Vector3(0, -0.1, -0.46),
    );

    // 17. Gęsia stopka (Pes anserinus) - 3 converging aponeurotic slips (krawiecki, smukły, półścięgnisty)
    const pesSartorius = buildVariableRadiusTube(
      [
        new THREE.Vector3(-0.44, -0.08, 0.14),
        new THREE.Vector3(-0.34, -0.4, 0.21),
        new THREE.Vector3(-0.18, -0.66, 0.23),
      ],
      () => ({ rx: 0.042, ry: 0.018 }),
      14,
      10,
    );
    const pesGracilis = buildVariableRadiusTube(
      [
        new THREE.Vector3(-0.47, -0.12, 0.02),
        new THREE.Vector3(-0.35, -0.44, 0.16),
        new THREE.Vector3(-0.18, -0.68, 0.23),
      ],
      () => ({ rx: 0.036, ry: 0.018 }),
      14,
      10,
    );
    const pesSemitend = buildVariableRadiusTube(
      [
        new THREE.Vector3(-0.44, -0.18, -0.1),
        new THREE.Vector3(-0.33, -0.48, 0.12),
        new THREE.Vector3(-0.18, -0.7, 0.22),
      ],
      () => ({ rx: 0.036, ry: 0.018 }),
      14,
      10,
    );
    const pesMerged = mergePartGeometries([pesSartorius, pesGracilis, pesSemitend], false);
    const pesMesh = new THREE.Mesh(pesMerged, createLigamentMat(0xf5f7f5));
    registerPart(
      root,
      'mesh_pes_anserinus',
      'pes_anserinus',
      [pesMesh],
      interactables,
      partMeshes,
      partMetas,
      disposables,
      undefined,
      new THREE.Vector3(-0.42, -0.25, 0.35),
    );
  }

  return { root, interactables, partMeshes, partMetas, disposables };
}
