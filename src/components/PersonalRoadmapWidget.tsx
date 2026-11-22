import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Circle,
  Clock,
  Compass,
} from 'lucide-react';
import type { SessionUser } from '../utils/identityApi';
import type { UserAttestationSummary } from './AttestationProgressWidget';
import {
  OFFICIAL_EXAM_OPTIONS,
  buildPersonalRoadmap,
  readStoredRoadmapPrefs,
  writeStoredRoadmapPrefs,
  type PreparationContour,
  type RoadmapMilestoneStatus,
} from '../utils/personalRoadmap';
import {
  buildScheduleSlotCalendarEvent,
  downloadCalendarIcs,
} from '../utils/attestationCalendar';
import { tracker } from '../utils/tracker';

interface PersonalRoadmapWidgetProps {
  user: SessionUser;
  summary: UserAttestationSummary;
  onExamDateChange?: (examDateIso: string) => void;
}

function formatOffsetLabel(offsetDays: number): string {
  if (offsetDays === 0) return 'День экзамена';
  if (offsetDays < 0) return `T − ${Math.abs(offsetDays)} дн.`;
  return `T + ${offsetDays} дн.`;
}

function getStatusVisual(status: RoadmapMilestoneStatus): {
  icon: React.ReactNode;
  badgeTextClass: string;
  rowBgClass: string;
} {
  switch (status) {
    case 'completed':
      return {
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />,
        badgeTextClass: 'text-emerald-700',
        rowBgClass: 'bg-emerald-50/30',
      };
    case 'active':
      return {
        icon: <Compass className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />,
        badgeTextClass: 'text-teal-800',
        rowBgClass: 'bg-teal-50/40',
      };
    case 'overdue':
      return {
        icon: <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />,
        badgeTextClass: 'text-amber-800',
        rowBgClass: 'bg-amber-50/40',
      };
    case 'upcoming':
      return {
        icon: <Circle className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />,
        badgeTextClass: 'text-slate-500',
        rowBgClass: 'bg-white',
      };
  }
}

export const PersonalRoadmapWidget: React.FC<PersonalRoadmapWidgetProps> = ({
  user,
  summary,
  onExamDateChange,
}) => {
  const [prefs, setPrefs] = useState(() => readStoredRoadmapPrefs(user.id));
  const [icsNotice, setIcsNotice] = useState<string | null>(null);

  useEffect(() => {
    const loaded = readStoredRoadmapPrefs(user.id);
    setPrefs(loaded);
    onExamDateChange?.(loaded.examDateIso);
  }, [user.id, onExamDateChange]);

  const plan = useMemo(
    () => buildPersonalRoadmap(prefs.examDateIso, prefs.contour, summary),
    [prefs.examDateIso, prefs.contour, summary]
  );

  const updateExamDate = (nextIso: string, sourceLabel: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextIso)) return;
    const next = { ...prefs, examDateIso: nextIso };
    setPrefs(next);
    writeStoredRoadmapPrefs(user.id, next);
    setIcsNotice(null);
    onExamDateChange?.(nextIso);
    tracker.trackCustomInteraction(
      'Выбор даты экзамена в дорожной карте',
      `${nextIso} (${sourceLabel})`
    );
  };

  const handleExportExamIcs = () => {
    const matchedSlot = OFFICIAL_EXAM_OPTIONS.find((opt) => opt.startIso === prefs.examDateIso);
    const ev = buildScheduleSlotCalendarEvent(
      {
        start: prefs.examDateIso,
        end: matchedSlot?.endIso ?? prefs.examDateIso,
        category: matchedSlot?.category ?? '1–4 КС',
        disciplines: ['пешеходный', 'водный', 'горный'],
      },
      0
    );
    const fileName = downloadCalendarIcs(ev, 1440);
    setIcsNotice(
      `Файл ${fileName} скачан (${plan.examDateFormatted}) — импортируйте его в Google или Яндекс Календарь.`
    );
    tracker.trackCustomInteraction('Дорожная карта · Добавить в календарь (.ics)', prefs.examDateIso);
  };

  const updateContour = (contour: PreparationContour) => {
    const next = { ...prefs, contour };
    setPrefs(next);
    writeStoredRoadmapPrefs(user.id, next);
    tracker.trackCustomInteraction(
      'Смена контура подготовки в дорожной карте',
      contour === 'contour_b' ? 'Контур Б (ДПО)' : 'Контур А (Стаж)'
    );
  };

  const daysText =
    plan.daysUntilExam > 0
      ? `${plan.daysUntilExam} дн.`
      : plan.daysUntilExam === 0
        ? 'Сегодня'
        : `прошло ${Math.abs(plan.daysUntilExam)} дн.`;

  return (
    <section
      aria-labelledby="personal-roadmap-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-6"
    >
      {/* Header + Countdown */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <p className="text-xs font-medium text-teal-700">
            Планирование сроков аттестации · Календарь соискателя
          </p>
          <h3
            id="personal-roadmap-heading"
            className="text-lg sm:text-xl font-bold text-slate-900"
          >
            Индивидуальная дорожная карта
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Выберите дату ближайшей сессии или задайте собственную дату экзамена — график
            подготовки рассчитает контрольные сроки автоматически с учётом вашего текущего прогресса.
          </p>
        </div>

        <div className="flex items-center gap-6 shrink-0">
          <div className="text-left md:text-right">
            <p className="text-xs text-slate-500">До экзамена</p>
            <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums leading-tight">
              {daysText}
            </p>
            <p className="text-xs text-slate-500 tabular-nums mt-0.5">
              {plan.completedCount} из {plan.milestones.length} вех выполнено
            </p>
          </div>
        </div>
      </div>

      {/* Controls: Exam Session Quick Picks + Custom Date + Contour */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-4 border-t border-slate-200 items-end">
        <div className="lg:col-span-7 space-y-2">
          <span className="block text-xs font-semibold text-slate-700">
            Ближайшие сессии РЦА (1–4 КС)
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {OFFICIAL_EXAM_OPTIONS.map((slot) => {
              const active = prefs.examDateIso === slot.startIso;
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => updateExamDate(slot.startIso, slot.label)}
                  aria-pressed={active}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-teal-50 border-teal-700 text-teal-900 font-semibold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {slot.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={handleExportExamIcs}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CalendarPlus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Добавить в календарь (.ics)</span>
            </button>
          </div>
          {icsNotice && (
            <p role="status" className="text-[11px] text-teal-800 font-medium">
              {icsNotice}
            </p>
          )}
        </div>

        <div className="lg:col-span-2 space-y-1.5">
          <label
            htmlFor="roadmap-custom-exam-date"
            className="block text-xs font-semibold text-slate-700"
          >
            Своя дата экзамена
          </label>
          <input
            id="roadmap-custom-exam-date"
            type="date"
            value={prefs.examDateIso}
            onChange={(e) => updateExamDate(e.target.value, 'Пользовательская дата')}
            className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
          />
        </div>

        <div className="lg:col-span-3 space-y-1.5">
          <span className="block text-xs font-semibold text-slate-700">Трек подготовки</span>
          <div
            role="group"
            aria-label="Выбор трека подготовки"
            className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg"
          >
            <button
              type="button"
              onClick={() => updateContour('contour_b')}
              aria-pressed={prefs.contour === 'contour_b'}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                prefs.contour === 'contour_b'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Контур Б (ДПО)
            </button>
            <button
              type="button"
              onClick={() => updateContour('contour_a')}
              aria-pressed={prefs.contour === 'contour_a'}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                prefs.contour === 'contour_a'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Контур А (Стаж)
            </button>
          </div>
        </div>
      </div>

      {/* Compressed schedule advisory */}
      {plan.isCompressedSchedule && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-950 text-xs sm:text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="leading-relaxed">
            <span className="font-semibold">Сжатый график подготовки:</span> до выбранной даты
            экзамена ({plan.examDateFormatted}) осталось меньше рекомендуемых{' '}
            <span className="font-mono font-semibold tabular-nums">{plan.recommendedDays}</span> дн.
            Рекомендуем подать заявку и параллельно начать оформление паспорта маршрута (ПП № 760).
          </p>
        </div>
      )}

      {/* Milestone timeline table/list */}
      <ol className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
        {plan.milestones.map((milestone) => {
          const visual = getStatusVisual(milestone.status);
          return (
            <li
              key={milestone.id}
              className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${visual.rowBgClass}`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <span className="mt-0.5">{visual.icon}</span>
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-xs font-mono text-slate-500 tabular-nums">
                      0{milestone.order}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      {milestone.title}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{milestone.description}</p>
                </div>
              </div>

              <div className="sm:text-right shrink-0 pl-7 sm:pl-4 space-y-1">
                <div className="inline-flex sm:flex items-center sm:justify-end gap-1.5 text-xs font-mono font-semibold text-slate-900 tabular-nums">
                  <CalendarDays className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
                  <span>{milestone.windowLabel}</span>
                </div>
                <div className="flex items-center sm:justify-end gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 text-slate-500 font-mono tabular-nums">
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    {formatOffsetLabel(milestone.offsetDays)}
                  </span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className={`font-semibold ${visual.badgeTextClass}`}>
                    {milestone.statusLabel}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
