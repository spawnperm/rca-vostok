import {
  GUIDE_TRACK_LABELS,
  type CertifiedGuideRecord,
  type GuideTrack,
} from '../domain/certification/GuideLeaderboard.ts';
import {
  formatDateIsoUtc,
  formatDateRuUtc,
  parseIsoDateUtc,
} from './format.ts';

export type CertificateValidityFilter =
  | 'all'
  | 'expiring_12m'
  | 'mid_term_2027_2029'
  | 'long_term_2030_plus';

export type RegistrySortField =
  | 'validUntil'
  | 'fullName'
  | 'region'
  | 'routes'
  | 'experience';

export interface CertifiedGuideRegistryRow extends CertifiedGuideRecord {
  trackLabel: string;
  attestedAtFormatted: string;
  validUntilIso: string;
  validUntilFormatted: string;
  validUntilYear: number;
  monthsRemaining: number;
  validityBand: Exclude<CertificateValidityFilter, 'all'>;
  validityStatusLabel: string;
}

export interface CertifiedGuidesRegistryFilter {
  region?: string;
  track?: 'all' | GuideTrack;
  validity?: CertificateValidityFilter;
  search?: string;
  sortBy?: RegistrySortField;
  sortDir?: 'asc' | 'desc';
}

const VALIDITY_PERIOD_YEARS = 5;

export function computeValidUntilDate(lastAttestationDate: string): Date {
  const issued = parseIsoDateUtc(lastAttestationDate);
  return new Date(
    Date.UTC(
      issued.getUTCFullYear() + VALIDITY_PERIOD_YEARS,
      issued.getUTCMonth(),
      issued.getUTCDate()
    )
  );
}

export function enrichCertifiedGuideForRegistry(
  record: CertifiedGuideRecord,
  referenceDate: Date = new Date()
): CertifiedGuideRegistryRow {
  const issued = parseIsoDateUtc(record.lastAttestationDate);
  const validUntil = computeValidUntilDate(record.lastAttestationDate);
  const validUntilYear = validUntil.getUTCFullYear();

  const refUtc = Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate()
  );
  const diffDays = Math.round((validUntil.getTime() - refUtc) / (1000 * 60 * 60 * 24));
  const monthsRemaining = Math.max(0, Math.round(diffDays / 30.4375));

  let validityBand: Exclude<CertificateValidityFilter, 'all'> = 'long_term_2030_plus';
  let validityStatusLabel = 'Действует до 2030+';

  if (monthsRemaining <= 12) {
    validityBand = 'expiring_12m';
    validityStatusLabel =
      diffDays <= 0 ? 'Требует продления' : `Истекает через ${monthsRemaining} мес.`;
  } else if (validUntilYear <= 2029) {
    validityBand = 'mid_term_2027_2029';
    validityStatusLabel = `До ${validUntilYear} г. (${monthsRemaining} мес.)`;
  } else {
    validityBand = 'long_term_2030_plus';
    validityStatusLabel = `До ${validUntilYear} г. (${monthsRemaining} мес.)`;
  }

  return {
    ...record,
    trackLabel: GUIDE_TRACK_LABELS[record.track] ?? record.track,
    attestedAtFormatted: formatDateRuUtc(issued),
    validUntilIso: formatDateIsoUtc(validUntil),
    validUntilFormatted: formatDateRuUtc(validUntil),
    validUntilYear,
    monthsRemaining,
    validityBand,
    validityStatusLabel,
  };
}

export function filterCertifiedGuidesRegistry(
  records: readonly CertifiedGuideRecord[],
  filter: CertifiedGuidesRegistryFilter = {},
  referenceDate: Date = new Date()
): {
  rows: CertifiedGuideRegistryRow[];
  totalActive: number;
  availableRegions: string[];
  availableTracks: { id: GuideTrack; label: string; count: number }[];
  expiringCount: number;
} {
  const activeRecords = records.filter((r) => r.isActive);
  const enrichedAll = activeRecords.map((r) =>
    enrichCertifiedGuideForRegistry(r, referenceDate)
  );

  const region = filter.region?.trim();
  const track = filter.track ?? 'all';
  const validity = filter.validity ?? 'all';
  const needle = filter.search?.trim().toLowerCase() ?? '';
  const sortBy = filter.sortBy ?? 'validUntil';
  const sortDir = filter.sortDir ?? 'asc';

  const filtered = enrichedAll.filter((row) => {
    if (region && region !== 'all' && row.region !== region) return false;
    if (track !== 'all' && row.track !== track) return false;
    if (validity !== 'all' && row.validityBand !== validity) return false;
    if (needle) {
      const hay =
        `${row.fullName} ${row.registryNumber} ${row.organisation} ${row.region} ${row.trackLabel}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  const dirMult = sortDir === 'desc' ? -1 : 1;
  filtered.sort((a, b) => {
    if (sortBy === 'fullName') {
      return a.fullName.localeCompare(b.fullName, 'ru') * dirMult;
    }
    if (sortBy === 'region') {
      return a.region.localeCompare(b.region, 'ru') * dirMult;
    }
    if (sortBy === 'routes') {
      return (a.certifiedRoutesCount - b.certifiedRoutesCount) * dirMult;
    }
    if (sortBy === 'experience') {
      return (a.experienceYears - b.experienceYears) * dirMult;
    }
    // validUntil
    const cmp = a.validUntilIso.localeCompare(b.validUntilIso);
    if (cmp !== 0) return cmp * dirMult;
    return a.fullName.localeCompare(b.fullName, 'ru');
  });

  const availableRegions = Array.from(
    new Set(enrichedAll.map((r) => r.region))
  ).sort((a, b) => a.localeCompare(b, 'ru'));

  const trackCounts = new Map<GuideTrack, number>();
  for (const r of enrichedAll) {
    trackCounts.set(r.track, (trackCounts.get(r.track) ?? 0) + 1);
  }
  const availableTracks = (Object.keys(GUIDE_TRACK_LABELS) as GuideTrack[]).map((t) => ({
    id: t,
    label: GUIDE_TRACK_LABELS[t],
    count: trackCounts.get(t) ?? 0,
  }));

  const expiringCount = enrichedAll.filter((r) => r.validityBand === 'expiring_12m').length;

  return {
    rows: filtered,
    totalActive: enrichedAll.length,
    availableRegions,
    availableTracks,
    expiringCount,
  };
}
