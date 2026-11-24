import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Bot,
  Headset,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { ROLE_LABELS, type SessionUser } from '../utils/identityApi';
import type { UserAttestationSummary } from './AttestationProgressWidget';
import { tracker } from '../utils/tracker';
import { SECTION_SEO_MAP, type SiteTabId } from '../utils/seo';
import {
  ALL_FAQ_SCENARIOS,
  getSectionRagSummary,
  matchFaqScenarioReply,
  retrieveSectionRagContext,
  type FaqScenarioItem,
} from '../utils/rcaRagEngine';

type AssistantMode = 'rag' | 'faq';
type FaqGroupFilter = 'all' | 'procedure' | 'training' | 'region';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAtLabel: string;
  modeTag?: string;
  sources?: string[];
  relatedScenarios?: FaqScenarioItem[];
  canEscalateToAi?: boolean;
  sourceQuestion?: string;
}

export interface RcaAssistantOpenDetail {
  prompt?: string;
  mode?: AssistantMode;
}

export interface RcaAssistantUserContextDetail {
  user: SessionUser | null;
  progressSummary: UserAttestationSummary | null;
}

export function dispatchOpenRcaAssistant(detail: RcaAssistantOpenDetail = {}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<RcaAssistantOpenDetail>('rca-assistant-open', { detail }));
}

export function dispatchRcaUserContext(detail: RcaAssistantUserContextDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<RcaAssistantUserContextDetail>('rca-assistant-user-context', { detail })
  );
}

interface RcaAssistantChatWidgetProps {
  activeTab?: SiteTabId;
  user?: SessionUser | null;
  progressSummary?: UserAttestationSummary | null;
  externalOpenRequest?: { prompt?: string; mode?: AssistantMode; nonce: number } | null;
}

const FAQ_GROUP_LABELS: { id: FaqGroupFilter; label: string }[] = [
  { id: 'all', label: 'Все сценарии' },
  { id: 'procedure', label: 'Процедура' },
  { id: 'training', label: 'Обучение' },
  { id: 'region', label: 'Специфика ДФО' },
];

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

function buildWelcomeMessage(sectionName: string, contextFocus: string): ChatMessage {
  return {
    id: 'welcome',
    role: 'assistant',
    text: `Здравствуйте! Я консультант РЦА «Русский Восток». Сейчас открыт раздел «${sectionName}» (${contextFocus}).\n\nВы можете задать вопрос ИИ-ассистенту с RAG-контекстом этого раздела или выбрать готовый FAQ-сценарий для мгновенного ответа без ожидания.`,
    createdAtLabel: formatNowTime(),
    modeTag: 'RAG + FAQ',
  };
}

export const RcaAssistantChatWidget: React.FC<RcaAssistantChatWidgetProps> = ({
  activeTab = 'home',
  user = null,
  progressSummary = null,
  externalOpenRequest = null,
}) => {
  const sectionSummary = useMemo(() => getSectionRagSummary(activeTab), [activeTab]);
  const sectionSeo = SECTION_SEO_MAP[activeTab] ?? SECTION_SEO_MAP.home;

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [mode, setMode] = useState<AssistantMode>('rag');
  const [faqGroup, setFaqGroup] = useState<FaqGroupFilter>('all');
  const [syncedUser, setSyncedUser] = useState<SessionUser | null>(user);
  const [syncedProgress, setSyncedProgress] = useState<UserAttestationSummary | null>(
    progressSummary
  );

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    buildWelcomeMessage(sectionSummary.sectionName, sectionSummary.contextFocus),
  ]);
  const [draft, setDraft] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setSyncedUser(user);
  }, [user]);

  useEffect(() => {
    setSyncedProgress(progressSummary);
  }, [progressSummary]);

  // Keep welcome banner synced to current section if dialogue has not started yet
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0]?.id === 'welcome') {
        return [buildWelcomeMessage(sectionSummary.sectionName, sectionSummary.contextFocus)];
      }
      return prev;
    });
  }, [sectionSummary.sectionName, sectionSummary.contextFocus]);

  // Global custom events for cross-tab triggers & AccountSection user context sync
  useEffect(() => {
    const onOpenEvent = (event: Event) => {
      const custom = event as CustomEvent<RcaAssistantOpenDetail>;
      setIsOpen(true);
      if (custom.detail?.mode) {
        setMode(custom.detail.mode);
      }
      if (custom.detail?.prompt && custom.detail.prompt.trim().length > 0) {
        setDraft(custom.detail.prompt.trim());
      }
      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 60);
    };

    const onContextEvent = (event: Event) => {
      const custom = event as CustomEvent<RcaAssistantUserContextDetail>;
      setSyncedUser(custom.detail?.user ?? null);
      setSyncedProgress(custom.detail?.progressSummary ?? null);
    };

    window.addEventListener('rca-assistant-open', onOpenEvent);
    window.addEventListener('rca-assistant-user-context', onContextEvent);
    return () => {
      window.removeEventListener('rca-assistant-open', onOpenEvent);
      window.removeEventListener('rca-assistant-user-context', onContextEvent);
    };
  }, []);

  useEffect(() => {
    if (!externalOpenRequest?.nonce) return;
    setIsOpen(true);
    if (externalOpenRequest.mode) {
      setMode(externalOpenRequest.mode);
    }
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

  const filteredFaqScenarios = useMemo(() => {
    if (faqGroup === 'all') return ALL_FAQ_SCENARIOS;
    return ALL_FAQ_SCENARIOS.filter((s) => s.group === faqGroup);
  }, [faqGroup]);

  const requestRagReply = async (historyToSend: ChatMessage[], latestUserText: string) => {
    setError(null);
    setBusy(true);

    const rag = retrieveSectionRagContext(latestUserText, activeTab, 4);

    try {
      const apiMessages = historyToSend
        .filter((m) => m.id !== 'welcome')
        .slice(-16)
        .map((m) => ({ role: m.role, text: m.text }));

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Requested-With': 'fetch',
        },
        body: JSON.stringify({
          messages: apiMessages,
          context: {
            ...(syncedUser
              ? {
                  region: syncedUser.region,
                  roleLabel: ROLE_LABELS[syncedUser.role],
                  progressPercent: syncedProgress?.percent,
                  activeStageTitle: syncedProgress?.activeStage.title,
                }
              : {}),
            activeTab,
            sectionName: sectionSummary.sectionName,
            sectionDescription: sectionSeo.description,
            ragPassages: rag.promptDigest,
          },
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        reply?: string;
        error?: string;
      };

      if (!res.ok || !data.reply) {
        throw new Error(
          data.error || 'Не удалось получить ответ от ИИ-сервиса поддержки РЦА.'
        );
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: data.reply!,
          createdAtLabel: formatNowTime(),
          modeTag: `ИИ + RAG · ${sectionSummary.sectionName}`,
          sources: rag.chunks.slice(0, 3).map((c) => c.sourceLabel),
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

  const triggerFaqScenarioReply = (
    queryOrScenarioId: string,
    displayPrompt?: string
  ) => {
    setError(null);
    const trimmed = queryOrScenarioId.trim();
    if (!trimmed) return;

    const scenarioMatch = ALL_FAQ_SCENARIOS.find(
      (s) => s.id === trimmed || s.faqId === trimmed
    );
    const userDisplayText = displayPrompt ?? scenarioMatch?.prompt ?? trimmed;
    const result = matchFaqScenarioReply(trimmed, activeTab);

    const userMsg: ChatMessage = {
      id: `user-faq-${Date.now()}`,
      role: 'user',
      text: userDisplayText,
      createdAtLabel: formatNowTime(),
    };

    const botMsg: ChatMessage = {
      id: `bot-faq-${Date.now() + 1}`,
      role: 'assistant',
      text: result.answer,
      createdAtLabel: formatNowTime(),
      modeTag: result.matchedFaq
        ? `Сценарий FAQ · ${result.matchedFaq.categoryLabel}`
        : `База знаний · ${sectionSummary.sectionName}`,
      sources: result.ragChunks.slice(0, 3).map((c) => c.sourceLabel),
      relatedScenarios: result.relatedScenarios,
      canEscalateToAi: true,
      sourceQuestion: userDisplayText,
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    tracker.trackCustomInteraction('FAQ-бот РЦА · сценарий', userDisplayText.slice(0, 60));
  };

  const sendMessage = async (textOverride?: string) => {
    const text = (textOverride ?? draft).trim();
    if (!text || busy) return;

    if (mode === 'faq') {
      if (!textOverride) setDraft('');
      triggerFaqScenarioReply(text, text);
      return;
    }

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

    tracker.trackCustomInteraction(
      `ИИ-консультант РЦА (${activeTab})`,
      text.slice(0, 60)
    );
    await requestRagReply(nextHistory, text);
  };

  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
  const canRetryLast =
    !busy &&
    mode === 'rag' &&
    messages.length > 0 &&
    messages[messages.length - 1]?.role === 'user';

  const handleRetryLast = () => {
    if (!canRetryLast || !lastUserMessage) return;
    void requestRagReply(messages, lastUserMessage.text);
  };

  const handleFaqFallbackOnError = () => {
    if (!lastUserMessage) return;
    setError(null);
    const result = matchFaqScenarioReply(lastUserMessage.text, activeTab);
    setMessages((prev) => [
      ...prev,
      {
        id: `bot-fallback-${Date.now()}`,
        role: 'assistant',
        text: result.answer,
        createdAtLabel: formatNowTime(),
        modeTag: 'Мгновенный ответ по базе FAQ + RAG',
        sources: result.ragChunks.slice(0, 3).map((c) => c.sourceLabel),
        relatedScenarios: result.relatedScenarios,
      },
    ]);
  };

  const handleEscalateQuestionToAi = (question: string) => {
    setMode('rag');
    void (async () => {
      const userMsg: ChatMessage = {
        id: `user-rag-${Date.now()}`,
        role: 'user',
        text: `Уточните подробнее с учётом раздела «${sectionSummary.sectionName}»: ${question}`,
        createdAtLabel: formatNowTime(),
      };
      const nextHistory = [...messages, userMsg];
      setMessages(nextHistory);
      await requestRagReply(nextHistory, question);
    })();
  };

  const handleReset = () => {
    setMessages([
      buildWelcomeMessage(sectionSummary.sectionName, sectionSummary.contextFocus),
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
          className="w-[calc(100vw-2rem)] sm:w-[430px] bg-white border border-slate-200 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 rounded-lg bg-teal-700/90 border border-teal-500/40 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-white" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h4
                  id="rca-ai-assistant-heading"
                  className="text-sm font-bold leading-tight truncate"
                >
                  Консультант РЦА · RAG + FAQ
                </h4>
                <p className="text-[11px] text-teal-300 truncate">
                  Контекст: {sectionSummary.sectionName}
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

          {/* Mode Switcher: AI RAG vs Instant FAQ Bot Scenarios */}
          <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMode('rag')}
              aria-pressed={mode === 'rag'}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                mode === 'rag'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
              <span>ИИ-чат (RAG)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('faq')}
              aria-pressed={mode === 'faq'}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                mode === 'faq'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
              <span>Сценарии FAQ</span>
            </button>
          </div>

          {/* Messages Stream */}
          <div
            ref={listRef}
            className="p-4 space-y-3 overflow-y-auto max-h-[300px] min-h-[210px] bg-slate-50"
          >
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed whitespace-pre-line ${
                      isUser
                        ? 'bg-teal-700 text-white rounded-br-xs'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
                    }`}
                  >
                    {!isUser && msg.modeTag && (
                      <p className="text-[10px] font-semibold text-teal-800 mb-1 uppercase tracking-wide">
                        {msg.modeTag}
                      </p>
                    )}

                    {isUser ? msg.text : renderSafeAssistantText(msg.text)}

                    {!isUser && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2 pt-1.5 border-t border-slate-100 text-[10px] text-slate-500">
                        <span className="font-semibold text-slate-600">Источники RAG: </span>
                        {msg.sources.join(' · ')}
                      </div>
                    )}

                    {!isUser && msg.relatedScenarios && msg.relatedScenarios.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                        <p className="text-[10px] font-semibold text-slate-500">
                          Связанные сценарии:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {msg.relatedScenarios.map((rel) => (
                            <button
                              key={rel.id}
                              type="button"
                              onClick={() => triggerFaqScenarioReply(rel.id, rel.prompt)}
                              className="px-2 py-1 text-[10px] font-medium bg-slate-50 hover:bg-teal-50 text-slate-700 hover:text-teal-900 border border-slate-200 rounded text-left cursor-pointer"
                            >
                              {rel.prompt}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {!isUser && msg.canEscalateToAi && msg.sourceQuestion && (
                      <button
                        type="button"
                        onClick={() => handleEscalateQuestionToAi(msg.sourceQuestion!)}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-teal-800 hover:text-teal-900 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" aria-hidden="true" />
                        <span>Уточнить индивидуально через ИИ (RAG)</span>
                      </button>
                    )}
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
                  <span>Анализирую контекст раздела «{sectionSummary.sectionName}»…</span>
                </div>
              </div>
            )}
          </div>

          {/* Section-Aware RAG Prompts OR Predefined FAQ Scenarios */}
          {mode === 'rag' ? (
            <div className="px-3.5 py-2.5 bg-white border-t border-slate-200 space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                Вопросы по разделу «{sectionSummary.sectionName}»
              </p>
              <div className="flex flex-wrap gap-1.5">
                {sectionSummary.suggestedQuestions.map((q) => (
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
            </div>
          ) : (
            <div className="px-3.5 py-2.5 bg-white border-t border-slate-200 space-y-2">
              <div className="flex flex-wrap items-center gap-1">
                {FAQ_GROUP_LABELS.map((grp) => {
                  const active = faqGroup === grp.id;
                  return (
                    <button
                      key={grp.id}
                      type="button"
                      onClick={() => setFaqGroup(grp.id)}
                      className={`px-2 py-1 text-[10px] font-semibold rounded border transition-colors cursor-pointer ${
                        active
                          ? 'bg-teal-700 text-white border-teal-700'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {grp.label}
                    </button>
                  );
                })}
              </div>

              <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                {filteredFaqScenarios.map((scenario) => (
                  <button
                    key={scenario.id}
                    type="button"
                    onClick={() => triggerFaqScenarioReply(scenario.id, scenario.prompt)}
                    className="w-full px-2.5 py-1.5 text-[11px] font-medium bg-slate-50 hover:bg-teal-50 text-slate-700 hover:text-teal-900 border border-slate-200 hover:border-teal-300 rounded-md transition-colors text-left cursor-pointer"
                  >
                    {scenario.prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="mx-3.5 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 space-y-2"
            >
              <div className="flex items-start gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{error}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canRetryLast && (
                  <button
                    type="button"
                    onClick={handleRetryLast}
                    className="px-2 py-1 text-[11px] font-semibold bg-white border border-red-200 text-red-800 hover:bg-red-100 rounded cursor-pointer"
                  >
                    Повторить
                  </button>
                )}
                {lastUserMessage && (
                  <button
                    type="button"
                    onClick={handleFaqFallbackOnError}
                    className="px-2 py-1 text-[11px] font-semibold bg-teal-700 text-white hover:bg-teal-800 rounded cursor-pointer"
                  >
                    Ответить по базе FAQ
                  </button>
                )}
              </div>
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
              placeholder={
                mode === 'faq'
                  ? 'Введите тему (Контур А, субсидия 70%, ПП № 760, продление 5 лет)…'
                  : `Спросите с учётом раздела «${sectionSummary.sectionName}»…`
              }
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
              tracker.trackCustomInteraction(
                'Открытие чата консультанта РЦА',
                activeTab
              );
            }
            return next;
          });
        }}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Скрыть консультант РЦА' : 'Открыть консультант РЦА'}
        className={`inline-flex items-center gap-2.5 px-4 py-3 rounded-xl border text-xs sm:text-sm font-semibold shadow-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
          isOpen
            ? 'bg-teal-700 border-teal-800 text-white hover:bg-teal-800'
            : 'bg-slate-900 border-slate-800 text-white hover:bg-slate-800'
        }`}
      >
        <Headset className="w-4 h-4 text-teal-300 shrink-0" aria-hidden="true" />
        <span>Консультант РЦА · FAQ</span>
      </button>
    </div>
  );
};
