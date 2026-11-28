import React, { useMemo } from 'react';
import {
  Activity,
  AlertCircle,
  Bone,
  Box,
  Check,
  Crown,
  Lock,
  Play,
  RotateCcw,
  Shield,
  Stethoscope,
} from 'lucide-react';
import { ANATOMY_MAP } from '../data/anatomyDb';
import { SKILL_SECTIONS } from '../data/curriculum';
import { formatBilingualName } from '../three/anatomyTranslator';
import { AnatomicalStructure, LessonNode, SkillSectionId, UserProgress } from '../types/anatomy';
import { getAllLessonsOrdered, getLessonStatuses } from '../utils/gameLogic';

interface SkillTreeProps {
  progress: UserProgress;
  onStartLesson: (lesson: LessonNode) => void;
  onOpenExplorerForRegion: (region: SkillSectionId) => void;
  onInspectStructureIn3D?: (structure: AnatomicalStructure) => void;
  onStartMistakeReview?: () => void;
}

const NODE_OFFSETS = [0, -44, -64, -28, 28, 56, 24, 0];

function renderNodeIcon(iconName: LessonNode['iconName'], className: string) {
  switch (iconName) {
    case 'bone':
      return <Bone className={className} />;
    case 'shield':
      return <Shield className={className} />;
    case 'activity':
      return <Activity className={className} />;
    case 'stethoscope':
      return <Stethoscope className={className} />;
  }
}

export const SkillTree: React.FC<SkillTreeProps> = React.memo(
  ({
    progress,
    onStartLesson,
    onOpenExplorerForRegion,
    onInspectStructureIn3D,
    onStartMistakeReview,
  }) => {
    const isFreeMode = progress.studyMode === 'free';
    const statuses = getLessonStatuses(progress.completedLessonIds, progress.studyMode);

    const firstActiveLessonId = useMemo(() => {
      const ordered = getAllLessonsOrdered();
      return ordered.find((l) => statuses[l.id] === 'active')?.id ?? null;
    }, [statuses]);

    // Top 3 most frequently missed structures for targeted study insight
    const topMistakes = Object.entries(progress.mistakeStats)
      .filter(([, stat]) => stat.wrongCount > 0)
      .sort((a, b) => b[1].wrongCount - a[1].wrongCount)
      .slice(0, 3)
      .map(([id, stat]) => ({
        structure: ANATOMY_MAP[id],
        wrongCount: stat.wrongCount,
      }))
      .filter((item) => Boolean(item.structure));

    return (
      <div className="mx-auto w-full max-w-2xl space-y-8 pb-24 md:pb-12">
        {/* Active Mistake Review Banner (only appears when mistakes have been logged) */}
        {topMistakes.length > 0 && (
          <div
            data-testid="mistake-review-banner"
            className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 dark:border-amber-800/70 dark:bg-amber-950/30"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-sm font-bold text-amber-900 dark:text-amber-200">
                    Struktury wymagające powtórki (kliknij, aby obejrzeć w 3D)
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {topMistakes.map(({ structure, wrongCount }) => (
                      <button
                        key={structure.id}
                        type="button"
                        data-testid={`mistake-chip-${structure.id}`}
                        onClick={() => onInspectStructureIn3D?.(structure)}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-2.5 py-1.5 text-left text-xs font-semibold text-[#16291f] transition hover:border-emerald-500 hover:bg-emerald-50 dark:border-amber-700 dark:bg-[#112018] dark:text-emerald-50 dark:hover:border-emerald-500 dark:hover:bg-[#182b21]"
                      >
                        <Box className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="min-w-0 break-words">
                          {formatBilingualName(structure.namePl, structure.nameLt)}
                        </span>
                        <span className="font-mono-tabular shrink-0 text-amber-600 dark:text-amber-400">
                          ({wrongCount}×)
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {onStartMistakeReview && (
                <button
                  type="button"
                  data-testid="start-mistake-review-btn"
                  onClick={onStartMistakeReview}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-b-4 border-amber-600 bg-amber-500 px-3.5 py-2 text-xs font-extrabold text-white transition hover:bg-amber-600 active:translate-y-0.5 active:border-b-2"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Powtórz błędy</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Skill Tree Sections */}
        {SKILL_SECTIONS.map((section) => {
          const isEmerald = section.accentColor === 'emerald';
          const completedInSection = section.lessons.filter(
            (l) => statuses[l.id] === 'completed',
          ).length;

          return (
            <section key={section.id} className="space-y-8">
              {/* Section Banner */}
              <div
                className={`rounded-3xl border-2 border-b-4 p-5 text-white shadow-sm ${
                  isEmerald
                    ? 'border-emerald-700 bg-emerald-500'
                    : 'border-green-700 bg-green-600'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-white/85">
                      Dział {section.number} • Ukończono {completedInSection}/{section.lessons.length}
                    </div>
                    <h2 className="font-display text-xl font-extrabold sm:text-2xl">
                      {section.title}
                    </h2>
                    <p className="text-sm font-medium text-white/90">{section.subtitle}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenExplorerForRegion(section.id)}
                    className={`shrink-0 whitespace-nowrap rounded-2xl border-2 border-b-4 px-3.5 py-2 text-xs font-extrabold transition active:translate-y-0.5 active:border-b-2 ${
                      isEmerald
                        ? 'border-emerald-800 bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'border-green-800 bg-green-700 text-white hover:bg-green-800'
                    }`}
                  >
                    Podgląd 3D działu
                  </button>
                </div>
              </div>

              {/* Vertical Winding Node Path */}
              <div className="relative flex flex-col items-center gap-7 overflow-x-clip py-2 sm:gap-8">
                {section.lessons.map((lesson, idx) => {
                  const status = statuses[lesson.id] ?? 'locked';
                  const bestAccuracy = progress.lessonBestAccuracy[lesson.id];
                  const offsetX = NODE_OFFSETS[(section.number * 3 + idx) % NODE_OFFSETS.length];

                  const isCompleted = status === 'completed';
                  const isActive = status === 'active';
                  const isLocked = status === 'locked';
                  const showStartPill =
                    isActive && (!isFreeMode || lesson.id === firstActiveLessonId);

                  return (
                    <div
                      key={lesson.id}
                      className="relative flex max-w-full flex-col items-center"
                      style={{
                        transform: `translateX(calc(${offsetX}px * var(--zigzag-scale, 1)))`,
                      }}
                    >
                      {showStartPill && (
                        <div className="mb-2.5 rounded-xl border-2 border-b-3 border-emerald-500 bg-white px-3.5 py-1 text-xs font-extrabold uppercase tracking-wide text-emerald-600 shadow-sm dark:bg-[#112018] dark:text-emerald-400">
                          Rozpocznij
                        </div>
                      )}

                      <button
                        type="button"
                        data-testid={`lesson-node-${lesson.id}`}
                        disabled={isLocked}
                        onClick={() => onStartLesson(lesson)}
                        aria-label={`${lesson.title} (${
                          isCompleted ? 'Ukończony' : isActive ? 'Aktywny' : 'Zablokowany'
                        })`}
                        className={`group relative flex h-20 w-20 items-center justify-center rounded-full border-b-[6px] transition focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400 ${
                          isCompleted
                            ? 'border-amber-600 bg-amber-400 text-amber-950 hover:bg-amber-300 active:translate-y-1 active:border-b-2'
                            : isActive
                              ? isEmerald
                                ? 'border-emerald-700 bg-emerald-500 text-white ring-4 ring-emerald-200 hover:bg-emerald-400 active:translate-y-1 active:border-b-2 dark:ring-emerald-900/70'
                                : 'border-green-700 bg-green-600 text-white ring-4 ring-green-200 hover:bg-green-500 active:translate-y-1 active:border-b-2 dark:ring-green-900/70'
                              : 'cursor-not-allowed border-[#c2d8ca] bg-[#e2ede6] text-[#6b8274] dark:border-[#294737] dark:bg-[#182b21] dark:text-[#739180]'
                        }`}
                      >
                        {isLocked ? (
                          <Lock className="h-7 w-7" />
                        ) : isCompleted ? (
                          <Crown className="h-8 w-8 fill-amber-950/15" />
                        ) : (
                          renderNodeIcon(lesson.iconName, 'h-8 w-8')
                        )}

                        {/* Status badge on node */}
                        {isCompleted && (
                          <span className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-white shadow dark:border-[#0b1510]">
                            <Check className="h-4 w-4 stroke-[3]" />
                          </span>
                        )}
                        {isActive && (
                          <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-amber-400 text-amber-950 shadow dark:border-[#0b1510]">
                            <Play className="h-3.5 w-3.5 fill-current" />
                          </span>
                        )}
                      </button>

                      {/* Lesson Title & Subtitle */}
                      <div className="mt-2.5 max-w-[215px] text-center sm:max-w-[240px]">
                        <div
                          className={`font-display text-sm font-bold ${
                            isLocked
                              ? 'text-[#6b8274] dark:text-[#739180]'
                              : 'text-emerald-950 dark:text-emerald-50'
                          }`}
                        >
                          {lesson.order}. {lesson.title}
                        </div>
                        <div className="mt-0.5 text-xs text-[#52695b] dark:text-[#94b0a0]">
                          {isCompleted && typeof bestAccuracy === 'number'
                            ? `Ukończono • Najlepszy wynik: ${bestAccuracy}%`
                            : lesson.subtitle}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    );
  },
);
