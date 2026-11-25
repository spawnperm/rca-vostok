import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceSearchLang = 'ru-RU' | 'en-US';

export interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

export interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternativeLike;
  [index: number]: SpeechRecognitionAlternativeLike;
}

export interface SpeechRecognitionResultListLike {
  readonly length: number;
  item(index: number): SpeechRecognitionResultLike;
  [index: number]: SpeechRecognitionResultLike;
}

export interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

export interface SpeechRecognitionErrorEventLike {
  readonly error: string;
  readonly message?: string;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;

interface SpeechRecognitionWindow {
  SpeechRecognition?: SpeechRecognitionConstructorLike;
  webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
}

/**
 * Strips trailing sentence punctuation added by Web Speech engines
 * and collapses extra whitespace so CRM substring filters match cleanly.
 */
export function normalizeVoiceSearchQuery(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,!?;:…]+$/g, '')
    .trim();
}

export function mapSpeechRecognitionError(code?: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Доступ к микрофону запрещён. Разрешите использование микрофона в настройках браузера.';
    case 'no-speech':
      return 'Речь не распознана. Попробуйте сказать запрос чётче и ближе к микрофону.';
    case 'audio-capture':
      return 'Микрофон не найден. Проверьте подключение аудиоустройства.';
    case 'network':
      return 'Ошибка сети при распознавании речи. Проверьте подключение к интернету.';
    case 'aborted':
      return '';
    default:
      return 'Не удалось распознать речь. Попробуйте ещё раз.';
  }
}

export function getSpeechRecognitionConstructor(): SpeechRecognitionConstructorLike | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const speechWindow = window as unknown as SpeechRecognitionWindow;
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
}

export interface UseVoiceSearchOptions {
  initialLang?: VoiceSearchLang;
  onTranscript: (text: string, meta: { isFinal: boolean }) => void;
  onError?: (message: string, code: string) => void;
}

export interface UseVoiceSearchResult {
  supported: boolean;
  listening: boolean;
  lang: VoiceSearchLang;
  interimTranscript: string;
  setLang: (lang: VoiceSearchLang) => void;
  toggleLang: () => void;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

export function useVoiceSearch({
  initialLang = 'ru-RU',
  onTranscript,
  onError,
}: UseVoiceSearchOptions): UseVoiceSearchResult {
  const [supported] = useState<boolean>(() => getSpeechRecognitionConstructor() !== null);
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState<VoiceSearchLang>(initialLang);
  const [interimTranscript, setInterimTranscript] = useState('');

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const stop = useCallback(() => {
    const active = recognitionRef.current;
    if (active) {
      try {
        active.stop();
      } catch {
        // Ignore stop errors if recognition already ended
      }
    }
    setListening(false);
    setInterimTranscript('');
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) {
      onErrorRef.current?.(
        'Голосовой поиск не поддерживается в этом браузере. Используйте Chrome, Edge или Safari.',
        'unsupported'
      );
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore abort cleanup error
      }
      recognitionRef.current = null;
    }

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setInterimTranscript('');
    };

    recognition.onresult = (event) => {
      let finalChunk = '';
      let interimChunk = '';

      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result?.[0]?.transcript || '';
        if (result.isFinal) {
          finalChunk += `${transcript} `;
        } else {
          interimChunk += `${transcript} `;
        }
      }

      const normalizedFinal = normalizeVoiceSearchQuery(finalChunk);
      const normalizedInterim = normalizeVoiceSearchQuery(interimChunk);

      if (normalizedFinal) {
        setInterimTranscript('');
        onTranscriptRef.current(normalizedFinal, { isFinal: true });
      } else if (normalizedInterim) {
        setInterimTranscript(normalizedInterim);
        onTranscriptRef.current(normalizedInterim, { isFinal: false });
      }
    };

    recognition.onerror = (event) => {
      const code = event.error || 'unknown';
      const mapped = mapSpeechRecognitionError(code);
      setListening(false);
      setInterimTranscript('');
      if (mapped) {
        onErrorRef.current?.(mapped, code);
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
      setListening(false);
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      onErrorRef.current?.('Не удалось запустить микрофон. Повторите попытку.', 'start-failed');
    }
  }, [lang]);

  const toggle = useCallback(() => {
    if (listening) {
      stop();
    } else {
      start();
    }
  }, [listening, start, stop]);

  const toggleLang = useCallback(() => {
    setLang((prev) => (prev === 'ru-RU' ? 'en-US' : 'ru-RU'));
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore unmount abort errors
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    supported,
    listening,
    lang,
    interimTranscript,
    setLang,
    toggleLang,
    start,
    stop,
    toggle,
  };
}
