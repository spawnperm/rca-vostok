import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  MessageSquare,
  RotateCcw,
  Scale,
  XCircle,
} from 'lucide-react';
import { tracker } from '../utils/tracker';

export interface RegulatoryQuestion {
  id: string;
  normRef: string;
  topic: string;
  question: string;
  options: { id: string; text: string }[];
  correctId: string;
  explanation: string;
}

export const REGULATORY_TEST_QUESTIONS: readonly RegulatoryQuestion[] = [
  {
    id: 'reg-1',
    normRef: 'ФЗ № 132-ФЗ · ПП РФ № 1003 (ред. № 1893)',
    topic: 'Обязательность аттестации и дедлайн',
    question:
      'С какой даты наличие действующей записи в Едином федеральном реестре инструкторов-проводников стало обязательным для выхода на маршруты с особым сопровождением и в ООПТ?',
    options: [
      { id: 'a', text: 'С 1 января 2025 г. только для горных маршрутов 4 КС' },
      { id: 'b', text: 'После 1 октября 2026 г. (по итогам переходного периода ПП РФ № 1893)' },
      { id: 'c', text: 'С 1 января 2028 г. после запуска курортных кластеров' },
    ],
    correctId: 'b',
    explanation:
      'Постановление Правительства РФ № 1003 в редакции № 1893 установило вступление обновлённых правил с 1 марта 2026 г. и завершение переходного периода 1 октября 2026 г.',
  },
  {
    id: 'reg-2',
    normRef: 'ПП РФ № 760 · Регламент РЦА',
    topic: 'Паспорт туристского маршрута',
    question:
      'Какой документ по безопасности маршрута соискатель обязан оформить и защитить перед аттестационной комиссией в ВВГУ?',
    options: [
      {
        id: 'a',
        text: 'Паспорт туристского маршрута по форме ПП № 760 (нитка, риски, точки связи и эвакуации)',
      },
      { id: 'b', text: 'Рекламный буклет тура с указанием стоимости трансфера' },
      { id: 'c', text: 'Только скриншот карты без расчёта контрольных сроков' },
    ],
    correctId: 'a',
    explanation:
      'Защита паспорта туристского маршрута по форме ПП РФ № 760 — обязательная часть теоретического этапа: проверяются тайминги, контрольные пункты связи, аварийные выходы и режим ООПТ.',
  },
  {
    id: 'reg-3',
    normRef: 'НК РФ ст. 333.33 · ПП РФ № 891 от 29.06.2024',
    topic: 'Налоговая госпошлина и плата за аттестацию',
    question:
      'Как законодательство регулирует уплату госпошлины и стоимость прохождения аттестации инструктором-проводником?',
    options: [
      { id: 'a', text: 'Уплачивается налоговая госпошлина 5 000 ₽ в ФНС за каждую заявку' },
      {
        id: 'b',
        text: 'Налоговая пошлина по ст. 333.33 НК РФ равна 0 ₽; оплачивается процедура аттестации в уполномоченной организации по методике ПП РФ № 891',
      },
      { id: 'c', text: 'Стоимость произвольно назначается каждым туроператором без нормативов' },
    ],
    correctId: 'b',
    explanation:
      'Государственная налоговая пошлина по НК РФ для инструкторов-проводников не взимается (0 ₽). Плата за проведение экзамена устанавливается уполномоченной организацией по методике ПП РФ № 891.',
  },
  {
    id: 'reg-4',
    normRef: 'ФЗ № 132-ФЗ · Приказ МЭР РФ',
    topic: 'Срок действия и территория действия бейджа',
    question:
      'На какой срок выдаётся аттестация инструктора-проводника и в каких субъектах РФ она действительна?',
    options: [
      { id: 'a', text: 'На 5 лет; действует на всей территории Российской Федерации' },
      { id: 'b', text: 'На 3 года; действует только в регионе выдачи (в Приморском крае)' },
      { id: 'c', text: 'На 1 год; требует отдельного подтверждения в каждом регионе ДФО' },
    ],
    correctId: 'a',
    explanation:
      'Реестровая запись и нагрудная карточка-бейдж действуют 5 лет по всей территории РФ. Поэтому гиды из Хабаровска, Камчатки и Сахалина проходят аттестацию в РЦА «Русский Восток».',
  },
  {
    id: 'reg-5',
    normRef: 'ПП РФ № 1003 · Двухконтурная модель ВВГУ',
    topic: 'Зачёт походного опыта и раздельная пересдача',
    question:
      'Что предусмотрено регламентом для действующих практиков при подтверждении стажа и при частичной сдаче этапов экзамена?',
    options: [
      { id: 'a', text: 'При ошибке на полигоне аннулируется даже успешно сданная теория' },
      {
        id: 'b',
        text: 'Опыт зачитывается по Контуру А (маршрутные книжки, справки ФСТР/договоры); теория и полевой этап фиксируются раздельно',
      },
      { id: 'c', text: 'Без высшего физкультурного образования допуск к экзамену закрыт навсегда' },
    ],
    correctId: 'b',
    explanation:
      'Действующие гиды подтверждают опыт через Контур А или программу ДПО ВВГУ (≈250 ч). Результаты теории и полевых испытаний учитываются раздельно — при несдаче полигона теорию пересдавать не нужно.',
  },
];

interface RegulatoryKnowledgeMiniTestProps {
  onApplyForSession: () => void;
  onContactCurator: (sourceLabel: string) => void;
}

export const RegulatoryKnowledgeMiniTest: React.FC<RegulatoryKnowledgeMiniTestProps> = ({
  onApplyForSession,
  onContactCurator,
}) => {
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [selectedById, setSelectedById] = useState<Record<string, string>>({});

  const total = REGULATORY_TEST_QUESTIONS.length;
  const activeQuestion = REGULATORY_TEST_QUESTIONS[currentIdx] ?? REGULATORY_TEST_QUESTIONS[0];
  const answeredCount = Object.keys(selectedById).length;
  const correctCount = useMemo(
    () =>
      REGULATORY_TEST_QUESTIONS.filter((q) => selectedById[q.id] === q.correctId).length,
    [selectedById]
  );

  const chosenOptionId = selectedById[activeQuestion.id];
  const isQuestionAnswered = Boolean(chosenOptionId);
  const isQuestionCorrect = chosenOptionId === activeQuestion.correctId;
  const allCompleted = answeredCount === total;

  const handleChoose = (optionId: string) => {
    if (isQuestionAnswered) return;
    setSelectedById((prev) => ({ ...prev, [activeQuestion.id]: optionId }));
    const ok = optionId === activeQuestion.correctId;
    tracker.trackCustomInteraction(
      `Мини-тест НПА: ${activeQuestion.topic}`,
      ok ? 'верно' : 'ошибка'
    );
  };

  const handleReset = () => {
    setSelectedById({});
    setCurrentIdx(0);
    tracker.trackCustomInteraction('Мини-тест НПА: сброс');
  };

  const scorePct = Math.round((correctCount / total) * 100);

  return (
    <section
      id="overview-regulatory-minitest"
      aria-labelledby="regulatory-minitest-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Проверка нормативной базы перед подачей заявки</span>
          </p>
          <h2 id="regulatory-minitest-heading" className="text-xl font-bold text-slate-900 text-balance">
            Мини-тест по законодательству об аттестации инструкторов-проводников
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Проверьте знание норм ФЗ № 132-ФЗ, ПП РФ № 1003/1893, паспортизации по ПП № 760 и
            правил оплаты по ПП № 891 до отправки документов в комиссию.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono tabular-nums text-right">
            <p className="text-[11px] text-slate-500">Пройдено / верно</p>
            <p className="text-sm font-bold text-slate-900">
              {answeredCount}/{total} · {correctCount} верно
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

      {/* Step Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Вопросы мини-теста НПА">
          {REGULATORY_TEST_QUESTIONS.map((q, idx) => {
            const ans = selectedById[q.id];
            const isActive = idx === currentIdx;
            const isRight = ans === q.correctId;

            return (
              <button
                key={q.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setCurrentIdx(idx)}
                className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                  isActive
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : ans
                    ? isRight
                      ? 'bg-teal-50 border-teal-300 text-teal-800'
                      : 'bg-red-50 border-red-300 text-red-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                0{idx + 1}
              </button>
            );
          })}
        </div>

        <span className="text-xs font-mono text-teal-800 tabular-nums">
          {activeQuestion.normRef}
        </span>
      </div>

      {/* Active Question Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span className="font-mono font-semibold text-teal-800 tabular-nums">
            Вопрос 0{currentIdx + 1} из 0{total} · {activeQuestion.topic}
          </span>
          {isQuestionAnswered && (
            <span
              className={`inline-flex items-center gap-1 font-semibold ${
                isQuestionCorrect ? 'text-teal-800' : 'text-red-700'
              }`}
            >
              {isQuestionCorrect ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Ответ верный</span>
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Требуется уточнение нормы</span>
                </>
              )}
            </span>
          )}
        </div>

        <h3 className="text-base sm:text-lg font-semibold text-slate-900 leading-snug">
          {activeQuestion.question}
        </h3>

        <div className="space-y-2.5">
          {activeQuestion.options.map((opt) => {
            const isSelected = chosenOptionId === opt.id;
            const isCorrect = opt.id === activeQuestion.correctId;

            let optionStyle =
              'bg-white border-slate-200 text-slate-800 hover:border-teal-600 hover:bg-teal-50/40';
            if (isQuestionAnswered) {
              if (isCorrect) {
                optionStyle = 'bg-teal-50 border-teal-600 text-teal-950 font-medium';
              } else if (isSelected) {
                optionStyle = 'bg-red-50 border-red-400 text-red-900 font-medium';
              } else {
                optionStyle = 'bg-white/60 border-slate-200 text-slate-400';
              }
            }

            return (
              <button
                key={opt.id}
                type="button"
                disabled={isQuestionAnswered}
                onClick={() => handleChoose(opt.id)}
                aria-pressed={isSelected}
                className={`w-full p-3.5 text-left rounded-lg border text-xs sm:text-sm leading-relaxed transition-colors flex items-start gap-3 ${
                  isQuestionAnswered ? 'cursor-default' : 'cursor-pointer'
                } ${optionStyle}`}
              >
                <span className="font-mono font-bold uppercase text-xs mt-0.5 shrink-0">
                  {opt.id}.
                </span>
                <span className="flex-1">{opt.text}</span>
              </button>
            );
          })}
        </div>

        {isQuestionAnswered && (
          <div
            role="status"
            className="bg-white border border-slate-200 rounded-lg p-4 text-xs sm:text-sm text-slate-700 leading-relaxed space-y-2"
          >
            <p className="font-semibold text-slate-900">
              Нормативное разъяснение ({activeQuestion.normRef}):
            </p>
            <p>{activeQuestion.explanation}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Предыдущий вопрос
          </button>

          {currentIdx < total - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentIdx((i) => Math.min(total - 1, i + 1))}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>Следующий вопрос</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onApplyForSession}
              className="px-4 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>Перейти к подаче заявки</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Completion Verdict */}
      {allCompleted && (
        <div
          role="region"
          aria-live="polite"
          className={`border rounded-xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            correctCount >= 4
              ? 'border-teal-300 bg-teal-50/70'
              : 'border-amber-300 bg-amber-50/70'
          }`}
        >
          <div className="space-y-1 max-w-2xl">
            <p className="text-xs font-mono font-semibold text-slate-700 tabular-nums">
              Итог проверки НПА: {correctCount} из {total} ({scorePct}%)
            </p>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              {correctCount >= 4
                ? 'Нормативная база освоена — можно переходить к оформлению заявки'
                : 'Рекомендуем уточнить отдельные нормы и посетить методический вебинар'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {correctCount >= 4
                ? 'Вы уверенно ориентируетесь в требованиях ФЗ № 132-ФЗ, ПП РФ № 1003/1893, паспорте маршрута ПП № 760 и порядке оплаты по ПП № 891.'
                : 'Просмотрите пояснения к вопросам выше или проконсультируйтесь с куратором РЦА по зачёту стажа (Контур А) и структуре паспорта маршрута.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onApplyForSession}
              className="px-4 py-2.5 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Подать заявку</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() =>
                onContactCurator(`Мини-тест НПА (${correctCount}/${total})`)
              }
              className="px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
              <span>Уточнить у куратора</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
