import type { UserProgress } from '../types/anatomy';
import type {
  AuthSessionPayload,
  AuthSuccessPayload,
  ChangePasswordInput,
  LoginAccountInput,
  ProgressSyncResult,
  RegisterAccountInput,
  UserAccountStoreAdapter,
} from '../types/auth';
import { sanitizeProgressObject } from '../utils/gameLogic';

export class BackendUnavailableError extends Error {
  constructor(message = 'Serwer kont jest niedostępny.') {
    super(message);
    this.name = 'BackendUnavailableError';
  }
}

export class AuthApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
  }
}

async function requestJson<T>(url: string, init?: RequestInit, timeoutMs = 4500): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });
  } catch {
    throw new BackendUnavailableError('Nie można połączyć się z serwerem kont.');
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 502 || res.status === 503 || res.status === 504) {
    throw new BackendUnavailableError('Serwer kont jest chwilowo niedostępny.');
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new BackendUnavailableError('Brak serwera API (tryb statyczny).');
  }

  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new AuthApiError(data.error || 'Wystąpił błąd podczas komunikacji z serwerem.', res.status);
  }
  return data;
}

export class RemoteApiAuthAdapter implements UserAccountStoreAdapter {
  readonly backendKind = 'server' as const;
  private readonly baseUrl: string;

  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async checkAvailable(): Promise<boolean> {
    try {
      const res = await requestJson<{ ok?: boolean }>(`${this.baseUrl}/health`, { method: 'GET' }, 2000);
      return Boolean(res.ok);
    } catch {
      return false;
    }
  }

  async getCurrentSession(): Promise<AuthSessionPayload> {
    const data = await requestJson<AuthSessionPayload>(`${this.baseUrl}/auth/me`, { method: 'GET' }, 2500);
    return {
      user: data.user ? { ...data.user, storageBackend: 'server' } : null,
      progress: data.progress ? sanitizeProgressObject(data.progress) : null,
      backend: 'server',
    };
  }

  async register(input: RegisterAccountInput): Promise<AuthSuccessPayload> {
    const data = await requestJson<AuthSuccessPayload>(`${this.baseUrl}/auth/register`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return {
      user: { ...data.user, storageBackend: 'server' },
      progress: sanitizeProgressObject(data.progress),
      backend: 'server',
    };
  }

  async login(input: LoginAccountInput): Promise<AuthSuccessPayload> {
    const data = await requestJson<AuthSuccessPayload>(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return {
      user: { ...data.user, storageBackend: 'server' },
      progress: sanitizeProgressObject(data.progress),
      backend: 'server',
    };
  }

  async logout(): Promise<void> {
    await requestJson<{ ok: boolean }>(`${this.baseUrl}/auth/logout`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async changePassword(input: ChangePasswordInput): Promise<void> {
    await requestJson<{ ok: boolean }>(`${this.baseUrl}/auth/password`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  async deleteAccount(currentPassword: string): Promise<void> {
    await requestJson<{ ok: boolean }>(`${this.baseUrl}/auth/account`, {
      method: 'DELETE',
      body: JSON.stringify({ currentPassword }),
    });
  }

  async loadUserProgress(): Promise<UserProgress | null> {
    const data = await requestJson<{ progress: UserProgress }>(`${this.baseUrl}/progress`, {
      method: 'GET',
    });
    return data.progress ? sanitizeProgressObject(data.progress) : null;
  }

  async saveUserProgress(progress: UserProgress): Promise<ProgressSyncResult> {
    const data = await requestJson<ProgressSyncResult>(`${this.baseUrl}/progress`, {
      method: 'PUT',
      body: JSON.stringify({ progress: sanitizeProgressObject(progress) }),
    });
    return {
      ok: Boolean(data.ok),
      updatedAt: data.updatedAt || new Date().toISOString(),
      backend: 'server',
    };
  }
}
