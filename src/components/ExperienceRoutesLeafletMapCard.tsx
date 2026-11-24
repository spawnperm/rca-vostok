import React, { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';
import {
  Compass,
  Flag,
  Layers,
  MapPin,
  Maximize2,
  Navigation,
  Route,
} from 'lucide-react';
import {
  EXPERIENCE_COMPLEXITIES,
  EXPERIENCE_JOURNAL_UPDATED_EVENT,
  JOURNAL_DFO_REGIONS,
  experienceJournalGateway,
  formatRussianJournalDate,
  readStoredExperienceJournal,
  type DfoJournalRegionId,
  type ExpeditionComplexity,
  type ExperienceLogEntry,
} from '../utils/experienceJournal';
import {
  resolveAllExpeditionEndpoints,
  type ResolvedExpeditionEndpoints,
} from '../utils/experienceMapPoints';
import type { SessionUser } from '../utils/identityApi';
import { tracker } from '../utils/tracker';

interface ExperienceRoutesLeafletMapCardProps {
  user: SessionUser | null;
  onJumpToJournal?: () => void;
}

type BasemapStyle = 'light' | 'topo';

const COMPLEXITY_COLOR: Record<ExpeditionComplexity, string> = {
  'н/к': '#475569',
  '1 КС': '#0D9488',
  '2 КС': '#0F766E',
  '3 КС': '#0369A1',
  '4 КС': '#B45309',
  '5 КС': '#991B1B',
};

function createEndpointDivIcon(
  kind: 'start' | 'finish',
  isSelected: boolean
): L.DivIcon {
  const size = isSelected ? 28 : 22;
  const bg = kind === 'start' ? '#0F766E' : '#B45309';
  const letter = kind === 'start' ? 'S' : 'F';
  const ring = isSelected
    ? kind === 'start'
      ? 'box-shadow: 0 0 0 4px rgba(15, 118, 110, 0.28), 0 2px 6px rgba(15,23,42,0.28);'
      : 'box-shadow: 0 0 0 4px rgba(180, 83, 9, 0.28), 0 2px 6px rgba(15,23,42,0.28);'
    : 'box-shadow: 0 1px 4px rgba(15,23,42,0.28);';

  return L.divIcon({
    className: `rca-journal-${kind}-icon`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:${
      kind === 'start' ? '9999px' : '6px'
    };background:${bg};color:#fff;border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:${
      isSelected ? 11 : 10
    }px;font-weight:700;${ring}">${letter}</div>`,
  });
}

interface CameraCommand {
  bounds: [number, number][];
  nonce: number;
}

const MapViewportController: React.FC<{ command: CameraCommand | null }> = ({ command }) => {
  const map = useMap();

  useEffect(() => {
    if (!command || command.bounds.length === 0) return;
    if (command.bounds.length === 1) {
      map.flyTo(command.bounds[0], 9, { duration: 0.6 });
      return;
    }
    map.flyToBounds(command.bounds, {
      padding: [44, 44],
      maxZoom: 11,
      duration: 0.65,
    });
  }, [map, command]);

  return null;
};

export const ExperienceRoutesLeafletMapCard: React.FC<ExperienceRoutesLeafletMapCardProps> = ({
  user,
  onJumpToJournal,
}) => {
  const userId = user?.id ?? null;
  const preferredRegion = user?.region;

  const [entries, setEntries] = useState<ExperienceLogEntry[]>(() =>
    readStoredExperienceJournal(userId, preferredRegion)
  );
  const [regionFilter, setRegionFilter] = useState<DfoJournalRegionId | 'all'>('all');
  const [complexityFilter, setComplexityFilter] = useState<ExpeditionComplexity | 'all'>('all');
  const [basemap, setBasemap] = useState<BasemapStyle>('light');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cameraCommand, setCameraCommand] = useState<CameraCommand | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEntries(readStoredExperienceJournal(userId, preferredRegion));
    void experienceJournalGateway
      .load(userId, preferredRegion)
      .then((loaded) => {
        if (!cancelled) setEntries(loaded);
      })
      .catch(() => {
        // fallback already hydrated from localStorage
      });

    const onJournalUpdated = () => {
      setEntries(readStoredExperienceJournal(userId, preferredRegion));
    };
    window.addEventListener(EXPERIENCE_JOURNAL_UPDATED_EVENT, onJournalUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener(EXPERIENCE_JOURNAL_UPDATED_EVENT, onJournalUpdated);
    };
  }, [userId, preferredRegion]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (regionFilter !== 'all' && entry.regionId !== regionFilter) return false;
      if (complexityFilter !== 'all' && entry.complexity !== complexityFilter) return false;
      return true;
    });
  }, [entries, regionFilter, complexityFilter]);

  const resolvedItems = useMemo(
    () => resolveAllExpeditionEndpoints(filteredEntries),
    [filteredEntries]
  );

  const selectedItem: ResolvedExpeditionEndpoints | null = useMemo(() => {
    if (resolvedItems.length === 0) return null;
    if (selectedId) {
      const found = resolvedItems.find((item) => item.entry.id === selectedId);
      if (found) return found;
    }
    return resolvedItems[0];
  }, [resolvedItems, selectedId]);

  const allBounds = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [];
    for (const item of resolvedItems) {
      pts.push([item.start.lat, item.start.lon]);
      pts.push([item.finish.lat, item.finish.lon]);
    }
    return pts;
  }, [resolvedItems]);

  // Fit bounds when filtered journal list changes
  useEffect(() => {
    if (allBounds.length === 0) return;
    setCameraCommand({
      bounds: allBounds,
      nonce: Date.now(),
    });
  }, [allBounds]);

  const totalDistanceKm = useMemo(
    () =>
      Math.round(
        filteredEntries.reduce((sum, e) => sum + (e.distanceKm ?? 0), 0) * 10
      ) / 10,
    [filteredEntries]
  );

  const handleSelectExpedition = (item: ResolvedExpeditionEndpoints) => {
    setSelectedId(item.entry.id);
    setCameraCommand({
      bounds: [
        [item.start.lat, item.start.lon],
        [item.finish.lat, item.finish.lon],
      ],
      nonce: Date.now(),
    });
    tracker.trackCustomInteraction(
      `Личный кабинет · Карта маршрутов журнала: ${item.entry.routeTitle}`,
      item.entry.regionId
    );
  };

  const handleFitAll = () => {
    if (allBounds.length === 0) return;
    setCameraCommand({
      bounds: allBounds,
      nonce: Date.now(),
    });
    tracker.trackCustomInteraction('Личный кабинет · Карта журнала: показать все маршруты');
  };

  return (
    <section
      id="experience-routes-leaflet-map"
      aria-labelledby="experience-routes-map-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 scroll-mt-24"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="space-y-1.5 max-w-2xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Картография маршрутов · React-Leaflet</span>
          </p>
          <h3 id="experience-routes-map-heading" className="text-xl font-bold text-slate-900">
            Интерактивная карта точек старта и финиша походов
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Визуализация всех зафиксированных в «Журнале профессионального опыта» маршрутов:
            отдельные маркеры старта (<strong className="font-mono">S</strong>) и финиша (
            <strong className="font-mono">F</strong>), соединительные треки и координаты точек.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Basemap switcher */}
          <div
            role="group"
            aria-label="Подложка карты походов"
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            <button
              type="button"
              onClick={() => setBasemap('light')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                basemap === 'light'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" aria-hidden="true" />
              Карта
            </button>
            <button
              type="button"
              onClick={() => setBasemap('topo')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                basemap === 'topo'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Рельеф
            </button>
          </div>

          <button
            type="button"
            onClick={handleFitAll}
            disabled={allBounds.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Maximize2 className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>Показать все</span>
          </button>
        </div>
      </div>

      {/* Filters + KPI strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Фильтр по региону ДФО"
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value as DfoJournalRegionId | 'all')}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-800 focus:border-teal-600 focus:outline-none"
          >
            <option value="all">Все регионы ДФО ({entries.length})</option>
            {JOURNAL_DFO_REGIONS.map((reg) => (
              <option key={reg.id} value={reg.id}>
                {reg.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Фильтр по сложности маршрута"
            value={complexityFilter}
            onChange={(e) => setComplexityFilter(e.target.value as ExpeditionComplexity | 'all')}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-800 focus:border-teal-600 focus:outline-none"
          >
            <option value="all">Любая сложность</option>
            {EXPERIENCE_COMPLEXITIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.shortLabel}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-mono tabular-nums">
          <span>
            Походов: <strong className="text-slate-900">{resolvedItems.length}</strong>
          </span>
          <span>·</span>
          <span>
            Точек старт/финиш:{' '}
            <strong className="text-teal-800">{resolvedItems.length * 2}</strong>
          </span>
          {totalDistanceKm > 0 && (
            <>
              <span>·</span>
              <span>
                Дистанция: <strong className="text-slate-900">{totalDistanceKm} км</strong>
              </span>
            </>
          )}
        </div>
      </div>

      {resolvedItems.length === 0 ? (
        <div className="py-10 px-4 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl space-y-3">
          <p className="text-sm font-medium text-slate-800">
            Для выбранных фильтров в журнале походов нет маршрутов.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {(regionFilter !== 'all' || complexityFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setRegionFilter('all');
                  setComplexityFilter('all');
                }}
                className="px-3.5 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                Сбросить фильтры
              </button>
            )}
            {onJumpToJournal && (
              <button
                type="button"
                onClick={onJumpToJournal}
                className="px-3.5 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 cursor-pointer"
              >
                Перейти к журналу опыта
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Leaflet Canvas (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div className="relative isolate z-0 h-[400px] sm:h-[460px] w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
              <MapContainer
                center={[48.2, 141.5]}
                zoom={4}
                scrollWheelZoom={true}
                className="w-full h-full"
              >
                <MapViewportController command={cameraCommand} />

                {basemap === 'light' ? (
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                  />
                ) : (
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
                    url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                  />
                )}

                {resolvedItems.map((item) => {
                  const isSelected = selectedItem?.entry.id === item.entry.id;
                  const lineColor = COMPLEXITY_COLOR[item.entry.complexity] ?? '#0F766E';
                  const startLatLng: [number, number] = [item.start.lat, item.start.lon];
                  const finishLatLng: [number, number] = [item.finish.lat, item.finish.lon];

                  return (
                    <React.Fragment key={item.entry.id}>
                      <Polyline
                        positions={[startLatLng, finishLatLng]}
                        pathOptions={{
                          color: lineColor,
                          weight: isSelected ? 4.5 : 2.5,
                          opacity: isSelected ? 0.95 : 0.65,
                          dashArray: isSelected ? undefined : '6 5',
                        }}
                        eventHandlers={{
                          click: () => handleSelectExpedition(item),
                        }}
                      >
                        <Tooltip sticky>
                          <div className="text-xs font-sans">
                            <p className="font-bold text-slate-900">{item.entry.routeTitle}</p>
                            <p className="text-slate-600">
                              {item.entry.complexity} · {formatRussianJournalDate(item.entry.date)}
                              {item.entry.distanceKm ? ` · ${item.entry.distanceKm} км` : ''}
                            </p>
                          </div>
                        </Tooltip>
                      </Polyline>

                      <Marker
                        position={startLatLng}
                        icon={createEndpointDivIcon('start', isSelected)}
                        eventHandlers={{
                          click: () => handleSelectExpedition(item),
                        }}
                      >
                        <Tooltip direction="top" offset={[0, -10]}>
                          <span className="text-xs font-semibold">
                            Старт: {item.entry.routeTitle}
                          </span>
                        </Tooltip>
                        <Popup>
                          <div className="space-y-1 min-w-[200px] font-sans">
                            <p className="text-[11px] font-bold text-teal-800 uppercase">
                              Точка старта (S)
                            </p>
                            <p className="text-xs font-bold text-slate-900 leading-snug">
                              {item.entry.routeTitle}
                            </p>
                            <p className="text-[11px] text-slate-600">{item.start.label}</p>
                            <p className="text-[11px] font-mono text-slate-500">
                              {item.start.lat.toFixed(4)}, {item.start.lon.toFixed(4)}
                            </p>
                            <p className="text-[11px] text-slate-700 pt-1 border-t border-slate-200">
                              {formatRussianJournalDate(item.entry.date)} · {item.entry.complexity}
                            </p>
                          </div>
                        </Popup>
                      </Marker>

                      <Marker
                        position={finishLatLng}
                        icon={createEndpointDivIcon('finish', isSelected)}
                        eventHandlers={{
                          click: () => handleSelectExpedition(item),
                        }}
                      >
                        <Tooltip direction="top" offset={[0, -10]}>
                          <span className="text-xs font-semibold">
                            Финиш: {item.entry.routeTitle}
                          </span>
                        </Tooltip>
                        <Popup>
                          <div className="space-y-1 min-w-[200px] font-sans">
                            <p className="text-[11px] font-bold text-amber-800 uppercase">
                              Точка финиша (F)
                            </p>
                            <p className="text-xs font-bold text-slate-900 leading-snug">
                              {item.entry.routeTitle}
                            </p>
                            <p className="text-[11px] text-slate-600">{item.finish.label}</p>
                            <p className="text-[11px] font-mono text-slate-500">
                              {item.finish.lat.toFixed(4)}, {item.finish.lon.toFixed(4)}
                            </p>
                            <p className="text-[11px] text-slate-700 pt-1 border-t border-slate-200">
                              {item.entry.regionName}
                              {item.entry.distanceKm ? ` · ${item.entry.distanceKm} км` : ''}
                            </p>
                          </div>
                        </Popup>
                      </Marker>
                    </React.Fragment>
                  );
                })}
              </MapContainer>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 px-1">
              <div className="flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-teal-700 text-white font-mono text-[10px] font-bold inline-flex items-center justify-center">
                    S
                  </span>
                  <span>Точка старта</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-amber-700 text-white font-mono text-[10px] font-bold inline-flex items-center justify-center">
                    F
                  </span>
                  <span>Точка финиша</span>
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                Клик по маркеру или строке справа фокусирует карту на походе
              </span>
            </div>
          </div>

          {/* Selected Expedition Details & Directory (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4">
            {selectedItem && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-teal-800 inline-flex items-center gap-1.5">
                      <Route className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {selectedItem.entry.regionName} ·{' '}
                        {formatRussianJournalDate(selectedItem.entry.date)}
                      </span>
                    </p>
                    <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                      {selectedItem.entry.routeTitle}
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 text-[11px] font-mono font-bold bg-white border border-slate-200 rounded text-slate-900 shrink-0">
                    {selectedItem.entry.complexity}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="bg-white border border-teal-200 rounded-lg p-3 space-y-1">
                    <p className="text-[11px] font-semibold text-teal-800 inline-flex items-center gap-1">
                      <Navigation className="w-3 h-3" aria-hidden="true" />
                      <span>Старт (S)</span>
                    </p>
                    <p className="font-medium text-slate-900 leading-snug">
                      {selectedItem.start.label}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                      {selectedItem.start.lat.toFixed(4)}, {selectedItem.start.lon.toFixed(4)}
                    </p>
                  </div>

                  <div className="bg-white border border-amber-200 rounded-lg p-3 space-y-1">
                    <p className="text-[11px] font-semibold text-amber-800 inline-flex items-center gap-1">
                      <Flag className="w-3 h-3" aria-hidden="true" />
                      <span>Финиш (F)</span>
                    </p>
                    <p className="font-medium text-slate-900 leading-snug">
                      {selectedItem.finish.label}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                      {selectedItem.finish.lat.toFixed(4)}, {selectedItem.finish.lon.toFixed(4)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pt-1 border-t border-slate-200">
                  <span>
                    Группа: <strong className="text-slate-900">{selectedItem.entry.participantsCount} чел.</strong>
                    {selectedItem.entry.distanceKm ? (
                      <>
                        {' '}
                        · Дистанция:{' '}
                        <strong className="text-slate-900">{selectedItem.entry.distanceKm} км</strong>
                      </>
                    ) : null}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {selectedItem.coordinateSource === 'explicit'
                      ? 'Точные координаты маршрута'
                      : selectedItem.coordinateSource === 'landmark'
                        ? 'Привязка к ориентиру ДФО'
                        : 'Модель региона ДФО'}
                  </span>
                </div>
              </div>
            )}

            {/* List of all expeditions */}
            <div className="border border-slate-200 rounded-xl overflow-hidden flex-1 flex flex-col">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 flex items-center justify-between">
                <span>Походы из журнала ({resolvedItems.length})</span>
                <span className="text-[11px] font-mono text-slate-500">Старт → Финиш</span>
              </div>
              <div className="divide-y divide-slate-200 max-h-[235px] overflow-y-auto">
                {resolvedItems.map((item) => {
                  const isSelected = selectedItem?.entry.id === item.entry.id;
                  return (
                    <button
                      key={item.entry.id}
                      type="button"
                      onClick={() => handleSelectExpedition(item)}
                      className={`w-full px-4 py-2.5 text-left text-xs flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-teal-50/80 text-slate-900 font-semibold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="truncate text-slate-900 inline-flex items-center gap-1.5 w-full">
                          <MapPin className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
                          <span className="truncate">{item.entry.routeTitle}</span>
                        </p>
                        <p className="text-[11px] text-slate-500 truncate pl-5">
                          {item.entry.regionName} · {formatRussianJournalDate(item.entry.date)}
                        </p>
                      </div>
                      <span className="font-mono text-[11px] text-slate-600 shrink-0 tabular-nums">
                        {item.entry.complexity}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
