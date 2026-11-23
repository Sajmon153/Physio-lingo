import type { UserProgress } from './anatomy';

export type AuthBackendKind = 'server' | 'local';

export type AccountSyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface UserAccountPublic {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
  storageBackend: AuthBackendKind;
}

export interface RegisterAccountInput {
  username: string;
  password: string;
  displayName?: string;
  initialProgress?: UserProgress;
}

export interface LoginAccountInput {
  username: string;
  password: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface AuthSessionPayload {
  user: UserAccountPublic | null;
  progress: UserProgress | null;
  backend: AuthBackendKind;
}

export interface AuthSuccessPayload {
  user: UserAccountPublic;
  progress: UserProgress;
  backend: AuthBackendKind;
}

export interface ProgressSyncResult {
  ok: boolean;
  updatedAt: string;
  backend: AuthBackendKind;
}

/**
 * Backend-agnostic user account & progress storage adapter.
 * Swapping local file storage for PostgreSQL / Supabase / Firebase only requires
 * implementing this interface (frontend) or ServerUserRepository (backend).
 */
export interface UserAccountStoreAdapter {
  readonly backendKind: AuthBackendKind;
  getCurrentSession(): Promise<AuthSessionPayload>;
  register(input: RegisterAccountInput): Promise<AuthSuccessPayload>;
  login(input: LoginAccountInput): Promise<AuthSuccessPayload>;
  logout(): Promise<void>;
  changePassword(input: ChangePasswordInput): Promise<void>;
  deleteAccount(currentPassword: string): Promise<void>;
  loadUserProgress(): Promise<UserProgress | null>;
  saveUserProgress(progress: UserProgress): Promise<ProgressSyncResult>;
}
