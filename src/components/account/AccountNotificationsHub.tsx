import React, { useState } from 'react';
import { BellRing, Sparkles } from 'lucide-react';
import type { SessionUser } from '../../utils/identityApi';
import { tracker } from '../../utils/tracker';
import type { UpdateFeedActionTarget } from '../../utils/updatesFeed';
import type { UserAttestationSummary } from '../AttestationProgressWidget';
import { NotificationCenterWidget } from '../NotificationCenterWidget';
import { UpdatesFeedWidget } from '../UpdatesFeedWidget';
import type { InquiryRecord } from '../social/MyInquiriesSection';

type HubMode = 'feed' | 'system';

interface AccountNotificationsHubProps {
  user: SessionUser;
  inquiries: InquiryRecord[];
  inquiriesLoading: boolean;
  progressSummary: UserAttestationSummary;
  onRefreshInquiries?: () => void;
  onOpenOverview?: () => void;
  onNavigateAction: (target: UpdateFeedActionTarget, prompt?: string) => void;
}

export const AccountNotificationsHub: React.FC<AccountNotificationsHubProps> = ({
  user,
  inquiries,
  inquiriesLoading,
  progressSummary,
  onRefreshInquiries,
  onOpenOverview,
  onNavigateAction,
}) => {
  const [mode, setMode] = useState<HubMode>('feed');

  return (
    <section
      id="account-notifications-hub"
      aria-labelledby="account-notifications-hub-heading"
      className="space-y-4 scroll-mt-24"
    >
      <div className="bg-white border border-slate-200 rounded-xl px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
            Центр событий и рекомендаций РЦА
          </p>
          <h2
            id="account-notifications-hub-heading"
            className="text-base font-bold text-slate-900"
          >
            Лента обновлений и мониторинг статусов заявок
          </h2>
        </div>

        <div
          role="tablist"
          aria-label="Режим уведомлений личного кабинета"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start lg:self-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'feed'}
            onClick={() => {
              setMode('feed');
              tracker.trackCustomInteraction('Кабинет · Лента обновлений и советы', 'account');
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'feed'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>Лента обновлений и советы</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={mode === 'system'}
            onClick={() => {
              setMode('system');
              tracker.trackCustomInteraction('Кабинет · Системные статусы заявок', 'account');
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'system'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BellRing className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>Системные статусы ({inquiries.length})</span>
          </button>
        </div>
      </div>

      {mode === 'feed' ? (
        <UpdatesFeedWidget
          user={user}
          inquiries={inquiries}
          progressSummary={progressSummary}
          onNavigateAction={onNavigateAction}
        />
      ) : (
        <NotificationCenterWidget
          user={user}
          inquiries={inquiries}
          inquiriesLoading={inquiriesLoading}
          onRefreshInquiries={onRefreshInquiries}
          onOpenOverview={onOpenOverview}
        />
      )}
    </section>
  );
};
