import { CALENDAR_TASK_TYPE_LABELS } from '../application/crm/calendarSync.ts';

export const UNIFIED_TASK_TYPE_LABELS: Record<string, string> = {
  ...CALENDAR_TASK_TYPE_LABELS,
  proposal: 'Коммерческое предложение',
  approval: 'Согласование',
};

export function getErrorMessage(err: unknown, fallback = 'Произошла ошибка'): string {
  if (err instanceof Error && err.message.trim()) {
    return err.message;
  }
  if (typeof err === 'string' && err.trim()) {
    return err;
  }
  return fallback;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 Б';
  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  let val = bytes;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx += 1;
  }
  return `${val >= 100 || idx === 0 ? val.toFixed(0) : val.toFixed(1)} ${units[idx]}`;
}

export function formatCurrencyRub(amount: number, currency = 'RUB'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₽';
  return `${safe.toLocaleString('ru-RU')} ${symbol}`;
}

export function formatDateTimeRu(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function sanitizeCsvCell(val: unknown): string {
  const str = val === null || val === undefined ? '' : String(val);
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
}
