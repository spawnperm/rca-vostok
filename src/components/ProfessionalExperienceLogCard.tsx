import React, { useEffect, useMemo, useState } from 'react';
import * as d3 from 'd3';
import {
  BarChart3,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Compass,
  Filter,
  MapPin,
  Plus,
  RotateCcw,
  Route,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DFO_LABEL_OFFSETS, buildDfoD3MapLayout } from '../utils/dfoD3MapData';
import {
  EXPERIENCE_COMPLEXITIES,
  JOURNAL_DFO_REGIONS,
  buildJournalCalendarMonth,
  computeJournalMetrics,
  extractActiveCalendarMonths,
  formatRussianJournalDate,
  getDefaultJournalEntries,
  readStoredExperienceJournal,
  resolveInitialCalendarMonth,
  resolveJournalRegionId,
  shiftCalendarMonth,
  validateJournalEntryInput,
  writeStoredExperienceJournal,
  type DfoJournalRegionId,
  type ExpeditionComplexity,
  type ExperienceLogEntry,
} from '../utils/experienceJournal';
import type { SessionUser } from '../utils/identityApi';
import { tracker } from '../utils/tracker';

interface ProfessionalExperienceLogCardProps {
  user: SessionUser | null;
}

type VisualizationTab = 'map' | 'calendar' | 'timeline' | 'complexity';

const COMPLEXITY_BADGE_CLASS: Record<ExpeditionComplexity, string> = {
  'н/к': 'bg-slate-100 text-slate-700 border-slate-300',
  '1 КС': 'bg-teal-50 text-teal-800 border-teal-200',
  '2 КС': 'bg-emerald-50 text-emerald-800 border-emerald-200',
  '3 КС': 'bg-cyan-50 text-cyan-900 border-cyan-200',
  '4 КС': 'bg-amber-50 text-amber-800 border-amber-200',
  '5 КС': 'bg-rose-50 text-rose-800 border-rose-200',
};

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const ProfessionalExperienceLogCard: React.FC<ProfessionalExperienceLogCardProps> = ({
  user,
}) => {
  const userId = user?.id ?? null;
  const preferredRegion = user?.region;

  const [entries, setEntries] = useState<ExperienceLogEntry[]>(() =>
    readStoredExperienceJournal(userId, preferredRegion)
  );

  // Sync storage when logged-in user changes
  useEffect(() => {
    setEntries(readStoredExperienceJournal(userId, preferredRegion));
  }, [userId, preferredRegion]);

  // Form state
  const [date, setDate] = useState<string>(getTodayIso);
  const [regionId, setRegionId] = useState<DfoJournalRegionId>(() =>
    resolveJournalRegionId(preferredRegion)
  );
  const [complexity, setComplexity] = useState<ExpeditionComplexity>('2 КС');
  const [participantsCount, setParticipantsCount] = useState<string>('10');
  const [routeTitle, setRouteTitle] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Visualization & table filters
  const [activeTab, setActiveTab] = useState<VisualizationTab>('map');
  const [selectedMapRegionId, setSelectedMapRegionId] = useState<DfoJournalRegionId>(() =>
    resolveJournalRegionId(preferredRegion)
  );
  const [hoveredMapRegionId, setHoveredMapRegionId] = useState<DfoJournalRegionId | null>(null);
  const [regionFilter, setRegionFilter] = useState<DfoJournalRegionId | 'all'>('all');
  const [complexityFilter, setComplexityFilter] = useState<ExpeditionComplexity | 'all'>('all');

  const initialCal = useMemo(() => resolveInitialCalendarMonth(entries), []);
  const [calendarYear, setCalendarYear] = useState<number>(initialCal.year);
  const [calendarMonth, setCalendarMonth] = useState<number>(initialCal.month);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(initialCal.selectedIso);

  useEffect(() => {
    const resolved = resolveJournalRegionId(preferredRegion);
    setRegionId(resolved);
    setSelectedMapRegionId(resolved);
  }, [preferredRegion]);

  const metrics = useMemo(() => computeJournalMetrics(entries), [entries]);
  const calendarModel = useMemo(
    () => buildJournalCalendarMonth(calendarYear, calendarMonth, entries),
    [calendarYear, calendarMonth, entries]
  );
  const activeCalendarMonths = useMemo(
    () => extractActiveCalendarMonths(entries),
    [entries]
  );
  const selectedDayEntries = useMemo(
    () => entries.filter((item) => item.date === selectedCalendarDate),
    [entries, selectedCalendarDate]
  );

  const mapLayout = useMemo(() => buildDfoD3MapLayout(760, 460), []);

  const maxTripsPerRegion = useMemo(
    () => Math.max(...metrics.byRegionList.map((r) => r.tripsCount), 1),
    [metrics.byRegionList]
  );

  const mapColorScale = useMemo(
    () =>
      d3
        .scaleSequential(d3.interpolateRgbBasis(['#CCFBF1', '#5EEAD4', '#0F766E']))
        .domain([1, Math.max(maxTripsPerRegion, 2)]),
    [maxTripsPerRegion]
  );

  const activeMapRegionId: DfoJournalRegionId = hoveredMapRegionId ?? selectedMapRegionId;
  const activeRegionStats = metrics.byRegionMap[activeMapRegionId];

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (regionFilter !== 'all' && entry.regionId !== regionFilter) return false;
      if (complexityFilter !== 'all' && entry.complexity !== complexityFilter) return false;
      return true;
    });
  }, [entries, regionFilter, complexityFilter]);

  const persistEntries = (next: ExperienceLogEntry[]) => {
    const sorted = [...next].sort((a, b) => b.date.localeCompare(a.date));
    setEntries(sorted);
    writeStoredExperienceJournal(userId, sorted);
  };

  const handleAddEntry = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    setStatusNotice(null);

    const validated = validateJournalEntryInput({
      date,
      routeTitle,
      regionId,
      complexity,
      participantsCount,
      notes,
    });

    if (!validated.ok) {
      setFormError(validated.error);
      return;
    }

    const next = [validated.entry, ...entries];
    persistEntries(next);
    setSelectedMapRegionId(validated.entry.regionId);
    const [yStr, mStr] = validated.entry.date.split('-');
    const yNum = Number.parseInt(yStr, 10);
    const mNum = Number.parseInt(mStr, 10);
    if (!Number.isNaN(yNum) && !Number.isNaN(mNum)) {
      setCalendarYear(yNum);
      setCalendarMonth(mNum);
    }
    setSelectedCalendarDate(validated.entry.date);
    setRouteTitle('');
    setNotes('');
    setStatusNotice(
      `Запись добавлена: ${validated.entry.routeTitle} (${validated.entry.regionName}, ${validated.entry.complexity}, ${validated.entry.participantsCount} чел.).`
    );
    tracker.trackCustomInteraction(
      'Журнал опыта · Добавлен поход',
      `${validated.entry.regionId}:${validated.entry.complexity}`
    );
  };

  const handleDeleteEntry = (entryId: string) => {
    const next = entries.filter((item) => item.id !== entryId);
    persistEntries(next);
    setStatusNotice('Запись удалена из журнала.');
  };

  const handleResetDemoEntries = () => {
    const defaults = getDefaultJournalEntries(preferredRegion);
    persistEntries(defaults);
    setRegionFilter('all');
    setComplexityFilter('all');
    setFormError(null);
    setStatusNotice('Восстановлены демонстрационные записи походов по ДФО.');
  };

  return (
    <section
      id="professional-experience-log"
      aria-labelledby="professional-experience-log-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 scroll-mt-24"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="space-y-1.5 max-w-2xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Полевая практика и маршрутный стаж · ДФО</span>
          </p>
          <h3
            id="professional-experience-log-heading"
            className="text-xl font-bold text-slate-900"
          >
            Журнал профессионального опыта
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Фиксируйте проведённые походы и водные маршруты с датой, субъектом ДФО, категорией
            сложности и составом группы. Активность автоматически отображается на карте ДФО и
            графиках динамики.
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetDemoEntries}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors self-start cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
          <span>Сбросить к примерам</span>
        </button>
      </div>

      {/* KPI summary row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1">
          <p className="text-[11px] font-medium text-slate-500 inline-flex items-center gap-1.5">
            <Route className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>Проведено походов</span>
          </p>
          <p className="text-xl font-bold text-slate-900 tabular-nums">{metrics.totalTrips}</p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1">
          <p className="text-[11px] font-medium text-slate-500 inline-flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>Участников в группах</span>
          </p>
          <p className="text-xl font-bold text-slate-900 tabular-nums">
            {metrics.totalParticipants} чел.
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1">
          <p className="text-[11px] font-medium text-slate-500 inline-flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>Субъектов ДФО</span>
          </p>
          <p className="text-xl font-bold text-slate-900 tabular-nums">
            {metrics.activeRegionsCount} из {JOURNAL_DFO_REGIONS.length}
          </p>
        </div>

        <div className="bg-teal-50/80 border border-teal-200 rounded-lg p-3.5 space-y-1">
          <p className="text-[11px] font-medium text-teal-800 inline-flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>Макс. категория / ср. группа</span>
          </p>
          <p className="text-xl font-bold text-teal-950 tabular-nums">
            {metrics.maxComplexity}{' '}
            <span className="text-xs font-semibold text-teal-800">
              · ~{metrics.avgGroupSize} чел.
            </span>
          </p>
        </div>
      </div>

      {/* Main grid: Entry Form (5 cols) + Interactive Map / Chart (7 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Form Card */}
        <form
          onSubmit={handleAddEntry}
          noValidate
          className="xl:col-span-5 bg-slate-50/70 border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-slate-900">Добавить проведённый поход</h4>
            <span className="text-[11px] text-slate-500">Сохраняется локально</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Дата похода</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Участников (чел.)</span>
              <input
                type="number"
                min={1}
                max={500}
                step={1}
                value={participantsCount}
                onChange={(e) => setParticipantsCount(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Регион ДФО</span>
              <select
                value={regionId}
                onChange={(e) => setRegionId(e.target.value as DfoJournalRegionId)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              >
                {JOURNAL_DFO_REGIONS.map((reg) => (
                  <option key={reg.id} value={reg.id}>
                    {reg.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Сложность маршрута</span>
              <select
                value={complexity}
                onChange={(e) => setComplexity(e.target.value as ExpeditionComplexity)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              >
                {EXPERIENCE_COMPLEXITIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-700">
              Нитка маршрута / объект (необязательно)
            </span>
            <input
              type="text"
              value={routeTitle}
              onChange={(e) => setRouteTitle(e.target.value)}
              placeholder="Напр.: Хребет Чандалаз или сплав по р. Кема"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-700">
              Примечание по безопасности (необязательно)
            </span>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Регистрация МЧС, погодные условия, роль в группе"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
          </label>

          {formError && (
            <p
              role="alert"
              className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
            >
              {formError}
            </p>
          )}

          {statusNotice && !formError && (
            <p className="text-xs text-teal-900 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
              {statusNotice}
            </p>
          )}

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Добавить запись в журнал</span>
          </button>
        </form>

        {/* Interactive Visualization Card */}
        <div className="xl:col-span-7 border border-slate-200 rounded-xl bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Визуализация активности проводника
              </h4>
              <p className="text-xs text-slate-500">
                Переключайтесь между географией маршрутов по ДФО и графиками динамики/сложности.
              </p>
            </div>

            <div
              role="tablist"
              aria-label="Режим визуализации журнала опыта"
              className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
            >
              {(
                [
                  { id: 'map', label: 'Карта ДФО', icon: MapPin },
                  { id: 'calendar', label: 'Календарь', icon: Calendar },
                  { id: 'timeline', label: 'По месяцам', icon: CalendarDays },
                  { id: 'complexity', label: 'По сложности', icon: BarChart3 },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {activeTab === 'map' && (
            <div className="space-y-3">
              <div className="relative bg-slate-50 border border-slate-200 rounded-xl p-3">
                <svg
                  viewBox={`0 0 ${mapLayout.width} ${mapLayout.height}`}
                  className="w-full max-h-[300px] h-auto mx-auto select-none"
                  role="img"
                  aria-label="Карта активности походов по субъектам ДФО"
                >
                  <rect
                    x="0"
                    y="0"
                    width={mapLayout.width}
                    height={mapLayout.height}
                    fill="#F0F7FF"
                    rx="10"
                  />
                  <path
                    d={mapLayout.graticulePath}
                    fill="none"
                    stroke="#DCE7F3"
                    strokeWidth="0.9"
                    strokeDasharray="3 4"
                  />

                  {mapLayout.subjects.map((subject) => {
                    const regId = subject.id as DfoJournalRegionId;
                    const stats = metrics.byRegionMap[regId];
                    const trips = stats?.tripsCount ?? 0;
                    const isActive = activeMapRegionId === regId;
                    const fillColor =
                      trips > 0 ? mapColorScale(trips) : isActive ? '#E2E8F0' : '#FFFFFF';

                    return (
                      <path
                        key={subject.id}
                        d={subject.pathData}
                        tabIndex={0}
                        role="button"
                        aria-label={`${subject.name}: ${trips} походов, ${stats?.participantsCount ?? 0} участников`}
                        fill={fillColor}
                        stroke={isActive ? '#0F172A' : trips > 0 ? '#0F766E' : '#94A3B8'}
                        strokeWidth={isActive ? 2.4 : trips > 0 ? 1.5 : 1}
                        strokeLinejoin="round"
                        className="cursor-pointer transition-colors"
                        onMouseEnter={() => setHoveredMapRegionId(regId)}
                        onMouseLeave={() =>
                          setHoveredMapRegionId((prev) => (prev === regId ? null : prev))
                        }
                        onFocus={() => setHoveredMapRegionId(regId)}
                        onBlur={() =>
                          setHoveredMapRegionId((prev) => (prev === regId ? null : prev))
                        }
                        onClick={() => {
                          setSelectedMapRegionId(regId);
                          setRegionFilter((prev) => (prev === regId ? 'all' : regId));
                        }}
                      />
                    );
                  })}

                  {/* Centroid count badges & labels */}
                  {mapLayout.subjects.map((subject) => {
                    const regId = subject.id as DfoJournalRegionId;
                    const stats = metrics.byRegionMap[regId];
                    const trips = stats?.tripsCount ?? 0;
                    const [cx, cy] = subject.centroid;
                    const offset = DFO_LABEL_OFFSETS[subject.id] ?? {
                      dx: 0,
                      dy: -16,
                      anchor: 'middle',
                    };
                    const isActive = activeMapRegionId === regId;

                    return (
                      <g key={`marker-${subject.id}`} className="pointer-events-none">
                        <circle
                          cx={cx}
                          cy={cy}
                          r={trips > 0 ? Math.min(18, 10 + trips * 2) : 6}
                          fill={trips > 0 ? '#0F172A' : '#CBD5E1'}
                          stroke="#FFFFFF"
                          strokeWidth="2"
                          opacity={isActive ? 1 : 0.9}
                        />
                        {trips > 0 && (
                          <text
                            x={cx}
                            y={cy + 4}
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontSize="11"
                            fontWeight="700"
                          >
                            {trips}
                          </text>
                        )}
                        <text
                          x={cx + offset.dx}
                          y={cy + offset.dy}
                          textAnchor={offset.anchor}
                          fill={isActive ? '#0F172A' : '#334155'}
                          fontSize="11"
                          fontWeight={isActive || trips > 0 ? '700' : '500'}
                        >
                          {subject.shortName}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Legend bar */}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 px-1">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-xs bg-white border border-slate-400" />
                      <span>Нет записей</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-xs bg-teal-200 border border-teal-700" />
                      <span>1 поход</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-xs bg-teal-700 border border-teal-900" />
                      <span>Высокая активность</span>
                    </span>
                  </div>
                  <span className="text-slate-500">
                    Клик по региону фильтрует список походов ниже
                  </span>
                </div>
              </div>

              {/* Selected region details strip */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div className="space-y-0.5">
                  <p className="font-bold text-slate-900">{activeRegionStats.regionName}</p>
                  <p className="text-slate-600">
                    {activeRegionStats.tripsCount > 0 ? (
                      <>
                        Походов: <strong>{activeRegionStats.tripsCount}</strong> · Участников:{' '}
                        <strong>{activeRegionStats.participantsCount} чел.</strong> · Макс. КС:{' '}
                        <strong>{activeRegionStats.maxComplexity ?? '—'}</strong>
                        {activeRegionStats.latestDate
                          ? ` · Последний: ${formatRussianJournalDate(activeRegionStats.latestDate)}`
                          : ''}
                      </>
                    ) : (
                      'По этому субъекту ДФО записи о походах ещё не внесены.'
                    )}
                  </p>
                </div>

                {regionFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setRegionFilter('all')}
                    className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 font-semibold rounded-md hover:bg-slate-100 cursor-pointer"
                  >
                    Показать все регионы
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="space-y-3">
              {/* Month Header Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Предыдущий месяц"
                    onClick={() => {
                      const prev = shiftCalendarMonth(calendarYear, calendarMonth, -1);
                      setCalendarYear(prev.year);
                      setCalendarMonth(prev.month);
                    }}
                    className="p-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 min-w-[132px] text-center">
                    {calendarModel.monthTitle}
                  </span>
                  <button
                    type="button"
                    aria-label="Следующий месяц"
                    onClick={() => {
                      const next = shiftCalendarMonth(calendarYear, calendarMonth, 1);
                      setCalendarYear(next.year);
                      setCalendarMonth(next.month);
                    }}
                    className="p-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                  <span>
                    В месяце: <strong className="text-slate-900">{calendarModel.monthTripsCount}</strong>{' '}
                    поход(ов) ·{' '}
                    <strong className="text-slate-900">
                      {calendarModel.monthParticipantsCount} чел.
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const today = getTodayIso();
                      const [yStr, mStr] = today.split('-');
                      setCalendarYear(Number.parseInt(yStr, 10));
                      setCalendarMonth(Number.parseInt(mStr, 10));
                      setSelectedCalendarDate(today);
                      setDate(today);
                    }}
                    className="px-2 py-1 bg-white border border-slate-300 text-slate-700 font-semibold rounded-md hover:bg-slate-100 cursor-pointer"
                  >
                    Текущий месяц
                  </button>
                </div>
              </div>

              {/* Quick jump pills to months with trips */}
              {activeCalendarMonths.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="text-slate-500 mr-1">Активные месяцы:</span>
                  {activeCalendarMonths.map((am) => {
                    const isCurrent = am.year === calendarYear && am.month === calendarMonth;
                    return (
                      <button
                        key={am.monthKey}
                        type="button"
                        onClick={() => {
                          setCalendarYear(am.year);
                          setCalendarMonth(am.month);
                        }}
                        className={`px-2 py-0.5 rounded-md border font-semibold transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-teal-700 border-teal-700 text-white'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {am.label} ({am.tripsCount})
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 7-column Monday-start Calendar Grid */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200 text-center text-[11px] font-semibold text-slate-600">
                  {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((wd) => (
                    <div key={wd} className="py-2">
                      {wd}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-px bg-slate-200">
                  {calendarModel.cells.map((cell) => {
                    const hasTrips = cell.entries.length > 0;
                    const isSelected = selectedCalendarDate === cell.isoDate;
                    return (
                      <button
                        key={cell.isoDate}
                        type="button"
                        onClick={() => {
                          setSelectedCalendarDate(cell.isoDate);
                          setDate(cell.isoDate);
                          if (!cell.inCurrentMonth) {
                            const [yStr, mStr] = cell.isoDate.split('-');
                            setCalendarYear(Number.parseInt(yStr, 10));
                            setCalendarMonth(Number.parseInt(mStr, 10));
                          }
                        }}
                        className={`min-h-[62px] p-1.5 text-left flex flex-col justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-teal-50 ring-2 ring-inset ring-teal-700'
                            : hasTrips
                            ? 'bg-emerald-50/70 hover:bg-emerald-100/70'
                            : cell.inCurrentMonth
                            ? 'bg-white hover:bg-slate-50'
                            : 'bg-slate-50/70 text-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 w-full">
                          <span
                            className={`text-[11px] font-semibold tabular-nums ${
                              hasTrips
                                ? 'text-teal-900'
                                : cell.inCurrentMonth
                                ? 'text-slate-700'
                                : 'text-slate-400'
                            }`}
                          >
                            {cell.dayOfMonth}
                          </span>
                          {hasTrips && (
                            <span className="w-2 h-2 rounded-full bg-teal-700 shrink-0" />
                          )}
                        </div>

                        {hasTrips && cell.highestComplexity && (
                          <div className="space-y-0.5 w-full">
                            <span
                              className={`block w-fit px-1.5 py-0.5 rounded-xs border text-[10px] font-bold leading-none ${
                                COMPLEXITY_BADGE_CLASS[cell.highestComplexity]
                              }`}
                            >
                              {cell.highestComplexity}
                            </span>
                            <span className="block text-[10px] text-slate-600 truncate leading-none">
                              {cell.entries.length > 1
                                ? `${cell.entries.length} похода`
                                : `${cell.totalParticipants} чел.`}
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Date Details & Planning Prompt */}
              <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-900">
                    Выбранная дата: {formatRussianJournalDate(selectedCalendarDate)}
                  </span>
                  <span className="text-[11px] text-teal-800 font-medium">
                    Дата подставлена в форму добавления слева
                  </span>
                </div>

                {selectedDayEntries.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    {selectedDayEntries.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2"
                      >
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-900">{item.routeTitle}</p>
                          <p className="text-[11px] text-slate-600">
                            {item.regionName} · {item.participantsCount} чел.
                            {item.notes ? ` · ${item.notes}` : ''}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold ${
                            COMPLEXITY_BADGE_CLASS[item.complexity]
                          }`}
                        >
                          {item.complexity}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-600">
                    На эту дату походы не зафиксированы — окно свободно для планирования будущего
                    маршрута или внесения прошедшего выхода.
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-3">
              {metrics.timelineSeries.length === 0 ? (
                <div className="h-[280px] flex items-center justify-center bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs text-slate-500">
                  Добавьте хотя бы одну запись о походе, чтобы построить график по месяцам.
                </div>
              ) : (
                <div className="h-[290px] w-full bg-slate-50/50 border border-slate-200 rounded-xl p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={metrics.timelineSeries}
                      margin={{ top: 12, right: 16, left: -12, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="periodLabel" tick={{ fontSize: 11, fill: '#475569' }} />
                      <YAxis
                        yAxisId="left"
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: '#0F766E' }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: '#334155' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          borderColor: '#334155',
                          borderRadius: '8px',
                          color: '#F8FAFC',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar
                        yAxisId="left"
                        dataKey="tripsCount"
                        name="Походов (шт.)"
                        fill="#0F766E"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={42}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="participantsCount"
                        name="Участников (чел.)"
                        stroke="#D97706"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#D97706' }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
              <p className="text-[11px] text-slate-500">
                Столбцы отражают число проведённых маршрутов в месяц, линия — суммарное число
                участников.
              </p>
            </div>
          )}

          {activeTab === 'complexity' && (
            <div className="space-y-3">
              <div className="h-[290px] w-full bg-slate-50/50 border border-slate-200 rounded-xl p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={metrics.complexitySeries}
                    margin={{ top: 12, right: 16, left: -12, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#334155' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        color: '#F8FAFC',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar
                      dataKey="tripsCount"
                      name="Походов (шт.)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={42}
                    >
                      {metrics.complexitySeries.map((item) => {
                        const meta = EXPERIENCE_COMPLEXITIES.find(
                          (c) => c.value === item.complexity
                        );
                        return (
                          <Cell
                            key={item.complexity}
                            fill={meta?.barColor ?? '#0F766E'}
                          />
                        );
                      })}
                    </Bar>
                    <Bar
                      dataKey="participantsCount"
                      name="Участников (чел.)"
                      fill="#94A3B8"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={42}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] text-slate-500">
                Распределение маршрутного опыта инструктора по категориям сложности (н/к – 5 КС).
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Filter & Journal History Table */}
      <div className="space-y-3 pt-2 border-t border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-teal-700" aria-hidden="true" />
            <h4 className="text-sm font-bold text-slate-900">
              Записи журнала ({filteredEntries.length}
              {filteredEntries.length !== entries.length ? ` из ${entries.length}` : ''})
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Фильтр по региону ДФО"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value as DfoJournalRegionId | 'all')}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:border-teal-600 focus:outline-none"
            >
              <option value="all">Все регионы ДФО</option>
              {JOURNAL_DFO_REGIONS.map((reg) => (
                <option key={reg.id} value={reg.id}>
                  {reg.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Фильтр по сложности"
              value={complexityFilter}
              onChange={(e) => setComplexityFilter(e.target.value as ExpeditionComplexity | 'all')}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:border-teal-600 focus:outline-none"
            >
              <option value="all">Любая сложность</option>
              {EXPERIENCE_COMPLEXITIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.shortLabel}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs text-slate-600">
            Нет записей, соответствующих выбранному фильтру. Добавьте новый поход через форму выше
            или сбросьте фильтры.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 px-3.5 font-semibold whitespace-nowrap">Дата</th>
                  <th className="py-2.5 px-3.5 font-semibold">Маршрут / заметка</th>
                  <th className="py-2.5 px-3.5 font-semibold whitespace-nowrap">Регион ДФО</th>
                  <th className="py-2.5 px-3.5 font-semibold whitespace-nowrap">Сложность</th>
                  <th className="py-2.5 px-3.5 font-semibold whitespace-nowrap text-right">
                    Участников
                  </th>
                  <th className="py-2.5 px-3.5 font-semibold text-right w-12">
                    <span className="sr-only">Действия</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3.5 font-mono text-slate-700 whitespace-nowrap align-top">
                      {formatRussianJournalDate(entry.date)}
                    </td>
                    <td className="py-3 px-3.5 align-top">
                      <p className="font-semibold text-slate-900">{entry.routeTitle}</p>
                      {entry.notes && (
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                          {entry.notes}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-slate-700 whitespace-nowrap align-top">
                      {entry.regionName}
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap align-top">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold ${
                          COMPLEXITY_BADGE_CLASS[entry.complexity]
                        }`}
                      >
                        {entry.complexity}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 font-semibold text-slate-900 text-right whitespace-nowrap tabular-nums align-top">
                      {entry.participantsCount} чел.
                    </td>
                    <td className="py-3 px-3.5 text-right align-top">
                      <button
                        type="button"
                        onClick={() => handleDeleteEntry(entry.id)}
                        aria-label={`Удалить запись ${entry.routeTitle}`}
                        className="p-1 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
