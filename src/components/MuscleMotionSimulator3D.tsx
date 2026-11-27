import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  ArrowLeftRight,
  Compass,
  Crosshair,
  Gauge,
  GitCommitHorizontal,
  Move,
  Pause,
  Play,
  Rotate3d,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { ANATOMY_MAP } from '../data/anatomyDb';
import { MUSCLE_ACTIONS_MAP } from '../data/muscleActionsDb';
import type { MuscleActionProfile, MuscleKinematicPreset } from '../data/muscleActionsTypes';
import { computeClickOrbitGoal } from '../three/cameraFocus';
import {
  classifyBoneSegment,
  computeAnatomicalJointAxis,
  computeFiberBundlePoints,
  computeJointPivotFromBoneBoxes,
  computePlaneHelperBasis,
  computeProtractorArcPoints,
  deformMuscleGeometryInPlace,
  evaluateKinematicFrame,
  normalizeGlbNodeName,
  prepareDeformableMuscle,
  sampleBoneSurfacePoints,
  SIMULATOR_SCENE_FILES,
  type KinematicSimulationMode,
  type PreparedDeformableMuscle,
  type SimpleBox3,
  type Vec3Tuple,
} from '../three/muscleKinematics';

interface MuscleMotionSimulator3DProps {
  profile: MuscleActionProfile;
  activePresetId?: string;
  onSelectPreset?: (presetId: string) => void;
  /** Hides muscle/movement names in quiz mode so user identifies the motion visually */
  maskedQuizMode?: boolean;
  /** Compact height for quiz card embedding */
  compact?: boolean;
  isDarkMode?: boolean;
}

// Module-level GLB scene template cache so switching muscles is instant (<10ms!)
const glbCache = new Map<string, Promise<THREE.Group>>();

let sharedLoader: GLTFLoader | null = null;
function getGltfLoader(): GLTFLoader {
  if (!sharedLoader) {
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');
    loader.setDRACOLoader(draco);
    sharedLoader = loader;
  }
  return sharedLoader;
}

function loadGlbTemplate(url: string): Promise<THREE.Group> {
  let promise = glbCache.get(url);
  if (!promise) {
    promise = new Promise<THREE.Group>((resolve, reject) => {
      getGltfLoader().load(
        url,
        (gltf) => resolve(gltf.scene),
        undefined,
        (err) => {
          glbCache.delete(url);
          reject(err);
        },
      );
    });
    glbCache.set(url, promise);
  }
  return promise;
}

function toVec3(v: Vec3Tuple): THREE.Vector3 {
  return new THREE.Vector3(v.x, v.y, v.z);
}

interface DeformableMeshInstance {
  mesh: THREE.Mesh;
  prepared: PreparedDeformableMuscle;
  isActiveSubpart: boolean;
  usesScapulaProximal: boolean;
  referenceStretchRatio: number;
}

interface RigRuntime {
  root: THREE.Group;
  proximalPivot: THREE.Group;
  proximalOffset: THREE.Group;
  distalPivot: THREE.Group;
  distalOffset: THREE.Group;
  distalTracksGlenoid: boolean;
  scapulaPivot: THREE.Group;
  scapulaOffset: THREE.Group;
  scapulaPivotPos: Vec3Tuple;
  patellaPivot: THREE.Group;
  patellaOffset: THREE.Group;
  pivotPos: Vec3Tuple;
  boneBoxes: Record<string, SimpleBox3>;
  agonistMeshes: DeformableMeshInstance[];
  activeMuscleMat: THREE.MeshStandardMaterial;
  passiveMuscleMat: THREE.MeshStandardMaterial;
  antagonistMeshes: DeformableMeshInstance[];
  antagonistMat: THREE.MeshStandardMaterial;
  antagonistNamePl: string | null;
  vectorGroup: THREE.Group;
  ppMarker: THREE.Mesh;
  pkMarker: THREE.Mesh;
  fiberMeshes: THREE.Mesh[];
  fiberMaterial: THREE.MeshStandardMaterial;
  planeHelperGroup: THREE.Group;
  axisRodMesh: THREE.Mesh;
  protractorLine: THREE.Line;
  protractorMaterial: THREE.LineBasicMaterial;
  disposables: Array<{ dispose: () => void }>;
  focusCenter: THREE.Vector3;
  focusRadius: number;
}

export const MuscleMotionSimulator3D: React.FC<MuscleMotionSimulator3DProps> = ({
  profile,
  activePresetId,
  onSelectPreset,
  maskedQuizMode = false,
  compact = false,
  isDarkMode = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rigRef = useRef<RigRuntime | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraTweenRef = useRef<{
    targetPos: THREE.Vector3;
    targetLookAt: THREE.Vector3;
    active: boolean;
  }>({
    targetPos: new THREE.Vector3(),
    targetLookAt: new THREE.Vector3(),
    active: false,
  });

  const activePreset: MuscleKinematicPreset = useMemo(() => {
    if (activePresetId) {
      const found = profile.kinematicPresets.find((p) => p.id === activePresetId);
      if (found) return found;
    }
    return profile.kinematicPresets[0];
  }, [profile, activePresetId]);

  const [isPlaying, setIsPlaying] = useState(true);
  const [progress01, setProgress01] = useState(0);
  const [speed, setSpeed] = useState<0.5 | 1>(1);
  const [simMode, setSimMode] = useState<KinematicSimulationMode>('concentric');
  const [showPlaneAndAxis, setShowPlaneAndAxis] = useState(!maskedQuizMode);
  const [showAntagonist, setShowAntagonist] = useState(false);
  const [showForceVectors, setShowForceVectors] = useState(false);
  const [availableAntagonistPl, setAvailableAntagonistPl] = useState<string | null>(null);
  const [touchMode, setTouchMode] = useState<'rotate' | 'pan'>('rotate');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  // Refs synced for animation loop
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const progressRef = useRef(progress01);
  progressRef.current = progress01;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const simModeRef = useRef(simMode);
  simModeRef.current = simMode;
  const activePresetRef = useRef(activePreset);
  activePresetRef.current = activePreset;
  const showPlaneAndAxisRef = useRef(showPlaneAndAxis);
  showPlaneAndAxisRef.current = showPlaneAndAxis;
  const showAntagonistRef = useRef(showAntagonist);
  showAntagonistRef.current = showAntagonist;
  const showForceVectorsRef = useRef(showForceVectors);
  showForceVectorsRef.current = showForceVectors;

  const sliderValueRef = useRef<HTMLInputElement | null>(null);
  const angleBadgeRef = useRef<HTMLSpanElement | null>(null);
  const strainBadgeRef = useRef<HTMLSpanElement | null>(null);

  // Reset mode when switching muscles or presets
  useEffect(() => {
    setSimMode('concentric');
    setProgress01(0);
    progressRef.current = 0;
    setIsPlaying(true);
  }, [profile.muscleId, activePreset.id]);

  // Keep OrbitControls touch mode synced
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.touches = {
      ONE: touchMode === 'pan' ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
  }, [touchMode]);

  // Sync toggleable 3D helpers immediately
  useEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;
    rig.planeHelperGroup.visible = showPlaneAndAxis && !maskedQuizMode;
  }, [showPlaneAndAxis, maskedQuizMode]);

  useEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;
    for (const ant of rig.antagonistMeshes) {
      ant.mesh.visible = showAntagonist && !maskedQuizMode;
    }
  }, [showAntagonist, maskedQuizMode]);

  useEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;
    rig.vectorGroup.visible = showForceVectors;
  }, [showForceVectors]);

  // Update background on dark mode change
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(isDarkMode ? 0x0c1711 : 0xf2f8f4);
    }
  }, [isDarkMode]);

  const applyRigFrame = (t01: number) => {
    const rig = rigRef.current;
    if (!rig) return;
    const preset = activePresetRef.current;
    const mode = simModeRef.current;
    const frame = evaluateKinematicFrame(preset, t01, mode, rig.boneBoxes);

    // 1. Reset all bone pivots to rest state
    rig.proximalPivot.quaternion.identity();
    rig.proximalPivot.position.set(rig.pivotPos.x, rig.pivotPos.y, rig.pivotPos.z);
    rig.distalPivot.quaternion.identity();
    rig.distalPivot.position.set(rig.pivotPos.x, rig.pivotPos.y, rig.pivotPos.z);
    rig.scapulaPivot.quaternion.identity();
    rig.scapulaPivot.position.set(
      rig.scapulaPivotPos.x,
      rig.scapulaPivotPos.y,
      rig.scapulaPivotPos.z,
    );
    rig.patellaPivot.quaternion.identity();
    rig.patellaPivot.position.set(rig.pivotPos.x, rig.pivotPos.y, rig.pivotPos.z);

    // 2. Apply coupled scapulohumeral rhythm (2:1) & patellar tracking first so glenoid position is up to date
    if (frame.coupledScapulaDeg !== 0) {
      const scapAxis =
        frame.coupledScapulaAxis === 'x'
          ? new THREE.Vector3(1, 0, 0)
          : new THREE.Vector3(0, 0, 1);
      rig.scapulaPivot.quaternion.setFromAxisAngle(
        scapAxis,
        (frame.coupledScapulaDeg * Math.PI) / 180,
      );
    }
    if (frame.coupledPatellaDeg !== 0) {
      rig.patellaPivot.quaternion.setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        (frame.coupledPatellaDeg * Math.PI) / 180,
      );
    }

    // 3. Apply true 3D anatomical quaternion rotation & translation to the moving segment
    // (When scapula co-rotates in open-chain shoulder motion, seat distalPivot directly on the rotated glenoid!)
    const targetPivot =
      frame.movingSegment === 'distal' ? rig.distalPivot : rig.proximalPivot;
    targetPivot.quaternion.set(
      frame.quaternion.x,
      frame.quaternion.y,
      frame.quaternion.z,
      frame.quaternion.w,
    );
    if (frame.movingSegment === 'distal' && frame.coupledScapulaDeg !== 0 && rig.distalTracksGlenoid) {
      rig.proximalPivot.updateMatrixWorld(true);
      const liveGlenoid = new THREE.Vector3(
        rig.pivotPos.x,
        rig.pivotPos.y,
        rig.pivotPos.z,
      ).applyMatrix4(rig.scapulaOffset.matrixWorld);
      targetPivot.position.set(
        liveGlenoid.x + frame.translationMeters.x,
        liveGlenoid.y + frame.translationMeters.y,
        liveGlenoid.z + frame.translationMeters.z,
      );
    } else {
      targetPivot.position.set(
        rig.pivotPos.x + frame.translationMeters.x,
        rig.pivotPos.y + frame.translationMeters.y,
        rig.pivotPos.z + frame.translationMeters.z,
      );
    }

    rig.root.updateMatrixWorld(true);

    // 4. Deform ALL real 3D Z-Anatomy agonist muscle meshes (active akton + passive heads) in real time!
    const proxWorldMat = rig.proximalOffset.matrixWorld;
    const scapWorldMat = rig.scapulaOffset.matrixWorld;
    const distWorldMat = rig.distalOffset.matrixWorld;

    let sumStretchRatio = 0;
    let activeStretchCount = 0;
    let primaryPpWorld: Vec3Tuple | null = null;
    let primaryPkWorld: Vec3Tuple | null = null;

    for (const inst of rig.agonistMeshes) {
      const effectiveProx = inst.usesScapulaProximal ? scapWorldMat : proxWorldMat;
      const { ppWorld, pkWorld, stretchRatio } = deformMuscleGeometryInPlace({
        prepared: inst.prepared,
        targetGeometry: inst.mesh.geometry,
        proximalMatrix: effectiveProx,
        distalMatrix: distWorldMat,
        jointPivot: rig.pivotPos,
        bulgeGain: inst.isActiveSubpart ? 1.15 : 0.35,
        facialContractionT: frame.motionT,
        referenceStretchRatio: inst.referenceStretchRatio,
      });
      if (inst.isActiveSubpart && !inst.prepared.isSingleSegment) {
        sumStretchRatio += stretchRatio;
        activeStretchCount += 1;
        if (!primaryPpWorld) {
          primaryPpWorld = ppWorld;
          primaryPkWorld = pkWorld;
        }
      }
    }

    // 5. Deform real 3D antagonist muscle meshes (when visible — visibly elongating & slimming!)
    if (showAntagonistRef.current && !maskedQuizMode) {
      for (const ant of rig.antagonistMeshes) {
        const effectiveProx = ant.usesScapulaProximal ? scapWorldMat : proxWorldMat;
        deformMuscleGeometryInPlace({
          prepared: ant.prepared,
          targetGeometry: ant.mesh.geometry,
          proximalMatrix: effectiveProx,
          distalMatrix: distWorldMat,
          jointPivot: rig.pivotPos,
          bulgeGain: 0.85,
        });
      }
    }

    // 6. Modulate physiological muscle material color & contraction sheen
    const act = frame.fiberActivation;
    if (mode === 'eccentric') {
      // Braking tension: warm terracotta-amber muscle tone
      rig.activeMuscleMat.color.setRGB(0.76 + 0.16 * act, 0.24 + 0.12 * act, 0.14);
      rig.activeMuscleMat.emissive.setRGB(0.32 * act, 0.1 * act, 0.02);
    } else if (mode === 'closed_chain') {
      // Closed kinetic chain contraction: rich crimson muscle tone
      rig.activeMuscleMat.color.setRGB(0.74 + 0.18 * act, 0.16 + 0.04 * act, 0.22);
      rig.activeMuscleMat.emissive.setRGB(0.34 * act, 0.05 * act, 0.08 * act);
    } else {
      // Concentric contraction: resting anatomical dark red -> vivid contracting crimson
      rig.activeMuscleMat.color.setRGB(0.72 + 0.2 * act, 0.15 + 0.03 * act, 0.2 + 0.03 * act);
      rig.activeMuscleMat.emissive.setRGB(0.36 * act, 0.04 * act, 0.07 * act);
    }

    // 7. Update optional PP-PK force vectors when enabled
    if (showForceVectorsRef.current && primaryPpWorld && primaryPkWorld) {
      rig.ppMarker.position.set(primaryPpWorld.x, primaryPpWorld.y, primaryPpWorld.z);
      rig.pkMarker.position.set(primaryPkWorld.x, primaryPkWorld.y, primaryPkWorld.z);
      const strands = computeFiberBundlePoints(
        primaryPpWorld,
        primaryPkWorld,
        frame.bellyBulgeScale,
        5,
        11,
      );
      const baseRadius = 0.0034 * frame.fiberThicknessScale;
      for (let i = 0; i < rig.fiberMeshes.length; i += 1) {
        const mesh = rig.fiberMeshes[i];
        const pts = strands[i];
        if (!pts || pts.length < 2) {
          mesh.visible = false;
          continue;
        }
        mesh.visible = true;
        const curve = new THREE.CatmullRomCurve3(
          pts.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
        );
        const newGeom = new THREE.TubeGeometry(curve, 12, baseRadius, 6, false);
        mesh.geometry.dispose();
        mesh.geometry = newGeom;
      }
    }

    // 8. Update 3D SFTR protractor arc around the true joint axis
    const arcRadius = Math.max(0.055, Math.min(0.14, rig.focusRadius * 0.34));
    const effectiveStartDeg =
      Math.abs(preset.endDeg - preset.startDeg) < 0.5 && preset.secondaryRot
        ? preset.secondaryRot.startDeg
        : preset.startDeg;
    const arcPts = computeProtractorArcPoints(
      rig.pivotPos,
      frame.axisWorld,
      effectiveStartDeg,
      frame.currentAngleDeg,
      arcRadius,
      20,
    );
    if (arcPts.length >= 2) {
      rig.protractorLine.visible = true;
      rig.protractorLine.geometry.dispose();
      rig.protractorLine.geometry = new THREE.BufferGeometry().setFromPoints(
        arcPts.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
      );
    } else {
      rig.protractorLine.visible = false;
    }

    // 9. Update live HUD badges (angle + physical muscle strain %!)
    if (angleBadgeRef.current) {
      angleBadgeRef.current.textContent =
        frame.totalRangeDeg > 0
          ? `${frame.sweepAngleDeg}° / ${frame.totalRangeDeg}°`
          : `${Math.round(frame.motionT * 100)}%`;
    }
    if (strainBadgeRef.current && activeStretchCount > 0) {
      const avgLambda = sumStretchRatio / activeStretchCount;
      const pct = Math.round((avgLambda - 1) * 100);
      if (mode === 'eccentric') {
        strainBadgeRef.current.textContent = `Hamowanie ekscentryczne (${pct <= 0 ? pct : `+${pct}`}% dł.)`;
      } else if (pct < -1) {
        strainBadgeRef.current.textContent = `Skrócenie brzuśca: ${pct}%`;
      } else if (pct > 1) {
        strainBadgeRef.current.textContent = `Wydłużenie: +${pct}%`;
      } else {
        strainBadgeRef.current.textContent = 'Długość spoczynkowa (0%)';
      }
    }
  };

  // Initialize Three.js WebGL stage once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglUnavailable(true);
      setIsLoading(false);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth || 480, container.clientHeight || 360);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none';
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isDarkMode ? 0x0c1711 : 0xf2f8f4);
    sceneRef.current = scene;

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const hemi = new THREE.HemisphereLight(0xffffff, 0xc7dbd0, 0.92);
    scene.add(hemi);
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.15);
    keyLight.position.set(1.5, 2.5, 2.2);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xd1fae5, 0.6);
    rimLight.position.set(-1.8, 1.4, -1.6);
    scene.add(rimLight);

    const camera = new THREE.PerspectiveCamera(
      40,
      (container.clientWidth || 480) / Math.max(1, container.clientHeight || 360),
      0.02,
      20,
    );
    camera.position.set(-0.55, 1.25, 0.85);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.14;
    controls.maxDistance = 3.2;
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    controlsRef.current = controls;

    // Click-to-pivot camera focus on any clicked bone or deforming muscle
    const raycaster = new THREE.Raycaster();
    const activePointerIds = new Set<number>();
    let downX = 0;
    let downY = 0;
    let hadMultiTouch = false;

    const onPointerDown = (e: PointerEvent) => {
      activePointerIds.add(e.pointerId);
      if (activePointerIds.size > 1) {
        hadMultiTouch = true;
        return;
      }
      hadMultiTouch = false;
      downX = e.clientX;
      downY = e.clientY;
      cameraTweenRef.current.active = false;
    };

    const onPointerUp = (e: PointerEvent) => {
      activePointerIds.delete(e.pointerId);
      if (hadMultiTouch || activePointerIds.size > 0) return;
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
      const tapThreshold = e.pointerType === 'touch' ? 12 : 6;
      if (dist > tapThreshold) return;

      const rig = rigRef.current;
      if (!rig) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const targets: THREE.Object3D[] = [
        rig.proximalPivot,
        rig.distalPivot,
        rig.scapulaPivot,
        ...rig.agonistMeshes.map((a) => a.mesh),
      ];
      const hits = raycaster.intersectObjects(targets, true);
      if (hits.length > 0) {
        const hitPt = hits[0].point;
        const goal = computeClickOrbitGoal({
          currentPos: camera.position,
          currentTarget: controls.target,
          structureCenter: hitPt,
          structureRadius: 0.14,
          hitPoint: hitPt,
          minDistance: controls.minDistance,
          maxDistance: controls.maxDistance,
          fovDeg: camera.fov,
          aspect: camera.aspect,
        });
        cameraTweenRef.current.targetPos.set(goal.position.x, goal.position.y, goal.position.z);
        cameraTweenRef.current.targetLookAt.set(goal.target.x, goal.target.y, goal.target.z);
        cameraTweenRef.current.active = true;
      }
    };

    const onPointerCancel = (e: PointerEvent) => {
      activePointerIds.delete(e.pointerId);
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerCancel);

    const ro = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w < 10 || h < 10) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    let rafId = 0;
    let lastTime = performance.now();
    let cycleDir = 1;

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (isPlayingRef.current && rigRef.current) {
        const cycleSpeed = 0.56 * speedRef.current;
        let next = progressRef.current + dt * cycleSpeed * cycleDir;
        if (next >= 1) {
          next = 1;
          cycleDir = -1;
        } else if (next <= 0) {
          next = 0;
          cycleDir = 1;
        }
        progressRef.current = next;
        if (sliderValueRef.current) {
          sliderValueRef.current.value = String(Math.round(next * 100));
        }
        applyRigFrame(next);
      }

      if (cameraTweenRef.current.active) {
        camera.position.lerp(cameraTweenRef.current.targetPos, 0.12);
        controls.target.lerp(cameraTweenRef.current.targetLookAt, 0.12);
        if (
          camera.position.distanceTo(cameraTweenRef.current.targetPos) < 0.004 &&
          controls.target.distanceTo(cameraTweenRef.current.targetLookAt) < 0.004
        ) {
          cameraTweenRef.current.active = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerCancel);
      controls.dispose();
      pmrem.dispose();
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, []);

  // Load & assemble articulated skeleton + per-vertex deformable 3D muscles
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!scene || !camera || !controls || webglUnavailable) return;

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    const disposePreviousRig = () => {
      const prev = rigRef.current;
      if (!prev) return;
      scene.remove(prev.root);
      for (const d of prev.disposables) {
        d.dispose();
      }
      prev.fiberMeshes.forEach((m) => m.geometry.dispose());
      prev.protractorLine.geometry.dispose();
      rigRef.current = null;
    };

    const files = SIMULATOR_SCENE_FILES[activePreset.scene];
    Promise.all(files.map(loadGlbTemplate))
      .then((templates) => {
        if (cancelled) return;
        disposePreviousRig();

        const disposables: Array<{ dispose: () => void }> = [];
        const root = new THREE.Group();

        const boneMaterialProximal = new THREE.MeshStandardMaterial({
          color: 0xe4dac6,
          roughness: 0.48,
          metalness: 0.05,
          side: THREE.DoubleSide,
        });
        const boneMaterialDistal = new THREE.MeshStandardMaterial({
          color: 0xf4ecdc,
          roughness: 0.42,
          metalness: 0.07,
          side: THREE.DoubleSide,
        });
        // Rich, 100% opaque anatomical striated muscle material (active head/akton)
        const activeMuscleMat = new THREE.MeshStandardMaterial({
          color: 0xc82838,
          emissive: 0x3b0710,
          emissiveIntensity: 0.55,
          roughness: 0.44,
          metalness: 0.06,
          side: THREE.DoubleSide,
        });
        // Passive neighboring heads/aktony of the same muscle (follow the bone in calm resting tone)
        const passiveMuscleMat = new THREE.MeshStandardMaterial({
          color: 0x994247,
          emissive: 0x1e080a,
          emissiveIntensity: 0.25,
          roughness: 0.58,
          metalness: 0.04,
          side: THREE.DoubleSide,
        });
        // Stretching antagonist muscle material (distinct rose-plum / muted terracotta)
        const antagonistMat = new THREE.MeshStandardMaterial({
          color: 0x8a5a68,
          emissive: 0x241018,
          emissiveIntensity: 0.25,
          roughness: 0.55,
          metalness: 0.04,
          transparent: true,
          opacity: 0.84,
          side: THREE.DoubleSide,
        });

        disposables.push(
          boneMaterialProximal,
          boneMaterialDistal,
          activeMuscleMat,
          passiveMuscleMat,
          antagonistMat,
        );

        const wholeMuscleRegex = new RegExp(profile.meshMatchPattern, 'i');
        const activeSubpartRegex = new RegExp(
          activePreset.meshPattern || profile.meshMatchPattern,
          'i',
        );

        // Identify primary antagonist profile whose mesh exists in this scene
        let chosenAntagonistId: string | null = null;
        let antagonistRegex: RegExp | null = null;
        for (const antId of profile.antagonistIds) {
          const antProf = MUSCLE_ACTIONS_MAP[antId];
          if (antProf && !antProf.kinematicPresets[0]?.explicitAnchors) {
            chosenAntagonistId = antId;
            antagonistRegex = new RegExp(antProf.meshMatchPattern, 'i');
            break;
          }
        }

        const boneBoxes: Record<string, SimpleBox3> = {};
        const proximalClones: THREE.Mesh[] = [];
        const distalClones: THREE.Mesh[] = [];
        const scapulaClones: THREE.Mesh[] = [];
        const patellaClones: THREE.Mesh[] = [];

        const rawAgonistSources: Array<{
          geometry: THREE.BufferGeometry;
          matrixWorld: THREE.Matrix4;
          isActiveSubpart: boolean;
          name: string;
        }> = [];
        const rawAntagonistSources: Array<{
          geometry: THREE.BufferGeometry;
          matrixWorld: THREE.Matrix4;
          name: string;
        }> = [];

        const matchedMuscleBox = new THREE.Box3();
        const distalBoneBox = new THREE.Box3();

        for (const tmpl of templates) {
          tmpl.updateMatrixWorld(true);
          tmpl.traverse((obj) => {
            if (!(obj instanceof THREE.Mesh)) return;
            const rawName = obj.name || obj.parent?.name || '';
            const name = normalizeGlbNodeName(rawName);
            const role = classifyBoneSegment(name, activePreset.joint);

            const worldBox = new THREE.Box3().setFromObject(obj);
            if (worldBox.isEmpty()) return;

            if (role === 'proximal' || role === 'distal') {
              boneBoxes[name] = {
                min: { x: worldBox.min.x, y: worldBox.min.y, z: worldBox.min.z },
                max: { x: worldBox.max.x, y: worldBox.max.y, z: worldBox.max.z },
              };
              if (role === 'distal') {
                distalBoneBox.union(worldBox);
              }
              const meshClone = new THREE.Mesh(
                obj.geometry,
                role === 'proximal' ? boneMaterialProximal : boneMaterialDistal,
              );
              meshClone.matrixAutoUpdate = false;
              meshClone.matrix.copy(obj.matrixWorld);
              meshClone.name = name;

              // Route scapula+clavicle in shoulder presets to scapulohumeral rhythm group,
              // and patella in knee presets to patellar tracking group!
              if (
                activePreset.joint === 'shoulder' &&
                role === 'proximal' &&
                /\b(scapula|clavicle)\b/i.test(name) &&
                (worldBox.min.x + worldBox.max.x) * 0.5 < 0
              ) {
                scapulaClones.push(meshClone);
                proximalClones.push(meshClone); // also referenced for bone surface cloud
              } else if (
                activePreset.joint === 'knee' &&
                role === 'proximal' &&
                /\bpatella\b/i.test(name)
              ) {
                patellaClones.push(meshClone);
                proximalClones.push(meshClone);
              } else if (role === 'proximal') {
                proximalClones.push(meshClone);
              } else {
                distalClones.push(meshClone);
              }
            } else if (role === 'muscle') {
              const centerX = (worldBox.min.x + worldBox.max.x) * 0.5;
              const isPreferredSide =
                activePreset.scene === 'upper_limb' ||
                activePreset.scene === 'lower_limb' ||
                activePreset.joint === 'ribcage_diaphragm' ||
                activePreset.joint === 'facial' ||
                centerX <= 0.02;

              if (!isPreferredSide) return;

              if (!activePreset.explicitAnchors && wholeMuscleRegex.test(name)) {
                matchedMuscleBox.union(worldBox);
                rawAgonistSources.push({
                  geometry: obj.geometry,
                  matrixWorld: obj.matrixWorld.clone(),
                  isActiveSubpart: activeSubpartRegex.test(name),
                  name,
                });
              } else if (antagonistRegex && antagonistRegex.test(name)) {
                rawAntagonistSources.push({
                  geometry: obj.geometry,
                  matrixWorld: obj.matrixWorld.clone(),
                  name,
                });
              }
            }
          });
        }

        // Ensure at least one agonist part is marked active if subpart pattern was narrower
        if (
          rawAgonistSources.length > 0 &&
          !rawAgonistSources.some((s) => s.isActiveSubpart)
        ) {
          rawAgonistSources.forEach((s) => {
            s.isActiveSubpart = true;
          });
        }

        const pivotPos = computeJointPivotFromBoneBoxes(activePreset.joint, boneBoxes);
        const pivotVec = toVec3(pivotPos);
        const scapulaPivotPos = computeJointPivotFromBoneBoxes('scapula', boneBoxes);

        // Assemble hierarchical bone pivot groups
        const proximalPivot = new THREE.Group();
        proximalPivot.position.copy(pivotVec);
        const proximalOffset = new THREE.Group();
        proximalOffset.position.set(-pivotPos.x, -pivotPos.y, -pivotPos.z);
        proximalPivot.add(proximalOffset);

        const scapulaPivot = new THREE.Group();
        scapulaPivot.position.set(scapulaPivotPos.x, scapulaPivotPos.y, scapulaPivotPos.z);
        const scapulaOffset = new THREE.Group();
        scapulaOffset.position.set(-scapulaPivotPos.x, -scapulaPivotPos.y, -scapulaPivotPos.z);
        scapulaPivot.add(scapulaOffset);
        proximalOffset.add(scapulaPivot);

        const patellaPivot = new THREE.Group();
        patellaPivot.position.copy(pivotVec);
        const patellaOffset = new THREE.Group();
        patellaOffset.position.set(-pivotPos.x, -pivotPos.y, -pivotPos.z);
        patellaPivot.add(patellaOffset);
        proximalOffset.add(patellaPivot);

        const distalPivot = new THREE.Group();
        distalPivot.position.copy(pivotVec);
        const distalOffset = new THREE.Group();
        distalOffset.position.set(-pivotPos.x, -pivotPos.y, -pivotPos.z);
        distalPivot.add(distalOffset);

        const scapulaSet = new Set(scapulaClones);
        const patellaSet = new Set(patellaClones);
        for (const m of proximalClones) {
          if (scapulaSet.has(m)) scapulaOffset.add(m);
          else if (patellaSet.has(m)) patellaOffset.add(m);
          else proximalOffset.add(m);
        }
        for (const m of distalClones) {
          distalOffset.add(m);
        }

        const distalTracksGlenoid =
          activePreset.joint === 'shoulder' && scapulaClones.length > 0;
        root.add(proximalPivot);
        root.add(distalPivot);

        // Sample proximal & distal bone surface point clouds ONCE for automatic PP/PK tendon binding
        const proximalBoneCloud = sampleBoneSurfacePoints(proximalClones, 420);
        const distalBoneCloud = sampleBoneSurfacePoints(distalClones, 420);

        // If explicitAnchors is used (TFL — missing separate belly in Z-Anatomy GLB), generate a smooth 3D fusiform muscle + ITB mesh!
        if (rawAgonistSources.length === 0 && activePreset.explicitAnchors) {
          const pp = new THREE.Vector3(...activePreset.explicitAnchors.pp);
          const pk = new THREE.Vector3(...activePreset.explicitAnchors.pk);
          const mid = pp.clone().lerp(pk, 0.38).add(new THREE.Vector3(-0.022, 0, 0.012));
          const low = pp.clone().lerp(pk, 0.72).add(new THREE.Vector3(-0.018, 0, 0.004));
          const curve = new THREE.CatmullRomCurve3([pp, mid, low, pk]);
          const fusiformGeom = new THREE.TubeGeometry(curve, 28, 0.014, 12, false);
          // Taper tendon ends and swell upper TFL belly
          const pAttr = fusiformGeom.getAttribute('position') as THREE.BufferAttribute;
          const vTmp = new THREE.Vector3();
          for (let i = 0; i < pAttr.count; i += 1) {
            vTmp.fromBufferAttribute(pAttr, i);
            const tLine = Math.max(0, Math.min(1, (pp.y - vTmp.y) / Math.max(0.05, pp.y - pk.y)));
            const centerOnCurve = curve.getPoint(tLine);
            // Upper 35% is fleshy TFL belly, lower 65% is sleeker ITB band
            const profileScale =
              tLine < 0.38
                ? 0.35 + 1.15 * Math.sin((Math.PI * tLine) / 0.38)
                : 0.48 * (1 - 0.35 * ((tLine - 0.38) / 0.62));
            vTmp.sub(centerOnCurve).multiplyScalar(profileScale).add(centerOnCurve);
            pAttr.setXYZ(i, vTmp.x, vTmp.y, vTmp.z);
          }
          fusiformGeom.computeVertexNormals();
          matchedMuscleBox.setFromBufferAttribute(pAttr);
          disposables.push(fusiformGeom);
          rawAgonistSources.push({
            geometry: fusiformGeom,
            matrixWorld: new THREE.Matrix4().identity(),
            isActiveSubpart: true,
            name: 'Tensor fasciae latae procedural 3D',
          });
        }

        const buildDeformableInstances = (
          sources: Array<{
            geometry: THREE.BufferGeometry;
            matrixWorld: THREE.Matrix4;
            isActiveSubpart?: boolean;
            name: string;
          }>,
          isAntagonist: boolean,
        ): DeformableMeshInstance[] => {
          return sources.map((src) => {
            const prepared = prepareDeformableMuscle({
              geometry: src.geometry,
              worldMatrix: src.matrixWorld,
              proximalBoneCloud,
              distalBoneCloud,
              jointPivot: pivotPos,
              joint: activePreset.joint,
            });
            // Clone geometry with dynamic world-space vertex buffer
            const dynGeom = src.geometry.clone();
            const posAttr = new THREE.BufferAttribute(
              new Float32Array(prepared.restWorldPositions),
              3,
            );
            posAttr.setUsage(THREE.DynamicDrawUsage);
            dynGeom.setAttribute('position', posAttr);
            dynGeom.computeVertexNormals();
            disposables.push(dynGeom);

            const isAct = src.isActiveSubpart ?? true;
            const mat = isAntagonist
              ? antagonistMat
              : isAct
                ? activeMuscleMat
                : passiveMuscleMat;
            const mesh = new THREE.Mesh(dynGeom, mat);
            mesh.frustumCulled = false;
            mesh.name = src.name;
            if (isAntagonist) {
              mesh.visible = showAntagonistRef.current && !maskedQuizMode;
            }
            root.add(mesh);

            const usesScapulaProximal =
              activePreset.joint === 'shoulder' &&
              scapulaClones.length > 0 &&
              !/pectoralis|latissimus/i.test(src.name);

            return {
              mesh,
              prepared,
              isActiveSubpart: isAct,
              usesScapulaProximal,
              referenceStretchRatio: 1.0,
            };
          });
        };

        const agonistMeshes = buildDeformableInstances(rawAgonistSources, false);
        const antagonistMeshes = buildDeformableInstances(rawAntagonistSources, true);

        // Calibrate lengthened reference ratio at progress=0 concentric so pre-stretched muscles
        // (quadriceps, triceps, masseter, temporalis, latissimus) bulge physiologically at peak contraction!
        {
          const startFrame = evaluateKinematicFrame(activePreset, 0, 'concentric', boneBoxes);
          if (startFrame.coupledScapulaDeg !== 0) {
            const scapAx =
              startFrame.coupledScapulaAxis === 'x'
                ? new THREE.Vector3(1, 0, 0)
                : new THREE.Vector3(0, 0, 1);
            scapulaPivot.quaternion.setFromAxisAngle(
              scapAx,
              (startFrame.coupledScapulaDeg * Math.PI) / 180,
            );
          }
          distalPivot.quaternion.set(
            startFrame.quaternion.x,
            startFrame.quaternion.y,
            startFrame.quaternion.z,
            startFrame.quaternion.w,
          );
          if (startFrame.coupledScapulaDeg !== 0 && distalTracksGlenoid) {
            proximalPivot.updateMatrixWorld(true);
            const liveGlenoid = new THREE.Vector3(
              pivotPos.x,
              pivotPos.y,
              pivotPos.z,
            ).applyMatrix4(scapulaOffset.matrixWorld);
            distalPivot.position.set(
              liveGlenoid.x + startFrame.translationMeters.x,
              liveGlenoid.y + startFrame.translationMeters.y,
              liveGlenoid.z + startFrame.translationMeters.z,
            );
          } else {
            distalPivot.position.set(
              pivotPos.x + startFrame.translationMeters.x,
              pivotPos.y + startFrame.translationMeters.y,
              pivotPos.z + startFrame.translationMeters.z,
            );
          }
          root.updateMatrixWorld(true);
          for (const inst of agonistMeshes) {
            const effProx = inst.usesScapulaProximal
              ? scapulaOffset.matrixWorld
              : proximalOffset.matrixWorld;
            const res = deformMuscleGeometryInPlace({
              prepared: inst.prepared,
              targetGeometry: inst.mesh.geometry,
              proximalMatrix: effProx,
              distalMatrix: distalOffset.matrixWorld,
              jointPivot: pivotPos,
              bulgeGain: 0,
              facialContractionT: 0,
              referenceStretchRatio: 1.0,
            });
            inst.referenceStretchRatio = Math.max(1.0, res.rawStretchRatio);
          }
          distalPivot.quaternion.identity();
          distalPivot.position.copy(pivotVec);
          scapulaPivot.quaternion.identity();
          root.updateMatrixWorld(true);
        }

        const antNamePl =
          chosenAntagonistId && antagonistMeshes.length > 0
            ? (ANATOMY_MAP[chosenAntagonistId]?.namePl ?? chosenAntagonistId)
            : null;
        setAvailableAntagonistPl(antNamePl);

        // Optional Force Vectors & PP/PK spheres group (hidden by default so real 3D muscle shines!)
        const vectorGroup = new THREE.Group();
        vectorGroup.visible = showForceVectorsRef.current;
        const markerGeom = new THREE.SphereGeometry(0.01, 14, 14);
        const ppMat = new THREE.MeshStandardMaterial({
          color: 0xf43f5e,
          emissive: 0xe11d48,
          emissiveIntensity: 0.45,
        });
        const pkMat = new THREE.MeshStandardMaterial({
          color: 0x10b981,
          emissive: 0x059669,
          emissiveIntensity: 0.45,
        });
        const ppMarker = new THREE.Mesh(markerGeom, ppMat);
        const pkMarker = new THREE.Mesh(markerGeom, pkMat);
        vectorGroup.add(ppMarker, pkMarker);

        const fiberMaterial = new THREE.MeshStandardMaterial({
          color: 0xfbbf24,
          emissive: 0xd97706,
          emissiveIntensity: 0.45,
          roughness: 0.35,
        });
        const fiberMeshes: THREE.Mesh[] = [];
        for (let i = 0; i < 5; i += 1) {
          const fm = new THREE.Mesh(new THREE.BufferGeometry(), fiberMaterial);
          vectorGroup.add(fm);
          fiberMeshes.push(fm);
        }
        disposables.push(markerGeom, ppMat, pkMat, fiberMaterial);
        root.add(vectorGroup);

        // 3D Anatomical Plane Card + True 3D Joint Rotation Axis Rod
        const planeHelperGroup = new THREE.Group();
        planeHelperGroup.visible = showPlaneAndAxisRef.current && !maskedQuizMode;

        const effectiveRotAxis =
          Math.abs(activePreset.endDeg - activePreset.startDeg) < 0.5 && activePreset.secondaryRot
            ? activePreset.secondaryRot.axis
            : activePreset.rotAxis;
        const axisVec = computeAnatomicalJointAxis(
          activePreset.joint,
          effectiveRotAxis,
          boneBoxes,
        );
        const axisThree = new THREE.Vector3(axisVec.x, axisVec.y, axisVec.z).normalize();

        // Golden-amber joint axis rod passing right through the anatomical pivot
        const rodGeom = new THREE.CylinderGeometry(0.0032, 0.0032, 0.24, 12);
        const rodMat = new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          emissive: 0xb45309,
          emissiveIntensity: 0.45,
          roughness: 0.3,
        });
        const axisRodMesh = new THREE.Mesh(rodGeom, rodMat);
        axisRodMesh.position.copy(pivotVec);
        axisRodMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axisThree);
        planeHelperGroup.add(axisRodMesh);

        // Pivot center bead
        const pivotBeadGeom = new THREE.SphereGeometry(0.0085, 14, 14);
        const pivotBead = new THREE.Mesh(pivotBeadGeom, rodMat);
        pivotBead.position.copy(pivotVec);
        planeHelperGroup.add(pivotBead);

        // Translucent emerald plane disc/quad aligned with the movement's anatomical plane
        const planeBasis = computePlaneHelperBasis(activePreset.planePl, axisVec);
        const planeNormal = new THREE.Vector3(
          planeBasis.normal.x,
          planeBasis.normal.y,
          planeBasis.normal.z,
        ).normalize();
        const planeSize = 0.24;
        const planeGeom = new THREE.PlaneGeometry(planeSize, planeSize);
        const planeMat = new THREE.MeshBasicMaterial({
          color: 0x10b981,
          transparent: true,
          opacity: 0.13,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const planeMesh = new THREE.Mesh(planeGeom, planeMat);
        planeMesh.position.copy(pivotVec);
        planeMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), planeNormal);
        planeHelperGroup.add(planeMesh);

        // Crisp border outline around the 3D anatomical plane card
        const edgesGeom = new THREE.EdgesGeometry(planeGeom);
        const edgesMat = new THREE.LineBasicMaterial({
          color: 0x059669,
          transparent: true,
          opacity: 0.45,
        });
        const planeBorder = new THREE.LineSegments(edgesGeom, edgesMat);
        planeBorder.position.copy(pivotVec);
        planeBorder.quaternion.copy(planeMesh.quaternion);
        planeHelperGroup.add(planeBorder);

        disposables.push(rodGeom, rodMat, pivotBeadGeom, planeGeom, planeMat, edgesGeom, edgesMat);
        root.add(planeHelperGroup);

        // 3D SFTR protractor arc line
        const protractorMaterial = new THREE.LineBasicMaterial({
          color: 0x059669,
          linewidth: 2,
        });
        disposables.push(protractorMaterial);
        const protractorLine = new THREE.Line(new THREE.BufferGeometry(), protractorMaterial);
        root.add(protractorLine);

        scene.add(root);

        // Compute ideal camera framing around the active muscle + joint pivot + moving limb context
        const focusBox = new THREE.Box3();
        focusBox.expandByPoint(pivotVec);
        if (!matchedMuscleBox.isEmpty()) focusBox.union(matchedMuscleBox);
        if (!distalBoneBox.isEmpty()) {
          const distalCenter = new THREE.Vector3();
          distalBoneBox.getCenter(distalCenter);
          focusBox.expandByPoint(distalCenter);
        }
        const focusSphere = new THREE.Sphere();
        focusBox.getBoundingSphere(focusSphere);
        const focusRadius = Math.max(0.22, Math.min(0.55, focusSphere.radius * 1.48));

        rigRef.current = {
          root,
          proximalPivot,
          proximalOffset,
          distalPivot,
          distalOffset,
          distalTracksGlenoid,
          scapulaPivot,
          scapulaOffset,
          scapulaPivotPos,
          patellaPivot,
          patellaOffset,
          pivotPos,
          boneBoxes,
          agonistMeshes,
          activeMuscleMat,
          passiveMuscleMat,
          antagonistMeshes,
          antagonistMat,
          antagonistNamePl: antNamePl,
          vectorGroup,
          ppMarker,
          pkMarker,
          fiberMeshes,
          fiberMaterial,
          planeHelperGroup,
          axisRodMesh,
          protractorLine,
          protractorMaterial,
          disposables,
          focusCenter: focusSphere.center.clone(),
          focusRadius,
        };

        const isPosterior =
          /trapezius|latissimus|rhomboid|erector|infraspinatus|teres|gluteus|piriformis|obturator|quadratus_femoris|biceps_femoris|semitendinosus|semimembranosus|popliteus|gastrocnemius|soleus|tibialis_posterior|flexor_hallucis|splenius|triceps/i.test(
            profile.muscleId,
          );
        const dist = focusRadius * 2.85;
        const sideSign =
          activePreset.scene === 'head_neck' || activePreset.scene === 'torso_only'
            ? -0.45
            : -0.68;
        const zSign = isPosterior ? -0.82 : 0.85;
        controls.target.copy(focusSphere.center);
        camera.position.set(
          focusSphere.center.x + dist * sideSign,
          focusSphere.center.y + dist * 0.18,
          focusSphere.center.z + dist * zSign,
        );
        controls.update();

        applyRigFrame(progressRef.current);
        setIsLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('Nie udało się załadować modelu mięśniowo-kostnego 3D.');
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [profile.muscleId, activePreset.id, webglUnavailable]);

  // Re-evaluate frame immediately when user drags slider or switches physiological mode / toggles
  useEffect(() => {
    applyRigFrame(progress01);
  }, [progress01, simMode, showAntagonist, showForceVectors]);

  const handleRecenter = () => {
    const rig = rigRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!rig || !camera || !controls) return;
    const isPosterior =
      /trapezius|latissimus|rhomboid|erector|infraspinatus|teres|gluteus|piriformis|obturator|quadratus_femoris|biceps_femoris|semitendinosus|semimembranosus|popliteus|gastrocnemius|soleus|tibialis_posterior|flexor_hallucis|splenius|triceps/i.test(
        profile.muscleId,
      );
    const dist = rig.focusRadius * 2.85;
    cameraTweenRef.current.targetLookAt.copy(rig.focusCenter);
    cameraTweenRef.current.targetPos.set(
      rig.focusCenter.x + dist * -0.58,
      rig.focusCenter.y + dist * 0.18,
      rig.focusCenter.z + dist * (isPosterior ? -0.82 : 0.85),
    );
    cameraTweenRef.current.active = true;
  };

  const activeCaption =
    simMode === 'closed_chain'
      ? activePreset.closedChainCaptionPl
      : activePreset.openChainCaptionPl;

  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl border-2 border-[#d6e7dc] bg-white shadow-sm dark:border-[#233d2f] dark:bg-[#112018]"
      data-testid="muscle-motion-simulator-3d"
    >
      {/* Top Presets Bar (when muscle has multiple simulated movements / aktony) */}
      {!maskedQuizMode && profile.kinematicPresets.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[#d6e7dc] bg-[#f4faf6] px-3 py-2 no-scrollbar dark:border-[#233d2f] dark:bg-[#15281e]">
          <span className="shrink-0 text-[11px] font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
            Symulowany ruch ({profile.kinematicPresets.length}):
          </span>
          {profile.kinematicPresets.map((preset) => {
            const selected = preset.id === activePreset.id;
            return (
              <button
                key={preset.id}
                type="button"
                data-testid={`sim-preset-${preset.id}`}
                onClick={() => onSelectPreset?.(preset.id)}
                className={`shrink-0 rounded-xl border px-2.5 py-1 text-xs font-bold transition ${
                  selected
                    ? 'border-emerald-500 bg-emerald-600 text-white shadow-xs'
                    : 'border-[#c5dfd0] bg-white text-[#233d2f] hover:bg-emerald-50 dark:border-[#2a4a39] dark:bg-[#112018] dark:text-[#c7dbcf] dark:hover:bg-[#1c3527]'
                }`}
              >
                {preset.labelPl}
              </button>
            );
          })}
        </div>
      )}

      {/* 3D WebGL Viewport */}
      <div
        className={`relative w-full select-none ${
          compact ? 'h-[260px] sm:h-[310px]' : 'h-[310px] sm:h-[395px]'
        }`}
      >
        <div ref={containerRef} className="h-full w-full" />

        {/* Live SFTR Angle, Plane & Muscle Strain HUD (top-left) */}
        <div className="pointer-events-none absolute top-2.5 left-2.5 flex max-w-[78%] flex-col gap-1">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-[#d6e7dc]/90 bg-white/92 px-2.5 py-1 text-[11px] font-extrabold text-emerald-950 shadow-xs backdrop-blur-sm dark:border-[#2a4a39] dark:bg-[#0d1912]/92 dark:text-emerald-100">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                simMode === 'eccentric'
                  ? 'bg-amber-500'
                  : simMode === 'closed_chain'
                    ? 'bg-emerald-500'
                    : 'bg-rose-600'
              }`}
            />
            <span ref={angleBadgeRef} className="shrink-0 whitespace-nowrap font-mono-tabular">
              0°
            </span>
            <span className="text-[#52695b] dark:text-[#94b0a0]">•</span>
            <span className="truncate">{activePreset.planePl}</span>
          </div>
          {!maskedQuizMode && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="w-fit rounded-lg bg-white/88 px-2 py-0.5 text-[10px] font-bold text-[#354c3f] shadow-xs backdrop-blur-sm dark:bg-[#0d1912]/88 dark:text-[#c7dbcf]">
                {activePreset.axisPl} • {activePreset.sftrLabel}
              </span>
              <span
                ref={strainBadgeRef}
                data-testid="sim-strain-badge"
                className="w-fit rounded-lg bg-rose-50/95 px-2 py-0.5 font-mono-tabular text-[10px] font-extrabold text-rose-800 shadow-xs backdrop-blur-sm dark:bg-rose-950/85 dark:text-rose-200"
              >
                Skrócenie brzuśca: 0%
              </span>
            </div>
          )}
        </div>

        {/* Floating Camera & Touch Controls (top-right) */}
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5">
          <button
            type="button"
            title="Wyśrodkuj widok 3D"
            onClick={handleRecenter}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#c5dfd0] bg-white/90 text-emerald-900 shadow-xs backdrop-blur-sm transition hover:bg-emerald-50 dark:border-[#2a4a39] dark:bg-[#112018]/90 dark:text-emerald-200"
          >
            <Crosshair className="h-4 w-4" />
          </button>
          <button
            type="button"
            title={
              touchMode === 'rotate'
                ? 'Dotyk: Obrót (kliknij, aby przełączyć na Przesuwanie)'
                : 'Dotyk: Przesuwanie (kliknij, aby przełączyć na Obrót)'
            }
            onClick={() => setTouchMode((m) => (m === 'rotate' ? 'pan' : 'rotate'))}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#c5dfd0] bg-white/90 text-emerald-900 shadow-xs backdrop-blur-sm transition hover:bg-emerald-50 dark:border-[#2a4a39] dark:bg-[#112018]/90 dark:text-emerald-200"
          >
            {touchMode === 'rotate' ? <Rotate3d className="h-4 w-4" /> : <Move className="h-4 w-4" />}
          </button>
        </div>

        {/* Legend pills (bottom-left) */}
        <div className="pointer-events-none absolute bottom-2 left-2.5 flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
          <span className="inline-flex items-center gap-1 rounded-lg bg-white/88 px-1.5 py-0.5 text-rose-800 backdrop-blur-sm dark:bg-[#0d1912]/88 dark:text-rose-300">
            <span className="h-2 w-2 rounded-full bg-rose-600" /> Aktywny brzusiec 3D
          </span>
          {showAntagonist && availableAntagonistPl && !maskedQuizMode && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/88 px-1.5 py-0.5 text-stone-700 backdrop-blur-sm dark:bg-[#0d1912]/88 dark:text-stone-300">
              <span className="h-2 w-2 rounded-full bg-[#8a5a68]" /> Rozciągany: {availableAntagonistPl}
            </span>
          )}
          {showPlaneAndAxis && !maskedQuizMode && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/88 px-1.5 py-0.5 text-amber-800 backdrop-blur-sm dark:bg-[#0d1912]/88 dark:text-amber-300">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Oś i płaszczyzna ruchu
            </span>
          )}
        </div>

        {/* Loading / Fallback Overlay */}
        {(isLoading || loadError || webglUnavailable) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#f2f8f4]/90 p-4 text-center dark:bg-[#0c1711]/90">
            {webglUnavailable ? (
              <p className="text-xs font-bold text-[#354c3f] dark:text-[#c7dbcf]">
                Podgląd WebGL 3D niedostępny w tym środowisku — pełny opis kinematyki dostępny poniżej.
              </p>
            ) : loadError ? (
              <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{loadError}</p>
            ) : (
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                <span>Wiązanie przyczepów PP/PK bryły mięśnia 3D z kośćmi…</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Interactive Controls Panel */}
      <div className="space-y-2.5 border-t border-[#d6e7dc] bg-[#f8fcfa] p-3 dark:border-[#233d2f] dark:bg-[#13241b]">
        {/* Row 1: Play/Pause + ROM Scrubber + Speed */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="sim-play-toggle"
            onClick={() => setIsPlaying((p) => !p)}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border-b-2 border-emerald-700 bg-emerald-600 px-3 text-xs font-extrabold text-white transition hover:bg-emerald-500"
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            <span>{isPlaying ? 'Pauza' : 'Start'}</span>
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#d6e7dc] bg-white px-2.5 py-1.5 dark:border-[#233d2f] dark:bg-[#0f1d15]">
            <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-[#52695b] dark:text-[#94b0a0]" />
            <input
              ref={sliderValueRef}
              type="range"
              min={0}
              max={100}
              defaultValue={0}
              aria-label="Zakres ruchu ROM (0-100%)"
              data-testid="sim-rom-slider"
              onChange={(e) => {
                setIsPlaying(false);
                const val = Number(e.target.value) / 100;
                progressRef.current = val;
                setProgress01(val);
              }}
              className="h-1.5 w-full cursor-pointer accent-emerald-600"
            />
          </div>

          <button
            type="button"
            data-testid="sim-speed-toggle"
            onClick={() => setSpeed((s) => (s === 1 ? 0.5 : 1))}
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl border border-[#c5dfd0] bg-white px-2.5 text-xs font-extrabold text-emerald-900 transition hover:bg-emerald-50 dark:border-[#2a4a39] dark:bg-[#0f1d15] dark:text-emerald-200"
          >
            <Gauge className="h-3.5 w-3.5" />
            <span>{speed === 1 ? '1×' : '0.5×'}</span>
          </button>

          <button
            type="button"
            title="Resetuj do 0%"
            onClick={() => {
              setIsPlaying(false);
              progressRef.current = 0;
              setProgress01(0);
              if (sliderValueRef.current) sliderValueRef.current.value = '0';
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#c5dfd0] bg-white text-[#52695b] transition hover:bg-emerald-50 dark:border-[#2a4a39] dark:bg-[#0f1d15] dark:text-[#94b0a0]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Row 2 & 3: Physiological Mode + 3D Scene Layer Helpers (Hidden in maskedQuizMode) */}
        {!maskedQuizMode && (
          <>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(
                [
                  {
                    id: 'concentric',
                    label: 'Koncentryczna',
                    activeCls:
                      'border-rose-500 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-950/60 dark:text-rose-200',
                  },
                  {
                    id: 'eccentric',
                    label: 'Ekscentryczna (hamowanie)',
                    activeCls:
                      'border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200',
                  },
                  {
                    id: 'closed_chain',
                    label: 'Łańcuch zamknięty (odwrócony przyczep)',
                    activeCls:
                      'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200',
                  },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  data-testid={`sim-mode-${m.id}`}
                  onClick={() => setSimMode(m.id)}
                  className={`shrink-0 rounded-xl border px-2.5 py-1.5 text-[11px] font-extrabold transition ${
                    simMode === m.id
                      ? m.activeCls
                      : 'border-[#d6e7dc] bg-white text-[#52695b] hover:bg-[#edf6f0] dark:border-[#233d2f] dark:bg-[#0f1d15] dark:text-[#94b0a0]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Row 3: 3D Helpers — Plane & Axis | Stretching Antagonist | Force Vectors PP–PK */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                type="button"
                data-testid="sim-plane-toggle"
                onClick={() => setShowPlaneAndAxis((v) => !v)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-bold transition ${
                  showPlaneAndAxis
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200'
                    : 'border-[#d6e7dc] bg-white text-[#52695b] dark:border-[#233d2f] dark:bg-[#0f1d15] dark:text-[#94b0a0]'
                }`}
              >
                <Compass className="h-3.5 w-3.5" />
                <span>Płaszczyzna i oś 3D</span>
              </button>

              {availableAntagonistPl && (
                <button
                  type="button"
                  data-testid="sim-antagonist-toggle"
                  onClick={() => setShowAntagonist((v) => !v)}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-bold transition ${
                    showAntagonist
                      ? 'border-rose-400 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-950/60 dark:text-rose-200'
                      : 'border-[#d6e7dc] bg-white text-[#52695b] dark:border-[#233d2f] dark:bg-[#0f1d15] dark:text-[#94b0a0]'
                  }`}
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  <span>Pokaż antagonistę</span>
                </button>
              )}

              <button
                type="button"
                data-testid="sim-vectors-toggle"
                onClick={() => setShowForceVectors((v) => !v)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-bold transition ${
                  showForceVectors
                    ? 'border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200'
                    : 'border-[#d6e7dc] bg-white text-[#52695b] dark:border-[#233d2f] dark:bg-[#0f1d15] dark:text-[#94b0a0]'
                }`}
              >
                <GitCommitHorizontal className="h-3.5 w-3.5" />
                <span>Wektory PP–PK</span>
              </button>
            </div>

            <p className="rounded-xl border border-[#d6e7dc] bg-white px-3 py-2 text-xs leading-relaxed text-[#2d4337] dark:border-[#233d2f] dark:bg-[#0f1d15] dark:text-[#c7dbcf]">
              <span className="font-extrabold text-emerald-800 dark:text-emerald-300">
                {simMode === 'closed_chain'
                  ? 'Punctum Fixum = PK: '
                  : simMode === 'eccentric'
                    ? 'Hamowanie ekscentryczne: '
                    : 'Punctum Fixum = PP: '}
              </span>
              {activeCaption}
            </p>
          </>
        )}
      </div>
    </div>
  );
};
