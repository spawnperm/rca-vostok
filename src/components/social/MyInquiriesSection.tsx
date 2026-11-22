import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, FileText, XCircle, RefreshCw, Loader2 } from 'lucide-react';
import { SocialApiError } from '../../utils/socialApi';

export interface InquiryRecord {
  id: string;
  fullName: string;
  email: string;
  contactChannel: string;
  region: string;
  track: string;
  experienceNote: string;
  consentAccepted: boolean;
  userId: string | null;
  status: 'new' | 'in_review' | 'approved' | 'rejected';
  createdAt: string;
}

const STATUS_META: Record<
  InquiryRecord['status'],
  { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  new: {
    label: 'Новая',
    icon: Clock,
    className: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  in_review: {
    label: 'На рассмотрении',
    icon: Loader2,
    className: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  approved: {
    label: 'Одобрена',
    icon: CheckCircle2,
    className: 'bg-teal-50 text-teal-800 border-teal-200',
  },
  rejected: {
    label: 'Отклонена',
    icon: XCircle,
    className: 'bg-red-50 text-red-800 border-red-200',
  },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * «Мои заявки» — the signed-in user's certification requests.
 *
 * Ownership is resolved server-side from the session; the client never sends a
 * user id, so one account cannot read another's requests.
 */
export function MyInquiriesSection({ canView }: { canView: boolean }) {
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/account/inquiries', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      const data = (await res.json()) as { inquiries?: InquiryRecord[]; error?: string };
      if (!res.ok) {
        throw new SocialApiError(data.error || 'Не удалось загрузить заявки.', res.status);
      }
      setInquiries(data.inquiries ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof SocialApiError ? err.message : 'Не удалось загрузить заявки.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) void load();
    else setLoading(false);
  }, [canView, load]);

  if (!canView) return null;

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-900 inline-flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-700" aria-hidden="true" />
            Мои заявки
          </h3>
          <p className="text-sm text-slate-600">
            Заявки на аттестацию, поданные из этого аккаунта, и их статус.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          Обновить
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Загружаем заявки…</p>
      ) : inquiries.length === 0 ? (
        <div className="text-center py-10 text-slate-500 space-y-2">
          <FileText className="w-8 h-8 mx-auto text-slate-300" aria-hidden="true" />
          <p className="text-sm">Вы пока не подавали заявок.</p>
          <p className="text-xs">
            Подать заявку можно в разделе «Обзор центра» — она появится здесь.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {inquiries.map((inquiry) => {
            const meta = STATUS_META[inquiry.status];
            const Icon = meta.icon;
            return (
              <li key={inquiry.id} className="py-3 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{inquiry.track}</p>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded border ${meta.className}`}
                  >
                    <Icon className="w-3 h-3" aria-hidden="true" />
                    {meta.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {inquiry.region} · подана {formatDate(inquiry.createdAt)}
                </p>
                {inquiry.experienceNote && (
                  <p className="text-xs text-slate-600 line-clamp-2">{inquiry.experienceNote}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
