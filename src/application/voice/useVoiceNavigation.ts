import { useCallback, useEffect, useRef, useState } from 'react';
import type { PortalSectionId } from '../../presentation/types.ts';
import {
  getSpeechRecognitionConstructor,
  mapSpeechRecognitionError,
  normalizeVoiceSearchQuery,
  type SpeechRecognitionLike,
  type VoiceSearchLang,
} from '../crm/useVoiceSearch.ts';
import { dispatchVoiceSectionAction } from './voiceActionBus.ts';
import {
  parseVoiceNavigationCommand,
  type VoiceActionPayload,
  type VoiceSectionActionId,
} from './voiceNavigation.ts';

export interface VoiceNavigationFeedback {
  transcript: string;
  sectionId?: PortalSectionId;
  actionId?: VoiceSectionActionId;
  label?: string;
  status: 'navigated' | 'action' | 'forbidden' | 'unknown' | 'stopped';
  timestamp: number;
}

export interface UseVoiceNavigationOptions {
  allowedSections: Set<PortalSectionId>;
  activeSection: PortalSectionId;
  actorPermissions?: Iterable<string>;
  onNavigate: (sectionId: PortalSectionId) => void;
  onAction?: (
    actionId: VoiceSectionActionId,
    sectionId: PortalSectionId,
    label: string,
    payload?: VoiceActionPayload
  ) => boolean | void;
  onHelp?: () => void;
  onNotify?: (msg: string, tone?: 'ok' | 'err' | 'info' | 'warn') => void;
  initialLang?: VoiceSearchLang;
  enableKeyboardShortcut?: boolean;
}

export interface UseVoiceNavigationResult {
  supported: boolean;
  listening: boolean;
  lang: VoiceSearchLang;
  interimTranscript: string;
  lastFeedback: VoiceNavigationFeedback | null;
  setLang: (lang: VoiceSearchLang) => void;
  toggleLang: () => void;
  start: () => void;
  stop: () => void;
  toggle: () => void;
  executeTranscript: (transcript: string) => void;
}

export function useVoiceNavigation({
  allowedSections,
  activeSection,
  actorPermissions,
  onNavigate,
  onAction,
  onHelp,
  onNotify,
  initialLang = 'ru-RU',
  enableKeyboardShortcut = true,
}: UseVoiceNavigationOptions): UseVoiceNavigationResult {
  const [supported] = useState<boolean>(() => getSpeechRecognitionConstructor() !== null);
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState<VoiceSearchLang>(initialLang);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [lastFeedback, setLastFeedback] = useState<VoiceNavigationFeedback | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wantsListeningRef = useRef(false);
  const processedIndexRef = useRef(0);
  const restartTimerRef = useRef<number | null>(null);

  const allowedSectionsRef = useRef(allowedSections);
  const activeSectionRef = useRef(activeSection);
  const actorPermissionsRef = useRef(actorPermissions);
  const onNavigateRef = useRef(onNavigate);
  const onActionRef = useRef(onAction);
  const onHelpRef = useRef(onHelp);
  const onNotifyRef = useRef(onNotify);

  useEffect(() => {
    allowedSectionsRef.current = allowedSections;
  }, [allowedSections]);

  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

  useEffect(() => {
    actorPermissionsRef.current = actorPermissions;
  }, [actorPermissions]);

  useEffect(() => {
    onNavigateRef.current = onNavigate;
  }, [onNavigate]);

  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);

  useEffect(() => {
    onHelpRef.current = onHelp;
  }, [onHelp]);

  useEffect(() => {
    onNotifyRef.current = onNotify;
  }, [onNotify]);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    wantsListeningRef.current = false;
    clearRestartTimer();
    const active = recognitionRef.current;
    recognitionRef.current = null;
    if (active) {
      try {
        active.stop();
      } catch {
        // Ignore stop errors if already ended
      }
    }
    setListening(false);
    setInterimTranscript('');
  }, [clearRestartTimer]);

  const handleCommandAlternatives = useCallback(
    (candidates: string[]) => {
      const cleanedCandidates = candidates
        .map((c) => normalizeVoiceSearchQuery(c))
        .filter(Boolean);
      if (cleanedCandidates.length === 0) return;

      let resolved = parseVoiceNavigationCommand(
        cleanedCandidates[0],
        allowedSectionsRef.current,
        activeSectionRef.current,
        actorPermissionsRef.current
      );
      if (resolved.kind === 'unknown' && cleanedCandidates.length > 1) {
        for (let i = 1; i < cleanedCandidates.length; i += 1) {
          const altResult = parseVoiceNavigationCommand(
            cleanedCandidates[i],
            allowedSectionsRef.current,
            activeSectionRef.current,
            actorPermissionsRef.current
          );
          if (altResult.kind !== 'unknown') {
            resolved = altResult;
            break;
          }
        }
      }

      const primaryTranscript = cleanedCandidates[0];
      const now = Date.now();

      if (resolved.kind === 'action') {
        const customHandled = onActionRef.current
          ? onActionRef.current(
              resolved.actionId,
              resolved.sectionId,
              resolved.label,
              resolved.payload
            )
          : dispatchVoiceSectionAction(
              resolved.sectionId,
              resolved.actionId,
              resolved.payload
            );

        if (customHandled === false) {
          setLastFeedback({
            transcript: primaryTranscript,
            sectionId: resolved.sectionId,
            actionId: resolved.actionId,
            label: resolved.label,
            status: 'forbidden',
            timestamp: now,
          });
          if (!resolved.payload) {
            onNotifyRef.current?.(
              `Действие «${resolved.label}» сейчас недоступно`,
              'warn'
            );
          }
          return;
        }

        setLastFeedback({
          transcript: primaryTranscript,
          sectionId: resolved.sectionId,
          actionId: resolved.actionId,
          label: resolved.label,
          status: 'action',
          timestamp: now,
        });
        if (!resolved.payload) {
          onNotifyRef.current?.(`Голосовое действие: «${resolved.label}»`, 'ok');
        }
        return;
      }

      if (resolved.kind === 'action_forbidden') {
        setLastFeedback({
          transcript: primaryTranscript,
          sectionId: resolved.sectionId,
          actionId: resolved.actionId,
          label: resolved.label,
          status: 'forbidden',
          timestamp: now,
        });
        onNotifyRef.current?.(
          `Нет прав для действия «${resolved.label}» для текущей роли`,
          'err'
        );
        return;
      }

      if (resolved.kind === 'navigate') {
        const alreadyThere = activeSectionRef.current === resolved.sectionId;
        onNavigateRef.current(resolved.sectionId);
        setLastFeedback({
          transcript: primaryTranscript,
          sectionId: resolved.sectionId,
          label: resolved.label,
          status: 'navigated',
          timestamp: now,
        });
        onNotifyRef.current?.(
          alreadyThere
            ? `Вы уже в разделе «${resolved.label}»`
            : `Голосовая команда: «${resolved.label}»`,
          alreadyThere ? 'info' : 'ok'
        );
        return;
      }

      if (resolved.kind === 'forbidden') {
        setLastFeedback({
          transcript: primaryTranscript,
          sectionId: resolved.sectionId,
          label: resolved.label,
          status: 'forbidden',
          timestamp: now,
        });
        onNotifyRef.current?.(
          `Нет доступа к разделу «${resolved.label}» для текущей роли`,
          'err'
        );
        return;
      }

      if (resolved.kind === 'stop') {
        setLastFeedback({
          transcript: primaryTranscript,
          status: 'stopped',
          timestamp: now,
        });
        stop();
        onNotifyRef.current?.('Голосовая навигация остановлена', 'info');
        return;
      }

      if (resolved.kind === 'help') {
        onHelpRef.current?.();
        return;
      }

      setLastFeedback({
        transcript: primaryTranscript,
        status: 'unknown',
        timestamp: now,
      });
    },
    [stop]
  );

  const startSession = useCallback(
    (targetLang: VoiceSearchLang) => {
      const Ctor = getSpeechRecognitionConstructor();
      if (!Ctor) {
        wantsListeningRef.current = false;
        setListening(false);
        onNotifyRef.current?.(
          'Голосовое управление не поддерживается в этом браузере. Используйте Chrome, Edge или Safari.',
          'err'
        );
        return;
      }

      clearRestartTimer();

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore cleanup errors
        }
        recognitionRef.current = null;
      }

      const recognition = new Ctor();
      recognition.lang = targetLang;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;
      processedIndexRef.current = 0;

      recognition.onstart = () => {
        setListening(true);
        setInterimTranscript('');
      };

      recognition.onresult = (event) => {
        let latestInterim = '';

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          if (!result) continue;

          if (result.isFinal) {
            if (i < processedIndexRef.current) continue;
            processedIndexRef.current = i + 1;

            const alternatives: string[] = [];
            for (let altIdx = 0; altIdx < result.length; altIdx += 1) {
              const altText = result[altIdx]?.transcript;
              if (altText) alternatives.push(altText);
            }
            setInterimTranscript('');
            handleCommandAlternatives(alternatives);
          } else {
            const text = result[0]?.transcript || '';
            latestInterim += `${text} `;
          }
        }

        const normalizedInterim = normalizeVoiceSearchQuery(latestInterim);
        if (normalizedInterim) {
          setInterimTranscript(normalizedInterim);
        }
      };

      recognition.onerror = (event) => {
        const code = event.error || 'unknown';
        // In continuous mode, no-speech happens periodically during pauses
        if (code === 'no-speech') {
          return;
        }

        // Fatal permission/hardware errors or intentional/external abort -> stop cleanly
        wantsListeningRef.current = false;
        clearRestartTimer();
        if (recognitionRef.current === recognition) {
          recognitionRef.current = null;
        }
        setListening(false);
        setInterimTranscript('');

        if (code !== 'aborted') {
          const mapped = mapSpeechRecognitionError(code);
          if (mapped) {
            onNotifyRef.current?.(mapped, 'err');
          }
        }
      };

      recognition.onend = () => {
        if (recognitionRef.current === recognition) {
          recognitionRef.current = null;
        }
        setInterimTranscript('');

        if (wantsListeningRef.current) {
          clearRestartTimer();
          restartTimerRef.current = window.setTimeout(() => {
            if (wantsListeningRef.current) {
              startSession(targetLang);
            }
          }, 250);
        } else {
          setListening(false);
        }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        recognitionRef.current = null;
        wantsListeningRef.current = false;
        setListening(false);
        onNotifyRef.current?.('Не удалось запустить микрофон. Повторите попытку.', 'err');
      }
    },
    [clearRestartTimer, handleCommandAlternatives]
  );

  const start = useCallback(() => {
    wantsListeningRef.current = true;
    startSession(lang);
  }, [lang, startSession]);

  const toggle = useCallback(() => {
    if (listening || wantsListeningRef.current) {
      stop();
    } else {
      start();
    }
  }, [listening, start, stop]);

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next: VoiceSearchLang = prev === 'ru-RU' ? 'en-US' : 'ru-RU';
      if (wantsListeningRef.current) {
        window.setTimeout(() => {
          if (wantsListeningRef.current) {
            startSession(next);
          }
        }, 0);
      }
      return next;
    });
  }, [startSession]);

  const executeTranscript = useCallback(
    (transcript: string) => {
      handleCommandAlternatives([transcript]);
    },
    [handleCommandAlternatives]
  );

  useEffect(() => {
    if (!enableKeyboardShortcut) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'KeyM') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enableKeyboardShortcut, toggle]);

  useEffect(() => {
    return () => {
      wantsListeningRef.current = false;
      clearRestartTimer();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore unmount abort errors
        }
        recognitionRef.current = null;
      }
    };
  }, [clearRestartTimer]);

  return {
    supported,
    listening,
    lang,
    interimTranscript,
    lastFeedback,
    setLang,
    toggleLang,
    start,
    stop,
    toggle,
    executeTranscript,
  };
}
