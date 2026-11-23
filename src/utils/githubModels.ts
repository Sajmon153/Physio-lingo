export interface GitHubTreeNode {
  path: string;
  type: string;
  size?: number;
}

export interface GitHubModelEntry {
  id: string;
  label: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
  cdnUrl: string;
}

export const BUILTIN_ANATOMY_REPOS: Array<{ owner: string; repo: string; branch: string; note: string }> = [
  {
    owner: 'ashemag',
    repo: 'human-atlas',
    branch: 'main',
    note: 'Atlas anatomii (GitHub)',
  },
  {
    owner: 'hpfrei',
    repo: 'body-anatomy-3d-viewer',
    branch: 'main',
    note: 'Pełne ciało — mięśnie i kości',
  },
  {
    owner: 'organui',
    repo: 'muscles-3d',
    branch: 'main',
    note: 'Układ mięśniowy (177 mięśni)',
  },
  {
    owner: 'organui',
    repo: 'skeleton-3d',
    branch: 'main',
    note: 'Układ kostny (242 kości)',
  },
  {
    owner: 'abhitsian',
    repo: 'kinetic-atlas',
    branch: 'main',
    note: 'Atlas kinetyczny 3D',
  },
];

export function buildJsDelivrUrl(
  owner: string,
  repo: string,
  branch: string,
  path: string,
): string {
  const cleanPath = path.replace(/^\/+/, '');
  return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${cleanPath}`;
}

export function formatGitHubModelLabel(owner: string, repo: string, path: string): string {
  const fileName = path.split('/').pop() ?? path;
  const baseName = fileName.replace(/\.(glb|gltf)$/i, '').replace(/[_-]+/g, ' ');
  const lower = baseName.toLowerCase();
  let polishHint = baseName;
  if (lower === 'body') polishHint = 'Pełny model ciała człowieka (mięśnie + kości)';
  else if (lower === 'muscles') polishHint = 'Układ mięśniowy człowieka';
  else if (lower === 'skeleton') polishHint = 'Szkielet człowieka (kości)';
  else if (lower === 'anatomy') polishHint = 'Atlas anatomiczny całego ciała';
  else if (lower === 'head') polishHint = 'Anatomia głowy i szyi';

  return `${polishHint} — ${owner}/${repo} (${fileName})`;
}

export function extractGlbModelsFromTree(
  owner: string,
  repo: string,
  branch: string,
  tree: GitHubTreeNode[],
): GitHubModelEntry[] {
  return tree
    .filter(
      (node) =>
        (node.type === 'blob' || !node.type) &&
        /\.(glb|gltf)$/i.test(node.path),
    )
    .map((node) => ({
      id: `gh_${owner}_${repo}_${branch}_${node.path}`,
      label: formatGitHubModelLabel(owner, repo, node.path),
      owner,
      repo,
      branch,
      path: node.path,
      cdnUrl: buildJsDelivrUrl(owner, repo, branch, node.path),
    }));
}

export function parseOwnerRepo(input: string): { owner: string; repo: string } | null {
  const trimmed = input
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '');
  const match = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

export const BUILTIN_VERIFIED_GITHUB_FALLBACK: GitHubModelEntry[] = [
  {
    id: 'gh_hpfrei_body-anatomy-3d-viewer_main_public/body.glb',
    label: formatGitHubModelLabel('hpfrei', 'body-anatomy-3d-viewer', 'public/body.glb'),
    owner: 'hpfrei',
    repo: 'body-anatomy-3d-viewer',
    branch: 'main',
    path: 'public/body.glb',
    cdnUrl: buildJsDelivrUrl('hpfrei', 'body-anatomy-3d-viewer', 'main', 'public/body.glb'),
  },
  {
    id: 'gh_organui_muscles-3d_main_public/models/muscles.glb',
    label: formatGitHubModelLabel('organui', 'muscles-3d', 'public/models/muscles.glb'),
    owner: 'organui',
    repo: 'muscles-3d',
    branch: 'main',
    path: 'public/models/muscles.glb',
    cdnUrl: buildJsDelivrUrl('organui', 'muscles-3d', 'main', 'public/models/muscles.glb'),
  },
  {
    id: 'gh_organui_skeleton-3d_main_public/models/skeleton.glb',
    label: formatGitHubModelLabel('organui', 'skeleton-3d', 'public/models/skeleton.glb'),
    owner: 'organui',
    repo: 'skeleton-3d',
    branch: 'main',
    path: 'public/models/skeleton.glb',
    cdnUrl: buildJsDelivrUrl('organui', 'skeleton-3d', 'main', 'public/models/skeleton.glb'),
  },
  {
    id: 'gh_abhitsian_kinetic-atlas_main_data/anatomy.glb',
    label: formatGitHubModelLabel('abhitsian', 'kinetic-atlas', 'data/anatomy.glb'),
    owner: 'abhitsian',
    repo: 'kinetic-atlas',
    branch: 'main',
    path: 'data/anatomy.glb',
    cdnUrl: buildJsDelivrUrl('abhitsian', 'kinetic-atlas', 'main', 'data/anatomy.glb'),
  },
  {
    id: 'gh_abhitsian_kinetic-atlas_main_data/head.glb',
    label: formatGitHubModelLabel('abhitsian', 'kinetic-atlas', 'data/head.glb'),
    owner: 'abhitsian',
    repo: 'kinetic-atlas',
    branch: 'main',
    path: 'data/head.glb',
    cdnUrl: buildJsDelivrUrl('abhitsian', 'kinetic-atlas', 'main', 'data/head.glb'),
  },
];

const CACHE_KEY = 'physiolingo_gh_models_cache_v1';
const CACHE_TTL_MS = 30 * 60 * 1000;
let memoryModelsCache: GitHubModelEntry[] | null = null;

function readCachedModels(): GitHubModelEntry[] | null {
  if (memoryModelsCache && memoryModelsCache.length > 0) return memoryModelsCache;
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; models: GitHubModelEntry[] };
    if (Date.now() - parsed.ts < CACHE_TTL_MS && Array.isArray(parsed.models) && parsed.models.length > 0) {
      memoryModelsCache = parsed.models;
      return parsed.models;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

function writeCachedModels(models: GitHubModelEntry[]): void {
  if (models.length === 0) return;
  memoryModelsCache = models;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), models }));
    }
  } catch {
    // ignore storage errors
  }
}

export async function fetchRepoGlbModels(
  owner: string,
  repo: string,
  preferredBranch = 'main',
  signal?: AbortSignal,
): Promise<GitHubModelEntry[]> {
  let branch = preferredBranch;
  let treeResp = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    {
      signal,
      headers: { Accept: 'application/vnd.github+json' },
    },
  );

  // Only query repo metadata if preferredBranch was not found (e.g. default_branch is "master")
  if (treeResp.status === 404) {
    const repoResp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      signal,
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (repoResp.ok) {
      const repoJson = (await repoResp.json()) as { default_branch?: string };
      if (repoJson.default_branch && repoJson.default_branch !== branch) {
        branch = repoJson.default_branch;
        treeResp = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
          {
            signal,
            headers: { Accept: 'application/vnd.github+json' },
          },
        );
      }
    }
  }

  if (!treeResp.ok) {
    throw new Error(`GitHub API HTTP ${treeResp.status}`);
  }
  const remaining = treeResp.headers.get('x-ratelimit-remaining');
  const treeJson = (await treeResp.json()) as { tree?: GitHubTreeNode[] };
  const models = extractGlbModelsFromTree(owner, repo, branch, treeJson.tree ?? []);
  if (remaining === '0') {
    rateLimitExhaustedUntil = Date.now() + 5 * 60 * 1000;
  }
  return models;
}

let rateLimitExhaustedUntil = 0;

export async function discoverBuiltInGitHubModels(
  signal?: AbortSignal,
): Promise<GitHubModelEntry[]> {
  const cached = readCachedModels();
  if (cached) return cached;

  if (Date.now() < rateLimitExhaustedUntil) {
    return BUILTIN_VERIFIED_GITHUB_FALLBACK;
  }

  const collected: GitHubModelEntry[] = [];
  const seenUrls = new Set<string>();

  let rateLimited = false;
  for (const item of BUILTIN_ANATOMY_REPOS) {
    if (signal?.aborted || rateLimited || Date.now() < rateLimitExhaustedUntil) break;
    try {
      const entries = await fetchRepoGlbModels(item.owner, item.repo, item.branch, signal);
      for (const entry of entries) {
        if (!seenUrls.has(entry.cdnUrl)) {
          seenUrls.add(entry.cdnUrl);
          collected.push(entry);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('403') || msg.includes('429')) {
        rateLimited = true;
        rateLimitExhaustedUntil = Date.now() + 5 * 60 * 1000;
      }
    }
  }

  if (collected.length > 0) {
    for (const fallback of BUILTIN_VERIFIED_GITHUB_FALLBACK) {
      if (!seenUrls.has(fallback.cdnUrl)) {
        seenUrls.add(fallback.cdnUrl);
        collected.push(fallback);
      }
    }
    writeCachedModels(collected);
    return collected;
  }

  // Fallback to verified jsDelivr GitHub manifest if GitHub API is rate-limited
  return BUILTIN_VERIFIED_GITHUB_FALLBACK;
}

export async function searchGitHubAnatomyModels(
  queryOrRepo: string,
  signal?: AbortSignal,
): Promise<{ models: GitHubModelEntry[]; scannedRepos: number }> {
  const direct = parseOwnerRepo(queryOrRepo);
  if (direct) {
    try {
      const models = await fetchRepoGlbModels(direct.owner, direct.repo, 'main', signal);
      return { models, scannedRepos: 1 };
    } catch (err) {
      const known = BUILTIN_VERIFIED_GITHUB_FALLBACK.filter(
        (m) =>
          m.owner.toLowerCase() === direct.owner.toLowerCase() &&
          m.repo.toLowerCase() === direct.repo.toLowerCase(),
      );
      if (known.length > 0) {
        return { models: known, scannedRepos: 1 };
      }
      throw err;
    }
  }

  const q = queryOrRepo.trim() || 'anatomy 3d glb';
  const searchResp = await fetch(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&per_page=5`,
    {
      signal,
      headers: { Accept: 'application/vnd.github+json' },
    },
  );

  if (!searchResp.ok) {
    throw new Error(`Wyszukiwanie GitHub HTTP ${searchResp.status}`);
  }

  const searchJson = (await searchResp.json()) as {
    items?: Array<{ full_name: string; default_branch?: string }>;
  };
  const items = searchJson.items ?? [];

  const treeResults = await Promise.allSettled(
    items.map((repoItem) => {
      const [owner, repo] = repoItem.full_name.split('/');
      return fetchRepoGlbModels(owner, repo, repoItem.default_branch ?? 'main', signal);
    }),
  );

  const models: GitHubModelEntry[] = [];
  const seen = new Set<string>();
  for (const res of treeResults) {
    if (res.status === 'fulfilled') {
      for (const entry of res.value) {
        if (!seen.has(entry.cdnUrl)) {
          seen.add(entry.cdnUrl);
          models.push(entry);
        }
      }
    }
  }

  return { models, scannedRepos: items.length };
}

