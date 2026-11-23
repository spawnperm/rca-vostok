import React, { useMemo, useState } from 'react';
import { ChevronDown, HelpCircle, MessageSquare, Search, X } from 'lucide-react';
import { ATTESTATION_FAQ, type FaqItem } from '../data/researchData';
import { tracker } from '../utils/tracker';

interface OverviewAttestationFaqProps {
  onContactCurator: (sourceLabel: string) => void;
}

type FaqFilter = 'all' | FaqItem['category'];

const FILTER_TABS: readonly { id: FaqFilter; label: string }[] = [
  { id: 'all', label: 'Все вопросы' },
  { id: 'procedure', label: 'Процедура и сроки' },
  { id: 'training', label: 'Обучение и опыт' },
  { id: 'region', label: 'Специфика ДФО' },
];

export const OverviewAttestationFaq: React.FC<OverviewAttestationFaqProps> = ({
  onContactCurator,
}) => {
  const [filter, setFilter] = useState<FaqFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [openIds, setOpenIds] = useState<string[]>([ATTESTATION_FAQ[0].id]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const visibleItems = useMemo(() => {
    const byCategory =
      filter === 'all'
        ? normalizedQuery
          ? ATTESTATION_FAQ
          : ATTESTATION_FAQ.slice(0, 8)
        : ATTESTATION_FAQ.filter((item) => item.category === filter);

    if (!normalizedQuery) return byCategory;

    return byCategory.filter(
      (item) =>
        item.question.toLowerCase().includes(normalizedQuery) ||
        item.answer.toLowerCase().includes(normalizedQuery) ||
        item.categoryLabel.toLowerCase().includes(normalizedQuery)
    );
  }, [filter, normalizedQuery]);

  const allExpanded =
    visibleItems.length > 0 && visibleItems.every((item) => openIds.includes(item.id));

  const toggleItem = (item: FaqItem) => {
    setOpenIds((prev) => {
      const exists = prev.includes(item.id);
      if (!exists) {
        tracker.trackCustomInteraction(
          `FAQ под заявками: ${item.question.slice(0, 56)}`,
          item.categoryLabel
        );
      }
      return exists ? prev.filter((id) => id !== item.id) : [...prev, item.id];
    });
  };

  const toggleAllVisible = () => {
    if (allExpanded) {
      const visibleSet = new Set(visibleItems.map((i) => i.id));
      setOpenIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      setOpenIds((prev) => Array.from(new Set([...prev, ...visibleItems.map((i) => i.id)])));
    }
  };

  return (
    <section
      id="overview-attestation-faq"
      aria-labelledby="overview-faq-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Частые вопросы о процедуре аттестации</span>
          </p>
          <h2 id="overview-faq-heading" className="text-xl font-bold text-slate-900 text-balance">
            Ответы на ключевые вопросы перед подачей заявки
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Нажмите на любой вопрос, чтобы плавно развернуть разъяснение по регламенту,
            перечню документов, зачёту стажа и полевым испытаниям в РЦА «Русский Восток».
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div
            role="tablist"
            aria-label="Фильтр вопросов об аттестации"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {FILTER_TABS.map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(tab.id)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {visibleItems.length > 0 && (
            <button
              type="button"
              onClick={toggleAllVisible}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              {allExpanded ? 'Свернуть все' : 'Раскрыть все'}
            </button>
          )}
        </div>
      </div>

      {/* Real-time keyword search bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xl">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="overview-faq-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по ключевым словам: документы, Контур А, полигон, стоимость, ООПТ..."
            aria-label="Поиск по вопросам FAQ об аттестации"
            className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:bg-white transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Очистить строку поиска FAQ"
              className="p-1 text-slate-400 hover:text-slate-700 absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="text-xs font-mono text-slate-500 tabular-nums shrink-0">
          Показано вопросов: {visibleItems.length}
        </p>
      </div>

      {visibleItems.length === 0 ? (
        <div className="py-6 px-4 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-3">
          <p className="text-sm font-medium text-slate-800">
            По запросу «{searchQuery}» вопросов в выбранной категории не найдено.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setFilter('all');
                setSearchQuery('');
              }}
              className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Сбросить поиск
            </button>
            <button
              type="button"
              onClick={() => onContactCurator('FAQ: поиск не дал результата')}
              className="px-3.5 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Спросить куратора</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-slate-200">
          {visibleItems.map((item, idx) => {
            const isOpen = openIds.includes(item.id);
            const panelId = `overview-faq-panel-${item.id}`;
            const triggerId = `overview-faq-trigger-${item.id}`;

            return (
              <div key={item.id} className="py-3.5 first:pt-1 last:pb-1">
                <button
                  id={triggerId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggleItem(item)}
                  className="w-full text-left flex items-start justify-between gap-4 py-1.5 cursor-pointer group focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700 rounded-md"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-semibold text-teal-700 tabular-nums">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{item.categoryLabel}</span>
                    </div>
                    <h3 className="text-sm sm:text-base font-semibold text-slate-900 group-hover:text-teal-800 transition-colors leading-snug">
                      {item.question}
                    </h3>
                  </div>

                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 mt-1.5 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                      isOpen ? 'rotate-180 text-teal-700' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>

                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={triggerId}
                  aria-hidden={!isOpen}
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="pt-2.5 pb-1 sm:pl-7 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-4xl">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Нужно уточнение по вашей категории сложности или маршрутной книжке?
        </p>
        <button
          type="button"
          onClick={() => onContactCurator('FAQ под виджетом заявок')}
          className="px-3.5 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <MessageSquare className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
          <span>Задать вопрос куратору</span>
        </button>
      </div>
    </section>
  );
};
