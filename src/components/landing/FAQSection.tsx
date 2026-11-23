import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  HelpCircle,
  Phone,
  Search,
  X,
} from 'lucide-react';
import { ATTESTATION_FAQ, type FaqItem } from '../../data/researchData';
import { tracker } from '../../utils/tracker';

type FaqCategoryFilter = 'all' | FaqItem['category'];

const CATEGORY_TABS: { id: FaqCategoryFilter; label: string }[] = [
  { id: 'all', label: 'Все вопросы' },
  { id: 'procedure', label: 'Порядок и сроки' },
  { id: 'training', label: 'Обучение и стоимость' },
  { id: 'region', label: 'Специфика ДФО' },
];

export interface FAQSectionProps {
  onNavigateToContacts?: () => void;
  onNavigateToCertification?: () => void;
}

/**
 * «FAQ» — публичный раздел лендинга с ответами на частые вопросы
 * о порядке аттестации инструкторов-проводников в РЦА «Русский Восток».
 */
export function FAQSection({
  onNavigateToContacts,
  onNavigateToCertification,
}: FAQSectionProps = {}) {
  const [category, setCategory] = useState<FaqCategoryFilter>('all');
  const [query, setQuery] = useState<string>('');
  const [openIds, setOpenIds] = useState<string[]>(() =>
    ATTESTATION_FAQ.slice(0, 2).map((item) => item.id)
  );

  const normalizedQuery = query.trim().toLowerCase();

  const filteredItems = useMemo(() => {
    return ATTESTATION_FAQ.filter((item) => {
      if (category !== 'all' && item.category !== category) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return (
        item.question.toLowerCase().includes(normalizedQuery) ||
        item.answer.toLowerCase().includes(normalizedQuery) ||
        item.categoryLabel.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [category, normalizedQuery]);

  const allVisibleOpen =
    filteredItems.length > 0 && filteredItems.every((item) => openIds.includes(item.id));

  const toggleItem = (item: FaqItem) => {
    setOpenIds((prev) => {
      const exists = prev.includes(item.id);
      if (!exists) {
        tracker.trackCustomInteraction(
          `Лендинг FAQ · ${item.question.slice(0, 56)}`,
          item.categoryLabel
        );
      }
      return exists ? prev.filter((id) => id !== item.id) : [...prev, item.id];
    });
  };

  const handleToggleAll = () => {
    if (allVisibleOpen) {
      const visibleSet = new Set(filteredItems.map((i) => i.id));
      setOpenIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      setOpenIds((prev) => Array.from(new Set([...prev, ...filteredItems.map((i) => i.id)])));
    }
  };

  return (
    <section aria-labelledby="faq-section-heading" className="space-y-6">
      <header id="faq" className="scroll-mt-24 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
          Частые вопросы
        </p>
        <h2
          id="faq-section-heading"
          className="text-2xl font-bold text-slate-900 text-balance"
        >
          Порядок аттестации инструкторов-проводников
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
          Разъяснения по требованиям Постановления Правительства РФ № 1003 (ред. № 1893),
          перечню документов, программе подготовки в ВВГУ, стоимости обучения и полевым
          испытаниям на полигонах Приморского края.
        </p>
      </header>

      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        {/* Controls: Category Filter Tabs + Search + Expand All */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div
            role="tablist"
            aria-label="Категории вопросов об аттестации"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start"
          >
            {CATEGORY_TABS.map((tab) => {
              const active = category === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setCategory(tab.id);
                    tracker.trackCustomInteraction(`Лендинг FAQ · фильтр ${tab.label}`, 'faq');
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
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

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 sm:w-72">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по вопросам и документам…"
                aria-label="Поиск по частым вопросам"
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:bg-white transition-colors"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Очистить поиск"
                  className="p-1 text-slate-400 hover:text-slate-700 absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            {filteredItems.length > 0 && (
              <button
                type="button"
                onClick={handleToggleAll}
                className="px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                {allVisibleOpen ? 'Свернуть все' : 'Раскрыть все'}
              </button>
            )}
          </div>
        </div>

        {/* Metadata bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
            <span>Актуальный регламент РЦА «Русский Восток» · ФСТР и ВВГУ</span>
          </span>
          <span className="font-mono tabular-nums">
            Показано вопросов: {filteredItems.length} из {ATTESTATION_FAQ.length}
          </span>
        </div>

        {/* Accordion List */}
        {filteredItems.length === 0 ? (
          <div className="py-10 px-4 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <p className="text-sm font-medium text-slate-800">
              По запросу «{query}» ответы не найдены.
            </p>
            <button
              type="button"
              onClick={() => {
                setCategory('all');
                setQuery('');
              }}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Показать все вопросы
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 border-t border-slate-200">
            {filteredItems.map((item, idx) => {
              const isOpen = openIds.includes(item.id);
              const numberLabel = String(idx + 1).padStart(2, '0');
              return (
                <div key={item.id} className="py-4">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`landing-faq-panel-${item.id}`}
                    onClick={() => toggleItem(item)}
                    className="w-full text-left flex items-start justify-between gap-4 py-1 cursor-pointer group focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono text-slate-400 tabular-nums">
                          {numberLabel}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium text-teal-700">{item.categoryLabel}</span>
                      </div>
                      <h3 className="text-sm sm:text-base font-semibold text-slate-900 group-hover:text-teal-800 transition-colors leading-snug">
                        {item.question}
                      </h3>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 mt-1.5 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-teal-700' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>

                  {isOpen && (
                    <div
                      id={`landing-faq-panel-${item.id}`}
                      className="mt-3 pl-0 sm:pl-7 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-4xl"
                    >
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Contextual Next Action Strip */}
        <div className="pt-5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
            Остались вопросы по подтверждению походного стажа, маршрутным книжкам или
            субсидированию обучения сотрудников?
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            {onNavigateToCertification && (
              <button
                type="button"
                onClick={onNavigateToCertification}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <CalendarDays className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                <span>График аттестаций</span>
              </button>
            )}
            {onNavigateToContacts && (
              <button
                type="button"
                onClick={onNavigateToContacts}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Задать вопрос центру</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
