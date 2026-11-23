import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpDown,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  FileWarning,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { SocialApiError } from '../../utils/socialApi';
import { formatDate } from '../../utils/format.ts';
import {
  computeInquiryStatusCounts,
  computeInquiryYearCounts,
  filterAndSortInquiriesHistory,
  getAvailableInquiryYears,
  getInquirySubmissionYear,
  type InquirySortOrder,
  type InquiryStatusFilterKey,
  type InquiryYearFilterKey,
} from '../../utils/inquiriesHistoryFilter';

export interface InquiryRecord {
  id: string;
  fullName: string;
  email: string;
  contactChannel: string;
  region: string;
  track: string;
  experienceNote: string;
  consentAccepted: boolean;
  sessionDate?: string | null;
  statusComment?: string;
  userId: string | null;
  status: 'new' | 'in_review' | 'needs_documents' | 'approved' | 'rejected';
  createdAt: string;
}

const STATUS_META: Record<
  InquiryRecord['status'],
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    textColorClass: string;
    rowAccentClass: string;
    defaultGuidance: string;
  }
> = {
  new: {
    label: 'Новая',
    icon: Clock,
    textColorClass: 'text-slate-700',
    rowAccentClass: '',
    defaultGuidance:
      'Заявка зарегистрирована в системе РЦА. Первичная сверка секретарём занимает до 1 рабочего дня.',
  },
  in_review: {
    label: 'На рассмотрении',
    icon: Loader2,
    textColorClass: 'text-amber-800',
    rowAccentClass: 'bg-amber-50/25',
    defaultGuidance:
      'Комиссия проверяет сведения о стаже, медицинский допуск и соответствие категории маршрута.',
  },
  needs_documents: {
    label: 'Требуются документы',
    icon: FileWarning,
    textColorClass: 'text-orange-800',
    rowAccentClass: 'bg-orange-50/45',
    defaultGuidance:
      'Для продолжения аттестации подготовьте справку о стаже/маршрутную книжку, меддопуск и паспорт маршрута (ПП № 760).',
  },
  approved: {
    label: 'Одобрено',
    icon: CheckCircle2,
    textColorClass: 'text-emerald-700',
    rowAccentClass: 'bg-emerald-50/25',
    defaultGuidance:
      'Допуск к аттестации подтверждён. Отслеживайте подготовку к экзамену в календаре и дорожной карте.',
  },
  rejected: {
    label: 'Отклонено',
    icon: XCircle,
    textColorClass: 'text-rose-700',
    rowAccentClass: 'bg-rose-50/25',
    defaultGuidance:
      'Комплект сведений не соответствует требованиям трека. Уточните данные и оформите новую запись.',
  },
};

function formatSessionIsoRu(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * «Статусы заявок на аттестацию» — self-service status table & tracking list
 * for the signed-in user's certification requests.
 */
export interface MyInquiriesSectionProps {
  canView: boolean;
  inquiries?: InquiryRecord[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onJumpToCalendar?: () => void;
  onJumpToChecklist?: () => void;
}

export function MyInquiriesSection({
  canView,
  inquiries: externalInquiries,
  loading: externalLoading,
  error: externalError,
  onRefresh,
  onJumpToCalendar,
  onJumpToChecklist,
}: MyInquiriesSectionProps) {
  const isControlled = externalInquiries !== undefined;
  const [internalInquiries, setInternalInquiries] = useState<InquiryRecord[]>([]);
  const [internalLoading, setInternalLoading] = useState<boolean>(true);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<InquiryStatusFilterKey>('all');
  const [yearFilter, setYearFilter] = useState<InquiryYearFilterKey>('all');
  const [sortOrder, setSortOrder] = useState<InquirySortOrder>('newest');

  const load = useCallback(async () => {
    if (onRefresh) {
      onRefresh();
      return;
    }
    setInternalLoading(true);
    try {
      const res = await fetch('/api/account/inquiries', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      const data = (await res.json()) as { inquiries?: InquiryRecord[]; error?: string };
      if (!res.ok) {
        throw new SocialApiError(data.error || 'Не удалось загрузить заявки.', res.status);
      }
      setInternalInquiries(data.inquiries ?? []);
      setInternalError(null);
    } catch (err) {
      setInternalError(err instanceof SocialApiError ? err.message : 'Не удалось загрузить заявки.');
    } finally {
      setInternalLoading(false);
    }
  }, [onRefresh]);

  useEffect(() => {
    if (isControlled) return;
    if (canView) void load();
    else setInternalLoading(false);
  }, [canView, isControlled, load]);

  const inquiries = isControlled ? externalInquiries : internalInquiries;
  const loading = isControlled ? Boolean(externalLoading) : internalLoading;
  const error = isControlled ? (externalError ?? null) : internalError;

  const availableYears = useMemo(
    () => getAvailableInquiryYears(inquiries),
    [inquiries]
  );

  const yearCounts = useMemo(
    () => computeInquiryYearCounts(inquiries),
    [inquiries]
  );

  const statusCounts = useMemo(
    () => computeInquiryStatusCounts(inquiries, yearFilter),
    [inquiries, yearFilter]
  );

  const overallCounts = useMemo(
    () => computeInquiryStatusCounts(inquiries, 'all'),
    [inquiries]
  );

  const filteredInquiries = useMemo(
    () =>
      filterAndSortInquiriesHistory(inquiries, {
        year: yearFilter,
        status: statusFilter,
        sortOrder,
      }),
    [inquiries, yearFilter, statusFilter, sortOrder]
  );

  useEffect(() => {
    if (yearFilter !== 'all' && !availableYears.includes(yearFilter)) {
      setYearFilter('all');
    }
  }, [availableYears, yearFilter]);

  if (!canView) return null;

  const filterTabs: { key: InquiryStatusFilterKey; label: string }[] = [
    { key: 'all', label: `Все (${statusCounts.all})` },
    { key: 'in_review', label: `На рассмотрении (${statusCounts.in_review})` },
    { key: 'needs_documents', label: `Требуются документы (${statusCounts.needs_documents})` },
    { key: 'approved', label: `Одобрено (${statusCounts.approved})` },
    { key: 'new', label: `Новые (${statusCounts.new})` },
  ];

  if (statusCounts.rejected > 0 || overallCounts.rejected > 0) {
    filterTabs.push({ key: 'rejected', label: `Отклонено (${statusCounts.rejected})` });
  }

  return (
    <section
      id="my-inquiries-status-table"
      aria-labelledby="my-inquiries-status-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 scroll-mt-24"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Реестр обращений кандидата · История и статусы</span>
          </p>
          <h3
            id="my-inquiries-status-heading"
            className="text-lg sm:text-xl font-bold text-slate-900"
          >
            История поданных заявок на аттестацию
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Полная история ваших заявок за все периоды с фильтрацией по годам и статусам, датами
            сессий и регламентными комментариями комиссии.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onJumpToCalendar && (
            <button
              type="button"
              onClick={onJumpToCalendar}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Записаться на сессию</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-300 text-slate-800 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Обновить</span>
          </button>
        </div>
      </div>

      {/* Summary Counters */}
      {inquiries.length > 0 && (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-y border-slate-200">
          <div className="space-y-0.5">
            <dt className="text-[11px] text-slate-500">Всего подано</dt>
            <dd className="text-sm font-bold font-mono text-slate-900 tabular-nums">
              {overallCounts.all}
            </dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-[11px] text-slate-500">Одобрено</dt>
            <dd className="text-sm font-bold font-mono text-emerald-700 tabular-nums">
              {overallCounts.approved}
            </dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-[11px] text-slate-500">На рассмотрении / доработке</dt>
            <dd className="text-sm font-bold font-mono text-amber-800 tabular-nums">
              {overallCounts.new + overallCounts.in_review + overallCounts.needs_documents}
            </dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-[11px] text-slate-500">Показано в таблице</dt>
            <dd className="text-sm font-bold font-mono text-teal-800 tabular-nums">
              {filteredInquiries.length} из {inquiries.length}
            </dd>
          </div>
        </dl>
      )}

      {/* Combined Filters: Years + Statuses + Sort */}
      {inquiries.length > 0 && (
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Фильтр заявок по статусу"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {filterTabs.map((tab) => {
              const active = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <label
              htmlFor="inquiries-year-filter"
              className="text-xs font-medium text-slate-600 whitespace-nowrap"
            >
              Год подачи:
            </label>
            <select
              id="inquiries-year-filter"
              aria-label="Фильтр заявок по году"
              value={yearFilter === 'all' ? 'all' : String(yearFilter)}
              onChange={(e) => {
                const val = e.target.value;
                setYearFilter(val === 'all' ? 'all' : Number(val));
              }}
              className="px-2.5 py-1.5 text-xs font-medium font-mono tabular-nums border border-slate-300 rounded-lg bg-white text-slate-800 focus:border-teal-700 focus:outline-none"
            >
              <option value="all">Все годы ({inquiries.length})</option>
              {availableYears.map((yr) => (
                <option key={yr} value={String(yr)}>
                  {yr} год ({yearCounts.get(yr) ?? 0})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() =>
                setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))
              }
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              <span>{sortOrder === 'newest' ? 'Сначала новые' : 'Сначала старые'}</span>
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {loading && inquiries.length === 0 ? (
        <p className="text-sm text-slate-500">Загружаем заявки…</p>
      ) : inquiries.length === 0 ? (
        <div className="text-center py-10 px-4 bg-slate-50/70 border border-dashed border-slate-300 rounded-xl text-slate-600 space-y-2.5">
          <FileText className="w-8 h-8 mx-auto text-slate-400" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-800">
            У вас пока нет оформленных заявок на аттестацию
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Выберите удобную дату аттестационной сессии в календаре выше — заявка сразу появится
            в этой таблице с отслеживанием статуса.
          </p>
          {onJumpToCalendar && (
            <button
              type="button"
              onClick={onJumpToCalendar}
              className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Выбрать дату в календаре</span>
            </button>
          )}
        </div>
      ) : filteredInquiries.length === 0 ? (
        <div className="py-8 px-4 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <AlertCircle className="w-6 h-6 mx-auto text-slate-400" aria-hidden="true" />
          <p className="text-xs sm:text-sm text-slate-600">
            Заявок по выбранному году и статусу не найдено.
          </p>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setYearFilter('all');
            }}
            className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
          >
            Сбросить фильтры и показать все ({inquiries.length})
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Structured Status Table */}
          <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th scope="col" className="py-3 px-4">
                    Заявка / Дата
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Направление и регион
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Сессия
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Статус
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Комментарий и следующий шаг
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredInquiries.map((inquiry) => {
                  const meta = STATUS_META[inquiry.status] ?? STATUS_META.new;
                  const Icon = meta.icon;
                  const guidance =
                    inquiry.statusComment?.trim() || meta.defaultGuidance;

                  return (
                    <tr
                      key={inquiry.id}
                      className={`align-top transition-colors hover:bg-slate-50/70 ${meta.rowAccentClass}`}
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                          {formatDate(inquiry.createdAt)}
                        </p>
                        <p className="font-mono text-[11px] text-slate-500 mt-0.5 tabular-nums">
                          № {inquiry.id.slice(-8)} · {getInquirySubmissionYear(inquiry) ?? '—'} г.
                        </p>
                      </td>

                      <td className="py-3.5 px-4 max-w-[220px]">
                        <p className="font-semibold text-slate-900">{inquiry.track}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{inquiry.region}</p>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {inquiry.sessionDate ? (
                          <span className="font-mono font-semibold text-teal-800 tabular-nums">
                            {formatSessionIsoRu(inquiry.sessionDate)}
                          </span>
                        ) : (
                          <span className="text-slate-500">По ближайшему потоку</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 font-semibold ${meta.textColorClass}`}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>{meta.label}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 space-y-1.5 max-w-sm">
                        <p className="text-slate-700 leading-relaxed">{guidance}</p>
                        {inquiry.experienceNote && (
                          <p className="text-[11px] text-slate-500 line-clamp-2">
                            {inquiry.experienceNote}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 pt-0.5">
                          {inquiry.status === 'needs_documents' && onJumpToChecklist && (
                            <button
                              type="button"
                              onClick={onJumpToChecklist}
                              className="text-[11px] font-semibold text-orange-800 hover:underline cursor-pointer"
                            >
                              Проверить пакет документов
                            </button>
                          )}
                          {(inquiry.status === 'rejected' || !inquiry.sessionDate) &&
                            onJumpToCalendar && (
                              <button
                                type="button"
                                onClick={onJumpToCalendar}
                                className="text-[11px] font-semibold text-teal-700 hover:underline cursor-pointer"
                              >
                                {inquiry.status === 'rejected'
                                  ? 'Выбрать новую дату'
                                  : 'Выбрать дату в календаре'}
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Responsive List Cards */}
          <ul className="md:hidden divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
            {filteredInquiries.map((inquiry) => {
              const meta = STATUS_META[inquiry.status] ?? STATUS_META.new;
              const Icon = meta.icon;
              const guidance =
                inquiry.statusComment?.trim() || meta.defaultGuidance;

              return (
                <li
                  key={inquiry.id}
                  className={`p-4 space-y-2 ${meta.rowAccentClass}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{inquiry.track}</p>
                      <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {inquiry.region} · {formatDate(inquiry.createdAt)}
                        {inquiry.sessionDate
                          ? ` · Сессия ${formatSessionIsoRu(inquiry.sessionDate)}`
                          : ''}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold shrink-0 ${meta.textColorClass}`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{meta.label}</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">{guidance}</p>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
