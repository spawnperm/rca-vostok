import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Headset,
  Loader2,
  RotateCcw,
  Send,
  X,
} from 'lucide-react';
import { ROLE_LABELS, type SessionUser } from '../utils/identityApi';
import type { UserAttestationSummary } from './AttestationProgressWidget';
import { tracker } from '../utils/tracker';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAtLabel: string;
}

interface RcaAssistantChatWidgetProps {
  user: SessionUser | null;
  progressSummary?: UserAttestationSummary | null;
  externalOpenRequest?: { prompt?: string; nonce: number } | null;
}

const QUICK_PROMPTS: readonly string[] = [
  'Как зачесть опыт походов по Контуру А?',
  'Какие документы нужны для аттестации?',
  'Что проверяют в паспорте маршрута (ПП № 760)?',
  'Сколько стоит ДПО ВВГУ и как получить субсидию 70%?',
];

const INITIAL_ASSISTANT_TEXT =
  'Здравствуйте! Я ИИ-ассистент службы поддержки РЦА «Русский Восток». Подскажу по правилам аттестации (ПП РФ № 1003, № 1893, № 760), программам ДПО ВВГУ, зачёту стажа по Контуру А и графику сессий 2027 года.';

function formatNowTime(): string {
  try {
    return new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function renderSafeAssistantText(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export const RcaAssistantChatWidget: React.FC<RcaAssistantChatWidgetProps> = ({
  user,
  progressSummary,
  externalOpenRequest,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: INITIAL_ASSISTANT_TEXT,
      createdAtLabel: formatNowTime(),
    },
  ]);
  const [draft, setDraft] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!externalOpenRequest?.nonce) return;
    setIsOpen(true);
    if (externalOpenRequest.prompt && externalOpenRequest.prompt.trim().length > 0) {
      setDraft(externalOpenRequest.prompt.trim());
    }
    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 60);
  }, [externalOpenRequest]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, busy, isOpen]);

  const sendMessage = async (textOverride?: string) => {
    const text = (textOverride ?? draft).trim();
    if (!text || busy) return;

    setError(null);
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      createdAtLabel: formatNowTime(),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    if (!textOverride) {
      setDraft('');
    }
    setBusy(true);

    tracker.trackCustomInteraction('ИИ-консультант РЦА · вопрос', text.slice(0, 60));

    try {
      const apiMessages = nextHistory
        .filter((m) => m.id !== 'welcome')
        .slice(-16)
        .map((m) => ({ role: m.role, text: m.text }));

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          messages: apiMessages,
          context: user
            ? {
                region: user.region,
                roleLabel: ROLE_LABELS[user.role],
                progressPercent: progressSummary?.percent,
                activeStageTitle: progressSummary?.activeStage.title,
              }
            : undefined,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        reply?: string;
        error?: string;
      };

      if (!res.ok || !data.reply) {
        throw new Error(
          data.error || 'Не удалось получить ответ от сервиса поддержки РЦА.'
        );
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: data.reply!,
          createdAtLabel: formatNowTime(),
        },
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Ошибка соединения с сервером ИИ-консультанта.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleReset = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        text: INITIAL_ASSISTANT_TEXT,
        createdAtLabel: formatNowTime(),
      },
    ]);
    setError(null);
    setDraft('');
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <div className="no-print fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
      {isOpen && (
        <section
          role="dialog"
          aria-modal="false"
          aria-labelledby="rca-ai-assistant-heading"
          className="w-[calc(100vw-2.5rem)] sm:w-[410px] bg-white border border-slate-200 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 rounded-lg bg-teal-700/90 border border-teal-500/40 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-white" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h4
                  id="rca-ai-assistant-heading"
                  className="text-sm font-bold leading-tight truncate"
                >
                  ИИ-ассистент поддержки РЦА
                </h4>
                <p className="text-[11px] text-slate-300 truncate">
                  Правила, НПА и регламенты «Русский Восток»
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleReset}
                title="Начать новый диалог"
                aria-label="Сбросить диалог"
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Свернуть чат поддержки"
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div
            ref={listRef}
            className="p-4 space-y-3 overflow-y-auto max-h-[340px] min-h-[240px] bg-slate-50"
          >
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed whitespace-pre-line ${
                      isUser
                        ? 'bg-teal-700 text-white rounded-br-xs'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
                    }`}
                  >
                    {isUser ? msg.text : renderSafeAssistantText(msg.text)}
                  </div>
                  {msg.createdAtLabel && (
                    <span className="mt-1 px-1 text-[10px] font-mono text-slate-400 tabular-nums">
                      {isUser ? 'Вы' : 'Консультант РЦА'} · {msg.createdAtLabel}
                    </span>
                  )}
                </div>
              );
            })}

            {busy && (
              <div className="flex items-start">
                <div className="bg-white border border-slate-200 rounded-xl rounded-bl-xs px-3.5 py-2.5 text-xs text-slate-600 inline-flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-teal-700 animate-spin" aria-hidden="true" />
                  <span>Готовлю ответ по регламентам РЦА…</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Suggested Prompts */}
          <div className="px-3.5 py-2.5 bg-white border-t border-slate-200 flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={busy}
                onClick={() => void sendMessage(q)}
                className="px-2.5 py-1 text-[11px] font-medium bg-slate-50 hover:bg-teal-50 text-slate-700 hover:text-teal-900 border border-slate-200 hover:border-teal-300 rounded-md transition-colors text-left disabled:opacity-50 cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="mx-3.5 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* Input Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage();
            }}
            className="p-3 bg-white border-t border-slate-200 flex items-end gap-2"
          >
            <label htmlFor="rca-assistant-input" className="sr-only">
              Вопрос ассистенту о правилах и регламентах РЦА
            </label>
            <textarea
              ref={inputRef}
              id="rca-assistant-input"
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              disabled={busy}
              placeholder="Спросите о ПП № 1893, Контуре А, документах или паспорте № 760…"
              className="flex-1 resize-none px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:border-teal-700 focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              aria-label="Отправить вопрос"
              className="p-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
            </button>
          </form>
        </section>
      )}

      {/* Floating Launcher Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => {
            const next = !prev;
            if (next) {
              tracker.trackCustomInteraction('Открытие ИИ-чата поддержки РЦА', 'account');
            }
            return next;
          });
        }}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Скрыть ИИ-консультант РЦА' : 'Открыть ИИ-консультант РЦА'}
        className={`inline-flex items-center gap-2.5 px-4 py-3 rounded-xl border text-xs sm:text-sm font-semibold shadow-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
          isOpen
            ? 'bg-teal-700 border-teal-800 text-white hover:bg-teal-800'
            : 'bg-slate-900 border-slate-800 text-white hover:bg-slate-800'
        }`}
      >
        <Headset className="w-4 h-4 text-teal-300 shrink-0" aria-hidden="true" />
        <span>ИИ-поддержка РЦА</span>
      </button>
    </div>
  );
};
