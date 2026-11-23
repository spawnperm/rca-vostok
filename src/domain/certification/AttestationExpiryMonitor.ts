export const REATTESTATION_WARNING_MONTHS = 3;

export type AttestationExpiryStatus =
  | 'not_configured'
  | 'active'
  | 'expiring_soon'
  | 'expired';

export interface ReattestationInquiryHint {
  status: string;
  sessionDate?: string | null;
}

export interface AttestationExpiryEvaluation {
  status: AttestationExpiryStatus;
  expiresAtIso: string | null;
  expiresAtFormatted: string | null;
  warningStartsAtIso: string | null;
  warningStartsAtFormatted: string | null;
  daysRemaining: number | null;
  daysUntilWarningStart: number | null;
  /** True when today is within 3 calendar months before expiry or already past expiry. */
  showReattestationWarning: boolean;
  isUrgent: boolean;
  hasScheduledReattestation: boolean;
  scheduledSessionDate: string | null;
  badgeLabel: string;
  headline: string;
  description: string;
}

const MS_PER_DAY = 86_400_000;

function parseIsoUtcParts(isoDate: string): { year: number; month: number; day: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const [yStr, mStr, dStr] = isoDate.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() + 1 !== month ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function toUtcEpochDays(isoDate: string): number {
  const parts = parseIsoUtcParts(isoDate);
  if (!parts) return 0;
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / MS_PER_DAY);
}

export function diffCalendarDays(fromIso: string, toIso: string): number {
  return toUtcEpochDays(toIso) - toUtcEpochDays(fromIso);
}

export function formatIsoDateRu(isoDate: string): string {
  const parts = parseIsoUtcParts(isoDate);
  if (!parts) return isoDate;
  return `${String(parts.day).padStart(2, '0')}.${String(parts.month).padStart(2, '0')}.${parts.year}`;
}

export function addCalendarDaysIso(isoDate: string, days: number): string {
  const parts = parseIsoUtcParts(isoDate);
  if (!parts) return isoDate;
  const dt = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return dt.toISOString().slice(0, 10);
}

/**
 * Subtracts `months` calendar months from an ISO YYYY-MM-DD date, clamping to the
 * last day of the target month when the source day exceeds the target month's length.
 */
export function subtractCalendarMonthsIso(isoDate: string, months: number): string {
  const parts = parseIsoUtcParts(isoDate);
  if (!parts) return isoDate;
  const totalMonths = parts.year * 12 + (parts.month - 1) - months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonthIndex = ((totalMonths % 12) + 12) % 12;
  const maxDayInMonth = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  const clampedDay = Math.min(parts.day, maxDayInMonth);
  return `${String(targetYear).padStart(4, '0')}-${String(targetMonthIndex + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

export function evaluateAttestationExpiry(params: {
  expiresAtIso: string | null | undefined;
  referenceDate?: Date;
  inquiries?: readonly ReattestationInquiryHint[];
}): AttestationExpiryEvaluation {
  const todayIso = (params.referenceDate ?? new Date()).toISOString().slice(0, 10);
  const cleanIso =
    typeof params.expiresAtIso === 'string' && parseIsoUtcParts(params.expiresAtIso.trim())
      ? params.expiresAtIso.trim()
      : null;

  const activeBooked = (params.inquiries ?? []).find(
    (inq) => inq.status !== 'rejected' && Boolean(inq.sessionDate)
  );
  const hasScheduledReattestation = Boolean(activeBooked?.sessionDate);
  const scheduledSessionDate = activeBooked?.sessionDate ?? null;

  if (!cleanIso) {
    return {
      status: 'not_configured',
      expiresAtIso: null,
      expiresAtFormatted: null,
      warningStartsAtIso: null,
      warningStartsAtFormatted: null,
      daysRemaining: null,
      daysUntilWarningStart: null,
      showReattestationWarning: false,
      isUrgent: false,
      hasScheduledReattestation,
      scheduledSessionDate,
      badgeLabel: 'Дата не указана',
      headline: 'Дата окончания аттестации не указана в профиле',
      description:
        'Укажите дату окончания действия текущего свидетельства в профиле, чтобы монитор заранее предупредил о необходимости переаттестации за 3 месяца.',
    };
  }

  const warningStartsAtIso = subtractCalendarMonthsIso(
    cleanIso,
    REATTESTATION_WARNING_MONTHS
  );
  const expiresAtFormatted = formatIsoDateRu(cleanIso);
  const warningStartsAtFormatted = formatIsoDateRu(warningStartsAtIso);
  const daysRemaining = diffCalendarDays(todayIso, cleanIso);
  const daysUntilWarningStart = diffCalendarDays(todayIso, warningStartsAtIso);

  if (todayIso > cleanIso) {
    const overdueDays = Math.abs(daysRemaining);
    return {
      status: 'expired',
      expiresAtIso: cleanIso,
      expiresAtFormatted,
      warningStartsAtIso,
      warningStartsAtFormatted,
      daysRemaining,
      daysUntilWarningStart,
      showReattestationWarning: true,
      isUrgent: true,
      hasScheduledReattestation,
      scheduledSessionDate,
      badgeLabel: `Истекла ${overdueDays} дн. назад`,
      headline: `Срок действия аттестации истёк (${expiresAtFormatted})`,
      description: `Свидетельство просрочено на ${overdueDays} дн. (контрольный порог уведомления за 3 месяца действовал с ${warningStartsAtFormatted}). Запишитесь на ближайшую сессию переаттестации.`,
    };
  }

  if (todayIso >= warningStartsAtIso) {
    const daysText = daysRemaining === 0 ? 'истекает сегодня' : `осталось ${daysRemaining} дн.`;
    return {
      status: 'expiring_soon',
      expiresAtIso: cleanIso,
      expiresAtFormatted,
      warningStartsAtIso,
      warningStartsAtFormatted,
      daysRemaining,
      daysUntilWarningStart,
      showReattestationWarning: true,
      isUrgent: daysRemaining <= 30,
      hasScheduledReattestation,
      scheduledSessionDate,
      badgeLabel: `Внимание · ${daysText}`,
      headline: `До истечения аттестации менее 3 месяцев (${daysText})`,
      description: `Срок действия вашей аттестации заканчивается ${expiresAtFormatted}. Контрольное окно уведомления за 3 месяца открылось ${warningStartsAtFormatted} — рекомендуем записаться на переаттестацию заранее.`,
    };
  }

  return {
    status: 'active',
    expiresAtIso: cleanIso,
    expiresAtFormatted,
    warningStartsAtIso,
    warningStartsAtFormatted,
    daysRemaining,
    daysUntilWarningStart,
    showReattestationWarning: false,
    isUrgent: false,
    hasScheduledReattestation,
    scheduledSessionDate,
    badgeLabel: `Действует · ${daysRemaining} дн.`,
    headline: `Аттестация действительна до ${expiresAtFormatted}`,
    description: `Осталось ${daysRemaining} дн. Предупреждение о переаттестации автоматически активируется ${warningStartsAtFormatted} (за 3 месяца до окончания срока).`,
  };
}

export function pickRecommendedReattestationSession<T extends { start: string }>(
  sessions: readonly T[],
  expiresAtIso: string | null | undefined,
  referenceDate: Date = new Date()
): T | null {
  if (sessions.length === 0) return null;
  const todayIso = referenceDate.toISOString().slice(0, 10);
  const upcoming = [...sessions]
    .filter((s) => s.start >= todayIso)
    .sort((a, b) => a.start.localeCompare(b.start));

  if (upcoming.length === 0) {
    return sessions[0] ?? null;
  }

  if (expiresAtIso && parseIsoUtcParts(expiresAtIso)) {
    // Prefer the latest upcoming session before expiry, or the nearest upcoming session if soon/expired.
    const beforeExpiry = upcoming.filter((s) => s.start <= expiresAtIso);
    if (beforeExpiry.length > 0) {
      return beforeExpiry[0];
    }
  }

  return upcoming[0];
}
