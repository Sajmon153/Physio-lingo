import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  Flame,
  Heart,
  Lock,
  Monitor,
  Moon,
  Smartphone,
  Sparkles,
  Sun,
  Tablet,
  Unlock,
  UserCheck,
  UserCircle2,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { DeviceViewMode, UserProgress } from '../types/anatomy';
import type { AccountSyncStatus, UserAccountPublic } from '../types/auth';

interface TopBarProps {
  progress: UserProgress;
  authUser?: UserAccountPublic | null;
  syncStatus?: AccountSyncStatus;
  isOnline?: boolean;
  isPwaInstalled?: boolean;
  canInstallPwa?: boolean;
  onTriggerInstallPwa?: () => void;
  onOpenInstallModal?: () => void;
  onOpenOfflineManager?: () => void;
  onOpenAccountModal?: () => void;
  onToggleTheme: () => void;
  onToggleStudyMode?: () => void;
  onChangeDeviceMode?: (mode: DeviceViewMode) => void;
  onChangeUiScale?: (scale: number) => void;
  onOpenHeartsModal: () => void;
}

const DEVICE_MODES: Array<{
  id: DeviceViewMode;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'auto', label: 'Auto', hint: 'Dopasuj automatycznie do ekranu', icon: Sparkles },
  { id: 'phone', label: 'Smartfon', hint: 'Układ mobilny (430 px) + dotyk', icon: Smartphone },
  { id: 'ipad', label: 'iPad', hint: 'Układ tabletowy (860 px) + boczny pasek', icon: Tablet },
  { id: 'desktop', label: 'Desktop', hint: 'Pełny ekran komputera', icon: Monitor },
];

const UI_SCALE_PRESETS = [85, 95, 100, 105, 115] as const;

export const TopBar: React.FC<TopBarProps> = React.memo(({
  progress,
  authUser = null,
  syncStatus = 'idle',
  isOnline = true,
  isPwaInstalled = false,
  canInstallPwa = false,
  onTriggerInstallPwa,
  onOpenInstallModal,
  onOpenOfflineManager,
  onOpenAccountModal,
  onToggleTheme,
  onToggleStudyMode,
  onChangeDeviceMode,
  onChangeUiScale,
  onOpenHeartsModal,
}) => {
  const prevXpRef = useRef(progress.xp);
  const [xpDelta, setXpDelta] = useState<number | null>(null);
  const [showScaleMenu, setShowScaleMenu] = useState(false);
  const scaleMenuRef = useRef<HTMLDivElement | null>(null);

  const isFreeMode = progress.studyMode === 'free';
  const deviceMode: DeviceViewMode = progress.deviceMode ?? 'auto';
  const uiScale = progress.uiScale ?? 100;

  useEffect(() => {
    const diff = progress.xp - prevXpRef.current;
    prevXpRef.current = progress.xp;
    if (diff > 0) {
      setXpDelta(diff);
      const timer = setTimeout(() => setXpDelta(null), 1400);
      return () => clearTimeout(timer);
    }
  }, [progress.xp]);

  useEffect(() => {
    if (!showScaleMenu) return;
    const onDocClick = (ev: MouseEvent) => {
      if (scaleMenuRef.current && !scaleMenuRef.current.contains(ev.target as Node)) {
        setShowScaleMenu(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showScaleMenu]);

  const ActiveDeviceIcon =
    deviceMode === 'phone'
      ? Smartphone
      : deviceMode === 'ipad'
        ? Tablet
        : deviceMode === 'desktop'
          ? Monitor
          : Smartphone;

  const isCompactPhone = deviceMode === 'phone';

  return (
    <header className="pt-safe sticky top-0 z-30 border-b-2 border-[#d6e7dc] bg-white/95 px-2.5 py-2 backdrop-blur-md sm:px-4 sm:py-2.5 dark:border-[#233d2f] dark:bg-[#112018]/95">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-1.5 sm:gap-2">
        {/* Brand label when sidebar is hidden (mobile/tablet/phone mode) */}
        <div
          className={`flex items-center gap-2 ${
            isCompactPhone
              ? 'flex'
              : deviceMode === 'desktop'
                ? 'hidden'
                : deviceMode === 'ipad'
                  ? 'flex sm:hidden'
                  : 'flex lg:hidden'
          }`}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border-b-4 border-emerald-700 bg-emerald-500 font-display text-base font-extrabold text-white">
            P
          </div>
          <span className="font-display text-base font-extrabold tracking-tight text-emerald-950 dark:text-white">
            PhysioLingo
          </span>
        </div>

        <div className="hidden items-center gap-2 xl:flex">
          <span className="truncate text-sm font-semibold text-[#52695b] dark:text-[#94b0a0]">
            Anatomia Funkcjonalna i Kliniczna 3D
          </span>
        </div>

        {/* Gamification Stats, Account, Device/Scale Switcher & Theme Toggle */}
        <div className="ml-auto flex w-full flex-wrap items-center justify-between gap-1 sm:w-auto sm:justify-end sm:gap-2">
          {/* Discreet Offline Indicator Pill (shown when browser has no network) */}
          {!isOnline && (
            <button
              type="button"
              data-testid="topbar-offline-badge"
              onClick={onOpenOfflineManager ?? onOpenAccountModal}
              title="Brak połączenia z internetem — pracujesz w trybie offline. Kliknij, aby zarządzać zapisanymi modelami 3D."
              className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border-2 border-amber-400 bg-amber-50 px-2 py-1.5 text-xs font-extrabold text-amber-800 transition hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-300"
            >
              <WifiOff className="h-3.5 w-3.5" />
              <span className={isCompactPhone ? 'hidden' : 'hidden sm:inline'}>Offline</span>
            </button>
          )}

          {/* Always-visible Download/Install App Button when running in browser (!isPwaInstalled) */}
          {!isPwaInstalled && (onOpenInstallModal || (canInstallPwa && onTriggerInstallPwa)) && (
            <button
              type="button"
              data-testid="topbar-install-pwa-btn"
              onClick={onOpenInstallModal ?? onTriggerInstallPwa}
              title="Pobierz i zainstaluj PhysioLingo na telefonie lub komputerze"
              className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border-2 border-emerald-500 bg-emerald-50 px-2 py-1.5 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-500 dark:bg-emerald-950/70 dark:text-emerald-200"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Pobierz</span>
            </button>
          )}

          {/* User Account / Login Button */}
          {onOpenAccountModal && (
            <button
              type="button"
              data-testid="account-btn"
              onClick={onOpenAccountModal}
              title={
                authUser
                  ? `Zalogowano jako ${authUser.displayName} (@${authUser.username}) — kliknij, aby zarządzać kontem`
                  : 'Zaloguj się lub załóż konto, aby zapisywać postępy'
              }
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border-2 px-2 py-1.5 text-xs font-extrabold transition ${
                authUser
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500 dark:bg-emerald-950/70 dark:text-emerald-200'
                  : 'border-[#d6e7dc] bg-[#f4faf6] text-[#26382e] hover:border-emerald-400 dark:border-[#294737] dark:bg-[#182b21] dark:text-emerald-50'
              }`}
            >
              {authUser ? (
                <UserCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <UserCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              )}
              <span className={isCompactPhone ? 'max-w-[74px] truncate' : 'hidden max-w-[110px] truncate sm:inline'}>
                {authUser ? `@${authUser.username}` : 'Konto'}
              </span>
              {authUser && (
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${
                    syncStatus === 'syncing'
                      ? 'animate-pulse bg-amber-400'
                      : syncStatus === 'offline' || syncStatus === 'error'
                        ? 'bg-rose-400'
                        : 'bg-emerald-500'
                  }`}
                />
              )}
            </button>
          )}

          {/* Device & UI Scale Switcher (Smartfon / iPad / Desktop + 85%-115%) */}
          {(onChangeDeviceMode || onChangeUiScale) && (
            <div ref={scaleMenuRef} className="relative">
              <button
                type="button"
                data-testid="device-scale-toggle"
                onClick={() => setShowScaleMenu((prev) => !prev)}
                title="Skalowanie aplikacji na Smartfon, iPad lub Desktop oraz rozmiar interfejsu"
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border-2 px-2 py-1.5 text-xs font-extrabold transition ${
                  deviceMode !== 'auto' || uiScale !== 100
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/70 dark:text-emerald-200'
                    : 'border-[#d6e7dc] bg-[#f4faf6] text-[#26382e] hover:border-emerald-400 dark:border-[#294737] dark:bg-[#182b21] dark:text-emerald-50'
                }`}
              >
                <ActiveDeviceIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">
                  {deviceMode === 'auto'
                    ? 'Ekran'
                    : deviceMode === 'phone'
                      ? 'Smartfon'
                      : deviceMode === 'ipad'
                        ? 'iPad'
                        : 'Desktop'}
                </span>
                {uiScale !== 100 && (
                  <span className="font-mono-tabular text-[10px] text-emerald-700 dark:text-emerald-300">
                    {uiScale}%
                  </span>
                )}
              </button>

              {showScaleMenu && (
                <div
                  data-testid="device-scale-menu"
                  className="fixed inset-x-3 top-20 z-50 mx-auto w-auto max-w-xs rounded-2xl border-2 border-emerald-500 bg-white p-3.5 shadow-2xl sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mx-0 sm:mt-2 sm:w-72 dark:border-emerald-600 dark:bg-[#112018]"
                >
                  <div className="flex items-center justify-between border-b border-[#d6e7dc] pb-2 dark:border-[#233d2f]">
                    <span className="text-xs font-extrabold text-emerald-950 dark:text-white">
                      Skalowanie: Smartfon / iPad
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowScaleMenu(false)}
                      aria-label="Zamknij menu skalowania"
                      className="rounded-lg p-1 text-[#6b8274] hover:bg-[#f4faf6] dark:hover:bg-[#182b21]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {onChangeDeviceMode && (
                    <div className="mt-2.5">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
                        Tryb układu urządzenia
                      </div>
                      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                        {DEVICE_MODES.map((m) => {
                          const Icon = m.icon;
                          const active = deviceMode === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              data-testid={`device-mode-${m.id}`}
                              onClick={() => onChangeDeviceMode(m.id)}
                              title={m.hint}
                              className={`flex items-center gap-1.5 rounded-xl border-2 px-2.5 py-2 text-left text-xs font-extrabold transition ${
                                active
                                  ? 'border-emerald-600 bg-emerald-500 text-white'
                                  : 'border-[#d6e7dc] bg-[#f4faf6] text-[#16291f] hover:border-emerald-400 dark:border-[#294737] dark:bg-[#182b21] dark:text-emerald-50'
                              }`}
                            >
                              <Icon className="h-3.5 w-3.5 shrink-0" />
                              <span>{m.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {onChangeUiScale && (
                    <div className="mt-3 border-t border-[#e6f0ea] pt-2.5 dark:border-[#233d2f]">
                      <div className="flex items-center justify-between text-[11px] font-extrabold text-[#16291f] dark:text-emerald-50">
                        <span>Skala interfejsu (UI)</span>
                        <span className="font-mono-tabular text-emerald-600 dark:text-emerald-400">
                          {uiScale}%
                        </span>
                      </div>
                      <input
                        type="range"
                        data-testid="ui-scale-slider"
                        min={85}
                        max={115}
                        step={5}
                        value={uiScale}
                        onChange={(e) => onChangeUiScale(Number(e.target.value))}
                        className="mt-1.5 w-full accent-emerald-600"
                      />
                      <div className="mt-1.5 flex items-center justify-between gap-1">
                        {UI_SCALE_PRESETS.map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            data-testid={`ui-scale-preset-${pct}`}
                            onClick={() => onChangeUiScale(pct)}
                            className={`flex-1 rounded-lg border py-1 font-mono-tabular text-[10px] font-extrabold transition ${
                              uiScale === pct
                                ? 'border-emerald-600 bg-emerald-500 text-white'
                                : 'border-[#d6e7dc] bg-[#f4faf6] text-[#354c3f] hover:border-emerald-400 dark:border-[#294737] dark:bg-[#182b21] dark:text-[#c7dbcf]'
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Course vs Free Study Mode Toggle */}
          {onToggleStudyMode && (
            <button
              type="button"
              data-testid="study-mode-toggle"
              onClick={onToggleStudyMode}
              title={
                isFreeMode
                  ? 'Tryb swobodny aktywny: wszystkie 37 lekcji odblokowane, bez utraty serc. Kliknij, aby wrócić do trybu kursu.'
                  : 'Tryb kursu aktywny: lekcje odblokowywane po kolei z sercami. Kliknij, aby włączyć tryb swobodny (wszystkie 37 lekcji odblokowane).'
              }
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border-2 px-2 py-1.5 text-xs font-extrabold transition ${
                isFreeMode
                  ? 'border-emerald-600 bg-emerald-500 text-white hover:bg-emerald-600'
                  : 'border-[#d6e7dc] bg-[#f4faf6] text-[#26382e] hover:border-emerald-400 dark:border-[#294737] dark:bg-[#182b21] dark:text-emerald-50'
              }`}
            >
              {isFreeMode ? (
                <Unlock className="h-3.5 w-3.5" />
              ) : (
                <Lock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              )}
              <span className={isCompactPhone ? 'hidden' : 'hidden md:inline'}>
                {isFreeMode ? 'Tryb swobodny' : 'Tryb kursu'}
              </span>
            </button>
          )}

          {/* Streak */}
          <div
            data-testid="stat-streak"
            title="Dni nauki z rzędu (Streak)"
            className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border-2 border-[#d6e7dc] bg-[#f4faf6] px-1.5 py-1 text-xs font-bold text-[#16291f] sm:px-2 sm:py-1.5 sm:text-sm dark:border-[#294737] dark:bg-[#182b21] dark:text-emerald-50"
          >
            <Flame
              className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${
                progress.streak > 0
                  ? 'fill-orange-500 text-orange-500'
                  : 'text-[#6b8274] dark:text-[#739180]'
              }`}
            />
            <span className="font-mono-tabular">{progress.streak}</span>
            <span className={isCompactPhone ? 'hidden' : 'hidden text-xs font-semibold text-[#52695b] sm:inline dark:text-[#94b0a0]'}>
              dni
            </span>
          </div>

          {/* XP with delta pop */}
          <div
            data-testid="stat-xp"
            title="Zdobyte punkty XP"
            className="relative flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border-2 border-[#d6e7dc] bg-[#f4faf6] px-1.5 py-1 text-xs font-bold text-[#16291f] sm:px-2 sm:py-1.5 sm:text-sm dark:border-[#294737] dark:bg-[#182b21] dark:text-emerald-50"
          >
            <Zap className="h-3.5 w-3.5 fill-amber-400 text-amber-500 sm:h-4 sm:w-4" />
            <span className="font-mono-tabular">{progress.xp}</span>
            <span className="text-[11px] font-semibold text-amber-600 sm:text-xs dark:text-amber-400">XP</span>
            {xpDelta !== null && (
              <span className="animate-xp-rise pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-emerald-500 px-2 py-0.5 text-xs font-extrabold text-white shadow-md">
                +{xpDelta} XP
              </span>
            )}
          </div>

          {/* Hearts */}
          <button
            type="button"
            data-testid="stat-hearts"
            onClick={onOpenHeartsModal}
            title={
              isFreeMode
                ? 'Tryb swobodny — nielimitowane serca podczas nauki'
                : 'Serca (życia) — kliknij, aby uzupełnić lub zrobić powtórkę'
            }
            className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border-2 px-1.5 py-1 text-xs font-bold transition hover:bg-rose-50 sm:px-2 sm:py-1.5 sm:text-sm dark:hover:bg-rose-950/40 ${
              !isFreeMode && progress.hearts === 0
                ? 'border-rose-400 bg-rose-50 text-rose-700 dark:border-rose-600 dark:bg-rose-950/60 dark:text-rose-300'
                : 'border-[#d6e7dc] bg-[#f4faf6] text-[#16291f] dark:border-[#294737] dark:bg-[#182b21] dark:text-emerald-50'
            }`}
          >
            <Heart
              className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${
                isFreeMode || progress.hearts > 0
                  ? 'fill-rose-500 text-rose-500'
                  : 'text-rose-400 dark:text-rose-500'
              }`}
            />
            <span className="font-mono-tabular">
              {isFreeMode ? '∞' : `${progress.hearts}/${progress.maxHearts}`}
            </span>
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            data-testid="theme-toggle"
            onClick={onToggleTheme}
            aria-label={
              progress.theme === 'dark' ? 'Przełącz na tryb jasny' : 'Przełącz na tryb ciemny'
            }
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border-2 border-b-4 border-[#d6e7dc] bg-white text-[#26382e] transition hover:bg-[#f4faf6] active:translate-y-0.5 active:border-b-2 sm:h-9 sm:w-9 dark:border-[#294737] dark:bg-[#182b21] dark:text-[#e6f2ea] dark:hover:bg-[#20382b]"
          >
            {progress.theme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-[#354c3f]" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
});
