import React from 'react';
import { Mic, MicOff, Search, X } from 'lucide-react';
import { useVoiceSearch } from '../../../application/crm/useVoiceSearch.ts';

interface VoiceSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel?: string;
  voiceHint?: string;
  onNotify?: (msg: string, tone?: 'ok' | 'err') => void;
  className?: string;
}

export const VoiceSearchInput: React.FC<VoiceSearchInputProps> = ({
  value,
  onChange,
  placeholder,
  ariaLabel = 'Поиск',
  voiceHint = 'Произнесите запрос',
  onNotify,
  className = '',
}) => {
  const { supported, listening, lang, interimTranscript, toggleLang, toggle, stop } = useVoiceSearch({
    initialLang: 'ru-RU',
    onTranscript: (text) => {
      onChange(text);
    },
    onError: (message) => {
      onNotify?.(message, 'err');
    },
  });

  const shortLang = lang === 'ru-RU' ? 'RU' : 'EN';

  return (
    <div className={`relative min-w-[240px] flex-1 ${className}`}>
      <div
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 transition-colors ${
          listening
            ? 'border-red-300 bg-red-50/40 ring-2 ring-red-100'
            : 'border-slate-200 bg-slate-50 focus-within:border-[#0077FF] focus-within:bg-white'
        }`}
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={listening ? 'Слушаю... произнесите запрос' : placeholder}
          aria-label={ariaLabel}
          className="min-w-0 flex-1 bg-transparent py-0.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none"
        />

        {value.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (listening) stop();
              onChange('');
            }}
            aria-label="Очистить поиск"
            title="Очистить поиск"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0077FF]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={toggleLang}
          disabled={listening}
          aria-label={`Язык распознавания речи: ${lang === 'ru-RU' ? 'Русский' : 'English'}. Нажмите для переключения`}
          title={`Язык голосового поиска: ${lang === 'ru-RU' ? 'Русский (ru-RU)' : 'English (en-US)'}`}
          className="inline-flex h-6 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white px-1.5 font-mono text-[10px] font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900 disabled:opacity-50 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0077FF]"
        >
          {shortLang}
        </button>

        <button
          type="button"
          onClick={toggle}
          aria-label={listening ? 'Остановить голосовой поиск' : 'Голосовой поиск'}
          aria-pressed={listening}
          title={
            !supported
              ? 'Голосовой поиск не поддерживается в этом браузере (используйте Chrome или Edge)'
              : listening
                ? 'Остановить запись речи'
                : `Голосовой поиск (${shortLang})`
          }
          className={`inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-[11px] font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0077FF] ${
            listening
              ? 'border border-red-200 bg-red-600 text-white hover:bg-red-700'
              : supported
                ? 'border border-slate-200 bg-white text-slate-700 hover:border-[#0077FF] hover:text-[#0077FF]'
                : 'border border-slate-200 bg-slate-100 text-slate-400 hover:text-slate-600'
          }`}
        >
          {listening ? <MicOff className="h-3 w-3 shrink-0" /> : <Mic className="h-3 w-3 shrink-0" />}
          <span>{listening ? 'Стоп' : 'Голос'}</span>
        </button>
      </div>

      {listening && (
        <div
          role="status"
          aria-live="polite"
          className="absolute left-0 top-full z-20 mt-1.5 flex max-w-full items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] text-red-700 shadow-sm"
        >
          <span className="shrink-0 font-medium">Запись ({shortLang})</span>
          <span aria-hidden="true">·</span>
          <span className="truncate text-slate-600">
            {interimTranscript ? `«${interimTranscript}»` : voiceHint}
          </span>
        </div>
      )}
    </div>
  );
};
