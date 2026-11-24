import React from 'react';
import { BookOpen, Box, Crosshair, Map as MapIcon, Stethoscope } from 'lucide-react';
import { DeviceViewMode } from '../types/anatomy';

export type AppView = 'tree' | 'explorer' | 'pin_exam' | 'cases' | 'atlas';

interface NavigationBarProps {
  activeView: AppView;
  onChangeView: (view: AppView) => void;
  completedCount: number;
  totalLessons: number;
  deviceMode?: DeviceViewMode;
}

const NAV_ITEMS: Array<{
  id: AppView;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'tree', label: 'Ścieżka nauki', shortLabel: 'Ścieżka', icon: MapIcon },
  { id: 'explorer', label: 'Eksplorator 3D', shortLabel: 'Model 3D', icon: Box },
  { id: 'pin_exam', label: 'Szpilki 3D', shortLabel: 'Szpilki', icon: Crosshair },
  { id: 'cases', label: 'Przypadki 3D', shortLabel: 'Klinika', icon: Stethoscope },
  { id: 'atlas', label: 'Atlas / Słownik', shortLabel: 'Atlas', icon: BookOpen },
];

export const NavigationBar: React.FC<NavigationBarProps> = React.memo(({
  activeView,
  onChangeView,
  completedCount,
  totalLessons,
  deviceMode = 'auto',
}) => {
  const forceMobileNav = deviceMode === 'phone';
  const compactTabletRail = deviceMode === 'ipad';
  const forceDesktopSidebar = deviceMode === 'desktop';

  const desktopSidebarClasses = forceMobileNav
    ? 'hidden'
    : compactTabletRail
      ? 'hidden sm:sticky sm:top-0 sm:flex sm:h-screen sm:w-20 sm:flex-col sm:items-center sm:justify-between border-r-2 border-[#d6e7dc] bg-white p-2.5 dark:border-[#233d2f] dark:bg-[#112018]'
      : forceDesktopSidebar
        ? 'sticky top-0 flex h-screen w-64 shrink-0 flex-col justify-between border-r-2 border-[#d6e7dc] bg-white p-4 dark:border-[#233d2f] dark:bg-[#112018]'
        : 'hidden w-60 shrink-0 flex-col justify-between border-r-2 border-[#d6e7dc] bg-white p-4 dark:border-[#233d2f] dark:bg-[#112018] lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64';

  const mobileBottomNavClasses = forceMobileNav
    ? 'sticky bottom-0 z-30 flex items-center justify-around border-t-2 border-[#d6e7dc] bg-white/95 px-2 pt-1.5 pb-safe backdrop-blur-md dark:border-[#233d2f] dark:bg-[#112018]/95'
    : compactTabletRail
      ? 'fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t-2 border-[#d6e7dc] bg-white/95 px-2 pt-1.5 pb-safe backdrop-blur-md dark:border-[#233d2f] dark:bg-[#112018]/95 sm:hidden'
      : forceDesktopSidebar
        ? 'hidden'
        : 'fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t-2 border-[#d6e7dc] bg-white/95 px-2 pt-1.5 pb-safe backdrop-blur-md dark:border-[#233d2f] dark:bg-[#112018]/95 lg:hidden';

  return (
    <>
      {/* Desktop / iPad Left Sidebar */}
      <aside className={desktopSidebarClasses}>
        <div className={compactTabletRail ? 'flex flex-col items-center space-y-5' : 'space-y-6'}>
          {/* Brand Logo */}
          <div className={compactTabletRail ? 'pt-1' : 'flex items-center gap-3 px-2 pt-1'}>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border-b-4 border-emerald-700 bg-emerald-500 font-display text-2xl font-extrabold text-white shadow-sm">
              P
            </div>
            {!compactTabletRail && (
              <div>
                <div className="font-display text-xl font-extrabold tracking-tight text-emerald-950 dark:text-white">
                  PhysioLingo
                </div>
                <div className="text-xs font-semibold text-[#52695b] dark:text-[#94b0a0]">
                  Fizjoterapia • Anatomia
                </div>
              </div>
            )}
          </div>

          {/* Nav Links */}
          <nav className={compactTabletRail ? 'flex w-full flex-col items-center space-y-2' : 'space-y-2'} aria-label="Nawigacja główna">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`nav-${item.id}`}
                  title={item.label}
                  onClick={() => onChangeView(item.id)}
                  className={
                    compactTabletRail
                      ? `flex w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 px-1 py-2.5 text-[10px] font-extrabold transition ${
                          isActive
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'border-transparent text-[#354c3f] hover:bg-[#ebf5ee] dark:text-[#c7dbcf] dark:hover:bg-[#182b21]'
                        }`
                      : `flex w-full items-center gap-3 whitespace-nowrap rounded-2xl border-2 px-4 py-3 text-left text-sm font-bold transition ${
                          isActive
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'border-transparent text-[#354c3f] hover:bg-[#ebf5ee] dark:text-[#c7dbcf] dark:hover:bg-[#182b21]'
                        }`
                  }
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 ${
                      isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#6b8274] dark:text-[#739180]'
                    }`}
                  />
                  <span>{compactTabletRail ? item.shortLabel : item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Course Completion Card */}
        {compactTabletRail ? (
          <div className="rounded-xl border border-[#d6e7dc] bg-[#f4faf6] px-2 py-2 text-center dark:border-[#233d2f] dark:bg-[#182b21]/60">
            <div className="font-mono-tabular text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400">
              {completedCount}/{totalLessons}
            </div>
            <div className="text-[9px] font-bold uppercase text-[#52695b] dark:text-[#94b0a0]">
              Kurs
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-[#d6e7dc] bg-[#f4faf6] p-4 dark:border-[#233d2f] dark:bg-[#182b21]/60">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
              <span>Postęp kursu</span>
              <span className="font-mono-tabular text-emerald-600 dark:text-emerald-400">
                {completedCount}/{totalLessons}
              </span>
            </div>
            <div className="mt-2.5 h-3 w-full overflow-hidden rounded-full bg-[#d6e7dc] dark:bg-[#233d2f]">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{
                  width: `${totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0}%`,
                }}
              />
            </div>
            <p className="mt-2.5 text-xs leading-relaxed text-[#354c3f] dark:text-[#c7dbcf]">
              Opanuj 11 działów anatomii funkcjonalnej 3D — układ ruchu, naczynia, nerwy, narządy i testy kliniczne.
            </p>
          </div>
        )}
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav aria-label="Nawigacja mobilna" className={mobileBottomNavClasses}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              data-testid={`mobile-nav-${item.id}`}
              onClick={() => onChangeView(item.id)}
              className={`flex min-h-[46px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1.5 text-[10px] font-extrabold transition sm:text-[11px] ${
                isActive
                  ? 'bg-emerald-50/90 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'text-[#52695b] hover:text-emerald-950 dark:text-[#94b0a0] dark:hover:text-emerald-50'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="max-w-full truncate">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
});
