import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  Eye,
  EyeOff,
  MessageSquare,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { GLOSSARY_TERMS, type GlossaryTerm } from '../data/researchData.ts';
import {
  tokenizeTextWithGlossary,
  type GlossarySegment,
} from '../utils/glossaryHighlighter.ts';
import { tracker } from '../utils/tracker.ts';

export type GlossaryCategoryFilter = 'all' | GlossaryTerm['category'];

const QUICK_GLOSSARY_TOPICS = [
  'активный туризм',
  'инструктор-проводник',
  '132-ФЗ',
  '1003',
  '760',
  'МКК',
  'Контур А',
  'ООПТ',
] as const;

interface GlossaryReadingPassage {
  id: string;
  label: string;
  title: string;
  text: string;
}

const READING_PASSAGES: GlossaryReadingPassage[] = [
  {
    id: 'legal-status',
    label: '01. Правовой статус и реестр',
    title: 'Регулирование работы инструктора-проводника по ФЗ № 132-ФЗ',
    text: 'Согласно ФЗ № 132-ФЗ и ПП РФ № 1003 (в ред. ПП РФ № 1893), каждый инструктор-проводник на маршрутах, требующих специального сопровождения, обязан пройти государственную аттестацию. По итогам проверки сведения вносятся в Единый федеральный реестр сроком на 5 лет, а специалист получает право законно работать во всех регионах РФ, включая территории с режимом ООПТ.',
  },
  {
    id: 'exam-stages',
    label: '02. Этапы экзамена и полигон',
    title: 'Защита паспорта маршрута и полевые испытания в РЦА',
    text: 'Допуск в Региональный центр аттестации (РЦА) учитывает заявленную категорию сложности и походный стаж, подтверждённый через МКК или Контур А. На теоретическом этапе соискатель защищает паспорт маршрута по Постановлению Правительства РФ № 760, а на полевом полигоне в Приморье демонстрирует навыки спасработ и протоколы Wilderness First Aid.',
  },
  {
    id: 'two-contour-dfo',
    label: '03. Двухконтурная модель ДФО',
    title: 'Легализация кадров через программы ДПО ВВГУ',
    text: 'Чтобы вовлечь нелегализованный резерв действующих практиков, в Приморском крае внедрена двухконтурная модель. Опытные гиды проходят модульное обучение Контура А, а новые специалисты осваивают программу ДПО ВВГУ объёмом 250 часов, выходя на экзамен РЦА без повторного переучивания.',
  },
];

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

interface InlineTermPopoverProps {
  term: GlossaryTerm;
  matchedText: string;
  showDirectoryLink?: boolean;
  onInspectTerm?: (term: GlossaryTerm) => void;
}

const InlineTermPopover: React.FC<InlineTermPopoverProps> = ({
  term,
  matchedText,
  showDirectoryLink = false,
  onInspectTerm,
}) => {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [placement, setPlacement] = useState<'top' | 'bottom'>('top');
  const [hAlign, setHAlign] = useState<'center' | 'left' | 'right'>('center');

  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const popoverId = useId();

  const isOpen = hovered || pinned;

  const updatePosition = () => {
    const el = wrapperRef.current;
    if (!el || typeof window === 'undefined') return;
    const rect = el.getBoundingClientRect();
    const spaceAbove = rect.top;
    const viewportWidth = window.innerWidth;

    setPlacement(spaceAbove < 230 ? 'bottom' : 'top');

    if (rect.left < 160) {
      setHAlign('left');
    } else if (viewportWidth - rect.right < 160) {
      setHAlign('right');
    } else {
      setHAlign('center');
    }
  };

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleMouseEnter = () => {
    clearCloseTimer();
    updatePosition();
    setHovered(true);
  };

  const handleMouseLeave = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setHovered(false);
    }, 120);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinned(false);
        setHovered(false);
      }
    };
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        pinned &&
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setPinned(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, pinned]);

  useEffect(() => () => clearCloseTimer(), []);

  const verticalClass =
    placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2';
  const horizontalClass =
    hAlign === 'left'
      ? 'left-0'
      : hAlign === 'right'
        ? 'right-0'
        : 'left-1/2 -translate-x-1/2';

  return (
    <span
      ref={wrapperRef}
      className="relative inline"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={() => {
          updatePosition();
          setPinned((prev) => {
            const next = !prev;
            if (next) {
              tracker.trackCustomInteraction(
                `Интерактивный глоссарий · ${term.term}`,
                term.categoryLabel
              );
            }
            return next;
          });
        }}
        onFocus={() => {
          updatePosition();
          setHovered(true);
        }}
        onBlur={() => setHovered(false)}
        aria-describedby={isOpen ? popoverId : undefined}
        aria-expanded={isOpen}
        className={`inline text-left [font-weight:inherit] border-b-2 border-dotted transition-colors duration-150 cursor-help rounded-xs px-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
          isOpen
            ? 'text-teal-900 border-teal-800 bg-teal-100/90'
            : 'text-teal-800 border-teal-700/75 bg-teal-50/60 hover:bg-teal-100/75 hover:text-teal-950'
        }`}
      >
        {matchedText}
      </button>

      {isOpen && (
        <span
          id={popoverId}
          role="dialog"
          aria-label={`Определение термина: ${term.term}`}
          className={`absolute z-40 ${verticalClass} ${horizontalClass} w-72 sm:w-80 max-w-[calc(100vw-2rem)] p-4 rounded-xl bg-slate-900 text-white shadow-xl border border-slate-700 text-left font-normal tracking-normal leading-normal`}
        >
          <span className="flex items-start justify-between gap-2">
            <span className="block text-[11px] font-mono text-teal-300 tabular-nums">
              {term.categoryLabel} · {term.shortTag}
            </span>
            {pinned && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPinned(false);
                  setHovered(false);
                }}
                aria-label="Закрыть определение"
                className="p-0.5 text-slate-400 hover:text-white rounded cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </span>

          <span className="block mt-1 text-sm font-semibold text-white leading-snug">
            {term.term}
          </span>

          <span className="block mt-1.5 text-xs text-slate-200 leading-relaxed font-normal">
            {term.definition}
          </span>

          <span className="block mt-2.5 pt-2 border-t border-slate-700/80 text-[11px] text-slate-300 leading-snug font-normal">
            {term.contextNote}
          </span>

          {(showDirectoryLink || onInspectTerm) && (
            <span className="block mt-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPinned(false);
                  setHovered(false);
                  if (onInspectTerm) {
                    onInspectTerm(term);
                  } else {
                    document
                      .getElementById('glossary-section')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                className="text-[11px] font-medium text-teal-300 hover:text-teal-200 underline underline-offset-2 cursor-pointer"
              >
                Открыть термин в глоссарии
              </button>
            </span>
          )}
        </span>
      )}
    </span>
  );
};

export interface GlossaryTextProps {
  text: string;
  enabled?: boolean;
  maxMatchesPerTerm?: number;
  showDirectoryLink?: boolean;
  onInspectTerm?: (term: GlossaryTerm) => void;
}

/**
 * Automatically highlights recognized attestation glossary terms inside arbitrary
 * Russian prose and attaches an accessible hover/focus/click definition popover.
 */
export const GlossaryText: React.FC<GlossaryTextProps> = ({
  text,
  enabled = true,
  maxMatchesPerTerm = 1,
  showDirectoryLink = false,
  onInspectTerm,
}) => {
  const segments: GlossarySegment[] = useMemo(() => {
    if (!enabled) {
      return [{ type: 'text', text }];
    }
    return tokenizeTextWithGlossary(text, GLOSSARY_TERMS, { maxMatchesPerTerm });
  }, [text, enabled, maxMatchesPerTerm]);

  if (!enabled) {
    return <>{text}</>;
  }

  return (
    <>
      {segments.map((seg, idx) =>
        seg.type === 'text' ? (
          <React.Fragment key={idx}>{seg.text}</React.Fragment>
        ) : (
          <InlineTermPopover
            key={`${seg.term.id}-${idx}`}
            term={seg.term}
            matchedText={seg.text}
            showDirectoryLink={showDirectoryLink}
            onInspectTerm={onInspectTerm}
          />
        )
      )}
    </>
  );
};

export interface InteractiveGlossaryProps {
  onContactCurator?: (sourceLabel: string) => void;
  highlightInOverview?: boolean;
  onToggleHighlightInOverview?: () => void;
  focusedTermRequest?: { termId: string; nonce: number } | null;
}

export const InteractiveGlossary: React.FC<InteractiveGlossaryProps> = ({
  onContactCurator,
  highlightInOverview = true,
  onToggleHighlightInOverview,
  focusedTermRequest,
}) => {
  const [glossaryCategory, setGlossaryCategory] =
    useState<GlossaryCategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pinnedGlossaryId, setPinnedGlossaryId] = useState<string | null>(null);
  const [activePassageId, setActivePassageId] = useState<string>(
    READING_PASSAGES[0].id
  );
  const [customTextMode, setCustomTextMode] = useState<boolean>(false);
  const [customText, setCustomText] = useState<string>(
    'Активный туризм в ДФО требует участия аттестованного специалиста: инструктор-проводник подтверждает походный стаж через МКК или Контур А, защищает паспорт маршрута по ПП РФ № 760 и вносится в Единый федеральный реестр.'
  );

  useEffect(() => {
    if (!focusedTermRequest?.termId) return;
    setGlossaryCategory('all');
    setSearchQuery('');
    setPinnedGlossaryId(focusedTermRequest.termId);
    window.setTimeout(() => {
      document
        .getElementById(`glossary-card-${focusedTermRequest.termId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  }, [focusedTermRequest]);

  const activePassage =
    READING_PASSAGES.find((p) => p.id === activePassageId) ??
    READING_PASSAGES[0];
  const inspectedText = customTextMode ? customText : activePassage.text;

  const detectedTermsInPassage = useMemo(() => {
    const segments = tokenizeTextWithGlossary(inspectedText, GLOSSARY_TERMS, {
      maxMatchesPerTerm: 2,
    });
    const map = new Map<string, GlossaryTerm>();
    for (const seg of segments) {
      if (seg.type === 'term') {
        map.set(seg.term.id, seg.term);
      }
    }
    return Array.from(map.values());
  }, [inspectedText]);

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

  const focusTermCard = (term: GlossaryTerm) => {
    setGlossaryCategory('all');
    setSearchQuery('');
    setPinnedGlossaryId(term.id);
    document
      .getElementById(`glossary-card-${term.id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <section
      id="glossary-section"
      aria-labelledby="glossary-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 scroll-mt-24"
    >
      {/* Header + Inline Highlight Toggle */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-medium text-teal-700">
            Нормативная база аттестации · Интерактивный терминологический справочник
          </p>
          <h2
            id="glossary-heading"
            className="text-xl font-bold text-slate-900 inline-flex items-center gap-2"
          >
            <BookOpen
              className="w-5 h-5 text-teal-700 shrink-0"
              aria-hidden="true"
            />
            <span>Интерактивный глоссарий</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Ключевые понятия аттестации автоматически выделяются прямо в тексте
            раздела — наведите курсор (или нажмите на подчёркнутый термин), чтобы
            открыть определение во всплывающем окне.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {onToggleHighlightInOverview && (
            <button
              type="button"
              onClick={() => {
                onToggleHighlightInOverview();
                tracker.trackCustomInteraction(
                  `Подсветка терминов в обзоре: ${!highlightInOverview ? 'вкл' : 'выкл'}`
                );
              }}
              aria-pressed={highlightInOverview}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                highlightInOverview
                  ? 'bg-teal-50 border-teal-300 text-teal-900'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {highlightInOverview ? (
                <Eye className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
              )}
              <span>
                {highlightInOverview
                  ? 'Подсветка в тексте: Вкл'
                  : 'Подсветка в тексте: Выкл'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Term-Highlighting Reader & Text Inspector */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Примеры текстов с автоматическим выделением терминов"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg"
          >
            {READING_PASSAGES.map((passage) => {
              const selected = !customTextMode && passage.id === activePassage.id;
              return (
                <button
                  key={passage.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => {
                    setCustomTextMode(false);
                    setActivePassageId(passage.id);
                    tracker.trackCustomInteraction(
                      `Интерактивный глоссарий · фрагмент ${passage.label}`
                    );
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selected
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {passage.label}
                </button>
              );
            })}
            <button
              type="button"
              role="tab"
              aria-selected={customTextMode}
              onClick={() => setCustomTextMode(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                customTextMode
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3 h-3 text-teal-700" aria-hidden="true" />
              <span>Проверить свой текст</span>
            </button>
          </div>

          <span className="text-xs font-mono text-slate-500 tabular-nums">
            Распознано терминов: {detectedTermsInPassage.length}
          </span>
        </div>

        {customTextMode ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-5 space-y-1.5">
              <label
                htmlFor="glossary-custom-text-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Вставьте фрагмент регламента или заявки
              </label>
              <textarea
                id="glossary-custom-text-input"
                rows={4}
                maxLength={700}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Например: Как инструктор-проводник проходит аттестацию и защиту паспорта маршрута в РЦА…"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 resize-y"
              />
            </div>

            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 space-y-2.5">
              <p className="text-xs font-semibold text-slate-500">
                Интерактивный разбор (наведите на выделенный термин)
              </p>
              <p className="text-sm sm:text-base text-slate-800 leading-relaxed">
                <GlossaryText
                  text={customText}
                  enabled
                  maxMatchesPerTerm={2}
                  onInspectTerm={focusTermCard}
                />
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                {activePassage.title}
              </h3>
              <span className="text-[11px] text-slate-500">
                Наведите на термин для просмотра определения
              </span>
            </div>
            <p className="text-sm sm:text-base text-slate-800 leading-relaxed max-w-4xl">
              <GlossaryText
                text={activePassage.text}
                enabled
                maxMatchesPerTerm={2}
                onInspectTerm={focusTermCard}
              />
            </p>
          </div>
        )}

        {detectedTermsInPassage.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-600">
            <span className="font-medium text-slate-500">
              Термины во фрагменте:
            </span>
            {detectedTermsInPassage.map((term, idx) => (
              <React.Fragment key={term.id}>
                {idx > 0 && (
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => focusTermCard(term)}
                  className="font-medium text-teal-800 hover:text-teal-950 hover:underline underline-offset-2 cursor-pointer"
                >
                  {term.term}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Category Filter + Search Bar for Full Directory */}
      <div className="space-y-4 pt-2 border-t border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
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

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-80">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по глоссарию: 132-ФЗ, 1003, МКК…"
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
              Показано: {filteredGlossary.length} / {GLOSSARY_TERMS.length}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500 mr-1">Быстрый переход:</span>
          {QUICK_GLOSSARY_TOPICS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => applyQuickTag(tag)}
              className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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

      {/* Searchable Glossary Cards Grid */}
      {filteredGlossary.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center space-y-3">
          <p className="text-sm font-medium text-slate-800">
            По запросу «{searchQuery}» в выбранной категории понятий не найдено.
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
                id={`glossary-card-${item.id}`}
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
