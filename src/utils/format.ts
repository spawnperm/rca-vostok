/**
 * Display formatting for Russian locale output.
 *
 * These helpers existed as four identical copies of `formatRub`, three variants
 * of date formatting and several inline `toLocaleString` calls. Consolidating
 * them means one place to fix a rounding bug and one place where the locale is
 * decided, instead of a search across components.
 *
 * Rule of thumb applied here: format only for display. Values stay numbers in
 * the domain and in data files; these functions are called at the render edge.
 */

/** Formatting options shared by every ruble amount. */
const RUB = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

/** "1 234 ₽" — rounded, non-breaking-space grouped, with the ruble sign. */
export function formatRub(value: number): string {
  if (!Number.isFinite(value)) return '— ₽';
  // Negative amounts appear in discounts and subsidies; render them with the
  // same typographic minus formatSignedRub uses, so a figure reads identically
  // whether it came from one helper or the other.
  const abs = Math.abs(Math.round(value));
  return value < 0 ? `− ${RUB.format(abs)} ₽` : `${RUB.format(abs)} ₽`;
}

/** Same grouping without the currency sign, for axis ticks and badges. */
export function formatNumber(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/** "12%" — whole percents, as every share in the UI is shown. */
export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '— %';
  return `${Math.round(value)}%`;
}

/**
 * Positive/negative sign with a typographic minus, used in cost breakdowns.
 * Returns an empty string for zero so rows can be omitted without a "+0 ₽".
 */
export function formatSignedRub(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '';
  return value > 0 ? `+ ${formatRub(value)}` : `− ${formatRub(Math.abs(value))}`;
}

/**
 * Calendar date from an ISO date or datetime, rendered in UTC.
 *
 * `dateOnly` inputs ("2026-11-22") are interpreted at midnight UTC so a user in
 * any timezone sees the day that is written in the data. Datetimes are rendered
 * in the browser's zone, because those represent a moment rather than a day.
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const date = new Date(dateOnly ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(date.getTime())) return iso;

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(dateOnly ? { timeZone: 'UTC' } : {}),
  });
}

/** "22 ноя 2026, 20:31" — date plus clock time, for activity and audit rows. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "5 мин" / "2 ч 10 мин" — compact duration for session rows. */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0 мин';
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} мин`;
}

/** "03 мин 09 с" — stopwatch-precision duration for behavioral analytics KPIs. */
export function formatDurationClock(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0 мин 00 с';
  const rounded = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(rounded / 60);
  const s = rounded % 60;
  return `${m} мин ${String(s).padStart(2, '0')} с`;
}

/** Parses YYYY-MM-DD strictly as UTC midnight without local timezone shifts. */
export function parseIsoDateUtc(isoDate: string, fallbackYear = 2026): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!match) {
    return new Date(Date.UTC(fallbackYear, 0, 1));
  }
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

/** Formats a UTC Date as "DD.MM.YYYY". */
export function formatDateRuUtc(dt: Date): string {
  const d = String(dt.getUTCDate()).padStart(2, '0');
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${d}.${m}.${dt.getUTCFullYear()}`;
}

/** Formats a UTC Date as "YYYY-MM-DD". */
export function formatDateIsoUtc(dt: Date): string {
  const d = String(dt.getUTCDate()).padStart(2, '0');
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${m}-${d}`;
}

