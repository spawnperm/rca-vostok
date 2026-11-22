import React, { useEffect, useState } from 'react';
import { CheckCircle2, MessageSquare, Send } from 'lucide-react';
import { tracker } from '../utils/tracker';

export type PlatformFeedbackType =
  | 'suggestion'
  | 'question'
  | 'data_correction'
  | 'technical_issue';

interface PlatformFeedbackFormProps {
  onOpenCuratorModal: (sourceLabel: string) => void;
}

const FEEDBACK_TYPE_OPTIONS: {
  id: PlatformFeedbackType;
  label: string;
  placeholder: string;
}[] = [
  {
    id: 'suggestion',
    label: 'Предложение по платформе',
    placeholder:
      'Например: добавить экспорт расчёта потребности для конкретного муниципального округа или чек-лист снаряжения для сплавов',
  },
  {
    id: 'question',
    label: 'Вопрос по работе портала',
    placeholder:
      'Например: как интерпретировать коэффициент сезонности в калькуляторе или выгрузить презентацию для совещания?',
  },
  {
    id: 'data_correction',
    label: 'Уточнение данных и НПА',
    placeholder:
      'Например: обновление числа аттестованных специалистов в регионе ДФО или ссылка на новую редакцию документа',
  },
  {
    id: 'technical_issue',
    label: 'Техническое замечание',
    placeholder:
      'Опишите, в каком разделе и при каком действии возникла неточность отображения или ошибка интерфейса',
  },
];

const PLATFORM_MODULES = [
  'Весь портал РЦА «Русский Восток»',
  'Обзор центра',
  'Калькулятор и симулятор ДФО',
  'Рынок и геоаналитика ДФО',
  'Диссертация ВАК 5.2.3',
  'Презентации и режим защиты',
  'Аналитика и SEO-аудит',
];

export const PlatformFeedbackForm: React.FC<PlatformFeedbackFormProps> = ({
  onOpenCuratorModal,
}) => {
  const [feedbackType, setFeedbackType] = useState<PlatformFeedbackType>('suggestion');
  const [platformModule, setPlatformModule] = useState<string>(PLATFORM_MODULES[0]);
  const [senderName, setSenderName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    id: string;
    feedbackTypeLabel: string;
  } | null>(null);
  const [totalFeedback, setTotalFeedback] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/feedback/stats')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { totalFeedback?: number } | null) => {
        if (data && typeof data.totalFeedback === 'number') {
          setTotalFeedback(data.totalFeedback);
        }
      })
      .catch(() => {});
  }, []);

  const activeTypeOption =
    FEEDBACK_TYPE_OPTIONS.find((item) => item.id === feedbackType) ??
    FEEDBACK_TYPE_OPTIONS[0];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (senderName.trim().length < 2) {
      setError('Укажите ваше имя или название организации (не менее 2 символов).');
      return;
    }
    if (email.trim().length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError('Проверьте формат электронной почты или оставьте поле пустым.');
      return;
    }
    if (subject.trim().length < 3) {
      setError('Укажите краткую тему сообщения (не менее 3 символов).');
      return;
    }
    if (message.trim().length < 10) {
      setError('Подробно опишите ваше предложение или вопрос (не менее 10 символов).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName: senderName.trim(),
          email: email.trim(),
          feedbackType,
          platformModule,
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        id?: string;
        totalFeedback?: number;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Не удалось сохранить сообщение. Повторите попытку.');
      }

      setSuccess({
        id: data.id || 'registered',
        feedbackTypeLabel: activeTypeOption.label,
      });
      if (typeof data.totalFeedback === 'number') {
        setTotalFeedback(data.totalFeedback);
      }

      tracker.trackCustomInteraction(
        `Обратная связь по платформе: ${activeTypeOption.label}`,
        platformModule
      );

      setSenderName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при отправке обращения.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      aria-labelledby="platform-feedback-heading"
      className="bg-white border border-slate-200 rounded-xl p-8 space-y-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1 max-w-3xl">
          <p className="text-xs font-medium text-teal-700">
            Развитие портала · Помимо индивидуальных консультаций куратора
          </p>
          <h2
            id="platform-feedback-heading"
            className="text-xl font-bold text-slate-900 text-balance"
          >
            Форма обратной связи
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Оставьте предложение по новым функциям, вопрос о работе калькулятора, карт или
            аналитических разделов, а также сообщение об уточнении данных для команды проекта.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {totalFeedback !== null && (
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              Зарегистрировано обращений: {totalFeedback}
            </span>
          )}
          <button
            type="button"
            onClick={() => onOpenCuratorModal('Форма обратной связи: вопрос куратору')}
            className="px-3.5 py-2 bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <MessageSquare className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>Консультация куратора по аттестации</span>
          </button>
        </div>
      </div>

      {success ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="inline-flex items-center gap-2 text-teal-700 font-semibold text-sm">
            <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
            <span>Обращение принято</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            Спасибо за вклад в развитие платформы РЦА «Русский Восток»
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
            Категория: <span className="font-medium text-slate-900">{success.feedbackTypeLabel}</span>.
            Сообщение сохранено на сервере и передано в журнал доработки платформы. Идентификатор:{' '}
            <span className="font-mono text-slate-900">{success.id}</span>.
          </p>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Отправить ещё одно предложение
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-5 pt-2 border-t border-slate-200">
          {/* Category Segmented Control */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-slate-700">
              Тип обращения
            </span>
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg w-fit">
              {FEEDBACK_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFeedbackType(opt.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                    feedbackType === opt.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="pf-sender"
                className="block text-xs font-semibold text-slate-700"
              >
                Имя или организация <span className="text-red-700">*</span>
              </label>
              <input
                id="pf-sender"
                type="text"
                required
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Например, Игорь Волков / Турклуб ДВ"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="pf-email"
                className="block text-xs font-semibold text-slate-700"
              >
                Электронная почта (если нужен ответ)
              </label>
              <input
                id="pf-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.ru"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="pf-module"
                className="block text-xs font-semibold text-slate-700"
              >
                Раздел платформы
              </label>
              <select
                id="pf-module"
                value={platformModule}
                onChange={(e) => setPlatformModule(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
              >
                {PLATFORM_MODULES.map((mod) => (
                  <option key={mod} value={mod}>
                    {mod}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="pf-subject"
              className="block text-xs font-semibold text-slate-700"
            >
              Краткая тема <span className="text-red-700">*</span>
            </label>
            <input
              id="pf-subject"
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Кратко сформулируйте суть предложения или вопроса"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="pf-message"
                className="block text-xs font-semibold text-slate-700"
              >
                Предложение или вопрос по работе платформы <span className="text-red-700">*</span>
              </label>
              <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                {message.length} / 1200
              </span>
            </div>
            <textarea
              id="pf-message"
              rows={3}
              required
              maxLength={1200}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={activeTypeOption.placeholder}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 resize-y"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800"
            >
              {error}
            </div>
          )}

          <div className="pt-1 flex flex-wrap items-center justify-between gap-4">
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-teal-700 text-white text-sm font-semibold rounded-lg hover:bg-teal-800 disabled:opacity-50 inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              <span>{submitting ? 'Отправка…' : 'Отправить обратную связь'}</span>
            </button>
            <p className="text-xs text-slate-500">
              Вопросы о допуске, стаже и экзаменах можно также направить напрямую куратору РЦА.
            </p>
          </div>
        </form>
      )}
    </section>
  );
};
