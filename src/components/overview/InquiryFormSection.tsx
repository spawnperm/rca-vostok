import React, { useEffect, useState } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import { DFO_INQUIRY_REGIONS } from '../../data/dfoRegions';
import { submitCenterInquiry, validateCenterInquiry } from '../../utils/inquiryApi';

export interface InquiryFormSectionProps {
  defaultRegion: string;
  defaultTrack: string;
  onSubmitted?: (payload: {
    id: string;
    createdAt: string;
    totalSubscriptions?: number;
  }) => void;
}

export const InquiryFormSection: React.FC<InquiryFormSectionProps> = ({
  defaultRegion,
  defaultTrack,
  onSubmitted,
}) => {
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [contactChannel, setContactChannel] = useState<string>('');
  const [region, setRegion] = useState<string>(defaultRegion);
  const [track, setTrack] = useState<string>(defaultTrack);
  const [experienceNote, setExperienceNote] = useState<string>('');
  const [consentAccepted, setConsentAccepted] = useState<boolean>(false);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<{ id: string; createdAt: string } | null>(null);

  useEffect(() => {
    setRegion(defaultRegion);
  }, [defaultRegion]);

  useEffect(() => {
    setTrack(defaultTrack);
  }, [defaultTrack]);

  const handleInquirySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    const payload = {
      fullName,
      email,
      contactChannel,
      region,
      track,
      experienceNote,
      consentAccepted,
    };

    const validationError = validateCenterInquiry(payload, {
      requireNote: false,
      consentMessage: 'Подтвердите согласие на получение уведомлений о сроках аттестации.',
    });
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setFormSubmitting(true);
    try {
      const result = await submitCenterInquiry(payload, `Подписка на аттестацию: ${track}`);
      setFormSuccess({ id: result.id, createdAt: result.createdAt });
      onSubmitted?.(result);
      setFullName('');
      setEmail('');
      setContactChannel('');
      setExperienceNote('');
      setConsentAccepted(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Ошибка отправки формы.');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <section
      id="inquiry-section"
      aria-labelledby="inquiry-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 scroll-mt-24"
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
          Прямая подача заявки в РЦА
        </p>
        <h2 id="inquiry-heading" className="text-xl font-bold text-slate-900 text-balance">
          Запись на аттестацию или программа переподготовки ВВГУ
        </h2>
        <p className="text-sm text-slate-600">
          Заявка сохраняется в журнале центра; статус можно отслеживать в личном кабинете.
        </p>
      </div>

      {formSuccess ? (
        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
          <div className="inline-flex items-center gap-2 text-emerald-800 font-semibold text-sm">
            <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
            <span>Заявка зарегистрирована</span>
          </div>
          <p className="text-sm text-slate-700">
            Регистрационный номер:{' '}
            <span className="font-mono font-semibold text-slate-900">{formSuccess.id}</span>.
            Куратор направит расписание ближайших сессий на указанный email.
          </p>
          <button
            type="button"
            onClick={() => setFormSuccess(null)}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            Отправить ещё одну заявку
          </button>
        </div>
      ) : (
        <form onSubmit={handleInquirySubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="inq-fullname" className="block text-xs font-semibold text-slate-700">
                ФИО или наименование турклуба
              </label>
              <input
                id="inq-fullname"
                name="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Иванов Сергей Алексеевич"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="inq-email" className="block text-xs font-semibold text-slate-700">
                Электронная почта
              </label>
              <input
                id="inq-email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="guide@example.ru"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="inq-contact" className="block text-xs font-semibold text-slate-700">
                Телефон или Telegram
              </label>
              <input
                id="inq-contact"
                name="contactChannel"
                type="text"
                value={contactChannel}
                onChange={(e) => setContactChannel(e.target.value)}
                placeholder="+7 999 ... или @username"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="inq-region" className="block text-xs font-semibold text-slate-700">
                Субъект ДФО
              </label>
              <select
                id="inq-region"
                name="region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
              >
                {DFO_INQUIRY_REGIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="inq-track" className="block text-xs font-semibold text-slate-700">
                Направление аттестации
              </label>
              <select
                id="inq-track"
                name="track"
                value={track}
                onChange={(e) => setTrack(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
              >
                <option value="Пешеходный туризм">Пешеходный туризм</option>
                <option value="Водный туризм и сплавы">Водный туризм и сплавы</option>
                <option value="Автомобильный туризм">Автомобильный туризм</option>
                <option value="Переаттестация действующего гида">
                  Переаттестация действующего гида
                </option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="inq-note" className="block text-xs font-semibold text-slate-700">
              Походный опыт или вопрос комиссии (необязательно)
            </label>
            <textarea
              id="inq-note"
              name="experienceNote"
              rows={2}
              value={experienceNote}
              onChange={(e) => setExperienceNote(e.target.value)}
              placeholder="Например: вожу группы на Ливадийскую и в Лазовский заповедник, интересует зачёт стажа и даты осенней сессии"
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700 resize-y"
            />
          </div>

          <div className="flex items-start gap-2.5">
            <input
              id="inq-consent"
              type="checkbox"
              checked={consentAccepted}
              onChange={(e) => setConsentAccepted(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-teal-700 rounded cursor-pointer"
            />
            <label htmlFor="inq-consent" className="text-xs text-slate-600 leading-relaxed cursor-pointer">
              Согласен получать информационные обновления о сроках аттестации, расписании
              экзаменов РЦА «Русский Восток» и наборе на программы переподготовки ВВГУ.
            </label>
          </div>

          {formError && (
            <div
              role="alert"
              className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800"
            >
              {formError}
            </div>
          )}

          <div className="pt-1 flex flex-wrap items-center justify-between gap-4">
            <button
              type="submit"
              disabled={formSubmitting}
              className="px-5 py-2.5 bg-teal-700 text-white text-sm font-semibold rounded-lg hover:bg-teal-800 disabled:opacity-50 inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              <span>{formSubmitting ? 'Отправка…' : 'Отправить заявку'}</span>
            </button>
            <span className="text-xs text-slate-500">
              Контактные данные сохраняются на сервере и не публикуются
            </span>
          </div>
        </form>
      )}
    </section>
  );
};
