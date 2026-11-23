import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  MessageSquareText,
  RefreshCw,
  Send,
  ShieldCheck,
  Star,
} from 'lucide-react';
import type { SessionUser } from '../utils/identityApi';
import type { UserAttestationSummary } from './AttestationProgressWidget';
import type { InquiryRecord } from './social/MyInquiriesSection';
import { tracker } from '../utils/tracker';

export interface InstructorReviewListItem {
  id: string;
  authorName: string;
  region: string;
  sessionTrack: string;
  sessionRating: number;
  trainingRating: number;
  expertsRating: number;
  overallRating: number;
  recommended: boolean;
  recommendLabel: string;
  verifiedInstructor: boolean;
  sessionNote: string;
  comment: string;
  createdAt: string;
}

interface ReviewsListResponse {
  reviews: InstructorReviewListItem[];
  total: number;
  averageOverall: number | null;
  averageProcess: number | null;
  averageTraining: number | null;
  averageExperts: number | null;
  recommendationRate: number | null;
}

interface InstructorReviewsSectionProps {
  user: SessionUser;
  progressSummary: UserAttestationSummary;
  inquiries: InquiryRecord[];
  refreshKey?: number;
  onReviewSubmitted?: () => void;
  onJumpToProgress?: () => void;
}

const REVIEW_TRACK_OPTIONS = [
  'Пешеходный / горный туризм · 1–4 КС',
  'Водный туризм и сплавы · ВВГУ / Шкотово',
  'Экспедиционный / ООПТ · Контур А',
  'Автомобильный туризм и автотуры ДФО',
  'Межрегиональная выездная комиссия ДФО',
];

const RATING_LABELS: Record<number, string> = {
  1: 'Требует серьёзной доработки',
  2: 'Ниже ожиданий',
  3: 'Удовлетворительно',
  4: 'Хорошо',
  5: 'Отлично',
};

type MinRatingFilter = 'all' | '5' | '4' | '3';
type ReviewSortMode = 'newest' | 'highest' | 'lowest';

function formatReviewDate(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function StarDisplay({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return (
    <div
      className="inline-flex items-center gap-0.5"
      aria-label={`Оценка ${rating} из 5`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-3.5 h-3.5 ${
            star <= rounded ? 'text-amber-500' : 'text-slate-300'
          }`}
          fill={star <= rounded ? 'currentColor' : 'none'}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function StarRatingInput({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (rating: number) => void;
}) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-800">{label}</span>
        <span className="text-xs font-mono font-bold text-teal-800 tabular-nums shrink-0">
          {value} / 5
        </span>
      </div>
      <p className="text-[11px] text-slate-500 leading-snug">{hint}</p>
      <div className="flex items-center gap-1 pt-0.5" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((score) => {
          const active = score <= value;
          return (
            <button
              key={score}
              type="button"
              onClick={() => onChange(score)}
              aria-label={`${label}: ${score} из 5`}
              aria-pressed={value === score}
              className={`p-1 rounded-md transition-colors cursor-pointer ${
                active
                  ? 'text-amber-500 hover:text-amber-600'
                  : 'text-slate-300 hover:text-slate-400'
              }`}
            >
              <Star
                className="w-4 h-4"
                fill={active ? 'currentColor' : 'none'}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
      <p className="text-[11px] font-medium text-slate-600">{RATING_LABELS[value]}</p>
    </div>
  );
}

export const InstructorReviewsSection: React.FC<InstructorReviewsSectionProps> = ({
  user,
  progressSummary,
  inquiries,
  refreshKey = 0,
  onReviewSubmitted,
  onJumpToProgress,
}) => {
  const hasApprovedInquiry = inquiries.some((inq) => inq.status === 'approved');
  const isAutomaticallyVerified =
    user.role === 'instructor' ||
    user.role === 'curator' ||
    user.role === 'admin' ||
    progressSummary.percent === 100 ||
    hasApprovedInquiry;

  // Form state
  const [sessionTrack, setSessionTrack] = useState<string>(REVIEW_TRACK_OPTIONS[0]);
  const [processRating, setProcessRating] = useState<number>(5);
  const [trainingRating, setTrainingRating] = useState<number>(5);
  const [expertsRating, setExpertsRating] = useState<number>(5);
  const [wouldRecommend, setWouldRecommend] = useState<'yes' | 'maybe' | 'no'>('yes');
  const [sessionNote, setSessionNote] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [confirmedCompletion, setConfirmedCompletion] = useState<boolean>(
    isAutomaticallyVerified
  );
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedNotice, setSubmittedNotice] = useState<string | null>(null);

  // List & rating filter state
  const [listData, setListData] = useState<ReviewsListResponse | null>(null);
  const [listLoading, setListLoading] = useState<boolean>(true);
  const [listError, setListError] = useState<string | null>(null);
  const [minRatingFilter, setMinRatingFilter] = useState<MinRatingFilter>('all');
  const [trackFilter, setTrackFilter] = useState<string>('all');
  const [sortMode, setSortMode] = useState<ReviewSortMode>('newest');

  useEffect(() => {
    if (isAutomaticallyVerified) {
      setConfirmedCompletion(true);
    }
  }, [isAutomaticallyVerified]);

  const loadReviews = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch('/api/feedback/reviews', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new Error('Не удалось загрузить список отзывов.');
      }
      const payload = (await res.json()) as ReviewsListResponse;
      setListData(payload);
    } catch (err) {
      setListError(
        err instanceof Error ? err.message : 'Ошибка загрузки отзывов.'
      );
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews, refreshKey]);

  const visibleReviews = useMemo(() => {
    const items = listData?.reviews ?? [];
    const filtered = items.filter((item) => {
      if (minRatingFilter === '5' && item.overallRating < 4.8) return false;
      if (minRatingFilter === '4' && item.overallRating < 4) return false;
      if (minRatingFilter === '3' && item.overallRating < 3) return false;
      if (
        trackFilter !== 'all' &&
        !item.sessionTrack.toLowerCase().includes(trackFilter.toLowerCase())
      ) {
        return false;
      }
      return true;
    });

    if (sortMode === 'highest') {
      return [...filtered].sort((a, b) => b.overallRating - a.overallRating);
    }
    if (sortMode === 'lowest') {
      return [...filtered].sort((a, b) => a.overallRating - b.overallRating);
    }
    return filtered;
  }, [listData, minRatingFilter, trackFilter, sortMode]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmittedNotice(null);

    if (!isAutomaticallyVerified && !confirmedCompletion) {
      setSubmitError(
        'Подтвердите, что вы прошли аттестацию или обучение в РЦА «Русский Восток» / ВВГУ.'
      );
      return;
    }

    if (comment.trim().length < 10) {
      setSubmitError(
        'Опишите ваши впечатления о процессе аттестации и качестве обучения (минимум 10 символов).'
      );
      return;
    }

    const recommendLabel =
      wouldRecommend === 'yes'
        ? 'Рекомендует коллегам'
        : wouldRecommend === 'maybe'
          ? 'Скорее рекомендует'
          : 'Есть замечания';

    const authorStatusLabel = isAutomaticallyVerified
      ? 'Прошедший аттестацию инструктор-проводник'
      : 'Подтверждённый участник сессии / обучения ВВГУ';

    const structuredSubject = `Отзыв о центре (${processRating}/5 сессия, ${expertsRating}/5 эксперты) · ${sessionTrack}`;
    const structuredMessage = [
      `Направление / сессия: ${sessionTrack}`,
      `Статус автора: ${authorStatusLabel}`,
      ...(sessionNote.trim()
        ? [`Поток / удостоверение: ${sessionNote.trim()}`]
        : []),
      `Оценка качества аттестационной сессии: ${processRating} из 5 (${RATING_LABELS[processRating]})`,
      `Оценка качества обучения и программы ДПО: ${trainingRating} из 5 (${RATING_LABELS[trainingRating]})`,
      `Оценка работы экспертов и комиссии: ${expertsRating} из 5 (${RATING_LABELS[expertsRating]})`,
      `Рекомендация: ${recommendLabel}`,
      `Регион пользователя: ${user.region || 'Приморский край'}`,
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
          platformModule: 'Личный кабинет · Отзывы и обратная связь',
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
        throw new Error(data.error || 'Не удалось сохранить отзыв.');
      }

      setSubmittedNotice(
        `Отзыв опубликован (${processRating}/5 аттестация, ${trainingRating}/5 обучение). Запись № ${data.id || 'сохранена'}.`
      );
      setComment('');
      setSessionNote('');
      await loadReviews();
      onReviewSubmitted?.();
      tracker.trackCustomInteraction(
        `Отзыв инструктора: аттестация ${processRating}/5, обучение ${trainingRating}/5`,
        sessionTrack
      );
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Ошибка отправки отзыва.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="account-reviews-section"
      aria-labelledby="account-reviews-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 scroll-mt-24"
    >
      {/* Header + Instructor Verification Status */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <MessageSquareText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Оценка качества подготовки и работы комиссии РЦА</span>
          </p>
          <h3 id="account-reviews-heading" className="text-lg font-bold text-slate-900">
            Отзывы и обратная связь
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Раздел для инструкторов-проводников, прошедших аттестацию или
            программу переподготовки ВВГУ: делитесь комментариями о процедуре
            экзамена, качестве обучения и работе экспертов.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isAutomaticallyVerified ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-xs font-semibold text-teal-800">
              <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
              <span>Статус подтверждён · Прошедший аттестацию</span>
            </span>
          ) : (
            <div className="inline-flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <span>Прогресс аттестации: {progressSummary.percent}%</span>
              {onJumpToProgress && (
                <button
                  type="button"
                  onClick={onJumpToProgress}
                  className="font-semibold underline underline-offset-2 hover:text-amber-950 cursor-pointer"
                >
                  К трекеру
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Rating KPI Summary Strip */}
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-slate-200">
        <div>
          <dt className="text-xs text-slate-500">Общий рейтинг центра</dt>
          <dd className="mt-1 flex items-center gap-2">
            <span className="text-xl font-bold font-mono text-slate-900 tabular-nums">
              {listData?.averageOverall !== null &&
              listData?.averageOverall !== undefined
                ? listData.averageOverall.toFixed(1)
                : '—'}
            </span>
            {listData?.averageOverall !== null &&
              listData?.averageOverall !== undefined && (
                <StarDisplay rating={listData.averageOverall} />
              )}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-slate-500">Процесс аттестации</dt>
          <dd className="mt-1 text-xl font-bold font-mono text-teal-800 tabular-nums">
            {listData?.averageProcess !== null &&
            listData?.averageProcess !== undefined
              ? `${listData.averageProcess.toFixed(1)} / 5`
              : '—'}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-slate-500">Качество обучения</dt>
          <dd className="mt-1 text-xl font-bold font-mono text-slate-900 tabular-nums">
            {listData?.averageTraining !== null &&
            listData?.averageTraining !== undefined
              ? `${listData.averageTraining.toFixed(1)} / 5`
              : '—'}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-slate-500">Рекомендуют (отзывов: {listData?.total ?? 0})</dt>
          <dd className="mt-1 text-xl font-bold font-mono text-slate-900 tabular-nums">
            {listData?.recommendationRate !== null &&
            listData?.recommendationRate !== undefined
              ? `${listData.recommendationRate}%`
              : '—'}
          </dd>
        </div>
      </dl>

      {/* 2-Column Split: Submission Form (left) + Rated Reviews List (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 5 cols: Leave a Review Form */}
        <div className="lg:col-span-5 bg-slate-50/70 border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-900 inline-flex items-center gap-1.5">
              <Award className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
              <span>Оставить отзыв о процессе и обучении</span>
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Оценки автоматически учитываются в рейтинге и общей статистике
              качества РЦА «Русский Восток».
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="inst-review-track"
                className="block text-xs font-semibold text-slate-700"
              >
                Направление аттестации / программа
              </label>
              <select
                id="inst-review-track"
                value={sessionTrack}
                onChange={(e) => setSessionTrack(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              >
                {REVIEW_TRACK_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2.5">
              <StarRatingInput
                label="Процесс аттестации"
                hint="Подача документов, регламент сессии и полевые испытания"
                value={processRating}
                onChange={setProcessRating}
              />
              <StarRatingInput
                label="Качество обучения (ВВГУ / ДПО)"
                hint="Полнота методичек, практическая польза модулей и WFA"
                value={trainingRating}
                onChange={setTrainingRating}
              />
              <StarRatingInput
                label="Работа экспертов и комиссии"
                hint="Объективность оценки и обратная связь на полигоне"
                value={expertsRating}
                onChange={setExpertsRating}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="inst-review-session-note"
                className="block text-xs font-semibold text-slate-700"
              >
                Поток или номер в реестре (необязательно)
              </label>
              <input
                id="inst-review-session-note"
                type="text"
                maxLength={80}
                value={sessionNote}
                onChange={(e) => setSessionNote(e.target.value)}
                placeholder="Например: Октябрь 2026 · Контур А"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-slate-700">
                Рекомендация коллегам-проводникам
              </span>
              <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
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
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
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
                <label
                  htmlFor="inst-review-comment"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Комментарий об аттестации и обучении{' '}
                  <span className="text-red-700">*</span>
                </label>
                <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                  {comment.length} / 900
                </span>
              </div>
              <textarea
                id="inst-review-comment"
                rows={4}
                maxLength={900}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Опишите, как прошёл теоретический этап, защита паспорта маршрута, полевой экзамен в Шкотово и обучение в ВВГУ..."
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 resize-y"
              />
            </div>

            {!isAutomaticallyVerified && (
              <label className="flex items-start gap-2.5 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmedCompletion}
                  onChange={(e) => setConfirmedCompletion(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-teal-700 rounded cursor-pointer"
                />
                <span className="leading-relaxed">
                  Подтверждаю, что прошёл аттестационную сессию или программу
                  подготовки инструкторов-проводников в РЦА «Русский Восток» / ВВГУ.
                </span>
              </label>
            )}

            {submitError && (
              <p
                role="alert"
                className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
              >
                {submitError}
              </p>
            )}

            {submittedNotice && (
              <div
                role="status"
                className="text-xs text-teal-900 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2.5 flex items-start gap-2"
              >
                <CheckCircle2
                  className="w-4 h-4 text-teal-700 mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <span>{submittedNotice}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-700 text-white text-sm font-semibold rounded-lg hover:bg-teal-800 transition-colors disabled:opacity-60 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              <span>{submitting ? 'Публикуем отзыв…' : 'Опубликовать отзыв'}</span>
            </button>
          </form>
        </div>

        {/* Right 7 cols: Reviews List Component with Rating System */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-sm font-bold text-slate-900">
              Список отзывов инструкторов ({visibleReviews.length})
            </h4>

            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="Фильтр по рейтингу"
                className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
              >
                {(
                  [
                    { id: 'all', label: 'Все' },
                    { id: '5', label: '5 ★' },
                    { id: '4', label: '4+ ★' },
                    { id: '3', label: '3+ ★' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={minRatingFilter === opt.id}
                    onClick={() => setMinRatingFilter(opt.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      minRatingFilter === opt.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <select
                aria-label="Фильтр по направлению"
                value={trackFilter}
                onChange={(e) => setTrackFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:border-teal-600 focus:outline-none"
              >
                <option value="all">Все направления</option>
                <option value="пешеходный">Пешеходный / горный</option>
                <option value="водный">Водный туризм</option>
                <option value="оопт">ООПТ / Контур А</option>
                <option value="авто">Автомобильный</option>
              </select>

              <select
                aria-label="Сортировка отзывов"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as ReviewSortMode)}
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:border-teal-600 focus:outline-none"
              >
                <option value="newest">Сначала новые</option>
                <option value="highest">Высокий рейтинг</option>
                <option value="lowest">Низкий рейтинг</option>
              </select>

              <button
                type="button"
                onClick={() => void loadReviews()}
                disabled={listLoading}
                aria-label="Обновить список отзывов"
                className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    listLoading ? 'animate-spin text-teal-700' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          {listLoading && !listData ? (
            <div
              role="status"
              className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500"
            >
              Загружаем отзывы инструкторов…
            </div>
          ) : listError ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-center justify-between gap-3">
              <span>{listError}</span>
              <button
                type="button"
                onClick={() => void loadReviews()}
                className="px-3 py-1.5 bg-white border border-rose-300 rounded-md font-semibold hover:bg-rose-50 cursor-pointer"
              >
                Повторить
              </button>
            </div>
          ) : visibleReviews.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <p className="text-sm font-semibold text-slate-800">
                {listData?.total === 0
                  ? 'Отзывов инструкторов пока нет'
                  : 'По выбранным фильтрам отзывов не найдено'}
              </p>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                {listData?.total === 0
                  ? 'Оставьте первый отзыв в форме слева — комментарий появится в общем списке и обновит рейтинг центра.'
                  : 'Сбросьте фильтр по оценке или направлению, чтобы увидеть все опубликованные отзывы.'}
              </p>
              {listData && listData.total > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMinRatingFilter('all');
                    setTrackFilter('all');
                  }}
                  className="mt-2 px-3 py-1.5 bg-white border border-slate-300 text-xs font-medium text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  Сбросить фильтры
                </button>
              )}
            </div>
          ) : (
            <ul className="space-y-3" aria-label="Отзывы прошедших аттестацию инструкторов">
              {visibleReviews.map((review) => (
                <li
                  key={review.id}
                  className="border border-slate-200 rounded-xl p-4 sm:p-5 bg-white space-y-3 hover:border-slate-300 transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {review.authorName}
                        </span>
                        {review.verifiedInstructor && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-[11px] font-semibold text-teal-800">
                            <ShieldCheck className="w-3 h-3 shrink-0" aria-hidden="true" />
                            <span>Аттестованный инструктор</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        {review.region} · {formatReviewDate(review.createdAt)}
                        {review.sessionNote ? ` · ${review.sessionNote}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                      <StarDisplay rating={review.overallRating} />
                      <span className="text-xs font-mono font-bold text-slate-900 tabular-nums">
                        {review.overallRating.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs font-medium text-teal-800">
                    {review.sessionTrack}
                  </p>

                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                    {review.comment}
                  </p>

                  <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-slate-600 tabular-nums">
                      <span className="px-2 py-0.5 rounded bg-slate-100">
                        Аттестация: {review.sessionRating}/5
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100">
                        Обучение: {review.trainingRating}/5
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100">
                        Эксперты: {review.expertsRating}/5
                      </span>
                    </div>

                    <span
                      className={`font-medium ${
                        review.recommended ? 'text-teal-700' : 'text-amber-700'
                      }`}
                    >
                      {review.recommendLabel}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};
