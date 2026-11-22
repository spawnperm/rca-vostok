import React, { useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  Newspaper,
  Route,
  ShieldCheck,
  Clock,
  Info,
} from 'lucide-react';
import {
  ATTESTATION_ANNOUNCEMENTS,
  INDUSTRY_NEWS,
  PRIMORYE_DISTRICTS,
  type AttestationAnnouncement,
  type IndustryNewsItem,
} from '../../data/researchData';
import { useNewsFeed, type NewsPost } from '../../utils/useNewsFeed';

/**
 * «Новости» and «Маршруты» — the two site sections that were still placeholders
 * on rca-vostok.ru. Rather than ship empty headings, both are backed by the
 * platform's own researched datasets: INDUSTRY_NEWS / ATTESTATION_ANNOUNCEMENTS
 * and PRIMORYE_DISTRICTS. Nothing here is invented — every figure comes from
 * src/data/researchData.ts.
 */

const NEWS_CATEGORY_LABELS: Record<IndustryNewsItem['category'], string> = {
  regulation: 'Нормативная база',
  rca: 'Сессии РЦА и ВВГУ',
  market: 'Рынок',
};

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function NewsCard({ item }: { item: IndustryNewsItem }) {
  const [open, setOpen] = useState<boolean>(false);

  return (
    <article className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-semibold rounded">
          {NEWS_CATEGORY_LABELS[item.category]}
        </span>
        <span className="text-[11px] text-slate-500">{formatDate(item.isoDate)}</span>
      </div>

      <h3 className="text-sm font-bold text-slate-900 leading-snug">{item.title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{item.summary}</p>

      {open && (
        <p className="text-sm text-slate-700 leading-relaxed border-t border-slate-100 pt-3">
          {item.details}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-[11px] text-slate-400">{item.source}</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900 cursor-pointer"
        >
          {open ? 'Свернуть' : 'Подробнее'}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>
    </article>
  );
}

function AnnouncementRow({ item }: { item: AttestationAnnouncement }) {
  return (
    <li className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded border ${
            item.kind === 'session'
              ? 'bg-teal-50 border-teal-200 text-teal-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          {item.kindLabel}
        </span>
        <span className="text-[11px] text-slate-500">{item.statusLabel}</span>
      </div>

      <p className="text-sm font-semibold text-slate-900">{item.title}</p>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="w-3 h-3" aria-hidden="true" />
          {item.eventWindow}
        </span>
        <span>{item.venueOrLegalBasis}</span>
      </div>
    </li>
  );
}

/** «Новости» — cabinet-published news, industry news and attestation notices. */
export function NewsSection() {
  const { news, loading, reload } = useNewsFeed(6);

  const sessionAnnouncements = ATTESTATION_ANNOUNCEMENTS.filter((a) => a.kind === 'session');
  const regulationAnnouncements = ATTESTATION_ANNOUNCEMENTS.filter(
    (a) => a.kind === 'regulation'
  );

  return (
    <section className="space-y-8">
      <header id="news" className="scroll-mt-24 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Новости</p>
        <h2 className="text-2xl font-bold text-slate-900 text-balance">
          Новости аттестации и рынка
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
          Публикации центра, изменения нормативной базы и события рынка активного туризма
          Дальнего Востока.
        </p>
      </header>

      {/* News published from the personal cabinet. Hidden while empty so the
          landing page never shows an empty heading. */}
      {(loading || news.length > 0) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-bold text-slate-900">Публикации центра</h3>
            <button
              type="button"
              onClick={reload}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Обновить
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Загружаем публикации…</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {news.map((item) => (
                <LandingNewsCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {INDUSTRY_NEWS.map((item) => (
          <NewsCard key={item.id} item={item} />
        ))}
      </div>

      <div className="space-y-4 pt-4">
        <h3 className="text-base font-bold text-slate-900">Анонсы сессий и изменения НПА</h3>

        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sessionAnnouncements.map((item) => (
            <AnnouncementRow key={item.id} item={item} />
          ))}
        </ul>

        {regulationAnnouncements.length > 0 && (
          <>
            <h4 className="text-sm font-semibold text-slate-700 pt-2">Нормативные изменения</h4>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {regulationAnnouncements.map((item) => (
                <AnnouncementRow key={item.id} item={item} />
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

/** Card for a news item published from the cabinet. */
function LandingNewsCard({ item }: { item: NewsPost }) {
  const [open, setOpen] = useState<boolean>(false);
  const published = item.publishedAt ?? item.createdAt;

  return (
    <article className="bg-white border border-teal-200 rounded-xl p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-semibold rounded">
          <Newspaper className="w-3 h-3" aria-hidden="true" />
          Новость центра
        </span>
        <span className="text-[11px] text-slate-500">{formatDate(published)}</span>
      </div>

      <h3 className="text-sm font-bold text-slate-900 leading-snug">{item.title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
        {open ? item.body : item.excerpt}
      </p>

      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[11px] rounded">
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-[11px] text-slate-400">{item.authorName}</span>
        {item.body.length > item.excerpt.length && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900 cursor-pointer"
          >
            {open ? 'Свернуть' : 'Читать полностью'}
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
        )}
      </div>
    </article>
  );
}

/** «Маршруты» — the eight Primorye districts the centre works with. */
export function RoutesSection() {
  const [activeId, setActiveId] = useState<string>(PRIMORYE_DISTRICTS[0]?.id ?? '');
  const active =
    PRIMORYE_DISTRICTS.find((d) => d.id === activeId) ?? PRIMORYE_DISTRICTS[0];

  const totalRoutes = PRIMORYE_DISTRICTS.reduce((acc, d) => acc + d.activeRoutesCount, 0);
  const totalCertified = PRIMORYE_DISTRICTS.reduce(
    (acc, d) => acc + d.certifiedInRegistry,
    0
  );

  return (
    <section className="space-y-8">
      <header id="routes" className="scroll-mt-24 space-y-2">
        <p className="text-xs font-semibold uppercase uppercase tracking-wide text-teal-700">
          Маршруты
        </p>
        <h2 className="text-2xl font-bold text-slate-900 text-balance">
          Маршруты и округа Приморского края
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
          Территории, где работает центр: активные маршруты, обеспеченность проводниками и
          особенности безопасности по каждому муниципальному образованию.
        </p>

        <div className="flex flex-wrap gap-6 pt-2">
          <div>
            <p className="text-lg font-bold text-slate-900 tabular-nums">{totalRoutes}</p>
            <p className="text-[11px] text-slate-500">активных маршрутов</p>
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900 tabular-nums">{totalCertified}</p>
            <p className="text-[11px] text-slate-500">проводников в реестре</p>
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900 tabular-nums">
              {PRIMORYE_DISTRICTS.length}
            </p>
            <p className="text-[11px] text-slate-500">округов</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* District selector */}
        <nav aria-label="Округа Приморского края" className="space-y-1 lg:col-span-1">
          {PRIMORYE_DISTRICTS.map((district) => {
            const isActive = district.id === active?.id;
            return (
              <button
                key={district.id}
                type="button"
                onClick={() => setActiveId(district.id)}
                aria-current={isActive ? 'true' : undefined}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-teal-50 text-teal-900 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="truncate">{district.shortName}</span>
                <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                  {district.activeRoutesCount}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Selected district detail */}
        {active && (
          <article className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">{active.name}</h3>
              <p className="text-xs text-slate-500">{active.profileLabel}</p>
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <dt className="text-[11px] text-slate-500">В реестре</dt>
                <dd className="text-base font-bold text-slate-900 tabular-nums">
                  {active.certifiedInRegistry}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-500">Расчётная потребность</dt>
                <dd className="text-base font-bold text-slate-900 tabular-nums">
                  {active.estimatedDemand}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-500">Активность</dt>
                <dd className="text-base font-bold text-slate-900">{active.activityLevel}</dd>
              </div>
            </dl>

            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <Route className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Ключевые точки
                  </p>
                  <p className="text-slate-700 leading-relaxed">{active.keySpots}</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <ShieldCheck
                  className="w-4 h-4 text-teal-700 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Безопасность
                  </p>
                  <p className="text-slate-700 leading-relaxed">{active.safetyNote}</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Сезон
                  </p>
                  <p className="text-slate-700">{active.seasonWindow}</p>
                </div>
              </div>
            </div>
          </article>
        )}
      </div>

      <p className="text-xs text-slate-500 inline-flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        Данные о маршрутах и реестре приведены по исследовательской базе платформы РЦА «Русский
        Восток» (срез 2026 года).
      </p>
    </section>
  );
}
