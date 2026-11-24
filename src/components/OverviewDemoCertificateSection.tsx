import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Award, CheckCircle2, Download, FileCheck2, Image as ImageIcon } from 'lucide-react';
import {
  buildOverviewDemoCertificateData,
  generateOverviewDemoCertificatePdf,
  renderOverviewDemoCertificateToCanvas,
  type GeneratedOverviewDemoCertificatePdf,
} from '../utils/overviewDemoCertificatePdf';
import { DFO_CORE_SIX_REGIONS } from '../data/dfoRegions';
import { tracker } from '../utils/tracker';

const DEMO_TRACKS = [
  'Пешеходный туризм',
  'Водный туризм и сплавы',
  'Горный / экспедиционный туризм',
  'Автомобильный туризм',
] as const;

const DEMO_CATEGORIES = [
  '1 категория сложности (экотропы и базовые маршруты)',
  '1–2 категория сложности (коммерческие туры ДФО)',
  '3–4 категория сложности (экспедиционные маршруты)',
] as const;

const DEMO_CONTOURS = [
  'Контур А (зачёт подтверждённого стажа)',
  'Контур Б (программа ДПО ВВГУ 250 ч + экзамен)',
] as const;

export const OverviewDemoCertificateSection: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fullName, setFullName] = useState<string>('Соколов Алексей Владимирович');
  const [region, setRegion] = useState<string>(DFO_CORE_SIX_REGIONS[0]);
  const [track, setTrack] = useState<string>(DEMO_TRACKS[0]);
  const [category, setCategory] = useState<string>(DEMO_CATEGORIES[1]);
  const [contour, setContour] = useState<string>(DEMO_CONTOURS[0]);
  const [readinessPercent, setReadinessPercent] = useState<number>(88);

  const [busyPdf, setBusyPdf] = useState<boolean>(false);
  const [generatedPdf, setGeneratedPdf] =
    useState<GeneratedOverviewDemoCertificatePdf | null>(null);
  const [error, setError] = useState<string | null>(null);

  const certData = useMemo(
    () =>
      buildOverviewDemoCertificateData({
        fullName,
        region,
        track,
        category,
        contour,
        readinessPercent,
      }),
    [fullName, region, track, category, contour, readinessPercent]
  );

  useEffect(() => {
    if (canvasRef.current) {
      renderOverviewDemoCertificateToCanvas(canvasRef.current, certData);
    }
  }, [certData]);

  useEffect(() => {
    const url = generatedPdf?.pdfBlobUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [generatedPdf?.pdfBlobUrl]);

  const handleDownloadPdf = () => {
    setError(null);
    setBusyPdf(true);
    try {
      const result = generateOverviewDemoCertificatePdf({
        fullName,
        region,
        track,
        category,
        contour,
        readinessPercent,
      });
      setGeneratedPdf(result);
      tracker.trackCustomInteraction(
        'Обзор · Скачать демо-сертификат (PDF)',
        `${result.data.certificateId}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сформировать PDF-отчёт.');
    } finally {
      setBusyPdf(false);
    }
  };

  const handleDownloadPng = () => {
    if (!canvasRef.current) return;
    renderOverviewDemoCertificateToCanvas(canvasRef.current, certData);
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `Demo_Certificate_${certData.certificateId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    tracker.trackCustomInteraction('Обзор · Скачать макет сертификата (PNG)', certData.certificateId);
  };

  return (
    <section
      id="overview-demo-certificate"
      aria-labelledby="overview-demo-cert-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 scroll-mt-24"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Демонстрационный генератор предварительной аттестации</span>
          </p>
          <h2 id="overview-demo-cert-heading" className="text-xl font-bold text-slate-900">
            Генератор демонстрационного сертификата инструктора-проводника
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Введите ФИО и параметры вашей подготовки, чтобы в реальном времени получить визуальный
            макет сертификата предварительной аттестации и выгрузить PDF-отчёт.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={busyPdf}
            className="px-4 py-2.5 bg-teal-700 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-teal-800 disabled:opacity-50 transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>{busyPdf ? 'Формирование PDF…' : 'Скачать демо-сертификат'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPng}
            className="px-3.5 py-2.5 bg-white border border-slate-300 text-slate-800 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <ImageIcon className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>Скачать макет (PNG)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Form Controls */}
        <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="demo-cert-fullname" className="block text-xs font-semibold text-slate-700">
              ФИО инструктора-проводника
            </label>
            <input
              id="demo-cert-fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Например, Иванов Иван Иванович"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="demo-cert-region" className="block text-xs font-semibold text-slate-700">
                Регион ДФО
              </label>
              <select
                id="demo-cert-region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
              >
                {DFO_CORE_SIX_REGIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="demo-cert-track" className="block text-xs font-semibold text-slate-700">
                Направление туризма
              </label>
              <select
                id="demo-cert-track"
                value={track}
                onChange={(e) => setTrack(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
              >
                {DEMO_TRACKS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="demo-cert-category" className="block text-xs font-semibold text-slate-700">
              Категория сложности маршрутов
            </label>
            <select
              id="demo-cert-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
            >
              {DEMO_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="demo-cert-contour" className="block text-xs font-semibold text-slate-700">
              Образовательный контур
            </label>
            <select
              id="demo-cert-contour"
              value={contour}
              onChange={(e) => setContour(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
            >
              {DEMO_CONTOURS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="demo-cert-score" className="font-semibold text-slate-700">
                Итоговый результат предварительной проверки
              </label>
              <span className="font-mono font-bold text-teal-800 tabular-nums">
                {readinessPercent}%
              </span>
            </div>
            <input
              id="demo-cert-score"
              type="range"
              min={60}
              max={100}
              step={2}
              value={readinessPercent}
              onChange={(e) => setReadinessPercent(Number(e.target.value))}
              className="w-full accent-teal-700 cursor-pointer"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-700 font-medium">
              {error}
            </p>
          )}

          {generatedPdf && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3.5 space-y-2 text-xs text-emerald-950">
              <div className="inline-flex items-center gap-1.5 font-semibold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
                <span>PDF-отчёт «{generatedPdf.fileName}» сформирован</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={generatedPdf.pdfBlobUrl}
                  download={generatedPdf.fileName}
                  className="inline-flex items-center gap-1 font-semibold text-teal-800 underline underline-offset-2"
                >
                  <FileCheck2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Скачать повторно</span>
                </a>
                <span className="font-mono text-[11px] text-slate-600">
                  Код: {generatedPdf.data.certificateId}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Real-time Visual Mockup Canvas */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Визуальный макет предварительного сертификата (обновляется мгновенно)</span>
            <span className="font-mono text-slate-700">{certData.certificateId}</span>
          </div>
          <div className="border border-slate-300 rounded-xl overflow-hidden bg-slate-100 shadow-sm">
            <canvas
              ref={canvasRef}
              aria-label={`Макет демонстрационного сертификата для ${certData.fullName}`}
              className="w-full h-auto block"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
