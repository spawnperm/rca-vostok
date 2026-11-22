import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  ExternalLink,
  Quote,
  Send,
} from 'lucide-react';
import {
  ATTESTATION_FAQ,
  ATTESTATION_TIMELINE_2025_2030,
  EMPIRICAL_TABLE,
  EXPERT_TESTIMONIALS,
  HERO_IMAGE,
  INDUSTRY_NEWS,
  RCA_PROFILE,
} from '../data/researchData';
import { tracker } from '../utils/tracker';

interface OverviewSectionProps {
  onNavigate: (tab: 'calculator' | 'market' | 'dissertation' | 'presentations') => void;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({ onNavigate }) => {
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [tableFilter, setTableFilter] = useState<'all' | 'core'>('all');
  const [faqCategory, setFaqCategory] = useState<'all' | 'procedure' | 'training' | 'region'>('all');
  const [openFaqIds, setOpenFaqIds] = useState<string[]>([ATTESTATION_FAQ[0].id]);
  const [expertIndex, setExpertIndex] = useState<number>(0);
  const [timelineIndex, setTimelineIndex] = useState<number>(2); // Default to active 2026-2027 stage
  const [newsCategory, setNewsCategory] = useState<'all' | 'regulation' | 'rca' | 'market'>('all');
  const [expandedNewsIds, setExpandedNewsIds] = useState<string[]>([INDUSTRY_NEWS[0].id]);

  const activeExpert = EXPERT_TESTIMONIALS[expertIndex] ?? EXPERT_TESTIMONIALS[0];
  const activeMilestone =
    ATTESTATION_TIMELINE_2025_2030[timelineIndex] ?? ATTESTATION_TIMELINE_2025_2030[0];

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

  const filteredFaq =
    faqCategory === 'all'
      ? ATTESTATION_FAQ
      : ATTESTATION_FAQ.filter((item) => item.category === faqCategory);

  const toggleFaq = (id: string, question: string) => {
    setOpenFaqIds((prev) => {
      const exists = prev.includes(id);
      if (!exists) {
        tracker.trackCustomInteraction(`FAQ раскрыт: ${question.slice(0, 60)}`);
      }
      return exists ? prev.filter((item) => item !== id) : [...prev, id];
    });
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

      {/* Frequently Asked Questions (FAQ) on Certification Procedure */}
      <section aria-labelledby="faq-heading" className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-teal-700">Ответы для соискателей</p>
            <h2 id="faq-heading" className="text-xl font-bold text-slate-900">
              Часто задаваемые вопросы о процедуре аттестации
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'all', label: `Все (${ATTESTATION_FAQ.length})` },
                  { id: 'procedure', label: 'Процедура и сроки' },
                  { id: 'training', label: 'Обучение и стоимость' },
                  { id: 'region', label: 'Требования ДФО' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setFaqCategory(cat.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    faqCategory === cat.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                const allVisibleIds = filteredFaq.map((f) => f.id);
                const allOpen = allVisibleIds.every((id) => openFaqIds.includes(id));
                setOpenFaqIds(allOpen ? [] : allVisibleIds);
              }}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {filteredFaq.every((f) => openFaqIds.includes(f.id)) ? 'Свернуть все' : 'Раскрыть все'}
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-200 border-t border-slate-200">
          {filteredFaq.map((item) => {
            const isOpen = openFaqIds.includes(item.id);
            return (
              <div key={item.id} className="py-4">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => toggleFaq(item.id, item.question)}
                  className="w-full text-left flex items-start justify-between gap-4 py-1 cursor-pointer group focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
                >
                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-teal-700">
                      {item.categoryLabel}
                    </span>
                    <h3 className="text-sm sm:text-base font-semibold text-slate-900 group-hover:text-teal-800 transition-colors">
                      {item.question}
                    </h3>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 mt-1 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-teal-700' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {isOpen && (
                  <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-4xl">
                    {item.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Instructor Feedback & Certification Updates Form */}
      <section aria-labelledby="inquiry-heading" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
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
    </div>
  );
};
