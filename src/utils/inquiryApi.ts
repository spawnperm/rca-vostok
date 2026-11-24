import { tracker } from './tracker.ts';

export interface CenterInquiryPayload {
  fullName: string;
  email: string;
  contactChannel?: string;
  region: string;
  track: string;
  experienceNote?: string;
  sessionDate?: string;
  consentAccepted: boolean;
}

export interface CenterInquiryResult {
  id: string;
  createdAt: string;
  totalSubscriptions?: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateCenterInquiry(
  payload: CenterInquiryPayload,
  options: {
    requireNote?: boolean;
    consentMessage?: string;
    emailMessage?: string;
  } = {}
): string | null {
  if (payload.fullName.trim().length < 2) {
    return 'Укажите ваше имя или ФИО (не менее 2 символов).';
  }
  if (!EMAIL_RE.test(payload.email.trim())) {
    return options.emailMessage ?? 'Укажите корректный адрес электронной почты.';
  }
  if (options.requireNote && (payload.experienceNote ?? '').trim().length < 5) {
    return 'Опишите ваш вопрос по аттестации (минимум 5 символов).';
  }
  if (!payload.consentAccepted) {
    return (
      options.consentMessage ??
      'Подтвердите согласие на получение уведомлений о сроках аттестации.'
    );
  }
  return null;
}

export async function submitCenterInquiry(
  payload: CenterInquiryPayload,
  trackingLabel: string
): Promise<CenterInquiryResult> {
  const res = await fetch('/api/inquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: payload.fullName.trim(),
      email: payload.email.trim(),
      contactChannel: payload.contactChannel?.trim() ?? '',
      region: payload.region,
      track: payload.track,
      experienceNote: payload.experienceNote?.trim() ?? '',
      sessionDate: payload.sessionDate,
      consentAccepted: payload.consentAccepted,
    }),
  });

  const data = (await res.json()) as {
    ok?: boolean;
    id?: string;
    createdAt?: string;
    totalSubscriptions?: number;
    error?: string;
  };

  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'Не удалось сохранить заявку. Повторите попытку.');
  }

  tracker.trackCustomInteraction(trackingLabel, payload.region);

  return {
    id: data.id || 'registered',
    createdAt: data.createdAt || new Date().toISOString(),
    totalSubscriptions: data.totalSubscriptions,
  };
}
