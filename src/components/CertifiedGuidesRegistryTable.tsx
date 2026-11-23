import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, CalendarClock, Filter, RotateCcw, Search, ShieldCheck } from 'lucide-react';
import {
  GUIDE_TRACK_LABELS,
  INITIAL_DFO_CERTIFIED_GUIDES,
  type CertifiedGuideRecord,
  type GuideTrack,
} from '../domain/certification/GuideLeaderboard.ts';
import {
  filterCertifiedGuidesRegistry,
  type CertificateValidityFilter,
  type RegistrySortField,
} from '../utils/certifiedGuidesRegistry';
import { tracker } from '../utils/tracker';

const VALIDITY_FILTER_OPTIONS: readonly {
  id: CertificateValidityFilter;
  label: string;
}[] = [
  { id: 'all', label: 'Все сроки действия' },
  { id: 'expiring_12m', label: 'Истекает в ближайшие 12 мес.' },
  { id: 'mid_term_2027_2029', label: 'Действует до 2027–2029 гг.' },
  { id: 'long_term_2030_plus', label: 'Действует до 2030–2031 гг.' },
];

export const CertifiedGuidesRegistryTable: React.FC<{
  initialRegionFilter?: string;
}> = ({ initialRegionFilter }) => {
  const [records, setRecords] = useState<CertifiedGuideRecord[]>([
    ...INITIAL_DFO_CERTIFIED_GUIDES,
  ]);
  const [loading, setLoading] = useState<boolean>(true);
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [trackFilter, setTrackFilter] = useState<'all' | GuideTrack>('all');
  const [validityFilter, setValidityFilter] = useState<CertificateValidityFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<RegistrySortField>('validUntil');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (initialRegionFilter) {
      setRegionFilter(initialRegionFilter);
    }
  }, [initialRegionFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch('/api/guides/leaderboard?limit=50', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { guides?: CertifiedGuideRecord[] };
        if (!cancelled && Array.isArray(data.guides) && data.guides.length > 0) {
          setRecords(data.guides);
        }
      })
      .catch(() => {
        // Fallback to calibrated DFO baseline already initialized in state
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const registry = useMemo(
    () =>
      filterCertifiedGuidesRegistry(records, {
        region: regionFilter,
        track: trackFilter,
        validity: validityFilter,
        search: searchQuery,
        sortBy,
        sortDir,
      }),
    [records, regionFilter, trackFilter, validityFilter, searchQuery, sortBy, sortDir]
  );

  const hasActiveFilters =
    regionFilter !== 'all' ||
    trackFilter !== 'all' ||
    validityFilter !== 'all' ||
    searchQuery.trim().length > 0;

  const resetFilters = () => {
    setRegionFilter('all');
    setTrackFilter('all');
    setValidityFilter('all');
    setSearchQuery('');
    tracker.trackCustomInteraction('Реестр проводников: сброс фильтров');
  };

  const toggleSort = (field: RegistrySortField) => {
    if (sortBy === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir(field === 'routes' || field === 'experience' ? 'desc' : 'asc');
    }
  };

  return (
    <section
      aria-labelledby="certified-guides-registry-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1.5 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-teal-700">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Реестр действующих аттестованных инструкторов-проводников ДФО</span>
          </div>
          <h2 id="certified-guides-registry-heading" className="text-xl font-bold text-slate-900">
            Реестр аттестованных проводников и контроль срока удостоверений
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Интерактивный реестр с 5-летним циклом действия аттестации (ПП РФ № 1003 / № 1893).
            Фильтруйте записи по субъектам ДФО, специализации маршрутов и сроку окончания действия
            удостоверения.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 shrink-0">
          <div>
            <span className="block text-[11px] text-slate-500">В выборке</span>
            <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
              {registry.rows.length} / {registry.totalActive} чел.
            </span>
          </div>
          <div className="pl-4 border-l border-slate-200">
            <span className="block text-[11px] text-slate-500">Продление ≤ 12 мес.</span>
            <span className="font-mono text-base font-bold text-amber-700 tabular-nums">
              {registry.expiringCount} уд.
            </span>
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3 items-end">
        <div className="xl:col-span-3 space-y-1">
          <label
            htmlFor="registry-filter-region"
            className="text-[11px] font-semibold text-slate-600 inline-flex items-center gap-1"
          >
            <Filter className="w-3 h-3 text-teal-700" aria-hidden="true" />
            <span>Регион ДФО</span>
          </label>
          <select
            id="registry-filter-region"
            value={regionFilter}
            onChange={(e) => {
              setRegionFilter(e.target.value);
              tracker.trackCustomInteraction('Реестр проводников: регион', e.target.value);
            }}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:border-teal-700 focus:outline-none"
          >
            <option value="all">Все субъекты ДФО ({registry.availableRegions.length})</option>
            {registry.availableRegions.map((reg) => (
              <option key={reg} value={reg}>
                {reg}
              </option>
            ))}
          </select>
        </div>

        <div className="xl:col-span-3 space-y-1">
          <label
            htmlFor="registry-filter-track"
            className="text-[11px] font-semibold text-slate-600 block"
          >
            Специализация
          </label>
          <select
            id="registry-filter-track"
            value={trackFilter}
            onChange={(e) => {
              const val = e.target.value as 'all' | GuideTrack;
              setTrackFilter(val);
              tracker.trackCustomInteraction('Реестр проводников: специализация', val);
            }}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:border-teal-700 focus:outline-none"
          >
            <option value="all">Все специализации</option>
            {registry.availableTracks.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.label} ({tr.count})
              </option>
            ))}
          </select>
        </div>

        <div className="xl:col-span-3 space-y-1">
          <label
            htmlFor="registry-filter-validity"
            className="text-[11px] font-semibold text-slate-600 inline-flex items-center gap-1"
          >
            <CalendarClock className="w-3 h-3 text-teal-700" aria-hidden="true" />
            <span>Срок действия удостоверения</span>
          </label>
          <select
            id="registry-filter-validity"
            value={validityFilter}
            onChange={(e) => {
              const val = e.target.value as CertificateValidityFilter;
              setValidityFilter(val);
              tracker.trackCustomInteraction('Реестр проводников: срок действия', val);
            }}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:border-teal-700 focus:outline-none"
          >
            {VALIDITY_FILTER_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="xl:col-span-3 flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <label
              htmlFor="registry-search-input"
              className="text-[11px] font-semibold text-slate-600 block"
            >
              Поиск по ФИО или № реестра
            </label>
            <div className="relative">
              <Search
                className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="registry-search-input"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ФИО, МЭР-ДФО, турклуб…"
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:border-teal-700 focus:outline-none"
              />
            </div>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              title="Сбросить фильтры"
              className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Сбросить</span>
            </button>
          )}
        </div>
      </div>

      {/* Registry Table */}
      {loading && records.length === 0 ? (
        <div role="status" className="space-y-2 py-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : registry.rows.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center space-y-3 bg-slate-50/70">
          <p className="text-sm font-semibold text-slate-900">
            По выбранным фильтрам действующих проводников не найдено
          </p>
          <p className="text-xs text-slate-600">
            Измените параметры региона ДФО, специализации или срока действия удостоверения.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Показать весь реестр
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-3 px-3.5 font-semibold whitespace-nowrap">№ реестра</th>
                <th className="py-3 px-3.5 font-semibold">
                  <button
                    type="button"
                    onClick={() => toggleSort('fullName')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                  >
                    <span>Инструктор и организация</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" aria-hidden="true" />
                  </button>
                </th>
                <th className="py-3 px-3.5 font-semibold">
                  <button
                    type="button"
                    onClick={() => toggleSort('region')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                  >
                    <span>Регион ДФО</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" aria-hidden="true" />
                  </button>
                </th>
                <th className="py-3 px-3.5 font-semibold whitespace-nowrap">Специализация</th>
                <th className="py-3 px-3.5 font-semibold text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort('routes')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer ml-auto"
                  >
                    <span>Маршруты / КС</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" aria-hidden="true" />
                  </button>
                </th>
                <th className="py-3 px-3.5 font-semibold text-right whitespace-nowrap">
                  Аттестован
                </th>
                <th className="py-3 px-3.5 font-semibold text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort('validUntil')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer ml-auto"
                  >
                    <span>Действительно до</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" aria-hidden="true" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {registry.rows.map((row) => {
                const isExpiring = row.validityBand === 'expiring_12m';
                const isMidTerm = row.validityBand === 'mid_term_2027_2029';
                return (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3.5 font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {row.registryNumber}
                    </td>
                    <td className="py-2.5 px-3.5 min-w-[200px]">
                      <p className="font-semibold text-slate-900">{row.fullName}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{row.organisation}</p>
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-700 whitespace-nowrap">
                      {row.region}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-700 whitespace-nowrap">
                      {GUIDE_TRACK_LABELS[row.track] ?? row.trackLabel}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                      <span className="font-semibold">{row.certifiedRoutesCount} маршр.</span>
                      <span className="text-slate-400 mx-1">/</span>
                      <span>{row.maxComplexity}</span>
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {row.attestedAtFormatted}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono tabular-nums whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          isExpiring
                            ? 'text-amber-700'
                            : isMidTerm
                            ? 'text-sky-800'
                            : 'text-teal-800'
                        }`}
                      >
                        {row.validUntilFormatted}
                      </span>
                      <span className="block text-[10px] font-sans text-slate-500">
                        {row.validityStatusLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
