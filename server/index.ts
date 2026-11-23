import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { UserProgress } from '../src/types/anatomy';
import {
  clearSessionCookie,
  extractSessionToken,
  generateSessionToken,
  hashPassword,
  setSessionCookie,
  validateDisplayName,
  validatePassword,
  validateUsername,
  verifyPassword,
} from './auth';
import {
  JsonFileUserRepository,
  type ServerUserRepository,
  type StoredUserRecord,
  toPublicAccount,
} from './storage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

export interface CreateServerOptions {
  repository?: ServerUserRepository;
  serveDist?: boolean;
}

export function createApp(options: CreateServerOptions = {}): express.Express {
  const dataFilePath =
    process.env.PHYSIOLINGO_DATA_FILE ||
    path.join(PROJECT_ROOT, 'data', 'physiolingo-accounts.json');
  const repo: ServerUserRepository =
    options.repository ?? new JsonFileUserRepository(dataFilePath);

  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Lightweight per-IP rate limiting for auth endpoints (30 attempts / 5 min)
  const authAttempts = new Map<string, { count: number; resetAt: number }>();
  const checkAuthRateLimit = (req: Request, res: Response): boolean => {
    const key = req.ip || 'local';
    const now = Date.now();
    const current = authAttempts.get(key);
    if (!current || current.resetAt < now) {
      authAttempts.set(key, { count: 1, resetAt: now + 5 * 60 * 1000 });
      return true;
    }
    current.count += 1;
    if (current.count > 40) {
      res.status(429).json({
        error: 'Zbyt wiele prób logowania. Odczekaj chwilę i spróbuj ponownie.',
      });
      return false;
    }
    return true;
  };

  const resolveAuthenticatedUser = (req: Request): { user: StoredUserRecord; token: string } | null => {
    const token = extractSessionToken(req);
    if (!token) return null;
    const session = repo.findSessionByToken(token);
    if (!session) return null;
    const user = repo.findUserById(session.userId);
    if (!user) return null;
    return { user, token };
  };

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      backend: 'express-file',
      usersCount: repo.countUsers(),
    });
  });

  // Current session
  app.get('/api/auth/me', (req, res) => {
    const auth = resolveAuthenticatedUser(req);
    if (!auth) {
      res.json({ user: null, progress: null, backend: 'server' });
      return;
    }
    res.json({
      user: toPublicAccount(auth.user),
      progress: auth.user.progress,
      backend: 'server',
    });
  });

  // Register new account (login + password + optional guest progress migration)
  app.post('/api/auth/register', (req, res) => {
    if (!checkAuthRateLimit(req, res)) return;

    const { username, password, displayName, initialProgress } = (req.body ?? {}) as {
      username?: string;
      password?: string;
      displayName?: string;
      initialProgress?: Partial<UserProgress>;
    };

    const userErr = validateUsername(typeof username === 'string' ? username : '');
    if (userErr) {
      res.status(400).json({ error: userErr });
      return;
    }
    const passErr = validatePassword(typeof password === 'string' ? password : '');
    if (passErr) {
      res.status(400).json({ error: passErr });
      return;
    }
    const displayErr = validateDisplayName(displayName);
    if (displayErr) {
      res.status(400).json({ error: displayErr });
      return;
    }

    const existing = repo.findUserByUsername(username!);
    if (existing) {
      res.status(409).json({
        error: 'Ten login jest już zajęty. Wybierz inną nazwę użytkownika lub zaloguj się.',
      });
      return;
    }

    const passwordHash = hashPassword(password!);
    const created = repo.createUser({
      username: username!.trim(),
      displayName: displayName && displayName.trim() ? displayName.trim() : username!.trim(),
      passwordHash,
      initialProgress,
    });

    const token = generateSessionToken();
    repo.createSession(created.id, token);
    setSessionCookie(res, token);

    res.status(201).json({
      user: toPublicAccount(created),
      progress: created.progress,
      backend: 'server',
    });
  });

  // Login
  app.post('/api/auth/login', (req, res) => {
    if (!checkAuthRateLimit(req, res)) return;

    const { username, password } = (req.body ?? {}) as {
      username?: string;
      password?: string;
    };

    if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password) {
      res.status(400).json({ error: 'Podaj login oraz hasło.' });
      return;
    }

    const user = repo.findUserByUsername(username);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Nieprawidłowy login lub hasło.' });
      return;
    }

    const updated = repo.updateUserLastLogin(user.id) ?? user;
    const token = generateSessionToken();
    repo.createSession(updated.id, token);
    setSessionCookie(res, token);

    res.json({
      user: toPublicAccount(updated),
      progress: updated.progress,
      backend: 'server',
    });
  });

  // Logout
  app.post('/api/auth/logout', (req, res) => {
    const token = extractSessionToken(req);
    if (token) {
      repo.deleteSessionByToken(token);
    }
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  // Change password
  app.put('/api/auth/password', (req, res) => {
    const auth = resolveAuthenticatedUser(req);
    if (!auth) {
      res.status(401).json({ error: 'Zaloguj się, aby zmienić hasło.' });
      return;
    }
    const { currentPassword, newPassword } = (req.body ?? {}) as {
      currentPassword?: string;
      newPassword?: string;
    };
    if (typeof currentPassword !== 'string' || !verifyPassword(currentPassword, auth.user.passwordHash)) {
      res.status(401).json({ error: 'Obecne hasło jest nieprawidłowe.' });
      return;
    }
    const passErr = validatePassword(typeof newPassword === 'string' ? newPassword : '');
    if (passErr) {
      res.status(400).json({ error: passErr });
      return;
    }

    const nextHash = hashPassword(newPassword!);
    repo.updateUserPassword(auth.user.id, nextHash);
    // Rotate sessions for security
    repo.deleteUserSessions(auth.user.id);
    const freshToken = generateSessionToken();
    repo.createSession(auth.user.id, freshToken);
    setSessionCookie(res, freshToken);

    res.json({ ok: true });
  });

  // Delete account
  app.delete('/api/auth/account', (req, res) => {
    const auth = resolveAuthenticatedUser(req);
    if (!auth) {
      res.status(401).json({ error: 'Zaloguj się, aby usunąć konto.' });
      return;
    }
    const { currentPassword } = (req.body ?? {}) as { currentPassword?: string };
    if (typeof currentPassword !== 'string' || !verifyPassword(currentPassword, auth.user.passwordHash)) {
      res.status(401).json({ error: 'Podane hasło jest nieprawidłowe.' });
      return;
    }
    repo.deleteUser(auth.user.id);
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  // Load user progress
  app.get('/api/progress', (req, res) => {
    const auth = resolveAuthenticatedUser(req);
    if (!auth) {
      res.status(401).json({ error: 'Wymagane logowanie.' });
      return;
    }
    res.json({
      progress: auth.user.progress,
      updatedAt: auth.user.updatedAt,
      backend: 'server',
    });
  });

  // Save user progress
  app.put('/api/progress', (req, res) => {
    const auth = resolveAuthenticatedUser(req);
    if (!auth) {
      res.status(401).json({ error: 'Wymagane logowanie.' });
      return;
    }
    const { progress } = (req.body ?? {}) as { progress?: Partial<UserProgress> };
    if (!progress || typeof progress !== 'object') {
      res.status(400).json({ error: 'Nieprawidłowe dane postępu.' });
      return;
    }
    const updated = repo.updateUserProgress(auth.user.id, progress);
    if (!updated) {
      res.status(404).json({ error: 'Nie znaleziono konta użytkownika.' });
      return;
    }
    res.json({
      ok: true,
      updatedAt: updated.updatedAt,
      backend: 'server',
    });
  });

  // Optional production static serving (when running `npm start`)
  const shouldServeDist =
    options.serveDist ??
    (process.env.NODE_ENV === 'production' || process.argv.includes('--serve-dist'));
  const distDir = path.join(PROJECT_ROOT, 'dist');
  if (shouldServeDist && fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  return app;
}

const isEntrypoint =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isEntrypoint) {
  const port = Number(process.env.API_PORT || process.env.PORT || 3001);
  const host = process.env.API_HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
  const app = createApp();
  app.listen(port, host, () => {
    console.log(`[PhysioLingo API] listening on http://${host}:${port}`);
  });
}
