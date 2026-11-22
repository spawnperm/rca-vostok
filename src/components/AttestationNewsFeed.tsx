import React, { useState } from 'react';
import {
  CalendarClock,
  ChevronDown,
  FileCheck2,
  MessageSquare,
} from 'lucide-react';
import { ATTESTATION_ANNOUNCEMENTS } from '../data/researchData';
import { tracker } from '../utils/tracker';

interface AttestationNewsFeedProps {
  onContactCurator: (sourceLabel: string) => void;
}

export const AttestationNewsFeed: React.FC<AttestationNewsFeedProps> = ({
  onContactCurator,
}) => {
  const [filterKind, setFilterKind] = useState<'all' | 'session' | 'regulation'>('all');
  const [expandedIds, setExpandedIds] = useState<string[]>([
    ATTESTATION_ANNOUNCEMENTS[0].id,
  ]);

  const filteredAnnouncements =
    filterKind === 'all'
      ? ATTESTATION_ANNOUNCEMENTS
      : ATTESTATION_ANNOUNCEMENTS.filter((item) => item.kind === filterKind);

  const sessionCount = ATTESTATION_ANNOUNCEMENTS.filter(
    (item) => item.kind === 'session'
  ).length;
  const regulationCount = ATTESTATION_ANNOUNCEMENTS.filter(
    (item) => item.kind === 'regulation'
  ).length;

  const toggleExpand = (id: string, title: string) => {
    setExpandedIds((prev) => {
      const exists = prev.includes(id);
      if (!exists) {
        tracker.trackCustomInteraction(
          `Анонс аттестации раскрыт: ${title.slice(0, 60)}`
        );
      }
      return exists ? prev.filter((item) => item !== id) : [...prev, id];
    });
  };

  const leadItem = filteredAnnouncements[0];
  const restItems = filteredAnnouncements.slice(1);

  return (
    <section
      aria-labelledby="attestation-news-heading"
      className="bg-white border border-slate-200 rounded-xl p-8 space-y-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1 max-w-3xl">
          <p className="text-xs font-medium text-teal-700">
            Оперативные анонсы для инструкторов-проводников
          </p>
          <h2
            id="attestation-news-heading"
            className="text-xl font-bold text-slate-900 text-balance"
          >
            Лента новостей аттестации
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Актуальное расписание потоков и экзаменационных сессий РЦА «Русский Восток» и ВВГУ,
            а также действующие изменения нормативной базы по Постановлениям № 1003 и № 1893.
          </p>
        </div>

        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
          {(
            [
              { id: 'all', label: `Все анонсы (${ATTESTATION_ANNOUNCEMENTS.length})` },
              { id: 'session', label: `Даты сессий (${sessionCount})` },
              { id: 'regulation', label: `Нормативная база (${regulationCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setFilterKind(tab.id);
                tracker.trackCustomInteraction(
                  `Лента аттестации: фильтр ${tab.label}`
                );
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                filterKind === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Operational Utility Bar: Key Session Dates & Compliance Deadline */}
      <dl className="grid grid-cols-1 md:grid-cols-3 gap-4 border-y border-slate-200 py-4 text-xs">
        <div className="space-y-1">
          <dt className="text-slate-500 font-medium">Зимняя сессия · Водный трек</dt>
          <dd className="font-mono font-semibold text-slate-900 tabular-nums">
            14–19 дек 2026 · приём до 07 дек
          </dd>
        </div>
        <div className="space-y-1 md:border-l md:border-slate-200 md:pl-4">
          <dt className="text-slate-500 font-medium">Межрегиональный поток ДФО · Пеший</dt>
          <dd className="font-mono font-semibold text-slate-900 tabular-nums">
            Февраль–март 2027 · ВВГУ + Шкотовский р-н
          </dd>
        </div>
        <div className="space-y-1 md:border-l md:border-slate-200 md:pl-4">
          <dt className="text-slate-500 font-medium">Регуляторный статус (ПП № 1893)</dt>
          <dd className="font-mono font-semibold text-teal-800 tabular-nums">
            Обязателен с 01 окт 2026 · срок 5 лет
          </dd>
        </div>
      </dl>

      {/* Tier 1: Lead Announcement */}
      {leadItem && (
        <article className="bg-slate-50 border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-teal-800">{leadItem.kindLabel}</span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-slate-800">{leadItem.statusLabel}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={leadItem.isoDate} className="font-mono tabular-nums">
                {leadItem.publishedDate}
              </time>
            </div>
            <span className="font-mono text-[11px] text-slate-600 tabular-nums">
              Ключевой анонс
            </span>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-bold text-slate-900 leading-snug max-w-3xl">
              {leadItem.title}
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
              {leadItem.summary}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-200 text-xs">
            <div className="flex items-start gap-2 text-slate-700">
              <CalendarClock
                className="w-4 h-4 text-teal-700 mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <div>
                <p className="text-[11px] text-slate-500">График и период действия</p>
                <p className="font-mono font-medium text-slate-900 tabular-nums mt-0.5">
                  {leadItem.eventWindow}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 text-slate-700">
              <FileCheck2
                className="w-4 h-4 text-teal-700 mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <div>
                <p className="text-[11px] text-slate-500">Площадка / правовое основание</p>
                <p className="font-medium text-slate-900 mt-0.5">
                  {leadItem.venueOrLegalBasis}
                </p>
              </div>
            </div>
          </div>

          {expandedIds.includes(leadItem.id) && (
            <div className="pt-3 border-t border-slate-200 space-y-2 max-w-3xl">
              <p className="text-xs font-semibold text-slate-800">
                Требования и действия для соискателей ({leadItem.audience}):
              </p>
              <ul className="space-y-1.5 text-xs text-slate-700 leading-relaxed">
                {leadItem.requirements.map((req, idx) => (
                  <li key={req} className="flex items-start gap-2">
                    <span className="font-mono font-semibold text-teal-700 tabular-nums shrink-0">
                      0{idx + 1}.
                    </span>
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              aria-expanded={expandedIds.includes(leadItem.id)}
              onClick={() => toggleExpand(leadItem.id, leadItem.title)}
              className="text-xs font-medium text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <span>
                {expandedIds.includes(leadItem.id)
                  ? 'Скрыть требования'
                  : 'Подробнее и требования'}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  expandedIds.includes(leadItem.id) ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            <button
              type="button"
              onClick={() =>
                onContactCurator(`Лента аттестации: ${leadItem.title.slice(0, 48)}`)
              }
              className="px-4 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{leadItem.ctaLabel}</span>
            </button>
          </div>
        </article>
      )}

      {/* Tier 2 & 3: Structured Feed Rows */}
      <ol className="divide-y divide-slate-200 border-t border-slate-200">
        {restItems.map((item) => {
          const isExpanded = expandedIds.includes(item.id);
          return (
            <li key={item.id} className="py-5 last:pb-1">
              <div className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-8">
                <div className="lg:w-52 shrink-0 space-y-1 pt-0.5">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <time
                      dateTime={item.isoDate}
                      className="font-mono font-semibold text-slate-900 tabular-nums"
                    >
                      {item.publishedDate}
                    </time>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-teal-700">{item.kindLabel}</span>
                  </div>
                  <p className="text-xs text-slate-700 font-medium">{item.statusLabel}</p>
                </div>

                <div className="flex-1 space-y-2.5">
                  <h3 className="text-base font-semibold text-slate-900 leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
                    {item.summary}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="font-mono text-slate-800 tabular-nums">
                      {item.eventWindow}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{item.venueOrLegalBasis}</span>
                  </div>

                  {isExpanded && (
                    <div className="pt-3 border-t border-slate-100 space-y-2 max-w-3xl">
                      <p className="text-xs font-semibold text-slate-800">
                        Кого касается: {item.audience}
                      </p>
                      <ul className="space-y-1.5 text-xs text-slate-700 leading-relaxed">
                        {item.requirements.map((req, idx) => (
                          <li key={req} className="flex items-start gap-2">
                            <span className="font-mono font-semibold text-teal-700 tabular-nums shrink-0">
                              0{idx + 1}.
                            </span>
                            <span>{req}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="pt-1 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => toggleExpand(item.id, item.title)}
                      className="text-xs font-medium text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                    >
                      <span>{isExpanded ? 'Свернуть детали' : 'Подробнее и требования'}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        aria-hidden="true"
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onContactCurator(`Лента аттестации: ${item.title.slice(0, 48)}`)
                      }
                      className="px-3 py-1.5 bg-white border border-slate-300 text-slate-800 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                      <span>{item.ctaLabel}</span>
                    </button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
