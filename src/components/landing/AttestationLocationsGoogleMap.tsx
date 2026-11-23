/// <reference types="google.maps" />
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  APILoadingStatus,
  AdvancedMarker,
  CollisionBehavior,
  InfoWindow,
  Map as GoogleMap,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Compass,
  ExternalLink,
  Layers,
  MapPin,
  Maximize2,
  Search,
  Users,
} from 'lucide-react';
import {
  ATTESTATION_KIND_COLORS,
  ATTESTATION_KIND_FILTERS,
  DFO_ATTESTATION_LOCATIONS,
  buildAttestationGoogleMapsUrl,
  filterAttestationLocations,
  sortAttestationLocationsForStacking,
  type AttestationLocationFilterId,
  type DfoAttestationLocation,
  type LatLngPoint,
} from '../../utils/attestationLocationsMap';
import { tracker } from '../../utils/tracker';

type MapBasemapMode = 'roadmap' | 'terrain' | 'hybrid';

const Z_INDEX_SELECTED = 1000;
const Z_INDEX_HOVER = 999;

interface CameraCommand {
  boundsPoints?: LatLngPoint[];
  center?: LatLngPoint;
  zoom?: number;
  nonce: number;
}

interface LocationMarkerProps {
  location: DfoAttestationLocation;
  zIndex: number;
  isSelected: boolean;
  isHovered: boolean;
  onRegisterMarker: (
    locationId: string,
    marker: google.maps.marker.AdvancedMarkerElement | null
  ) => void;
  onHover: (locationId: string | null) => void;
  onSelect: (location: DfoAttestationLocation) => void;
}

const AttestationLocationMarker: React.FC<LocationMarkerProps> = ({
  location,
  zIndex,
  isSelected,
  isHovered,
  onRegisterMarker,
  onHover,
  onSelect,
}) => {
  const [markerRef, markerInstance] = useAdvancedMarkerRef();

  useEffect(() => {
    onRegisterMarker(location.id, markerInstance);
    return () => onRegisterMarker(location.id, null);
  }, [location.id, markerInstance, onRegisterMarker]);

  const accentColor = ATTESTATION_KIND_COLORS[location.kind];

  return (
    <AdvancedMarker
      ref={markerRef}
      position={location.coordinates}
      zIndex={zIndex}
      collisionBehavior={CollisionBehavior.OPTIONAL_AND_HIDES_LOWER_PRIORITY}
      title={`${location.shortName} — ${location.kindLabel}`}
      onClick={() => onSelect(location)}
      onMouseEnter={() => onHover(location.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div
        className={`flex flex-col items-center select-none transition-transform duration-150 ${
          isSelected ? 'scale-110' : isHovered ? 'scale-105' : 'scale-100'
        }`}
      >
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold shadow-md whitespace-nowrap ${
            isSelected
              ? 'bg-slate-900 text-white border-white ring-2 ring-teal-500/60'
              : 'bg-white text-slate-900 border-slate-300'
          }`}
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: isSelected ? '#5EEAD4' : accentColor }}
            aria-hidden="true"
          />
          <span className="font-mono text-[10px] tabular-nums">{location.badgeCode}</span>
          <span className="font-semibold max-w-[140px] truncate">{location.shortName}</span>
        </div>
        <div
          className="w-2.5 h-2.5 rotate-45 -mt-1.5 border-r border-b"
          style={{
            backgroundColor: isSelected ? '#0F172A' : '#FFFFFF',
            borderColor: isSelected ? '#FFFFFF' : '#CBD5E1',
          }}
        />
      </div>
    </AdvancedMarker>
  );
};

const CameraSynchronizer: React.FC<{ command: CameraCommand | null }> = ({ command }) => {
  const map = useMap();
  const coreLib = useMapsLibrary('core');

  useEffect(() => {
    if (!map || !command) return;

    if (command.boundsPoints && command.boundsPoints.length > 1 && coreLib) {
      const bounds = new coreLib.LatLngBounds();
      for (const pt of command.boundsPoints) {
        bounds.extend(pt);
      }
      map.fitBounds(bounds, { top: 52, right: 52, bottom: 52, left: 52 });
      return;
    }

    if (command.center) {
      map.panTo(command.center);
      if (typeof command.zoom === 'number') {
        map.setZoom(command.zoom);
      }
    }
  }, [map, coreLib, command]);

  return null;
};

interface AttestationMapCanvasProps {
  locations: readonly DfoAttestationLocation[];
  selectedLocation: DfoAttestationLocation;
  hoveredLocationId: string | null;
  basemapMode: MapBasemapMode;
  cameraCommand: CameraCommand | null;
  infoWindowOpen: boolean;
  onHoverLocation: (id: string | null) => void;
  onSelectLocation: (loc: DfoAttestationLocation) => void;
  onCloseInfoWindow: () => void;
}

const AttestationMapCanvas: React.FC<AttestationMapCanvasProps> = ({
  locations,
  selectedLocation,
  hoveredLocationId,
  basemapMode,
  cameraCommand,
  infoWindowOpen,
  onHoverLocation,
  onSelectLocation,
  onCloseInfoWindow,
}) => {
  const loadingStatus = useApiLoadingStatus();
  const markerRegistryRef = useRef<Record<string, google.maps.marker.AdvancedMarkerElement | null>>(
    {}
  );

  const registerMarker = useCallback(
    (locationId: string, marker: google.maps.marker.AdvancedMarkerElement | null) => {
      markerRegistryRef.current[locationId] = marker;
    },
    []
  );

  const stackedLocations = useMemo(
    () => sortAttestationLocationsForStacking(locations),
    [locations]
  );

  const selectedAnchor = markerRegistryRef.current[selectedLocation.id] ?? null;
  const accentColor = ATTESTATION_KIND_COLORS[selectedLocation.kind];

  if (
    loadingStatus === APILoadingStatus.FAILED ||
    loadingStatus === APILoadingStatus.AUTH_FAILURE
  ) {
    return (
      <div className="h-[400px] sm:h-[460px] w-full rounded-xl border border-amber-200 bg-amber-50/70 p-6 flex flex-col items-center justify-center text-center gap-3">
        <AlertTriangle className="w-7 h-7 text-amber-700" aria-hidden="true" />
        <div className="space-y-1 max-w-md">
          <p className="text-sm font-bold text-slate-900">
            Картографический слой Google Maps временно недоступен
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            Список очных площадок аттестации ДФО, адреса экзаменационных центров и формат испытаний
            доступны в каталоге справа.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate z-0 h-[400px] sm:h-[460px] w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
      <GoogleMap
        mapId="DEMO_MAP_ID"
        defaultCenter={{ lat: 50.2, lng: 141.0 }}
        defaultZoom={4}
        mapTypeId={basemapMode}
        gestureHandling="greedy"
        streetViewControl={false}
        fullscreenControl={true}
        mapTypeControl={false}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        className="w-full h-full"
      >
        <CameraSynchronizer command={cameraCommand} />

        {stackedLocations.map(({ location, baseZIndex }) => {
          const isSelected = location.id === selectedLocation.id;
          const isHovered = location.id === hoveredLocationId;
          const zIndex = isSelected
            ? Z_INDEX_SELECTED
            : isHovered
              ? Z_INDEX_HOVER
              : baseZIndex;

          return (
            <AttestationLocationMarker
              key={location.id}
              location={location}
              zIndex={zIndex}
              isSelected={isSelected}
              isHovered={isHovered}
              onRegisterMarker={registerMarker}
              onHover={onHoverLocation}
              onSelect={onSelectLocation}
            />
          );
        })}

        {infoWindowOpen && selectedAnchor && (
          <InfoWindow
            anchor={selectedAnchor}
            maxWidth={300}
            pixelOffset={[0, -6]}
            onCloseClick={onCloseInfoWindow}
          >
            <div className="space-y-2 p-0.5 text-slate-900 font-sans">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                <span className="font-semibold" style={{ color: accentColor }}>
                  {selectedLocation.kindLabel}
                </span>
                <span aria-hidden="true">·</span>
                <span>{selectedLocation.regionName}</span>
              </div>

              <p className="text-xs font-bold text-slate-900 leading-snug">
                {selectedLocation.name}
              </p>

              <p className="text-[11px] text-slate-600 leading-snug">{selectedLocation.address}</p>

              <div className="rounded-md bg-teal-50 border border-teal-200 px-2.5 py-1.5 text-[11px] text-teal-950 font-medium leading-snug">
                Очный формат: {selectedLocation.trialFormats[0]}
              </div>

              <p className="text-[11px] text-slate-600 tabular-nums">
                Ближайшие сессии: {selectedLocation.nextSessions}
              </p>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
};

export const AttestationLocationsGoogleMap: React.FC = () => {
  const staticEnvKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim();
  const [resolvedApiKey, setResolvedApiKey] = useState<string>(staticEnvKey);
  const [configChecked, setConfigChecked] = useState<boolean>(Boolean(staticEnvKey));

  const [kindFilter, setKindFilter] = useState<AttestationLocationFilterId>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [basemapMode, setBasemapMode] = useState<MapBasemapMode>('roadmap');
  const [selectedLocationId, setSelectedLocationId] = useState<string>(
    DFO_ATTESTATION_LOCATIONS[0].id
  );
  const [hoveredLocationId, setHoveredLocationId] = useState<string | null>(null);
  const [infoWindowOpen, setInfoWindowOpen] = useState<boolean>(true);
  const [cameraCommand, setCameraCommand] = useState<CameraCommand | null>(null);

  useEffect(() => {
    if (staticEnvKey) return;
    let active = true;
    fetch('/api/maps/config', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { apiKey: '' }))
      .then((data: { apiKey?: string }) => {
        if (!active) return;
        setResolvedApiKey((data.apiKey ?? '').trim());
        setConfigChecked(true);
      })
      .catch(() => {
        if (!active) return;
        setConfigChecked(true);
      });
    return () => {
      active = false;
    };
  }, [staticEnvKey]);

  const filteredLocations = useMemo(
    () => filterAttestationLocations(DFO_ATTESTATION_LOCATIONS, kindFilter, searchQuery),
    [kindFilter, searchQuery]
  );

  const selectedLocation = useMemo(
    () =>
      filteredLocations.find((loc) => loc.id === selectedLocationId) ??
      filteredLocations[0] ??
      DFO_ATTESTATION_LOCATIONS[0],
    [filteredLocations, selectedLocationId]
  );

  const handleSelectLocation = useCallback((location: DfoAttestationLocation) => {
    setSelectedLocationId(location.id);
    setInfoWindowOpen(true);
    setCameraCommand({
      center: location.coordinates,
      zoom: location.kind === 'headquarters' ? 12 : location.kind === 'field_polygon' ? 9 : 7,
      nonce: Date.now(),
    });
    tracker.trackCustomInteraction(
      `Карта очных площадок ДФО: ${location.shortName}`,
      location.kindLabel
    );
  }, []);

  const handleFitAllDfo = () => {
    const source = filteredLocations.length > 0 ? filteredLocations : DFO_ATTESTATION_LOCATIONS;
    setCameraCommand({
      boundsPoints: source.map((loc) => loc.coordinates),
      nonce: Date.now(),
    });
    tracker.trackCustomInteraction('Карта очных площадок ДФО: общий обзор ДФО');
  };

  return (
    <div
      aria-labelledby="attestation-locations-map-heading"
      className="bg-white border border-slate-200 rounded-xl p-5 sm:p-7 space-y-5"
    >
      {/* Header & Map Type Controls */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-800">
            <Compass className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Карта площадок ДФО · Очные испытания</span>
          </div>
          <h3
            id="attestation-locations-map-heading"
            className="text-lg sm:text-xl font-bold text-slate-900 text-balance"
          >
            Локации очных аттестационных испытаний на Дальнем Востоке
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Выберите экзаменационный центр, полевой полигон или выездную комиссию ДФО на карте
            Google Maps, чтобы уточнить адрес, состав очных испытаний и ближайшие даты приёма.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Слой карты Google"
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {(
              [
                { id: 'roadmap', label: 'Карта' },
                { id: 'terrain', label: 'Рельеф' },
                { id: 'hybrid', label: 'Спутник' },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setBasemapMode(mode.id)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  basemapMode === mode.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {mode.id === 'terrain' && <Layers className="w-3.5 h-3.5" aria-hidden="true" />}
                {mode.label}
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
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Тип площадки">
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
                    `Карта очных площадок ДФО фильтр: ${filter.label}`
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
        </div>

        <label className="relative flex items-center w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по городу или полигону…"
            aria-label="Поиск площадки аттестации по городу, региону или виду испытаний"
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600"
          />
        </label>
      </div>

      {/* Main Split: Google Maps (7 cols) + Inspector & Directory (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 flex flex-col gap-3">
          {resolvedApiKey ? (
            <APIProvider
              apiKey={resolvedApiKey}
              libraries={['marker']}
              language="ru"
              region="RU"
            >
              <AttestationMapCanvas
                locations={filteredLocations}
                selectedLocation={selectedLocation}
                hoveredLocationId={hoveredLocationId}
                basemapMode={basemapMode}
                cameraCommand={cameraCommand}
                infoWindowOpen={infoWindowOpen}
                onHoverLocation={setHoveredLocationId}
                onSelectLocation={handleSelectLocation}
                onCloseInfoWindow={() => setInfoWindowOpen(false)}
              />
            </APIProvider>
          ) : (
            <div className="h-[400px] sm:h-[460px] w-full rounded-xl border border-slate-200 bg-slate-50 p-6 flex flex-col items-center justify-center text-center gap-3">
              <MapPin className="w-7 h-7 text-teal-700" aria-hidden="true" />
              <div className="space-y-1 max-w-md">
                <p className="text-sm font-bold text-slate-900">
                  {configChecked
                    ? 'Карта площадок ДФО ожидает активации ключа Google Maps'
                    : 'Загрузка интерактивной карты Google Maps…'}
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Все {DFO_ATTESTATION_LOCATIONS.length} площадок очных испытаний ДФО доступны для
                  просмотра в списке справа.
                </p>
              </div>
            </div>
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
              Выездные и партнёрские точки ДФО
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
              <a
                href={buildAttestationGoogleMapsUrl(selectedLocation)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  tracker.trackCustomInteraction(
                    `Карта площадок ДФО · Открыть в Google Картах: ${selectedLocation.shortName}`
                  )
                }
                className="inline-flex items-center gap-1.5 font-semibold text-teal-700 hover:text-teal-900 underline underline-offset-2 whitespace-nowrap shrink-0"
              >
                <span>Открыть в Google Картах</span>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
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
                <span>По заданному фильтру площадок не найдено.</span>
                <button
                  type="button"
                  onClick={() => {
                    setKindFilter('all');
                    setSearchQuery('');
                  }}
                  className="font-semibold text-teal-700 hover:text-teal-900 cursor-pointer"
                >
                  Сбросить
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 max-h-[210px] overflow-y-auto">
                {filteredLocations.map((loc) => {
                  const isSelected = loc.id === selectedLocation.id;
                  const dotColor = ATTESTATION_KIND_COLORS[loc.kind];
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => handleSelectLocation(loc)}
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
