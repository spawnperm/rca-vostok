import React, { useState } from 'react';
import { CalendarDays, CalendarRange, MapPin, Video } from 'lucide-react';
import { CertificationAttestationCalendar } from './CertificationAttestationCalendar';
import { AttestationEventsCalendarWidget } from './AttestationEventsCalendarWidget';
import { MarketFieldCommissionsCalendar } from './MarketFieldCommissionsCalendar';
import { OverviewWebinarsSchedule } from './OverviewWebinarsSchedule';
import { buildRouteUrl, type NavigateOptions, type SiteTabId } from '../utils/seo';
import { tracker } from '../utils/tracker';

type CalendarTabId = 'dfo_sessions' | 'events_commissions' | 'field_commissions' | 'webinars';

const CALENDAR_TABS: {
  id: CalendarTabId;
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'dfo_sessions',
    label: 'Экзамены по 7 субъектам ДФО',
    description: 'Сводный график экзаменов по 7 субъектам ДФО с экспортом в Google/Яндекс/.ics',
    Icon: CalendarDays,
  },
  {
    id: 'events_commissions',
    label: 'Календарь и напоминания',
    description: 'Контрольные вехи перехода и персональные напоминания по датам сессий',
    Icon: MapPin,
  },
  {
    id: 'field_commissions',
    label: 'Выездные полигоны (сетка)',
    description: 'Сетка выездных комиссий на полигонах Приморья и ДФО с выгрузкой .ics',
    Icon: CalendarRange,
  },
  {
    id: 'webinars',
    label: 'Вебинары ВВГУ и запись',
    description: 'Онлайн-консультации с экспертами ФСТР, запись участников и скачивание .ics',
    Icon: Video,
  },
];

export interface CertificationCalendarHubProps {
  onApplyForSession?: (regionName: string, trackName: string) => void;
  onContactCurator?: (sourceLabel: string) => void;
  onNavigateTab?: (tab: SiteTabId, options?: NavigateOptions) => void;
  onRegistered?: () => void;
}

export const CertificationCalendarHub: React.FC<CertificationCalendarHubProps> = ({
  onApplyForSession,
  onContactCurator,
  onNavigateTab,
  onRegistered,
}) => {
  const [activeTab, setActiveTab] = useState<CalendarTabId>('dfo_sessions');
  const activeMeta = CALENDAR_TABS.find((t) => t.id === activeTab) ?? CALENDAR_TABS[0];

  const handleCurator = (sourceLabel: string) => {
    if (onContactCurator) {
      onContactCurator(sourceLabel);
      return;
    }
    if (onNavigateTab) {
      onNavigateTab('contacts', { subTab: 'contacts' });
      return;
    }
    const nextUrl = buildRouteUrl(window.location.pathname, 'contacts', 'contacts');
    window.history.pushState({ tab: 'contacts', subTab: 'contacts' }, '', nextUrl);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <section aria-labelledby="cert-calendar-hub-heading" className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              Единый календарь ДФО
            </p>
            <h3
              id="cert-calendar-hub-heading"
              className="text-lg font-bold text-slate-900"
            >
              Расписание комиссий, экзаменов и вебинаров РЦА
            </h3>
            <p className="text-xs sm:text-sm text-slate-600">{activeMeta.description}</p>
          </div>

          <div
            role="tablist"
            aria-label="Режимы календаря аттестации"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start lg:self-auto"
          >
            {CALENDAR_TABS.map(({ id, label, Icon }) => {
              const active = id === activeTab;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setActiveTab(id);
                    tracker.trackCustomInteraction(`Календарь РЦА · ${label}`, 'certification');
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
        </div>
      </div>

      {activeTab === 'dfo_sessions' && <CertificationAttestationCalendar />}

      {activeTab === 'events_commissions' && (
        <AttestationEventsCalendarWidget
          onApplyForSession={onApplyForSession}
          onContactCurator={handleCurator}
        />
      )}

      {activeTab === 'field_commissions' && <MarketFieldCommissionsCalendar />}

      {activeTab === 'webinars' && (
        <OverviewWebinarsSchedule
          onRegistered={onRegistered}
          onContactCurator={handleCurator}
        />
      )}
    </section>
  );
};
