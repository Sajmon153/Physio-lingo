/**
 * tests/e2e/harness/model3dInspector.ts
 * Headless 3D GLB Model Inspector, Draco Decoder Validator & Raycasting Engine
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { ZipLoader } from './zipLoader.ts';

export const REGIONAL_MODEL_PATHS: Record<string, string> = {
  head_neck: '/models/regional/head_neck.glb',
  upper_limb_left: '/models/regional/upper_limb_left.glb',
  upper_limb_right: '/models/regional/upper_limb_right.glb',
  lower_limb_left: '/models/regional/lower_limb_left.glb',
  lower_limb_right: '/models/regional/lower_limb_right.glb',
  torso: '/models/regional/torso.glb',
  full_body: '/models/body.glb',
};

export interface BoundingBox3D {
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
  size: [number, number, number];
}

export interface MeshMetadata {
  nodeIndex: number;
  meshIndex: number;
  rawName: string;
  namePl: string;
  structureId?: string;
  category: 'muscle' | 'bone' | 'joint_ligament';
  tissueType: 'muscle' | 'bone' | 'other';
  bounds: BoundingBox3D;
  isLeft: boolean;
  isRight: boolean;
}

export interface RaycastHit {
  distance: number;
  point: [number, number, number];
  mesh: MeshMetadata;
}

export interface RaycastOptions {
  layerFilter?: 'all' | 'muscle' | 'bone';
  excludedMeshIds?: string[];
  exploded?: boolean;
  explodeFactor?: number;
}

export interface DracoAssetVerification {
  wasmPresent: boolean;
  wasmValidMagic: boolean;
  wasmByteLength: number;
  decoderJsPresent: boolean;
  wrapperJsPresent: boolean;
}

export class Model3DInspector {
  private static cachedInstance: Model3DInspector | null = null;
  private gltf: any;
  private meshes: MeshMetadata[] = [];
  private sceneBounds!: BoundingBox3D;
  private rawGlbLength = 0;
  private chunk0Length = 0;

  private constructor(glbBuffer: Buffer) {
    this.rawGlbLength = glbBuffer.length;
    this.parseGlb(glbBuffer);
    this.indexMeshes();
    this.computeSceneBounds();
  }

  public static getDefault(): Model3DInspector {
    if (!Model3DInspector.cachedInstance) {
      const loader = ZipLoader.getInstance();
      const glbBuf = loader.readBinary('public/models/body.glb');
      Model3DInspector.cachedInstance = new Model3DInspector(glbBuf);
    }
    return Model3DInspector.cachedInstance;
  }

  public static fromBuffer(glbBuffer: Buffer): Model3DInspector {
    return new Model3DInspector(glbBuffer);
  }

  private parseGlb(buf: Buffer): void {
    if (buf.length < 20) {
      throw new Error(`Buffer too short for GLB: ${buf.length} bytes`);
    }
    const magic = buf.toString('utf8', 0, 4);
    if (magic !== 'glTF') {
      throw new Error(`Invalid GLB magic: expected 'glTF', got '${magic}'`);
    }
    const version = buf.readUInt32LE(4);
    if (version !== 2) {
      throw new Error(`Unsupported glTF version: ${version}`);
    }

    this.chunk0Length = buf.readUInt32LE(12);
    const chunk0Type = buf.toString('utf8', 16, 20);
    if (chunk0Type !== 'JSON') {
      throw new Error(`Expected chunk 0 to be JSON, got '${chunk0Type}'`);
    }

    const jsonStr = buf.toString('utf8', 20, 20 + this.chunk0Length);
    this.gltf = JSON.parse(jsonStr);
  }

  private indexMeshes(): void {
    const nodes = this.gltf.nodes || [];
    const meshes = this.gltf.meshes || [];
    const accessors = this.gltf.accessors || [];

    for (let nodeIdx = 0; nodeIdx < nodes.length; nodeIdx++) {
      const node = nodes[nodeIdx];
      if (node.mesh === undefined) continue;

      const rawName: string = node.name || `Mesh_${nodeIdx}`;
      const meshObj = meshes[node.mesh];
      if (!meshObj || !meshObj.primitives || !meshObj.primitives.length) continue;

      const prim = meshObj.primitives[0];
      const posAccIdx = prim.attributes?.POSITION;
      const acc = posAccIdx !== undefined ? accessors[posAccIdx] : undefined;

      const min: [number, number, number] = acc?.min ? [acc.min[0], acc.min[1], acc.min[2]] : [0, 0, 0];
      const max: [number, number, number] = acc?.max ? [acc.max[0], acc.max[1], acc.max[2]] : [0, 0, 0];

      const center: [number, number, number] = [
        (min[0] + max[0]) / 2,
        (min[1] + max[1]) / 2,
        (min[2] + max[2]) / 2,
      ];
      const size: [number, number, number] = [
        max[0] - min[0],
        max[1] - min[1],
        max[2] - min[2],
      ];

      const lowName = rawName.toLowerCase();
      const isLeft = /\b(left|lt)\b|[_.]l$/i.test(rawName) || min[0] < -0.01;
      const isRight = /\b(right|rt)\b|[_.]r$/i.test(rawName) || min[0] > 0.01;

      // Anatomical categorization
      let category: 'muscle' | 'bone' | 'joint_ligament' = 'bone';
      let tissueType: 'muscle' | 'bone' | 'other' = 'bone';

      if (
        /\b(muscle|pectoralis|biceps|triceps|deltoid|gluteus|rectus|oblique|gastrocnemius|soleus|sartorius|gracilis|trapezius|latissimus|quadriceps|vastus|infraspinatus|supraspinatus|subscapularis|teres|brachialis|pronator|supinator|flexor|extensor|adductor|abductor|serratus|levator|rhomboid|pectineus|iliopsoas|psoas|iliacus|piriformis|gemellus|obturator|quadratus|popliteus|tibialis|peroneus|fibularis|interossei|lumbrical|masseter|temporalis|pterygoid|orbicularis|frontalis|occipitalis|splenius|semispinalis|longissimus|iliocostalis|spinalis|scalene|sternocleidomastoid|hyoid)\b/i.test(
          lowName
        )
      ) {
        category = 'muscle';
        tissueType = 'muscle';
      } else if (
        /\b(bursa|cartilage|ligament|meniscus|tendon|sheath|disc|capsule|labrum|retinaculum|aponeurosis|fascia)\b/i.test(
          lowName
        )
      ) {
        category = 'joint_ligament';
        tissueType = 'other';
      }

      this.meshes.push({
        nodeIndex: nodeIdx,
        meshIndex: node.mesh,
        rawName,
        namePl: rawName,
        category,
        tissueType,
        bounds: { min, max, center, size },
        isLeft,
        isRight,
      });
    }
  }

  private computeSceneBounds(): void {
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    for (const m of this.meshes) {
      minX = Math.min(minX, m.bounds.min[0]);
      minY = Math.min(minY, m.bounds.min[1]);
      minZ = Math.min(minZ, m.bounds.min[2]);
      maxX = Math.max(maxX, m.bounds.max[0]);
      maxY = Math.max(maxY, m.bounds.max[1]);
      maxZ = Math.max(maxZ, m.bounds.max[2]);
    }

    this.sceneBounds = {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
      center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
      size: [maxX - minX, maxY - minY, maxZ - minZ],
    };
  }

  // --- Public Getters ---

  public getTotalMeshCount(): number {
    return this.meshes.length;
  }

  public getAllMeshes(): MeshMetadata[] {
    return [...this.meshes];
  }

  public getRawGlbLength(): number {
    return this.rawGlbLength;
  }

  public getChunk0Length(): number {
    return this.chunk0Length;
  }

  public getSceneBounds(): BoundingBox3D {
    return { ...this.sceneBounds };
  }

  public getExtensionsRequired(): string[] {
    return this.gltf?.extensionsRequired || [];
  }

  public getExtensionsUsed(): string[] {
    return this.gltf?.extensionsUsed || [];
  }

  public findMesh(predicate: (m: MeshMetadata) => boolean): MeshMetadata | undefined {
    return this.meshes.find(predicate);
  }

  public filterMeshes(predicate: (m: MeshMetadata) => boolean): MeshMetadata[] {
    return this.meshes.filter(predicate);
  }

  public getMeshesByCategory(category: 'muscle' | 'bone' | 'joint_ligament'): MeshMetadata[] {
    return this.meshes.filter((m) => m.category === category);
  }

  public getMeshesByTissueType(tissue: 'muscle' | 'bone' | 'other'): MeshMetadata[] {
    return this.meshes.filter((m) => m.tissueType === tissue);
  }

  public getMeshBounds(name: string): BoundingBox3D | undefined {
    const mesh = this.findMesh((m) => m.rawName.toLowerCase() === name.toLowerCase() || m.rawName.includes(name));
    return mesh?.bounds;
  }

  // --- Regional Model Loading & Partitioning ---

  public static fromRegional(regionName: string): Model3DInspector {
    const filename = regionName.endsWith('.glb') ? regionName : `${regionName}.glb`;
    const regionalPath = path.resolve(process.cwd(), 'public/models/regional', filename);

    if (fs.existsSync(regionalPath)) {
      const buf = fs.readFileSync(regionalPath);
      return new Model3DInspector(buf);
    }

    // Partition from master model
    const defaultInst = Model3DInspector.getDefault();
    const buf = ZipLoader.getInstance().readBinary('public/models/body.glb');
    const partitioned = new Model3DInspector(buf);

    partitioned.meshes = defaultInst.meshes.filter((m) => {
      const name = m.rawName.toLowerCase();
      const cy = m.bounds.center[1];
      const cx = m.bounds.center[0];

      if (regionName.includes('head_neck')) {
        return cy >= 1.45 || /skull|cranium|mandib|maxill|nasal|tooth|teeth|tongue|hyoid|alar|septal|facial|temporalis|masseter/i.test(name);
      }
      if (regionName.includes('upper_limb_left')) {
        return (cx < -0.05 && cy <= 1.55 && cy >= 0.70) || /left.*(humer|radius|ulna|scapul|clavic|hand|biceps|triceps|deltoid)/i.test(name) || (/\.001/i.test(name) && /humer|radius|ulna/i.test(name));
      }
      if (regionName.includes('upper_limb_right')) {
        return (cx > 0.05 && cy <= 1.55 && cy >= 0.70) || /right.*(humer|radius|ulna|scapul|clavic|hand|biceps|triceps|deltoid)/i.test(name);
      }
      if (regionName.includes('lower_limb_left')) {
        return (cx < -0.01 && cy <= 0.95) || /left.*(femur|patella|tibia|fibula|foot|gastrocnemius|soleus|quadriceps)/i.test(name) || (/\.001/i.test(name) && /femur|tibia|patella/i.test(name));
      }
      if (regionName.includes('lower_limb_right') || regionName === 'lower_limb') {
        return (cy <= 0.95) || /femur|patella|tibia|fibula|foot/i.test(name);
      }
      if (regionName.includes('torso')) {
        return (cy >= 0.85 && cy <= 1.50) || /sternum|rib|costa|vertebra|sacrum|coccyx|pelvis|ilium|pectoralis|rectus/i.test(name);
      }
      return true;
    });

    partitioned.computeSceneBounds();
    return partitioned;
  }

  // --- Specialized Anatomy Helpers ---

  public getNoseMeshes(): MeshMetadata[] {
    return this.meshes.filter((m) =>
      /nasal|alar|septi|nasalis/i.test(m.rawName)
    );
  }

  public static getFdiCodeForMesh(rawName: string): number | undefined {
    const low = rawName.toLowerCase();
    const isLeft = rawName.includes('.001') || low.includes('left');

    if (low.includes('upper') || low.includes('maxill')) {
      const quadrant = isLeft ? 2 : 1;
      let toothNum = 0;
      if (low.includes('medial incisor') || low.includes('central incisor')) toothNum = 1;
      else if (low.includes('lateral incisor')) toothNum = 2;
      else if (low.includes('canine')) toothNum = 3;
      else if (low.includes('first premolar')) toothNum = 4;
      else if (low.includes('second premolar')) toothNum = 5;
      else if (low.includes('first molar')) toothNum = 6;
      else if (low.includes('second molar')) toothNum = 7;
      if (toothNum > 0) return quadrant * 10 + toothNum;
    } else if (low.includes('lower') || low.includes('mandib')) {
      const quadrant = isLeft ? 3 : 4;
      let toothNum = 0;
      if (low.includes('medial incisor') || low.includes('central incisor')) toothNum = 1;
      else if (low.includes('lateral incisor')) toothNum = 2;
      else if (low.includes('canine')) toothNum = 3;
      else if (low.includes('first premolar')) toothNum = 4;
      else if (low.includes('second premolar')) toothNum = 5;
      else if (low.includes('first molar')) toothNum = 6;
      else if (low.includes('second molar')) toothNum = 7;
      if (toothNum > 0) return quadrant * 10 + toothNum;
    }

    return undefined;
  }

  public getTeethMeshes(): (MeshMetadata & { fdiNumber: number })[] {
    const results: (MeshMetadata & { fdiNumber: number })[] = [];
    const seenCodes = new Set<number>();

    for (const m of this.meshes) {
      const fdi = Model3DInspector.getFdiCodeForMesh(m.rawName);
      if (fdi !== undefined && !seenCodes.has(fdi)) {
        seenCodes.add(fdi);
        results.push({ ...m, fdiNumber: fdi });
      }
    }

    results.sort((a, b) => a.fdiNumber - b.fdiNumber);
    return results;
  }

  public getVertebraeMeshes(): (MeshMetadata & { vertebraId: string; level: string })[] {
    const results: (MeshMetadata & { vertebraId: string; level: string })[] = [];

    for (const m of this.meshes) {
      const match = m.rawName.match(/Vertebra\s+([CTL])(\d+)|Atlas\s*\((C1)\)|Axis\s*\((C2)\)|(Sacrum)|(Coccyx)/i);
      if (match) {
        let level = '';
        if (match[3]) level = 'C1';
        else if (match[4]) level = 'C2';
        else if (match[1] && match[2]) {
          const prefix = match[1].toUpperCase() === 'T' ? 'Th' : match[1].toUpperCase();
          level = `${prefix}${match[2]}`;
        } else if (match[5]) level = 'Sacrum';
        else if (match[6]) level = 'Coccyx';

        results.push({
          ...m,
          vertebraId: `vertebra_${level.toLowerCase()}`,
          level,
        });
      }
    }

    return results;
  }

  public static isCartilageMesh(rawName: string): boolean {
    return /(cartilag|chondr|menisc)/i.test(rawName);
  }

  public static getCartilageMaterialProperties() {
    return {
      color: 0x7fd2ec,
      roughness: 0.22,
      transmission: 0.35,
      isPhysical: true,
    };
  }

  public static getBoneMaterialProperties() {
    return {
      color: 0xefe5d2,
      roughness: 0.72,
      isStandard: true,
    };
  }

  public static computeFocusTargetAndDistance(
    bounds: BoundingBox3D,
    aspect = 1.0,
    fov = 45
  ): { target: [number, number, number]; distance: number; cameraPosition: [number, number, number] } {
    const radius = Math.max(
      Math.hypot(bounds.size[0], bounds.size[1], bounds.size[2]) / 2,
      0.035
    );
    const fovRad = (fov * Math.PI) / 180;
    let distance = radius / Math.sin(fovRad / 2);

    if (aspect < 1.0) {
      distance /= aspect;
    }

    const target = bounds.center;
    const offsetLen = Math.hypot(0.18, 0.12, 0.98);
    const cameraPosition: [number, number, number] = [
      target[0] + (0.18 / offsetLen) * distance,
      target[1] + (0.12 / offsetLen) * distance,
      target[2] + (0.98 / offsetLen) * distance,
    ];

    return { target, distance, cameraPosition };
  }

  // --- Raycasting Math (Slab Method) ---

  public raycast(
    origin: [number, number, number],
    direction: [number, number, number],
    options: RaycastOptions = {}
  ): RaycastHit[] {
    const { layerFilter = 'all', excludedMeshIds = [], exploded = false, explodeFactor = 0.3 } = options;

    const len = Math.hypot(direction[0], direction[1], direction[2]);
    if (len === 0) return [];
    const dir: [number, number, number] = [
      direction[0] / len,
      direction[1] / len,
      direction[2] / len,
    ];

    const hits: RaycastHit[] = [];

    for (const mesh of this.meshes) {
      if (layerFilter === 'muscle' && mesh.tissueType !== 'muscle') continue;
      if (layerFilter === 'bone' && mesh.tissueType !== 'bone') continue;
      if (excludedMeshIds.includes(mesh.rawName)) continue;

      let bMin = [...mesh.bounds.min] as [number, number, number];
      let bMax = [...mesh.bounds.max] as [number, number, number];

      if (exploded) {
        const dx = (mesh.bounds.center[0] - this.sceneBounds.center[0]) * explodeFactor;
        const dy = (mesh.bounds.center[1] - this.sceneBounds.center[1]) * explodeFactor;
        const dz = (mesh.bounds.center[2] - this.sceneBounds.center[2]) * explodeFactor;
        bMin = [bMin[0] + dx, bMin[1] + dy, bMin[2] + dz];
        bMax = [bMax[0] + dx, bMax[1] + dy, bMax[2] + dz];
      }

      const t = this.intersectRayBox(origin, dir, bMin, bMax);
      if (t !== null && t >= 0) {
        const point: [number, number, number] = [
          origin[0] + dir[0] * t,
          origin[1] + dir[1] * t,
          origin[2] + dir[2] * t,
        ];
        hits.push({ distance: t, point, mesh });
      }
    }

    hits.sort((a, b) => a.distance - b.distance);
    return hits;
  }

  private intersectRayBox(
    rayOrigin: [number, number, number],
    rayDir: [number, number, number],
    boxMin: [number, number, number],
    boxMax: [number, number, number]
  ): number | null {
    let tmin = -Infinity;
    let tmax = Infinity;

    for (let i = 0; i < 3; i++) {
      const invD = 1.0 / (Math.abs(rayDir[i]) < 1e-12 ? (rayDir[i] < 0 ? -1e-12 : 1e-12) : rayDir[i]);
      let t0 = (boxMin[i] - rayOrigin[i]) * invD;
      let t1 = (boxMax[i] - rayOrigin[i]) * invD;
      if (invD < 0) {
        const tmp = t0;
        t0 = t1;
        t1 = tmp;
      }
      tmin = Math.max(tmin, t0);
      tmax = Math.min(tmax, t1);
      if (tmax <= tmin) return null;
    }
    if (tmax < 0) return null;
    return tmin >= 0 ? tmin : tmax;
  }

  // --- Static Asset Integrity Checks ---

  public static verifyDracoAssets(): DracoAssetVerification {
    const loader = ZipLoader.getInstance();
    let wasmPresent = false;
    let wasmValidMagic = false;
    let wasmByteLength = 0;
    let decoderJsPresent = false;
    let wrapperJsPresent = false;

    try {
      if (loader.hasFile('public/draco/draco_decoder.wasm')) {
        wasmPresent = true;
        const buf = loader.readBinary('public/draco/draco_decoder.wasm');
        wasmByteLength = buf.length;
        if (
          buf.length >= 4 &&
          buf[0] === 0x00 &&
          buf[1] === 0x61 &&
          buf[2] === 0x73 &&
          buf[3] === 0x6d
        ) {
          wasmValidMagic = true;
        }
      }
    } catch {}

    try {
      decoderJsPresent = loader.hasFile('public/draco/draco_decoder.js');
    } catch {}

    try {
      wrapperJsPresent = loader.hasFile('public/draco/draco_wasm_wrapper.js');
    } catch {}

    return {
      wasmPresent,
      wasmValidMagic,
      wasmByteLength,
      decoderJsPresent,
      wrapperJsPresent,
    };
  }

  public static shouldSuppressRaycast(
    downPos: { x: number; y: number },
    upPos: { x: number; y: number },
    thresholdPx = 6
  ): boolean {
    const dx = upPos.x - downPos.x;
    const dy = upPos.y - downPos.y;
    return Math.hypot(dx, dy) > thresholdPx;
  }
}
