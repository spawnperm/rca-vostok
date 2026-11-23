import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist/types/src/display/api';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  Expand,
  FileText,
  Layers,
  Minimize2,
  PanelLeft,
  RotateCw,
  ScrollText,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  BUILT_IN_ACADEMIC_WORKS,
  MAX_PDF_ZOOM,
  MIN_PDF_ZOOM,
  PDF_ZOOM_STEP,
  buildBuiltInAcademicPdfBytes,
  clampPdfPage,
  createUploadedAcademicWorkMeta,
  loadUploadedAcademicWorks,
  removeUploadedAcademicWork,
  rotatePdfQuarterTurn,
  saveUploadedAcademicWork,
  stepPdfZoom,
  validateAcademicPdfFile,
  type AcademicWorkCategory,
  type AcademicWorkDocument,
} from '../utils/dissertationPdfLibrary';
import { tracker } from '../utils/tracker';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type ReaderViewMode = 'single' | 'scroll';
type CategoryFilter = 'all' | AcademicWorkCategory;

interface PdfPageCanvasProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  containerWidth: number;
  zoom: number;
  rotation: 0 | 90 | 180 | 270;
  pageRef?: (el: HTMLDivElement | null) => void;
}

const PdfPageCanvas: React.FC<PdfPageCanvasProps> = ({
  pdfDoc,
  pageNumber,
  containerWidth,
  zoom,
  rotation,
  pageRef,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rendering, setRendering] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    const renderPage = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      setRendering(true);

      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1, rotation });
        const availableWidth = Math.max(containerWidth - 40, 260);
        const fitScale = Math.min(1.65, availableWidth / baseViewport.width);
        const effectiveScale = Math.max(0.4, fitScale * zoom);

        const viewport = page.getViewport({ scale: effectiveScale, rotation });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const transform: [number, number, number, number, number, number] | undefined =
          dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined;

        renderTask = page.render({
          canvas,
          viewport,
          transform,
        });

        await renderTask.promise;
        if (!cancelled) {
          setRendering(false);
        }
      } catch (err) {
        if (
          err &&
          typeof err === 'object' &&
          'name' in err &&
          (err as { name?: string }).name === 'RenderingCancelledException'
        ) {
          return;
        }
        if (!cancelled) {
          setRendering(false);
        }
      }
    };

    renderPage();

    return () => {
      cancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          // ignore cancellation error
        }
      }
    };
  }, [pdfDoc, pageNumber, containerWidth, zoom, rotation]);

  return (
    <div
      ref={pageRef}
      data-page-number={pageNumber}
      className="relative mx-auto bg-white shadow-lg rounded-xs overflow-hidden border border-slate-300/80"
    >
      <canvas ref={canvasRef} className="block mx-auto" />
      {rendering && (
        <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-xs font-medium text-slate-600">
          Отрисовка страницы {pageNumber}…
        </div>
      )}
    </div>
  );
};

interface PdfThumbnailProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  isActive: boolean;
  onSelect: (page: number) => void;
}

const PdfThumbnail: React.FC<PdfThumbnailProps> = ({
  pdfDoc,
  pageNumber,
  isActive,
  onSelect,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    const renderThumb = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const thumbScale = 104 / baseViewport.width;
        const viewport = page.getViewport({ scale: thumbScale });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        renderTask = page.render({ canvas, viewport });
        await renderTask.promise;
      } catch {
        // ignore thumbnail cancel/error
      }
    };

    renderThumb();
    return () => {
      cancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [pdfDoc, pageNumber]);

  return (
    <button
      type="button"
      onClick={() => onSelect(pageNumber)}
      aria-label={`Перейти на страницу ${pageNumber}`}
      className={`w-full flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-colors cursor-pointer ${
        isActive
          ? 'bg-teal-950/60 border-teal-400 text-white'
          : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:border-slate-500'
      }`}
    >
      <div className="bg-white rounded-xs overflow-hidden shadow-xs">
        <canvas ref={canvasRef} className="block" />
      </div>
      <span className="font-mono text-[11px] tabular-nums">{pageNumber}</span>
    </button>
  );
};

export const DissertationPdfReader: React.FC = () => {
  const [works, setWorks] = useState<AcademicWorkDocument[]>(BUILT_IN_ACADEMIC_WORKS);
  const [selectedWorkId, setSelectedWorkId] = useState<string>(BUILT_IN_ACADEMIC_WORKS[0].id);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [activeBytes, setActiveBytes] = useState<Uint8Array | null>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageInput, setPageInput] = useState<string>('1');

  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [viewMode, setViewMode] = useState<ReaderViewMode>('single');
  const [showThumbnails, setShowThumbnails] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const [isLoadingDoc, setIsLoadingDoc] = useState<boolean>(true);
  const [docError, setDocError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [stageWidth, setStageWidth] = useState<number>(680);

  // Load persisted user-uploaded PDFs from IndexedDB on mount
  useEffect(() => {
    let active = true;
    loadUploadedAcademicWorks().then((uploaded) => {
      if (!active || uploaded.length === 0) return;
      setWorks((prev) => {
        const existingIds = new Set(prev.map((w) => w.id));
        const fresh = uploaded.filter((u) => !existingIds.has(u.id));
        return [...fresh, ...prev];
      });
    });
    return () => {
      active = false;
    };
  }, []);

  // Observe PDF viewer container width for crisp Fit-to-Width baseline scaling
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const updateWidth = () => {
      const w = el.clientWidth;
      if (w > 0) setStageWidth(w);
    };
    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateWidth);
      observer.observe(el);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [isExpanded, showThumbnails]);

  const selectedWork = useMemo(
    () => works.find((w) => w.id === selectedWorkId) ?? works[0],
    [works, selectedWorkId]
  );

  const filteredWorks = useMemo(() => {
    if (categoryFilter === 'all') return works;
    return works.filter((w) => w.category === categoryFilter);
  }, [works, categoryFilter]);

  // Parse selected PDF binary via pdfjs-dist
  useEffect(() => {
    if (!selectedWork) return;
    let cancelled = false;
    let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;
    let loadedProxy: PDFDocumentProxy | null = null;

    const loadDocument = async () => {
      setIsLoadingDoc(true);
      setDocError(null);

      try {
        const bytes =
          selectedWork.source === 'uploaded' && selectedWork.bytes
            ? selectedWork.bytes
            : buildBuiltInAcademicPdfBytes(selectedWork);

        if (cancelled) return;
        setActiveBytes(bytes);

        // Pass a fresh slice so pdf.js worker never detaches the cached Uint8Array
        loadingTask = pdfjsLib.getDocument({ data: bytes.slice() });
        const doc = await loadingTask.promise;

        if (cancelled) {
          await doc.cleanup();
          return;
        }

        loadedProxy = doc;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);
        setPageInput('1');
        setRotation(0);
        setIsLoadingDoc(false);
      } catch (err) {
        if (cancelled) return;
        setPdfDoc(null);
        setIsLoadingDoc(false);
        setDocError(
          err instanceof Error
            ? `Не удалось открыть PDF-документ: ${err.message}`
            : 'Не удалось прочитать структуру выбранного PDF-файла.'
        );
      }
    };

    loadDocument();

    return () => {
      cancelled = true;
      if (loadedProxy) {
        loadedProxy.cleanup().catch(() => {});
      }
      if (loadingTask) {
        loadingTask.destroy().catch(() => {});
      }
    };
  }, [selectedWork]);

  const goToPage = useCallback(
    (nextPage: number) => {
      const clamped = clampPdfPage(nextPage, totalPages);
      setCurrentPage(clamped);
      setPageInput(String(clamped));

      if (viewMode === 'scroll') {
        const target = pageRefs.current.get(clamped);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    },
    [totalPages, viewMode]
  );

  // Escape exits expanded modal view
  useEffect(() => {
    if (!isExpanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExpanded(false);
      } else if (e.key === 'ArrowRight' && viewMode === 'single') {
        goToPage(currentPage + 1);
      } else if (e.key === 'ArrowLeft' && viewMode === 'single') {
        goToPage(currentPage - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isExpanded, viewMode, currentPage, goToPage]);

  const handleFilesUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploadError(null);

    const files = Array.from(fileList);
    let lastAddedId: string | null = null;

    for (const file of files) {
      const validation = validateAcademicPdfFile({
        name: file.name,
        type: file.type,
        size: file.size,
      });
      if (!validation.valid) {
        setUploadError(validation.error);
        continue;
      }

      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const docMeta = createUploadedAcademicWorkMeta(
          { name: file.name, size: file.size },
          bytes
        );

        await saveUploadedAcademicWork(docMeta);
        setWorks((prev) => [docMeta, ...prev]);
        lastAddedId = docMeta.id;
        tracker.trackCustomInteraction(
          'Диссертация: загрузка PDF в ридер',
          `${file.name} (${docMeta.sizeLabel})`
        );
      } catch {
        setUploadError(`Ошибка чтения файла «${file.name}». Попробуйте ещё раз.`);
      }
    }

    if (lastAddedId) {
      setCategoryFilter('all');
      setSelectedWorkId(lastAddedId);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteUploaded = async (work: AcademicWorkDocument, e: React.MouseEvent) => {
    e.stopPropagation();
    if (work.source !== 'uploaded') return;

    await removeUploadedAcademicWork(work.id);
    setWorks((prev) => {
      const next = prev.filter((item) => item.id !== work.id);
      if (selectedWorkId === work.id && next.length > 0) {
        setSelectedWorkId(next[0].id);
      }
      return next;
    });
    tracker.trackCustomInteraction('Диссертация: удаление загруженного PDF', work.fileName);
  };

  const handleDownloadActivePdf = () => {
    if (!selectedWork || !activeBytes) return;
    const copy = new Uint8Array(activeBytes.byteLength);
    copy.set(activeBytes);
    const blob = new Blob([copy.buffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = selectedWork.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    tracker.trackCustomInteraction(
      'Диссертация: скачивание PDF из ридера',
      selectedWork.fileName
    );
  };

  const handlePageInputCommit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number.parseInt(pageInput, 10);
    if (Number.isNaN(parsed)) {
      setPageInput(String(currentPage));
      return;
    }
    goToPage(parsed);
  };

  const pageNumbers = useMemo(
    () => Array.from({ length: totalPages }, (_, i) => i + 1),
    [totalPages]
  );

  const readerCardContent = (
    <div
      className={`bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col ${
        isExpanded ? 'w-full h-full max-w-[1440px] mx-auto shadow-2xl' : ''
      }`}
    >
      {/* Top Section Title Bar */}
      <div className="px-6 py-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-teal-700">
            <BookOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Встроенный PDF-ридер академических работ</span>
          </div>
          <h2 id="dissertation-pdf-reader-heading" className="text-xl font-bold text-slate-900">
            Чтение диссертации, автореферата, статей ВАК и собственных PDF-файлов
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
            Просматривайте академические материалы и загруженные PDF-рукописи прямо внутри
            раздела — с масштабированием, миниатюрами, поворотом и навигацией по страницам без
            перехода на сторонние сайты.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            onChange={(e) => handleFilesUpload(e.target.files)}
            className="hidden"
            aria-label="Загрузить академическую работу в формате PDF"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Загрузить PDF</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsExpanded((v) => !v);
              tracker.trackCustomInteraction(
                'Диссертация PDF-ридер: полноэкранный режим',
                !isExpanded ? 'открыт' : 'свернут'
              );
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg border border-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isExpanded ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Свернуть</span>
              </>
            ) : (
              <>
                <Expand className="w-3.5 h-3.5" aria-hidden="true" />
                <span>На весь экран</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Split Workspace: Left Library + Right Embedded PDF Canvas */}
      <div
        className={`grid grid-cols-1 lg:grid-cols-12 ${
          isExpanded ? 'flex-1 min-h-0' : ''
        }`}
      >
        {/* Left Sidebar: Library & Upload Dropzone */}
        <aside
          aria-label="Список академических работ"
          className={`lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50/70 p-4 sm:p-5 flex flex-col gap-4 ${
            isExpanded ? 'overflow-y-auto' : ''
          }`}
        >
          {/* Drag-and-drop Upload Box */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFilesUpload(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={`border-2 border-dashed rounded-xl p-3.5 text-center transition-colors cursor-pointer ${
              isDragging
                ? 'border-teal-600 bg-teal-50 text-teal-900'
                : 'border-slate-300 bg-white hover:border-teal-500 text-slate-600'
            }`}
          >
            <Upload className="w-4 h-4 mx-auto text-teal-700 mb-1" aria-hidden="true" />
            <p className="text-xs font-semibold text-slate-800">
              Перетащите PDF или нажмите для загрузки
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Диссертации, авторефераты, статьи (.pdf до 50 МБ)
            </p>
          </div>

          {uploadError && (
            <div
              role="alert"
              className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 leading-snug"
            >
              {uploadError}
            </div>
          )}

          {/* Category Filter Chips */}
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'all', label: 'Все' },
                { id: 'Диссертация', label: 'Диссертация' },
                { id: 'Автореферат', label: 'Автореферат' },
                { id: 'Статья ВАК', label: 'Статьи ВАК' },
                { id: 'Загруженный PDF', label: 'Мои PDF' },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                  categoryFilter === cat.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Works List */}
          <div className="space-y-2.5">
            {filteredWorks.length === 0 ? (
              <div className="p-4 bg-white border border-slate-200 rounded-lg text-xs text-slate-500 text-center">
                В этой категории пока нет документов. Загрузите свой PDF выше.
              </div>
            ) : (
              filteredWorks.map((work) => {
                const isSelected = work.id === selectedWork?.id;
                return (
                  <div
                    key={work.id}
                    onClick={() => {
                      setSelectedWorkId(work.id);
                      tracker.trackCustomInteraction(
                        'Диссертация PDF-ридер: выбор документа',
                        work.title
                      );
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedWorkId(work.id);
                      }
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer space-y-2 ${
                      isSelected
                        ? 'bg-white border-teal-600 shadow-xs ring-1 ring-teal-600/20'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-teal-800">
                        <FileText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{work.category}</span>
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <span className="font-mono text-slate-500 tabular-nums">{work.year}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                          {work.sizeLabel}
                        </span>
                        {work.source === 'uploaded' && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteUploaded(work, e)}
                            aria-label={`Удалить загруженный файл ${work.fileName}`}
                            title="Удалить загруженный PDF"
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>

                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                      {work.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {work.subtitle}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Workspace: Embedded PDF Toolbar + Viewport */}
        <div
          className={`lg:col-span-8 flex flex-col bg-slate-900 ${
            isExpanded ? 'min-h-0 flex-1' : ''
          }`}
        >
          {/* Reader Control Bar */}
          <div className="px-4 py-2.5 bg-slate-800 border-b border-slate-700 text-slate-200 flex flex-wrap items-center justify-between gap-2.5">
            {/* Page Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowThumbnails((v) => !v)}
                title="Миниатюры страниц"
                aria-label="Показать или скрыть миниатюры страниц"
                aria-pressed={showThumbnails}
                className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                  showThumbnails
                    ? 'bg-teal-700 border-teal-500 text-white'
                    : 'bg-slate-700/70 border-slate-600 text-slate-200 hover:bg-slate-700'
                }`}
              >
                <PanelLeft className="w-4 h-4" aria-hidden="true" />
              </button>

              <div className="h-4 w-px bg-slate-600 mx-0.5" aria-hidden="true" />

              <button
                type="button"
                disabled={currentPage <= 1 || isLoadingDoc}
                onClick={() => goToPage(currentPage - 1)}
                aria-label="Предыдущая страница"
                className="p-1.5 rounded-md bg-slate-700/70 border border-slate-600 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </button>

              <form onSubmit={handlePageInputCommit} className="inline-flex items-center gap-1.5">
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="Номер текущей страницы"
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onBlur={() => {
                    const parsed = Number.parseInt(pageInput, 10);
                    if (!Number.isNaN(parsed)) {
                      goToPage(parsed);
                    } else {
                      setPageInput(String(currentPage));
                    }
                  }}
                  className="w-11 px-1.5 py-1 text-center font-mono text-xs bg-slate-900 border border-slate-600 rounded text-white focus:outline-2 focus:outline-teal-400 tabular-nums"
                />
                <span className="font-mono text-xs text-slate-400 tabular-nums">
                  / {totalPages}
                </span>
              </form>

              <button
                type="button"
                disabled={currentPage >= totalPages || isLoadingDoc}
                onClick={() => goToPage(currentPage + 1)}
                aria-label="Следующая страница"
                className="p-1.5 rounded-md bg-slate-700/70 border border-slate-600 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Zoom, View Mode, Rotate & Download Controls */}
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="inline-flex items-center bg-slate-900/80 border border-slate-700 rounded-md p-0.5">
                <button
                  type="button"
                  disabled={zoom <= MIN_PDF_ZOOM}
                  onClick={() => setZoom((z) => stepPdfZoom(z, -PDF_ZOOM_STEP))}
                  aria-label="Уменьшить масштаб"
                  title="Уменьшить"
                  className="p-1 text-slate-200 hover:text-white disabled:opacity-40 cursor-pointer"
                >
                  <ZoomOut className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  title="Сбросить масштаб к ширине окна"
                  className="px-2 font-mono text-[11px] font-semibold text-slate-200 hover:text-teal-300 tabular-nums cursor-pointer"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  disabled={zoom >= MAX_PDF_ZOOM}
                  onClick={() => setZoom((z) => stepPdfZoom(z, PDF_ZOOM_STEP))}
                  aria-label="Увеличить масштаб"
                  title="Увеличить"
                  className="p-1 text-slate-200 hover:text-white disabled:opacity-40 cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>

              <div
                role="tablist"
                aria-label="Режим прокрутки PDF"
                className="inline-flex items-center bg-slate-900/80 border border-slate-700 rounded-md p-0.5"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'single'}
                  onClick={() => setViewMode('single')}
                  title="Постраничный просмотр"
                  className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                    viewMode === 'single'
                      ? 'bg-teal-700 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Layers className="w-3 h-3" aria-hidden="true" />
                  <span className="hidden sm:inline">Страница</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'scroll'}
                  onClick={() => setViewMode('scroll')}
                  title="Непрерывная лента страниц"
                  className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                    viewMode === 'scroll'
                      ? 'bg-teal-700 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <ScrollText className="w-3 h-3" aria-hidden="true" />
                  <span className="hidden sm:inline">Лента</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setRotation((r) => rotatePdfQuarterTurn(r))}
                aria-label="Повернуть страницы на 90 градусов"
                title="Повернуть на 90°"
                className="p-1.5 rounded-md bg-slate-700/70 border border-slate-600 hover:bg-slate-700 text-slate-200 cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
              </button>

              <button
                type="button"
                disabled={!activeBytes}
                onClick={handleDownloadActivePdf}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 border border-slate-500 text-xs font-medium text-white disabled:opacity-40 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Скачать PDF</span>
              </button>
            </div>
          </div>

          {/* Active File Metadata Strip */}
          {selectedWork && (
            <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
              <span className="font-medium text-slate-100 truncate max-w-xl">
                {selectedWork.fileName}
              </span>
              <span className="font-mono text-slate-400 tabular-nums shrink-0">
                {selectedWork.specialtyCode} · {selectedWork.sizeLabel} · {totalPages} стр.
              </span>
            </div>
          )}

          {/* Thumbnails + Scrollable Canvas Stage */}
          <div className={`flex flex-1 min-h-0 ${isExpanded ? '' : 'h-[640px]'}`}>
            {showThumbnails && pdfDoc && (
              <div className="w-36 shrink-0 border-r border-slate-800 bg-slate-950/70 p-2.5 overflow-y-auto space-y-2.5">
                {pageNumbers.map((num) => (
                  <PdfThumbnail
                    key={`${selectedWork.id}-thumb-${num}`}
                    pdfDoc={pdfDoc}
                    pageNumber={num}
                    isActive={num === currentPage}
                    onSelect={(page) => goToPage(page)}
                  />
                ))}
              </div>
            )}

            <div
              ref={stageRef}
              className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-800/80 space-y-5"
            >
              {isLoadingDoc && (
                <div className="h-full min-h-[360px] flex flex-col items-center justify-center text-slate-300 gap-3 text-xs">
                  <div className="w-7 h-7 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                  <span>Загрузка PDF-документа во встроенный ридер…</span>
                </div>
              )}

              {!isLoadingDoc && docError && (
                <div className="max-w-lg mx-auto my-12 p-5 bg-slate-900 border border-red-500/40 rounded-xl text-xs text-red-200 space-y-2">
                  <p className="font-semibold text-red-300">Ошибка отображения PDF</p>
                  <p className="leading-relaxed">{docError}</p>
                </div>
              )}

              {!isLoadingDoc && !docError && pdfDoc && (
                <>
                  {viewMode === 'single' ? (
                    <PdfPageCanvas
                      key={`${selectedWork.id}-p-${currentPage}`}
                      pdfDoc={pdfDoc}
                      pageNumber={currentPage}
                      containerWidth={stageWidth}
                      zoom={zoom}
                      rotation={rotation}
                    />
                  ) : (
                    <div className="space-y-6">
                      {pageNumbers.map((num) => (
                        <PdfPageCanvas
                          key={`${selectedWork.id}-scroll-p-${num}`}
                          pdfDoc={pdfDoc}
                          pageNumber={num}
                          containerWidth={stageWidth}
                          zoom={zoom}
                          rotation={rotation}
                          pageRef={(el) => {
                            if (el) pageRefs.current.set(num, el);
                            else pageRefs.current.delete(num);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (isExpanded) {
    return (
      <section aria-labelledby="dissertation-pdf-reader-heading">
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs p-3 sm:p-6 flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dissertation-pdf-reader-heading"
        >
          {readerCardContent}
        </div>
      </section>
    );
  }

  return (
    <section
      id="dissertation-pdf-reader"
      aria-labelledby="dissertation-pdf-reader-heading"
    >
      {readerCardContent}
    </section>
  );
};
