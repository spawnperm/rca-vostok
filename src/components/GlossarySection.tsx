import React, { useMemo, useState } from 'react';
import { BookOpen, ChevronDown, MessageSquare, Search, X } from 'lucide-react';
import { GLOSSARY_TERMS, type GlossaryTerm } from '../data/researchData.ts';
import { tracker } from '../utils/tracker.ts';

export type GlossaryCategoryFilter = 'all' | GlossaryTerm['category'];

const QUICK_GLOSSARY_TOPICS = [
  '132-ФЗ',
  '1003',
  '760',
  'МКК',
  'Контур А',
  'реестр',
  'ООПТ',
] as const;

export function filterGlossaryTerms(
  terms: readonly GlossaryTerm[],
  query: string,
  category: GlossaryCategoryFilter = 'all'
): GlossaryTerm[] {
  const normalized = query.trim().toLowerCase();
  return terms.filter((item) => {
    if (category !== 'all' && item.category !== category) {
      return false;
    }
    if (!normalized) return true;
    const haystack = `${item.term} ${item.shortTag} ${item.categoryLabel} ${item.definition} ${item.contextNote}`.toLowerCase();
    return haystack.includes(normalized);
  });
}

interface GlossaryTooltipTermProps {
  termItem: GlossaryTerm;
  displayText?: string;
  isPinned: boolean;
  onPinToggle: (term: GlossaryTerm) => void;
}

const GlossaryTooltipTerm: React.FC<GlossaryTooltipTermProps> = ({
  termItem,
  displayText,
  isPinned,
  onPinToggle,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const isOpen = isHovered || isPinned;

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        type="button"
        onClick={() => onPinToggle(termItem)}
        onFocus={() => setIsHovered(true)}
        onBlur={() => setIsHovered(false)}
        aria-describedby={`tooltip-inline-${termItem.id}`}
        aria-expanded={isOpen}
        className={`inline font-medium border-b border-dotted transition-colors cursor-help focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
          isOpen
            ? 'text-teal-800 border-teal-800 bg-teal-50/70 rounded-xs px-0.5'
            : 'text-teal-800 border-teal-700/70 hover:text-teal-900 hover:border-teal-900'
        }`}
      >
        {displayText ?? termItem.term}
      </button>

      <span
        id={`tooltip-inline-${termItem.id}`}
        role="tooltip"
        className={`absolute z-30 bottom-full left-0 sm:left-1/2 sm:-translate-x-1/2 mb-2.5 w-72 sm:w-80 max-w-[calc(100vw-3rem)] p-4 rounded-lg bg-slate-900 text-white shadow-lg border border-slate-700 text-left transition-[opacity,transform] duration-150 ${
          isOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-1 pointer-events-none'
        }`}
      >
        <span className="block text-[11px] font-mono text-teal-300 tabular-nums">
          {termItem.categoryLabel} · {termItem.shortTag}
        </span>
        <span className="block mt-1 text-sm font-semibold text-white">
          {termItem.term}
        </span>
        <span className="block mt-1.5 text-xs text-slate-200 leading-relaxed font-normal">
          {termItem.definition}
        </span>
        <span className="block mt-2 pt-2 border-t border-slate-700/80 text-[11px] text-slate-300 leading-snug font-normal">
          {termItem.contextNote}
        </span>
      </span>
    </span>
  );
};

interface GlossarySectionProps {
  onContactCurator?: (sourceLabel: string) => void;
}

export const GlossarySection: React.FC<GlossarySectionProps> = ({
  onContactCurator,
}) => {
  const [glossaryCategory, setGlossaryCategory] =
    useState<GlossaryCategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pinnedGlossaryId, setPinnedGlossaryId] = useState<string | null>(null);

  const glossaryById = useMemo(
    () =>
      Object.fromEntries(GLOSSARY_TERMS.map((t) => [t.id, t])) as Record<
        string,
        GlossaryTerm
      >,
    []
  );

  const filteredGlossary = useMemo(
    () => filterGlossaryTerms(GLOSSARY_TERMS, searchQuery, glossaryCategory),
    [searchQuery, glossaryCategory]
  );

  const handleToggleGlossaryPin = (term: GlossaryTerm) => {
    setPinnedGlossaryId((prev) => {
      const next = prev === term.id ? null : term.id;
      if (next) {
        tracker.trackCustomInteraction(
          `Глоссарий: ${term.term}`,
          term.categoryLabel
        );
      }
      return next;
    });
  };

  const applyQuickTag = (tag: string) => {
    setGlossaryCategory('all');
    setSearchQuery(tag);
    tracker.trackCustomInteraction(`Глоссарий быстрый тег: ${tag}`);
  };

  return (
    <section
      id="glossary-section"
      aria-labelledby="glossary-heading"
      className="bg-white border border-slate-200 rounded-xl p-8 space-y-6 scroll-mt-24"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-medium text-teal-700">
            Нормативная база аттестации · Терминологический справочник
          </p>
          <h2
            id="glossary-heading"
            className="text-xl font-bold text-slate-900 inline-flex items-center gap-2"
          >
            <BookOpen
              className="w-5 h-5 text-teal-700 shrink-0"
              aria-hidden="true"
            />
            <span>Глоссарий основных понятий</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Ключевые определения и нормативно-правовые основания аттестации
            инструкторов-проводников (ФЗ № 132-ФЗ, ПП РФ № 1003/1893, № 760,
            требования МКК и ФСТР).
          </p>
        </div>

        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(
            [
              { id: 'all', label: `Все понятия (${GLOSSARY_TERMS.length})` },
              { id: 'regulation', label: 'Правовой статус' },
              { id: 'procedure', label: 'Процедура и маршруты' },
              { id: 'economics', label: 'Экономика и модель' },
            ] as const
          ).map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setGlossaryCategory(cat.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                glossaryCategory === cat.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search & Quick Normative Tags */}
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
              placeholder="Поиск по глоссарию: 132-ФЗ, 1003, 760, МКК, реестр, паспорт..."
              aria-label="Поиск по глоссарию основных понятий"
              className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:bg-white transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Очистить поиск по глоссарию"
                className="p-1 text-slate-400 hover:text-slate-700 absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <p className="text-xs font-mono text-slate-500 tabular-nums shrink-0">
            Найдено понятий: {filteredGlossary.length} / {GLOSSARY_TERMS.length}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500 mr-1">Ключевые запросы:</span>
          {QUICK_GLOSSARY_TOPICS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => applyQuickTag(tag)}
              className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors cursor-pointer ${
                searchQuery.trim().toLowerCase() === tag.toLowerCase()
                  ? 'bg-teal-50 border-teal-300 text-teal-800'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Contextual editorial prose with hover/focus inline glossary tooltips */}
      {!searchQuery.trim() && glossaryById['term-instructor-guide'] && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 space-y-3">
          <p className="text-xs font-medium text-slate-500">
            Наведите курсор на выделенное понятие (или сфокусируйтесь с
            клавиатуры), чтобы открыть всплывающее определение
          </p>
          <p className="text-sm sm:text-base text-slate-800 leading-relaxed max-w-4xl">
            В соответствии с действующим законодательством РФ, каждый{' '}
            <GlossaryTooltipTerm
              termItem={glossaryById['term-instructor-guide']}
              displayText="инструктор-проводник"
              isPinned={pinnedGlossaryId === 'term-instructor-guide'}
              onPinToggle={handleToggleGlossaryPin}
            />
            , сопровождающий туристические группы на активных маршрутах, обязан
            пройти государственную{' '}
            <GlossaryTooltipTerm
              termItem={glossaryById['term-attestation']}
              displayText="аттестацию"
              isPinned={pinnedGlossaryId === 'term-attestation'}
              onPinToggle={handleToggleGlossaryPin}
            />{' '}
            с учётом заявленной{' '}
            <GlossaryTooltipTerm
              termItem={glossaryById['term-difficulty-category']}
              displayText="категории сложности"
              isPinned={pinnedGlossaryId === 'term-difficulty-category'}
              onPinToggle={handleToggleGlossaryPin}
            />
            . На теоретическом этапе в ВВГУ соискатель защищает{' '}
            <GlossaryTooltipTerm
              termItem={glossaryById['term-route-passport']}
              displayText="паспорт маршрута"
              isPinned={pinnedGlossaryId === 'term-route-passport'}
              onPinToggle={handleToggleGlossaryPin}
            />
            , после полевых испытаний сведения вносятся в{' '}
            <GlossaryTooltipTerm
              termItem={glossaryById['term-federal-registry']}
              displayText="Единый федеральный реестр"
              isPinned={pinnedGlossaryId === 'term-federal-registry'}
              onPinToggle={handleToggleGlossaryPin}
            />
            . Чтобы вовлечь в легальное поле{' '}
            <GlossaryTooltipTerm
              termItem={glossaryById['term-unlegalized-reserve']}
              displayText="нелегализованный резерв"
              isPinned={pinnedGlossaryId === 'term-unlegalized-reserve'}
              onPinToggle={handleToggleGlossaryPin}
            />{' '}
            опытных гидов ДФО, применяется{' '}
            <GlossaryTooltipTerm
              termItem={glossaryById['term-two-contour']}
              displayText="двухконтурная модель (Контур А / Б)"
              isPinned={pinnedGlossaryId === 'term-two-contour'}
              onPinToggle={handleToggleGlossaryPin}
            />
            .
          </p>
        </div>
      )}

      {/* Searchable Glossary Cards Grid */}
      {filteredGlossary.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center space-y-3">
          <p className="text-sm font-medium text-slate-800">
            По запросу «{searchQuery}» в выбранной категории понятий не
            найдено.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setGlossaryCategory('all');
                setSearchQuery('');
              }}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Сбросить поиск и фильтр
            </button>
            {onContactCurator && (
              <button
                type="button"
                onClick={() =>
                  onContactCurator('Глоссарий: понятие не найдено')
                }
                className="px-3.5 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Уточнить у куратора</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGlossary.map((item) => {
            const isExpanded = pinnedGlossaryId === item.id;
            return (
              <article
                key={item.id}
                className={`rounded-lg border p-4 transition-colors flex flex-col justify-between gap-3 ${
                  isExpanded
                    ? 'bg-teal-50/35 border-teal-700'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2 text-[11px] text-slate-500">
                    <span className="font-medium text-teal-800">
                      {item.categoryLabel}
                    </span>
                    <span className="font-mono tabular-nums text-right">
                      {item.shortTag}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">
                    {item.term}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {item.definition}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-2">
                  {isExpanded && (
                    <p className="text-[11px] text-slate-700 bg-slate-50 border border-slate-200 rounded-md p-2.5 leading-relaxed">
                      <span className="font-semibold text-teal-800">
                        Примечание к применению:{' '}
                      </span>
                      {item.contextNote}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => handleToggleGlossaryPin(item)}
                    aria-expanded={isExpanded}
                    className="text-[11px] font-medium text-teal-800 hover:text-teal-950 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>
                      {isExpanded
                        ? 'Скрыть примечание'
                        : 'Показать нормативный контекст'}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-150 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
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
