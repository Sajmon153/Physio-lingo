import type { UserProgress } from '../types/anatomy';
import type {
  AuthSessionPayload,
  AuthSuccessPayload,
  ChangePasswordInput,
  LoginAccountInput,
  ProgressSyncResult,
  RegisterAccountInput,
  UserAccountPublic,
  UserAccountStoreAdapter,
} from '../types/auth';
import { createInitialProgress, sanitizeProgressObject } from '../utils/gameLogic';

const ACCOUNTS_KEY = 'physiolingo_local_accounts_v1';
const SESSION_KEY = 'physiolingo_local_session_v1';
const PROGRESS_PREFIX = 'physiolingo_account_progress_v1_';
const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,24}$/;

interface LocalStoredAccount {
  id: string;
  username: string;
  usernameNormalized: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
}

interface LocalSessionRecord {
  userId: string;
  createdAt: string;
}

export interface KeyValueStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function generateSaltHex(len = 16): string {
  const bytes = new Uint8Array(len);
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < len; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToHex(bytes);
}

// Pure-JS SHA-256 fallback for insecure HTTP LAN contexts where window.crypto.subtle is unavailable
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256Bytes(data: Uint8Array): Uint8Array {
  const bitLen = data.length * 8;
  const paddedLen = Math.ceil((data.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 =
        ((w[i - 15] >>> 7) | (w[i - 15] << 25)) ^
        ((w[i - 15] >>> 18) | (w[i - 15] << 14)) ^
        (w[i - 15] >>> 3);
      const s1 =
        ((w[i - 2] >>> 17) | (w[i - 2] << 15)) ^
        ((w[i - 2] >>> 19) | (w[i - 2] << 13)) ^
        (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  outView.setUint32(20, h5, false);
  outView.setUint32(24, h6, false);
  outView.setUint32(28, h7, false);
  return out;
}

async function deriveLocalHash(password: string, saltHex: string, mode: 'pbkdf2' | 'sha256iter', iterations: number): Promise<string> {
  const enc = new TextEncoder();
  if (
    mode === 'pbkdf2' &&
    typeof globalThis.crypto !== 'undefined' &&
    globalThis.crypto.subtle
  ) {
    const keyMaterial = await globalThis.crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits'],
    );
    const saltBytes = hexToBytes(saltHex);
    const bits = await globalThis.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes.buffer as ArrayBuffer,
        iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      256,
    );
    return bytesToHex(new Uint8Array(bits));
  }

  // Fallback iterative salted SHA-256 for non-secure HTTP contexts
  const saltBytes = hexToBytes(saltHex);
  const passBytes = enc.encode(password);
  let buf: Uint8Array = new Uint8Array(saltBytes.length + passBytes.length);
  buf.set(saltBytes);
  buf.set(passBytes, saltBytes.length);
  for (let i = 0; i < iterations; i++) {
    const digest = sha256Bytes(buf);
    const next = new Uint8Array(digest.length + saltBytes.length);
    next.set(digest);
    next.set(saltBytes, digest.length);
    buf = next;
  }
  return bytesToHex(sha256Bytes(buf));
}

export async function hashPasswordLocal(password: string): Promise<string> {
  const saltHex = generateSaltHex(16);
  const hasSubtle =
    typeof globalThis.crypto !== 'undefined' && Boolean(globalThis.crypto.subtle);
  const mode = hasSubtle ? 'pbkdf2' : 'sha256iter';
  const iterations = hasSubtle ? 100000 : 8000;
  const digestHex = await deriveLocalHash(password, saltHex, mode, iterations);
  return `${mode}$${iterations}$${saltHex}$${digestHex}`;
}

export async function verifyPasswordLocal(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4) return false;
  const [modeRaw, iterRaw, saltHex, expectedHex] = parts;
  if (modeRaw !== 'pbkdf2' && modeRaw !== 'sha256iter') return false;
  const iterations = Number(iterRaw);
  if (!Number.isFinite(iterations) || iterations <= 0 || !saltHex || !expectedHex) return false;
  try {
    const actualHex = await deriveLocalHash(password, saltHex, modeRaw, iterations);
    return constantTimeEqualHex(actualHex, expectedHex);
  } catch {
    return false;
  }
}

export function validateUsernameClient(username: string): string | null {
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 24) {
    return 'Login musi mieć od 3 do 24 znaków.';
  }
  if (!USERNAME_REGEX.test(trimmed)) {
    return 'Login może zawierać tylko litery, cyfry oraz znaki . _ - (bez spacji).';
  }
  return null;
}

export function validatePasswordClient(password: string): string | null {
  if (password.length < 6) {
    return 'Hasło musi mieć co najmniej 6 znaków.';
  }
  if (password.length > 128) {
    return 'Hasło nie może przekraczać 128 znaków.';
  }
  return null;
}

function toPublicLocalAccount(acc: LocalStoredAccount): UserAccountPublic {
  return {
    id: acc.id,
    username: acc.username,
    displayName: acc.displayName,
    createdAt: acc.createdAt,
    updatedAt: acc.updatedAt,
    lastLoginAt: acc.lastLoginAt,
    storageBackend: 'local',
  };
}

export class LocalBrowserAuthAdapter implements UserAccountStoreAdapter {
  readonly backendKind = 'local' as const;
  private readonly storage: KeyValueStorageLike | null;

  constructor(storage?: KeyValueStorageLike | null) {
    if (storage !== undefined) {
      this.storage = storage;
    } else if (typeof window !== 'undefined' && window.localStorage) {
      this.storage = window.localStorage;
    } else {
      this.storage = null;
    }
  }

  private readAccounts(): LocalStoredAccount[] {
    if (!this.storage) return [];
    try {
      const raw = this.storage.getItem(ACCOUNTS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as LocalStoredAccount[]) : [];
    } catch {
      return [];
    }
  }

  private writeAccounts(accounts: LocalStoredAccount[]): void {
    this.storage?.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  }

  private readSession(): LocalSessionRecord | null {
    if (!this.storage) return null;
    try {
      const raw = this.storage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<LocalSessionRecord>;
      if (parsed && typeof parsed.userId === 'string') {
        return { userId: parsed.userId, createdAt: parsed.createdAt ?? new Date().toISOString() };
      }
      return null;
    } catch {
      return null;
    }
  }

  private writeSession(userId: string): void {
    this.storage?.setItem(
      SESSION_KEY,
      JSON.stringify({ userId, createdAt: new Date().toISOString() }),
    );
  }

  private readProgressForUser(userId: string): UserProgress {
    if (!this.storage) return createInitialProgress();
    try {
      const raw = this.storage.getItem(`${PROGRESS_PREFIX}${userId}`);
      if (!raw) return createInitialProgress();
      return sanitizeProgressObject(JSON.parse(raw) as Partial<UserProgress>);
    } catch {
      return createInitialProgress();
    }
  }

  private writeProgressForUser(userId: string, progress: UserProgress): void {
    this.storage?.setItem(
      `${PROGRESS_PREFIX}${userId}`,
      JSON.stringify(sanitizeProgressObject(progress)),
    );
  }

  async getCurrentSession(): Promise<AuthSessionPayload> {
    const session = this.readSession();
    if (!session) {
      return { user: null, progress: null, backend: 'local' };
    }
    const account = this.readAccounts().find((a) => a.id === session.userId);
    if (!account) {
      this.storage?.removeItem(SESSION_KEY);
      return { user: null, progress: null, backend: 'local' };
    }
    return {
      user: toPublicLocalAccount(account),
      progress: this.readProgressForUser(account.id),
      backend: 'local',
    };
  }

  async register(input: RegisterAccountInput): Promise<AuthSuccessPayload> {
    const userErr = validateUsernameClient(input.username);
    if (userErr) throw new Error(userErr);
    const passErr = validatePasswordClient(input.password);
    if (passErr) throw new Error(passErr);

    const norm = input.username.trim().toLowerCase();
    const accounts = this.readAccounts();
    if (accounts.some((a) => a.usernameNormalized === norm)) {
      throw new Error('Ten login jest już zajęty. Wybierz inną nazwę użytkownika lub zaloguj się.');
    }

    const nowIso = new Date().toISOString();
    const id = `local_${Date.now().toString(36)}_${generateSaltHex(6)}`;
    const passwordHash = await hashPasswordLocal(input.password);
    const account: LocalStoredAccount = {
      id,
      username: input.username.trim(),
      usernameNormalized: norm,
      displayName: (input.displayName?.trim() || input.username.trim()).slice(0, 40),
      passwordHash,
      createdAt: nowIso,
      updatedAt: nowIso,
      lastLoginAt: nowIso,
    };

    const progress = sanitizeProgressObject(input.initialProgress ?? createInitialProgress());
    accounts.push(account);
    this.writeAccounts(accounts);
    this.writeProgressForUser(account.id, progress);
    this.writeSession(account.id);

    return {
      user: toPublicLocalAccount(account),
      progress,
      backend: 'local',
    };
  }

  async login(input: LoginAccountInput): Promise<AuthSuccessPayload> {
    const norm = input.username.trim().toLowerCase();
    const accounts = this.readAccounts();
    const idx = accounts.findIndex((a) => a.usernameNormalized === norm);
    if (idx === -1) {
      throw new Error('Nieprawidłowy login lub hasło.');
    }
    const account = accounts[idx];
    const ok = await verifyPasswordLocal(input.password, account.passwordHash);
    if (!ok) {
      throw new Error('Nieprawidłowy login lub hasło.');
    }

    const nowIso = new Date().toISOString();
    account.lastLoginAt = nowIso;
    account.updatedAt = nowIso;
    accounts[idx] = account;
    this.writeAccounts(accounts);
    this.writeSession(account.id);

    return {
      user: toPublicLocalAccount(account),
      progress: this.readProgressForUser(account.id),
      backend: 'local',
    };
  }

  async logout(): Promise<void> {
    this.storage?.removeItem(SESSION_KEY);
  }

  async changePassword(input: ChangePasswordInput): Promise<void> {
    const session = this.readSession();
    if (!session) throw new Error('Zaloguj się, aby zmienić hasło.');
    const accounts = this.readAccounts();
    const idx = accounts.findIndex((a) => a.id === session.userId);
    if (idx === -1) throw new Error('Nie znaleziono konta użytkownika.');

    const ok = await verifyPasswordLocal(input.currentPassword, accounts[idx].passwordHash);
    if (!ok) throw new Error('Obecne hasło jest nieprawidłowe.');

    const passErr = validatePasswordClient(input.newPassword);
    if (passErr) throw new Error(passErr);

    accounts[idx].passwordHash = await hashPasswordLocal(input.newPassword);
    accounts[idx].updatedAt = new Date().toISOString();
    this.writeAccounts(accounts);
  }

  async deleteAccount(currentPassword: string): Promise<void> {
    const session = this.readSession();
    if (!session) throw new Error('Zaloguj się, aby usunąć konto.');
    const accounts = this.readAccounts();
    const idx = accounts.findIndex((a) => a.id === session.userId);
    if (idx === -1) throw new Error('Nie znaleziono konta użytkownika.');

    const ok = await verifyPasswordLocal(currentPassword, accounts[idx].passwordHash);
    if (!ok) throw new Error('Podane hasło jest nieprawidłowe.');

    accounts.splice(idx, 1);
    this.writeAccounts(accounts);
    this.storage?.removeItem(`${PROGRESS_PREFIX}${session.userId}`);
    this.storage?.removeItem(SESSION_KEY);
  }

  async loadUserProgress(): Promise<UserProgress | null> {
    const session = this.readSession();
    if (!session) return null;
    return this.readProgressForUser(session.userId);
  }

  async saveUserProgress(progress: UserProgress): Promise<ProgressSyncResult> {
    const session = this.readSession();
    if (!session) {
      return { ok: false, updatedAt: new Date().toISOString(), backend: 'local' };
    }
    this.writeProgressForUser(session.userId, progress);
    const updatedAt = new Date().toISOString();
    const accounts = this.readAccounts();
    const idx = accounts.findIndex((a) => a.id === session.userId);
    if (idx !== -1) {
      accounts[idx].updatedAt = updatedAt;
      this.writeAccounts(accounts);
    }
    return { ok: true, updatedAt, backend: 'local' };
  }
}
