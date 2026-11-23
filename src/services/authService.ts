import type { UserProgress } from '../types/anatomy';
import type {
  AuthBackendKind,
  AuthSessionPayload,
  AuthSuccessPayload,
  ChangePasswordInput,
  LoginAccountInput,
  ProgressSyncResult,
  RegisterAccountInput,
  UserAccountStoreAdapter,
} from '../types/auth';
import { LocalBrowserAuthAdapter } from './localAuthAdapter';
import { BackendUnavailableError, RemoteApiAuthAdapter } from './remoteAuthAdapter';

function isStaticHostBuild(): boolean {
  try {
    return (
      typeof import.meta !== 'undefined' &&
      (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_STATIC_HOST === 'true'
    );
  } catch {
    return false;
  }
}

/**
 * Hybrid Auth & Progress Store:
 * 1. Primary: Express REST API (/api/auth/*, /api/progress) backed by ServerUserRepository
 * 2. Automatic graceful fallback: LocalBrowserAuthAdapter (Web Crypto PBKDF2 + isolated localStorage)
 *    whenever the API server is unavailable or when built for static CDN hosting (VITE_STATIC_HOST=true).
 */
export class HybridAuthService implements UserAccountStoreAdapter {
  private readonly remote: RemoteApiAuthAdapter;
  private readonly local: LocalBrowserAuthAdapter;
  private readonly staticHostOnly: boolean;
  private activeBackend: AuthBackendKind;

  constructor(
    remote?: RemoteApiAuthAdapter,
    local?: LocalBrowserAuthAdapter,
    staticHostOnly: boolean = isStaticHostBuild(),
  ) {
    this.remote = remote ?? new RemoteApiAuthAdapter('/api');
    this.local = local ?? new LocalBrowserAuthAdapter();
    this.staticHostOnly = staticHostOnly;
    this.activeBackend = staticHostOnly ? 'local' : 'server';
  }

  get backendKind(): AuthBackendKind {
    return this.activeBackend;
  }

  async getCurrentSession(): Promise<AuthSessionPayload> {
    if (this.staticHostOnly) {
      this.activeBackend = 'local';
      return this.local.getCurrentSession();
    }
    try {
      const serverSession = await this.remote.getCurrentSession();
      this.activeBackend = 'server';
      if (serverSession.user) {
        return serverSession;
      }
      // If server is up but no server session cookie, also check if user had an offline local session
      const localSession = await this.local.getCurrentSession();
      if (localSession.user) {
        this.activeBackend = 'local';
        return localSession;
      }
      return serverSession;
    } catch (err) {
      if (err instanceof BackendUnavailableError) {
        this.activeBackend = 'local';
        return this.local.getCurrentSession();
      }
      throw err;
    }
  }

  async register(input: RegisterAccountInput): Promise<AuthSuccessPayload> {
    if (this.staticHostOnly) {
      this.activeBackend = 'local';
      return this.local.register(input);
    }
    try {
      const res = await this.remote.register(input);
      this.activeBackend = 'server';
      return res;
    } catch (err) {
      if (err instanceof BackendUnavailableError) {
        this.activeBackend = 'local';
        return this.local.register(input);
      }
      throw err;
    }
  }

  async login(input: LoginAccountInput): Promise<AuthSuccessPayload> {
    if (this.staticHostOnly) {
      this.activeBackend = 'local';
      return this.local.login(input);
    }
    try {
      const res = await this.remote.login(input);
      this.activeBackend = 'server';
      return res;
    } catch (err) {
      if (err instanceof BackendUnavailableError) {
        this.activeBackend = 'local';
        return this.local.login(input);
      }
      throw err;
    }
  }

  async logout(): Promise<void> {
    if (this.activeBackend === 'server') {
      try {
        await this.remote.logout();
      } catch (err) {
        if (!(err instanceof BackendUnavailableError)) {
          throw err;
        }
      }
    }
    await this.local.logout();
  }

  async changePassword(input: ChangePasswordInput): Promise<void> {
    if (this.activeBackend === 'server') {
      return this.remote.changePassword(input);
    }
    return this.local.changePassword(input);
  }

  async deleteAccount(currentPassword: string): Promise<void> {
    if (this.activeBackend === 'server') {
      return this.remote.deleteAccount(currentPassword);
    }
    return this.local.deleteAccount(currentPassword);
  }

  async loadUserProgress(): Promise<UserProgress | null> {
    if (this.activeBackend === 'server') {
      try {
        return await this.remote.loadUserProgress();
      } catch (err) {
        if (err instanceof BackendUnavailableError) {
          this.activeBackend = 'local';
          return this.local.loadUserProgress();
        }
        throw err;
      }
    }
    return this.local.loadUserProgress();
  }

  async saveUserProgress(progress: UserProgress): Promise<ProgressSyncResult> {
    if (this.activeBackend === 'server') {
      try {
        return await this.remote.saveUserProgress(progress);
      } catch (err) {
        if (err instanceof BackendUnavailableError) {
          // Keep offline fallback notice rather than silently dropping
          return { ok: false, updatedAt: new Date().toISOString(), backend: 'server' };
        }
        throw err;
      }
    }
    return this.local.saveUserProgress(progress);
  }
}

export const authService = new HybridAuthService();
