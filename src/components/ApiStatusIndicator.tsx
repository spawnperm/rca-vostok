import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import {
  createInitialSnapshot,
  createOfflineSnapshot,
  probeApiHealth,
  type ApiConnectionSnapshot,
} from '../utils/apiConnectionStatus';

const POLL_INTERVAL_MS = 5000;

function formatCheckTime(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export const ApiStatusIndicator: React.FC = () => {
  const [snapshot, setSnapshot] = useState<ApiConnectionSnapshot>(createInitialSnapshot);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [detailsOpen, setDetailsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inFlightRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);

  const runProbe = useCallback(async () => {
    if (inFlightRef.current) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setSnapshot(createOfflineSnapshot());
      return;
    }

    inFlightRef.current = true;
    setIsChecking(true);
    try {
      const next = await probeApiHealth();
      if (mountedRef.current) {
        setSnapshot(next);
      }
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setIsChecking(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void runProbe();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void runProbe();
      }
    }, POLL_INTERVAL_MS);

    const handleOffline = () => {
      setSnapshot(createOfflineSnapshot());
    };
    const handleOnline = () => {
      void runProbe();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void runProbe();
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      window.clearInterval(intervalId);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [runProbe]);

  useEffect(() => {
    if (!detailsOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setDetailsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDetailsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [detailsOpen]);

  const isConnected = snapshot.status === 'connected';
  const isDisconnected = snapshot.status === 'disconnected';

  const buttonClasses = isConnected
    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100/80'
    : isDisconnected
      ? 'bg-red-50 border-red-300 text-red-800 hover:bg-red-100/80'
      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100';

  const dotColor = isConnected
    ? 'bg-emerald-500'
    : isDisconnected
      ? 'bg-red-500'
      : 'bg-slate-400';

  const pingColor = isConnected
    ? 'bg-emerald-400'
    : isDisconnected
      ? 'bg-red-400'
      : 'bg-slate-300';

  const statusText = isConnected
    ? 'API онлайн'
    : isDisconnected
      ? 'Нет связи'
      : 'Проверка API';

  const shortText = isConnected ? 'API' : isDisconnected ? 'Нет связи' : 'API';

  const ariaLabel = isConnected
    ? `Соединение с API активно${snapshot.latencyMs !== null ? `, задержка ${snapshot.latencyMs} мс` : ''}`
    : isDisconnected
      ? `Потеряна связь с сервером API${snapshot.errorMessage ? `: ${snapshot.errorMessage}` : ''}`
      : 'Проверка соединения с сервером API';

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          setDetailsOpen((prev) => !prev);
          void runProbe();
        }}
        aria-label={ariaLabel}
        aria-expanded={detailsOpen}
        aria-haspopup="dialog"
        title={ariaLabel}
        data-testid="api-status-indicator"
        data-status={snapshot.status}
        className={`inline-flex items-center gap-2 px-2.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${buttonClasses}`}
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
          {(isConnected || isDisconnected) && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${pingColor}`}
            />
          )}
          <span
            className={`relative inline-flex rounded-full h-2.5 w-2.5 transition-colors ${dotColor}`}
          />
        </span>
        <span className="hidden xl:inline">{statusText}</span>
        <span className="hidden sm:inline xl:hidden">{shortText}</span>
      </button>

      {detailsOpen && (
        <div
          role="dialog"
          aria-label="Состояние соединения с API"
          className="absolute right-0 mt-2 w-72 rounded-xl bg-white border border-slate-200 shadow-lg p-4 z-50 text-left space-y-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              {isDisconnected ? (
                <WifiOff className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
              ) : (
                <Wifi
                  className={`w-4 h-4 shrink-0 ${isConnected ? 'text-emerald-600' : 'text-slate-500'}`}
                  aria-hidden="true"
                />
              )}
              <div>
                <p className="text-xs font-semibold text-slate-900">
                  {isConnected
                    ? 'Соединение с API активно'
                    : isDisconnected
                      ? 'Связь с сервером потеряна'
                      : 'Проверка подключения…'}
                </p>
                <p className="text-[11px] text-slate-500">
                  Мониторинг каждые {POLL_INTERVAL_MS / 1000} сек
                </p>
              </div>
            </div>
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full mt-1 shrink-0 ${dotColor}`}
              aria-hidden="true"
            />
          </div>

          {isDisconnected && snapshot.errorMessage && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-2.5 py-2 text-[11px] text-red-800">
              {snapshot.errorMessage}
            </div>
          )}

          <dl className="grid grid-cols-2 gap-2 text-[11px] border-t border-slate-100 pt-2.5">
            <div>
              <dt className="text-slate-500">Состояние</dt>
              <dd className={`font-semibold ${isDisconnected ? 'text-red-700' : isConnected ? 'text-emerald-700' : 'text-slate-700'}`}>
                {isConnected ? 'Онлайн' : isDisconnected ? 'Офлайн' : 'Проверка'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Задержка</dt>
              <dd className="font-mono font-medium text-slate-800">
                {snapshot.latencyMs !== null ? `${snapshot.latencyMs} мс` : '—'}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-500">Последняя проверка</dt>
              <dd className="font-mono font-medium text-slate-800">
                {formatCheckTime(snapshot.lastCheckedAt)}
              </dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={() => void runProbe()}
            disabled={isChecking}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-60 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{isChecking ? 'Проверка…' : 'Проверить сейчас'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
