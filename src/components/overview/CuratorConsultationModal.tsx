import React, { useEffect, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { DFO_INQUIRY_REGIONS } from '../../data/dfoRegions';
import { submitCenterInquiry, validateCenterInquiry } from '../../utils/inquiryApi';

export interface CuratorConsultationModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitted?: (payload: { totalSubscriptions?: number }) => void;
}

export const CuratorConsultationModal: React.FC<CuratorConsultationModalProps> = ({
  open,
  onClose,
  onSubmitted,
}) => {
  const [curatorName, setCuratorName] = useState<string>('');
  const [curatorEmail, setCuratorEmail] = useState<string>('');
  const [curatorContact, setCuratorContact] = useState<string>('');
  const [curatorRegion, setCuratorRegion] = useState<string>('Приморский край');
  const [curatorTopic, setCuratorTopic] = useState<string>('Допуск и перечень документов');
  const [curatorQuestion, setCuratorQuestion] = useState<string>('');
  const [curatorConsent, setCuratorConsent] = useState<boolean>(false);
  const [curatorSubmitting, setCuratorSubmitting] = useState<boolean>(false);
  const [curatorError, setCuratorError] = useState<string | null>(null);
  const [curatorSuccess, setCuratorSuccess] = useState<{ id: string; topic: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setCuratorError(null);
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleCuratorSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCuratorError(null);

    const payload = {
      fullName: curatorName,
      email: curatorEmail,
      contactChannel: curatorContact,
      region: curatorRegion,
      track: `Консультация куратора: ${curatorTopic}`,
      experienceNote: curatorQuestion,
      consentAccepted: curatorConsent,
    };

    const validationError = validateCenterInquiry(payload, {
      requireNote: true,
      emailMessage: 'Укажите корректный адрес электронной почты для ответа куратора.',
      consentMessage: 'Подтвердите согласие на обработку обращения куратором РЦА.',
    });
    if (validationError) {
      setCuratorError(validationError);
      return;
    }

    setCuratorSubmitting(true);
    try {
      const result = await submitCenterInquiry(payload, `Консультация куратора: ${curatorTopic}`);
      setCuratorSuccess({ id: result.id, topic: curatorTopic });
      onSubmitted?.({ totalSubscriptions: result.totalSubscriptions });
      setCuratorName('');
      setCuratorEmail('');
      setCuratorContact('');
      setCuratorQuestion('');
      setCuratorConsent(false);
    } catch (err) {
      setCuratorError(err instanceof Error ? err.message : 'Ошибка отправки запроса.');
    } finally {
      setCuratorSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="curator-modal-title"
        className="w-full max-w-xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-50">
          <div className="space-y-1">
            <p className="text-xs font-medium text-teal-700">
              Индивидуальная консультация · РЦА «Русский Восток»
            </p>
            <h2 id="curator-modal-title" className="text-lg font-bold text-slate-900">
              Запрос куратору по вопросам аттестации
            </h2>
            <p className="text-xs text-slate-600">
              Куратор направления: Григорий Саранча (руководитель центра, ВВГУ)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно консультации"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {curatorSuccess ? (
            <div className="py-4 space-y-4">
              <div className="inline-flex items-center gap-2 text-teal-700 font-semibold text-sm">
                <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                <span>Запрос на консультацию отправлен</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Тема: <span className="font-medium text-slate-900">{curatorSuccess.topic}</span>.
                Номер обращения: <span className="font-mono">{curatorSuccess.id}</span>.
              </p>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => setCuratorSuccess(null)}
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Задать ещё вопрос
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCuratorSuccess(null);
                    onClose();
                  }}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-medium rounded-lg cursor-pointer"
                >
                  Закрыть
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCuratorSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={curatorName}
                  onChange={(e) => setCuratorName(e.target.value)}
                  placeholder="Ваше имя / ФИО"
                  aria-label="Имя или ФИО"
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <input
                  type="email"
                  required
                  value={curatorEmail}
                  onChange={(e) => setCuratorEmail(e.target.value)}
                  placeholder="Электронная почта"
                  aria-label="Электронная почта"
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={curatorContact}
                  onChange={(e) => setCuratorContact(e.target.value)}
                  placeholder="Телефон / Telegram"
                  aria-label="Телефон или Telegram"
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <select
                  value={curatorRegion}
                  onChange={(e) => setCuratorRegion(e.target.value)}
                  aria-label="Субъект ДФО"
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {DFO_INQUIRY_REGIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select
                  value={curatorTopic}
                  onChange={(e) => setCuratorTopic(e.target.value)}
                  aria-label="Тема вопроса"
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Допуск и перечень документов">Допуск и перечень документов</option>
                  <option value="Зачёт походного стажа (Контур А)">
                    Зачёт походного стажа (Контур А)
                  </option>
                  <option value="Обучение ДПО ВВГУ (Контур Б)">Обучение ДПО ВВГУ (Контур Б)</option>
                  <option value="Выездная комиссия в субъекте ДФО">
                    Выездная комиссия в субъекте ДФО
                  </option>
                </select>
              </div>
              <textarea
                rows={3}
                required
                value={curatorQuestion}
                onChange={(e) => setCuratorQuestion(e.target.value)}
                placeholder="Ваш вопрос куратору..."
                aria-label="Текст вопроса куратору"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg resize-y"
              />
              <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={curatorConsent}
                  onChange={(e) => setCuratorConsent(e.target.checked)}
                  className="mt-0.5 accent-teal-700"
                />
                <span>Согласен на обработку обращения куратором РЦА «Русский Восток»</span>
              </label>
              {curatorError && (
                <p
                  role="alert"
                  className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
                >
                  {curatorError}
                </p>
              )}
              <button
                type="submit"
                disabled={curatorSubmitting}
                className="px-4 py-2.5 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 disabled:opacity-50 cursor-pointer"
              >
                {curatorSubmitting ? 'Отправка…' : 'Отправить запрос куратору'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
