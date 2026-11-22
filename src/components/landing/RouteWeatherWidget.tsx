import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CloudFog,
  CloudRain,
  CloudSun,
  Compass,
  Droplets,
  Eye,
  Gauge,
  MapPin,
  RefreshCw,
  Sun,
  Wind,
} from 'lucide-react';
import { CERTIFIED_TOURIST_ROUTES, type CertifiedTouristRoute } from '../../data/researchData';
import {
  fetchRouteWeatherForecast,
  type GuideWeatherStatus,
  type RouteWeatherForecast,
  type WeatherConditionKind,
} from '../../utils/routeWeatherApi';
import { tracker } from '../../utils/tracker';

type TrackFilter = 'all' | CertifiedTouristRoute['track'];

const TRACK_FILTERS: { id: TrackFilter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'hiking', label: 'Пешеходные' },
  { id: 'water', label: 'Водные' },
  { id: 'expedition', label: 'Экспедиционные' },
];

function formatTemp(value: number): string {
  return value > 0 ? `+${value}°C` : `${value}°C`;
}

function formatFetchTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function WeatherConditionIcon({
  kind,
  className = 'w-5 h-5',
}: {
  kind: WeatherConditionKind;
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
    case 'wind':
      return <Wind className={`${className} text-teal-700`} aria-hidden="true" />;
  }
}

function GuideStatusStyle(status: GuideWeatherStatus): {
  container: string;
  text: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case 'favourable':
      return {
        container: 'bg-emerald-50 border border-emerald-200',
        text: 'text-emerald-900',
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />,
      };
    case 'caution':
      return {
        container: 'bg-amber-50 border border-amber-200',
        text: 'text-amber-900',
        icon: <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />,
      };
    case 'restricted':
      return {
        container: 'bg-rose-50 border border-rose-200',
        text: 'text-rose-900',
        icon: <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" aria-hidden="true" />,
      };
  }
}

export function RouteWeatherWidget({ suggestedRouteId }: { suggestedRouteId?: string }) {
  const [trackFilter, setTrackFilter] = useState<TrackFilter>('all');
  const [selectedRouteId, setSelectedRouteId] = useState<string>(
    suggestedRouteId || CERTIFIED_TOURIST_ROUTES[1]?.id || CERTIFIED_TOURIST_ROUTES[0]?.id || ''
  );
  const [refreshCount, setRefreshCount] = useState<number>(0);
  const [forecast, setForecast] = useState<RouteWeatherForecast | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Sync route selection when the user switches a Primorye district above.
  useEffect(() => {
    if (suggestedRouteId) {
      setTrackFilter('all');
      setSelectedRouteId(suggestedRouteId);
    }
  }, [suggestedRouteId]);

  const visibleRoutes = useMemo(() => {
    if (trackFilter === 'all') return CERTIFIED_TOURIST_ROUTES;
    return CERTIFIED_TOURIST_ROUTES.filter((route) => route.track === trackFilter);
  }, [trackFilter]);

  useEffect(() => {
    if (!visibleRoutes.some((r) => r.id === selectedRouteId) && visibleRoutes[0]) {
      setSelectedRouteId(visibleRoutes[0].id);
    }
  }, [visibleRoutes, selectedRouteId]);

  useEffect(() => {
    if (!selectedRouteId) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchRouteWeatherForecast(selectedRouteId, {
      signal: controller.signal,
      refreshSeed: refreshCount,
    })
      .then((data) => {
        setForecast(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Не удалось загрузить прогноз погоды.');
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [selectedRouteId, refreshCount]);

  const handleSelectRoute = (route: CertifiedTouristRoute) => {
    setSelectedRouteId(route.id);
    tracker.trackCustomInteraction(
      'Выбор маршрута для прогноза погоды',
      `${route.shortName} (${route.id})`
    );
  };

  const handleRefresh = () => {
    setRefreshCount((count) => count + 1);
    tracker.trackCustomInteraction(
      'Обновление прогноза погоды маршрута',
      forecast?.shortName ?? selectedRouteId
    );
  };

  const guideStyle = forecast ? GuideStatusStyle(forecast.guideStatus) : null;

  return (
    <div className="space-y-4 pt-4 border-t border-slate-200">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
            Метеомониторинг маршрутов
          </p>
          <h3 className="text-lg font-bold text-slate-900">
            Погода на популярных маршрутах
          </h3>
          <p className="text-sm text-slate-600 max-w-2xl">
            Выберите популярный маршрут, чтобы выполнить запрос к имитации метео-API и оценить
            локальные условия для выхода группы.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            role="group"
            aria-label="Фильтр маршрутов по направлению"
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {TRACK_FILTERS.map((filter) => {
              const active = trackFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setTrackFilter(filter.id)}
                  aria-pressed={active}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-700' : ''}`}
              aria-hidden="true"
            />
            Обновить прогноз
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Popular routes selector */}
        <nav
          aria-label="Популярные маршруты для прогноза погоды"
          className="lg:col-span-4 space-y-1.5"
        >
          {visibleRoutes.map((route) => {
            const isActive = route.id === selectedRouteId;
            return (
              <button
                key={route.id}
                type="button"
                onClick={() => handleSelectRoute(route)}
                aria-current={isActive ? 'true' : undefined}
                className={`w-full text-left px-3.5 py-2.5 rounded-lg border transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-teal-50 border-teal-300 text-teal-950'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm truncate ${isActive ? 'font-semibold' : 'font-medium'}`}>
                    {route.shortName}
                  </span>
                  <span className="text-xs text-slate-500 tabular-nums shrink-0">
                    {route.lengthKm} км
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {route.regionName} · {route.difficultyCategory}
                </p>
              </button>
            );
          })}
        </nav>

        {/* Weather forecast panel */}
        <div
          aria-busy={loading}
          aria-live="polite"
          className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6"
        >
          {loading ? (
            <div role="status" className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-2 w-2/3">
                  <div className="h-5 w-3/4 bg-slate-100 rounded" />
                  <div className="h-3.5 w-1/2 bg-slate-100 rounded" />
                </div>
                <div className="h-10 w-24 bg-slate-100 rounded" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-slate-200">
                {[0, 1, 2, 3].map((slot) => (
                  <div key={slot} className="space-y-2">
                    <div className="h-3 w-20 bg-slate-100 rounded" />
                    <div className="h-5 w-24 bg-slate-100 rounded" />
                  </div>
                ))}
              </div>

              <div className="h-16 bg-slate-100 rounded-lg" />

              <p className="text-xs text-slate-500">
                Выполняем запрос к метеосервису для выбранной локации маршрута…
              </p>
            </div>
          ) : error ? (
            <div className="space-y-4 py-4">
              <div className="flex items-start gap-2.5 text-rose-900">
                <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Ошибка получения прогноза</p>
                  <p className="text-sm text-slate-600">{error}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer"
              >
                Повторить запрос
              </button>
            </div>
          ) : (
            forecast && (
              <div className="space-y-6">
                {/* Route identity & current temperature */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <h4 className="text-base font-bold text-slate-900 leading-snug">
                      {forecast.routeName}
                    </h4>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                        {forecast.regionName}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{forecast.coordinatesLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span>{forecast.elevationLabel}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Обновлено в{' '}
                      <span className="tabular-nums font-medium text-slate-700">
                        {formatFetchTime(forecast.fetchedAtIso)}
                      </span>{' '}
                      <span aria-hidden="true">·</span> Имитация API-запроса (
                      <span className="tabular-nums">{forecast.simulatedLatencyMs} мс</span>)
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 sm:text-right">
                    <WeatherConditionIcon
                      kind={forecast.current.condition}
                      className="w-9 h-9 shrink-0"
                    />
                    <div>
                      <p className="text-3xl font-bold text-slate-900 tabular-nums leading-none">
                        {formatTemp(forecast.current.tempC)}
                      </p>
                      <p className="text-xs font-medium text-slate-700 mt-1">
                        {forecast.current.conditionLabel}
                      </p>
                      <p className="text-xs text-slate-500 tabular-nums">
                        Ощущается как {formatTemp(forecast.current.feelsLikeC)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Key atmospheric & trail metrics separated by clean hairlines */}
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-slate-200">
                  <div className="space-y-1">
                    <dt className="text-xs text-slate-500 inline-flex items-center gap-1">
                      <Wind className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                      Ветер и порывы
                    </dt>
                    <dd className="text-sm font-bold text-slate-900 tabular-nums">
                      {forecast.current.windSpeedMs} м/с · {forecast.current.windDirection}
                    </dd>
                    <p className="text-xs text-slate-500 tabular-nums">
                      порывы до {forecast.current.windGustMs} м/с
                    </p>
                  </div>

                  <div className="space-y-1">
                    <dt className="text-xs text-slate-500 inline-flex items-center gap-1">
                      <Droplets className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                      Влажность и осадки
                    </dt>
                    <dd className="text-sm font-bold text-slate-900 tabular-nums">
                      {forecast.current.humidityPct}% · {forecast.current.precipitationMm} мм
                    </dd>
                    <p className="text-xs text-slate-500 tabular-nums">
                      УФ-индекс: {forecast.current.uvIndex}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <dt className="text-xs text-slate-500 inline-flex items-center gap-1">
                      <Gauge className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                      Давление и видимость
                    </dt>
                    <dd className="text-sm font-bold text-slate-900 tabular-nums">
                      {forecast.current.pressureMmHg} мм рт. ст.
                    </dd>
                    <p className="text-xs text-slate-500 inline-flex items-center gap-1 tabular-nums">
                      <Eye className="w-3 h-3" aria-hidden="true" />
                      Видимость {forecast.current.visibilityKm} км
                    </p>
                  </div>

                  <div className="space-y-1">
                    <dt className="text-xs text-slate-500 inline-flex items-center gap-1">
                      <Compass className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                      {forecast.current.surfaceOrWaterLabel}
                    </dt>
                    <dd className="text-sm font-bold text-slate-900">
                      {forecast.current.surfaceOrWaterValue}
                    </dd>
                    <p className="text-xs text-slate-500">{forecast.durationLabel}</p>
                  </div>
                </dl>

                {/* Guide operational readiness & microclimate note */}
                {guideStyle && (
                  <div className={`rounded-lg p-4 space-y-1.5 ${guideStyle.container}`}>
                    <div className={`flex items-start gap-2 text-sm font-semibold ${guideStyle.text}`}>
                      {guideStyle.icon}
                      <span>Статус для инструктора: {forecast.guideStatusLabel}</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed pl-6">
                      {forecast.guideAdvisory}
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed pl-6">
                      {forecast.microclimateSummary}
                    </p>
                  </div>
                )}

                {/* Hourly outlook */}
                <div className="space-y-2.5">
                  <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ближайшие часы по нитке маршрута
                  </h5>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {forecast.hourlyOutlook.map((hour) => (
                      <div
                        key={hour.timeLabel}
                        className="flex items-center justify-between gap-2 py-2 px-3 bg-slate-50 rounded-lg"
                      >
                        <div>
                          <p className="text-xs font-semibold text-slate-700 tabular-nums">
                            {hour.timeLabel}
                          </p>
                          <p className="text-xs text-slate-500 tabular-nums">
                            {hour.windMs} м/с · {hour.precipProbPct}%
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <WeatherConditionIcon kind={hour.condition} className="w-4 h-4" />
                          <span className="text-sm font-bold text-slate-900 tabular-nums">
                            {formatTemp(hour.tempC)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4-day outlook */}
                <div className="space-y-2.5">
                  <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Прогноз на 4 дня
                  </h5>
                  <div className="divide-y divide-slate-100 border-t border-slate-200">
                    {forecast.dailyOutlook.map((day) => (
                      <div
                        key={day.isoDate}
                        className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-sm"
                      >
                        <div className="flex items-center gap-3 min-w-[140px]">
                          <span className="font-semibold text-slate-900 w-16">{day.dayLabel}</span>
                          <span className="text-xs text-slate-500 tabular-nums">
                            {day.shortDateLabel}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-700 min-w-[180px]">
                          <WeatherConditionIcon kind={day.condition} className="w-4 h-4 shrink-0" />
                          <span>{day.conditionLabel}</span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-slate-500 tabular-nums ml-auto">
                          <span>Ветер до {day.windMaxMs} м/с</span>
                          <span>Осадки {day.precipProbPct}%</span>
                          <span className="text-sm font-bold text-slate-900 min-w-[82px] text-right">
                            {formatTemp(day.tempMinC)} … {formatTemp(day.tempMaxC)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
