import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react';

/**
 * Photo viewer.
 *
 * Photographs are not media that "plays", so they do not belong in the <audio>
 * or <video> element the player wraps — an image piped into a media element
 * simply produces a broken control bar. This component covers what a photo
 * actually needs: fit-to-screen, zoom, pan when zoomed, keyboard navigation,
 * and fullscreen.
 */

export interface PhotoViewerProps {
  /** Ordered list of images; the viewer navigates within it. */
  photos: { id: string; url: string; title: string }[];
  /** Index of the photo to show first. */
  startIndex?: number;
  onClose: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.5;

export function PhotoViewer({ photos, startIndex = 0, onClose }: PhotoViewerProps) {
  const [index, setIndex] = useState<number>(
    Math.min(Math.max(startIndex, 0), Math.max(photos.length - 1, 0))
  );
  const [zoom, setZoom] = useState<number>(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState<boolean>(false);
  const [failed, setFailed] = useState<boolean>(false);
  const dragging = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const photo = photos[index];

  const reset = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const go = useCallback(
    (delta: number) => {
      if (photos.length <= 1) return;
      setIndex((current) => (current + delta + photos.length) % photos.length);
      reset();
      setLoaded(false);
      setFailed(false);
    },
    [photos.length, reset]
  );

  const zoomBy = useCallback(
    (delta: number) => {
      setZoom((current) => {
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current + delta));
        // Recentre when returning to fit, otherwise the image can stay parked
        // off-screen after panning.
        if (next === MIN_ZOOM) setOffset({ x: 0, y: 0 });
        return next;
      });
    },
    []
  );

  const fullscreen = () => {
    const el = containerRef.current;
    if (el && 'requestFullscreen' in el) void el.requestFullscreen();
  };

  // Keyboard: arrows navigate, +/- zoom, 0 resets, Escape closes.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          onClose();
          break;
        case 'ArrowRight':
          event.preventDefault();
          go(1);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          go(-1);
          break;
        case '+':
        case '=':
          event.preventDefault();
          zoomBy(ZOOM_STEP);
          break;
        case '-':
          event.preventDefault();
          zoomBy(-ZOOM_STEP);
          break;
        case '0':
          event.preventDefault();
          reset();
          break;
        case 'f':
          fullscreen();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, zoomBy, reset, onClose]);

  // Panning is only meaningful while zoomed in.
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (zoom <= MIN_ZOOM) return;
    dragging.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    setOffset({
      x: dragging.current.ox + (event.clientX - dragging.current.x),
      y: dragging.current.oy + (event.clientY - dragging.current.y),
    });
  };

  const onPointerUp = () => {
    dragging.current = null;
  };

  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={`Просмотр фотографии: ${photo.title}`}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{photo.title}</p>
          {photos.length > 1 && (
            <p className="text-[11px] text-slate-400 tabular-nums">
              {index + 1} из {photos.length}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => zoomBy(-ZOOM_STEP)}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Уменьшить"
            className="p-2 rounded hover:bg-white/10 disabled:opacity-40 cursor-pointer disabled:cursor-default"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="text-xs tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => zoomBy(ZOOM_STEP)}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Увеличить"
            className="p-2 rounded hover:bg-white/10 disabled:opacity-40 cursor-pointer disabled:cursor-default"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={reset}
            aria-label="Сбросить масштаб"
            className="p-2 rounded hover:bg-white/10 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={fullscreen}
            aria-label="Полный экран"
            className="p-2 rounded hover:bg-white/10 cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть просмотр"
            className="p-2 rounded hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden flex items-center justify-center bg-black"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ cursor: zoom > MIN_ZOOM ? 'grab' : 'default' }}
      >
        {!loaded && !failed && (
          <p className="absolute text-xs text-slate-400">Загружаем изображение…</p>
        )}

        {failed ? (
          <div className="text-center space-y-2 px-6">
            <p className="text-sm text-red-300">Не удалось загрузить изображение</p>
            <a
              href={photo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-300 underline underline-offset-2"
            >
              Открыть файл напрямую
            </a>
          </div>
        ) : (
          <img
            src={photo.url}
            alt={photo.title}
            draggable={false}
            onLoad={() => setLoaded(true)}
            onError={() => {
              setLoaded(true);
              setFailed(true);
            }}
            className="max-h-full max-w-full select-none"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transition: dragging.current ? 'none' : 'transform 120ms ease-out',
            }}
          />
        )}

        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Предыдущая фотография"
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Следующая фотография"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      <p className="px-4 py-2 text-[11px] text-slate-500 text-center">
        Стрелки — листать · +/− масштаб · 0 сброс · F полный экран · Esc закрыть
      </p>
    </div>
  );
}
