/// <reference types="google.maps" />
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  APILoadingStatus,
  AdvancedMarker,
  CollisionBehavior,
  InfoWindow,
  Map as GoogleMap,
  Polyline,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  Building2,
  Compass,
  Layers,
  MapPin,
  Navigation,
  Route,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  CERTIFIED_TOURIST_ROUTES,
  RCA_REPRESENTATIONS,
  type CertifiedTouristRoute,
  type RcaRepresentationOffice,
} from '../../data/researchData';
import {
  DFO_REGION_CAMERA_PRESETS,
  ROUTE_TRACK_STROKE_COLORS,
  filterDfoTouristRoutes,
  getAttestationPinBadge,
  getGuideRequirementSummary,
  sortRoutesForMarkerStacking,
  toLatLngPath,
  type DfoAttestationFilterId,
  type DfoMapRegionId,
  type LatLngPoint,
} from '../../utils/dfoRoutesMap';
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

interface RouteMarkerProps {
  route: CertifiedTouristRoute;
  position: LatLngPoint;
  zIndex: number;
  isSelected: boolean;
  isHovered: boolean;
  onRegisterMarker: (
    routeId: string,
    marker: google.maps.marker.AdvancedMarkerElement | null
  ) => void;
  onHover: (routeId: string | null) => void;
  onSelect: (route: CertifiedTouristRoute, marker: google.maps.marker.AdvancedMarkerElement | null) => void;
}

const RouteAttestationMarker: React.FC<RouteMarkerProps> = ({
  route,
  position,
  zIndex,
  isSelected,
  isHovered,
  onRegisterMarker,
  onHover,
  onSelect,
}) => {
  const [markerRef, markerInstance] = useAdvancedMarkerRef();

  useEffect(() => {
    onRegisterMarker(route.id, markerInstance);
    return () => onRegisterMarker(route.id, null);
  }, [markerInstance, onRegisterMarker, route.id]);

  const strokeColor = ROUTE_TRACK_STROKE_COLORS[route.track];
  const badge = getAttestationPinBadge(route);

  return (
    <AdvancedMarker
      ref={markerRef}
      position={position}
      zIndex={zIndex}
      collisionBehavior={CollisionBehavior.OPTIONAL_AND_HIDES_LOWER_PRIORITY}
      title={`${route.shortName} — требуется аттестованный проводник (${route.difficultyCategory})`}
      onClick={() => onSelect(route, markerInstance)}
      onMouseEnter={() => onHover(route.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div
        className={`group flex flex-col items-center select-none transition-transform duration-150 ${
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
          <ShieldCheck
            className="w-3.5 h-3.5 shrink-0"
            style={{ color: isSelected ? '#5EEAD4' : strokeColor }}
            aria-hidden="true"
          />
          <span className="font-mono tabular-nums">{badge}</span>
          <span className="hidden sm:inline font-semibold max-w-[130px] truncate">
            {route.shortName.split('(')[0].trim()}
          </span>
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

interface OfficeMarkerProps {
  office: RcaRepresentationOffice;
  onSelect: (office: RcaRepresentationOffice) => void;
}

const OfficeHubMarker: React.FC<OfficeMarkerProps> = ({ office, onSelect }) => {
  const shortTag =
    office.officeType === 'headquarters'
      ? 'РЦА'
      : office.officeType === 'polygon'
        ? 'ПЛГ'
        : 'УЗЕЛ';

  return (
    <AdvancedMarker
      position={{ lat: office.coordinates[0], lng: office.coordinates[1] }}
      zIndex={50}
      title={`${office.name} (${office.certifiedCountLabel})`}
      onClick={() => onSelect(office)}
    >
      <div className="px-1.5 py-0.5 rounded bg-slate-900/90 text-white border border-white/90 font-mono text-[10px] font-bold shadow-sm">
        {shortTag}
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
      map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
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

interface GoogleMapCanvasProps {
  filteredRoutes: CertifiedTouristRoute[];
  selectedRoute: CertifiedTouristRoute;
  hoveredRouteId: string | null;
  showOffices: boolean;
  basemapMode: MapBasemapMode;
  cameraCommand: CameraCommand | null;
  selectedOffice: RcaRepresentationOffice | null;
  onHoverRoute: (routeId: string | null) => void;
  onSelectRoute: (route: CertifiedTouristRoute) => void;
  onSelectOffice: (office: RcaRepresentationOffice) => void;
  onClearOffice: () => void;
}

const GoogleMapCanvas: React.FC<GoogleMapCanvasProps> = ({
  filteredRoutes,
  selectedRoute,
  hoveredRouteId,
  showOffices,
  basemapMode,
  cameraCommand,
  selectedOffice,
  onHoverRoute,
  onSelectRoute,
  onSelectOffice,
  onClearOffice,
}) => {
  const loadingStatus = useApiLoadingStatus();
  const [infoWindowOpen, setInfoWindowOpen] = useState<boolean>(true);
  const markerRegistryRef = useRef<Record<string, google.maps.marker.AdvancedMarkerElement | null>>(
    {}
  );

  const registerMarker = useCallback(
    (routeId: string, marker: google.maps.marker.AdvancedMarkerElement | null) => {
      markerRegistryRef.current[routeId] = marker;
    },
    []
  );

  const stackedMarkers = useMemo(
    () => sortRoutesForMarkerStacking(filteredRoutes),
    [filteredRoutes]
  );

  const handleMarkerClick = useCallback(
    (route: CertifiedTouristRoute) => {
      onClearOffice();
      onSelectRoute(route);
      setInfoWindowOpen(true);
    },
    [onClearOffice, onSelectRoute]
  );

  const selectedAnchor = markerRegistryRef.current[selectedRoute.id] ?? null;
  const selectedTrackColor = ROUTE_TRACK_STROKE_COLORS[selectedRoute.track];

  if (
    loadingStatus === APILoadingStatus.FAILED ||
    loadingStatus === APILoadingStatus.AUTH_FAILURE
  ) {
    return (
      <div className="h-[440px] sm:h-[520px] w-full rounded-xl border border-amber-200 bg-amber-50/70 p-6 flex flex-col items-center justify-center text-center gap-3">
        <AlertTriangle className="w-7 h-7 text-amber-700" aria-hidden="true" />
        <div className="space-y-1 max-w-md">
          <p className="text-sm font-bold text-slate-900">
            Картографический слой Google Maps временно недоступен
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            Не удалось загрузить интерактивные тайлы карты. Список популярных направлений ДФО и
            требования к аттестации проводников доступны в инспекторе справа.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate z-0 h-[440px] sm:h-[520px] w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
      <GoogleMap
        mapId="DEMO_MAP_ID"
        defaultCenter={{ lat: 47.6, lng: 141.5 }}
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

        {filteredRoutes.map((route) => {
          const isSelected = route.id === selectedRoute.id;
          const color = ROUTE_TRACK_STROKE_COLORS[route.track];
          return (
            <Polyline
              key={`${route.id}-line`}
              path={toLatLngPath(route.coordinates)}
              strokeColor={color}
              strokeOpacity={isSelected ? 0.95 : 0.72}
              strokeWeight={isSelected ? 5 : 3}
              geodesic={true}
              zIndex={isSelected ? 20 : 5}
              onClick={() => handleMarkerClick(route)}
            />
          );
        })}

        {stackedMarkers.map(({ route, baseZIndex, position }) => {
          const isSelected = route.id === selectedRoute.id;
          const isHovered = route.id === hoveredRouteId;
          const zIndex = isSelected
            ? Z_INDEX_SELECTED
            : isHovered
              ? Z_INDEX_HOVER
              : baseZIndex;

          return (
            <RouteAttestationMarker
              key={route.id}
              route={route}
              position={position}
              zIndex={zIndex}
              isSelected={isSelected}
              isHovered={isHovered}
              onRegisterMarker={registerMarker}
              onHover={onHoverRoute}
              onSelect={(clickedRoute) => handleMarkerClick(clickedRoute)}
            />
          );
        })}

        {showOffices &&
          RCA_REPRESENTATIONS.map((office) => (
            <OfficeHubMarker
              key={office.id}
              office={office}
              onSelect={(clickedOffice) => {
                setInfoWindowOpen(false);
                onSelectOffice(clickedOffice);
              }}
            />
          ))}

        {infoWindowOpen && selectedAnchor && !selectedOffice && (
          <InfoWindow
            anchor={selectedAnchor}
            maxWidth={300}
            pixelOffset={[0, -6]}
            onCloseClick={() => setInfoWindowOpen(false)}
          >
            <div className="space-y-2 p-0.5 text-slate-900 font-sans">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                <span className="font-semibold" style={{ color: selectedTrackColor }}>
                  {selectedRoute.trackLabel}
                </span>
                <span aria-hidden="true">·</span>
                <span>{selectedRoute.regionName}</span>
              </div>

              <p className="text-xs font-bold text-slate-900 leading-snug">
                {selectedRoute.name}
              </p>

              <div className="rounded-md bg-teal-50 border border-teal-200 px-2.5 py-1.5 text-[11px] text-teal-950 font-semibold leading-snug">
                Требуется аттестованный проводник · {selectedRoute.difficultyCategory}
              </div>

              <p className="text-[11px] text-slate-600 tabular-nums">
                {selectedRoute.lengthKm} км · {selectedRoute.durationLabel} · норма:{' '}
                {selectedRoute.groupNorm}
              </p>
            </div>
          </InfoWindow>
        )}

        {selectedOffice && (
          <InfoWindow
            position={{
              lat: selectedOffice.coordinates[0],
              lng: selectedOffice.coordinates[1],
            }}
            maxWidth={290}
            onCloseClick={onClearOffice}
          >
            <div className="space-y-1.5 p-0.5 text-slate-900 font-sans">
              <p className="text-[11px] font-semibold text-teal-800">
                {selectedOffice.officeTypeLabel}
              </p>
              <p className="text-xs font-bold text-slate-900 leading-snug">
                {selectedOffice.name}
              </p>
              <p className="text-[11px] text-slate-600">{selectedOffice.address}</p>
              <p className="text-[11px] font-medium text-slate-800 pt-1 border-t border-slate-200">
                {selectedOffice.certifiedCountLabel}
              </p>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
};

export interface DfoRoutesGoogleMapProps {
  onSelectRouteId?: (routeId: string) => void;
}

export const DfoRoutesGoogleMap: React.FC<DfoRoutesGoogleMapProps> = ({
  onSelectRouteId,
}) => {
  const staticEnvKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim();
  const [resolvedApiKey, setResolvedApiKey] = useState<string>(staticEnvKey);
  const [configChecked, setConfigChecked] = useState<boolean>(Boolean(staticEnvKey));

  const [regionFilter, setRegionFilter] = useState<DfoMapRegionId>('all');
  const [attestationFilter, setAttestationFilter] =
    useState<DfoAttestationFilterId>('all');
  const [basemapMode, setBasemapMode] = useState<MapBasemapMode>('terrain');
  const [showOffices, setShowOffices] = useState<boolean>(true);
  const [selectedRouteId, setSelectedRouteId] = useState<string>(
    CERTIFIED_TOURIST_ROUTES[0]?.id ?? ''
  );
  const [hoveredRouteId, setHoveredRouteId] = useState<string | null>(null);
  const [selectedOffice, setSelectedOffice] =
    useState<RcaRepresentationOffice | null>(null);
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

  const filteredRoutes = useMemo(
    () =>
      filterDfoTouristRoutes(
        CERTIFIED_TOURIST_ROUTES,
        regionFilter,
        attestationFilter
      ),
    [regionFilter, attestationFilter]
  );

  const selectedRoute = useMemo(() => {
    return (
      filteredRoutes.find((r) => r.id === selectedRouteId) ??
      filteredRoutes[0] ??
      CERTIFIED_TOURIST_ROUTES[0]
    );
  }, [filteredRoutes, selectedRouteId]);

  const linkedOffice = useMemo(() => {
    return (
      RCA_REPRESENTATIONS.find((o) => o.id === selectedRoute.officeId) ?? null
    );
  }, [selectedRoute]);

  const handleSelectRegion = (preset: (typeof DFO_REGION_CAMERA_PRESETS)[number]) => {
    setRegionFilter(preset.id);
    setSelectedOffice(null);
    setCameraCommand({
      center: preset.center,
      zoom: preset.zoom,
      nonce: Date.now(),
    });
    tracker.trackCustomInteraction(`Карта направлений ДФО: регион ${preset.label}`);
  };

  const handleSelectRoute = useCallback(
    (route: CertifiedTouristRoute) => {
      setSelectedRouteId(route.id);
      setSelectedOffice(null);
      setCameraCommand({
        boundsPoints: toLatLngPath(route.coordinates),
        nonce: Date.now(),
      });
      onSelectRouteId?.(route.id);
      tracker.trackCustomInteraction(
        `Карта направлений ДФО: ${route.shortName}`,
        route.difficultyCategory
      );
    },
    [onSelectRouteId]
  );

  const handleSelectOffice = useCallback((office: RcaRepresentationOffice) => {
    setSelectedOffice(office);
    setCameraCommand({
      center: { lat: office.coordinates[0], lng: office.coordinates[1] },
      zoom: office.officeType === 'headquarters' ? 10 : 8,
      nonce: Date.now(),
    });
    tracker.trackCustomInteraction(`Карта направлений ДФО: узел ${office.shortName}`);
  }, []);

  return (
    <section
      aria-labelledby="dfo-routes-google-map-heading"
      className="bg-white border border-slate-200 rounded-xl p-5 sm:p-7 space-y-6"
    >
      {/* Header & Controls */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-teal-800">
            <Compass className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Интерактивная карта направлений ДФО · Метки обязательной аттестации</span>
          </div>
          <h3
            id="dfo-routes-google-map-heading"
            className="text-xl font-bold text-slate-900 text-balance"
          >
            Популярные туристические направления ДФО с допуском аттестованных проводников
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Визуализация ключевых маршрутов Дальнего Востока, где по требованиям 132-ФЗ и
            Постановления Правительства РФ № 1893 обязательно сопровождение аттестованного
            инструктора-проводника и оформление паспорта маршрута (форма 760).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Map Basemap Switcher */}
          <div
            role="group"
            aria-label="Режим карты Google"
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {(
              [
                { id: 'terrain', label: 'Рельеф' },
                { id: 'roadmap', label: 'Карта' },
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
            onClick={() => setShowOffices((prev) => !prev)}
            aria-pressed={showOffices}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showOffices
                ? 'bg-slate-900 border-slate-900 text-white'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Площадки РЦА</span>
          </button>
        </div>
      </div>

      {/* Filters toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-slate-500 mr-1 inline-flex items-center gap-1">
            <Navigation className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            Регион ДФО:
          </span>
          {DFO_REGION_CAMERA_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelectRegion(preset)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                regionFilter === preset.id
                  ? 'bg-teal-50 border-teal-300 text-teal-900'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-slate-500 mr-1">Профиль допуска:</span>
          {(
            [
              { id: 'all', label: 'Все направления' },
              { id: 'hiking', label: 'Пешеходный / ООПТ' },
              { id: 'water', label: 'Водный / сплавы' },
              { id: 'expedition', label: 'Экспедиция' },
              { id: 'high_complexity', label: 'Повышенный допуск (3–4 КС / ООПТ)' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setAttestationFilter(item.id);
                tracker.trackCustomInteraction(`Карта направлений ДФО фильтр: ${item.label}`);
              }}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                attestationFilter === item.id
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split: Google Maps Viewport (7 cols) + Attestation Inspector & List (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 flex flex-col gap-3">
          {resolvedApiKey ? (
            <APIProvider
              apiKey={resolvedApiKey}
              libraries={['marker']}
              language="ru"
              region="RU"
            >
              <GoogleMapCanvas
                filteredRoutes={filteredRoutes}
                selectedRoute={selectedRoute}
                hoveredRouteId={hoveredRouteId}
                showOffices={showOffices}
                basemapMode={basemapMode}
                cameraCommand={cameraCommand}
                selectedOffice={selectedOffice}
                onHoverRoute={setHoveredRouteId}
                onSelectRoute={handleSelectRoute}
                onSelectOffice={handleSelectOffice}
                onClearOffice={() => setSelectedOffice(null)}
              />
            </APIProvider>
          ) : (
            <div className="h-[440px] sm:h-[520px] w-full rounded-xl border border-slate-200 bg-slate-50 p-6 flex flex-col items-center justify-center text-center gap-3">
              <MapPin className="w-7 h-7 text-teal-700" aria-hidden="true" />
              <div className="space-y-1 max-w-md">
                <p className="text-sm font-bold text-slate-900">
                  {configChecked
                    ? 'Карта направлений ДФО ожидает активации ключа Google Maps'
                    : 'Инициализация картографического модуля Google Maps…'}
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Все {CERTIFIED_TOURIST_ROUTES.length} направлений ДФО, нормы по группам и
                  требования аттестации проводников доступны для выбора в каталоге справа.
                </p>
              </div>
            </div>
          )}

          {/* Map Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 h-1 rounded-full bg-teal-700" aria-hidden="true" />
                Пешеходный / ООПТ
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 h-1 rounded-full bg-sky-700" aria-hidden="true" />
                Водный / каякинг
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 h-1 rounded-full bg-amber-700" aria-hidden="true" />
                Горно-экспедиционный
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                Метка требуемой аттестации проводника
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white font-mono text-[10px] font-bold">
                  РЦА
                </span>
                Аттестационная площадка
              </span>
            </div>
          </div>
        </div>

        {/* Right Inspector & Destination List */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-5">
          {/* Selected Route Card */}
          <article className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Route className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
                <span className="font-semibold text-teal-800">{selectedRoute.trackLabel}</span>
                <span aria-hidden="true">·</span>
                <span>{selectedRoute.regionName}</span>
              </div>
              <h4 className="text-base font-bold text-slate-900 leading-snug">
                {selectedRoute.name}
              </h4>
            </div>

            <div className="rounded-lg bg-white border border-teal-200 p-3 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs font-semibold text-slate-900 leading-relaxed">
                {getGuideRequirementSummary(selectedRoute)}
              </p>
            </div>

            <dl className="grid grid-cols-3 gap-2.5">
              <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                <dt className="text-[11px] text-slate-500">Протяжённость</dt>
                <dd className="mt-0.5 text-sm font-bold text-slate-900 tabular-nums">
                  {selectedRoute.lengthKm} км
                </dd>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                <dt className="text-[11px] text-slate-500">Срок выхода</dt>
                <dd className="mt-0.5 text-xs font-bold text-slate-900 tabular-nums">
                  {selectedRoute.durationLabel}
                </dd>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                <dt className="text-[11px] text-slate-500">Норма группы</dt>
                <dd className="mt-0.5 text-xs font-semibold text-slate-900 leading-tight flex items-center gap-1">
                  <Users className="w-3 h-3 text-teal-700 shrink-0" aria-hidden="true" />
                  <span>{selectedRoute.groupNorm}</span>
                </dd>
              </div>
            </dl>

            <p className="text-xs text-slate-700 leading-relaxed">
              {selectedRoute.keyHighlights}
            </p>

            <div className="border-t border-slate-200 pt-3 space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Требования безопасности и паспортизации
              </p>
              <ul className="space-y-1 text-xs text-slate-700">
                {selectedRoute.safetyProtocols.map((protocol) => (
                  <li key={protocol}>· {protocol}</li>
                ))}
              </ul>
            </div>

            <div className="border-t border-slate-200 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span>Сезон: {selectedRoute.seasonWindow}</span>
              {linkedOffice && (
                <button
                  type="button"
                  onClick={() => handleSelectOffice(linkedOffice)}
                  className="text-xs font-semibold text-teal-700 hover:text-teal-900 underline underline-offset-2 cursor-pointer"
                >
                  Площадка аттестации: {linkedOffice.city}
                </button>
              )}
            </div>
          </article>

          {/* Filtered DFO Routes Directory */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>Направления ДФО с обязательной аттестацией</span>
              <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                {filteredRoutes.length} из {CERTIFIED_TOURIST_ROUTES.length}
              </span>
            </div>

            {filteredRoutes.length === 0 ? (
              <div className="p-4 text-xs text-slate-500 flex items-center justify-between gap-2">
                <span>По выбранным фильтрам маршрутов нет.</span>
                <button
                  type="button"
                  onClick={() => {
                    setRegionFilter('all');
                    setAttestationFilter('all');
                  }}
                  className="font-semibold text-teal-700 hover:text-teal-900 cursor-pointer"
                >
                  Сбросить
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 max-h-[220px] overflow-y-auto">
                {filteredRoutes.map((route) => {
                  const isSelected = route.id === selectedRoute.id;
                  const trackColor = ROUTE_TRACK_STROKE_COLORS[route.track];
                  return (
                    <button
                      key={route.id}
                      type="button"
                      onClick={() => handleSelectRoute(route)}
                      className={`w-full px-4 py-2.5 text-left text-xs flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-teal-50/90 font-semibold text-slate-900'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: trackColor }}
                          aria-hidden="true"
                        />
                        <span className="truncate">{route.shortName}</span>
                      </span>
                      <span className="font-mono text-[11px] text-slate-500 tabular-nums shrink-0">
                        {getAttestationPinBadge(route)} · {route.lengthKm} км
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
