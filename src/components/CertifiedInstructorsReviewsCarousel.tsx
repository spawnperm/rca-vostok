import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Quote,
  ShieldCheck,
  Star,
} from 'lucide-react';
import type { GlossaryTerm } from '../data/researchData.ts';
import type { InstructorReviewListItem } from './InstructorReviewsSection.tsx';
import { GlossaryText } from './InteractiveGlossary.tsx';
import {
  CERTIFIED_TRACK_FILTER_OPTIONS,
  CURATED_CERTIFIED_INSTRUCTOR_REVIEWS,
  computeReviewsAverageRating,
  filterCertifiedInstructorReviews,
  mergeCertifiedInstructorReviews,
  parseCertifiedReviewsFromApi,
  wrapCarouselIndex,
  type CertifiedInstructorReviewSlide,
  type CertifiedReviewTrackFilter,
} from '../utils/certifiedInstructorReviewsCarousel.ts';
import { tracker } from '../utils/tracker.ts';

export interface CertifiedInstructorsReviewsCarouselProps {
  glossaryHighlightEnabled?: boolean;
  onInspectTerm?: (term: GlossaryTerm) => void;
  onApplyForSession?: () => void;
  onOpenSuccessStories?: () => void;
  onOpenAccount?: () => void;
}

function StarRatingInline({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`Оценка ${rating.toFixed(1)} из 5`}
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
    </span>
  );
}

export const CertifiedInstructorsReviewsCarousel: React.FC<
  CertifiedInstructorsReviewsCarouselProps
> = ({
  glossaryHighlightEnabled = true,
  onInspectTerm,
  onApplyForSession,
  onOpenSuccessStories,
  onOpenAccount,
}) => {
  const [communitySlides, setCommunitySlides] = useState<
    CertifiedInstructorReviewSlide[]
  >([]);
  const [trackFilter, setTrackFilter] =
    useState<CertifiedReviewTrackFilter>('all');
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [autoPlay, setAutoPlay] = useState<boolean>(false);
  const [isPausedByHover, setIsPausedByHover] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    fetch('/api/feedback/reviews', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { reviews?: InstructorReviewListItem[] } | null) => {
        if (!mounted || !data || !Array.isArray(data.reviews)) {
          return;
        }
        setCommunitySlides(parseCertifiedReviewsFromApi(data.reviews));
      })
      .catch(() => {
        // Curated certified reviews remain available offline
      });

    return () => {
      mounted = false;
    };
  }, []);

  const allSlides = useMemo(
    () =>
      mergeCertifiedInstructorReviews(
        communitySlides,
        CURATED_CERTIFIED_INSTRUCTOR_REVIEWS
      ),
    [communitySlides]
  );

  const visibleSlides = useMemo(
    () => filterCertifiedInstructorReviews(allSlides, trackFilter),
    [allSlides, trackFilter]
  );

  const safeIndex =
    visibleSlides.length > 0
      ? wrapCarouselIndex(activeIndex, visibleSlides.length)
      : 0;
  const activeSlide = visibleSlides[safeIndex] ?? allSlides[0];
  const averageRating = useMemo(
    () => computeReviewsAverageRating(visibleSlides),
    [visibleSlides]
  );

  const handleStep = useCallback(
    (delta: number, sourceAction: 'button' | 'keyboard' | 'autoplay' = 'button') => {
      if (visibleSlides.length === 0) return;
      const next = wrapCarouselIndex(safeIndex + delta, visibleSlides.length);
      setActiveIndex(next);
      const nextSlide = visibleSlides[next];
      if (nextSlide && sourceAction !== 'autoplay') {
        tracker.trackCustomInteraction(
          `Карусель отзывов инструкторов: ${nextSlide.authorName}`,
          nextSlide.region
        );
      }
    },
    [safeIndex, visibleSlides]
  );

  const handleSelectDirect = (idx: number) => {
    const next = wrapCarouselIndex(idx, visibleSlides.length);
    setActiveIndex(next);
    const chosen = visibleSlides[next];
    if (chosen) {
      tracker.trackCustomInteraction(
        `Карусель отзывов инструкторов: ${chosen.authorName}`,
        chosen.region
      );
    }
  };

  const handleSelectFilter = (nextFilter: CertifiedReviewTrackFilter) => {
    setTrackFilter(nextFilter);
    setActiveIndex(0);
    tracker.trackCustomInteraction(
      `Фильтр карусели отзывов: ${nextFilter}`
    );
  };

  useEffect(() => {
    if (!autoPlay || isPausedByHover || visibleSlides.length <= 1) {
      return;
    }
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const timerId = window.setInterval(() => {
      setActiveIndex((prev) => wrapCarouselIndex(prev + 1, visibleSlides.length));
    }, 7000);
    return () => window.clearInterval(timerId);
  }, [autoPlay, isPausedByHover, visibleSlides.length]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      handleStep(-1, 'keyboard');
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      handleStep(1, 'keyboard');
    }
  };

  if (!activeSlide) {
    return null;
  }

  return (
    <section
      id="certified-instructors-reviews"
      aria-labelledby="certified-reviews-heading"
      aria-roledescription="carousel"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsPausedByHover(true)}
      onMouseLeave={() => setIsPausedByHover(false)}
      onFocusCapture={() => setIsPausedByHover(true)}
      onBlurCapture={() => setIsPausedByHover(false)}
      className="bg-white border border-slate-200 rounded-xl p-8 space-y-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 scroll-mt-24"
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-medium text-teal-700">
            Проверенный опыт выпускников реестра ДФО
          </p>
          <h2
            id="certified-reviews-heading"
            className="text-xl font-bold text-slate-900 text-balance"
          >
            Отзывы аттестованных инструкторов-проводников
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Впечатления гидов и руководителей походов, уже прошедших теоретический этап, защиту
            паспорта маршрута и полевые испытания в РЦА «Русский Восток».
            {averageRating !== null && (
              <span className="font-mono font-semibold text-slate-800 tabular-nums ml-1.5">
                · Средняя оценка: {averageRating.toFixed(1)} / 5
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoPlay((prev) => !prev)}
            aria-pressed={autoPlay}
            aria-label={
              autoPlay
                ? 'Приостановить автопрокрутку отзывов'
                : 'Включить автопрокрутку отзывов'
            }
            className={`px-3 py-2 text-xs font-medium rounded-lg border inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              autoPlay
                ? 'bg-teal-50 text-teal-800 border-teal-300'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {autoPlay ? (
              <Pause className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Play className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>{autoPlay ? 'Пауза' : 'Автопрокрутка'}</span>
          </button>

          <span className="text-xs font-mono text-slate-600 tabular-nums px-2">
            {String(safeIndex + 1).padStart(2, '0')} /{' '}
            {String(visibleSlides.length).padStart(2, '0')}
          </span>

          <button
            type="button"
            onClick={() => handleStep(-1, 'button')}
            disabled={visibleSlides.length <= 1}
            aria-label="Предыдущий отзыв аттестованного инструктора"
            className="p-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => handleStep(1, 'button')}
            disabled={visibleSlides.length <= 1}
            aria-label="Следующий отзыв аттестованного инструктора"
            className="p-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Direction Filter Strip */}
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Фильтр отзывов по направлению туризма"
      >
        {CERTIFIED_TRACK_FILTER_OPTIONS.map((option) => {
          const count =
            option.id === 'all'
              ? allSlides.length
              : allSlides.filter((s) => s.track === option.id).length;
          if (option.id !== 'all' && count === 0) return null;
          const isSelected = trackFilter === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSelectFilter(option.id)}
              aria-pressed={isSelected}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                isSelected
                  ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              {option.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Active Carousel Slide */}
      <div
        key={activeSlide.id}
        aria-live="polite"
        className="border-y border-slate-200 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
      >
        <div className="lg:col-span-8 space-y-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Аттестация подтверждена</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-slate-800">{activeSlide.trackLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{activeSlide.contourLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{activeSlide.batchLabel}</span>
          </div>

          <Quote className="w-6 h-6 text-teal-700/60" aria-hidden="true" />

          <blockquote className="font-serif text-lg sm:text-xl text-slate-900 leading-relaxed">
            «
            <GlossaryText
              text={activeSlide.quote}
              enabled={glossaryHighlightEnabled}
              showDirectoryLink
              onInspectTerm={onInspectTerm}
            />
            »
          </blockquote>

          <div className="bg-slate-50 rounded-lg p-4 space-y-1">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Совет соискателям перед аттестацией
            </p>
            <p className="text-xs text-slate-700 leading-relaxed">
              <GlossaryText
                text={activeSlide.advice}
                enabled={glossaryHighlightEnabled}
                showDirectoryLink
                onInspectTerm={onInspectTerm}
              />
            </p>
          </div>
        </div>

        {/* Attributable Instructor Identity & Rating Card */}
        <aside className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-slate-900">
                {activeSlide.authorName}
              </p>
              <Award
                className="w-4 h-4 text-teal-700 shrink-0 mt-0.5"
                aria-hidden="true"
              />
            </div>
            <p className="text-xs text-slate-600 leading-snug">{activeSlide.role}</p>
            <p className="text-xs font-medium text-teal-800 pt-1">
              {activeSlide.organization} · {activeSlide.region}
            </p>
            <p className="text-[11px] font-mono text-slate-500 tabular-nums pt-0.5">
              {activeSlide.certificateCode}
            </p>
          </div>

          <div className="pt-3 border-t border-slate-200 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <StarRatingInline rating={activeSlide.overallRating} />
              <span className="text-xs font-mono font-bold text-slate-900 tabular-nums">
                {activeSlide.overallRating.toFixed(1)} / 5
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 tabular-nums">
              <div className="bg-white border border-slate-200 rounded-md px-2.5 py-1.5 flex items-center justify-between">
                <span>Подготовка</span>
                <span className="font-mono font-semibold text-slate-900">
                  {activeSlide.prepRating}/5
                </span>
              </div>
              <div className="bg-white border border-slate-200 rounded-md px-2.5 py-1.5 flex items-center justify-between">
                <span>Экзамен</span>
                <span className="font-mono font-semibold text-slate-900">
                  {activeSlide.examRating}/5
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 space-y-1">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Результат аттестации
            </p>
            <p className="text-xs text-slate-800 leading-relaxed">
              <GlossaryText
                text={activeSlide.practicalOutcome}
                enabled={glossaryHighlightEnabled}
                showDirectoryLink
                onInspectTerm={onInspectTerm}
              />
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            {onApplyForSession && (
              <button
                type="button"
                onClick={onApplyForSession}
                className="w-full px-3.5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Записаться на аттестацию</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              {onOpenSuccessStories && (
                <button
                  type="button"
                  onClick={onOpenSuccessStories}
                  className="text-teal-800 font-medium hover:underline cursor-pointer whitespace-nowrap shrink-0"
                >
                  Все истории и оставить отзыв
                </button>
              )}
              {onOpenAccount && (
                <button
                  type="button"
                  onClick={onOpenAccount}
                  className="text-slate-600 font-medium hover:text-slate-900 hover:underline cursor-pointer whitespace-nowrap shrink-0"
                >
                  Личный кабинет
                </button>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Direct Instructor Slide Selector Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {visibleSlides.map((slide, idx) => {
            const isSelected = idx === safeIndex;
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => handleSelectDirect(idx)}
                aria-current={isSelected ? 'true' : undefined}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                  isSelected
                    ? 'bg-teal-700 text-white border-teal-700 font-semibold'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {String(idx + 1).padStart(2, '0')}. {slide.authorName} · {slide.region}
              </button>
            );
          })}
        </div>

        <p className="text-[11px] text-slate-500">
          Навигация клавишами ← / → или кнопками выбора
        </p>
      </div>
    </section>
  );
};
