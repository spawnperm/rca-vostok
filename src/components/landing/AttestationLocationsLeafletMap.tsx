import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import {
  CalendarDays,
  CheckCircle2,
  Compass,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Layers,
  MapPin,
  Maximize2,
  RotateCcw,
  Search,
  Users,
} from 'lucide-react';
import {
  ATTESTATION_KIND_COLORS,
  ATTESTATION_KIND_FILTERS,
  DFO_ATTESTATION_LOCATIONS,
  buildAttestationGoogleMapsUrl,
  buildAttestationYandexMapsUrl,
  filterAttestationLocations,
  getDfoRegionFilterOptions,
  type AttestationLocationFilterId,
  type DfoAttestationLocation,
} from '../../utils/attestationLocationsMap';
import {
  exportAttestationLocationsCsv,
  exportAttestationLocationsPdf,
} from '../../utils/attestationLocationsExport';
import { tracker } from '../../utils/tracker';

type LeafletBasemapId = 'voyager' | 'osm' | 'topo';

interface BasemapConfig {
  id: LeafletBasemapId;
  label: string;
  url: string;
  attribution: string;
  maxZoom: number;
}

const LEAFLET_BASEMAPS: Record<LeafletBasemapId, BasemapConfig> = {
  voyager: {
    id: 'voyager',
    label: 'Светлая',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 18,
  },
  osm: {
    id: 'osm',
    label: 'Схема OSM',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 18,
  },
  topo: {
    id: 'topo',
    label: 'Топография',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors, SRTM &copy; OpenTopoMap',
    maxZoom: 17,
  },
};

const DFO_OVERVIEW_BOUNDS: L.LatLngBoundsExpression = [
  [42.2, 126.5],
  [63.0, 159.5],
];

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function createVenueDivIcon(
  location: DfoAttestationLocation,
  isSelected: boolean,
  isHovered: boolean
): L.DivIcon {
  const accentColor = ATTESTATION_KIND_COLORS[location.kind];
  const bg = isSelected ? '#0F172A' : '#FFFFFF';
  const text = isSelected ? '#FFFFFF' : '#0F172A';
  const border = isSelected ? '#0F766E' : isHovered ? '#0F766E' : '#CBD5E1';
  const dotColor = isSelected ? '#5EEAD4' : accentColor;
  const ringShadow = isSelected
    ? '0 0 0 3px rgba(15, 118, 110, 0.28), 0 8px 18px -4px rgba(15, 23, 42, 0.38)'
    : '0 4px 10px -2px rgba(15, 23, 42, 0.18)';
  const scale = isSelected ? 'scale(1.06)' : isHovered ? 'scale(1.03)' : 'scale(1)';

  const html = `
    <div style="transform: translate(-50%, -100%) ${scale}; transform-origin: bottom center; display: flex; flex-direction: column; align-items: center; pointer-events: auto; transition: transform 150ms ease;">
      <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 9px; border-radius: 8px; background: ${bg}; color: ${text}; border: 1.5px solid ${border}; box-shadow: ${ringShadow}; white-space: nowrap; font-family: 'Plus Jakarta Sans', system-ui, sans-serif;">
        <span style="width: 8px; height: 8px; border-radius: 9999px; background: ${dotColor}; flex-shrink: 0;"></span>
        <span style="font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 700; opacity: 0.9;">${escapeHtml(location.badgeCode)}</span>
        <span style="font-size: 11px; font-weight: 600; max-width: 145px; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(location.shortName)}</span>
      </div>
      <div style="width: 9px; height: 9px; transform: rotate(45deg); margin-top: -5px; background: ${bg}; border-right: 1.5px solid ${border}; border-bottom: 1.5px solid ${border};"></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'bg-transparent border-0',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -38],
  });
}

interface LeafletCameraControllerProps {
  filteredLocations: readonly DfoAttestationLocation[];
  selectedLocation: DfoAttestationLocation;
  filterKey: string;
  fitOverviewNonce: number;
  focusSelectionNonce: number;
}

const LeafletCameraController: React.FC<LeafletCameraControllerProps> = ({
  filteredLocations,
  selectedLocation,
  filterKey,
  fitOverviewNonce,
  focusSelectionNonce,
}) => {
  const map = useMap();
  const prevFilterKeyRef = useRef<string>(filterKey);
  const prevFitNonceRef = useRef<number>(fitOverviewNonce);
  const prevSelectionNonceRef = useRef<number>(focusSelectionNonce);
  const initialFittedRef = useRef<boolean>(false);

  // Initial fit on mount to show the full DFO coverage
  useEffect(() => {
    if (initialFittedRef.current) return;
    initialFittedRef.current = true;
    if (filteredLocations.length > 1) {
      const bounds = L.latLngBounds(
        filteredLocations.map((loc) => [loc.coordinates.lat, loc.coordinates.lng] as [number, number])
      );
      map.fitBounds(bounds, { padding: [42, 42], maxZoom: 6, animate: false });
    } else {
      map.fitBounds(DFO_OVERVIEW_BOUNDS, { padding: [32, 32], animate: false });
    }
  }, [map, filteredLocations]);

  // Refit map when region/kind/search filter changes or "Обзор всего ДФО" is clicked
  useEffect(() => {
    const filterChanged = prevFilterKeyRef.current !== filterKey;
    const fitRequested = prevFitNonceRef.current !== fitOverviewNonce;
    prevFilterKeyRef.current = filterKey;
    prevFitNonceRef.current = fitOverviewNonce;

    if (!filterChanged && !fitRequested) return;

    if (filteredLocations.length === 0) {
      map.fitBounds(DFO_OVERVIEW_BOUNDS, { padding: [32, 32], animate: true });
      return;
    }

    if (filteredLocations.length === 1) {
      const only = filteredLocations[0];
      const zoom = only.kind === 'headquarters' ? 11 : only.kind === 'field_polygon' ? 9 : 7;
      map.flyTo([only.coordinates.lat, only.coordinates.lng], zoom, { duration: 0.65 });
      return;
    }

    const bounds = L.latLngBounds(
      filteredLocations.map((loc) => [loc.coordinates.lat, loc.coordinates.lng] as [number, number])
    );
    map.fitBounds(bounds, {
      padding: [48, 48],
      maxZoom: filterKey.startsWith('all|') ? 6 : 9,
      animate: true,
    });
  }, [map, filteredLocations, filterKey, fitOverviewNonce]);

  // Fly to explicitly clicked marker / venue directory row
  useEffect(() => {
    if (prevSelectionNonceRef.current === focusSelectionNonce) return;
    prevSelectionNonceRef.current = focusSelectionNonce;

    const targetZoom =
      selectedLocation.kind === 'headquarters'
        ? 12
        : selectedLocation.kind === 'field_polygon'
          ? 9
          : 7;
    map.flyTo([selectedLocation.coordinates.lat, selectedLocation.coordinates.lng], targetZoom, {
      duration: 0.55,
    });
  }, [map, selectedLocation, focusSelectionNonce]);

  return null;
};

export const AttestationLocationsLeafletMap: React.FC = () => {
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [kindFilter, setKindFilter] = useState<AttestationLocationFilterId>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [basemapId, setBasemapId] = useState<LeafletBasemapId>('voyager');
  const [selectedLocationId, setSelectedLocationId] = useState<string>(
    DFO_ATTESTATION_LOCATIONS[0].id
  );
  const [hoveredLocationId, setHoveredLocationId] = useState<string | null>(null);
  const [fitOverviewNonce, setFitOverviewNonce] = useState<number>(0);
  const [focusSelectionNonce, setFocusSelectionNonce] = useState<number>(0);
  const [tileErrorNotice, setTileErrorNotice] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);

  const markerRefs = useRef<Record<string, L.Marker | null>>({});

  const regionOptions = useMemo(
    () => getDfoRegionFilterOptions(DFO_ATTESTATION_LOCATIONS),
    []
  );

  const filteredLocations = useMemo(
    () => filterAttestationLocations(DFO_ATTESTATION_LOCATIONS, kindFilter, searchQuery, regionFilter),
    [kindFilter, searchQuery, regionFilter]
  );

  const selectedLocation = useMemo(
    () =>
      filteredLocations.find((loc) => loc.id === selectedLocationId) ??
      filteredLocations[0] ??
      DFO_ATTESTATION_LOCATIONS[0],
    [filteredLocations, selectedLocationId]
  );

  const activeBasemap = LEAFLET_BASEMAPS[basemapId];
  const filterKey = `${regionFilter}|${kindFilter}|${searchQuery.trim()}`;
  const hasActiveFilters =
    regionFilter !== 'all' || kindFilter !== 'all' || searchQuery.trim().length > 0;

  const handleSelectLocation = useCallback((location: DfoAttestationLocation, openPopup = true) => {
    setSelectedLocationId(location.id);
    setFocusSelectionNonce((n) => n + 1);
    if (openPopup) {
      const marker = markerRefs.current[location.id];
      if (marker) {
        marker.openPopup();
      }
    }
    tracker.trackCustomInteraction(
      `Карта площадок ДФО (Leaflet): ${location.shortName}`,
      location.regionName
    );
  }, []);

  const handleSelectRegion = (regionId: string) => {
    setRegionFilter(regionId);
    const matching = filterAttestationLocations(
      DFO_ATTESTATION_LOCATIONS,
      kindFilter,
      searchQuery,
      regionId
    );
    if (matching.length > 0 && !matching.some((loc) => loc.id === selectedLocationId)) {
      setSelectedLocationId(matching[0].id);
    }
    tracker.trackCustomInteraction(`Карта площадок ДФО · регион: ${regionId}`, 'leaflet-region');
  };

  const handleResetFilters = () => {
    setRegionFilter('all');
    setKindFilter('all');
    setSearchQuery('');
    setFitOverviewNonce((n) => n + 1);
  };

  const handleFitAllDfo = () => {
    setFitOverviewNonce((n) => n + 1);
    tracker.trackCustomInteraction('Карта площадок ДФО (Leaflet): обзор всего ДФО');
  };

  const handleExportCsv = () => {
    if (filteredLocations.length === 0) return;
    try {
      const fileName = exportAttestationLocationsCsv({
        locations: filteredLocations,
        regionFilter,
        kindFilter,
        searchQuery,
      });
      setExportNotice({
        kind: 'success',
        text: `Реестр площадок для комиссий выгружен в CSV: ${fileName} (строк: ${filteredLocations.length}).`,
      });
      tracker.trackCustomInteraction(
        `Экспорт реестра площадок ДФО (CSV): ${filteredLocations.length} шт.`,
        regionFilter
      );
    } catch {
      setExportNotice({
        kind: 'error',
        text: 'Не удалось сформировать CSV-файл. Повторите попытку.',
      });
    }
  };

  const handleExportPdf = async () => {
    if (filteredLocations.length === 0 || isExportingPdf) return;
    setIsExportingPdf(true);
    setExportNotice(null);
    try {
      const fileName = await exportAttestationLocationsPdf({
        locations: filteredLocations,
        regionFilter,
        kindFilter,
        searchQuery,
      });
      setExportNotice({
        kind: 'success',
        text: `Печатный реестр площадок ДФО для комиссий сохранён в PDF: ${fileName} (площадок: ${filteredLocations.length}).`,
      });
      tracker.trackCustomInteraction(
        `Экспорт реестра площадок ДФО (PDF): ${filteredLocations.length} шт.`,
        regionFilter
      );
    } catch {
      setExportNotice({
        kind: 'error',
        text: 'Не удалось сформировать PDF-реестр площадок. Попробуйте выгрузить CSV или повторите попытку.',
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div
      aria-labelledby="attestation-locations-map-heading"
      className="bg-white border border-slate-200 rounded-xl p-5 sm:p-7 space-y-5"
    >
      {/* Header & Basemap / Zoom Controls */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-800">
            <Compass className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Интерактивная карта ДФО · Leaflet</span>
          </div>
          <h3
            id="attestation-locations-map-heading"
            className="text-lg sm:text-xl font-bold text-slate-900 text-balance"
          >
            Аттестационные площадки Дальневосточного федерального округа
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Отфильтруйте субъект ДФО или тип площадки, чтобы увидеть расположение экзаменационного
            центра, полевого полигона или выездной комиссии ФСТР и ближайшие даты приёма.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Подложка карты"
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {(Object.values(LEAFLET_BASEMAPS) as BasemapConfig[]).map((layer) => (
              <button
                key={layer.id}
                type="button"
                onClick={() => {
                  setBasemapId(layer.id);
                  setTileErrorNotice(false);
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  basemapId === layer.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {layer.id === 'topo' && <Layers className="w-3.5 h-3.5" aria-hidden="true" />}
                {layer.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleFitAllDfo}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>Обзор всего ДФО</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredLocations.length === 0}
            title="Выгрузить текущий отфильтрованный список площадок ДФО в CSV (UTF-8 для Excel)"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>CSV для комиссий</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={filteredLocations.length === 0 || isExportingPdf}
            title="Сформировать печатный PDF-реестр текущих площадок ДФО для работы комиссий"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isExportingPdf ? 'Формируем PDF…' : 'PDF реестр'}</span>
          </button>
        </div>
      </div>

      {exportNotice && (
        <p
          role="status"
          className={`text-xs rounded-lg px-3.5 py-2.5 font-medium border ${
            exportNotice.kind === 'error'
              ? 'text-red-900 bg-red-50 border-red-200'
              : 'text-teal-900 bg-teal-50 border-teal-200'
          }`}
        >
          {exportNotice.text}
        </p>
      )}

      {/* Region Filter Row + Venue Kind & Search Row */}
      <div className="space-y-3 pt-3 border-t border-slate-200">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <span>Фильтр по субъектам ДФО</span>
            <span className="font-mono tabular-nums normal-case text-slate-600">
              Показано площадок: {filteredLocations.length} из {DFO_ATTESTATION_LOCATIONS.length}
            </span>
          </div>
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Фильтр площадок по регионам ДФО"
          >
            {regionOptions.map((region) => {
              const isActive = regionFilter === region.id;
              return (
                <button
                  key={region.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => handleSelectRegion(region.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-teal-700 border-teal-700 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <span>{region.shortLabel}</span>
                  <span
                    className={`font-mono text-[11px] tabular-nums ${
                      isActive ? 'text-teal-100' : 'text-slate-400'
                    }`}
                  >
                    {region.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Фильтр по типу площадки"
          >
            {ATTESTATION_KIND_FILTERS.map((filter) => {
              const isActive = kindFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => {
                    setKindFilter(filter.id);
                    tracker.trackCustomInteraction(
                      `Карта площадок ДФО · тип: ${filter.label}`,
                      'leaflet-kind'
                    );
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-teal-800 hover:text-teal-950 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Сбросить фильтры</span>
              </button>
            )}
          </div>

          <label className="relative flex items-center w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по городу, ООПТ или дисциплине…"
              aria-label="Поиск аттестационной площадки по городу, региону или виду туризма"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600"
            />
          </label>
        </div>
      </div>

      {/* Main Split: Leaflet Map (7 cols) + Inspector & Directory (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="relative isolate z-0 h-[420px] sm:h-[490px] w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
            <MapContainer
              center={[51.0, 140.5]}
              zoom={4}
              minZoom={3}
              maxZoom={17}
              scrollWheelZoom={true}
              className="w-full h-full z-0"
            >
              <TileLayer
                key={activeBasemap.id}
                url={activeBasemap.url}
                attribution={activeBasemap.attribution}
                maxZoom={activeBasemap.maxZoom}
                eventHandlers={{
                  tileerror: () => setTileErrorNotice(true),
                }}
              />

              <LeafletCameraController
                filteredLocations={filteredLocations}
                selectedLocation={selectedLocation}
                filterKey={filterKey}
                fitOverviewNonce={fitOverviewNonce}
                focusSelectionNonce={focusSelectionNonce}
              />

              {filteredLocations.map((loc) => {
                const isSelected = loc.id === selectedLocation.id;
                const isHovered = loc.id === hoveredLocationId;
                const accentColor = ATTESTATION_KIND_COLORS[loc.kind];

                return (
                  <Marker
                    key={loc.id}
                    position={[loc.coordinates.lat, loc.coordinates.lng]}
                    icon={createVenueDivIcon(loc, isSelected, isHovered)}
                    zIndexOffset={isSelected ? 1000 : isHovered ? 500 : 10}
                    ref={(instance) => {
                      markerRefs.current[loc.id] = instance;
                    }}
                    eventHandlers={{
                      click: () => handleSelectLocation(loc, false),
                      mouseover: () => setHoveredLocationId(loc.id),
                      mouseout: () => setHoveredLocationId(null),
                    }}
                  >
                    <Popup maxWidth={290} minWidth={230}>
                      <div className="space-y-1.5 text-slate-900 font-sans">
                        <p className="text-[11px] font-semibold" style={{ color: accentColor }}>
                          {loc.kindLabel} · {loc.regionName}
                        </p>
                        <p className="text-xs font-bold text-slate-900 leading-snug m-0">
                          {loc.name}
                        </p>
                        <p className="text-[11px] text-slate-600 leading-snug m-0">
                          {loc.city}, {loc.address}
                        </p>
                        <p className="text-[11px] text-teal-900 bg-teal-50 border border-teal-200 rounded px-2 py-1 m-0">
                          {loc.trialFormats[0]}
                        </p>
                        <p className="text-[11px] text-slate-600 tabular-nums m-0">
                          Сессии: {loc.nextSessions}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>

          {tileErrorNotice && (
            <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              Некоторые картографические тайлы временно недоступны в сети; координаты площадок и
              список регионов полностью активны.
            </p>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-5 px-1 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-700" aria-hidden="true" />
              Головной центр РЦА и теория (ВВГУ)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-700" aria-hidden="true" />
              Полевые испытательные полигоны
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-700" aria-hidden="true" />
              Выездные и партнёрские площадки ДФО
            </span>
          </div>
        </div>

        {/* Right Side Inspector & Venue Directory */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-4">
          <article className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span
                  className="font-semibold"
                  style={{ color: ATTESTATION_KIND_COLORS[selectedLocation.kind] }}
                >
                  {selectedLocation.kindLabel}
                </span>
                <span aria-hidden="true">·</span>
                <span>{selectedLocation.regionName}</span>
              </div>
              <h4 className="text-base font-bold text-slate-900 leading-snug">
                {selectedLocation.name}
              </h4>
              <p className="text-xs text-slate-600 flex items-start gap-1.5 pt-0.5">
                <MapPin className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  {selectedLocation.city}, {selectedLocation.address}
                </span>
              </p>
              <p className="text-[11px] font-mono text-slate-500 tabular-nums pl-5">
                {selectedLocation.coordinates.lat.toFixed(4)}° N,{' '}
                {selectedLocation.coordinates.lng.toFixed(4)}° E
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Очные испытания на площадке
              </p>
              <ul className="space-y-1.5">
                {selectedLocation.trialFormats.map((format) => (
                  <li
                    key={format}
                    className="flex items-start gap-2 text-xs text-slate-800 leading-relaxed"
                  >
                    <CheckCircle2
                      className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>{format}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-0.5">
                <span className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                  <CalendarDays className="w-3 h-3 text-teal-700" aria-hidden="true" />
                  Ближайшие сессии
                </span>
                <p className="font-semibold text-slate-900 tabular-nums leading-snug">
                  {selectedLocation.nextSessions}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-0.5">
                <span className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                  <Users className="w-3 h-3 text-teal-700" aria-hidden="true" />
                  Кураторы комиссии
                </span>
                <p className="font-semibold text-slate-900 leading-snug">
                  {selectedLocation.chairName}
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-600">{selectedLocation.capacityNote}</span>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={buildAttestationYandexMapsUrl(selectedLocation)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    tracker.trackCustomInteraction(
                      `Карта площадок ДФО · Яндекс Карты: ${selectedLocation.shortName}`
                    )
                  }
                  className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:text-teal-900 underline underline-offset-2 whitespace-nowrap shrink-0"
                >
                  <span>Яндекс Карты</span>
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
                <a
                  href={buildAttestationGoogleMapsUrl(selectedLocation)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    tracker.trackCustomInteraction(
                      `Карта площадок ДФО · Google Карты: ${selectedLocation.shortName}`
                    )
                  }
                  className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900 underline underline-offset-2 whitespace-nowrap shrink-0"
                >
                  <span>Google Карты</span>
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              </div>
            </div>
          </article>

          {/* Directory of Locations */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>Площадки очных испытаний ДФО</span>
              <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                {filteredLocations.length} из {DFO_ATTESTATION_LOCATIONS.length}
              </span>
            </div>

            {filteredLocations.length === 0 ? (
              <div className="p-4 text-xs text-slate-500 flex items-center justify-between gap-2">
                <span>По выбранному региону и типу площадок не найдено.</span>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="font-semibold text-teal-700 hover:text-teal-900 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Сбросить
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 max-h-[215px] overflow-y-auto">
                {filteredLocations.map((loc) => {
                  const isSelected = loc.id === selectedLocation.id;
                  const dotColor = ATTESTATION_KIND_COLORS[loc.kind];
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => handleSelectLocation(loc, true)}
                      onMouseEnter={() => setHoveredLocationId(loc.id)}
                      onMouseLeave={() => setHoveredLocationId(null)}
                      className={`w-full px-4 py-2.5 text-left text-xs flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-teal-50/90 font-semibold text-slate-900'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: dotColor }}
                          aria-hidden="true"
                        />
                        <span className="truncate">{loc.shortName}</span>
                      </span>
                      <span className="text-[11px] text-slate-500 shrink-0">{loc.regionName}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
