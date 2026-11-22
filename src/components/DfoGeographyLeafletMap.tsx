import React, { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';
import {
  Building2,
  Compass,
  Layers,
  MapPin,
  Navigation,
  Route,
  ShieldCheck,
} from 'lucide-react';
import {
  CERTIFIED_TOURIST_ROUTES,
  RCA_REPRESENTATIONS,
  type CertifiedTouristRoute,
  type RcaRepresentationOffice,
} from '../data/researchData';
import { tracker } from '../utils/tracker';

type LayerFilter = 'all' | 'routes' | 'offices';
type TrackFilter = 'all' | 'hiking' | 'water' | 'expedition';
type BasemapStyle = 'light' | 'topo';
type RegionPresetId = 'dfo' | 'primorye' | 'khabarovsk' | 'kamchatka' | 'sakhalin';

type SelectedEntity =
  | { kind: 'route'; item: CertifiedTouristRoute }
  | { kind: 'office'; item: RcaRepresentationOffice };

const REGION_PRESETS: {
  id: RegionPresetId;
  label: string;
  center: [number, number];
  zoom: number;
}[] = [
  { id: 'dfo', label: 'Весь ДФО', center: [48.2, 141.5], zoom: 4 },
  { id: 'primorye', label: 'Приморский край', center: [44.2, 134.2], zoom: 6 },
  { id: 'khabarovsk', label: 'Хабаровский край', center: [49.0, 136.4], zoom: 6 },
  { id: 'kamchatka', label: 'Камчатка', center: [52.95, 158.45], zoom: 7 },
  { id: 'sakhalin', label: 'Сахалин', center: [47.2, 142.85], zoom: 7 },
];

const TRACK_COLORS: Record<CertifiedTouristRoute['track'], string> = {
  hiking: '#0F766E', // teal-700
  water: '#0369A1', // sky-700
  expedition: '#B45309', // amber-700
};

const OFFICE_COLORS: Record<RcaRepresentationOffice['officeType'], string> = {
  headquarters: '#0F172A', // slate-900
  polygon: '#0F766E', // teal-700
  commission: '#7C2D12', // orange-900
  partner: '#475569', // slate-600
};

function createOfficeDivIcon(
  office: RcaRepresentationOffice,
  isSelected: boolean
): L.DivIcon {
  const bg = OFFICE_COLORS[office.officeType];
  const size = office.officeType === 'headquarters' ? 30 : 24;
  const ring = isSelected ? 'box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.35);' : '';
  const badgeText =
    office.officeType === 'headquarters'
      ? 'РЦА'
      : office.officeType === 'polygon'
        ? 'ПЛГ'
        : 'П';

  return L.divIcon({
    className: 'rca-leaflet-office-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:8px;background:${bg};color:#fff;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:${office.officeType === 'headquarters' ? 9 : 10}px;font-weight:700;letter-spacing:-0.02em;${ring}box-shadow:0 2px 6px rgba(15,23,42,0.28);">${badgeText}</div>`,
  });
}

function createRouteStartDivIcon(
  route: CertifiedTouristRoute,
  isSelected: boolean
): L.DivIcon {
  const color = TRACK_COLORS[route.track];
  const size = isSelected ? 18 : 14;
  const ring = isSelected ? `box-shadow: 0 0 0 4px rgba(15, 118, 110, 0.25);` : '';

  return L.divIcon({
    className: 'rca-leaflet-route-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2.5px solid #fff;${ring}box-shadow:0 1px 4px rgba(15,23,42,0.25);"></div>`,
  });
}

interface CameraTarget {
  bounds?: [number, number][];
  center?: [number, number];
  zoom?: number;
  nonce: number;
}

const MapCameraController: React.FC<{ target: CameraTarget | null }> = ({ target }) => {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    if (target.bounds && target.bounds.length > 1) {
      map.flyToBounds(target.bounds, {
        padding: [48, 48],
        maxZoom: 10,
        duration: 0.7,
      });
    } else if (target.center) {
      map.flyTo(target.center, target.zoom ?? 7, { duration: 0.7 });
    }
  }, [map, target]);

  return null;
};

export const DfoGeographyLeafletMap: React.FC = () => {
  const [layerFilter, setLayerFilter] = useState<LayerFilter>('all');
  const [trackFilter, setTrackFilter] = useState<TrackFilter>('all');
  const [basemap, setBasemap] = useState<BasemapStyle>('light');
  const [activePreset, setActivePreset] = useState<RegionPresetId>('primorye');
  const [selected, setSelected] = useState<SelectedEntity>({
    kind: 'office',
    item: RCA_REPRESENTATIONS[0],
  });
  const [cameraTarget, setCameraTarget] = useState<CameraTarget | null>(null);

  const visibleRoutes = useMemo(() => {
    if (layerFilter === 'offices') return [];
    if (trackFilter === 'all') return CERTIFIED_TOURIST_ROUTES;
    return CERTIFIED_TOURIST_ROUTES.filter((r) => r.track === trackFilter);
  }, [layerFilter, trackFilter]);

  const visibleOffices = useMemo(() => {
    if (layerFilter === 'routes') return [];
    return RCA_REPRESENTATIONS;
  }, [layerFilter]);

  const handleSelectPreset = (preset: (typeof REGION_PRESETS)[number]) => {
    setActivePreset(preset.id);
    setCameraTarget({
      center: preset.center,
      zoom: preset.zoom,
      nonce: Date.now(),
    });
    tracker.trackCustomInteraction(`Leaflet ДФО: фокус ${preset.label}`);
  };

  const handleSelectRoute = (route: CertifiedTouristRoute) => {
    setSelected({ kind: 'route', item: route });
    setCameraTarget({
      bounds: route.coordinates,
      nonce: Date.now(),
    });
    tracker.trackCustomInteraction(`Leaflet маршрут: ${route.shortName}`, route.difficultyCategory);
  };

  const handleSelectOffice = (office: RcaRepresentationOffice) => {
    setSelected({ kind: 'office', item: office });
    setCameraTarget({
      center: office.coordinates,
      zoom: office.officeType === 'headquarters' ? 10 : 8,
      nonce: Date.now(),
    });
    tracker.trackCustomInteraction(`Leaflet представительство: ${office.shortName}`);
  };

  const linkedOfficeForRoute = useMemo(() => {
    if (selected.kind !== 'route') return null;
    return RCA_REPRESENTATIONS.find((o) => o.id === selected.item.officeId) ?? null;
  }, [selected]);

  const routesForOffice = useMemo(() => {
    if (selected.kind !== 'office') return [];
    return CERTIFIED_TOURIST_ROUTES.filter((r) => r.officeId === selected.item.id);
  }, [selected]);

  return (
    <section
      aria-labelledby="dfo-leaflet-map-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      {/* Header & Controls */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-teal-700">
            <Compass className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Геоинформационный контур ДФО · React-Leaflet</span>
          </div>
          <h2 id="dfo-leaflet-map-heading" className="text-xl font-bold text-slate-900">
            География сертифицированных туристических маршрутов и представительств РЦА
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Интерактивная карта действующих аттестационных площадок РЦА «Русский Восток» (ВВГУ),
            полевых полигонов и паспортизированных маршрутов Дальнего Востока с привязкой к
            требованиям ПП РФ № 760 и № 1893.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Layer toggle */}
          <div
            role="group"
            aria-label="Слои карты"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {(
              [
                { id: 'all', label: 'Все объекты' },
                { id: 'routes', label: `Маршруты (${CERTIFIED_TOURIST_ROUTES.length})` },
                { id: 'offices', label: `Представительства (${RCA_REPRESENTATIONS.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setLayerFilter(tab.id);
                  tracker.trackCustomInteraction(`Leaflet слой: ${tab.label}`);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  layerFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Basemap toggle */}
          <div
            role="group"
            aria-label="Подложка карты"
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
        </div>
      </div>

      {/* Sub-toolbar: Region Jump + Route Track Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-slate-500 mr-1 inline-flex items-center gap-1">
            <Navigation className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            Фокус:
          </span>
          {REGION_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelectPreset(preset)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                activePreset === preset.id
                  ? 'bg-teal-50 border-teal-300 text-teal-900'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {layerFilter !== 'offices' && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500 mr-1">Профиль маршрута:</span>
            {(
              [
                { id: 'all', label: 'Все виды' },
                { id: 'hiking', label: 'Пешеходный' },
                { id: 'water', label: 'Водный' },
                { id: 'expedition', label: 'Экспедиция' },
              ] as const
            ).map((tf) => (
              <button
                key={tf.id}
                type="button"
                onClick={() => setTrackFilter(tf.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                  trackFilter === tf.id
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Grid: Map Canvas + Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Leaflet Map Container (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="relative isolate z-0 h-[440px] sm:h-[500px] w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
            <MapContainer
              center={[44.2, 134.2]}
              zoom={6}
              scrollWheelZoom={true}
              className="w-full h-full"
            >
              <MapCameraController target={cameraTarget} />

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

              {/* Certified Tourist Routes (Polylines + Start Markers) */}
              {visibleRoutes.map((route) => {
                const isSelected =
                  selected.kind === 'route' && selected.item.id === route.id;
                const color = TRACK_COLORS[route.track];
                const startPoint = route.coordinates[0];

                return (
                  <React.Fragment key={route.id}>
                    <Polyline
                      positions={route.coordinates}
                      pathOptions={{
                        color,
                        weight: isSelected ? 5 : 3.2,
                        opacity: isSelected ? 0.95 : 0.72,
                        dashArray: route.track === 'expedition' ? '6 5' : undefined,
                      }}
                      eventHandlers={{
                        click: () => handleSelectRoute(route),
                      }}
                    >
                      <Tooltip sticky>
                        <div className="text-xs font-sans">
                          <div className="font-bold text-slate-900">{route.shortName}</div>
                          <div className="text-slate-600">
                            {route.trackLabel} · {route.difficultyCategory} · {route.lengthKm} км
                          </div>
                        </div>
                      </Tooltip>
                    </Polyline>

                    <Marker
                      position={startPoint}
                      icon={createRouteStartDivIcon(route, isSelected)}
                      eventHandlers={{
                        click: () => handleSelectRoute(route),
                      }}
                    >
                      <Popup>
                        <div className="space-y-1.5 min-w-[210px] font-sans">
                          <p className="text-[11px] font-semibold text-teal-700">
                            {route.trackLabel}
                          </p>
                          <p className="text-xs font-bold text-slate-900 leading-snug">
                            {route.name}
                          </p>
                          <p className="text-[11px] text-slate-600">
                            {route.difficultyCategory} · {route.lengthKm} км · {route.durationLabel}
                          </p>
                          <p className="text-[11px] text-slate-700 pt-1 border-t border-slate-200">
                            {route.passportStatus}
                          </p>
                        </div>
                      </Popup>
                    </Marker>

                    {isSelected &&
                      route.coordinates.slice(1).map((pt, idx) => (
                        <CircleMarker
                          key={`${route.id}-wp-${idx}`}
                          center={pt}
                          radius={4}
                          pathOptions={{
                            color: '#FFFFFF',
                            weight: 1.5,
                            fillColor: color,
                            fillOpacity: 0.9,
                          }}
                        />
                      ))}
                  </React.Fragment>
                );
              })}

              {/* RCA Representation Offices & Polygons */}
              {visibleOffices.map((office) => {
                const isSelected =
                  selected.kind === 'office' && selected.item.id === office.id;

                return (
                  <Marker
                    key={office.id}
                    position={office.coordinates}
                    icon={createOfficeDivIcon(office, isSelected)}
                    eventHandlers={{
                      click: () => handleSelectOffice(office),
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -12]}>
                      <span className="text-xs font-semibold">{office.shortName}</span>
                    </Tooltip>
                    <Popup>
                      <div className="space-y-1.5 min-w-[220px] font-sans">
                        <p className="text-[11px] font-semibold text-slate-500">
                          {office.officeTypeLabel}
                        </p>
                        <p className="text-xs font-bold text-slate-900 leading-snug">
                          {office.name}
                        </p>
                        <p className="text-[11px] text-slate-600">{office.address}</p>
                        <p className="text-[11px] font-medium text-teal-800 pt-1 border-t border-slate-200">
                          {office.certifiedCountLabel}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>

          {/* Map Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 h-1 rounded-full bg-teal-700" aria-hidden="true" />
                Пешеходный трек
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 h-1 rounded-full bg-sky-700" aria-hidden="true" />
                Водный маршрут
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-4 h-0.5 border-t-2 border-dashed border-amber-700"
                  aria-hidden="true"
                />
                Экспедиционный
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-slate-900 text-white font-mono text-[9px] font-bold"
                  aria-hidden="true"
                >
                  РЦА
                </span>
                Головной центр (ВВГУ)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-teal-700 text-white font-mono text-[9px] font-bold"
                  aria-hidden="true"
                >
                  ПЛГ
                </span>
                Полигон
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-slate-600 text-white font-mono text-[9px] font-bold"
                  aria-hidden="true"
                >
                  П
                </span>
                Площадка ДФО
              </span>
            </div>
          </div>
        </div>

        {/* Inspector + Directory (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-5">
          {/* Selected Object Card */}
          {selected.kind === 'route' ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <Route className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
                  <span className="font-medium text-teal-800">{selected.item.trackLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>{selected.item.regionName}</span>
                </div>
                <h3 className="mt-1.5 text-base sm:text-lg font-bold text-slate-900 leading-snug">
                  {selected.item.name}
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <p className="text-[11px] text-slate-500">Категория</p>
                  <p className="mt-1 text-xs sm:text-sm font-bold font-mono text-slate-900">
                    {selected.item.difficultyCategory}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <p className="text-[11px] text-slate-500">Протяжённость</p>
                  <p className="mt-1 text-xs sm:text-sm font-bold font-mono text-teal-800 tabular-nums">
                    {selected.item.lengthKm} км
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <p className="text-[11px] text-slate-500">Группа</p>
                  <p className="mt-1 text-xs font-semibold text-slate-900 leading-tight">
                    {selected.item.groupNorm}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed">
                {selected.item.keyHighlights}
              </p>

              <div className="border-t border-slate-200 pt-3 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  Требования аттестации и безопасности
                </p>
                <ul className="space-y-1 text-xs text-slate-700">
                  {selected.item.safetyProtocols.map((p) => (
                    <li key={p}>· {p}</li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-slate-200 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Статус: </span>
                  <span className="font-medium text-slate-900">{selected.item.passportStatus}</span>
                </div>
                {linkedOfficeForRoute && (
                  <button
                    type="button"
                    onClick={() => handleSelectOffice(linkedOfficeForRoute)}
                    className="text-xs font-semibold text-teal-700 hover:text-teal-900 underline underline-offset-2 cursor-pointer"
                  >
                    Площадка: {linkedOfficeForRoute.city}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <Building2 className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
                  <span className="font-medium text-teal-800">{selected.item.officeTypeLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>{selected.item.regionName}</span>
                </div>
                <h3 className="mt-1.5 text-base sm:text-lg font-bold text-slate-900 leading-snug">
                  {selected.item.name}
                </h3>
                <p className="mt-1 text-xs text-slate-600 flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{selected.item.address}</span>
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <p className="text-[11px] text-slate-500">Кадровый и аттестационный контур</p>
                <p className="mt-1 text-xs font-semibold font-mono text-teal-800">
                  {selected.item.certifiedCountLabel}
                </p>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed">{selected.item.curatorNote}</p>

              <div className="border-t border-slate-200 pt-3 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Функции представительства
                </p>
                <ul className="space-y-1 text-xs text-slate-700">
                  {selected.item.functions.map((fn) => (
                    <li key={fn}>· {fn}</li>
                  ))}
                </ul>
              </div>

              {routesForOffice.length > 0 && (
                <div className="border-t border-slate-200 pt-3 space-y-1.5">
                  <p className="text-[11px] font-semibold text-slate-500">
                    Курируемые маршруты ({routesForOffice.length}):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {routesForOffice.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleSelectRoute(r)}
                        className="px-2 py-1 bg-white border border-slate-200 rounded text-[11px] font-medium text-teal-800 hover:bg-teal-50 hover:border-teal-300 transition-colors cursor-pointer"
                      >
                        {r.shortName}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Directory: Offices & Routes */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 flex items-center justify-between">
              <span>Представительства РЦА и маршруты ДФО</span>
              <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                {visibleOffices.length} площ. · {visibleRoutes.length} маршр.
              </span>
            </div>

            <div className="divide-y divide-slate-200 max-h-[210px] overflow-y-auto">
              {visibleOffices.map((office) => {
                const isSelected =
                  selected.kind === 'office' && selected.item.id === office.id;
                return (
                  <button
                    key={office.id}
                    type="button"
                    onClick={() => handleSelectOffice(office)}
                    className={`w-full px-4 py-2.5 text-left text-xs flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-teal-50/80 font-semibold text-slate-900'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2 truncate">
                      <Building2
                        className="w-3.5 h-3.5 text-slate-700 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="truncate">{office.shortName}</span>
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 shrink-0">
                      РЦА
                    </span>
                  </button>
                );
              })}

              {visibleRoutes.map((route) => {
                const isSelected =
                  selected.kind === 'route' && selected.item.id === route.id;
                return (
                  <button
                    key={route.id}
                    type="button"
                    onClick={() => handleSelectRoute(route)}
                    className={`w-full px-4 py-2.5 text-left text-xs flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-teal-50/80 font-semibold text-slate-900'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: TRACK_COLORS[route.track] }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{route.shortName}</span>
                    </span>
                    <span className="font-mono text-[11px] text-slate-500 tabular-nums shrink-0">
                      {route.lengthKm} км · {route.difficultyCategory.split(' ')[0]} КС
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
