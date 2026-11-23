import * as d3 from 'd3';
import { DFO_REGIONS_DISTRIBUTION, type DfoRegionDistribution } from '../data/researchData.ts';

export type DfoD3MetricMode = 'density' | 'registry' | 'deficit' | 'coveragePct';

export type DensityTierId = 'high' | 'medium' | 'low';

export interface DfoSubjectGeometryFeature {
  type: 'Feature';
  id: string;
  properties: {
    id: string;
    name: string;
    shortName: string;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

export interface DfoProjectedSubject extends DfoRegionDistribution {
  pathData: string;
  centroid: [number, number];
  areaKm2: number;
  densityPer10kKm2: number;
  demandDensityPer10kKm2: number;
  densityTier: DensityTierId;
  densityTierLabel: string;
  densityVsDfoAvgRatio: number;
  deficit: number;
  coveragePct: number;
  registrySharePct: number;
}

export interface DfoD3MapLayout {
  width: number;
  height: number;
  graticulePath: string;
  subjects: DfoProjectedSubject[];
  totalAreaKm2: number;
  avgDensityPer10kKm2: number;
  maxDensityPer10kKm2: number;
  totalRegistry: number;
  totalDemand: number;
  totalDeficit: number;
  totalOct2026: number;
}

// Official territory sizes (km²) for the 7 DFO subjects/clusters
export const DFO_SUBJECT_AREA_KM2: Record<string, number> = {
  primorye: 164673,
  kamchatka: 464275,
  khabarovsk: 787633,
  sakhalin: 87101,
  yakutia: 3083523,
  amur: 361908,
  'magadan-chukotka': 1183945,
};

// Cartographically accurate approximate lon/lat polygons for the 7 statistical subjects/clusters of DFO
// Matching verified dataset entries in DFO_REGIONS_DISTRIBUTION.
// Longitudes east of 180° (Eastern Chukotka) use >180° continuity or spherical conic projection centered at 142°E.
const DFO_SUBJECT_GEOJSON: readonly DfoSubjectGeometryFeature[] = [
  {
    type: 'Feature',
    id: 'yakutia',
    properties: {
      id: 'yakutia',
      name: 'Республика Саха (Якутия)',
      shortName: 'Якутия',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [106.0, 72.5],
          [116.0, 73.5],
          [128.0, 73.2],
          [141.0, 72.4],
          [154.0, 71.2],
          [161.5, 69.5],
          [158.0, 66.2],
          [148.0, 64.5],
          [141.5, 61.8],
          [137.0, 58.6],
          [131.0, 56.4],
          [124.5, 56.2],
          [118.5, 57.2],
          [114.0, 59.5],
          [109.5, 62.5],
          [107.0, 66.5],
          [106.0, 72.5],
        ],
      ],
    },
  },
  {
    type: 'Feature',
    id: 'magadan-chukotka',
    properties: {
      id: 'magadan-chukotka',
      name: 'Магаданская область и Чукотский АО',
      shortName: 'Магадан / Чукотка',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [145.5, 64.3],
          [157.8, 66.2],
          [162.0, 69.5],
          [172.0, 70.0],
          [179.8, 68.8],
          [189.8, 66.1],
          [184.5, 64.0],
          [178.0, 62.6],
          [173.5, 61.2],
          [166.5, 60.5],
          [162.5, 62.0],
          [157.0, 61.5],
          [152.5, 59.5],
          [146.5, 59.4],
          [145.0, 62.0],
          [145.5, 64.3],
        ],
      ],
    },
  },
  {
    type: 'Feature',
    id: 'kamchatka',
    properties: {
      id: 'kamchatka',
      name: 'Камчатский край',
      shortName: 'Камчатка',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [157.0, 61.4],
          [163.0, 61.8],
          [171.5, 60.6],
          [165.0, 58.6],
          [163.2, 56.1],
          [161.8, 54.0],
          [158.6, 51.4],
          [156.6, 50.9],
          [155.8, 53.0],
          [156.2, 56.0],
          [157.6, 58.6],
          [157.0, 61.4],
        ],
      ],
    },
  },
  {
    type: 'Feature',
    id: 'amur',
    properties: {
      id: 'amur',
      name: 'Амурская область',
      shortName: 'Амурская обл.',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [119.5, 56.9],
          [125.0, 56.0],
          [131.5, 56.1],
          [134.8, 53.5],
          [132.8, 50.2],
          [130.6, 48.8],
          [127.5, 49.8],
          [125.5, 51.6],
          [121.6, 53.4],
          [119.5, 56.9],
        ],
      ],
    },
  },
  {
    type: 'Feature',
    id: 'khabarovsk',
    properties: {
      id: 'khabarovsk',
      name: 'Хабаровский край',
      shortName: 'Хабаровский кр.',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [131.8, 56.2],
          [137.4, 58.5],
          [144.8, 59.4],
          [143.2, 56.4],
          [139.6, 54.4],
          [141.3, 52.8],
          [140.4, 49.2],
          [138.6, 46.8],
          [135.2, 46.8],
          [133.4, 48.2],
          [131.2, 48.6],
          [133.0, 50.5],
          [134.8, 53.6],
          [131.8, 56.2],
        ],
      ],
    },
  },
  {
    type: 'Feature',
    id: 'sakhalin',
    properties: {
      id: 'sakhalin',
      name: 'Сахалинская область (и Курилы)',
      shortName: 'Сахалин и Курилы',
    },
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        // Sakhalin Island
        [
          [
            [141.9, 54.3],
            [143.2, 53.6],
            [143.5, 51.5],
            [144.6, 49.2],
            [143.4, 46.8],
            [142.1, 46.0],
            [141.8, 48.8],
            [142.0, 52.0],
            [141.9, 54.3],
          ],
        ],
        // Kuril Archipelago representative polygons (North + South Kurils)
        [
          [
            [145.6, 44.3],
            [148.5, 45.4],
            [149.2, 45.0],
            [146.2, 43.8],
            [145.6, 44.3],
          ],
        ],
        [
          [
            [151.8, 47.4],
            [155.4, 50.2],
            [156.1, 49.7],
            [152.5, 47.0],
            [151.8, 47.4],
          ],
        ],
      ],
    },
  },
  {
    type: 'Feature',
    id: 'primorye',
    properties: {
      id: 'primorye',
      name: 'Приморский край',
      shortName: 'Приморье',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [133.4, 48.0],
          [135.4, 46.7],
          [138.4, 46.6],
          [137.4, 44.6],
          [135.2, 42.9],
          [132.9, 42.7],
          [130.7, 42.4],
          [131.2, 44.6],
          [133.0, 45.8],
          [133.4, 48.0],
        ],
      ],
    },
  },
];

// Explicit visual label offsets for dense southern/coastal regions so labels never collide
export const DFO_LABEL_OFFSETS: Record<
  string,
  { dx: number; dy: number; anchor: 'start' | 'middle' | 'end' }
> = {
  yakutia: { dx: 0, dy: -22, anchor: 'middle' },
  'magadan-chukotka': { dx: 8, dy: -20, anchor: 'middle' },
  kamchatka: { dx: 26, dy: 4, anchor: 'start' },
  amur: { dx: -22, dy: 6, anchor: 'end' },
  khabarovsk: { dx: -24, dy: -8, anchor: 'end' },
  sakhalin: { dx: 22, dy: 14, anchor: 'start' },
  primorye: { dx: -20, dy: 18, anchor: 'end' },
};

export function buildDfoD3MapLayout(width = 760, height = 480): DfoD3MapLayout {
  const featureCollection = {
    type: 'FeatureCollection' as const,
    features: DFO_SUBJECT_GEOJSON as unknown as d3.GeoPermissibleObjects[],
  };

  // Conic Equal-Area centered on 142°E so Chukotka/Kamchatka/Yakutia/Primorye render smoothly
  const projection = d3
    .geoConicEqualArea()
    .rotate([-142, 0])
    .parallels([48, 66])
    .fitExtent(
      [
        [34, 24],
        [width - 34, height - 24],
      ],
      featureCollection as unknown as d3.GeoPermissibleObjects
    );

  const pathGenerator = d3.geoPath(projection);
  const graticule = d3.geoGraticule().step([10, 5]);
  const graticulePath = pathGenerator(graticule()) ?? '';

  const totalRegistry = DFO_REGIONS_DISTRIBUTION.reduce(
    (sum, r) => sum + r.certifiedInRegistry,
    0
  );
  const totalDemand = DFO_REGIONS_DISTRIBUTION.reduce(
    (sum, r) => sum + r.estimatedDemand,
    0
  );
  const totalOct2026 = DFO_REGIONS_DISTRIBUTION.reduce(
    (sum, r) => sum + r.october2026Certified,
    0
  );

  const totalAreaKm2 = DFO_REGIONS_DISTRIBUTION.reduce(
    (sum, r) => sum + (DFO_SUBJECT_AREA_KM2[r.id] ?? 100000),
    0
  );
  const avgDensityPer10kKm2 =
    Math.round(((totalRegistry / Math.max(totalAreaKm2, 1)) * 10000) * 100) / 100;

  const featureById = new Map(DFO_SUBJECT_GEOJSON.map((f) => [f.id, f]));

  const subjects: DfoProjectedSubject[] = DFO_REGIONS_DISTRIBUTION.map((region) => {
    const feature = featureById.get(region.id);
    const geoObj = feature as unknown as d3.GeoPermissibleObjects | undefined;
    const pathData = geoObj ? (pathGenerator(geoObj) ?? region.svgPath) : region.svgPath;
    const rawCentroid = geoObj ? pathGenerator.centroid(geoObj) : [region.cx, region.cy];
    const centroid: [number, number] = [
      Number.isFinite(rawCentroid[0]) ? rawCentroid[0] : region.cx,
      Number.isFinite(rawCentroid[1]) ? rawCentroid[1] : region.cy,
    ];

    const areaKm2 = DFO_SUBJECT_AREA_KM2[region.id] ?? 100000;
    const densityPer10kKm2 =
      Math.round(((region.certifiedInRegistry / areaKm2) * 10000) * 100) / 100;
    const demandDensityPer10kKm2 =
      Math.round(((region.estimatedDemand / areaKm2) * 10000) * 100) / 100;

    let densityTier: DensityTierId = 'low';
    let densityTierLabel = 'Низкая плотность';
    if (densityPer10kKm2 >= 5) {
      densityTier = 'high';
      densityTierLabel = 'Высокая плотность';
    } else if (densityPer10kKm2 >= 0.4) {
      densityTier = 'medium';
      densityTierLabel = 'Средняя плотность';
    }

    const densityVsDfoAvgRatio =
      Math.round((densityPer10kKm2 / Math.max(avgDensityPer10kKm2, 0.01)) * 10) / 10;

    const deficit = Math.max(0, region.estimatedDemand - region.certifiedInRegistry);
    const coveragePct =
      Math.round((region.certifiedInRegistry / Math.max(region.estimatedDemand, 1)) * 1000) / 10;
    const registrySharePct = Math.round(
      (region.certifiedInRegistry / Math.max(totalRegistry, 1)) * 100
    );

    return {
      ...region,
      pathData,
      centroid,
      areaKm2,
      densityPer10kKm2,
      demandDensityPer10kKm2,
      densityTier,
      densityTierLabel,
      densityVsDfoAvgRatio,
      deficit,
      coveragePct,
      registrySharePct,
    };
  });

  const maxDensityPer10kKm2 = Math.max(...subjects.map((s) => s.densityPer10kKm2), 0.1);

  return {
    width,
    height,
    graticulePath,
    subjects,
    totalAreaKm2,
    avgDensityPer10kKm2,
    maxDensityPer10kKm2,
    totalRegistry,
    totalDemand,
    totalDeficit: Math.max(0, totalDemand - totalRegistry),
    totalOct2026,
  };
}

export function getDfoSubjectMetricValue(
  subject: DfoProjectedSubject,
  mode: DfoD3MetricMode
): number {
  if (mode === 'density') return subject.densityPer10kKm2;
  if (mode === 'registry') return subject.certifiedInRegistry;
  if (mode === 'deficit') return subject.deficit;
  return subject.coveragePct;
}

export function formatDfoSubjectMetricLabel(
  subject: DfoProjectedSubject,
  mode: DfoD3MetricMode
): string {
  if (mode === 'density') return subject.densityPer10kKm2.toFixed(2).replace('.', ',');
  if (mode === 'registry') return String(subject.certifiedInRegistry);
  if (mode === 'deficit') return String(subject.deficit);
  return `${subject.coveragePct.toFixed(0)}%`;
}

export function createDfoD3ColorScale(
  subjects: readonly DfoProjectedSubject[],
  mode: DfoD3MetricMode
): d3.ScaleSequential<string, never> {
  const values = subjects.map((s) => getDfoSubjectMetricValue(s, mode));
  const maxVal = Math.max(...values, 1);

  if (mode === 'density') {
    return d3
      .scaleSequential(d3.interpolateRgbBasis(['#F1F5F9', '#99F6E4', '#0F766E', '#115E59']))
      .domain([0, Math.max(maxVal, 7.5)]);
  }
  if (mode === 'deficit') {
    return d3
      .scaleSequential(d3.interpolateRgbBasis(['#FEF3C7', '#F59E0B', '#B91C1C']))
      .domain([0, maxVal]);
  }
  if (mode === 'coveragePct') {
    return d3
      .scaleSequential(d3.interpolateRgbBasis(['#E2E8F0', '#5EEAD4', '#0F766E']))
      .domain([0, Math.max(maxVal, 40)]);
  }
  return d3
    .scaleSequential(d3.interpolateRgbBasis(['#F1F5F9', '#99F6E4', '#0F766E']))
    .domain([0, maxVal]);
}

export function createDfoD3RadiusScale(
  subjects: readonly DfoProjectedSubject[],
  mode: DfoD3MetricMode
): d3.ScalePower<number, number, never> {
  const maxVal = Math.max(
    ...subjects.map((s) => getDfoSubjectMetricValue(s, mode)),
    1
  );
  return d3.scaleSqrt().domain([0, maxVal]).range([10, 26]);
}
