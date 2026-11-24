import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  FileWarning,
  Loader2,
  RefreshCw,
  Save,
  Search,
  XCircle,
} from 'lucide-react';
import {
  ApiError,
  identityApi,
  type AdminInquiryRecord,
  type InquiryStatus,
} from '../../utils/identityApi';
import { formatDate } from '../../utils/format';
import { tracker } from '../../utils/tracker';

const STATUS_OPTIONS: { value: InquiryStatus; label: string }[] = [
  { value: 'new', label: 'Новая' },
  { value: 'in_review', label: 'На рассмотрении' },
  { value: 'needs_documents', label: 'Требуются документы' },
  { value: 'approved', label: 'Одобрено' },
  { value: 'rejected', label: 'Отклонено' },
];

const STATUS_BADGE_MAP: Record<
  InquiryStatus,
  { label: string; className: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  new: {
    label: 'Новая',
    className: 'bg-slate-100 text-slate-800 border-slate-200',
    Icon: Clock,
  },
  in_review: {
    label: 'На рассмотрении',
    className: 'bg-amber-50 text-amber-900 border-amber-200',
    Icon: Loader2,
  },
  needs_documents: {
    label: 'Требуются документы',
    className: 'bg-orange-50 text-orange-900 border-orange-200',
    Icon: FileWarning,
  },
  approved: {
    label: 'Одобрено',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    Icon: CheckCircle2,
  },
  rejected: {
    label: 'Отклонено',
    className: 'bg-rose-50 text-rose-800 border-rose-200',
    Icon: XCircle,
  },
};

export interface CuratorInquiriesCrmCardProps {
  onInquiryUpdated?: () => void;
}

export const CuratorInquiriesCrmCard: React.FC<CuratorInquiriesCrmCardProps> = ({
  onInquiryUpdated,
}) => {
  const [inquiries, setInquiries] = useState<AdminInquiryRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | InquiryStatus>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [drafts, setDrafts] = useState<
    Record<string, { status: InquiryStatus; statusComment: string }>
  >({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await identityApi.listAllInquiries();
      const sorted = [...(res.inquiries ?? [])].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );
      setInquiries(sorted);
      setDrafts((prev) => {
        const next: Record<string, { status: InquiryStatus; statusComment: string }> = {};
        for (const item of sorted) {
          next[item.id] = prev[item.id] ?? {
            status: item.status,
            statusComment: item.statusComment ?? '',
          };
        }
        return next;
      });
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Не удалось загрузить очередь заявок куратора.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const counts = useMemo(() => {
    const map: Record<'all' | InquiryStatus, number> = {
      all: inquiries.length,
      new: 0,
      in_review: 0,
      needs_documents: 0,
      approved: 0,
      rejected: 0,
    };
    for (const item of inquiries) {
      map[item.status] = (map[item.status] ?? 0) + 1;
    }
    return map;
  }, [inquiries]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return inquiries.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (!q) return true;
      return (
        item.fullName.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        item.region.toLowerCase().includes(q) ||
        item.track.toLowerCase().includes(q) ||
        (item.contactChannel || '').toLowerCase().includes(q)
      );
    });
  }, [inquiries, statusFilter, searchQuery]);

  const handleDraftChange = (
    id: string,
    patch: Partial<{ status: InquiryStatus; statusComment: string }>
  ) => {
    const source = inquiries.find((x) => x.id === id);
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        status: patch.status ?? prev[id]?.status ?? source?.status ?? 'new',
        statusComment:
          patch.statusComment ?? prev[id]?.statusComment ?? source?.statusComment ?? '',
      },
    }));
  };

  const handleSave = async (item: AdminInquiryRecord) => {
    const draft = drafts[item.id] ?? {
      status: item.status,
      statusComment: item.statusComment ?? '',
    };
    setSavingId(item.id);
    setError(null);
    try {
      const updated = await identityApi.updateInquiryStatus(item.id, {
        status: draft.status,
        statusComment: draft.statusComment.trim(),
      });
      setInquiries((prev) => prev.map((row) => (row.id === item.id ? updated : row)));
      setDrafts((prev) => ({
        ...prev,
        [item.id]: {
          status: updated.status,
          statusComment: updated.statusComment ?? '',
        },
      }));
      setSavedId(item.id);
      window.setTimeout(() => {
        setSavedId((curr) => (curr === item.id ? null : curr));
      }, 2400);
      tracker.trackCustomInteraction(
        `CRM куратора · статус заявки ${updated.status}`,
        'crm'
      );
      onInquiryUpdated?.();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Не удалось обновить статус заявки.'
      );
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section
      id="curator-inquiries-crm"
      aria-labelledby="curator-crm-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 scroll-mt-24"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-semibold text-teal-700 inline-flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>CRM куратора РЦА · Все поступающие заявки</span>
          </p>
          <h3 id="curator-crm-heading" className="text-lg sm:text-xl font-bold text-slate-900">
            Очередь рассмотрения заявок на аттестацию ({inquiries.length})
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Просмотр всех обращений кандидатов из калькулятора и календаря, назначение статуса
            проверки и публикация комментария комиссии для соискателя.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadAll()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-300 text-slate-800 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>Обновить очередь</span>
        </button>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Фильтр очереди куратора по статусу"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
        >
          {(
            [
              { key: 'all', label: `Все (${counts.all})` },
              { key: 'new', label: `Новые (${counts.new})` },
              { key: 'in_review', label: `На рассмотрении (${counts.in_review})` },
              { key: 'needs_documents', label: `Нужны документы (${counts.needs_documents})` },
              { key: 'approved', label: `Одобрено (${counts.approved})` },
              { key: 'rejected', label: `Отклонено (${counts.rejected})` },
            ] as const
          ).map((tab) => {
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

        <label className="relative flex items-center w-full xl:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по ФИО, email, региону…"
            aria-label="Поиск заявок в CRM куратора"
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 focus:border-teal-700 focus:outline-none"
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {loading && inquiries.length === 0 ? (
        <p className="text-sm text-slate-500">Загружаем очередь заявок…</p>
      ) : filtered.length === 0 ? (
        <div className="py-8 px-4 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl space-y-1.5">
          <p className="text-sm font-semibold text-slate-800">
            {inquiries.length === 0
              ? 'В системе пока нет зарегистрированных заявок'
              : 'По выбранному фильтру заявки не найдены'}
          </p>
          <p className="text-xs text-slate-500">
            Новые заявки соискателей с главной страницы и календаря аттестации появятся здесь
            автоматически.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((item) => {
            const draft = drafts[item.id] ?? {
              status: item.status,
              statusComment: item.statusComment ?? '',
            };
            const badge = STATUS_BADGE_MAP[item.status] ?? STATUS_BADGE_MAP.new;
            const BadgeIcon = badge.Icon;
            const isDirty =
              draft.status !== item.status ||
              draft.statusComment.trim() !== (item.statusComment ?? '').trim();
            const isSaving = savingId === item.id;
            const isJustSaved = savedId === item.id;

            return (
              <li
                key={item.id}
                className="border border-slate-200 rounded-xl p-4 sm:p-5 bg-slate-50/50 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{item.fullName}</span>
                      <span className="font-mono text-[11px] text-slate-500">
                        № {item.id.slice(-8)} · {formatDate(item.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>{item.email}</span>
                      {item.contactChannel && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{item.contactChannel}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-slate-800">{item.region}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-teal-800">{item.track}</span>
                      {item.sessionDate && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-teal-900">
                            Сессия: {item.sessionDate}
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold border rounded-md shrink-0 ${badge.className}`}
                  >
                    <BadgeIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{badge.label}</span>
                  </span>
                </div>

                {item.experienceNote && (
                  <p className="text-xs text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 leading-relaxed">
                    <span className="font-semibold text-slate-800">Опыт и комментарий соискателя:</span>{' '}
                    {item.experienceNote}
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-start pt-1">
                  <div className="md:col-span-3">
                    <label
                      htmlFor={`crm-status-${item.id}`}
                      className="block text-[11px] font-semibold text-slate-600 mb-1"
                    >
                      Статус заявки
                    </label>
                    <select
                      id={`crm-status-${item.id}`}
                      value={draft.status}
                      onChange={(e) =>
                        handleDraftChange(item.id, { status: e.target.value as InquiryStatus })
                      }
                      className="w-full px-2.5 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-900 focus:border-teal-700 focus:outline-none"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-7">
                    <label
                      htmlFor={`crm-comment-${item.id}`}
                      className="block text-[11px] font-semibold text-slate-600 mb-1"
                    >
                      Комментарий куратора для соискателя
                    </label>
                    <input
                      id={`crm-comment-${item.id}`}
                      type="text"
                      value={draft.statusComment}
                      onChange={(e) =>
                        handleDraftChange(item.id, { statusComment: e.target.value })
                      }
                      placeholder="Укажите недостающие документы или дату допуска к экзамену…"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:border-teal-700 focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-2 md:pt-5">
                    <button
                      type="button"
                      disabled={isSaving || !isDirty}
                      onClick={() => void handleSave(item)}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 disabled:bg-slate-200 disabled:text-slate-500 transition-colors cursor-pointer disabled:cursor-not-allowed"
                    >
                      <Save className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        {isSaving ? 'Сохранение…' : isJustSaved ? 'Сохранено' : 'Сохранить'}
                      </span>
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
