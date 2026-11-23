import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  Compass,
  Database,
  RefreshCw,
  Search,
  Trophy,
  X,
} from 'lucide-react';
import type {
  GuideLeaderboardSort,
  GuideLeaderboardSummary,
  GuideTrack,
  RankedGuideEntry,
} from '../domain/certification/GuideLeaderboard';
import { tracker } from '../utils/tracker';

interface LeaderboardApiResponse {
  guides: RankedGuideEntry[];
  summary: GuideLeaderboardSummary;
  availableRegions: string[];
  sortBy: GuideLeaderboardSort;
  sourceAdapter: string;
  generatedAt: string;
}

interface DfoGuidesLeaderboardWidgetProps {
  currentUserId?: string | null;
  currentUserRegion?: string;
}

const SORT_OPTIONS: readonly { id: GuideLeaderboardSort; label: string }[] = [
  { id: 'routes', label: 'По маршрутам' },
  { id: 'experience', label: 'По стажу' },
  { id: 'composite', label: 'Комплексный индекс' },
];

const TRACK_FILTERS: readonly { id: 'all' | GuideTrack; label: string }[] = [
  { id: 'all', label: 'Все треки' },
  { id: 'hiking', label: 'Пешеходный' },
  { id: 'water', label: 'Водный' },
  { id: 'expedition', label: 'Экспедиционный / ООПТ' },
  { id: 'ski', label: 'Горно-таёжный' },
];

export const DfoGuidesLeaderboardWidget: React.FC<DfoGuidesLeaderboardWidgetProps> = ({
  currentUserId,
}) => {
  const [sortBy, setSortBy] = useState<GuideLeaderboardSort>('routes');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [trackFilter, setTrackFilter] = useState<'all' | GuideTrack>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [data, setData] = useState<LeaderboardApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('sortBy', sortBy);
      if (regionFilter !== 'all') params.set('region', regionFilter);
      if (trackFilter !== 'all') params.set('track', trackFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      params.set('limit', '15');

      const res = await fetch(`/api/guides/leaderboard?${params.toString()}`, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new Error('Не удалось загрузить рейтинг проводников ДФО.');
      }
      const payload = (await res.json()) as LeaderboardApiResponse;
      setData(payload);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Ошибка загрузки данных рейтинга из базы.'
      );
    } finally {
      setLoading(false);
    }
  }, [sortBy, regionFilter, trackFilter, searchQuery]);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  const resetFilters = () => {
    setRegionFilter('all');
    setTrackFilter('all');
    setSearchQuery('');
  };

  const guides = data?.guides ?? [];
  const summary = data?.summary;
  const topThree = guides.slice(0, 3);
  const hasFiltersActive =
    regionFilter !== 'all' || trackFilter !== 'all' || searchQuery.trim().length > 0;

  return (
    <section
      aria-labelledby="dfo-guides-leaderboard-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
    >
      {/* Header & Sort Controls */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5 font-medium text-teal-700">
              <Database className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Данные реестра из базы платформы</span>
            </span>
            {data?.sourceAdapter && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono">
                  {data.sourceAdapter === 'postgresql' ? 'PostgreSQL' : 'Реестр БД'}
                </span>
              </>
            )}
          </div>
          <h4
            id="dfo-guides-leaderboard-heading"
            className="text-base sm:text-lg font-bold text-slate-900 text-balance"
          >
            Рейтинг активных проводников ДФО
          </h4>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Лидеры дальневосточного реестра по количеству аттестованных маршрутов (ПП № 760) и
            подтверждённому стажу руководства группами.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            role="group"
            aria-label="Критерий ранжирования проводников"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {SORT_OPTIONS.map((opt) => {
              const active = sortBy === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setSortBy(opt.id);
                    tracker.trackCustomInteraction(
                      'Рейтинг проводников ДФО: сортировка',
                      opt.label
                    );
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => void loadLeaderboard()}
            disabled={loading}
            aria-label="Обновить рейтинг из базы"
            className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-700' : ''}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={regionFilter}
            aria-label="Фильтр по субъекту ДФО"
            onChange={(e) => {
              setRegionFilter(e.target.value);
              tracker.trackCustomInteraction('Рейтинг проводников ДФО: регион', e.target.value);
            }}
            className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-slate-50 text-slate-800 focus:outline-none focus:border-teal-700 focus:bg-white cursor-pointer"
          >
            <option value="all">Все регионы ДФО</option>
            {(data?.availableRegions ?? []).map((reg) => (
              <option key={reg} value={reg}>
                {reg}
              </option>
            ))}
          </select>

          <div
            role="group"
            aria-label="Фильтр по специализации маршрута"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {TRACK_FILTERS.map((tf) => {
              const active = trackFilter === tf.id;
              return (
                <button
                  key={tf.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setTrackFilter(tf.id);
                    tracker.trackCustomInteraction('Рейтинг проводников ДФО: трек', tf.label);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tf.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative w-full md:w-64">
          <Search
            className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по ФИО, турклубу, №..."
            aria-label="Поиск проводника в рейтинге ДФО"
            className="w-full pl-8 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:bg-white transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Очистить поиск проводников"
              className="p-0.5 text-slate-400 hover:text-slate-700 absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* KPI Summary Strip */}
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3.5 border-y border-slate-200">
        <div>
          <dt className="text-xs text-slate-500">Активных в базе</dt>
          <dd className="text-lg font-bold font-mono text-slate-900 tabular-nums mt-0.5">
            {summary ? `${summary.filteredCount} / ${summary.totalActiveGuides}` : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Аттестованных маршрутов</dt>
          <dd className="text-lg font-bold font-mono text-teal-800 tabular-nums mt-0.5">
            {summary ? summary.totalCertifiedRoutes : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Средний стаж выборки</dt>
          <dd className="text-lg font-bold font-mono text-slate-900 tabular-nums mt-0.5">
            {summary ? `${summary.avgExperienceYears} г.` : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Среднее маршрутов</dt>
          <dd className="text-lg font-bold font-mono text-slate-900 tabular-nums mt-0.5">
            {summary ? summary.avgRoutesPerGuide : '—'}
          </dd>
        </div>
      </dl>

      {/* Loading / Error / Empty / Populated States */}
      {loading && !data ? (
        <div className="space-y-2.5" role="status" aria-label="Загрузка рейтинга проводников">
          {[1, 2, 3, 4, 5].map((idx) => (
            <div
              key={idx}
              className="h-11 bg-slate-50 border border-slate-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadLeaderboard()}
            className="px-3 py-1.5 bg-white border border-rose-300 rounded-md font-semibold hover:bg-rose-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Повторить
          </button>
        </div>
      ) : guides.length === 0 ? (
        <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg text-center space-y-2.5">
          <p className="text-sm font-medium text-slate-800">
            По заданным параметрам фильтра проводники в базе не найдены.
          </p>
          <p className="text-xs text-slate-500">
            Сбросьте регион, направление или поисковый запрос, чтобы увидеть полный рейтинг ДФО.
          </p>
          {hasFiltersActive && (
            <button
              type="button"
              onClick={resetFilters}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Top-3 Podium Cards */}
          {topThree.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {topThree.map((leader) => {
                const isFirst = leader.rank === 1;
                return (
                  <div
                    key={leader.id}
                    className={`rounded-lg border p-4 space-y-2.5 ${
                      isFirst
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-slate-50/70 border-slate-200 text-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span
                        className={`font-mono font-bold tabular-nums inline-flex items-center gap-1.5 ${
                          isFirst ? 'text-teal-300' : 'text-teal-800'
                        }`}
                      >
                        {isFirst ? (
                          <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : (
                          <Award className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                        <span>#{leader.rank} в ДФО</span>
                      </span>
                      <span
                        className={`font-mono tabular-nums text-[11px] ${
                          isFirst ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {leader.registryNumber}
                      </span>
                    </div>

                    <div>
                      <p className="text-sm font-bold leading-snug truncate">{leader.fullName}</p>
                      <p
                        className={`text-[11px] truncate mt-0.5 ${
                          isFirst ? 'text-slate-300' : 'text-slate-600'
                        }`}
                      >
                        {leader.region} · {leader.organisation}
                      </p>
                    </div>

                    <div
                      className={`pt-2 border-t flex items-baseline justify-between gap-2 text-xs ${
                        isFirst ? 'border-slate-700/80' : 'border-slate-200'
                      }`}
                    >
                      <span className="font-mono font-semibold tabular-nums">
                        {leader.certifiedRoutesCount} маршр.
                      </span>
                      <span
                        className={`font-mono tabular-nums ${
                          isFirst ? 'text-slate-300' : 'text-slate-600'
                        }`}
                      >
                        стаж {leader.experienceYears} л. · {leader.maxComplexity}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* High-Density Leaderboard Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 pl-4 pr-2 w-12">#</th>
                  <th className="py-2.5 px-3">Проводник и организация</th>
                  <th className="py-2.5 px-3">Субъект ДФО и трек</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Аттест. маршруты</th>
                  <th className="py-2.5 pl-3 pr-4 text-right whitespace-nowrap">Стаж</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {guides.map((guide) => {
                  const isOwnRecord = Boolean(currentUserId && guide.userId === currentUserId);
                  const barPct =
                    sortBy === 'experience' ? guide.pctOfTopExperience : guide.pctOfTopRoutes;

                  return (
                    <tr
                      key={guide.id}
                      className={`transition-colors ${
                        isOwnRecord ? 'bg-teal-50/70' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-2.5 pl-4 pr-2 font-mono font-bold text-slate-700 tabular-nums">
                        {String(guide.rank).padStart(2, '0')}
                      </td>

                      <td className="py-2.5 px-3 min-w-[210px]">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">
                            {guide.fullName}
                            {isOwnRecord ? ' (Вы)' : ''}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          <span className="font-mono tabular-nums">{guide.registryNumber}</span>
                          <span aria-hidden="true"> · </span>
                          <span>{guide.organisation}</span>
                        </p>
                      </td>

                      <td className="py-2.5 px-3 min-w-[190px]">
                        <p className="font-medium text-slate-800">{guide.region}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          <span>{guide.trackLabel}</span>
                          <span aria-hidden="true"> · </span>
                          <span className="font-mono tabular-nums text-slate-700">
                            до {guide.maxComplexity}
                          </span>
                        </p>
                      </td>

                      <td className="py-2.5 px-3 text-right min-w-[140px]">
                        <div className="inline-flex flex-col items-end gap-1 w-full max-w-[130px]">
                          <span className="font-mono font-bold text-slate-900 tabular-nums">
                            {guide.certifiedRoutesCount} шт.
                          </span>
                          <div
                            className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"
                            aria-hidden="true"
                          >
                            <div
                              className="h-full bg-teal-700 rounded-full"
                              style={{ width: `${Math.max(8, barPct)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 pl-3 pr-4 text-right whitespace-nowrap">
                        <span className="font-mono font-semibold text-slate-900 tabular-nums">
                          {guide.experienceYears} л.
                        </span>
                        <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                          индекс {guide.compositeScore.toFixed(1)}
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {summary?.topRegion && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pt-1">
              <span className="inline-flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
                <span>
                  Ведущий регион выборки: <strong className="text-slate-800">{summary.topRegion}</strong>
                </span>
              </span>
              <span className="font-mono tabular-nums">
                Обновляется из серверной БД в реальном времени
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
