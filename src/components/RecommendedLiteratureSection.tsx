import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookMarked, Bookmark, BookmarkCheck, BookOpen, Search, X } from 'lucide-react';
import {
  FAVORITE_LITERATURE_EVENT,
  LITERATURE_DISCIPLINE_TABS,
  RECOMMENDED_LITERATURE,
  filterRecommendedLiterature,
  getFavoriteLiteratureIds,
  toggleFavoriteLiteratureId,
  type LiteratureDiscipline,
} from '../utils/recommendedLiterature';
import { identityApi } from '../utils/identityApi';
import { tracker } from '../utils/tracker';

interface RecommendedLiteratureSectionProps {
  onOpenCabinetFavorites?: () => void;
}

export const RecommendedLiteratureSection: React.FC<RecommendedLiteratureSectionProps> = ({
  onOpenCabinetFavorites,
}) => {
  const [discipline, setDiscipline] = useState<LiteratureDiscipline>('all');
  const [search, setSearch] = useState<string>('');
  const [onlyFavorites, setOnlyFavorites] = useState<boolean>(false);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => getFavoriteLiteratureIds(null));
  const [justSavedTitle, setJustSavedTitle] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    identityApi
      .session()
      .then((res) => {
        if (cancelled) return;
        const uid = res.authenticated && res.user ? res.user.id : null;
        setActiveUserId(uid);
        setFavoriteIds(getFavoriteLiteratureIds(uid));
      })
      .catch(() => {
        if (!cancelled) {
          setFavoriteIds(getFavoriteLiteratureIds(null));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onUpdated = () => {
      setFavoriteIds(getFavoriteLiteratureIds(activeUserId));
    };
    window.addEventListener(FAVORITE_LITERATURE_EVENT, onUpdated);
    return () => {
      window.removeEventListener(FAVORITE_LITERATURE_EVENT, onUpdated);
    };
  }, [activeUserId]);

  const filteredItems = useMemo(
    () =>
      filterRecommendedLiterature(RECOMMENDED_LITERATURE, {
        discipline,
        search,
        onlyFavorites,
        favoriteIds,
      }),
    [discipline, search, onlyFavorites, favoriteIds]
  );

  const handleToggleFavorite = (itemId: string, itemTitle: string) => {
    const res = toggleFavoriteLiteratureId(itemId, activeUserId);
    setFavoriteIds(res.ids);
    setJustSavedTitle(res.saved ? itemTitle : null);
    tracker.trackCustomInteraction(
      res.saved ? 'Литература: добавлено в избранное' : 'Литература: убрано из избранного',
      itemTitle.slice(0, 50)
    );
  };

  return (
    <section
      id="recommended-literature"
      aria-labelledby="recommended-literature-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 scroll-mt-24"
    >
      {/* Header + Personal Cabinet Favorites Shortcut */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="space-y-1.5 max-w-2xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Библиография ДПО ВВГУ и методический фонд ФСТР</span>
          </p>
          <h2 id="recommended-literature-heading" className="text-xl font-bold text-slate-900">
            Рекомендуемая литература для подготовки к аттестации
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Отбирайте учебники и регламенты по экзаменационным дисциплинам и сохраняйте нужные
            издания в список «Избранное» в личном кабинете соискателя.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setOnlyFavorites((prev) => !prev)}
            aria-pressed={onlyFavorites}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              onlyFavorites
                ? 'bg-teal-700 border-teal-800 text-white'
                : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <BookMarked className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Избранное:</span>
            <span className="font-mono tabular-nums">{favoriteIds.length}</span>
          </button>

          {onOpenCabinetFavorites && (
            <button
              type="button"
              onClick={onOpenCabinetFavorites}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <span>Открыть «Избранное» в кабинете</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Discipline Filter Controls + Search */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div
          role="tablist"
          aria-label="Фильтр литературы по дисциплинам"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
        >
          {LITERATURE_DISCIPLINE_TABS.map((tab) => {
            const active = discipline === tab.id;
            const count =
              tab.id === 'all'
                ? RECOMMENDED_LITERATURE.length
                : RECOMMENDED_LITERATURE.filter((l) => l.discipline === tab.id).length;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setDiscipline(tab.id);
                  tracker.trackCustomInteraction('Литература: фильтр дисциплины', tab.label);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>

        <div className="relative w-full xl:w-72 shrink-0">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию, автору, теме…"
            aria-label="Поиск по рекомендуемой литературе"
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Очистить поиск литературы"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Live Save Confirmation Notice */}
      {justSavedTitle && (
        <div
          role="status"
          aria-live="polite"
          className="px-4 py-2.5 bg-teal-50/80 border border-teal-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs text-teal-900"
        >
          <span>
            Издание «<strong>{justSavedTitle}</strong>» сохранено в список «Избранное» личного кабинета.
          </span>
          {onOpenCabinetFavorites && (
            <button
              type="button"
              onClick={onOpenCabinetFavorites}
              className="font-semibold text-teal-800 underline hover:text-teal-950 cursor-pointer"
            >
              Перейти в кабинет
            </button>
          )}
        </div>
      )}

      {/* Literature Grid or Empty State */}
      {filteredItems.length === 0 ? (
        <div className="py-10 px-6 bg-slate-50 border border-slate-200 rounded-lg text-center space-y-3">
          <p className="text-sm font-semibold text-slate-900">
            {onlyFavorites
              ? 'В вашем списке «Избранное» пока нет материалов по выбранному фильтру'
              : 'По вашему запросу учебные материалы не найдены'}
          </p>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            Сбросьте фильтры дисциплины или переключите режим просмотра, чтобы увидеть всю подборку РЦА и ВВГУ.
          </p>
          <button
            type="button"
            onClick={() => {
              setDiscipline('all');
              setSearch('');
              setOnlyFavorites(false);
            }}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Показать все материалы ({RECOMMENDED_LITERATURE.length})
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
            const isSaved = favoriteIds.includes(item.id);
            return (
              <article
                key={item.id}
                className={`border rounded-lg p-5 flex flex-col justify-between gap-4 transition-colors ${
                  isSaved
                    ? 'bg-teal-50/35 border-teal-300'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-teal-800">{item.disciplineLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.publisherYear}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-[11px] text-slate-600">{item.pagesOrFormat}</span>
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                    {item.title}
                  </h3>

                  <p className="text-xs font-medium text-slate-700">{item.authors}</p>

                  <p className="text-xs text-slate-600 leading-relaxed">{item.summary}</p>
                </div>

                <div className="pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[11px] text-slate-600 max-w-xs leading-snug">
                    {item.examRelevance}
                  </p>

                  <button
                    type="button"
                    aria-pressed={isSaved}
                    onClick={() => handleToggleFavorite(item.id, item.title)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                      isSaved
                        ? 'bg-teal-700 border-teal-800 text-white hover:bg-teal-800'
                        : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    {isSaved ? (
                      <>
                        <BookmarkCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>В избранном ЛК</span>
                      </>
                    ) : (
                      <>
                        <Bookmark className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
                        <span>Сохранить в избранное</span>
                      </>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
