import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileText,
  Headset,
  HelpCircle,
  Search,
  X,
} from 'lucide-react';
import {
  KNOWLEDGE_QUICK_QUERIES,
  METHODOLOGICAL_MATERIALS,
  getMaterialById,
  searchAccountKnowledgeBase,
  type FaqCategoryFilter,
  type KnowledgeSearchScope,
  type MethodologicalMaterial,
} from '../utils/accountKnowledgeBase';
import { ENRICHED_ATTESTATION_FAQ } from '../utils/accountKnowledgeBase';
import type { SessionUser } from '../utils/identityApi';
import type { SiteTabId } from '../utils/seo';
import { tracker } from '../utils/tracker';

interface AccountKnowledgeBaseWidgetProps {
  user: SessionUser;
  externalSearch?: { query: string; nonce: number } | null;
  onNavigate?: (tab: SiteTabId) => void;
  onJumpToChecklist?: () => void;
  onJumpToConsultant?: () => void;
}

export const AccountKnowledgeBaseWidget: React.FC<AccountKnowledgeBaseWidgetProps> = ({
  user,
  externalSearch,
  onNavigate,
  onJumpToChecklist,
  onJumpToConsultant,
}) => {
  const [scope, setScope] = useState<KnowledgeSearchScope>('all');
  const [faqCategory, setFaqCategory] = useState<FaqCategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [openFaqIds, setOpenFaqIds] = useState<string[]>([ENRICHED_ATTESTATION_FAQ[0].id]);
  const [openMaterialIds, setOpenMaterialIds] = useState<string[]>([
    METHODOLOGICAL_MATERIALS[0].id,
  ]);

  useEffect(() => {
    if (!externalSearch?.nonce) return;
    const nextQuery = externalSearch.query.trim();
    setScope('all');
    setFaqCategory('all');
    setSearchQuery(nextQuery);
    if (nextQuery) {
      const matched = searchAccountKnowledgeBase({ query: nextQuery, scope: 'all' });
      if (matched.faqItems.length > 0) {
        setOpenFaqIds(matched.faqItems.slice(0, 2).map((item) => item.id));
      }
      if (matched.materials.length > 0) {
        setOpenMaterialIds([matched.materials[0].id]);
      }
    }
  }, [externalSearch]);

  const countsResult = useMemo(
    () =>
      searchAccountKnowledgeBase({
        query: searchQuery,
        scope: 'all',
        faqCategory,
      }),
    [searchQuery, faqCategory]
  );

  const visibleResult = useMemo(
    () =>
      searchAccountKnowledgeBase({
        query: searchQuery,
        scope,
        faqCategory,
      }),
    [searchQuery, scope, faqCategory]
  );

  const toggleFaq = (id: string, question: string) => {
    setOpenFaqIds((prev) => {
      const exists = prev.includes(id);
      if (!exists) {
        tracker.trackCustomInteraction(
          `Кабинет FAQ: ${question.slice(0, 55)}`,
          user.region
        );
      }
      return exists ? prev.filter((item) => item !== id) : [...prev, id];
    });
  };

  const toggleMaterial = (material: MethodologicalMaterial) => {
    setOpenMaterialIds((prev) => {
      const exists = prev.includes(material.id);
      if (!exists) {
        tracker.trackCustomInteraction(
          `Кабинет методичка: ${material.code}`,
          material.title
        );
      }
      return exists ? prev.filter((item) => item !== material.id) : [...prev, material.id];
    });
  };

  const openLinkedMaterial = (materialId: string) => {
    if (scope === 'faq' || scope === 'glossary') {
      setScope('all');
    }
    setOpenMaterialIds((prev) => (prev.includes(materialId) ? prev : [...prev, materialId]));
    const target = document.getElementById(`kb-material-${materialId}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    const mat = getMaterialById(materialId);
    if (mat) {
      tracker.trackCustomInteraction(`Переход FAQ → методичка: ${mat.code}`, mat.title);
    }
  };

  const openLinkedFaq = (faqId: string) => {
    if (scope === 'materials' || scope === 'glossary') {
      setScope('all');
    }
    setFaqCategory('all');
    setOpenFaqIds((prev) => (prev.includes(faqId) ? prev : [...prev, faqId]));
    const target = document.getElementById(`kb-faq-${faqId}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const applyQuickQuery = (topic: string) => {
    setScope('all');
    setFaqCategory('all');
    setSearchQuery(topic);
    const matched = searchAccountKnowledgeBase({ query: topic, scope: 'all' });
    if (matched.faqItems.length > 0) {
      setOpenFaqIds(matched.faqItems.slice(0, 2).map((item) => item.id));
    }
    if (matched.materials.length > 0) {
      setOpenMaterialIds([matched.materials[0].id]);
    }
    tracker.trackCustomInteraction(`Кабинет база знаний · тег: ${topic}`, 'account');
  };

  const triggerMaterialAction = (material: MethodologicalMaterial) => {
    tracker.trackCustomInteraction(
      `Кабинет методичка · действие: ${material.code}`,
      material.actionLabel
    );
    if (material.actionType === 'checklist' && onJumpToChecklist) {
      onJumpToChecklist();
      return;
    }
    if (material.actionType === 'consultant' && onJumpToConsultant) {
      onJumpToConsultant();
      return;
    }
    if (material.actionType === 'tab' && material.targetTab && onNavigate) {
      onNavigate(material.targetTab);
    }
  };

  const handleReset = () => {
    setScope('all');
    setFaqCategory('all');
    setSearchQuery('');
  };

  return (
    <section
      id="account-knowledge-base"
      aria-labelledby="account-kb-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 scroll-mt-24"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Справочник личного кабинета · ВВГУ и РЦА «Русский Восток»</span>
          </p>
          <h3 id="account-kb-heading" className="text-lg font-bold text-slate-900">
            База знаний и FAQ
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Быстрые ответы на частые вопросы по аттестации и единый поиск по методическим
            материалам, регламентам ДПО и нормативным терминам.
          </p>
        </div>

        <p className="text-xs font-mono text-slate-500 tabular-nums whitespace-nowrap shrink-0 pt-1">
          Найдено материалов: {visibleResult.totalCount}
        </p>
      </div>

      {/* Unified Search Input & Quick Topic Buttons */}
      <div className="space-y-3">
        <div className="relative">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по FAQ и методическим материалам: Контур А, паспорт маршрута, ПП № 1893, 27 200 ₽..."
            aria-label="Поиск по базе знаний и методическим материалам"
            className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:bg-white transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Очистить поисковый запрос"
              className="p-1 text-slate-400 hover:text-slate-700 absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500 mr-1">Быстрые темы:</span>
          {KNOWLEDGE_QUICK_QUERIES.map((topic) => {
            const isActive = searchQuery.trim().toLowerCase() === topic.toLowerCase();
            return (
              <button
                key={topic}
                type="button"
                onClick={() => applyQuickQuery(topic)}
                className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-teal-50 border-teal-300 text-teal-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {topic}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scope Tabs + FAQ Category Sub-filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-200">
        <div
          role="tablist"
          aria-label="Раздел базы знаний"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
        >
          {(
            [
              { id: 'all', label: `Всё (${countsResult.totalCount})` },
              { id: 'faq', label: `FAQ (${countsResult.faqItems.length})` },
              {
                id: 'materials',
                label: `Методические материалы (${countsResult.materials.length})`,
              },
              {
                id: 'glossary',
                label: `Термины (${countsResult.glossaryItems.length})`,
              },
            ] as const
          ).map((tab) => {
            const isSelected = scope === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setScope(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {(scope === 'all' || scope === 'faq') && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {(
              [
                { id: 'all', label: 'Все темы FAQ' },
                { id: 'procedure', label: 'Процедура' },
                { id: 'training', label: 'Обучение' },
                { id: 'region', label: 'ДФО и ООПТ' },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFaqCategory(cat.id)}
                className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  faqCategory === cat.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Empty Search Result */}
      {visibleResult.totalCount === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center space-y-3">
          <p className="text-sm font-medium text-slate-800">
            По запросу «{searchQuery}» ответы и методические материалы не найдены.
          </p>
          <p className="text-xs text-slate-500">
            Попробуйте изменить формулировку (например: «Контур А», «760», «пересдача») или
            передайте вопрос дежурному специалисту комиссии.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleReset}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Сбросить фильтры
            </button>
            {onJumpToConsultant && (
              <button
                type="button"
                onClick={onJumpToConsultant}
                className="px-3.5 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Headset className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Спросить онлайн-консультанта</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Methodological Materials Section */}
          {(scope === 'all' || scope === 'materials') &&
            visibleResult.materials.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider inline-flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                    <span>Методические материалы и инструкции</span>
                  </h4>
                  <span className="text-xs font-mono text-slate-500 tabular-nums">
                    {visibleResult.materials.length} док.
                  </span>
                </div>

                <div className="space-y-2.5">
                  {visibleResult.materials.map((material) => {
                    const isOpen = openMaterialIds.includes(material.id);
                    return (
                      <div
                        key={material.id}
                        id={`kb-material-${material.id}`}
                        className={`border rounded-lg transition-colors scroll-mt-24 ${
                          isOpen
                            ? 'border-teal-700/60 bg-slate-50/70'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() => toggleMaterial(material)}
                          className="w-full text-left p-4 flex items-start justify-between gap-4 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                              <span className="font-mono font-semibold text-teal-800 tabular-nums">
                                {material.code}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-medium text-slate-700">
                                {material.categoryLabel}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">{material.normRef}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">{material.readingTime}</span>
                            </div>
                            <p className="text-sm font-semibold text-slate-900 leading-snug">
                              {material.title}
                            </p>
                            <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                              {material.summary}
                            </p>
                          </div>

                          <ChevronDown
                            className={`w-4 h-4 text-slate-500 mt-1 shrink-0 transition-transform duration-200 ${
                              isOpen ? 'rotate-180 text-teal-700' : ''
                            }`}
                            aria-hidden="true"
                          />
                        </button>

                        {isOpen && (
                          <div className="px-4 pb-4 pt-2 border-t border-slate-200/80 space-y-3">
                            <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
                              {material.keyPoints.map((point) => (
                                <li key={point} className="flex items-start gap-2">
                                  <CheckCircle2
                                    className="w-3.5 h-3.5 text-teal-700 mt-0.5 shrink-0"
                                    aria-hidden="true"
                                  />
                                  <span>{point}</span>
                                </li>
                              ))}
                            </ul>

                            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/70">
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                {material.relatedFaqIds.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => openLinkedFaq(material.relatedFaqIds[0])}
                                    className="text-xs font-medium text-slate-600 hover:text-teal-800 underline underline-offset-2 cursor-pointer"
                                  >
                                    Связанный вопрос FAQ ({material.relatedFaqIds.length})
                                  </button>
                                )}
                              </div>

                              {(material.actionType !== 'tab' || onNavigate) && (
                                <button
                                  type="button"
                                  onClick={() => triggerMaterialAction(material)}
                                  className="px-3 py-1.5 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                                >
                                  {material.actionType === 'checklist' && (
                                    <ClipboardCheck
                                      className="w-3.5 h-3.5 text-teal-700"
                                      aria-hidden="true"
                                    />
                                  )}
                                  {material.actionType === 'consultant' && (
                                    <Headset
                                      className="w-3.5 h-3.5 text-teal-700"
                                      aria-hidden="true"
                                    />
                                  )}
                                  <span>{material.actionLabel}</span>
                                  <ArrowRight
                                    className="w-3 h-3 text-slate-500"
                                    aria-hidden="true"
                                  />
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          {/* Quick Answers FAQ Accordion */}
          {(scope === 'all' || scope === 'faq') && visibleResult.faqItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider inline-flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  <span>Быстрые ответы на вопросы по аттестации (FAQ)</span>
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    const allIds = visibleResult.faqItems.map((f) => f.id);
                    const allOpen = allIds.every((id) => openFaqIds.includes(id));
                    setOpenFaqIds(allOpen ? [] : allIds);
                  }}
                  className="text-xs font-medium text-teal-700 hover:text-teal-900 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {visibleResult.faqItems.every((f) => openFaqIds.includes(f.id))
                    ? 'Свернуть ответы'
                    : 'Раскрыть все'}
                </button>
              </div>

              <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white">
                {visibleResult.faqItems.map((item) => {
                  const isOpen = openFaqIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      id={`kb-faq-${item.id}`}
                      className="px-4 py-3.5 scroll-mt-24"
                    >
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => toggleFaq(item.id, item.question)}
                        className="w-full text-left flex items-start justify-between gap-4 cursor-pointer group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="font-medium text-teal-700">
                              {item.categoryLabel}
                            </span>
                            <span aria-hidden="true" className="text-slate-300">
                              ·
                            </span>
                            <span className="text-slate-500">{item.quickHighlight}</span>
                          </div>
                          <p className="text-sm font-semibold text-slate-900 group-hover:text-teal-800 transition-colors leading-snug">
                            {item.question}
                          </p>
                        </div>

                        <ChevronDown
                          className={`w-4 h-4 text-slate-500 mt-1 shrink-0 transition-transform duration-200 ${
                            isOpen ? 'rotate-180 text-teal-700' : ''
                          }`}
                          aria-hidden="true"
                        />
                      </button>

                      {isOpen && (
                        <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2.5">
                          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                            {item.answer}
                          </p>

                          {item.relatedMaterialIds.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                              <span className="text-slate-500">Методические материалы:</span>
                              {item.relatedMaterialIds.map((matId) => {
                                const mat = getMaterialById(matId);
                                if (!mat) return null;
                                return (
                                  <button
                                    key={matId}
                                    type="button"
                                    onClick={() => openLinkedMaterial(matId)}
                                    className="inline-flex items-center gap-1 font-medium text-teal-800 hover:text-teal-950 underline underline-offset-2 cursor-pointer"
                                  >
                                    <span>
                                      {mat.code}: {mat.categoryLabel}
                                    </span>
                                    <ArrowRight className="w-3 h-3" aria-hidden="true" />
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Glossary Terms (shown when searching or glossary tab active) */}
          {(scope === 'glossary' || (scope === 'all' && searchQuery.trim().length > 0)) &&
            visibleResult.glossaryItems.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Нормативные термины и определения
                  </h4>
                  <span className="text-xs font-mono text-slate-500 tabular-nums">
                    {visibleResult.glossaryItems.length} терм.
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {visibleResult.glossaryItems.map((term) => (
                    <div
                      key={term.id}
                      className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5"
                    >
                      <div className="flex items-baseline justify-between gap-2 text-[11px] text-slate-500">
                        <span className="font-medium text-teal-800">{term.categoryLabel}</span>
                        <span className="font-mono tabular-nums">{term.shortTag}</span>
                      </div>
                      <p className="text-sm font-bold text-slate-900">{term.term}</p>
                      <p className="text-xs text-slate-600 leading-relaxed">{term.definition}</p>
                      <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/80">
                        {term.contextNote}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      )}

      {/* Footer Escalation */}
      <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-600">
          Нужна индивидуальная проверка маршрутной книжки или паспорта маршрута?
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {onJumpToChecklist && (
            <button
              type="button"
              onClick={onJumpToChecklist}
              className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ClipboardCheck className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              <span>К чек-листу документов</span>
            </button>
          )}
          {onJumpToConsultant && (
            <button
              type="button"
              onClick={onJumpToConsultant}
              className="px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Headset className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
              <span>Задать вопрос консультанту</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
