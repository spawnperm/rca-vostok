import React, { useState } from 'react';
import { Building2, ExternalLink } from 'lucide-react';
import { tracker } from '../utils/tracker';

type PartnerCategory = 'all' | 'education' | 'federation' | 'regulator';

interface PartnerItem {
  id: string;
  shortCode: string;
  name: string;
  role: string;
  category: Exclude<PartnerCategory, 'all'>;
  categoryLabel: string;
  contribution: string;
  region: string;
  url?: string;
}

const PARTNERS: readonly PartnerItem[] = [
  {
    id: 'vvsu',
    shortCode: 'ВВГУ',
    name: 'Владивостокский государственный университет (ВВГУ)',
    role: 'Базовый университет и учредитель площадки РЦА «Русский Восток»',
    category: 'education',
    categoryLabel: 'Образовательная база',
    contribution:
      'Программы ДПО (≈250 ч и модульный Контур А), компьютерное тестирование и методическая лаборатория туризма ДФО.',
    region: 'г. Владивосток',
    url: 'https://www.vvsu.ru/',
  },
  {
    id: 'fstr',
    shortCode: 'ФСТР',
    name: 'Федерация спортивного туризма России',
    role: 'Общероссийский соорганизатор и экспертный методический партнёр',
    category: 'federation',
    categoryLabel: 'Туристская федерация',
    contribution:
      'Верификация категорийного опыта МКК, экспертный состав аттестационной комиссии и стандарты полевых испытаний.',
    region: 'Федеральный контур',
    url: 'https://tssr.ru/',
  },
  {
    id: 'mintour-pk',
    shortCode: 'МТ ПК',
    name: 'Министерство туризма Приморского края',
    role: 'Орган исполнительной власти и координатор региональных субсидий',
    category: 'regulator',
    categoryLabel: 'Регулятор и поддержка',
    contribution:
      'Интеграция обучения ВВГУ в меры поддержки МСП (субсидии до 70%) и развитие туристской инфраструктуры края.',
    region: 'Приморский край',
  },
  {
    id: 'prim-fst',
    shortCode: 'ПФСТ',
    name: 'Приморская федерация спортивного туризма',
    role: 'Региональный оператор полевых испытаний и судейских бригад',
    category: 'federation',
    categoryLabel: 'Туристская федерация',
    contribution:
      'Организация практических этапов в Шкотовском районе, переправ, страховки, ПСР и оценки техники на рельефе.',
    region: 'Приморский край',
  },
  {
    id: 'visit-primorye',
    shortCode: 'ТИЦ ПК',
    name: 'Туристско-информационный центр Приморского края',
    role: 'Отраслевой координатор туроператоров и продвижения маршрутов',
    category: 'regulator',
    categoryLabel: 'Отраслевой партнёр',
    contribution:
      'Мониторинг сезонного спроса туроператоров, паспортизация маршрутов (ПП № 760) и кадровое содействие.',
    region: 'Visit Primorye',
    url: 'https://visit-primorye.ru/',
  },
  {
    id: 'oopt-dfo',
    shortCode: 'ООПТ',
    name: 'Консорциум ООПТ Дальнего Востока и Центр «Амурский тигр»',
    role: 'Партнёры по режимам заповедников и безопасности на маршрутах ДФО',
    category: 'regulator',
    categoryLabel: 'ООПТ и безопасность',
    contribution:
      'Методики работы на экотропах («Земля леопарда», «Бикин», Сихотэ-Алинь) и регламенты безопасности в ареале хищников.',
    region: 'Дальний Восток',
  },
];

function PartnerLogoMark({ id }: { id: string }) {
  switch (id) {
    case 'vvsu':
      return (
        <svg viewBox="0 0 48 48" className="w-11 h-11 shrink-0" aria-hidden="true">
          <rect x="2" y="2" width="44" height="44" rx="10" fill="#0F766E" />
          <path d="M12 16L24 10L36 16L24 22L12 16Z" fill="#CCFBF1" />
          <path d="M16 21V31C16 33.5 19.6 36 24 36C28.4 36 32 33.5 32 31V21L24 25L16 21Z" fill="#FFFFFF" fillOpacity="0.92" />
        </svg>
      );
    case 'fstr':
      return (
        <svg viewBox="0 0 48 48" className="w-11 h-11 shrink-0" aria-hidden="true">
          <rect x="2" y="2" width="44" height="44" rx="10" fill="#0F172A" />
          <circle cx="24" cy="24" r="14" stroke="#2DD4BF" strokeWidth="2.2" fill="none" />
          <path d="M24 11L28 24L24 37L20 24L24 11Z" fill="#2DD4BF" />
          <path d="M11 24H37" stroke="#E2E8F0" strokeWidth="1.6" />
        </svg>
      );
    case 'mintour-pk':
      return (
        <svg viewBox="0 0 48 48" className="w-11 h-11 shrink-0" aria-hidden="true">
          <rect x="2" y="2" width="44" height="44" rx="10" fill="#1E3A8A" />
          <path d="M10 31L18 19L24 26L30 16L38 31H10Z" fill="#BFDBFE" />
          <circle cx="32" cy="14" r="3" fill="#FDE68A" />
        </svg>
      );
    case 'prim-fst':
      return (
        <svg viewBox="0 0 48 48" className="w-11 h-11 shrink-0" aria-hidden="true">
          <rect x="2" y="2" width="44" height="44" rx="10" fill="#115E59" />
          <path d="M11 33L21 15L27 25L31 20L37 33H11Z" fill="#FFFFFF" fillOpacity="0.92" />
          <path d="M10 36C15 33 21 39 27 35C32 32 35 36 38 35" stroke="#5EEAD4" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        </svg>
      );
    case 'visit-primorye':
      return (
        <svg viewBox="0 0 48 48" className="w-11 h-11 shrink-0" aria-hidden="true">
          <rect x="2" y="2" width="44" height="44" rx="10" fill="#0369A1" />
          <path d="M10 29C15 24 21 34 27 28C32 23 35 28 38 26" stroke="#BAE6FD" strokeWidth="2.8" fill="none" strokeLinecap="round" />
          <circle cx="24" cy="17" r="5" fill="#FDE047" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 48 48" className="w-11 h-11 shrink-0" aria-hidden="true">
          <rect x="2" y="2" width="44" height="44" rx="10" fill="#166534" />
          <path d="M24 11L32 24H27L33 34H15L21 24H16L24 11Z" fill="#DCFCE7" />
          <rect x="22" y="34" width="4" height="4" fill="#BBF7D0" />
        </svg>
      );
  }
}

export const PartnersAndCoOrganizersSection: React.FC = () => {
  const [filter, setFilter] = useState<PartnerCategory>('all');

  const visiblePartners =
    filter === 'all' ? PARTNERS : PARTNERS.filter((p) => p.category === filter);

  return (
    <section
      id="overview-partners"
      aria-labelledby="overview-partners-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Институциональная кооперация ДФО</span>
          </p>
          <h2 id="overview-partners-heading" className="text-xl font-bold text-slate-900">
            Партнеры и соорганизаторы
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Университеты, туристские федерации и профильные ведомства, обеспечивающие обучение,
            комиссию и полевые полигоны РЦА «Русский Восток».
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Категории партнеров РЦА"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start lg:self-auto"
        >
          {(
            [
              { id: 'all', label: `Все (${PARTNERS.length})` },
              { id: 'education', label: 'ВУЗы (ВВГУ)' },
              { id: 'federation', label: 'Федерации' },
              { id: 'regulator', label: 'Регуляторы и ООПТ' },
            ] as const
          ).map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setFilter(tab.id);
                  tracker.trackCustomInteraction(`Партнеры РЦА · фильтр: ${tab.label}`);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visiblePartners.map((partner) => (
          <article
            key={partner.id}
            className="bg-slate-50/70 border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-teal-300 transition-colors"
          >
            <div className="space-y-3">
              <div className="flex items-start gap-3.5">
                <PartnerLogoMark id={partner.id} />
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
                    <span className="font-mono font-bold text-teal-800">{partner.shortCode}</span>
                    <span aria-hidden="true" className="text-slate-400">·</span>
                    <span className="text-slate-500">{partner.categoryLabel}</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">
                    {partner.name}
                  </h3>
                </div>
              </div>

              <p className="text-xs font-medium text-teal-800 leading-snug">{partner.role}</p>
              <p className="text-xs text-slate-600 leading-relaxed">{partner.contribution}</p>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2 text-[11px]">
              <span className="text-slate-500 font-mono">{partner.region}</span>
              {partner.url ? (
                <a
                  href={partner.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-700 hover:text-teal-900 font-semibold inline-flex items-center gap-1"
                >
                  <span>Официальный сайт</span>
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              ) : (
                <span className="text-slate-500 font-medium">Региональное взаимодействие</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
