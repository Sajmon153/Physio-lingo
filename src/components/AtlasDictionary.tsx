import React, { useMemo, useState } from 'react';
import {
  Activity,
  BookOpen,
  Box,
  ClipboardCheck,
  Search,
  Sparkles,
  Stethoscope,
  X,
} from 'lucide-react';
import { AnatomicalStructure, DeviceViewMode, RegionId, StructureCategory } from '../types/anatomy';
import { ANATOMY_DB, ANATOMY_MAP } from '../data/anatomyDb';
import {
  CLINICAL_TESTS_DB,
  type ClinicalTestCategory,
  type ClinicalTestEntry,
} from '../data/clinicalTestsDb';
import { formatBilingualName } from '../three/anatomyTranslator';
import { getStructureDetailLabels, normalizeAnatomyAnswer } from '../utils/gameLogic';

type AtlasMainTab = 'structures' | 'orthopedic' | 'kinesitherapy';
type KinesiSubFilter = 'all' | 'kinesitherapy_length' | 'lovett' | 'kinesitherapy_method';

interface AtlasDictionaryProps {
  mistakeStats: Record<string, { wrongCount: number }>;
  onShowIn3D?: (structure: AnatomicalStructure) => void;
  onVisualizeClinicalTest?: (test: ClinicalTestEntry) => void;
  deviceMode?: DeviceViewMode;
}

const CATEGORY_LABELS: Record<StructureCategory, string> = {
  bone: 'Kość / Punkt kostny',
  joint_ligament: 'Staw / Więzadło / Łąkotka',
  muscle: 'Mięsień / Zespół ścięgien',
  bursa: 'Kaletka maziowa',
  tendon: 'Ścięgno / Pochewka / Rozcięgno',
  ligament: 'Więzadło / Torebka stawowa',
  artery: 'Tętnica',
  vein: 'Żyła / Zatoka żylna',
  nerve: 'Nerw / Układ nerwowy',
  organ: 'Narząd wewnętrzny',
  skin: 'Powłoka skórna / Okolica',
};

const CLINICAL_CATEGORY_LABELS: Record<ClinicalTestCategory, string> = {
  orthopedic: 'Test ortopedyczny',
  kinesitherapy_length: 'Test przykurczu / długości',
  lovett: 'Skala Lovetta 0–5',
  kinesitherapy_method: 'Metodyka: UGUL / PNF / SFTR',
};

const REGION_LABELS: Record<RegionId, string> = {
  shoulder: 'Obręcz barkowa i ramię',
  knee: 'Staw kolanowy',
  spine_thorax: 'Kręgosłup i klatka piersiowa',
  pelvis_hip: 'Miednica i biodro',
  head_neck: 'Głowa i szyja',
  upper_limb: 'Kończyna górna',
  lower_limb: 'Kończyna dolna',
};

const REGION_TABS: Array<{ id: RegionId | 'all'; label: string }> = [
  { id: 'all', label: 'Wszystkie działy' },
  { id: 'shoulder', label: 'Obręcz barkowa i ramię' },
  { id: 'knee', label: 'Staw kolanowy' },
  { id: 'spine_thorax', label: 'Kręgosłup i klatka piersiowa' },
  { id: 'pelvis_hip', label: 'Miednica i biodro' },
  { id: 'head_neck', label: 'Głowa i szyja' },
  { id: 'upper_limb', label: 'Kończyna górna' },
  { id: 'lower_limb', label: 'Kończyna dolna' },
];

const ORTHO_COUNT = CLINICAL_TESTS_DB.filter((t) => t.category === 'orthopedic').length;
const KINESI_COUNT = CLINICAL_TESTS_DB.filter((t) => t.category !== 'orthopedic').length;

export const AtlasDictionary: React.FC<AtlasDictionaryProps> = React.memo(
  ({ mistakeStats, onShowIn3D, onVisualizeClinicalTest, deviceMode = 'auto' }) => {
    const [activeTab, setActiveTab] = useState<AtlasMainTab>('structures');
    const [query, setQuery] = useState('');
    const [regionFilter, setRegionFilter] = useState<RegionId | 'all'>('all');
    const [categoryFilter, setCategoryFilter] = useState<StructureCategory | 'all'>('all');
    const [kinesiSubFilter, setKinesiSubFilter] = useState<KinesiSubFilter>('all');

    const [selectedItem, setSelectedItem] = useState<AnatomicalStructure | null>(null);
    const [selectedTest, setSelectedTest] = useState<ClinicalTestEntry | null>(null);

    const structureResults = useMemo(() => {
      const rawQ = query.trim().toLowerCase();
      const normQ = normalizeAnatomyAnswer(query);

      return ANATOMY_DB.filter((item) => {
        if (regionFilter !== 'all' && item.region !== regionFilter) return false;
        if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
        if (!rawQ) return true;

        const directHaystack = [
          item.namePl,
          item.nameEn ?? '',
          formatBilingualName(item.namePl, item.nameEn),
          item.nameLt ?? '',
          ...item.aliases,
          item.pp,
          item.pk,
          item.innervation,
          item.spinalSegments,
          item.bloodSupply ?? '',
          item.functionDesc,
          item.clinicalCorrelation,
          item.funFact,
        ]
          .join(' ')
          .toLowerCase();

        if (directHaystack.includes(rawQ)) return true;

        const normHaystack = normalizeAnatomyAnswer(directHaystack);
        return normHaystack.includes(normQ);
      });
    }, [query, regionFilter, categoryFilter]);

    const clinicalResults = useMemo(() => {
      if (activeTab === 'structures') return [];
      const rawQ = query.trim().toLowerCase();
      const normQ = normalizeAnatomyAnswer(query);

      return CLINICAL_TESTS_DB.filter((test) => {
        if (activeTab === 'orthopedic' && test.category !== 'orthopedic') return false;
        if (activeTab === 'kinesitherapy') {
          if (test.category === 'orthopedic') return false;
          if (kinesiSubFilter !== 'all' && test.category !== kinesiSubFilter) return false;
        }
        if (regionFilter !== 'all' && test.region !== regionFilter) return false;
        if (!rawQ) return true;

        const linkedNames = test.structureIds
          .map((id) => ANATOMY_MAP[id]?.namePl ?? '')
          .join(' ');
        const directHaystack = [
          test.namePl,
          test.nameEn,
          test.targetSummary,
          test.patientPosition,
          test.procedure,
          test.positiveSign,
          test.clinicalInterpretation,
          test.lovettGravity ?? '',
          test.lovettEliminated ?? '',
          test.stabilization ?? '',
          test.resistancePoint ?? '',
          test.normsOrRules ?? '',
          linkedNames,
        ]
          .join(' ')
          .toLowerCase();

        if (directHaystack.includes(rawQ)) return true;
        return normalizeAnatomyAnswer(directHaystack).includes(normQ);
      });
    }, [activeTab, query, regionFilter, kinesiSubFilter]);

    const activeCount = activeTab === 'structures' ? structureResults.length : clinicalResults.length;
    const activeUnitLabel =
      activeTab === 'structures'
        ? 'struktur'
        : activeTab === 'orthopedic'
          ? 'testów'
          : 'zagadnień';

    const handleShowStructureById = (structureId: string) => {
      if (!onShowIn3D) return;
      const found = ANATOMY_MAP[structureId];
      if (!found) return;
      setSelectedTest(null);
      onShowIn3D(found);
    };

    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-emerald-950 dark:text-white">
              Atlas, Testy Ortopedyczne i Kinezyterapia
            </h1>
            <p className="mt-0.5 text-sm text-[#354c3f] dark:text-[#94b0a0]">
              Kompletne kompendium fizjoterapeuty: {ANATOMY_DB.length} struktur anatomicznych wszystkich układów (kości, mięśnie, kaletki, ścięgna, więzadła, tętnice, żyły, nerwy, narządy, skóra), {ORTHO_COUNT} testy ortopedyczne oraz {KINESI_COUNT} protokołów kinezyterapii (Lovett 0–5, UGUL, PNF, SFTR) z bezpośrednim podglądem 3D.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border-2 border-[#d6e7dc] bg-white px-3 py-1.5 text-xs font-bold text-[#26382e] dark:border-[#233d2f] dark:bg-[#112018] dark:text-[#c7dbcf]">
            <BookOpen className="h-4 w-4 text-emerald-500" />
            <span className="font-mono-tabular">{activeCount}</span>
            <span>{activeUnitLabel}</span>
          </div>
        </div>

        {/* Main 3-Tab Switcher */}
        <div
          role="tablist"
          aria-label="Sekcje Atlasu"
          className="grid grid-cols-1 gap-2.5 sm:grid-cols-3"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'structures'}
            data-testid="atlas-tab-structures"
            onClick={() => setActiveTab('structures')}
            className={`flex items-center justify-between gap-2 rounded-2xl border-2 border-b-4 px-4 py-3 text-left transition active:translate-y-0.5 active:border-b-2 ${
              activeTab === 'structures'
                ? 'border-emerald-700 bg-emerald-500 text-white shadow-sm'
                : 'border-[#d6e7dc] bg-white text-emerald-950 hover:border-emerald-400 dark:border-[#233d2f] dark:bg-[#112018] dark:text-emerald-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <BookOpen className="h-5 w-5 shrink-0" />
              <div>
                <div className="font-display text-sm font-extrabold">Struktury anatomiczne</div>
                <div
                  className={`text-[11px] font-medium ${
                    activeTab === 'structures' ? 'text-white/90' : 'text-[#52695b] dark:text-[#94b0a0]'
                  }`}
                >
                  Kości, stawy, więzadła, mięśnie
                </div>
              </div>
            </div>
            <span
              className={`font-mono-tabular rounded-lg px-2 py-0.5 text-xs font-extrabold ${
                activeTab === 'structures'
                  ? 'bg-emerald-700/60 text-white'
                  : 'bg-[#ebf5ee] text-emerald-800 dark:bg-[#182b21] dark:text-emerald-300'
              }`}
            >
              {ANATOMY_DB.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'orthopedic'}
            data-testid="atlas-tab-orthopedic"
            onClick={() => setActiveTab('orthopedic')}
            className={`flex items-center justify-between gap-2 rounded-2xl border-2 border-b-4 px-4 py-3 text-left transition active:translate-y-0.5 active:border-b-2 ${
              activeTab === 'orthopedic'
                ? 'border-emerald-700 bg-emerald-500 text-white shadow-sm'
                : 'border-[#d6e7dc] bg-white text-emerald-950 hover:border-emerald-400 dark:border-[#233d2f] dark:bg-[#112018] dark:text-emerald-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Stethoscope className="h-5 w-5 shrink-0" />
              <div>
                <div className="font-display text-sm font-extrabold">Testy ortopedyczne</div>
                <div
                  className={`text-[11px] font-medium ${
                    activeTab === 'orthopedic' ? 'text-white/90' : 'text-[#52695b] dark:text-[#94b0a0]'
                  }`}
                >
                  Neer, Lachman, Lasègue, Spurling...
                </div>
              </div>
            </div>
            <span
              className={`font-mono-tabular rounded-lg px-2 py-0.5 text-xs font-extrabold ${
                activeTab === 'orthopedic'
                  ? 'bg-emerald-700/60 text-white'
                  : 'bg-[#ebf5ee] text-emerald-800 dark:bg-[#182b21] dark:text-emerald-300'
              }`}
            >
              {ORTHO_COUNT}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'kinesitherapy'}
            data-testid="atlas-tab-kinesitherapy"
            onClick={() => setActiveTab('kinesitherapy')}
            className={`flex items-center justify-between gap-2 rounded-2xl border-2 border-b-4 px-4 py-3 text-left transition active:translate-y-0.5 active:border-b-2 ${
              activeTab === 'kinesitherapy'
                ? 'border-green-700 bg-green-600 text-white shadow-sm'
                : 'border-[#d6e7dc] bg-white text-emerald-950 hover:border-emerald-400 dark:border-[#233d2f] dark:bg-[#112018] dark:text-emerald-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Activity className="h-5 w-5 shrink-0" />
              <div>
                <div className="font-display text-sm font-extrabold">Kinezyterapia i Lovett</div>
                <div
                  className={`text-[11px] font-medium ${
                    activeTab === 'kinesitherapy' ? 'text-white/90' : 'text-[#52695b] dark:text-[#94b0a0]'
                  }`}
                >
                  Testy długości, Lovett 0–5, UGUL, PNF, SFTR
                </div>
              </div>
            </div>
            <span
              className={`font-mono-tabular rounded-lg px-2 py-0.5 text-xs font-extrabold ${
                activeTab === 'kinesitherapy'
                  ? 'bg-green-800/60 text-white'
                  : 'bg-[#ebf5ee] text-emerald-800 dark:bg-[#182b21] dark:text-emerald-300'
              }`}
            >
              {KINESI_COUNT}
            </span>
          </button>
        </div>

        {/* Search & Filters Bar */}
        <div className="space-y-3 rounded-2xl border-2 border-[#d6e7dc] bg-white p-4 dark:border-[#233d2f] dark:bg-[#112018]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#6b8274]" />
            <input
              type="text"
              data-testid="atlas-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                activeTab === 'structures'
                  ? 'Szukaj po polsku, angielsku (np. humerus), łacinie (np. supraspinatus), przyczepach, nerwach lub tętnicach...'
                  : activeTab === 'orthopedic'
                    ? 'Szukaj testu (np. Lachman, Neer, Spurling, Phalen), struktury lub objawu dodatniego...'
                    : 'Szukaj w kinezyterapii (np. Thomas, Schober, Lovett, UGUL, PNF, SFTR, przykurcz)...'
              }
              className="w-full rounded-xl border-2 border-[#d6e7dc] bg-[#f4faf6] py-2.5 pr-10 pl-10 text-sm font-medium text-emerald-950 placeholder:text-[#6b8274] focus:border-emerald-500 focus:outline-none dark:border-[#294737] dark:bg-[#182b21] dark:text-white"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Wyczyść wyszukiwanie"
                className="absolute top-1/2 right-3 -translate-y-1/2 text-[#6b8274] hover:text-[#2c4235] dark:hover:text-[#e6f2ea]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {/* Region Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              {REGION_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRegionFilter(tab.id)}
                  className={`whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                    regionFilter === tab.id
                      ? 'border-emerald-600 bg-emerald-500 text-white'
                      : 'border-[#d6e7dc] bg-[#f4faf6] text-[#354c3f] hover:bg-[#ebf5ee] dark:border-[#294737] dark:bg-[#182b21] dark:text-[#c7dbcf] dark:hover:bg-[#20382b]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sub-filter row for Structures */}
            {activeTab === 'structures' && (
              <div className="flex flex-wrap items-center gap-1.5 border-t border-[#e6f0ea] pt-2 dark:border-[#233d2f]">
                {(
                  [
                    { id: 'all', label: 'Wszystkie typy' },
                    { id: 'bone', label: 'Kości i punkty' },
                    { id: 'muscle', label: 'Mięśnie' },
                    { id: 'joint_ligament', label: 'Stawy i łąkotki' },
                    { id: 'ligament', label: 'Więzadła' },
                    { id: 'bursa', label: 'Kaletki' },
                    { id: 'tendon', label: 'Ścięgna i pochewki' },
                    { id: 'artery', label: 'Tętnice' },
                    { id: 'vein', label: 'Żyły' },
                    { id: 'nerve', label: 'Nerwy i OUN' },
                    { id: 'organ', label: 'Narządy' },
                    { id: 'skin', label: 'Powłoki skórne' },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    data-testid={`atlas-cat-filter-${cat.id}`}
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                      categoryFilter === cat.id
                        ? 'border-emerald-600 bg-emerald-500 text-white'
                        : 'border-[#d6e7dc] bg-[#f4faf6] text-[#354c3f] hover:bg-[#ebf5ee] dark:border-[#294737] dark:bg-[#182b21] dark:text-[#c7dbcf] dark:hover:bg-[#20382b]'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            )}

            {/* Sub-filter row for Kinesitherapy */}
            {activeTab === 'kinesitherapy' && (
              <div className="flex flex-wrap items-center gap-1.5 border-t border-[#e6f0ea] pt-2 dark:border-[#233d2f]">
                {(
                  [
                    { id: 'all', label: 'Wszystkie działy kinezyterapii' },
                    { id: 'kinesitherapy_length', label: 'Testy przykurczów i długości' },
                    { id: 'lovett', label: 'Skala Lovetta 0–5' },
                    { id: 'kinesitherapy_method', label: 'Metodyka: UGUL / PNF / SFTR' },
                  ] as const
                ).map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    data-testid={`atlas-kinesi-filter-${sub.id}`}
                    onClick={() => setKinesiSubFilter(sub.id)}
                    className={`whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                      kinesiSubFilter === sub.id
                        ? 'border-green-700 bg-green-600 text-white'
                        : 'border-[#d6e7dc] bg-[#f4faf6] text-[#354c3f] hover:bg-[#ebf5ee] dark:border-[#294737] dark:bg-[#182b21] dark:text-[#c7dbcf] dark:hover:bg-[#20382b]'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* TAB 1: ANATOMICAL STRUCTURES */}
        {activeTab === 'structures' && (
          <>
            {/* Desktop Table (hidden in Smartfon mode) */}
            <div
              className={`${
                deviceMode === 'phone' ? 'hidden' : 'hidden md:block'
              } overflow-hidden rounded-2xl border-2 border-[#d6e7dc] bg-white dark:border-[#233d2f] dark:bg-[#112018]`}
            >
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b-2 border-[#d6e7dc] bg-[#f4faf6] text-xs font-extrabold uppercase tracking-wider text-[#52695b] dark:border-[#233d2f] dark:bg-[#182b21]/70 dark:text-[#94b0a0]">
                      <th className="px-4 py-3">Struktura anatomiczna</th>
                      <th className="px-4 py-3">
                        {categoryFilter === 'bone'
                          ? 'Struktury kostne'
                          : categoryFilter === 'all'
                            ? 'Struktury kostne / PP'
                            : 'Przyczep początkowy (PP)'}
                      </th>
                      <th className="px-4 py-3">
                        {categoryFilter === 'bone'
                          ? 'Mięśnie przyczepiające się'
                          : categoryFilter === 'all'
                            ? 'Mięśnie przyczepiające się / PK'
                            : 'Przyczep końcowy (PK)'}
                      </th>
                      <th className="px-4 py-3">Unerwienie i unaczynienie</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e6f0ea] dark:divide-[#233d2f]">
                    {structureResults.map((item) => {
                      const mistakes = mistakeStats[item.id]?.wrongCount ?? 0;
                      const labels = getStructureDetailLabels(item.category);
                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedItem(item)}
                          className="cursor-pointer transition hover:bg-emerald-50/70 dark:hover:bg-[#182b21]/70"
                        >
                          <td className="px-4 py-3.5 align-top">
                            <div className="font-display font-bold text-emerald-950 dark:text-white">
                              {formatBilingualName(item.namePl, item.nameEn)}
                            </div>
                            {item.nameLt && (
                              <div className="text-xs italic text-[#52695b] dark:text-[#94b0a0]">
                                {item.nameLt}
                              </div>
                            )}
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className="rounded bg-[#ebf5ee] px-1.5 py-0.5 text-[10px] font-semibold text-[#354c3f] dark:bg-[#182b21] dark:text-[#c7dbcf]">
                                {REGION_LABELS[item.region]}
                              </span>
                              {onShowIn3D && (
                                <button
                                  type="button"
                                  data-testid={`atlas-row-3d-${item.id}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onShowIn3D(item);
                                  }}
                                  className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-800 transition hover:bg-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:hover:bg-emerald-900/70"
                                >
                                  <Box className="h-3 w-3" />
                                  <span>3D</span>
                                </button>
                              )}
                              {mistakes > 0 && (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                  Błędy: {mistakes}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="max-w-xs px-4 py-3.5 align-top text-xs leading-relaxed text-[#26382e] dark:text-[#c7dbcf]">
                            {categoryFilter === 'all' && (
                              <span className="font-bold text-[#16291f] dark:text-emerald-50">
                                {labels.firstShort}:{' '}
                              </span>
                            )}
                            {item.pp}
                          </td>
                          <td className="max-w-xs px-4 py-3.5 align-top text-xs leading-relaxed text-[#26382e] dark:text-[#c7dbcf]">
                            {categoryFilter === 'all' && (
                              <span className="font-bold text-[#16291f] dark:text-emerald-50">
                                {labels.secondShort}:{' '}
                              </span>
                            )}
                            {item.pk}
                          </td>
                          <td className="px-4 py-3.5 align-top text-xs text-[#26382e] dark:text-[#c7dbcf]">
                            <div>{item.innervation}</div>
                            {item.spinalSegments && item.spinalSegments !== '—' && (
                              <div className="font-mono-tabular mt-0.5 font-bold text-emerald-600 dark:text-emerald-400">
                                Segmenty: {item.spinalSegments}
                              </div>
                            )}
                            {item.bloodSupply && (
                              <div className="mt-1 text-[11px] text-[#52695b] dark:text-[#94b0a0]">
                                <span className="font-semibold text-rose-500 dark:text-rose-400">
                                  Tętnice:{' '}
                                </span>
                                {item.bloodSupply}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {structureResults.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-10 text-center text-sm text-[#52695b] dark:text-[#94b0a0]"
                        >
                          Brak struktur pasujących do podanych filtrów.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards */}
            <div className={`space-y-3 ${deviceMode === 'phone' ? 'block' : 'md:hidden'}`}>
              {structureResults.map((item) => {
                const labels = getStructureDetailLabels(item.category);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedItem(item)}
                    className="w-full rounded-2xl border-2 border-[#d6e7dc] bg-white p-4 text-left transition hover:border-emerald-300 dark:border-[#233d2f] dark:bg-[#112018] dark:hover:border-emerald-700"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-display text-base font-bold text-emerald-950 dark:text-white">
                          {formatBilingualName(item.namePl, item.nameEn)}
                        </div>
                        {item.nameLt && (
                          <div className="text-xs italic text-[#52695b] dark:text-[#94b0a0]">
                            {item.nameLt}
                          </div>
                        )}
                        <div className="mt-1 text-[11px] font-semibold text-[#52695b] dark:text-[#94b0a0]">
                          {REGION_LABELS[item.region]}
                        </div>
                      </div>
                      {item.spinalSegments && item.spinalSegments !== '—' && (
                        <span className="font-mono-tabular rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {item.spinalSegments}
                        </span>
                      )}
                    </div>
                    <div className="mt-2.5 space-y-1 text-xs text-[#354c3f] dark:text-[#c7dbcf]">
                      <div>
                        <span className="font-bold">{labels.firstShort}: </span>
                        {item.pp}
                      </div>
                      <div>
                        <span className="font-bold">{labels.secondShort}: </span>
                        {item.pk}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* TAB 2 & TAB 3: ORTHOPEDIC TESTS & KINESITHERAPY / LOVETT */}
        {activeTab !== 'structures' && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {clinicalResults.map((test) => {
              const primaryStructure = test.structureIds[0]
                ? ANATOMY_MAP[test.structureIds[0]]
                : undefined;

              return (
                <article
                  key={test.id}
                  data-testid={`clinical-card-${test.id}`}
                  onClick={() => setSelectedTest(test)}
                  className="flex cursor-pointer flex-col justify-between rounded-2xl border-2 border-[#d6e7dc] bg-white p-5 transition hover:border-emerald-500 hover:shadow-sm dark:border-[#233d2f] dark:bg-[#112018] dark:hover:border-emerald-500"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`rounded-lg px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                          test.category === 'lovett'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                            : test.category === 'kinesitherapy_method'
                              ? 'bg-green-100 text-green-800 dark:bg-green-950/70 dark:text-green-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                        }`}
                      >
                        {CLINICAL_CATEGORY_LABELS[test.category]}
                      </span>
                      <span className="text-[11px] font-semibold text-[#52695b] dark:text-[#94b0a0]">
                        {REGION_LABELS[test.region]}
                      </span>
                    </div>

                    <h2 className="mt-2 font-display text-lg font-extrabold text-emerald-950 dark:text-white">
                      {test.namePl}
                    </h2>
                    <div className="text-xs font-medium text-[#52695b] dark:text-[#94b0a0]">
                      {test.nameEn}
                    </div>

                    <p className="mt-2.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                      {test.targetSummary}
                    </p>

                    {test.category === 'lovett' ? (
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 text-[11px] text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-100">
                          <div className="font-extrabold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                            Lovett 0–2 (odciążenie)
                          </div>
                          <p className="mt-0.5 line-clamp-3 leading-relaxed">
                            {test.lovettEliminated}
                          </p>
                        </div>
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5 text-[11px] text-emerald-950 dark:border-emerald-800/70 dark:bg-emerald-950/30 dark:text-emerald-100">
                          <div className="font-extrabold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                            Lovett 3–5 (grawitacja)
                          </div>
                          <p className="mt-0.5 line-clamp-3 leading-relaxed">
                            {test.lovettGravity}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl bg-[#f4faf6] p-3 text-xs leading-relaxed text-[#26382e] dark:bg-[#182b21]/80 dark:text-[#c7dbcf]">
                        <span className="font-extrabold text-rose-600 dark:text-rose-400">
                          Objaw dodatni / Kryterium:{' '}
                        </span>
                        <span className="line-clamp-3">{test.positiveSign}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#e6f0ea] pt-3 dark:border-[#233d2f]">
                    <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
                      <ClipboardCheck className="h-3.5 w-3.5" />
                      <span>Otwórz pełny protokół</span>
                    </span>

                    {(onVisualizeClinicalTest || (onShowIn3D && primaryStructure)) && (
                      <button
                        type="button"
                        data-testid={`clinical-card-3d-${test.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onVisualizeClinicalTest) {
                            onVisualizeClinicalTest(test);
                          } else if (primaryStructure) {
                            handleShowStructureById(primaryStructure.id);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500 bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-200 dark:hover:bg-emerald-900/70"
                      >
                        <Box className="h-3.5 w-3.5" />
                        <span>Wizualizuj test na 3D</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}

            {clinicalResults.length === 0 && (
              <div className="col-span-full rounded-2xl border-2 border-[#d6e7dc] bg-white px-4 py-12 text-center text-sm text-[#52695b] dark:border-[#233d2f] dark:bg-[#112018] dark:text-[#94b0a0]">
                Brak testów lub zagadnień kinezyterapii pasujących do podanych filtrów.
              </div>
            )}
          </div>
        )}

        {/* Structure Detail Modal */}
        {selectedItem && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#050d09]/60 p-4"
            onClick={() => setSelectedItem(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border-2 border-[#d6e7dc] bg-white p-6 shadow-xl dark:border-[#294737] dark:bg-[#112018]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    {REGION_LABELS[selectedItem.region]} • {CATEGORY_LABELS[selectedItem.category]}
                  </div>
                  <h2 className="mt-1 font-display text-2xl font-extrabold text-emerald-950 dark:text-white">
                    {formatBilingualName(selectedItem.namePl, selectedItem.nameEn)}
                  </h2>
                  {selectedItem.nameLt && (
                    <div className="mt-0.5 text-sm italic font-medium text-[#52695b] dark:text-[#94b0a0]">
                      łac. – {selectedItem.nameLt}
                    </div>
                  )}
                  {onShowIn3D && (
                    <button
                      type="button"
                      data-testid="atlas-modal-show-3d-btn"
                      onClick={() => {
                        const target = selectedItem;
                        setSelectedItem(null);
                        onShowIn3D(target);
                      }}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-3.5 py-2 text-xs font-extrabold text-white transition hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2"
                    >
                      <Box className="h-4 w-4" />
                      <span>Pokaż w 3D (z przyczepami PP/PK)</span>
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  aria-label="Zamknij szczegóły"
                  className="rounded-xl border border-[#d6e7dc] p-2 text-[#52695b] hover:bg-[#ebf5ee] dark:border-[#294737] dark:text-[#94b0a0] dark:hover:bg-[#182b21]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 space-y-3 text-sm leading-relaxed">
                {(() => {
                  const modalLabels = getStructureDetailLabels(selectedItem.category);
                  return (
                    <>
                      <div className="rounded-2xl bg-[#f4faf6] p-3.5 dark:bg-[#182b21]/70">
                        <div className="text-xs font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
                          {modalLabels.firstLabel}
                        </div>
                        <p className="mt-1 text-[#16291f] dark:text-emerald-50">{selectedItem.pp}</p>
                      </div>
                      <div className="rounded-2xl bg-[#f4faf6] p-3.5 dark:bg-[#182b21]/70">
                        <div className="text-xs font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
                          {modalLabels.secondLabel}
                        </div>
                        <p className="mt-1 text-[#16291f] dark:text-emerald-50">{selectedItem.pk}</p>
                      </div>
                    </>
                  );
                })()}

                <div className="rounded-2xl bg-[#f4faf6] p-3.5 dark:bg-[#182b21]/70">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
                    Czynność i biomechanika
                  </div>
                  <p className="mt-1 text-[#16291f] dark:text-emerald-50">
                    {selectedItem.functionDesc}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#f4faf6] p-3.5 dark:bg-[#182b21]/70">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
                    Unerwienie i segmenty rdzeniowe
                  </div>
                  <p className="mt-1 text-[#16291f] dark:text-emerald-50">
                    {selectedItem.innervation}{' '}
                    {selectedItem.spinalSegments && selectedItem.spinalSegments !== '—' && (
                      <span className="font-mono-tabular font-bold text-emerald-600 dark:text-emerald-400">
                        ({selectedItem.spinalSegments})
                      </span>
                    )}
                  </p>
                </div>

                {selectedItem.bloodSupply && (
                  <div className="rounded-2xl bg-[#f4faf6] p-3.5 dark:bg-[#182b21]/70">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-rose-500 dark:text-rose-400">
                      Unaczynienie tętnicze
                    </div>
                    <p className="mt-1 text-[#16291f] dark:text-emerald-50">
                      {selectedItem.bloodSupply}
                    </p>
                  </div>
                )}

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-100">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider">
                    <Stethoscope className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span>Korelacja kliniczna</span>
                  </div>
                  <p className="mt-1">{selectedItem.clinicalCorrelation}</p>
                </div>

                {selectedItem.funFact && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-emerald-950 dark:border-emerald-800/70 dark:bg-emerald-950/40 dark:text-emerald-100">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider">
                      <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Ciekawostka anatomiczna</span>
                    </div>
                    <p className="mt-1">{selectedItem.funFact}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Clinical Test / Kinesitherapy Detail Modal */}
        {selectedTest && (
          <div
            data-testid="clinical-detail-modal"
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#050d09]/60 p-4"
            onClick={() => setSelectedTest(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border-2 border-[#d6e7dc] bg-white p-6 shadow-xl dark:border-[#294737] dark:bg-[#112018]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    {REGION_LABELS[selectedTest.region]} • {CLINICAL_CATEGORY_LABELS[selectedTest.category]}
                  </div>
                  <h2 className="mt-1 font-display text-2xl font-extrabold text-emerald-950 dark:text-white">
                    {selectedTest.namePl}
                  </h2>
                  <div className="mt-0.5 text-sm font-medium text-[#52695b] dark:text-[#94b0a0]">
                    {selectedTest.nameEn}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedTest(null)}
                  aria-label="Zamknij protokół testu"
                  className="rounded-xl border border-[#d6e7dc] p-2 text-[#52695b] hover:bg-[#ebf5ee] dark:border-[#294737] dark:text-[#94b0a0] dark:hover:bg-[#182b21]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 space-y-3 text-sm leading-relaxed">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-800/70 dark:bg-emerald-950/40">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    Cel i oceniana struktura
                  </div>
                  <p className="mt-1 font-semibold text-emerald-950 dark:text-emerald-50">
                    {selectedTest.targetSummary}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#f4faf6] p-3.5 dark:bg-[#182b21]/70">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
                    Pozycja wyjściowa pacjenta
                  </div>
                  <p className="mt-1 text-[#16291f] dark:text-emerald-50">
                    {selectedTest.patientPosition}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#f4faf6] p-3.5 dark:bg-[#182b21]/70">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
                    Sposób wykonania / Metodyka
                  </div>
                  <p className="mt-1 text-[#16291f] dark:text-emerald-50">
                    {selectedTest.procedure}
                  </p>
                </div>

                {/* Dedicated Lovett 0-5 breakdown grid */}
                {(selectedTest.lovettEliminated || selectedTest.lovettGravity) && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {selectedTest.lovettEliminated && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-800/70 dark:bg-amber-950/40">
                        <div className="text-xs font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                          Stopnie 0–2 (w odciążeniu / bez grawitacji)
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-amber-950 dark:text-amber-100">
                          {selectedTest.lovettEliminated}
                        </p>
                      </div>
                    )}
                    {selectedTest.lovettGravity && (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 dark:border-emerald-800/70 dark:bg-emerald-950/40">
                        <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                          Stopnie 3–5 (przeciw grawitacji + opór)
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-emerald-950 dark:text-emerald-100">
                          {selectedTest.lovettGravity}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {(selectedTest.stabilization || selectedTest.resistancePoint) && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {selectedTest.stabilization && (
                      <div className="rounded-2xl bg-[#f4faf6] p-3.5 dark:bg-[#182b21]/70">
                        <div className="text-xs font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
                          Stabilizacja
                        </div>
                        <p className="mt-1 text-xs text-[#16291f] dark:text-emerald-50">
                          {selectedTest.stabilization}
                        </p>
                      </div>
                    )}
                    {selectedTest.resistancePoint && (
                      <div className="rounded-2xl bg-[#f4faf6] p-3.5 dark:bg-[#182b21]/70">
                        <div className="text-xs font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                          Punkt przyłożenia oporu (4–5)
                        </div>
                        <p className="mt-1 text-xs text-[#16291f] dark:text-emerald-50">
                          {selectedTest.resistancePoint}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3.5 text-rose-950 dark:border-rose-800/70 dark:bg-rose-950/35 dark:text-rose-100">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                    {selectedTest.category === 'lovett'
                      ? 'Kryteria stopni 0–5 w skali Lovetta'
                      : 'Objaw dodatni / Kryterium oceny'}
                  </div>
                  <p className="mt-1">{selectedTest.positiveSign}</p>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-100">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider">
                    <Stethoscope className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span>Interpretacja kliniczna i postępowanie</span>
                  </div>
                  <p className="mt-1">{selectedTest.clinicalInterpretation}</p>
                </div>

                {selectedTest.normsOrRules && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-emerald-950 dark:border-emerald-800/70 dark:bg-emerald-950/40 dark:text-emerald-100">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider">
                      <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Normy i kluczowe zasady egzaminacyjne</span>
                    </div>
                    <p className="mt-1">{selectedTest.normsOrRules}</p>
                  </div>
                )}

                {/* Linked 3D Structures Chips + Full Multi-Structure 3D Test Visualizer CTA */}
                {(onVisualizeClinicalTest || onShowIn3D) && selectedTest.structureIds.length > 0 && (
                  <div className="space-y-3 rounded-2xl border-2 border-[#d6e7dc] bg-[#f4faf6] p-3.5 dark:border-[#294737] dark:bg-[#182b21]/80">
                    {onVisualizeClinicalTest && (
                      <button
                        type="button"
                        data-testid="clinical-modal-visualize-test-3d"
                        onClick={() => {
                          const t = selectedTest;
                          setSelectedTest(null);
                          onVisualizeClinicalTest(t);
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-b-4 border-emerald-700 bg-emerald-500 px-4 py-2.5 font-display text-xs font-extrabold text-white transition hover:bg-emerald-600 active:translate-y-0.5 active:border-b-2"
                      >
                        <Box className="h-4 w-4" />
                        <span>
                          Wizualizuj cały test na modelu 3D (podświetl {selectedTest.structureIds.length} struktur naraz)
                        </span>
                      </button>
                    )}

                    <div>
                      <div className="text-xs font-extrabold uppercase tracking-wider text-[#52695b] dark:text-[#94b0a0]">
                        Pojedyncze struktury na modelu 3D (kliknij, aby przejść):
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedTest.structureIds.map((sid) => {
                          const s = ANATOMY_MAP[sid];
                          if (!s) return null;
                          return (
                            <button
                              key={sid}
                              type="button"
                              data-testid={`clinical-modal-3d-${sid}`}
                              onClick={() => handleShowStructureById(sid)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400 bg-white px-2.5 py-1.5 text-xs font-bold text-emerald-900 transition hover:bg-emerald-50 dark:border-emerald-700 dark:bg-[#112018] dark:text-emerald-200 dark:hover:bg-emerald-950/60"
                            >
                              <Box className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>{formatBilingualName(s.namePl, s.nameEn)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
);
