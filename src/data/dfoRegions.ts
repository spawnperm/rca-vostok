/**
 * Canonical list of Far Eastern Federal District (DFO) subjects and regional presets
 * shared across profile forms, calendars, readiness surveys, and certificate builders.
 */
export const DFO_REGIONS = [
  'Приморский край',
  'Камчатский край',
  'Хабаровский край',
  'Сахалинская область',
  'Республика Саха (Якутия)',
  'Амурская область',
  'Магаданская область',
  'Чукотский АО',
] as const;

export const DFO_CORE_SIX_REGIONS = [
  'Приморский край',
  'Хабаровский край',
  'Камчатский край',
  'Сахалинская область',
  'Амурская область',
  'Республика Саха (Якутия)',
] as const;

export const DFO_INQUIRY_REGIONS = [
  'Приморский край',
  'Хабаровский край',
  'Камчатский край',
  'Сахалинская область',
  'Амурская область',
  'Республика Саха (Якутия)',
  'Магаданская область',
  'Чукотский АО',
  'Другой регион ДФО',
] as const;

export const DFO_SURVEY_REGIONS = [
  ...DFO_CORE_SIX_REGIONS,
  'Магаданская область / Чукотский АО',
] as const;

export function buildRegionSelectOptions(currentValue?: string | null): string[] {
  const trimmed = currentValue?.trim();
  if (trimmed && !DFO_REGIONS.includes(trimmed as (typeof DFO_REGIONS)[number])) {
    return [trimmed, ...DFO_REGIONS];
  }
  return [...DFO_REGIONS];
}
