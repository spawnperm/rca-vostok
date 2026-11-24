import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Compass,
  Download,
  ExternalLink,
  MessageSquare,
  Send,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { AccreditationRegistryTable } from './AccreditationRegistryTable';
import { AccreditationRenewalLineChart } from './AccreditationRenewalLineChart';
import { ActiveInquiriesDashboardWidget } from './ActiveInquiriesDashboardWidget';
import { AttestationCommissionWidget } from './AttestationCommissionWidget';
import { CertifiedInstructorsReviewsCarousel } from './CertifiedInstructorsReviewsCarousel';
import { CourseSatisfactionSurvey } from './CourseSatisfactionSurvey';
import { DfoHubsWeatherWidget } from './DfoHubsWeatherWidget';
import { ExpertProfileWidget } from './ExpertProfileWidget';
import { GuideEmploymentReattestationSurvey } from './GuideEmploymentReattestationSurvey';
import { InstructorReadinessSurvey } from './InstructorReadinessSurvey';
import { OverviewAttestationStatusBar } from './OverviewAttestationStatusBar';
import { PartnersAndCoOrganizersSection } from './PartnersAndCoOrganizersSection';
import { SuccessStoriesSection } from './SuccessStoriesSection';
import { CuratorConsultationModal } from './overview/CuratorConsultationModal';
import { InquiryFormSection } from './overview/InquiryFormSection';
import { generateOverviewDemoCertificatePdf } from '../utils/overviewDemoCertificatePdf';
import {
  ATTESTATION_TIMELINE_2025_2030,
  CENTER_ACCREDITATION_STATUS,
  EMPIRICAL_TABLE,
  RCA_PROFILE,
} from '../data/researchData';
import type { NavigateOptions, SiteTabId } from '../utils/seo';
import { tracker } from '../utils/tracker';

export type OverviewTabId = 'summary' | 'commission' | 'monitoring' | 'registry';

const VALID_OVERVIEW_TABS = new Set<OverviewTabId>([
  'summary',
  'commission',
  'monitoring',
  'registry',
]);

interface OverviewSectionProps {
  initialSubTab?: string;
  onSubTabChange?: (subTab: string) => void;
  onNavigate: (tab: SiteTabId, options?: NavigateOptions) => void;
}

const OVERVIEW_TABS: {
  id: OverviewTabId;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'summary', label: 'Сводка и заявки', Icon: BarChart3 },
  { id: 'commission', label: 'Комиссия и партнёры', Icon: Users },
  { id: 'monitoring', label: 'Мониторинг и опросы', Icon: Compass },
  { id: 'registry', label: 'Реестр и аккредитация', Icon: ShieldCheck },
];

function resolveOverviewTab(sub?: string): OverviewTabId {
  if (sub && VALID_OVERVIEW_TABS.has(sub as OverviewTabId)) {
    return sub as OverviewTabId;
  }
  return 'summary';
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({
  initialSubTab,
  onSubTabChange,
  onNavigate,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<OverviewTabId>(() =>
    resolveOverviewTab(initialSubTab)
  );
  const [tableFilter, setTableFilter] = useState<'all' | 'core'>('core');
  const [timelineIndex, setTimelineIndex] = useState<number>(2);
  const [activeContourId, setActiveContourId] = useState<string>(
    CENTER_ACCREDITATION_STATUS.contours[0].id
  );
  const [heroDemoCertNotice, setHeroDemoCertNotice] = useState<string | null>(null);

  const [region, setRegion] = useState<string>('Приморский край');
  const [track, setTrack] = useState<string>('Пешеходный туризм');
  const [statsRefreshKey, setStatsRefreshKey] = useState<number>(0);
  const [curatorModalOpen, setCuratorModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (initialSubTab && VALID_OVERVIEW_TABS.has(initialSubTab as OverviewTabId)) {
      setActiveSubTab(initialSubTab as OverviewTabId);
    }
  }, [initialSubTab]);

  const selectSubTab = (tabId: OverviewTabId) => {
    setActiveSubTab(tabId);
    onSubTabChange?.(tabId);
  };

  const openCuratorModal = (sourceLabel: string) => {
    setCuratorModalOpen(true);
    tracker.trackCustomInteraction('Открыто окно связи с куратором', sourceLabel);
  };

  const scrollToInquiryForm = (regionName?: string, trackName?: string) => {
    if (regionName) setRegion(regionName);
    if (trackName) setTrack(trackName);
    selectSubTab('summary');
    window.setTimeout(() => {
      document.getElementById('inquiry-section')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 60);
  };

  const handleQuickDownloadDemoCert = () => {
    try {
      const result = generateOverviewDemoCertificatePdf({
        fullName: 'Соискатель РЦА «Русский Восток»',
        region: 'Приморский край',
        track: 'Пешеходный туризм',
        category: '1–2 категория сложности (коммерческие туры ДФО)',
        contour: 'Контур А (зачёт подтверждённого стажа)',
        readinessPercent: 88,
      });
      window.setTimeout(() => URL.revokeObjectURL(result.pdfBlobUrl), 1000);
      setHeroDemoCertNotice(
        `Сформирован образец PDF «${result.fileName}». Именной сертификат доступен в разделе «Аттестация» → «Реестр и удостоверение».`
      );
      tracker.trackCustomInteraction(
        'Обзор · Скачать демо-сертификат (PDF)',
        result.data.certificateId
      );
    } catch {
      setHeroDemoCertNotice('Не удалось сформировать PDF — откройте раздел «Аттестация».');
    }
  };

  const activeMilestone =
    ATTESTATION_TIMELINE_2025_2030[timelineIndex] ?? ATTESTATION_TIMELINE_2025_2030[0];
  const activeAccreditationContour =
    CENTER_ACCREDITATION_STATUS.contours.find((c) => c.id === activeContourId) ??
    CENTER_ACCREDITATION_STATUS.contours[0];
  const visibleRows =
    tableFilter === 'core' ? EMPIRICAL_TABLE.filter((row) => row.highlight) : EMPIRICAL_TABLE;

  return (
    <div className="space-y-8">
      {/* Executive Header */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              Панель управления РЦА «Русский Восток» · ВВГУ и ФСТР
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
              Аналитический центр аттестации инструкторов-проводников ДФО
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Единая рабочая панель центра: статистика заявок в реальном времени, эмпирический
              баланс кадров Приморья, состав экспертной комиссии, мониторинг готовности и реестр
              аккредитации.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => scrollToInquiryForm()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Подать заявку</span>
            </button>
            <button
              type="button"
              onClick={() => openCuratorModal('Обзор центра · Шапка')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              <span>Запрос куратору</span>
            </button>
            <button
              type="button"
              onClick={handleQuickDownloadDemoCert}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Образец удостоверения</span>
            </button>
          </div>
        </div>

        {heroDemoCertNotice && (
          <div
            role="status"
            className="text-xs text-teal-900 bg-teal-50 border border-teal-200 rounded-lg px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2"
          >
            <span>{heroDemoCertNotice}</span>
            <button
              type="button"
              onClick={() => onNavigate('certification', { subTab: 'registry' })}
              className="inline-flex items-center gap-1 font-semibold text-teal-800 hover:text-teal-950 underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Открыть конструктор в «Аттестации»</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Workspace Sub-Navigation */}
        <div
          role="tablist"
          aria-label="Разделы обзора центра"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
        >
          {OVERVIEW_TABS.map(({ id, label, Icon }) => {
            const active = activeSubTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  selectSubTab(id);
                  tracker.trackCustomInteraction(`Обзор центра · ${label}`, 'overview');
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

      {/* Live Status Bar & Inquiries KPI */}
      <OverviewAttestationStatusBar
        onApplyForSession={(regionName, trackName) =>
          scrollToInquiryForm(regionName, trackName)
        }
        onContactCurator={(source) => openCuratorModal(source)}
      />

      {activeSubTab === 'summary' && (
        <div className="space-y-8">
          <ActiveInquiriesDashboardWidget
            refreshKey={statsRefreshKey}
            onScrollToForm={() => scrollToInquiryForm()}
            onContactCurator={(source) => openCuratorModal(source)}
          />

          {/* Empirical Table + Platform Shortcuts */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-teal-700">Эмпирическая база исследования</p>
                  <h2 className="text-lg font-bold text-slate-900">
                    Баланс спроса и легального предложения (Приморский край)
                  </h2>
                </div>
                <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setTableFilter('core')}
                    className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                      tableFilter === 'core'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Ключевые ({EMPIRICAL_TABLE.filter((r) => r.highlight).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTableFilter('all')}
                    className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                      tableFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Все показатели ({EMPIRICAL_TABLE.length})
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                      <th className="py-2.5 pr-4">Показатель</th>
                      <th className="py-2.5 px-3 text-right">Значение</th>
                      <th className="py-2.5 pl-3">Источник / период</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleRows.map((row) => (
                      <tr key={row.indicator}>
                        <td className="py-2.5 pr-4 font-medium text-slate-800">{row.indicator}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-teal-800 tabular-nums whitespace-nowrap">
                          {row.value}
                        </td>
                        <td className="py-2.5 pl-3 text-xs text-slate-500">{row.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h2 className="text-base font-bold text-slate-900">Инструменты платформы</h2>
                <div className="space-y-2.5">
                  {(
                    [
                      {
                        tab: 'calculator',
                        title: 'Калькулятор 2030 и сметы',
                        desc: 'Сценарии дефицита, ДПО и госпошлина',
                      },
                      {
                        tab: 'market',
                        title: 'Геоаналитика рынка ДФО',
                        desc: 'Карты, тепловые слои и 7 мер',
                      },
                      {
                        tab: 'dissertation',
                        title: 'Диссертация ВАК 5.2.3',
                        desc: 'Методика, IFMGA и PDF-материалы',
                      },
                      {
                        tab: 'presentations',
                        title: 'Слайды для защиты и сессий',
                        desc: '18 академических и 10 управленческих',
                      },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.tab}
                      type="button"
                      onClick={() => onNavigate(item.tab)}
                      className="w-full text-left p-3.5 rounded-lg border border-slate-200 hover:border-teal-400 hover:bg-teal-50/40 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-900">{item.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900 text-white rounded-xl p-5 space-y-2.5">
                <p className="text-xs font-semibold text-teal-300">Площадка проведения</p>
                <p className="text-sm font-bold">{RCA_PROFILE.fullName}</p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {RCA_PROFILE.legalBasis.join(' · ')}
                </p>
                <a
                  href="https://attestation.tssr.ru/rca_primorie"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-300 hover:text-white pt-1"
                >
                  <span>Страница в реестре ФСТР</span>
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>
          </section>

          {/* 2025-2030 Interactive Timeline */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-teal-700">Регуляторная траектория</p>
                <h2 className="text-lg font-bold text-slate-900">
                  Дорожная карта легализации рынка (2025–2030 гг.)
                </h2>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ATTESTATION_TIMELINE_2025_2030.map((item, idx) => (
                  <button
                    key={item.period}
                    type="button"
                    onClick={() => setTimelineIndex(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer ${
                      idx === timelineIndex
                        ? 'bg-teal-700 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {item.period}
                  </button>
                ))}
              </div>
            </div>

            {activeMilestone && (
              <div className="border-t border-slate-200 pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <p className="text-xs font-semibold text-teal-700">
                    {activeMilestone.phase} · {activeMilestone.period}
                  </p>
                  <h3 className="text-base font-bold text-slate-900">{activeMilestone.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {activeMilestone.summary}
                  </p>
                  <ul className="space-y-1 pt-1 text-xs text-slate-600 list-disc list-inside">
                    {activeMilestone.keyTasks.map((task) => (
                      <li key={task}>{task}</li>
                    ))}
                  </ul>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1 self-start">
                  <p className="text-xs font-semibold text-slate-500">Ключевой ориентир</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {activeMilestone.checkpointMetric}
                  </p>
                </div>
              </div>
            )}
          </section>

          <InquiryFormSection
            defaultRegion={region}
            defaultTrack={track}
            onSubmitted={() => setStatsRefreshKey((prev) => prev + 1)}
          />
        </div>
      )}

      {activeSubTab === 'commission' && (
        <div className="space-y-8">
          <AttestationCommissionWidget onContactCurator={openCuratorModal} />
          <ExpertProfileWidget
            onContactCurator={openCuratorModal}
            onApplyForSession={(regionName, trackName) =>
              scrollToInquiryForm(regionName, trackName)
            }
          />
          <PartnersAndCoOrganizersSection />
          <SuccessStoriesSection onApplyForSession={() => scrollToInquiryForm()} />
          <CertifiedInstructorsReviewsCarousel />
        </div>
      )}

      {activeSubTab === 'monitoring' && (
        <div className="space-y-8">
          <GuideEmploymentReattestationSurvey
            onApplyForSession={(regionName, trackName) =>
              scrollToInquiryForm(regionName, trackName)
            }
          />
          <InstructorReadinessSurvey
            onApplyForSession={(regionName, trackName) =>
              scrollToInquiryForm(regionName, trackName)
            }
            onContactCurator={(source) => openCuratorModal(source)}
          />
          <CourseSatisfactionSurvey />
          <DfoHubsWeatherWidget />
          <section className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Обратная связь и кураторская поддержка
              </p>
              <h3 className="text-base font-bold text-slate-900">
                Форма отзывов о платформе, контакты приёмной комиссии и мессенджеры РЦА
              </h3>
              <p className="text-xs text-slate-600">
                Все обращения и отзывы о качестве сервисов объединены в разделе «FAQ и связь».
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('contacts', { subTab: 'contacts' })}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Перейти к контактам и отзыву</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </section>
        </div>
      )}

      {activeSubTab === 'registry' && (
        <div className="space-y-8">
          <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-teal-700">Статус аккредитации РЦА</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {CENTER_ACCREDITATION_STATUS.legalOperator}
                </h2>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CENTER_ACCREDITATION_STATUS.contours.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveContourId(c.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      c.id === activeContourId
                        ? 'bg-teal-700 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {c.code}
                  </button>
                ))}
              </div>
            </div>

            {activeAccreditationContour && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-2">
                <p className="text-xs font-semibold text-teal-700">
                  {activeAccreditationContour.statusLabel} · {activeAccreditationContour.legalNorm}
                </p>
                <h3 className="text-base font-bold text-slate-900">
                  {activeAccreditationContour.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {activeAccreditationContour.scope}
                </p>
                <p className="text-xs text-slate-500">
                  {activeAccreditationContour.authority} · {activeAccreditationContour.verificationNote}
                </p>
              </div>
            )}
          </section>

          <AccreditationRegistryTable />
          <AccreditationRenewalLineChart />
          <section className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Федеральный реестр проводников ДФО
              </p>
              <h3 className="text-base font-bold text-slate-900">
                Поиск по действующим удостоверениям и конструктор образца документа
              </h3>
              <p className="text-xs text-slate-600">
                Таблица аттестованных проводников с фильтрацией по субъектам и проверкой сроков
                действия вынесена в раздел «Аттестация».
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('certification', { subTab: 'registry' })}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Открыть реестр в «Аттестации»</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </section>
        </div>
      )}

      <CuratorConsultationModal
        open={curatorModalOpen}
        onClose={() => setCuratorModalOpen(false)}
        onSubmitted={() => setStatsRefreshKey((prev) => prev + 1)}
      />
    </div>
  );
};
