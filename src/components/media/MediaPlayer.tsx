import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pause,
  Play,
  Volume2,
  VolumeX,
  Maximize2,
  SkipBack,
  SkipForward,
  Settings,
} from 'lucide-react';

/**
 * Professional media player.
 *
 * One component covers audio and video with a shared transport: play/pause,
 * seek, volume with mute, playback-rate menu, fullscreen for video, keyboard
 * shortcuts (space, arrows, m, f) and buffered-range indication. It is driven
 * by native <audio>/<video> elements, so it inherits browser decoding and
 * accessibility instead of reimplementing them.
 */

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export interface MediaPlayerProps {
  src: string;
  kind: 'video' | 'audio';
  title?: string;
  poster?: string;
  /** Optional playlist controls. */
  onNext?: () => void;
  onPrev?: () => void;
}

export function MediaPlayer({
  src,
  kind,
  title,
  poster,
  onNext,
  onPrev,
}: MediaPlayerProps) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<boolean>(false);
  const [current, setCurrent] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [buffered, setBuffered] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [muted, setMuted] = useState<boolean>(false);
  const [rate, setRate] = useState<number>(1);
  const [showRates, setShowRates] = useState<boolean>(false);
  const [waiting, setWaiting] = useState<boolean>(false);

  const toggle = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
    } else {
      el.pause();
    }
  }, []);

  // Media element events drive all state; the element is the single source of
  // truth so external plays/pauses stay in sync with the UI.
  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;

    const onTime = () => setCurrent(el.currentTime);
    const onDuration = () => setDuration(el.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onWaiting = () => setWaiting(true);
    const onPlaying = () => setWaiting(false);
    const onProgress = () => {
      try {
        if (el.buffered.length > 0) {
          setBuffered(el.buffered.end(el.buffered.length - 1));
        }
      } catch {
        // Some browsers throw before metadata loads.
      }
    };

    el.addEventListener('timeupdate', onTime);
    el.addEventListener('durationchange', onDuration);
    el.addEventListener('loadedmetadata', onDuration);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('waiting', onWaiting);
    el.addEventListener('playing', onPlaying);
    el.addEventListener('progress', onProgress);

    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('durationchange', onDuration);
      el.removeEventListener('loadedmetadata', onDuration);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('waiting', onWaiting);
      el.removeEventListener('playing', onPlaying);
      el.removeEventListener('progress', onProgress);
    };
  }, [src]);

  // Reset transport state when the source changes (playlist navigation).
  useEffect(() => {
    setCurrent(0);
    setDuration(0);
    setBuffered(0);
    setPlaying(false);
  }, [src]);

  const seek = (value: number) => {
    const el = mediaRef.current;
    if (!el) return;
    el.currentTime = value;
    setCurrent(value);
  };

  const applyVolume = (value: number) => {
    const el = mediaRef.current;
    if (!el) return;
    el.volume = value;
    el.muted = value === 0;
    setVolume(value);
    setMuted(value === 0);
  };

  const toggleMute = () => {
    const el = mediaRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  };

  const applyRate = (value: number) => {
    const el = mediaRef.current;
    if (!el) return;
    el.playbackRate = value;
    setRate(value);
    setShowRates(false);
  };

  const fullscreen = () => {
    const el = mediaRef.current;
    if (el && 'requestFullscreen' in el) {
      void el.requestFullscreen();
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const el = mediaRef.current;
    if (!el) return;

    switch (event.key) {
      case ' ':
        event.preventDefault();
        toggle();
        break;
      case 'ArrowRight':
        event.preventDefault();
        seek(Math.min(el.currentTime + 5, duration || el.currentTime + 5));
        break;
      case 'ArrowLeft':
        event.preventDefault();
        seek(Math.max(el.currentTime - 5, 0));
        break;
      case 'm':
        toggleMute();
        break;
      case 'f':
        if (kind === 'video') fullscreen();
        break;
      default:
        break;
    }
  };

  const progressPct = duration > 0 ? (current / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? Math.min((buffered / duration) * 100, 100) : 0;

  return (
    <div
      tabIndex={0}
      onKeyDown={onKeyDown}
      role="region"
      aria-label={title ? `Проигрыватель: ${title}` : 'Медиапроигрыватель'}
      className="bg-slate-900 rounded-xl overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
    >
      {kind === 'video' ? (
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          src={src}
          poster={poster}
          playsInline
          preload="metadata"
          className="w-full max-h-[70vh] bg-black"
          onClick={toggle}
        />
      ) : (
        <div className="px-5 pt-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-teal-600/20 border border-teal-500/30 flex items-center justify-center shrink-0">
            <Volume2 className="w-5 h-5 text-teal-400" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {title || 'Аудиозапись'}
            </p>
            <p className="text-xs text-slate-400">
              {formatTime(current)} / {formatTime(duration)}
            </p>
          </div>
        </div>
      )}

      <audio ref={mediaRef as React.RefObject<HTMLAudioElement>} src={src} preload="metadata" />

      {/* Transport */}
      <div className="px-4 py-3 space-y-2 bg-slate-900">
        {/* Seek bar with buffered range */}
        <div className="relative h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-slate-500/60"
            style={{ width: `${bufferedPct}%` }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-y-0 left-0 bg-teal-500"
            style={{ width: `${progressPct}%` }}
            aria-hidden="true"
          />
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={current}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Позиция воспроизведения"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        <div className="flex items-center gap-3">
          {onPrev && (
            <button
              type="button"
              onClick={onPrev}
              aria-label="Предыдущий"
              className="p-1.5 text-slate-300 hover:text-white cursor-pointer"
            >
              <SkipBack className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? 'Пауза' : 'Воспроизвести'}
            className="w-9 h-9 rounded-full bg-teal-600 hover:bg-teal-500 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            {playing ? (
              <Pause className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" aria-hidden="true" />
            )}
          </button>

          {onNext && (
            <button
              type="button"
              onClick={onNext}
              aria-label="Следующий"
              className="p-1.5 text-slate-300 hover:text-white cursor-pointer"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          )}

          <span className="text-xs text-slate-300 tabular-nums shrink-0">
            {formatTime(current)} / {formatTime(duration)}
          </span>

          {waiting && <span className="text-[10px] text-teal-400">загрузка…</span>}

          <div className="flex-1" />

          {/* Volume */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? 'Включить звук' : 'Выключить звук'}
              className="p-1.5 text-slate-300 hover:text-white cursor-pointer"
            >
              {muted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => applyVolume(Number(e.target.value))}
              aria-label="Громкость"
              className="w-16 accent-teal-500 cursor-pointer"
            />
          </div>

          {/* Playback rate */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowRates((v) => !v)}
              aria-label="Скорость воспроизведения"
              className="p-1.5 text-slate-300 hover:text-white inline-flex items-center gap-1 cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              <span className="text-[11px] tabular-nums">{rate}×</span>
            </button>
            {showRates && (
              <ul className="absolute right-0 bottom-full mb-1 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden shadow-xl z-10">
                {RATES.map((r) => (
                  <li key={r}>
                    <button
                      type="button"
                      onClick={() => applyRate(r)}
                      className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-700 cursor-pointer ${
                        r === rate ? 'text-teal-400 font-semibold' : 'text-slate-200'
                      }`}
                    >
                      {r}×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {kind === 'video' && (
            <button
              type="button"
              onClick={fullscreen}
              aria-label="Полный экран"
              className="p-1.5 text-slate-300 hover:text-white cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
