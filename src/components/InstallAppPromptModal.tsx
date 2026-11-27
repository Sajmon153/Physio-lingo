import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  Copy,
  Download,
  ExternalLink,
  HardDriveDownload,
  Laptop,
  MoreVertical,
  PlusSquare,
  Share,
  Share2,
  Smartphone,
  Tablet,
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

/**
 * Synchronous + async clipboard helper that never fails on iOS/iPadOS WebKit or Messenger WKWebView.
 */
function copyTextSafe(text: string): boolean {
  let copiedSync = false;
  if (typeof document !== 'undefined') {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', 'true');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.style.left = '-9999px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, text.length);
      copiedSync = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch {
      copiedSync = false;
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => undefined);
    return true;
  }
  return copiedSync;
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
  const [showPointerCoach, setShowPointerCoach] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedTab(env.defaultTab);
      setShowPointerCoach(false);
    }
  }, [isOpen, env.defaultTab]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showPointerCoach) setShowPointerCoach(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, showPointerCoach, onClose]);

  if (!isOpen) return null;

  const shareUrl =
    typeof window !== 'undefined'
      ? buildDirectInstallShareUrl(window.location.origin)
      : 'https://physio-lingo.fizjolingo.workers.dev/?install=1';

  const canWebShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleCopyLink = () => {
    const ok = copyTextSafe(shareUrl);
    if (ok) {
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  const handleNativeShare = async () => {
    if (canWebShare) {
      try {
        await navigator.share({
          title: 'PhysioLingo 3D',
          url: shareUrl,
        });
        return;
      } catch {
        // If user cancelled or WebView blocked share, fall back to copy
      }
    }
    handleCopyLink();
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

  // Interactive Full-Screen Safari / Browser Bar Pointer Coach (especially helpful on iPad & iPhone!)
  if (showPointerCoach) {
    const isBottomBarIphone = selectedTab === 'ios' && env.os === 'ios' && !env.isIpad;
    return (
      <div
        className="fixed inset-0 z-[130] flex flex-col justify-between bg-black/75 p-4 text-white backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        data-testid="install-pointer-coach"
        onClick={() => setShowPointerCoach(false)}
      >
        {/* Top-Right Bouncing Arrow (for iPad Safari, Android Chrome menu, and Desktop Chrome/Safari) */}
        {!isBottomBarIphone ? (
          <div className="flex justify-end pr-3 pt-1 sm:pr-8">
            <div className="flex flex-col items-end gap-1">
              <div className="flex h-12 w-12 animate-bounce items-center justify-center rounded-2xl border-2 border-emerald-300 bg-emerald-500 text-white shadow-xl">
                <ArrowUpRight className="h-7 w-7 stroke-[2.6]" />
              </div>
              <span className="rounded-xl bg-emerald-600 px-3 py-1 text-xs font-extrabold shadow-lg">
                {selectedTab === 'ios'
                  ? '1. Stuknij tutaj ikonę Udostępnij [↑] na pasku Safari!'
                  : selectedTab === 'android'
                    ? '1. Stuknij menu ⋮ w rogu przeglądarki!'
                    : '1. Kliknij ikonę instalacji w pasku adresu lub menu!'}
              </span>
            </div>
          </div>
        ) : (
          <div />
        )}

        {/* Center Step-by-Step Visual Card */}
        <div
          className="mx-auto w-full max-w-md rounded-3xl border-2 border-emerald-400 bg-white p-5 text-emerald-950 shadow-2xl dark:bg-[#101f17] dark:text-white"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-lg font-extrabold">
              {selectedTab === 'ios'
                ? env.isIpad
                  ? 'Jak dodać aplikację na iPada (3 sekundy)'
                  : 'Jak dodać aplikację na iPhone’a / iPada'
                : selectedTab === 'android'
                  ? 'Instalacja na telefonie Android'
                  : 'Instalacja na komputerze'}
            </h3>
            <button
              type="button"
              onClick={() => setShowPointerCoach(false)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#c8e3d2] bg-[#f4faf6] text-[#354c3f] dark:border-[#294737] dark:bg-[#162a1f] dark:text-emerald-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {selectedTab === 'ios' ? (
            <div className="mt-3 space-y-2.5 text-xs leading-relaxed text-[#2d4337] dark:text-[#d0e3d7]">
              <p className="rounded-xl bg-emerald-50 px-3 py-2 font-semibold text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
                System Apple wymaga potwierdzenia ikony bezpośrednio w pasku przeglądarki{' '}
                <strong>Safari</strong>:
              </p>
              <div className="flex items-center gap-3 rounded-2xl border border-[#d6e7dc] bg-[#f8fcfa] p-3 dark:border-[#233d2f] dark:bg-[#15281e]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <Share className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-extrabold text-emerald-950 dark:text-white">
                    Krok 1: Stuknij „Udostępnij” (kwadrat ze strzałką w górę)
                  </div>
                  <div className="text-[11px] text-[#52695b] dark:text-[#9cb8a8]">
                    Na <strong>iPadzie</strong> ikona znajduje się na górnym pasku obok adresu; na{' '}
                    <strong>iPhonie</strong> na dolnym pasku Safari.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-[#d6e7dc] bg-[#f8fcfa] p-3 dark:border-[#233d2f] dark:bg-[#15281e]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <PlusSquare className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-extrabold text-emerald-950 dark:text-white">
                    Krok 2: Wybierz „Dodaj do ekranu początkowego”
                  </div>
                  <div className="text-[11px] text-[#52695b] dark:text-[#9cb8a8]">
                    Następnie stuknij <strong>„Dodaj”</strong> w prawym górnym rogu — gotowe!
                  </div>
                </div>
              </div>
            </div>
          ) : selectedTab === 'android' ? (
            <div className="mt-3 space-y-2 text-xs leading-relaxed text-[#2d4337] dark:text-[#d0e3d7]">
              <p>
                1. Stuknij menu <strong>⋮ (3 kropki)</strong> w rogu przeglądarki Chrome.
              </p>
              <p>
                2. Wybierz <strong>„Zainstaluj aplikację”</strong> lub{' '}
                <strong>„Dodaj do ekranu głównego”</strong>.
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-2 text-xs leading-relaxed text-[#2d4337] dark:text-[#d0e3d7]">
              <p>
                <strong>Chrome / Edge / Brave:</strong> kliknij ikonę pobierania po prawej stronie
                paska adresu lub menu <strong>⋮ → Zainstaluj PhysioLingo</strong>.
              </p>
              <p>
                <strong>Safari na Macu:</strong> wybierz na górnym pasku{' '}
                <strong>Plik → Dodaj do Docka…</strong>
              </p>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              data-testid="install-coach-back-btn"
              onClick={() => setShowPointerCoach(false)}
              className="flex-1 cursor-pointer select-none rounded-2xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-emerald-600 active:scale-95"
            >
              Rozumiem — wróć
            </button>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer select-none rounded-2xl border border-[#c8e3d2] bg-[#f4faf6] px-3.5 py-2.5 text-xs font-bold text-[#354c3f] transition active:scale-95 dark:border-[#294737] dark:bg-[#162a1f] dark:text-emerald-200"
            >
              Otwórz w przeglądarce
            </button>
          </div>
        </div>

        {/* Bottom Bouncing Arrow for iPhone Safari bottom bar */}
        {isBottomBarIphone ? (
          <div className="flex flex-col items-center gap-1 pb-2">
            <span className="rounded-xl bg-emerald-600 px-3 py-1 text-xs font-extrabold shadow-lg">
              1. Stuknij ikonę Udostępnij [↑] na dolnym pasku Safari!
            </span>
            <div className="flex h-12 w-12 animate-bounce items-center justify-center rounded-2xl border-2 border-emerald-300 bg-emerald-500 text-white shadow-xl">
              <ArrowDown className="h-7 w-7 stroke-[2.6]" />
            </div>
          </div>
        ) : (
          <div />
        )}
      </div>
    );
  }

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
        {/* Header */}
        <div className="relative border-b border-[#d6e7dc] bg-gradient-to-br from-emerald-50 via-[#f4faf6] to-emerald-100/60 px-4 pt-4 pb-3.5 sm:px-5 dark:border-[#233d2f] dark:from-[#13291e] dark:via-[#101f17] dark:to-[#13291e]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij okno pobierania aplikacji"
            data-testid="install-modal-close-x"
            className="absolute top-3.5 right-3.5 flex h-9 w-9 items-center justify-center rounded-xl border border-[#c8e3d2] bg-white text-[#456050] transition hover:bg-emerald-50 hover:text-emerald-900 active:scale-95 dark:border-[#294737] dark:bg-[#162a1f] dark:text-[#9cb8a8]"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3 pr-10">
            <img
              src="/icons/icon-192.png"
              alt="Ikona PhysioLingo"
              className="h-12 w-12 shrink-0 rounded-2xl border-2 border-emerald-500/40 bg-emerald-500 object-cover shadow-sm"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Darmowa aplikacja • Pełny ekran • Offline 3D
              </p>
              <h2
                id="install-app-modal-title"
                className="font-display text-lg leading-tight font-extrabold text-emerald-950 sm:text-xl dark:text-white"
              >
                Zainstaluj PhysioLingo 3D
              </h2>
            </div>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-[#385243] dark:text-[#b4cec0]">
            Wybierz swoje urządzenie poniżej, aby dodać aplikację na ekran główny telefonu, iPada
            lub pulpit komputera:
          </p>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3.5 sm:px-5">
          {/* 3 Interactive Device Buttons: iPad / iPhone | Android | Komputer */}
          <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-[#d6e7dc] bg-[#f4faf6] p-1 dark:border-[#233d2f] dark:bg-[#15281e]">
            <button
              type="button"
              data-testid="install-tab-ios"
              onClick={() => setSelectedTab('ios')}
              className={`flex cursor-pointer select-none flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 text-[11px] font-extrabold transition-transform duration-100 active:scale-95 sm:flex-row sm:gap-1.5 sm:text-xs ${
                selectedTab === 'ios'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-transparent text-[#354c3f] hover:bg-white/85 dark:text-[#b4cec0] dark:hover:bg-[#1c3527]'
              }`}
            >
              <Tablet className="h-4 w-4 shrink-0" />
              <span>iPad / iPhone</span>
            </button>

            <button
              type="button"
              data-testid="install-tab-mobile"
              onClick={() => setSelectedTab('android')}
              className={`flex cursor-pointer select-none flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 text-[11px] font-extrabold transition-transform duration-100 active:scale-95 sm:flex-row sm:gap-1.5 sm:text-xs ${
                selectedTab === 'android'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-transparent text-[#354c3f] hover:bg-white/85 dark:text-[#b4cec0] dark:hover:bg-[#1c3527]'
              }`}
            >
              <Smartphone className="h-4 w-4 shrink-0" />
              <span>Android</span>
            </button>

            <button
              type="button"
              data-testid="install-tab-desktop"
              onClick={() => setSelectedTab('desktop')}
              className={`flex cursor-pointer select-none flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 text-[11px] font-extrabold transition-transform duration-100 active:scale-95 sm:flex-row sm:gap-1.5 sm:text-xs ${
                selectedTab === 'desktop'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-transparent text-[#354c3f] hover:bg-white/85 dark:text-[#b4cec0] dark:hover:bg-[#1c3527]'
              }`}
            >
              <Laptop className="h-4 w-4 shrink-0" />
              <span>Komputer</span>
            </button>
          </div>

          {/* Messenger / Instagram / Embedded WebView Alert (critical when user sent link to themselves in chat!) */}
          {env.isInAppBrowser && (
            <div
              data-testid="install-inapp-warning"
              className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-3.5 dark:border-amber-600 dark:bg-amber-950/45"
            >
              <div className="text-xs font-extrabold text-amber-950 dark:text-amber-200">
                Uwaga: otwarto link wewnątrz komunikatora (np. Messenger / Poczta)
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-amber-900 dark:text-amber-200/90">
                Wewnętrzny podgląd komunikatora blokuje pobieranie aplikacji na ekran główny.{' '}
                {env.os === 'ios' ? (
                  <>
                    Stuknij ikonę <strong>⋯ / kompas Safari</strong> w rogu ekranu i wybierz{' '}
                    <strong>„Otwórz w przeglądarce zewnętrznej (Safari)”</strong> lub skopiuj link
                    poniżej i wklej go w <strong>Safari</strong>:
                  </>
                ) : (
                  <>Otwórz ten link bezpośrednio w przeglądarce Chrome:</>
                )}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {env.os === 'android' && (
                  <a
                    href={androidIntentUrl}
                    className="inline-flex items-center gap-1.5 rounded-xl border-b-2 border-emerald-800 bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-emerald-500"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Otwórz od razu w Chrome</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 rounded-xl border-2 border-amber-600 bg-white px-3 py-2 text-xs font-extrabold text-amber-950 transition hover:bg-amber-100 active:scale-98 dark:bg-[#162a1f] dark:text-amber-100"
                >
                  {copiedLink ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  <span>
                    {copiedLink ? 'Skopiowano! Wklej w Safari' : 'Skopiuj link dla Safari'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* PANEL 1: iPad / iPhone (iOS / iPadOS) */}
          {selectedTab === 'ios' && (
            <div className="space-y-3" data-testid="install-panel-ios">
              <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50/55 p-3.5 dark:border-emerald-700 dark:bg-[#152a1f]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-emerald-950 dark:text-white">
                    {env.isIpad
                      ? 'Instalacja na iPadzie (przeglądarka Safari)'
                      : 'Instalacja na iPadzie i iPhonie (Safari)'}
                  </span>
                  {env.os === 'ios' && (
                    <span className="shrink-0 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-extrabold text-white">
                      {env.isIpad ? 'TWÓJ iPAD' : 'TWOJE URZĄDZENIE'}
                    </span>
                  )}
                </div>

                <p className="mt-1.5 text-[11px] leading-relaxed text-[#2d4337] dark:text-[#c7dbcf]">
                  Na urządzeniach Apple nie pobiera się pliku instalacyjnego — aplikację dodaje się
                  bezpośrednio z paska <strong>Safari</strong> w 2 prostych krokach:
                </p>

                <div className="mt-2.5 space-y-2">
                  <div className="flex items-start gap-2.5 rounded-xl border border-[#cde3d5] bg-white p-2.5 dark:border-[#264736] dark:bg-[#101f17]">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-xs font-extrabold text-white">
                      1
                    </span>
                    <div className="text-xs leading-snug text-emerald-950 dark:text-white">
                      Stuknij ikonę <strong>Udostępnij</strong>{' '}
                      <Share className="inline h-4 w-4 align-text-bottom text-emerald-600 dark:text-emerald-400" />{' '}
                      (kwadrat ze strzałką w górę) — na <strong>iPadzie</strong> w prawym górnym
                      rogu paska Safari, na <strong>iPhonie</strong> na dole ekranu.
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-xl border border-[#cde3d5] bg-white p-2.5 dark:border-[#264736] dark:bg-[#101f17]">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-xs font-extrabold text-white">
                      2
                    </span>
                    <div className="text-xs leading-snug text-emerald-950 dark:text-white">
                      Wybierz z listy <strong>„Dodaj do ekranu początkowego”</strong>{' '}
                      <PlusSquare className="inline h-4 w-4 align-text-bottom text-emerald-600 dark:text-emerald-400" />{' '}
                      i zatwierdź przyciskiem <strong>„Dodaj”</strong>.
                    </div>
                  </div>
                </div>

                {/* Big Interactive Primary CTA Button on iPad / iPhone! */}
                <button
                  type="button"
                  data-testid="install-ios-guide-btn"
                  onClick={() => setShowPointerCoach(true)}
                  className="mt-3 flex w-full cursor-pointer select-none items-center justify-center gap-2 rounded-2xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-4 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2 active:scale-98"
                >
                  <ArrowUpRight className="h-4 w-4 shrink-0" />
                  <span>Pokaż strzałką na ekranie, gdzie kliknąć</span>
                </button>
              </div>
            </div>
          )}

          {/* PANEL 2: Android */}
          {selectedTab === 'android' && (
            <div className="space-y-3" data-testid="install-panel-mobile">
              <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50/55 p-3.5 dark:border-emerald-700 dark:bg-[#152a1f]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-emerald-950 dark:text-white">
                    Telefon / Tablet z systemem Android
                  </span>
                  {env.os === 'android' && (
                    <span className="shrink-0 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-extrabold text-white">
                      TWÓJ TELEFON
                    </span>
                  )}
                </div>

                {canInstallNative ? (
                  <>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#2d4337] dark:text-[#c7dbcf]">
                      Kliknij poniższy przycisk, aby od razu zainstalować ikonę PhysioLingo na
                      ekranie głównym telefonu:
                    </p>
                    <button
                      type="button"
                      data-testid="install-modal-native-btn"
                      disabled={isInstalling}
                      onClick={handleNativeInstallClick}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-4 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2 disabled:opacity-60"
                    >
                      <Download className="h-4 w-4 shrink-0" />
                      <span>
                        {isInstalling ? 'Otwieranie instalatora…' : 'Pobierz i zainstaluj na telefonie'}
                      </span>
                    </button>
                  </>
                ) : (
                  <>
                    <div className="mt-2 space-y-2 text-xs text-emerald-950 dark:text-white">
                      <div className="rounded-xl border border-[#cde3d5] bg-white p-2.5 dark:border-[#264736] dark:bg-[#101f17]">
                        <strong>1.</strong> Dotknij ikony menu{' '}
                        <MoreVertical className="inline h-4 w-4 align-text-bottom text-emerald-600" />{' '}
                        (3 kropki) w rogu przeglądarki Chrome / Samsung Internet.
                      </div>
                      <div className="rounded-xl border border-[#cde3d5] bg-white p-2.5 dark:border-[#264736] dark:bg-[#101f17]">
                        <strong>2.</strong> Wybierz <strong>„Zainstaluj aplikację”</strong> lub{' '}
                        <strong>„Dodaj do ekranu głównego”</strong>.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPointerCoach(true)}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-4 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2"
                    >
                      <ArrowUpRight className="h-4 w-4 shrink-0" />
                      <span>Pokaż strzałką na ekranie</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* PANEL 3: Komputer (Windows / macOS / Linux) */}
          {selectedTab === 'desktop' && (
            <div className="space-y-3" data-testid="install-panel-desktop">
              <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50/55 p-3.5 dark:border-emerald-700 dark:bg-[#152a1f]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-emerald-950 dark:text-white">
                    Komputer (Windows, macOS, Linux)
                  </span>
                  {env.defaultTab === 'desktop' && (
                    <span className="shrink-0 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-extrabold text-white">
                      TWÓJ KOMPUTER
                    </span>
                  )}
                </div>

                {canInstallNative ? (
                  <>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#2d4337] dark:text-[#c7dbcf]">
                      Zainstaluj aplikację jednym kliknięciem — utworzy ikonę na Pulpicie oraz w
                      Menu Start / Aplikacjach:
                    </p>
                    <button
                      type="button"
                      data-testid="install-modal-native-btn"
                      disabled={isInstalling}
                      onClick={handleNativeInstallClick}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-4 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2 disabled:opacity-60"
                    >
                      <Download className="h-4 w-4 shrink-0" />
                      <span>
                        {isInstalling
                          ? 'Otwieranie instalatora…'
                          : 'Pobierz i zainstaluj na komputerze'}
                      </span>
                    </button>
                  </>
                ) : (
                  <>
                    <div className="mt-2 space-y-2 text-xs leading-relaxed text-emerald-950 dark:text-white">
                      <div className="rounded-xl border border-[#cde3d5] bg-white p-2.5 dark:border-[#264736] dark:bg-[#101f17]">
                        <strong>Chrome / Edge / Brave / Opera:</strong> kliknij ikonę pobierania po
                        prawej stronie paska adresu lub menu{' '}
                        <strong>⋮ → Zapisz i udostępnij → Zainstaluj aplikację</strong>.
                      </div>
                      <div className="rounded-xl border border-[#cde3d5] bg-white p-2.5 dark:border-[#264736] dark:bg-[#101f17]">
                        <strong>Safari (macOS):</strong> wybierz na górnym pasku{' '}
                        <strong>Plik → Dodaj do Docka…</strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPointerCoach(true)}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-4 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2"
                    >
                      <ArrowUpRight className="h-4 w-4 shrink-0" />
                      <span>Pokaż strzałką, gdzie kliknąć</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions — Every button works reliably on iPad, iPhone, Android & PC */}
        <div className="space-y-2 border-t border-[#d6e7dc] bg-[#f8fcfa] px-4 py-3 sm:px-5 dark:border-[#233d2f] dark:bg-[#13241b]">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              data-testid="install-modal-copy-btn"
              onClick={handleCopyLink}
              className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-xl border border-emerald-400 bg-white px-2.5 py-1.5 text-xs font-extrabold text-emerald-900 transition hover:bg-emerald-50 active:scale-95 dark:border-emerald-700 dark:bg-[#0f1d15] dark:text-emerald-200"
            >
              {copiedLink ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{copiedLink ? 'Skopiowano link!' : 'Kopiuj link'}</span>
            </button>

            {canWebShare && (
              <button
                type="button"
                data-testid="install-modal-share-btn"
                onClick={handleNativeShare}
                className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-xl border border-[#c5dfd0] bg-white px-2.5 py-1.5 text-xs font-bold text-[#354c3f] transition hover:bg-emerald-50 active:scale-95 dark:border-[#2a4a39] dark:bg-[#0f1d15] dark:text-[#c7dbcf]"
              >
                <Share2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Udostępnij</span>
              </button>
            )}

            {onOpenOfflinePacks && (
              <button
                type="button"
                data-testid="install-modal-offline-packs-btn"
                onClick={() => {
                  onClose();
                  onOpenOfflinePacks();
                }}
                className="inline-flex cursor-pointer select-none items-center gap-1 rounded-xl border border-[#c5dfd0] bg-white px-2.5 py-1.5 text-xs font-bold text-[#354c3f] transition hover:bg-emerald-50 active:scale-95 dark:border-[#2a4a39] dark:bg-[#0f1d15] dark:text-[#c7dbcf]"
              >
                <HardDriveDownload className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Modele 3D offline</span>
              </button>
            )}
          </div>

          <button
            type="button"
            data-testid="install-modal-dismiss-btn"
            onClick={onClose}
            className="flex w-full cursor-pointer select-none items-center justify-center rounded-xl border-2 border-[#c5dfd0] bg-white px-3 py-2 text-xs font-extrabold text-emerald-950 transition hover:border-emerald-400 hover:bg-emerald-50/60 active:scale-98 dark:border-[#294737] dark:bg-[#0f1d15] dark:text-emerald-100"
          >
            Korzystaj teraz w przeglądarce (bez instalacji)
          </button>
        </div>
      </div>
    </div>
  );
};
