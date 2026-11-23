import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Award, Download, RefreshCw, ShieldCheck, X } from 'lucide-react';
import type { AttestationDiagnosticsEvaluation } from '../utils/attestationSelfDiagnostics';
import type { SessionUser } from '../utils/identityApi';
import {
  buildDemoCertificatePayload,
  renderDemoCertificateToCanvas,
} from '../utils/demoCertificateCanvas';
import { tracker } from '../utils/tracker';

interface DemoCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: SessionUser | null;
  evaluation: AttestationDiagnosticsEvaluation;
}

export const DemoCertificateModal: React.FC<DemoCertificateModalProps> = ({
  isOpen,
  onClose,
  user,
  evaluation,
}) => {
  const [candidateNameInput, setCandidateNameInput] = useState<string>(
    user?.fullName?.trim() || 'Кандидат РЦА «Русский Восток»'
  );
  const [renderNonce, setRenderNonce] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (user?.fullName?.trim()) {
      setCandidateNameInput(user.fullName.trim());
    }
  }, [user?.fullName]);

  const payload = useMemo(
    () =>
      buildDemoCertificatePayload({
        user,
        customCandidateName: candidateNameInput,
        evaluation,
      }),
    [user, candidateNameInput, evaluation]
  );

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // Draw certificate onto HTMLCanvasElement whenever payload changes or fonts finish loading
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    renderDemoCertificateToCanvas(canvasRef.current, payload);

    let cancelled = false;
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        if (!cancelled && canvasRef.current) {
          renderDemoCertificateToCanvas(canvasRef.current, payload);
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [isOpen, payload, renderNonce]);

  if (!isOpen) return null;

  const handleDownloadPng = () => {
    if (!canvasRef.current) return;
    // Re-render once synchronously before export to ensure latest edits
    renderDemoCertificateToCanvas(canvasRef.current, payload);
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `demo-certificate-rca-${payload.overallPercent}pct.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    tracker.trackCustomInteraction(
      `Демо-сертификат: скачивание PNG (${payload.overallPercent}%)`,
      'account'
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-certificate-modal-title"
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-4xl w-full p-5 sm:p-7 space-y-5 my-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-700">
              <Award className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>HTML5 Canvas · Визуальный демо-сертификат готовности</span>
            </div>
            <h3
              id="demo-certificate-modal-title"
              className="text-lg sm:text-xl font-bold text-slate-900"
            >
              Демо-сертификат о прохождении самодиагностики ({payload.overallPercent}%)
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно демо-сертификата"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Name Customizer */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-8 space-y-1">
            <label
              htmlFor="demo-cert-candidate-name"
              className="block text-xs font-semibold text-slate-700"
            >
              ФИО получателя на сертификате
            </label>
            <input
              id="demo-cert-candidate-name"
              type="text"
              maxLength={80}
              value={candidateNameInput}
              onChange={(e) => setCandidateNameInput(e.target.value)}
              placeholder="Введите фамилию, имя и отчество"
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <div className="sm:col-span-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRenderNonce((n) => n + 1)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Обновить предпросмотр</span>
            </button>
          </div>
        </div>

        {/* Live Canvas Output */}
        <div className="bg-slate-100 border border-slate-200 rounded-xl p-2 sm:p-3">
          <canvas
            ref={canvasRef}
            aria-label={`Демо-сертификат для ${payload.candidateName} с результатом ${payload.overallPercent}%`}
            className="w-full h-auto rounded-lg shadow-sm block bg-[#FAFAF7]"
          />
        </div>

        {/* Actions Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs text-slate-500 inline-flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
            <span>Учебный документ для самоподготовки · Код {payload.certificateId}</span>
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Закрыть
            </button>

            <button
              type="button"
              onClick={handleDownloadPng}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-teal-700 text-white rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Скачать демо-сертификат (PNG)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
