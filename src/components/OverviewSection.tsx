import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  ExternalLink,
  MessageSquare,
  Quote,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import { AccreditationRegistryTable } from './AccreditationRegistryTable';
import { AccreditationRenewalLineChart } from './AccreditationRenewalLineChart';
import { ActiveInquiriesDashboardWidget } from './ActiveInquiriesDashboardWidget';
import { AttestationCommissionWidget } from './AttestationCommissionWidget';
import { AttestationCostCalculator } from './AttestationCostCalculator';
import { AttestationEventsCalendarWidget } from './AttestationEventsCalendarWidget';
import { AttestationNewsFeed } from './AttestationNewsFeed';
import { AttestationReadinessCheck } from './AttestationReadinessCheck';
import { AttestationRoadmap } from './AttestationRoadmap';
import { CenterReadinessMiniQuiz } from './CenterReadinessMiniQuiz';
import { DfoAttestationPointsWidget } from './DfoAttestationPointsWidget';
import { DfoOverviewHoverMap } from './DfoOverviewHoverMap';
import { DfoRegionalOfficesMap } from './DfoRegionalOfficesMap';
import { ExpertProfileWidget } from './ExpertProfileWidget';
import { KnowledgeBaseFaq } from './KnowledgeBaseFaq';
import { PlatformFeedbackForm } from './PlatformFeedbackForm';
import { RegionalSessionsTimeline } from './RegionalSessionsTimeline';
import {
  ATTESTATION_TIMELINE_2025_2030,
  CENTER_ACCREDITATION_STATUS,
  EMPIRICAL_TABLE,
  EXPERT_TESTIMONIALS,
  GLOSSARY_TERMS,
  HERO_IMAGE,
  INDUSTRY_NEWS,
  RCA_PROFILE,
  type GlossaryTerm,
} from '../data/researchData';
import { tracker } from '../utils/tracker';

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

interface OverviewSectionProps {
  onNavigate: (tab: 'calculator' | 'market' | 'dissertation' | 'presentations') => void;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({ onNavigate }) => {
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [tableFilter, setTableFilter] = useState<'all' | 'core'>('all');
  const [expertIndex, setExpertIndex] = useState<number>(0);
  const [timelineIndex, setTimelineIndex] = useState<number>(2); // Default to active 2026-2027 stage
  const [newsCategory, setNewsCategory] = useState<'all' | 'regulation' | 'rca' | 'market'>('all');
  const [expandedNewsIds, setExpandedNewsIds] = useState<string[]>([INDUSTRY_NEWS[0].id]);
  const [activeContourId, setActiveContourId] = useState<string>(
    CENTER_ACCREDITATION_STATUS.contours[0].id
  );
  const [glossaryCategory, setGlossaryCategory] = useState<
    'all' | 'regulation' | 'procedure' | 'economics'
  >('all');
  const [hoveredGlossaryId, setHoveredGlossaryId] = useState<string | null>(null);
  const [pinnedGlossaryId, setPinnedGlossaryId] = useState<string | null>(null);

  const activeExpert = EXPERT_TESTIMONIALS[expertIndex] ?? EXPERT_TESTIMONIALS[0];
  const activeMilestone =
    ATTESTATION_TIMELINE_2025_2030[timelineIndex] ?? ATTESTATION_TIMELINE_2025_2030[0];
  const activeAccreditationContour =
    CENTER_ACCREDITATION_STATUS.contours.find((c) => c.id === activeContourId) ??
    CENTER_ACCREDITATION_STATUS.contours[0];

  const glossaryById = Object.fromEntries(GLOSSARY_TERMS.map((t) => [t.id, t])) as Record<
    string,
    GlossaryTerm
  >;

  const filteredGlossary =
    glossaryCategory === 'all'
      ? GLOSSARY_TERMS
      : GLOSSARY_TERMS.filter((item) => item.category === glossaryCategory);

  const handleToggleGlossaryPin = (term: GlossaryTerm) => {
    setPinnedGlossaryId((prev) => {
      const next = prev === term.id ? null : term.id;
      if (next) {
        tracker.trackCustomInteraction(`Глоссарий: ${term.term}`, term.categoryLabel);
      }
      return next;
    });
  };

  const handleSelectTimeline = (idx: number) => {
    const normalized = Math.max(0, Math.min(idx, ATTESTATION_TIMELINE_2025_2030.length - 1));
    setTimelineIndex(normalized);
    const chosen = ATTESTATION_TIMELINE_2025_2030[normalized];
    if (chosen) {
      tracker.trackCustomInteraction(`Таймлайн 2025–2030: ${chosen.period}`, chosen.phase);
    }
  };

  const handleSelectExpert = (nextIdx: number) => {
    const normalized =
      (nextIdx + EXPERT_TESTIMONIALS.length) % EXPERT_TESTIMONIALS.length;
    setExpertIndex(normalized);
    const chosen = EXPERT_TESTIMONIALS[normalized];
    if (chosen) {
      tracker.trackCustomInteraction(`Отзыв эксперта: ${chosen.author}`, chosen.region);
    }
  };

  const filteredNews =
    newsCategory === 'all'
      ? INDUSTRY_NEWS
      : INDUSTRY_NEWS.filter((item) => item.category === newsCategory);

  const toggleNewsDetails = (id: string, title: string) => {
    setExpandedNewsIds((prev) => {
      const exists = prev.includes(id);
      if (!exists) {
        tracker.trackCustomInteraction(`Новость раскрыта: ${title.slice(0, 60)}`);
      }
      return exists ? prev.filter((item) => item !== id) : [...prev, id];
    });
  };

  // Certification updates inquiry form state
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

  const scrollToInquiryForm = () => {
    const el = document.getElementById('inquiry-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleApplyForSession = (targetRegion: string, targetTrack: string) => {
    setRegion(targetRegion);
    setTrack(targetTrack);
    setFormSuccess(null);
    scrollToInquiryForm();
  };

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
    if (!curatorModalOpen) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setCuratorModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [curatorModalOpen]);

  const openCuratorModal = (sourceLabel: string) => {
    setCuratorError(null);
    setCuratorModalOpen(true);
    tracker.trackCustomInteraction('Открыто окно связи с куратором', sourceLabel);
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

      setCuratorSuccess({
        id: data.id || 'registered',
        topic: curatorTopic,
      });
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

  const visibleRows =
    tableFilter === 'core'
      ? EMPIRICAL_TABLE.filter((row) => row.highlight)
      : EMPIRICAL_TABLE;

  return (
    <div className="space-y-12">
      {/* Hero Split (2 columns, items-stretch) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-8 flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
              <span>rca-vostok.ru</span>
              <span aria-hidden="true">·</span>
              <span>ВВГУ + Федерация спортивного туризма России</span>
              <span aria-hidden="true">·</span>
              <span>Ноябрь 2026</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-[1.15] text-balance">
              Региональный центр аттестации «Русский Восток» и баланс кадров активного туризма ДФО
            </h1>

            <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
              Уполномоченный центр государственной аттестации инструкторов-проводников Приморского края
              на базе Владивостокского государственного университета (ВВГУ). Платформа объединяет
              институциональный профиль центра, расчётную модель потребности до 2030 года,
              аналитику рынка и материалы диссертационного исследования (ВАК 5.2.3).
            </p>
          </div>

          <div className="pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('calculator')}
                className="px-5 py-2.5 bg-teal-700 text-white text-sm font-semibold rounded-lg hover:bg-teal-800 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <span>Моделировать потребность</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('presentations')}
                className="px-5 py-2.5 bg-white border border-slate-300 text-slate-800 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                Открыть презентации
              </button>
              <button
                type="button"
                onClick={() => openCuratorModal('Hero')}
                className="px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                <MessageSquare className="w-4 h-4 text-teal-300" aria-hidden="true" />
                <span>Связаться с куратором</span>
              </button>
            </div>

            <a
              href="https://rca-vostok.ru/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-teal-700 hover:text-teal-900 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <span>Источник: rca-vostok.ru</span>
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="lg:col-span-5 relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 min-h-[280px]">
          {!heroImgFailed ? (
            <img
              src={HERO_IMAGE}
              alt="Группа туристов с аттестованным инструктором-проводником на горном хребте Приморского края"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="w-full h-full lg:h-full object-cover"
            />
          ) : (
            <div className="w-full h-full min-h-[280px] bg-gradient-to-br from-slate-800 to-teal-950 flex flex-col items-center justify-center p-8 text-center text-white">
              <Compass className="w-10 h-10 text-teal-400 mb-3" aria-hidden="true" />
              <p className="text-sm font-medium">Приморский край · Активный туризм ДФО</p>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent flex flex-col justify-end p-6">
            <p className="text-xs font-medium text-teal-300 tracking-wide">
              Полевые испытания · Шкотовский район и побережье Приморья
            </p>
            <p className="text-sm text-white/95 mt-1 leading-snug">
              Симбиоз академической базы ВВГУ, стандартов ФСТР и реальных природных полигонов Дальнего Востока.
            </p>
          </div>
        </div>
      </section>

      {/* Full-width 4-column KPI Strip */}
      <section aria-label="Ключевые показатели рынка" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <p className="text-xs font-medium text-slate-500">Турпоток Приморья · 2025</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 font-mono tabular-nums">4 068,9 тыс.</p>
          <p className="mt-2 text-xs text-slate-600">+4,5% к 2024 г. · Сезон расширен до 7 месяцев (март–ноябрь)</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <p className="text-xs font-medium text-slate-500">Активный туризм (оценка Минтуризма)</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 font-mono tabular-nums">≈ 835 тыс.</p>
          <p className="mt-2 text-xs text-slate-600">20% от общего потока: горные треки, сплавы, пешие походы</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <p className="text-xs font-medium text-slate-500">Реестр Приморского края</p>
          <p className="mt-2 text-3xl font-bold text-red-700 font-mono tabular-nums">122 чел.</p>
          <p className="mt-2 text-xs text-slate-600">Разрыв с расчётной потребностью (2 390 чел.) — более 18 раз</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <p className="text-xs font-medium text-slate-500">Выпуск РЦА и ВВГУ (окт. 2026)</p>
          <p className="mt-2 text-3xl font-bold text-teal-700 font-mono tabular-nums">26 / 52</p>
          <p className="mt-2 text-xs text-slate-600">26 аттестованы (15 ПК, 9 ХК, 2 Камч.), 52 обучены за год</p>
        </div>
      </section>

      {/* Real-time Active Applications Dashboard Widget */}
      <ActiveInquiriesDashboardWidget
        refreshKey={statsRefreshKey}
        onScrollToForm={scrollToInquiryForm}
        onContactCurator={openCuratorModal}
      />

      {/* Institutional Profile & Certification Pipeline */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-8 space-y-6">
          <div>
            <p className="text-xs font-medium text-teal-700">Институциональная база</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Архитектура РЦА «Русский Восток»
            </h2>
          </div>

          <dl className="divide-y divide-slate-200 text-sm">
            <div className="py-3">
              <dt className="text-xs text-slate-500">Площадка и партнёр</dt>
              <dd className="mt-1 font-medium text-slate-900">{RCA_PROFILE.baseInstitution}</dd>
              <dd className="text-slate-600">{RCA_PROFILE.partner}</dd>
            </div>
            {RCA_PROFILE.leadership.map((leader) => (
              <div key={leader.name} className="py-3">
                <dt className="text-xs text-slate-500">{leader.role}</dt>
                <dd className="mt-1 font-semibold text-slate-900">{leader.name}</dd>
              </div>
            ))}
            <div className="py-3">
              <dt className="text-xs text-slate-500">Нормативно-правовой контур</dt>
              <dd className="mt-1.5 space-y-1.5 text-slate-700 text-xs leading-relaxed">
                {RCA_PROFILE.legalBasis.map((item) => (
                  <p key={item}>· {item}</p>
                ))}
              </dd>
            </div>
          </dl>

          <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">Вопросы по аттестации и зачёту стажа</span>
            <button
              type="button"
              onClick={() => openCuratorModal('Архитектура РЦА')}
              className="px-3.5 py-2 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Связаться с куратором</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-8 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-teal-700">Порядок прохождения</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Четыре этапа аттестации и программы ВВГУ
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              Срок действия: 5 лет
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            {RCA_PROFILE.pipelineStages.map((stage) => (
              <div key={stage.step} className="border-t border-slate-200 pt-4">
                <p className="text-xs font-mono font-semibold text-teal-700 tabular-nums">
                  Этап {stage.step}
                </p>
                <h3 className="mt-1 text-sm font-semibold text-slate-900">{stage.title}</h3>
                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">{stage.detail}</p>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Действующие и проектируемые программы ДПО (ВВГУ + РЦА)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {RCA_PROFILE.programs.map((prog) => (
                <div key={prog.title} className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1.5">
                  <p className="text-sm font-semibold text-slate-900">{prog.title}</p>
                  <p className="text-xs font-mono text-teal-700 tabular-nums">
                    {prog.hours} · {prog.pricing}
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">{prog.seats}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Attestation Commission Experts Widget */}
      <AttestationCommissionWidget onContactCurator={openCuratorModal} />

      {/* Expert Profile: Commission & Key Speakers */}
      <ExpertProfileWidget
        onContactCurator={openCuratorModal}
        onApplyForSession={handleApplyForSession}
      />

      {/* Candidate Attestation Roadmap */}
      <AttestationRoadmap onContactCurator={openCuratorModal} />

      {/* Candidate Readiness Self-Check */}
      <AttestationReadinessCheck onContactCurator={openCuratorModal} />

      {/* 5-Question Mini Interactive Readiness Quiz */}
      <CenterReadinessMiniQuiz
        onContactCurator={openCuratorModal}
        onApplyForSession={scrollToInquiryForm}
      />

      {/* Operational Certification Announcements & Regulatory Updates Feed */}
      <AttestationNewsFeed onContactCurator={openCuratorModal} />

      {/* Certification Cost & Fee Estimator */}
      <AttestationCostCalculator onContactCurator={openCuratorModal} />

      {/* Center Accreditation & Licensing Status */}
      <section
        aria-labelledby="accreditation-status-heading"
        className="bg-white border border-slate-200 rounded-xl p-8 space-y-6"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1 max-w-3xl">
            <p className="text-xs font-medium text-teal-700">
              Правовая легитимность и лицензирование по законам РФ
            </p>
            <h2 id="accreditation-status-heading" className="text-xl font-bold text-slate-900">
              Статус аккредитации центра
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed pt-1">
              {CENTER_ACCREDITATION_STATUS.summary}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 shrink-0">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800">
              <ShieldCheck className="w-4 h-4 text-teal-700" aria-hidden="true" />
              <span>Действующий уполномоченный статус</span>
            </div>
            <a
              href={CENTER_ACCREDITATION_STATUS.officialPortal}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <span>Портал rca-vostok.ru</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-2 border-t border-slate-200">
          {/* Left 7 cols: Interactive Legal Contours */}
          <div className="lg:col-span-7 space-y-5">
            <div
              role="tablist"
              aria-label="Правовые контуры деятельности РЦА и ВВГУ"
              className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
            >
              {CENTER_ACCREDITATION_STATUS.contours.map((contour, idx) => {
                const isSelected = contour.id === activeAccreditationContour.id;
                return (
                  <button
                    key={contour.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => {
                      setActiveContourId(contour.id);
                      tracker.trackCustomInteraction(`Аккредитация: ${contour.code}`);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    0{idx + 1}.{' '}
                    {idx === 0
                      ? 'Лицензия ДПО ВВГУ'
                      : idx === 1
                      ? 'Полномочия РЦА и ФСТР'
                      : 'Комиссия и полигоны'}
                  </button>
                );
              })}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span className="font-mono font-semibold text-teal-800 tabular-nums">
                  {activeAccreditationContour.code}
                </span>
                <span className="font-medium text-slate-700">
                  {activeAccreditationContour.statusLabel}
                </span>
              </div>

              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                {activeAccreditationContour.title}
              </h3>

              <dl className="divide-y divide-slate-200 text-xs sm:text-sm">
                <div className="py-2.5 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                  <dt className="text-slate-500 font-medium">Уполномоченный орган</dt>
                  <dd className="sm:col-span-2 text-slate-900 font-medium">
                    {activeAccreditationContour.authority}
                  </dd>
                </div>
                <div className="py-2.5 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                  <dt className="text-slate-500 font-medium">Нормативное основание</dt>
                  <dd className="sm:col-span-2 font-mono text-xs text-teal-800 tabular-nums">
                    {activeAccreditationContour.legalNorm}
                  </dd>
                </div>
                <div className="py-2.5 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                  <dt className="text-slate-500 font-medium">Область действия</dt>
                  <dd className="sm:col-span-2 text-slate-700 leading-relaxed">
                    {activeAccreditationContour.scope}
                  </dd>
                </div>
              </dl>

              <p className="text-xs text-slate-600 pt-2 border-t border-slate-200 leading-relaxed">
                {activeAccreditationContour.verificationNote}
              </p>
            </div>
          </div>

          {/* Right 5 cols: RF Statutory Compliance Matrix */}
          <div className="lg:col-span-5 space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-700">
                Соответствие требованиям законодательства РФ
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Оператор обучения: ВВГУ · Оператор реестра: Минэкономразвития РФ
              </p>
            </div>

            <div className="divide-y divide-slate-200 border-y border-slate-200">
              {CENTER_ACCREDITATION_STATUS.complianceChecklist.map((item) => (
                <div key={item.id} className="py-3.5 space-y-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-xs font-semibold text-slate-900 leading-snug">
                      {item.requirement}
                    </p>
                    <span className="text-[11px] font-mono text-teal-800 tabular-nums whitespace-nowrap shrink-0">
                      {item.normRef}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.implementation}</p>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Актуальный перечень образовательных программ ДПО и графики аттестационных сессий
              подтверждаются официальным порталом{' '}
              <span className="font-mono text-slate-700">rca-vostok.ru</span> и вносимыми записями
              в Единый федеральный реестр.
            </p>
          </div>
        </div>
      </section>

      {/* Accreditation & Licensing Status Registry Table */}
      <AccreditationRegistryTable />

      {/* Yearly Licensing & Accreditation Renewal Dynamics (Recharts LineChart) */}
      <AccreditationRenewalLineChart />

      {/* Visual Comparison: Demand vs Registry & Interregional Results */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-8 space-y-5">
          <div>
            <p className="text-xs font-medium text-teal-700">Сопоставление масштабов</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Расчётная потребность против реестра (Приморский край)
            </h2>
          </div>

          <div className="space-y-4 pt-2">
            {[
              { label: 'Базовая модель потребности (P_org = 30%)', value: 2390, max: 2500, color: 'bg-slate-900', textColor: 'text-slate-900' },
              { label: 'Консервативный сценарий (P_org = 15–20%)', value: 1400, max: 2500, color: 'bg-teal-700', textColor: 'text-teal-800' },
              { label: 'Реестр Приморского края (февр. 2025 г.)', value: 122, max: 2500, color: 'bg-red-700', textColor: 'text-red-700' },
              { label: 'Обучено на базе ВВГУ за учебный год', value: 52, max: 2500, color: 'bg-amber-600', textColor: 'text-amber-700' },
              { label: 'Аттестовано в окт. 2026 г. (Приморье: 15 чел.)', value: 26, max: 2500, color: 'bg-slate-400', textColor: 'text-slate-700' },
            ].map((bar) => (
              <div key={bar.label} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-4 text-xs">
                  <span className="font-medium text-slate-700">{bar.label}</span>
                  <span className={`font-mono font-semibold tabular-nums shrink-0 ${bar.textColor}`}>
                    {bar.value.toLocaleString('ru-RU')} чел.
                  </span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-sm overflow-hidden">
                  <div
                    className={`h-full ${bar.color} rounded-sm`}
                    style={{ width: `${Math.max((bar.value / bar.max) * 100, 1.5)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-500 pt-2 border-t border-slate-200 leading-relaxed">
            Даже по верхней границе открытых данных (120–130 специалистов в реестре) обеспеченность
            аттестованными кадрами в Приморье более чем на порядок ниже расчётной потребности (1 200–2 390 чел.).
          </p>
        </div>

        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-8 space-y-5">
          <div>
            <p className="text-xs font-medium text-teal-700">Межрегиональный срез ДФО</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Регионы Дальнего Востока и итоги сессии окт. 2026 г.
            </h2>
          </div>

          <div className="divide-y divide-slate-200 text-sm">
            <div className="py-3 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-slate-900">Приморский край</p>
                <p className="text-xs text-slate-500">4,07 млн поездок · 20% активный туризм · лидер по объёму</p>
              </div>
              <div className="text-right font-mono tabular-nums shrink-0">
                <p className="text-sm font-semibold text-slate-900">122 в реестре</p>
                <p className="text-xs text-teal-700">+15 окт. 2026</p>
              </div>
            </div>

            <div className="py-3 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-slate-900">Камчатский край (контрольная точка)</p>
                <p className="text-xs text-slate-500">88% летних групп организованы · запись на переаттестацию-2026: 9 чел.</p>
              </div>
              <div className="text-right font-mono tabular-nums shrink-0">
                <p className="text-sm font-semibold text-slate-900">343 в реестре</p>
                <p className="text-xs text-amber-700">&gt; 80 аттест. / +2 окт.</p>
              </div>
            </div>

            <div className="py-3 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-slate-900">Хабаровский край</p>
                <p className="text-xs text-slate-500">Высокий отложенный спрос · выездная аттестация в РЦА Приморья</p>
              </div>
              <div className="text-right font-mono tabular-nums shrink-0">
                <p className="text-sm font-semibold text-slate-900">33 в реестре</p>
                <p className="text-xs text-teal-700">+9 окт. 2026</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700 leading-relaxed">
            Поскольку федеральная аттестация действует на всей территории РФ, ВВГУ и РЦА «Русский Восток» уже
            фактически выполняют роль межрегиональной площадки ДФО: треть аттестованных в октябре 2026 г. (11 из 26)
            прибыли из Хабаровского края и Камчатки.
          </div>
        </div>
      </section>

      {/* Compact Interactive DFO Map with Hover Registry & Session Info */}
      <DfoOverviewHoverMap onOpenMarket={() => onNavigate('market')} />

      {/* Interactive DFO Map: Regional Training Office Contacts */}
      <DfoRegionalOfficesMap
        onContactCurator={openCuratorModal}
        onApplyForSession={handleApplyForSession}
      />

      {/* Interactive DFO Attestation Points & Expert Groups Modal Widget */}
      <DfoAttestationPointsWidget onContactCurator={openCuratorModal} />

      {/* Interactive Regional Sessions & Deadlines Timeline */}
      <RegionalSessionsTimeline
        onApplyForSession={handleApplyForSession}
        onContactCurator={openCuratorModal}
      />

      {/* Interactive Calendar of Upcoming Attestation Sessions & Webinars */}
      <AttestationEventsCalendarWidget
        onApplyForSession={handleApplyForSession}
        onContactCurator={openCuratorModal}
      />

      {/* Horizontal Attestation Development Timeline 2025-2030 */}
      <section aria-labelledby="timeline-2030-heading" className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-teal-700">Дорожная карта регулятора и ВВГУ</p>
            <h2 id="timeline-2030-heading" className="text-xl font-bold text-slate-900">
              Этапы развития аттестации 2025-2030
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500 tabular-nums mr-1">
              {String(timelineIndex + 1).padStart(2, '0')} /{' '}
              {String(ATTESTATION_TIMELINE_2025_2030.length).padStart(2, '0')}
            </span>
            <button
              type="button"
              disabled={timelineIndex === 0}
              onClick={() => handleSelectTimeline(timelineIndex - 1)}
              aria-label="Предыдущий этап таймлайна"
              className="p-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={timelineIndex === ATTESTATION_TIMELINE_2025_2030.length - 1}
              onClick={() => handleSelectTimeline(timelineIndex + 1)}
              aria-label="Следующий этап таймлайна"
              className="p-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Horizontal Visual Timeline Ribbon */}
        <div className="overflow-x-auto pb-2 -mx-2 px-2">
          <div className="min-w-[820px] relative pt-2">
            {/* Continuous horizontal axis rail */}
            <div
              aria-hidden="true"
              className="absolute left-[8%] right-[8%] top-[25px] h-0.5 bg-slate-200"
            >
              <div
                className="h-full w-full bg-teal-700 origin-left transition-transform duration-200"
                style={{
                  transform: `scaleX(${
                    timelineIndex / Math.max(ATTESTATION_TIMELINE_2025_2030.length - 1, 1)
                  })`,
                }}
              />
            </div>

            <ol className="grid grid-cols-6 gap-3 relative">
              {ATTESTATION_TIMELINE_2025_2030.map((milestone, idx) => {
                const isSelected = idx === timelineIndex;
                const isPassed = idx < timelineIndex;
                return (
                  <li key={milestone.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectTimeline(idx)}
                      aria-current={isSelected ? 'step' : undefined}
                      className="w-full text-center flex flex-col items-center gap-2.5 px-2 py-1 rounded-lg group cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                    >
                      <span
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-mono font-bold tabular-nums border-2 transition-colors ${
                          isSelected
                            ? 'bg-teal-700 border-teal-700 text-white'
                            : isPassed
                            ? 'bg-slate-900 border-slate-900 text-white'
                            : 'bg-white border-slate-300 text-slate-600 group-hover:border-teal-700 group-hover:text-teal-800'
                        }`}
                      >
                        0{idx + 1}
                      </span>

                      <div className="space-y-0.5">
                        <p
                          className={`text-xs font-mono font-semibold tabular-nums whitespace-nowrap ${
                            isSelected ? 'text-teal-800' : 'text-slate-900'
                          }`}
                        >
                          {milestone.period}
                        </p>
                        <p className="text-[11px] text-slate-500 leading-snug">
                          {milestone.phase}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        {/* Selected Milestone Detail Band */}
        <div className="pt-6 border-t border-slate-200 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono font-semibold text-teal-800 tabular-nums">
                {activeMilestone.period}
              </span>
              <span aria-hidden="true">·</span>
              <span>{activeMilestone.phase}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-slate-700">
                {activeMilestone.checkpointMetric}
              </span>
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              {activeMilestone.title}
            </h3>

            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
              {activeMilestone.summary}
            </p>
          </div>

          <div className="lg:col-span-5 bg-slate-50 rounded-lg p-5 space-y-3">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Контрольные точки этапа
            </p>
            <ul className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
              {activeMilestone.keyTasks.map((task, tIdx) => (
                <li key={task} className="flex items-start gap-2.5">
                  <span className="font-mono font-semibold text-teal-700 tabular-nums shrink-0">
                    0{tIdx + 1}.
                  </span>
                  <span>{task}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Full Empirical Table */}
      <section className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-teal-700">Верифицированная база данных</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Сводная эмпирическая таблица исследования
            </h2>
          </div>

          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setTableFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                tableFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Все показатели ({EMPIRICAL_TABLE.length})
            </button>
            <button
              type="button"
              onClick={() => setTableFilter('core')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                tableFilter === 'core'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ключевые для модели (4)
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                <th className="py-3 pr-4">Показатель</th>
                <th className="py-3 px-4 whitespace-nowrap">Значение</th>
                <th className="py-3 px-4">Методический комментарий</th>
                <th className="py-3 pl-4 whitespace-nowrap">Источник</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {visibleRows.map((row) => (
                <tr key={row.id} className={row.highlight ? 'bg-slate-50/70' : 'hover:bg-slate-50/50'}>
                  <td className="py-3.5 pr-4 font-medium text-slate-900">{row.indicator}</td>
                  <td className="py-3.5 px-4 font-mono font-semibold text-teal-800 tabular-nums whitespace-nowrap">
                    {row.value}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-600 leading-relaxed">{row.note}</td>
                  <td className="py-3.5 pl-4 text-xs text-slate-500 whitespace-nowrap">{row.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Expert Reviews Carousel */}
      <section aria-labelledby="experts-heading" className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-teal-700">Позиция отрасли и комиссии</p>
            <h2 id="experts-heading" className="text-xl font-bold text-slate-900">
              Отзывы экспертов о необходимости аттестации в ДФО
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500 tabular-nums mr-1">
              {String(expertIndex + 1).padStart(2, '0')} / {String(EXPERT_TESTIMONIALS.length).padStart(2, '0')}
            </span>
            <button
              type="button"
              onClick={() => handleSelectExpert(expertIndex - 1)}
              aria-label="Предыдущий отзыв эксперта"
              className="p-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => handleSelectExpert(expertIndex + 1)}
              aria-label="Следующий отзыв эксперта"
              className="p-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="border-y border-slate-200 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-4">
            <Quote className="w-6 h-6 text-teal-700/60" aria-hidden="true" />
            <blockquote className="font-serif text-lg sm:text-xl text-slate-900 leading-relaxed">
              «{activeExpert.quote}»
            </blockquote>
          </div>

          <div className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-900">{activeExpert.author}</p>
              <p className="text-xs text-slate-600 leading-snug">{activeExpert.role}</p>
              <p className="text-xs font-medium text-teal-800 pt-1">
                {activeExpert.organization} · {activeExpert.region}
              </p>
            </div>
            <div className="pt-3 border-t border-slate-200 space-y-1">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Практический результат
              </p>
              <p className="text-xs text-slate-800 leading-relaxed">{activeExpert.outcome}</p>
            </div>
          </div>
        </div>

        {/* Direct Expert Selector Strip */}
        <div className="flex flex-wrap items-center gap-2">
          {EXPERT_TESTIMONIALS.map((item, idx) => {
            const isSelected = idx === expertIndex;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectExpert(idx)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                0{idx + 1}. {item.author}
              </button>
            );
          })}
        </div>
      </section>

      {/* Industry News Chronological Feed */}
      <section aria-labelledby="industry-news-heading" className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-teal-700">Хроника аттестации и рынка ДФО</p>
            <h2 id="industry-news-heading" className="text-xl font-bold text-slate-900">
              Новости индустрии
            </h2>
          </div>

          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'all', label: `Все события (${INDUSTRY_NEWS.length})` },
                { id: 'rca', label: 'Сессии РЦА и ВВГУ' },
                { id: 'regulation', label: 'Нормативная база' },
                { id: 'market', label: 'Рынок ДФО' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setNewsCategory(tab.id);
                  tracker.trackCustomInteraction(`Фильтр новостей: ${tab.label}`);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  newsCategory === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <ol className="divide-y divide-slate-200 border-t border-slate-200">
          {filteredNews.map((item) => {
            const isExpanded = expandedNewsIds.includes(item.id);
            return (
              <li key={item.id} className="py-5 first:pt-5 last:pb-1">
                <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-8">
                  <div className="md:w-44 shrink-0 space-y-1 pt-0.5">
                    <time
                      dateTime={item.isoDate}
                      className="block text-sm font-mono font-semibold text-slate-900 tabular-nums"
                    >
                      {item.date}
                    </time>
                    <p className="text-xs text-teal-700 font-medium">{item.categoryLabel}</p>
                  </div>

                  <div className="flex-1 space-y-2.5">
                    <h3 className="text-base font-semibold text-slate-900 leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
                      {item.summary}
                    </p>

                    {isExpanded && (
                      <div className="pt-2.5 border-t border-slate-100 max-w-3xl">
                        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                          {item.details}
                        </p>
                      </div>
                    )}

                    <div className="pt-1 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <span className="text-slate-500">
                        Источник: {item.source}
                      </span>
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() => toggleNewsDetails(item.id, item.title)}
                        className="font-medium text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                      >
                        <span>{isExpanded ? 'Свернуть контекст' : 'Подробнее о событии'}</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Interactive Glossary of Terms */}
      <section
        aria-labelledby="glossary-heading"
        className="bg-white border border-slate-200 rounded-xl p-8 space-y-6"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-teal-700">Терминологический справочник</p>
            <h2 id="glossary-heading" className="text-xl font-bold text-slate-900 inline-flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-teal-700 shrink-0" aria-hidden="true" />
              <span>Глоссарий терминов</span>
            </h2>
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

        {/* Contextual editorial prose with hover/focus inline glossary tooltips */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 space-y-3">
          <p className="text-xs font-medium text-slate-500">
            Наведите курсор на выделенное понятие (или сфокусируйтесь с клавиатуры), чтобы открыть всплывающее определение
          </p>
          <p className="text-sm sm:text-base text-slate-800 leading-relaxed max-w-4xl">
            В соответствии с действующим законодательством РФ, каждый{' '}
            <GlossaryTooltipTerm
              termItem={glossaryById['term-instructor-guide']}
              displayText="инструктор-проводник"
              isPinned={pinnedGlossaryId === 'term-instructor-guide'}
              onPinToggle={handleToggleGlossaryPin}
            />
            , сопровождающий туристические группы на активных маршрутах, обязан пройти государственную{' '}
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

        {/* Interactive Glossary Index Grid (hover/focus tooltip per term card) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGlossary.map((item) => {
            const isActive = hoveredGlossaryId === item.id || pinnedGlossaryId === item.id;
            return (
              <div
                key={item.id}
                className="relative"
                onMouseEnter={() => setHoveredGlossaryId(item.id)}
                onMouseLeave={() =>
                  setHoveredGlossaryId((prev) => (prev === item.id ? null : prev))
                }
              >
                <button
                  type="button"
                  onClick={() => handleToggleGlossaryPin(item)}
                  onFocus={() => setHoveredGlossaryId(item.id)}
                  onBlur={() =>
                    setHoveredGlossaryId((prev) => (prev === item.id ? null : prev))
                  }
                  aria-describedby={`glossary-card-tip-${item.id}`}
                  aria-expanded={isActive}
                  className={`w-full text-left p-4 rounded-lg border transition-colors cursor-help focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                    isActive
                      ? 'bg-slate-50 border-teal-700'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2 text-[11px] text-slate-500">
                    <span className="font-medium text-teal-800">{item.categoryLabel}</span>
                    <span className="font-mono tabular-nums">{item.shortTag}</span>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold text-slate-900 border-b border-dotted border-slate-400 inline-block">
                    {item.term}
                  </p>
                  <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {item.definition}
                  </p>
                </button>

                {/* Floating Definition Tooltip */}
                <div
                  id={`glossary-card-tip-${item.id}`}
                  role="tooltip"
                  className={`absolute z-30 bottom-full left-0 right-0 mb-2 p-4 rounded-lg bg-slate-900 text-white shadow-lg border border-slate-700 transition-[opacity,transform] duration-150 ${
                    isActive
                      ? 'opacity-100 translate-y-0 pointer-events-auto'
                      : 'opacity-0 translate-y-1 pointer-events-none'
                  }`}
                >
                  <p className="text-[11px] font-mono text-teal-300 tabular-nums">
                    {item.categoryLabel} · {item.shortTag}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">{item.term}</p>
                  <p className="mt-1.5 text-xs text-slate-200 leading-relaxed">
                    {item.definition}
                  </p>
                  <p className="mt-2 pt-2 border-t border-slate-700/80 text-[11px] text-slate-300 leading-snug">
                    {item.contextNote}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Knowledge Base with Searchable FAQ Accordion */}
      <KnowledgeBaseFaq onContactCurator={openCuratorModal} />

      {/* Instructor Feedback & Certification Updates Form */}
      <section
        id="inquiry-section"
        aria-labelledby="inquiry-heading"
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch scroll-mt-24"
      >
        <div className="lg:col-span-5 bg-slate-900 text-white rounded-xl p-8 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <p className="text-xs font-medium text-teal-300">Обратная связь для соискателей</p>
            <h2 id="inquiry-heading" className="text-2xl font-bold leading-snug text-balance">
              Получать уведомления о датах аттестации и наборе групп ВВГУ
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Оставьте контакты, чтобы своевременно получать расписание ближайших экзаменационных
              сессий РЦА «Русский Восток», информацию о старте потоков по водному и автомобильному
              туризму и обновлении перечня вопросов.
            </p>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-700 text-xs text-slate-300">
            <p>· Приглашения на очные и выездные сессии в Приморском крае</p>
            <p>· Разъяснения по зачёту походного опыта (Контур А для действующих гидов)</p>
            <p>· Информация об условиях субсидирования обучения для туроператоров (до 70%)</p>
            {totalSubscriptions !== null && (
              <p className="pt-2 text-teal-300 font-mono tabular-nums">
                Заявок в журнале оповещений: {totalSubscriptions}
              </p>
            )}
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-8">
          {formSuccess ? (
            <div className="h-full flex flex-col justify-center items-start gap-4 py-6">
              <div className="inline-flex items-center gap-2 text-teal-700 font-semibold text-sm">
                <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                <span>Контактные данные сохранены</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                Вы добавлены в список оповещений РЦА «Русский Восток»
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed max-w-xl">
                Мы уведомим вас о ближайших датах теоретического тестирования, полевых испытаний
                и открытии целевого набора в ВВГУ. Идентификатор обращения:{' '}
                <span className="font-mono text-slate-800">{formSuccess.id}</span>.
              </p>
              <button
                type="button"
                onClick={() => setFormSuccess(null)}
                className="mt-2 px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Отправить ещё одну заявку
              </button>
            </div>
          ) : (
            <form onSubmit={handleInquirySubmit} noValidate className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="inq-fullname" className="block text-xs font-semibold text-slate-700">
                    ФИО или имя <span className="text-red-700">*</span>
                  </label>
                  <input
                    id="inq-fullname"
                    name="fullName"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Например, Алексей Смирнов"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="inq-email" className="block text-xs font-semibold text-slate-700">
                    Электронная почта <span className="text-red-700">*</span>
                  </label>
                  <input
                    id="inq-email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="guide@example.ru"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                    placeholder="+7 999 ... или @nick"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="inq-region" className="block text-xs font-semibold text-slate-700">
                    Регион ДФО
                  </label>
                  <select
                    id="inq-region"
                    name="region"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                  >
                    <option value="Приморский край">Приморский край</option>
                    <option value="Хабаровский край">Хабаровский край</option>
                    <option value="Камчатский край">Камчатский край</option>
                    <option value="Сахалинская область">Сахалинская область</option>
                    <option value="Другой регион ДФО">Другой регион ДФО</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="inq-track" className="block text-xs font-semibold text-slate-700">
                    Направление
                  </label>
                  <select
                    id="inq-track"
                    name="track"
                    value={track}
                    onChange={(e) => setTrack(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                  >
                    <option value="Пешеходный туризм">Пешеходный туризм</option>
                    <option value="Водный туризм и сплавы">Водный туризм и сплавы</option>
                    <option value="Автомобильный туризм">Автомобильный туризм</option>
                    <option value="Переаттестация действующего гида">Переаттестация действующего гида</option>
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
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 resize-y"
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
                  Согласен получать информационные обновления о сроках аттестации, расписании экзаменов
                  РЦА «Русский Восток» и наборе на программы переподготовки ВВГУ.
                </label>
              </div>

              {formError && (
                <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                  {formError}
                </div>
              )}

              <div className="pt-1 flex flex-wrap items-center justify-between gap-4">
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2.5 bg-teal-700 text-white text-sm font-semibold rounded-lg hover:bg-teal-800 disabled:opacity-50 inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                  <span>{formSubmitting ? 'Отправка…' : 'Подписаться на обновления'}</span>
                </button>
                <span className="text-[11px] text-slate-500">
                  Контактные данные сохраняются на сервере и не публикуются в открытом доступе
                </span>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* General Platform Feedback Form */}
      <PlatformFeedbackForm onOpenCuratorModal={openCuratorModal} />

      {/* Curator Consultation Modal */}
      {curatorModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setCuratorModalOpen(false);
            }
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
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {curatorSuccess ? (
                <div className="py-6 space-y-4">
                  <div className="inline-flex items-center gap-2 text-teal-700 font-semibold text-sm">
                    <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                    <span>Запрос на консультацию отправлен</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Обращение зарегистрировано в журнале РЦА
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Тема: <span className="font-medium text-slate-900">{curatorSuccess.topic}</span>.
                    Куратор свяжется с вами по указанной электронной почте или контактному каналу.
                    Номер обращения:{' '}
                    <span className="font-mono text-slate-900">{curatorSuccess.id}</span>.
                  </p>
                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCuratorSuccess(null)}
                      className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Задать ещё вопрос
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCuratorSuccess(null);
                        setCuratorModalOpen(false);
                      }}
                      className="px-4 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Закрыть окно
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCuratorSubmit} noValidate className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="cur-name" className="block text-xs font-semibold text-slate-700">
                        ФИО или имя <span className="text-red-700">*</span>
                      </label>
                      <input
                        id="cur-name"
                        type="text"
                        required
                        value={curatorName}
                        onChange={(e) => setCuratorName(e.target.value)}
                        placeholder="Например, Мария Соколова"
                        className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="cur-email" className="block text-xs font-semibold text-slate-700">
                        Электронная почта <span className="text-red-700">*</span>
                      </label>
                      <input
                        id="cur-email"
                        type="email"
                        required
                        value={curatorEmail}
                        onChange={(e) => setCuratorEmail(e.target.value)}
                        placeholder="guide@example.ru"
                        className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="cur-contact" className="block text-xs font-semibold text-slate-700">
                        Телефон или Telegram
                      </label>
                      <input
                        id="cur-contact"
                        type="text"
                        value={curatorContact}
                        onChange={(e) => setCuratorContact(e.target.value)}
                        placeholder="+7 999 ... или @nick"
                        className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="cur-region" className="block text-xs font-semibold text-slate-700">
                        Регион ДФО
                      </label>
                      <select
                        id="cur-region"
                        value={curatorRegion}
                        onChange={(e) => setCuratorRegion(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                      >
                        <option value="Приморский край">Приморский край</option>
                        <option value="Хабаровский край">Хабаровский край</option>
                        <option value="Камчатский край">Камчатский край</option>
                        <option value="Сахалинская область">Сахалинская область</option>
                        <option value="Другой регион ДФО">Другой регион ДФО</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="cur-topic" className="block text-xs font-semibold text-slate-700">
                      Тема консультации
                    </label>
                    <select
                      id="cur-topic"
                      value={curatorTopic}
                      onChange={(e) => setCuratorTopic(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                    >
                      <option value="Допуск и перечень документов">Допуск и перечень документов</option>
                      <option value="Зачёт походного стажа (Контур А)">Зачёт походного стажа (Контур А)</option>
                      <option value="Теория и защита паспорта маршрута">Теория и защита паспорта маршрута</option>
                      <option value="Полевые испытания в Шкотовском районе">Полевые испытания в Шкотовском районе</option>
                      <option value="Договорное обучение и субсидии 70%">Договорное обучение и субсидии 70%</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="cur-question" className="block text-xs font-semibold text-slate-700">
                      Суть вопроса куратору <span className="text-red-700">*</span>
                    </label>
                    <textarea
                      id="cur-question"
                      rows={3}
                      required
                      value={curatorQuestion}
                      onChange={(e) => setCuratorQuestion(e.target.value)}
                      placeholder="Опишите ваш маршрут, категорию сложности или вопрос по расписанию ближайшей аттестационной сессии"
                      className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 resize-y"
                    />
                  </div>

                  <div className="flex items-start gap-2.5">
                    <input
                      id="cur-consent"
                      type="checkbox"
                      checked={curatorConsent}
                      onChange={(e) => setCuratorConsent(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-teal-700 rounded cursor-pointer"
                    />
                    <label htmlFor="cur-consent" className="text-xs text-slate-600 leading-relaxed cursor-pointer">
                      Согласен на обработку обращения и направление ответа куратором РЦА «Русский Восток».
                    </label>
                  </div>

                  {curatorError && (
                    <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                      {curatorError}
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setCuratorModalOpen(false)}
                      className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      disabled={curatorSubmitting}
                      className="px-5 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 disabled:opacity-50 inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                    >
                      <Send className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{curatorSubmitting ? 'Отправка…' : 'Отправить запрос куратору'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
