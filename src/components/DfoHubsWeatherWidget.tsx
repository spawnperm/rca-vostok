import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CloudFog,
  CloudRain,
  CloudSun,
  Droplets,
  Gauge,
  RefreshCw,
  Snowflake,
  Sun,
  Wind,
} from 'lucide-react';
import type {
  HubGuideStatus,
  HubWeatherCondition,
  HubsWeatherResponse,
  TourismHubWeather,
} from '../utils/hubsWeather';
import { tracker } from '../utils/tracker';

function formatTemp(value: number): string {
  return value > 0 ? `+${value}°C` : `${value}°C`;
}

function formatUpdatedTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function HubConditionIcon({
  kind,
  className = 'w-5 h-5',
}: {
  kind: HubWeatherCondition;
  className?: string;
}) {
  switch (kind) {
    case 'clear':
      return <Sun className={`${className} text-amber-500`} aria-hidden="true" />;
    case 'partly-cloudy':
      return <CloudSun className={`${className} text-amber-500`} aria-hidden="true" />;
    case 'overcast':
      return <Cloud className={`${className} text-slate-500`} aria-hidden="true" />;
    case 'fog':
      return <CloudFog className={`${className} text-slate-500`} aria-hidden="true" />;
    case 'rain':
      return <CloudRain className={`${className} text-sky-600`} aria-hidden="true" />;
    case 'snow':
      return <Snowflake className={`${className} text-sky-500`} aria-hidden="true" />;
    case 'wind':
      return <Wind className={`${className} text-teal-700`} aria-hidden="true" />;
  }
}

function guideStatusMeta(status: HubGuideStatus): {
  textClass: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case 'favourable':
      return {
        textClass: 'text-emerald-700',
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" aria-hidden="true" />,
      };
    case 'caution':
      return {
        textClass: 'text-amber-700',
        icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" aria-hidden="true" />,
      };
    case 'restricted':
      return {
        textClass: 'text-rose-700',
        icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-700 shrink-0" aria-hidden="true" />,
      };
  }
}

export const DfoHubsWeatherWidget: React.FC = () => {
  const [data, setData] = useState<HubsWeatherResponse | null>(null);
  const [selectedHubId, setSelectedHubId] = useState<string>('vladivostok');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadWeather = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshing(true);
    }
    try {
      const url = forceRefresh ? '/api/weather/hubs?refresh=1' : '/api/weather/hubs';
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const payload = (await res.json()) as HubsWeatherResponse;
      setData(payload);
      setError(null);
    } catch {
      setError('Не удалось получить метеосводку по хабам ДФО.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadWeather(false);
  }, [loadWeather]);

  const hubs = data?.hubs ?? [];
  const selectedHub: TourismHubWeather | undefined =
    hubs.find((h) => h.id === selectedHubId) ?? hubs[0];

  return (
    <section
      aria-labelledby="dfo-hubs-weather-heading"
      className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-teal-700">Оперативная сводка по ДФО</p>
          <h2 id="dfo-hubs-weather-heading" className="text-base sm:text-lg font-bold text-slate-900">
            Погода в ключевых туристических хабах
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {data && (
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {data.source === 'open-meteo' ? 'Open-Meteo' : 'Сезонный профиль'} ·{' '}
              {formatUpdatedTime(data.fetchedAtIso)}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              void loadWeather(true);
              tracker.trackCustomInteraction('Обновление погоды хабов ДФО');
            }}
            disabled={loading || refreshing}
            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 disabled:opacity-60 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-teal-700' : ''}`}
              aria-hidden="true"
            />
            <span>Обновить</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div
          role="status"
          aria-live="polite"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 border-t border-slate-200 pt-4"
        >
          <span className="sr-only">Загружаем текущую погоду по хабам ДФО…</span>
          {[0, 1, 2, 3, 4].map((slot) => (
            <div key={slot} className="py-2 sm:px-4 first:sm:pl-0 last:sm:pr-0 space-y-2">
              <div className="h-3.5 w-28 bg-slate-100 rounded animate-pulse" />
              <div className="h-7 w-20 bg-slate-100 rounded animate-pulse" />
              <div className="h-3 w-32 bg-slate-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="border-t border-slate-200 pt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-xs text-rose-800">
            <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadWeather(true)}
            className="px-3 py-1.5 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Повторить
          </button>
        </div>
      ) : (
        <>
          <div
            role="tablist"
            aria-label="Ключевые туристические хабы ДФО"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 border-t border-slate-200 pt-4"
          >
            {hubs.map((hub) => {
              const active = hub.id === selectedHub?.id;
              const status = guideStatusMeta(hub.guideStatus);

              return (
                <button
                  key={hub.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setSelectedHubId(hub.id);
                    tracker.trackCustomInteraction(`Погода хаба ДФО: ${hub.city}`);
                  }}
                  className={`text-left py-2.5 sm:px-4 first:sm:pl-2 last:sm:pr-2 rounded-lg transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                    active ? 'bg-teal-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={`text-xs font-semibold truncate ${
                        active ? 'text-teal-900' : 'text-slate-900'
                      }`}
                    >
                      {hub.city}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 tabular-nums shrink-0">
                      {hub.localTimeLabel}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-2.5">
                    <HubConditionIcon kind={hub.condition} className="w-6 h-6 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xl font-bold font-mono tabular-nums text-slate-900 leading-none">
                        {formatTemp(hub.tempC)}
                      </p>
                      <p className="text-[11px] text-slate-600 truncate mt-1">
                        {hub.conditionLabel}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-mono text-slate-500 tabular-nums">
                      {hub.windMs} м/с · {hub.humidityPct}%
                    </span>
                    <span className={`inline-flex items-center gap-1 font-medium ${status.textClass}`}>
                      {status.icon}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedHub && (
            <div className="border-t border-slate-200 pt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs text-slate-600">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold text-slate-900">{selectedHub.city}</span>
                <span aria-hidden="true">·</span>
                <span>{selectedHub.region}</span>
                <span aria-hidden="true">·</span>
                <span className="text-slate-500">{selectedHub.hubRole}</span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono tabular-nums text-slate-700">
                <span>Ощущается {formatTemp(selectedHub.feelsLikeC)}</span>
                <span className="inline-flex items-center gap-1">
                  <Wind className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  порывы до {selectedHub.windGustMs} м/с
                </span>
                <span className="inline-flex items-center gap-1">
                  <Droplets className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  {selectedHub.humidityPct}%
                </span>
                <span className="inline-flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  {selectedHub.pressureMmHg} мм рт. ст.
                </span>
                <span
                  className={`inline-flex items-center gap-1 font-sans font-semibold ${
                    guideStatusMeta(selectedHub.guideStatus).textClass
                  }`}
                >
                  {guideStatusMeta(selectedHub.guideStatus).icon}
                  <span>{selectedHub.guideStatusLabel}</span>
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};
