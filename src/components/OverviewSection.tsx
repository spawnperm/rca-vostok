import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Compass,
  Download,
  ExternalLink,
  MessageSquare,
  Send,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { AccreditationRegistryTable } from './AccreditationRegistryTable';
import { AccreditationRenewalLineChart } from './AccreditationRenewalLineChart';
import { ActiveInquiriesDashboardWidget } from './ActiveInquiriesDashboardWidget';
import { AttestationCommissionWidget } from './AttestationCommissionWidget';
import { CertifiedInstructorsReviewsCarousel } from './CertifiedInstructorsReviewsCarousel';
import { CourseSatisfactionSurvey } from './CourseSatisfactionSurvey';
import { DfoHubsWeatherWidget } from './DfoHubsWeatherWidget';
import { ExpertProfileWidget } from './ExpertProfileWidget';
import { InstructorReadinessSurvey } from './InstructorReadinessSurvey';
import { OverviewAttestationStatusBar } from './OverviewAttestationStatusBar';
import { PartnersAndCoOrganizersSection } from './PartnersAndCoOrganizersSection';
import { SuccessStoriesSection } from './SuccessStoriesSection';
import { generateOverviewDemoCertificatePdf } from '../utils/overviewDemoCertificatePdf';
import { DFO_INQUIRY_REGIONS } from '../data/dfoRegions';
import {
  ATTESTATION_TIMELINE_2025_2030,
  CENTER_ACCREDITATION_STATUS,
  EMPIRICAL_TABLE,
  RCA_PROFILE,
} from '../data/researchData';
import { tracker } from '../utils/tracker';

interface OverviewSectionProps {
  onNavigate: (
    tab:
      | 'calculator'
      | 'market'
      | 'dissertation'
      | 'presentations'
      | 'account'
      | 'certification'
      | 'contacts'
      | 'faq'
      | 'learning'
      | 'routes'
  ) => void;
}

type OverviewTabId = 'summary' | 'commission' | 'monitoring' | 'registry';

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

export const OverviewSection: React.FC<OverviewSectionProps> = ({ onNavigate }) => {
  const [activeSubTab, setActiveSubTab] = useState<OverviewTabId>('summary');
  const [tableFilter, setTableFilter] = useState<'all' | 'core'>('core');
  const [timelineIndex, setTimelineIndex] = useState<number>(2);
  const [activeContourId, setActiveContourId] = useState<string>(
    CENTER_ACCREDITATION_STATUS.contours[0].id
  );
  const [heroDemoCertNotice, setHeroDemoCertNotice] = useState<string | null>(null);

  // Inquiry form state
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [contactChannel, setContactChannel] = useState<string>('');
  const [region, setRegion] = useState<string>('Приморский край');
  const [track, setTrack] = useState<string>('Пешеходный туризм');
  const [experienceNote, setExperienceNote] = useState<string>('');
  const [consentAccepted, setConsentAccepted] = useState<boolean>(false);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<{ id: string; createdAt: string } | null>(null);
  const [totalSubscriptions, setTotalSubscriptions] = useState<number | null>(null);
  const [statsRefreshKey, setStatsRefreshKey] = useState<number>(0);

  // Curator consultation modal state
  const [curatorModalOpen, setCuratorModalOpen] = useState<boolean>(false);
  const [curatorName, setCuratorName] = useState<string>('');
  const [curatorEmail, setCuratorEmail] = useState<string>('');
  const [curatorContact, setCuratorContact] = useState<string>('');
  const [curatorRegion, setCuratorRegion] = useState<string>('Приморский край');
  const [curatorTopic, setCuratorTopic] = useState<string>('Допуск и перечень документов');
  const [curatorQuestion, setCuratorQuestion] = useState<string>('');
  const [curatorConsent, setCuratorConsent] = useState<boolean>(false);
  const [curatorSubmitting, setCuratorSubmitting] = useState<boolean>(false);
  const [curatorError, setCuratorError] = useState<string | null>(null);
  const [curatorSuccess, setCuratorSuccess] = useState<{ id: string; topic: string } | null>(null);

  useEffect(() => {
    fetch('/api/inquiries/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { totalSubscriptions?: number } | null) => {
        if (d && typeof d.totalSubscriptions === 'number') {
          setTotalSubscriptions(d.totalSubscriptions);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!curatorModalOpen) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setCuratorModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [curatorModalOpen]);

  const openCuratorModal = (sourceLabel: string) => {
    setCuratorError(null);
    setCuratorModalOpen(true);
    tracker.trackCustomInteraction('Открыто окно связи с куратором', sourceLabel);
  };

  const scrollToInquiryForm = () => {
    setActiveSubTab('summary');
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
      URL.revokeObjectURL(result.pdfBlobUrl);
      setHeroDemoCertNotice(
        `Сформирован образец PDF «${result.fileName}». Именной сертификат доступен в разделе «Аттестация» → «Реестр и удостоверение».`
      );
      tracker.trackCustomInteraction('Обзор · Скачать демо-сертификат (PDF)', result.data.certificateId);
    } catch {
      setHeroDemoCertNotice('Не удалось сформировать PDF — откройте раздел «Аттестация».');
    }
  };

  const handleInquirySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    if (fullName.trim().length < 2) {
      setFormError('Пожалуйста, укажите ваше имя или ФИО.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setFormError('Укажите корректный адрес электронной почты.');
      return;
    }
    if (!consentAccepted) {
      setFormError('Подтвердите согласие на получение уведомлений о сроках аттестации.');
      return;
    }

    setFormSubmitting(true);
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          contactChannel: contactChannel.trim(),
          region,
          track,
          experienceNote: experienceNote.trim(),
          consentAccepted,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        id?: string;
        createdAt?: string;
        totalSubscriptions?: number;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Не удалось сохранить заявку. Повторите попытку.');
      }
      setFormSuccess({
        id: data.id || 'registered',
        createdAt: data.createdAt || new Date().toISOString(),
      });
      if (typeof data.totalSubscriptions === 'number') {
        setTotalSubscriptions(data.totalSubscriptions);
      }
      setStatsRefreshKey((prev) => prev + 1);
      tracker.trackCustomInteraction(`Подписка на аттестацию: ${track}`, region);
      setFullName('');
      setEmail('');
      setContactChannel('');
      setExperienceNote('');
      setConsentAccepted(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Ошибка отправки формы.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleCuratorSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCuratorError(null);
    if (curatorName.trim().length < 2) {
      setCuratorError('Укажите ваше имя или ФИО (не менее 2 символов).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(curatorEmail.trim())) {
      setCuratorError('Укажите корректный адрес электронной почты для ответа куратора.');
      return;
    }
    if (curatorQuestion.trim().length < 5) {
      setCuratorError('Опишите ваш вопрос по аттестации (минимум 5 символов).');
      return;
    }
    if (!curatorConsent) {
      setCuratorError('Подтвердите согласие на обработку обращения куратором РЦА.');
      return;
    }

    setCuratorSubmitting(true);
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: curatorName.trim(),
          email: curatorEmail.trim(),
          contactChannel: curatorContact.trim(),
          region: curatorRegion,
          track: `Консультация куратора: ${curatorTopic}`,
          experienceNote: curatorQuestion.trim(),
          consentAccepted: curatorConsent,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        id?: string;
        totalSubscriptions?: number;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Не удалось отправить запрос на консультацию.');
      }
      setCuratorSuccess({ id: data.id || 'registered', topic: curatorTopic });
      if (typeof data.totalSubscriptions === 'number') {
        setTotalSubscriptions(data.totalSubscriptions);
      }
      setStatsRefreshKey((prev) => prev + 1);
      tracker.trackCustomInteraction(`Консультация куратора: ${curatorTopic}`, curatorRegion);
      setCuratorName('');
      setCuratorEmail('');
      setCuratorContact('');
      setCuratorQuestion('');
      setCuratorConsent(false);
    } catch (err) {
      setCuratorError(err instanceof Error ? err.message : 'Ошибка отправки запроса.');
    } finally {
      setCuratorSubmitting(false);
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
              onClick={scrollToInquiryForm}
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
              onClick={() => onNavigate('certification')}
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
                  setActiveSubTab(id);
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
        onApplyForSession={(regionName, trackName) => {
          setRegion(regionName);
          setTrack(trackName);
          scrollToInquiryForm();
        }}
        onContactCurator={(source) => openCuratorModal(source)}
      />

      {activeSubTab === 'summary' && (
        <div className="space-y-8">
          <ActiveInquiriesDashboardWidget
            refreshKey={statsRefreshKey}
            onScrollToForm={scrollToInquiryForm}
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

          {/* Inquiry Submission Form */}
          <section
            id="inquiry-section"
            aria-labelledby="inquiry-heading"
            className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 scroll-mt-24"
          >
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Прямая подача заявки в РЦА
              </p>
              <h2 id="inquiry-heading" className="text-xl font-bold text-slate-900 text-balance">
                Запись на аттестацию или программа переподготовки ВВГУ
              </h2>
              <p className="text-sm text-slate-600">
                Заявка сохраняется в журнале центра; статус можно отслеживать в личном кабинете.
              </p>
            </div>

            {formSuccess ? (
              <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                <div className="inline-flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                  <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                  <span>Заявка зарегистрирована</span>
                </div>
                <p className="text-sm text-slate-700">
                  Регистрационный номер:{' '}
                  <span className="font-mono font-semibold text-slate-900">{formSuccess.id}</span>.
                  Куратор направит расписание ближайших сессий на указанный email.
                </p>
                <button
                  type="button"
                  onClick={() => setFormSuccess(null)}
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  Отправить ещё одну заявку
                </button>
              </div>
            ) : (
              <form onSubmit={handleInquirySubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="inq-fullname" className="block text-xs font-semibold text-slate-700">
                      ФИО или наименование турклуба
                    </label>
                    <input
                      id="inq-fullname"
                      name="fullName"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Иванов Сергей Алексеевич"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="inq-email" className="block text-xs font-semibold text-slate-700">
                      Электронная почта
                    </label>
                    <input
                      id="inq-email"
                      name="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="guide@example.ru"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="inq-contact" className="block text-xs font-semibold text-slate-700">
                      Телефон или Telegram
                    </label>
                    <input
                      id="inq-contact"
                      name="contactChannel"
                      type="text"
                      value={contactChannel}
                      onChange={(e) => setContactChannel(e.target.value)}
                      placeholder="+7 999 ... или @username"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="inq-region" className="block text-xs font-semibold text-slate-700">
                      Субъект ДФО
                    </label>
                    <select
                      id="inq-region"
                      name="region"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                    >
                      {DFO_INQUIRY_REGIONS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="inq-track" className="block text-xs font-semibold text-slate-700">
                      Направление аттестации
                    </label>
                    <select
                      id="inq-track"
                      name="track"
                      value={track}
                      onChange={(e) => setTrack(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                    >
                      <option value="Пешеходный туризм">Пешеходный туризм</option>
                      <option value="Водный туризм и сплавы">Водный туризм и сплавы</option>
                      <option value="Автомобильный туризм">Автомобильный туризм</option>
                      <option value="Переаттестация действующего гида">
                        Переаттестация действующего гида
                      </option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="inq-note" className="block text-xs font-semibold text-slate-700">
                    Походный опыт или вопрос комиссии (необязательно)
                  </label>
                  <textarea
                    id="inq-note"
                    name="experienceNote"
                    rows={2}
                    value={experienceNote}
                    onChange={(e) => setExperienceNote(e.target.value)}
                    placeholder="Например: вожу группы на Ливадийскую и в Лазовский заповедник, интересует зачёт стажа и даты осенней сессии"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700 resize-y"
                  />
                </div>

                <div className="flex items-start gap-2.5">
                  <input
                    id="inq-consent"
                    type="checkbox"
                    checked={consentAccepted}
                    onChange={(e) => setConsentAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-teal-700 rounded cursor-pointer"
                  />
                  <label htmlFor="inq-consent" className="text-xs text-slate-600 leading-relaxed cursor-pointer">
                    Согласен получать информационные обновления о сроках аттестации, расписании
                    экзаменов РЦА «Русский Восток» и наборе на программы переподготовки ВВГУ.
                  </label>
                </div>

                {formError && (
                  <div
                    role="alert"
                    className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800"
                  >
                    {formError}
                  </div>
                )}

                <div className="pt-1 flex flex-wrap items-center justify-between gap-4">
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="px-5 py-2.5 bg-teal-700 text-white text-sm font-semibold rounded-lg hover:bg-teal-800 disabled:opacity-50 inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Send className="w-4 h-4" aria-hidden="true" />
                    <span>{formSubmitting ? 'Отправка…' : 'Отправить заявку'}</span>
                  </button>
                  <span className="text-xs text-slate-500">
                    Контактные данные сохраняются на сервере и не публикуются
                  </span>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

      {activeSubTab === 'commission' && (
        <div className="space-y-8">
          <AttestationCommissionWidget onContactCurator={openCuratorModal} />
          <ExpertProfileWidget
            onContactCurator={openCuratorModal}
            onApplyForSession={(regionName, trackName) => {
              setRegion(regionName);
              setTrack(trackName);
              scrollToInquiryForm();
            }}
          />
          <PartnersAndCoOrganizersSection />
          <SuccessStoriesSection onApplyForSession={scrollToInquiryForm} />
          <CertifiedInstructorsReviewsCarousel />
        </div>
      )}

      {activeSubTab === 'monitoring' && (
        <div className="space-y-8">
          <InstructorReadinessSurvey
            onApplyForSession={(regionName, trackName) => {
              setRegion(regionName);
              setTrack(trackName);
              scrollToInquiryForm();
            }}
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
              onClick={() => onNavigate('contacts')}
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
              onClick={() => onNavigate('certification')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Открыть реестр в «Аттестации»</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </section>
        </div>
      )}

      {/* Curator Consultation Modal */}
      {curatorModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCuratorModalOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="curator-modal-title"
            className="w-full max-w-xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-50">
              <div className="space-y-1">
                <p className="text-xs font-medium text-teal-700">
                  Индивидуальная консультация · РЦА «Русский Восток»
                </p>
                <h2 id="curator-modal-title" className="text-lg font-bold text-slate-900">
                  Запрос куратору по вопросам аттестации
                </h2>
                <p className="text-xs text-slate-600">
                  Куратор направления: Григорий Саранча (руководитель центра, ВВГУ)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCuratorModalOpen(false)}
                aria-label="Закрыть окно консультации"
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {curatorSuccess ? (
                <div className="py-4 space-y-4">
                  <div className="inline-flex items-center gap-2 text-teal-700 font-semibold text-sm">
                    <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                    <span>Запрос на консультацию отправлен</span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Тема: <span className="font-medium text-slate-900">{curatorSuccess.topic}</span>.
                    Номер обращения: <span className="font-mono">{curatorSuccess.id}</span>.
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => setCuratorSuccess(null)}
                      className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Задать ещё вопрос
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCuratorSuccess(null);
                        setCuratorModalOpen(false);
                      }}
                      className="px-4 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-medium rounded-lg cursor-pointer"
                    >
                      Закрыть
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCuratorSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      value={curatorName}
                      onChange={(e) => setCuratorName(e.target.value)}
                      placeholder="Ваше имя / ФИО"
                      aria-label="Имя или ФИО"
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                    <input
                      type="email"
                      required
                      value={curatorEmail}
                      onChange={(e) => setCuratorEmail(e.target.value)}
                      placeholder="Электронная почта"
                      aria-label="Электронная почта"
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={curatorContact}
                      onChange={(e) => setCuratorContact(e.target.value)}
                      placeholder="Телефон или Telegram (необязательно)"
                      aria-label="Телефон или Telegram"
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                    <select
                      value={curatorTopic}
                      onChange={(e) => setCuratorTopic(e.target.value)}
                      aria-label="Тема вопроса"
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="Допуск и перечень документов">Допуск и перечень документов</option>
                      <option value="Зачёт походного стажа (Контур А)">Зачёт походного стажа (Контур А)</option>
                      <option value="Обучение ДПО ВВГУ (Контур Б)">Обучение ДПО ВВГУ (Контур Б)</option>
                      <option value="Выездная комиссия в субъекте ДФО">Выездная комиссия в субъекте ДФО</option>
                    </select>
                  </div>
                  <textarea
                    rows={3}
                    required
                    value={curatorQuestion}
                    onChange={(e) => setCuratorQuestion(e.target.value)}
                    placeholder="Ваш вопрос куратору..."
                    aria-label="Текст вопроса куратору"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg resize-y"
                  />
                  <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={curatorConsent}
                      onChange={(e) => setCuratorConsent(e.target.checked)}
                      className="mt-0.5 accent-teal-700"
                    />
                    <span>Согласен на обработку обращения куратором РЦА «Русский Восток»</span>
                  </label>
                  {curatorError && (
                    <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      {curatorError}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={curatorSubmitting}
                    className="px-4 py-2.5 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 disabled:opacity-50 cursor-pointer"
                  >
                    {curatorSubmitting ? 'Отправка…' : 'Отправить запрос куратору'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
