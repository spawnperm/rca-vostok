import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookMarked, Trash2 } from 'lucide-react';
import {
  FAVORITE_LITERATURE_EVENT,
  LITERATURE_DISCIPLINE_TABS,
  RECOMMENDED_LITERATURE,
  clearFavoriteLiteratureIds,
  filterRecommendedLiterature,
  getFavoriteLiteratureIds,
  removeFavoriteLiteratureId,
  syncGuestFavoritesToUser,
  type LiteratureDiscipline,
} from '../utils/recommendedLiterature';
import { tracker } from '../utils/tracker';

interface FavoriteLiteratureCabinetWidgetProps {
  userId?: string | null;
  onOpenOverviewLibrary?: () => void;
}

export const FavoriteLiteratureCabinetWidget: React.FC<
  FavoriteLiteratureCabinetWidgetProps
> = ({ userId = null, onOpenOverviewLibrary }) => {
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() =>
    userId ? syncGuestFavoritesToUser(userId) : getFavoriteLiteratureIds(null)
  );
  const [disciplineFilter, setDisciplineFilter] = useState<LiteratureDiscipline>('all');

  useEffect(() => {
    const initialIds = userId
      ? syncGuestFavoritesToUser(userId)
      : getFavoriteLiteratureIds(null);
    setFavoriteIds(initialIds);

    const onUpdated = () => {
      setFavoriteIds(getFavoriteLiteratureIds(userId));
    };
    window.addEventListener(FAVORITE_LITERATURE_EVENT, onUpdated);
    return () => window.removeEventListener(FAVORITE_LITERATURE_EVENT, onUpdated);
  }, [userId]);

  const savedBooks = useMemo(
    () =>
      filterRecommendedLiterature(RECOMMENDED_LITERATURE, {
        discipline: disciplineFilter,
        onlyFavorites: true,
        favoriteIds,
      }),
    [disciplineFilter, favoriteIds]
  );

  const handleRemove = (id: string, title: string) => {
    const next = removeFavoriteLiteratureId(id, userId);
    setFavoriteIds(next);
    tracker.trackCustomInteraction('Кабинет · удалена книга из избранного', title.slice(0, 50));
  };

  const handleClearAll = () => {
    const next = clearFavoriteLiteratureIds(userId);
    setFavoriteIds(next);
    setDisciplineFilter('all');
    tracker.trackCustomInteraction('Кабинет · очищено избранное литературы', 'account');
  };

  return (
    <section
      id="account-favorite-literature"
      aria-labelledby="account-favorite-literature-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 scroll-mt-24"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 pb-4 border-b border-slate-200">
        <div className="space-y-1">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <BookMarked className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Личная библиотека соискателя · Избранное</span>
          </p>
          <h3 id="account-favorite-literature-heading" className="text-lg font-bold text-slate-900">
            Избранные учебные материалы ({favoriteIds.length})
          </h3>
          <p className="text-xs text-slate-600">
            Учебники и нормативные пособия, сохранённые вами из раздела «Обзор центра».
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {favoriteIds.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-700 border border-slate-200 hover:border-red-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Очистить список
            </button>
          )}
          {onOpenOverviewLibrary && (
            <button
              type="button"
              onClick={onOpenOverviewLibrary}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Подобрать материалы</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {favoriteIds.length > 0 && (
        <div
          role="tablist"
          aria-label="Фильтр избранной литературы по дисциплинам"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
        >
          {LITERATURE_DISCIPLINE_TABS.map((tab) => {
            const count =
              tab.id === 'all'
                ? favoriteIds.length
                : RECOMMENDED_LITERATURE.filter(
                    (l) => favoriteIds.includes(l.id) && l.discipline === tab.id
                  ).length;
            if (tab.id !== 'all' && count === 0) return null;
            const active = disciplineFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setDisciplineFilter(tab.id)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
      )}

      {savedBooks.length === 0 ? (
        <div className="py-8 px-5 bg-slate-50 border border-slate-200 rounded-lg text-center space-y-2.5">
          <p className="text-sm font-semibold text-slate-900">
            {favoriteIds.length === 0
              ? 'Список «Избранное» пока пуст'
              : 'В выбранной дисциплине сохранённых материалов нет'}
          </p>
          <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
            Перейдите в раздел «Обзор центра» и нажмите «Сохранить в избранное» на нужных учебниках
            по ПП № 1893, спасработам или первой помощи.
          </p>
          {onOpenOverviewLibrary && (
            <button
              type="button"
              onClick={onOpenOverviewLibrary}
              className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <span>Перейти к рекомендуемой литературе</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
          {savedBooks.map((book) => (
            <div
              key={book.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span className="font-semibold text-teal-800">{book.disciplineLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>{book.publisherYear}</span>
                </div>
                <p className="text-sm font-semibold text-slate-900 leading-snug">{book.title}</p>
                <p className="text-xs text-slate-600">
                  {book.authors} — {book.examRelevance}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleRemove(book.id, book.title)}
                aria-label={`Удалить «${book.title}» из избранного`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-700 bg-white border border-slate-200 hover:border-red-200 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-center cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Убрать</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
