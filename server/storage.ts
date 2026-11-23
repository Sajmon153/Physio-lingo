import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { UserProgress } from '../src/types/anatomy';
import type { UserAccountPublic } from '../src/types/auth';
import { createInitialProgress, sanitizeProgressObject } from '../src/utils/gameLogic';
import { hashSessionToken, normalizeUsername, SESSION_TTL_MS } from './auth';

export interface StoredUserRecord {
  id: string;
  username: string;
  usernameNormalized: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
  progress: UserProgress;
}

export interface StoredSessionRecord {
  tokenHash: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

interface AccountsFileSchema {
  version: 1;
  users: StoredUserRecord[];
  sessions: StoredSessionRecord[];
}

/**
 * Clean server-side persistence interface.
 * Implement this interface to migrate from local JSON file storage to PostgreSQL / SQLite / Supabase
 * without touching any Express route or frontend code.
 */
export interface ServerUserRepository {
  countUsers(): number;
  findUserById(userId: string): StoredUserRecord | null;
  findUserByUsername(username: string): StoredUserRecord | null;
  createUser(params: {
    username: string;
    displayName: string;
    passwordHash: string;
    initialProgress?: Partial<UserProgress>;
  }): StoredUserRecord;
  updateUserLastLogin(userId: string): StoredUserRecord | null;
  updateUserPassword(userId: string, passwordHash: string): StoredUserRecord | null;
  updateUserProgress(userId: string, progress: Partial<UserProgress>): StoredUserRecord | null;
  deleteUser(userId: string): boolean;
  createSession(userId: string, rawToken: string): StoredSessionRecord;
  findSessionByToken(rawToken: string): StoredSessionRecord | null;
  deleteSessionByToken(rawToken: string): void;
  deleteUserSessions(userId: string): void;
}

export function toPublicAccount(record: StoredUserRecord): UserAccountPublic {
  return {
    id: record.id,
    username: record.username,
    displayName: record.displayName,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastLoginAt: record.lastLoginAt,
    storageBackend: 'server',
  };
}

export class JsonFileUserRepository implements ServerUserRepository {
  private readonly filePath: string;
  private state: AccountsFileSchema;

  constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
    this.state = this.loadFromDisk();
    this.pruneExpiredSessions();
  }

  private loadFromDisk(): AccountsFileSchema {
    try {
      if (!fs.existsSync(this.filePath)) {
        return { version: 1, users: [], sessions: [] };
      }
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<AccountsFileSchema>;
      const users = Array.isArray(parsed.users)
        ? parsed.users
            .filter((u): u is StoredUserRecord => Boolean(u && typeof u.id === 'string' && typeof u.username === 'string'))
            .map((u) => ({
              ...u,
              usernameNormalized: u.usernameNormalized || normalizeUsername(u.username),
              displayName: u.displayName || u.username,
              progress: sanitizeProgressObject(u.progress ?? createInitialProgress()),
            }))
        : [];
      const sessions = Array.isArray(parsed.sessions)
        ? parsed.sessions.filter(
            (s): s is StoredSessionRecord =>
              Boolean(s && typeof s.tokenHash === 'string' && typeof s.userId === 'string'),
          )
        : [];
      return { version: 1, users, sessions };
    } catch {
      return { version: 1, users: [], sessions: [] };
    }
  }

  private persist(): void {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmpPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(this.state, null, 2), 'utf-8');
    fs.renameSync(tmpPath, this.filePath);
  }

  private pruneExpiredSessions(): void {
    const now = Date.now();
    const before = this.state.sessions.length;
    this.state.sessions = this.state.sessions.filter((s) => {
      const exp = Date.parse(s.expiresAt);
      return Number.isFinite(exp) && exp > now;
    });
    if (this.state.sessions.length !== before && fs.existsSync(this.filePath)) {
      this.persist();
    }
  }

  countUsers(): number {
    return this.state.users.length;
  }

  findUserById(userId: string): StoredUserRecord | null {
    return this.state.users.find((u) => u.id === userId) ?? null;
  }

  findUserByUsername(username: string): StoredUserRecord | null {
    const norm = normalizeUsername(username);
    return this.state.users.find((u) => u.usernameNormalized === norm) ?? null;
  }

  createUser(params: {
    username: string;
    displayName: string;
    passwordHash: string;
    initialProgress?: Partial<UserProgress>;
  }): StoredUserRecord {
    const nowIso = new Date().toISOString();
    const record: StoredUserRecord = {
      id: `usr_${crypto.randomUUID()}`,
      username: params.username.trim(),
      usernameNormalized: normalizeUsername(params.username),
      displayName: (params.displayName || params.username).trim(),
      passwordHash: params.passwordHash,
      createdAt: nowIso,
      updatedAt: nowIso,
      lastLoginAt: nowIso,
      progress: sanitizeProgressObject(params.initialProgress ?? createInitialProgress()),
    };
    this.state.users.push(record);
    this.persist();
    return record;
  }

  updateUserLastLogin(userId: string): StoredUserRecord | null {
    const user = this.findUserById(userId);
    if (!user) return null;
    const nowIso = new Date().toISOString();
    user.lastLoginAt = nowIso;
    user.updatedAt = nowIso;
    this.persist();
    return user;
  }

  updateUserPassword(userId: string, passwordHash: string): StoredUserRecord | null {
    const user = this.findUserById(userId);
    if (!user) return null;
    user.passwordHash = passwordHash;
    user.updatedAt = new Date().toISOString();
    this.persist();
    return user;
  }

  updateUserProgress(userId: string, progress: Partial<UserProgress>): StoredUserRecord | null {
    const user = this.findUserById(userId);
    if (!user) return null;
    user.progress = sanitizeProgressObject(progress);
    user.updatedAt = new Date().toISOString();
    this.persist();
    return user;
  }

  deleteUser(userId: string): boolean {
    const before = this.state.users.length;
    this.state.users = this.state.users.filter((u) => u.id !== userId);
    this.state.sessions = this.state.sessions.filter((s) => s.userId !== userId);
    if (this.state.users.length !== before) {
      this.persist();
      return true;
    }
    return false;
  }

  createSession(userId: string, rawToken: string): StoredSessionRecord {
    this.pruneExpiredSessions();
    const now = Date.now();
    const session: StoredSessionRecord = {
      tokenHash: hashSessionToken(rawToken),
      userId,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    };
    this.state.sessions.push(session);
    this.persist();
    return session;
  }

  findSessionByToken(rawToken: string): StoredSessionRecord | null {
    const tokenHash = hashSessionToken(rawToken);
    const session = this.state.sessions.find((s) => s.tokenHash === tokenHash);
    if (!session) return null;
    if (Date.parse(session.expiresAt) <= Date.now()) {
      this.deleteSessionByToken(rawToken);
      return null;
    }
    return session;
  }

  deleteSessionByToken(rawToken: string): void {
    const tokenHash = hashSessionToken(rawToken);
    const before = this.state.sessions.length;
    this.state.sessions = this.state.sessions.filter((s) => s.tokenHash !== tokenHash);
    if (this.state.sessions.length !== before) {
      this.persist();
    }
  }

  deleteUserSessions(userId: string): void {
    const before = this.state.sessions.length;
    this.state.sessions = this.state.sessions.filter((s) => s.userId !== userId);
    if (this.state.sessions.length !== before) {
      this.persist();
    }
  }
}
