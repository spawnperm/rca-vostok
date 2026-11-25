import React, { useEffect, useRef, useState } from 'react';
import { HelpCircle, Mic, MicOff, Sparkles, Volume2, X } from 'lucide-react';
import { useVoiceNavigation } from '../../application/voice/useVoiceNavigation.ts';
import {
  getVoiceActionsForSection,
  VOICE_SECTION_RULES,
  type VoiceActionPayload,
  type VoiceSectionActionId,
} from '../../application/voice/voiceNavigation.ts';
import type { PortalSectionId } from '../types.ts';

interface VoiceNavigationControlProps {
  allowedSections: Set<PortalSectionId>;
  activeSection: PortalSectionId;
  actorPermissions?: Iterable<string>;
  onNavigate: (sectionId: PortalSectionId) => void;
  onExecuteAction?: (
    actionId: VoiceSectionActionId,
    sectionId: PortalSectionId,
    label: string,
    payload?: VoiceActionPayload
  ) => boolean | void;
  onNotify: (msg: string, tone?: 'ok' | 'err' | 'info' | 'warn') => void;
}

export const VoiceNavigationControl: React.FC<VoiceNavigationControlProps> = ({
  allowedSections,
  activeSection,
  actorPermissions,
  onNavigate,
  onExecuteAction,
  onNotify,
}) => {
  const [helpOpen, setHelpOpen] = useState(false);
  const [manualCommand, setManualCommand] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  const {
    supported,
    listening,
    lang,
    interimTranscript,
    lastFeedback,
    toggleLang,
    toggle,
    stop,
    executeTranscript,
  } = useVoiceNavigation({
    allowedSections,
    activeSection,
    actorPermissions,
    onNavigate,
    onAction: onExecuteAction,
    onHelp: () => setHelpOpen(true),
    onNotify,
  });

  useEffect(() => {
    if (!helpOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setHelpOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setHelpOpen(false);
      }
    };
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [helpOpen]);

  const shortLang = lang === 'ru-RU' ? 'RU' : 'EN';
  const availableRules = VOICE_SECTION_RULES.filter((rule) => allowedSections.has(rule.id));
  const activeSectionActions = allowedSections.has(activeSection)
    ? getVoiceActionsForSection(activeSection, actorPermissions)
    : [];
  const activeSectionRule = VOICE_SECTION_RULES.find((r) => r.id === activeSection);
  const primaryActionHint = activeSectionActions[0]?.sampleCommand;

  const showRecentFeedback =
    lastFeedback && Date.now() - lastFeedback.timestamp < 5000 ? lastFeedback : null;

  return (
    <div ref={containerRef} className="relative flex items-center gap-1 shrink-0">
      <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
        <button
          type="button"
          onClick={toggle}
          aria-pressed={listening}
          aria-label={
            listening
              ? 'Остановить голосовое управление (Alt+M)'
              : 'Включить голосовое управление (Alt+M)'
          }
          title={
            !supported
              ? 'Web Speech API не поддерживается в этом браузере'
              : listening
                ? 'Остановить голосовые команды (Alt+M)'
                : 'Голосовая навигация и команды раздела (Alt+M)'
          }
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
            listening
              ? 'bg-red-600 text-white hover:bg-red-700'
              : supported
                ? 'text-slate-700 hover:bg-slate-100 hover:text-[#0077FF]'
                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
          }`}
        >
          {listening ? (
            <>
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" aria-hidden="true" />
              <MicOff className="h-3.5 w-3.5 shrink-0" />
              <span>Слушаю</span>
            </>
          ) : (
            <>
              <Mic className="h-3.5 w-3.5 shrink-0" />
              <span>Голос</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => setHelpOpen((prev) => !prev)}
          aria-expanded={helpOpen}
          aria-label="Справка по голосовым командам"
          title="Список голосовых команд"
          className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
            helpOpen
              ? 'bg-slate-100 text-[#0077FF]'
              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
          }`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Live listening status bar */}
      {listening && (
        <div
          role="status"
          aria-live="polite"
          className="absolute right-0 top-full z-40 mt-2 flex w-84 items-center justify-between gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs shadow-lg"
        >
          <div className="flex min-w-0 items-center gap-2">
            <Volume2 className="h-3.5 w-3.5 shrink-0 text-red-600" aria-hidden="true" />
            <div className="min-w-0">
              <div className="truncate font-medium text-slate-900">
                {interimTranscript
                  ? `«${interimTranscript}»`
                  : showRecentFeedback?.status === 'unknown'
                    ? `Не распознано: «${showRecentFeedback.transcript}»`
                    : showRecentFeedback?.status === 'forbidden'
                      ? `Нет доступа: ${showRecentFeedback.label}`
                      : showRecentFeedback?.status === 'action'
                        ? `Действие: ${showRecentFeedback.label}`
                        : showRecentFeedback?.status === 'navigated'
                          ? `Переход: ${showRecentFeedback.label}`
                          : 'Говорите команду навигации или действия...'}
              </div>
              <div className="truncate text-[11px] text-slate-500">
                {primaryActionHint
                  ? `Например: «${primaryActionHint}», «Открыть календарь»`
                  : 'Например: «Перейти к сделкам», «Открыть календарь»'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={stop}
            aria-label="Выключить микрофон"
            className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Voice commands reference popover */}
      {helpOpen && (
        <div
          role="dialog"
          aria-label="Голосовые команды навигации и действий"
          className="absolute right-0 top-full z-50 mt-2 w-84 rounded-xl border border-slate-200 bg-white p-3.5 text-xs shadow-xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div>
              <div className="font-semibold text-slate-900">Голосовое управление</div>
              <div className="text-[11px] text-slate-500">
                Горячая клавиша:{' '}
                <kbd className="rounded border border-slate-200 bg-slate-50 px-1 font-mono text-[10px]">
                  Alt+M
                </kbd>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleLang}
                title="Переключить язык распознавания речи"
                className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700 hover:border-slate-300"
              >
                {shortLang}
              </button>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                aria-label="Закрыть подсказку"
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {!supported && (
            <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
              Браузер не поддерживает Web Speech API. Для голосового управления используйте Chrome, Edge или Safari, либо введите команду ниже.
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const cmd = manualCommand.trim();
              if (!cmd) return;
              executeTranscript(cmd);
              setManualCommand('');
              setHelpOpen(false);
            }}
            className="mt-2.5 flex items-center gap-1.5"
          >
            <input
              type="text"
              value={manualCommand}
              onChange={(e) => setManualCommand(e.target.value)}
              placeholder={
                activeSection === 'deals'
                  ? 'Например: перевести сделку в статус Оплата'
                  : 'Выполнить голосовую команду...'
              }
              aria-label="Выполнить голосовую команду текстом"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-800 outline-none focus:border-[#0077FF] focus:bg-white"
            />
            <button
              type="submit"
              className="shrink-0 rounded-lg bg-[#0077FF] px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-blue-700"
            >
              Выполнить
            </button>
          </form>

          <div className="mt-2.5 max-h-80 space-y-3 overflow-y-auto pr-0.5">
            {activeSectionActions.length > 0 && (
              <div>
                <div className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-semibold text-[#0077FF]">
                  <Sparkles className="h-3 w-3 shrink-0" />
                  <span>
                    Действия в разделе «{activeSectionRule?.label || activeSection}»
                  </span>
                </div>
                <div className="space-y-1">
                  {activeSectionActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => {
                        executeTranscript(action.sampleCommand);
                        setHelpOpen(false);
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded-lg bg-[#0077FF]/5 px-2 py-1.5 text-left text-slate-800 transition-colors hover:bg-[#0077FF]/12"
                    >
                      <span className="truncate font-medium">«{action.sampleCommand}»</span>
                      <span className="shrink-0 text-[11px] text-[#0077FF]">{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="mb-1 px-1 text-[11px] font-semibold text-slate-500">
                Навигация по разделам
              </div>
              <div className="space-y-1">
                {availableRules.map((rule) => {
                  const isCurrent = activeSection === rule.id;
                  return (
                    <button
                      key={rule.id}
                      type="button"
                      onClick={() => {
                        executeTranscript(rule.sampleCommand);
                        setHelpOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                        isCurrent
                          ? 'bg-[#0077FF]/10 text-[#0077FF]'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate font-medium">«{rule.sampleCommand}»</span>
                      <span className="shrink-0 text-[11px] text-slate-400">{rule.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
            <span>Команды управления:</span>
            <span className="font-medium text-slate-700">«Стоп» · «Помощь»</span>
          </div>
        </div>
      )}
    </div>
  );
};
