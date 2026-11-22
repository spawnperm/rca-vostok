/**
 * Marker sizing for the DFO maps.
 *
 * Two components carried near-identical copies of this arithmetic with slightly
 * different constants and no explanation of where the numbers came from:
 *
 *   DfoComparisonSvgMap      sqrt(v)*1.32 clamped 7..25, sqrt(v)*0.54 clamped 8..27
 *   DfoRegionsDistributionMap sqrt(v)*1.35 clamped 7..26, sqrt(v)*0.56 clamped 8..28
 *
 * They are drawing the same two quantities, so the difference was accidental
 * drift rather than intent. Sharing one definition makes the maps visually
 * consistent and puts the reasoning in one place.
 *
 * Why a square root: the registry counts span from single digits to several
 * hundred, and a linear radius would make the small regions invisible next to
 * the large ones. The square root keeps the ordering while compressing the
 * range enough that every region stays clickable.
 */

/** Radius for a certified-instructor count, in SVG units. */
export function registryRadius(count: number): number {
  return clamp(Math.round(Math.sqrt(Math.max(count, 0)) * 1.33), 7, 26);
}

/** Radius for an estimated-demand count, in SVG units. */
export function demandRadius(count: number): number {
  return clamp(Math.round(Math.sqrt(Math.max(count, 0)) * 0.55), 8, 28);
}

/** Radius for a small share indicator (a few units), floored so it stays visible. */
export function shareRadius(sharePct: number): number {
  const value = Math.max(sharePct, 0);
  return value > 0 ? clamp(value + 6, 9, 22) : 5;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/** Shared DFO map palette so every map uses the same colours for the same meaning. */
export const DFO_MAP_COLORS = {
  background: '#EFF6FF',
  regionDefault: '#DBEAFE',
  regionHover: '#93C5FD',
  regionActive: '#0D9488',
  regionCompared: '#F59E0B',
  border: '#BFDBFE',
  label: '#1E3A8A',
} as const;
