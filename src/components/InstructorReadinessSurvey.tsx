import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  RotateCcw,
  Send,
} from 'lucide-react';
import { tracker } from '../utils/tracker';

export interface ReadinessSurveyStats {
  totalResponses: number;
  averageReadinessPct: number;
  byRegion: { region: string; count: number }[];
  byFormat: { format: string; count: number }[];
  topBarriers: { barrier: string; count: number }[];
  updatedAt: string;
}

const DFO_REGIONS = [
  'Приморский край',
  'Хабаровский край',
  'Камчатский край',
  'Сахалинская область',
  'Амурская область',
  'Республика Саха (Якутия)',
  'Магаданская область / Чукотский АО',
] as const;

const TRACK_OPTIONS = [
  'Пешеходный туризм',
  'Водный туризм и сплавы',
  'Горный / экспедиционный туризм',
  'Автомобильный туризм',
  'Переаттестация действующего гида',
] as const;

const EXPERIENCE_OPTIONS = [
  'До 1 года',
  '1–3 года',
  '3–5 лет',
  'Более 5 лет',
] as const;

const FORMAT_OPTIONS = [
  'Контур А (зачёт стажа практиков)',
  'Переподготовка ДПО ВВГУ + экзамен',
  'Плановая переаттестация (5 лет)',
] as const;

const TIMEFRAME_OPTIONS = [
  'Ближайшая сессия (зима 2026 / весна 2027)',
  'Лето–осень 2027',
  'В процессе подготовки документов',
] as const;

const BARRIER_OPTIONS = [
  'Оформление паспорта маршрута (ПП № 760)',
  'Подтверждение стажа без справок МКК',
  'Полевые испытания (переправы, WFA, ПСР)',
  'Стоимость обучения и поиск субсидии',
  'Барьеров нет — готов к экзамену',
] as const;

const DOCUMENT_CHECKLIST: readonly { id: string; label: string }[] = [
  { id: 'medical', label: 'Медицинская справка-допуск' },
  { id: 'experience_proof', label: 'Подтверждение стажа (маршрутные книжки / договоры)' },
  { id: 'route_passport', label: 'Проект паспорта маршрута (ПП № 760)' },
  { id: 'education_dpo', label: 'Диплом об образовании или ДПО ВВГУ' },
  { id: 'wfa_gear', label: 'Личное снаряжение и навыки первой помощи (WFA)' },
];

interface InstructorReadinessSurveyProps {
  onApplyForSession: (regionName: string, trackName: string) => void;
  onContactCurator: (sourceLabel: string) => void;
}

export const InstructorReadinessSurvey: React.FC<InstructorReadinessSurveyProps> = ({
  onApplyForSession,
  onContactCurator,
}) => {
  const [region, setRegion] = useState<string>(DFO_REGIONS[0]);
  const [track, setTrack] = useState<string>(TRACK_OPTIONS[0]);
  const [experienceRange, setExperienceRange] = useState<string>(EXPERIENCE_OPTIONS[2]);
  const [preferredFormat, setPreferredFormat] = useState<string>(FORMAT_OPTIONS[0]);
  const [plannedTimeframe, setPlannedTimeframe] = useState<string>(TIMEFRAME_OPTIONS[0]);
  const [mainBarrier, setMainBarrier] = useState<string>(BARRIER_OPTIONS[0]);
  const [readyDocs, setReadyDocs] = useState<string[]>(['medical', 'wfa_gear']);
  const [respondentName, setRespondentName] = useState<string>('');
  const [comment, setComment] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedResult, setSubmittedResult] = useState<{
    id: string;
    readinessPct: number;
  } | null>(null);
  const [stats, setStats] = useState<ReadinessSurveyStats | null>(null);

  const loadStats = () => {
    fetch('/api/readiness-survey/stats', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ReadinessSurveyStats | null) => {
        if (data && typeof data.totalResponses === 'number') {
          setStats(data);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadStats();
    const timer = window.setInterval(loadStats, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const currentReadinessPct = useMemo(
    () => Math.round((readyDocs.length / DOCUMENT_CHECKLIST.length) * 100),
    [readyDocs]
  );

  const liveReadinessLabel = useMemo(() => {
    if (currentReadinessPct >= 80) return 'Готов к подаче документов';
    if (currentReadinessPct >= 40) return 'Частичная готовность';
    return 'Требуется сбор комплекта';
  }, [currentReadinessPct]);

  const toggleDoc = (id: string) => {
    setReadyDocs((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/readiness-survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region,
          track,
          experienceRange,
          preferredFormat,
          plannedTimeframe,
          mainBarrier,
          readyDocs,
          respondentName: respondentName.trim(),
          comment: comment.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        id?: string;
        readinessPct?: number;
        stats?: ReadinessSurveyStats;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Не удалось сохранить анкету готовности.');
      }

      setSubmittedResult({
        id: data.id || 'survey',
        readinessPct: data.readinessPct ?? currentReadinessPct,
      });
      if (data.stats) {
        setStats(data.stats);
      } else {
        loadStats();
      }
      tracker.trackCustomInteraction(
        `Анкета готовности отправлена (${region})`,
        `${data.readinessPct ?? currentReadinessPct}%`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки анкеты.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmittedResult(null);
    setError(null);
    setComment('');
  };

  return (
    <section
      id="overview-readiness-survey"
      aria-labelledby="readiness-survey-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Мониторинг кадровой готовности ДФО</span>
          </p>
          <h2 id="readiness-survey-heading" className="text-xl font-bold text-slate-900 text-balance">
            Опрос-анкета готовности инструктора к прохождению аттестации
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Заполните короткую анкету, чтобы оценить личную готовность комплекта документов и
            передать данные о потребности в проведении выездных и онлайн-сессий РЦА в вашем
            регионе.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0 font-mono tabular-nums">
          <div className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-right">
            <p className="text-[11px] text-slate-500">Собрано анкет</p>
            <p className="text-sm font-bold text-slate-900">
              {stats ? stats.totalResponses : '—'}
            </p>
          </div>
          <div className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-right">
            <p className="text-[11px] text-slate-500">Средняя готовность</p>
            <p className="text-sm font-bold text-teal-700">
              {stats && stats.totalResponses > 0 ? `${stats.averageReadinessPct}%` : `${currentReadinessPct}%`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Questionnaire Form (8 cols) */}
        <div className="lg:col-span-8">
          {submittedResult ? (
            <div className="bg-teal-50/60 border border-teal-200 rounded-xl p-6 space-y-4">
              <div className="inline-flex items-center gap-2 text-teal-800 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 text-teal-700" aria-hidden="true" />
                <span>Анкета сохранена · индекс готовности {submittedResult.readinessPct}%</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Спасибо! Ваши данные о готовности учтены в статистике РЦА
              </h3>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed max-w-2xl">
                Зафиксирован профиль: <span className="font-semibold">{region}</span> ·{' '}
                <span className="font-semibold">{track}</span> · формат{' '}
                <span className="font-semibold">{preferredFormat}</span>. Регистрационный код
                анкеты: <span className="font-mono text-slate-900">{submittedResult.id}</span>.
              </p>

              <div className="flex flex-wrap items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => onApplyForSession(region, track)}
                  className="px-4 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Записаться на ближайшую сессию</span>
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Заполнить ещё одну анкету</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="survey-region" className="block text-xs font-semibold text-slate-700">
                    1. Регион работы в ДФО
                  </label>
                  <select
                    id="survey-region"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                  >
                    {DFO_REGIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="survey-track" className="block text-xs font-semibold text-slate-700">
                    2. Основное направление
                  </label>
                  <select
                    id="survey-track"
                    value={track}
                    onChange={(e) => setTrack(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                  >
                    {TRACK_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="survey-exp" className="block text-xs font-semibold text-slate-700">
                    3. Стаж сопровождения групп
                  </label>
                  <select
                    id="survey-exp"
                    value={experienceRange}
                    onChange={(e) => setExperienceRange(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                  >
                    {EXPERIENCE_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-700">
                    4. Что уже подготовлено к аттестации?
                  </p>
                  <span className="text-xs font-mono text-teal-800 tabular-nums">
                    Готовность: {currentReadinessPct}% ({readyDocs.length}/{DOCUMENT_CHECKLIST.length})
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {DOCUMENT_CHECKLIST.map((doc) => {
                    const checked = readyDocs.includes(doc.id);
                    return (
                      <label
                        key={doc.id}
                        className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                          checked
                            ? 'bg-teal-50/60 border-teal-300 text-teal-950 font-medium'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDoc(doc.id)}
                          className="mt-0.5 w-4 h-4 accent-teal-700 rounded cursor-pointer shrink-0"
                        />
                        <span className="leading-snug">{doc.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="survey-format" className="block text-xs font-semibold text-slate-700">
                    5. Предпочтительный трек
                  </label>
                  <select
                    id="survey-format"
                    value={preferredFormat}
                    onChange={(e) => setPreferredFormat(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                  >
                    {FORMAT_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="survey-time" className="block text-xs font-semibold text-slate-700">
                    6. Планируемый срок сдачи
                  </label>
                  <select
                    id="survey-time"
                    value={plannedTimeframe}
                    onChange={(e) => setPlannedTimeframe(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                  >
                    {TIMEFRAME_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="survey-barrier" className="block text-xs font-semibold text-slate-700">
                    7. Главный барьер сейчас
                  </label>
                  <select
                    id="survey-barrier"
                    value={mainBarrier}
                    onChange={(e) => setMainBarrier(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                  >
                    {BARRIER_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="survey-name" className="block text-xs font-semibold text-slate-700">
                    Имя или организация (необязательно)
                  </label>
                  <input
                    id="survey-name"
                    type="text"
                    value={respondentName}
                    onChange={(e) => setRespondentName(e.target.value)}
                    placeholder="Например, Турклуб «Сихотэ-Алинь»"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="survey-comment" className="block text-xs font-semibold text-slate-700">
                    Пожелание по датам или формату (необязательно)
                  </label>
                  <input
                    id="survey-comment"
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Например, нужна выездная комиссия в Южно-Сахалинске"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700"
                  />
                </div>
              </div>

              {error && (
                <p role="alert" className="text-xs text-red-700 font-medium">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-teal-700 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-teal-800 disabled:opacity-50 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                  <span>{submitting ? 'Сохранение…' : 'Отправить анкету готовности'}</span>
                </button>
                <span className="text-[11px] text-slate-500">
                  Обезличенные сводные показатели учитываются при планировании сессий РЦА.
                </span>
              </div>
            </form>
          )}
        </div>

        {/* Right: Real-time Readiness & Collected Survey Summary Panel (4 cols) */}
        <aside className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-5">
          {/* Live Personal Readiness Gauge */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Ваша оценка сейчас
              </span>
              <span className="text-xs font-mono font-bold text-teal-800 tabular-nums">
                {currentReadinessPct}%
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Личная оценка готовности к аттестации в реальном времени"
              aria-valuenow={currentReadinessPct}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden"
            >
              <div
                className="h-full bg-teal-700 transition-all duration-300 rounded-full"
                style={{ width: `${currentReadinessPct}%` }}
              />
            </div>
            <p className="text-xs font-semibold text-slate-900">{liveReadinessLabel}</p>
            <p className="text-[11px] text-slate-500 leading-snug">
              {region} · {preferredFormat.split('(')[0].trim()}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-900">
                Сводка в реальном времени
              </p>
              {stats?.updatedAt && (
                <span className="text-[10px] font-mono text-teal-700">Live · 15с</span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Реальные ответы инструкторов обновляются автоматически после каждой отправки.
            </p>
          </div>

          {stats && stats.totalResponses > 0 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Распределение по регионам ДФО
                </p>
                <ul className="space-y-2 text-xs">
                  {stats.byRegion.slice(0, 4).map((item) => {
                    const pct = Math.round((item.count / stats.totalResponses) * 100);
                    return (
                      <li key={item.region} className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-700 truncate">{item.region}</span>
                          <span className="font-mono font-semibold text-slate-900 tabular-nums shrink-0">
                            {item.count} ({pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal-700 transition-all duration-300"
                            style={{ width: `${Math.max(pct, 4)}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {stats.byFormat.length > 0 && (
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Выбор образовательного трека
                  </p>
                  <ul className="space-y-2 text-xs">
                    {stats.byFormat.slice(0, 3).map((fmt) => {
                      const pct = Math.round((fmt.count / stats.totalResponses) * 100);
                      return (
                        <li key={fmt.format} className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-700 truncate">{fmt.format}</span>
                            <span className="font-mono font-semibold text-slate-900 tabular-nums shrink-0">
                              {pct}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-slate-800 transition-all duration-300"
                              style={{ width: `${Math.max(pct, 4)}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Частые барьеры подготовки
                </p>
                <ul className="space-y-2 text-xs">
                  {stats.topBarriers.slice(0, 3).map((b) => {
                    const pct = Math.round((b.count / stats.totalResponses) * 100);
                    return (
                      <li key={b.barrier} className="space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-slate-700 leading-snug">{b.barrier}</span>
                          <span className="font-mono font-semibold text-teal-800 tabular-nums shrink-0">
                            {b.count} ({pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-600 transition-all duration-300"
                            style={{ width: `${Math.max(pct, 4)}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          ) : (
            <div className="py-4 border-y border-slate-200 text-xs text-slate-600 leading-relaxed">
              Пока нет отправленных анкет в текущей базе — ваша анкета станет первой и сразу
              отобразится в региональной сводке.
            </div>
          )}

          <button
            type="button"
            onClick={() => onContactCurator('Опрос-анкета готовности к аттестации')}
            className="w-full px-3.5 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>Обсудить подготовку с куратором</span>
          </button>
        </aside>
      </div>
    </section>
  );
};
