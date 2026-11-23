import type { CertifiedTouristRoute } from '../data/researchData.ts';

export type DfoMapRegionId =
  | 'all'
  | 'primorye'
  | 'khabarovsk'
  | 'kamchatka'
  | 'sakhalin';

export type DfoAttestationFilterId =
  | 'all'
  | 'hiking'
  | 'water'
  | 'expedition'
  | 'high_complexity';

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export interface DfoRegionCameraPreset {
  id: DfoMapRegionId;
  label: string;
  center: LatLngPoint;
  zoom: number;
}

export const DFO_REGION_CAMERA_PRESETS: readonly DfoRegionCameraPreset[] = [
  { id: 'all', label: 'Весь ДФО', center: { lat: 47.6, lng: 141.5 }, zoom: 4 },
  { id: 'primorye', label: 'Приморский край', center: { lat: 44.3, lng: 134.2 }, zoom: 6 },
  { id: 'khabarovsk', label: 'Хабаровский край', center: { lat: 49.25, lng: 137.2 }, zoom: 7 },
  { id: 'kamchatka', label: 'Камчатка', center: { lat: 52.85, lng: 158.45 }, zoom: 8 },
  { id: 'sakhalin', label: 'Сахалин', center: { lat: 47.15, lng: 142.95 }, zoom: 7 },
];

export const ROUTE_TRACK_STROKE_COLORS: Record<CertifiedTouristRoute['track'], string> = {
  hiking: '#0F766E',
  water: '#0369A1',
  expedition: '#B45309',
};

export function toLatLngPath(coords: readonly [number, number][]): LatLngPoint[] {
  return coords.map(([lat, lng]) => ({ lat, lng }));
}

export function getRouteMarkerPosition(route: CertifiedTouristRoute): LatLngPoint {
  const first = route.coordinates[0];
  if (!first) {
    return { lat: 43.1155, lng: 131.8855 };
  }
  return { lat: first[0], lng: first[1] };
}

export function isHighComplexityAttestation(route: CertifiedTouristRoute): boolean {
  return (
    route.track === 'expedition' ||
    /3|4|ООПТ|комбинированный/i.test(route.difficultyCategory)
  );
}

export function getAttestationPinBadge(route: CertifiedTouristRoute): string {
  const ksMatch = route.difficultyCategory.match(/\d(?:[–-]\d)?\s*КС/i);
  if (ksMatch) {
    return ksMatch[0].replace(/\s+/g, ' ').toUpperCase();
  }
  return 'ГИД КС';
}

export function getGuideRequirementSummary(route: CertifiedTouristRoute): string {
  if (/ООПТ/i.test(route.difficultyCategory) || /ООПТ/i.test(route.passportStatus)) {
    return `Аттестованный гид (${route.difficultyCategory}) · пропуск и реестр на кордоне ООПТ`;
  }
  if (/комбинированный/i.test(route.difficultyCategory)) {
    return `Комбинированная аттестация (пешеходный + водный туризм) · ${route.difficultyCategory}`;
  }
  if (route.track === 'water') {
    return `Аттестованный инструктор-проводник по водному туризму · ${route.difficultyCategory}`;
  }
  if (route.track === 'expedition') {
    return `Аттестованный проводник (автономные маршруты) · ${route.difficultyCategory}`;
  }
  return `Аттестованный инструктор-проводник (132-ФЗ / ПП № 1893) · ${route.difficultyCategory}`;
}

export function filterDfoTouristRoutes(
  routes: readonly CertifiedTouristRoute[],
  regionFilter: DfoMapRegionId,
  attestationFilter: DfoAttestationFilterId
): CertifiedTouristRoute[] {
  return routes.filter((route) => {
    if (regionFilter !== 'all' && route.regionId !== regionFilter) {
      return false;
    }
    if (attestationFilter === 'high_complexity') {
      return isHighComplexityAttestation(route);
    }
    if (attestationFilter !== 'all' && route.track !== attestationFilter) {
      return false;
    }
    return true;
  });
}

export function sortRoutesForMarkerStacking(
  routes: readonly CertifiedTouristRoute[]
): { route: CertifiedTouristRoute; baseZIndex: number; position: LatLngPoint }[] {
  return [...routes]
    .sort((a, b) => getRouteMarkerPosition(b).lat - getRouteMarkerPosition(a).lat)
    .map((route, index) => ({
      route,
      baseZIndex: index + 1,
      position: getRouteMarkerPosition(route),
    }));
}
