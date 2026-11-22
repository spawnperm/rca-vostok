import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Compass,
  MessageSquare,
  RotateCcw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { tracker } from '../utils/tracker';

interface MiniQuizOption {
  id: string;
  label: string;
}

interface MiniQuizQuestion {
  id: string;
  category: string;
  prompt: string;
  options: MiniQuizOption[];
  correctId: string;
  feedbackCorrect: string;
  feedbackIncorrect: string;
}

const MINI_QUIZ_QUESTIONS: MiniQuizQuestion[] = [
  {
    id: 'mq-1',
    category: 'Срок действия',
    prompt: 'На какой срок выдаётся аттестация инструктора-проводника и запись в Едином федеральном реестре?',
    options: [
      { id: 'a', label: 'На 3 года' },
      { id: 'b', label: 'На 5 лет' },
      { id: 'c', label: 'Бессрочно' },
    ],
    correctId: 'b',
    feedbackCorrect:
      'Верно: согласно ФЗ № 132-ФЗ и ПП РФ № 1003 аттестация действует 5 лет, после чего проводится плановое подтверждение.',
    feedbackIncorrect:
      'Правильный ответ — 5 лет (ФЗ № 132-ФЗ и ПП РФ № 1003). По истечении 5 лет запись подтверждается повторно.',
  },
  {
    id: 'mq-2',
    category: 'Пакет документов',
    prompt: 'Какой медицинский документ обязателен для допуска к практическому этапу аттестации?',
    options: [
      { id: 'a', label: 'Действующая медицинская справка-допуск к физическим нагрузкам и работе на маршруте' },
      { id: 'b', label: 'Достаточно устного заявления соискателя об отсутствии жалоб' },
      { id: 'c', label: 'Полис ДМС без заключения врача' },
    ],
    correctId: 'a',
    feedbackCorrect:
      'Верно: действующее медицинское заключение-допуск входит в обязательный пакет документов на этапе регистрации.',
    feedbackIncorrect:
      'Обязательно требуется действующая медицинская справка-допуск от медорганизации — без неё комиссия не допускает к полигону.',
  },
  {
    id: 'mq-3',
    category: 'Подтверждение опыта',
    prompt: 'Как действующий гид-практик без профильного диплома может подтвердить квалификацию в ВВГУ?',
    options: [
      { id: 'a', label: 'Никак — требуется заново отучиться в вузе 4 года' },
      { id: 'b', label: 'По Контуру А (зачёт маршрутных книжек, справок ФСТР или договоров туроператоров)' },
      { id: 'c', label: 'Достаточно отзывов туристов в социальных сетях' },
    ],
    correctId: 'b',
    feedbackCorrect:
      'Верно: двухконтурная модель ВВГУ и РЦА позволяет опытным практикам зачесть подтверждённый походный стаж по Контуру А.',
    feedbackIncorrect:
      'Для опытных практиков предусмотрен Контур А: верификация походного стажа по маршрутным книжкам, справкам или договорам.',
  },
  {
    id: 'mq-4',
    category: 'Полевой этап в Приморье',
    prompt: 'Где РЦА «Русский Восток» проводит полевые испытания (переправы, ориентирование, WFA)?',
    options: [
      { id: 'a', label: 'Только в компьютерном классе во Владивостоке' },
      { id: 'b', label: 'На природных полигонах Шкотовского района и реках Приморского края' },
      { id: 'c', label: 'Исключительно в Москве' },
    ],
    correctId: 'b',
    feedbackCorrect:
      'Верно: теория и защита паспорта маршрута проходят в ВВГУ, а полевые испытания — на полигонах Шкотовского района и реках края.',
    feedbackIncorrect:
      'Полевой этап проходит очно на природных полигонах Шкотовского района и реках Приморского края (после теоретического блока в ВВГУ).',
  },
  {
    id: 'mq-5',
    category: 'Оплата и госпошлина',
    prompt: 'Взимается ли с инструктора-проводника налоговая госпошлина по ст. 333.33 НК РФ?',
    options: [
      { id: 'a', label: 'Нет (0 ₽) — оплачивается регламентированная процедура аттестации по ПП РФ № 891' },
      { id: 'b', label: 'Да, 5 000 ₽ в налоговую инспекцию' },
      { id: 'c', label: 'Да, 1 300 ₽ ежемесячно' },
    ],
    correctId: 'a',
    feedbackCorrect:
      'Верно: налоговая пошлина по НК РФ равна 0 ₽, так как экзамен принимает уполномоченная организация по методике ПП РФ № 891.',
    feedbackIncorrect:
      'Налоговая госпошлина по ст. 333.33 НК РФ для инструкторов-проводников не установлена (0 ₽); оплачивается экзамен по ПП РФ № 891.',
  },
];

interface CenterReadinessMiniQuizProps {
  onContactCurator?: (sourceLabel: string) => void;
  onApplyForSession?: () => void;
}

export const CenterReadinessMiniQuiz: React.FC<CenterReadinessMiniQuizProps> = ({
  onContactCurator,
  onApplyForSession,
}) => {
  const [selectedByQuestion, setSelectedByQuestion] = useState<Record<string, string>>({});

  const answeredCount = Object.keys(selectedByQuestion).length;
  const totalCount = MINI_QUIZ_QUESTIONS.length;
  const correctCount = useMemo(
    () =>
      MINI_QUIZ_QUESTIONS.filter((q) => selectedByQuestion[q.id] === q.correctId).length,
    [selectedByQuestion]
  );

  const isComplete = answeredCount === totalCount;
  const progressPct = Math.round((answeredCount / totalCount) * 100);

  const summary = useMemo(() => {
    if (!isComplete) return null;
    if (correctCount === totalCount) {
      return {
        badge: 'Максимальная готовность · 5/5',
        title: 'Вы отлично ориентируетесь в требованиях аттестации РЦА',
        text: 'Вы знаете ключевые правила допуска, сроки действия реестровой записи и формат полевых испытаний. Можно переходить к сбору пакета документов и записи на сессию.',
        cardClass: 'border-teal-300 bg-teal-50/70',
        badgeClass: 'bg-teal-700 text-white',
      };
    }
    if (correctCount >= 3) {
      return {
        badge: `Хорошая готовность · ${correctCount}/5`,
        title: 'Базовые требования понятны, осталось уточнить детали',
        text: 'Просмотрите пояснения к вопросам с ошибками и проверьте пакет документов. При необходимости куратор РЦА подскажет оптимальный трек (Контур А или ДПО ВВГУ).',
        cardClass: 'border-amber-300 bg-amber-50/70',
        badgeClass: 'bg-amber-700 text-white',
      };
    }
    return {
      badge: `Нужна подготовка · ${correctCount}/5`,
      title: 'Рекомендуем вводную консультацию и подготовительный курс ВВГУ',
      text: 'Перед подачей заявки изучите материалы раздела «База знаний» ниже или запишитесь на профильную программу ДПО ВВГУ с разбором паспорта маршрута и практики.',
      cardClass: 'border-red-300 bg-red-50/70',
      badgeClass: 'bg-red-700 text-white',
    };
  }, [isComplete, correctCount, totalCount]);

  const selectAnswer = (question: MiniQuizQuestion, optionId: string) => {
    const ok = optionId === question.correctId;
    setSelectedByQuestion((prev) => ({
      ...prev,
      [question.id]: optionId,
    }));
    tracker.trackCustomInteraction(
      `Мини-тест Обзора центра: ${question.category}`,
      ok ? 'верно' : 'ошибка'
    );
  };

  const resetQuiz = () => {
    setSelectedByQuestion({});
    tracker.trackCustomInteraction('Мини-тест «Готовы ли вы к аттестации?»: сброс');
  };

  return (
    <section
      aria-labelledby="center-mini-quiz-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Мини-тест самооценки · 5 вопросов</span>
          </div>
          <h2 id="center-mini-quiz-heading" className="text-xl font-bold text-slate-900">
            Готовы ли вы к аттестации?
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Быстрая проверка знаний процедуры, документов и условий прохождения аттестации в
            РЦА «Русский Восток» с мгновенной обратной связью по итогам.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-right font-mono tabular-nums">
            <p className="text-[11px] text-slate-500">Ответов / верно</p>
            <p className="text-sm font-bold text-slate-900">
              {answeredCount}/{totalCount} · {correctCount} верно
            </p>
          </div>
          {answeredCount > 0 && (
            <button
              type="button"
              onClick={resetQuiz}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Сбросить</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-teal-700 transition-all duration-300"
          style={{ width: `${Math.max(progressPct, answeredCount > 0 ? 4 : 0)}%` }}
        />
      </div>

      {/* Questions */}
      <div className="grid grid-cols-1 gap-4">
        {MINI_QUIZ_QUESTIONS.map((q, index) => {
          const chosenId = selectedByQuestion[q.id];
          const answered = Boolean(chosenId);
          const isRight = chosenId === q.correctId;

          return (
            <div
              key={q.id}
              className={`border rounded-xl p-4 sm:p-5 space-y-3 transition-colors ${
                !answered
                  ? 'border-slate-200 bg-white'
                  : isRight
                  ? 'border-teal-300 bg-teal-50/30'
                  : 'border-red-200 bg-red-50/20'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono font-semibold text-teal-800">
                  0{index + 1}. {q.category}
                </span>
                {answered && (
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded ${
                      isRight ? 'bg-teal-700 text-white' : 'bg-red-700 text-white'
                    }`}
                  >
                    {isRight ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                        <span>Верно</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3" aria-hidden="true" />
                        <span>Неверно</span>
                      </>
                    )}
                  </span>
                )}
              </div>

              <p className="text-sm font-semibold text-slate-900 leading-snug">{q.prompt}</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {q.options.map((opt) => {
                  const isSelected = chosenId === opt.id;
                  const isCorrectOpt = opt.id === q.correctId;

                  let style =
                    'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100';
                  if (answered) {
                    if (isCorrectOpt) {
                      style = 'bg-teal-50 border-teal-600 text-teal-950 font-medium';
                    } else if (isSelected) {
                      style = 'bg-red-50 border-red-500 text-red-900 font-medium';
                    } else {
                      style = 'bg-white border-slate-200 text-slate-400';
                    }
                  }

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => selectAnswer(q, opt.id)}
                      aria-pressed={isSelected}
                      className={`p-3 text-left rounded-lg border text-xs leading-relaxed transition-colors cursor-pointer ${style}`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {answered && (
                <p
                  role="status"
                  className="text-xs text-slate-700 bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 leading-relaxed"
                >
                  {isRight ? q.feedbackCorrect : q.feedbackIncorrect}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Feedback Banner */}
      {summary && (
        <div
          className={`border rounded-xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 ${summary.cardClass}`}
        >
          <div className="space-y-1.5 max-w-2xl">
            <span
              className={`inline-block px-2.5 py-1 text-[11px] font-semibold rounded-md ${summary.badgeClass}`}
            >
              {summary.badge}
            </span>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 pt-0.5">
              {summary.title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">{summary.text}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {onApplyForSession && (
              <button
                type="button"
                onClick={onApplyForSession}
                className="px-4 py-2.5 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Записаться на сессию</span>
              </button>
            )}
            {onContactCurator && (
              <button
                type="button"
                onClick={() =>
                  onContactCurator(`Мини-тест «Готовы ли вы к аттестации?» (${correctCount}/5)`)
                }
                className="px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
                <span>Спросить куратора</span>
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
