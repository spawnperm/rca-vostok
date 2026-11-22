import React, { useState } from 'react';
import { Award, CheckCircle2, Send, Star } from 'lucide-react';
import type { SessionUser } from '../utils/identityApi';
import { tracker } from '../utils/tracker';

interface CenterReviewFormProps {
  user: SessionUser;
}

const SESSION_TRACKS = [
  'Водный туризм и сплавы · ВВГУ / Шкотово',
  'Пешеходный / горный туризм · 1–4 КС',
  'Экспедиционный / ООПТ · Контур А',
  'Межрегиональная выездная комиссия ДФО',
  'Теоретическое тестирование и консультации РЦА',
];

const RATING_LABELS: Record<number, string> = {
  1: 'Требует серьёзной доработки',
  2: 'Ниже ожиданий',
  3: 'Удовлетворительно',
  4: 'Хорошо',
  5: 'Отлично',
};

export const CenterReviewForm: React.FC<CenterReviewFormProps> = ({ user }) => {
  const [sessionTrack, setSessionTrack] = useState<string>(SESSION_TRACKS[0]);
  const [sessionRating, setSessionRating] = useState<number>(5);
  const [expertsRating, setExpertsRating] = useState<number>(5);
  const [wouldRecommend, setWouldRecommend] = useState<'yes' | 'maybe' | 'no'>('yes');
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedReview, setSubmittedReview] = useState<{
    id: string;
    sessionTrack: string;
    sessionRating: number;
    expertsRating: number;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (comment.trim().length < 10) {
      setError('Напишите развёрнутый отзыв о сессии и работе экспертов (минимум 10 символов).');
      return;
    }

    const recommendLabel =
      wouldRecommend === 'yes'
        ? 'Рекомендует коллегам'
        : wouldRecommend === 'maybe'
        ? 'Скорее рекомендует'
        : 'Не рекомендует';

    const structuredSubject = `Отзыв о центре (${sessionRating}/5 сессия, ${expertsRating}/5 эксперты) · ${sessionTrack}`;
    const structuredMessage = [
      `Направление / сессия: ${sessionTrack}`,
      `Оценка качества аттестационной сессии: ${sessionRating} из 5 (${RATING_LABELS[sessionRating]})`,
      `Оценка работы экспертов и комиссии: ${expertsRating} из 5 (${RATING_LABELS[expertsRating]})`,
      `Рекомендация: ${recommendLabel}`,
      `Регион пользователя: ${user.region || 'не указан'}`,
      `Комментарий: ${comment.trim()}`,
    ].join('\n');

    setSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName: user.fullName,
          email: user.email,
          feedbackType: 'center_review',
          platformModule: 'Личный кабинет · Отзыв о центре',
          subject: structuredSubject.slice(0, 160),
          message: structuredMessage.slice(0, 1200),
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        id?: string;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Не удалось сохранить отзыв. Попробуйте снова.');
      }

      setSubmittedReview({
        id: data.id || 'review-saved',
        sessionTrack,
        sessionRating,
        expertsRating,
      });
      setComment('');
      tracker.trackCustomInteraction(
        `Отзыв о центре из кабинета: сессия ${sessionRating}/5, эксперты ${expertsRating}/5`,
        sessionTrack
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки отзыва.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      aria-labelledby="center-review-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
    >
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700">
          <Award className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Обратная связь соискателей и гидов</span>
        </div>
        <h3 id="center-review-heading" className="text-base font-bold text-slate-900">
          Оставить отзыв о центре
        </h3>
        <p className="text-sm text-slate-600 leading-relaxed">
          Оцените организацию аттестационных сессий в ВВГУ и на Шкотовском полигоне, а также
          работу экспертов комиссии РЦА «Русский Восток».
        </p>
      </div>

      {submittedReview ? (
        <div className="bg-teal-50/60 border border-teal-200 rounded-xl p-5 space-y-3">
          <div className="inline-flex items-center gap-2 text-teal-800 font-semibold text-sm">
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            <span>Отзыв о работе центра сохранён</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            Спасибо, <span className="font-semibold text-slate-900">{user.fullName}</span>! Ваша
            оценка ({submittedReview.sessionRating}/5 за качество сессии и{' '}
            {submittedReview.expertsRating}/5 за работу экспертов по направлению «
            {submittedReview.sessionTrack}») передана руководству РЦА. Номер записи:{' '}
            <span className="font-mono text-slate-900">{submittedReview.id}</span>.
          </p>
          <button
            type="button"
            onClick={() => setSubmittedReview(null)}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Оставить ещё один отзыв
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-5 pt-2 border-t border-slate-200">
          <div className="space-y-1.5">
            <label htmlFor="review-session-track" className="block text-xs font-semibold text-slate-700">
              Аттестационная сессия или направление
            </label>
            <select
              id="review-session-track"
              value={sessionTrack}
              onChange={(e) => setSessionTrack(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
            >
              {SESSION_TRACKS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StarRatingInput
              label="Качество аттестационной сессии"
              value={sessionRating}
              onChange={setSessionRating}
            />
            <StarRatingInput
              label="Работа экспертов и комиссии"
              value={expertsRating}
              onChange={setExpertsRating}
            />
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-semibold text-slate-700">
              Готовы ли рекомендовать РЦА коллегам-проводникам?
            </span>
            <div className="inline-flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'yes', label: 'Да, рекомендую' },
                  { id: 'maybe', label: 'Скорее да' },
                  { id: 'no', label: 'Есть замечания' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setWouldRecommend(opt.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    wouldRecommend === opt.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="review-comment" className="block text-xs font-semibold text-slate-700">
                Ваш отзыв о сессии и экспертах <span className="text-red-700">*</span>
              </label>
              <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                {comment.length} / 900
              </span>
            </div>
            <textarea
              id="review-comment"
              rows={3}
              maxLength={900}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Поделитесь впечатлениями: организация теоретического этапа, полигон в Шкотово, объективность и разбор от экспертов комиссии..."
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 resize-y"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
            >
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-700 text-white text-sm font-semibold rounded-lg hover:bg-teal-800 transition-colors disabled:opacity-60 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              <span>{submitting ? 'Отправляем…' : 'Отправить отзыв о центре'}</span>
            </button>
            <span className="text-[11px] text-slate-500">
              Автор: {user.fullName}
            </span>
          </div>
        </form>
      )}
    </section>
  );
};

function StarRatingInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (rating: number) => void;
}) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-800">{label}</span>
        <span className="text-xs font-mono font-bold text-teal-800 tabular-nums">
          {value} / 5
        </span>
      </div>
      <div className="flex items-center gap-1" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((score) => {
          const active = score <= value;
          return (
            <button
              key={score}
              type="button"
              onClick={() => onChange(score)}
              aria-label={`${label}: ${score} из 5`}
              aria-pressed={value === score}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                active
                  ? 'text-amber-500 hover:text-amber-600'
                  : 'text-slate-300 hover:text-slate-400'
              }`}
            >
              <Star
                className="w-5 h-5"
                fill={active ? 'currentColor' : 'none'}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-500">{RATING_LABELS[value]}</p>
    </div>
  );
}
