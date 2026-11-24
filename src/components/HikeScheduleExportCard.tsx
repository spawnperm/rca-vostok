import React, { useMemo, useState } from 'react';
import {
  Calendar,
  CalendarPlus,
  CheckCircle2,
  CheckSquare,
  Download,
  ExternalLink,
  MapPin,
  Plus,
  RotateCcw,
  Square,
  Trash2,
  Users,
} from 'lucide-react';
import type { SessionUser } from '../utils/identityApi';
import {
  EXPERIENCE_COMPLEXITIES,
  JOURNAL_DFO_REGIONS,
  formatRussianJournalDate,
  readStoredExperienceJournal,
  type ExpeditionComplexity,
} from '../utils/experienceJournal';
import {
  CALENDAR_CLIENT_GUIDES,
  HIKE_DISCIPLINE_OPTIONS,
  HIKE_REMINDER_OPTIONS,
  buildGoogleCalendarHikeUrl,
  convertExperienceEntryToPlannedHike,
  downloadHikesScheduleIcs,
  getDefaultPlannedHikes,
  getDisciplineLabel,
  readStoredPlannedHikes,
  writeStoredPlannedHikes,
  type HikeDisciplineId,
  type HikeReminderLeadDays,
  type PlannedHikeEntry,
} from '../utils/hikeScheduleExport';
import { tracker } from '../utils/tracker';

interface HikeScheduleExportCardProps {
  user: SessionUser;
}

export const HikeScheduleExportCard: React.FC<HikeScheduleExportCardProps> = ({ user }) => {
  const [hikes, setHikes] = useState<PlannedHikeEntry[]>(() =>
    readStoredPlannedHikes(user.id, user.region)
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    readStoredPlannedHikes(user.id, user.region).map((h) => h.id)
  );
  const [reminderDays, setReminderDays] = useState<HikeReminderLeadDays>(10);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showJournalImport, setShowJournalImport] = useState(false);
  const [exportNotice, setExportNotice] = useState<{
    fileName: string;
    eventCount: number;
  } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields for a new planned hike
  const [title, setTitle] = useState('');
  const [region, setRegion] = useState(user.region || JOURNAL_DFO_REGIONS[0].name);
  const [discipline, setDiscipline] = useState<HikeDisciplineId>('hiking');
  const [complexity, setComplexity] = useState<ExpeditionComplexity>('2 КС');
  const [startDateIso, setStartDateIso] = useState('2027-07-10');
  const [endDateIso, setEndDateIso] = useState('2027-07-12');
  const [startTimeLocal, setStartTimeLocal] = useState('08:00');
  const [participantsCount, setParticipantsCount] = useState('10');
  const [meetingPoint, setMeetingPoint] = useState('');
  const [notes, setNotes] = useState('');

  const journalEntries = useMemo(
    () => readStoredExperienceJournal(user.id, user.region),
    [user.id, user.region]
  );

  const selectedHikes = useMemo(
    () => hikes.filter((h) => selectedIds.includes(h.id)),
    [hikes, selectedIds]
  );

  const totalSelectedParticipants = useMemo(
    () => selectedHikes.reduce((sum, h) => sum + h.participantsCount, 0),
    [selectedHikes]
  );

  const updateHikes = (next: PlannedHikeEntry[], selectNewId?: string) => {
    const sorted = [...next].sort((a, b) => a.startDateIso.localeCompare(b.startDateIso));
    setHikes(sorted);
    writeStoredPlannedHikes(user.id, sorted);
    setSelectedIds((prev) => {
      const existingValid = prev.filter((id) => sorted.some((h) => h.id === id));
      return selectNewId && !existingValid.includes(selectNewId)
        ? [...existingValid, selectNewId]
        : existingValid;
    });
    setExportNotice(null);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
    setExportNotice(null);
  };

  const handleSelectAll = () => {
    setSelectedIds(hikes.map((h) => h.id));
    setExportNotice(null);
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
    setExportNotice(null);
  };

  const handleDeleteHike = (id: string) => {
    const next = hikes.filter((h) => h.id !== id);
    updateHikes(next);
  };

  const handleResetDefaults = () => {
    const defaults = getDefaultPlannedHikes(user.region);
    setHikes(defaults);
    writeStoredPlannedHikes(user.id, defaults);
    setSelectedIds(defaults.map((h) => h.id));
    setExportNotice(null);
    setFormError(null);
  };

  const handleAddPlannedHike = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setFormError('Укажите название запланированного маршрута.');
      return;
    }
    if (!startDateIso) {
      setFormError('Укажите дату начала похода.');
      return;
    }
    const safeEnd = endDateIso && endDateIso >= startDateIso ? endDateIso : startDateIso;
    const groupSize = Math.max(1, Math.min(200, Number.parseInt(participantsCount, 10) || 8));

    const newHike: PlannedHikeEntry = {
      id: `hike-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: cleanTitle.slice(0, 140),
      region: region || JOURNAL_DFO_REGIONS[0].name,
      discipline,
      complexity,
      startDateIso,
      endDateIso: safeEnd,
      startTimeLocal: startTimeLocal || '08:00',
      participantsCount: groupSize,
      meetingPoint: meetingPoint.trim() || region || 'Точка сбора уточняется',
      reminderDaysBefore: reminderDays,
      notes: notes.trim(),
    };

    updateHikes([...hikes, newHike], newHike.id);
    setTitle('');
    setMeetingPoint('');
    setNotes('');
    setShowAddForm(false);

    tracker.trackCustomInteraction('Личный кабинет · Добавлен маршрут в график походов', complexity);
  };

  const handleImportFromJournal = (entryId: string) => {
    const found = journalEntries.find((j) => j.id === entryId);
    if (!found) return;
    // Schedule 1 year forward or next summer if original date is in the past
    const origYear = Number.parseInt(found.date.slice(0, 4), 10) || 2026;
    const nextDate = `${Math.max(origYear + 1, 2027)}${found.date.slice(4)}`;
    const imported = convertExperienceEntryToPlannedHike(found, nextDate);
    updateHikes([...hikes, imported], imported.id);
    setShowJournalImport(false);
  };

  const handleExportIcs = () => {
    if (selectedHikes.length === 0) return;
    const res = downloadHikesScheduleIcs(selectedHikes, {
      overrideReminderDays: reminderDays,
    });
    setExportNotice({
      fileName: res.fileName,
      eventCount: res.eventCount,
    });
    tracker.trackCustomInteraction(
      'Личный кабинет · Экспорт графика походов (.ics)',
      `${res.eventCount} маршрутов`
    );
  };

  const allSelected = hikes.length > 0 && selectedIds.length === hikes.length;

  return (
    <section
      id="hike-schedule-export"
      className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5 scroll-mt-24"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 inline-flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Интеграция с личным календарём (RFC 5545)</span>
          </p>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900">
            Экспорт графика походов (.ics)
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
            Сформируйте календарный файл <code className="font-mono text-slate-800">.ics</code> со
            всеми запланированными выходами, точками сбора и автоматическим напоминанием для
            уведомления МЧС. Поддерживается в Google, Яндекс и Apple Календаре.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setShowAddForm((v) => !v);
              setShowJournalImport(false);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Добавить маршрут</span>
          </button>
          {journalEntries.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setShowJournalImport((v) => !v);
                setShowAddForm(false);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-200 hover:border-teal-600 text-slate-700 hover:text-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CalendarPlus className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              <span>Из журнала стажа</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
          <p className="text-[11px] font-medium text-slate-500">В графике походов</p>
          <p className="text-base sm:text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
            {hikes.length}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
          <p className="text-[11px] font-medium text-slate-500">Выбрано в .ics</p>
          <p className="text-base sm:text-lg font-bold text-teal-700 font-mono tabular-nums mt-0.5">
            {selectedHikes.length}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
          <p className="text-[11px] font-medium text-slate-500">Участников в выборке</p>
          <p className="text-base sm:text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
            {totalSelectedParticipants} чел.
          </p>
        </div>
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
          <p className="text-[11px] font-medium text-slate-500">Уведомление (VALARM)</p>
          <p className="text-sm sm:text-base font-bold text-slate-900 font-mono tabular-nums mt-0.5">
            За {reminderDays} {reminderDays === 1 ? 'день' : 'дн.'}
          </p>
        </div>
      </div>

      {/* Journal Import Drawer */}
      {showJournalImport && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-slate-900">
              Перенести маршрут из журнала походного стажа (повторить в новом сезоне)
            </p>
            <button
              type="button"
              onClick={() => setShowJournalImport(false)}
              className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Закрыть
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {journalEntries.slice(0, 4).map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => handleImportFromJournal(entry.id)}
                className="text-left p-3 rounded-lg bg-white border border-slate-200 hover:border-teal-600 transition-colors cursor-pointer space-y-1"
              >
                <p className="text-xs font-semibold text-slate-900 line-clamp-1">
                  {entry.routeTitle}
                </p>
                <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                  {entry.regionName} · {entry.complexity} · {entry.participantsCount} чел.
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add Route Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddPlannedHike}
          className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900">
              Новый запланированный маршрут
            </h4>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Отмена
            </button>
          </div>

          {formError && (
            <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {formError}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <label className="block sm:col-span-2 lg:col-span-2 space-y-1">
              <span className="text-xs font-medium text-slate-700">Название маршрута *</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: Хребет Чандалаз · учебно-тренировочный выход"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Регион ДФО</span>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              >
                {JOURNAL_DFO_REGIONS.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Дата начала *</span>
              <input
                type="date"
                value={startDateIso}
                onChange={(e) => {
                  const val = e.target.value;
                  setStartDateIso(val);
                  if (!endDateIso || endDateIso < val) {
                    setEndDateIso(val);
                  }
                }}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono tabular-nums focus:outline-none focus:border-teal-600"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Дата возвращения</span>
              <input
                type="date"
                value={endDateIso}
                min={startDateIso}
                onChange={(e) => setEndDateIso(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono tabular-nums focus:outline-none focus:border-teal-600"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Время сбора (ВЛД)</span>
              <input
                type="time"
                value={startTimeLocal}
                onChange={(e) => setStartTimeLocal(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono tabular-nums focus:outline-none focus:border-teal-600"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Вид туризма</span>
              <select
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value as HikeDisciplineId)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              >
                {HIKE_DISCIPLINE_OPTIONS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Категория сложности</span>
              <select
                value={complexity}
                onChange={(e) => setComplexity(e.target.value as ExpeditionComplexity)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              >
                {EXPERIENCE_COMPLEXITIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.shortLabel}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Численность группы</span>
              <input
                type="number"
                min={1}
                max={200}
                value={participantsCount}
                onChange={(e) => setParticipantsCount(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono tabular-nums focus:outline-none focus:border-teal-600"
              />
            </label>

            <label className="block sm:col-span-2 lg:col-span-1 space-y-1">
              <span className="text-xs font-medium text-slate-700">Точка сбора</span>
              <input
                type="text"
                value={meetingPoint}
                onChange={(e) => setMeetingPoint(e.target.value)}
                placeholder="с. Екатериновка / ж/д станция"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </label>

            <label className="block sm:col-span-2 space-y-1">
              <span className="text-xs font-medium text-slate-700">Заметки и требования ТБ</span>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="МЧС, рации, каски, разрешение ООПТ..."
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Сохранить в график</span>
            </button>
          </div>
        </form>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={allSelected ? handleClearSelection : handleSelectAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {allSelected ? (
              <CheckSquare className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            ) : (
              <Square className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            )}
            <span>{allSelected ? 'Снять выделение' : 'Выбрать все маршруты'}</span>
          </button>

          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Восстановить примеры</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Напоминание:</span>
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {HIKE_REMINDER_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                type="button"
                onClick={() => setReminderDays(opt.days)}
                title={opt.label}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  reminderDays === opt.days
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.shortLabel}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Route list */}
      {hikes.length === 0 ? (
        <div className="p-6 rounded-xl border border-dashed border-slate-300 text-center space-y-2">
          <p className="text-sm font-medium text-slate-700">
            Список запланированных походов пока пуст
          </p>
          <p className="text-xs text-slate-500">
            Добавьте маршрут вручную, перенесите из журнала стажа или восстановите примеры.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {hikes.map((hike) => {
            const isSelected = selectedIds.includes(hike.id);
            const sameDay = hike.startDateIso === hike.endDateIso;
            const dateRangeLabel = sameDay
              ? formatRussianJournalDate(hike.startDateIso)
              : `${formatRussianJournalDate(hike.startDateIso)} – ${formatRussianJournalDate(
                  hike.endDateIso
                )}`;

            return (
              <div
                key={hike.id}
                className={`p-4 rounded-xl border transition-colors ${
                  isSelected
                    ? 'border-teal-300 bg-teal-50/35'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleSelect(hike.id)}
                      aria-pressed={isSelected}
                      aria-label={`Включить маршрут ${hike.title} в экспорт .ics`}
                      className="mt-0.5 text-teal-700 hover:text-teal-900 cursor-pointer shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" aria-hidden="true" />
                      )}
                    </button>

                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-900">{hike.title}</p>
                      <p className="text-xs text-slate-600 font-mono tabular-nums">
                        {dateRangeLabel} · {hike.startTimeLocal} ВЛД · {hike.complexity} ·{' '}
                        {getDisciplineLabel(hike.discipline)}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 pt-0.5">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                          <span>
                            {hike.region}
                            {hike.meetingPoint ? ` · ${hike.meetingPoint}` : ''}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                          <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                          <span>{hike.participantsCount} чел.</span>
                        </span>
                      </div>
                      {hike.notes && (
                        <p className="text-xs text-slate-500 leading-relaxed pt-0.5">
                          {hike.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pl-7 sm:pl-0">
                    <a
                      href={buildGoogleCalendarHikeUrl(hike)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-teal-800 bg-white border border-slate-200 hover:border-teal-600 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>В Google Календарь</span>
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDeleteHike(hike.id)}
                      aria-label={`Удалить маршрут ${hike.title}`}
                      className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Primary Download & Confirmation */}
      <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-800">
            Файл <code className="font-mono">.ics</code> включает{' '}
            <span className="font-mono tabular-nums">{selectedHikes.length}</span>{' '}
            {selectedHikes.length === 1
              ? 'событие'
              : selectedHikes.length >= 2 && selectedHikes.length <= 4
                ? 'события'
                : 'событий'}{' '}
            и триггер уведомления за{' '}
            <span className="font-mono tabular-nums">{reminderDays}</span>{' '}
            {reminderDays === 1 ? 'день' : 'дн.'} до старта.
          </p>
          {exportNotice && (
            <p
              role="status"
              className="text-xs text-emerald-800 inline-flex items-center gap-1.5 font-medium"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
              <span>
                Файл <code className="font-mono">{exportNotice.fileName}</code> сформирован (
                {exportNotice.eventCount} маршрутов). Импортируйте его в свой календарь.
              </span>
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleExportIcs}
          disabled={selectedHikes.length === 0}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4 text-teal-300" aria-hidden="true" />
          <span>Скачать график походов (.ics)</span>
        </button>
      </div>

      {/* Import hints for Google, Yandex, Apple */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {CALENDAR_CLIENT_GUIDES.map((guide) => (
          <div
            key={guide.id}
            className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 flex flex-col justify-between"
          >
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-900">{guide.name}</p>
              <p className="text-[11px] text-slate-600 leading-relaxed">{guide.steps}</p>
            </div>
            {guide.actionUrl && guide.actionLabel && (
              <a
                href={guide.actionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:text-teal-900 pt-1"
              >
                <span>{guide.actionLabel}</span>
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
