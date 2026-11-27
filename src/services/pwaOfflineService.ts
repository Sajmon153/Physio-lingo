/**
 * PhysioLingo v6 — Offline PWA & 3D Model Cache Manager
 *
 * Manages Service Worker registration and regional 3D .glb packs stored in Cache Storage API
 * (`physiolingo-models-v6` and `physiolingo-app-v6`) so students can study 3D anatomy,
 * dermatomes, biomechanics, and clinical cases without internet access.
 */

export const PHYSIOLINGO_APP_CACHE = 'physiolingo-app-v7';
export const PHYSIOLINGO_MODELS_CACHE = 'physiolingo-models-v6';

export type OfflinePackId =
  | 'full_body'
  | 'head_neck'
  | 'torso'
  | 'upper_limbs'
  | 'lower_limbs';

export interface OfflineAssetDescriptor {
  url: string;
  bytes: number;
}

export interface OfflineModelPack {
  id: OfflinePackId;
  namePl: string;
  descriptionPl: string;
  assets: OfflineAssetDescriptor[];
  totalBytes: number;
}

export interface OfflinePackStatus {
  id: OfflinePackId;
  cachedCount: number;
  totalCount: number;
  cachedBytes: number;
  totalBytes: number;
  isComplete: boolean;
  percent: number;
}

export interface OfflineStorageSummary {
  supported: boolean;
  serviceWorkerState: 'unsupported' | 'unregistered' | 'installing' | 'active';
  coreReady: boolean;
  totalFiles: number;
  cachedFiles: number;
  totalBytes: number;
  cachedBytes: number;
  percent: number;
  packs: Record<OfflinePackId, OfflinePackStatus>;
}

export interface OfflineDownloadProgress {
  completedFiles: number;
  totalFiles: number;
  completedBytes: number;
  totalBytes: number;
  percent: number;
  currentUrl: string;
}

/**
 * Core 3D runtime assets (layer manifest + Draco WASM/JS decoders) required to decode all .glb files offline.
 */
export const CORE_OFFLINE_3D_ASSETS: OfflineAssetDescriptor[] = [
  { url: '/models/layers/manifest.json', bytes: 5331 },
  { url: '/draco/draco_decoder.js', bytes: 719410 },
  { url: '/draco/draco_decoder.wasm', bytes: 285747 },
  { url: '/draco/draco_wasm_wrapper.js', bytes: 58763 },
];

const RAW_PACKS: Array<Omit<OfflineModelPack, 'totalBytes'>> = [
  {
    id: 'full_body',
    namePl: 'Całe ciało 3D + 6 warstw',
    descriptionPl: 'Pełna sylwetka (kości, mięśnie, nerwy, naczynia, więzadła, narządy, skóra) — podstawa mapy dermatomów i ogólnego przeglądu.',
    assets: [
      { url: '/models/body.glb', bytes: 8249484 },
      { url: '/models/layers/full_body/arteries.glb', bytes: 966628 },
      { url: '/models/layers/full_body/ligaments.glb', bytes: 700120 },
      { url: '/models/layers/full_body/nerves.glb', bytes: 1467944 },
      { url: '/models/layers/full_body/organs.glb', bytes: 492644 },
      { url: '/models/layers/full_body/skin.glb', bytes: 406440 },
      { url: '/models/layers/full_body/veins.glb', bytes: 523584 },
    ],
  },
  {
    id: 'head_neck',
    namePl: 'Głowa i szyja 3D + 6 warstw',
    descriptionPl: 'Czaszka, żuchwa, mięśnie szyi, nerwy czaszkowe i naczynia szyjne — lekcje głowy, karku i stawu skroniowo-żuchwowego.',
    assets: [
      { url: '/models/regional/head_neck.glb', bytes: 1199720 },
      { url: '/models/layers/head_neck/arteries.glb', bytes: 425604 },
      { url: '/models/layers/head_neck/ligaments.glb', bytes: 79516 },
      { url: '/models/layers/head_neck/nerves.glb', bytes: 913112 },
      { url: '/models/layers/head_neck/organs.glb', bytes: 86892 },
      { url: '/models/layers/head_neck/skin.glb', bytes: 155440 },
      { url: '/models/layers/head_neck/veins.glb', bytes: 117148 },
    ],
  },
  {
    id: 'torso',
    namePl: 'Tułów, kręgosłup i narządy 3D',
    descriptionPl: 'Kręgosłup, klatka piersiowa, miednica oraz wszystkie warstwy trzewne i naczyniowe tułowia.',
    assets: [
      { url: '/models/regional/torso.glb', bytes: 1136528 },
      { url: '/models/layers/torso/arteries.glb', bytes: 277528 },
      { url: '/models/layers/torso/ligaments.glb', bytes: 195184 },
      { url: '/models/layers/torso/nerves.glb', bytes: 254992 },
      { url: '/models/layers/torso/organs.glb', bytes: 416332 },
      { url: '/models/layers/torso/skin.glb', bytes: 59344 },
      { url: '/models/layers/torso/veins.glb', bytes: 213240 },
    ],
  },
  {
    id: 'upper_limbs',
    namePl: 'Kończyny górne (P + L) + warstwy',
    descriptionPl: 'Bark, łokieć, przedramię, nadgarstek i ręka po obu stronach — testy barku, biomechanika i splot ramienny.',
    assets: [
      { url: '/models/regional/upper_limb_right.glb', bytes: 1034048 },
      { url: '/models/regional/upper_limb_left.glb', bytes: 1018692 },
      { url: '/models/layers/upper_limb_right/arteries.glb', bytes: 62536 },
      { url: '/models/layers/upper_limb_right/ligaments.glb', bytes: 101648 },
      { url: '/models/layers/upper_limb_right/nerves.glb', bytes: 90980 },
      { url: '/models/layers/upper_limb_right/skin.glb', bytes: 53280 },
      { url: '/models/layers/upper_limb_right/veins.glb', bytes: 51732 },
      { url: '/models/layers/upper_limb_left/arteries.glb', bytes: 60836 },
      { url: '/models/layers/upper_limb_left/ligaments.glb', bytes: 105904 },
      { url: '/models/layers/upper_limb_left/nerves.glb', bytes: 96148 },
      { url: '/models/layers/upper_limb_left/skin.glb', bytes: 54364 },
      { url: '/models/layers/upper_limb_left/veins.glb', bytes: 49400 },
    ],
  },
  {
    id: 'lower_limbs',
    namePl: 'Kończyny dolne (P + L) + warstwy',
    descriptionPl: 'Biodro, kolano, podudzie i stopa po obu stronach — ACL/łąkotki, biomechanika, dermatomy L2–S1 i nerw kulszowy.',
    assets: [
      { url: '/models/regional/lower_limb_right.glb', bytes: 943652 },
      { url: '/models/regional/lower_limb_left.glb', bytes: 940400 },
      { url: '/models/layers/lower_limb_right/arteries.glb', bytes: 99588 },
      { url: '/models/layers/lower_limb_right/ligaments.glb', bytes: 136012 },
      { url: '/models/layers/lower_limb_right/nerves.glb', bytes: 82376 },
      { url: '/models/layers/lower_limb_right/skin.glb', bytes: 69004 },
      { url: '/models/layers/lower_limb_right/veins.glb', bytes: 74740 },
      { url: '/models/layers/lower_limb_left/arteries.glb', bytes: 97116 },
      { url: '/models/layers/lower_limb_left/ligaments.glb', bytes: 140788 },
      { url: '/models/layers/lower_limb_left/nerves.glb', bytes: 85736 },
      { url: '/models/layers/lower_limb_left/skin.glb', bytes: 70620 },
      { url: '/models/layers/lower_limb_left/veins.glb', bytes: 73136 },
    ],
  },
];

export const OFFLINE_MODEL_PACKS: OfflineModelPack[] = RAW_PACKS.map((pack) => ({
  ...pack,
  totalBytes: pack.assets.reduce((acc, item) => acc + item.bytes, 0),
}));

export const TOTAL_OFFLINE_3D_FILES = OFFLINE_MODEL_PACKS.reduce(
  (sum, pack) => sum + pack.assets.length,
  0,
);

export const TOTAL_OFFLINE_3D_BYTES = OFFLINE_MODEL_PACKS.reduce(
  (sum, pack) => sum + pack.totalBytes,
  0,
);

/**
 * Formats a byte size cleanly using Polish decimal comma formatting (e.g. "2,4 MB", "22,8 MB").
 */
export function formatBytesPl(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1).replace('.', ',')} MB`;
}

export function isOfflineCacheSupported(): boolean {
  return typeof window !== 'undefined' && 'caches' in window;
}

export function isStandalonePwaMode(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    nav.standalone === true
  );
}

/**
 * Registers /sw.js safely without throwing on unsupported or non-secure contexts.
 */
export async function registerPhysioServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return registration;
  } catch (err) {
    console.warn('[PhysioLingo PWA] Service Worker registration skipped:', err);
    return null;
  }
}

async function getServiceWorkerState(): Promise<OfflineStorageSummary['serviceWorkerState']> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return 'unsupported';
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    if (!reg) return 'unregistered';
    if (reg.active) return 'active';
    if (reg.installing || reg.waiting) return 'installing';
    return 'unregistered';
  } catch {
    return 'unregistered';
  }
}

function buildEmptyPackStatuses(): Record<OfflinePackId, OfflinePackStatus> {
  const result = {} as Record<OfflinePackId, OfflinePackStatus>;
  for (const pack of OFFLINE_MODEL_PACKS) {
    result[pack.id] = {
      id: pack.id,
      cachedCount: 0,
      totalCount: pack.assets.length,
      cachedBytes: 0,
      totalBytes: pack.totalBytes,
      isComplete: false,
      percent: 0,
    };
  }
  return result;
}

/**
 * Inspects browser Cache Storage API to report exact per-region 3D offline readiness.
 */
export async function getOfflineCacheStatus(): Promise<OfflineStorageSummary> {
  const swState = await getServiceWorkerState();
  const emptyPacks = buildEmptyPackStatuses();

  if (!isOfflineCacheSupported()) {
    return {
      supported: false,
      serviceWorkerState: swState,
      coreReady: false,
      totalFiles: TOTAL_OFFLINE_3D_FILES,
      cachedFiles: 0,
      totalBytes: TOTAL_OFFLINE_3D_BYTES,
      cachedBytes: 0,
      percent: 0,
      packs: emptyPacks,
    };
  }

  try {
    const [modelsCache, appCache] = await Promise.all([
      caches.open(PHYSIOLINGO_MODELS_CACHE),
      caches.open(PHYSIOLINGO_APP_CACHE),
    ]);

    const [modelKeys, appKeys] = await Promise.all([
      modelsCache.keys(),
      appCache.keys(),
    ]);

    const cachedPathSet = new Set<string>();
    for (const req of [...modelKeys, ...appKeys]) {
      try {
        cachedPathSet.add(new URL(req.url).pathname);
      } catch {
        // Ignore malformed cache keys
      }
    }

    const coreReady = CORE_OFFLINE_3D_ASSETS.every((asset) => cachedPathSet.has(asset.url));

    let totalCachedFiles = 0;
    let totalCachedBytes = 0;

    for (const pack of OFFLINE_MODEL_PACKS) {
      let cachedCount = 0;
      let cachedBytes = 0;
      for (const asset of pack.assets) {
        if (cachedPathSet.has(asset.url)) {
          cachedCount += 1;
          cachedBytes += asset.bytes;
        }
      }
      totalCachedFiles += cachedCount;
      totalCachedBytes += cachedBytes;

      emptyPacks[pack.id] = {
        id: pack.id,
        cachedCount,
        totalCount: pack.assets.length,
        cachedBytes,
        totalBytes: pack.totalBytes,
        isComplete: cachedCount === pack.assets.length,
        percent:
          pack.assets.length > 0 ? Math.round((cachedCount / pack.assets.length) * 100) : 0,
      };
    }

    return {
      supported: true,
      serviceWorkerState: swState,
      coreReady,
      totalFiles: TOTAL_OFFLINE_3D_FILES,
      cachedFiles: totalCachedFiles,
      totalBytes: TOTAL_OFFLINE_3D_BYTES,
      cachedBytes: totalCachedBytes,
      percent:
        TOTAL_OFFLINE_3D_FILES > 0
          ? Math.round((totalCachedFiles / TOTAL_OFFLINE_3D_FILES) * 100)
          : 0,
      packs: emptyPacks,
    };
  } catch {
    return {
      supported: true,
      serviceWorkerState: swState,
      coreReady: false,
      totalFiles: TOTAL_OFFLINE_3D_FILES,
      cachedFiles: 0,
      totalBytes: TOTAL_OFFLINE_3D_BYTES,
      cachedBytes: 0,
      percent: 0,
      packs: emptyPacks,
    };
  }
}

async function cacheAssetBatch(
  assets: OfflineAssetDescriptor[],
  onProgress?: (progress: OfflineDownloadProgress) => void,
  concurrency = 3,
): Promise<{ succeeded: number; failed: string[] }> {
  if (!isOfflineCacheSupported()) {
    throw new Error('Przeglądarka nie obsługuje pamięci podręcznej Cache API.');
  }

  const [modelsCache, appCache] = await Promise.all([
    caches.open(PHYSIOLINGO_MODELS_CACHE),
    caches.open(PHYSIOLINGO_APP_CACHE),
  ]);

  const totalFiles = assets.length;
  const totalBytes = assets.reduce((sum, item) => sum + item.bytes, 0);
  let completedFiles = 0;
  let completedBytes = 0;
  let succeeded = 0;
  const failed: string[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < assets.length) {
      const idx = cursor++;
      const asset = assets[idx];
      const targetCache = asset.url.endsWith('.glb') ? modelsCache : appCache;

      try {
        const existing = await targetCache.match(asset.url, { ignoreSearch: true });
        if (!existing) {
          const response = await fetch(asset.url, { cache: 'default' });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          await targetCache.put(asset.url, response.clone());
        }
        succeeded += 1;
      } catch {
        failed.push(asset.url);
      } finally {
        completedFiles += 1;
        completedBytes += asset.bytes;
        onProgress?.({
          completedFiles,
          totalFiles,
          completedBytes,
          totalBytes,
          percent: totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 100,
          currentUrl: asset.url,
        });
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, assets.length) }, () => worker());
  await Promise.all(workers);

  return { succeeded, failed };
}

/**
 * Downloads a single regional 3D model pack (plus Draco decoders & layer manifest) into Cache API.
 */
export async function downloadOfflinePack(
  packId: OfflinePackId,
  onProgress?: (progress: OfflineDownloadProgress) => void,
): Promise<{ succeeded: number; failed: string[] }> {
  const pack = OFFLINE_MODEL_PACKS.find((p) => p.id === packId);
  if (!pack) {
    throw new Error(`Nieznany pakiet offline: ${packId}`);
  }
  const batch = [...CORE_OFFLINE_3D_ASSETS, ...pack.assets];
  return cacheAssetBatch(batch, onProgress, 3);
}

/**
 * Downloads all 5 regional 3D model packs (all 45 .glb files + Draco decoders) for 100% offline 3D study.
 */
export async function downloadAllOfflinePacks(
  onProgress?: (progress: OfflineDownloadProgress) => void,
): Promise<{ succeeded: number; failed: string[] }> {
  const allAssets: OfflineAssetDescriptor[] = [
    ...CORE_OFFLINE_3D_ASSETS,
    ...OFFLINE_MODEL_PACKS.flatMap((pack) => pack.assets),
  ];
  return cacheAssetBatch(allAssets, onProgress, 3);
}

/**
 * Deletes cached .glb files belonging to a specific regional pack.
 */
export async function removeOfflinePack(packId: OfflinePackId): Promise<void> {
  if (!isOfflineCacheSupported()) return;
  const pack = OFFLINE_MODEL_PACKS.find((p) => p.id === packId);
  if (!pack) return;
  const modelsCache = await caches.open(PHYSIOLINGO_MODELS_CACHE);
  await Promise.all(
    pack.assets.map((asset) => modelsCache.delete(asset.url, { ignoreSearch: true })),
  );
}

/**
 * Clears all cached 3D .glb models while keeping the core App Shell intact.
 */
export async function clearOfflineModelCache(): Promise<void> {
  if (!isOfflineCacheSupported()) return;
  await caches.delete(PHYSIOLINGO_MODELS_CACHE);
}

// ============================================================================
// IMMEDIATE APP DOWNLOAD / PWA INSTALL DETECTION & LINK HELPERS
// ============================================================================

export type InstallPlatformTab = 'mobile' | 'desktop';
export type DetectedOsKind = 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'other';

export interface InstallEnvironmentInfo {
  isStandalone: boolean;
  defaultTab: InstallPlatformTab;
  os: DetectedOsKind;
  /** True when opened inside Messenger, Instagram, Facebook, TikTok or similar WebView */
  isInAppBrowser: boolean;
  browser: 'chromium' | 'safari' | 'firefox' | 'other';
}

export const INSTALL_PROMPT_DISMISSED_SESSION_KEY = 'physiolingo_install_prompt_dismissed_v1';

/**
 * Detects OS, browser engine, Messenger/Instagram WebView, and ideal default tab ('mobile' vs 'desktop')
 * so visitors opening a shared link immediately get tailored download instructions or 1-click install.
 */
export function detectInstallEnvironment(
  userAgent?: string,
  maxTouchPoints?: number,
  standaloneOverride?: boolean,
): InstallEnvironmentInfo {
  const ua =
    userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent || '' : '');
  const touchPts =
    maxTouchPoints ?? (typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0);
  const isStandalone = standaloneOverride ?? isStandalonePwaMode();

  const isInAppBrowser =
    /\b(FBAN|FBAV|FB_IAB|Messenger|Instagram|BytedanceWebview|musical_ly|TikTok|Line\/|LinkedInApp)\b/i.test(
      ua,
    );

  // iPadOS 13+ reports Macintosh in UA with maxTouchPoints > 1
  const isIos =
    /\b(iPhone|iPad|iPod)\b/i.test(ua) || (/Macintosh/i.test(ua) && touchPts > 1);
  const isAndroid = /\bAndroid\b/i.test(ua);

  let os: DetectedOsKind = 'other';
  if (isIos) os = 'ios';
  else if (isAndroid) os = 'android';
  else if (/Windows/i.test(ua)) os = 'windows';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macos';
  else if (/Linux|CrOS/i.test(ua)) os = 'linux';

  const defaultTab: InstallPlatformTab =
    os === 'ios' || os === 'android' || /\bMobile\b/i.test(ua) ? 'mobile' : 'desktop';

  let browser: InstallEnvironmentInfo['browser'] = 'other';
  if (/Firefox|FxiOS/i.test(ua)) {
    browser = 'firefox';
  } else if (/Chrome|CriOS|Edg|OPR|SamsungBrowser|Brave/i.test(ua) && !isIos) {
    browser = 'chromium';
  } else if (/Safari/i.test(ua) && !/Chrome|CriOS|Edg|OPR|Android/i.test(ua)) {
    browser = 'safari';
  }

  return {
    isStandalone,
    defaultTab,
    os,
    isInAppBrowser,
    browser,
  };
}

/**
 * Decides whether the "Pobierz aplikację na telefon lub komputer" modal should open immediately on page load:
 * - Never if already running as an installed standalone app
 * - Always if the shared URL contains `?install=1` or `?pobierz=1`
 * - Immediately on every fresh visit in a browser tab until dismissed in that session
 */
export function shouldAutoShowInstallModal(params: {
  isStandalone: boolean;
  search: string;
  dismissedInSession: boolean;
}): boolean {
  if (params.isStandalone) return false;
  const query = new URLSearchParams(params.search || '');
  if (query.get('install') === '1' || query.get('pobierz') === '1') {
    return true;
  }
  return !params.dismissedInSession;
}

/**
 * Builds an Android `intent://` deep link that breaks out of Messenger/Instagram WebView directly into Google Chrome.
 */
export function buildAndroidChromeIntentUrl(currentHref: string): string {
  try {
    const parsed = new URL(currentHref);
    parsed.searchParams.set('install', '1');
    const hostAndPath = `${parsed.host}${parsed.pathname}${parsed.search}`;
    return `intent://${hostAndPath}#Intent;scheme=${parsed.protocol.replace(':', '')};package=com.android.chrome;end`;
  } catch {
    return currentHref;
  }
}

export function buildDirectInstallShareUrl(origin: string): string {
  const clean = origin.replace(/\/+$/, '');
  return `${clean}/?install=1`;
}
