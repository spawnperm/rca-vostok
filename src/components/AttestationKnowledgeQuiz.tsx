import React, { useMemo, useState } from 'react';
import {
  BookOpenCheck,
  CheckCircle2,
  HelpCircle,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { tracker } from '../utils/tracker';

interface QuizOption {
  id: string;
  text: string;
}

interface QuizQuestion {
  id: string;
  topic: string;
  question: string;
  options: QuizOption[];
  correctOptionId: string;
  explanation: string;
  legalRef: string;
}

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1-validity',
    topic: 'Срок действия аттестации',
    question:
      'На какой срок действует аттестация инструктора-проводника и запись в Едином федеральном реестре?',
    options: [
      { id: 'a', text: '1 год (требуется ежегодное переподтверждение)' },
      { id: 'b', text: '3 года с момента прохождения полигона' },
      { id: 'c', text: '5 лет с последующим плановым подтверждением соответствия' },
      { id: 'd', text: 'Бессрочно при наличии диплома ДПО ВВГУ' },
    ],
    correctOptionId: 'c',
    explanation:
      'Удостоверение и реестровая запись инструктора-проводника действуют 5 лет. По истечении срока проводится плановое подтверждение соответствия требованиям.',
    legalRef: 'ФЗ № 132-ФЗ · ПП РФ № 1003',
  },
  {
    id: 'q2-route-passport',
    topic: 'Теоретический этап в ВВГУ',
    question:
      'Какой обязательный документ по маршруту соискатель готовит и защищает перед комиссией на теоретическом этапе?',
    options: [
      { id: 'a', text: 'Только трек маршрута в GPX без текстового описания' },
      {
        id: 'b',
        text: 'Паспорт туристского маршрута со схемой связи, контрольными сроками и точками эвакуации',
      },
      { id: 'c', text: 'Финансовую смету тура и договор аренды снаряжения' },
      { id: 'd', text: 'Справку о прохождении инструктажа на предприятии' },
    ],
    correctOptionId: 'b',
    explanation:
      'На теоретическом этапе ВВГУ и РЦА проверяется знание законодательства и защита паспорта маршрута, оформленного по установленной форме (нитка, риски, связь, ПСР).',
    legalRef: 'ПП РФ № 760 · Программа РЦА и ФСТР',
  },
  {
    id: 'q3-deadline-1893',
    topic: 'Обязательность реестра с 2026 года',
    question:
      'Что требуется для легального сопровождения туристов на маршрутах повышенной опасности и в ООПТ после 1 октября 2026 года?',
    options: [
      {
        id: 'a',
        text: 'Действующая запись в Едином федеральном реестре Минэкономразвития РФ и нагрудная карточка-бейдж',
      },
      { id: 'b', text: 'Достаточно внутреннего приказа туроператора без записи в реестре' },
      { id: 'c', text: 'Только членский билет спортивного клуба' },
      { id: 'd', text: 'Разрешение муниципалитета на разовый выход группы' },
    ],
    correctOptionId: 'a',
    explanation:
      'После завершения переходного периода (1 октября 2026 г.) выход на категорированные маршруты и маршруты ООПТ допускается только при наличии действующей записи в Едином реестре и бейджа.',
    legalRef: 'ПП РФ № 1003 (в ред. № 1893)',
  },
  {
    id: 'q4-fee-vs-duty',
    topic: 'Госпошлина и оплата аттестации',
    question:
      'Как регулируется оплата прохождения аттестации для физического лица — инструктора-проводника?',
    options: [
      { id: 'a', text: 'Уплачивается фиксированная налоговая госпошлина 1 300 ₽ в ФНС' },
      { id: 'b', text: 'Государственная пошлина по НК РФ составляет 5 000 ₽ за каждую категорию' },
      {
        id: 'c',
        text: 'Налоговая госпошлина по ст. 333.33 НК РФ не взимается (0 ₽); оплачивается процедура аттестации в уполномоченной организации по методике ПП РФ № 891',
      },
      { id: 'd', text: 'Аттестация полностью бесплатна для всех заявителей без сборов' },
    ],
    correctOptionId: 'c',
    explanation:
      'Поскольку аттестацию инструкторов-проводников проводят уполномоченные организации (ФСТР/РЦА), а не госорганы, налоговая госпошлина по ст. 333.33 НК РФ равна 0 ₽. Плата за экзамен рассчитывается по методике и предельным ставкам ПП РФ № 891.',
    legalRef: 'НК РФ ст. 333.33 · ПП РФ № 891 от 29.06.2024',
  },
  {
    id: 'q5-field-safety',
    topic: 'Полевой экзамен и специфика ДФО',
    question:
      'Какие практические компетенции проверяются на полевых испытаниях в Приморском крае (Шкотовский полигон)?',
    options: [
      { id: 'a', text: 'Только скорость бега по пересечённой местности без снаряжения' },
      { id: 'b', text: 'Знание экскурсионных объектов и архитектуры Владивостока' },
      {
        id: 'c',
        text: 'Ориентирование, организация переправ/спасработ, автономная первая помощь (WFA) и протокол действий при встрече с крупным хищником',
      },
      { id: 'd', text: 'Ведение налоговой отчётности самозанятого проводника' },
    ],
    correctOptionId: 'c',
    explanation:
      'Полевой этап оценивает реальную безопасность группы: работу со снаряжением и переправами, навыки Wilderness First Aid и региональные протоколы ДФО (медведь, тигр, эвакуация).',
    legalRef: 'Методика ФСТР · Стандарт РЦА «Русский Восток»',
  },
];

export const AttestationKnowledgeQuiz: React.FC = () => {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = QUIZ_QUESTIONS.length;

  const correctCount = useMemo(
    () =>
      QUIZ_QUESTIONS.filter((q) => answers[q.id] === q.correctOptionId).length,
    [answers]
  );

  const progressPct = Math.round((answeredCount / totalQuestions) * 100);
  const allAnswered = answeredCount === totalQuestions;

  const verdict = useMemo(() => {
    if (!allAnswered) return null;
    if (correctCount === 5) {
      return {
        badge: 'Высокая готовность · 5 из 5',
        title: 'Базовая нормативная и практическая подготовка подтверждена',
        summary:
          'Вы уверенно ориентируетесь в требованиях ФЗ № 132-ФЗ, ПП РФ № 1003/1893, правилах оплаты по ПП РФ № 891 и стандартах полевых испытаний РЦА.',
        toneClass: 'border-teal-300 bg-teal-50/70',
        badgeClass: 'bg-teal-700 text-white',
      };
    }
    if (correctCount >= 3) {
      return {
        badge: `Хорошая база · ${correctCount} из 5`,
        title: 'Есть понимание ключевых норм, стоит освежить отдельные детали',
        summary:
          'Рекомендуем перечитать пояснения к ошибочным пунктам (особенно по паспорту маршрута и структуре оплаты) перед записью на теоретическое тестирование в ВВГУ.',
        toneClass: 'border-amber-300 bg-amber-50/70',
        badgeClass: 'bg-amber-700 text-white',
      };
    }
    return {
      badge: `Требуется подготовка · ${correctCount} из 5`,
      title: 'Рекомендуем вводный курс ДПО на базе ВВГУ перед экзаменом',
      summary:
        'До подачи заявки стоит проработать нормативную базу (ФЗ № 132-ФЗ, ПП № 760, ПП № 891) и методику безопасности ДФО на подготовительном потоке РЦА.',
      toneClass: 'border-red-300 bg-red-50/70',
      badgeClass: 'bg-red-700 text-white',
    };
  }, [allAnswered, correctCount]);

  const handleSelectOption = (question: QuizQuestion, optionId: string) => {
    const isCorrect = optionId === question.correctOptionId;
    setAnswers((prev) => ({
      ...prev,
      [question.id]: optionId,
    }));
    tracker.trackCustomInteraction(
      `Тест «Готов ли я к аттестации»: ${question.topic}`,
      isCorrect ? 'верно' : 'ошибка'
    );
  };

  const handleReset = () => {
    setAnswers({});
    tracker.trackCustomInteraction('Тест «Готов ли я к аттестации»: сброс');
  };

  return (
    <section
      aria-labelledby="knowledge-quiz-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      {/* Header & Live Score */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5 max-w-3xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <BookOpenCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Экспресс-тест знаний соискателя (5 базовых вопросов)</span>
          </p>
          <h2
            id="knowledge-quiz-heading"
            className="text-xl sm:text-2xl font-bold text-slate-900"
          >
            Готов ли я к аттестации
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Проверьте знание сроков действия бейджа, структуры паспорта маршрута, правил
            госпошлины и стандартов полевого экзамена РЦА «Русский Восток» с мгновенным разбором
            каждого ответа.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-right font-mono tabular-nums">
            <p className="text-[11px] text-slate-500">Результат</p>
            <p className="text-sm font-bold text-slate-900">
              {correctCount} / {totalQuestions} верно
            </p>
          </div>
          {answeredCount > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Пройти заново</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-slate-500 font-mono tabular-nums">
          <span>
            Отвечено: {answeredCount} из {totalQuestions}
          </span>
          <span>{progressPct}%</span>
        </div>
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-700 transition-all duration-300"
            style={{ width: `${Math.max(progressPct, answeredCount > 0 ? 4 : 0)}%` }}
          />
        </div>
      </div>

      {/* 5 Questions List */}
      <div className="space-y-5">
        {QUIZ_QUESTIONS.map((q, idx) => {
          const selectedId = answers[q.id];
          const isAnswered = Boolean(selectedId);
          const isCorrect = selectedId === q.correctOptionId;

          return (
            <div
              key={q.id}
              className={`border rounded-xl p-5 transition-colors space-y-4 ${
                !isAnswered
                  ? 'border-slate-200 bg-white'
                  : isCorrect
                  ? 'border-teal-300 bg-teal-50/30'
                  : 'border-red-200 bg-red-50/20'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono font-semibold text-teal-800">
                  Вопрос 0{idx + 1} · {q.topic}
                </span>
                {isAnswered ? (
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-md ${
                      isCorrect
                        ? 'bg-teal-700 text-white'
                        : 'bg-red-700 text-white'
                    }`}
                  >
                    {isCorrect ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Верно</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Есть ошибка</span>
                      </>
                    )}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                    <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Выберите один вариант</span>
                  </span>
                )}
              </div>

              <h3 className="text-sm sm:text-base font-semibold text-slate-900 leading-snug">
                {q.question}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {q.options.map((opt) => {
                  const chosen = selectedId === opt.id;
                  const optionIsCorrect = opt.id === q.correctOptionId;

                  let buttonStyle =
                    'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100 hover:border-slate-300';
                  if (isAnswered) {
                    if (optionIsCorrect) {
                      buttonStyle =
                        'bg-teal-50 border-teal-600 text-teal-950 font-medium';
                    } else if (chosen && !optionIsCorrect) {
                      buttonStyle =
                        'bg-red-50 border-red-500 text-red-900 font-medium';
                    } else {
                      buttonStyle = 'bg-white border-slate-200 text-slate-500 opacity-75';
                    }
                  }

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectOption(q, opt.id)}
                      aria-pressed={chosen}
                      className={`p-3 text-left rounded-lg border text-xs leading-relaxed transition-colors cursor-pointer flex items-start gap-2.5 ${buttonStyle}`}
                    >
                      <span className="font-mono font-semibold uppercase text-[11px] mt-0.5 shrink-0">
                        {opt.id}.
                      </span>
                      <span className="flex-1">{opt.text}</span>
                    </button>
                  );
                })}
              </div>

              {/* Instant Feedback Box */}
              {isAnswered && (
                <div
                  role="status"
                  className={`rounded-lg p-3.5 text-xs leading-relaxed border ${
                    isCorrect
                      ? 'bg-white border-teal-200 text-slate-700'
                      : 'bg-white border-red-200 text-slate-700'
                  }`}
                >
                  <p className="font-semibold text-slate-900 mb-1">
                    {isCorrect
                      ? 'Верный ответ — мгновенное подтверждение:'
                      : 'Пояснение и правильный ориентир:'}
                  </p>
                  <p>{q.explanation}</p>
                  <p className="mt-1.5 text-[11px] font-mono text-teal-800">
                    Нормативная база: {q.legalRef}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Final Verdict Card */}
      {verdict && (
        <div className={`border rounded-xl p-5 sm:p-6 space-y-2 ${verdict.toneClass}`}>
          <span
            className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold ${verdict.badgeClass}`}
          >
            {verdict.badge}
          </span>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 pt-1">
            {verdict.title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            {verdict.summary}
          </p>
        </div>
      )}
    </section>
  );
};
