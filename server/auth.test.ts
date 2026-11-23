import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  LocalBrowserAuthAdapter,
  type KeyValueStorageLike,
  hashPasswordLocal,
  verifyPasswordLocal,
} from '../src/services/localAuthAdapter';
import { createInitialProgress } from '../src/utils/gameLogic';
import {
  hashPassword,
  validatePassword,
  validateUsername,
  verifyPassword,
} from './auth';
import { createApp } from './index';
import { JsonFileUserRepository } from './storage';

class MemoryStorage implements KeyValueStorageLike {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

test('server auth crypto hashes with unique random salts and verifies safely', () => {
  assert.equal(validateUsername('ab'), 'Login musi mieć od 3 do 24 znaków.');
  assert.equal(validateUsername('anna fizjo'), 'Login może zawierać tylko litery, cyfry oraz znaki . _ - (bez spacji).');
  assert.equal(validateUsername('anna_fizjo.01'), null);
  assert.equal(validatePassword('12345'), 'Hasło musi mieć co najmniej 6 znaków.');
  assert.equal(validatePassword('Haslo123!'), null);

  const hashA = hashPassword('Sekret123!');
  const hashB = hashPassword('Sekret123!');
  assert.notEqual(hashA, hashB, 'Same password must produce distinct salted scrypt hashes');
  assert.ok(hashA.startsWith('scrypt$'));
  assert.equal(verifyPassword('Sekret123!', hashA), true);
  assert.equal(verifyPassword('Sekret123!', hashB), true);
  assert.equal(verifyPassword('ZleHaslo123!', hashA), false);
  assert.equal(verifyPassword('Sekret123!', 'malformed'), false);
});

test('Express API full lifecycle: register, migrate guest progress, persist to disk, login, change password, delete', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'physiolingo-auth-test-'));
  const dataFile = path.join(tmpDir, 'accounts.json');
  const repo = new JsonFileUserRepository(dataFile);
  const app = createApp({ repository: repo, serveDist: false });

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const port = (server.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${port}`;

    // 1. Health check
    const healthRes = await fetch(`${base}/api/health`);
    assert.equal(healthRes.status, 200);
    const health = (await healthRes.json()) as { ok: boolean; usersCount: number };
    assert.equal(health.ok, true);
    assert.equal(health.usersCount, 0);

    // 2. Register with Guest progress migration
    const guestProgress = {
      ...createInitialProgress(),
      xp: 240,
      streak: 3,
      completedLessonIds: ['shoulder_1_bones', 'shoulder_2_joints'],
      theme: 'dark' as const,
      deviceMode: 'ipad' as const,
      uiScale: 105,
    };

    const regRes = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'szymon_fizjo',
        displayName: 'Szymon',
        password: 'MojeHaslo2026',
        initialProgress: guestProgress,
      }),
    });
    assert.equal(regRes.status, 201);
    const setCookieHeader = regRes.headers.get('set-cookie') || '';
    assert.ok(setCookieHeader.includes('physiolingo_session='), 'Session cookie must be set');
    assert.ok(setCookieHeader.includes('HttpOnly'), 'Session cookie must be HttpOnly');
    const cookiePair = setCookieHeader.split(';')[0];

    const regData = (await regRes.json()) as {
      user: { username: string; displayName: string; storageBackend: string };
      progress: { xp: number; completedLessonIds: string[]; deviceMode: string };
    };
    assert.equal(regData.user.username, 'szymon_fizjo');
    assert.equal(regData.user.displayName, 'Szymon');
    assert.equal(regData.user.storageBackend, 'server');
    assert.equal(regData.progress.xp, 240);
    assert.deepEqual(regData.progress.completedLessonIds, ['shoulder_1_bones', 'shoulder_2_joints']);
    assert.equal(regData.progress.deviceMode, 'ipad');

    // 3. Duplicate username rejected case-insensitively with 409
    const dupRes = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'SZYMON_FIZJO',
        password: 'InneHaslo999',
      }),
    });
    assert.equal(dupRes.status, 409);

    // 4. GET /api/auth/me with cookie returns authenticated user & progress
    const meRes = await fetch(`${base}/api/auth/me`, {
      headers: { Cookie: cookiePair },
    });
    assert.equal(meRes.status, 200);
    const meData = (await meRes.json()) as { user: { username: string } | null; progress: { xp: number } | null };
    assert.equal(meData.user?.username, 'szymon_fizjo');
    assert.equal(meData.progress?.xp, 240);

    // 5. PUT /api/progress updates progress & persists cleanly on disk
    const updatedProgress = {
      ...guestProgress,
      xp: 485,
      completedLessonIds: ['shoulder_1_bones', 'shoulder_2_joints', 'knee_1_bones'],
    };
    const saveRes = await fetch(`${base}/api/progress`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookiePair },
      body: JSON.stringify({ progress: updatedProgress }),
    });
    assert.equal(saveRes.status, 200);

    // Reload fresh repository from disk to prove durability
    const reloadedRepo = new JsonFileUserRepository(dataFile);
    const reloadedUser = reloadedRepo.findUserByUsername('szymon_fizjo');
    assert.ok(reloadedUser);
    assert.equal(reloadedUser.progress.xp, 485);
    assert.equal(reloadedUser.progress.completedLessonIds.length, 3);
    assert.ok(!reloadedUser.passwordHash.includes('MojeHaslo2026'), 'Plaintext password must never be stored');

    // 6. Logout revokes session
    const logoutRes = await fetch(`${base}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookiePair },
    });
    assert.equal(logoutRes.status, 200);

    const meAfterLogout = (await (
      await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookiePair } })
    ).json()) as { user: unknown };
    assert.equal(meAfterLogout.user, null);

    // 7. Login rejects wrong password & succeeds with correct password
    const badLogin = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'szymon_fizjo', password: 'WrongPassword' }),
    });
    assert.equal(badLogin.status, 401);

    const goodLogin = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Szymon_Fizjo', password: 'MojeHaslo2026' }),
    });
    assert.equal(goodLogin.status, 200);
    const loginCookie = (goodLogin.headers.get('set-cookie') || '').split(';')[0];
    const loginData = (await goodLogin.json()) as { progress: { xp: number } };
    assert.equal(loginData.progress.xp, 485);

    // 8. Change password rotates session and updates credentials
    const chPwdRes = await fetch(`${base}/api/auth/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: loginCookie },
      body: JSON.stringify({ currentPassword: 'MojeHaslo2026', newPassword: 'NoweHaslo2027!' }),
    });
    assert.equal(chPwdRes.status, 200);
    const rotatedCookie = (chPwdRes.headers.get('set-cookie') || '').split(';')[0];

    const oldPwdLogin = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'szymon_fizjo', password: 'MojeHaslo2026' }),
    });
    assert.equal(oldPwdLogin.status, 401);

    // 9. Delete account removes user cleanly
    const delRes = await fetch(`${base}/api/auth/account`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Cookie: rotatedCookie },
      body: JSON.stringify({ currentPassword: 'NoweHaslo2027!' }),
    });
    assert.equal(delRes.status, 200);
    assert.equal(repo.countUsers(), 0);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('LocalBrowserAuthAdapter offline fallback isolates multiple accounts and hashes passwords with PBKDF2', async () => {
  const storage = new MemoryStorage();
  const adapter = new LocalBrowserAuthAdapter(storage);

  const localHash = await hashPasswordLocal('OfflinePass99');
  assert.ok(localHash.startsWith('pbkdf2$') || localHash.startsWith('sha256iter$'));
  assert.equal(await verifyPasswordLocal('OfflinePass99', localHash), true);
  assert.equal(await verifyPasswordLocal('WrongPass99', localHash), false);

  // Register user 1 with migrated progress
  const u1 = await adapter.register({
    username: 'anna_pt',
    password: 'HasloAnna123',
    displayName: 'Anna',
    initialProgress: { ...createInitialProgress(), xp: 150, completedLessonIds: ['shoulder_1_bones'] },
  });
  assert.equal(u1.user.username, 'anna_pt');
  assert.equal(u1.progress.xp, 150);

  // Save updated progress for user 1
  await adapter.saveUserProgress({ ...u1.progress, xp: 320 });
  await adapter.logout();

  // Register user 2 with separate progress
  const u2 = await adapter.register({
    username: 'marek_pt',
    password: 'HasloMarek123',
    initialProgress: { ...createInitialProgress(), xp: 40 },
  });
  assert.equal(u2.progress.xp, 40);
  await adapter.logout();

  // Log back in as user 1 -> restores exact isolated 320 XP
  const backU1 = await adapter.login({ username: 'anna_pt', password: 'HasloAnna123' });
  assert.equal(backU1.progress.xp, 320);

  // Change password & verify
  await adapter.changePassword({ currentPassword: 'HasloAnna123', newPassword: 'NoweHasloAnna456' });
  await adapter.logout();
  await assert.rejects(() => adapter.login({ username: 'anna_pt', password: 'HasloAnna123' }));
  const backU1New = await adapter.login({ username: 'anna_pt', password: 'NoweHasloAnna456' });
  assert.equal(backU1New.progress.xp, 320);
});
