import { ValidationError } from '../shared/DomainError.ts';
import {
  getJournalRegionById,
  type DfoJournalRegionId,
} from './ExperienceEntry.ts';

export interface GpxTrackPoint {
  lat: number;
  lon: number;
  ele?: number;
  timeIso?: string;
}

export interface ParsedGpxTrackResult {
  fileName: string;
  routeTitle: string;
  date: string | null; // YYYY-MM-DD
  regionId: DfoJournalRegionId;
  regionName: string;
  regionMatchType: 'polygon' | 'nearest' | 'default';
  distanceKm: number;
  elevationGainM: number | null;
  pointsCount: number;
  segmentsCount: number;
  centroid: {
    lat: number;
    lon: number;
  };
  startPoint: {
    lat: number;
    lon: number;
  };
  finishPoint: {
    lat: number;
    lon: number;
  };
  suggestedNotes: string;
}

const EARTH_RADIUS_KM = 6371.0088;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineDistanceKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

/**
 * Representative [lon, lat] polygons matching the 7 DFO statistical regions in dfoD3MapData.ts.
 * Longitudes east of 180° (Eastern Chukotka) use >180° continuity.
 */
const DFO_REGION_POLYGONS: ReadonlyArray<{
  id: DfoJournalRegionId;
  centroid: { lat: number; lon: number };
  rings: readonly (readonly [number, number][])[];
}> = [
  {
    id: 'primorye',
    centroid: { lat: 44.8, lon: 134.8 },
    rings: [
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
  {
    id: 'sakhalin',
    centroid: { lat: 49.8, lon: 143.0 },
    rings: [
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
      [
        [145.6, 44.3],
        [148.5, 45.4],
        [149.2, 45.0],
        [146.2, 43.8],
        [145.6, 44.3],
      ],
      [
        [151.8, 47.4],
        [155.4, 50.2],
        [156.1, 49.7],
        [152.5, 47.0],
        [151.8, 47.4],
      ],
    ],
  },
  {
    id: 'kamchatka',
    centroid: { lat: 55.6, lon: 159.5 },
    rings: [
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
  {
    id: 'khabarovsk',
    centroid: { lat: 52.2, lon: 136.5 },
    rings: [
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
  {
    id: 'amur',
    centroid: { lat: 52.8, lon: 127.6 },
    rings: [
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
  {
    id: 'yakutia',
    centroid: { lat: 64.8, lon: 128.5 },
    rings: [
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
  {
    id: 'magadan-chukotka',
    centroid: { lat: 63.8, lon: 162.5 },
    rings: [
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
];

function pointInRing(lon: number, lat: number, ring: readonly [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function resolveDfoRegionFromCoordinates(
  lat: number,
  lon: number
): { regionId: DfoJournalRegionId; regionName: string; matchType: 'polygon' | 'nearest' | 'default' } {
  // Normalize Western Hemisphere Chukotka longitudes (e.g. -175° -> +185°)
  const normLon = lon < -150 ? lon + 360 : lon;

  for (const poly of DFO_REGION_POLYGONS) {
    for (const ring of poly.rings) {
      if (pointInRing(normLon, lat, ring)) {
        const reg = getJournalRegionById(poly.id);
        return {
          regionId: reg.id,
          regionName: reg.name,
          matchType: 'polygon',
        };
      }
    }
  }

  // Within broad Far East bounds, pick nearest DFO subject centroid (e.g. coastal/offshore tracks)
  if (lat >= 38 && lat <= 77 && normLon >= 100 && normLon <= 198) {
    let bestId: DfoJournalRegionId = 'primorye';
    let bestDist = Infinity;
    for (const poly of DFO_REGION_POLYGONS) {
      const dist = haversineDistanceKm(
        { lat, lon: normLon > 180 ? normLon - 360 : normLon },
        poly.centroid
      );
      if (dist < bestDist) {
        bestDist = dist;
        bestId = poly.id;
      }
    }
    const reg = getJournalRegionById(bestId);
    return {
      regionId: reg.id,
      regionName: reg.name,
      matchType: 'nearest',
    };
  }

  const fallback = getJournalRegionById('primorye');
  return {
    regionId: fallback.id,
    regionName: fallback.name,
    matchType: 'default',
  };
}

function decodeXmlText(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFirstTagText(xml: string, tagName: string): string | null {
  const re = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const m = re.exec(xml);
  if (!m) return null;
  const decoded = decodeXmlText(m[1]);
  return decoded || null;
}

function parseGpxIsoDate(rawTime: string | null | undefined): string | null {
  if (!rawTime) return null;
  const trimmed = rawTime.trim();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  if (!match) return null;
  const iso = match[1];
  const ts = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(ts) ? null : iso;
}

function parsePointsFromFragment(
  fragment: string,
  tagName: 'trkpt' | 'rtept' | 'wpt'
): GpxTrackPoint[] {
  const points: GpxTrackPoint[] = [];
  const tagRe = new RegExp(
    `<${tagName}\\b([^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/${tagName}>)`,
    'gi'
  );

  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(fragment)) !== null) {
    const attrs = match[1] ?? '';
    const inner = match[2] ?? '';

    const latMatch = /\blat\s*=\s*["']\s*([+-]?\d+(?:\.\d+)?)\s*["']/i.exec(attrs);
    const lonMatch = /\blon\s*=\s*["']\s*([+-]?\d+(?:\.\d+)?)\s*["']/i.exec(attrs);
    if (!latMatch || !lonMatch) continue;

    const lat = Number.parseFloat(latMatch[1]);
    const lon = Number.parseFloat(lonMatch[1]);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      continue;
    }

    const eleText = inner ? extractFirstTagText(inner, 'ele') : null;
    const ele =
      eleText !== null && Number.isFinite(Number.parseFloat(eleText))
        ? Number.parseFloat(eleText)
        : undefined;

    const timeText = inner ? extractFirstTagText(inner, 'time') : null;

    points.push({
      lat,
      lon,
      ele,
      timeIso: timeText ?? undefined,
    });
  }

  return points;
}

function cleanFileNameTitle(fileName?: string): string {
  if (!fileName) return '';
  return fileName.replace(/\.gpx$/i, '').replace(/[_]+/g, ' ').trim();
}

export function parseGpxTrack(
  gpxXml: string,
  fileName = 'track.gpx'
): ParsedGpxTrackResult {
  if (typeof gpxXml !== 'string' || !gpxXml.trim()) {
    throw new ValidationError('Файл GPX пуст.');
  }

  if (!/<gpx[\s>]/i.test(gpxXml)) {
    throw new ValidationError('Файл не соответствует формату GPX (отсутствует тег <gpx>).');
  }

  // Extract segments from <trkseg> blocks first; otherwise direct <trkpt>, <rtept>, or <wpt>
  const segments: GpxTrackPoint[][] = [];
  const segRe = /<trkseg(?:\s[^>]*)?>([\s\S]*?)<\/trkseg>/gi;
  let segMatch: RegExpExecArray | null;
  while ((segMatch = segRe.exec(gpxXml)) !== null) {
    const pts = parsePointsFromFragment(segMatch[1], 'trkpt');
    if (pts.length > 0) segments.push(pts);
  }

  if (segments.length === 0) {
    const directTrk = parsePointsFromFragment(gpxXml, 'trkpt');
    if (directTrk.length > 0) {
      segments.push(directTrk);
    }
  }

  if (segments.length === 0) {
    const rtePts = parsePointsFromFragment(gpxXml, 'rtept');
    if (rtePts.length > 0) {
      segments.push(rtePts);
    }
  }

  if (segments.length === 0) {
    const wptPts = parsePointsFromFragment(gpxXml, 'wpt');
    if (wptPts.length > 0) {
      segments.push(wptPts);
    }
  }

  const allPoints = segments.flat();
  if (allPoints.length === 0) {
    throw new ValidationError(
      'В GPX-файле не найдено координатных точек маршрута (<trkpt>, <rtept> или <wpt>).'
    );
  }

  // Sum Haversine distance segment-by-segment
  let rawDistanceKm = 0;
  for (const seg of segments) {
    for (let i = 1; i < seg.length; i += 1) {
      rawDistanceKm += haversineDistanceKm(seg[i - 1], seg[i]);
    }
  }
  const distanceKm =
    rawDistanceKm > 0
      ? Math.max(0.1, Math.round(rawDistanceKm * 10) / 10)
      : 0;

  // Elevation gain (filter small GPS noise < 2m)
  let hasEle = false;
  let gainSum = 0;
  for (const seg of segments) {
    let prevEle: number | null = null;
    for (const pt of seg) {
      if (pt.ele !== undefined) {
        hasEle = true;
        if (prevEle !== null) {
          const diff = pt.ele - prevEle;
          if (diff >= 2) {
            gainSum += diff;
          }
        }
        prevEle = pt.ele;
      }
    }
  }
  const elevationGainM = hasEle ? Math.round(gainSum) : null;

  // Earliest timestamp across trackpoints or metadata
  const candidateTimes: string[] = [];
  for (const pt of allPoints) {
    const d = parseGpxIsoDate(pt.timeIso);
    if (d) candidateTimes.push(d);
  }
  const metaMatch = /<metadata\b[^>]*>([\s\S]*?)<\/metadata>/i.exec(gpxXml);
  const metaDate = metaMatch ? parseGpxIsoDate(extractFirstTagText(metaMatch[1], 'time')) : null;
  if (metaDate) candidateTimes.push(metaDate);
  const rootTime = parseGpxIsoDate(extractFirstTagText(gpxXml, 'time'));
  if (rootTime) candidateTimes.push(rootTime);

  candidateTimes.sort();
  const date = candidateTimes[0] ?? null;

  // Route title: <trk><name>, <rte><name>, <metadata><name>, filename
  const trkBlock = /<trk\b[^>]*>([\s\S]*?)<\/trk>/i.exec(gpxXml);
  const rteBlock = /<rte\b[^>]*>([\s\S]*?)<\/rte>/i.exec(gpxXml);
  const trkName = trkBlock ? extractFirstTagText(trkBlock[1], 'name') : null;
  const rteName = rteBlock ? extractFirstTagText(rteBlock[1], 'name') : null;
  const metaName = metaMatch ? extractFirstTagText(metaMatch[1], 'name') : null;

  // Compute centroid & resolve DFO region
  const latSum = allPoints.reduce((acc, p) => acc + p.lat, 0);
  const lonSum = allPoints.reduce((acc, p) => acc + (p.lon < -150 ? p.lon + 360 : p.lon), 0);
  const centroidLat = Math.round((latSum / allPoints.length) * 10000) / 10000;
  let centroidLon = Math.round((lonSum / allPoints.length) * 10000) / 10000;
  if (centroidLon > 180) centroidLon = Math.round((centroidLon - 360) * 10000) / 10000;

  const regionResolved = resolveDfoRegionFromCoordinates(centroidLat, centroidLon);

  const routeTitle = (
    trkName ||
    rteName ||
    metaName ||
    cleanFileNameTitle(fileName) ||
    `Маршрут GPX · ${regionResolved.regionName}`
  ).slice(0, 140);

  const noteParts = [
    `GPX-трек: ${distanceKm.toFixed(1)} км`,
    elevationGainM !== null && elevationGainM > 0 ? `набор +${elevationGainM} м` : null,
    `${allPoints.length} GPS-точек`,
  ].filter(Boolean);

  const firstPt = allPoints[0];
  const lastPt = allPoints[allPoints.length - 1];

  return {
    fileName,
    routeTitle,
    date,
    regionId: regionResolved.regionId,
    regionName: regionResolved.regionName,
    regionMatchType: regionResolved.matchType,
    distanceKm,
    elevationGainM,
    pointsCount: allPoints.length,
    segmentsCount: segments.length,
    centroid: { lat: centroidLat, lon: centroidLon },
    startPoint: {
      lat: Math.round(firstPt.lat * 10000) / 10000,
      lon: Math.round(firstPt.lon * 10000) / 10000,
    },
    finishPoint: {
      lat: Math.round(lastPt.lat * 10000) / 10000,
      lon: Math.round(lastPt.lon * 10000) / 10000,
    },
    suggestedNotes: noteParts.join(' · '),
  };
}

export const SAMPLE_DFO_GPX_TRACK = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RCA Vostok" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Хребет Ливадийский — восхождение на г. Пидан</name>
    <time>2026-09-19T00:15:00Z</time>
  </metadata>
  <trk>
    <name>Хребет Ливадийский — траверс г. Пидан (GPX)</name>
    <trkseg>
      <trkpt lat="43.0582" lon="132.6815"><ele>290</ele><time>2026-09-19T00:20:00Z</time></trkpt>
      <trkpt lat="43.0655" lon="132.6848"><ele>520</ele><time>2026-09-19T01:30:00Z</time></trkpt>
      <trkpt lat="43.0731" lon="132.6901"><ele>960</ele><time>2026-09-19T03:05:00Z</time></trkpt>
      <trkpt lat="43.0789" lon="132.6934"><ele>1332</ele><time>2026-09-19T04:40:00Z</time></trkpt>
      <trkpt lat="43.0680" lon="132.7052"><ele>740</ele><time>2026-09-19T06:20:00Z</time></trkpt>
      <trkpt lat="43.0588" lon="132.6820"><ele>295</ele><time>2026-09-19T08:10:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`;
