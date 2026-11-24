import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Box,
  CheckCircle2,
  Cloud,
  Download,
  Eye,
  EyeOff,
  HardDrive,
  KeyRound,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { ANATOMY_MAP } from '../data/anatomyDb';
import { SKILL_SECTIONS } from '../data/curriculum';
import { formatBilingualName } from '../three/anatomyTranslator';
import type { AnatomicalStructure, UserProgress } from '../types/anatomy';
import type {
  AccountSyncStatus,
  AuthBackendKind,
  ChangePasswordInput,
  LoginAccountInput,
  RegisterAccountInput,
  UserAccountPublic,
} from '../types/auth';
import {
  exportProgressToJson,
  getAllLessonsOrdered,
  getLessonStatuses,
  parseImportedProgress,
} from '../utils/gameLogic';
import { getAllSrsCards, getSrsDeckStats } from '../utils/srsLogic';
import {
  validatePasswordClient,
  validateUsernameClient,
} from '../services/localAuthAdapter';
import {
  clearOfflineModelCache,
  downloadAllOfflinePacks,
  downloadOfflinePack,
  formatBytesPl,
  getOfflineCacheStatus,
  OFFLINE_MODEL_PACKS,
  removeOfflinePack,
  TOTAL_OFFLINE_3D_BYTES,
  TOTAL_OFFLINE_3D_FILES,
  type OfflineDownloadProgress,
  type OfflinePackId,
  type OfflineStorageSummary,
} from '../services/pwaOfflineService';

const SHORT_SECTION_NAMES: Record<string, string> = {
  shoulder: 'Bark',
  knee: 'Kolano',
  spine_thorax: 'Kręgosłup',
  pelvis_hip: 'Biodro',
  head_neck: 'Głowa/szyja',
  upper_limb: 'Kończyna górna',
  lower_limb: 'Stopa/podudzie',
  vascular: 'Naczynia',
  nervous: 'Nerwy i sploty',
  visceral: 'Narządy',
  connective: 'Więzadła/kaletki',
};

interface AccountModalProps {
  isOpen: boolean;
  initialTab?: 'account' | 'stats' | 'offline';
  isOnline?: boolean;
  canInstallPwa?: boolean;
  isPwaInstalled?: boolean;
  onTriggerInstallPwa?: () => void;
  onClose: () => void;
  user: UserAccountPublic | null;
  backend: AuthBackendKind;
  syncStatus: AccountSyncStatus;
  lastSyncedAt: string | null;
  progress: UserProgress;
  onLogin: (input: LoginAccountInput) => Promise<void>;
  onRegister: (input: RegisterAccountInput) => Promise<void>;
  onLogout: () => Promise<void>;
  onChangePassword: (input: ChangePasswordInput) => Promise<void>;
  onDeleteAccount: (currentPassword: string) => Promise<void>;
  onImportProgress: (nextProgress: UserProgress) => void;
  onInspectStructureIn3D?: (structure: AnatomicalStructure) => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  initialTab = 'account',
  isOnline = true,
  canInstallPwa = false,
  isPwaInstalled = false,
  onTriggerInstallPwa,
  onClose,
  user,
  backend,
  syncStatus,
  lastSyncedAt,
  progress,
  onLogin,
  onRegister,
  onLogout,
  onChangePassword,
  onDeleteAccount,
  onImportProgress,
  onInspectStructureIn3D,
}) => {
  const [modalTab, setModalTab] = useState<'account' | 'stats' | 'offline'>(initialTab);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('register');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmNewPwd, setConfirmNewPwd] = useState('');

  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [deletePwd, setDeletePwd] = useState('');

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'emerald' | 'rose'; message: string } | null>(null);
  const [offlineStatus, setOfflineStatus] = useState<OfflineStorageSummary | null>(null);
  const [offlineBusyTarget, setOfflineBusyTarget] = useState<'all' | 'clear' | OfflinePackId | null>(null);
  const [offlineProgress, setOfflineProgress] = useState<OfflineDownloadProgress | null>(null);
  const [offlineNotice, setOfflineNotice] = useState<{ tone: 'emerald' | 'rose'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshOfflineStatus = useCallback(async () => {
    const summary = await getOfflineCacheStatus();
    setOfflineStatus(summary);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setModalTab(initialTab);
    setNotice(null);
    setOfflineNotice(null);
    setPassword('');
    setConfirmPassword('');
    setCurrentPwd('');
    setNewPwd('');
    setConfirmNewPwd('');
    setDeletePwd('');
    setShowPasswordForm(false);
    setShowDeleteForm(false);
    void refreshOfflineStatus();
  }, [isOpen, initialTab, user?.id, refreshOfflineStatus]);

  useEffect(() => {
    if (isOpen && modalTab === 'offline') {
      void refreshOfflineStatus();
    }
  }, [isOpen, modalTab, refreshOfflineStatus]);

  const handleDownloadPack = useCallback(
    async (packId: OfflinePackId) => {
      setOfflineBusyTarget(packId);
      setOfflineNotice(null);
      setOfflineProgress(null);
      try {
        const res = await downloadOfflinePack(packId, (prog) => setOfflineProgress(prog));
        await refreshOfflineStatus();
        const packMeta = OFFLINE_MODEL_PACKS.find((p) => p.id === packId);
        if (res.failed.length > 0) {
          setOfflineNotice({
            tone: 'rose',
            message: `Nie udało się pobrać ${res.failed.length} plików (${packMeta?.namePl ?? packId}). Sprawdź połączenie z siecią.`,
          });
        } else {
          setOfflineNotice({
            tone: 'emerald',
            message: `Zapisano pakiet „${packMeta?.namePl ?? packId}” do pamięci offline!`,
          });
        }
      } catch (err) {
        setOfflineNotice({
          tone: 'rose',
          message: err instanceof Error ? err.message : 'Błąd pobierania pakietu 3D.',
        });
      } finally {
        setOfflineBusyTarget(null);
        setOfflineProgress(null);
      }
    },
    [refreshOfflineStatus],
  );

  const handleDownloadAllPacks = useCallback(async () => {
    setOfflineBusyTarget('all');
    setOfflineNotice(null);
    setOfflineProgress(null);
    try {
      const res = await downloadAllOfflinePacks((prog) => setOfflineProgress(prog));
      await refreshOfflineStatus();
      if (res.failed.length > 0) {
        setOfflineNotice({
          tone: 'rose',
          message: `Pobrano ${res.succeeded} plików, nie udało się pobrać ${res.failed.length}. Spróbuj ponownie przy aktywnym połączeniu.`,
        });
      } else {
        setOfflineNotice({
          tone: 'emerald',
          message: `Wszystkie ${TOTAL_OFFLINE_3D_FILES} modeli 3D zapisano lokalnie — aplikacja jest gotowa do nauki offline!`,
        });
      }
    } catch (err) {
      setOfflineNotice({
        tone: 'rose',
        message: err instanceof Error ? err.message : 'Błąd pobierania modeli 3D.',
      });
    } finally {
      setOfflineBusyTarget(null);
      setOfflineProgress(null);
    }
  }, [refreshOfflineStatus]);

  const handleRemovePack = useCallback(
    async (packId: OfflinePackId) => {
      setOfflineBusyTarget(packId);
      setOfflineNotice(null);
      try {
        await removeOfflinePack(packId);
        await refreshOfflineStatus();
        const packMeta = OFFLINE_MODEL_PACKS.find((p) => p.id === packId);
        setOfflineNotice({
          tone: 'emerald',
          message: `Usunięto pakiet „${packMeta?.namePl ?? packId}” z pamięci offline.`,
        });
      } finally {
        setOfflineBusyTarget(null);
      }
    },
    [refreshOfflineStatus],
  );

  const handleClearOfflineCache = useCallback(async () => {
    setOfflineBusyTarget('clear');
    setOfflineNotice(null);
    try {
      await clearOfflineModelCache();
      await refreshOfflineStatus();
      setOfflineNotice({
        tone: 'emerald',
        message: 'Wyczyszczono pamięć podręczną modeli 3D. Możesz pobrać wybrane regiony ponownie w dowolnym momencie.',
      });
    } finally {
      setOfflineBusyTarget(null);
    }
  }, [refreshOfflineStatus]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalLessons = getAllLessonsOrdered().length;
  const completedLessons = progress.completedLessonIds.length;
  const overallPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const srsStats = useMemo(
    () => getSrsDeckStats(getAllSrsCards(), progress.srsProgress ?? {}),
    [progress.srsProgress],
  );
  const lessonStatuses = useMemo(
    () => getLessonStatuses(progress.completedLessonIds, progress.studyMode),
    [progress.completedLessonIds, progress.studyMode],
  );
  const topMistakes = useMemo(
    () =>
      Object.entries(progress.mistakeStats)
        .filter(([, stat]) => stat.wrongCount > 0)
        .sort((a, b) => b[1].wrongCount - a[1].wrongCount)
        .slice(0, 5)
        .map(([id, stat]) => ({ structure: ANATOMY_MAP[id], wrongCount: stat.wrongCount }))
        .filter((item): item is { structure: AnatomicalStructure; wrongCount: number } =>
          Boolean(item.structure),
        ),
    [progress.mistakeStats],
  );
  const recentPins = (progress.pinExamHistory ?? []).slice(0, 5);
  const recentPatientCases = (progress.patientCaseHistory ?? []).slice(0, 5);
  const uniquePatientCasesDone = new Set(
    (progress.patientCaseHistory ?? []).map((entry) => entry.caseId),
  ).size;

  const handleRegisterSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setNotice(null);
    const userErr = validateUsernameClient(username);
    if (userErr) {
      setNotice({ tone: 'rose', message: userErr });
      return;
    }
    const passErr = validatePasswordClient(password);
    if (passErr) {
      setNotice({ tone: 'rose', message: passErr });
      return;
    }
    if (password !== confirmPassword) {
      setNotice({ tone: 'rose', message: 'Wpisane hasła nie są identyczne.' });
      return;
    }

    setBusy(true);
    try {
      await onRegister({
        username: username.trim(),
        password,
        displayName: displayName.trim() || undefined,
        initialProgress: progress,
      });
      setUsername('');
      setDisplayName('');
      setPassword('');
      setConfirmPassword('');
      setNotice({
        tone: 'emerald',
        message: 'Konto zostało utworzone, a dotychczasowy postęp zapisany!',
      });
    } catch (err) {
      setNotice({
        tone: 'rose',
        message: err instanceof Error ? err.message : 'Nie udało się założyć konta.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleLoginSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setNotice(null);
    if (!username.trim() || !password) {
      setNotice({ tone: 'rose', message: 'Podaj login oraz hasło.' });
      return;
    }
    setBusy(true);
    try {
      await onLogin({ username: username.trim(), password });
      setUsername('');
      setPassword('');
      setNotice({ tone: 'emerald', message: 'Zalogowano pomyślnie i wczytano postęp.' });
    } catch (err) {
      setNotice({
        tone: 'rose',
        message: err instanceof Error ? err.message : 'Nie udało się zalogować.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordChangeSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setNotice(null);
    const passErr = validatePasswordClient(newPwd);
    if (passErr) {
      setNotice({ tone: 'rose', message: passErr });
      return;
    }
    if (newPwd !== confirmNewPwd) {
      setNotice({ tone: 'rose', message: 'Nowe hasła nie są identyczne.' });
      return;
    }
    setBusy(true);
    try {
      await onChangePassword({ currentPassword: currentPwd, newPassword: newPwd });
      setCurrentPwd('');
      setNewPwd('');
      setConfirmNewPwd('');
      setShowPasswordForm(false);
      setNotice({ tone: 'emerald', message: 'Hasło zostało zaktualizowane.' });
    } catch (err) {
      setNotice({
        tone: 'rose',
        message: err instanceof Error ? err.message : 'Nie udało się zmienić hasła.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAccountSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setNotice(null);
    if (!deletePwd) {
      setNotice({ tone: 'rose', message: 'Potwierdź usunięcie konta obecnym hasłem.' });
      return;
    }
    setBusy(true);
    try {
      await onDeleteAccount(deletePwd);
      setDeletePwd('');
      setShowDeleteForm(false);
      setNotice({ tone: 'emerald', message: 'Konto zostało usunięte. Przełączono na tryb Gościa.' });
    } catch (err) {
      setNotice({
        tone: 'rose',
        message: err instanceof Error ? err.message : 'Nie udało się usunąć konta.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleLogoutClick = async () => {
    setNotice(null);
    setBusy(true);
    try {
      await onLogout();
      setNotice({
        tone: 'emerald',
        message: 'Wylogowano. Twój postęp na koncie jest bezpiecznie zapisany.',
      });
    } catch (err) {
      setNotice({
        tone: 'rose',
        message: err instanceof Error ? err.message : 'Nie udało się wylogować.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleExportJson = () => {
    try {
      const json = exportProgressToJson(progress);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const suffix = user ? user.username : 'gosc';
      a.download = `physiolingo-${suffix}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setNotice({ tone: 'emerald', message: 'Pobrano kopię zapasową postępu (JSON).' });
    } catch {
      setNotice({ tone: 'rose', message: 'Nie udało się wyeksportować pliku JSON.' });
    }
  };

  const handleImportFile = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseImportedProgress(text);
      if (!parsed) {
        setNotice({
          tone: 'rose',
          message: 'Nieprawidłowy format pliku JSON — wybierz kopię z PhysioLingo.',
        });
        return;
      }
      onImportProgress(parsed);
      setNotice({
        tone: 'emerald',
        message: `Wczytano postęp: ${parsed.xp} XP, ${parsed.completedLessonIds.length} ukończonych lekcji.`,
      });
    } catch {
      setNotice({ tone: 'rose', message: 'Błąd odczytu wybranego pliku.' });
    }
  };

  const syncLabel =
    syncStatus === 'syncing'
      ? 'Zapisywanie...'
      : syncStatus === 'offline' || syncStatus === 'error'
        ? 'Tryb offline (zapis lokalny)'
        : lastSyncedAt
          ? `Zsynchronizowano ${new Date(lastSyncedAt).toLocaleTimeString('pl-PL', {
              hour: '2-digit',
              minute: '2-digit',
            })}`
          : 'Zapis aktywny';

  return (
    <div
      data-testid="account-modal-backdrop"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a1410]/70 p-4 backdrop-blur-sm"
    >
      <div
        data-testid="account-modal"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border-2 border-[#d6e7dc] bg-white p-5 shadow-2xl dark:border-[#233d2f] dark:bg-[#112018]"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#e6f0ea] pb-3.5 dark:border-[#233d2f]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border-b-4 border-emerald-700 bg-emerald-500 text-white">
              {user ? <UserCheck className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="font-display text-lg font-extrabold text-emerald-950 dark:text-white">
                {user ? 'Konto użytkownika' : 'Konto PhysioLingo'}
              </h2>
              <p className="text-xs font-medium text-[#52695b] dark:text-[#94b0a0]">
                {user
                  ? 'Twoje postępy zapisują się automatycznie'
                  : 'Załóż login i hasło, aby zachować postępy nauki'}
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="account-modal-close"
            onClick={onClose}
            aria-label="Zamknij okno konta"
            className="rounded-xl p-1.5 text-[#52695b] transition hover:bg-[#ebf5ee] dark:text-[#94b0a0] dark:hover:bg-[#182b21]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Top Modal Section Switcher: Konto | Statystyki | Offline / PWA */}
        <div className="mt-3.5 grid grid-cols-3 gap-1 rounded-2xl border border-[#d6e7dc] bg-[#f4faf6] p-1 dark:border-[#233d2f] dark:bg-[#182b21]">
          <button
            type="button"
            data-testid="account-modal-tab-account"
            onClick={() => setModalTab('account')}
            className={`inline-flex min-w-0 items-center justify-center gap-1 rounded-xl px-1.5 py-1.5 text-[11px] font-extrabold transition sm:px-2 sm:text-xs ${
              modalTab === 'account'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-[#354c3f] hover:text-emerald-950 dark:text-[#c7dbcf]'
            }`}
          >
            {user ? <UserCheck className="h-3.5 w-3.5 shrink-0" /> : <ShieldCheck className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">{user ? 'Profil' : 'Konto'}</span>
          </button>
          <button
            type="button"
            data-testid="account-modal-tab-stats"
            onClick={() => setModalTab('stats')}
            className={`inline-flex min-w-0 items-center justify-center gap-1 rounded-xl px-1.5 py-1.5 text-[11px] font-extrabold transition sm:px-2 sm:text-xs ${
              modalTab === 'stats'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-[#354c3f] hover:text-emerald-950 dark:text-[#c7dbcf]'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              <span className="sm:hidden">Postępy</span>
              <span className="hidden sm:inline">Statystyki ({overallPct}%)</span>
            </span>
          </button>
          <button
            type="button"
            data-testid="account-modal-tab-offline"
            onClick={() => setModalTab('offline')}
            className={`inline-flex min-w-0 items-center justify-center gap-1 rounded-xl px-1.5 py-1.5 text-[11px] font-extrabold transition sm:px-2 sm:text-xs ${
              modalTab === 'offline'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-[#354c3f] hover:text-emerald-950 dark:text-[#c7dbcf]'
            }`}
          >
            {isOnline ? (
              <HardDrive className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate">
              Offline<span className="hidden sm:inline"> / PWA</span>
            </span>
          </button>
        </div>

        {/* Status / Validation Notice */}
        {notice && modalTab === 'account' && (
          <div
            data-testid="account-modal-notice"
            className={`mt-4 rounded-2xl border px-3.5 py-2.5 text-xs font-bold ${
              notice.tone === 'emerald'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200'
                : 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-950/60 dark:text-rose-200'
            }`}
          >
            {notice.message}
          </div>
        )}

        {/* STATS TAB */}
        {modalTab === 'stats' ? (
          <div data-testid="account-stats-panel" className="mt-4 space-y-4">
            <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 p-3.5 dark:border-emerald-800/70 dark:bg-emerald-950/30">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-sm font-extrabold text-emerald-950 dark:text-white">
                  Ukończenie kursu ({SKILL_SECTIONS.length} działów)
                </span>
                <span className="font-mono-tabular text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
                  {completedLessons}/{totalLessons} ({overallPct}%)
                </span>
              </div>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-[#d6e7dc] dark:bg-[#233d2f]">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${overallPct}%` }}
                />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-[#d6e7dc] bg-white px-2 py-2 dark:border-[#233d2f] dark:bg-[#112018]">
                  <div className="font-mono-tabular text-sm font-extrabold text-amber-600 dark:text-amber-400">
                    {progress.xp} XP
                  </div>
                  <div className="text-[10px] font-bold text-[#52695b] dark:text-[#94b0a0]">
                    Zdobyte punkty
                  </div>
                </div>
                <div className="rounded-xl border border-[#d6e7dc] bg-white px-2 py-2 dark:border-[#233d2f] dark:bg-[#112018]">
                  <div className="font-mono-tabular text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                    {progress.streak} dni
                  </div>
                  <div className="text-[10px] font-bold text-[#52695b] dark:text-[#94b0a0]">
                    Seria nauki
                  </div>
                </div>
                <div className="rounded-xl border border-[#d6e7dc] bg-white px-2 py-2 dark:border-[#233d2f] dark:bg-[#112018]">
                  <div className="font-mono-tabular text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                    {srsStats.reviewedCards}/{srsStats.total}
                  </div>
                  <div className="text-[10px] font-bold text-[#52695b] dark:text-[#94b0a0]">
                    Fiszki SRS ({srsStats.dueReviews} dziś)
                  </div>
                </div>
              </div>
            </div>

            {/* 11-Section Progress Grid */}
            <div>
              <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
                Postęp w działach
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SKILL_SECTIONS.map((sec) => {
                  const done = sec.lessons.filter((l) => lessonStatuses[l.id] === 'completed').length;
                  const pct = sec.lessons.length > 0 ? Math.round((done / sec.lessons.length) * 100) : 0;
                  return (
                    <div
                      key={sec.id}
                      className="rounded-xl border border-[#e6f0ea] bg-[#f4faf6] px-2.5 py-2 dark:border-[#233d2f] dark:bg-[#182b21]/80"
                    >
                      <div className="flex items-center justify-between gap-1 text-[11px] font-bold">
                        <span className="truncate text-[#16291f] dark:text-emerald-50">
                          {sec.number}. {SHORT_SECTION_NAMES[sec.id] ?? sec.title}
                        </span>
                        <span className="font-mono-tabular shrink-0 text-emerald-700 dark:text-emerald-300">
                          {done}/{sec.lessons.length}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#d6e7dc] dark:bg-[#233d2f]">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Pin Exam Scores */}
            {recentPins.length > 0 && (
              <div>
                <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
                  Ostatnie wyniki Szpilek 3D
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recentPins.map((entry) => (
                    <span
                      key={entry.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#d6e7dc] bg-[#f4faf6] px-2 py-1 text-[11px] font-semibold text-[#16291f] dark:border-[#294737] dark:bg-[#182b21] dark:text-emerald-50"
                    >
                      <span>
                        {entry.mode === 'identify'
                          ? 'Odwr.'
                          : entry.mode === 'dermatomes'
                            ? 'Derm.'
                            : entry.mode === 'biomechanics'
                              ? 'Biom.'
                              : 'Szp.'}
                      </span>
                      <span>{entry.region}</span>
                      <span className="font-mono-tabular font-extrabold text-emerald-700 dark:text-emerald-300">
                        {entry.accuracy}%
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Patient Simulator 3D Scores */}
            {recentPatientCases.length > 0 && (
              <div data-testid="account-stats-patient-cases">
                <div className="mb-1.5 flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
                  <span>Symulator Pacjenta 3D</span>
                  <span className="font-mono-tabular text-emerald-700 dark:text-emerald-300">
                    {uniquePatientCasesDone}/12 przypadków
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recentPatientCases.map((entry) => (
                    <span
                      key={entry.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#d6e7dc] bg-[#f4faf6] px-2 py-1 text-[11px] font-semibold text-[#16291f] dark:border-[#294737] dark:bg-[#182b21] dark:text-emerald-50"
                    >
                      <span
                        className={`rounded px-1 text-[10px] font-extrabold ${
                          entry.mode === 'osce'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}
                      >
                        {entry.mode === 'osce' ? 'OSCE' : 'Nauka'}
                      </span>
                      <span className="max-w-[140px] truncate">{entry.caseTitle}</span>
                      <span className="font-mono-tabular font-extrabold text-emerald-700 dark:text-emerald-300">
                        {entry.grade.toFixed(1).replace('.', ',')}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Weakest Structures (Top 5) */}
            {topMistakes.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-800/70 dark:bg-amber-950/30">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-900 dark:text-amber-200">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Struktury do powtórki (kliknij, aby otworzyć 3D):</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {topMistakes.map(({ structure, wrongCount }) => (
                    <button
                      key={structure.id}
                      type="button"
                      onClick={() => {
                        onInspectStructureIn3D?.(structure);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2 py-1 text-[11px] font-bold text-[#16291f] transition hover:border-emerald-500 hover:bg-emerald-50 dark:border-amber-700 dark:bg-[#112018] dark:text-emerald-50"
                    >
                      <Box className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      <span>{formatBilingualName(structure.namePl, structure.nameEn)}</span>
                      <span className="font-mono-tabular text-amber-700 dark:text-amber-400">
                        ({wrongCount}×)
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : modalTab === 'offline' ? (
          <div data-testid="account-offline-panel" className="mt-4 space-y-4">
            {/* Network & Service Worker Overview Card */}
            <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 p-3.5 dark:border-emerald-800/70 dark:bg-emerald-950/30">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {isOnline ? (
                    <Wifi className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  )}
                  <span className="font-display text-sm font-extrabold text-emerald-950 dark:text-white">
                    {isOnline ? 'Połączono z siecią' : 'Tryb offline (bez sieci)'}
                  </span>
                </div>
                <span
                  data-testid="offline-sw-status"
                  className={`inline-flex items-center gap-1 rounded-xl border px-2 py-0.5 text-[11px] font-extrabold ${
                    offlineStatus?.serviceWorkerState === 'active'
                      ? 'border-emerald-300 bg-white text-emerald-800 dark:border-emerald-700 dark:bg-[#112018] dark:text-emerald-300'
                      : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                  }`}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  <span>
                    {offlineStatus?.serviceWorkerState === 'active'
                      ? 'Service Worker aktywny'
                      : offlineStatus?.serviceWorkerState === 'installing'
                        ? 'Instalowanie SW...'
                        : 'Cache lokalny gotowy'}
                  </span>
                </span>
              </div>

              <div className="mt-3 flex items-baseline justify-between gap-2 text-xs">
                <span className="font-bold text-[#354c3f] dark:text-[#c7dbcf]">
                  Zapisane modele 3D (Cache Storage):
                </span>
                <span
                  data-testid="offline-cached-summary"
                  className="font-mono-tabular font-extrabold text-emerald-700 dark:text-emerald-300"
                >
                  {offlineStatus?.cachedFiles ?? 0}/{TOTAL_OFFLINE_3D_FILES} plików (
                  {formatBytesPl(offlineStatus?.cachedBytes ?? 0)} /{' '}
                  {formatBytesPl(TOTAL_OFFLINE_3D_BYTES)})
                </span>
              </div>

              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-[#d6e7dc] dark:bg-[#233d2f]">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${offlineStatus?.percent ?? 0}%` }}
                />
              </div>

              {offlineProgress && (
                <div
                  data-testid="offline-download-progress"
                  className="mt-2.5 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-[11px] font-bold text-emerald-900 dark:border-emerald-700 dark:bg-[#112018] dark:text-emerald-200"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-600 dark:text-emerald-400" />
                      Pobieranie modeli 3D ({offlineProgress.completedFiles}/
                      {offlineProgress.totalFiles})...
                    </span>
                    <span className="font-mono-tabular">{offlineProgress.percent}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#e6f0ea] dark:bg-[#233d2f]">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-150"
                      style={{ width: `${offlineProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="offline-download-all-btn"
                  disabled={
                    offlineBusyTarget !== null ||
                    !isOnline ||
                    (offlineStatus !== null &&
                      offlineStatus.cachedFiles >= TOTAL_OFFLINE_3D_FILES &&
                      offlineStatus.coreReady)
                  }
                  onClick={handleDownloadAllPacks}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2 disabled:opacity-60"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>
                    {offlineBusyTarget === 'all'
                      ? 'Pobieranie wszystkich...'
                      : offlineStatus && offlineStatus.cachedFiles >= TOTAL_OFFLINE_3D_FILES
                        ? 'Wszystkie 45 modeli 3D offline'
                        : `Pobierz wszystkie 3D (${formatBytesPl(TOTAL_OFFLINE_3D_BYTES)})`}
                  </span>
                </button>
                <button
                  type="button"
                  data-testid="offline-clear-cache-btn"
                  disabled={
                    offlineBusyTarget !== null || (offlineStatus?.cachedFiles ?? 0) === 0
                  }
                  onClick={handleClearOfflineCache}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#d6e7dc] bg-white px-3 py-2 text-xs font-extrabold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:opacity-50 dark:border-[#294737] dark:bg-[#182b21] dark:text-rose-300 dark:hover:border-rose-700 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Wyczyść pamięć</span>
                </button>
              </div>
            </div>

            {offlineNotice && (
              <div
                data-testid="offline-notice"
                className={`rounded-2xl border px-3.5 py-2.5 text-xs font-bold ${
                  offlineNotice.tone === 'emerald'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200'
                    : 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-950/60 dark:text-rose-200'
                }`}
              >
                {offlineNotice.message}
              </div>
            )}

            {/* 5 Regional 3D Model Packs */}
            <div>
              <div className="mb-2 flex items-center justify-between text-xs font-extrabold text-[#16291f] dark:text-emerald-50">
                <span>Pakiety modeli 3D według regionów (5 pakietów)</span>
                <span className="font-mono-tabular text-[11px] font-bold text-[#52695b] dark:text-[#94b0a0]">
                  Draco + warstwy
                </span>
              </div>
              <div className="space-y-2">
                {OFFLINE_MODEL_PACKS.map((pack) => {
                  const st = offlineStatus?.packs[pack.id];
                  const isCached = st?.isComplete ?? false;
                  const isDownloadingThis = offlineBusyTarget === pack.id;
                  return (
                    <div
                      key={pack.id}
                      data-testid={`offline-pack-${pack.id}`}
                      className={`rounded-2xl border p-3 transition ${
                        isCached
                          ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-700/80 dark:bg-emerald-950/25'
                          : 'border-[#d6e7dc] bg-[#f4faf6] dark:border-[#233d2f] dark:bg-[#182b21]/70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-extrabold text-emerald-950 dark:text-white">
                              {pack.namePl}
                            </span>
                            {isCached && (
                              <span
                                data-testid={`offline-pack-saved-${pack.id}`}
                                className="inline-flex items-center gap-0.5 rounded-lg bg-emerald-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white"
                              >
                                <CheckCircle2 className="h-2.5 w-2.5" />
                                Zapisano offline
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-[#52695b] dark:text-[#94b0a0]">
                            {pack.descriptionPl}
                          </p>
                          <div className="mt-1 font-mono-tabular text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                            {st ? `${st.cachedCount}/${st.totalCount}` : `0/${pack.assets.length}`}{' '}
                            plików • {formatBytesPl(pack.totalBytes)}
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isCached ? (
                            <button
                              type="button"
                              data-testid={`offline-pack-remove-${pack.id}`}
                              disabled={offlineBusyTarget !== null}
                              onClick={() => handleRemovePack(pack.id)}
                              className="inline-flex items-center gap-1 rounded-xl border border-[#d6e7dc] bg-white px-2.5 py-1.5 text-[11px] font-extrabold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:opacity-50 dark:border-[#294737] dark:bg-[#112018] dark:text-rose-300"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Usuń</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              data-testid={`offline-pack-download-${pack.id}`}
                              disabled={offlineBusyTarget !== null || !isOnline}
                              onClick={() => handleDownloadPack(pack.id)}
                              className="inline-flex items-center gap-1 rounded-xl border-2 border-emerald-600 bg-emerald-500 px-2.5 py-1.5 text-[11px] font-extrabold text-white transition hover:bg-emerald-600 disabled:opacity-50"
                            >
                              {isDownloadingThis ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <Download className="h-3 w-3" />
                              )}
                              <span>{isDownloadingThis ? 'Pobieram...' : 'Pobierz'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PWA Installation Card */}
            <div className="rounded-2xl border border-[#d6e7dc] bg-[#f4faf6] p-3.5 dark:border-[#233d2f] dark:bg-[#182b21]/70">
              <div className="flex items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                  <Smartphone className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-extrabold text-emerald-950 dark:text-white">
                    Instalacja aplikacji (PWA na telefon / iPad / komputer)
                  </div>
                  {isPwaInstalled ? (
                    <p className="mt-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                      PhysioLingo działa już jako zainstalowana aplikacja w trybie pełnoekranowym!
                    </p>
                  ) : canInstallPwa && onTriggerInstallPwa ? (
                    <div className="mt-2">
                      <p className="text-[11px] text-[#52695b] dark:text-[#94b0a0]">
                        Zainstaluj PhysioLingo jednym kliknięciem na ekranie głównym, aby uczyć się
                        anatomii 3D i fiszek SM-2 bez połączenia z internetem.
                      </p>
                      <button
                        type="button"
                        data-testid="offline-install-pwa-btn"
                        onClick={onTriggerInstallPwa}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-3 py-1.5 text-xs font-extrabold text-white transition hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Zainstaluj PhysioLingo na urządzeniu</span>
                      </button>
                    </div>
                  ) : (
                    <p className="mt-1 text-[11px] leading-relaxed text-[#52695b] dark:text-[#94b0a0]">
                      <strong>Chrome / Edge / Android:</strong> kliknij ikonę instalacji w pasku
                      adresu lub menu → <em>Zainstaluj aplikację</em>.{' '}
                      <strong>iPhone / iPad (Safari):</strong> kliknij <em>Udostępnij</em> →{' '}
                      <em>Dodaj do ekranu początkowego</em>.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : user ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-800/70 dark:bg-emerald-950/30">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div
                    data-testid="account-profile-display-name"
                    className="truncate font-display text-base font-extrabold text-emerald-950 dark:text-white"
                  >
                    {user.displayName}
                  </div>
                  <div
                    data-testid="account-profile-username"
                    className="font-mono-tabular text-xs font-bold text-emerald-700 dark:text-emerald-300"
                  >
                    @{user.username}
                  </div>
                </div>
                <span
                  data-testid="account-backend-badge"
                  className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-extrabold text-emerald-800 dark:border-emerald-700 dark:bg-[#112018] dark:text-emerald-300"
                >
                  {user.storageBackend === 'server' ? (
                    <>
                      <Cloud className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Serwer API</span>
                    </>
                  ) : (
                    <>
                      <HardDrive className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Lokalnie</span>
                    </>
                  )}
                </span>
              </div>

              <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-[#354c3f] dark:text-[#c7dbcf]">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{syncLabel}</span>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                <div className="rounded-xl border border-[#d6e7dc] bg-white px-2 py-2 dark:border-[#233d2f] dark:bg-[#112018]">
                  <div className="font-mono-tabular text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                    {completedLessons}/{totalLessons}
                  </div>
                  <div className="text-[10px] font-bold text-[#52695b] dark:text-[#94b0a0]">
                    Lekcje
                  </div>
                </div>
                <div className="rounded-xl border border-[#d6e7dc] bg-white px-2 py-2 dark:border-[#233d2f] dark:bg-[#112018]">
                  <div className="font-mono-tabular text-sm font-extrabold text-amber-600 dark:text-amber-400">
                    {progress.xp}
                  </div>
                  <div className="text-[10px] font-bold text-[#52695b] dark:text-[#94b0a0]">XP</div>
                </div>
                <div className="rounded-xl border border-[#d6e7dc] bg-white px-2 py-2 dark:border-[#233d2f] dark:bg-[#112018]">
                  <div className="font-mono-tabular text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                    {progress.streak}
                  </div>
                  <div className="text-[10px] font-bold text-[#52695b] dark:text-[#94b0a0]">
                    Dni
                  </div>
                </div>
                <div className="rounded-xl border border-[#d6e7dc] bg-white px-2 py-2 dark:border-[#233d2f] dark:bg-[#112018]">
                  <div className="font-mono-tabular text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                    {srsStats.reviewedCards}
                  </div>
                  <div className="text-[10px] font-bold text-[#52695b] dark:text-[#94b0a0]">
                    Fiszki
                  </div>
                </div>
              </div>
            </div>

            {/* Change Password Collapsible */}
            <div className="rounded-2xl border border-[#d6e7dc] bg-[#f4faf6] p-3.5 dark:border-[#233d2f] dark:bg-[#182b21]/60">
              <button
                type="button"
                data-testid="toggle-change-password"
                onClick={() => {
                  setShowPasswordForm((prev) => !prev);
                  setShowDeleteForm(false);
                }}
                className="flex w-full items-center justify-between text-xs font-extrabold text-[#16291f] dark:text-emerald-50"
              >
                <span className="inline-flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Zmień hasło</span>
                </span>
                <span className="text-emerald-700 dark:text-emerald-300">
                  {showPasswordForm ? 'Ukryj' : 'Rozwiń'}
                </span>
              </button>

              {showPasswordForm && (
                <form onSubmit={handlePasswordChangeSubmit} className="mt-3 space-y-2.5">
                  <input
                    type="password"
                    data-testid="change-password-current"
                    value={currentPwd}
                    onChange={(e) => setCurrentPwd(e.target.value)}
                    placeholder="Obecne hasło"
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-[#c2d8ca] bg-white px-3 py-2 text-sm text-[#16291f] focus:border-emerald-500 focus:outline-none dark:border-[#294737] dark:bg-[#112018] dark:text-white"
                  />
                  <input
                    type="password"
                    data-testid="change-password-new"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    placeholder="Nowe hasło (min. 6 znaków)"
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-[#c2d8ca] bg-white px-3 py-2 text-sm text-[#16291f] focus:border-emerald-500 focus:outline-none dark:border-[#294737] dark:bg-[#112018] dark:text-white"
                  />
                  <input
                    type="password"
                    data-testid="change-password-confirm"
                    value={confirmNewPwd}
                    onChange={(e) => setConfirmNewPwd(e.target.value)}
                    placeholder="Powtórz nowe hasło"
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-[#c2d8ca] bg-white px-3 py-2 text-sm text-[#16291f] focus:border-emerald-500 focus:outline-none dark:border-[#294737] dark:bg-[#112018] dark:text-white"
                  />
                  <button
                    type="submit"
                    data-testid="change-password-submit"
                    disabled={busy}
                    className="w-full rounded-xl border-2 border-b-3 border-emerald-700 bg-emerald-500 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-emerald-600 disabled:opacity-60"
                  >
                    Zapisz nowe hasło
                  </button>
                </form>
              )}
            </div>

            {/* Logout & Delete Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                data-testid="account-logout-btn"
                disabled={busy}
                onClick={handleLogoutClick}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-b-4 border-[#c2d8ca] bg-white px-4 py-2.5 text-xs font-extrabold text-[#16291f] transition hover:border-emerald-400 hover:bg-[#f4faf6] active:translate-y-0.5 active:border-b-2 disabled:opacity-60 dark:border-[#294737] dark:bg-[#182b21] dark:text-emerald-50"
              >
                <LogOut className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Wyloguj się</span>
              </button>

              <button
                type="button"
                data-testid="toggle-delete-account"
                onClick={() => {
                  setShowDeleteForm((prev) => !prev);
                  setShowPasswordForm(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-rose-200 bg-rose-50/70 px-3.5 py-2.5 text-xs font-extrabold text-rose-700 transition hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Usuń konto</span>
              </button>
            </div>

            {showDeleteForm && (
              <form
                onSubmit={handleDeleteAccountSubmit}
                className="space-y-2.5 rounded-2xl border border-rose-300 bg-rose-50/70 p-3.5 dark:border-rose-800 dark:bg-rose-950/30"
              >
                <p className="text-xs font-semibold text-rose-900 dark:text-rose-200">
                  Ta operacja trwale usunie konto oraz zapisane na nim postępy. Potwierdź obecnym hasłem:
                </p>
                <input
                  type="password"
                  data-testid="delete-account-password"
                  value={deletePwd}
                  onChange={(e) => setDeletePwd(e.target.value)}
                  placeholder="Wpisz hasło, aby potwierdzić"
                  className="w-full rounded-xl border border-rose-300 bg-white px-3 py-2 text-sm text-[#16291f] focus:border-rose-500 focus:outline-none dark:border-rose-800 dark:bg-[#112018] dark:text-white"
                />
                <button
                  type="submit"
                  data-testid="delete-account-submit"
                  disabled={busy}
                  className="w-full rounded-xl border-2 border-b-3 border-rose-700 bg-rose-500 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-rose-600 disabled:opacity-60"
                >
                  Potwierdź trwałe usunięcie konta
                </button>
              </form>
            )}
          </div>
        ) : (
          /* GUEST LOGIN / REGISTER VIEW */
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[#d6e7dc] bg-[#f4faf6] p-1 dark:border-[#233d2f] dark:bg-[#182b21]">
              <button
                type="button"
                data-testid="account-tab-register"
                onClick={() => {
                  setAuthTab('register');
                  setNotice(null);
                }}
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold transition ${
                  authTab === 'register'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-[#354c3f] hover:text-emerald-950 dark:text-[#c7dbcf]'
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Załóż konto</span>
              </button>
              <button
                type="button"
                data-testid="account-tab-login"
                onClick={() => {
                  setAuthTab('login');
                  setNotice(null);
                }}
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold transition ${
                  authTab === 'login'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-[#354c3f] hover:text-emerald-950 dark:text-[#c7dbcf]'
                }`}
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Zaloguj się</span>
              </button>
            </div>

            {authTab === 'register' ? (
              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs text-emerald-900 dark:border-emerald-800/70 dark:bg-emerald-950/30 dark:text-emerald-200">
                  Obecny postęp Gościa (<strong>{completedLessons} lekcji</strong> •{' '}
                  <strong>{progress.xp} XP</strong>) zostanie automatycznie przypisany do nowego konta.
                </div>

                <div>
                  <label className="mb-1 block text-xs font-extrabold text-[#26382e] dark:text-[#c7dbcf]">
                    Login (3–24 znaki)
                  </label>
                  <input
                    type="text"
                    data-testid="register-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="np. anna_fizjo"
                    autoComplete="username"
                    required
                    className="w-full rounded-xl border-2 border-[#c2d8ca] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#16291f] focus:border-emerald-500 focus:outline-none dark:border-[#294737] dark:bg-[#182b21] dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-extrabold text-[#26382e] dark:text-[#c7dbcf]">
                    Nazwa wyświetlana (opcjonalna)
                  </label>
                  <input
                    type="text"
                    data-testid="register-display-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="np. Anna Kowalska"
                    className="w-full rounded-xl border-2 border-[#c2d8ca] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#16291f] focus:border-emerald-500 focus:outline-none dark:border-[#294737] dark:bg-[#182b21] dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-extrabold text-[#26382e] dark:text-[#c7dbcf]">
                    Hasło (min. 6 znaków)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      data-testid="register-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Ustaw bezpieczne hasło"
                      autoComplete="new-password"
                      required
                      className="w-full rounded-xl border-2 border-[#c2d8ca] bg-white py-2.5 pr-10 pl-3.5 text-sm font-semibold text-[#16291f] focus:border-emerald-500 focus:outline-none dark:border-[#294737] dark:bg-[#182b21] dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
                      className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-lg p-1 text-[#6b8274] hover:text-emerald-700"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-extrabold text-[#26382e] dark:text-[#c7dbcf]">
                    Powtórz hasło
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    data-testid="register-password-confirm"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Wpisz hasło ponownie"
                    autoComplete="new-password"
                    required
                    className="w-full rounded-xl border-2 border-[#c2d8ca] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#16291f] focus:border-emerald-500 focus:outline-none dark:border-[#294737] dark:bg-[#182b21] dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  data-testid="register-submit"
                  disabled={busy}
                  className="w-full rounded-2xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-5 py-3 font-display text-sm font-extrabold text-white transition hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2 disabled:opacity-60"
                >
                  {busy ? 'Tworzenie konta...' : 'Załóż konto i zapisz postęp'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleLoginSubmit} className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-extrabold text-[#26382e] dark:text-[#c7dbcf]">
                    Login
                  </label>
                  <input
                    type="text"
                    data-testid="login-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Twój login"
                    autoComplete="username"
                    required
                    className="w-full rounded-xl border-2 border-[#c2d8ca] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#16291f] focus:border-emerald-500 focus:outline-none dark:border-[#294737] dark:bg-[#182b21] dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-extrabold text-[#26382e] dark:text-[#c7dbcf]">
                    Hasło
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      data-testid="login-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Twoje hasło"
                      autoComplete="current-password"
                      required
                      className="w-full rounded-xl border-2 border-[#c2d8ca] bg-white py-2.5 pr-10 pl-3.5 text-sm font-semibold text-[#16291f] focus:border-emerald-500 focus:outline-none dark:border-[#294737] dark:bg-[#182b21] dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
                      className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-lg p-1 text-[#6b8274] hover:text-emerald-700"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  data-testid="login-submit"
                  disabled={busy}
                  className="w-full rounded-2xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-5 py-3 font-display text-sm font-extrabold text-white transition hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2 disabled:opacity-60"
                >
                  {busy ? 'Logowanie...' : 'Zaloguj się'}
                </button>
              </form>
            )}

            <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#52695b] dark:text-[#94b0a0]">
              {backend === 'server' ? (
                <>
                  <Cloud className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Połączono z serwerem kont (zapis automatyczny + hashowanie scrypt)</span>
                </>
              ) : (
                <>
                  <HardDrive className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Tryb offline — konta zapisywane bezpiecznie lokalnie w przeglądarce</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* JSON Backup Section (relocated from Mastery Dashboard) */}
        <div className="mt-5 border-t border-[#e6f0ea] pt-4 dark:border-[#233d2f]">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-extrabold text-[#16291f] dark:text-emerald-50">
                Kopia zapasowa postępu (JSON)
              </div>
              <div className="text-[11px] text-[#52695b] dark:text-[#94b0a0]">
                Eksportuj lub wczytaj plik kopii zapasowej
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                data-testid="btn-export-progress"
                onClick={handleExportJson}
                className="inline-flex items-center gap-1 rounded-xl border border-[#d6e7dc] bg-[#f4faf6] px-2.5 py-1.5 text-xs font-bold text-[#26382e] transition hover:border-emerald-400 hover:bg-[#ebf5ee] dark:border-[#294737] dark:bg-[#182b21] dark:text-[#c7dbcf]"
              >
                <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Eksport</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleImportFile}
                className="hidden"
              />
              <button
                type="button"
                data-testid="btn-import-progress"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-xl border border-[#d6e7dc] bg-[#f4faf6] px-2.5 py-1.5 text-xs font-bold text-[#26382e] transition hover:border-emerald-400 hover:bg-[#ebf5ee] dark:border-[#294737] dark:bg-[#182b21] dark:text-[#c7dbcf]"
              >
                <Upload className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Import</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
