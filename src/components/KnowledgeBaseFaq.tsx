import React, { useMemo, useState } from 'react';
import { BookOpen, ChevronDown, MessageSquare, Search, X } from 'lucide-react';
import { ATTESTATION_FAQ } from '../data/researchData';
import { tracker } from '../utils/tracker';

interface KnowledgeBaseFaqProps {
  onContactCurator: (sourceLabel: string) => void;
}

type FaqCategoryFilter = 'all' | 'procedure' | 'training' | 'region';

const QUICK_TOPICS = ['документы', 'Контур А', '27 200 ₽', 'пересдача', '5 лет', 'ООПТ'];

export const KnowledgeBaseFaq: React.FC<KnowledgeBaseFaqProps> = ({
  onContactCurator,
}) => {
  const [category, setCategory] = useState<FaqCategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [openIds, setOpenIds] = useState<string[]>([ATTESTATION_FAQ[0].id]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredFaq = useMemo(
    () =>
      ATTESTATION_FAQ.filter((item) => {
        const matchesCategory = category === 'all' || item.category === category;
        if (!matchesCategory) return false;
        if (!normalizedQuery) return true;
        return (
          item.question.toLowerCase().includes(normalizedQuery) ||
          item.answer.toLowerCase().includes(normalizedQuery) ||
          item.categoryLabel.toLowerCase().includes(normalizedQuery)
        );
      }),
    [category, normalizedQuery]
  );

  const toggleItem = (id: string, question: string) => {
    setOpenIds((prev) => {
      const exists = prev.includes(id);
      if (!exists) {
        tracker.trackCustomInteraction(`База знаний FAQ: ${question.slice(0, 60)}`);
      }
      return exists ? prev.filter((item) => item !== id) : [...prev, id];
    });
  };

  const applyQuickTopic = (topic: string) => {
    setCategory('all');
    setSearchQuery(topic);
    const matched = ATTESTATION_FAQ.filter(
      (item) =>
        item.question.toLowerCase().includes(topic.toLowerCase()) ||
        item.answer.toLowerCase().includes(topic.toLowerCase())
    ).map((item) => item.id);
    if (matched.length > 0) {
      setOpenIds(matched);
    }
    tracker.trackCustomInteraction(`База знаний быстрый тег: ${topic}`);
  };

  return (
    <section
      aria-labelledby="knowledge-base-heading"
      className="bg-white border border-slate-200 rounded-xl p-8 space-y-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Справочник соискателя · Быстрый поиск ответов</span>
          </p>
          <h2 id="knowledge-base-heading" className="text-xl font-bold text-slate-900">
            База знаний
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Часто задаваемые вопросы по допуску, подтверждению походного стажа, стоимости
            обучения в ВВГУ, пересдаче и требованиям к работе в ДФО.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'all', label: `Все (${ATTESTATION_FAQ.length})` },
                { id: 'procedure', label: 'Процедура и сроки' },
                { id: 'training', label: 'Обучение и стоимость' },
                { id: 'region', label: 'Требования ДФО' },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  category === cat.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {filteredFaq.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const allVisibleIds = filteredFaq.map((f) => f.id);
                const allOpen = allVisibleIds.every((id) => openIds.includes(id));
                setOpenIds(allOpen ? [] : allVisibleIds);
              }}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {filteredFaq.every((f) => openIds.includes(f.id))
                ? 'Свернуть все'
                : 'Раскрыть все'}
            </button>
          )}
        </div>
      </div>

      {/* Search & Quick Topic Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-xl">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по базе знаний: документы, МКК, пересдача, 27 200 ₽, ДПО..."
              aria-label="Поиск по базе знаний"
              className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:bg-white transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Очистить поиск по базе знаний"
                className="p-1 text-slate-400 hover:text-slate-700 absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
          <p className="text-xs font-mono text-slate-500 tabular-nums shrink-0">
            Найдено вопросов: {filteredFaq.length} / {ATTESTATION_FAQ.length}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500 mr-1">Частые запросы:</span>
          {QUICK_TOPICS.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => applyQuickTopic(topic)}
              className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors cursor-pointer ${
                searchQuery.toLowerCase() === topic.toLowerCase()
                  ? 'bg-teal-50 border-teal-300 text-teal-800'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              {topic}
            </button>
          ))}
        </div>
      </div>

      {/* FAQ Accordion */}
      <div className="divide-y divide-slate-200 border-t border-slate-200">
        {filteredFaq.length === 0 ? (
          <div className="py-8 text-center space-y-3">
            <p className="text-sm font-medium text-slate-800">
              По запросу «{searchQuery}» в выбранной категории ответов не найдено.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setCategory('all');
                  setSearchQuery('');
                }}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Сбросить фильтр и поиск
              </button>
              <button
                type="button"
                onClick={() => onContactCurator('База знаний: ответ не найден')}
                className="px-3.5 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Задать вопрос куратору</span>
              </button>
            </div>
          </div>
        ) : (
          filteredFaq.map((item) => {
            const isOpen = openIds.includes(item.id);
            return (
              <div key={item.id} className="py-4">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => toggleItem(item.id, item.question)}
                  className="w-full text-left flex items-start justify-between gap-4 py-1 cursor-pointer group focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
                >
                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-teal-700">
                      {item.categoryLabel}
                    </span>
                    <h3 className="text-sm sm:text-base font-semibold text-slate-900 group-hover:text-teal-800 transition-colors">
                      {item.question}
                    </h3>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 mt-1 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-teal-700' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {isOpen && (
                  <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-4xl">
                    {item.answer}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="pt-5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-slate-600">
          Не нашли ответ на нестандартный случай по походному опыту или пересдаче? Передайте
          вопрос дежурному куратору РЦА.
        </p>
        <button
          type="button"
          onClick={() => onContactCurator('База знаний (FAQ)')}
          className="px-4 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <MessageSquare className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
          <span>Связаться с куратором</span>
        </button>
      </div>
    </section>
  );
};
