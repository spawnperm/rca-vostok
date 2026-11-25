import React from 'react';
import { Bell, X } from 'lucide-react';

export interface ToastNotification {
  id: string;
  title?: string;
  msg: string;
  subject?: string;
  tone: 'ok' | 'err' | 'info' | 'warn';
  source: 'ui' | 'nats';
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastStackProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
}

export const ToastStack: React.FC<ToastStackProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Уведомления системы"
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
    >
      {toasts.map((item) => {
        const isLightToast = item.tone === 'err' || item.tone === 'warn';
        const toneClass =
          item.tone === 'err'
            ? 'border-red-200 bg-red-50 text-red-950'
            : item.tone === 'warn'
            ? 'border-amber-200 bg-amber-50 text-amber-950'
            : 'border-slate-800 bg-slate-900 text-white';

        return (
          <div
            key={item.id}
            role={item.tone === 'err' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-xs shadow-lg ${toneClass}`}
          >
            {item.source === 'nats' && (
              <Bell
                aria-hidden="true"
                className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                  item.tone === 'err'
                    ? 'text-red-600'
                    : item.tone === 'warn'
                    ? 'text-amber-600'
                    : 'text-sky-400'
                }`}
              />
            )}
            <div className="min-w-0 flex-1">
              {item.source === 'nats' && (
                <div
                  className={`flex items-center gap-1.5 text-[11px] font-semibold ${
                    item.tone === 'err'
                      ? 'text-red-800'
                      : item.tone === 'warn'
                      ? 'text-amber-900'
                      : 'text-sky-300'
                  }`}
                >
                  <span>{item.title}</span>
                  <span className={isLightToast ? 'text-slate-400' : 'text-slate-500'}>·</span>
                  <span
                    className={`truncate font-mono text-[10px] font-normal ${
                      isLightToast ? 'text-slate-600' : 'text-slate-400'
                    }`}
                  >
                    {item.subject}
                  </span>
                </div>
              )}
              <div
                className={
                  item.source === 'nats'
                    ? isLightToast
                      ? 'mt-0.5 break-words text-slate-900'
                      : 'mt-0.5 break-words text-slate-100'
                    : 'font-medium'
                }
              >
                {item.msg}
              </div>
              {item.actionLabel && item.onAction && (
                <button
                  type="button"
                  onClick={() => {
                    item.onAction?.();
                    onDismiss(item.id);
                  }}
                  className={`mt-1.5 inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                    isLightToast
                      ? 'bg-white/80 text-slate-800 ring-1 ring-black/10 hover:bg-white'
                      : 'bg-white/10 text-sky-300 hover:bg-white/20'
                  }`}
                >
                  {item.actionLabel}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              aria-label="Закрыть уведомление"
              className={`shrink-0 rounded p-0.5 ${
                isLightToast
                  ? 'text-slate-500 hover:bg-black/5 hover:text-slate-900'
                  : 'text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
