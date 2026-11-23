import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  PenLine,
  Send,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import { CERTIFIED_SUCCESS_STORIES } from '../data/researchData.ts';
import type { InstructorReviewListItem } from './InstructorReviewsSection.tsx';
import { identityApi, type SessionUser } from '../utils/identityApi.ts';
import {
  buildSuccessStorySubmissionPayload,
  filterSuccessStories,
  mergeSuccessStories,
  parseSuccessStoriesFromReviews,
  type SuccessStoryCardModel,
  type SuccessStoryContourFilter,
  type SuccessStoryTrackFilter,
} from '../utils/successStories.ts';
import { tracker } from '../utils/tracker.ts';

export interface SuccessStoriesSectionProps {
  onApplyForSession?: () => void;
}

const REGION_OPTIONS = [
  'Приморский край',
  'Хабаровский край',
  'Камчатский край',
  'Сахалинская область',
  'Амурская область',
  'Другой регион ДФО',
] as const;

const TRACK_FILTER_TABS: { id: SuccessStoryTrackFilter; label: string }[] = [
  { id: 'all', label: 'Все направления' },
  { id: 'hiking', label: 'Пешеходный и горный' },
  { id: 'water', label: 'Водный и сплавы' },
  { id: 'expedition', label: 'ООПТ и экспедиции' },
];

const CONTOUR_FILTER_TABS: { id: SuccessStoryContourFilter; label: string }[] = [
  { id: 'all', label: 'Все траектории' },
  { id: 'A', label: 'Контур А · зачёт стажа' },
  { id: 'B', label: 'Контур Б · обучение ВВГУ' },
];

function formatStoryDate(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });
}

function ScoreButtons({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (score: number) => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-800">{label}</span>
        <span className="font-mono font-bold text-teal-800 tabular-nums">
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
    </div>
  );
}

export const SuccessStoriesSection: React.FC<SuccessStoriesSectionProps> = ({
  onApplyForSession,
}) => {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [communityStories, setCommunityStories] = useState<
    SuccessStoryCardModel[]
  >([]);
  const [loadingStories, setLoadingStories] = useState<boolean>(true);
  const [trackFilter, setTrackFilter] =
    useState<SuccessStoryTrackFilter>('all');
  const [contourFilter, setContourFilter] =
    useState<SuccessStoryContourFilter>('all');

  // Interactive submission form state
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [authorName, setAuthorName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [region, setRegion] = useState<string>('Приморский край');
  const [track, setTrack] = useState<'hiking' | 'water' | 'expedition' | 'auto'>(
    'hiking'
  );
  const [contour, setContour] = useState<'A' | 'B'>('A');
  const [batchLabel, setBatchLabel] = useState<string>('Октябрь 2026');
  const [studyHours, setStudyHours] = useState<string>('48');
  const [prepRating, setPrepRating] = useState<number>(5);
  const [examRating, setExamRating] = useState<number>(5);
  const [prepStory, setPrepStory] = useState<string>('');
  const [examStory, setExamStory] = useState<string>('');
  const [advice, setAdvice] = useState<string>('');
  const [confirmedAttestation, setConfirmedAttestation] =
    useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);

  const loadStories = useCallback(async () => {
    setLoadingStories(true);
    try {
      const res = await fetch('/api/feedback/reviews', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as {
        reviews?: InstructorReviewListItem[];
      };
      if (Array.isArray(data.reviews)) {
        setCommunityStories(parseSuccessStoriesFromReviews(data.reviews));
      }
    } catch {
      // Non-blocking fallback to curated stories if offline
    } finally {
      setLoadingStories(false);
    }
  }, []);

  useEffect(() => {
    void loadStories();
  }, [loadStories]);

  useEffect(() => {
    let active = true;
    identityApi
      .session()
      .then((res) => {
        if (!active || !res.authenticated || !res.user) return;
        setSessionUser(res.user);
        setAuthorName((prev) => prev || res.user!.fullName);
        setEmail((prev) => prev || res.user!.email);
        if (
          res.user.region &&
          REGION_OPTIONS.includes(
            res.user.region as (typeof REGION_OPTIONS)[number]
          )
        ) {
          setRegion(res.user.region);
        }
        if (
          res.user.role === 'instructor' ||
          res.user.role === 'curator' ||
          res.user.role === 'admin'
        ) {
          setConfirmedAttestation(true);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const allStories = useMemo(
    () => mergeSuccessStories(communityStories, CERTIFIED_SUCCESS_STORIES),
    [communityStories]
  );

  const visibleStories = useMemo(
    () => filterSuccessStories(allStories, trackFilter, contourFilter),
    [allStories, trackFilter, contourFilter]
  );

  const metrics = useMemo(() => {
    const total = allStories.length;
    const avgExam =
      total > 0
        ? (
            allStories.reduce((acc, s) => acc + s.examRating, 0) / total
          ).toFixed(1)
        : '—';
    const contourACount = allStories.filter((s) => s.contour === 'A').length;
    const regionsCount = new Set(allStories.map((s) => s.region)).size;
    return { total, avgExam, contourACount, regionsCount };
  }, [allStories]);

  const handleSubmitStory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitNotice(null);

    if (authorName.trim().length < 2) {
      setSubmitError('Укажите ваше имя и фамилию (не менее 2 символов).');
      return;
    }
    if (
      email.trim().length > 0 &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
    ) {
      setSubmitError('Укажите корректный адрес электронной почты.');
      return;
    }
    if (!confirmedAttestation) {
      setSubmitError(
        'Подтвердите, что вы уже прошли аттестацию инструктора-проводника.'
      );
      return;
    }
    if (prepStory.trim().length < 15) {
      setSubmitError(
        'Расскажите подробнее об опыте подготовки (не менее 15 символов).'
      );
      return;
    }
    if (examStory.trim().length < 15) {
      setSubmitError(
        'Опишите, как прошло прохождение экзаменов и полевых испытаний (не менее 15 символов).'
      );
      return;
    }

    const parsedHours = Number(studyHours);
    const payload = buildSuccessStorySubmissionPayload({
      authorName,
      email,
      region,
      track,
      contour,
      batchLabel,
      studyHours: Number.isFinite(parsedHours) ? parsedHours : undefined,
      prepRating,
      examRating,
      prepStory,
      examStory,
      advice,
    });

    setSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        id?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(
          data.error || 'Не удалось опубликовать историю успеха.'
        );
      }

      await loadStories();
      setTrackFilter('all');
      setContourFilter('all');
      setSubmitNotice(
        `История успеха опубликована в ленте РЦА «Русский Восток» (запись № ${data.id || 'сохранена'}).`
      );
      setPrepStory('');
      setExamStory('');
      setAdvice('');
      setFormOpen(false);
      tracker.trackCustomInteraction(
        `Опубликована история успеха: ${track}`,
        region
      );
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Ошибка при отправке истории.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="success-stories-section"
      aria-labelledby="success-stories-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 scroll-mt-24"
    >
      {/* Header & Share CTA */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-medium text-teal-700">
            Практика выпускников РЦА «Русский Восток» и ВВГУ
          </p>
          <h2
            id="success-stories-heading"
            className="text-xl font-bold text-slate-900 inline-flex items-center gap-2"
          >
            <Award
              className="w-5 h-5 text-teal-700 shrink-0"
              aria-hidden="true"
            />
            <span>Отзывы и истории успеха</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Реальный опыт инструкторов-проводников ДФО, уже прошедших
            государственную аттестацию: сколько времени заняла подготовка, как
            выглядела защита паспорта маршрута и испытания на полигоне.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setSubmitError(null);
              setFormOpen((prev) => !prev);
              tracker.trackCustomInteraction(
                'Открыта форма истории успеха в Обзоре центра'
              );
            }}
            aria-expanded={formOpen}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            {formOpen ? (
              <>
                <X className="w-4 h-4" aria-hidden="true" />
                <span>Скрыть форму</span>
              </>
            ) : (
              <>
                <PenLine className="w-4 h-4" aria-hidden="true" />
                <span>Поделиться опытом</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-slate-200">
        <div>
          <dt className="text-xs text-slate-500">Историй аттестованных гидов</dt>
          <dd className="mt-1 text-xl font-bold font-mono text-slate-900 tabular-nums">
            {metrics.total}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Средняя оценка экзамена</dt>
          <dd className="mt-1 text-xl font-bold font-mono text-teal-800 tabular-nums">
            {metrics.avgExam} / 5
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Прошли по Контуру А</dt>
          <dd className="mt-1 text-xl font-bold font-mono text-slate-900 tabular-nums">
            {metrics.contourACount} из {metrics.total}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Субъектов ДФО в подборке</dt>
          <dd className="mt-1 text-xl font-bold font-mono text-slate-900 tabular-nums">
            {metrics.regionsCount}
          </dd>
        </div>
      </dl>

      {submitNotice && (
        <div
          role="status"
          className="px-4 py-3 bg-teal-50 border border-teal-200 rounded-lg text-xs sm:text-sm text-teal-900 flex items-center gap-2.5"
        >
          <CheckCircle2
            className="w-4 h-4 text-teal-700 shrink-0"
            aria-hidden="true"
          />
          <span>{submitNotice}</span>
        </div>
      )}

      {/* Interactive Story Submission Form */}
      {formOpen && (
        <form
          onSubmit={handleSubmitStory}
          noValidate
          className="bg-slate-50 border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Поделитесь историей подготовки и прохождения экзаменов
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                Расскажите будущим соискателям, по какому контуру готовились,
                что вызвало вопросы на теории или полигоне и какой совет поможет
                сдать с первой попытки.
              </p>
            </div>
            {sessionUser && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-800">
                <ShieldCheck className="w-4 h-4 text-teal-700" aria-hidden="true" />
                <span>Автозаполнение: {sessionUser.fullName}</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="story-author-name"
                className="block text-xs font-semibold text-slate-700"
              >
                Имя и фамилия <span className="text-red-700">*</span>
              </label>
              <input
                id="story-author-name"
                type="text"
                required
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Например, Игорь Сорокин"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="story-region"
                className="block text-xs font-semibold text-slate-700"
              >
                Регион ДФО
              </label>
              <select
                id="story-region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
              >
                {REGION_OPTIONS.map((reg) => (
                  <option key={reg} value={reg}>
                    {reg}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="story-track"
                className="block text-xs font-semibold text-slate-700"
              >
                Направление аттестации
              </label>
              <select
                id="story-track"
                value={track}
                onChange={(e) =>
                  setTrack(
                    e.target.value as 'hiking' | 'water' | 'expedition' | 'auto'
                  )
                }
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
              >
                <option value="hiking">Пешеходный и горный туризм</option>
                <option value="water">Водный туризм и сплавы</option>
                <option value="expedition">Экспедиционный / ООПТ</option>
                <option value="auto">Автомобильный туризм</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="story-contour"
                className="block text-xs font-semibold text-slate-700"
              >
                Траектория подготовки
              </label>
              <select
                id="story-contour"
                value={contour}
                onChange={(e) => setContour(e.target.value as 'A' | 'B')}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
              >
                <option value="A">Контур А (зачёт стажа)</option>
                <option value="B">Контур Б (ДПО ВВГУ 250 ч)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="story-batch"
                className="block text-xs font-semibold text-slate-700"
              >
                Поток / период сдачи
              </label>
              <input
                id="story-batch"
                type="text"
                maxLength={40}
                value={batchLabel}
                onChange={(e) => setBatchLabel(e.target.value)}
                placeholder="Октябрь 2026"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="story-hours"
                className="block text-xs font-semibold text-slate-700"
              >
                Затрачено часов на подготовку
              </label>
              <input
                id="story-hours"
                type="number"
                min={4}
                max={400}
                value={studyHours}
                onChange={(e) => setStudyHours(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-mono tabular-nums focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="story-email"
                className="block text-xs font-semibold text-slate-700"
              >
                Email (не публикуется, необязательно)
              </label>
              <input
                id="story-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="guide@example.ru"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ScoreButtons
              label="Оценка материалов подготовки и обучения"
              value={prepRating}
              onChange={setPrepRating}
            />
            <ScoreButtons
              label="Оценка организации экзамена и полигона"
              value={examRating}
              onChange={setExamRating}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="story-prep-text"
                className="block text-xs font-semibold text-slate-700"
              >
                Опыт подготовки (документы, модули, стаж){' '}
                <span className="text-red-700">*</span>
              </label>
              <textarea
                id="story-prep-text"
                rows={3}
                maxLength={420}
                value={prepStory}
                onChange={(e) => setPrepStory(e.target.value)}
                placeholder="Как собирали маршрутные книжки или треки, сколько времени ушло на теорию и WFA…"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 resize-y"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="story-exam-text"
                className="block text-xs font-semibold text-slate-700"
              >
                Как прошло прохождение экзаменов{' '}
                <span className="text-red-700">*</span>
              </label>
              <textarea
                id="story-exam-text"
                rows={3}
                maxLength={420}
                value={examStory}
                onChange={(e) => setExamStory(e.target.value)}
                placeholder="Защита паспорта маршрута в ВВГУ, вопросы комиссии, практические этапы на полигоне…"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 resize-y"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="story-advice"
              className="block text-xs font-semibold text-slate-700"
            >
              Главный совет будущим соискателям
            </label>
            <input
              id="story-advice"
              type="text"
              maxLength={220}
              value={advice}
              onChange={(e) => setAdvice(e.target.value)}
              placeholder="На что обратить особое внимание перед подачей заявки и сдачей практики…"
              className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
            />
          </div>

          <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmedAttestation}
              onChange={(e) => setConfirmedAttestation(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-teal-700 rounded cursor-pointer"
            />
            <span className="leading-relaxed">
              Подтверждаю, что я уже прошёл государственную аттестацию
              инструктора-проводника и публикую личный опыт для соискателей РЦА
              «Русский Восток».
            </span>
          </label>

          {submitError && (
            <p
              role="alert"
              className="px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700"
            >
              {submitError}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {submitting ? 'Публикуем…' : 'Опубликовать историю успеха'}
              </span>
            </button>
          </div>
        </form>
      )}

      {/* Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Фильтр историй по направлению туризма"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start"
        >
          {TRACK_FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={trackFilter === tab.id}
              onClick={() => {
                setTrackFilter(tab.id);
                tracker.trackCustomInteraction(
                  `Истории успеха · фильтр ${tab.label}`
                );
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                trackFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          role="group"
          aria-label="Фильтр по траектории подготовки"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start"
        >
          {CONTOUR_FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={contourFilter === tab.id}
              onClick={() => setContourFilter(tab.id)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                contourFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stories Grid */}
      {loadingStories && allStories.length === 0 ? (
        <div
          role="status"
          className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500"
        >
          Загружаем истории прошедших аттестацию инструкторов…
        </div>
      ) : visibleStories.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <p className="text-sm font-semibold text-slate-800">
            По выбранным фильтрам историй пока нет.
          </p>
          <button
            type="button"
            onClick={() => {
              setTrackFilter('all');
              setContourFilter('all');
            }}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Показать все истории
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {visibleStories.map((story) => (
            <article
              key={story.id}
              className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5"
            >
              <div className="space-y-4">
                {/* Header row with unboxed metadata */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 font-medium text-teal-800">
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>Аттестация пройдена</span>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{story.batchLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {story.studyHours} ч подготовки
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      {story.authorName}
                    </h3>
                    <p className="text-xs text-slate-600">
                      {story.region} · {story.trackLabel} · {story.contourLabel}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="inline-flex items-center gap-1 text-xs font-mono font-bold text-slate-900 tabular-nums">
                      <Star
                        className="w-3.5 h-3.5 text-amber-500"
                        fill="currentColor"
                        aria-hidden="true"
                      />
                      <span>{story.examRating}.0 / 5</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {formatStoryDate(story.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Structured Experience Narrative */}
                <div className="space-y-3 pt-3 border-t border-slate-100 text-xs sm:text-sm text-slate-700 leading-relaxed">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Опыт подготовки
                    </p>
                    <p>{story.prepStory}</p>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Прохождение экзаменов
                    </p>
                    <p>{story.examStory}</p>
                  </div>
                </div>
              </div>

              {/* Practical Takeaway */}
              <div className="bg-slate-50 rounded-lg p-4 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="font-semibold text-teal-800">
                    Совет будущим соискателям
                  </span>
                  <span className="font-mono text-slate-500 tabular-nums">
                    {story.outcomeMetric}
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {story.advice}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Bottom Next Action Strip */}
      <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
          Готовитесь к ближайшей аттестационной сессии или уже получили
          нагрудную карточку инструктора-проводника?
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          {!formOpen && (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="px-3.5 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Добавить свою историю
            </button>
          )}
          {onApplyForSession && (
            <button
              type="button"
              onClick={onApplyForSession}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Подать заявку на сессию
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
