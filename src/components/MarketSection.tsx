import React, { useState } from 'react';
import { ArrowRight, BarChart3, Compass, FileDown, Map, ShieldAlert } from 'lucide-react';
import {
  BOTTLENECKS,
  HORIZON_STAGES,
  MARKET_SEGMENTS,
  RECOMMENDATIONS,
} from '../data/researchData';
import { exportMarketAnalyticsPdf } from '../utils/analyticsPdfReports';
import type { SiteTabId } from '../utils/seo';
import { tracker } from '../utils/tracker';
import { DfoMultiRegionConcentrationChart } from './DfoMultiRegionConcentrationChart';
import { DfoRegionComparisonChart } from './DfoRegionComparisonChart';
import { DfoTwoPeriodDemandComparison } from './DfoTwoPeriodDemandComparison';
import { DfoSubjectsD3SvgMap } from './DfoSubjectsD3SvgMap';
import { DfoGeographyLeafletMap } from './DfoGeographyLeafletMap';
import { MarketDfoDemandTableBlock } from './MarketDfoDemandTableBlock';
import { PrimoryeActivityMap } from './PrimoryeActivityMap';
import { PrimoryeMunicipalD3Heatmap } from './PrimoryeMunicipalD3Heatmap';

type MarketTabId = 'geo' | 'demand' | 'strategy';
type GeoLayerId = 'leaflet_dfo' | 'd3_dfo' | 'primorye_heatmap' | 'primorye_activity';
type DemandChartId = 'concentration' | 'comparison' | 'periods';

const MARKET_TABS: {
  id: MarketTabId;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'geo', label: 'Геоаналитика ДФО и Приморья', Icon: Map },
  { id: 'demand', label: 'Спрос и динамика регионов', Icon: BarChart3 },
  { id: 'strategy', label: 'Сегменты, риски и 7 мер', Icon: ShieldAlert },
];

interface MarketSectionProps {
  onNavigate?: (tab: SiteTabId) => void;
}

export const MarketSection: React.FC<MarketSectionProps> = ({ onNavigate }) => {
  const [marketTab, setMarketTab] = useState<MarketTabId>('geo');
  const [geoLayer, setGeoLayer] = useState<GeoLayerId>('leaflet_dfo');
  const [demandChart, setDemandChart] = useState<DemandChartId>('concentration');
  const [selectedHorizonId, setSelectedHorizonId] = useState<string>(HORIZON_STAGES[0].id);
  const [stakeholderFilter, setStakeholderFilter] = useState<
    'all' | 'ВВГУ и РЦА' | 'Минтуризма и МЭР' | 'Туроператоры'
  >('all');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);

  const activeHorizon =
    HORIZON_STAGES.find((h) => h.id === selectedHorizonId) ?? HORIZON_STAGES[0];
  const filteredRecommendations =
    stakeholderFilter === 'all'
      ? RECOMMENDATIONS
      : RECOMMENDATIONS.filter((rec) => rec.stakeholder === stakeholderFilter);

  const handleDownloadReport = () => {
    const { fileName } = exportMarketAnalyticsPdf({
      activeHorizon,
      stakeholderFilter,
    });
    setPdfNotice(`PDF-отчёт ${fileName} сформирован и сохранён.`);
    tracker.trackCustomInteraction('Рынок ДФО · Скачать отчет (jsPDF)', stakeholderFilter);
  };

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
              <span>Рынок труда ДФО</span>
              <span aria-hidden="true">·</span>
              <span>Окно 2026–2030 гг.</span>
              <span aria-hidden="true">·</span>
              <span>Геоаналитика и стратегия</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 text-balance">
              Аналитика рынка проводников ДФО, карты спроса и 7 стратегических мер
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Ввод курорта «Приморье» в бухте Алеут (2027) и объектов в Хасанском округе (2028)
              формирует устойчивый внепиковый спрос. Изучите распределение по субъектам ДФО,
              сравнение округов Приморья и дорожную карту легализации кадров.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadReport}
            className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileDown className="w-4 h-4" aria-hidden="true" />
            <span>Скачать отчет PDF</span>
          </button>
        </div>

        {pdfNotice && (
          <p
            role="status"
            className="text-xs text-teal-900 bg-teal-50 border border-teal-200 rounded-lg px-3.5 py-2 font-medium"
          >
            {pdfNotice}
          </p>
        )}

        {/* Workspace Tab Bar */}
        <div
          role="tablist"
          aria-label="Разделы аналитики рынка ДФО"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
        >
          {MARKET_TABS.map(({ id, label, Icon }) => {
            const active = marketTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setMarketTab(id);
                  tracker.trackCustomInteraction(`Рынок ДФО · ${label}`, 'market');
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {marketTab === 'geo' && (
        <div className="space-y-6">
          {/* Unified Map Studio Switcher */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Единая геоплатформа ДФО
              </p>
              <h2 className="text-base font-bold text-slate-900">
                Переключение картографических слоёв
              </h2>
            </div>

            <div
              role="tablist"
              aria-label="Слои геоаналитики"
              className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
            >
              {(
                [
                  { id: 'leaflet_dfo', label: 'Карта ДФО (Leaflet)' },
                  { id: 'd3_dfo', label: 'Субъекты ДФО (D3)' },
                  { id: 'primorye_heatmap', label: 'Тепловая карта Приморья' },
                  { id: 'primorye_activity', label: 'Активность и маршруты Приморья' },
                ] as const
              ).map((layer) => {
                const active = geoLayer === layer.id;
                return (
                  <button
                    key={layer.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setGeoLayer(layer.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {layer.label}
                  </button>
                );
              })}
            </div>
          </div>

          {geoLayer === 'leaflet_dfo' && <DfoGeographyLeafletMap />}
          {geoLayer === 'd3_dfo' && <DfoSubjectsD3SvgMap />}
          {geoLayer === 'primorye_heatmap' && <PrimoryeMunicipalD3Heatmap />}
          {geoLayer === 'primorye_activity' && <PrimoryeActivityMap />}
        </div>
      )}

      {marketTab === 'demand' && (
        <div className="space-y-6">
          <MarketDfoDemandTableBlock />

          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Сравнительная визуализация
              </p>
              <h2 className="text-base font-bold text-slate-900">
                Диаграммы концентрации и динамики по субъектам ДФО
              </h2>
            </div>

            <div
              role="tablist"
              aria-label="Графики спроса ДФО"
              className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
            >
              {(
                [
                  { id: 'concentration', label: 'Концентрация по ДФО' },
                  { id: 'comparison', label: 'Сравнение 2 регионов' },
                  { id: 'periods', label: 'Динамика периодов' },
                ] as const
              ).map((c) => {
                const active = demandChart === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setDemandChart(c.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {demandChart === 'concentration' && <DfoMultiRegionConcentrationChart />}
          {demandChart === 'comparison' && <DfoRegionComparisonChart />}
          {demandChart === 'periods' && <DfoTwoPeriodDemandComparison />}

          {onNavigate && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-slate-600">
                Рассчитайте индивидуальный прогноз закрытия дефицита кадров до 2030 года и смету
                обучения ДПО ВВГУ в калькуляторе.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('calculator')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Открыть калькулятор 2030</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}

      {marketTab === 'strategy' && (
        <div className="space-y-8">
          {/* 3 Market Segments */}
          <section className="space-y-5">
            <div>
              <p className="text-xs font-medium text-teal-700">Сегментация спроса</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Три профиля инструкторов-проводников на Дальнем Востоке
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {MARKET_SEGMENTS.map((seg) => (
                <article
                  key={seg.id}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col"
                >
                  <div className="aspect-[4/3] bg-slate-900 relative overflow-hidden">
                    {!failedImages[seg.id] ? (
                      <img
                        src={seg.image}
                        alt={seg.imageAlt}
                        referrerPolicy="no-referrer"
                        onError={() => setFailedImages((prev) => ({ ...prev, [seg.id]: true }))}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-800 to-teal-950 flex flex-col items-center justify-center p-6 text-white text-center">
                        <Compass className="w-8 h-8 text-teal-300 mb-2" aria-hidden="true" />
                        <span className="text-xs font-medium">{seg.title}</span>
                      </div>
                    )}
                  </div>

                  <div className="p-6 flex-1 flex flex-col justify-between gap-4">
                    <div className="space-y-3">
                      <div className="text-xs text-slate-500">
                        <span>{seg.regionFocus}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono text-slate-700">{seg.groupNorm}</span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 leading-snug">{seg.title}</h3>
                      <p className="text-sm text-slate-600 leading-relaxed">{seg.description}</p>
                      <ul className="space-y-1.5 pt-2 border-t border-slate-200 text-xs text-slate-700">
                        {seg.requirements.map((req) => (
                          <li key={req}>· {req}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-3 border-t border-slate-200 text-xs font-semibold text-teal-700">
                      {seg.status}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Regional Specifics */}
          <section className="bg-slate-900 text-white rounded-xl p-8 space-y-6">
            <div className="max-w-3xl space-y-2">
              <p className="text-xs font-medium text-teal-300">
                Региональная специфика Дальнего Востока
              </p>
              <h2 className="text-xl font-bold">
                Почему требования к проводнику на ДФО выше, чем в средней полосе
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="border-t border-slate-700 pt-4 space-y-2">
                <h3 className="text-sm font-semibold text-white">Фауна и крупные хищники</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Обитание амурского тигра и бурого медведя на маршрутах Приморья («Земля леопарда»,
                  «Бикин», «Удэгейская легенда») требует протоколов предотвращения встреч и работы
                  со спецсредствами.
                </p>
              </div>
              <div className="border-t border-slate-700 pt-4 space-y-2">
                <h3 className="text-sm font-semibold text-white">Автономия и спутниковая связь</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Большие расстояния и отсутствие сотового покрытия делают обязательными навыки
                  работы со спутниковыми трекерами (Garmin inReach) и расширенную первую помощь
                  Wilderness First Aid.
                </p>
              </div>
              <div className="border-t border-slate-700 pt-4 space-y-2">
                <h3 className="text-sm font-semibold text-white">Контраст профилей ДФО</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Приморье формирует массовый спрос на сервис-ориентированных проводников для экотроп
                  и глэмпингов, тогда как Камчатка и Сахалин — на экспедиционные группы до 4–6 человек.
                </p>
              </div>
            </div>
          </section>

          {/* 5 Bottlenecks & 1-2-3 Year Horizon */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-8 space-y-5">
              <div>
                <p className="text-xs font-medium text-red-700">Структурные риски</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Пять «узких мест» рынка проводников
                </h2>
              </div>

              <div className="divide-y divide-slate-200">
                {BOTTLENECKS.map((item) => (
                  <div key={item.id} className="py-4 first:pt-2 last:pb-0 space-y-1.5">
                    <div className="flex items-baseline gap-2.5">
                      <span className="text-xs font-mono font-semibold text-slate-400 tabular-nums">
                        {item.index}
                      </span>
                      <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed pl-6">{item.summary}</p>
                    <p className="text-xs text-teal-800 font-medium leading-relaxed pl-6">
                      {item.impact}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-8 space-y-6 flex flex-col justify-between">
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-medium text-teal-700">Прогноз востребованности</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    Какие специалисты будут востребованы через 1, 2 и 3 года
                  </h2>
                </div>

                <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  {HORIZON_STAGES.map((stage) => {
                    const active = stage.id === selectedHorizonId;
                    return (
                      <button
                        key={stage.id}
                        type="button"
                        onClick={() => setSelectedHorizonId(stage.id)}
                        className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {stage.horizon} ({stage.period})
                      </button>
                    );
                  })}
                </div>

                <div className="border-t border-slate-200 pt-5 space-y-5">
                  <div>
                    <p className="text-xs font-mono text-teal-700">{activeHorizon.period}</p>
                    <h3 className="mt-1 text-xl font-bold text-slate-900">
                      {activeHorizon.archetype}
                    </h3>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Драйверы спроса
                    </p>
                    <ul className="space-y-2 text-sm text-slate-700">
                      {activeHorizon.drivers.map((d) => (
                        <li key={d} className="leading-relaxed">
                          · {d}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Ключевые компетенции профиля
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {activeHorizon.competencies.map((comp) => (
                        <div
                          key={comp}
                          className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-medium text-slate-800"
                        >
                          {comp}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700 leading-relaxed">
                <span className="font-semibold text-slate-900">
                  Сквозной тренд всех трёх горизонтов:
                </span>{' '}
                переход от роли «ведущего по тропе» к статусу «менеджера безопасности».
              </div>
            </div>
          </section>

          {/* 7 Strategic Recommendations */}
          <section className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-teal-700">Дорожная карта действий</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Семь мер по преодолению кадрового дефицита
                </h2>
              </div>

              <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['all', 'ВВГУ и РЦА', 'Минтуризма и МЭР', 'Туроператоры'] as const).map(
                  (filterVal) => (
                    <button
                      key={filterVal}
                      type="button"
                      onClick={() => setStakeholderFilter(filterVal)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        stakeholderFilter === filterVal
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {filterVal === 'all' ? 'Все участники (7)' : filterVal}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredRecommendations.map((rec) => (
                <div key={rec.id} className="border border-slate-200 rounded-lg p-5 space-y-3">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-mono font-semibold text-teal-700 tabular-nums">
                      Мера {rec.index}
                    </span>
                    <span className="text-slate-500 font-medium">{rec.stakeholder}</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{rec.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{rec.mechanism}</p>
                  <p className="text-xs text-slate-800 pt-2 border-t border-slate-200 leading-relaxed">
                    <span className="font-semibold">Эффект:</span> {rec.expectedEffect}
                  </p>
                </div>
              ))}
            </div>

            {onNavigate && (
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-slate-600">
                  Ближайшие выездные и очные комиссии по 7 субъектам ДФО представлены в разделе
                  аттестации.
                </p>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onNavigate('calculator')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:border-teal-500 text-slate-800 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>Калькулятор и смета</span>
                    <ArrowRight className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('certification')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>График аттестаций 2027</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
