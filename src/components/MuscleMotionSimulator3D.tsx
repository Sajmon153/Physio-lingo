import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  Crosshair,
  Eye,
  EyeOff,
  Gauge,
  Move,
  Pause,
  Play,
  Rotate3d,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import type { MuscleActionProfile, MuscleKinematicPreset } from '../data/muscleActionsTypes';
import { computeClickOrbitGoal } from '../three/cameraFocus';
import {
  classifyBoneSegment,
  computeFiberBundlePoints,
  computeJointPivotFromBoneBoxes,
  computeProtractorArcPoints,
  deriveMuscleAnchorsFromBox,
  evaluateKinematicFrame,
  normalizeGlbNodeName,
  SIMULATOR_SCENE_FILES,
  type KinematicSimulationMode,
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

interface RigRuntime {
  root: THREE.Group;
  proximalPivot: THREE.Group;
  distalPivot: THREE.Group;
  pivotPos: Vec3Tuple;
  ppMarker: THREE.Mesh;
  pkMarker: THREE.Mesh;
  ppAnchorNode: THREE.Object3D;
  pkAnchorNode: THREE.Object3D;
  fiberGroup: THREE.Group;
  fiberMeshes: THREE.Mesh[];
  fiberMaterial: THREE.MeshStandardMaterial;
  protractorLine: THREE.Line;
  protractorMaterial: THREE.LineBasicMaterial;
  realMuscleMeshes: THREE.Mesh[];
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
  const [showMuscleOverlay, setShowMuscleOverlay] = useState(true);
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
  const showMuscleOverlayRef = useRef(showMuscleOverlay);
  showMuscleOverlayRef.current = showMuscleOverlay;
  const sliderValueRef = useRef<HTMLInputElement | null>(null);
  const angleBadgeRef = useRef<HTMLSpanElement | null>(null);

  // Reset mode when switching muscles
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

  // Apply real muscle overlay visibility immediately
  useEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;
    for (const m of rig.realMuscleMeshes) {
      m.visible = showMuscleOverlay;
    }
  }, [showMuscleOverlay]);

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
    const frame = evaluateKinematicFrame(preset, t01, mode);

    // Reset both pivots first
    rig.proximalPivot.rotation.set(0, 0, 0);
    rig.proximalPivot.position.set(rig.pivotPos.x, rig.pivotPos.y, rig.pivotPos.z);
    rig.distalPivot.rotation.set(0, 0, 0);
    rig.distalPivot.position.set(rig.pivotPos.x, rig.pivotPos.y, rig.pivotPos.z);

    const targetPivot =
      frame.movingSegment === 'distal' ? rig.distalPivot : rig.proximalPivot;
    targetPivot.rotation.set(frame.rotationRad.x, frame.rotationRad.y, frame.rotationRad.z);
    targetPivot.position.set(
      rig.pivotPos.x + frame.translationMeters.x,
      rig.pivotPos.y + frame.translationMeters.y,
      rig.pivotPos.z + frame.translationMeters.z,
    );

    rig.root.updateMatrixWorld(true);

    // Compute live world PP & PK positions pinned to the actual bone groups
    const ppWorld = new THREE.Vector3();
    const pkWorld = new THREE.Vector3();
    rig.ppAnchorNode.getWorldPosition(ppWorld);
    rig.pkAnchorNode.getWorldPosition(pkWorld);

    rig.ppMarker.position.copy(ppWorld);
    rig.pkMarker.position.copy(pkWorld);

    // Rebuild live glowing 3D muscle fiber bundle between moving PP & PK
    const strands = computeFiberBundlePoints(
      { x: ppWorld.x, y: ppWorld.y, z: ppWorld.z },
      { x: pkWorld.x, y: pkWorld.y, z: pkWorld.z },
      frame.bellyBulgeScale,
      5,
      11,
    );

    // Color shifts: Concentric = bright coral-crimson; Eccentric = vibrant amber; Closed Chain = emerald-teal
    if (mode === 'eccentric') {
      rig.fiberMaterial.color.setHex(0xf59e0b);
      rig.fiberMaterial.emissive.setHex(0xb45309);
      rig.fiberMaterial.emissiveIntensity = 0.25 + frame.fiberActivation * 0.45;
      rig.protractorMaterial.color.setHex(0xd97706);
    } else if (mode === 'closed_chain') {
      rig.fiberMaterial.color.setHex(0x10b981);
      rig.fiberMaterial.emissive.setHex(0x047857);
      rig.fiberMaterial.emissiveIntensity = 0.25 + frame.fiberActivation * 0.45;
      rig.protractorMaterial.color.setHex(0x059669);
    } else {
      rig.fiberMaterial.color.setHex(0xe11d48);
      rig.fiberMaterial.emissive.setHex(0xbe123c);
      rig.fiberMaterial.emissiveIntensity = 0.18 + frame.fiberActivation * 0.52;
      rig.protractorMaterial.color.setHex(0x10b981);
    }

    const baseRadius = 0.0046 * frame.fiberThicknessScale;
    for (let i = 0; i < rig.fiberMeshes.length; i += 1) {
      const mesh = rig.fiberMeshes[i];
      const pts = strands[i];
      if (!pts || pts.length < 2) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, p.y, p.z)));
      const newGeom = new THREE.TubeGeometry(curve, 14, i === 0 ? baseRadius * 1.25 : baseRadius, 6, false);
      mesh.geometry.dispose();
      mesh.geometry = newGeom;
    }

    // Update 3D SFTR protractor arc around joint pivot
    const arcRadius = Math.max(0.055, Math.min(0.14, rig.focusRadius * 0.36));
    const arcPts = computeProtractorArcPoints(
      rig.pivotPos,
      preset.rotAxis,
      preset.startDeg,
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

    if (angleBadgeRef.current) {
      angleBadgeRef.current.textContent =
        frame.totalRangeDeg > 0
          ? `${frame.sweepAngleDeg}° / ${frame.totalRangeDeg}°`
          : `${Math.round(frame.motionT * 100)}%`;
    }
  };

  // Initialize Three.js WebGL stage once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch {
      setWebglUnavailable(true);
      setIsLoading(false);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth || 480, container.clientHeight || 360);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none';
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isDarkMode ? 0x0c1711 : 0xf2f8f4);
    sceneRef.current = scene;

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const hemi = new THREE.HemisphereLight(0xffffff, 0xc7dbd0, 0.9);
    scene.add(hemi);
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
    keyLight.position.set(1.5, 2.5, 2.2);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xd1fae5, 0.55);
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

    // Click-to-pivot camera focus on any clicked bone/muscle (supports both mouse and 1-finger mobile tap)
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
      const hits = raycaster.intersectObjects([rig.proximalPivot, rig.distalPivot, rig.fiberGroup], true);
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

    // Responsive ResizeObserver
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

    // Main animation loop (ping-pong smooth biological cycle)
    let rafId = 0;
    let lastTime = performance.now();
    let cycleDir = 1;

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (isPlayingRef.current && rigRef.current) {
        const cycleSpeed = 0.58 * speedRef.current; // full sweep ~1.7s at 1x
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

  // Load & assemble articulated real-bone kinematic rig whenever muscle or preset changes
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
      prev.fiberMeshes.forEach((m) => m.geometry.dispose());
      prev.fiberMaterial.dispose();
      prev.protractorLine.geometry.dispose();
      prev.protractorMaterial.dispose();
      prev.ppMarker.geometry.dispose();
      (prev.ppMarker.material as THREE.Material).dispose();
      prev.pkMarker.geometry.dispose();
      (prev.pkMarker.material as THREE.Material).dispose();
      rigRef.current = null;
    };

    const files = SIMULATOR_SCENE_FILES[activePreset.scene];
    Promise.all(files.map(loadGlbTemplate))
      .then((templates) => {
        if (cancelled) return;
        disposePreviousRig();

        const root = new THREE.Group();
        const boneMaterialProximal = new THREE.MeshStandardMaterial({
          color: 0xe3d8c2,
          roughness: 0.48,
          metalness: 0.06,
          side: THREE.DoubleSide,
        });
        const boneMaterialDistal = new THREE.MeshStandardMaterial({
          color: 0xf4ecda,
          roughness: 0.42,
          metalness: 0.08,
          side: THREE.DoubleSide,
        });
        const realMuscleMat = new THREE.MeshStandardMaterial({
          color: 0xdc2626,
          emissive: 0x7f1d1d,
          emissiveIntensity: 0.16,
          roughness: 0.45,
          transparent: true,
          opacity: 0.34,
          depthWrite: false,
          side: THREE.DoubleSide,
        });

        const muscleRegex = new RegExp(
          activePreset.meshPattern || profile.meshMatchPattern,
          'i',
        );
        const fallbackMuscleRegex = new RegExp(profile.meshMatchPattern, 'i');

        const boneBoxes: Record<string, SimpleBox3> = {};
        const proximalClones: THREE.Mesh[] = [];
        const distalClones: THREE.Mesh[] = [];
        const matchedMuscleMeshes: THREE.Mesh[] = [];
        const matchedMuscleBox = new THREE.Box3();
        const fallbackMuscleBox = new THREE.Box3();
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
              if (role === 'proximal') proximalClones.push(meshClone);
              else distalClones.push(meshClone);
            } else if (role === 'muscle') {
              // For bilateral torso/head models, prefer the right side (X <= 0.02) when single-sided
              const centerX = (worldBox.min.x + worldBox.max.x) * 0.5;
              const isPreferredSide =
                activePreset.scene === 'upper_limb' ||
                activePreset.scene === 'lower_limb' ||
                activePreset.joint === 'ribcage_diaphragm' ||
                activePreset.joint === 'facial' ||
                centerX <= 0.02;

              if (muscleRegex.test(name) && isPreferredSide) {
                matchedMuscleBox.union(worldBox);
                const mClone = new THREE.Mesh(obj.geometry, realMuscleMat);
                mClone.matrixAutoUpdate = false;
                mClone.matrix.copy(obj.matrixWorld);
                mClone.visible = showMuscleOverlayRef.current;
                mClone.name = name;
                matchedMuscleMeshes.push(mClone);
              } else if (fallbackMuscleRegex.test(name)) {
                fallbackMuscleBox.union(worldBox);
                if (matchedMuscleMeshes.length === 0) {
                  const mClone = new THREE.Mesh(obj.geometry, realMuscleMat);
                  mClone.matrixAutoUpdate = false;
                  mClone.matrix.copy(obj.matrixWorld);
                  mClone.visible = showMuscleOverlayRef.current;
                  mClone.name = name;
                  matchedMuscleMeshes.push(mClone);
                }
              }
            }
          });
        }

        const pivotPos = computeJointPivotFromBoneBoxes(activePreset.joint, boneBoxes);
        const pivotVec = toVec3(pivotPos);

        const proximalPivot = new THREE.Group();
        proximalPivot.position.copy(pivotVec);
        const proximalOffset = new THREE.Group();
        proximalOffset.position.set(-pivotPos.x, -pivotPos.y, -pivotPos.z);
        proximalPivot.add(proximalOffset);

        const distalPivot = new THREE.Group();
        distalPivot.position.copy(pivotVec);
        const distalOffset = new THREE.Group();
        distalOffset.position.set(-pivotPos.x, -pivotPos.y, -pivotPos.z);
        distalPivot.add(distalOffset);

        proximalClones.forEach((m) => proximalOffset.add(m));
        distalClones.forEach((m) => distalOffset.add(m));
        // Attach translucent anatomical muscle reference to proximal group (visual reference at rest)
        matchedMuscleMeshes.forEach((m) => proximalOffset.add(m));

        root.add(proximalPivot);
        root.add(distalPivot);

        // Compute PP & PK anchor points (either explicit or derived from the muscle's real GLB mesh bounds)
        let anchors: { pp: Vec3Tuple; pk: Vec3Tuple };
        if (activePreset.explicitAnchors) {
          anchors = {
            pp: {
              x: activePreset.explicitAnchors.pp[0],
              y: activePreset.explicitAnchors.pp[1],
              z: activePreset.explicitAnchors.pp[2],
            },
            pk: {
              x: activePreset.explicitAnchors.pk[0],
              y: activePreset.explicitAnchors.pk[1],
              z: activePreset.explicitAnchors.pk[2],
            },
          };
        } else {
          const useBox = !matchedMuscleBox.isEmpty() ? matchedMuscleBox : fallbackMuscleBox;
          if (!useBox.isEmpty()) {
            anchors = deriveMuscleAnchorsFromBox(
              {
                min: { x: useBox.min.x, y: useBox.min.y, z: useBox.min.z },
                max: { x: useBox.max.x, y: useBox.max.y, z: useBox.max.z },
              },
              activePreset.fiberAxis ?? 'vertical',
            );
          } else {
            anchors = {
              pp: { x: pivotPos.x, y: pivotPos.y + 0.1, z: pivotPos.z },
              pk: { x: pivotPos.x, y: pivotPos.y - 0.12, z: pivotPos.z },
            };
          }
        }

        // Pin PP anchor inside proximal bone group & PK anchor inside distal bone group
        const ppAnchorNode = new THREE.Object3D();
        ppAnchorNode.position.set(anchors.pp.x, anchors.pp.y, anchors.pp.z);
        proximalOffset.add(ppAnchorNode);

        const pkAnchorNode = new THREE.Object3D();
        pkAnchorNode.position.set(anchors.pk.x, anchors.pk.y, anchors.pk.z);
        if (activePreset.joint === 'facial') {
          proximalOffset.add(pkAnchorNode);
        } else {
          distalOffset.add(pkAnchorNode);
        }

        // Glowing PP (rose) & PK (emerald) attachment spheres
        const markerGeom = new THREE.SphereGeometry(0.011, 14, 14);
        const ppMarker = new THREE.Mesh(
          markerGeom,
          new THREE.MeshStandardMaterial({
            color: 0xf43f5e,
            emissive: 0xe11d48,
            emissiveIntensity: 0.45,
          }),
        );
        const pkMarker = new THREE.Mesh(
          markerGeom.clone(),
          new THREE.MeshStandardMaterial({
            color: 0x10b981,
            emissive: 0x059669,
            emissiveIntensity: 0.45,
          }),
        );
        root.add(ppMarker);
        root.add(pkMarker);

        // Joint pivot indicator ring
        const pivotSphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.008, 12, 12),
          new THREE.MeshStandardMaterial({
            color: 0xfbbf24,
            emissive: 0xd97706,
            emissiveIntensity: 0.5,
          }),
        );
        pivotSphere.position.copy(pivotVec);
        root.add(pivotSphere);

        // Dynamic 5-strand elastic muscle fiber bundle
        const fiberGroup = new THREE.Group();
        const fiberMaterial = new THREE.MeshStandardMaterial({
          color: 0xe11d48,
          emissive: 0xbe123c,
          emissiveIntensity: 0.35,
          roughness: 0.35,
          metalness: 0.08,
        });
        const fiberMeshes: THREE.Mesh[] = [];
        for (let i = 0; i < 5; i += 1) {
          const fm = new THREE.Mesh(new THREE.BufferGeometry(), fiberMaterial);
          fiberGroup.add(fm);
          fiberMeshes.push(fm);
        }
        root.add(fiberGroup);

        // 3D SFTR protractor arc line
        const protractorMaterial = new THREE.LineBasicMaterial({
          color: 0x10b981,
          linewidth: 2,
        });
        const protractorLine = new THREE.Line(new THREE.BufferGeometry(), protractorMaterial);
        root.add(protractorLine);

        scene.add(root);

        // Compute ideal camera framing around the active muscle + joint pivot + moving limb context
        const focusBox = new THREE.Box3();
        focusBox.expandByPoint(pivotVec);
        focusBox.expandByPoint(toVec3(anchors.pp));
        focusBox.expandByPoint(toVec3(anchors.pk));
        if (!matchedMuscleBox.isEmpty()) focusBox.union(matchedMuscleBox);
        if (!distalBoneBox.isEmpty()) {
          // Include midpoint toward distal bone center so the whole articulating bone stays clearly in frame
          const distalCenter = new THREE.Vector3();
          distalBoneBox.getCenter(distalCenter);
          focusBox.expandByPoint(distalCenter);
        }
        const focusSphere = new THREE.Sphere();
        focusBox.getBoundingSphere(focusSphere);
        const focusRadius = Math.max(0.22, Math.min(0.55, focusSphere.radius * 1.5));

        rigRef.current = {
          root,
          proximalPivot,
          distalPivot,
          pivotPos,
          ppMarker,
          pkMarker,
          ppAnchorNode,
          pkAnchorNode,
          fiberGroup,
          fiberMeshes,
          fiberMaterial,
          protractorLine,
          protractorMaterial,
          realMuscleMeshes: matchedMuscleMeshes,
          focusCenter: focusSphere.center.clone(),
          focusRadius,
        };

        // Frame camera from best anatomical angle (anterior-lateral 3/4 view, or posterior for back muscles)
        const isPosterior =
          /trapezius|latissimus|rhomboid|erector|infraspinatus|teres|gluteus|piriformis|obturator|quadratus_femoris|biceps_femoris|semitendinosus|semimembranosus|popliteus|gastrocnemius|soleus|tibialis_posterior|flexor_hallucis|splenius|triceps/i.test(
            profile.muscleId,
          );
        const dist = focusRadius * 2.85;
        const sideSign = activePreset.scene === 'head_neck' || activePreset.scene === 'torso_only' ? -0.45 : -0.68;
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
          setLoadError('Nie udało się załadować modelu kostnego 3D.');
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [profile.muscleId, activePreset.id, webglUnavailable]);

  // Re-evaluate frame immediately when user drags slider or switches physiological mode
  useEffect(() => {
    applyRigFrame(progress01);
  }, [progress01, simMode]);

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
            Symulowany ruch:
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
          compact ? 'h-[260px] sm:h-[310px]' : 'h-[300px] sm:h-[380px]'
        }`}
      >
        <div ref={containerRef} className="h-full w-full" />

        {/* Live SFTR Angle & Plane HUD (top-left) */}
        <div className="pointer-events-none absolute top-2.5 left-2.5 flex max-w-[72%] flex-col gap-1">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-[#d6e7dc]/90 bg-white/90 px-2.5 py-1 text-[11px] font-extrabold text-emerald-950 shadow-xs backdrop-blur-sm dark:border-[#2a4a39] dark:bg-[#0d1912]/90 dark:text-emerald-100">
            <span
              className={`h-2 w-2 rounded-full ${
                simMode === 'eccentric'
                  ? 'bg-amber-500'
                  : simMode === 'closed_chain'
                    ? 'bg-emerald-500'
                    : 'bg-rose-500'
              }`}
            />
            <span ref={angleBadgeRef} className="shrink-0 whitespace-nowrap font-mono-tabular">
              0°
            </span>
            <span className="text-[#52695b] dark:text-[#94b0a0]">•</span>
            <span className="truncate">{activePreset.planePl}</span>
          </div>
          {!maskedQuizMode && (
            <div className="w-fit rounded-lg bg-white/85 px-2 py-0.5 text-[10px] font-bold text-[#354c3f] shadow-xs backdrop-blur-sm dark:bg-[#0d1912]/85 dark:text-[#c7dbcf]">
              {activePreset.axisPl} • {activePreset.sftrLabel}
            </div>
          )}
        </div>

        {/* Floating Camera & Layer Controls (top-right) */}
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
            title={showMuscleOverlay ? 'Ukryj realną siatkę mięśnia' : 'Pokaż realną siatkę mięśnia'}
            onClick={() => setShowMuscleOverlay((v) => !v)}
            className={`flex h-8 w-8 items-center justify-center rounded-xl border shadow-xs backdrop-blur-sm transition ${
              showMuscleOverlay
                ? 'border-emerald-400 bg-emerald-50/95 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/90 dark:text-emerald-300'
                : 'border-[#c5dfd0] bg-white/90 text-[#52695b] dark:border-[#2a4a39] dark:bg-[#112018]/90 dark:text-[#94b0a0]'
            }`}
          >
            {showMuscleOverlay ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
          <button
            type="button"
            title={touchMode === 'rotate' ? 'Dotyk: Obrót (kliknij, aby przełączyć na Przesuwanie)' : 'Dotyk: Przesuwanie (kliknij, aby przełączyć na Obrót)'}
            onClick={() => setTouchMode((m) => (m === 'rotate' ? 'pan' : 'rotate'))}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#c5dfd0] bg-white/90 text-emerald-900 shadow-xs backdrop-blur-sm transition hover:bg-emerald-50 dark:border-[#2a4a39] dark:bg-[#112018]/90 dark:text-emerald-200"
          >
            {touchMode === 'rotate' ? <Rotate3d className="h-4 w-4" /> : <Move className="h-4 w-4" />}
          </button>
        </div>

        {/* Legend pills (bottom-left) */}
        <div className="pointer-events-none absolute bottom-2 left-2.5 flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
          <span className="inline-flex items-center gap-1 rounded-lg bg-white/85 px-1.5 py-0.5 text-rose-700 backdrop-blur-sm dark:bg-[#0d1912]/85 dark:text-rose-300">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> PP
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-white/85 px-1.5 py-0.5 text-emerald-700 backdrop-blur-sm dark:bg-[#0d1912]/85 dark:text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> PK
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-white/85 px-1.5 py-0.5 text-amber-700 backdrop-blur-sm dark:bg-[#0d1912]/85 dark:text-amber-300">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> Oś stawu
          </span>
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
                <span>Składanie kości Z-Anatomy i osi stawu…</span>
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

        {/* Row 2: Physiological Mode Switcher (Hidden in maskedQuizMode to avoid hints) */}
        {!maskedQuizMode && (
          <>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(
                [
                  { id: 'concentric', label: 'Koncentryczna', activeCls: 'border-rose-500 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-950/60 dark:text-rose-200' },
                  { id: 'eccentric', label: 'Ekscentryczna (hamowanie)', activeCls: 'border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200' },
                  { id: 'closed_chain', label: 'Łańcuch zamknięty (odwrócony przyczep)', activeCls: 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200' },
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
