import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  HardDriveDownload,
  Laptop,
  MoreVertical,
  PlusSquare,
  Share2,
  Smartphone,
  Sparkles,
  WifiOff,
  X,
} from 'lucide-react';
import {
  buildAndroidChromeIntentUrl,
  buildDirectInstallShareUrl,
  detectInstallEnvironment,
  type InstallPlatformTab,
} from '../services/pwaOfflineService';

interface InstallAppPromptModalProps {
  isOpen: boolean;
  canInstallNative: boolean;
  onTriggerNativeInstall: () => Promise<boolean | void> | void;
  onOpenOfflinePacks?: () => void;
  onClose: () => void;
}

export const InstallAppPromptModal: React.FC<InstallAppPromptModalProps> = ({
  isOpen,
  canInstallNative,
  onTriggerNativeInstall,
  onOpenOfflinePacks,
  onClose,
}) => {
  const env = useMemo(() => detectInstallEnvironment(), []);
  const [selectedTab, setSelectedTab] = useState<InstallPlatformTab>(env.defaultTab);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedTab(env.defaultTab);
    }
  }, [isOpen, env.defaultTab]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shareUrl =
    typeof window !== 'undefined'
      ? buildDirectInstallShareUrl(window.location.origin)
      : 'https://physio-lingo.fizjolingo.workers.dev/?install=1';

  const handleCopyOrShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'PhysioLingo — Pobierz aplikację 3D',
          text: 'Pobierz darmową aplikację PhysioLingo (Anatomia Funkcjonalna i Kliniczna 3D) na telefon lub komputer:',
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to clipboard copy if user cancels share sheet or unsupported
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2400);
    } catch {
      setCopiedLink(false);
    }
  };

  const handleNativeInstallClick = async () => {
    setIsInstalling(true);
    try {
      await onTriggerNativeInstall();
    } finally {
      setIsInstalling(false);
    }
  };

  const androidIntentUrl =
    typeof window !== 'undefined' ? buildAndroidChromeIntentUrl(window.location.href) : shareUrl;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 p-2 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-app-modal-title"
      data-testid="install-app-prompt-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border-2 border-[#c8e3d2] bg-white shadow-2xl dark:border-[#254434] dark:bg-[#101f17]">
        {/* Top Hero Header */}
        <div className="relative border-b border-[#d6e7dc] bg-gradient-to-br from-emerald-50 via-[#f4faf6] to-emerald-100/60 px-4 pt-4 pb-3.5 sm:px-5 dark:border-[#233d2f] dark:from-[#13291e] dark:via-[#101f17] dark:to-[#13291e]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij okno pobierania aplikacji"
            data-testid="install-modal-close-x"
            className="absolute top-3.5 right-3.5 flex h-8 w-8 items-center justify-center rounded-xl border border-[#c8e3d2] bg-white/90 text-[#456050] transition hover:bg-emerald-50 hover:text-emerald-900 dark:border-[#294737] dark:bg-[#162a1f] dark:text-[#9cb8a8]"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3 pr-9">
            <img
              src="/icons/icon-192.png"
              alt="Ikona PhysioLingo"
              className="h-12 w-12 shrink-0 rounded-2xl border-2 border-emerald-500/40 bg-emerald-500 object-cover shadow-sm"
            />
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1 rounded-full bg-emerald-600/12 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300">
                <Sparkles className="h-3 w-3" />
                <span>Aplikacja na telefon i komputer</span>
              </div>
              <h2
                id="install-app-modal-title"
                className="mt-0.5 font-display text-lg leading-tight font-extrabold text-emerald-950 sm:text-xl dark:text-white"
              >
                Pobierz PhysioLingo 3D
              </h2>
            </div>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-[#385243] dark:text-[#b4cec0]">
            Zainstaluj aplikację bezpośrednio na ekranie głównym telefonu lub pulpicie komputera —
            uruchamia się z własnej ikony na pełnym ekranie i działa również offline.
          </p>

          {/* Feature Pills */}
          <div className="mt-2.5 flex flex-wrap gap-1.5 text-[10px] font-bold">
            <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-300/80 bg-white/85 px-2 py-0.5 text-emerald-900 dark:border-emerald-700/70 dark:bg-[#162a1f] dark:text-emerald-200">
              <Download className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              Szybka instalacja bez sklepu
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-300/80 bg-white/85 px-2 py-0.5 text-emerald-900 dark:border-emerald-700/70 dark:bg-[#162a1f] dark:text-emerald-200">
              <WifiOff className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              Nauka i modele 3D offline
            </span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3.5 sm:px-5">
          {/* In-App Messenger / Instagram WebView Warning + 1-Tap Chrome Breakout */}
          {env.isInAppBrowser && (
            <div
              data-testid="install-inapp-warning"
              className="rounded-2xl border-2 border-amber-400 bg-amber-50/90 p-3 dark:border-amber-600 dark:bg-amber-950/45"
            >
              <div className="text-xs font-extrabold text-amber-950 dark:text-amber-200">
                Otwarto link w wewnętrznej przeglądarce komunikatora
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-amber-900 dark:text-amber-200/90">
                Wbudowany podgląd (np. Messenger / Instagram) blokuje instalację aplikacji. Otwórz
                ten link w zewnętrznej przeglądarce <strong>Chrome</strong> lub{' '}
                <strong>Safari</strong>:
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {env.os === 'android' && (
                  <a
                    href={androidIntentUrl}
                    className="inline-flex items-center gap-1.5 rounded-xl border-b-2 border-emerald-800 bg-emerald-600 px-3 py-1.5 text-xs font-extrabold text-white transition hover:bg-emerald-500"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Otwórz od razu w Chrome</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleCopyOrShare}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500 bg-white px-2.5 py-1.5 text-xs font-bold text-amber-950 transition hover:bg-amber-100 dark:bg-[#162a1f] dark:text-amber-200"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedLink ? 'Skopiowano link!' : 'Skopiuj link'}</span>
                </button>
              </div>
            </div>
          )}

          {/* 1-Click Direct Native Download/Install CTA (shown immediately whenever supported by browser!) */}
          {canInstallNative && (
            <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50/80 p-3.5 dark:border-emerald-600 dark:bg-emerald-950/40">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-emerald-950 dark:text-emerald-100">
                  Twoja przeglądarka obsługuje instalację 1 kliknięciem:
                </span>
                <span className="shrink-0 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                  GOTOWE
                </span>
              </div>
              <button
                type="button"
                data-testid="install-modal-native-btn"
                disabled={isInstalling}
                onClick={handleNativeInstallClick}
                className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-4 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2 disabled:opacity-60"
              >
                <Download className="h-4 w-4 shrink-0" />
                <span>
                  {isInstalling
                    ? 'Otwieranie instalatora…'
                    : env.defaultTab === 'mobile'
                      ? 'Pobierz i zainstaluj na telefonie'
                      : 'Pobierz i zainstaluj na komputerze'}
                </span>
              </button>
            </div>
          )}

          {/* Device Switcher: Telefon / Tablet vs Komputer */}
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[#d6e7dc] bg-[#f4faf6] p-1 dark:border-[#233d2f] dark:bg-[#15281e]">
            <button
              type="button"
              data-testid="install-tab-mobile"
              onClick={() => setSelectedTab('mobile')}
              className={`flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-extrabold transition ${
                selectedTab === 'mobile'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-[#354c3f] hover:bg-white/80 dark:text-[#b4cec0] dark:hover:bg-[#1c3527]'
              }`}
            >
              <Smartphone className="h-4 w-4 shrink-0" />
              <span className="truncate">
                Na telefon<span className="hidden sm:inline"> / iPad</span>
              </span>
            </button>
            <button
              type="button"
              data-testid="install-tab-desktop"
              onClick={() => setSelectedTab('desktop')}
              className={`flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-extrabold transition ${
                selectedTab === 'desktop'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-[#354c3f] hover:bg-white/80 dark:text-[#b4cec0] dark:hover:bg-[#1c3527]'
              }`}
            >
              <Laptop className="h-4 w-4 shrink-0" />
              <span className="truncate">Na komputer</span>
            </button>
          </div>

          {selectedTab === 'mobile' ? (
            <div className="space-y-2.5" data-testid="install-panel-mobile">
              {/* Android Card */}
              <div
                className={`rounded-2xl border p-3 ${
                  env.os === 'android'
                    ? 'border-emerald-400 bg-emerald-50/50 dark:border-emerald-700 dark:bg-[#152a1f]'
                    : 'border-[#d6e7dc] bg-[#f8fcfa] dark:border-[#233d2f] dark:bg-[#14241b]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-emerald-950 dark:text-white">
                    Android (Chrome, Samsung Internet, Edge)
                  </span>
                  {env.os === 'android' && (
                    <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-200">
                      Twój telefon
                    </span>
                  )}
                </div>
                <ol className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-[#354c3f] dark:text-[#c7dbcf]">
                  <li className="flex items-start gap-1.5">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-extrabold text-white">
                      1
                    </span>
                    <span>
                      {canInstallNative ? (
                        <>
                          Kliknij zielony przycisk{' '}
                          <strong>„Pobierz i zainstaluj na telefonie”</strong> powyżej.
                        </>
                      ) : (
                        <>
                          Dotknij ikony menu{' '}
                          <MoreVertical className="inline h-3.5 w-3.5 align-text-bottom text-emerald-700 dark:text-emerald-400" />{' '}
                          (3 kropki) w prawym górnym lub dolnym rogu przeglądarki.
                        </>
                      )}
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-extrabold text-white">
                      2
                    </span>
                    <span>
                      Wybierz <strong>„Zainstaluj aplikację”</strong> (lub{' '}
                      <em>„Dodaj do ekranu głównego”</em>) i potwierdź — ikona PhysioLingo pojawi
                      się wśród aplikacji.
                    </span>
                  </li>
                </ol>
              </div>

              {/* iPhone / iPad Card */}
              <div
                className={`rounded-2xl border p-3 ${
                  env.os === 'ios'
                    ? 'border-emerald-400 bg-emerald-50/50 dark:border-emerald-700 dark:bg-[#152a1f]'
                    : 'border-[#d6e7dc] bg-[#f8fcfa] dark:border-[#233d2f] dark:bg-[#14241b]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-emerald-950 dark:text-white">
                    iPhone / iPad (Safari lub Chrome na iOS)
                  </span>
                  {env.os === 'ios' && (
                    <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-200">
                      Twoje urządzenie
                    </span>
                  )}
                </div>
                <ol className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-[#354c3f] dark:text-[#c7dbcf]">
                  <li className="flex items-start gap-1.5">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-extrabold text-white">
                      1
                    </span>
                    <span>
                      Dotknij przycisku <strong>Udostępnij</strong>{' '}
                      <Share2 className="inline h-3.5 w-3.5 align-text-bottom text-emerald-700 dark:text-emerald-400" />{' '}
                      na pasku przeglądarki (kwadrat ze strzałką w górę).
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-extrabold text-white">
                      2
                    </span>
                    <span>
                      Przewiń listę i wybierz{' '}
                      <strong>„Dodaj do ekranu początkowego”</strong>{' '}
                      <PlusSquare className="inline h-3.5 w-3.5 align-text-bottom text-emerald-700 dark:text-emerald-400" />,
                      a następnie kliknij <strong>„Dodaj”</strong>.
                    </span>
                  </li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5" data-testid="install-panel-desktop">
              {/* Windows / macOS / Linux Chrome & Edge */}
              <div className="rounded-2xl border border-[#d6e7dc] bg-[#f8fcfa] p-3 dark:border-[#233d2f] dark:bg-[#14241b]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-emerald-950 dark:text-white">
                    Windows / macOS / Linux (Chrome, Edge, Brave, Opera)
                  </span>
                  {env.defaultTab === 'desktop' && env.browser !== 'safari' && (
                    <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-200">
                      Twój komputer
                    </span>
                  )}
                </div>
                <ol className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-[#354c3f] dark:text-[#c7dbcf]">
                  <li className="flex items-start gap-1.5">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-extrabold text-white">
                      1
                    </span>
                    <span>
                      {canInstallNative ? (
                        <>
                          Kliknij przycisk{' '}
                          <strong>„Pobierz i zainstaluj na komputerze”</strong> powyżej.
                        </>
                      ) : (
                        <>
                          Kliknij ikonę <strong>Zainstaluj PhysioLingo</strong> (monitor ze
                          strzałką) po prawej stronie paska adresu lub menu{' '}
                          <strong>⋮ → Zapisz i udostępnij → Zainstaluj aplikację</strong>.
                        </>
                      )}
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-extrabold text-white">
                      2
                    </span>
                    <span>
                      Potwierdź <strong>„Zainstaluj”</strong> — aplikacja utworzy skrót na Pulpicie
                      oraz w Menu Start / Launchpadzie.
                    </span>
                  </li>
                </ol>
              </div>

              {/* macOS Safari */}
              <div className="rounded-2xl border border-[#d6e7dc] bg-[#f8fcfa] p-3 dark:border-[#233d2f] dark:bg-[#14241b]">
                <span className="text-xs font-extrabold text-emerald-950 dark:text-white">
                  macOS (Safari)
                </span>
                <p className="mt-1 text-[11px] leading-relaxed text-[#354c3f] dark:text-[#c7dbcf]">
                  Wybierz na górnym pasku <strong>Plik → Dodaj do Docka…</strong> (lub ikonę{' '}
                  <strong>Udostępnij → Dodaj do Docka</strong>) i kliknij <strong>Dodaj</strong>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col gap-2 border-t border-[#d6e7dc] bg-[#f8fcfa] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-[#233d2f] dark:bg-[#13241b]">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              data-testid="install-modal-share-btn"
              onClick={handleCopyOrShare}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400 bg-white px-2.5 py-1.5 text-xs font-extrabold text-emerald-900 transition hover:bg-emerald-50 dark:border-emerald-700 dark:bg-[#0f1d15] dark:text-emerald-200"
            >
              {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
              <span>{copiedLink ? 'Skopiowano link!' : 'Wyślij link do pobrania'}</span>
            </button>

            {onOpenOfflinePacks && (
              <button
                type="button"
                data-testid="install-modal-offline-packs-btn"
                onClick={() => {
                  onClose();
                  onOpenOfflinePacks();
                }}
                className="inline-flex items-center gap-1 rounded-xl border border-[#c5dfd0] bg-white px-2.5 py-1.5 text-xs font-bold text-[#354c3f] transition hover:bg-emerald-50 dark:border-[#2a4a39] dark:bg-[#0f1d15] dark:text-[#c7dbcf]"
              >
                <HardDriveDownload className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Pakiety 3D offline</span>
              </button>
            )}
          </div>

          <button
            type="button"
            data-testid="install-modal-dismiss-btn"
            onClick={onClose}
            className="rounded-xl px-2.5 py-1.5 text-center text-xs font-bold text-[#52695b] transition hover:bg-[#e8f3ec] hover:text-emerald-950 dark:text-[#94b0a0] dark:hover:bg-[#1a3124] dark:hover:text-white"
          >
            Otwórz w przeglądarce
          </button>
        </div>
      </div>
    </div>
  );
};
