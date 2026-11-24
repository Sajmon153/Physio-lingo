import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Compass,
  Crosshair,
  Eye,
  Focus,
  Info,
  Layers,
  MapPin,
  Search,
  Sparkles,
  Stethoscope,
  X,
  Zap,
} from 'lucide-react';
import { ANATOMY_MAP } from '../data/anatomyDb';
import {
  BIOMECHANICS_JOINT_GROUPS,
  BIOMECHANICS_MOVEMENTS,
  getMovementById,
  getMovementsForMuscle,
  type JointBiomechanicsGroup,
  type JointMovementProfile,
} from '../data/biomechanicsDb';
import { BONY_LANDMARKS, type BonyLandmarkExtended } from '../data/bonyLandmarks';
import {
  CLINICAL_TEST_MAP,
  CLINICAL_TESTS_DB,
  type ClinicalTestCategory,
  type ClinicalTestEntry,
} from '../data/clinicalTestsDb';
import {
  DERMATOME_MYOTOME_LEVELS,
  getDermatomeLevelById,
  type DermatomeMyotomeLevel,
} from '../data/dermatomesMyotomes';
import {
  getNerveProfileForMesh,
  getNervesForMuscle,
  type ClinicalNerveProfile,
} from '../data/nerveMuscleMap';
import { formatBilingualName } from '../three/anatomyTranslator';
import { getMuscleAttachmentZones } from '../three/boneSurfaceZones';
import {
  AnatomicalStructure,
  BiomechanicsHighlightState,
  ClinicalNerveHighlight,
  ClinicalTestHighlightState,
  DermatomeDisplayMode,
  DermatomeHighlightState,
  DeviceViewMode,
  StructureCategory,
} from '../types/anatomy';
import { getStructureDetailLabels, normalizeAnatomyAnswer } from '../utils/gameLogic';
import { SelectableMeshMeta } from '../three/proceduralModels';
import {
  AnatomyViewport3D,
  AnatomyViewport3DHandle,
  SelectedPartInfo,
  ViewportModelMode,
} from './AnatomyViewport3D';

export interface ExplorerJumpTarget {
  region: ViewportModelMode;
  structureId?: string;
  landmarkId?: string;
  clinicalTestId?: string;
  isolateIfMuscle?: boolean;
  requestId: number;
}

interface Explorer3DViewProps {
  initialRegion: ViewportModelMode;
  initialTarget?: ExplorerJumpTarget | null;
  isDarkMode: boolean;
  deviceMode?: DeviceViewMode;
}

type ExplorerRegionKey =
  | 'head_neck'
  | 'torso'
  | 'upper_limb_right'
  | 'upper_limb_left'
  | 'lower_limb_right'
  | 'lower_limb_left'
  | 'full_body';

const EXPLORER_REGION_OPTIONS: Array<{
  id: ExplorerRegionKey;
  label: string;
  modelUrl: string;
  testId: string;
}> = [
  {
    id: 'head_neck',
    label: 'Głowa i szyja',
    modelUrl: '/models/regional/head_neck.glb',
    testId: 'explorer-region-head-neck',
  },
  {
    id: 'torso',
    label: 'Tułów',
    modelUrl: '/models/regional/torso.glb',
    testId: 'explorer-region-torso',
  },
  {
    id: 'upper_limb_right',
    label: 'Kończyna górna prawa',
    modelUrl: '/models/regional/upper_limb_right.glb',
    testId: 'explorer-region-upper-limb-right',
  },
  {
    id: 'upper_limb_left',
    label: 'Kończyna górna lewa',
    modelUrl: '/models/regional/upper_limb_left.glb',
    testId: 'explorer-region-upper-limb-left',
  },
  {
    id: 'lower_limb_right',
    label: 'Kończyna dolna prawa',
    modelUrl: '/models/regional/lower_limb_right.glb',
    testId: 'explorer-region-lower-limb-right',
  },
  {
    id: 'lower_limb_left',
    label: 'Kończyna dolna lewa',
    modelUrl: '/models/regional/lower_limb_left.glb',
    testId: 'explorer-region-lower-limb-left',
  },
  {
    id: 'full_body',
    label: 'Całe ciało (Wszystkie układy 3D)',
    modelUrl: '/models/body.glb',
    testId: 'explorer-region-full',
  },
];

function normalizeExplorerRegion(input: ViewportModelMode): ExplorerRegionKey {
  switch (input) {
    case 'head_neck':
      return 'head_neck';
    case 'torso':
    case 'spine_thorax':
    case 'pelvis_hip':
    case 'visceral' as ViewportModelMode:
      return 'torso';
    case 'upper_limb_left':
      return 'upper_limb_left';
    case 'shoulder':
    case 'upper_limb':
    case 'upper_limb_right':
      return 'upper_limb_right';
    case 'lower_limb_left':
      return 'lower_limb_left';
    case 'knee':
    case 'lower_limb':
    case 'lower_limb_right':
      return 'lower_limb_right';
    case 'full_body':
    default:
      return 'full_body';
  }
}

function getPartNameEn(part: { nameEn?: string; structureId?: string }): string | undefined {
  if (part.nameEn && part.nameEn.trim()) return part.nameEn.trim();
  if (part.structureId && ANATOMY_MAP[part.structureId]?.nameEn) {
    return ANATOMY_MAP[part.structureId].nameEn;
  }
  return undefined;
}

function getPartBilingualLabel(part: {
  namePl: string;
  nameEn?: string;
  bilingualName?: string;
  structureId?: string;
}): string {
  const en = getPartNameEn(part);
  if (en) return formatBilingualName(part.namePl, en);
  if (part.bilingualName && part.bilingualName.trim()) return part.bilingualName.trim();
  return part.namePl;
}

function getCategoryLabel(cat?: StructureCategory): string {
  switch (cat) {
    case 'bone':
      return 'Kość / Punkt kostny';
    case 'joint_ligament':
      return 'Staw / Chrząstka / Więzadło';
    case 'muscle':
      return 'Mięsień';
    case 'bursa':
      return 'Kaletka maziowa';
    case 'tendon':
      return 'Ścięgno / Pochewka / Rozcięgno';
    case 'ligament':
      return 'Więzadło / Torebka stawowa';
    case 'artery':
      return 'Tętnica';
    case 'vein':
      return 'Żyła / Zatoka żylna';
    case 'nerve':
      return 'Nerw / Układ nerwowy';
    case 'organ':
      return 'Narząd wewnętrzny';
    case 'skin':
      return 'Powłoka skórna / Okolica ciała';
    default:
      return 'Struktura anatomiczna';
  }
}

function getRegionBadgeLabel(region?: string): string {
  switch (region) {
    case 'shoulder':
      return 'Kompleks barkowy';
    case 'knee':
      return 'Staw kolanowy';
    case 'head_neck':
      return 'Głowa i szyja';
    case 'torso':
      return 'Tułów';
    case 'spine_thorax':
      return 'Kręgosłup i klatka';
    case 'pelvis_hip':
      return 'Miednica i biodro';
    case 'upper_limb':
      return 'Kończyna górna';
    case 'upper_limb_right':
      return 'Kończyna górna prawa';
    case 'upper_limb_left':
      return 'Kończyna górna lewa';
    case 'lower_limb':
      return 'Kończyna dolna';
    case 'lower_limb_right':
      return 'Kończyna dolna prawa';
    case 'lower_limb_left':
      return 'Kończyna dolna lewa';
    case 'full_body':
    default:
      return 'Całe ciało';
  }
}

function getTissueBadge(part: SelectedPartInfo, entry: AnatomicalStructure | null): string {
  const cat = entry?.category ?? part.category;
  if (cat === 'artery' || part.layerId === 'artery') return 'Układ tętniczy';
  if (cat === 'vein' || part.layerId === 'vein') return 'Układ żylny';
  if (cat === 'nerve' || part.layerId === 'nerve') return 'Układ nerwowy';
  if (cat === 'organ' || part.layerId === 'organ') return 'Narządy wewnętrzne';
  if (cat === 'bursa' || part.layerId === 'bursa') return 'Kaletki maziowe';
  if (cat === 'tendon' || part.layerId === 'tendon') return 'Ścięgna i pochewki';
  if (cat === 'ligament' || part.layerId === 'ligament') return 'Aparat więzadłowy';
  if (cat === 'skin' || part.layerId === 'skin') return 'Powłoki skórne';
  if (cat === 'muscle' || part.tissueType === 'muscle') return 'Układ mięśniowy';
  if (cat === 'bone' || part.tissueType === 'bone') return 'Układ szkieletowy';
  return 'Aparat więzadłowo-stawowy';
}

export const Explorer3DView: React.FC<Explorer3DViewProps> = ({
  initialRegion,
  initialTarget = null,
  isDarkMode,
  deviceMode = 'auto',
}) => {
  const [region, setRegion] = useState<ExplorerRegionKey>(() =>
    normalizeExplorerRegion(initialTarget?.region ?? initialRegion),
  );
  const [selectedPart, setSelectedPart] = useState<SelectedPartInfo | null>(null);
  const [sceneParts, setSceneParts] = useState<SelectableMeshMeta[]>([]);
  const [sceneLandmarks, setSceneLandmarks] = useState<BonyLandmarkExtended[]>([]);
  const [isolatedMusclePartId, setIsolatedMusclePartId] = useState<string | null>(null);
  const [clinicalNerveHighlight, setClinicalNerveHighlight] =
    useState<ClinicalNerveHighlight | null>(null);
  const [dermatomeHighlight, setDermatomeHighlight] =
    useState<DermatomeHighlightState | null>(null);
  const [biomechanicsHighlight, setBiomechanicsHighlight] =
    useState<BiomechanicsHighlightState | null>(null);
  const [showBiomechanicsPanel, setShowBiomechanicsPanel] = useState(false);
  const [biomechanicsJointFilter, setBiomechanicsJointFilter] =
    useState<JointBiomechanicsGroup>('shoulder');
  const [clinicalTestHighlight, setClinicalTestHighlight] =
    useState<ClinicalTestHighlightState | null>(() => {
      if (initialTarget?.clinicalTestId) {
        const t = CLINICAL_TEST_MAP[initialTarget.clinicalTestId];
        if (t) {
          return { testId: t.id, testNamePl: t.namePl, structureIds: t.structureIds };
        }
      }
      return null;
    });
  const [showDermatomePanel, setShowDermatomePanel] = useState(false);
  const [showClinicalTestPanel, setShowClinicalTestPanel] = useState(false);
  const [clinicalTestQuery, setClinicalTestQuery] = useState('');
  const [clinicalTestCategoryFilter, setClinicalTestCategoryFilter] = useState<
    ClinicalTestCategory | 'all'
  >('all');
  const [quickQuery, setQuickQuery] = useState('');
  const [modelLoadedRegion, setModelLoadedRegion] = useState<ExplorerRegionKey | null>(null);

  const viewportRef = useRef<AnatomyViewport3DHandle>(null);
  const pendingJumpRef = useRef<ExplorerJumpTarget | null>(initialTarget);

  useEffect(() => {
    if (initialTarget) {
      if (initialTarget.clinicalTestId) {
        const testEntry = CLINICAL_TEST_MAP[initialTarget.clinicalTestId];
        if (testEntry) {
          pendingJumpRef.current = null;
          setDermatomeHighlight(null);
          setClinicalNerveHighlight(null);
          setIsolatedMusclePartId(null);
          setSelectedPart(null);
          setClinicalTestHighlight({
            testId: testEntry.id,
            testNamePl: testEntry.namePl,
            structureIds: testEntry.structureIds,
          });
          const nextReg = normalizeExplorerRegion(initialTarget.region);
          if (nextReg !== region) {
            setModelLoadedRegion(null);
            setRegion(nextReg);
          }
          return;
        }
      }

      setDermatomeHighlight(null);
      setClinicalTestHighlight(null);
      pendingJumpRef.current = initialTarget;
      const nextReg = normalizeExplorerRegion(initialTarget.region);
      if (nextReg !== region) {
        setModelLoadedRegion(null);
        setRegion(nextReg);
        setSelectedPart(null);
        setIsolatedMusclePartId(null);
      } else if (modelLoadedRegion === nextReg) {
        viewportRef.current?.selectAndFocusTarget?.({
          structureId: initialTarget.structureId,
          landmarkId: initialTarget.landmarkId,
          isolateIfMuscle: initialTarget.isolateIfMuscle ?? true,
        });
        pendingJumpRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTarget?.requestId]);

  useEffect(() => {
    if (initialTarget) return;
    setRegion(normalizeExplorerRegion(initialRegion));
    setSelectedPart(null);
    setIsolatedMusclePartId(null);
  }, [initialRegion, initialTarget]);

  const handleViewportLoaded = useCallback(() => {
    setModelLoadedRegion(region);
    const pending = pendingJumpRef.current;
    if (pending) {
      pendingJumpRef.current = null;
      window.setTimeout(() => {
        viewportRef.current?.selectAndFocusTarget?.({
          structureId: pending.structureId,
          landmarkId: pending.landmarkId,
          isolateIfMuscle: pending.isolateIfMuscle ?? true,
        });
      }, 60);
    }
  }, [region]);

  const activeRegionOption = useMemo(
    () => EXPLORER_REGION_OPTIONS.find((opt) => opt.id === region) ?? EXPLORER_REGION_OPTIONS[0],
    [region],
  );

  const selectedEntry = useMemo(() => {
    if (!selectedPart?.structureId) return null;
    return ANATOMY_MAP[selectedPart.structureId] ?? null;
  }, [selectedPart]);

  const selectedLandmarkEntry = useMemo(() => {
    if (!selectedPart) return null;
    return (
      sceneLandmarks.find(
        (lm) =>
          lm.id === selectedPart.id ||
          (lm.structureId && lm.structureId === selectedPart.structureId),
      ) ??
      BONY_LANDMARKS.find(
        (lm) =>
          lm.id === selectedPart.id ||
          (lm.structureId && lm.structureId === selectedPart.structureId),
      ) ??
      null
    );
  }, [selectedPart, sceneLandmarks]);

  const isSelectedMuscle = Boolean(
    selectedPart &&
      (selectedEntry?.category === 'muscle' ||
        selectedPart.category === 'muscle' ||
        selectedPart.tissueType === 'muscle'),
  );

  const muscleAttachmentZones = useMemo(() => {
    if (!isSelectedMuscle || !selectedPart) return { pp: [], pk: [] };
    const preferredSide =
      selectedPart.namePl && /\(strona\s+lewa\)/i.test(selectedPart.namePl)
        ? 'left'
        : selectedPart.namePl && /\(strona\s+prawa\)/i.test(selectedPart.namePl)
          ? 'right'
          : undefined;
    return getMuscleAttachmentZones(
      sceneLandmarks,
      selectedPart.structureId ?? null,
      selectedPart.namePl ?? null,
      preferredSide,
    );
  }, [isSelectedMuscle, selectedPart, sceneLandmarks]);

  const isThisMuscleIsolated = Boolean(
    selectedPart &&
      isolatedMusclePartId &&
      (isolatedMusclePartId === selectedPart.id ||
        (selectedPart.structureId && isolatedMusclePartId === selectedPart.structureId)),
  );

  const selectedSide = useMemo<'left' | 'right' | undefined>(() => {
    if (!selectedPart?.namePl) return undefined;
    if (/\(strona\s+lewa\)/i.test(selectedPart.namePl)) return 'left';
    if (/\(strona\s+prawa\)/i.test(selectedPart.namePl)) return 'right';
    return undefined;
  }, [selectedPart?.namePl]);

  const selectedNerveProfile = useMemo<ClinicalNerveProfile | null>(() => {
    if (!selectedPart) return null;
    const cat = selectedEntry?.category ?? selectedPart.category;
    if (cat !== 'nerve' && selectedPart.layerId !== 'nerve') return null;
    return getNerveProfileForMesh(selectedPart.structureId, selectedPart.rawMeshName || selectedPart.nameEn);
  }, [selectedPart, selectedEntry]);

  const selectedMuscleNerves = useMemo<ClinicalNerveProfile[]>(() => {
    if (!isSelectedMuscle || !selectedPart) return [];
    return getNervesForMuscle(selectedPart.structureId, selectedPart.rawMeshName || selectedPart.nameEn);
  }, [isSelectedMuscle, selectedPart]);

  const isSelectedNerveGroupHighlighted = Boolean(
    selectedNerveProfile &&
      clinicalNerveHighlight?.nerveStructureId === selectedNerveProfile.nerveStructureId,
  );

  const activateNerveMuscleHighlight = useCallback(
    (profile: ClinicalNerveProfile, preferredSide?: 'left' | 'right') => {
      viewportRef.current?.clearIsolatedMuscle?.();
      setDermatomeHighlight(null);
      setClinicalTestHighlight(null);
      setBiomechanicsHighlight(null);
      setClinicalNerveHighlight({
        nerveStructureId: profile.nerveStructureId,
        nerveNamePl: profile.nerveNamePl,
        muscleIds: profile.innervatedMuscleIds,
        side: preferredSide,
      });
    },
    [],
  );

  const activeDermatomeLevel = useMemo<DermatomeMyotomeLevel | null>(
    () => (dermatomeHighlight ? getDermatomeLevelById(dermatomeHighlight.rootId) : null),
    [dermatomeHighlight],
  );

  const activeBiomechanicsMovement = useMemo<JointMovementProfile | null>(
    () => (biomechanicsHighlight ? getMovementById(biomechanicsHighlight.movementId) : null),
    [biomechanicsHighlight],
  );

  const activeClinicalTest = useMemo<ClinicalTestEntry | null>(
    () => (clinicalTestHighlight ? CLINICAL_TEST_MAP[clinicalTestHighlight.testId] ?? null : null),
    [clinicalTestHighlight],
  );

  const selectedMuscleMovements = useMemo(
    () => (selectedEntry?.category === 'muscle' ? getMovementsForMuscle(selectedEntry.id) : []),
    [selectedEntry],
  );

  const filteredClinicalTests = useMemo(() => {
    const q = normalizeAnatomyAnswer(clinicalTestQuery.trim());
    return CLINICAL_TESTS_DB.filter((t) => {
      if (clinicalTestCategoryFilter !== 'all' && t.category !== clinicalTestCategoryFilter) {
        return false;
      }
      if (!q) return true;
      const hay = normalizeAnatomyAnswer(`${t.namePl} ${t.nameEn} ${t.targetSummary}`);
      return hay.includes(q);
    });
  }, [clinicalTestQuery, clinicalTestCategoryFilter]);

  const selectDermatomeRoot = useCallback(
    (level: DermatomeMyotomeLevel, modeOverride?: DermatomeDisplayMode) => {
      viewportRef.current?.clearIsolatedMuscle?.();
      setClinicalNerveHighlight(null);
      setClinicalTestHighlight(null);
      setBiomechanicsHighlight(null);
      setSelectedPart(null);
      const nextMode = modeOverride ?? dermatomeHighlight?.mode ?? 'both';
      const nextSide = dermatomeHighlight?.side ?? 'both';
      setDermatomeHighlight({
        rootId: level.id,
        mode: nextMode,
        side: nextSide,
      });
      const targetRegion = normalizeExplorerRegion(level.recommendedRegion);
      if (region !== 'full_body' && region !== targetRegion) {
        setModelLoadedRegion(null);
        setRegion(targetRegion);
      }
    },
    [dermatomeHighlight?.mode, dermatomeHighlight?.side, region],
  );

  const resolveRegionForClinicalTest = (test: ClinicalTestEntry): ExplorerRegionKey => {
    if (
      test.id === 'test_lasegue_slump' ||
      test.id === 'test_bragard' ||
      test.id === 'test_adson_wright_tos'
    ) {
      return 'full_body';
    }
    return normalizeExplorerRegion(test.region);
  };

  const selectClinicalTest3D = useCallback(
    (test: ClinicalTestEntry) => {
      viewportRef.current?.clearIsolatedMuscle?.();
      setClinicalNerveHighlight(null);
      setDermatomeHighlight(null);
      setBiomechanicsHighlight(null);
      setSelectedPart(null);
      setShowClinicalTestPanel(false);
      setClinicalTestHighlight({
        testId: test.id,
        testNamePl: test.namePl,
        structureIds: test.structureIds,
      });
      const targetRegion = resolveRegionForClinicalTest(test);
      if (targetRegion !== region) {
        setModelLoadedRegion(null);
        setRegion(targetRegion);
      }
    },
    [region],
  );

  const selectBiomechanicsMovement = useCallback(
    (movement: JointMovementProfile) => {
      viewportRef.current?.clearIsolatedMuscle?.();
      setClinicalNerveHighlight(null);
      setDermatomeHighlight(null);
      setClinicalTestHighlight(null);
      setSelectedPart(null);
      setBiomechanicsJointFilter(movement.jointGroup);
      setBiomechanicsHighlight((prev) => ({
        movementId: movement.id,
        side: prev?.side ?? movement.defaultSide,
        showAgonists: prev?.showAgonists ?? true,
        showSynergists: prev?.showSynergists ?? true,
        showAntagonists: prev?.showAntagonists ?? true,
        showPlaneHelper: prev?.showPlaneHelper ?? true,
      }));
      const targetRegion = normalizeExplorerRegion(movement.recommendedRegion);
      if (targetRegion !== region) {
        setModelLoadedRegion(null);
        setRegion(targetRegion);
      }
    },
    [region],
  );

  const quickJumpResults = useMemo(() => {
    const raw = quickQuery.trim();
    if (raw.length < 2) return [];
    const normQ = normalizeAnatomyAnswer(raw);
    const rawLower = raw.toLowerCase();

    type JumpItem = {
      key: string;
      kind: 'landmark' | 'mesh';
      label: string;
      badge: string;
      badgeTone: 'pp' | 'pk' | 'muscle' | 'bone';
      score: number;
      landmarkId?: string;
      partId?: string;
      structureId?: string;
      isMuscle?: boolean;
    };

    const items: JumpItem[] = [];
    const seen = new Set<string>();

    const matchesText = (text: string) =>
      text.toLowerCase().includes(rawLower) || normalizeAnatomyAnswer(text).includes(normQ);

    // 1. Search 3D scene meshes (muscles, bones, vessels, nerves, organs, bursae, tendons, ligaments)
    for (const part of sceneParts) {
      const dbEntry = part.structureId ? ANATOMY_MAP[part.structureId] : undefined;
      const primaryName = `${part.namePl} ${part.nameEn ?? ''}`;
      const secondaryText = `${dbEntry?.nameLt ?? ''} ${(dbEntry?.aliases || []).join(' ')}`;
      const directMatch = matchesText(primaryName);
      if (!directMatch && !matchesText(secondaryText)) {
        continue;
      }
      const cleanName = part.namePl.replace(/\s*\(strona\s+(prawa|lewa)\)/gi, '').trim().toLowerCase();
      const dedupKey = `mesh:${part.structureId || cleanName}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      const isMuscle = part.category === 'muscle' || dbEntry?.category === 'muscle';
      const resolvedCat = dbEntry?.category ?? part.category;
      const badgeText =
        resolvedCat === 'artery'
          ? 'Tętnica'
          : resolvedCat === 'vein'
            ? 'Żyła'
            : resolvedCat === 'nerve'
              ? 'Nerw'
              : resolvedCat === 'organ'
                ? 'Narząd'
                : resolvedCat === 'bursa'
                  ? 'Kaletka'
                  : resolvedCat === 'tendon'
                    ? 'Ścięgno'
                    : resolvedCat === 'ligament'
                      ? 'Więzadło'
                      : resolvedCat === 'skin'
                        ? 'Skóra'
                        : isMuscle
                          ? 'Mięsień'
                          : 'Kość / Staw';
      const exactStart =
        cleanName.startsWith(rawLower) ||
        normalizeAnatomyAnswer(cleanName).startsWith(normQ);
      const score =
        (directMatch ? 100 : 50) +
        (exactStart ? 25 : 0) +
        (dbEntry ? 15 : 0) +
        (isMuscle ? 5 : 0);
      items.push({
        key: part.id,
        kind: 'mesh',
        label: getPartBilingualLabel(part),
        badge: badgeText,
        badgeTone: resolvedCat === 'artery' || resolvedCat === 'organ' ? 'pp' : isMuscle ? 'muscle' : 'bone',
        score,
        partId: part.id,
        structureId: part.structureId,
        isMuscle,
      });
    }

    // 2. Search mounted 3D bony landmarks & PP/PK zones
    for (const lm of sceneLandmarks) {
      const primaryName = `${lm.namePl} ${lm.nameEn ?? ''}`;
      const secondaryText = `${lm.boneNamePl ?? ''} ${(lm.attachedMuscles || []).join(' ')}`;
      const directMatch = matchesText(primaryName);
      if (!directMatch && !matchesText(secondaryText)) {
        continue;
      }
      const dedupKey = `lm:${lm.id.replace(/_(r|l)$/, '')}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      const lmLower = lm.namePl.toLowerCase();
      const exactStart =
        lmLower.startsWith(rawLower) ||
        normalizeAnatomyAnswer(lm.namePl).startsWith(normQ);
      const score = (directMatch ? 95 : 30) + (exactStart ? 25 : 0);
      items.push({
        key: lm.id,
        kind: 'landmark',
        label: lm.bilingualName || formatBilingualName(lm.namePl, lm.nameEn),
        badge: lm.type === 'pp' ? 'PP' : lm.type === 'pk' ? 'PK' : 'Punkt kostny',
        badgeTone: lm.type === 'pp' ? 'pp' : lm.type === 'pk' ? 'pk' : 'bone',
        score,
        landmarkId: lm.id,
      });
    }

    items.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'pl'));
    return items.slice(0, 8);
  }, [quickQuery, sceneLandmarks, sceneParts]);

  const handleRegionChange = (nextRegion: ExplorerRegionKey) => {
    pendingJumpRef.current = null;
    setModelLoadedRegion(null);
    setRegion(nextRegion);
    setSelectedPart(null);
    setIsolatedMusclePartId(null);
    setClinicalNerveHighlight(null);
    setQuickQuery('');
  };

  const handlePartsLoaded = (parts: SelectableMeshMeta[]) => {
    setSceneParts(parts);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-20 md:pb-8">
      {/* Header & Regional Model Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-emerald-950 dark:text-white">
            Eksplorator 3D Anatomii
          </h1>
          <p className="mt-0.5 text-sm text-[#354c3f] dark:text-[#94b0a0]">
            Interaktywny atlas 3D wszystkich układów: kości, mięśnie, kaletki, ścięgna, więzadła, tętnice, żyły, nerwy, narządy wewnętrzne i powłoki skórne.
          </p>
        </div>

        <div className="flex w-full flex-nowrap items-center gap-1.5 overflow-x-auto no-scrollbar rounded-2xl border-2 border-[#d6e7dc] bg-white p-1.5 sm:w-auto sm:flex-wrap sm:overflow-visible dark:border-[#233d2f] dark:bg-[#112018]">
          {EXPLORER_REGION_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              data-testid={opt.testId}
              onClick={() => handleRegionChange(opt.id)}
              className={`shrink-0 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-extrabold transition sm:px-3 sm:py-2 ${
                region === opt.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-[#354c3f] hover:bg-[#ebf5ee] dark:text-[#c7dbcf] dark:hover:bg-[#182b21]'
              }`}
            >
              {opt.id === 'full_body' ? (
                <>
                  <span className="sm:hidden">Całe ciało 3D</span>
                  <span className="hidden sm:inline">{opt.label}</span>
                </>
              ) : (
                opt.label
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Clean 2-Column Split Stage (switches cleanly to single-column stack in Smartfon mode) */}
      <div
        className={`grid grid-cols-1 items-start gap-5 ${
          deviceMode === 'phone' ? '' : 'md:grid-cols-12'
        }`}
      >
        {/* 3D Canvas Stage */}
        <div
          className={`space-y-2.5 ${
            deviceMode === 'phone'
              ? ''
              : deviceMode === 'ipad'
                ? 'md:col-span-7'
                : 'md:col-span-7 lg:col-span-8'
          }`}
        >
          {/* Clinical 3D Tools Bar: Dermatomy/Miotomy (C4–S2) + Test Kliniczny 3D + Biomechanika 3D */}
          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 sm:flex-wrap sm:overflow-visible sm:pb-0">
            <button
              type="button"
              data-testid="toggle-dermatome-panel-btn"
              onClick={() => {
                setShowDermatomePanel((prev) => !prev);
                setShowClinicalTestPanel(false);
                setShowBiomechanicsPanel(false);
              }}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border-2 px-3 py-1.5 text-xs font-extrabold transition ${
                showDermatomePanel || dermatomeHighlight
                  ? 'border-emerald-600 bg-emerald-500 text-white'
                  : 'border-[#d6e7dc] bg-white text-[#16291f] hover:border-emerald-400 dark:border-[#233d2f] dark:bg-[#112018] dark:text-emerald-50'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>
                {activeDermatomeLevel
                  ? `Dermatom / Miotom: ${activeDermatomeLevel.id}`
                  : 'Dermatomy i Miotomy (C4–S2)'}
              </span>
            </button>

            <button
              type="button"
              data-testid="toggle-clinical-test-panel-btn"
              onClick={() => {
                setShowClinicalTestPanel((prev) => !prev);
                setShowDermatomePanel(false);
                setShowBiomechanicsPanel(false);
              }}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border-2 px-3 py-1.5 text-xs font-extrabold transition ${
                showClinicalTestPanel || clinicalTestHighlight
                  ? 'border-emerald-600 bg-emerald-500 text-white'
                  : 'border-[#d6e7dc] bg-white text-[#16291f] hover:border-emerald-400 dark:border-[#233d2f] dark:bg-[#112018] dark:text-emerald-50'
              }`}
            >
              <Stethoscope className="h-3.5 w-3.5" />
              <span>
                {activeClinicalTest
                  ? `Test 3D: ${activeClinicalTest.namePl.slice(0, 28)}${activeClinicalTest.namePl.length > 28 ? '…' : ''}`
                  : `Test kliniczny 3D (${CLINICAL_TESTS_DB.length})`}
              </span>
            </button>

            <button
              type="button"
              data-testid="toggle-biomechanics-panel-btn"
              onClick={() => {
                setShowBiomechanicsPanel((prev) => !prev);
                setShowDermatomePanel(false);
                setShowClinicalTestPanel(false);
              }}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border-2 px-3 py-1.5 text-xs font-extrabold transition ${
                showBiomechanicsPanel || biomechanicsHighlight
                  ? 'border-emerald-600 bg-emerald-500 text-white'
                  : 'border-[#d6e7dc] bg-white text-[#16291f] hover:border-emerald-400 dark:border-[#233d2f] dark:bg-[#112018] dark:text-emerald-50'
              }`}
            >
              <Compass className="h-3.5 w-3.5" />
              <span>
                {activeBiomechanicsMovement
                  ? `Biomechanika: ${activeBiomechanicsMovement.shortLabelPl}`
                  : `Biomechanika 3D (${BIOMECHANICS_MOVEMENTS.length})`}
              </span>
            </button>

            {(dermatomeHighlight ||
              clinicalTestHighlight ||
              clinicalNerveHighlight ||
              biomechanicsHighlight) && (
              <button
                type="button"
                data-testid="clear-all-clinical-overlays-btn"
                onClick={() => {
                  setDermatomeHighlight(null);
                  setClinicalTestHighlight(null);
                  setClinicalNerveHighlight(null);
                  setBiomechanicsHighlight(null);
                }}
                className="inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
              >
                <X className="h-3 w-3" />
                <span>Wyłącz nakładkę kliniczną</span>
              </button>
            )}
          </div>

          {/* Collapsible Dermatomes & Myotomes 3D Selector Panel */}
          {showDermatomePanel && (
            <div
              data-testid="dermatome-selector-panel"
              className="space-y-3 rounded-2xl border-2 border-emerald-500 bg-white p-3.5 shadow-md dark:border-emerald-600 dark:bg-[#112018]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e6f0ea] pb-2 dark:border-[#233d2f]">
                <div className="text-xs font-extrabold text-emerald-950 dark:text-white">
                  Mapa Dermatomów i Miotomów 3D (wybierz korzeń nerwowy):
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {(
                    [
                      { id: 'both', label: 'Dermatom + Miotom' },
                      { id: 'dermatome', label: 'Tylko Dermatom' },
                      { id: 'myotome', label: 'Tylko Miotom' },
                    ] as Array<{ id: DermatomeDisplayMode; label: string }>
                  ).map((m) => {
                    const active = (dermatomeHighlight?.mode ?? 'both') === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        data-testid={`dermatome-mode-${m.id}`}
                        onClick={() => {
                          if (dermatomeHighlight) {
                            setDermatomeHighlight({ ...dermatomeHighlight, mode: m.id });
                          } else {
                            selectDermatomeRoot(DERMATOME_MYOTOME_LEVELS[1], m.id);
                          }
                        }}
                        className={`rounded-lg border px-2 py-1 text-[10px] font-extrabold transition ${
                          active
                            ? 'border-emerald-600 bg-emerald-500 text-white'
                            : 'border-[#d6e7dc] bg-[#f4faf6] text-[#26382e] hover:border-emerald-400 dark:border-[#294737] dark:bg-[#182b21] dark:text-[#c7dbcf]'
                        }`}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {DERMATOME_MYOTOME_LEVELS.map((lvl) => {
                  const isActive = dermatomeHighlight?.rootId === lvl.id;
                  return (
                    <button
                      key={lvl.id}
                      type="button"
                      data-testid={`dermatome-root-${lvl.id}`}
                      onClick={() => selectDermatomeRoot(lvl)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border-2 px-2.5 py-1.5 text-xs font-extrabold transition ${
                        isActive
                          ? 'border-emerald-600 bg-emerald-500 text-white shadow-sm'
                          : 'border-[#d6e7dc] bg-[#f4faf6] text-[#16291f] hover:border-emerald-400 dark:border-[#294737] dark:bg-[#182b21] dark:text-emerald-50'
                      }`}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/15"
                        style={{ backgroundColor: lvl.accentHex }}
                      />
                      <span>{lvl.id}</span>
                    </button>
                  );
                })}
              </div>

              {dermatomeHighlight && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e6f0ea] pt-2 text-[11px] dark:border-[#233d2f]">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[#52695b] dark:text-[#94b0a0]">Strona:</span>
                    {(
                      [
                        { id: 'both', label: 'Obustronnie' },
                        { id: 'right', label: 'Prawa' },
                        { id: 'left', label: 'Lewa' },
                      ] as const
                    ).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        data-testid={`dermatome-side-${s.id}`}
                        onClick={() =>
                          setDermatomeHighlight((prev) => (prev ? { ...prev, side: s.id } : null))
                        }
                        className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold transition ${
                          (dermatomeHighlight.side ?? 'both') === s.id
                            ? 'border-emerald-600 bg-emerald-500 text-white'
                            : 'border-[#d6e7dc] bg-white text-[#26382e] dark:border-[#294737] dark:bg-[#182b21] dark:text-[#c7dbcf]'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setModelLoadedRegion(null);
                      setRegion('full_body');
                    }}
                    className="font-bold text-emerald-700 underline hover:text-emerald-600 dark:text-emerald-400"
                  >
                    Pokaż na całym ciele
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Collapsible 50 Clinical Tests 3D Selector Panel */}
          {showClinicalTestPanel && (
            <div
              data-testid="clinical-test-selector-panel"
              className="space-y-2.5 rounded-2xl border-2 border-emerald-500 bg-white p-3.5 shadow-md dark:border-emerald-600 dark:bg-[#112018]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-emerald-950 dark:text-white">
                  Wizualizator Testów Klinicznych 3D ({filteredClinicalTests.length}/{CLINICAL_TESTS_DB.length})
                </span>
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      { id: 'all', label: 'Wszystkie' },
                      { id: 'orthopedic', label: 'Ortopedyczne' },
                      { id: 'kinesitherapy_length', label: 'Długość' },
                      { id: 'lovett', label: 'Lovett' },
                      { id: 'kinesitherapy_method', label: 'Metodyka' },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setClinicalTestCategoryFilter(cat.id)}
                      className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold transition ${
                        clinicalTestCategoryFilter === cat.id
                          ? 'border-emerald-600 bg-emerald-500 text-white'
                          : 'border-[#d6e7dc] bg-[#f4faf6] text-[#26382e] dark:border-[#294737] dark:bg-[#182b21] dark:text-[#c7dbcf]'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="text"
                data-testid="clinical-test-search-input"
                value={clinicalTestQuery}
                onChange={(e) => setClinicalTestQuery(e.target.value)}
                placeholder="Szukaj testu (np. Neer, Lachman, Lasègue, Phalen, Trendelenburg, Lovett)..."
                className="w-full rounded-xl border border-[#c2d8ca] bg-[#f4faf6] px-3 py-1.5 text-xs font-semibold text-emerald-950 focus:border-emerald-500 focus:outline-none dark:border-[#294737] dark:bg-[#182b21] dark:text-white"
              />

              <div className="grid max-h-48 grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
                {filteredClinicalTests.map((t) => {
                  const isActive = clinicalTestHighlight?.testId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      data-testid={`select-clinical-test-${t.id}`}
                      onClick={() => selectClinicalTest3D(t)}
                      className={`flex flex-col rounded-xl border p-2 text-left transition ${
                        isActive
                          ? 'border-emerald-600 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/60'
                          : 'border-[#e6f0ea] bg-[#f4faf6] hover:border-emerald-400 dark:border-[#233d2f] dark:bg-[#182b21]/80'
                      }`}
                    >
                      <span className="truncate text-xs font-extrabold text-emerald-950 dark:text-white">
                        {t.namePl}
                      </span>
                      <span className="truncate text-[10px] font-medium text-[#52695b] dark:text-[#94b0a0]">
                        {t.targetSummary}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Collapsible Biomechanics 3D (Agonists / Synergists / Antagonists + SFTR) Panel */}
          {showBiomechanicsPanel && (
            <div
              data-testid="biomechanics-selector-panel"
              className="space-y-3 rounded-2xl border-2 border-emerald-300 bg-white p-3.5 shadow-sm dark:border-emerald-700 dark:bg-[#112018]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-extrabold text-emerald-950 dark:text-emerald-100">
                  Biomechanika 3D — wybierz staw i ruch (Agoniści / Synergiści / Antagoniści)
                </div>
                {biomechanicsHighlight && (
                  <button
                    type="button"
                    data-testid="biomech-toggle-plane"
                    onClick={() =>
                      setBiomechanicsHighlight((prev) =>
                        prev ? { ...prev, showPlaneHelper: !prev.showPlaneHelper } : null,
                      )
                    }
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-extrabold transition ${
                      biomechanicsHighlight.showPlaneHelper
                        ? 'border-emerald-600 bg-emerald-500 text-white'
                        : 'border-[#d6e7dc] bg-[#f4faf6] text-[#354c3f] dark:border-[#294737] dark:bg-[#182b21] dark:text-[#c7dbcf]'
                    }`}
                  >
                    Płaszczyzna i oś 3D: {biomechanicsHighlight.showPlaneHelper ? 'WŁ.' : 'WYŁ.'}
                  </button>
                )}
              </div>

              {/* 7 Joint Complex Tabs */}
              <div className="flex flex-wrap gap-1.5">
                {BIOMECHANICS_JOINT_GROUPS.map((grp) => (
                  <button
                    key={grp.id}
                    type="button"
                    data-testid={`biomech-joint-${grp.id}`}
                    onClick={() => setBiomechanicsJointFilter(grp.id)}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-extrabold transition ${
                      biomechanicsJointFilter === grp.id
                        ? 'border-emerald-600 bg-emerald-500 text-white'
                        : 'border-[#d6e7dc] bg-[#f4faf6] text-[#16291f] hover:border-emerald-400 dark:border-[#294737] dark:bg-[#182b21] dark:text-emerald-50'
                    }`}
                  >
                    {grp.shortLabel}
                  </button>
                ))}
              </div>

              {/* Movements for selected joint */}
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {BIOMECHANICS_MOVEMENTS.filter(
                  (m) => m.jointGroup === biomechanicsJointFilter,
                ).map((m) => {
                  const isActive = biomechanicsHighlight?.movementId === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      data-testid={`biomech-movement-${m.id}`}
                      onClick={() => selectBiomechanicsMovement(m)}
                      className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition ${
                        isActive
                          ? 'border-emerald-600 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/60'
                          : 'border-[#e6f0ea] bg-[#f4faf6] hover:border-emerald-400 dark:border-[#233d2f] dark:bg-[#182b21]/80'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-xs font-extrabold text-emerald-950 dark:text-white">
                          {m.namePl}
                        </div>
                        <div className="truncate text-[10px] font-semibold text-[#52695b] dark:text-[#94b0a0]">
                          {m.planeLabelPl}
                        </div>
                      </div>
                      <span className="font-mono-tabular shrink-0 rounded-md bg-white px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:bg-[#112018] dark:text-emerald-300">
                        {m.sftrCode.split(' ')[0]} {m.sftrCode.split(' ')[1]}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Independent Role Toggles + Side Selector */}
              {biomechanicsHighlight && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e6f0ea] pt-2.5 dark:border-[#233d2f]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      data-testid="biomech-toggle-agonists"
                      onClick={() =>
                        setBiomechanicsHighlight((prev) =>
                          prev ? { ...prev, showAgonists: !prev.showAgonists } : null,
                        )
                      }
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-extrabold transition ${
                        biomechanicsHighlight.showAgonists
                          ? 'border-emerald-600 bg-emerald-500 text-white'
                          : 'border-[#d6e7dc] bg-[#f4faf6] text-[#52695b] dark:border-[#294737] dark:bg-[#182b21] dark:text-[#94b0a0]'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-emerald-300" />
                      <span>Agoniści</span>
                    </button>
                    <button
                      type="button"
                      data-testid="biomech-toggle-synergists"
                      onClick={() =>
                        setBiomechanicsHighlight((prev) =>
                          prev ? { ...prev, showSynergists: !prev.showSynergists } : null,
                        )
                      }
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-extrabold transition ${
                        biomechanicsHighlight.showSynergists
                          ? 'border-amber-600 bg-amber-500 text-white'
                          : 'border-[#d6e7dc] bg-[#f4faf6] text-[#52695b] dark:border-[#294737] dark:bg-[#182b21] dark:text-[#94b0a0]'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-amber-200" />
                      <span>Synergiści</span>
                    </button>
                    <button
                      type="button"
                      data-testid="biomech-toggle-antagonists"
                      onClick={() =>
                        setBiomechanicsHighlight((prev) =>
                          prev ? { ...prev, showAntagonists: !prev.showAntagonists } : null,
                        )
                      }
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-extrabold transition ${
                        biomechanicsHighlight.showAntagonists
                          ? 'border-rose-600 bg-rose-500 text-white'
                          : 'border-[#d6e7dc] bg-[#f4faf6] text-[#52695b] dark:border-[#294737] dark:bg-[#182b21] dark:text-[#94b0a0]'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-rose-200" />
                      <span>Antagoniści</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    {(
                      [
                        ['right', 'Prawa'],
                        ['left', 'Lewa'],
                        ['both', 'Obie'],
                      ] as const
                    ).map(([sId, sLabel]) => (
                      <button
                        key={sId}
                        type="button"
                        data-testid={`biomech-side-${sId}`}
                        onClick={() =>
                          setBiomechanicsHighlight((prev) =>
                            prev ? { ...prev, side: sId } : null,
                          )
                        }
                        className={`rounded-lg px-2 py-1 text-[10px] font-extrabold transition ${
                          biomechanicsHighlight.side === sId
                            ? 'bg-emerald-500 text-white'
                            : 'bg-[#f4faf6] text-[#354c3f] hover:bg-[#e1f1e7] dark:bg-[#182b21] dark:text-[#c7dbcf]'
                        }`}
                      >
                        {sLabel}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Compact Quick-Jump Autocomplete Search Bar (dropdown opens ONLY while typing) */}
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#6b8274]" />
            <input
              type="text"
              data-testid="explorer-quick-jump-input"
              value={quickQuery}
              onChange={(e) => setQuickQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setQuickQuery('');
                } else if (e.key === 'Enter' && quickJumpResults.length > 0) {
                  const first = quickJumpResults[0];
                  viewportRef.current?.selectAndFocusTarget?.({
                    landmarkId: first.landmarkId,
                    partId: first.partId,
                    structureId: first.structureId,
                    isolateIfMuscle: Boolean(first.isMuscle),
                  });
                  setQuickQuery('');
                }
              }}
              placeholder="Skocz do struktury 3D (np. mięsień naramienny, tętnica udowa, nerw kulszowy, kaletka podbarkowa, serce)..."
              className="w-full rounded-2xl border-2 border-[#d6e7dc] bg-white py-2 pr-9 pl-10 text-xs font-semibold text-emerald-950 placeholder:text-[#6b8274] focus:border-emerald-500 focus:outline-none dark:border-[#233d2f] dark:bg-[#112018] dark:text-white"
            />
            {quickQuery && (
              <button
                type="button"
                onClick={() => setQuickQuery('')}
                aria-label="Wyczyść szybkie wyszukiwanie"
                className="absolute top-1/2 right-3 -translate-y-1/2 text-[#6b8274] hover:text-emerald-950 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {quickQuery.trim().length >= 2 && (
              <div
                data-testid="explorer-quick-jump-results"
                className="absolute inset-x-0 top-full z-40 mt-1.5 overflow-hidden rounded-2xl border-2 border-emerald-500 bg-white shadow-2xl dark:border-emerald-600 dark:bg-[#112018]"
              >
                {quickJumpResults.length > 0 ? (
                  <ul className="divide-y divide-[#e6f0ea] dark:divide-[#233d2f]">
                    {quickJumpResults.map((item, idx) => (
                      <li key={item.key}>
                        <button
                          type="button"
                          data-testid={`quick-jump-option-${idx}`}
                          onClick={() => {
                            viewportRef.current?.selectAndFocusTarget?.({
                              landmarkId: item.landmarkId,
                              partId: item.partId,
                              structureId: item.structureId,
                              isolateIfMuscle: Boolean(item.isMuscle),
                            });
                            setQuickQuery('');
                          }}
                          className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs font-semibold text-[#16291f] transition hover:bg-emerald-50 dark:text-[#e6f2ea] dark:hover:bg-[#182b21]"
                        >
                          <span className="truncate">{item.label}</span>
                          <span
                            className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                              item.badgeTone === 'pp'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                                : item.badgeTone === 'pk'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                                  : item.badgeTone === 'muscle'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            }`}
                          >
                            {item.badge}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-4 py-3 text-xs font-medium text-[#52695b] dark:text-[#94b0a0]">
                    Brak pasujących struktur w bieżącym modelu — przełącz na „Całe ciało”, aby szukać globalnie.
                  </div>
                )}
              </div>
            )}
          </div>

          <AnatomyViewport3D
            ref={viewportRef}
            region={region}
            modelUrl={activeRegionOption.modelUrl}
            selectedId={selectedPart?.id ?? null}
            selectedPartId={selectedPart?.id ?? null}
            onSelectPart={setSelectedPart}
            onPartsLoaded={handlePartsLoaded}
            onLandmarksLoaded={setSceneLandmarks}
            onLoaded={handleViewportLoaded}
            onIsolatedMuscleChange={setIsolatedMusclePartId}
            clinicalNerveHighlight={clinicalNerveHighlight}
            onClearClinicalNerveHighlight={() => setClinicalNerveHighlight(null)}
            dermatomeHighlight={dermatomeHighlight}
            onClearDermatomeHighlight={() => setDermatomeHighlight(null)}
            clinicalTestHighlight={clinicalTestHighlight}
            onClearClinicalTestHighlight={() => setClinicalTestHighlight(null)}
            biomechanicsHighlight={biomechanicsHighlight}
            onClearBiomechanicsHighlight={() => setBiomechanicsHighlight(null)}
            enableExtendedLayers
            hideHotspotOverlay
            heightClassName="h-[400px] sm:h-[480px] md:h-[560px]"
            isDarkMode={isDarkMode}
          />
        </div>

        {/* Right Panel: Selected Structure Key Info Card */}
        <div
          className={
            deviceMode === 'phone'
              ? ''
              : deviceMode === 'ipad'
                ? 'md:col-span-5'
                : 'md:col-span-5 lg:col-span-4'
          }
        >
          <div
            data-testid="explorer-inspector"
            className="rounded-2xl border-2 border-[#d6e7dc] bg-white p-5 md:max-h-[612px] md:overflow-y-auto dark:border-[#233d2f] dark:bg-[#112018]"
          >
            {/* Priority 1: Active Dermatome & Myotome Radiculopathy Card */}
            {activeDermatomeLevel && !selectedPart ? (
              <div data-testid="inspector-dermatome-card" className="space-y-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white"
                        style={{ backgroundColor: activeDermatomeLevel.accentHex }}
                      >
                        <span>{activeDermatomeLevel.id}</span>
                      </span>
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                        {activeDermatomeLevel.groupLabelPl}
                      </span>
                    </div>
                    <h2 className="mt-1.5 font-display text-xl font-extrabold text-emerald-950 dark:text-white">
                      {activeDermatomeLevel.labelPl} — Dermatom i Miotom
                    </h2>
                    <p className="mt-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                      {activeDermatomeLevel.commonDiscLevelPl}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDermatomeHighlight(null)}
                    aria-label="Zamknij kartę dermatomu"
                    className="rounded-lg p-1 text-[#6b8274] hover:bg-[#f4faf6] dark:hover:bg-[#182b21]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-800/70 dark:bg-emerald-950/35">
                    <div className="font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      Miotom — mięsień wskaźnikowy i ruch
                    </div>
                    <p className="mt-1 font-bold text-emerald-950 dark:text-white">
                      {activeDermatomeLevel.keyMusclePl}
                    </p>
                    <p className="mt-0.5 text-[#26382e] dark:text-[#c7dbcf]">
                      {activeDermatomeLevel.keyMovementPl}
                    </p>
                  </div>

                  <div className="rounded-xl bg-[#f4faf6] p-3 dark:bg-[#182b21]/80">
                    <div className="font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
                      Dermatom — obszar czucia skórnego
                    </div>
                    <p className="mt-1 leading-relaxed text-[#16291f] dark:text-[#e6f2ea]">
                      {activeDermatomeLevel.sensoryLandmarkPl}
                    </p>
                  </div>

                  <div className="rounded-xl bg-[#f4faf6] p-3 dark:bg-[#182b21]/80">
                    <div className="font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
                      Odruch głęboki
                    </div>
                    <p className="mt-1 font-semibold text-[#16291f] dark:text-[#e6f2ea]">
                      {activeDermatomeLevel.reflexPl}
                    </p>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-800/70 dark:bg-amber-950/30">
                    <div className="flex items-center gap-1.5 font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                      <Activity className="h-3.5 w-3.5" />
                      <span>Objawy radikulopatii</span>
                    </div>
                    <p className="mt-1 leading-relaxed text-[#26382e] dark:text-[#e6f2ea]">
                      {activeDermatomeLevel.radiculopathySignsPl}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      Mięśnie miotomu na 3D (kliknij, aby zbadać):
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeDermatomeLevel.myotomeMuscleIds.map((mId) => {
                        const mEntry = ANATOMY_MAP[mId];
                        if (!mEntry) return null;
                        return (
                          <button
                            key={mId}
                            type="button"
                            onClick={() => {
                              viewportRef.current?.selectAndFocusTarget?.({
                                structureId: mId,
                                isolateIfMuscle: false,
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2 py-1 text-[11px] font-bold text-emerald-900 transition hover:bg-emerald-50 dark:border-emerald-700 dark:bg-[#112018] dark:text-emerald-200"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <span>{mEntry.namePl}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-[#e6f0ea] pt-2 text-[11px] text-[#52695b] dark:border-[#233d2f] dark:text-[#94b0a0]">
                    <strong className="text-[#16291f] dark:text-emerald-100">Testy prowokacyjne: </strong>
                    {activeDermatomeLevel.provocationTestsPl.join(' • ')}
                  </div>
                </div>
              </div>
            ) : activeClinicalTest && !selectedPart ? (
              /* Priority 2: Active Clinical Test 3D Procedure & Structures Card */
              <div data-testid="inspector-clinical-test-card" className="space-y-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                      Wizualizator Testu 3D
                    </span>
                    <h2 className="mt-1.5 font-display text-lg font-extrabold text-emerald-950 dark:text-white">
                      {activeClinicalTest.namePl}
                    </h2>
                    <div className="text-xs font-medium text-[#52695b] dark:text-[#94b0a0]">
                      {activeClinicalTest.nameEn}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setClinicalTestHighlight(null)}
                    aria-label="Zamknij kartę testu"
                    className="rounded-lg p-1 text-[#6b8274] hover:bg-[#f4faf6] dark:hover:bg-[#182b21]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-800/70 dark:bg-emerald-950/35">
                    <div className="font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      Cel badania i podświetlone struktury ({activeClinicalTest.structureIds.length})
                    </div>
                    <p className="mt-1 font-semibold text-emerald-950 dark:text-white">
                      {activeClinicalTest.targetSummary}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {activeClinicalTest.structureIds.map((sid) => {
                        const s = ANATOMY_MAP[sid];
                        if (!s) return null;
                        return (
                          <button
                            key={sid}
                            type="button"
                            data-testid={`test-card-structure-${sid}`}
                            onClick={() => {
                              viewportRef.current?.selectAndFocusTarget?.({
                                structureId: sid,
                                isolateIfMuscle: false,
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2 py-1 text-[11px] font-bold text-emerald-900 transition hover:bg-emerald-50 dark:border-emerald-700 dark:bg-[#112018] dark:text-emerald-200"
                          >
                            <Crosshair className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            <span>{s.namePl}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#f4faf6] p-3 dark:bg-[#182b21]/80">
                    <div className="font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
                      Pozycja wyjściowa
                    </div>
                    <p className="mt-1 leading-relaxed text-[#16291f] dark:text-[#e6f2ea]">
                      {activeClinicalTest.patientPosition}
                    </p>
                  </div>

                  <div className="rounded-xl bg-[#f4faf6] p-3 dark:bg-[#182b21]/80">
                    <div className="font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
                      Metodyka wykonania
                    </div>
                    <p className="mt-1 leading-relaxed text-[#16291f] dark:text-[#e6f2ea]">
                      {activeClinicalTest.procedure}
                    </p>
                  </div>

                  <div className="rounded-xl border border-rose-200 bg-rose-50/75 p-3 dark:border-rose-800/70 dark:bg-rose-950/30">
                    <div className="font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                      {activeClinicalTest.category === 'lovett'
                        ? 'Kryteria stopni 0–5 (Lovett)'
                        : 'Objaw dodatni'}
                    </div>
                    <p className="mt-1 leading-relaxed text-rose-950 dark:text-rose-100">
                      {activeClinicalTest.positiveSign}
                    </p>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-800/70 dark:bg-amber-950/30">
                    <div className="flex items-center gap-1.5 font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                      <Stethoscope className="h-3.5 w-3.5" />
                      <span>Interpretacja kliniczna</span>
                    </div>
                    <p className="mt-1 leading-relaxed text-[#26382e] dark:text-[#e6f2ea]">
                      {activeClinicalTest.clinicalInterpretation}
                    </p>
                  </div>
                </div>
              </div>
            ) : activeBiomechanicsMovement ? (
              <div data-testid="inspector-biomechanics-card" className="space-y-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                      <Compass className="h-3 w-3" />
                      <span>{activeBiomechanicsMovement.jointLabelPl}</span>
                    </div>
                    <h2 className="mt-1.5 font-display text-lg font-extrabold text-emerald-950 dark:text-white">
                      {activeBiomechanicsMovement.namePl}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBiomechanicsHighlight(null)}
                    aria-label="Zamknij kartę biomechaniki"
                    className="rounded-lg p-1 text-[#6b8274] hover:bg-[#f4faf6] dark:hover:bg-[#182b21]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* SFTR + Plane & Axis Box */}
                <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/70 p-3 text-xs dark:border-emerald-800/70 dark:bg-emerald-950/40">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      Norma SFTR (ISOM)
                    </span>
                    <span className="font-mono-tabular text-sm font-black text-emerald-900 dark:text-white">
                      {activeBiomechanicsMovement.sftrCode}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-semibold text-[#26382e] dark:text-[#d1e5d9]">
                    {activeBiomechanicsMovement.normRangePl}
                  </p>
                  <div className="mt-2 space-y-0.5 border-t border-emerald-200/80 pt-1.5 text-[11px] text-[#354c3f] dark:border-emerald-800/70 dark:text-[#c7dbcf]">
                    <div>
                      <span className="font-extrabold">Płaszczyzna: </span>
                      {activeBiomechanicsMovement.planeLabelPl}
                    </div>
                    <div>
                      <span className="font-extrabold">Oś obrotu: </span>
                      {activeBiomechanicsMovement.axisLabelPl}
                    </div>
                  </div>
                </div>

                {/* Kaltenborn Convex-Concave Arthrokinematics */}
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs dark:border-amber-800/70 dark:bg-amber-950/30">
                  <div className="font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    Artrokinematyka • Reguła wklęsło-wypukła
                  </div>
                  <p className="mt-1 leading-relaxed text-[#26382e] dark:text-[#e6f2ea]">
                    {activeBiomechanicsMovement.convexConcaveRulePl}
                  </p>
                </div>

                {/* Muscle Chain Groups (clickable to focus in 3D) */}
                {(
                  [
                    {
                      title: 'Agoniści (główni sprawcy)',
                      ids: activeBiomechanicsMovement.agonistIds,
                      dot: 'bg-emerald-500',
                      chipTone:
                        'border-emerald-300 bg-emerald-50/70 text-emerald-950 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-100',
                    },
                    {
                      title: 'Synergiści i stabilizatory',
                      ids: activeBiomechanicsMovement.synergistIds,
                      dot: 'bg-amber-500',
                      chipTone:
                        'border-amber-300 bg-amber-50/70 text-amber-950 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100',
                    },
                    {
                      title: 'Antagoniści (przeciwstawni)',
                      ids: activeBiomechanicsMovement.antagonistIds,
                      dot: 'bg-rose-500',
                      chipTone:
                        'border-rose-300 bg-rose-50/70 text-rose-950 hover:bg-rose-100 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-100',
                    },
                  ] as const
                ).map((group) => (
                  <div key={group.title} className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
                      <span className={`h-2 w-2 rounded-full ${group.dot}`} />
                      <span>{group.title}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {group.ids.map((sid) => {
                        const entry = ANATOMY_MAP[sid];
                        if (!entry) return null;
                        return (
                          <button
                            key={sid}
                            type="button"
                            data-testid={`biomech-chip-${sid}`}
                            onClick={() => {
                              viewportRef.current?.selectAndFocusTarget?.({
                                structureId: sid,
                                isolateIfMuscle: false,
                              });
                            }}
                            className={`rounded-lg border px-2 py-1 text-[11px] font-bold transition ${group.chipTone}`}
                          >
                            {entry.namePl}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* 1-Click Lovett 0-5 3D Test Shortcut */}
                {activeBiomechanicsMovement.lovettTestId &&
                  CLINICAL_TEST_MAP[activeBiomechanicsMovement.lovettTestId] && (
                    <button
                      type="button"
                      data-testid="biomech-open-lovett-btn"
                      onClick={() => {
                        const t = CLINICAL_TEST_MAP[activeBiomechanicsMovement.lovettTestId!];
                        if (t) selectClinicalTest3D(t);
                      }}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-3.5 py-2.5 text-xs font-extrabold text-white transition hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2"
                    >
                      <Stethoscope className="h-4 w-4" />
                      <span>Otwórz badanie w skali Lovetta 0–5 (3D)</span>
                    </button>
                  )}

                <div className="rounded-xl bg-[#f4faf6] p-3 text-xs leading-relaxed text-[#354c3f] dark:bg-[#182b21]/80 dark:text-[#c7dbcf]">
                  <span className="font-extrabold text-emerald-800 dark:text-emerald-300">
                    Wskazówka kliniczna:{' '}
                  </span>
                  {activeBiomechanicsMovement.clinicalTipPl}
                </div>
              </div>
            ) : selectedPart ? (
              <div className="space-y-3.5">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {selectedLandmarkEntry ? (
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                          selectedLandmarkEntry.type === 'pp'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                            : selectedLandmarkEntry.type === 'pk'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                        }`}
                      >
                        {selectedLandmarkEntry.type === 'pp'
                          ? 'PP • Przyczep początkowy'
                          : selectedLandmarkEntry.type === 'pk'
                            ? 'PK • Przyczep końcowy'
                            : 'Struktura kostna'}
                      </span>
                    ) : (
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        {getCategoryLabel(selectedEntry?.category ?? selectedPart.category)}
                      </span>
                    )}
                    <span className="rounded-md bg-[#ebf5ee] px-2 py-0.5 text-[10px] font-extrabold text-[#354c3f] dark:bg-[#182b21] dark:text-[#c7dbcf]">
                      {getTissueBadge(selectedPart, selectedEntry)}
                    </span>
                    {selectedEntry?.region && (
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                        {getRegionBadgeLabel(selectedEntry.region)}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-1.5 font-display text-xl font-extrabold text-emerald-950 dark:text-white">
                    {getPartBilingualLabel(selectedPart)}
                  </h2>
                  {selectedEntry?.nameLt && (
                    <div className="mt-0.5 text-xs font-semibold italic text-[#52695b] dark:text-[#94b0a0]">
                      {selectedEntry.nameLt}
                    </div>
                  )}
                </div>

                {/* Action buttons right below header for quick muscle/bone inspection */}
                <div className="flex flex-wrap gap-2">
                  {isSelectedMuscle && (
                    <button
                      type="button"
                      data-testid="inspector-isolate-muscle-btn"
                      onClick={() => {
                        if (isThisMuscleIsolated) {
                          viewportRef.current?.clearIsolatedMuscle?.();
                        } else {
                          viewportRef.current?.isolateMuscle?.(selectedPart.id);
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-xl border border-b-3 px-3 py-1.5 text-xs font-extrabold transition active:translate-y-0.5 active:border-b ${
                        isThisMuscleIsolated
                          ? 'border-emerald-700 bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'border-emerald-600 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-200 dark:hover:bg-emerald-900/60'
                      }`}
                    >
                      {isThisMuscleIsolated ? (
                        <>
                          <Eye className="h-3.5 w-3.5" />
                          <span>Pokaż wszystkie mięśnie</span>
                        </>
                      ) : (
                        <>
                          <Focus className="h-3.5 w-3.5" />
                          <span>Izoluj na szkielecie (przyczepy PP/PK)</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    data-testid="inspector-focus-btn"
                    onClick={() => viewportRef.current?.focusMesh(selectedPart.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#c2d8ca] bg-[#f4faf6] px-3 py-1.5 text-xs font-bold text-[#16291f] transition hover:bg-[#ebf5ee] dark:border-[#294737] dark:bg-[#182b21] dark:text-emerald-50 dark:hover:bg-[#20382b]"
                  >
                    <Crosshair className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Przybliż kamerę</span>
                  </button>

                  {selectedNerveProfile && (
                    <button
                      type="button"
                      data-testid="inspector-highlight-nerve-muscles-btn"
                      onClick={() => {
                        if (isSelectedNerveGroupHighlighted) {
                          setClinicalNerveHighlight(null);
                        } else {
                          activateNerveMuscleHighlight(selectedNerveProfile, selectedSide);
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-xl border border-b-3 px-3 py-1.5 text-xs font-extrabold transition active:translate-y-0.5 active:border-b ${
                        isSelectedNerveGroupHighlighted
                          ? 'border-amber-700 bg-amber-500 text-white hover:bg-amber-600'
                          : 'border-amber-500 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-200 dark:hover:bg-amber-900/60'
                      }`}
                    >
                      <Zap className="h-3.5 w-3.5" />
                      <span>
                        {isSelectedNerveGroupHighlighted
                          ? 'Wyłącz podświetlenie mięśni'
                          : `Podświetl unerwiane mięśnie (${selectedNerveProfile.innervatedMuscleIds.length})`}
                      </span>
                    </button>
                  )}
                </div>

                {/* Bidirectional Nerve -> Innervated Muscles & Palsy Syndrome Clinical Card */}
                {selectedNerveProfile && (
                  <div
                    data-testid="inspector-nerve-palsy-card"
                    className="space-y-2.5 rounded-xl border-2 border-amber-300 bg-amber-50/75 p-3.5 text-xs dark:border-amber-700/80 dark:bg-amber-950/30"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-extrabold text-amber-900 dark:text-amber-200">
                        <Zap className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        <span>Zespół porażenny i unerwienie 3D</span>
                      </span>
                      <span className="font-mono-tabular rounded-md bg-amber-200/80 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-950 dark:bg-amber-900/80 dark:text-amber-200">
                        {selectedNerveProfile.segments}
                      </span>
                    </div>

                    <div className="font-display text-xs font-extrabold text-emerald-950 dark:text-white">
                      {selectedNerveProfile.palsySyndromePl}
                    </div>

                    <p className="leading-relaxed text-[#26382e] dark:text-[#e6f2ea]">
                      <strong className="text-amber-900 dark:text-amber-300">Deficyt ruchowy: </strong>
                      {selectedNerveProfile.motorDeficitPl}
                    </p>

                    <p className="leading-relaxed text-[#354c3f] dark:text-[#c7dbcf]">
                      <strong className="text-amber-900 dark:text-amber-300">Obszar czucia: </strong>
                      {selectedNerveProfile.sensoryAreaPl}
                    </p>

                    <div className="space-y-1">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                        Unerwiane mięśnie (kliknij, aby przejść na 3D):
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedNerveProfile.innervatedMuscleIds.map((mId) => {
                          const mEntry = ANATOMY_MAP[mId];
                          if (!mEntry) return null;
                          return (
                            <button
                              key={mId}
                              type="button"
                              data-testid={`nerve-innervated-muscle-${mId}`}
                              onClick={() => {
                                viewportRef.current?.selectAndFocusTarget?.({
                                  structureId: mId,
                                  isolateIfMuscle: false,
                                });
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2 py-1 text-[11px] font-bold text-emerald-900 transition hover:bg-emerald-50 dark:border-emerald-700 dark:bg-[#112018] dark:text-emerald-200 dark:hover:bg-emerald-950/60"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              <span>{mEntry.namePl}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {selectedNerveProfile.keyTestsPl.length > 0 && (
                      <div className="border-t border-amber-200/80 pt-2 text-[11px] text-[#354c3f] dark:border-amber-800/60 dark:text-[#c7dbcf]">
                        <strong className="text-amber-900 dark:text-amber-300">Testy kliniczne: </strong>
                        {selectedNerveProfile.keyTestsPl.join(' • ')}
                      </div>
                    )}
                  </div>
                )}

                {/* Bidirectional Muscle -> Supplying Nerve 3D shortcut */}
                {isSelectedMuscle && selectedMuscleNerves.length > 0 && (
                  <div
                    data-testid="inspector-muscle-nerves-card"
                    className="space-y-2 rounded-xl border border-amber-300/80 bg-amber-50/60 p-3 text-xs dark:border-amber-800/70 dark:bg-amber-950/25"
                  >
                    <div className="flex items-center gap-1.5 font-extrabold text-amber-900 dark:text-amber-200">
                      <Zap className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Nerw zaopatrujący (mapa 3D):</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedMuscleNerves.map((nProf) => {
                        const active =
                          clinicalNerveHighlight?.nerveStructureId === nProf.nerveStructureId;
                        return (
                          <button
                            key={nProf.nerveStructureId}
                            type="button"
                            data-testid={`inspector-show-supplying-nerve-${nProf.nerveStructureId}`}
                            onClick={() => {
                              if (active) {
                                setClinicalNerveHighlight(null);
                              } else {
                                activateNerveMuscleHighlight(nProf, selectedSide);
                                viewportRef.current?.selectAndFocusTarget?.({
                                  structureId: nProf.nerveStructureId,
                                  isolateIfMuscle: false,
                                });
                              }
                            }}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-extrabold transition ${
                              active
                                ? 'border-amber-600 bg-amber-500 text-white'
                                : 'border-amber-400 bg-white text-amber-950 hover:bg-amber-100 dark:border-amber-700 dark:bg-[#112018] dark:text-amber-200 dark:hover:bg-amber-950/60'
                            }`}
                          >
                            <Zap className="h-3 w-3" />
                            <span>
                              {active
                                ? `Ukryj grupę: ${nProf.nerveNamePl}`
                                : `Pokaż ${nProf.nerveNamePl} (${nProf.segments})`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Clickable 3D PP (Red) & PK (Green) bone-zone chips for the selected muscle */}
                {isSelectedMuscle &&
                  (muscleAttachmentZones.pp.length > 0 || muscleAttachmentZones.pk.length > 0) && (
                    <div
                      data-testid="inspector-pp-pk-chips"
                      className="space-y-2 rounded-xl border border-[#d6e7dc] bg-[#f4faf6] p-3 text-xs dark:border-[#233d2f] dark:bg-[#182b21]/70"
                    >
                      <div className="flex items-center gap-1.5 font-extrabold text-[#16291f] dark:text-[#e6f2ea]">
                        <MapPin className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Przyczepy 3D na szkielecie (kliknij, aby zbliżyć):</span>
                      </div>

                      {muscleAttachmentZones.pp.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                            PP • Przyczep początkowy
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {muscleAttachmentZones.pp.map((lm) => (
                              <button
                                key={lm.id}
                                type="button"
                                data-testid={`inspector-pp-chip-${lm.id}`}
                                onClick={() => viewportRef.current?.selectLandmark?.(lm.id)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-2 py-1 text-left text-[11px] font-bold text-rose-900 transition hover:bg-rose-100 dark:border-rose-700/80 dark:bg-rose-950/60 dark:text-rose-200 dark:hover:bg-rose-900/60"
                              >
                                <span className="h-2 w-2 shrink-0 rounded-full bg-rose-600" />
                                <span>{lm.namePl}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {muscleAttachmentZones.pk.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                            PK • Przyczep końcowy
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {muscleAttachmentZones.pk.map((lm) => (
                              <button
                                key={lm.id}
                                type="button"
                                data-testid={`inspector-pk-chip-${lm.id}`}
                                onClick={() => viewportRef.current?.selectLandmark?.(lm.id)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-left text-[11px] font-bold text-emerald-900 transition hover:bg-emerald-100 dark:border-emerald-700/80 dark:bg-emerald-950/60 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
                              >
                                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-600" />
                                <span>{lm.namePl}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                {/* Clickable attached muscles list when a bony landmark / PP-PK zone is active */}
                {selectedLandmarkEntry && (
                  <div className="space-y-2.5 border-t border-[#e6f0ea] pt-3 text-xs leading-relaxed dark:border-[#233d2f]">
                    {selectedLandmarkEntry.boneNamePl && (
                      <div>
                        <span className="font-bold text-[#26382e] dark:text-[#e6f2ea]">
                          Kość macierzysta:{' '}
                        </span>
                        <span className="text-[#354c3f] dark:text-[#c7dbcf]">
                          {formatBilingualName(
                            selectedLandmarkEntry.boneNamePl,
                            selectedLandmarkEntry.boneNameEn,
                          )}
                        </span>
                      </div>
                    )}

                    {selectedLandmarkEntry.attachedMuscles &&
                      selectedLandmarkEntry.attachedMuscles.length > 0 && (
                        <div>
                          <div className="font-bold text-[#26382e] dark:text-[#e6f2ea]">
                            Przyczepione mięśnie / struktury (kliknij, aby wyizolować na szkielecie):
                          </div>
                          <ul className="mt-1.5 space-y-1">
                            {selectedLandmarkEntry.attachedMuscles.map((muscleLabel, idx) => (
                              <li key={idx}>
                                <button
                                  type="button"
                                  data-testid={`inspector-attached-muscle-${idx}`}
                                  onClick={() =>
                                    viewportRef.current?.isolateAttachedMuscle?.(
                                      muscleLabel,
                                      selectedLandmarkEntry.side,
                                    )
                                  }
                                  className="flex w-full items-center gap-2 rounded-xl border border-[#d6e7dc] bg-[#f4faf6] px-2.5 py-1.5 text-left text-xs font-semibold text-[#16291f] transition hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-900 dark:border-[#233d2f] dark:bg-[#182b21] dark:text-[#e6f2ea] dark:hover:border-emerald-500 dark:hover:bg-emerald-950/60"
                                >
                                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                                  <span>{muscleLabel}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {selectedLandmarkEntry.clinicalNotes && !selectedEntry && (
                      <div className="rounded-xl bg-amber-50 p-2.5 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
                        <div className="flex items-center gap-1.5 font-bold">
                          <Stethoscope className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                          <span>Korelacja kliniczna i palpacja</span>
                        </div>
                        <p className="mt-1">{selectedLandmarkEntry.clinicalNotes}</p>
                      </div>
                    )}
                  </div>
                )}

                {selectedEntry ? (() => {
                  const labels = getStructureDetailLabels(selectedEntry.category);
                  return (
                    <div className="space-y-2.5 border-t border-[#e6f0ea] pt-3 text-xs leading-relaxed dark:border-[#233d2f]">
                      <div>
                        <span className="font-bold text-[#26382e] dark:text-[#e6f2ea]">
                          {labels.firstShort}:{' '}
                        </span>
                        <span className="text-[#354c3f] dark:text-[#c7dbcf]">{selectedEntry.pp}</span>
                      </div>
                      <div>
                        <span className="font-bold text-[#26382e] dark:text-[#e6f2ea]">
                          {labels.secondShort}:{' '}
                        </span>
                        <span className="text-[#354c3f] dark:text-[#c7dbcf]">{selectedEntry.pk}</span>
                      </div>
                      <div>
                        <span className="font-bold text-[#26382e] dark:text-[#e6f2ea]">Czynność: </span>
                        <span className="text-[#354c3f] dark:text-[#c7dbcf]">
                          {selectedEntry.functionDesc}
                        </span>
                      </div>
                      <div>
                        <span className="font-bold text-[#26382e] dark:text-[#e6f2ea]">
                          Unerwienie:{' '}
                        </span>
                        <span className="text-[#354c3f] dark:text-[#c7dbcf]">
                          {selectedEntry.innervation}{' '}
                          {selectedEntry.spinalSegments !== '—' && (
                            <span className="font-mono-tabular font-bold text-emerald-600 dark:text-emerald-400">
                              ({selectedEntry.spinalSegments})
                            </span>
                          )}
                        </span>
                      </div>
                      {selectedEntry.bloodSupply && (
                        <div>
                          <span className="font-bold text-[#26382e] dark:text-[#e6f2ea]">
                            Unaczynienie tętnicze:{' '}
                          </span>
                          <span className="text-[#354c3f] dark:text-[#c7dbcf]">
                            {selectedEntry.bloodSupply}
                          </span>
                        </div>
                      )}
                      <div className="rounded-xl bg-amber-50 p-2.5 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
                        <div className="flex items-center gap-1.5 font-bold">
                          <Stethoscope className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                          <span>Korelacja kliniczna</span>
                        </div>
                        <p className="mt-1">{selectedEntry.clinicalCorrelation}</p>
                      </div>
                      {selectedMuscleMovements.length > 0 && (
                        <div
                          data-testid="muscle-biomechanics-links"
                          className="rounded-xl border border-emerald-200 bg-[#f4faf6] p-2.5 dark:border-emerald-800/70 dark:bg-[#182b21]/80"
                        >
                          <div className="flex items-center gap-1.5 font-extrabold text-emerald-900 dark:text-emerald-200">
                            <Compass className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Udział w ruchach stawowych (Biomechanika 3D):</span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {selectedMuscleMovements.map(({ movement, role }) => (
                              <button
                                key={`${movement.id}_${role}`}
                                type="button"
                                data-testid={`muscle-biom-link-${movement.id}`}
                                onClick={() => selectBiomechanicsMovement(movement)}
                                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-extrabold transition ${
                                  role === 'agonist'
                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200'
                                    : role === 'synergist'
                                      ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200'
                                      : 'border-rose-300 bg-rose-50 text-rose-900 hover:bg-rose-100 dark:border-rose-700 dark:bg-rose-950/60 dark:text-rose-200'
                                }`}
                              >
                                <span>
                                  {role === 'agonist'
                                    ? 'Agon.'
                                    : role === 'synergist'
                                      ? 'Syn.'
                                      : 'Antag.'}
                                </span>
                                <span>• {movement.namePl}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedEntry.funFact && (
                        <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100">
                          <div className="flex items-center gap-1.5 font-bold">
                            <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Ciekawostka anatomiczna</span>
                          </div>
                          <p className="mt-1">{selectedEntry.funFact}</p>
                        </div>
                      )}
                    </div>
                  );
                })() : !selectedLandmarkEntry ? (
                  <div className="space-y-3 border-t border-[#e6f0ea] pt-3 text-xs leading-relaxed text-[#354c3f] dark:border-[#233d2f] dark:text-[#c7dbcf]">
                    <p>
                      Wybrano strukturę z trójwymiarowego modelu anatomicznego ({sceneParts.length} obiektów 3D). Możesz zbliżyć kamerę, ukryć warstwę lub przełączyć tryb stref kostnych i przyczepów PP/PK.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex items-start gap-3 text-[#354c3f] dark:text-[#c7dbcf]">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                <div>
                  <div className="font-display text-sm font-bold text-emerald-950 dark:text-white">
                    Kliknij strukturę na modelu 3D
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#52695b] dark:text-[#94b0a0]">
                    Kliknięta struktura podświetli się na modelu 3D i wyświetli tutaj najważniejsze informacje anatomiczne: nazwy PL/EN/łac., przyczepy (PP/PK), czynność, unerwienie i korelacje kliniczne.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
