import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bot,
  Loader2,
  MessageSquare,
  RotateCcw,
  Send,
  Sparkles,
} from 'lucide-react';
import {
  ATTESTATION_CALENDAR_EVENTS,
  type AttestationCalendarEvent,
} from '../utils/attestationCalendar';
import {
  matchFaqScenarioReply,
  retrieveSectionRagContext,
} from '../utils/rcaRagEngine';
import { EMPIRICAL_TABLE, RCA_PROFILE } from '../data/researchData';
import { tracker } from '../utils/tracker';

interface ChatbotMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  sources?: string[];
  followUpQuery?: string;
}

const QUICK_QUESTIONS: readonly string[] = [
  'Какие документы нужны для подачи заявки в РЦА?',
  'Когда ближайшие аттестационные сессии в ДФО?',
  'Сколько стоит обучение в ВВГУ и есть ли госпошлина?',
  'Как подтвердить стаж по Контуру А без МКК?',
  'Какие компетенции проверяются на полигоне в Приморье?',
];

function nowTimeLabel(): string {
  try {
    return new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function buildDataGroundedReply(question: string): {
  text: string;
  sources: string[];
} {
  const q = question.toLowerCase().replace(/ё/g, 'е');

  // Check if user specifically asks about upcoming session dates / webinars / schedule
  if (
    q.includes('дат') ||
    q.includes('когда') ||
    q.includes('сесси') ||
    q.includes('вебинар') ||
    q.includes('расписан') ||
    q.includes('график')
  ) {
    const upcomingSessions = ATTESTATION_CALENDAR_EVENTS.filter(
      (ev: AttestationCalendarEvent) => ev.kind === 'session'
    ).slice(0, 4);
    const upcomingWebinars = ATTESTATION_CALENDAR_EVENTS.filter(
      (ev: AttestationCalendarEvent) => ev.kind === 'webinar'
    ).slice(0, 2);

    const lines: string[] = [
      'Ближайшие подтверждённые события РЦА «Русский Восток» по графику 2026–2027:',
      ...upcomingSessions.map(
        (s) => `· ${s.startDateIso} (${s.regionLabel}): ${s.title}`
      ),
      ...upcomingWebinars.map(
        (w) => `· ${w.startDateIso} ${w.startTimeVld} ВЛД (Онлайн): ${w.shortTitle}`
      ),
      `Площадка приёма комиссии: ${RCA_PROFILE.baseInstitution}.`,
    ];

    return {
      text: lines.join('\n'),
      sources: ['Календарь сессий и вебинаров РЦА 2026–2027', 'Профиль ВВГУ и РЦА'],
    };
  }

  // Check if user asks about market numbers / registry deficit / statistics
  if (
    q.includes('дефицит') ||
    q.includes('реестр') ||
    q.includes('цифр') ||
    q.includes('потребност') ||
    q.includes('статистик')
  ) {
    const highlighted = EMPIRICAL_TABLE.filter((r) => r.highlight).slice(0, 4);
    if (highlighted.length > 0 && (q.includes('дефицит') || q.includes('потребност') || q.includes('цифр'))) {
      return {
        text: [
          'По эмпирическим данным платформы РЦА «Русский Восток»:',
          ...highlighted.map((r) => `· ${r.indicator}: ${r.value} (${r.note})`),
        ].join('\n'),
        sources: ['Сводная эмпирическая таблица исследования', 'Данные Минтуризма и реестра РФ'],
      };
    }
  }

  const matched = matchFaqScenarioReply(question, 'overview');
  const sources = Array.from(
    new Set(matched.ragChunks.slice(0, 3).map((c) => c.sourceLabel))
  );

  return {
    text: matched.answer,
    sources: sources.length > 0 ? sources : ['База знаний РЦА «Русский Восток»'],
  };
}

interface OverviewAttestationChatbotProps {
  onApplyForSession: () => void;
  onContactCurator: (sourceLabel: string) => void;
}

export const OverviewAttestationChatbot: React.FC<OverviewAttestationChatbotProps> = ({
  onApplyForSession,
  onContactCurator,
}) => {
  const [messages, setMessages] = useState<ChatbotMessage[]>(() => [
    {
      id: 'bot-welcome',
      role: 'assistant',
      text: 'Здравствуйте! Я интерактивный бот-консультант РЦА «Русский Восток». Отвечаю на вопросы об аттестации инструкторов-проводников на основе нормативной базы, FAQ, графика сессий ДФО и программ ВВГУ.',
      timestamp: nowTimeLabel(),
      sources: ['База знаний РЦА', 'ПП РФ № 1003 / № 760 / № 891', 'График сессий 2026–2027'],
    },
  ]);
  const [draft, setDraft] = useState<string>('');
  const [aiBusy, setAiBusy] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const streamRef = useRef<HTMLDivElement | null>(null);

  const messageCountLabel = useMemo(
    () => `${messages.filter((m) => m.role === 'user').length} вопросов`,
    [messages]
  );

  const scrollBottom = () => {
    window.setTimeout(() => {
      if (streamRef.current) {
        streamRef.current.scrollTop = streamRef.current.scrollHeight;
      }
    }, 30);
  };

  const askFromPlatformData = (rawQuestion: string) => {
    const question = rawQuestion.trim();
    if (!question) return;
    setAiError(null);

    const userMsg: ChatbotMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: question,
      timestamp: nowTimeLabel(),
    };

    const reply = buildDataGroundedReply(question);
    const botMsg: ChatbotMessage = {
      id: `bot-${Date.now() + 1}`,
      role: 'assistant',
      text: reply.text,
      timestamp: nowTimeLabel(),
      sources: reply.sources,
      followUpQuery: question,
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setDraft('');
    tracker.trackCustomInteraction('Чат-бот Overview: вопрос', question.slice(0, 60));
    scrollBottom();
  };

  const refineWithAi = async (question: string) => {
    if (aiBusy) return;
    setAiError(null);
    setAiBusy(true);
    const rag = retrieveSectionRagContext(question, 'overview', 4);

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', text: question }],
          context: {
            activeTab: 'overview',
            sectionName: 'Обзор центра',
            ragPassages: rag.promptDigest,
          },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
      if (!res.ok || !data.reply) {
        throw new Error(data.error || 'ИИ-уточнение сейчас недоступно — используйте базу знаний выше.');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `bot-ai-${Date.now()}`,
          role: 'assistant',
          text: data.reply!,
          timestamp: nowTimeLabel(),
          sources: rag.chunks.slice(0, 3).map((c) => c.sourceLabel),
        },
      ]);
      scrollBottom();
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : 'ИИ-сервис временно недоступен; ответ уже сформирован по локальной базе РЦА.'
      );
    } finally {
      setAiBusy(false);
    }
  };

  const handleReset = () => {
    setMessages((prev) => prev.slice(0, 1));
    setDraft('');
    setAiError(null);
  };

  return (
    <section
      id="overview-attestation-chatbot"
      aria-labelledby="overview-chatbot-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Интерактивный чат-бот по данным РЦА · {messageCountLabel}</span>
          </p>
          <h2 id="overview-chatbot-heading" className="text-xl font-bold text-slate-900 text-balance">
            Консультант по аттестации инструкторов-проводников
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Задайте вопрос о документах, сроках, стоимости, Контуре А или графике сессий ДФО —
            бот мгновенно подберёт ответ по материалам платформы и нормативным документам.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Очистить диалог</span>
          </button>
          <button
            type="button"
            onClick={() => onContactCurator('Чат-бот в Обзоре центра')}
            className="px-3.5 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>Написать куратору</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Quick Topics & Context Actions (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3">
            <p className="text-xs font-semibold text-slate-800">Популярные вопросы соискателей</p>
            <div className="space-y-2">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => askFromPlatformData(q)}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:border-teal-600 hover:text-teal-900 transition-colors cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 text-white rounded-xl p-5 space-y-3">
            <p className="text-xs font-medium text-teal-300">Готовы к регистрации?</p>
            <p className="text-xs text-slate-300 leading-relaxed">
              После уточнения деталей вы можете перейти к анкете оповещений и выбрать ближайшую
              сессию в своём регионе ДФО.
            </p>
            <button
              type="button"
              onClick={onApplyForSession}
              className="w-full px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Перейти к подаче заявки</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Right: Chat Window (8 cols) */}
        <div className="lg:col-span-8 border border-slate-200 rounded-xl overflow-hidden flex flex-col bg-slate-50">
          <div
            ref={streamRef}
            aria-live="polite"
            className="p-4 sm:p-5 space-y-3.5 max-h-[360px] min-h-[260px] overflow-y-auto"
          >
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[90%] rounded-xl px-4 py-3 text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                      isUser
                        ? 'bg-teal-700 text-white rounded-br-xs'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
                    }`}
                  >
                    <p>{msg.text}</p>

                    {!isUser && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
                        <span>Источники: {msg.sources.join(' · ')}</span>
                        {msg.followUpQuery && (
                          <button
                            type="button"
                            disabled={aiBusy}
                            onClick={() => void refineWithAi(msg.followUpQuery!)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-800 hover:text-teal-950 disabled:opacity-50 cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3" aria-hidden="true" />
                            <span>Развернуть ответ</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="mt-1 px-1 text-[10px] font-mono text-slate-400 tabular-nums">
                    {isUser ? 'Вы' : 'Бот РЦА'} · {msg.timestamp}
                  </span>
                </div>
              );
            })}

            {aiBusy && (
              <div className="flex items-start">
                <div className="bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-600 inline-flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-teal-700 animate-spin" aria-hidden="true" />
                  <span>Подготавливаю развёрнутый ответ по базе РЦА…</span>
                </div>
              </div>
            )}
          </div>

          {aiError && (
            <p
              role="status"
              className="mx-4 mb-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900"
            >
              {aiError}
            </p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              askFromPlatformData(draft);
            }}
            className="p-3.5 bg-white border-t border-slate-200 flex items-center gap-2.5"
          >
            <label htmlFor="overview-chatbot-input" className="sr-only">
              Ваш вопрос чат-боту об аттестации
            </label>
            <input
              id="overview-chatbot-input"
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Спросите про документы, Контур А, госпошлину, даты сессий…"
              className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-teal-700"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
              <span>Отправить</span>
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};
