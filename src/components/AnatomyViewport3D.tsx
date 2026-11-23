import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  AlertTriangle,
  Eye,
  EyeOff,
  FlipHorizontal2,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  RotateCcw,
  ScanEye,
  Scissors,
  SlidersHorizontal,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  AnatomicalLayerId,
  BiomechanicsHighlightState,
  BonyLandmarkHotspot,
  ClippingPlaneAxis,
  ClippingPlaneState,
  ClinicalNerveHighlight,
  ClinicalTestHighlightState,
  DermatomeHighlightState,
  MuscleGroupingMode,
  RegionId,
  StructureCategory,
} from '../types/anatomy';
import {
  buildProceduralAnatomyModel,
  type SelectableMeshMeta,
} from '../three/proceduralModels';
export type { SelectableMeshMeta };
import { formatBilingualName, translateMeshNameToPolish } from '../three/anatomyTranslator';
import {
  ANATOMY_LAYERS_META,
  classifyBaseGlbMeshLayer,
  createDefaultLayerVisibility,
  createMaterialForLayer,
  formatMuscleSubpartPolish,
  getUnifiedMeshGroupKey,
  layerIdToLegacyTissueType,
  loadLayersManifest,
  OVERLAY_KEY_TO_LAYER_ID,
  type OverlayGlbLayerKey,
} from '../three/anatomyLayers';
import {
  doesMeshMatchNerveInnervation,
  getNerveProfileByStructureId,
} from '../data/nerveMuscleMap';
import {
  doesMuscleMeshMatchMyotome,
  doesSkinMeshMatchDermatome,
  getDermatomeLevelById,
} from '../data/dermatomesMyotomes';
import {
  getMovementById,
  resolveMuscleBiomechanicsRole,
} from '../data/biomechanicsDb';
import { ANATOMY_MAP } from '../data/anatomyDb';
import { BONY_LANDMARKS, type BonyLandmarkExtended } from '../data/bonyLandmarks';
import {
  type BoneSurfaceZoneMode,
  buildBoneSurfaceZones,
  detectHitBoneSurfaceZone,
  getBoneZoneWorldPosition,
  resolveAttachedMuscleTarget,
  updateAllBoneSurfaceColors,
} from '../three/boneSurfaceZones';

export const LOCAL_BODY_MODEL_PATH = '/models/body.glb';

export const REGIONAL_MODEL_PATHS: Record<string, string> = {
  head_neck: '/models/regional/head_neck.glb',
  upper_limb_left: '/models/regional/upper_limb_left.glb',
  upper_limb_right: '/models/regional/upper_limb_right.glb',
  lower_limb_left: '/models/regional/lower_limb_left.glb',
  lower_limb_right: '/models/regional/lower_limb_right.glb',
  torso: '/models/regional/torso.glb',
  full_body: '/models/body.glb',
};

export type RegionalModelKey =
  | 'head_neck'
  | 'upper_limb_left'
  | 'upper_limb_right'
  | 'lower_limb_left'
  | 'lower_limb_right'
  | 'torso'
  | 'full_body';

export type ViewportModelMode = RegionId | RegionalModelKey | string;
export type CameraViewPreset = 'front' | 'back' | 'right' | 'left';

export interface ViewportSelectTarget {
  partId?: string;
  structureId?: string;
  landmarkId?: string;
  isolateIfMuscle?: boolean;
  silent?: boolean;
}

const TORSO_STRUCTURES_IDS = new Set([
  'm_pectoralis_major',
  'm_pectoralis_minor',
  'm_serratus_anterior',
  'm_rhomboideus_major',
  'm_rhomboideus_minor',
  'm_trapezius',
  'm_latissimus_dorsi',
  'm_erector_spinae',
  'm_iliopsoas',
  'm_rectus_abdominis',
  'm_obliquus_externus_abdominis',
  'm_quadratus_lumborum',
  'a_aorta',
  'a_subclavia',
  'a_iliaca_communis',
  'v_cava_superior',
  'v_cava_inferior',
  'v_subclavia',
  'v_portae',
  'n_medulla_spinalis',
  'org_cor',
  'org_pulmo',
  'org_trachea',
  'org_oesophagus',
  'org_gaster',
  'org_hepar',
  'org_vesica_biliaris',
  'org_pancreas',
  'org_splen',
  'org_intestinum_tenue',
  'org_colon',
  'org_ren',
  'org_vesica_urinaria',
  'lig_longitudinale_anterius',
  'lig_flavum',
  'lig_sacrotuberale',
  'bursa_iliopectinea',
  'skin_thorax_abdomen',
  'skin_back_lumbar',
]);

const LOWER_LIMB_STRUCTURES_IDS = new Set([
  'm_gluteus_maximus',
  'm_gluteus_medius',
  'm_gluteus_minimus',
  'm_piriformis',
  'm_adductor_longus',
  'm_adductor_magnus',
  'm_sartorius',
  'm_gracilis',
  'm_fibularis_brevis',
  'm_tibialis_posterior',
  'm_quadriceps_femoris',
  'm_biceps_femoris',
  'm_semitendinosus',
  'm_semimembranosus',
  'm_popliteus',
  'm_gastrocnemius',
  'm_soleus',
  'm_tibialis_anterior',
  'm_peroneus_longus',
  'pes_anserinus',
  'achilles_tendon',
  'a_femoralis',
  'a_profunda_femoris',
  'a_poplitea',
  'a_tibialis_anterior',
  'a_tibialis_posterior',
  'a_dorsalis_pedis',
  'v_femoralis',
  'v_saphena_magna',
  'v_saphena_parva',
  'v_poplitea',
  'n_femoralis',
  'n_ischiadicus',
  'n_tibialis',
  'n_fibularis_communis',
  'n_obturatorius',
  'bursa_trochanterica',
  'bursa_suprapatellaris',
  'bursa_praepatellaris',
  'bursa_infrapatellaris_profunda',
  'bursa_anserina',
  'bursa_calcanea',
  'tendon_tibialis_anterior_sheath',
  'tendon_tibialis_posterior_sheath',
  'tendon_fibularis_sheath',
  'lig_iliofemorale',
  'lig_ischiofemorale',
  'lig_pubofemorale',
  'lig_talofibulare_anterius',
  'lig_deltoideum_ankle',
  'skin_gluteal_thigh',
  'skin_leg_foot',
]);

export function resolveBestRegionalKeyForStructure(
  structureId?: string,
  fallbackRegion?: ViewportModelMode | string,
): RegionalModelKey {
  if (structureId) {
    const isLeft = /_left|_l\b|lewa|lewy/i.test(structureId);
    if (structureId === 'atlas_c1' || structureId === 'axis_c2' || structureId === 'vertebra_c7' || structureId === 'vertebra_c5') {
      return 'head_neck';
    }
    if (structureId === 'm_tensor_fasciae_latae') {
      return 'full_body';
    }
    if (TORSO_STRUCTURES_IDS.has(structureId)) {
      return 'torso';
    }
    if (LOWER_LIMB_STRUCTURES_IDS.has(structureId) || /^m_gluteus_/i.test(structureId)) {
      return isLeft ? 'lower_limb_left' : 'lower_limb_right';
    }
  }
  switch (fallbackRegion) {
    case 'head_neck':
      return 'head_neck';
    case 'upper_limb_left':
      return 'upper_limb_left';
    case 'upper_limb':
    case 'upper_limb_right':
    case 'shoulder':
      return structureId && /_left|_l\b|lewa|lewy/i.test(structureId)
        ? 'upper_limb_left'
        : 'upper_limb_right';
    case 'lower_limb_left':
      return 'lower_limb_left';
    case 'lower_limb':
    case 'lower_limb_right':
    case 'knee':
      return structureId && /_left|_l\b|lewa|lewy/i.test(structureId)
        ? 'lower_limb_left'
        : 'lower_limb_right';
    case 'torso':
    case 'spine_thorax':
    case 'pelvis_hip':
      return 'torso';
    case 'full_body':
    default:
      return 'full_body';
  }
}

export function resolveRegionalModelPath(
  region: ViewportModelMode | string,
  structureId?: string,
): string {
  if (region === 'full_body') {
    return REGIONAL_MODEL_PATHS.full_body;
  }
  const bestKey = resolveBestRegionalKeyForStructure(structureId, region);
  return REGIONAL_MODEL_PATHS[bestKey] ?? REGIONAL_MODEL_PATHS.full_body;
}

const REGION_TITLES: Record<string, string> = {
  full_body: 'Podgląd 3D: Pełny model anatomiczny (Full Body)',
  head_neck: 'Model 3D: Głowa i szyja (Head & Neck)',
  torso: 'Model 3D: Tułów (Torso)',
  spine_thorax: 'Model 3D: Kręgosłup i klatka piersiowa (Spine & Thorax)',
  pelvis_hip: 'Model 3D: Miednica i staw biodrowy (Pelvis & Hip)',
  shoulder: 'Model 3D: Kompleks barkowy (Shoulder Complex)',
  upper_limb: 'Model 3D: Kończyna górna (Upper Limb)',
  upper_limb_left: 'Model 3D: Kończyna górna lewa (Left Upper Limb)',
  upper_limb_right: 'Model 3D: Kończyna górna prawa (Right Upper Limb)',
  knee: 'Model 3D: Staw kolanowy (Knee Joint)',
  lower_limb: 'Model 3D: Kończyna dolna (Lower Limb)',
  lower_limb_left: 'Model 3D: Kończyna dolna lewa (Left Lower Limb)',
  lower_limb_right: 'Model 3D: Kończyna dolna prawa (Right Lower Limb)',
};

export type TissueLayerFilter = 'all' | 'muscle' | 'bone';
export type BodyFocusZone = 'full' | 'shoulder' | 'knee' | 'head' | 'thorax' | 'pelvis';

export interface SelectedPartInfo {
  id: string;
  rawMeshName?: string;
  namePl: string;
  nameEn?: string;
  bilingualName?: string;
  structureId?: string;
  category?: StructureCategory;
  tissueType?: 'muscle' | 'bone' | 'other';
  layerId?: AnatomicalLayerId;
}

export interface AnatomyViewport3DHandle {
  focusMesh: (partId: string) => void;
  focusBodyZone: (zone: BodyFocusZone) => void;
  setCameraPreset?: (preset: CameraViewPreset) => void;
  selectLandmark?: (landmarkId: string) => void;
  selectAndFocusTarget?: (target: ViewportSelectTarget) => boolean;
  isolateMuscle?: (partId: string) => void;
  isolateAttachedMuscle?: (attachedText: string, preferredSide?: 'right' | 'left' | 'midline') => void;
  clearIsolatedMuscle?: () => void;
  resetCamera: () => void;
}

export interface AnatomyViewport3DProps {
  region: ViewportModelMode;
  modelUrl?: string;
  selectedId?: string | null;
  selectedPartId?: string | null;
  highlightedStructureId?: string | null;
  onSelectPart: (part: SelectedPartInfo | null) => void;
  onPartsLoaded?: (parts: SelectableMeshMeta[]) => void;
  onLandmarksLoaded?: (landmarks: BonyLandmarkExtended[]) => void;
  onLoaded?: () => void;
  onIsolatedMuscleChange?: (isolatedPartId: string | null) => void;
  filterMode?: TissueLayerFilter;
  enableExtendedLayers?: boolean;
  initialVisibleLayers?: Partial<Record<AnatomicalLayerId, boolean>>;
  initialBoneZoneMode?: BoneSurfaceZoneMode;
  clinicalNerveHighlight?: ClinicalNerveHighlight | null;
  onClearClinicalNerveHighlight?: () => void;
  dermatomeHighlight?: DermatomeHighlightState | null;
  onClearDermatomeHighlight?: () => void;
  clinicalTestHighlight?: ClinicalTestHighlightState | null;
  onClearClinicalTestHighlight?: () => void;
  biomechanicsHighlight?: BiomechanicsHighlightState | null;
  onClearBiomechanicsHighlight?: () => void;
  showMuscleGroupingToggle?: boolean;
  showClippingControl?: boolean;
  exploded?: boolean;
  heightClassName?: string;
  isDarkMode?: boolean;
  allowUpload?: boolean;
  enableGitHubBrowser?: boolean;
  hideHotspotOverlay?: boolean;
  hideHoverLabel?: boolean;
  highlightMode?: 'neutral' | 'correct' | 'wrong';
}

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export const AnatomyViewport3D = React.forwardRef<
  AnatomyViewport3DHandle,
  AnatomyViewport3DProps
>(
  (
    {
      region,
      modelUrl,
      selectedId = null,
      selectedPartId,
      highlightedStructureId = null,
      onSelectPart,
      onPartsLoaded,
      onLandmarksLoaded,
      onLoaded,
      onIsolatedMuscleChange,
      filterMode,
      enableExtendedLayers = false,
      initialVisibleLayers,
      initialBoneZoneMode,
      clinicalNerveHighlight = null,
      onClearClinicalNerveHighlight,
      dermatomeHighlight = null,
      onClearDermatomeHighlight,
      clinicalTestHighlight = null,
      onClearClinicalTestHighlight,
      biomechanicsHighlight = null,
      onClearBiomechanicsHighlight,
      showMuscleGroupingToggle,
      showClippingControl,
      exploded: explodedProp,
      heightClassName = 'h-[360px] sm:h-[420px]',
      isDarkMode = false,
      allowUpload = true,
      enableGitHubBrowser = false,
      hideHotspotOverlay = false,
      hideHoverLabel = false,
      highlightMode = 'neutral',
    },
    ref,
  ) => {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const onSelectPartRef = useRef(onSelectPart);
    onSelectPartRef.current = onSelectPart;
    const onPartsLoadedRef = useRef(onPartsLoaded);
    onPartsLoadedRef.current = onPartsLoaded;
    const onLandmarksLoadedRef = useRef(onLandmarksLoaded);
    onLandmarksLoadedRef.current = onLandmarksLoaded;
    const onLoadedRef = useRef(onLoaded);
    onLoadedRef.current = onLoaded;
    const onIsolatedMuscleChangeRef = useRef(onIsolatedMuscleChange);
    onIsolatedMuscleChangeRef.current = onIsolatedMuscleChange;
    const hideHoverLabelRef = useRef(hideHoverLabel);
    hideHoverLabelRef.current = hideHoverLabel;
    const enableExtendedLayersRef = useRef(enableExtendedLayers);
    enableExtendedLayersRef.current = enableExtendedLayers;
    const clinicalNerveHighlightRef = useRef<ClinicalNerveHighlight | null>(clinicalNerveHighlight);
    clinicalNerveHighlightRef.current = clinicalNerveHighlight;
    const dermatomeHighlightRef = useRef<DermatomeHighlightState | null>(dermatomeHighlight);
    dermatomeHighlightRef.current = dermatomeHighlight;
    const clinicalTestHighlightRef = useRef<ClinicalTestHighlightState | null>(clinicalTestHighlight);
    clinicalTestHighlightRef.current = clinicalTestHighlight;
    const biomechanicsHighlightRef = useRef<BiomechanicsHighlightState | null>(biomechanicsHighlight);
    biomechanicsHighlightRef.current = biomechanicsHighlight;
    const biomechanicsGuideGroupRef = useRef<THREE.Group | null>(null);

    const canToggleMuscleGrouping = showMuscleGroupingToggle ?? enableExtendedLayers;
    const canUseClipping = showClippingControl ?? enableExtendedLayers;

    const effectiveSelectedId =
      selectedPartId !== undefined ? selectedPartId : selectedId;

    const [exploded, setExploded] = useState(Boolean(explodedProp));
    const [xrayMode, setXrayMode] = useState(false);
    const xrayModeRef = useRef(false);
    xrayModeRef.current = xrayMode;
    const [muscleGroupingMode, setMuscleGroupingMode] = useState<MuscleGroupingMode>('whole');
    const muscleGroupingModeRef = useRef<MuscleGroupingMode>(muscleGroupingMode);
    muscleGroupingModeRef.current = muscleGroupingMode;
    const [clippingState, setClippingState] = useState<ClippingPlaneState>({
      axis: 'off',
      depth: 0.5,
      inverted: false,
    });
    const clippingStateRef = useRef<ClippingPlaneState>(clippingState);
    clippingStateRef.current = clippingState;
    const [showClippingPanel, setShowClippingPanel] = useState(false);
    const [layerFilter, setLayerFilter] = useState<TissueLayerFilter>(
      filterMode ?? 'all',
    );
    const [visibleLayers, setVisibleLayers] = useState<Record<AnatomicalLayerId, boolean>>(() => ({
      ...createDefaultLayerVisibility(enableExtendedLayers),
      ...(initialVisibleLayers ?? {}),
    }));
    const visibleLayersRef = useRef(visibleLayers);
    visibleLayersRef.current = visibleLayers;
    const initialLayersSyncKey = JSON.stringify(initialVisibleLayers ?? null);
    useEffect(() => {
      if (!initialVisibleLayers) return;
      setVisibleLayers({
        ...createDefaultLayerVisibility(enableExtendedLayers),
        ...initialVisibleLayers,
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialLayersSyncKey, enableExtendedLayers]);
    const [skinOpacity, setSkinOpacity] = useState<number>(0.3);
    const skinOpacityRef = useRef(skinOpacity);
    skinOpacityRef.current = skinOpacity;
    const [showLayersPanel, setShowLayersPanel] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [layerMeshCounts, setLayerMeshCounts] = useState<Partial<Record<AnatomicalLayerId, number>>>({});
    const [loadingOverlayLayers, setLoadingOverlayLayers] = useState(false);
    const [hiddenPartIds, setHiddenPartIds] = useState<string[]>([]);
    const [isolatedMusclePartId, setIsolatedMusclePartId] = useState<string | null>(null);
    const [showHiddenPanel, setShowHiddenPanel] = useState(false);
    const [partLabelsById, setPartLabelsById] = useState<Record<string, string>>({});
    const [customModelName, setCustomModelName] = useState<string | null>(null);
    const [hoveredName, setHoveredName] = useState<string | null>(null);
    const [webglError, setWebglError] = useState<string | null>(null);
    const [loadingModel, setLoadingModel] = useState(false);
    const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
    const [isGlbLoaded, setIsGlbLoaded] = useState(false);
    const [boneZoneMode, setBoneZoneMode] = useState<BoneSurfaceZoneMode>(
      initialBoneZoneMode ?? 'landmarks',
    );
    const boneZoneModeRef = useRef<BoneSurfaceZoneMode>(initialBoneZoneMode ?? 'landmarks');
    boneZoneModeRef.current = boneZoneMode;
    const [selectedHotspot, setSelectedHotspot] = useState<BonyLandmarkHotspot | null>(null);
    const selectedHotspotRef = useRef<BonyLandmarkHotspot | null>(null);
    selectedHotspotRef.current = selectedHotspot;
    const pendingOverlayTargetRef = useRef<ViewportSelectTarget | null>(null);
    const overlaysLoadingRef = useRef(false);

    const sceneRefs = useRef<{
      renderer: THREE.WebGLRenderer | null;
      scene: THREE.Scene | null;
      camera: THREE.PerspectiveCamera | null;
      controls: OrbitControls | null;
      pedestal: THREE.Mesh | null;
      contactShadow: THREE.Mesh | null;
      clipPlane: THREE.Plane;
      clipGuide: THREE.LineLoop | null;
      applyClipping: () => void;
      activeGroup: THREE.Group | null;
      interactables: THREE.Mesh[];
      partMeshes: Map<string, THREE.Mesh[]>;
      hotspotMarkers: THREE.Mesh[];
      disposables: Array<{ dispose: () => void }>;
      requestRender: () => void;
      renderNow: () => void;
      selectedId: string | null;
      hoveredId: string | null;
      hoveredLandmarkId: string | null;
      highlightMode: 'neutral' | 'correct' | 'wrong';
      modelBounds: THREE.Box3 | null;
      isGlbActive: boolean;
      isFullBodyGlb: boolean;
      isSoftwareGl: boolean;
      region: ViewportModelMode;
      customModelName: string | null;
      resetCamera: () => void;
      zoomBy: (factor: number) => void;
      focusBodyZone: (zone: BodyFocusZone) => void;
      setCameraPreset: (preset: CameraViewPreset) => void;
      focusMesh: (partId: string) => void;
      focusHotspot?: (hotspot: BonyLandmarkHotspot, orientToNormal?: boolean) => void;
      selectLandmark?: (landmarkId: string) => void;
      loadProcedural: (targetRegion: RegionId, notice?: string | null) => void;
      loadGlbFromUrl: (url: string, label: string, fallbackRegion: RegionId) => void;
      loadCustomGlb: (file: File) => void;
    }>({
      renderer: null,
      scene: null,
      camera: null,
      controls: null,
      pedestal: null,
      contactShadow: null,
      clipPlane: new THREE.Plane(new THREE.Vector3(0, -1, 0), 0),
      clipGuide: null,
      applyClipping: () => {},
      activeGroup: null,
      interactables: [],
      partMeshes: new Map(),
      hotspotMarkers: [],
      disposables: [],
      requestRender: () => {},
      renderNow: () => {},
      selectedId: null,
      hoveredId: null,
      hoveredLandmarkId: null,
      highlightMode: 'neutral',
      modelBounds: null,
      isGlbActive: false,
      isFullBodyGlb: false,
      isSoftwareGl: false,
      region,
      customModelName: null,
      resetCamera: () => {},
      zoomBy: () => {},
      focusBodyZone: () => {},
      setCameraPreset: () => {},
      focusMesh: () => {},
      loadProcedural: () => {},
      loadGlbFromUrl: () => {},
      loadCustomGlb: () => {},
    });

    const isolateAttachedMuscleByText = (
      attachedText: string,
      preferredSide?: 'right' | 'left' | 'midline',
    ) => {
      const target = resolveAttachedMuscleTarget(attachedText);
      const preferredSideText =
        preferredSide === 'right'
          ? 'strona prawa'
          : preferredSide === 'left'
            ? 'strona lewa'
            : null;

      const matchesTarget = (mesh: THREE.Mesh) => {
        if (target.structureId && mesh.userData.structureId === target.structureId) {
          return true;
        }
        const pl = ((mesh.userData.namePl as string) || '').toLowerCase();
        const en = ((mesh.userData.nameEn as string) || '').toLowerCase();
        return (
          Boolean(target.coreNamePl && pl.includes(target.coreNamePl.toLowerCase())) ||
          Boolean(target.coreNameEn && en.includes(target.coreNameEn.toLowerCase()))
        );
      };

      const hitMesh =
        (preferredSideText
          ? sceneRefs.current.interactables.find(
              (mesh) =>
                matchesTarget(mesh) &&
                ((mesh.userData.namePl as string) || '').toLowerCase().includes(preferredSideText),
            )
          : undefined) ?? sceneRefs.current.interactables.find(matchesTarget);

      if (hitMesh) {
        const ud = hitMesh.userData;
        setIsolatedMusclePartId(ud.id);
        setBoneZoneMode((prev) => (prev === 'off' ? 'attachments' : prev));
        setSelectedHotspot(null);
        onSelectPartRef.current({
          id: ud.id,
          rawMeshName: ud.rawName || hitMesh.name,
          namePl: ud.namePl,
          nameEn: ud.nameEn,
          bilingualName: ud.bilingualName || formatBilingualName(ud.namePl, ud.nameEn),
          structureId: ud.structureId,
          category: ud.category,
          tissueType: ud.tissueType,
        });
        sceneRefs.current.focusMesh(ud.id);
      }
    };

    const STRUCTURE_FALLBACK_LANDMARK: Record<string, string> = {
      fossa_supraspinata: 'scapula_supraspinous_fossa_r',
      fossa_infraspinata: 'scapula_infraspinous_fossa_r',
      cavitas_glenoidalis: 'shoulder_labrum_glenoidale_r',
      articulatio_humeri: 'humerus_head_r',
      articulatio_ac: 'clavicle_acromial_end_r',
      pcl: 'knee_acl_r',
      lcl: 'femur_lateral_epicondyle_r',
      meniscus_lateralis: 'knee_meniscus_medialis_r',
      vertebrae_thoracicae: 'vertebra_t6_spinous_process',
      vertebrae_lumbales: 'vertebra_l4_spinous_process',
      discus_intervertebralis: 'vertebra_l4_spinous_process',
      acetabulum: 'pelvis_aiis_r',
      achilles_tendon: 'calcaneus_tuberosity_r',
      m_tensor_fasciae_latae: 'pelvis_asis_r',
    };

    const selectAndFocusTargetInternal = (target: ViewportSelectTarget): boolean => {
      const refs = sceneRefs.current;
      // 1. Direct landmark target
      const desiredLandmarkId =
        target.landmarkId ??
        (target.structureId ? STRUCTURE_FALLBACK_LANDMARK[target.structureId] : undefined);
      if (desiredLandmarkId) {
        const zonePos = getBoneZoneWorldPosition(refs.interactables, desiredLandmarkId);
        if (zonePos) {
          setXrayMode(false);
          setIsolatedMusclePartId(null);
          setLayerFilter('bone');
          setBoneZoneMode((prev) => (prev === 'off' ? 'landmarks' : prev));
          setSelectedHotspot(zonePos.landmark);
          if (!target.silent) {
            const lm = zonePos.landmark;
            onSelectPartRef.current({
              id: lm.id,
              namePl: lm.namePl,
              nameEn: lm.nameEn,
              bilingualName: lm.bilingualName || formatBilingualName(lm.namePl, lm.nameEn),
              structureId: lm.structureId || lm.id,
              category: 'bone',
              tissueType: 'bone',
            });
          }
          refs.focusHotspot?.(zonePos.landmark, true);
          return true;
        }
      }

      // 2. Landmark matched by structureId (e.g., tuberculum_majus, acl, pes_anserinus)
      if (target.structureId) {
        const zoneByStructure = getBoneZoneWorldPosition(refs.interactables, target.structureId);
        if (zoneByStructure) {
          setXrayMode(false);
          setIsolatedMusclePartId(null);
          setLayerFilter('bone');
          setBoneZoneMode((prev) => (prev === 'off' ? 'landmarks' : prev));
          setSelectedHotspot(zoneByStructure.landmark);
          if (!target.silent) {
            const lm = zoneByStructure.landmark;
            onSelectPartRef.current({
              id: lm.id,
              namePl: lm.namePl,
              nameEn: lm.nameEn,
              bilingualName: lm.bilingualName || formatBilingualName(lm.namePl, lm.nameEn),
              structureId: lm.structureId || lm.id,
              category: 'bone',
              tissueType: 'bone',
            });
          }
          refs.focusHotspot?.(zoneByStructure.landmark, true);
          return true;
        }
      }

      // 3. Mesh target by partId or structureId (preferring right-side mesh when bilateral)
      let hitMesh: THREE.Mesh | undefined;
      if (target.partId) {
        hitMesh = refs.interactables.find((m) => m.userData.id === target.partId);
      }
      if (!hitMesh && target.structureId) {
        const candidates = refs.interactables.filter(
          (m) => m.userData.structureId === target.structureId,
        );
        hitMesh =
          candidates.find((m) =>
            ((m.userData.namePl as string) || '').toLowerCase().includes('strona prawa'),
          ) ?? candidates[0];
      }

      if (!hitMesh) {
        if (overlaysLoadingRef.current) {
          pendingOverlayTargetRef.current = target;
        }
        return false;
      }
      pendingOverlayTargetRef.current = null;
      const ud = hitMesh.userData;
      const meshLayerId = (ud.layerId as AnatomicalLayerId | undefined) ?? (ud.tissueType === 'muscle' ? 'muscle' : 'bone');
      const isMuscle = ud.tissueType === 'muscle' || ud.category === 'muscle';
      setXrayMode(false);
      setSelectedHotspot(null);

      // Ensure the target's anatomical layer is visible
      setVisibleLayers((prev) => (prev[meshLayerId] ? prev : { ...prev, [meshLayerId]: true }));
      if (meshLayerId === 'skin') {
        setSkinOpacity((prev) => (prev < 0.8 ? 0.85 : prev));
      }

      if (isMuscle && target.isolateIfMuscle) {
        setIsolatedMusclePartId((ud.structureId as string) || (ud.id as string));
        setBoneZoneMode('attachments');
      } else {
        setIsolatedMusclePartId(null);
        setLayerFilter(ud.tissueType === 'bone' ? 'bone' : 'all');
      }

      if (!target.silent) {
        onSelectPartRef.current({
          id: ud.id,
          rawMeshName: ud.rawName || hitMesh.name,
          namePl: ud.namePl,
          nameEn: ud.nameEn,
          bilingualName: ud.bilingualName || formatBilingualName(ud.namePl, ud.nameEn),
          structureId: ud.structureId,
          category: ud.category,
          tissueType: ud.tissueType,
          layerId: meshLayerId,
        });
      }
      // Make sure target mesh(es) are immediately visible before computing focus box
      const groupMeshes = refs.partMeshes.get(ud.id) ?? [hitMesh];
      for (const gm of groupMeshes) gm.visible = true;
      refs.focusMesh(ud.id);
      return true;
    };

    useImperativeHandle(
      ref,
      () => ({
        focusMesh: (partId: string) => sceneRefs.current.focusMesh(partId),
        focusBodyZone: (zone: BodyFocusZone) =>
          sceneRefs.current.focusBodyZone(zone),
        setCameraPreset: (preset: CameraViewPreset) =>
          sceneRefs.current.setCameraPreset(preset),
        selectLandmark: (landmarkId: string) =>
          sceneRefs.current.selectLandmark?.(landmarkId),
        selectAndFocusTarget: (target: ViewportSelectTarget) =>
          selectAndFocusTargetInternal(target),
        isolateMuscle: (partId: string) => {
          setXrayMode(false);
          setIsolatedMusclePartId(partId);
          setBoneZoneMode('attachments');
          setSelectedHotspot(null);
          sceneRefs.current.focusMesh(partId);
        },
        isolateAttachedMuscle: (attachedText: string, preferredSide?: 'right' | 'left' | 'midline') =>
          isolateAttachedMuscleByText(attachedText, preferredSide),
        clearIsolatedMuscle: () => {
          setIsolatedMusclePartId(null);
          setLayerFilter('all');
        },
        resetCamera: () => sceneRefs.current.resetCamera(),
      }),
      [],
    );

    useEffect(() => {
      onIsolatedMuscleChangeRef.current?.(isolatedMusclePartId);
    }, [isolatedMusclePartId]);

    // Sync filterMode prop if controlled externally
    useEffect(() => {
      if (filterMode !== undefined) {
        setLayerFilter(filterMode);
        setIsolatedMusclePartId(null);
      }
    }, [filterMode]);

    // Sync exploded prop if controlled externally
    useEffect(() => {
      if (explodedProp !== undefined) {
        setExploded(explodedProp);
      }
    }, [explodedProp]);

    // Sync initialBoneZoneMode when changed by parent (e.g. Pin Exam switching pool)
    useEffect(() => {
      if (initialBoneZoneMode !== undefined) {
        setBoneZoneMode(initialBoneZoneMode);
      }
    }, [initialBoneZoneMode]);

    // Update highlight styling whenever selectedId, highlightMode, boneZoneMode, xrayMode, or selectedHotspot changes
    useEffect(() => {
      const refs = sceneRefs.current;
      refs.selectedId = effectiveSelectedId;
      refs.highlightMode = highlightMode;
      refs.region = region;
      refs.customModelName = customModelName;
      applyVisualHighlights();
      refs.renderNow();
      refs.requestRender();
    }, [effectiveSelectedId, highlightMode, region, customModelName, boneZoneMode, selectedHotspot, xrayMode]);

  // Update scene background & pedestal on theme switch
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs.scene) return;
    refs.scene.background = new THREE.Color(isDarkMode ? 0x0a1410 : 0x111c18);
    if (refs.pedestal && refs.pedestal.material instanceof THREE.MeshStandardMaterial) {
      refs.pedestal.material.color.setHex(isDarkMode ? 0x16241d : 0x22332a);
    }
    refs.renderNow();
    refs.requestRender();
  }, [isDarkMode]);

  // Update exploded layer separation (smooth damped animation on GPU, crisp snap on software WebGL)
  useEffect(() => {
    const refs = sceneRefs.current;
    if (refs.interactables.length === 0) return;

    if (refs.isSoftwareGl) {
      for (const mesh of refs.interactables) {
        const base = mesh.userData.basePosition as THREE.Vector3 | undefined;
        const vec = mesh.userData.explodeVector as THREE.Vector3 | undefined;
        if (base && vec) {
          mesh.position.copy(base);
          if (exploded) mesh.position.add(vec);
        }
      }
      refs.renderNow();
      refs.requestRender();
      return;
    }

    let animRaf: number | null = null;
    let lastTime = performance.now();
    const targetPos = new THREE.Vector3();

    const stepExplode = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      let settled = true;

      for (const mesh of refs.interactables) {
        const base = mesh.userData.basePosition as THREE.Vector3 | undefined;
        const vec = mesh.userData.explodeVector as THREE.Vector3 | undefined;
        if (!base || !vec) continue;
        targetPos.copy(base);
        if (exploded) targetPos.add(vec);

        mesh.position.x = THREE.MathUtils.damp(mesh.position.x, targetPos.x, 10, dt);
        mesh.position.y = THREE.MathUtils.damp(mesh.position.y, targetPos.y, 10, dt);
        mesh.position.z = THREE.MathUtils.damp(mesh.position.z, targetPos.z, 10, dt);

        if (mesh.position.distanceToSquared(targetPos) > 1e-5) {
          settled = false;
        } else {
          mesh.position.copy(targetPos);
        }
      }

      refs.renderNow();
      if (!settled) {
        animRaf = requestAnimationFrame(stepExplode);
      }
    };

    animRaf = requestAnimationFrame(stepExplode);
    return () => {
      if (animRaf !== null) cancelAnimationFrame(animRaf);
    };
  }, [exploded]);

    // Sync initialVisibleLayers if updated by parent (e.g., Pin Exam switching pool)
    useEffect(() => {
      if (initialVisibleLayers) {
        setVisibleLayers((prev) => ({
          ...prev,
          ...initialVisibleLayers,
        }));
      }
    }, [initialVisibleLayers]);

    // Exit fullscreen cleanly on Escape key
    useEffect(() => {
      if (!isFullscreen) return;
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape') setIsFullscreen(false);
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [isFullscreen]);

    // Sync skin material opacity & depthWrite live when slider moves
    useEffect(() => {
      const refs = sceneRefs.current;
      const clamped = Math.max(0.05, Math.min(1, skinOpacity));
      for (const mesh of refs.interactables) {
        if (mesh.userData.layerId !== 'skin') continue;
        const applyMat = (m: THREE.Material) => {
          if (m instanceof THREE.MeshStandardMaterial) {
            m.transparent = clamped < 0.99;
            m.opacity = clamped;
            m.depthWrite = clamped > 0.85;
            m.needsUpdate = true;
          }
        };
        if (Array.isArray(mesh.material)) mesh.material.forEach(applyMat);
        else if (mesh.material) applyMat(mesh.material);
        if (mesh.userData.originalMaterial) {
          if (Array.isArray(mesh.userData.originalMaterial)) {
            mesh.userData.originalMaterial.forEach(applyMat);
          } else {
            applyMat(mesh.userData.originalMaterial);
          }
        }
      }
      refs.renderNow();
      refs.requestRender();
    }, [skinOpacity]);

    const computeClinicalTestLayerSet = (structureIds: string[]): Set<AnatomicalLayerId> => {
      const allowed = new Set<AnatomicalLayerId>(['bone', 'cartilage', 'muscle']);
      for (const sid of structureIds) {
        const entry = ANATOMY_MAP[sid];
        if (!entry) continue;
        if (entry.category === 'nerve') allowed.add('nerve');
        else if (entry.category === 'artery') allowed.add('artery');
        else if (entry.category === 'vein') allowed.add('vein');
        else if (entry.category === 'organ') allowed.add('organ');
        else if (entry.category === 'bursa') allowed.add('bursa');
        else if (entry.category === 'tendon') allowed.add('tendon');
        else if (entry.category === 'ligament' || entry.category === 'joint_ligament') {
          allowed.add('ligament');
          allowed.add('tendon');
        } else if (entry.category === 'skin') {
          allowed.add('skin');
        }
      }
      return allowed;
    };

    // Apply tissue layer filter + per-system visibleLayers + hidden parts + single-muscle isolation + clinical overlays
    useEffect(() => {
      const refs = sceneRefs.current;
      const hiddenSet = new Set(hiddenPartIds);
      const activeDermHlt = dermatomeHighlight;
      const activeTestHlt = clinicalTestHighlight;
      const activeNerveHlt = clinicalNerveHighlight;
      const activeBiomHlt = biomechanicsHighlight;
      const testAllowedLayers = activeTestHlt
        ? computeClinicalTestLayerSet(activeTestHlt.structureIds)
        : null;

      for (const mesh of refs.interactables) {
        const id = mesh.userData.id as string;
        const structureId = mesh.userData.structureId as string | undefined;
        const tissueType = (mesh.userData.tissueType as string) || 'other';
        const layerId = (mesh.userData.layerId as AnatomicalLayerId | undefined) ?? (tissueType === 'muscle' ? 'muscle' : 'bone');
        const hiddenManually = hiddenSet.has(id);

        let hiddenByLayer = false;
        if (activeDermHlt) {
          if (activeDermHlt.mode === 'dermatome') {
            hiddenByLayer = layerId !== 'skin' && layerId !== 'bone' && layerId !== 'cartilage';
          } else if (activeDermHlt.mode === 'myotome') {
            hiddenByLayer = layerId !== 'muscle' && layerId !== 'bone' && layerId !== 'cartilage';
          } else {
            hiddenByLayer =
              layerId !== 'skin' &&
              layerId !== 'muscle' &&
              layerId !== 'bone' &&
              layerId !== 'cartilage';
          }
        } else if (testAllowedLayers) {
          hiddenByLayer = !testAllowedLayers.has(layerId);
        } else if (activeNerveHlt) {
          hiddenByLayer =
            layerId !== 'muscle' &&
            layerId !== 'nerve' &&
            layerId !== 'bone' &&
            layerId !== 'cartilage';
        } else if (activeBiomHlt) {
          hiddenByLayer =
            layerId !== 'muscle' && layerId !== 'bone' && layerId !== 'cartilage';
        } else if (isolatedMusclePartId) {
          if (layerId === 'muscle') {
            hiddenByLayer = id !== isolatedMusclePartId && structureId !== isolatedMusclePartId;
          } else if (layerId === 'bone' || layerId === 'cartilage') {
            hiddenByLayer = false;
          } else {
            // Keep skeleton + isolated muscle super clean without overlapping vessels/skin
            hiddenByLayer = true;
          }
        } else if (layerFilter === 'muscle') {
          hiddenByLayer = layerId !== 'muscle';
        } else if (layerFilter === 'bone') {
          hiddenByLayer = layerId !== 'bone' && layerId !== 'cartilage';
        } else {
          hiddenByLayer = !visibleLayers[layerId];
        }

        mesh.visible = !hiddenManually && !hiddenByLayer;
      }
      if (selectedHotspot) {
        const foundZone = getBoneZoneWorldPosition(refs.interactables, selectedHotspot.id);
        if (foundZone && !foundZone.mesh.visible) {
          setSelectedHotspot(null);
        }
      }
      applyVisualHighlights();
      refs.renderNow();
      refs.requestRender();
    }, [
      layerFilter,
      visibleLayers,
      hiddenPartIds,
      selectedHotspot,
      isolatedMusclePartId,
      clinicalNerveHighlight,
      dermatomeHighlight,
      clinicalTestHighlight,
      biomechanicsHighlight,
    ]);

    // Apply WebGL 3D Clipping Plane whenever axis/depth/inverted changes
    useEffect(() => {
      const refs = sceneRefs.current;
      refs.applyClipping();
      refs.renderNow();
      refs.requestRender();
    }, [clippingState]);

    // Dynamically switch between unified multi-head muscles ('whole') and individual heads/aktons ('parts') without re-fetching GLB
    useEffect(() => {
      const refs = sceneRefs.current;
      if (refs.interactables.length === 0) return;

      const rebuiltPartMeshes = new Map<string, THREE.Mesh[]>();
      const rebuiltLabels: Record<string, string> = {};
      const rebuiltMetas: SelectableMeshMeta[] = [];

      for (const mesh of refs.interactables) {
        const ud = mesh.userData;
        const individualId = (ud.individualId as string | undefined) ?? (ud.id as string);
        const unifiedId = (ud.unifiedId as string | null | undefined) ?? null;

        let nextId = individualId;
        if (muscleGroupingMode === 'whole' && unifiedId) {
          nextId = unifiedId;
          if (ud.wholeNamePl) ud.namePl = ud.wholeNamePl;
          if (ud.wholeNameEn) ud.nameEn = ud.wholeNameEn;
          if (ud.wholeBilingualName) ud.bilingualName = ud.wholeBilingualName;
        } else if (unifiedId) {
          nextId = individualId;
          if (ud.partNamePl) ud.namePl = ud.partNamePl;
          if (ud.partNameEn) ud.nameEn = ud.partNameEn;
          if (ud.partBilingualName) ud.bilingualName = ud.partBilingualName;
        }
        ud.id = nextId;

        const grp = rebuiltPartMeshes.get(nextId);
        if (grp) {
          grp.push(mesh);
        } else {
          rebuiltPartMeshes.set(nextId, [mesh]);
          const bLabel =
            (ud.bilingualName as string | undefined) ||
            formatBilingualName((ud.namePl as string) || '', ud.nameEn as string | undefined);
          rebuiltLabels[nextId] = bLabel;
          rebuiltMetas.push({
            id: nextId,
            namePl: (ud.namePl as string) || '',
            nameEn: (ud.nameEn as string | undefined) || '',
            bilingualName: bLabel,
            structureId: ud.structureId as string | undefined,
            category: (ud.category as StructureCategory | undefined) ?? 'bone',
          });
        }
      }

      // Harmonize explode vectors for unified multi-mesh groups vs individual heads
      for (const [, groupMeshes] of rebuiltPartMeshes.entries()) {
        if (groupMeshes.length > 1) {
          const unionBox = new THREE.Box3();
          for (const gm of groupMeshes) unionBox.expandByObject(gm);
          const uCenter = unionBox.getCenter(new THREE.Vector3());
          const sharedExplode = new THREE.Vector3(uCenter.x, 0, uCenter.z);
          if (sharedExplode.lengthSq() < 1e-4) sharedExplode.set(0.1, 0, 0.1);
          sharedExplode.normalize().multiplyScalar(0.35);
          for (const gm of groupMeshes) {
            gm.userData.explodeVector = sharedExplode.clone();
          }
        } else if (groupMeshes.length === 1 && groupMeshes[0].userData.individualExplodeVector) {
          groupMeshes[0].userData.explodeVector = (
            groupMeshes[0].userData.individualExplodeVector as THREE.Vector3
          ).clone();
        }
      }

      refs.partMeshes = rebuiltPartMeshes;
      setPartLabelsById(rebuiltLabels);
      onPartsLoadedRef.current?.(rebuiltMetas);
      applyVisualHighlights();
      refs.renderNow();
      refs.requestRender();
    }, [muscleGroupingMode]);

  function applyVisualHighlights() {
    const refs = sceneRefs.current;
    const { partMeshes, selectedId: selId, hoveredId, highlightMode: mode } = refs;

    // Resolve selected mesh metadata for bidirectional muscle -> bone PP/PK zone highlighting
    const selectedMesh = selId
      ? refs.interactables.find(
          (m) => m.userData.id === selId || m.userData.structureId === selId,
        )
      : undefined;
    const selectedStructureId =
      (selectedMesh?.userData.structureId as string | undefined) ?? selId ?? null;
    const selectedPartNamePl =
      (selectedMesh?.userData.namePl as string | undefined) ?? null;

    // 1. Update vertex-colored bone surface zones (landmarks & PP/PK attachments)
    updateAllBoneSurfaceColors(refs.interactables, {
      mode: boneZoneModeRef.current,
      selectedLandmarkId: selectedHotspotRef.current?.id ?? null,
      hoveredLandmarkId: refs.hoveredLandmarkId,
      selectedPartId: selId,
      selectedStructureId,
      selectedPartNamePl,
      hoveredPartId: hoveredId,
      highlightMode: mode,
    });

    // 2. Update non-zone meshes (muscles, nerves, skin dermatomes, clinical tests, biomechanics, cartilages, and bones)
    const isXrayActive = xrayModeRef.current;
    const activeDermHlt = dermatomeHighlightRef.current;
    const activeDermLevel = activeDermHlt
      ? getDermatomeLevelById(activeDermHlt.rootId)
      : null;
    const activeTestHlt = !activeDermLevel ? clinicalTestHighlightRef.current : null;
    const activeTestIds = activeTestHlt ? new Set(activeTestHlt.structureIds) : null;
    const activeNerveHlt = !activeDermLevel && !activeTestHlt ? clinicalNerveHighlightRef.current : null;
    const activeNerveProfile = activeNerveHlt
      ? getNerveProfileByStructureId(activeNerveHlt.nerveStructureId)
      : null;
    const activeBiomHlt =
      !activeDermLevel && !activeTestHlt && !activeNerveProfile
        ? biomechanicsHighlightRef.current
        : null;
    const activeBiomMovement = activeBiomHlt
      ? getMovementById(activeBiomHlt.movementId)
      : null;

    for (const [partId, meshes] of partMeshes.entries()) {
      const isSelected = selId === partId;
      const isHovered = !isSelected && hoveredId === partId;

      for (const mesh of meshes) {
        if (mesh.userData.boneZoneData) continue;

        const meshLayerId = (mesh.userData.layerId as AnatomicalLayerId | undefined) ??
          (mesh.userData.tissueType === 'muscle' ? 'muscle' : 'bone');
        const meshStructureId = mesh.userData.structureId as string | undefined;
        const meshRawName = (mesh.userData.rawName as string | undefined) ?? mesh.name;
        const meshSide = mesh.userData.anatomicalSide as 'left' | 'right' | undefined;

        // Priority A: Dermatome & Myotome 3D mode
        const dermSideMatches =
          !activeDermHlt?.side ||
          activeDermHlt.side === 'both' ||
          !meshSide ||
          meshSide === activeDermHlt.side;
        const isDermSkinMatch = Boolean(
          activeDermLevel &&
            activeDermHlt &&
            activeDermHlt.mode !== 'myotome' &&
            meshLayerId === 'skin' &&
            dermSideMatches &&
            doesSkinMeshMatchDermatome(activeDermLevel, meshRawName),
        );
        const isDermSkinMuted = Boolean(
          activeDermLevel &&
            activeDermHlt &&
            activeDermHlt.mode !== 'myotome' &&
            meshLayerId === 'skin' &&
            !isDermSkinMatch,
        );
        const isMyotomeMuscleMatch = Boolean(
          activeDermLevel &&
            activeDermHlt &&
            activeDermHlt.mode !== 'dermatome' &&
            meshLayerId === 'muscle' &&
            dermSideMatches &&
            doesMuscleMeshMatchMyotome(activeDermLevel, meshStructureId, meshRawName),
        );
        const isMyotomeMuscleGhosted = Boolean(
          activeDermLevel &&
            activeDermHlt &&
            activeDermHlt.mode !== 'dermatome' &&
            meshLayerId === 'muscle' &&
            !isMyotomeMuscleMatch &&
            !isSelected &&
            !isHovered,
        );

        // Priority B: Multi-structure Clinical Test 3D Visualizer
        const isTestTargetStructure = Boolean(
          activeTestIds && meshStructureId && activeTestIds.has(meshStructureId),
        );
        const isTestGhostedMuscle = Boolean(
          activeTestIds &&
            meshLayerId === 'muscle' &&
            !isTestTargetStructure &&
            !isSelected &&
            !isHovered,
        );

        // Priority C: Nerve <-> Innervated Muscles 3D mode
        const sideMatches =
          !activeNerveHlt?.side || !meshSide || meshSide === activeNerveHlt.side;
        const isClinicalTargetNerve = Boolean(
          activeNerveProfile &&
            meshLayerId === 'nerve' &&
            sideMatches &&
            (meshStructureId === activeNerveProfile.nerveStructureId ||
              activeNerveProfile.nerveMeshPattern.test(meshRawName)),
        );
        const isClinicalInnervatedMuscle = Boolean(
          activeNerveProfile &&
            meshLayerId === 'muscle' &&
            sideMatches &&
            doesMeshMatchNerveInnervation(
              activeNerveProfile,
              meshStructureId,
              meshRawName,
              meshLayerId,
            ),
        );
        const isClinicalGhostedMuscle = Boolean(
          activeNerveProfile &&
            meshLayerId === 'muscle' &&
            !isClinicalInnervatedMuscle &&
            !isSelected &&
            !isHovered,
        );

        // Priority D: Biomechanics 3D (Agonists / Synergists / Antagonists)
        const biomSideMatches =
          !activeBiomHlt?.side ||
          activeBiomHlt.side === 'both' ||
          !meshSide ||
          meshSide === activeBiomHlt.side;
        const rawBiomRole =
          activeBiomMovement && activeBiomHlt && meshLayerId === 'muscle' && biomSideMatches
            ? resolveMuscleBiomechanicsRole(activeBiomMovement, meshStructureId, meshRawName)
            : null;
        const activeBiomRole =
          rawBiomRole === 'agonist' && activeBiomHlt?.showAgonists
            ? 'agonist'
            : rawBiomRole === 'synergist' && activeBiomHlt?.showSynergists
              ? 'synergist'
              : rawBiomRole === 'antagonist' && activeBiomHlt?.showAntagonists
                ? 'antagonist'
                : null;
        const isBiomGhostedMuscle = Boolean(
          activeBiomMovement &&
            meshLayerId === 'muscle' &&
            !activeBiomRole &&
            !isSelected &&
            !isHovered,
        );

        const isXrayMuscle =
          isXrayActive &&
          !activeDermLevel &&
          !activeTestIds &&
          !activeNerveProfile &&
          !activeBiomMovement &&
          !isSelected &&
          !isHovered &&
          mesh.userData.tissueType === 'muscle';

        const needsOverride =
          isSelected ||
          isHovered ||
          isXrayMuscle ||
          isDermSkinMatch ||
          isDermSkinMuted ||
          isMyotomeMuscleMatch ||
          isMyotomeMuscleGhosted ||
          isTestTargetStructure ||
          isTestGhostedMuscle ||
          isClinicalTargetNerve ||
          isClinicalInnervatedMuscle ||
          isClinicalGhostedMuscle ||
          Boolean(activeBiomRole) ||
          isBiomGhostedMuscle;

        if (needsOverride) {
          if (!mesh.userData.originalMaterial) {
            mesh.userData.originalMaterial = mesh.material;
            if (Array.isArray(mesh.material)) {
              mesh.material = mesh.material.map((m) => m.clone());
            } else if (mesh.material) {
              mesh.material = mesh.material.clone();
            }
          }

          const mat = mesh.material;
          const origMat = mesh.userData.originalMaterial;
          if (!Array.isArray(mat) && mat instanceof THREE.MeshStandardMaterial) {
            if (isDermSkinMatch && activeDermLevel && activeDermHlt) {
              mat.color.set(activeDermLevel.accentHex);
              mat.emissive.set(activeDermLevel.accentHex);
              mat.emissiveIntensity = 0.42;
              mat.transparent = true;
              mat.opacity = activeDermHlt.mode === 'dermatome' ? 0.78 : 0.56;
              mat.depthWrite = activeDermHlt.mode === 'dermatome';
              mat.needsUpdate = true;
            } else if (isDermSkinMuted && activeDermHlt) {
              if (!Array.isArray(origMat) && origMat instanceof THREE.MeshStandardMaterial) {
                mat.color.copy(origMat.color);
              }
              mat.emissive.setHex(0x000000);
              mat.emissiveIntensity = 0;
              mat.transparent = true;
              mat.opacity = activeDermHlt.mode === 'dermatome' ? 0.2 : 0.1;
              mat.depthWrite = false;
              mat.needsUpdate = true;
            } else if (
              isXrayMuscle ||
              isClinicalGhostedMuscle ||
              isMyotomeMuscleGhosted ||
              isTestGhostedMuscle ||
              isBiomGhostedMuscle
            ) {
              if (!Array.isArray(origMat) && origMat instanceof THREE.MeshStandardMaterial) {
                mat.color.copy(origMat.color);
                mat.vertexColors = origMat.vertexColors;
              }
              mat.emissive.setHex(0x000000);
              mat.emissiveIntensity = 0;
              mat.transparent = true;
              mat.opacity = isXrayMuscle ? 0.22 : 0.14;
              mat.depthWrite = false;
              mat.needsUpdate = true;
            } else {
              mat.transparent = false;
              mat.opacity = 1;
              mat.depthWrite = true;
              if (mat.vertexColors) {
                // Ensure vertex-colored tendon-to-belly muscles highlight uniformly
                mat.vertexColors = false;
                mat.needsUpdate = true;
              }
              if (!Array.isArray(origMat) && origMat instanceof THREE.MeshStandardMaterial) {
                if (origMat.vertexColors) {
                  mat.color.setHex(0xb84050);
                } else {
                  mat.color.copy(origMat.color);
                }
              }
              if (isMyotomeMuscleMatch) {
                mat.color.lerp(new THREE.Color(0x10b981), 0.76);
                mat.emissive.setHex(0x059669);
                mat.emissiveIntensity = 0.68;
              } else if (isTestTargetStructure) {
                if (meshLayerId === 'nerve') {
                  mat.color.setHex(0xfef08a);
                  mat.emissive.setHex(0xeab308);
                  mat.emissiveIntensity = 0.95;
                } else if (meshLayerId === 'artery') {
                  mat.color.setHex(0xfca5a5);
                  mat.emissive.setHex(0xdc2626);
                  mat.emissiveIntensity = 0.85;
                } else if (
                  meshLayerId === 'bursa' ||
                  meshLayerId === 'tendon' ||
                  meshLayerId === 'ligament' ||
                  meshLayerId === 'cartilage'
                ) {
                  mat.color.setHex(0xfde68a);
                  mat.emissive.setHex(0xf59e0b);
                  mat.emissiveIntensity = 0.78;
                } else {
                  mat.color.lerp(new THREE.Color(0x10b981), 0.76);
                  mat.emissive.setHex(0x059669);
                  mat.emissiveIntensity = 0.7;
                }
              } else if (isClinicalTargetNerve) {
                mat.color.setHex(0xfef08a);
                mat.emissive.setHex(0xeab308);
                mat.emissiveIntensity = 0.95;
              } else if (isClinicalInnervatedMuscle) {
                mat.color.lerp(new THREE.Color(0x10b981), 0.72);
                mat.emissive.setHex(0x059669);
                mat.emissiveIntensity = 0.65;
              } else if (activeBiomRole === 'agonist') {
                mat.color.lerp(new THREE.Color(0x10b981), 0.8);
                mat.emissive.setHex(0x059669);
                mat.emissiveIntensity = 0.74;
              } else if (activeBiomRole === 'synergist') {
                mat.color.lerp(new THREE.Color(0xf59e0b), 0.8);
                mat.emissive.setHex(0xd97706);
                mat.emissiveIntensity = 0.68;
              } else if (activeBiomRole === 'antagonist') {
                mat.color.lerp(new THREE.Color(0xf43f5e), 0.8);
                mat.emissive.setHex(0xe11d48);
                mat.emissiveIntensity = 0.68;
              } else if (isSelected) {
                if (mode === 'wrong') {
                  mat.color.lerp(new THREE.Color(0xef4444), 0.78);
                  mat.emissive.setHex(0xdc2626);
                  mat.emissiveIntensity = 0.8;
                } else {
                  mat.color.lerp(new THREE.Color(0x22c55e), 0.8);
                  mat.emissive.setHex(0x16a34a);
                  mat.emissiveIntensity = 0.82;
                }
              } else {
                mat.color.lerp(new THREE.Color(0xf59e0b), 0.52);
                mat.emissive.setHex(0xf59e0b);
                mat.emissiveIntensity = 0.42;
              }
            }
          }
        } else if (mesh.userData.originalMaterial) {
          const clonedMat = mesh.material;
          mesh.material = mesh.userData.originalMaterial;
          delete mesh.userData.originalMaterial;
          if (Array.isArray(clonedMat)) {
            clonedMat.forEach((m) => m.dispose());
          } else if (clonedMat && typeof clonedMat.dispose === 'function') {
            clonedMat.dispose();
          }
        }
      }
    }

    // 3. Update optional 3D anatomical plane & rotation axis helper for Biomechanics 3D
    if (biomechanicsGuideGroupRef.current) {
      refs.scene?.remove(biomechanicsGuideGroupRef.current);
      biomechanicsGuideGroupRef.current.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      biomechanicsGuideGroupRef.current = null;
    }

    if (
      activeBiomMovement &&
      activeBiomHlt &&
      activeBiomHlt.showPlaneHelper &&
      refs.scene &&
      refs.interactables.length > 0
    ) {
      const targetSide = activeBiomHlt.side === 'left' ? 'left' : activeBiomHlt.side === 'right' ? 'right' : 'both';
      const anchorBoxes = new Map<string, THREE.Box3>();
      const agonistBox = new THREE.Box3();
      let hasAgonistBox = false;
      const tmpBox = new THREE.Box3();

      for (const mesh of refs.interactables) {
        if (!mesh.visible) continue;
        const sid = mesh.userData.structureId as string | undefined;
        const mSide = mesh.userData.anatomicalSide as 'left' | 'right' | undefined;
        const sideOk = targetSide === 'both' || !mSide || mSide === targetSide;
        if (!sideOk) continue;

        if (sid && activeBiomMovement.anchorBoneIds.includes(sid)) {
          tmpBox.setFromObject(mesh);
          if (!tmpBox.isEmpty()) {
            const existing = anchorBoxes.get(sid);
            if (existing) existing.union(tmpBox);
            else anchorBoxes.set(sid, tmpBox.clone());
          }
        }
        if (
          mesh.userData.layerId === 'muscle' &&
          resolveMuscleBiomechanicsRole(
            activeBiomMovement,
            sid,
            (mesh.userData.rawName as string | undefined) ?? mesh.name,
          ) === 'agonist'
        ) {
          tmpBox.setFromObject(mesh);
          if (!tmpBox.isEmpty()) {
            if (!hasAgonistBox) {
              agonistBox.copy(tmpBox);
              hasAgonistBox = true;
            } else {
              agonistBox.union(tmpBox);
            }
          }
        }
      }

      const jointCenter = new THREE.Vector3();
      const boxesList = [...anchorBoxes.values()];
      if (boxesList.length >= 2) {
        const cA = boxesList[0].getCenter(new THREE.Vector3());
        const cB = boxesList[1].getCenter(new THREE.Vector3());
        const pA = boxesList[0].clampPoint(cB, new THREE.Vector3());
        const pB = boxesList[1].clampPoint(cA, new THREE.Vector3());
        jointCenter.addVectors(pA, pB).multiplyScalar(0.5);
      } else if (boxesList.length === 1) {
        const b = boxesList[0];
        b.getCenter(jointCenter);
        // When a regional model contains only the distal/proximal long bone, snap vertically to the true joint pole
        if (activeBiomMovement.jointGroup === 'hip' || activeBiomMovement.jointGroup === 'shoulder') {
          jointCenter.y = b.max.y - Math.min(0.045, (b.max.y - b.min.y) * 0.1);
        } else if (
          activeBiomMovement.jointGroup === 'knee' ||
          activeBiomMovement.jointGroup === 'elbow_forearm' ||
          activeBiomMovement.jointGroup === 'wrist' ||
          activeBiomMovement.jointGroup === 'ankle_foot'
        ) {
          jointCenter.y = b.min.y + Math.min(0.03, (b.max.y - b.min.y) * 0.08);
        }
      } else if (hasAgonistBox) {
        agonistBox.getCenter(jointCenter);
      } else if (refs.modelBounds) {
        refs.modelBounds.getCenter(jointCenter);
      }

      const radius =
        activeBiomMovement.jointGroup === 'wrist' ||
        activeBiomMovement.jointGroup === 'ankle_foot'
          ? 0.09
          : activeBiomMovement.jointGroup === 'elbow_forearm' ||
              activeBiomMovement.jointGroup === 'knee'
            ? 0.135
            : 0.175;

      const planeHex =
        activeBiomMovement.planeId === 'sagittal'
          ? 0x10b981
          : activeBiomMovement.planeId === 'frontal'
            ? 0xf59e0b
            : 0xf43f5e;

      const helperGroup = new THREE.Group();
      helperGroup.name = 'biomechanics_plane_helper';

      const discGeo = new THREE.CircleGeometry(radius, 48);
      const discMat = new THREE.MeshBasicMaterial({
        color: planeHex,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const discMesh = new THREE.Mesh(discGeo, discMat);
      discMesh.renderOrder = 15;

      const ringGeo = new THREE.RingGeometry(radius * 0.92, radius, 48);
      const ringMat = new THREE.MeshBasicMaterial({
        color: planeHex,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.renderOrder = 16;

      const axisLen = radius * 2.25;
      const axisGeo = new THREE.CylinderGeometry(0.005, 0.005, axisLen, 14);
      const axisMat = new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.95,
      });
      const axisMesh = new THREE.Mesh(axisGeo, axisMat);
      axisMesh.renderOrder = 17;

      const capGeo = new THREE.SphereGeometry(0.0095, 12, 12);
      const capMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
      const capA = new THREE.Mesh(capGeo, capMat);
      const capB = new THREE.Mesh(capGeo, capMat);
      capA.position.y = axisLen / 2;
      capB.position.y = -axisLen / 2;
      axisMesh.add(capA, capB);

      if (activeBiomMovement.planeId === 'sagittal') {
        // Disc in YZ plane, transverse rotation axis along X
        discMesh.rotation.y = Math.PI / 2;
        ringMesh.rotation.y = Math.PI / 2;
        axisMesh.rotation.z = Math.PI / 2;
      } else if (activeBiomMovement.planeId === 'frontal') {
        // Disc in XY plane (default), sagittal rotation axis along Z
        axisMesh.rotation.x = Math.PI / 2;
      } else {
        // Transverse: disc in XZ plane, longitudinal rotation axis along Y (default)
        discMesh.rotation.x = Math.PI / 2;
        ringMesh.rotation.x = Math.PI / 2;
      }

      helperGroup.add(discMesh, ringMesh, axisMesh);
      helperGroup.position.copy(jointCenter);
      refs.scene.add(helperGroup);
      biomechanicsGuideGroupRef.current = helperGroup;
    }

    refs.applyClipping();
  }

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = Math.max(container.clientWidth, 300);
    const height = Math.max(container.clientHeight, 260);
    const isSoftwareGl = detectSoftwareWebGL();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      });
    } catch {
      setWebglError('Twoja przeglądarka nie obsługuje WebGL do renderowania modelu 3D.');
      return;
    }

    if (isSoftwareGl) {
      renderer.setPixelRatio(1);
      renderer.shadowMap.enabled = false;
    } else {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.localClippingEnabled = true;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.outline = 'none';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isDarkMode ? 0x0a1410 : 0x111c18);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.005, 120);
    camera.position.set(2.1, 0.75, 3.8);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.12;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.zoomToCursor = true;
    controls.zoomSpeed = 1.65;
    controls.rotateSpeed = 0.85;
    controls.panSpeed = 0.9;
    controls.minDistance = 0.06;
    controls.maxDistance = 18;
    controls.target.set(0, 0.05, 0);
    controls.update();

    const hemiLight = new THREE.HemisphereLight(0xf0fdf4, 0x1e2924, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.45);
    keyLight.position.set(3.5, 4.5, 4.0);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.bias = -0.0005;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xecfdf5, 0.85);
    rimLight.position.set(-3.2, 2.0, -3.5);
    scene.add(rimLight);

    const pedestalGeo = new THREE.CylinderGeometry(1.45, 1.52, 0.06, 48);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: isDarkMode ? 0x16241d : 0x22332a,
      roughness: 0.85,
      metalness: 0.05,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.set(0, -1.98, 0);
    pedestal.receiveShadow = !isSoftwareGl;
    scene.add(pedestal);

    // Soft radial contact shadow disc grounded atop the pedestal
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
      grad.addColorStop(0, 'rgba(6, 16, 11, 0.38)');
      grad.addColorStop(0.55, 'rgba(6, 16, 11, 0.16)');
      grad.addColorStop(1, 'rgba(6, 16, 11, 0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 128, 128);
    }
    const contactShadowTex = new THREE.CanvasTexture(shadowCanvas);
    const contactShadowGeo = new THREE.CircleGeometry(1.38, 36);
    contactShadowGeo.rotateX(-Math.PI / 2);
    const contactShadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
    });
    const contactShadow = new THREE.Mesh(contactShadowGeo, contactShadowMat);
    contactShadow.position.set(0, -1.948, 0);
    scene.add(contactShadow);

    // Subtle visual outline rectangle for active 3D Clipping Plane
    const clipGuidePts = [
      new THREE.Vector3(-0.5, -0.5, 0),
      new THREE.Vector3(0.5, -0.5, 0),
      new THREE.Vector3(0.5, 0.5, 0),
      new THREE.Vector3(-0.5, 0.5, 0),
    ];
    const clipGuideGeo = new THREE.BufferGeometry().setFromPoints(clipGuidePts);
    const clipGuideMat = new THREE.LineBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.72,
    });
    const clipGuide = new THREE.LineLoop(clipGuideGeo, clipGuideMat);
    clipGuide.visible = false;
    scene.add(clipGuide);

    // DRACOLoader configured with local WebAssembly decoders
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    dracoLoader.preload();

    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);

    const refs = sceneRefs.current;
    refs.renderer = renderer;
    refs.scene = scene;
    refs.camera = camera;
    refs.controls = controls;
    refs.pedestal = pedestal;
    refs.contactShadow = contactShadow;
    refs.clipGuide = clipGuide;
    refs.isSoftwareGl = isSoftwareGl;

    const applyClipping = () => {
      const state = clippingStateRef.current;
      const bounds = refs.modelBounds;
      const active = state.axis !== 'off' && Boolean(bounds);

      if (active && bounds) {
        const min = bounds.min;
        const max = bounds.max;
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        const d = Math.max(0.01, Math.min(0.99, state.depth));
        const sign = state.inverted ? 1 : -1;

        if (state.axis === 'axial') {
          const cutY = THREE.MathUtils.lerp(min.y, max.y, d);
          refs.clipPlane.set(new THREE.Vector3(0, sign, 0), -sign * cutY);
          clipGuide.position.set(center.x, cutY, center.z);
          clipGuide.rotation.set(Math.PI / 2, 0, 0);
          clipGuide.scale.set(Math.max(size.x * 1.15, 0.6), Math.max(size.z * 1.15, 0.6), 1);
        } else if (state.axis === 'sagittal') {
          const cutX = THREE.MathUtils.lerp(min.x, max.x, d);
          refs.clipPlane.set(new THREE.Vector3(sign, 0, 0), -sign * cutX);
          clipGuide.position.set(cutX, center.y, center.z);
          clipGuide.rotation.set(0, Math.PI / 2, 0);
          clipGuide.scale.set(Math.max(size.z * 1.15, 0.6), Math.max(size.y * 1.05, 0.6), 1);
        } else {
          const cutZ = THREE.MathUtils.lerp(min.z, max.z, d);
          refs.clipPlane.set(new THREE.Vector3(0, 0, sign), -sign * cutZ);
          clipGuide.position.set(center.x, center.y, cutZ);
          clipGuide.rotation.set(0, 0, 0);
          clipGuide.scale.set(Math.max(size.x * 1.15, 0.6), Math.max(size.y * 1.05, 0.6), 1);
        }
        clipGuide.visible = true;
      } else {
        clipGuide.visible = false;
      }

      const planes = active ? [refs.clipPlane] : [];
      const applyMat = (m: THREE.Material) => {
        m.clippingPlanes = planes;
        m.clipShadows = active;
        if (active) {
          m.side = THREE.DoubleSide;
        }
      };

      for (const mesh of refs.interactables) {
        if (Array.isArray(mesh.material)) mesh.material.forEach(applyMat);
        else if (mesh.material) applyMat(mesh.material);
        if (mesh.userData.originalMaterial) {
          if (Array.isArray(mesh.userData.originalMaterial)) {
            mesh.userData.originalMaterial.forEach(applyMat);
          } else {
            applyMat(mesh.userData.originalMaterial);
          }
        }
      }
    };
    refs.applyClipping = applyClipping;

    let rafId: number | null = null;
    let cameraAnimRaf: number | null = null;
    let cameraAnimGoal: { target: THREE.Vector3; position: THREE.Vector3 } | null = null;
    let timeoutId: number | null = null;
    let disposed = false;
    let activeLoadToken = 0;
    let renderBusy = false;
    let renderDirty = false;

    const cancelCameraAnimation = () => {
      if (cameraAnimRaf !== null) {
        cancelAnimationFrame(cameraAnimRaf);
        cameraAnimRaf = null;
      }
      cameraAnimGoal = null;
      controls.enableDamping = !isSoftwareGl;
    };

    const animateCameraTo = (nextTarget: THREE.Vector3, nextPosition: THREE.Vector3) => {
      cancelCameraAnimation();
      if (isSoftwareGl) {
        controls.target.copy(nextTarget);
        camera.position.copy(nextPosition);
        controls.update();
        renderNow();
        requestRender();
        return;
      }
      cameraAnimGoal = { target: nextTarget.clone(), position: nextPosition.clone() };
      controls.enableDamping = false;
      controls.update();
      let lastTime = performance.now();
      const lambda = 9;

      const stepCamera = (now: number) => {
        if (disposed || !cameraAnimGoal) {
          cameraAnimRaf = null;
          return;
        }
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;

        controls.target.x = THREE.MathUtils.damp(
          controls.target.x,
          cameraAnimGoal.target.x,
          lambda,
          dt,
        );
        controls.target.y = THREE.MathUtils.damp(
          controls.target.y,
          cameraAnimGoal.target.y,
          lambda,
          dt,
        );
        controls.target.z = THREE.MathUtils.damp(
          controls.target.z,
          cameraAnimGoal.target.z,
          lambda,
          dt,
        );

        camera.position.x = THREE.MathUtils.damp(
          camera.position.x,
          cameraAnimGoal.position.x,
          lambda,
          dt,
        );
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          cameraAnimGoal.position.y,
          lambda,
          dt,
        );
        camera.position.z = THREE.MathUtils.damp(
          camera.position.z,
          cameraAnimGoal.position.z,
          lambda,
          dt,
        );

        const settled =
          controls.target.distanceToSquared(cameraAnimGoal.target) < 1e-6 &&
          camera.position.distanceToSquared(cameraAnimGoal.position) < 1e-6;

        if (settled) {
          controls.target.copy(cameraAnimGoal.target);
          camera.position.copy(cameraAnimGoal.position);
          cameraAnimGoal = null;
          cameraAnimRaf = null;
          controls.enableDamping = !isSoftwareGl;
          controls.update();
          renderer.render(scene, camera);
          return;
        }

        controls.update();
        renderer.render(scene, camera);
        cameraAnimRaf = requestAnimationFrame(stepCamera);
      };

      cameraAnimRaf = requestAnimationFrame(stepCamera);
    };

    const afterDraw = (cb: () => void) => {
      let attempts = 0;
      try {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        if (gl && typeof gl.fenceSync === 'function') {
          const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
          gl.flush();
          const poll = () => {
            if (disposed) return;
            attempts += 1;
            const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
            if (state === gl.UNSIGNALED && attempts < 20) {
              timeoutId = window.setTimeout(poll, 5);
            } else {
              if (sync) gl.deleteSync(sync);
              timeoutId = window.setTimeout(cb, 20);
            }
          };
          timeoutId = window.setTimeout(poll, 5);
          return;
        }
      } catch {
        // Fallback when WebGL2 fenceSync is unavailable
      }
      timeoutId = window.setTimeout(cb, 20);
    };

    const prevCamPos = new THREE.Vector3();
    const prevTarget = new THREE.Vector3();

    const renderNow = () => {
      if (disposed) return;
      let dampingStillMoving = false;
      if (controls.enableDamping) {
        prevCamPos.copy(camera.position);
        prevTarget.copy(controls.target);
        controls.update();
        dampingStillMoving =
          prevCamPos.distanceToSquared(camera.position) > 1e-8 ||
          prevTarget.distanceToSquared(controls.target) > 1e-8;
      }
      renderer.render(scene, camera);
      if (dampingStillMoving && !cameraAnimGoal) {
        requestRender();
      }
    };
    refs.renderNow = renderNow;

    const requestRender = () => {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        renderDirty = false;
        if (disposed) return;
        renderNow();
        const done = () => {
          renderBusy = false;
          if (renderDirty && !disposed) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    };
    refs.requestRender = requestRender;

    const clearCurrentModel = () => {
      cancelCameraAnimation();
      if (refs.activeGroup) {
        scene.remove(refs.activeGroup);
      }
      for (const mesh of refs.interactables) {
        if (mesh.userData.originalMaterial) {
          const cloned = mesh.material;
          mesh.material = mesh.userData.originalMaterial;
          delete mesh.userData.originalMaterial;
          if (Array.isArray(cloned)) cloned.forEach((m) => m.dispose());
          else if (cloned && typeof cloned.dispose === 'function') cloned.dispose();
        }
      }
      for (const d of refs.disposables) {
        try {
          d.dispose();
        } catch {
          // ignore
        }
      }
      refs.disposables = [];
      refs.interactables = [];
      refs.partMeshes = new Map();
      refs.hotspotMarkers = [];
      refs.activeGroup = null;
      refs.hoveredId = null;
      refs.hoveredLandmarkId = null;
      refs.modelBounds = null;
    };

    const frameCameraForModel = (
      group: THREE.Group,
      mode: RegionId | 'full_body' | 'custom',
    ) => {
      cancelCameraAnimation();
      const box = new THREE.Box3().setFromObject(group);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 1);
      refs.modelBounds = box;

      if (refs.pedestal) {
        refs.pedestal.position.y = box.min.y - 0.04;
      }
      if (refs.contactShadow) {
        refs.contactShadow.position.y = box.min.y - 0.008;
      }

      controls.target.copy(center);
      if (mode === 'shoulder') {
        camera.position.set(
          center.x + maxDim * 0.6,
          center.y + maxDim * 0.25,
          center.z + maxDim * 1.65,
        );
      } else if (mode === 'knee') {
        camera.position.set(
          center.x + maxDim * 0.72,
          center.y + maxDim * 0.12,
          center.z + maxDim * 1.55,
        );
      } else if (mode === 'full_body') {
        camera.position.set(
          center.x + maxDim * 0.16,
          center.y + size.y * 0.03,
          center.z + maxDim * 1.72,
        );
      } else {
        camera.position.set(
          center.x + maxDim * 0.65,
          center.y + maxDim * 0.25,
          center.z + maxDim * 1.55,
        );
      }
      controls.update();
      requestRender();
    };

    refs.focusBodyZone = (zone: BodyFocusZone) => {
      if (!refs.modelBounds) return;
      const box = refs.modelBounds;
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 1);

      if (zone === 'full') {
        controls.target.copy(center);
        camera.position.set(
          center.x + maxDim * 0.16,
          center.y + size.y * 0.03,
          center.z + maxDim * 1.72,
        );
      } else if (zone === 'head') {
        const targetY = box.min.y + size.y * 0.92;
        controls.target.set(center.x, targetY, center.z);
        camera.position.set(center.x, targetY + size.y * 0.02, center.z + maxDim * 0.42);
      } else if (zone === 'shoulder') {
        const targetY = box.min.y + size.y * 0.72;
        const targetX = center.x - size.x * 0.18;
        controls.target.set(targetX, targetY, center.z);
        camera.position.set(
          targetX - size.x * 0.25,
          targetY + size.y * 0.04,
          center.z + maxDim * 0.55,
        );
      } else if (zone === 'thorax') {
        const targetY = box.min.y + size.y * 0.65;
        controls.target.set(center.x, targetY, center.z);
        camera.position.set(center.x, targetY, center.z + maxDim * 0.62);
      } else if (zone === 'pelvis') {
        const targetY = box.min.y + size.y * 0.48;
        controls.target.set(center.x, targetY, center.z);
        camera.position.set(center.x, targetY, center.z + maxDim * 0.58);
      } else if (zone === 'knee') {
        const targetY = box.min.y + size.y * 0.27;
        const targetX = center.x - size.x * 0.12;
        controls.target.set(targetX, targetY, center.z);
        camera.position.set(
          targetX - size.x * 0.22,
          targetY + size.y * 0.04,
          center.z + maxDim * 0.52,
        );
      }
      controls.update();
      requestRender();
    };

    refs.setCameraPreset = (preset: CameraViewPreset) => {
      if (!refs.modelBounds) return;
      const box = refs.modelBounds;
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 1);
      const dist = maxDim * (refs.isFullBodyGlb ? 1.72 : 1.55);
      const yOffset = size.y * 0.04;

      const nextPos = center.clone();
      if (preset === 'front') {
        nextPos.set(center.x, center.y + yOffset, center.z + dist);
      } else if (preset === 'back') {
        nextPos.set(center.x, center.y + yOffset, center.z - dist);
      } else if (preset === 'right') {
        // Anatomical right side of the model sits at -X
        nextPos.set(center.x - dist, center.y + yOffset, center.z);
      } else {
        // Anatomical left side of the model sits at +X
        nextPos.set(center.x + dist, center.y + yOffset, center.z);
      }
      animateCameraTo(center, nextPos);
    };

    refs.focusMesh = (partId: string) => {
      // Check if partId refers to a vertex-colored bone surface zone (landmark)
      const zonePos = getBoneZoneWorldPosition(refs.interactables, partId);
      if (zonePos && zonePos.mesh.visible) {
        setSelectedHotspot(zonePos.landmark);
        const dir = camera.position.clone().sub(controls.target);
        if (dir.lengthSq() < 1e-4) {
          dir.set(0.18, 0.12, 0.98);
        }
        dir.normalize();
        animateCameraTo(
          zonePos.worldPos,
          zonePos.worldPos.clone().add(dir.multiplyScalar(0.42)),
        );
        return;
      }

      const mapped = refs.partMeshes.get(partId);
      const targetMeshes = (
        mapped && mapped.length > 0
          ? mapped
          : refs.interactables.filter(
              (m) => m.userData.id === partId || m.userData.structureId === partId,
            )
      ).filter((m) => m.visible);
      if (targetMeshes.length === 0) return;

      const box = new THREE.Box3();
      for (const m of targetMeshes) {
        m.updateWorldMatrix(true, false);
        box.expandByObject(m);
      }
      if (box.isEmpty()) return;

      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const radius = Math.max(size.length() * 0.5, 0.035);

      const fovRad = THREE.MathUtils.degToRad(camera.fov / 2);
      const aspect = Math.max(camera.aspect, 0.25);
      const rawDist = (radius / Math.sin(fovRad)) * (aspect < 1 ? 1 / aspect : 1) * 1.45;
      const dist = THREE.MathUtils.clamp(
        rawDist,
        Math.max(controls.minDistance * 2, 0.25),
        controls.maxDistance * 0.85,
      );

      const dir = camera.position.clone().sub(controls.target);
      if (dir.lengthSq() < 1e-4) {
        dir.set(0.18, 0.12, 0.98);
      }
      dir.normalize();

      animateCameraTo(center, center.clone().add(dir.multiplyScalar(dist)));
    };

    refs.focusHotspot = (hotspot: BonyLandmarkHotspot, orientToNormal = false) => {
      const zonePos = getBoneZoneWorldPosition(refs.interactables, hotspot.id);
      const worldPos = zonePos
        ? zonePos.worldPos
        : new THREE.Vector3(...hotspot.position);
      const lmExt = (zonePos?.landmark ?? hotspot) as BonyLandmarkExtended;
      let dir: THREE.Vector3;
      if (orientToNormal && lmExt.normal && lmExt.normal.length === 3) {
        dir = new THREE.Vector3(lmExt.normal[0], lmExt.normal[1] * 0.45 + 0.12, lmExt.normal[2]);
        if (dir.lengthSq() < 1e-4) dir.set(0.18, 0.12, 0.98);
      } else {
        dir = camera.position.clone().sub(controls.target);
        if (dir.lengthSq() < 1e-4) {
          dir.set(0.18, 0.12, 0.98);
        }
      }
      dir.normalize();

      animateCameraTo(worldPos, worldPos.clone().add(dir.multiplyScalar(0.46)));
    };

    refs.selectLandmark = (landmarkId: string) => {
      const zonePos = getBoneZoneWorldPosition(refs.interactables, landmarkId);
      if (!zonePos) return;
      const lm = zonePos.landmark;
      if (boneZoneModeRef.current === 'off') {
        setBoneZoneMode('landmarks');
      }
      setLayerFilter((prev) => (prev === 'muscle' ? 'bone' : prev));
      setSelectedHotspot(lm);
      setShowHiddenPanel(false);
      const resolvedId = lm.structureId || lm.id;
      onSelectPartRef.current({
        id: lm.id,
        namePl: lm.namePl,
        nameEn: lm.nameEn,
        bilingualName: lm.bilingualName || formatBilingualName(lm.namePl, lm.nameEn),
        structureId: resolvedId,
        category: 'bone',
        tissueType: 'bone',
      });
      refs.focusHotspot?.(lm, true);
    };

    refs.zoomBy = (factor: number) => {
      const baseTarget = cameraAnimGoal ? cameraAnimGoal.target.clone() : controls.target.clone();
      const basePos = cameraAnimGoal ? cameraAnimGoal.position.clone() : camera.position.clone();
      const offset = basePos.sub(baseTarget);
      const currentDist = offset.length();
      if (currentDist < 1e-5) {
        offset.set(0, 0, 1);
      } else {
        offset.normalize();
      }
      const nextDist = THREE.MathUtils.clamp(
        Math.max(currentDist, controls.minDistance) * factor,
        controls.minDistance,
        controls.maxDistance,
      );
      animateCameraTo(baseTarget, baseTarget.clone().add(offset.multiplyScalar(nextDist)));
    };

    refs.resetCamera = () => {
      if (!refs.activeGroup) return;
      if (refs.isGlbActive) {
        frameCameraForModel(
          refs.activeGroup,
          refs.isFullBodyGlb ? 'full_body' : 'custom',
        );
      } else if (refs.customModelName) {
        frameCameraForModel(refs.activeGroup, 'custom');
      } else if (refs.region === 'shoulder' || refs.region === 'knee') {
        frameCameraForModel(refs.activeGroup, refs.region);
      } else {
        frameCameraForModel(refs.activeGroup, 'shoulder');
      }
    };

    refs.loadProcedural = (targetRegion: RegionId, notice: string | null = null) => {
      activeLoadToken += 1;
      setLoadingModel(false);
      setWebglError(null);
      setFallbackNotice(notice);
      refs.isGlbActive = false;
      refs.isFullBodyGlb = false;
      setIsGlbLoaded(false);
      clearCurrentModel();

      const built = buildProceduralAnatomyModel(targetRegion);
      scene.add(built.root);
      refs.activeGroup = built.root;
      refs.interactables = built.interactables;
      refs.partMeshes = built.partMeshes;
      refs.disposables = built.disposables;

      const labels: Record<string, string> = {};
      for (const meta of built.partMetas) {
        labels[meta.id] =
          meta.bilingualName || formatBilingualName(meta.namePl, meta.nameEn);
      }
      setPartLabelsById(labels);

      for (const mesh of built.interactables) {
        const cat = mesh.userData.category as StructureCategory | undefined;
        mesh.userData.tissueType = cat === 'muscle' ? 'muscle' : cat === 'bone' ? 'bone' : 'other';
      }

      onPartsLoadedRef.current?.(built.partMetas);
      onLoadedRef.current?.();
      applyVisualHighlights();
      built.root.updateMatrixWorld(true);
      frameCameraForModel(built.root, targetRegion);
      if (!isSoftwareGl) {
        renderer.compile(scene, camera);
      }
      renderNow();
      requestRender();
    };

    const ingestLoadedGltf = (
      model: THREE.Group,
      isFullBody: boolean,
      onComplete?: () => void,
      loadToken?: number,
      allowOverlayLayers = false,
      overlayRegionKey?: RegionalModelKey,
    ) => {
      clearCurrentModel();
      refs.isGlbActive = true;
      refs.isFullBodyGlb = isFullBody;
      setIsGlbLoaded(true);
      setFallbackNotice(null);

      // Auto-center and scale model to fit camera nicely via THREE.Box3
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const origCenter = center.clone();
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 0.001);
      const scale = 3.2 / maxDim;
      const offset = origCenter.clone().multiplyScalar(-scale);
      model.scale.setScalar(scale);
      model.position.copy(offset);
      model.updateMatrixWorld(true);

      const metas: SelectableMeshMeta[] = [];
      const labels: Record<string, string> = {};
      const counts: Partial<Record<AnatomicalLayerId, number>> = {};
      let meshIndex = 0;

      const bumpCount = (lid: AnatomicalLayerId) => {
        counts[lid] = (counts[lid] ?? 0) + 1;
      };

      const applyCurrentVisibilityToMesh = (mesh: THREE.Mesh) => {
        const lid = (mesh.userData.layerId as AnatomicalLayerId | undefined) ?? 'bone';
        const activeDerm = dermatomeHighlightRef.current;
        const activeTest = clinicalTestHighlightRef.current;
        const activeNerve = clinicalNerveHighlightRef.current;
        const activeBiom = biomechanicsHighlightRef.current;
        if (activeDerm) {
          if (activeDerm.mode === 'dermatome') {
            mesh.visible = lid === 'skin' || lid === 'bone' || lid === 'cartilage';
          } else if (activeDerm.mode === 'myotome') {
            mesh.visible = lid === 'muscle' || lid === 'bone' || lid === 'cartilage';
          } else {
            mesh.visible =
              lid === 'skin' || lid === 'muscle' || lid === 'bone' || lid === 'cartilage';
          }
        } else if (activeTest) {
          const allowed = computeClinicalTestLayerSet(activeTest.structureIds);
          mesh.visible = allowed.has(lid);
        } else if (activeNerve) {
          mesh.visible =
            lid === 'muscle' || lid === 'nerve' || lid === 'bone' || lid === 'cartilage';
        } else if (activeBiom) {
          mesh.visible = lid === 'muscle' || lid === 'bone' || lid === 'cartilage';
        } else if (layerFilter === 'muscle') {
          mesh.visible = lid === 'muscle';
        } else if (layerFilter === 'bone') {
          mesh.visible = lid === 'bone' || lid === 'cartilage';
        } else {
          mesh.visible = Boolean(visibleLayersRef.current[lid]);
        }
      };

      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.computeBoundingBox();
          child.geometry.computeBoundingSphere();

          const ud = (child.userData || {}) as {
            type?: string;
            name?: string;
            nameDetail?: string;
            description?: string;
            wikiLink?: string;
          };
          const rawTitle =
            child.name?.trim() || ud.name?.trim() || `Struktura_${meshIndex + 1}`;
          const rawType = (ud.type || '').toLowerCase();
          const matName = (
            child.material && !Array.isArray(child.material) ? child.material.name : ''
          ).toLowerCase();

          const isBursaRaw = /\bbursae?\b/i.test(rawTitle);
          const isTendonRaw = /\b(tendon|sheath|aponeurosis|retinaculum|fascia|linea\s+alba)\b/i.test(rawTitle);
          const isMuscleTissue =
            !isBursaRaw &&
            !isTendonRaw &&
            (rawType === 'muscle' ||
              matName.includes('muscle') ||
              matName === 'mat_muscle_pro' ||
              /\bmuscle\b/i.test(rawTitle));

          const tissueHint = isBursaRaw
            ? ('bursa' as const)
            : isTendonRaw
              ? ('tendon' as const)
              : isMuscleTissue
                ? ('muscle' as const)
                : rawType === 'bone' || matName.includes('bone') || matName === 'mat_bone_pro'
                  ? ('bone' as const)
                  : ('other' as const);

          // Compute world center BEFORE translateMeshNameToPolish; recover pre-centering anatomical X
          const childBox = new THREE.Box3().setFromObject(child);
          const worldCenter = childBox.getCenter(new THREE.Vector3());
          const anatomicalX = worldCenter.x / scale + origCenter.x;

          const translated = translateMeshNameToPolish(rawTitle, tissueHint, anatomicalX);
          const isCartilage =
            Boolean(translated.isCartilage) ||
            /\b(cartilage|alar|septal|meniscus|labrum|intervertebral.*disc|discus)\b/i.test(
              rawTitle,
            ) ||
            /\b(cartilage|alar|septal)\b/i.test(child.name);

          const layerId = classifyBaseGlbMeshLayer(
            rawTitle,
            rawType,
            matName,
            isCartilage,
            translated.category,
          );
          bumpCount(layerId);

          // Apply specialized PBR materials for cartilage (mint), bursae (pearly white), and tendons/sheaths (satin white)
          const overrideMat = createMaterialForLayer(layerId, rawTitle);
          if (overrideMat) {
            child.material = overrideMat;
          }

          const tissueType = layerIdToLegacyTissueType(layerId);

          // Unify multi-head / multi-part muscles per side in 'whole' mode (and preserve per-head labels for 'parts' mode)
          const individualId = `glb_${meshIndex}_${rawTitle.replace(/\W+/g, '_')}`;
          const unifiedId = getUnifiedMeshGroupKey(
            rawTitle,
            translated.structureId,
            layerId,
            anatomicalX,
            'whole',
          );
          const id =
            muscleGroupingModeRef.current === 'whole' && unifiedId ? unifiedId : individualId;
          meshIndex += 1;

          const anatomicalSide: 'left' | 'right' | undefined =
            anatomicalX > 0.002 ? 'left' : anatomicalX < -0.002 ? 'right' : undefined;
          const subpartPl = unifiedId ? formatMuscleSubpartPolish(rawTitle) : null;
          const wholeNamePl = translated.namePl;
          const wholeNameEn = translated.nameEn;
          const wholeBilingualName =
            translated.bilingualName || formatBilingualName(wholeNamePl, wholeNameEn);

          const baseWithoutSidePl = wholeNamePl.replace(/\s*\(strona\s+(prawa|lewa)\)/i, '').trim();
          const sideSuffixMatch = wholeNamePl.match(/\s*\(strona\s+(prawa|lewa)\)/i);
          const sideSuffix = sideSuffixMatch ? sideSuffixMatch[0] : '';
          const partNamePl = subpartPl
            ? `${baseWithoutSidePl} — ${subpartPl}${sideSuffix}`
            : wholeNamePl;
          const partNameEn =
            rawTitle
              .replace(/[_]+/g, ' ')
              .replace(/\.(r|l)$/gi, '')
              .replace(/\.?\d{3}$/g, '')
              .replace(/\s+/g, ' ')
              .trim() || wholeNameEn;
          const partBilingualName = formatBilingualName(partNamePl, partNameEn);

          const activeNamePl =
            muscleGroupingModeRef.current === 'parts' && unifiedId ? partNamePl : wholeNamePl;
          const activeNameEn =
            muscleGroupingModeRef.current === 'parts' && unifiedId ? partNameEn : wholeNameEn;
          const activeBilingualName =
            muscleGroupingModeRef.current === 'parts' && unifiedId
              ? partBilingualName
              : wholeBilingualName;

          // Compute radial displacement vector relative to longitudinal body axis (Y)
          const explodeVec = new THREE.Vector3(worldCenter.x, 0, worldCenter.z);
          if (explodeVec.lengthSq() < 1e-4) {
            explodeVec.set(0.1, 0, 0.1);
          }
          explodeVec.normalize();
          const dist = layerId === 'muscle' || layerId === 'bursa' || layerId === 'tendon' ? 0.35 : 0.12;
          explodeVec.multiplyScalar(dist);

          child.userData = {
            ...child.userData,
            id,
            individualId,
            unifiedId,
            anatomicalSide,
            namePl: activeNamePl,
            nameEn: activeNameEn,
            bilingualName: activeBilingualName,
            wholeNamePl,
            wholeNameEn,
            wholeBilingualName,
            partNamePl,
            partNameEn,
            partBilingualName,
            structureId: translated.structureId,
            category: translated.category,
            isCartilage,
            layerId,
            tissueType,
            basePosition: child.position.clone(),
            explodeVector: explodeVec,
            individualExplodeVector: explodeVec.clone(),
            rawName: rawTitle,
            nameDetail: ud.nameDetail,
            description: ud.description,
            wikiLink: ud.wikiLink,
          };

          applyCurrentVisibilityToMesh(child);
          refs.interactables.push(child);

          const existingGroup = refs.partMeshes.get(id);
          if (existingGroup) {
            existingGroup.push(child);
          } else {
            refs.partMeshes.set(id, [child]);
            const bilingualLabel = activeBilingualName;
            labels[id] = bilingualLabel;
            metas.push({
              id,
              namePl: activeNamePl,
              nameEn: activeNameEn,
              bilingualName: bilingualLabel,
              structureId: translated.structureId,
              category: translated.category,
            });
          }

          refs.disposables.push(child.geometry);
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => refs.disposables.push(m));
          } else if (child.material) {
            refs.disposables.push(child.material);
          }
        }
      });

      // Harmonize explodeVector across unified multi-mesh structures (e.g., 3 heads of Deltoid move as 1 unit)
      for (const [, groupMeshes] of refs.partMeshes.entries()) {
        if (groupMeshes.length <= 1) continue;
        const unionBox = new THREE.Box3();
        for (const gm of groupMeshes) unionBox.expandByObject(gm);
        const uCenter = unionBox.getCenter(new THREE.Vector3());
        const sharedExplode = new THREE.Vector3(uCenter.x, 0, uCenter.z);
        if (sharedExplode.lengthSq() < 1e-4) sharedExplode.set(0.1, 0, 0.1);
        sharedExplode.normalize().multiplyScalar(0.35);
        for (const gm of groupMeshes) {
          gm.userData.explodeVector = sharedExplode.clone();
        }
      }

      setPartLabelsById({ ...labels });
      setLayerMeshCounts({ ...counts });

      // Build vertex-colored 3D bone surface zones for landmarks & PP/PK muscle attachments (zero floating spheres)
      refs.hotspotMarkers = [];
      const normalizeMeshKey = (name: string) =>
        THREE.PropertyBinding.sanitizeNodeName(name).trim().toLowerCase();

      const landmarksByMesh = new Map<THREE.Mesh, BonyLandmarkExtended[]>();
      const mountedLandmarks: BonyLandmarkExtended[] = [];

      for (const lm of BONY_LANDMARKS) {
        let parentMesh: THREE.Mesh | undefined;
        if (lm.parentMesh) {
          const targetKey = normalizeMeshKey(lm.parentMesh);
          parentMesh = refs.interactables.find(
            (m) =>
              normalizeMeshKey(m.name || '') === targetKey ||
              normalizeMeshKey((m.userData.rawName as string) || '') === targetKey,
          );
        } else {
          const isMidline =
            lm.side === 'midline' ||
            lm.boneId === 'mandibula' ||
            Math.abs(lm.position[0]) < 0.015;
          const isRight = lm.position[0] < 0;

          parentMesh = refs.interactables.find((m) => {
            const sId = m.userData.structureId;
            const raw = ((m.userData.rawName as string) || '').toLowerCase();

            const matchesBone =
              sId === lm.boneId ||
              (lm.boneId === 'humerus' && raw.includes('humerus')) ||
              (lm.boneId === 'scapula' && raw.includes('scapula')) ||
              (lm.boneId === 'femur' && raw.includes('femur')) ||
              (lm.boneId === 'tibia' && raw.includes('tibia')) ||
              (lm.boneId === 'fibula_head' && raw.includes('fibula')) ||
              (lm.boneId === 'os_coxae' &&
                (raw.includes('hip bone') || raw.includes('pelvis') || raw.includes('ilium'))) ||
              (lm.boneId === 'calcaneus' && raw.includes('calcaneus')) ||
              (lm.boneId === 'radius' && raw.includes('radius')) ||
              (lm.boneId === 'ulna' && raw.includes('ulna')) ||
              (lm.boneId === 'patella' && raw.includes('patella')) ||
              (lm.boneId === 'mandibula' && raw.includes('mandible'));

            if (!matchesBone) return false;
            if (isMidline) return true;
            const meshX =
              ((m.geometry.boundingBox?.min.x ?? 0) + (m.geometry.boundingBox?.max.x ?? 0)) / 2;
            return isRight ? meshX < 0 : meshX > 0;
          });
        }

        if (!parentMesh) continue;

        const list = landmarksByMesh.get(parentMesh) ?? [];
        list.push(lm);
        landmarksByMesh.set(parentMesh, list);
        mountedLandmarks.push(lm);
      }

      for (const [boneMesh, meshLandmarks] of landmarksByMesh.entries()) {
        buildBoneSurfaceZones(boneMesh, meshLandmarks);
        if (!Array.isArray(boneMesh.material) && boneMesh.material) {
          refs.disposables.push(boneMesh.material);
        }
      }

      applyVisualHighlights();

      const wrapper = new THREE.Group();
      wrapper.add(model);
      scene.add(wrapper);
      refs.activeGroup = wrapper;

      onPartsLoadedRef.current?.([...metas]);
      onLandmarksLoadedRef.current?.(mountedLandmarks);
      onSelectPartRef.current(null);
      frameCameraForModel(wrapper, isFullBody ? 'full_body' : 'custom');
      onLoadedRef.current?.();
      renderer.render(scene, camera);
      onComplete?.();
      requestRender();

      // Stream additive Z-Anatomy overlay layers (ligaments, arteries, veins, nerves, organs, skin)
      if (allowOverlayLayers && enableExtendedLayersRef.current && loadToken !== undefined) {
        const regKey: RegionalModelKey =
          overlayRegionKey ?? (isFullBody ? 'full_body' : resolveBestRegionalKeyForStructure(undefined, refs.region));
        overlaysLoadingRef.current = true;
        setLoadingOverlayLayers(true);

        loadLayersManifest().then((manifest) => {
          if (disposed || loadToken !== activeLoadToken) return;
          const regEntries = manifest?.regions?.[regKey];
          if (!regEntries) {
            overlaysLoadingRef.current = false;
            setLoadingOverlayLayers(false);
            return;
          }

          const layerEntries = Object.entries(regEntries) as Array<
            [OverlayGlbLayerKey, { url: string; meshes: number; bytes: number }]
          >;
          if (layerEntries.length === 0) {
            overlaysLoadingRef.current = false;
            setLoadingOverlayLayers(false);
            return;
          }

          let remaining = layerEntries.length;
          const finishOne = () => {
            remaining -= 1;
            if (remaining <= 0 && !disposed && loadToken === activeLoadToken) {
              overlaysLoadingRef.current = false;
              setLoadingOverlayLayers(false);
              setPartLabelsById({ ...labels });
              setLayerMeshCounts({ ...counts });
              onPartsLoadedRef.current?.([...metas]);
              applyVisualHighlights();
              const pending = pendingOverlayTargetRef.current;
              if (pending) {
                pendingOverlayTargetRef.current = null;
                selectAndFocusTargetInternal(pending);
              }
              applyVisualHighlights();
              applyClipping();
              renderNow();
              requestRender();
            }
          };

          for (const [overlayKey, entry] of layerEntries) {
            const targetLayerId = OVERLAY_KEY_TO_LAYER_ID[overlayKey];
            gltfLoader.load(
              entry.url,
              (overlayGltf) => {
                if (disposed || loadToken !== activeLoadToken) return;
                const overlayScene = overlayGltf.scene;
                overlayScene.scale.setScalar(scale);
                overlayScene.position.copy(offset);
                overlayScene.updateMatrixWorld(true);

                overlayScene.traverse((child) => {
                  if (!(child instanceof THREE.Mesh)) return;
                  child.geometry.computeBoundingBox();
                  child.geometry.computeBoundingSphere();

                  const ud = (child.userData || {}) as {
                    sourceName?: string;
                    origMaterial?: string;
                    side?: string;
                    layer?: string;
                  };
                  const rawTitle =
                    ud.sourceName?.trim() || child.name?.trim() || `${overlayKey}_${meshIndex + 1}`;
                  const childBox = new THREE.Box3().setFromObject(child);
                  const worldCenter = childBox.getCenter(new THREE.Vector3());
                  const anatomicalX = worldCenter.x / scale + origCenter.x;

                  const translated = translateMeshNameToPolish(rawTitle, targetLayerId, anatomicalX);
                  const isCartilageOverlay =
                    targetLayerId === 'ligament' &&
                    Boolean(translated.isCartilage || /\b(disc|meniscus|labrum|cartilage)\b/i.test(rawTitle));

                  const mat = createMaterialForLayer(
                    targetLayerId,
                    rawTitle,
                    ud.origMaterial,
                    skinOpacityRef.current,
                  );
                  if (mat) {
                    child.material = mat;
                  }

                  const id = `ov_${overlayKey}_${meshIndex}_${rawTitle.replace(/\W+/g, '_')}`;
                  meshIndex += 1;
                  bumpCount(targetLayerId);

                  const explodeVec = new THREE.Vector3(worldCenter.x, 0, worldCenter.z);
                  if (explodeVec.lengthSq() < 1e-4) explodeVec.set(0.1, 0, 0.1);
                  explodeVec.normalize();
                  const explodeDist =
                    targetLayerId === 'skin'
                      ? 0.55
                      : targetLayerId === 'artery' || targetLayerId === 'vein' || targetLayerId === 'nerve'
                        ? 0.24
                        : targetLayerId === 'organ'
                          ? 0.06
                          : 0.14;
                  explodeVec.multiplyScalar(explodeDist);

                  const overlaySide: 'left' | 'right' | undefined =
                    ud.side === 'left' || ud.side === 'right'
                      ? (ud.side as 'left' | 'right')
                      : anatomicalX > 0.002
                        ? 'left'
                        : anatomicalX < -0.002
                          ? 'right'
                          : undefined;

                  child.userData = {
                    ...child.userData,
                    id,
                    individualId: id,
                    unifiedId: null,
                    anatomicalSide: overlaySide,
                    namePl: translated.namePl,
                    nameEn: translated.nameEn,
                    bilingualName: translated.bilingualName,
                    structureId: translated.structureId,
                    category: translated.category,
                    isCartilage: isCartilageOverlay,
                    layerId: targetLayerId,
                    tissueType: layerIdToLegacyTissueType(targetLayerId),
                    basePosition: child.position.clone(),
                    explodeVector: explodeVec,
                    individualExplodeVector: explodeVec.clone(),
                    rawName: rawTitle,
                  };

                  applyCurrentVisibilityToMesh(child);
                  refs.interactables.push(child);
                  refs.partMeshes.set(id, [child]);

                  const bilingualLabel =
                    translated.bilingualName ||
                    formatBilingualName(translated.namePl, translated.nameEn);
                  labels[id] = bilingualLabel;
                  metas.push({
                    id,
                    namePl: translated.namePl,
                    nameEn: translated.nameEn,
                    bilingualName: bilingualLabel,
                    structureId: translated.structureId,
                    category: translated.category,
                  });

                  refs.disposables.push(child.geometry);
                  if (Array.isArray(child.material)) {
                    child.material.forEach((m) => refs.disposables.push(m));
                  } else if (child.material) {
                    refs.disposables.push(child.material);
                  }
                });

                wrapper.add(overlayScene);
                finishOne();
              },
              undefined,
              () => {
                finishOne();
              },
            );
          }
        });
      }
    };


    refs.loadGlbFromUrl = (url: string, _label: string, fallbackRegion: RegionId) => {
      const token = ++activeLoadToken;
      setLoadingModel(true);
      setLoadingOverlayLayers(false);
      overlaysLoadingRef.current = false;
      setWebglError(null);
      setFallbackNotice(null);

      gltfLoader.load(
        url,
        (gltf) => {
          if (disposed || token !== activeLoadToken) return;
          const isFull = url === LOCAL_BODY_MODEL_PATH;
          const regMatch = url.match(/\/models\/regional\/([a-z_]+)\.glb$/i);
          const overlayRegKey: RegionalModelKey = isFull
            ? 'full_body'
            : ((regMatch?.[1] as RegionalModelKey | undefined) ??
                resolveBestRegionalKeyForStructure(undefined, refs.region));
          ingestLoadedGltf(
            gltf.scene,
            isFull,
            () => setLoadingModel(false),
            token,
            true,
            overlayRegKey,
          );
        },
        undefined,
        () => {
          if (disposed || token !== activeLoadToken) return;
          setLoadingModel(false);
          refs.loadProcedural(
            fallbackRegion,
            'Nie udało się pobrać modelu z GitHuba — włączono klikalny model zapasowy.',
          );
        },
      );
    };

    refs.loadCustomGlb = (file: File) => {
      const token = ++activeLoadToken;
      setLoadingModel(true);
      setWebglError(null);
      const url = URL.createObjectURL(file);

      gltfLoader.load(
        url,
        (gltf) => {
          URL.revokeObjectURL(url);
          if (disposed || token !== activeLoadToken) return;
          setCustomModelName(file.name);
          ingestLoadedGltf(gltf.scene, false, () => setLoadingModel(false));
        },
        undefined,
        () => {
          URL.revokeObjectURL(url);
          if (disposed || token !== activeLoadToken) return;
          setLoadingModel(false);
          setWebglError('Nie udało się wczytać pliku .glb / .gltf. Sprawdź format modelu.');
        },
      );
    };

    const handleControlsChange = () => {
      if (!cameraAnimGoal) requestRender();
    };
    const handleControlsStart = () => {
      cancelCameraAnimation();
    };
    controls.addEventListener('change', handleControlsChange);
    controls.addEventListener('start', handleControlsStart);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownX = 0;
    let pointerDownY = 0;
    let pointerDownActive = false;
    let lastHoverCheck = 0;
    let lastHoveredHotspotId: string | null = null;

    const updatePointer = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const handlePointerDown = (ev: PointerEvent) => {
      if (ev.button !== 0) return;
      pointerDownActive = true;
      pointerDownX = ev.clientX;
      pointerDownY = ev.clientY;
    };

    const getVisibleInteractables = () => refs.interactables.filter((m) => m.visible);

    const pickBestHit = (hits: THREE.Intersection[]) => {
      if (hits.length === 0) return null;
      // Exclude intersection points that have been sliced away by the active 3D Clipping Plane
      const clipActive = clippingStateRef.current.axis !== 'off';
      const unclippedHits = clipActive
        ? hits.filter((h) => refs.clipPlane.distanceToPoint(h.point) >= -1e-4)
        : hits;
      if (unclippedHits.length === 0) return null;
      // When Skin is translucent (<= 75% opacity), let clicks & hover pass right through to underlying structures
      const filteredHits =
        skinOpacityRef.current <= 0.75
          ? unclippedHits.filter(
              (h) => !(h.object instanceof THREE.Mesh && h.object.userData.layerId === 'skin'),
            )
          : unclippedHits;
      if (filteredHits.length === 0) return null;
      if (xrayModeRef.current) {
        // In X-Ray mode, allow clicking bones & PP/PK zones right through translucent muscles
        const boneHit = filteredHits.find(
          (h) => h.object instanceof THREE.Mesh && h.object.userData.tissueType === 'bone',
        );
        if (boneHit) return boneHit;
      }
      return filteredHits[0];
    };

    const handlePointerUp = (ev: PointerEvent) => {
      if (!pointerDownActive) return;
      pointerDownActive = false;
      const dist = Math.hypot(ev.clientX - pointerDownX, ev.clientY - pointerDownY);
      if (dist > 6) return;

      updatePointer(ev);
      raycaster.setFromCamera(pointer, camera);

      const hits = raycaster.intersectObjects(getVisibleInteractables(), false);
      const primaryHit = pickBestHit(hits);

      if (primaryHit) {
        // Priority 1: Triangle-level detection of vertex-colored bone surface zone
        const hitZone = detectHitBoneSurfaceZone(primaryHit, boneZoneModeRef.current);
        if (hitZone) {
          setSelectedHotspot(hitZone);
          setShowHiddenPanel(false);
          const resolvedId = hitZone.structureId || hitZone.id;
          onSelectPartRef.current({
            id: hitZone.id,
            namePl: hitZone.namePl,
            nameEn: hitZone.nameEn,
            bilingualName: hitZone.bilingualName || formatBilingualName(hitZone.namePl, hitZone.nameEn),
            structureId: resolvedId,
            category: 'bone',
            tissueType: 'bone',
            layerId: 'bone',
          });
          requestRender();
          return;
        }

        // Priority 2: Whole structure mesh selection
        const hitObj = primaryHit.object;
        const {
          id,
          rawName,
          namePl,
          nameEn,
          bilingualName,
          structureId,
          category,
          tissueType,
          layerId,
        } = hitObj.userData;
        setSelectedHotspot(null);
        onSelectPartRef.current({
          id,
          rawMeshName: rawName || hitObj.name,
          namePl,
          nameEn,
          bilingualName: bilingualName || formatBilingualName(namePl, nameEn),
          structureId,
          category,
          tissueType,
          layerId,
        });
      } else {
        setSelectedHotspot(null);
        onSelectPartRef.current(null);
      }
      requestRender();
    };

    const handleDoubleClick = (ev: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const hits = raycaster.intersectObjects(getVisibleInteractables(), false);
      const primaryHit = pickBestHit(hits);
      if (!primaryHit) return;

      const hitZone = detectHitBoneSurfaceZone(primaryHit, boneZoneModeRef.current);
      if (hitZone) {
        refs.focusHotspot?.(hitZone);
        return;
      }

      const id = primaryHit.object.userData.id as string | undefined;
      if (id) {
        refs.focusMesh(id);
      }
    };

    const handleWheel = () => {
      cancelCameraAnimation();
    };

    const handlePointerMove = (ev: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 50) return;
      lastHoverCheck = now;

      updatePointer(ev);
      raycaster.setFromCamera(pointer, camera);

      const hits = raycaster.intersectObjects(getVisibleInteractables(), false);
      const primaryHit = pickBestHit(hits);

      // Priority 1: Triangle-level hover over a vertex-colored bone surface zone
      const hitZone = primaryHit ? detectHitBoneSurfaceZone(primaryHit, boneZoneModeRef.current) : null;
      if (hitZone) {
        if (refs.hoveredId !== null || refs.hoveredLandmarkId !== hitZone.id) {
          refs.hoveredId = null;
          refs.hoveredLandmarkId = hitZone.id;
          applyVisualHighlights();
        }
        lastHoveredHotspotId = hitZone.id;
        renderer.domElement.style.cursor = 'pointer';
        if (hideHoverLabelRef.current) {
          setHoveredName(null);
        } else {
          const label = hitZone.bilingualName || formatBilingualName(hitZone.namePl, hitZone.nameEn);
          const typeTag =
            hitZone.type === 'pp'
              ? 'PP • Przyczep początkowy'
              : hitZone.type === 'pk'
                ? 'PK • Przyczep końcowy'
                : 'Struktura kostna';
          setHoveredName(`${label} • [${typeTag}]`);
        }
        requestRender();
        return;
      }

      const nextHoveredId = primaryHit ? (primaryHit.object.userData.id as string) : null;

      if (nextHoveredId !== refs.hoveredId || lastHoveredHotspotId !== null || refs.hoveredLandmarkId !== null) {
        lastHoveredHotspotId = null;
        refs.hoveredLandmarkId = null;
        refs.hoveredId = nextHoveredId;
        renderer.domElement.style.cursor = nextHoveredId ? 'pointer' : 'grab';
        const hitObj = primaryHit ? primaryHit.object : null;
        if (hitObj && !hideHoverLabelRef.current) {
          const ud = hitObj.userData;
          setHoveredName(
            ud.bilingualName || formatBilingualName(ud.namePl || '', ud.nameEn) || ud.namePl || null,
          );
        } else {
          setHoveredName(null);
        }
        applyVisualHighlights();
        requestRender();
      }
    };

    const handlePointerLeave = () => {
      pointerDownActive = false;
      if (refs.hoveredId !== null || lastHoveredHotspotId !== null || refs.hoveredLandmarkId !== null) {
        refs.hoveredId = null;
        refs.hoveredLandmarkId = null;
        lastHoveredHotspotId = null;
        renderer.domElement.style.cursor = 'grab';
        setHoveredName(null);
        applyVisualHighlights();
        requestRender();
      }
    };

    const handleContextLost = (ev: Event) => {
      ev.preventDefault();
      setWebglError('Kontekst WebGL został tymczasowo utracony. Odśwież widok.');
    };

    const handleContextRestored = () => {
      setWebglError(null);
      requestRender();
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerleave', handlePointerLeave);
    renderer.domElement.addEventListener('dblclick', handleDoubleClick);
    renderer.domElement.addEventListener('wheel', handleWheel, { passive: true });
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    let lastObservedWidth = width;
    let lastObservedHeight = height;
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || disposed) return;
      const w = Math.max(Math.round(entry.contentRect.width), 200);
      const h = Math.max(Math.round(entry.contentRect.height), 200);
      if (w === lastObservedWidth && h === lastObservedHeight) return;
      lastObservedWidth = w;
      lastObservedHeight = h;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderNow();
      requestRender();
    });
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      activeLoadToken += 1;
      cancelCameraAnimation();
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (timeoutId !== null) clearTimeout(timeoutId);
      resizeObserver.disconnect();
      controls.removeEventListener('change', handleControlsChange);
      controls.removeEventListener('start', handleControlsStart);
      controls.dispose();
      dracoLoader.dispose();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerleave', handlePointerLeave);
      renderer.domElement.removeEventListener('dblclick', handleDoubleClick);
      renderer.domElement.removeEventListener('wheel', handleWheel);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      clearCurrentModel();
      pedestalGeo.dispose();
      pedestalMat.dispose();
      contactShadowGeo.dispose();
      contactShadowMat.dispose();
      contactShadowTex.dispose();
      clipGuideGeo.dispose();
      clipGuideMat.dispose();
      if (biomechanicsGuideGroupRef.current) {
        scene.remove(biomechanicsGuideGroupRef.current);
        biomechanicsGuideGroupRef.current.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
            else obj.material.dispose();
          }
        });
        biomechanicsGuideGroupRef.current = null;
      }
      envTarget.dispose();
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load regional GLB or full_body on initial mount and whenever region/modelUrl/highlightedStructureId changes
  useEffect(() => {
    if (!sceneRefs.current.renderer) return;
    sceneRefs.current.region = region;
    setExploded(false);
    setXrayMode(false);
    setLayerFilter(filterMode ?? 'all');
    setHiddenPartIds([]);
    setIsolatedMusclePartId(null);
    setShowHiddenPanel(false);
    setShowLayersPanel(false);
    setSelectedHotspot(null);
    setCustomModelName(null);
    setFallbackNotice(null);

    const targetUrl =
      modelUrl ||
      resolveRegionalModelPath(region, highlightedStructureId ?? undefined);
    const fallbackRegion: RegionId =
      region === 'knee' ||
      region === 'lower_limb' ||
      region === 'lower_limb_left' ||
      region === 'lower_limb_right' ||
      /lower_limb/i.test(targetUrl)
        ? 'knee'
        : 'shoulder';

    const label =
      targetUrl === LOCAL_BODY_MODEL_PATH
        ? 'Pełny model ciała człowieka (826 struktur 3D)'
        : REGION_TITLES[region] ?? `Model regionalny: ${region}`;

    sceneRefs.current.loadGlbFromUrl(targetUrl, label, fallbackRegion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, modelUrl, highlightedStructureId]);

  const activeLayerCount = ANATOMY_LAYERS_META.filter(
    (l) => (layerMeshCounts[l.id] ?? 0) > 0 && visibleLayers[l.id],
  ).length;
  const availableLayerCount = ANATOMY_LAYERS_META.filter(
    (l) => (layerMeshCounts[l.id] ?? 0) > 0,
  ).length;

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 flex flex-col overflow-hidden bg-white dark:bg-[#0b1510]'
          : 'flex flex-col overflow-hidden rounded-2xl border-2 border-[#d6e7dc] bg-white dark:border-[#294737] dark:bg-[#112018]'
      }
    >
      {/* Non-overlapping Top Controls Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#d6e7dc] bg-[#f4faf6] px-3 py-2 dark:border-[#233d2f] dark:bg-[#112018]">
        <div className="flex items-center gap-2 text-xs font-extrabold text-[#16291f] dark:text-[#e6f2ea]">
          <span>
            {customModelName
              ? `Model: ${customModelName}`
              : REGION_TITLES[region] ?? 'Model 3D: Anatomia regionalna (Regional Anatomy)'}
          </span>
          {loadingOverlayLayers && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
              <span className="h-2 w-2 animate-ping rounded-full bg-emerald-500" />
              Ładowanie układów...
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {!customModelName && (
            <div className="flex items-center rounded-xl border border-[#c2d8ca] bg-white p-0.5 dark:border-[#294737] dark:bg-[#182b21]">
              {(
                [
                  { id: 'all', label: 'Wszystko' },
                  { id: 'muscle', label: 'Mięśnie' },
                  { id: 'bone', label: 'Kości' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`layer-filter-${tab.id}`}
                  onClick={() => {
                    setIsolatedMusclePartId(null);
                    setXrayMode(false);
                    setLayerFilter(tab.id);
                  }}
                  className={`whitespace-nowrap rounded-lg px-2 py-0.5 text-[11px] font-bold transition ${
                    !isolatedMusclePartId && layerFilter === tab.id
                      ? 'bg-emerald-500 text-white'
                      : 'text-[#354c3f] hover:text-emerald-950 dark:text-[#c7dbcf] dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {!customModelName && (
            <button
              type="button"
              data-testid="toggle-layers-panel-btn"
              onClick={() => {
                setShowLayersPanel((prev) => {
                  const next = !prev;
                  if (next) {
                    setShowHiddenPanel(false);
                    setShowClippingPanel(false);
                  }
                  return next;
                });
              }}
              title="Przełączaj układy anatomiczne: kości, mięśnie, kaletki, ścięgna, więzadła, tętnice, żyły, nerwy, narządy i skórę"
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-b-3 px-2.5 py-1 text-xs font-bold transition active:translate-y-0.5 active:border-b ${
                showLayersPanel
                  ? 'border-emerald-700 bg-emerald-600 text-white'
                  : 'border-[#c2d8ca] bg-white text-[#26382e] hover:bg-[#f4faf6] dark:border-[#294737] dark:bg-[#182b21] dark:text-[#e6f2ea] dark:hover:bg-[#233d2f]'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>
                Warstwy{availableLayerCount > 0 ? ` (${activeLayerCount}/${availableLayerCount})` : ''}
              </span>
            </button>
          )}

          {!customModelName && canUseClipping && (
            <button
              type="button"
              data-testid="toggle-clipping-panel-btn"
              onClick={() => {
                setShowClippingPanel((prev) => {
                  const next = !prev;
                  if (next) {
                    setShowLayersPanel(false);
                    setShowHiddenPanel(false);
                  }
                  return next;
                });
              }}
              title="Przekrój anatomiczny 3D (płaszczyzna poprzeczna, strzałkowa lub czołowa)"
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-b-3 px-2.5 py-1 text-xs font-bold transition active:translate-y-0.5 active:border-b ${
                showClippingPanel || clippingState.axis !== 'off'
                  ? 'border-emerald-700 bg-emerald-600 text-white'
                  : 'border-[#c2d8ca] bg-white text-[#26382e] hover:bg-[#f4faf6] dark:border-[#294737] dark:bg-[#182b21] dark:text-[#e6f2ea] dark:hover:bg-[#233d2f]'
              }`}
            >
              <Scissors className="h-3.5 w-3.5" />
              <span>
                {clippingState.axis === 'off'
                  ? 'Przekrój 3D'
                  : clippingState.axis === 'axial'
                    ? 'Przekrój: Osiowy'
                    : clippingState.axis === 'sagittal'
                      ? 'Przekrój: Strzałkowy'
                      : 'Przekrój: Czołowy'}
              </span>
            </button>
          )}

          {!customModelName && canToggleMuscleGrouping && (
            <div
              data-testid="muscle-grouping-toggle"
              className="flex items-center rounded-xl border border-[#c2d8ca] bg-white p-0.5 dark:border-[#294737] dark:bg-[#182b21]"
            >
              {(
                [
                  { id: 'whole', label: 'Całe mięśnie', testId: 'muscle-grouping-whole' },
                  { id: 'parts', label: 'Głowy / aktony', testId: 'muscle-grouping-parts' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  data-testid={opt.testId}
                  onClick={() => setMuscleGroupingMode(opt.id)}
                  title={
                    opt.id === 'whole'
                      ? 'Łączy głowy i aktony mięśni wielogłowych (np. naramienny, biceps, triceps, piersiowy większy, czworoboczny) w jedną strukturę; czworogłowy uda pozostaje podzielony na 4 głowy'
                      : 'Rozdziela mięśnie wielogłowe na pojedyncze głowy i aktony do szczegółowej nauki'
                  }
                  className={`whitespace-nowrap rounded-lg px-2 py-0.5 text-[11px] font-bold transition ${
                    muscleGroupingMode === opt.id
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-[#354c3f] hover:text-emerald-950 dark:text-[#c7dbcf] dark:hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {region === 'full_body' && !customModelName && (
            <div className="flex flex-wrap items-center rounded-xl border border-[#c2d8ca] bg-white p-0.5 dark:border-[#294737] dark:bg-[#182b21]">
              <button
                type="button"
                onClick={() => sceneRefs.current.focusBodyZone('full')}
                className="whitespace-nowrap rounded-lg px-2 py-0.5 text-[11px] font-bold text-[#354c3f] hover:bg-emerald-50 dark:text-[#c7dbcf] dark:hover:bg-[#233d2f]"
              >
                Całe
              </button>
              <button
                type="button"
                onClick={() => sceneRefs.current.focusBodyZone('head')}
                className="whitespace-nowrap rounded-lg px-2 py-0.5 text-[11px] font-bold text-[#354c3f] hover:bg-emerald-50 dark:text-[#c7dbcf] dark:hover:bg-[#233d2f]"
              >
                Głowa
              </button>
              <button
                type="button"
                onClick={() => sceneRefs.current.focusBodyZone('shoulder')}
                className="whitespace-nowrap rounded-lg px-2 py-0.5 text-[11px] font-bold text-[#354c3f] hover:bg-emerald-50 dark:text-[#c7dbcf] dark:hover:bg-[#233d2f]"
              >
                Bark
              </button>
              <button
                type="button"
                onClick={() => sceneRefs.current.focusBodyZone('thorax')}
                className="whitespace-nowrap rounded-lg px-2 py-0.5 text-[11px] font-bold text-[#354c3f] hover:bg-emerald-50 dark:text-[#c7dbcf] dark:hover:bg-[#233d2f]"
              >
                Klatka
              </button>
              <button
                type="button"
                onClick={() => sceneRefs.current.focusBodyZone('pelvis')}
                className="whitespace-nowrap rounded-lg px-2 py-0.5 text-[11px] font-bold text-[#354c3f] hover:bg-emerald-50 dark:text-[#c7dbcf] dark:hover:bg-[#233d2f]"
              >
                Miednica
              </button>
              <button
                type="button"
                onClick={() => sceneRefs.current.focusBodyZone('knee')}
                className="whitespace-nowrap rounded-lg px-2 py-0.5 text-[11px] font-bold text-[#354c3f] hover:bg-emerald-50 dark:text-[#c7dbcf] dark:hover:bg-[#233d2f]"
              >
                Kolano
              </button>
            </div>
          )}

          <button
            type="button"
            data-testid="toggle-xray-btn"
            onClick={() => {
              setXrayMode((prev) => {
                const next = !prev;
                if (next) {
                  setIsolatedMusclePartId(null);
                  setLayerFilter('all');
                  if (boneZoneModeRef.current === 'off') {
                    setBoneZoneMode('attachments');
                  }
                }
                return next;
              });
            }}
            title="Tryb RTG — półprzezroczyste mięśnie odsłaniające kości i przyczepy PP/PK"
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-b-3 px-2.5 py-1 text-xs font-bold transition active:translate-y-0.5 active:border-b ${
              xrayMode
                ? 'border-emerald-700 bg-emerald-600 text-white'
                : 'border-[#c2d8ca] bg-white text-[#26382e] hover:bg-[#f4faf6] dark:border-[#294737] dark:bg-[#182b21] dark:text-[#e6f2ea] dark:hover:bg-[#233d2f]'
            }`}
          >
            <ScanEye className="h-3.5 w-3.5" />
            <span>RTG</span>
          </button>

          <button
            type="button"
            onClick={() => setExploded((prev) => !prev)}
            title="Rozsuń warstwy mięśniowe i kostne"
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-b-3 px-2.5 py-1 text-xs font-bold transition active:translate-y-0.5 active:border-b ${
              exploded
                ? 'border-emerald-700 bg-emerald-500 text-white'
                : 'border-[#c2d8ca] bg-white text-[#26382e] hover:bg-[#f4faf6] dark:border-[#294737] dark:bg-[#182b21] dark:text-[#e6f2ea] dark:hover:bg-[#233d2f]'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>{exploded ? 'Złóż warstwy' : 'Rozsuń warstwy'}</span>
          </button>

          <div
            data-testid="toggle-bony-landmarks-btn"
            className="flex flex-wrap items-center rounded-xl border border-[#c2d8ca] bg-white p-0.5 dark:border-[#294737] dark:bg-[#182b21]"
          >
            {(
              [
                { id: 'landmarks', label: 'Struktury kostne', testId: 'bone-zone-mode-landmarks' },
                { id: 'attachments', label: 'Przyczepy PP/PK', testId: 'bone-zone-mode-attachments' },
                { id: 'off', label: 'Ukryj strefy', testId: 'bone-zone-mode-off' },
              ] as const
            ).map((modeTab) => (
              <button
                key={modeTab.id}
                type="button"
                data-testid={modeTab.testId}
                onClick={() => {
                  setBoneZoneMode(modeTab.id);
                  if (modeTab.id === 'off') {
                    setSelectedHotspot(null);
                  } else {
                    setIsolatedMusclePartId(null);
                    setLayerFilter('bone');
                  }
                }}
                className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-0.5 text-[11px] font-bold transition ${
                  boneZoneMode === modeTab.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-[#354c3f] hover:text-emerald-950 dark:text-[#c7dbcf] dark:hover:text-white'
                }`}
              >
                {modeTab.id === 'landmarks' && <MapPin className="h-3 w-3" />}
                <span>{modeTab.label}</span>
              </button>
            ))}
          </div>

          {isolatedMusclePartId && (
            <button
              type="button"
              data-testid="clear-isolated-muscle-btn"
              onClick={() => {
                setIsolatedMusclePartId(null);
                setLayerFilter('all');
              }}
              title="Wyłącz izolację pojedynczego mięśnia i pokaż wszystkie mięśnie"
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border border-b-3 border-emerald-700 bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-emerald-700 active:translate-y-0.5 active:border-b"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Pokaż wszystkie mięśnie</span>
            </button>
          )}

          {!selectedHotspot && effectiveSelectedId && Boolean(partLabelsById[effectiveSelectedId]) && (
            <button
              type="button"
              data-testid="cut-selected-structure-btn"
              onClick={() => {
                setHiddenPartIds((prev) =>
                  prev.includes(effectiveSelectedId) ? prev : [...prev, effectiveSelectedId],
                );
                onSelectPart(null);
              }}
              title="Wytnij / ukryj zaznaczoną strukturę, aby odsłonić głębsze warstwy"
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border border-b-3 border-amber-600 bg-amber-500 px-2 py-1 text-[11px] font-bold text-white transition hover:bg-amber-600 active:translate-y-0.5 active:border-b"
            >
              <EyeOff className="h-3.5 w-3.5" />
              <span>Ukryj warstwę</span>
            </button>
          )}

          {hiddenPartIds.length > 0 && (
            <button
              type="button"
              data-testid="hidden-parts-toggle-btn"
              onClick={() => {
                setShowHiddenPanel((prev) => {
                  const next = !prev;
                  if (next) setSelectedHotspot(null);
                  return next;
                });
              }}
              className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border border-b-3 px-2 py-1 text-[11px] font-bold transition ${
                showHiddenPanel
                  ? 'border-emerald-700 bg-emerald-600 text-white'
                  : 'border-[#c2d8ca] bg-white text-[#26382e] hover:bg-[#f4faf6] dark:border-[#294737] dark:bg-[#182b21] dark:text-[#e6f2ea]'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Ukryte ({hiddenPartIds.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => sceneRefs.current.resetCamera()}
            title="Resetuj kamerę"
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border border-b-3 border-[#c2d8ca] bg-white px-2 py-1 text-[11px] font-bold text-[#26382e] transition hover:bg-[#f4faf6] active:translate-y-0.5 active:border-b dark:border-[#294737] dark:bg-[#182b21] dark:text-[#e6f2ea] dark:hover:bg-[#233d2f]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Resetuj widok</span>
          </button>

          <button
            type="button"
            data-testid="toggle-fullscreen-3d-btn"
            onClick={() => setIsFullscreen((prev) => !prev)}
            title={isFullscreen ? 'Wyjdź z pełnego ekranu (Esc)' : 'Powiększ model 3D na pełny ekran'}
            className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border border-b-3 px-2 py-1 text-[11px] font-bold transition active:translate-y-0.5 active:border-b ${
              isFullscreen
                ? 'border-emerald-700 bg-emerald-600 text-white'
                : 'border-[#c2d8ca] bg-white text-[#26382e] hover:bg-[#f4faf6] dark:border-[#294737] dark:bg-[#182b21] dark:text-[#e6f2ea] dark:hover:bg-[#233d2f]'
            }`}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Zamknij' : 'Pełny ekran'}</span>
          </button>
        </div>
      </div>

      <div
        className={`relative w-full ${
          isFullscreen ? 'min-h-0 flex-1' : heightClassName
        } bg-[#111c18] dark:bg-[#0a1410]`}
      >
        {/* Dedicated WebGL Mount Container */}
        <div
          ref={mountRef}
          data-testid="three-viewport-canvas"
          className="h-full w-full touch-none select-none"
        />

        {/* Hover structure tag */}
        {hoveredName && (
          <div className="pointer-events-none absolute top-3 left-3 z-10 inline-flex items-center rounded-lg border border-emerald-500/30 bg-[#0a1410]/90 px-2.5 py-1 text-xs font-semibold text-amber-300 shadow">
            {hoveredName}
          </div>
        )}

        {/* Discreet Floating Zoom Controls (+ / −) */}
        <div
          data-testid="viewport-zoom-controls"
          className="absolute bottom-3 left-3 z-10 flex flex-col overflow-hidden rounded-xl border border-emerald-500/35 bg-[#0a1410]/85 shadow-lg backdrop-blur-md"
        >
          <button
            type="button"
            data-testid="viewport-zoom-in"
            onClick={() => sceneRefs.current.zoomBy(0.72)}
            title="Przybliż widok (lub użyj rolki myszy / gestu szczypania)"
            aria-label="Przybliż model 3D"
            className="flex h-9 w-9 items-center justify-center text-emerald-100 transition hover:bg-emerald-600/40 active:bg-emerald-600/60"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <div className="h-px bg-emerald-500/25" />
          <button
            type="button"
            data-testid="viewport-zoom-out"
            onClick={() => sceneRefs.current.zoomBy(1.38)}
            title="Oddal widok (lub użyj rolki myszy / gestu szczypania)"
            aria-label="Oddal model 3D"
            className="flex h-9 w-9 items-center justify-center text-emerald-100 transition hover:bg-emerald-600/40 active:bg-emerald-600/60"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
        </div>

        {/* Active Dermatome / Myotome Banner */}
        {dermatomeHighlight && !dermatomeHighlight.maskedLabel && (() => {
          const dLvl = getDermatomeLevelById(dermatomeHighlight.rootId);
          if (!dLvl) return null;
          return (
            <div
              data-testid="dermatome-highlight-banner"
              className="absolute top-3 left-3 z-20 flex max-w-[calc(100%-6rem)] items-center gap-2 rounded-xl border-2 border-emerald-400/80 bg-[#0a1410]/92 px-3 py-1.5 text-xs font-bold text-emerald-100 shadow-lg backdrop-blur-md"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: dLvl.accentHex }}
              />
              <span className="truncate">
                {dLvl.labelPl} •{' '}
                {dermatomeHighlight.mode === 'dermatome'
                  ? 'Dermatom (skóra)'
                  : dermatomeHighlight.mode === 'myotome'
                    ? 'Miotom (mięśnie)'
                    : 'Dermatom + Miotom'}
              </span>
              {onClearDermatomeHighlight && (
                <button
                  type="button"
                  data-testid="clear-dermatome-highlight-btn"
                  onClick={onClearDermatomeHighlight}
                  aria-label="Wyłącz mapę dermatomu"
                  className="ml-1 rounded-md p-0.5 text-emerald-200 transition hover:bg-emerald-400/20 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })()}

        {/* Active Clinical Test 3D Visualizer Banner */}
        {!dermatomeHighlight && clinicalTestHighlight && (
          <div
            data-testid="clinical-test-highlight-banner"
            className="absolute top-3 left-3 z-20 flex max-w-[calc(100%-6rem)] items-center gap-2 rounded-xl border-2 border-emerald-400/80 bg-[#0a1410]/92 px-3 py-1.5 text-xs font-bold text-emerald-100 shadow-lg backdrop-blur-md"
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400" />
            <span className="truncate">
              Test 3D: {clinicalTestHighlight.testNamePl} ({clinicalTestHighlight.structureIds.length} struktur)
            </span>
            {onClearClinicalTestHighlight && (
              <button
                type="button"
                data-testid="clear-clinical-test-highlight-btn"
                onClick={onClearClinicalTestHighlight}
                aria-label="Wyłącz wizualizację testu klinicznego"
                className="ml-1 rounded-md p-0.5 text-emerald-200 transition hover:bg-emerald-400/20 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Active Clinical Nerve -> Innervated Muscles Banner */}
        {!dermatomeHighlight && !clinicalTestHighlight && clinicalNerveHighlight && (
          <div
            data-testid="clinical-nerve-highlight-banner"
            className="absolute top-3 left-3 z-20 flex max-w-[calc(100%-6rem)] items-center gap-2 rounded-xl border-2 border-amber-400/80 bg-[#0a1410]/92 px-3 py-1.5 text-xs font-bold text-amber-200 shadow-lg backdrop-blur-md"
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" />
            <span className="truncate">
              Unerwienie: {clinicalNerveHighlight.nerveNamePl} → podświetlone mięśnie (
              {clinicalNerveHighlight.muscleIds.length})
            </span>
            {onClearClinicalNerveHighlight && (
              <button
                type="button"
                data-testid="clear-clinical-nerve-highlight-btn"
                onClick={onClearClinicalNerveHighlight}
                aria-label="Wyłącz podświetlenie unerwienia"
                className="ml-1 rounded-md p-0.5 text-amber-200 transition hover:bg-amber-400/20 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Active Biomechanics 3D Banner (hidden during quiz answering when maskedLabel is true) */}
        {!dermatomeHighlight &&
          !clinicalTestHighlight &&
          !clinicalNerveHighlight &&
          biomechanicsHighlight &&
          !biomechanicsHighlight.maskedLabel &&
          (() => {
            const bMove = getMovementById(biomechanicsHighlight.movementId);
            if (!bMove) return null;
            return (
              <div
                data-testid="biomechanics-highlight-banner"
                className="absolute top-3 left-3 z-20 flex max-w-[calc(100%-6rem)] flex-wrap items-center gap-2 rounded-xl border-2 border-emerald-400/80 bg-[#0a1410]/92 px-3 py-1.5 text-xs font-bold text-emerald-100 shadow-lg backdrop-blur-md"
              >
                <span className="truncate">
                  {bMove.namePl} • {bMove.sftrCode}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold">
                  {biomechanicsHighlight.showAgonists && (
                    <span className="inline-flex items-center gap-1 text-emerald-300">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      Agon.
                    </span>
                  )}
                  {biomechanicsHighlight.showSynergists && (
                    <span className="inline-flex items-center gap-1 text-amber-300">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      Syn.
                    </span>
                  )}
                  {biomechanicsHighlight.showAntagonists && (
                    <span className="inline-flex items-center gap-1 text-rose-300">
                      <span className="h-2 w-2 rounded-full bg-rose-400" />
                      Antag.
                    </span>
                  )}
                </span>
                {onClearBiomechanicsHighlight && (
                  <button
                    type="button"
                    data-testid="clear-biomechanics-highlight-btn"
                    onClick={onClearBiomechanicsHighlight}
                    aria-label="Wyłącz wizualizację biomechaniki 3D"
                    className="ml-0.5 rounded-md p-0.5 text-emerald-200 transition hover:bg-emerald-400/20 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })()}

        {/* Collapsible 3D Clipping Plane Panel */}
        {showClippingPanel && (
          <div
            data-testid="clipping-panel"
            className="absolute top-3 right-3 z-30 w-72 max-w-[calc(100%-1.5rem)] rounded-2xl border-2 border-emerald-600 bg-white/95 p-3.5 shadow-2xl backdrop-blur-md sm:w-80 dark:border-emerald-700 dark:bg-[#112018]/95"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#d6e7dc] pb-2 dark:border-[#233d2f]">
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#16291f] dark:text-[#e6f2ea]">
                <Scissors className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Przekrój anatomiczny 3D</span>
              </span>
              <button
                type="button"
                onClick={() => setShowClippingPanel(false)}
                aria-label="Zamknij panel przekroju"
                className="rounded-lg p-1 text-[#6b8274] hover:bg-[#f4faf6] hover:text-[#16291f] dark:hover:bg-[#182b21] dark:hover:text-[#e6f2ea]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'off', label: 'Wyłączony' },
                  { id: 'axial', label: 'Poprzeczny (Osiowy)' },
                  { id: 'sagittal', label: 'Strzałkowy' },
                  { id: 'coronal', label: 'Czołowy' },
                ] as Array<{ id: ClippingPlaneAxis; label: string }>
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  data-testid={`clipping-axis-${opt.id}`}
                  onClick={() =>
                    setClippingState((prev) => ({
                      ...prev,
                      axis: opt.id,
                    }))
                  }
                  className={`rounded-xl border px-2.5 py-1.5 text-left text-[11px] font-extrabold transition ${
                    clippingState.axis === opt.id
                      ? 'border-emerald-600 bg-emerald-500 text-white'
                      : 'border-[#d6e7dc] bg-[#f4faf6] text-[#26382e] hover:border-emerald-400 dark:border-[#294737] dark:bg-[#182b21] dark:text-[#e6f2ea]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {clippingState.axis !== 'off' && (
              <div className="mt-3 space-y-2.5 border-t border-[#e6f0ea] pt-2.5 dark:border-[#233d2f]">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#16291f] dark:text-emerald-100">
                    <span>Głębokość przekroju</span>
                    <span className="font-mono-tabular text-emerald-700 dark:text-emerald-300">
                      {Math.round(clippingState.depth * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    data-testid="clipping-depth-slider"
                    min={5}
                    max={95}
                    step={1}
                    value={Math.round(clippingState.depth * 100)}
                    onChange={(e) => {
                      const nextDepth = Number(e.target.value) / 100;
                      setClippingState((prev) => ({ ...prev, depth: nextDepth }));
                    }}
                    className="mt-1.5 w-full accent-emerald-600"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    data-testid="clipping-invert-btn"
                    onClick={() =>
                      setClippingState((prev) => ({ ...prev, inverted: !prev.inverted }))
                    }
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#c2d8ca] bg-[#f4faf6] px-2.5 py-1.5 text-[11px] font-bold text-[#26382e] transition hover:border-emerald-500 dark:border-[#294737] dark:bg-[#182b21] dark:text-[#e6f2ea]"
                  >
                    <FlipHorizontal2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Odwróć stronę</span>
                  </button>
                  <button
                    type="button"
                    data-testid="clipping-reset-btn"
                    onClick={() =>
                      setClippingState({ axis: 'off', depth: 0.5, inverted: false })
                    }
                    className="rounded-xl border border-[#c2d8ca] bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#52695b] transition hover:border-rose-400 hover:text-rose-700 dark:border-[#294737] dark:bg-[#182b21] dark:text-[#94b0a0]"
                  >
                    Wyłącz
                  </button>
                </div>

                <p className="text-[10px] leading-snug text-[#52695b] dark:text-[#94b0a0]">
                  Możesz klikać odsłonięte narządy i głębokie struktury bezpośrednio wewnątrz przekroju.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Collapsible Anatomical Systems Layers Panel */}
        {showLayersPanel && (
          <div
            data-testid="anatomy-layers-panel"
            className="absolute top-3 right-3 z-30 w-72 max-w-[calc(100%-1.5rem)] rounded-2xl border-2 border-emerald-600 bg-white/95 p-3.5 shadow-2xl backdrop-blur-md sm:w-80 dark:border-emerald-700 dark:bg-[#112018]/95"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#d6e7dc] pb-2 dark:border-[#233d2f]">
              <span className="text-xs font-extrabold text-[#16291f] dark:text-[#e6f2ea]">
                Układy anatomiczne 3D
              </span>
              <button
                type="button"
                onClick={() => setShowLayersPanel(false)}
                aria-label="Zamknij panel warstw"
                className="rounded-lg p-1 text-[#6b8274] hover:bg-[#f4faf6] hover:text-[#16291f] dark:hover:bg-[#182b21] dark:hover:text-[#e6f2ea]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Quick System Presets */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                data-testid="layers-preset-all-internal"
                onClick={() => {
                  setIsolatedMusclePartId(null);
                  setLayerFilter('all');
                  setVisibleLayers(createDefaultLayerVisibility(true));
                }}
                className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-extrabold text-white transition hover:bg-emerald-700"
              >
                Wszystkie wewnętrzne
              </button>
              <button
                type="button"
                data-testid="layers-preset-locomotor"
                onClick={() => {
                  setIsolatedMusclePartId(null);
                  setLayerFilter('all');
                  setVisibleLayers({
                    bone: true,
                    cartilage: true,
                    muscle: true,
                    bursa: true,
                    tendon: true,
                    ligament: true,
                    artery: false,
                    vein: false,
                    nerve: false,
                    organ: false,
                    skin: false,
                  });
                }}
                className="rounded-lg border border-[#c2d8ca] bg-[#f4faf6] px-2 py-1 text-[10px] font-bold text-[#26382e] hover:border-emerald-500 dark:border-[#294737] dark:bg-[#182b21] dark:text-[#e6f2ea]"
              >
                Układ ruchu
              </button>
              <button
                type="button"
                data-testid="layers-preset-neurovascular"
                onClick={() => {
                  setIsolatedMusclePartId(null);
                  setLayerFilter('all');
                  setVisibleLayers({
                    bone: true,
                    cartilage: true,
                    muscle: false,
                    bursa: false,
                    tendon: false,
                    ligament: false,
                    artery: true,
                    vein: true,
                    nerve: true,
                    organ: false,
                    skin: false,
                  });
                }}
                className="rounded-lg border border-[#c2d8ca] bg-[#f4faf6] px-2 py-1 text-[10px] font-bold text-[#26382e] hover:border-emerald-500 dark:border-[#294737] dark:bg-[#182b21] dark:text-[#e6f2ea]"
              >
                Kości + Naczynia/Nerwy
              </button>
            </div>

            {/* Per-System Toggle List */}
            <div className="mt-2.5 max-h-64 space-y-1 overflow-y-auto pr-1">
              {ANATOMY_LAYERS_META.map((layer) => {
                const meshCount = layerMeshCounts[layer.id] ?? 0;
                const isAvailable = meshCount > 0;
                const isChecked = layerFilter === 'all' && !isolatedMusclePartId && visibleLayers[layer.id];
                return (
                  <label
                    key={layer.id}
                    data-testid={`layer-toggle-${layer.id}`}
                    className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 text-xs transition ${
                      !isAvailable
                        ? 'cursor-not-allowed border-transparent opacity-45'
                        : isChecked
                          ? 'border-emerald-300 bg-emerald-50/80 font-bold text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-100'
                          : 'border-[#e6f0ea] bg-[#f4faf6] font-medium text-[#354c3f] hover:border-emerald-400 dark:border-[#233d2f] dark:bg-[#182b21] dark:text-[#c7dbcf]'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <input
                        type="checkbox"
                        disabled={!isAvailable}
                        checked={isAvailable && isChecked}
                        onChange={() => {
                          setIsolatedMusclePartId(null);
                          setLayerFilter('all');
                          setVisibleLayers((prev) => ({
                            ...prev,
                            [layer.id]: !prev[layer.id],
                          }));
                        }}
                        className="h-3.5 w-3.5 accent-emerald-600"
                      />
                      <span
                        className="h-3 w-3 shrink-0 rounded-full border border-black/20 shadow-xs"
                        style={{ backgroundColor: layer.swatchHex }}
                      />
                      <span className="truncate">{layer.labelPl}</span>
                    </span>
                    <span className="font-mono-tabular shrink-0 text-[10px] font-bold text-[#52695b] dark:text-[#94b0a0]">
                      {meshCount}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Skin Opacity Slider (active when skin layer is enabled) */}
            {(layerMeshCounts.skin ?? 0) > 0 && visibleLayers.skin && (
              <div
                data-testid="skin-opacity-control"
                className="mt-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5 dark:border-emerald-800 dark:bg-emerald-950/40"
              >
                <div className="flex items-center justify-between text-[11px] font-extrabold text-emerald-950 dark:text-emerald-200">
                  <span>Krycie powłok skórnych</span>
                  <span className="font-mono-tabular">{Math.round(skinOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  data-testid="skin-opacity-slider"
                  min={10}
                  max={100}
                  step={5}
                  value={Math.round(skinOpacity * 100)}
                  onChange={(e) => setSkinOpacity(Number(e.target.value) / 100)}
                  className="mt-1.5 w-full accent-emerald-600"
                />
                <div className="mt-1 text-[10px] font-medium text-[#354c3f] dark:text-[#94b0a0]">
                  {skinOpacity <= 0.75
                    ? 'Kliknięcia przenikają przez skórę do głębszych struktur.'
                    : 'Krycie >75%: powłoki skórne są klikalne.'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Hidden / Cut Structures Individual & Bulk Restore Panel */}
        {showHiddenPanel && hiddenPartIds.length > 0 && (
          <div
            data-testid="hidden-parts-restore-panel"
            className="absolute top-3 right-3 z-30 w-72 rounded-2xl border-2 border-emerald-600 bg-white/95 p-3 shadow-2xl backdrop-blur-md sm:w-80 dark:border-emerald-700 dark:bg-[#112018]/95"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#d6e7dc] pb-2 dark:border-[#233d2f]">
              <span className="text-xs font-extrabold text-[#16291f] dark:text-[#e6f2ea]">
                Ukryte struktury ({hiddenPartIds.length})
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  data-testid="restore-all-hidden-btn"
                  onClick={() => {
                    setHiddenPartIds([]);
                    setShowHiddenPanel(false);
                  }}
                  className="rounded-lg bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-emerald-700"
                >
                  Przywróć wszystkie
                </button>
                <button
                  type="button"
                  onClick={() => setShowHiddenPanel(false)}
                  className="rounded-lg p-1 text-[#6b8274] hover:bg-[#f4faf6] hover:text-[#16291f] dark:hover:bg-[#182b21] dark:hover:text-[#e6f2ea]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto pr-1">
              {hiddenPartIds.map((hiddenId) => (
                <li
                  key={hiddenId}
                  className="flex items-center justify-between gap-2 rounded-xl border border-[#d6e7dc] bg-[#f4faf6] px-2.5 py-1.5 text-xs dark:border-[#233d2f] dark:bg-[#182b21]"
                >
                  <span className="truncate font-semibold text-[#16291f] dark:text-[#e6f2ea]">
                    {partLabelsById[hiddenId] || hiddenId}
                  </span>
                  <button
                    type="button"
                    data-testid={`restore-hidden-${hiddenId}`}
                    onClick={() => {
                      setHiddenPartIds((prev) => {
                        const next = prev.filter((id) => id !== hiddenId);
                        if (next.length === 0) setShowHiddenPanel(false);
                        return next;
                      });
                    }}
                    className="shrink-0 rounded-lg border border-emerald-600 bg-white px-2 py-0.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500 dark:bg-[#112018] dark:text-emerald-300"
                  >
                    Przywróć
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Fallback notice when offline or GitHub CDN unavailable */}
        {fallbackNotice && !loadingModel && (
          <div className="pointer-events-none absolute top-3 right-3 z-10 max-w-xs rounded-xl bg-amber-900/90 px-3 py-1.5 text-[11px] font-semibold text-amber-100 shadow">
            {fallbackNotice}
          </div>
        )}

        {/* Interactive Bony Landmark & Muscle Attachment Hotspot Detail Card */}
        {!hideHotspotOverlay && selectedHotspot && (
          <div
            data-testid="hotspot-detail-card"
            className="absolute right-3 bottom-3 z-30 max-w-sm rounded-2xl border-2 border-emerald-500 bg-white/95 p-4 shadow-2xl backdrop-blur-md dark:border-emerald-600 dark:bg-[#112018]/95"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block rounded-lg px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                      selectedHotspot.type === 'pp'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : selectedHotspot.type === 'pk'
                          ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {selectedHotspot.type === 'pp'
                      ? 'PP • Przyczep początkowy'
                      : selectedHotspot.type === 'pk'
                        ? 'PK • Przyczep końcowy'
                        : 'Punkt kostny'}
                  </span>
                </div>
                <h4 className="mt-1 text-sm font-black text-[#16291f] dark:text-[#e6f2ea]">
                  {selectedHotspot.bilingualName ||
                    formatBilingualName(selectedHotspot.namePl, selectedHotspot.nameEn)}
                </h4>
                <p className="text-xs font-semibold text-[#52695b] dark:text-[#94b0a0]">
                  {selectedHotspot.nameEn}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHotspot(null)}
                className="rounded-lg p-1 text-[#6b8274] hover:bg-[#f4faf6] hover:text-[#16291f] dark:hover:bg-[#182b21] dark:hover:text-[#e6f2ea]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {selectedHotspot.attachedMuscles && selectedHotspot.attachedMuscles.length > 0 && (
              <div className="mt-2.5">
                <span className="text-[11px] font-extrabold text-[#26382e] dark:text-[#c7dbcf]">
                  Przyczepione mięśnie / struktury (kliknij, aby podświetlić):
                </span>
                <ul className="mt-1 space-y-1 text-xs text-[#354c3f] dark:text-[#c7dbcf]">
                  {selectedHotspot.attachedMuscles.map((m, idx) => (
                    <li key={idx}>
                      <button
                        type="button"
                        data-testid={`hotspot-attached-muscle-${idx}`}
                        onClick={() =>
                          isolateAttachedMuscleByText(
                            m,
                            (selectedHotspot as BonyLandmarkExtended).side,
                          )
                        }
                        className="flex w-full items-center gap-1.5 rounded-lg px-1.5 py-0.5 text-left font-medium transition hover:bg-emerald-50 hover:text-emerald-800 dark:hover:bg-[#182b21] dark:hover:text-emerald-300"
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                        <span className="underline decoration-emerald-500/40 underline-offset-2">
                          {m}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedHotspot.clinicalNotes && (
              <div className="mt-2.5 rounded-xl border border-[#d6e7dc] bg-[#f4faf6] p-2.5 text-xs text-[#26382e] dark:border-[#233d2f] dark:bg-[#0b1510] dark:text-[#c7dbcf]">
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  Klinika & Palpacja:{' '}
                </span>
                {selectedHotspot.clinicalNotes}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-[#d6e7dc] pt-2 text-[10px] text-[#6b8274] dark:border-[#233d2f]">
              <span>Atlas Nettera • anatomik.pl</span>
              <button
                type="button"
                onClick={() => sceneRefs.current.focusHotspot?.(selectedHotspot)}
                className="font-bold text-emerald-600 hover:underline dark:text-emerald-400"
              >
                Skup kamerę na punkcie
              </button>
            </div>
          </div>
        )}

        {loadingModel && (
          <div
            data-testid="three-loading-overlay"
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-[#0a1410]/80 text-sm font-bold text-white"
          >
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-emerald-400 border-t-transparent" />
            <span>Pobieranie i dekompresja modelu 3D...</span>
          </div>
        )}

        {webglError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-[#f4faf6] p-6 text-center dark:bg-[#112018]">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <p className="text-sm font-semibold text-[#16291f] dark:text-[#e6f2ea]">{webglError}</p>
          </div>
        )}
      </div>
    </div>
    );
  },
);

AnatomyViewport3D.displayName = 'AnatomyViewport3D';
